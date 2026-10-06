// Mis clientes, ficha del cliente y cola de seguimiento post-evento
import { useMemo, useState } from "react";
import { followMessage, LOST, nextMorning, quoteLink, STAGES, TEMPS, useAS, waLink, fmtPhone } from "./store";
import { fmtQ, fmtDate, ago } from "../lib/format";

const stageLabel = (s) => STAGES.find((x) => x.id === s)?.label || s;
const endOfToday = () => { const n = new Date(Date.now() - 6 * 3600e3); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 23 + 6, 59)).getTime(); };
const useLeadExtras = () => {
  const { data, modelById } = useAS();
  return useMemo(() => {
    const qBy = {}, aBy = {};
    for (const q of data.quotes || []) (qBy[q.lead_id] ||= []).push(q);
    for (const a of data.activities || []) (aBy[a.lead_id] ||= []).push(a);
    Object.values(qBy).forEach((l) => l.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    Object.values(aBy).forEach((l) => l.sort((a, b) => new Date(b.created_at || b.at) - new Date(a.created_at || a.at)));
    return { qBy, aBy, mname: (id) => modelById[id]?.name || "—" };
  }, [data.quotes, data.activities, modelById]);
};

export function TempPill({ t }) { const x = TEMPS[t] || TEMPS.tibio; return <span className={`as-pill ${x.cls}`}>{x.emoji} {x.short}</span>; }

export function Clients({ onOpen, sellerFilter }) {
  const { data, me } = useAS();
  const { qBy, mname } = useLeadExtras();
  const [q, setQ] = useState("");
  const [temp, setTemp] = useState("");
  const [stage, setStage] = useState("");
  const [seller, setSeller] = useState(sellerFilter || "");
  const sellers = Object.fromEntries((data.sellers || []).map((s) => [s.id, s.name]));
  const list = (data.leads || []).filter((l) =>
    (!q || `${l.name} ${l.phone}`.toLowerCase().includes(q.toLowerCase())) && (!temp || l.temperature === temp) && (!stage || l.stage === stage) && (!seller || l.seller_id === seller));
  return (
    <div className="as-page">
      <div className="as-filters">
        <input className="as-inp" style={{ maxWidth: 280 }} placeholder="Buscar nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="as-seg">{[["", "Todos"], ...Object.entries(TEMPS).map(([k, t]) => [k, `${t.emoji} ${t.short}`])].map(([k, l]) => <button key={k} className={temp === k ? "on" : ""} onClick={() => setTemp(k)}>{l}</button>)}</div>
        <select className="as-inp" style={{ maxWidth: 180 }} value={stage} onChange={(e) => setStage(e.target.value)}><option value="">Todas las etapas</option>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        {me?.role === "gerente" && <select className="as-inp" style={{ maxWidth: 200 }} value={seller} onChange={(e) => setSeller(e.target.value)}><option value="">Todos los asesores</option>{(data.sellers || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        <span className="as-muted">{list.length} clientes</span>
      </div>
      <div className="as-list">
        {list.map((l) => {
          const qt = qBy[l.id]?.[0];
          return (
            <button key={l.id} className="as-lrow" onClick={() => onOpen(l.id)}>
              <div className="as-lmain"><b>{l.name}</b><span className="as-muted">{fmtPhone(l.phone)} · {mname(l.model_id)}{me?.role === "gerente" ? ` · ${sellers[l.seller_id] || ""}` : ""}</span></div>
              <TempPill t={l.temperature} />
              <span className="as-pill">{stageLabel(l.stage)}</span>
              <span className="as-muted as-hide-sm">{qt ? `${fmtQ(qt.total)} · ${qt.open_count ? `abierta ${qt.open_count}×` : "sin abrir"}` : "Sin cotización"}</span>
              <span className="as-muted as-hide-sm">{l.next_action_at ? `Seguimiento ${fmtDate(l.next_action_at, { day: "numeric", month: "short" })}` : "—"}</span>
              {l._pending && <span className="as-pill pend">Por sincronizar</span>}
            </button>
          );
        })}
        {!list.length && <div className="as-empty">Aún no hay clientes aquí. Registre al primero desde el catálogo.</div>}
      </div>
    </div>
  );
}

export function LeadSheet({ id, onClose, onQuote }) {
  const { data, me, saveLead, logActivity, manager, toast, refresh } = useAS();
  const { qBy, aBy, mname } = useLeadExtras();
  const lead = (data.leads || []).find((l) => l.id === id);
  const [msg, setMsg] = useState(null);
  const [note, setNote] = useState("");
  const [lost, setLost] = useState(false);
  if (!lead) return null;
  const quotes = qBy[lead.id] || [];
  const acts = aBy[lead.id] || [];
  const m = { ...lead, _modelName: mname(lead.model_id) };
  const suggested = followMessage({ lead: m, step: Math.min(lead.followup_step || 0, 3), quote: quotes[0], me, event: data.settings?.event });
  const text = msg ?? suggested;
  const set = (patch) => saveLead({ ...lead, ...patch });
  const sendWa = () => { const u = waLink(lead.phone, text); if (u) { window.open(u, "_blank"); logActivity(lead.id, "whatsapp", text.slice(0, 300)); setMsg(null); toast("Seguimiento registrado", "Se programó el siguiente"); } };
  return (
    <div className="as-sheet">
      <div className="as-sheet-head">
        <button className="as-btn as-ghost" onClick={onClose}>← Volver</button>
        <div className="as-sheet-title"><b>{lead.name}</b><span className="as-muted">{fmtPhone(lead.phone)}{lead.email ? ` · ${lead.email}` : ""} · {mname(lead.model_id)}</span></div>
        <button className="as-btn as-primary" onClick={() => onQuote(lead)}>Nueva cotización</button>
      </div>
      <div className="as-sheet-body">
        <div className="as-sheet-left" style={{ gap: 14 }}>
          <div className="as-card pad">
            <span className="as-label">Temperatura</span>
            <div className="as-temps sm">{Object.entries(TEMPS).map(([k, t]) => <button key={k} className={`as-temp ${t.cls} ${lead.temperature === k ? "on" : ""}`} onClick={() => set({ temperature: k })}><b>{t.emoji}</b><span>{t.short}</span></button>)}</div>
            <span className="as-label" style={{ marginTop: 10 }}>Etapa</span>
            <div className="as-stages">{STAGES.map((s) => <button key={s.id} className={`${lead.stage === s.id ? "on" : ""} ${s.id}`} onClick={() => (s.id === "perdido" ? setLost(true) : set({ stage: s.id }))}>{s.label}</button>)}</div>
            {lead.stage === "perdido" && lead.lost_reason && <span className="as-muted">Motivo: {lead.lost_reason}</span>}
            {lost && <div className="as-chips">{LOST.map((r) => <button key={r} className="as-chip" onClick={() => { set({ stage: "perdido", lost_reason: r }); setLost(false); }}>{r}</button>)}</div>}
          </div>
          <div className="as-card pad">
            <span className="as-label">Datos del cliente</span>
            <div className="as-kv"><span>Pago</span><b>{{ contado: "Contado", credito: "Financiado", no_sabe: "No sabe" }[lead.pago] || "—"}{lead.enganche_q ? ` · enganche ${fmtQ(lead.enganche_q)}` : ""}</b></div>
            <div className="as-kv"><span>Compra</span><b>{{ inmediato: "Este mes", "1-3m": "1–3 meses", "3-6m": "3–6 meses", "6m+": "Más adelante" }[lead.plazo] || "—"}</b></div>
            <div className="as-kv"><span>Parte de pago</span><b>{lead.parte_pago ? lead.parte_pago_desc || "Sí" : lead.parte_pago === false ? "No" : "—"}</b></div>
            <div className="as-kv"><span>Contacto</span><b>{lead.consent ? "Acepta WhatsApp" : "Sin autorización"}</b></div>
            {lead.notes && <p style={{ margin: "6px 0 0" }}>{lead.notes}</p>}
          </div>
          <div className="as-card pad">
            <span className="as-label">Cotizaciones</span>
            {quotes.map((q) => (
              <div key={q.id} className="as-qrow">
                <div><b>{mname(q.model_id)}</b> <span className="as-muted">{q.color}</span><div className="as-muted">{fmtQ(q.total)}{q.monthly ? ` · ${fmtQ(q.monthly)}/mes` : ""} · {q.open_count ? `abierta ${q.open_count}×` : "sin abrir"}</div></div>
                <a className="as-btn as-ghost sm" href={`${quoteLink(q.public_token)}?preview=1`} target="_blank" rel="noreferrer">Ver</a>
                <a className="as-btn as-ghost sm" href={waLink(lead.phone, `Hola ${lead.name.split(" ")[0]}, aquí está su cotización de la ${mname(q.model_id)}: ${quoteLink(q.public_token)}`) || "#"} target="_blank" rel="noreferrer" onClick={() => logActivity(lead.id, "whatsapp", "Reenvió la cotización por WhatsApp")}>Reenviar</a>
              </div>
            ))}
            {!quotes.length && <span className="as-muted">Sin cotizaciones todavía.</span>}
          </div>
          {me?.role === "gerente" && (
            <div className="as-card pad">
              <span className="as-label">Asesor asignado</span>
              <select className="as-inp" value={lead.seller_id || ""} onChange={async (e) => { try { await manager("reassign", { lead_id: lead.id, seller_id: e.target.value }); toast("Cliente reasignado"); refresh(); } catch (x) { toast("No se pudo reasignar", x.message, "bad"); } }}>
                {(data.sellers || []).filter((s) => s.active !== false).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button className="as-btn as-ghost sm" style={{ color: "var(--as-bad)", alignSelf: "flex-start" }} onClick={async () => { if (!confirm(`¿Eliminar a ${lead.name} y sus cotizaciones? No se puede deshacer.`)) return; try { await manager("lead_delete", { lead_id: lead.id }); toast("Cliente eliminado"); onClose(); refresh(); } catch (x) { toast("No se pudo eliminar", x.message, "bad"); } }}>Eliminar cliente (duplicado o error)</button>
            </div>
          )}
        </div>
        <div className="as-sheet-right" style={{ gap: 14 }}>
          <div className="as-card pad">
            <div className="as-row-between"><span className="as-label">Seguimiento</span><span className="as-muted">{lead.next_action_at ? `Próximo: ${fmtDate(lead.next_action_at)}` : "Sin programar"} · contactos: {lead.followup_step || 0}</span></div>
            <textarea className="as-inp" rows={5} value={text} onChange={(e) => setMsg(e.target.value)} />
            <div className="as-actions">
              <a className="as-btn as-ghost" href={`tel:${lead.phone}`} onClick={() => logActivity(lead.id, "llamada", "Llamada al cliente")}>Llamar</a>
              <button className="as-btn as-wa" onClick={sendWa} disabled={!lead.phone}>Enviar WhatsApp</button>
            </div>
            <div className="as-chips">
              <span className="as-muted">Reprogramar:</span>
              {[["Mañana", 1], ["3 días", 3], ["1 semana", 7], ["2 semanas", 14]].map(([l, d]) => <button key={l} className="as-chip" onClick={() => { set({ next_action_at: nextMorning(d) }); toast("Seguimiento reprogramado", l); }}>{l}</button>)}
            </div>
          </div>
          <div className="as-card pad">
            <span className="as-label">Historial</span>
            <div style={{ display: "flex", gap: 8 }}><input className="as-inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agregar nota…" /><button className="as-btn as-ghost" disabled={!note.trim()} onClick={() => { logActivity(lead.id, "nota", note.trim()); setNote(""); }}>Guardar</button></div>
            <div className="as-timeline">
              {acts.map((a) => <div key={a.id}><i className={a.type.startsWith("cliente_") ? "hot" : a.type === "whatsapp" ? "wa" : ""} /><span>{a.detail || a.type}</span><small>{ago(a.created_at || a.at)}</small></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FollowUp({ onOpen }) {
  const { data, me, logActivity, saveLead, toast } = useAS();
  const { qBy, mname } = useLeadExtras();
  const [edit, setEdit] = useState({});
  const eod = endOfToday();
  const open = (data.leads || []).filter((l) => !["ganado", "perdido"].includes(l.stage) && l.next_action_at && (me?.role !== "gerente" || l.seller_id === me.id));
  const today = open.filter((l) => new Date(l.next_action_at).getTime() <= eod).sort((a, b) => ({ caliente: 0, tibio: 1, frio: 2 }[a.temperature] - { caliente: 0, tibio: 1, frio: 2 }[b.temperature]) || (qBy[b.id]?.[0]?.open_count || 0) - (qBy[a.id]?.[0]?.open_count || 0));
  const soon = open.filter((l) => { const t = new Date(l.next_action_at).getTime(); return t > eod && t <= eod + 7 * 864e5; }).sort((a, b) => new Date(a.next_action_at) - new Date(b.next_action_at));
  const Card = ({ l }) => {
    const qt = qBy[l.id]?.[0];
    const sug = followMessage({ lead: { ...l, _modelName: mname(l.model_id) }, step: Math.min(l.followup_step || 0, 3), quote: qt, me, event: data.settings?.event });
    const text = edit[l.id] ?? sug;
    const overdue = new Date(l.next_action_at).getTime() < Date.now() - 864e5;
    return (
      <div className="as-fcard">
        <div className="as-row-between">
          <button className="as-link" onClick={() => onOpen(l.id)}><b>{l.name}</b> <span className="as-muted">· {mname(l.model_id)}</span></button>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <TempPill t={l.temperature} />
            {qt?.open_count > 0 && <span className="as-pill hot">Abrió su cotización {qt.open_count}×</span>}
            {overdue && <span className="as-pill bad">Atrasado</span>}
            <span className="as-muted">Contacto #{(l.followup_step || 0) + 1}</span>
          </div>
        </div>
        <textarea className="as-inp" rows={3} value={text} onChange={(e) => setEdit((x) => ({ ...x, [l.id]: e.target.value }))} />
        <div className="as-actions">
          <button className="as-btn as-ghost sm" onClick={() => { saveLead({ ...l, stage: l.stage === "nuevo" ? "contactado" : l.stage, next_action_at: nextMorning(3) }); logActivity(l.id, "respondio", "El cliente respondió"); toast("Anotado", "Seguimiento en 3 días"); }}>Ya respondió</button>
          <button className="as-btn as-ghost sm" onClick={() => saveLead({ ...l, next_action_at: nextMorning(1) })}>Mañana</button>
          <a className="as-btn as-ghost sm" href={`tel:${l.phone}`} onClick={() => logActivity(l.id, "llamada", "Llamada al cliente")}>Llamar</a>
          <button className="as-btn as-wa" disabled={!l.phone || !l.consent} title={!l.consent ? "El cliente no autorizó WhatsApp" : ""} onClick={() => { const u = waLink(l.phone, text); window.open(u, "_blank"); logActivity(l.id, "whatsapp", text.slice(0, 300)); }}>Enviar WhatsApp</button>
        </div>
      </div>
    );
  };
  return (
    <div className="as-page">
      <div className="as-kpis">
        <div className="as-kpi dark"><span>Para hoy</span><b>{today.length}</b></div>
        <div className="as-kpi"><span>Próximos 7 días</span><b>{soon.length}</b></div>
        <div className="as-kpi"><span>Calientes abiertos</span><b>{open.filter((l) => l.temperature === "caliente").length}</b></div>
        <div className="as-kpi accent"><span>Vendidos</span><b>{(data.leads || []).filter((l) => l.stage === "ganado" && (me?.role !== "gerente" || l.seller_id === me.id)).length}</b></div>
      </div>
      <h2 className="as-h2">Hoy</h2>
      {today.map((l) => <Card key={l.id} l={l} />)}
      {!today.length && <div className="as-empty">Nada pendiente para hoy. 🎉</div>}
      {soon.length > 0 && <><h2 className="as-h2">Próximos días</h2>
        <div className="as-list">{soon.map((l) => <button key={l.id} className="as-lrow" onClick={() => onOpen(l.id)}><div className="as-lmain"><b>{l.name}</b><span className="as-muted">{mname(l.model_id)}</span></div><TempPill t={l.temperature} /><span className="as-muted">{fmtDate(l.next_action_at, { weekday: "short", day: "numeric", month: "short" })}</span></button>)}</div></>}
    </div>
  );
}
