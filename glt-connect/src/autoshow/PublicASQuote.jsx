// Cotización del autoshow que abre el cliente en su celular
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { asset, assetFile, SUPABASE_KEY, SUPABASE_URL } from "../lib/supabase";
import { cuota, fmtQ, fmtUSD } from "../lib/format";
import { Loading } from "../components/bits";
import { AngleViewer, Pano360, VideoReel } from "../components/Media";
import { Confetti, CountUp, Countdown, slots } from "../pages/PublicQuote";
import { waLink } from "./store";

async function call(body) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/autoshow-cotizacion`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || "Error"); e.status = r.status; throw e; }
  return d;
}
const fade = (i) => ({ animation: `qin .6s ${0.08 * i}s both cubic-bezier(.2,.7,.2,1)` });

export default function PublicASQuote() {
  const { token } = useParams();
  const [sp] = useSearchParams();
  const [d, setD] = useState(null);
  const [state, setState] = useState("loading");
  const [eng, setEng] = useState(0);
  const [term, setTerm] = useState(60);
  const [bank, setBank] = useState(null);
  const [pi, setPi] = useState(0);
  const [picker, setPicker] = useState(false);
  const [slot, setSlot] = useState(null);
  const [done, setDone] = useState(null);
  const tries = useRef(0);

  useEffect(() => {
    document.title = "Su cotización Jetour";
    let t;
    const load = () => call({ token, preview: sp.get("preview") === "1" })
      .then((r) => { setD(r); setState("ok"); setEng(Number(r.quote.enganche_q) || 0); setTerm(r.quote.term_months || 60); setBank(r.quote.bank || r.banks?.[0]?.name); })
      .catch((e) => { if (e.status === 404 && e.message === "pending" && tries.current++ < 40) { setState("pending"); t = setTimeout(load, 5000); } else setState("error"); });
    load();
    return () => clearTimeout(t);
  }, [token]); // eslint-disable-line

  const calc = useMemo(() => {
    if (!d) return null;
    const q = d.quote, fx = d.fx || 7.7;
    const list = q.currency === "USD" ? Number(q.price) * fx : Number(q.price);
    const acc = (q.accessories || []).reduce((a, x) => a + Number(x.price || 0), 0);
    const trade = Number(q.trade_in?.value || 0);
    return { list, acc, trade, total: Math.max(0, list + acc - Number(q.bonus_amount || 0) - trade) };
  }, [d]);

  if (state === "loading") return <Loading text="Preparando su cotización…" />;
  if (state === "pending") return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 30, textAlign: "center", background: "#0d1014", color: "#fff" }}>
      <div><img src={assetFile("jetour_logo_light.png")} alt="Jetour" style={{ height: 16 }} /><h2 style={{ marginTop: 26 }}>Su cotización viene en camino</h2><p style={{ opacity: 0.7 }}>La tablet del stand la está subiendo. Esta página se actualiza sola en unos segundos.</p><span className="spin" /></div>
    </div>
  );
  if (state === "error" || !d) return <div style={{ padding: 40, textAlign: "center" }}><h2>Esta cotización no está disponible</h2><p className="muted">Pida a su asesor que se la envíe de nuevo.</p></div>;

  const { quote: q, model: m, seller } = d;
  const contado = !q.term_months;
  const color = (m.colors || []).find((c) => c.name === q.color) || { img: q.color_img, name: q.color };
  const videos = (m.media || []).filter((x) => x.type === "video");
  const panos = (m.media || []).filter((x) => x.type === "pano");
  const rate = (d.banks || []).find((b) => b.name === bank)?.rate ?? Number(q.rate) ?? 9.5;
  const engC = Math.min(eng, calc.total);
  const monthly = cuota(Math.max(0, calc.total - engC), rate, term);
  const version = (m.versions || []).find((v) => (/h[íi]brid/i.test(m.powertrain || "") ? /h[íi]brid/i.test(v.name) : !/h[íi]brid/i.test(v.name))) || { specs: m.specs, hl: m.highlights };
  const first = d.client;
  const cta = async (type, extra) => { try { await call({ token, action: "cta", type, ...extra }); } catch {} if (type !== "whatsapp") setDone(type); };
  const waSeller = seller?.phone ? waLink(seller.phone, `Hola ${seller.name.split(" ")[0]}, soy ${first}. Vi mi cotización de la ${m.name} ${q.color || ""} y tengo una consulta.`) : null;

  return (
    <div style={{ background: "#e9ebee", minHeight: "100%" }}>
      <style>{`@keyframes qin{from{opacity:.001;transform:translateY(14px)}to{opacity:1;transform:none}} @keyframes shine{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
      <Confetti run={done === "quiero_este"} />
      <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: 100 }}>
        <section style={{ background: "#0d1014", color: "#fff", padding: "18px 20px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <img src={assetFile("jetour_logo_light.png")} alt="Jetour" style={{ height: 15 }} />
            <span style={{ fontSize: 11.5, opacity: 0.7, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600 }}>{d.event?.name || "Autoshow"} · {first || "Su cotización"}</span>
          </div>
          <h1 style={{ fontSize: 46, marginTop: 18, lineHeight: 1, ...fade(0) }}>{m.name}</h1>
          <p style={{ margin: "8px 0 0", opacity: 0.75, ...fade(1) }}>{m.tagline}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, ...fade(2) }}>
            {q.color && <span className="chip" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}>{q.color}</span>}
            <span className="chip" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}>{m.powertrain}</span>
            <span className="chip" style={{ background: "var(--blue)", color: "#fff" }}>Garantía {m.warranty}</span>
          </div>
          <div style={{ margin: "14px -20px 0", background: "linear-gradient(#0d1014 0%, #0d1014 30%, #fff 30%)", padding: "0 12px", ...fade(3) }}><AngleViewer color={color} alt={m.name} /></div>
        </section>

        {q.bonus_amount > 0 && (
          <section style={{ padding: "14px 20px 0" }}>
            <div style={{ background: "linear-gradient(90deg,#ff2d6f,#ff5a36)", color: "#fff", borderRadius: 18, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div><div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.85 }}>{q.bonus_label || "Bono Autoshow"}</div><div style={{ fontSize: 30, fontWeight: 800 }}>− {fmtQ(q.bonus_amount)}</div></div>
              <span style={{ fontSize: 34 }}>🎁</span>
            </div>
          </section>
        )}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, padding: "14px 20px" }}>
          {(version.hl || m.highlights || []).map((h, i) => (
            <div key={i} style={{ background: "var(--card2)", borderRadius: 16, padding: "12px 8px", textAlign: "center", ...fade(4 + i) }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{h[0]}<span style={{ fontSize: 12, marginLeft: 2 }}>{h[1]}</span></div>
              <div className="faint" style={{ fontSize: 11.5 }}>{h[2]}</div>
            </div>
          ))}
        </section>

        {videos.length > 0 && <section style={{ padding: "0 20px 18px" }}><VideoReel videos={videos} title={`La ${m.name} en acción`} /></section>}
        {panos.length > 0 && (
          <section style={{ padding: "0 20px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2>Súbase por dentro</h2>
              {panos.length > 1 && <div className="seg">{panos.map((p, i) => <button key={p.src} className={i === pi ? "on" : ""} onClick={() => setPi(i)} style={{ padding: "5px 10px", fontSize: 12 }}>{p.label.replace("Interior ", "")}</button>)}</div>}
            </div>
            <Pano360 src={panos[pi].src} label={panos[pi].label} height={230} />
          </section>
        )}

        <section style={{ padding: "0 20px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          <h2>Su inversión</h2>
          {[["Precio de lista", q.currency === "USD" ? `${fmtUSD(q.price)} (≈ ${fmtQ(calc.list)})` : fmtQ(calc.list)],
            ...(q.accessories || []).map((a) => [a.name, `+ ${fmtQ(a.price)}`]),
            ...(q.bonus_amount ? [[q.bonus_label || "Bono Autoshow", `− ${fmtQ(q.bonus_amount)}`]] : []),
            ...(calc.trade ? [[`Su vehículo: ${q.trade_in.desc}`, `− ${fmtQ(calc.trade)}`]] : [])].map(([k, v], i) =>
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}><span className="muted">{k}</span><b className="num" style={{ color: v.startsWith("−") ? "var(--good)" : undefined }}>{v}</b></div>)}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><b>Total</b><b style={{ fontSize: 30 }}><CountUp value={calc.total} fmt={fmtQ} /></b></div>
          <span className="faint" style={{ fontSize: 12 }}>Precios con IVA incluido.{q.valid_until ? ` Oferta válida hasta el ${new Date(q.valid_until + "T12:00:00").toLocaleDateString("es-GT", { day: "numeric", month: "long" })}.` : ""}</span>
          {q.valid_until && q.bonus_amount > 0 && <Countdown until={q.valid_until} />}
        </section>

        {!contado && (
          <section style={{ margin: "0 20px 20px", background: "var(--ink)", color: "#fff", borderRadius: 22, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.7, fontWeight: 700 }}>Simule su cuota</span>
            <div style={{ fontSize: 40, fontWeight: 800 }}><CountUp value={monthly} fmt={fmtQ} /><span style={{ fontSize: 16, opacity: 0.7 }}>/mes</span></div>
            <label style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Enganche</span><b>{fmtQ(engC)} ({calc.total ? Math.round((engC / calc.total) * 100) : 0}%)</b></label>
            <input type="range" min={0} max={Math.round((calc.total * 0.7) / 5000) * 5000} step={5000} value={engC} onChange={(e) => setEng(Number(e.target.value))} aria-label="Enganche" />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[36, 48, 60, 72].map((t) => <button key={t} className="btn sm" style={{ background: t === term ? "#fff" : "#22262d", color: t === term ? "var(--ink)" : "#fff" }} onClick={() => setTerm(t)}>{t} meses</button>)}</div>
            <select className="sel" value={bank || ""} onChange={(e) => setBank(e.target.value)} style={{ background: "#22262d", color: "#fff", border: 0 }}>{(d.banks || []).map((b) => <option key={b.name} value={b.name}>{b.name} · {b.rate}% anual</option>)}</select>
            <span style={{ fontSize: 11.5, opacity: 0.6 }}>Cálculo referencial, sujeto a aprobación del banco.</span>
          </section>
        )}

        {(version.specs || []).length > 0 && (
          <section style={{ padding: "0 20px 18px" }}>
            <details><summary style={{ fontWeight: 800, cursor: "pointer" }}>Ficha técnica completa</summary>
              {(version.specs || []).map((g) => <div key={g.t} style={{ marginTop: 10 }}><div className="label">{g.t}</div>{g.rows.map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "5px 0", borderBottom: "1px solid var(--line)" }}><span className="muted">{k}</span><b style={{ textAlign: "right" }}>{v}</b></div>)}</div>)}
            </details>
          </section>
        )}

        {picker && done !== "test_drive" && (
          <section id="agenda" style={{ padding: "0 20px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <h2>Elija su horario de test drive</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {slots().map((s) => <button key={s} className={`btn sm ${slot === s ? "" : "ghost"}`} onClick={() => setSlot(s)}>{new Date(s).toLocaleString("es-GT", { timeZone: "America/Guatemala", weekday: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</button>)}
            </div>
            <button className="btn blue" disabled={!slot} onClick={() => cta("test_drive", { when: new Date(slot).toLocaleString("es-GT", { timeZone: "America/Guatemala", weekday: "long", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) })}>Confirmar test drive</button>
          </section>
        )}
        {done && (
          <section style={{ margin: "0 20px 18px", padding: 16, borderRadius: 18, background: "var(--blue-soft)", textAlign: "center" }}>
            <b>{done === "quiero_este" ? "¡Excelente elección! 🎉" : "¡Listo!"}</b>
            <div style={{ fontSize: 14 }}>{seller?.name ? `${seller.name.split(" ")[0]} le contactará` : "Su asesor le contactará"} muy pronto para {done === "quiero_este" ? "apartar su unidad" : "confirmar su test drive"}.</div>
          </section>
        )}
        <p className="faint" style={{ textAlign: "center", fontSize: 12, padding: "0 20px" }}>Le atiende: <b>{seller?.name || "Jetour Guatemala"}</b></p>

        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "center", zIndex: 20 }}>
          <div style={{ width: "100%", maxWidth: 560, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "10px 12px calc(10px + env(safe-area-inset-bottom,0px))", background: "rgba(255,255,255,.95)", backdropFilter: "blur(10px)", borderTop: "1px solid var(--line)" }}>
            <button className="btn blue" style={{ padding: 13, backgroundImage: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,.35) 50%, transparent 60%)", backgroundSize: "200% 100%", animation: "shine 2.8s infinite" }} onClick={() => { setPicker(true); setTimeout(() => document.getElementById("agenda")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60); }}>Test drive</button>
            {waSeller ? <a className="btn ghost" style={{ padding: 13, justifyContent: "center" }} href={waSeller} target="_blank" rel="noreferrer" onClick={() => cta("whatsapp")}>WhatsApp</a>
              : <button className="btn ghost" style={{ padding: 13 }} onClick={() => cta("llamar")}>Que me llamen</button>}
            <button className="btn" style={{ padding: 13 }} disabled={done === "quiero_este"} onClick={() => cta("quiero_este")}>{done === "quiero_este" ? "¡Listo!" : "Lo quiero"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
