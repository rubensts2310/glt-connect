import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { useStore } from "../lib/store";
import { CHANNELS, TEMP, fmtMin, initials, minsBetween } from "../lib/format";
import { IClock } from "./icons";

export const TempChip = ({ t, score }) => {
  const x = TEMP[t] || TEMP.frio;
  return <span className={`chip ${x.cls}`}><span className="dot" style={{ background: "currentColor" }} />{x.label}{score != null && <b className="num">· {score}</b>}</span>;
};

export const ChannelChip = ({ c }) => <span className="chip">{CHANNELS[c] || c}</span>;

export function SellerAvatar({ id, size = 30, showName }) {
  const { sellerById } = useStore();
  const s = sellerById[id];
  if (!s) return showName ? <span className="chip blue">Bot</span> : null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span className="avatar" style={{ background: s.color, width: size, height: size }} title={s.name}>{initials(s.name)}</span>
      {showName && <span style={{ fontWeight: 600 }}>{s.name}</span>}
    </span>
  );
}

// Reloj de SLA: primera respuesta del asesor tras la asignación
export function SlaBadge({ lead, sla }) {
  const { tick } = useStore(); void tick;
  if (!lead.assigned_at || ["ganado", "perdido"].includes(lead.stage)) return null;
  const s = sla || { primera_respuesta_min: 5, alerta_gerente_min: 15, reasignar_min: 120 };
  if (lead.first_response_at) {
    const m = minsBetween(lead.assigned_at, lead.first_response_at);
    return <span className={`sla ${m <= s.primera_respuesta_min ? "ok" : m <= s.alerta_gerente_min ? "warn" : "late"}`}><IClock />Respondió en {fmtMin(m)}</span>;
  }
  const m = minsBetween(lead.assigned_at);
  const cls = m <= s.primera_respuesta_min ? "ok" : m <= s.alerta_gerente_min ? "warn" : "late";
  const txt = m <= s.primera_respuesta_min ? `Responder en ${Math.max(0, Math.ceil(s.primera_respuesta_min - m))} min`
    : m <= s.alerta_gerente_min ? `Sin respuesta · ${fmtMin(m)}` : m <= s.reasignar_min ? `Alerta al gerente · ${fmtMin(m)}` : `Reasignación · ${fmtMin(m)}`;
  return <span className={`sla ${cls}`}><IClock />{txt}</span>;
}

export function Toasts() {
  const { toasts } = useStore();
  const nav = useNavigate();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind || ""}`} onClick={() => t.lead && nav(`/lead/${t.lead}`)}>
          <b>{t.title}</b><span>{t.body}</span>
        </div>
      ))}
    </div>
  );
}

export function QR({ text, size = 200 }) {
  const [src, setSrc] = useState(null);
  useEffect(() => { QRCode.toDataURL(text, { margin: 1, width: size * 2, color: { dark: "#0d1014", light: "#ffffff" } }).then(setSrc); }, [text, size]);
  return src ? <img src={src} width={size} height={size} alt="Código QR" style={{ borderRadius: 12 }} /> : <div style={{ width: size, height: size }} />;
}

export function Loading({ text = "Cargando…" }) {
  return <div className="empty" style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center" }}><span className="spin" />{text}</div>;
}

export function Modal({ children, onClose }) {
  return <div className="overlay" style={{ justifyContent: "center", alignItems: "center" }} onClick={onClose}><div className="modal-c" onClick={(e) => e.stopPropagation()}>{children}</div></div>;
}
