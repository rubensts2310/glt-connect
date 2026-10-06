import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { sb } from "../lib/supabase";
import { ago, fmtDate, fmtQ, fmtUSD, toGTQ } from "../lib/format";
import { TopBar } from "../components/Shell";
import { SellerAvatar } from "../components/bits";

const SORTS = {
  fecha_desc: { label: "Más recientes", fn: (a, b) => new Date(b.sent_at || b.created_at) - new Date(a.sent_at || a.created_at) },
  fecha_asc: { label: "Más antiguas", fn: (a, b) => new Date(a.sent_at || a.created_at) - new Date(b.sent_at || b.created_at) },
  aperturas: { label: "Más abiertas", fn: (a, b) => b.open_count - a.open_count },
  precio: { label: "Mayor precio", fn: (a, b) => toGTQ(b.price, b.currency) - toGTQ(a.price, a.currency) },
};

export default function Cotizaciones() {
  const { quotes, leads, modelById, models, vendedores, meId, loadAux, toast } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [model, setModel] = useState("");
  const [seller, setSeller] = useState("");
  const [opened, setOpened] = useState("");
  const [follow, setFollow] = useState("");
  const [sort, setSort] = useState("fecha_desc");
  const byId = Object.fromEntries(leads.map((l) => [l.id, l]));

  const base = meId ? quotes.filter((x) => x.seller_id === meId) : quotes;
  const list = useMemo(() => base.filter((x) =>
    (!q || (byId[x.lead_id]?.name || "").toLowerCase().includes(q.toLowerCase())) &&
    (!model || modelById[x.model_id]?.family === model) &&
    (!seller || x.seller_id === seller) &&
    (!opened || (opened === "si" ? x.open_count > 0 : x.open_count === 0)) &&
    (!follow || (follow === "si" ? !!x.followed_up_at : !x.followed_up_at))
  ).sort(SORTS[sort].fn), [base, q, model, seller, opened, follow, sort, byId, modelById]);

  const families = [...new Map(models.map((m) => [m.family, m.name.replace(/ (Híbrida|1\.5 Gasolina|4x4 Híbrida)$/, "")])).entries()];
  const openedPct = Math.round((base.filter((x) => x.open_count > 0).length / Math.max(1, base.length)) * 100);
  const sinSeg = base.filter((x) => !x.followed_up_at && x.sent_at && Date.now() - new Date(x.sent_at) > 864e5 && !["ganado", "perdido"].includes(byId[x.lead_id]?.stage)).length;

  const markFollow = async (x) => {
    const t = new Date().toISOString();
    await sb.from("quotes").update({ followed_up_at: t }).eq("id", x.id);
    await sb.from("lead_events").insert({ lead_id: x.lead_id, type: "seguimiento_cotizacion", detail: "Asesor dio seguimiento a la cotización" });
    toast({ title: "Seguimiento registrado", body: byId[x.lead_id]?.name });
    loadAux();
  };

  return (
    <>
      <TopBar title="Cotizaciones" crumbs={meId ? "Mis cotizaciones" : "Seguimiento de apertura en tiempo real"} />
      <div className="grid g4">
        <div className="card kpi"><span className="label">Enviadas</span><span className="v">{base.length}</span></div>
        <div className="card kpi"><span className="label">Abiertas por el cliente</span><span className="v">{openedPct}%</span></div>
        <div className="card kpi dark"><span className="label">Sin seguimiento</span><span className="v">{sinSeg}</span><span className="d">enviadas hace más de 24 h, lead abierto</span></div>
        <div className="card kpi accent"><span className="label">«Quiero este»</span><span className="v">{base.filter((x) => x.status === "aceptada").length}</span></div>
      </div>
      <div className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input className="inp" style={{ width: 200 }} placeholder="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente" />
          <select className="sel" style={{ width: 180 }} value={model} onChange={(e) => setModel(e.target.value)} aria-label="Modelo"><option value="">Todos los modelos</option>{families.map(([f, n]) => <option key={f} value={f}>{n}</option>)}</select>
          {!meId && <select className="sel" style={{ width: 170 }} value={seller} onChange={(e) => setSeller(e.target.value)} aria-label="Asesor"><option value="">Todos los asesores</option>{vendedores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
          <select className="sel" style={{ width: 150 }} value={opened} onChange={(e) => setOpened(e.target.value)} aria-label="Apertura"><option value="">Abierta o no</option><option value="si">Abiertas</option><option value="no">Sin abrir</option></select>
          <select className="sel" style={{ width: 200 }} value={follow} onChange={(e) => setFollow(e.target.value)} aria-label="Seguimiento"><option value="">Con o sin seguimiento</option><option value="si">Con seguimiento</option><option value="no">Sin seguimiento</option></select>
          <select className="sel" style={{ width: 160, marginLeft: "auto" }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        </div>
        <span className="faint" style={{ fontSize: 12 }}>{list.length} cotizaciones</span>
        <div className="tablewrap"><table className="t">
          <thead><tr><th>Cliente</th><th>Modelo</th><th>Precio</th><th>Asesor</th><th>Enviada</th><th>Aperturas</th><th>Seguimiento</th><th>Estado</th></tr></thead>
          <tbody>{list.map((x) => {
            const l = byId[x.lead_id];
            const late = !x.followed_up_at && x.sent_at && Date.now() - new Date(x.sent_at) > 864e5;
            return (
              <tr key={x.id} className="link" onClick={() => nav(`/lead/${x.lead_id}`, { state: { from: "/cotizaciones", fromLabel: "Cotizaciones" } })}>
                <td><b>{l?.name || "—"}</b></td><td>{modelById[x.model_id]?.name} <span className="faint">· {x.color}</span></td>
                <td className="num">{x.currency === "USD" ? fmtUSD(x.price) : fmtQ(x.price)}</td><td><SellerAvatar id={x.seller_id} /></td>
                <td title={x.sent_at ? fmtDate(x.sent_at) : ""}>{ago(x.sent_at || x.created_at)}</td>
                <td><span className={`chip ${x.open_count >= 2 ? "hot" : x.open_count ? "blue" : ""}`}>{x.open_count}×</span></td>
                <td onClick={(e) => e.stopPropagation()}>
                  {x.followed_up_at ? <span className="chip good" title={fmtDate(x.followed_up_at)}>✓ {ago(x.followed_up_at)}</span>
                    : <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><span className={`chip ${late ? "bad" : ""}`}>Pendiente</span><button className="btn ghost sm" onClick={() => markFollow(x)}>Marcar</button></span>}
                </td>
                <td><span className={`chip ${x.status === "aceptada" ? "good" : ""}`}>{x.status}</span></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </div>
    </>
  );
}
