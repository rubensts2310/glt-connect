import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { sb } from "../lib/supabase";
import { CHANNELS, fmtDate, fmtMin, fmtQ, minsBetween, stageLabel, ago } from "../lib/format";
import { BrandSwitch, TopBar } from "../components/Shell";
import { ChannelChip, SellerAvatar, SlaBadge, TempChip } from "../components/bits";
import { Donut, Funnel, Ring, Spark } from "../components/charts";
import Direccion from "./Direccion";
import { needsReminder, sellerPerf } from "../lib/perf";

const OPEN = ["nuevo", "contactado", "calificado", "cotizado", "test_drive", "financiamiento", "negociacion"];
const CH_COLORS = { meta: "#0a3a7a", whatsapp: "#17a673", web: "#00aeef", google: "#f2a516", llamada: "#7d95ad", sala: "#0d1014", evento: "#ff5b3a", hubspot: "#ff7a59" };
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };

export function priority(l) {
  const pending = l.assigned_at && !l.first_response_at ? 1000 + minsBetween(l.assigned_at) : 0;
  return pending + (l.score || 0);
}

export function LeadRow({ l, showSeller, from = "/", fromLabel = "Atender ahora" }) {
  const { modelById } = useStore();
  const nav = useNavigate();
  return (
    <div className="row link" style={{ gridTemplateColumns: showSeller ? "minmax(0,1.5fr) minmax(0,1fr) auto auto" : "minmax(0,1.6fr) minmax(0,1fr) auto" }} onClick={() => nav(`/lead/${l.id}`, { state: { from, fromLabel } })} role="link" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && nav(`/lead/${l.id}`, { state: { from, fromLabel } })}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b>{l.name || "Prospecto sin nombre"}</b><TempChip t={l.temperature} score={l.score} /></div>
        <div className="muted" style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.summary || "El bot está calificando…"}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{modelById[l.model_id]?.name || "Modelo por definir"}</span>
        <span className="faint" style={{ fontSize: 12 }}>{stageLabel(l.stage)} · {CHANNELS[l.channel]}</span>
      </div>
      {showSeller && <SellerAvatar id={l.seller_id} />}
      <div style={{ textAlign: "right" }}><SlaBadge lead={l} /></div>
    </div>
  );
}

function MiRendimiento({ sellerId }) {
  const { leads, quotes, stats } = useStore();
  const p = sellerPerf(sellerId, leads, quotes, stats);
  const color = p.score >= 75 ? "var(--good)" : p.score >= 50 ? "var(--warm)" : "var(--bad)";
  return (
    <div className="card">
      <div className="card-head"><h2>Mi rendimiento</h2><span className="faint" style={{ fontSize: 12 }}>últimos 90 días</span></div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Ring value={p.score} size={92} stroke={10} color={color} label={`${p.score}%`} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, flex: 1, minWidth: 160 }}>
          <span><b className="num">{p.counts.cotPend}</b> cotizaciones pendientes de seguimiento</span>
          <span><b className="num">{p.counts.sinSeguimiento}</b> leads sin seguimiento (3+ días)</span>
          <span><b className="num">{p.counts.pendingReply}</b> por responder</span>
          <span><b className="num">{p.counts.conv}%</b> de conversión</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {Object.values(p.parts).map((x) => (
          <div key={x.label} className="factor" style={{ gridTemplateColumns: "minmax(0,1fr) 110px 40px" }}>
            <span>{x.label}</span><div className="bar"><i style={{ width: `${x.pct * 100}%`, background: x.pct >= 0.75 ? "var(--good)" : x.pct >= 0.5 ? "var(--warm)" : "var(--bad)" }} /></div>
            <b className="num" style={{ textAlign: "right" }}>{Math.round(x.pct * 100)}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function Recordatorios({ list }) {
  const { updateLead, modelById, stats } = useStore();
  const nav = useNavigate();
  return (
    <div className="card">
      <div className="card-head"><h2>Recordatorios</h2><span className={`chip ${list.length ? "warm" : "good"}`}>{list.length} sin respuesta del cliente</span></div>
      {list.length ? list.slice(0, 6).map((l) => {
        const days = Math.floor((Date.now() - new Date(stats[l.id].last_out_at)) / 864e5);
        return (
          <div key={l.id} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <div style={{ minWidth: 0 }}><b>{l.name}</b><div className="muted" style={{ fontSize: 12 }}>{modelById[l.model_id]?.name} · sin respuesta hace {days} días</div></div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn sm" onClick={() => nav(`/lead/${l.id}`, { state: { from: "/", fromLabel: "Atender ahora" } })}>Dar seguimiento</button>
              <button className="btn ghost sm" title="Volver a recordar en 3 días" onClick={() => updateLead(l.id, { reminder_snooze_until: new Date(Date.now() + 3 * 864e5).toISOString() }, { type: "recordatorio", detail: "Recordatorio pospuesto 3 días" })}>+3 días</button>
            </div>
          </div>
        );
      }) : <p className="faint" style={{ margin: 0 }}>Todos sus clientes han respondido en los últimos 3 días.</p>}
    </div>
  );
}

function VendedorHome() {
  const { visibleLeads, viewAs, vendedores, sellerById, modelById, settings, tick, stats } = useStore();
  const me = sellerById[viewAs.sellerId] || vendedores[0];
  const open = visibleLeads.filter((l) => OPEN.includes(l.stage));
  const pending = open.filter((l) => l.assigned_at && !l.first_response_at);
  const hot = open.filter((l) => l.temperature === "caliente");
  const wonMonth = visibleLeads.filter((l) => l.stage === "ganado" && new Date(l.won_at) >= monthStart());
  const [drives, setDrives] = useState([]);
  useEffect(() => {
    const ids = visibleLeads.map((l) => l.id);
    if (!ids.length) return;
    sb.from("test_drives").select("*").in("lead_id", ids).gte("slot", new Date(Date.now() - 3600e3).toISOString()).order("slot").limit(6).then(({ data }) => setDrives(data || []));
  }, [visibleLeads.length, tick]);
  const follow = open.filter((l) => l.next_followup_at).sort((a, b) => new Date(a.next_followup_at) - new Date(b.next_followup_at)).slice(0, 5);
  const byId = Object.fromEntries(visibleLeads.map((l) => [l.id, l]));
  const reminders = open.filter((l) => needsReminder(l, stats[l.id])).sort((a, b) => new Date(stats[a.id].last_out_at) - new Date(stats[b.id].last_out_at));
  return (
    <>
      <TopBar title={`Hola, ${me?.name.split(" ")[0]}`} crumbs={`Asesor Jetour · ${me?.showroom_id === "jlib" ? "Sala Liberación" : "Sala 20 Calle"}`} />
      <div className="grid g4">
        <div className="card kpi dark"><span className="label">Por responder</span><span className="v">{pending.length}</span><span className="d">Meta: primera respuesta en {settings.sla?.primera_respuesta_min ?? 5} min</span></div>
        <div className="card kpi"><span className="label">Leads calientes</span><span className="v">{hot.length}</span><span className="d muted">de {open.length} activos</span></div>
        <div className="card kpi"><span className="label">Test drives próximos</span><span className="v">{drives.length}</span><span className="d muted">agenda de la semana</span></div>
        <div className="card kpi accent"><span className="label">Ventas del mes</span><span className="v">{wonMonth.length}</span><span className="d">{fmtQ(wonMonth.reduce((a, l) => a + Number(l.sale_amount || 0), 0))}</span></div>
      </div>
      <div className="grid g-main">
        <div className="card">
          <div className="card-head"><h2>Atender ahora</h2><span className="faint" style={{ fontSize: 12 }}>Ordenado por urgencia y puntaje</span></div>
          <div className="list">{[...open].sort((a, b) => priority(b) - priority(a)).slice(0, 9).map((l) => <LeadRow key={l.id} l={l} />)}</div>
          <Link to="/pipeline" className="btn ghost sm" style={{ alignSelf: "flex-start" }}>Ver todo mi embudo</Link>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <MiRendimiento sellerId={me?.id} />
          <Recordatorios list={reminders} />
          <div className="card">
            <h2>Test drives</h2>
            {drives.length ? drives.map((d) => (
              <Link key={d.id} to={`/lead/${d.lead_id}`} state={{ from: "/", fromLabel: "Inicio" }} className="row link" style={{ gridTemplateColumns: "56px minmax(0,1fr)" }}>
                <div style={{ background: "var(--card2)", borderRadius: 12, textAlign: "center", padding: "6px 0" }}>
                  <div className="label" style={{ fontSize: 10 }}>{fmtDate(d.slot, { weekday: "short" })}</div>
                  <b className="num" style={{ fontSize: 16 }}>{fmtDate(d.slot, { hour: "numeric", minute: "2-digit" })}</b>
                </div>
                <div><b>{byId[d.lead_id]?.name}</b><div className="muted" style={{ fontSize: 12 }}>{modelById[d.model_id]?.name} · {d.showroom_id === "jlib" ? "Liberación" : "20 Calle"}</div></div>
              </Link>
            )) : <p className="faint">Sin test drives agendados.</p>}
          </div>
          <div className="card">
            <h2>Próximos mensajes del bot</h2>
            {follow.map((l) => (
              <Link key={l.id} to={`/lead/${l.id}`} state={{ from: "/", fromLabel: "Inicio" }} className="row link" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <div><b>{l.name}</b><div className="muted" style={{ fontSize: 12 }}>Seguimiento #{(l.followup_step || 0) + 1} · {stageLabel(l.stage)}</div></div>
                <span className="chip blue">{fmtDate(l.next_followup_at, { weekday: "short", hour: "numeric" })}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function GerenteHome() {
  const { leads, vendedores, settings, tick, quotes, stats } = useStore();
  const sla = settings.sla || { alerta_gerente_min: 15 };
  const m0 = monthStart();
  const month = leads.filter((l) => new Date(l.created_at) >= m0);
  const open = leads.filter((l) => OPEN.includes(l.stage));
  const alerts = open.filter((l) => l.assigned_at && !l.first_response_at && minsBetween(l.assigned_at) > sla.alerta_gerente_min);
  const responded = leads.filter((l) => l.first_response_at && l.assigned_at);
  const avgResp = responded.length ? responded.reduce((a, l) => a + minsBetween(l.assigned_at, l.first_response_at), 0) / responded.length : null;
  const closed = leads.filter((l) => ["ganado", "perdido"].includes(l.stage));
  const conv = closed.length ? Math.round((leads.filter((l) => l.stage === "ganado").length / closed.length) * 100) : 0;
  const qualified = leads.filter((l) => l.qualification_complete).length;
  const wonMonth = leads.filter((l) => l.stage === "ganado" && new Date(l.won_at) >= m0);

  const byCh = Object.entries(leads.reduce((a, l) => ((a[l.channel] = (a[l.channel] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
  const weekly = useMemo(() => {
    const w = Array(12).fill(0);
    leads.forEach((l) => { const k = Math.floor((Date.now() - new Date(l.created_at)) / (7 * 864e5)); if (k < 12) w[11 - k]++; });
    return w;
  }, [leads]);
  const rank = vendedores.map((s) => {
    const mine = leads.filter((l) => l.seller_id === s.id);
    const r = mine.filter((l) => l.first_response_at && l.assigned_at).map((l) => minsBetween(l.assigned_at, l.first_response_at)).sort((a, b) => a - b);
    const cl = mine.filter((l) => ["ganado", "perdido"].includes(l.stage));
    const won = mine.filter((l) => l.stage === "ganado");
    return { s, perf: sellerPerf(s.id, leads, quotes, stats), n: mine.filter((l) => OPEN.includes(l.stage)).length, med: r.length ? r[Math.floor(r.length / 2)] : null, conv: cl.length ? Math.round((won.length / cl.length) * 100) : 0, won: won.length, amount: won.reduce((a, l) => a + Number(l.sale_amount || 0), 0) };
  }).sort((a, b) => b.perf.score - a.perf.score);

  const [feed, setFeed] = useState([]);
  useEffect(() => { sb.from("lead_events").select("*, leads(name)").order("created_at", { ascending: false }).limit(8).then(({ data }) => setFeed(data || [])); }, [tick]);

  return (
    <>
      <TopBar title="Sala de ventas Jetour" crumbs="Gerencia · vista en vivo"><BrandSwitch /></TopBar>
      <div className="grid g4">
        <div className="card kpi"><span className="label">Leads este mes</span><div style={{ display: "flex", justifyContent: "space-between", alignItems: "end" }}><span className="v">{month.length}</span><Spark values={weekly} /></div><span className="d muted">{leads.length} en los últimos 90 días</span></div>
        <div className="card kpi"><span className="label">Calificados por el bot</span><div style={{ display: "flex", gap: 12, alignItems: "center" }}><Ring value={qualified} max={leads.length} label={`${Math.round((qualified / Math.max(1, leads.length)) * 100)}%`} size={58} color="var(--blue)" /><span className="muted" style={{ fontSize: 12.5 }}>{qualified} leads con las 7 preguntas completas</span></div></div>
        <div className="card kpi dark"><span className="label">Primera respuesta del asesor</span><span className="v">{fmtMin(avgResp)}</span><span className="d">promedio · meta {settings.sla?.primera_respuesta_min ?? 5} min</span></div>
        <div className="card kpi accent"><span className="label">Ventas del mes</span><span className="v">{wonMonth.length}</span><span className="d">{fmtQ(wonMonth.reduce((a, l) => a + Number(l.sale_amount || 0), 0))} · conversión {conv}%</span></div>
      </div>
      <div className="grid g-main">
        <div className="card">
          <div className="card-head"><h2>Alertas de atención</h2><span className="chip bad">{alerts.length} sin respuesta &gt; {sla.alerta_gerente_min} min</span></div>
          <div className="list">{alerts.length ? alerts.sort((a, b) => priority(b) - priority(a)).slice(0, 6).map((l) => <LeadRow key={l.id} l={l} showSeller fromLabel="Alertas" />) : <p className="faint">Todo el equipo está al día.</p>}</div>
          <div className="card-head" style={{ marginTop: 6 }}><h2>Asesores · del más al menos eficiente</h2><span className="faint" style={{ fontSize: 12 }}>Mystery shopper · ago 2026</span></div>
          <div className="tablewrap"><table className="t">
            <thead><tr><th>Asesor</th><th>Rendimiento</th><th>Activos</th><th>Resp. mediana</th><th>Conversión</th><th>Ventas</th><th>Mystery</th></tr></thead>
            <tbody>{rank.map(({ s, perf, n, med, conv, won, amount }) => (
              <tr key={s.id}><td><SellerAvatar id={s.id} showName /></td><td><span className={`chip ${perf.score >= 75 ? "good" : perf.score >= 50 ? "warm" : "bad"}`}>{perf.score}%</span> <span className="faint" style={{ fontSize: 11.5 }}>{perf.counts.sinSeguimiento} sin seguimiento</span></td><td className="num">{n}</td>
                <td><span className={`chip ${med == null ? "" : med <= 5 ? "good" : med <= 15 ? "warm" : "bad"}`}>{fmtMin(med)}</span></td>
                <td className="num">{conv}%</td><td className="num">{won} · {fmtQ(amount)}</td>
                <td><Ring value={s.mystery_score || 0} size={40} stroke={5} color={s.mystery_score >= 60 ? "var(--good)" : s.mystery_score >= 40 ? "var(--warm)" : "var(--bad)"} /></td></tr>
            ))}</tbody>
          </table></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <h2>Embudo</h2>
            <Funnel steps={["contactado", "calificado", "cotizado", "test_drive", "financiamiento", "negociacion", "ganado"].map((st, i, arr) => ({
              label: stageLabel(st), value: leads.filter((l) => arr.indexOf(l.stage) >= i).length, color: st === "ganado" ? "var(--blue)" : "var(--ink)",
            }))} />
          </div>
          <div className="card">
            <h2>Leads por canal</h2>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <Donut items={byCh.map(([c, v]) => ({ label: c, value: v, color: CH_COLORS[c] }))} size={140} center={leads.length} sub="leads" />
              <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, flex: 1, minWidth: 120 }}>
                {byCh.map(([c, v]) => <div key={c} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span><span className="dot" style={{ background: CH_COLORS[c], marginRight: 6 }} />{CHANNELS[c]}</span><b className="num">{v}</b></div>)}
              </div>
            </div>
          </div>
          <div className="card">
            <h2>Actividad en vivo</h2>
            {feed.map((e) => (
              <Link key={e.id} to={`/lead/${e.lead_id}`} state={{ from: "/", fromLabel: "Inicio" }} className="row link" style={{ gridTemplateColumns: "minmax(0,1fr) auto", padding: "8px 4px" }}>
                <div style={{ minWidth: 0 }}><b style={{ fontSize: 13 }}>{e.leads?.name || "Prospecto"}</b><div className="muted" style={{ fontSize: 12 }}>{e.detail}</div></div>
                <span className="faint" style={{ fontSize: 11.5 }}>{ago(e.created_at)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Home() {
  const { viewAs } = useStore();
  if (viewAs.role === "vendedor") return <VendedorHome />;
  if (viewAs.role === "director") return <Direccion />;
  return <GerenteHome />;
}
