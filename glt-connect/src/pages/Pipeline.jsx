import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { CHANNELS, STAGES, ago } from "../lib/format";
import { TopBar } from "../components/Shell";
import { ChannelChip, Modal, SellerAvatar, SlaBadge, TempChip } from "../components/bits";

export function LostModal({ onConfirm, onClose }) {
  const { settings } = useStore();
  const [r, setR] = useState("");
  return (
    <Modal onClose={onClose}>
      <h2>¿Por qué se perdió?</h2>
      <p className="muted" style={{ margin: 0 }}>El motivo es obligatorio: alimenta el análisis de dirección.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(settings.lost_reasons || []).map((x) => <button key={x} className={`btn sm ${r === x ? "" : "ghost"}`} onClick={() => setR(x)}>{x}</button>)}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn" disabled={!r} onClick={() => onConfirm(r)}>Marcar como perdido</button>
      </div>
    </Modal>
  );
}

export default function Pipeline() {
  const { visibleLeads, modelById, vendedores, viewAs, updateLead, toast } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [temp, setTemp] = useState("");
  const [ch, setCh] = useState("");
  const [seller, setSeller] = useState("");
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [lostFor, setLostFor] = useState(null);
  const [showClosed, setShowClosed] = useState(false);

  const list = useMemo(() => visibleLeads.filter((l) =>
    (!q || (l.name || "").toLowerCase().includes(q.toLowerCase()) || (modelById[l.model_id]?.name || "").toLowerCase().includes(q.toLowerCase())) &&
    (!temp || l.temperature === temp) && (!ch || l.channel === ch) && (!seller || l.seller_id === seller)
  ), [visibleLeads, q, temp, ch, seller, modelById]);

  const cols = STAGES.filter((s) => showClosed || !["ganado", "perdido"].includes(s.id));
  const move = async (id, stage) => {
    const l = visibleLeads.find((x) => x.id === id);
    if (!l || l.stage === stage) return;
    if (stage === "perdido") return setLostFor(id);
    const patch = { stage, last_activity_at: new Date().toISOString() };
    if (stage === "ganado") { patch.won_at = new Date().toISOString(); const m = modelById[l.model_id]; if (m) patch.sale_amount = m.currency === "USD" ? m.price * 7.7 : m.price; }
    await updateLead(id, patch, { type: "etapa", detail: `Movido a ${STAGES.find((s) => s.id === stage).label}` });
    if (stage === "ganado") toast({ title: "¡Venta cerrada!", body: `${l.name} · ${modelById[l.model_id]?.name ?? ""}`, kind: "hot" });
  };

  return (
    <>
      <TopBar title="Embudo de ventas" crumbs={viewAs.role === "vendedor" ? "Mis leads" : "Jetour · todas las salas"}>
        <input className="inp" style={{ width: 220 }} placeholder="Buscar cliente o modelo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <select className="sel" style={{ width: 130 }} value={temp} onChange={(e) => setTemp(e.target.value)} aria-label="Temperatura">
          <option value="">Temperatura</option><option value="caliente">Caliente</option><option value="tibio">Tibio</option><option value="frio">Frío</option>
        </select>
        <select className="sel" style={{ width: 130 }} value={ch} onChange={(e) => setCh(e.target.value)} aria-label="Canal">
          <option value="">Canal</option>{Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {viewAs.role !== "vendedor" && <select className="sel" style={{ width: 160 }} value={seller} onChange={(e) => setSeller(e.target.value)} aria-label="Asesor">
          <option value="">Todos los asesores</option>{vendedores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>}
        <button className="btn ghost sm" onClick={() => setShowClosed((x) => !x)}>{showClosed ? "Ocultar cerrados" : "Ver ganados y perdidos"}</button>
      </TopBar>
      <div className="kanban">
        {cols.map((c) => {
          const items = list.filter((l) => l.stage === c.id).sort((a, b) => (b.score || 0) - (a.score || 0));
          return (
            <div key={c.id} className={`col ${over === c.id ? "drop" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setOver(c.id); }} onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); setOver(null); drag && move(drag, c.id); setDrag(null); }}>
              <div className="col-head"><h3>{c.label}</h3><span className="chip">{items.length}</span></div>
              {items.slice(0, 40).map((l) => (
                <div key={l.id} className="lc" draggable onDragStart={() => setDrag(l.id)} onClick={() => nav(`/lead/${l.id}`)} role="link" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && nav(`/lead/${l.id}`)} style={{ cursor: "pointer" }}>
                  <div className="top-line"><span className="name">{l.name || "Prospecto nuevo"}</span><TempChip t={l.temperature} score={l.score} /></div>
                  <div className="muted" style={{ fontSize: 12.5 }}>{modelById[l.model_id]?.name || "Modelo por definir"}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {l.seller_id ? <SellerAvatar id={l.seller_id} size={24} /> : <span className="chip blue">Bot</span>}
                      <ChannelChip c={l.channel} />
                    </div>
                    <span className="faint" style={{ fontSize: 11.5 }}>{ago(l.last_activity_at || l.created_at)}</span>
                  </div>
                  {c.id === "perdido" && l.lost_reason && <span className="chip bad">{l.lost_reason}</span>}
                  <SlaBadge lead={l} />
                </div>
              ))}
              {items.length > 40 && <span className="faint" style={{ fontSize: 12, textAlign: "center" }}>+{items.length - 40} más</span>}
            </div>
          );
        })}
      </div>
      {lostFor && <LostModal onClose={() => setLostFor(null)} onConfirm={async (r) => {
        await updateLead(lostFor, { stage: "perdido", lost_reason: r }, { type: "etapa", detail: `Perdido: ${r}` }); setLostFor(null);
      }} />}
    </>
  );
}
