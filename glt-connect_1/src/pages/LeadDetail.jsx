import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { fn, sb } from "../lib/supabase";
import { CHANNELS, FACTORS, PAGO, PLAZO, STAGES, ago, fmtDate, fmtQ, fmtUSD } from "../lib/format";
import { TopBar } from "../components/Shell";
import { ChannelChip, Loading, SellerAvatar, SlaBadge, TempChip } from "../components/bits";
import { Gauge } from "../components/charts";
import { IBack, IBolt, ISend } from "../components/icons";
import { LostModal } from "./Pipeline";
import QuoteBuilder from "./QuoteBuilder";

const Q_ROWS = [
  ["nombre", "Nombre", (v) => v],
  ["modelo", "Modelo / uso", (v, q, m) => m[v]?.name || q.uso || v],
  ["pago", "Forma de pago", (v, q) => `${PAGO[v] || v}${q.enganche_monto ? ` · enganche ${fmtQ(q.enganche_monto)}` : ""}${q.enganche_pct ? ` (${q.enganche_pct}%)` : ""}`],
  ["plazo", "Plazo de compra", (v) => PLAZO[v] || v],
  ["parte_pago", "Parte de pago", (v, q) => (v === "si" ? [q.parte_pago_vehiculo || "Sí, tiene vehículo", q.parte_pago_anio, q.parte_pago_tipo && (q.parte_pago_tipo === "agencia" ? "de agencia" : "rodado")].filter(Boolean).join(" · ") : "No")],
  ["sala", "Sala preferida", (v) => v],
  ["telefono", "Teléfono y horario", (v, q) => `${v}${q.horario ? ` · ${q.horario}` : ""}`],
];

export default function LeadDetail() {
  const { id } = useParams();
  const { leads, modelById, sellerById, vendedores, viewAs, updateLead, tick, toast, meId, loadAux } = useStore();
  const loc = useLocation();
  const back = loc.state?.from ? { to: loc.state.from, label: loc.state.fromLabel || "Volver" } : { to: "/pipeline", label: "Embudo" };
  const lead = leads.find((l) => l.id === id);
  const [msgs, setMsgs] = useState([]);
  const [events, setEvents] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [drives, setDrives] = useState([]);
  const [text, setText] = useState("");
  const [builder, setBuilder] = useState(false);
  const [lost, setLost] = useState(false);
  const [busy, setBusy] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      sb.from("messages").select("*").eq("lead_id", id).order("created_at"),
      sb.from("lead_events").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      sb.from("quotes").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      sb.from("test_drives").select("*").eq("lead_id", id).order("slot"),
    ]).then(([m, e, q, d]) => { setMsgs(m.data || []); setEvents(e.data || []); setQuotes(q.data || []); setDrives(d.data || []); });
  }, [id, tick]);
  useEffect(() => { chatRef.current && (chatRef.current.scrollTop = chatRef.current.scrollHeight); }, [msgs.length]);

  if (!lead) return <Loading text="Buscando lead…" />;
  if (meId && lead.seller_id && lead.seller_id !== meId) return (
    <><TopBar title="Lead de otro asesor" crumbs="Permisos por rol" /><div className="card"><h2>Este lead está asignado a {sellerById[lead.seller_id]?.name}</h2><p className="muted" style={{ margin: 0 }}>Como asesor solo puede ver sus propios leads.</p><Link className="btn ghost sm" style={{ alignSelf: "flex-start" }} to={back.to}>Volver</Link></div></>
  );
  const q = lead.qualification || {};
  const bd = lead.score_breakdown || {};
  const me = viewAs.role === "vendedor" ? sellerById[viewAs.sellerId] || vendedores[0] : sellerById[lead.seller_id];

  const send = async () => {
    const body = text.trim(); if (!body) return;
    setText("");
    const now = new Date().toISOString();
    await sb.from("messages").insert({ lead_id: lead.id, sender: "vendedor", body, meta: { seller: me?.name } });
    const patch = { last_activity_at: now, bot_active: false };
    if (!lead.seller_id && me) Object.assign(patch, { seller_id: me.id, assigned_at: now, showroom_id: me.showroom_id });
    if (!lead.first_response_at) patch.first_response_at = now;
    if (["nuevo", "contactado"].includes(lead.stage)) patch.stage = "calificado";
    await updateLead(lead.id, patch, !lead.first_response_at ? { type: "respuesta", detail: `${me?.name ?? "Asesor"} respondió al cliente` } : null);
    // Si hay cotización enviada sin seguimiento, este mensaje cuenta como seguimiento
    const pend = quotes.filter((qt) => qt.sent_at && !qt.followed_up_at && new Date(qt.sent_at) < new Date(now) - 6e4);
    if (pend.length) { await sb.from("quotes").update({ followed_up_at: now }).in("id", pend.map((x) => x.id)); setQuotes((x) => x.map((y) => (pend.some((p) => p.id === y.id) ? { ...y, followed_up_at: now } : y))); loadAux(); }
  };
  const followNow = async () => {
    setBusy(true);
    try { const r = await fn("followup", { lead_id: lead.id }); toast({ title: "Seguimiento enviado por el bot", body: r.done?.[0]?.mensaje?.slice(0, 120) }); }
    catch (e) { toast({ title: "No se pudo enviar", body: e.message, kind: "hot" }); }
    setBusy(false);
  };
  const setStage = async (stage) => {
    if (stage === "perdido") return setLost(true);
    const patch = { stage };
    if (stage === "ganado") { patch.won_at = new Date().toISOString(); const m = modelById[lead.model_id]; if (m) patch.sale_amount = m.currency === "USD" ? m.price * 7.7 : m.price; }
    await updateLead(lead.id, patch, { type: "etapa", detail: `Movido a ${STAGES.find((s) => s.id === stage).label}` });
  };

  return (
    <>
      <TopBar title={lead.name || "Prospecto nuevo"} crumbs={<Link to={back.to} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><IBack /> {back.label}</Link>}>
        <TempChip t={lead.temperature} score={lead.score} />
        <select className="sel" style={{ width: 170 }} value={lead.stage} onChange={(e) => setStage(e.target.value)} aria-label="Etapa">
          {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button className="btn blue" onClick={() => setBuilder(true)}>Nueva cotización</button>
      </TopBar>

      <div className="grid g-side">
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div className="card" style={{ flexDirection: "row", flexWrap: "wrap", gap: 18, alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}><span className="label">Asesor</span>{lead.seller_id ? <SellerAvatar id={lead.seller_id} showName /> : <span className="chip blue">Bot calificando</span>}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}><span className="label">Canal</span><ChannelChip c={lead.channel} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}><span className="label">Modelo</span><b>{modelById[lead.model_id]?.name || "Por definir"}</b></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}><span className="label">Teléfono</span><b className="num">{lead.phone || q.telefono || "—"}</b></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}><span className="label">Entró</span><span>{fmtDate(lead.created_at)}</span></div>
            <div style={{ marginLeft: "auto" }}><SlaBadge lead={lead} /></div>
          </div>

          {lead.summary && (
            <div className="card flat" style={{ gap: 6 }}>
              <span className="label">Resumen del bot para el asesor</span>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{lead.summary}</p>
              {lead.handoff_reason && <span className="faint" style={{ fontSize: 12 }}>Traspaso: {lead.handoff_reason}</span>}
            </div>
          )}

          <div className="card">
            <div className="card-head">
              <h2>Conversación · WhatsApp</h2>
              <div style={{ display: "flex", gap: 8 }}>
                {lead.bot_active && <span className="chip blue">El bot está atendiendo</span>}
                <button className="btn ghost sm" onClick={followNow} disabled={busy}><IBolt /> {busy ? "Generando…" : "Seguimiento del bot ahora"}</button>
              </div>
            </div>
            <div className="chat" ref={chatRef} style={{ maxHeight: 420, minHeight: 160 }}>
              {msgs.map((m) => (
                <div key={m.id} className={`bubble ${m.sender === "sistema" ? "bot" : m.sender}`}>
                  <div className="who">{m.sender === "bot" ? (m.meta?.followup ? `Bot · seguimiento #${m.meta.followup}` : "Asistente virtual") : m.sender === "vendedor" ? (m.meta?.seller || "Asesor") : lead.name || "Cliente"} · {fmtDate(m.created_at, { hour: "numeric", minute: "2-digit" })}</div>
                  {m.body}
                </div>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "flex", gap: 8 }}>
              <input id="composer" className="inp" placeholder={`Responder como ${me?.name ?? "asesor"}…`} value={text} onChange={(e) => setText(e.target.value)} />
              <button className="btn" type="submit" aria-label="Enviar"><ISend /></button>
            </form>
          </div>

          <div className="card">
            <div className="card-head"><h2>Cotizaciones</h2><button className="btn ghost sm" onClick={() => setBuilder(true)}>Crear</button></div>
            {quotes.length ? quotes.map((qt) => {
              const m = modelById[qt.model_id];
              return (
                <div key={qt.id} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto auto auto auto" }}>
                  <div><b>{m?.name}</b> <span className="muted">· {qt.color}</span><div className="faint" style={{ fontSize: 12 }}>Enviada {qt.sent_at ? ago(qt.sent_at) : "—"} · vence {qt.valid_until}</div></div>
                  <b className="num">{qt.currency === "USD" ? fmtUSD(qt.price) : fmtQ(qt.price)}</b>
                  <span className={`chip ${qt.open_count >= 2 ? "hot" : qt.open_count ? "blue" : ""}`}>{qt.open_count ? `Abierta ${qt.open_count}×` : "Sin abrir"}</span>
                  {qt.followed_up_at ? <span className="chip good" title={fmtDate(qt.followed_up_at)}>Seguimiento ✓</span>
                    : <button className="btn ghost sm" onClick={async () => { const t = new Date().toISOString(); await sb.from("quotes").update({ followed_up_at: t }).eq("id", qt.id); await sb.from("lead_events").insert({ lead_id: lead.id, type: "seguimiento_cotizacion", detail: "Asesor dio seguimiento a la cotización" }); setQuotes((x) => x.map((y) => (y.id === qt.id ? { ...y, followed_up_at: t } : y))); loadAux(); }}>Marcar seguimiento</button>}
                  <a className="btn ghost sm" href={`/c/${qt.public_token}?preview=1`} target="_blank" rel="noreferrer">Ver</a>
                </div>
              );
            }) : <p className="faint">Aún no hay cotizaciones.</p>}
          </div>

          <div className="card">
            <h2>Historial</h2>
            <div className="list">{events.map((e) => (
              <div key={e.id} className="row" style={{ gridTemplateColumns: "12px minmax(0,1fr) auto", padding: "8px 4px" }}>
                <span className="dot" style={{ background: e.type === "ganado" ? "var(--good)" : e.type.includes("cotiz") || e.type === "quiero_este" ? "var(--hot)" : e.type === "seguimiento" ? "var(--blue)" : "var(--ink3)" }} />
                <span>{e.detail}</span><span className="faint" style={{ fontSize: 12 }}>{fmtDate(e.created_at)}</span>
              </div>
            ))}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ alignItems: "center" }}>
            <div className="card-head" style={{ width: "100%" }}><h2>Probabilidad de compra</h2><span className="faint" style={{ fontSize: 12 }}>0–100</span></div>
            <Gauge value={lead.score || 0} size={220} label={lead.temperature === "caliente" ? "CALIENTE" : lead.temperature === "tibio" ? "TIBIO" : "FRÍO"} />
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(FACTORS).map(([k, label]) => {
                const f = bd[k] || { pts: 0, max: 1 };
                return (
                  <div key={k} className="factor">
                    <span>{label}</span>
                    <div className="bar"><i style={{ width: `${(f.pts / f.max) * 100}%`, background: f.pts / f.max >= 0.7 ? "var(--ink)" : f.pts ? "var(--blue)" : "transparent" }} /></div>
                    <b className="num" style={{ textAlign: "right" }}>{f.pts}/{f.max}</b>
                  </div>
                );
              })}
            </div>
            <p className="faint" style={{ fontSize: 11.5, margin: 0 }}>Modelo de pesos transparente. Con el historial de HubSpot se entrena el modelo estadístico.</p>
          </div>

          <div className="card">
            {q.parte_pago === "si" && q.parte_pago_anio && Number(q.parte_pago_anio) < new Date().getFullYear() - 10 && (
              <div className="chip warm" style={{ whiteSpace: "normal", padding: "8px 12px", borderRadius: 12 }}>Vehículo de parte de pago con más de 10 años: puede no calificar para recibo.</div>
            )}
            <div className="card-head"><h2>Calificación</h2><span className={`chip ${lead.qualification_complete ? "good" : "warm"}`}>{Q_ROWS.filter(([k]) => q[k] || (k === "modelo" && q.uso)).length}/7</span></div>
            {Q_ROWS.map(([k, label, f]) => {
              const v = q[k] ?? (k === "modelo" ? q.uso : null);
              return (
                <div key={k} style={{ display: "grid", gridTemplateColumns: "20px minmax(0,1fr)", gap: 8, alignItems: "start" }}>
                  <span style={{ color: v ? "var(--good)" : "var(--ink3)", fontWeight: 800 }}>{v ? "✓" : "·"}</span>
                  <div><div className="faint" style={{ fontSize: 11.5 }}>{label}</div><div style={{ fontWeight: 600 }}>{v ? f(v, q, modelById) : "Pendiente"}</div></div>
                </div>
              );
            })}
          </div>

          <div className="card">
            <h2>Test drive</h2>
            {drives.length ? drives.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span><b>{fmtDate(d.slot, { weekday: "long", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</b><div className="faint" style={{ fontSize: 12 }}>{d.showroom_id === "jlib" ? "Sala Liberación" : "Sala 20 Calle"} · {modelById[d.model_id]?.name}</div></span>
                <span className={`chip ${d.status === "realizado" ? "good" : "blue"}`}>{d.status}</span>
              </div>
            )) : <p className="faint">El cliente puede agendarlo desde su cotización.</p>}
          </div>

          <div className="card">
            <h2>Seguimiento automático</h2>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>{lead.next_followup_at ? <>Próximo mensaje del bot: <b>{fmtDate(lead.next_followup_at)}</b> (seguimiento #{(lead.followup_step || 0) + 1}).</> : "Sin seguimientos pendientes."}</p>
            {viewAs.role !== "vendedor" && lead.stage !== "ganado" && lead.stage !== "perdido" && (
              <label className="field"><span>Reasignar a</span>
                <select className="sel" value={lead.seller_id || ""} onChange={(e) => { const s = sellerById[e.target.value]; updateLead(lead.id, { seller_id: s.id, showroom_id: s.showroom_id, assigned_at: new Date().toISOString(), first_response_at: null }, { type: "reasignado", detail: `Reasignado a ${s.name} por gerencia` }); }}>
                  <option value="" disabled>Elegir asesor</option>{vendedores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
          </div>
        </div>
      </div>
      {builder && <QuoteBuilder lead={lead} seller={me} onClose={() => setBuilder(false)} />}
      {lost && <LostModal onClose={() => setLost(false)} onConfirm={async (r) => { await updateLead(lead.id, { stage: "perdido", lost_reason: r }, { type: "etapa", detail: `Perdido: ${r}` }); setLost(false); }} />}
    </>
  );
}
