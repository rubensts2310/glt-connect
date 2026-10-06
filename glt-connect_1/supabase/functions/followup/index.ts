// Seguimiento automático del bot. body: { lead_id } para uno, o { advance_hours } para "adelantar el tiempo".
import { admin, authUser, catalogText, cors, json, openaiJSON } from "./_shared.ts";

const CADENCE: Record<string, number[]> = { tibio: [24, 72], frio: [72, 168, 360], caliente: [24] };

async function followOne(db: ReturnType<typeof admin>, leadId: string) {
  const { data: lead } = await db.from("leads").select("*, sellers(name)").eq("id", leadId).single();
  if (!lead || ["ganado", "perdido"].includes(lead.stage)) return null;
  const { data: quotes } = await db.from("quotes").select("open_count,status,model_id,sent_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1);
  const qt = quotes?.[0];
  const { data: msgs } = await db.from("messages").select("sender,body").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(12);
  let motivo = "seguimiento";
  if (qt && qt.open_count === 0) motivo = "cotizacion_sin_abrir";
  else if (qt && qt.open_count >= 2 && lead.stage === "cotizado") motivo = "cotizacion_abierta_sin_test_drive";
  const catalog = await catalogText(db);
  const out = await openaiJSON([
    { role: "system", content: `Usted es el asistente virtual de Jetour Guatemala (un bot, NO el asesor humano: nunca se presente como el asesor ni firme con su nombre; puede mencionar que el asesor está disponible). Escriba UN mensaje de seguimiento por WhatsApp (máx. 2 oraciones, trato de usted, cálido, sin presionar, sin prometer descuentos). Contexto del motivo: ${
      { seguimiento: "retomar la conversación y resolver dudas", cotizacion_sin_abrir: "recordar que tiene su cotización lista para revisar", cotizacion_abierta_sin_test_drive: "invitar a agendar un test drive porque ya revisó su cotización" }[motivo]
    }. Asesor asignado: ${lead.sellers?.name ?? "un asesor"}. Etapa: ${lead.stage}. Resumen del prospecto: ${lead.summary ?? "sin resumen"}. Catálogo:\n${catalog}` },
    { role: "user", content: "Conversación reciente (de más nueva a más antigua):\n" + (msgs ?? []).map((m: any) => `${m.sender}: ${m.body}`).join("\n") },
  ], { type: "object", additionalProperties: false, required: ["mensaje"], properties: { mensaje: { type: "string" } } }, "seguimiento");
  const step = (lead.followup_step || 0) + 1;
  const cad = CADENCE[lead.temperature] || CADENCE.tibio;
  const next = step < cad.length ? new Date(Date.now() + (cad[step] - cad[step - 1]) * 3600e3).toISOString() : null;
  await db.from("messages").insert({ lead_id: leadId, sender: "bot", body: out.mensaje, meta: { followup: step, motivo } });
  await db.from("leads").update({ followup_step: step, next_followup_at: next, last_activity_at: new Date().toISOString() }).eq("id", leadId);
  await db.from("lead_events").insert({ lead_id: leadId, type: "seguimiento", detail: `Seguimiento #${step} del bot (${motivo.replaceAll("_", " ")})` });
  return { lead_id: leadId, mensaje: out.mensaje };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!(await authUser(req))) return json({ error: "No autorizado" }, 401);
  const db = admin();
  try {
    const b = await req.json().catch(() => ({}));
    if (b.lead_id) return json({ done: [await followOne(db, b.lead_id)] });
    const until = new Date(Date.now() + (Number(b.advance_hours) || 72) * 3600e3).toISOString();
    const { data } = await db.from("leads").select("id").not("next_followup_at", "is", null).lte("next_followup_at", until)
      .not("stage", "in", "(ganado,perdido)").order("next_followup_at").limit(Number(b.limit) || 3);
    const done = [];
    for (const l of data ?? []) done.push(await followOne(db, l.id));
    return json({ done });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
