// Seguimiento del bot con contexto de toda la conversación.
// body: { lead_id }            → seguimiento / retoma inmediata de un lead
//       { cron: true }         → retoma leads desatendidos + seguimientos vencidos (pg_cron cada 2 min)
//       { advance_hours: n }   → "adelantar el tiempo" en la demo
import { admin, authOrKey, banksText, catalogText, cors, json, openaiJSON, TONE } from "./_shared.ts";

type DB = ReturnType<typeof admin>;
const OPEN = ["nuevo", "contactado", "calificado", "cotizado", "test_drive", "financiamiento", "negociacion"];
const CADENCE: Record<string, number[]> = { caliente: [24, 72], tibio: [24, 72], frio: [72, 168, 360] };
const WEEKLY_MAX = 6;

const STAGE_GUIDE: Record<string, string> = {
  nuevo: "Retome la conversación con calidez y ofrezca ayuda.",
  contactado: "Retome la conversación con calidez y ofrezca ayuda para elegir su Jetour.",
  calificado: "Ofrezca enviarle su cotización personalizada o resolver dudas del modelo.",
  cotizado: "Pregunte si pudo revisar su cotización y ofrezca resolver dudas; si ya la abrió varias veces invítele a un test drive.",
  test_drive: "Si el test drive es próximo, confírmelo (fecha, sala) y recuérdele traer su licencia. Si ya pasó, pregúntele con entusiasmo qué le pareció la experiencia y ofrezca el siguiente paso (financiamiento o reservar su unidad).",
  financiamiento: "Ayude con el crédito: documentos típicos (DPI, constancia de ingresos, últimos 3 estados de cuenta, recibo de luz o agua) y los bancos aliados; ofrezca que el asesor le precalifique.",
  negociacion: "Mantenga el entusiasmo, resuelva dudas y recuerde la vigencia de su bono si aplica; el asesor le prepara la propuesta final.",
};

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["mensaje", "nota_asesor", "intencion"],
  properties: {
    mensaje: { type: "string" },
    nota_asesor: { type: "string" },
    intencion: { type: "string", enum: ["financiamiento", "otra_cotizacion", "test_drive", "precio", "documentos", "compra", "duda_general", "sin_pregunta"] },
  },
};
const INTENT_TXT: Record<string, string> = {
  financiamiento: "pregunta por financiamiento", otra_cotizacion: "quiere cotizar otro modelo", test_drive: "habla del test drive",
  precio: "pregunta por precio", documentos: "pregunta por requisitos/documentos", compra: "muestra intención de compra", duda_general: "tiene una duda",
};

function fmtSlot(s: string) {
  return new Date(s).toLocaleString("es-GT", { timeZone: "America/Guatemala", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
}

async function followOne(db: DB, leadId: string, opts: { reentry?: boolean } = {}) {
  const { data: lead } = await db.from("leads").select("*, sellers(name, showroom_id)").eq("id", leadId).single();
  if (!lead || !OPEN.includes(lead.stage)) return null;
  const [{ data: msgsDesc }, { data: quotes }, { data: drives }, { data: model }] = await Promise.all([
    db.from("messages").select("sender,body,created_at,meta").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(24),
    db.from("quotes").select("open_count,status,model_id,color,price,currency,sent_at,valid_until,bonus_amount,term_months,bank").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(3),
    db.from("test_drives").select("slot,status,showroom_id").eq("lead_id", leadId).order("slot", { ascending: false }).limit(1),
    lead.model_id ? db.from("models").select("name").eq("id", lead.model_id).single() : Promise.resolve({ data: null }),
  ]);
  const msgs = (msgsDesc ?? []).reverse();
  // Preguntas pendientes: lo que el cliente escribió después de la última respuesta real (asesor o retoma del bot)
  let li = -1;
  msgs.forEach((m: any, i: number) => { if (m.sender !== "cliente" && !(m.meta?.followup && !m.meta?.reentry)) li = i; });
  const pendientes = msgs.slice(li + 1).filter((m: any) => m.sender === "cliente").map((m: any) => m.body as string);
  const unanswered = pendientes.length > 0;

  const qt = quotes?.[0];
  const td = drives?.[0];
  const tdFuture = td && new Date(td.slot).getTime() > Date.now();
  let motivo = unanswered ? "retoma" : "seguimiento";
  if (!unanswered && lead.stage === "cotizado" && qt && qt.open_count === 0) motivo = "cotizacion_sin_abrir";
  else if (!unanswered && lead.stage === "cotizado" && qt && qt.open_count >= 2) motivo = "cotizacion_abierta_sin_test_drive";
  else if (!unanswered && lead.stage === "test_drive" && td) motivo = tdFuture ? "confirmar_test_drive" : "despues_test_drive";

  const seller = lead.sellers?.name ?? "su asesor";
  const sala = (td?.showroom_id || lead.showroom_id || lead.sellers?.showroom_id) === "jlib" ? "Jetour Liberación (Boulevard Liberación)" : "Jetour 20 Calle (zona 10)";
  const [catalog, banks] = await Promise.all([catalogText(db), banksText(db)]);
  const ctx = [
    `Cliente: ${lead.name ?? "sin nombre"}. Modelo de interés: ${model?.name ?? "por definir"}. Etapa del proceso: ${lead.stage}.`,
    `Asesor asignado: ${seller} · Sala: ${sala}.`,
    `Datos que dio: ${JSON.stringify(lead.qualification ?? {})}.`,
    `Resumen: ${lead.summary ?? "—"}`,
    qt ? `Última cotización: modelo ${qt.model_id}, color ${qt.color}, abierta ${qt.open_count} veces, vence ${qt.valid_until}${qt.bonus_amount ? `, bono Q${qt.bonus_amount}` : ""}${qt.bank ? `, simulada con ${qt.bank} a ${qt.term_months} meses` : ""}.` : "Aún no tiene cotización.",
    td ? `Test drive: ${fmtSlot(td.slot)} (${td.status}) — ${tdFuture ? "es próximo" : "ya pasó"}.` : "Sin test drive agendado.",
    `Bancos aliados: ${banks}. Enganche desde 10–20% según el banco; plazos de 12 a 72 meses.`,
  ].join("\n");

  const system = `Usted es el asistente virtual de Jetour Guatemala (Grupo Los Tres). Es un bot, NO el asesor: nunca se presente como ${seller} ni firme con su nombre; puede decir que ${seller} le está apoyando.
${TONE}
TAREA: escriba UN mensaje de WhatsApp (máx. 3 oraciones) que tenga sentido con TODA la conversación.
${unanswered
  ? `El cliente escribió y aún NO ha recibido respuesta. Mensajes pendientes del cliente: ${pendientes.map((p) => `"${p}"`).join(" ")}. Discúlpese brevemente por la espera y RESPONDA cada una de sus preguntas con la información disponible (financiamiento: bancos aliados, tasas referenciales, enganche y plazos; otra cotización: diga que con gusto, pregunte qué modelo le interesa y que ${seller} se la envía; precios: del catálogo). Lo que no pueda confirmar, diga que ${seller} se lo confirma en breve.`
  : `Es un seguimiento porque el cliente no ha respondido. ${STAGE_GUIDE[lead.stage] ?? ""} Motivo: ${motivo.replaceAll("_", " ")}. No repita literalmente mensajes anteriores.`}
REGLAS: nunca prometa descuentos ni negocie precio; use solo datos del contexto y el catálogo; no invente fechas ni nombres; los precios incluyen IVA. Horario de salas: lunes a sábado 8:00–18:00.
"nota_asesor": 1 oración para ${seller} con lo que pidió el cliente y qué debe hacer. "intencion": la principal intención del cliente en sus últimos mensajes (o "sin_pregunta").
CONTEXTO:
${ctx}
CATÁLOGO:
${catalog}`;

  const convo = msgs.map((m: any) => {
    const who = m.sender === "cliente" ? "Cliente" : m.sender === "vendedor" ? `Asesor ${m.meta?.seller ?? seller}` : "Bot";
    const when = new Date(m.created_at).toLocaleString("es-GT", { timeZone: "America/Guatemala", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    return `[${when}] ${who}: ${m.body}`;
  }).join("\n");
  const out = await openaiJSON([
    { role: "system", content: system },
    { role: "user", content: `Conversación completa (de la más antigua a la más reciente):\n${convo}\n\nEscriba el siguiente mensaje del bot.` },
  ], SCHEMA, "seguimiento");

  // Próximo seguimiento: cadencia por temperatura y luego semanal; tras un test drive próximo, preguntar cómo le fue
  const step = (lead.followup_step || 0) + 1;
  const cad = CADENCE[lead.temperature] || CADENCE.tibio;
  let nextH: number | null = step < cad.length ? cad[step] - cad[step - 1] : step < WEEKLY_MAX ? 168 : null;
  if (tdFuture) nextH = Math.max(1, (new Date(td.slot).getTime() - Date.now()) / 3600e3 + 4);
  const next = nextH ? new Date(Date.now() + nextH * 3600e3).toISOString() : null;
  const now = new Date().toISOString();

  await db.from("messages").insert({ lead_id: leadId, sender: "bot", body: out.mensaje, meta: { followup: step, motivo, reentry: unanswered || !!opts.reentry } });
  await db.from("leads").update({ followup_step: step, next_followup_at: next, last_activity_at: now }).eq("id", leadId);
  const evs = [{ lead_id: leadId, type: unanswered ? "bot_retoma" : "seguimiento", detail: unanswered ? `El bot retomó la conversación: ${seller} no había respondido` : `Seguimiento #${step} del bot (${motivo.replaceAll("_", " ")})` }];
  if (out.intencion !== "sin_pregunta") evs.push({ lead_id: leadId, type: "intencion", detail: `Cliente ${INTENT_TXT[out.intencion] ?? "escribió"} · ${out.nota_asesor}` });
  await db.from("lead_events").insert(evs);
  return { lead_id: leadId, mensaje: out.mensaje, nota: out.nota_asesor, intencion: out.intencion, motivo };
}

// Leads asignados donde el cliente escribió y el asesor no respondió dentro de la ventana
async function unattended(db: DB, windowMin: number, limit: number) {
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const until = new Date(Date.now() - windowMin * 6e4).toISOString();
  const { data: st } = await db.from("lead_msg_stats").select("lead_id,last_client_at,last_out_at").gte("last_client_at", since).lte("last_client_at", until).limit(200);
  const cand = (st ?? []).filter((s: any) => !s.last_out_at || s.last_client_at > s.last_out_at).map((s: any) => s.lead_id);
  if (!cand.length) return [];
  const { data } = await db.from("leads").select("id").in("id", cand).eq("bot_active", false).eq("is_demo_seed", false).not("seller_id", "is", null).in("stage", OPEN).limit(limit);
  return (data ?? []).map((l: any) => l.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = admin();
  if (!(await authOrKey(req, db))) return json({ error: "No autorizado" }, 401);
  try {
    const b = await req.json().catch(() => ({}));
    if (b.lead_id) return json({ done: [await followOne(db, b.lead_id)] });
    const { data: sla } = await db.from("settings").select("value").eq("key", "sla").single();
    const windowMin = Number(sla?.value?.bot_retoma_min) || 20;
    const done = [];
    if (b.cron) {
      for (const id of await unattended(db, windowMin, 5)) done.push(await followOne(db, id, { reentry: true }));
      const { data } = await db.from("leads").select("id").eq("is_demo_seed", false).not("next_followup_at", "is", null)
        .lte("next_followup_at", new Date().toISOString()).in("stage", OPEN).order("next_followup_at").limit(5);
      for (const l of data ?? []) if (!done.some((d) => d?.lead_id === l.id)) done.push(await followOne(db, l.id));
      return json({ done });
    }
    const until = new Date(Date.now() + (Number(b.advance_hours) || 72) * 3600e3).toISOString();
    for (const id of await unattended(db, 0, Number(b.limit) || 3)) done.push(await followOne(db, id, { reentry: true }));
    const { data } = await db.from("leads").select("id").not("next_followup_at", "is", null).lte("next_followup_at", until)
      .in("stage", OPEN).order("next_followup_at").limit(Math.max(0, (Number(b.limit) || 3) - done.length));
    for (const l of data ?? []) done.push(await followOne(db, l.id));
    return json({ done });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
