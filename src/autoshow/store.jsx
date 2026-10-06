// Estado del autoshow: sesión por PIN, caché local y cola offline con sincronización.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SUPABASE_KEY, SUPABASE_URL } from "../lib/supabase";
import { cuota } from "../lib/format";

const API = `${SUPABASE_URL}/functions/v1/autoshow`;
export const PUBLIC_ORIGIN = typeof window !== "undefined" && /localhost|127\.0\.0\.1/.test(window.location.hostname) ? "https://glt-connect.vercel.app" : (typeof window !== "undefined" ? window.location.origin : "");
export const quoteLink = (token) => `${PUBLIC_ORIGIN}/autoshow/c/${token}`;

const LS = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); }));

export class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
export async function api(action, body = {}) {
  let r;
  try {
    r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY }, body: JSON.stringify({ action, ...body }) });
  } catch { throw new ApiError(0, "Sin conexión"); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, d.error || `Error ${r.status}`);
  return d;
}

// ---------- reglas compartidas con el servidor ----------
export function nextMorning(days, hour = 9) {
  const now = new Date(Date.now() - 6 * 3600e3);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days, hour + 6, 0, 0)).toISOString();
}
export const FIRST = { caliente: 1, tibio: 2, frio: 4 };
export const CADENCE = { caliente: [1, 2, 4, 7], tibio: [2, 4, 7, 14], frio: [4, 10, 21] };
export const TEMPS = {
  caliente: { label: "Listo para comprar", short: "Caliente", emoji: "🔥", cls: "hot" },
  tibio: { label: "Evaluando opciones", short: "Tibio", emoji: "🙂", cls: "warm" },
  frio: { label: "Solo viendo", short: "Frío", emoji: "❄️", cls: "cold" },
};
export const STAGES = [
  { id: "nuevo", label: "Nuevo" }, { id: "contactado", label: "Contactado" }, { id: "test_drive", label: "Test drive" },
  { id: "negociacion", label: "Negociación" }, { id: "ganado", label: "Vendido" }, { id: "perdido", label: "Perdido" },
];
export const LOST = ["Precio", "Compró otra marca", "No calificó al crédito", "Sin respuesta", "Pospuso la compra", "Otro"];
export const waNumber = (p) => { const d = String(p || "").replace(/\D/g, ""); if (!d) return null; return d.length === 8 ? `502${d}` : d; };
export const waLink = (phone, text) => { const n = waNumber(phone); return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null; };
export const fmtPhone = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length === 8 ? `${d.slice(0, 4)} ${d.slice(4)}` : d; };

export function calcQuote({ model, fx = 7.7, bonus = 0, accessories = [], trade = 0, enganche = 0, term = 60, rate = 9.5 }) {
  if (!model) return {};
  const base = model.currency === "USD" ? model.price * fx : Number(model.price);
  const acc = accessories.reduce((a, x) => a + Number(x.price || 0), 0);
  const total = Math.max(0, base + acc - Number(bonus || 0) - Number(trade || 0));
  const eng = Math.min(Number(enganche || 0), total);
  const financed = Math.max(0, total - eng);
  return { base, acc, total, eng, financed, pct: total ? Math.round((eng / total) * 100) : 0, monthly: financed ? cuota(financed, rate, term) : 0 };
}

// Mensaje sugerido de seguimiento según temperatura y paso
export function followMessage({ lead, step, quote, me, event }) {
  const n = (lead.name || "").split(" ")[0] || "";
  const m = lead._modelName || "su próximo Jetour";
  const yo = (me?.name || "").split(" ")[0] || "su asesor";
  const ev = event?.name || "el autoshow";
  const link = quote ? quoteLink(quote.public_token) : null;
  const vig = quote?.valid_until ? new Date(quote.valid_until + "T12:00:00").toLocaleDateString("es-GT", { day: "numeric", month: "long" }) : null;
  if (step === 0) {
    if (lead.temperature === "caliente") return `¡Hola ${n}! Soy ${yo}, de Jetour 👋 Fue un gusto atenderle en ${ev}. ${link ? `Aquí tiene de nuevo su cotización de la ${m}: ${link} ` : ""}¿Le parece si agendamos su test drive esta semana?`;
    if (lead.temperature === "tibio") return `¡Hola ${n}! Soy ${yo}, de Jetour. Gracias por visitarnos en ${ev}. ${link ? `¿Pudo revisar su cotización de la ${m}? ${link} ` : `Quedo pendiente de compartirle la información de la ${m}. `}Con gusto le resuelvo cualquier duda.`;
    return `¡Hola ${n}! Soy ${yo}, de Jetour. Gracias por pasar por nuestro stand en ${ev}. ${link ? `Le comparto la información de la ${m}: ${link} ` : ""}Cuando guste, aquí estoy para ayudarle.`;
  }
  if (step === 1) return `Hola ${n}, ¿cómo está? Le escribe ${yo} de Jetour. ${vig ? `El bono del autoshow para la ${m} sigue vigente hasta el ${vig}.` : `Sigo a la orden con la ${m}.`} ¿Le gustaría venir a manejarla?`;
  if (step === 2) return `Hola ${n}, le escribe ${yo} de Jetour. Puedo apartarle la ${m} en el color que le gustó. ¿Le llamo hoy para darle los detalles?`;
  return `Hola ${n}, no quiero molestarle 🙂 Si en algún momento retoma la idea de su próximo Jetour, aquí estoy para ayudarle. ¡Que tenga excelente día! — ${yo}, Jetour`;
}

// ---------- contexto ----------
const Ctx = createContext(null);
export const useAS = () => useContext(Ctx);

const EMPTY = { models: [], settings: {}, leads: [], quotes: [], activities: [], sellers: [] };

export function AutoshowProvider({ children }) {
  const [device, setDevice] = useState(() => LS.get("as_device"));
  const [session, setSession] = useState(() => LS.get("as_session"));
  const [me, setMe] = useState(() => LS.get("as_me"));
  const [data, setData] = useState(() => LS.get("as_data", EMPTY));
  const [queue, setQueue] = useState(() => LS.get("as_queue", []));
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(() => LS.get("as_last_sync"));
  const [toasts, setToasts] = useState([]);
  const [errors, setErrors] = useState([]);
  const qRef = useRef(queue); qRef.current = queue;
  const sRef = useRef(session); sRef.current = session;
  const meRef = useRef(me); meRef.current = me;
  const busy = useRef(false);

  useEffect(() => LS.set("as_data", data), [data]);
  useEffect(() => LS.set("as_queue", queue), [queue]);

  const toast = useCallback((title, body, kind) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, title, body, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const signOut = useCallback((keepDevice = true) => {
    LS.del("as_session"); LS.del("as_me"); setSession(null); setMe(null);
    if (!keepDevice) { LS.del("as_device"); setDevice(null); }
  }, []);

  // aplica operaciones pendientes encima de los datos del servidor
  const applyOps = useCallback((base, ops) => {
    const d = { ...base, leads: [...base.leads], quotes: [...base.quotes], activities: [...base.activities] };
    for (const op of ops) {
      const x = { ...op.data, _pending: true };
      if (op.type === "lead") { const i = d.leads.findIndex((l) => l.id === x.id); if (i >= 0) d.leads[i] = { ...d.leads[i], ...x }; else d.leads.unshift(x); }
      if (op.type === "quote") { const i = d.quotes.findIndex((q) => q.id === x.id); if (i >= 0) d.quotes[i] = { ...d.quotes[i], ...x }; else d.quotes.unshift(x); }
      if (op.type === "activity") { if (!d.activities.some((a) => a.id === x.id)) d.activities.unshift({ ...x, created_at: x.at }); }
    }
    return d;
  }, []);

  const refresh = useCallback(async () => {
    if (!sRef.current) return;
    try {
      const b = await api("bootstrap", { session: sRef.current });
      const mine = qRef.current.filter((o) => o.seller === meRef.current?.id);
      setData(applyOps({ models: b.models || [], settings: b.settings || {}, leads: b.leads || [], quotes: b.quotes || [], activities: b.activities || [], sellers: b.sellers || [] }, mine));
      setMe((m) => { const n = { ...m, ...b.me }; LS.set("as_me", n); return n; });
      const t = new Date().toISOString(); setLastSync(t); LS.set("as_last_sync", t);
    } catch (e) {
      if (e.status === 401) { toast("Sesión vencida", "Ingrese su PIN de nuevo"); signOut(true); }
      else if (e.status === 0) setOnline(false);
    }
  }, [applyOps, signOut, toast]);

  const flush = useCallback(async () => {
    if (busy.current || !sRef.current || !meRef.current) return;
    const mine = qRef.current.filter((o) => o.seller === meRef.current.id);
    if (!mine.length) return;
    busy.current = true; setSyncing(true);
    try {
      // leads primero para que las cotizaciones encuentren a su cliente
      const order = { lead: 0, quote: 1, activity: 2 };
      const batch = [...mine].sort((a, b) => order[a.type] - order[b.type] || a.ts - b.ts).slice(0, 60);
      const r = await api("sync", { session: sRef.current, ops: batch.map((o) => ({ id: o.id, type: o.type, data: o.data })) });
      const done = new Set(), failed = [];
      for (const x of r.results || []) {
        if (x.ok) done.add(x.id);
        else if (!x.retry) { done.add(x.id); failed.push(x.error); }
      }
      setQueue((q) => q.filter((o) => !done.has(o.id)));
      qRef.current = qRef.current.filter((o) => !done.has(o.id));
      if (failed.length) { setErrors((e) => [...failed, ...e].slice(0, 20)); toast("No se pudo guardar un cambio", failed[0], "bad"); }
      setOnline(true);
      if (done.size) await refresh();
    } catch (e) {
      if (e.status === 401) signOut(true);
      if (e.status === 0) setOnline(false);
    } finally { busy.current = false; setSyncing(false); }
  }, [refresh, signOut, toast]);

  const enqueue = useCallback((type, payload) => {
    const op = { id: uuid(), type, data: payload, seller: meRef.current?.id, ts: Date.now() };
    setQueue((q) => [...q, op]); qRef.current = [...qRef.current, op];
    setData((d) => applyOps(d, [op]));
    setTimeout(() => flush(), 50);
  }, [applyOps, flush]);

  // ciclo de sincronización
  useEffect(() => {
    const on = () => { setOnline(true); flush(); refresh(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    const iv = setInterval(() => { flush(); }, 8000);
    const iv2 = setInterval(() => { if (navigator.onLine) refresh(); }, 60000);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); clearInterval(iv); clearInterval(iv2); };
  }, [flush, refresh]);
  useEffect(() => { if (session) { refresh().then(() => flush()); } }, [session]); // eslint-disable-line

  // ---------- acciones de alto nivel ----------
  const activate = async (code, label) => {
    const r = await api("activate", { code, label });
    LS.set("as_device", r.device); setDevice(r.device);
  };
  const login = async (sellerId, pin) => {
    const r = await api("login", { device, seller_id: sellerId, pin });
    LS.set("as_session", r.session); LS.set("as_me", r.me);
    sRef.current = r.session; meRef.current = r.me;
    setSession(r.session); setMe(r.me);
  };
  const saveLead = (lead) => {
    const isNew = !data.leads.some((l) => l.id === lead.id);
    const payload = { ...lead };
    if (isNew) Object.assign(payload, { seller_id: me.id, captured_at: new Date().toISOString(), created_at: new Date().toISOString(), stage: "nuevo", followup_step: 0, next_action_at: nextMorning(FIRST[lead.temperature] || 2) });
    enqueue("lead", payload);
    return payload;
  };
  const saveQuote = (q) => { enqueue("quote", { ...q, seller_id: me.id, created_at: new Date().toISOString(), open_count: 0 }); };
  const logActivity = (leadId, type, detail, meta) => {
    const lead = data.leads.find((l) => l.id === leadId);
    enqueue("activity", { id: uuid(), lead_id: leadId, type, detail, meta: meta || {}, at: new Date().toISOString(), seller_id: me.id });
    if (lead && (type === "whatsapp" || type === "llamada")) {
      const step = (lead.followup_step || 0) + 1; const cad = CADENCE[lead.temperature] || CADENCE.tibio;
      // reflejo local inmediato (el servidor calcula lo mismo)
      setData((d) => ({ ...d, leads: d.leads.map((l) => (l.id === leadId ? { ...l, followup_step: step, last_contact_at: new Date().toISOString(), next_action_at: step < cad.length ? nextMorning(cad[step]) : null, stage: l.stage === "nuevo" ? "contactado" : l.stage } : l)) }));
    }
  };
  const manager = async (action, body) => api(action, { session, ...body });

  const modelById = useMemo(() => Object.fromEntries((data.models || []).map((m) => [m.id, m])), [data.models]);
  const fx = Number(data.settings?.fx?.USD_GTQ) || 7.7;

  const value = {
    device, session, me, data, modelById, fx, online, syncing, lastSync, pending: queue.filter((o) => o.seller === me?.id).length, pendingOther: queue.filter((o) => o.seller !== me?.id).length,
    errors, toasts, toast, activate, login, signOut, refresh, flush, saveLead, saveQuote, logActivity, manager,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
