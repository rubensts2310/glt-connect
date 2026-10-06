// GLT Connect · Autoshow — API de la tablet (producción).
// Seguridad: las tablas no tienen acceso anon; todo pasa por aquí con service role.
//  1) La tablet se activa una vez con el código del evento → token de dispositivo firmado.
//  2) El vendedor entra con su PIN (bloqueo tras 5 intentos) → token de sesión firmado (12 h).
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

// ---------- firma de tokens (HMAC-SHA256 con secreto guardado en as_settings) ----------
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
async function verify(token: string | undefined, kind: string) {
  if (!token || !token.includes(".")) fail(401, "Sesión inválida");
  const [body, sig] = token!.split(".");
  const ok = await crypto.subtle.verify("HMAC", await key(), unb64u(sig), new TextEncoder().encode(body));
  if (!ok) fail(401, "Sesión inválida");
  const p = JSON.parse(new TextDecoder().decode(unb64u(body)));
  if (p.k !== kind) fail(401, "Sesión inválida");
  if (p.exp && Date.now() > p.exp) fail(401, "Sesión vencida");
  return p;
}
async function device(token: string) {
  const p = await verify(token, "dev");
  const { data } = await db.from("as_devices").select("id,revoked").eq("id", p.did).single();
  if (!data || data.revoked) fail(401, "Esta tablet fue desactivada. Pida el código del evento.");
  db.from("as_devices").update({ last_seen: new Date().toISOString() }).eq("id", p.did).then(() => {});
  return p.did as string;
}
async function session(token: string) {
  const p = await verify(token, "ses");
  const { data: s } = await db.from("as_sellers").select("id,name,role,active,phone").eq("id", p.sid).single();
  if (!s || !s.active) fail(401, "Usuario inactivo");
  return { ...s, did: p.did as string };
}

// ---------- límite de intentos por IP ----------
async function throttle(ip: string, kind: string, max: number) {
  const since = new Date(Date.now() - 10 * 60e3).toISOString();
  const { count } = await db.from("as_auth_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).eq("kind", kind).eq("ok", false).gte("created_at", since);
  if ((count ?? 0) >= max) fail(429, "Demasiados intentos. Espere 10 minutos.");
}
const logAttempt = (ip: string, kind: string, ok: boolean) => db.from("as_auth_attempts").insert({ ip, kind, ok });

// ---------- reglas de negocio ----------
const GT = "America/Guatemala";
function nextMorning(days: number, hour = 9) {
  // hora de Guatemala (UTC-6, sin horario de verano)
  const now = new Date(Date.now() - 6 * 3600e3);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days, hour + 6, 0, 0));
  return d.toISOString();
}
const FIRST = { caliente: 1, tibio: 2, frio: 4 } as Record<string, number>;
const CADENCE = { caliente: [1, 2, 4, 7], tibio: [2, 4, 7, 14], frio: [4, 10, 21] } as Record<string, number[]>;
const STAGES = ["nuevo", "contactado", "test_drive", "negociacion", "ganado", "perdido"];
const clean = (s: unknown, n = 200) => (s == null ? null : String(s).trim().slice(0, n) || null);
const phoneOk = (p: unknown) => { const d = String(p ?? "").replace(/\D/g, ""); return d.length >= 8 ? d : null; };

async function upsertLead(ses: any, d: any) {
  if (!d?.id || !d?.name) fail(400, "Lead incompleto");
  const { data: prev } = await db.from("as_leads").select("id,seller_id,next_action_at,stage").eq("id", d.id).maybeSingle();
  if (prev && ses.role !== "gerente" && prev.seller_id !== ses.id) fail(403, "Este cliente es de otro asesor");
  const temperature = ["caliente", "tibio", "frio"].includes(d.temperature) ? d.temperature : "tibio";
  const row: Record<string, unknown> = {
    id: d.id, name: clean(d.name, 120), phone: phoneOk(d.phone), email: clean(d.email, 160),
    model_id: clean(d.model_id, 20), temperature, pago: ["contado", "credito", "no_sabe"].includes(d.pago) ? d.pago : null,
    enganche_q: d.enganche_q ? Math.max(0, Number(d.enganche_q)) : null, plazo: ["inmediato", "1-3m", "3-6m", "6m+"].includes(d.plazo) ? d.plazo : null,
    parte_pago: typeof d.parte_pago === "boolean" ? d.parte_pago : null, parte_pago_desc: clean(d.parte_pago_desc, 160),
    notes: clean(d.notes, 1000), consent: !!d.consent, updated_at: new Date().toISOString(),
  };
  if (!prev) {
    Object.assign(row, { seller_id: ses.role === "gerente" && d.seller_id ? d.seller_id : ses.id, device_id: ses.did, captured_at: d.captured_at || new Date().toISOString(), stage: "nuevo", next_action_at: nextMorning(FIRST[temperature]) });
  }
  if (d.stage && STAGES.includes(d.stage)) row.stage = d.stage;
  if ("lost_reason" in d) row.lost_reason = clean(d.lost_reason, 120);
  if ("next_action_at" in d) row.next_action_at = d.next_action_at;
  if (row.stage === "ganado" || row.stage === "perdido") row.next_action_at = null;
  const { error } = await db.from("as_leads").upsert(row);
  if (error) fail(400, error.message);
  if (!prev) await db.from("as_activities").insert({ lead_id: d.id, seller_id: ses.id, type: "captura", detail: `Registrado en el stand por ${ses.name}` });
  else if (d.stage && d.stage !== prev.stage) await db.from("as_activities").insert({ lead_id: d.id, seller_id: ses.id, type: "etapa", detail: `Etapa: ${d.stage}${d.lost_reason ? ` · ${d.lost_reason}` : ""}` });
}

async function upsertQuote(ses: any, q: any) {
  if (!q?.id || !q?.lead_id || !q?.public_token || !q?.model_id) fail(400, "Cotización incompleta");
  const { data: lead } = await db.from("as_leads").select("id,seller_id,stage").eq("id", q.lead_id).maybeSingle();
  if (!lead) fail(409, "El cliente aún no se sincroniza");
  if (ses.role !== "gerente" && lead!.seller_id !== ses.id) fail(403, "Este cliente es de otro asesor");
  const { data: m } = await db.from("as_models").select("price,currency").eq("id", q.model_id).single();
  if (!m) fail(400, "Modelo no existe");
  const { data: exists } = await db.from("as_quotes").select("id").eq("id", q.id).maybeSingle();
  const row = {
    id: q.id, public_token: q.public_token, lead_id: q.lead_id, seller_id: lead!.seller_id, model_id: q.model_id,
    color: clean(q.color, 60), color_img: clean(q.color_img, 120), price: m!.price, currency: m!.currency,
    bonus_label: clean(q.bonus_label, 80), bonus_amount: Math.max(0, Number(q.bonus_amount) || 0), accessories: Array.isArray(q.accessories) ? q.accessories.slice(0, 12) : [],
    trade_in: q.trade_in && q.trade_in.desc ? { desc: clean(q.trade_in.desc, 120), value: Math.max(0, Number(q.trade_in.value) || 0) } : null,
    enganche_q: Math.max(0, Number(q.enganche_q) || 0), term_months: Number(q.term_months) || 60, bank: clean(q.bank, 60), rate: Number(q.rate) || null,
    monthly: Number(q.monthly) || null, total: Number(q.total) || null, valid_until: q.valid_until || null,
  };
  const { error } = await db.from("as_quotes").upsert(row);
  if (error) fail(400, error.message);
  if (!exists) await db.from("as_activities").insert({ lead_id: q.lead_id, seller_id: ses.id, type: "cotizacion", detail: `Cotización ${q.model_id.toUpperCase()} ${row.color ?? ""}`.trim(), meta: { quote_id: q.id } });
}

async function addActivity(ses: any, a: any) {
  if (!a?.id || !a?.lead_id || !a?.type) fail(400, "Actividad incompleta");
  const { data: lead } = await db.from("as_leads").select("id,seller_id,temperature,followup_step,stage").eq("id", a.lead_id).maybeSingle();
  if (!lead) fail(409, "El cliente aún no se sincroniza");
  if (ses.role !== "gerente" && lead!.seller_id !== ses.id) fail(403, "Este cliente es de otro asesor");
  const { error } = await db.from("as_activities").upsert({ id: a.id, lead_id: a.lead_id, seller_id: ses.id, type: clean(a.type, 30), detail: clean(a.detail, 600), meta: a.meta ?? {}, created_at: a.at || new Date().toISOString() }, { ignoreDuplicates: true });
  if (error) fail(400, error.message);
  // seguimiento enviado → siguiente paso de la cadencia
  if (a.type === "whatsapp" || a.type === "llamada") {
    const step = (lead!.followup_step || 0) + 1;
    const cad = CADENCE[lead!.temperature] || CADENCE.tibio;
    const patch: Record<string, unknown> = { followup_step: step, last_contact_at: a.at || new Date().toISOString(), next_action_at: step < cad.length ? nextMorning(cad[step]) : null, updated_at: new Date().toISOString() };
    if (lead!.stage === "nuevo") patch.stage = "contactado";
    await db.from("as_leads").update(patch).eq("id", a.lead_id);
  }
}

async function bootstrap(ses: any) {
  const isMgr = ses.role === "gerente";
  const leadsQ = db.from("as_leads").select("*").order("created_at", { ascending: false }).limit(5000);
  const [{ data: models }, { data: settings }, { data: leads }, { data: sellers }] = await Promise.all([
    db.from("as_models").select("*").eq("active", true).order("sort"),
    db.from("as_settings").select("key,value").in("key", ["event", "banks", "fx", "accessories"]),
    isMgr ? leadsQ : leadsQ.eq("seller_id", ses.id),
    db.from("as_sellers").select("id,name,role,phone,active").order("name"),
  ]);
  const ids = (leads ?? []).map((l: any) => l.id);
  const chunks = (a: string[], n = 300) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
  let quotes: any[] = [], acts: any[] = [];
  for (const c of chunks(ids)) {
    const [q, a] = await Promise.all([
      db.from("as_quotes").select("*").in("lead_id", c),
      db.from("as_activities").select("*").in("lead_id", c).order("created_at", { ascending: false }).limit(4000),
    ]);
    quotes = quotes.concat(q.data ?? []); acts = acts.concat(a.data ?? []);
  }
  return {
    me: { id: ses.id, name: ses.name, role: ses.role, phone: ses.phone },
    models, settings: Object.fromEntries((settings ?? []).map((s: any) => [s.key, s.value])),
    leads, quotes, activities: acts, sellers: isMgr ? sellers : (sellers ?? []).filter((s: any) => s.id === ses.id).map((s: any) => ({ id: s.id, name: s.name, role: s.role })),
    server_time: new Date().toISOString(),
  };
}

function csv(rows: any[][]) {
  return rows.map((r) => r.map((v) => { const s = v == null ? "" : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?";
  try {
    const b = await req.json().catch(() => ({}));
    const a = b.action;

    if (a === "activate") {
      await throttle(ip, "activate", 8);
      const { data } = await db.from("as_settings").select("value").eq("key", "activation_hash").single();
      const { data: ok } = await db.rpc("as_check_hash", { p_plain: String(b.code || "").trim().toUpperCase(), p_hash: data?.value });
      await logAttempt(ip, "activate", !!ok);
      if (!ok) fail(401, "Código del evento incorrecto");
      const { data: dev } = await db.from("as_devices").insert({ label: clean(b.label, 60) || "Tablet", last_seen: new Date().toISOString() }).select("id").single();
      return json({ device: await sign({ k: "dev", did: dev!.id }) });
    }

    if (a === "sellers") {
      await device(b.device);
      const { data } = await db.from("as_sellers").select("id,name,role").eq("active", true).order("name");
      return json({ sellers: data });
    }

    if (a === "login") {
      const did = await device(b.device);
      await throttle(ip, "pin", 15);
      const { data: s } = await db.from("as_sellers").select("id,name,role,pin_hash,active,failed_attempts,locked_until").eq("id", b.seller_id).single();
      if (!s || !s.active) fail(401, "Usuario no disponible");
      if (s!.locked_until && new Date(s!.locked_until) > new Date()) fail(429, "PIN bloqueado por intentos fallidos. Intente en unos minutos o pida a su gerente que lo restablezca.");
      const { data: ok } = await db.rpc("as_check_hash", { p_plain: String(b.pin || ""), p_hash: s!.pin_hash });
      await logAttempt(ip, "pin", !!ok);
      if (!ok) {
        const f = (s!.failed_attempts || 0) + 1;
        await db.from("as_sellers").update({ failed_attempts: f, locked_until: f >= 5 ? new Date(Date.now() + 10 * 60e3).toISOString() : null }).eq("id", s!.id);
        fail(401, f >= 5 ? "PIN bloqueado 10 minutos" : `PIN incorrecto (${5 - f} intentos restantes)`);
      }
      await db.from("as_sellers").update({ failed_attempts: 0, locked_until: null }).eq("id", s!.id);
      return json({ session: await sign({ k: "ses", sid: s!.id, did, exp: Date.now() + 14 * 3600e3 }), me: { id: s!.id, name: s!.name, role: s!.role } });
    }

    // ---- todo lo demás requiere sesión ----
    const ses = await session(b.session);

    if (a === "bootstrap") return json(await bootstrap(ses));

    if (a === "sync") {
      const ops = Array.isArray(b.ops) ? b.ops.slice(0, 200) : [];
      const results: any[] = [];
      for (const op of ops) {
        try {
          if (op.type === "lead") await upsertLead(ses, op.data);
          else if (op.type === "quote") await upsertQuote(ses, op.data);
          else if (op.type === "activity") await addActivity(ses, op.data);
          else fail(400, "Operación desconocida");
          results.push({ id: op.id, ok: true });
        } catch (e) {
          const st = e instanceof HttpError ? e.status : 500;
          results.push({ id: op.id, ok: false, retry: st === 409 || st >= 500, error: String((e as Error).message) });
        }
      }
      return json({ results });
    }

    // ---- gerencia ----
    if (ses.role !== "gerente") fail(403, "Solo gerencia");

    if (a === "seller_save") {
      const d = b.data || {};
      const row: Record<string, unknown> = { name: clean(d.name, 80), role: d.role === "gerente" ? "gerente" : "vendedor", phone: phoneOk(d.phone), showroom: clean(d.showroom, 60), active: d.active !== false };
      if (!row.name) fail(400, "Nombre requerido");
      if (d.pin) {
        if (!/^\d{4,6}$/.test(String(d.pin))) fail(400, "El PIN debe tener 4 a 6 dígitos");
        const { data: h } = await db.rpc("as_hash", { p_plain: String(d.pin) });
        Object.assign(row, { pin_hash: h, failed_attempts: 0, locked_until: null });
      } else if (!d.id) fail(400, "PIN requerido para un usuario nuevo");
      const q = d.id ? db.from("as_sellers").update(row).eq("id", d.id) : db.from("as_sellers").insert(row);
      const { error } = await q; if (error) fail(400, error.message);
      return json({ ok: true });
    }

    if (a === "settings_save") {
      const ev = b.event || {};
      const { data: cur } = await db.from("as_settings").select("value").eq("key", "event").single();
      const next = { ...(cur?.value || {}), ...ev };
      await db.from("as_settings").upsert({ key: "event", value: next, updated_at: new Date().toISOString() });
      if (b.activation_code) {
        const code = String(b.activation_code).trim().toUpperCase();
        if (code.length < 6) fail(400, "El código del evento debe tener al menos 6 caracteres");
        const { data: h } = await db.rpc("as_hash", { p_plain: code });
        await db.from("as_settings").upsert({ key: "activation_hash", value: h });
      }
      return json({ ok: true, event: next });
    }

    if (a === "reassign") {
      const { error } = await db.from("as_leads").update({ seller_id: b.seller_id, updated_at: new Date().toISOString() }).eq("id", b.lead_id);
      if (error) fail(400, error.message);
      await db.from("as_activities").insert({ lead_id: b.lead_id, seller_id: ses.id, type: "reasignado", detail: `Reasignado por ${ses.name}` });
      return json({ ok: true });
    }

    if (a === "export") {
      const [{ data: leads }, { data: sellers }, { data: quotes }, { data: models }] = await Promise.all([
        db.from("as_leads").select("*").order("created_at").limit(20000),
        db.from("as_sellers").select("id,name"), db.from("as_quotes").select("lead_id,model_id,color,total,monthly,open_count,created_at,public_token").order("created_at"),
        db.from("as_models").select("id,name"),
      ]);
      const sn = Object.fromEntries((sellers ?? []).map((s: any) => [s.id, s.name]));
      const mn = Object.fromEntries((models ?? []).map((m: any) => [m.id, m.name]));
      const lastQ: Record<string, any> = {}; const nQ: Record<string, number> = {};
      for (const q of quotes ?? []) { lastQ[q.lead_id] = q; nQ[q.lead_id] = (nQ[q.lead_id] || 0) + 1; }
      const fmt = (t: string | null) => (t ? new Date(t).toLocaleString("es-GT", { timeZone: GT }) : "");
      const rows = [["Fecha", "Asesor", "Cliente", "Teléfono", "Correo", "Modelo", "Temperatura", "Pago", "Enganche Q", "Plazo", "Parte de pago", "Etapa", "Motivo pérdida", "Cotizaciones", "Última cotización (total Q)", "Cuota Q", "Aperturas", "Próximo seguimiento", "Contactos", "Acepta contacto", "Notas"]];
      for (const l of leads ?? []) {
        const q = lastQ[l.id];
        rows.push([fmt(l.captured_at || l.created_at), sn[l.seller_id] ?? "", l.name, l.phone ?? "", l.email ?? "", mn[l.model_id] ?? "", l.temperature, l.pago ?? "", l.enganche_q ?? "", l.plazo ?? "", l.parte_pago ? l.parte_pago_desc || "Sí" : l.parte_pago === false ? "No" : "", l.stage, l.lost_reason ?? "", nQ[l.id] || 0, q?.total ?? "", q?.monthly ?? "", q?.open_count ?? "", fmt(l.next_action_at), l.followup_step, l.consent ? "Sí" : "No", l.notes ?? ""]);
      }
      return json({ csv: "﻿" + csv(rows) });
    }

    if (a === "lead_delete") {
      const { error } = await db.from("as_leads").delete().eq("id", b.lead_id);
      if (error) fail(400, error.message);
      return json({ ok: true });
    }

    if (a === "device_revoke_all") {
      await db.from("as_devices").update({ revoked: true }).neq("id", ses.did);
      return json({ ok: true });
    }

    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Error del servidor" }, 500);
  }
});
