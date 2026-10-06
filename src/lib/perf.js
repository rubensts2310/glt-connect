import { minsBetween } from "./format";

const OPEN = ["contactado", "calificado", "cotizado", "test_drive", "financiamiento", "negociacion"];
const DAY = 864e5;

// Lead "sin respuesta del cliente": el último mensaje es nuestro y tiene 3+ días
export function needsReminder(lead, stat, now = Date.now()) {
  if (!OPEN.includes(lead.stage) || !lead.seller_id || !stat?.last_out_at) return false;
  if (lead.reminder_snooze_until && new Date(lead.reminder_snooze_until) > now) return false;
  const out = new Date(stat.last_out_at).getTime();
  const cli = stat.last_client_at ? new Date(stat.last_client_at).getTime() : 0;
  return out > cli && now - out >= 3 * DAY && now - out <= 21 * DAY;
}

// Rendimiento del asesor (0–100) con su detalle
export function sellerPerf(sellerId, leads, quotes, stats) {
  const mine = leads.filter((l) => l.seller_id === sellerId);
  const responded = mine.filter((l) => l.first_response_at && l.assigned_at);
  const fast = responded.filter((l) => minsBetween(l.assigned_at, l.first_response_at) <= 5).length;
  const pendingReply = mine.filter((l) => l.assigned_at && !l.first_response_at && OPEN.includes(l.stage)).length;
  const active = mine.filter((l) => OPEN.includes(l.stage));
  const sinSeguimiento = active.filter((l) => needsReminder(l, stats[l.id])).length;
  const myQuotes = quotes.filter((q) => q.seller_id === sellerId && q.sent_at && Date.now() - new Date(q.sent_at) > DAY);
  const openLeadIds = new Set(active.map((l) => l.id));
  const cotPend = myQuotes.filter((q) => !q.followed_up_at && openLeadIds.has(q.lead_id)).length;
  const cotCon = myQuotes.filter((q) => q.followed_up_at).length;
  const won = mine.filter((l) => l.stage === "ganado").length;
  const lost = mine.filter((l) => l.stage === "perdido").length;

  const parts = {
    respuesta: { label: "Respuesta en menos de 5 min", pct: responded.length ? fast / responded.length : 0, w: 30 },
    seguimiento: { label: "Leads con seguimiento al día", pct: active.length ? 1 - sinSeguimiento / active.length : 1, w: 25 },
    cotizaciones: { label: "Cotizaciones con seguimiento", pct: myQuotes.length ? cotCon / myQuotes.length : 1, w: 25 },
    conversion: { label: "Conversión (meta 30%)", pct: won + lost ? Math.min(1, won / (won + lost) / 0.3) : 0, w: 20 },
  };
  const score = Math.round(Object.values(parts).reduce((a, p) => a + p.pct * p.w, 0));
  return { score, parts, counts: { pendingReply, sinSeguimiento, cotPend, active: active.length, won, conv: won + lost ? Math.round((won / (won + lost)) * 100) : 0 } };
}
