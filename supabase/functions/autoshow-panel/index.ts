// GLT Connect · Autoshow — API del panel en vivo (gerencia / Madame).
// Un solo PIN de panel (as_settings.panel_hash). Sesión firmada 24 h. Solo lectura.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }
const fail = (status: number, msg: string): never => { throw new HttpError(status, msg); };

let secretKey: CryptoKey | null = null;
async function key() {
  if (secretKey) return secretKey;
  const { data } = await db.from("as_settings").select("value").eq("key", "session_secret").single();
  if (!data?.value) fail(500, "Falta configurar el secreto de sesión");
  secretKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(data!.value)), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return secretKey;
}
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function sign(payload: Record<string, unknown>) {
  const body = b64u(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(body)));
  return `${body}.${b64u(sig)}`;
}
async function verify(token: string | undefined) {
  if (!token || !token.includes(".")) fail(401, "Sesión inválida");
  const [body, sig] = token!.split(".");
  const ok = await crypto.subtle.verify("HMAC", await key(), unb64u(sig), new TextEncoder().encode(body));
  if (!ok) fail(401, "Sesión inválida");
  const p = JSON.parse(new TextDecoder().decode(unb64u(body)));
  if (p.k !== "panel") fail(401, "Sesión inválida");
  if (p.exp && Date.now() > p.exp) fail(401, "Sesión vencida");
  return p;
}
async function throttle(ip: string, max: number) {
  const since = new Date(Date.now() - 10 * 60e3).toISOString();
  const { count } = await db.from("as_auth_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).eq("kind", "panel").eq("ok", false).gte("created_at", since);
  if ((count ?? 0) >= max) fail(429, "Demasiados intentos. Espere 10 minutos.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?";
  try {
    const b = await req.json().catch(() => ({}));

    if (b.action === "login") {
      await throttle(ip, 8);
      const { data } = await db.from("as_settings").select("value").eq("key", "panel_hash").single();
      const { data: ok } = await db.rpc("as_check_hash", { p_plain: String(b.pin || "").trim(), p_hash: data?.value });
      await db.from("as_auth_attempts").insert({ ip, kind: "panel", ok: !!ok });
      if (!ok) fail(401, "PIN incorrecto");
      return json({ session: await sign({ k: "panel", exp: Date.now() + 24 * 3600e3 }) });
    }

    await verify(b.session);
    if (b.action === "stats") {
      const { data, error } = await db.rpc("as_panel_stats");
      if (error) fail(500, error.message);
      return json(data);
    }
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Error del servidor" }, 500);
  }
});
