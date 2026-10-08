// GLT Connect · Autoshow — cotización pública por token (lo que abre el cliente).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const b = await req.json().catch(() => ({}));
    if (!UUID.test(String(b.token || ""))) return json({ error: "Cotización no encontrada" }, 404);
    const { data: q } = await db.from("as_quotes").select("*").eq("public_token", b.token).maybeSingle();
    if (!q) return json({ error: "pending" }, 404); // puede venir en camino desde una tablet sin señal
    const { data: lead } = await db.from("as_leads").select("id,name,stage,seller_id").eq("id", q.lead_id).single();

    if (b.action === "cta") {
      const type = ["whatsapp", "test_drive", "quiero_este", "llamar"].includes(b.type) ? b.type : null;
      if (!type) return json({ error: "CTA inválido" }, 400);
      const label = ({ whatsapp: "El cliente abrió WhatsApp con su asesor desde la cotización", test_drive: `El cliente pidió test drive${b.when ? ` (${String(b.when).slice(0, 60)})` : ""}`, quiero_este: "El cliente tocó «Lo quiero» en su cotización", llamar: "El cliente pidió que lo llamen" } as Record<string, string>)[type];
      await db.from("as_activities").insert({ lead_id: q.lead_id, seller_id: null, type: `cliente_${type}`, detail: label });
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (type === "test_drive" && ["nuevo", "contactado"].includes(lead!.stage)) patch.stage = "test_drive";
      if (type === "quiero_este" && !["ganado", "perdido"].includes(lead!.stage)) { patch.stage = "negociacion"; patch.temperature = "caliente"; }
      if (type !== "whatsapp") patch.next_action_at = new Date().toISOString(); // sube a la cola de hoy del asesor
      await db.from("as_leads").update(patch).eq("id", q.lead_id);
      return json({ ok: true });
    }

    if (!b.preview) {
      const now = new Date().toISOString();
      await db.from("as_quotes").update({ open_count: (q.open_count || 0) + 1, first_opened_at: q.first_opened_at || now, last_opened_at: now }).eq("id", q.id);
      if (!q.first_opened_at) await db.from("as_activities").insert({ lead_id: q.lead_id, type: "cliente_abrio", detail: "El cliente abrió su cotización" });
    }
    const [{ data: model }, { data: seller }, { data: st }] = await Promise.all([
      db.from("as_models").select("id,name,version,price,currency,price_from,powertrain,tagline,highlights,specs,colors,versions,media,warranty").eq("id", q.model_id).single(),
      db.from("as_sellers").select("name,phone,showroom,photo").eq("id", q.seller_id).maybeSingle(),
      db.from("as_settings").select("key,value").in("key", ["banks", "event", "fx"]),
    ]);
    const s = Object.fromEntries((st ?? []).map((r: any) => [r.key, r.value]));
    const { lead_id: _l, seller_id: _s, id: _i, ...pub } = q;
    return json({ quote: pub, model, seller, client: (lead?.name || "").split(" ")[0], banks: s.banks ?? [], event: { name: s.event?.name, stand: s.event?.stand }, fx: s.fx?.USD_GTQ ?? 7.7 });
  } catch (e) {
    console.error(e);
    return json({ error: "Error del servidor" }, 500);
  }
});
