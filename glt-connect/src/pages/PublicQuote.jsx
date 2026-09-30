import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { asset, assetFile, fn } from "../lib/supabase";
import { FX, cuota, fmtQ, fmtUSD, toGTQ } from "../lib/format";
import { Loading } from "../components/bits";

function slots() {
  const out = []; const now = new Date();
  for (let d = 1; out.length < 12 && d < 10; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    if (day.getDay() === 0) continue;
    for (const h of [9, 11, 14, 16]) out.push(new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), h + 6, 0)).toISOString());
  }
  return out;
}

export default function PublicQuote() {
  const { token } = useParams();
  const [sp] = useSearchParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [down, setDown] = useState(20);
  const [term, setTerm] = useState(60);
  const [bank, setBank] = useState(null);
  const [picker, setPicker] = useState(false);
  const [slot, setSlot] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fn("quote", { action: "get", token, preview: sp.get("preview") === "1" })
      .then((r) => { setD(r); setDown(Number(r.quote.down_payment_pct) || 20); setTerm(r.quote.term_months || 60); setBank(r.quote.bank); if (r.test_drive) setDone("test_drive_prev"); })
      .catch((e) => setErr(e.message));
  }, [token]);

  const calc = useMemo(() => {
    if (!d) return {};
    const q = d.quote;
    const base = toGTQ(Number(q.price), q.currency);
    const accT = (q.accessories || []).reduce((a, x) => a + x.price, 0);
    const trade = Number(q.trade_in?.value || 0);
    const total = base + accT - Number(q.bonus_amount || 0) - trade;
    const rate = (d.banks || []).find((b) => b.name === bank)?.rate ?? Number(q.rate) ?? 9.5;
    const eng = (total * down) / 100;
    return { base, accT, trade, total, eng, rate, cuota: cuota(total - eng, rate, term) };
  }, [d, down, term, bank]);

  if (err) return <div style={{ padding: 40, textAlign: "center" }}><h2>Esta cotización no está disponible</h2><p className="muted">{err}</p></div>;
  if (!d) return <Loading text="Cargando su cotización…" />;
  const { quote: q, model: m, seller } = d;
  const daysLeft = Math.max(0, Math.ceil((new Date(q.valid_until) - Date.now()) / 864e5));
  const cta = async (type, meta) => {
    setBusy(true);
    try { await fn("quote", { action: "cta", token, type, meta }); if (type !== "simulador") setDone(type); } catch (e) { alert(e.message); }
    setBusy(false);
  };
  const salaTxt = seller?.showroom_id === "jlib" ? "Jetour Liberación" : "Jetour 20 Calle";

  return (
    <div style={{ background: "#f3f4f6", minHeight: "100%" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px" }}>
          <img src={assetFile("jetour_logo_dark.png")} alt="Jetour" style={{ height: 16 }} />
          <img src={assetFile("glt_icon.png")} alt="Grupo Los Tres" style={{ height: 26 }} />
        </header>
        <section style={{ padding: "4px 20px 0" }}>
          <span className="label">Cotización para {d.client || "usted"}</span>
          <h1 style={{ fontSize: 34, marginTop: 4 }}>{m.name}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>{m.tagline}</p>
        </section>
        <img className="car-img" src={asset(q.color_img)} alt={`${m.name} ${q.color}`} style={{ borderRadius: 0, marginTop: 8 }} />
        <div style={{ padding: "0 20px", display: "flex", gap: 8, flexWrap: "wrap", marginTop: -6 }}>
          <span className="chip dark">{q.color}</span><span className="chip">{m.powertrain}</span><span className="chip good">Garantía {m.warranty}</span>
          {daysLeft > 0 && daysLeft <= 15 && <span className="chip hot">Oferta válida {daysLeft} {daysLeft === 1 ? "día" : "días"} más</span>}
        </div>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, padding: 20 }}>
          {(m.highlights || []).map((h, i) => (
            <div key={i} style={{ background: "var(--card2)", borderRadius: 16, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{h[0]}<span style={{ fontSize: 12, marginLeft: 2 }}>{h[1]}</span></div>
              <div className="faint" style={{ fontSize: 11.5 }}>{h[2]}</div>
            </div>
          ))}
        </section>

        <section style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <h2>Su inversión</h2>
          {[
            ["Precio de lista", q.currency === "USD" ? `${fmtUSD(q.price)} (≈ ${fmtQ(calc.base)})` : fmtQ(calc.base)],
            ...(q.accessories || []).map((a) => [a.name, `+ ${fmtQ(a.price)}`]),
            ...(q.bonus_amount ? [[q.bonus_label || "Bono", `− ${fmtQ(q.bonus_amount)}`]] : []),
            ...(calc.trade ? [[`Su vehículo: ${q.trade_in.desc || "parte de pago"}`, `− ${fmtQ(calc.trade)}`]] : []),
          ].map(([k, v], i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}><span className="muted">{k}</span><b className="num">{v}</b></div>)}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 4 }}><b>Total</b><b className="num" style={{ fontSize: 20 }}>{fmtQ(calc.total)}</b></div>
          <span className="faint" style={{ fontSize: 11.5 }}>Precios con IVA incluido.{q.currency === "USD" ? ` Tipo de cambio referencial Q${FX}.` : ""}</span>
        </section>

        <section style={{ margin: "0 20px 20px", background: "var(--ink)", color: "#fff", borderRadius: 22, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="label" style={{ color: "rgba(255,255,255,.6)" }}>Simule su cuota</span>
          <div style={{ fontSize: 34, fontWeight: 800 }} className="num">{fmtQ(calc.cuota)}<span style={{ fontSize: 14, fontWeight: 600 }}> /mes</span></div>
          <label style={{ fontSize: 13 }}>Enganche {down}% · {fmtQ(calc.eng)}<input type="range" min={10} max={60} step={5} value={down} onChange={(e) => setDown(Number(e.target.value))} onMouseUp={() => cta("simulador", { enganche: down, plazo: term })} onTouchEnd={() => cta("simulador", { enganche: down, plazo: term })} style={{ width: "100%" }} /></label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[36, 48, 60, 72].map((t) => <button key={t} className="btn sm" style={{ background: t === term ? "#fff" : "#22262d", color: t === term ? "var(--ink)" : "#fff" }} onClick={() => setTerm(t)}>{t} meses</button>)}
          </div>
          <select className="sel" value={bank || ""} onChange={(e) => setBank(e.target.value)} style={{ background: "#22262d", color: "#fff", border: 0 }} aria-label="Banco">
            {(d.banks || []).map((b) => <option key={b.name} value={b.name}>{b.name} · {b.rate}% anual</option>)}
          </select>
          <span style={{ fontSize: 11.5, opacity: 0.6 }}>Cálculo referencial, sujeto a aprobación del banco.</span>
        </section>

        <section style={{ padding: "0 20px 16px" }}>
          <details className="card flat" style={{ padding: 16 }}>
            <summary style={{ fontWeight: 700, cursor: "pointer" }}>Ficha técnica</summary>
            {(m.specs || []).map((g) => (
              <div key={g.t} style={{ marginTop: 12 }}>
                <span className="label">{g.t}</span>
                {g.rows.map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}><span className="muted">{k}</span><b style={{ textAlign: "right" }}>{v}</b></div>)}
              </div>
            ))}
          </details>
        </section>

        <section style={{ padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
          {done === "test_drive" || done === "test_drive_prev" ? (
            <div className="card flat" style={{ textAlign: "center" }}><b>✓ Test drive agendado</b><span className="muted">{seller?.name} le confirmará por WhatsApp. Le esperamos en {salaTxt}.</span></div>
          ) : picker ? (
            <div className="card flat">
              <b>Elija su horario en {salaTxt}</b>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }}>
                {slots().map((s) => <button key={s} className={`btn sm ${slot === s ? "" : "ghost"}`} onClick={() => setSlot(s)}>{new Date(s).toLocaleString("es-GT", { timeZone: "America/Guatemala", weekday: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</button>)}
              </div>
              <button className="btn blue" disabled={!slot || busy} onClick={() => cta("test_drive", { slot, showroom: seller?.showroom_id })}>Confirmar test drive</button>
            </div>
          ) : (
            <button className="btn blue" style={{ padding: 15, fontSize: 15 }} onClick={() => setPicker(true)}>Agendar test drive</button>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Link className="btn ghost" style={{ padding: 13 }} to={`/chat/${d.chat_token}`} onClick={() => fn("quote", { action: "cta", token, type: "whatsapp" }).catch(() => {})}>Hablar por WhatsApp</Link>
            <button className="btn" style={{ padding: 13 }} disabled={busy || done === "quiero_este"} onClick={() => cta("quiero_este")}>{done === "quiero_este" ? "¡Listo! Le contactamos" : "Quiero este"}</button>
          </div>
          <p className="faint" style={{ textAlign: "center", fontSize: 12, margin: "6px 0 0" }}>Su asesor: <b>{seller?.name}</b> · {salaTxt}</p>
        </section>
      </div>
    </div>
  );
}
