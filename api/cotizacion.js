// Vista previa del enlace de cotización (/autoshow/c/:token) para WhatsApp y redes:
// devuelve la misma app, pero con etiquetas Open Graph que muestran la foto y el nombre del asesor.
// Usa el modo `preview` de autoshow-cotizacion, así que no cuenta como "el cliente abrió".
export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://sqcsjcdtahptpxwczoyy.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || "sb_publishable_7k7XlZVRJEw5XYUuk2hzCA_LiEtF9QJ";
const file = (p) => `${SUPABASE_URL}/storage/v1/object/public/assets/${p}`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function quote(token) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/autoshow-cotizacion`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify({ token, preview: true }),
  });
  return r.ok ? r.json() : null;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const page = await fetch(new URL("/index.html", url)).then((r) => r.text());
  let meta = `<meta property="og:title" content="Su cotización Jetour" /><meta property="og:site_name" content="Jetour Guatemala" />`;
  try {
    const d = await quote(token);
    if (d?.quote) {
      const { quote: q, model: m, seller } = d;
      const c = (m?.colors || []).find((x) => x.name === q.color);
      const any = (m?.colors || []).find((x) => x.img || x.ref);
      const car = c?.img || c?.ref || q.color_img || any?.img || any?.ref;
      const img = seller?.photo ? file(seller.photo) : car ? file(`${car}.webp`) : null;
      const title = `Cotización ${m?.name || "Jetour"}${q.color ? ` · ${q.color}` : ""}`;
      const desc = seller?.name ? `Le atiende ${seller.name}, asesor Jetour. Toque para ver precio, cuota y videos.` : "Toque para ver precio, cuota y videos.";
      meta = [
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="Jetour Guatemala" />`,
        `<meta property="og:title" content="${esc(title)}" />`,
        `<meta property="og:description" content="${esc(desc)}" />`,
        `<meta property="og:url" content="${esc(url.origin + "/autoshow/c/" + token)}" />`,
        img && `<meta property="og:image" content="${esc(img)}" />`,
        img && `<meta property="og:image:alt" content="${esc(seller?.name || m?.name || "")}" />`,
        `<meta name="twitter:card" content="summary" />`,
      ].filter(Boolean).join("");
    }
  } catch {}
  return new Response(page.replace("</head>", `${meta}</head>`), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
