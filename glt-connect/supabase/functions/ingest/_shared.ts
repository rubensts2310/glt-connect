import { createClient } from "npm:@supabase/supabase-js@2.45.4";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-glt-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

// Usuario autenticado del CRM (JWT de Supabase Auth)
export async function authUser(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data?.user ?? null;
}

export const openaiKey = () => Deno.env.get("OPEN") ?? Deno.env.get("OPENAI_API_KEY") ?? "";

export async function openaiJSON(messages: unknown[], schema: Record<string, unknown>, name = "respuesta") {
  const key = openaiKey();
  if (!key) throw new Error("Falta el secreto OPEN con la API key de OpenAI");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.5,
      messages,
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d = await r.json();
  return JSON.parse(d.choices[0].message.content);
}

export const fmtQ = (n: number) => "Q" + Math.round(n).toLocaleString("en-US");
export const priceLabel = (m: { price: number; currency: string; price_from: boolean }) =>
  (m.price_from ? "desde " : "") +
  (m.currency === "USD"
    ? `US$${Math.round(m.price).toLocaleString("en-US")} (≈ ${fmtQ(m.price * 7.7)})`
    : fmtQ(m.price));

export async function catalogText(db: ReturnType<typeof admin>) {
  const { data } = await db.from("models").select("*").eq("brand_id", "jetour").order("sort");
  return (data ?? [])
    .map((m: any) => {
      const hl = (m.highlights || []).map((h: string[]) => `${h[0]} ${h[1]} ${h[2]}`.trim()).join("; ");
      return `- id=${m.id} · ${m.name} (${m.powertrain}, ${m.version}) · precio ${priceLabel(m)} IVA incluido · garantía ${m.warranty} · ${hl} · ${m.tagline}`;
    })
    .join("\n");
}

export async function assignLead(db: ReturnType<typeof admin>, leadId: string, sala: string | null, reason: string) {
  const showroom = sala ? (/libera/i.test(sala) ? "jlib" : /20/.test(sala) ? "j20" : null) : null;
  const { data: sid } = await db.rpc("pick_seller", { p_showroom: showroom });
  const { data: seller } = await db.from("sellers").select("id,name,showroom_id").eq("id", sid).single();
  if (!seller) throw new Error("No hay vendedores disponibles");
  await db.from("leads").update({
    seller_id: seller.id, showroom_id: seller.showroom_id, assigned_at: new Date().toISOString(),
    stage: "calificado", handoff_reason: reason, bot_active: false,
    next_followup_at: new Date(Date.now() + 24 * 3600e3).toISOString(),
  }).eq("id", leadId);
  await db.from("lead_events").insert({ lead_id: leadId, type: "asignado", detail: `Asignado a ${seller.name} (${reason})` });
  await db.rpc("compute_score", { p_lead: leadId });
  return seller;
}
