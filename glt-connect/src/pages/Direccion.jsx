import { useEffect, useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { sb } from "../lib/supabase";
import { CHANNELS, fmtMin, fmtQ, minsBetween, stageLabel } from "../lib/format";
import { TopBar } from "../components/Shell";
import { AreaChart, Donut, Funnel, Lollipop, Ring } from "../components/charts";
import { SellerAvatar } from "../components/bits";
import { ILock } from "../components/icons";

const MES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const OPEN = ["calificado", "cotizado", "test_drive", "financiamiento", "negociacion"];

export default function Direccion() {
  const { leads, brands, vendedores, modelById } = useStore();
  const [sat, setSat] = useState([]);
  const [ads, setAds] = useState([]);
  const [quotes, setQuotes] = useState([]);
  useEffect(() => {
    sb.from("sat_monthly").select("*").order("period").then(({ data }) => setSat(data || []));
    sb.from("ad_monthly").select("*").order("period").then(({ data }) => setAds(data || []));
    sb.from("quotes").select("lead_id,price,currency,status").then(({ data }) => setQuotes(data || []));
  }, []);

  const periods = [...new Set(sat.map((r) => r.period))];
  const serie = (b) => periods.map((p) => sat.find((r) => r.brand === b && r.period === p)?.units || 0);
  const sum = (b, from, to) => sat.filter((r) => r.brand === b && r.period >= from && r.period <= to).reduce((a, r) => a + r.units, 0);
  const growth = (b) => { const a = sum(b, "2026-01-01", "2026-08-01"), p = sum(b, "2025-01-01", "2025-08-01"); return p ? Math.round(((a - p) / p) * 100) : 0; };
  const comp = ["Jetour", "BYD", "Chery", "Changan", "JAC", "Great Wall", "Toyota", "Kia"];
  const jet = sum("Jetour", "2026-01-01", "2026-08-01");

  const pipeline = useMemo(() => {
    const open = new Set(leads.filter((l) => OPEN.includes(l.stage)).map((l) => l.id));
    return quotes.filter((q) => open.has(q.lead_id)).reduce((a, q) => a + Number(q.price) * (q.currency === "USD" ? 7.7 : 1), 0);
  }, [leads, quotes]);
  const won = leads.filter((l) => l.stage === "ganado");
  const lost = leads.filter((l) => l.stage === "perdido");
  const lostBy = Object.entries(lost.reduce((a, l) => ((a[l.lost_reason || "Otro"] = (a[l.lost_reason || "Otro"] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
  const lastAds = ads.filter((a) => a.period === ads[ads.length - 1]?.period);
  const cpl = lastAds.map((a) => ({ label: CHANNELS[a.channel] || a.channel, value: Math.round(a.spend / a.leads) })).sort((a, b) => a.value - b.value);
  const modelsWon = Object.entries(won.reduce((a, l) => ((a[l.model_id] = (a[l.model_id] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const colors = ["#0d1014", "#00aeef", "#0a3a7a", "#7d95ad", "#f2a516", "#ff5b3a"];

  return (
    <>
      <TopBar title="Tablero de dirección" crumbs="Grupo Los Tres · todas las marcas" />
      <div className="card" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <span className="label" style={{ marginRight: 6 }}>Portafolio</span>
        {brands.map((b) => (
          <span key={b.id} className={`chip ${b.active ? "dark" : ""}`} style={{ padding: "6px 12px", fontSize: 12.5 }} title={b.active ? "Piloto activo" : "Próximamente"}>
            {!b.active && <ILock />}{b.name}{b.active && " · piloto"}
          </span>
        ))}
      </div>
      <div className="grid g4">
        <div className="card kpi dark"><span className="label">Jetour ene–ago 2026 · SAT</span><span className="v">{jet} u.</span><span className="d">+{growth("Jetour")}% vs mismo período 2025</span></div>
        <div className="card kpi"><span className="label">Pipeline cotizado abierto</span><span className="v">Q{(pipeline / 1e6).toFixed(1)} M</span><span className="d muted">{fmtQ(pipeline)} en cotizaciones vivas</span></div>
        <div className="card kpi accent"><span className="label">Ventas cerradas · 90 días</span><span className="v">{won.length}</span><span className="d">{fmtQ(won.reduce((a, l) => a + Number(l.sale_amount || 0), 0))}</span></div>
        <div className="card kpi"><span className="label">Conversión lead → venta</span><span className="v">{Math.round((won.length / Math.max(1, won.length + lost.length)) * 100)}%</span><span className="d muted">{lost.length} perdidos con motivo registrado</span></div>
      </div>
      <div className="grid g-main">
        <div className="card">
          <div className="card-head"><h2>Jetour vs chinas de su tamaño · inscripciones SAT</h2><span className="faint" style={{ fontSize: 12 }}>Livianos nuevos · ene 2025 – ago 2026</span></div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5 }}>
            {[["Jetour", "var(--blue)"], ["Chery", "#0d1014"], ["Great Wall", "#9aa1ad"]].map(([n, c]) => <span key={n}><span className="dot" style={{ background: c, marginRight: 6 }} />{n}</span>)}
          </div>
          {periods.length > 0 && <AreaChart labels={periods.map((p) => MES[Number(p.slice(5, 7)) - 1])} markers={[{ i: 8, label: "sep 2025" }]}
            series={[{ name: "Great Wall", color: "#9aa1ad", values: serie("Great Wall"), area: false, width: 2, dash: "5 4" }, { name: "Chery", color: "#0d1014", values: serie("Chery"), area: false, width: 2 }, { name: "Jetour", color: "#00aeef", values: serie("Jetour"), dotLast: true, width: 3, opacity: 0.18 }]} />}
        </div>
        <div className="card">
          <div className="card-head"><h2>Crecimiento ene–ago 26/25</h2><span className="faint" style={{ fontSize: 12 }}>SAT</span></div>
          {sat.length > 0 && <Lollipop items={comp.map((b) => ({ label: b, value: growth(b), color: b === "Jetour" ? "var(--blue)" : growth(b) < 0 ? "var(--bad)" : "var(--ink)", bold: b === "Jetour" })).sort((a, b) => b.value - a.value)} fmt={(v) => `${v > 0 ? "+" : ""}${v}%`} labelW={90} width={400} />}
        </div>
      </div>
      <div className="grid g3">
        <div className="card">
          <h2>Embudo del grupo</h2>
          <Funnel steps={(() => { const ord = ["contactado", "calificado", "cotizado", "test_drive", "financiamiento", "negociacion", "ganado"]; return ord.map((st, i) => ({ label: stageLabel(st), value: leads.filter((l) => ord.indexOf(l.stage) >= i).length, color: st === "ganado" ? "var(--blue)" : "var(--ink)" })); })()} />
        </div>
        <div className="card">
          <div className="card-head"><h2>Costo por lead</h2><span className="faint" style={{ fontSize: 12 }}>Pauta del mes</span></div>
          <Lollipop items={cpl.map((c) => ({ ...c, color: "var(--navy)" }))} fmt={(v) => fmtQ(v)} labelW={80} width={340} rowH={40} />
          <span className="faint" style={{ fontSize: 12 }}>Inversión {fmtQ(lastAds.reduce((a, x) => a + Number(x.spend), 0))} · {lastAds.reduce((a, x) => a + x.leads, 0)} leads</span>
        </div>
        <div className="card">
          <h2>Por qué se pierden</h2>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <Donut items={lostBy.map(([k, v], i) => ({ label: k, value: v, color: colors[i % colors.length] }))} size={130} center={lost.length} sub="perdidos" />
            <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, flex: 1, minWidth: 130 }}>
              {lostBy.map(([k, v], i) => <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span><span className="dot" style={{ background: colors[i % colors.length], marginRight: 6 }} />{k}</span><b className="num">{v}</b></div>)}
            </div>
          </div>
        </div>
      </div>
      <div className="grid g2">
        <div className="card">
          <div className="card-head"><h2>Atención por asesor</h2><span className="faint" style={{ fontSize: 12 }}>Respuesta real vs mystery shopper</span></div>
          <div className="list">{vendedores.map((s) => {
            const r = leads.filter((l) => l.seller_id === s.id && l.first_response_at && l.assigned_at).map((l) => minsBetween(l.assigned_at, l.first_response_at)).sort((a, b) => a - b);
            const med = r.length ? r[Math.floor(r.length / 2)] : null;
            return (
              <div key={s.id} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto auto" }}>
                <SellerAvatar id={s.id} showName />
                <span className={`chip ${med <= 5 ? "good" : med <= 15 ? "warm" : "bad"}`}>{fmtMin(med)}</span>
                <Ring value={s.mystery_score || 0} size={42} stroke={5} color={s.mystery_score >= 60 ? "var(--good)" : s.mystery_score >= 40 ? "var(--warm)" : "var(--bad)"} />
              </div>
            );
          })}</div>
        </div>
        <div className="card">
          <h2>Modelos vendidos · 90 días</h2>
          <Lollipop items={modelsWon.map(([m, v]) => ({ label: modelById[m]?.name || m, value: v, color: "var(--ink)" }))} fmt={(v) => `${v} u.`} labelW={120} />
        </div>
      </div>
    </>
  );
}
