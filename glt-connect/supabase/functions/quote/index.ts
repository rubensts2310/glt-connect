// Página pública de cotización: lectura con registro de aperturas y botones de acción del cliente.
import { admin, cors, json } from "./_shared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = admin();
  try {
    const b = await req.json();
    const { data: q } = await db.from("quotes").select("*").eq("public_token", b.token).single();
    if (!q) return json({ error: "Cotización no encontrada" }, 404);
    const now = new Date().toISOString();

    if (b.action === "get") {
      if (!b.preview) {
        await db.from("quotes").update({
          open_count: (q.open_count || 0) + 1, first_opened_at: q.first_opened_at ?? now,
          status: q.status === "enviada" || q.status === "borrador" ? "abierta" : q.status,
        }).eq("id", q.id);
        await db.from("quote_events").insert({ quote_id: q.id, lead_id: q.lead_id, type: "abierta" });
        await db.from("lead_events").insert({ lead_id: q.lead_id, type: "cotizacion_abierta", detail: `El cliente abrió la cotización (${(q.open_count || 0) + 1}ª vez)` });
        await db.rpc("compute_score", { p_lead: q.lead_id });
      }
      const [{ data: model }, { data: lead }, { data: seller }, { data: banks }, { data: drives }] = await Promise.all([
        db.from("models").select("*").eq("id", q.model_id).single(),
        db.from("leads").select("name,showroom_id,qualification").eq("id", q.lead_id).single(),
        db.from("sellers").select("name,showroom_id").eq("id", q.seller_id).single(),
        db.from("settings").select("value").eq("key", "banks").single(),
        db.from("test_drives").select("slot,status,showroom_id").eq("lead_id", q.lead_id).order("created_at", { ascending: false }).limit(1),
      ]);
      const { chat_token } = (await db.from("leads").select("chat_token").eq("id", q.lead_id).single()).data ?? {};
      return json({ quote: { ...q, lead_id: undefined, seller_id: undefined }, model, client: lead?.name?.split(" ")[0] ?? "", seller, banks: banks?.value ?? [], test_drive: drives?.[0] ?? null, chat_token });
    }

    if (b.action === "cta") {
      const type = ["test_drive", "whatsapp", "quiero_este", "simulador"].includes(b.type) ? b.type : null;
      if (!type) return json({ error: "Acción no válida" }, 400);
      await db.from("quote_events").insert({ quote_id: q.id, lead_id: q.lead_id, type, meta: b.meta ?? {} });
      const { data: lead } = await db.from("leads").select("stage,showroom_id").eq("id", q.lead_id).single();
      const order = ["nuevo", "contactado", "calificado", "cotizado", "test_drive", "financiamiento", "negociacion", "ganado"];
      const bump = (to: string) => order.indexOf(to) > order.indexOf(lead?.stage ?? "nuevo") ? { stage: to } : {};
      if (type === "test_drive") {
        const slot = b.meta?.slot;
        if (!slot) return json({ error: "Elija un horario" }, 400);
        const showroom = b.meta?.showroom || lead?.showroom_id || "j20";
        await db.from("test_drives").insert({ lead_id: q.lead_id, showroom_id: showroom, model_id: q.model_id, slot });
        await db.from("leads").update({ ...bump("test_drive"), last_activity_at: now }).eq("id", q.lead_id);
        const d = new Date(slot).toLocaleString("es-GT", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "America/Guatemala" });
        await db.from("lead_events").insert({ lead_id: q.lead_id, type: "test_drive", detail: `Agendó test drive: ${d}` });
      } else if (type === "quiero_este") {
        await db.from("quotes").update({ status: "aceptada" }).eq("id", q.id);
        await db.from("leads").update({ ...bump("negociacion"), last_activity_at: now }).eq("id", q.lead_id);
        await db.from("lead_events").insert({ lead_id: q.lead_id, type: "quiero_este", detail: "El cliente tocó «Quiero este» en la cotización" });
      } else if (type === "whatsapp") {
        await db.from("lead_events").insert({ lead_id: q.lead_id, type: "whatsapp", detail: "El cliente pidió hablar por WhatsApp desde la cotización" });
      } else {
        await db.from("lead_events").insert({ lead_id: q.lead_id, type: "simulador", detail: `Simuló cuota: ${b.meta?.enganche ?? "?"}% enganche a ${b.meta?.plazo ?? "?"} meses` });
      }
      await db.rpc("compute_score", { p_lead: q.lead_id });
      return json({ ok: true });
    }
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
