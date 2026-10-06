import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { asset, assetFile, fn } from "../lib/supabase";
import { FX, cuota, fmtQ, fmtUSD, toGTQ } from "../lib/format";
import { Loading } from "../components/bits";
import { AngleViewer, Pano360, VideoReel } from "../components/Media";

export function slots() {
  const out = []; const now = new Date();
  for (let d = 1; out.length < 12 && d < 10; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    if (day.getDay() === 0) continue;
    for (const h of [9, 11, 14, 16]) out.push(new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), h + 6, 0)).toISOString());
  }
  return out;
}

// Número que sube animado hasta su valor (arranca visible desde el valor final si el usuario prefiere menos movimiento)
export function CountUp({ value, fmt = (v) => v, ms = 900 }) {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [v, setV] = useState(reduce ? value : value * 0.6);
  const from = useRef(v);
  useEffect(() => {
    if (reduce) { setV(value); return; }
    const a = from.current, t0 = performance.now(); let raf;
    const step = (t) => { const p = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - p, 3); setV(a + (value - a) * e); if (p < 1) raf = requestAnimationFrame(step); else from.current = value; };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className="num">{fmt(v)}</span>;
}

export function Countdown({ until }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const ms = new Date(until + "T23:59:59-06:00") - now;
  if (ms <= 0) return null;
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1e3);
  const box = (n, l) => <div style={{ background: "rgba(255,255,255,.12)", borderRadius: 10, padding: "6px 0", minWidth: 50, textAlign: "center" }}><div className="num" style={{ fontSize: 20, fontWeight: 800 }}>{String(n).padStart(2, "0")}</div><div style={{ fontSize: 10, opacity: 0.7, letterSpacing: ".06em" }}>{l}</div></div>;
  return (
    <div style={{ background: "var(--hot)", color: "#fff", borderRadius: 18, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
      <b style={{ fontSize: 13.5, maxWidth: 140 }}>Su bono vence en</b>
      <div style={{ display: "flex", gap: 6 }}>{box(d, "DÍAS")}{box(h, "HRS")}{box(m, "MIN")}{box(s, "SEG")}</div>
    </div>
  );
}

export function Confetti({ run }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!run || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const c = ref.current, ctx = c.getContext("2d"); c.width = innerWidth; c.height = innerHeight;
    const cols = ["#00aeef", "#0a3a7a", "#ff5b3a", "#f2a516", "#17a673", "#0d1014"];
    const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight * 0.7, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 16 - 6, r: Math.random() * 6 + 3, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6 }));
    let raf, t = 0;
    const step = () => { ctx.clearRect(0, 0, c.width, c.height); ps.forEach((p) => { p.vy += 0.45; p.x += p.vx; p.y += p.vy; p.a += 0.2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6); ctx.restore(); }); if (t++ < 160) raf = requestAnimationFrame(step); else ctx.clearRect(0, 0, c.width, c.height); };
    step();
    return () => cancelAnimationFrame(raf);
  }, [run]);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 80 }} aria-hidden="true" />;
}

const fade = (i) => ({ animation: `qin .6s ${0.08 * i}s both cubic-bezier(.2,.7,.2,1)` });

export default function PublicQuote() {
  const { token } = useParams();
  const [sp] = useSearchParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [eng, setEng] = useState(0);
  const [term, setTerm] = useState(60);
  const [bank, setBank] = useState(null);
  const [picker, setPicker] = useState(false);
  const [slot, setSlot] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pi, setPi] = useState(0);
  const simTimer = useRef(null);

  useEffect(() => {
    fn("quote", { action: "get", token, preview: sp.get("preview") === "1" })
      .then((r) => { setD(r); setTerm(r.quote.term_months || 60); setBank(r.quote.bank); if (r.test_drive) setDone("test_drive_prev"); })
      .catch((e) => setErr(e.message));
  }, [token]);

  const base = useMemo(() => {
    if (!d) return null;
    const q = d.quote;
    const list = toGTQ(Number(q.price), q.currency);
    const accT = (q.accessories || []).reduce((a, x) => a + x.price, 0);
    const trade = Number(q.trade_in?.value || 0);
    return { list, accT, trade, total: list + accT - Number(q.bonus_amount || 0) - trade };
  }, [d]);
  useEffect(() => { if (base && d && !eng) setEng(Math.round((base.total * (Number(d.quote.down_payment_pct) || 20)) / 100 / 1000) * 1000); }, [base]);
  const rate = d ? (d.banks || []).find((b) => b.name === bank)?.rate ?? Number(d.quote.rate) ?? 9.5 : 9.5;
  const monthly = base ? cuota(Math.max(0, base.total - eng), rate, term) : 0;

  if (err) return <div style={{ padding: 40, textAlign: "center" }}><h2>Esta cotización no está disponible</h2><p className="muted">{err}</p></div>;
  if (!d || !base) return <Loading text="Preparando su cotización…" />;
  const { quote: q, model: m, seller } = d;
  const color = (m.colors || []).find((c) => c.name === q.color) || { img: q.color_img, name: q.color };
  const panos = (m.media || []).filter((x) => x.type === "pano");
  const videos = (m.media || []).filter((x) => x.type === "video");
  const images = (m.media || []).filter((x) => x.type === "image");
  const version = (m.versions || []).find((v) => (m.powertrain.includes("Híbrido") ? /h[íi]brid/i.test(v.name) : !/h[íi]brid/i.test(v.name))) || { specs: m.specs, hl: m.highlights };
  const engPct = Math.round((eng / base.total) * 100);
  const cta = async (type, meta) => {
    setBusy(true);
    try { await fn("quote", { action: "cta", token, type, meta }); if (type !== "simulador") setDone(type); } catch (e) { alert(e.message); }
    setBusy(false);
  };
  const logSim = () => { clearTimeout(simTimer.current); simTimer.current = setTimeout(() => fn("quote", { action: "cta", token, type: "simulador", meta: { enganche: engPct, monto: eng, plazo: term } }).catch(() => {}), 1200); };
  const salaTxt = seller?.showroom_id === "jlib" ? "Jetour Liberación" : "Jetour 20 Calle";
  const scheduled = done === "test_drive" || done === "test_drive_prev";

  return (
    <div style={{ background: "#e9ebee", minHeight: "100%" }}>
      <style>{`@keyframes qin{from{opacity:.001;transform:translateY(14px)}to{opacity:1;transform:none}} @keyframes shine{0%{background-position:-200% 0}100%{background-position:200% 0}} @media (prefers-reduced-motion: reduce){*{animation:none!important}}`}</style>
      <Confetti run={done === "quiero_este"} />
      <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: 96 }}>
        {/* Encabezado oscuro con el modelo */}
        <section style={{ background: "#0d1014", color: "#fff", padding: "18px 20px 0", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <img src={assetFile("jetour_logo_light.png")} alt="Jetour" style={{ height: 15 }} />
            <span style={{ fontSize: 11.5, opacity: 0.7, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600 }}>Cotización para {d.client || "usted"}</span>
          </div>
          <h1 style={{ fontSize: 46, marginTop: 18, lineHeight: 1, ...fade(0) }}>{m.name}</h1>
          <p style={{ margin: "8px 0 0", opacity: 0.75, ...fade(1) }}>{m.tagline}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, ...fade(2) }}>
            <span className="chip" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}>{q.color}</span>
            <span className="chip" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}>{m.powertrain}</span>
            <span className="chip" style={{ background: "var(--blue)", color: "#fff" }}>Garantía {m.warranty}</span>
          </div>
          <div style={{ margin: "14px -20px 0", background: "linear-gradient(#0d1014 0%, #0d1014 30%, #fff 30%)", ...fade(3) }}>
            <div style={{ padding: "0 12px" }}><AngleViewer color={color} alt={m.name} /></div>
          </div>
        </section>

        {videos.length > 0 && (
          <section style={{ padding: "4px 20px 6px", ...fade(4) }}>
            <VideoReel videos={videos} title={`La ${m.name} en acción`} />
          </section>
        )}

        {/* Datos clave */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, padding: "14px 20px" }}>
          {(version.hl || m.highlights || []).map((h, i) => (
            <div key={i} style={{ background: "var(--card2)", borderRadius: 16, padding: "12px 8px", textAlign: "center", ...fade(4 + i) }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{h[0]}<span style={{ fontSize: 12, marginLeft: 2 }}>{h[1]}</span></div>
              <div className="faint" style={{ fontSize: 11.5 }}>{h[2]}</div>
            </div>
          ))}
        </section>
        {version.phev && <p style={{ margin: "0 20px 14px", fontSize: 13.5, background: "var(--blue-soft)", padding: 12, borderRadius: 14 }}>⚡ {version.phev}</p>}

        {/* Interior 360 */}
        {panos.length > 0 && (
          <section style={{ padding: "0 20px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2>Súbase por dentro</h2>
              {panos.length > 1 && <div className="seg">{panos.map((p, i) => <button key={p.src} className={i === pi ? "on" : ""} onClick={() => setPi(i)} style={{ padding: "5px 10px", fontSize: 12 }}>{p.label.replace("Interior ", "")}</button>)}</div>}
            </div>
            <Pano360 src={panos[pi].src} label={panos[pi].label} height={230} />
          </section>
        )}
        {images.length > 0 && (
          <section style={{ padding: "0 20px 18px", display: "flex", gap: 8, overflowX: "auto", scrollSnapType: "x mandatory" }}>
            {images.map((x) => <img key={x.src} src={asset(x.src)} alt={x.label} loading="lazy" style={{ width: "78%", flex: "0 0 auto", borderRadius: 16, aspectRatio: "16/10", objectFit: "cover", scrollSnapAlign: "start" }} />)}
          </section>
        )}

        {/* Inversión */}
        <section style={{ padding: "0 20px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          <h2>Su inversión</h2>
          {[
            ["Precio de lista", q.currency === "USD" ? `${fmtUSD(q.price)} (≈ ${fmtQ(base.list)})` : fmtQ(base.list)],
            ...(q.accessories || []).map((a) => [a.name, `+ ${fmtQ(a.price)}`]),
            ...(q.bonus_amount ? [[q.bonus_label || "Bono", `− ${fmtQ(q.bonus_amount)}`]] : []),
            ...(base.trade ? [[`Su vehículo: ${q.trade_in.desc || "parte de pago"}`, `− ${fmtQ(base.trade)}`]] : []),
          ].map(([k, v], i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}><span className="muted">{k}</span><b className="num" style={{ color: v.startsWith("−") ? "var(--good)" : undefined }}>{v}</b></div>)}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 4 }}><b>Total</b><b style={{ fontSize: 26 }}><CountUp value={base.total} fmt={fmtQ} /></b></div>
          <span className="faint" style={{ fontSize: 11.5 }}>Precios con IVA incluido.{q.currency === "USD" ? ` Tipo de cambio referencial Q${FX}.` : ""}</span>
          {q.bonus_amount > 0 && q.valid_until && <Countdown until={q.valid_until} />}
        </section>

        {/* Simulador */}
        <section style={{ margin: "0 20px 20px", background: "var(--ink)", color: "#fff", borderRadius: 22, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="label" style={{ color: "rgba(255,255,255,.6)" }}>Simule su cuota</span>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-.03em" }}><CountUp value={monthly} fmt={fmtQ} ms={500} /><span style={{ fontSize: 14, fontWeight: 600 }}> /mes</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13 }}>Enganche</span>
            <label style={{ display: "flex", alignItems: "center", gap: 6, background: "#22262d", borderRadius: 12, padding: "6px 10px" }}>
              <span style={{ opacity: 0.6 }}>Q</span>
              <input type="number" inputMode="numeric" step={5000} value={eng} onChange={(e) => { setEng(Math.max(0, Math.min(base.total, Number(e.target.value)))); logSim(); }} aria-label="Enganche en quetzales"
                style={{ width: 110, background: "transparent", border: 0, color: "#fff", fontWeight: 800, fontSize: 16, outline: "none" }} />
              <span style={{ opacity: 0.6, fontSize: 12 }}>{engPct}%</span>
            </label>
          </div>
          <input type="range" min={0} max={Math.round(base.total * 0.6 / 5000) * 5000} step={5000} value={eng} onChange={(e) => { setEng(Number(e.target.value)); logSim(); }} style={{ width: "100%" }} aria-label="Ajustar enganche" />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[36, 48, 60, 72].map((t) => <button key={t} className="btn sm" style={{ background: t === term ? "#fff" : "#22262d", color: t === term ? "var(--ink)" : "#fff" }} onClick={() => { setTerm(t); logSim(); }}>{t} meses</button>)}
          </div>
          <select className="sel" value={bank || ""} onChange={(e) => setBank(e.target.value)} style={{ background: "#22262d", color: "#fff", border: 0 }} aria-label="Banco">
            {(d.banks || []).map((b) => <option key={b.name} value={b.name}>{b.name} · {b.rate}% anual</option>)}
          </select>
          <span style={{ fontSize: 11.5, opacity: 0.6 }}>Cálculo referencial, sujeto a aprobación del banco.</span>
        </section>

        {/* Ficha */}
        <section style={{ padding: "0 20px 16px" }}>
          <details className="card flat" style={{ padding: 16 }}>
            <summary style={{ fontWeight: 700, cursor: "pointer" }}>Ficha técnica completa</summary>
            {(version.specs || []).map((g) => (
              <div key={g.t} style={{ marginTop: 12 }}>
                <span className="label">{g.t}</span>
                {g.rows.map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}><span className="muted">{k}</span><b style={{ textAlign: "right" }}>{v}</b></div>)}
              </div>
            ))}
          </details>
        </section>

        {/* Test drive */}
        <section style={{ padding: "0 20px 16px" }}>
          {scheduled ? (
            <div className="card flat" style={{ textAlign: "center" }}><b>✓ Test drive agendado</b><span className="muted">{seller?.name} le confirmará por WhatsApp. Le esperamos en {salaTxt}.</span></div>
          ) : picker ? (
            <div className="card flat" id="agenda">
              <b>Elija su horario en {salaTxt}</b>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }}>
                {slots().map((s) => <button key={s} className={`btn sm ${slot === s ? "" : "ghost"}`} onClick={() => setSlot(s)}>{new Date(s).toLocaleString("es-GT", { timeZone: "America/Guatemala", weekday: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</button>)}
              </div>
              <button className="btn blue" disabled={!slot || busy} onClick={() => cta("test_drive", { slot, showroom: seller?.showroom_id })}>Confirmar test drive</button>
            </div>
          ) : null}
          <p className="faint" style={{ textAlign: "center", fontSize: 12, margin: "10px 0 0" }}>Su asesor: <b>{seller?.name}</b> · {salaTxt}</p>
        </section>
      </div>

      {/* Barra fija de acciones */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, display: "flex", justifyContent: "center", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div style={{ width: "100%", maxWidth: 560, background: "rgba(255,255,255,.94)", backdropFilter: "blur(10px)", borderTop: "1px solid var(--line)", padding: "10px 14px", display: "grid", gridTemplateColumns: scheduled ? "1fr 1fr" : "1.2fr 1fr 1fr", gap: 8 }}>
          {!scheduled && <button className="btn blue" style={{ padding: 13, backgroundImage: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,.35) 50%, transparent 60%)", backgroundSize: "200% 100%", animation: "shine 2.6s linear infinite" }}
            onClick={() => { setPicker(true); setTimeout(() => document.getElementById("agenda")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); }}>Test drive</button>}
          <Link className="btn ghost" style={{ padding: 13 }} to={`/chat/${d.chat_token}`} onClick={() => fn("quote", { action: "cta", token, type: "whatsapp" }).catch(() => {})}>WhatsApp</Link>
          <button className="btn" style={{ padding: 13 }} disabled={busy || done === "quiero_este"} onClick={() => cta("quiero_este")}>{done === "quiero_este" ? "¡Listo!" : "Quiero este"}</button>
        </div>
      </div>
    </div>
  );
}
