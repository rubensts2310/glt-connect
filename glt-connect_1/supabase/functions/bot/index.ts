import { admin, assignLead, catalogText, cors, json, openaiJSON } from "./_shared.ts";

const FIELDS = ["nombre", "modelo", "pago", "plazo", "parte_pago", "sala", "telefono"] as const;
const LABEL: Record<string, string> = {
  nombre: "su nombre", modelo: "modelo de interés o para qué usará el vehículo", pago: "contado o crédito; si es crédito, cuánto tiene para el enganche en quetzales (por ejemplo Q50,000)",
  plazo: "cuándo piensa comprar", parte_pago: "si tiene un vehículo para dar como parte de pago; si sí: si es de agencia o rodado, marca y modelo, y año", sala: "sala preferida (20 Calle o Liberación)",
  telefono: "teléfono y mejor horario para contactarle",
};

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["reply", "fields", "asked_field", "wants_human", "refused_field", "resumen"],
  properties: {
    reply: { type: "string" },
    fields: {
      type: "object", additionalProperties: false,
      required: ["nombre", "modelo", "uso", "pago", "enganche_pct", "enganche_monto", "plazo", "parte_pago", "parte_pago_tipo", "parte_pago_vehiculo", "parte_pago_anio", "sala", "telefono", "horario"],
      properties: {
        nombre: { type: ["string", "null"] },
        modelo: { type: ["string", "null"], description: "id del catálogo (x50, x70, dashing, x70plus, t1, x90plus, t1h, t2, t2h, t2h4x4, g700) o null" },
        uso: { type: ["string", "null"] },
        pago: { type: ["string", "null"], enum: ["contado", "credito", "no_sabe", null] },
        enganche_pct: { type: ["number", "null"] },
        enganche_monto: { type: ["number", "null"], description: "monto del enganche en quetzales" },
        plazo: { type: ["string", "null"], enum: ["inmediato", "1-3m", "3-6m", "6m+", null] },
        parte_pago: { type: ["string", "null"], enum: ["si", "no", null] },
        parte_pago_tipo: { type: ["string", "null"], enum: ["agencia", "rodado", null] },
        parte_pago_vehiculo: { type: ["string", "null"], description: "marca y modelo del vehículo que entrega" },
        parte_pago_anio: { type: ["number", "null"] },
        sala: { type: ["string", "null"], enum: ["20 Calle", "Liberación", null] },
        telefono: { type: ["string", "null"] },
        horario: { type: ["string", "null"] },
      },
    },
    asked_field: { type: ["string", "null"], enum: [...FIELDS, null] },
    wants_human: { type: "boolean" },
    refused_field: { type: ["string", "null"], enum: [...FIELDS, null] },
    resumen: { type: "string" },
  },
};

function missing(q: Record<string, unknown>) {
  return FIELDS.filter((f) => {
    if (f === "modelo") return !q.modelo && !q.uso;
    if (f === "pago") return !q.pago || (q.pago === "credito" && !q.enganche_monto && !q.enganche_pct);
    if (f === "parte_pago") return !q.parte_pago || (q.parte_pago === "si" && (!q.parte_pago_tipo || !q.parte_pago_vehiculo || !q.parte_pago_anio));
    return q[f] === undefined || q[f] === null || q[f] === "";
  });
}

async function history(db: ReturnType<typeof admin>, leadId: string) {
  const { data } = await db.from("messages").select("sender,body,created_at").eq("lead_id", leadId).order("created_at");
  return data ?? [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = admin();
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "start") {
      const { data: lead, error } = await db.from("leads").insert({
        channel: "whatsapp", brand_id: "jetour", name: null, qualification: {}, bot_active: true,
      }).select("id,chat_token").single();
      if (error) throw error;
      await db.from("lead_events").insert({ lead_id: lead.id, type: "creado", detail: "Lead entró por WhatsApp (QR)" });
      await db.from("messages").insert({
        lead_id: lead.id, sender: "bot",
        body: "¡Hola! Soy el asistente virtual de Jetour Guatemala 👋 Con gusto le ayudo a encontrar su próximo Jetour. ¿Me comparte su nombre?",
      });
      await db.rpc("compute_score", { p_lead: lead.id });
      return json({ token: lead.chat_token, messages: await history(db, lead.id) });
    }

    const { data: lead } = await db.from("leads").select("*").eq("chat_token", body.token).single();
    if (!lead) return json({ error: "Conversación no encontrada" }, 404);

    if (action === "poll") {
      const { data: seller } = lead.seller_id
        ? await db.from("sellers").select("name").eq("id", lead.seller_id).single() : { data: null };
      return json({ messages: await history(db, lead.id), seller: seller?.name ?? null, bot_active: lead.bot_active });
    }

    if (action === "send") {
      const text = String(body.text || "").trim().slice(0, 600);
      if (!text) return json({ error: "Mensaje vacío" }, 400);
      const { count } = await db.from("messages").select("id", { count: "exact", head: true }).eq("lead_id", lead.id).eq("sender", "cliente");
      if ((count ?? 0) > 40) return json({ error: "Límite de mensajes de la demo" }, 429);
      await db.from("messages").insert({ lead_id: lead.id, sender: "cliente", body: text });
      await db.from("leads").update({ last_activity_at: new Date().toISOString() }).eq("id", lead.id);

      // Si ya hay vendedor asignado, el bot no interviene: la conversación es del asesor
      if (!lead.bot_active) return json({ messages: await history(db, lead.id) });

      const q = { ...(lead.qualification || {}) } as Record<string, unknown>;
      const attempts = { ...(lead.qualification_attempts || {}) } as Record<string, number>;
      const faltan = missing(q);
      const hist = await history(db, lead.id);
      const catalog = await catalogText(db);
      const system = `Usted es el asistente virtual de Jetour Guatemala (distribuidor: Grupo Los Tres). Trate al cliente de "usted", en español de Guatemala, cálido, breve (máx. 2-3 oraciones) y con la energía aventurera de Jetour. Puede usar un emoji ocasional. No hable de "SUV" en genérico: diga "su próximo Jetour" (la línea también tendrá pick-ups).
OBJETIVO: calificar al prospecto antes de pasarlo a un asesor. Haga UNA pregunta a la vez, de forma natural, en este orden de prioridad: ${FIELDS.map((f) => LABEL[f]).join("; ")}.
Si el cliente pregunta por precios o fichas, responda con el catálogo y luego continúe con la siguiente pregunta pendiente.
REGLAS: nunca prometa descuentos ni negocie precio (eso lo hace el asesor); use solo datos del catálogo; si no sabe algo diga que un asesor lo confirma; no invente nombres de personas; los precios incluyen IVA. Horario de salas: lunes a sábado 8:00–18:00; fuera de horario ofrezca cita para el día siguiente.
Salas: Jetour 20 Calle (zona 10) y Jetour Liberación (Boulevard Liberación).
CATÁLOGO:
${catalog}
ESTADO ACTUAL: datos ya obtenidos ${JSON.stringify(q)}. Faltan: ${faltan.join(", ") || "nada"}. Intentos por dato: ${JSON.stringify(attempts)}.
Si un dato ya se pidió 2 veces y el cliente no lo da, no lo vuelva a pedir. Si faltan datos, termine su respuesta con la siguiente pregunta pendiente.
En "fields" devuelva TODOS los datos conocidos hasta ahora (los previos más lo nuevo), null si no se conoce. "asked_field" = el dato que pregunta en esta respuesta. "wants_human" = true si el cliente pide hablar con una persona/asesor. "refused_field" = dato que el cliente se niega a dar. "resumen" = resumen de 1-2 oraciones del prospecto para el asesor.`;
      const msgs = [
        { role: "system", content: system },
        ...hist.map((m: any) => ({ role: m.sender === "cliente" ? "user" : "assistant", content: m.body })),
      ];
      const out = await openaiJSON(msgs, SCHEMA, "bot_turno");

      for (const [k, v] of Object.entries(out.fields)) if (v !== null && v !== "") q[k] = v;
      // Enganche: si dio monto, calcular el % contra el precio del modelo
      if (q.enganche_monto && (q.modelo || lead.model_id)) {
        const { data: mm } = await db.from("models").select("price,currency").eq("id", (q.modelo as string) || lead.model_id).single();
        if (mm) q.enganche_pct = Math.round((Number(q.enganche_monto) / (mm.price * (mm.currency === "USD" ? 7.7 : 1))) * 100);
      }
      if (out.asked_field) attempts[out.asked_field] = (attempts[out.asked_field] || 0) + 1;
      if (out.refused_field) attempts[out.refused_field] = Math.max(2, attempts[out.refused_field] || 0);
      const still = missing(q);
      const exhausted = still.every((f) => (attempts[f] || 0) >= 2);
      const complete = still.length === 0;
      const handoff = complete || out.wants_human || (still.length > 0 && exhausted);

      const upd: Record<string, unknown> = {
        qualification: q, qualification_attempts: attempts, qualification_complete: complete,
        summary: out.resumen, name: (q.nombre as string) || lead.name, phone: (q.telefono as string) || lead.phone,
        model_id: (q.modelo as string) || lead.model_id, stage: lead.stage === "nuevo" ? "contactado" : lead.stage,
      };
      await db.from("leads").update(upd).eq("id", lead.id);

      let reply = out.reply as string;
      let seller = null;
      if (handoff) {
        const reason = complete ? "calificación completa" : out.wants_human ? "cliente pidió asesor (calificación incompleta)" : "calificación incompleta";
        seller = await assignLead(db, lead.id, (q.sala as string) || null, reason);
        const salaTxt = seller.showroom_id === "jlib" ? "Liberación" : "20 Calle";
        const nombre = q.nombre ? `, ${String(q.nombre).split(" ")[0]}` : "";
        reply = (complete ? `¡Muchas gracias${nombre}! ` : "Entendido. ") +
          `Le comunico con ${seller.name}, asesor(a) de Jetour ${salaTxt}, quien le escribirá en unos minutos por este medio.`;
      } else {
        await db.rpc("compute_score", { p_lead: lead.id });
      }
      await db.from("messages").insert({ lead_id: lead.id, sender: "bot", body: reply });
      return json({ messages: await history(db, lead.id), handoff, seller: seller?.name ?? null });
    }
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
