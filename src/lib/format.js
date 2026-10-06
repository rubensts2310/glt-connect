export const FX = 7.7;
export const fmtQ = (n) => "Q" + Math.round(Number(n) || 0).toLocaleString("en-US");
export const fmtUSD = (n) => "US$" + Math.round(Number(n) || 0).toLocaleString("en-US");
export const toGTQ = (price, currency) => (currency === "USD" ? price * FX : price);
export const priceMain = (m) => (m.currency === "USD" ? fmtUSD(m.price) : fmtQ(m.price));
export const priceSub = (m) => (m.currency === "USD" ? `≈ ${fmtQ(m.price * FX)}` : null);

export const STAGES = [
  { id: "nuevo", label: "Nuevo" },
  { id: "contactado", label: "Contactado" },
  { id: "calificado", label: "Calificado" },
  { id: "cotizado", label: "Cotizado" },
  { id: "test_drive", label: "Test drive" },
  { id: "financiamiento", label: "Financiamiento" },
  { id: "negociacion", label: "Negociación" },
  { id: "ganado", label: "Ganado" },
  { id: "perdido", label: "Perdido" },
];
export const stageLabel = (id) => STAGES.find((s) => s.id === id)?.label ?? id;

export const CHANNELS = {
  meta: "Meta", whatsapp: "WhatsApp", web: "Web", google: "Google", llamada: "Llamada", sala: "Sala", evento: "Evento", hubspot: "HubSpot",
};
export const TEMP = {
  caliente: { label: "Caliente", cls: "hot" },
  tibio: { label: "Tibio", cls: "warm" },
  frio: { label: "Frío", cls: "cold" },
};
export const PAGO = { contado: "Contado", credito: "Crédito", no_sabe: "No sabe aún" };
export const PLAZO = { inmediato: "Este mes", "1-3m": "1 a 3 meses", "3-6m": "3 a 6 meses", "6m+": "6 meses o más" };
export const FACTORS = {
  canal: "Canal de origen", modelo: "Modelo definido", pago: "Forma de pago", plazo: "Plazo de compra",
  parte_pago: "Parte de pago declarada", cotizacion: "Interacción con cotización", respuesta: "Velocidad de atención",
};

export function ago(ts) {
  if (!ts) return "—";
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return "hace segundos";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "ayer" : `hace ${d} días`;
}
export const minsBetween = (a, b) => (new Date(b || Date.now()) - new Date(a)) / 60000;
export const fmtMin = (m) => (m == null ? "—" : m < 60 ? `${Math.round(m)} min` : m < 1440 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m / 1440)} d`);
export const fmtDate = (ts, opts) =>
  new Date(ts).toLocaleString("es-GT", { timeZone: "America/Guatemala", ...(opts || { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) });

export function cuota(principal, ratePct, months) {
  const r = ratePct / 100 / 12;
  if (!r) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}
export const initials = (n = "") => n.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
