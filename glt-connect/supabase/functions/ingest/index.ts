// Webhook de entrada de leads: Meta Lead Ads, WhatsApp, web, Google, HubSpot.
// Autenticación: header x-glt-key (integraciones) o JWT de un usuario del CRM (botón "Simular lead").
import { admin, assignLead, authUser, cors, json } from "./_shared.ts";

const FN = ["María", "José", "Ana", "Carlos", "Lucía", "Luis", "Gabriela", "Jorge", "Daniela", "Pablo", "Fernanda", "Andrés", "Valeria", "Ricardo"];
const LN = ["López", "García", "Morales", "Castillo", "Méndez", "Cifuentes", "Aguilar", "Estrada", "Girón", "Barrios", "Figueroa", "Samayoa"];
const MODELS = ["x50", "t2", "t2h", "t1h", "x70", "x70plus", "dashing", "g700"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const CHANNELS = ["meta", "whatsapp", "web", "google", "llamada", "sala", "evento", "hubspot"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = admin();
  try {
    const key = req.headers.get("x-glt-key");
    let ok = false;
    if (key) {
      const { data } = await db.from("settings").select("value").eq("key", "ingest_key").single();
      ok = data?.value === key;
    } else ok = !!(await authUser(req));
    if (!ok) return json({ error: "No autorizado" }, 401);

    const b = await req.json().catch(() => ({}));
    const simulate = !!b.simulate;
    const channel = CHANNELS.includes(b.channel) ? b.channel : "meta";
    const name = b.name || (simulate ? `${pick(FN)} ${pick(LN)}` : null);
    const model_id = b.model_id || (simulate ? pick(MODELS) : null);
    const phone = b.phone || (simulate ? "5" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0") : null);

    const { data: model } = model_id ? await db.from("models").select("name").eq("id", model_id).single() : { data: null };
    const { data: lead, error } = await db.from("leads").insert({
      brand_id: "jetour", channel, name, phone, email: b.email || null, model_id,
      qualification: { ...(name ? { nombre: name } : {}), ...(model_id ? { modelo: model_id } : {}), ...(phone ? { telefono: phone } : {}) },
      bot_active: true, stage: "contactado",
    }).select("id").single();
    if (error) throw error;

    const origen = ({ meta: "formulario de Meta", whatsapp: "WhatsApp", web: "formulario web", google: "Google Ads", llamada: "llamada", sala: "sala", evento: "evento", hubspot: "importación HubSpot" } as Record<string, string>)[channel];
    await db.from("lead_events").insert({ lead_id: lead.id, type: "creado", detail: `Lead entró por ${origen}${b.source ? " · " + b.source : ""}` });
    if (b.message) await db.from("messages").insert({ lead_id: lead.id, sender: "cliente", body: String(b.message).slice(0, 600) });
    // El bot hace el primer contacto de inmediato (sin dejar enfriar el lead)
    const first = name ? name.split(" ")[0] : "";
    await db.from("messages").insert({
      lead_id: lead.id, sender: "bot",
      body: `¡Hola${first ? " " + first : ""}! Soy el asistente virtual de Jetour Guatemala. ¡Qué gusto que le interese ${model?.name ? "la " + model.name : "su próximo Jetour"}! 🙌 Para armarle la mejor opción, ¿la está pensando pagar de contado o con financiamiento?`,
    });
    await db.rpc("compute_score", { p_lead: lead.id });

    // Simulación en vivo: el prospecto responde y el bot califica en ~20 s
    if (simulate) {
      const pago = pick(["contado", "credito", "credito"]);
      const engQ = pick([40000, 50000, 60000, 75000]);
      const plazo = pick(["inmediato", "1-3m", "1-3m", "3-6m"]);
      const sala = pick(["20 Calle", "Liberación"]);
      const script: [string, string, Record<string, unknown>][] = [
        ["cliente", pago === "contado" ? "De contado" : `Con financiamiento, tengo unos Q${engQ.toLocaleString("en-US")} para el enganche`, pago === "contado" ? { pago } : { pago, enganche_monto: engQ }],
        ["bot", "¡Excelente! Tenemos muy buenas opciones con los bancos aliados. ¿Para cuándo tiene pensado estrenar?", {}],
        ["cliente", { inmediato: "Este mes si se puede", "1-3m": "En uno o dos meses", "3-6m": "Como en 4 meses" }[plazo] as string, { plazo }],
        ["bot", "¡Qué emoción, ya casi! ¿Tiene algún vehículo que le gustaría dejar como parte de pago?", {}],
        ["cliente", "Sí, una Rav4", { parte_pago: "si", parte_pago_vehiculo: "Toyota Rav4" }],
        ["bot", "¡Perfecto, eso ayuda bastante! ¿Es de agencia o rodado, y de qué año es?", {}],
        ["cliente", "De agencia, 2018", { parte_pago_tipo: "agencia", parte_pago_anio: 2018 }],
        ["bot", "Gracias por contarme. ¿Qué sala le queda más cómoda: 20 Calle o Liberación?", {}],
        ["cliente", sala, { sala }],
        ["bot", "¡Muy bien! Por último, ¿a qué número y en qué horario le queda mejor que le contacte su asesor?", {}],
        ["cliente", `${phone}, por la tarde`, { horario: "tarde" }],
      ];
      // @ts-ignore EdgeRuntime existe en Supabase
      EdgeRuntime.waitUntil((async () => {
        const q: Record<string, unknown> = { nombre: name, modelo: model_id, telefono: phone };
        for (const [sender, body, patch] of script) {
          await new Promise((r) => setTimeout(r, 2200));
          await db.from("messages").insert({ lead_id: lead.id, sender, body });
          Object.assign(q, patch);
          await db.from("leads").update({ qualification: q, last_activity_at: new Date().toISOString() }).eq("id", lead.id);
          await db.rpc("compute_score", { p_lead: lead.id });
        }
        await db.from("leads").update({ qualification_complete: true, summary: `Interesado en ${model?.name ?? "Jetour"}. ${pago === "contado" ? "Paga de contado." : `Crédito con Q${engQ.toLocaleString("en-US")} de enganche.`} Compra ${plazo === "inmediato" ? "este mes" : plazo === "1-3m" ? "en 1 a 3 meses" : "en 3 a 6 meses"}. Entrega una Toyota Rav4 2018 de agencia. Prefiere sala ${sala}.` }).eq("id", lead.id);
        const seller = await assignLead(db, lead.id, sala, "calificación completa");
        await new Promise((r) => setTimeout(r, 1500));
        await db.from("messages").insert({ lead_id: lead.id, sender: "bot", body: `¡Mil gracias${first ? ", " + first : ""}! 🙌 Le presento a ${seller.name}, quien le va a acompañar personalmente y le escribe en unos minutos. ¡Va a estar en excelentes manos!` });
      })());
    }
    return json({ ok: true, lead_id: lead.id });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
