// Catálogo del stand: info rápida por modelo para mostrarle al cliente
import { useState } from "react";
import { useAS } from "./store";
import { asset } from "../lib/supabase";
import { fmtQ, fmtUSD } from "../lib/format";
import { AngleViewer, Pano360, VideoReel } from "../components/Media";

export const priceTxt = (m) => (m.currency === "USD" ? fmtUSD(m.price) : fmtQ(m.price));
export const bonusFor = (settings, id) => { const ev = settings?.event || {}; const v = ev.bono_por_modelo?.[id]; return Number(v ?? ev.bono_q ?? 0) || 0; };

export function Stand({ onQuote, onCapture }) {
  const { data } = useAS();
  const [f, setF] = useState("todos");
  const [open, setOpen] = useState(null);
  const ms = (data.models || []).filter((m) => f === "todos" || (f === "hibrido" ? /h[íi]brid/i.test(m.powertrain || "") : !/h[íi]brid/i.test(m.powertrain || "")));
  return (
    <div className="as-page">
      <div className="as-row-between">
        <div className="as-seg">
          {[["todos", "Todos"], ["gasolina", "Gasolina"], ["hibrido", "Híbridos PHEV"]].map(([k, l]) => <button key={k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}</button>)}
        </div>
        <button className="as-btn as-primary" onClick={() => onCapture(null)}>＋ Registrar cliente</button>
      </div>
      <div className="as-grid">
        {ms.map((m) => {
          const c = (m.colors || []).find((x) => x.img);
          const b = bonusFor(data.settings, m.id);
          return (
            <button key={m.id} className="as-card as-model" onClick={() => setOpen(m)}>
              <div className="as-model-img">{c && <img src={asset(c.img)} alt={m.name} loading="lazy" />}{b > 0 && <span className="as-bono">Bono {fmtQ(b)}</span>}</div>
              <div className="as-model-meta">
                <b>{m.name}</b>
                <span className="as-muted">{m.powertrain}</span>
                <span className="as-price">{m.price_from ? "Desde " : ""}{priceTxt(m)}</span>
              </div>
            </button>
          );
        })}
      </div>
      {open && <ModelSheet m={open} onClose={() => setOpen(null)} onQuote={() => { setOpen(null); onQuote(open); }} onCapture={() => { setOpen(null); onCapture(open); }} />}
    </div>
  );
}

export function ModelSheet({ m, onClose, onQuote, onCapture }) {
  const { data, fx } = useAS();
  const colors = (m.colors || []).filter((c) => c.img);
  const [ci, setCi] = useState(0);
  const [tab, setTab] = useState("resumen");
  const versions = m.versions || [];
  const defaultV = Math.max(0, versions.findIndex((v) => (/h[íi]brid/i.test(m.powertrain || "") ? /h[íi]brid/i.test(v.name) : !/h[íi]brid/i.test(v.name))));
  const [vi, setVi] = useState(defaultV);
  const v = versions[vi] || { specs: m.specs || [], hl: m.highlights || [] };
  const videos = (m.media || []).filter((x) => x.type === "video");
  const panos = (m.media || []).filter((x) => x.type === "pano");
  const imgs = (m.media || []).filter((x) => x.type === "image");
  const [pi, setPi] = useState(0);
  const b = bonusFor(data.settings, m.id);
  const siblings = (data.models || []).filter((x) => x.family === m.family);
  return (
    <div className="as-sheet">
      <div className="as-sheet-head">
        <button className="as-btn as-ghost" onClick={onClose}>← Catálogo</button>
        <div className="as-sheet-title"><b>{m.name}</b><span className="as-muted">{m.tagline}</span></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="as-btn as-ghost" onClick={onCapture}>Registrar cliente</button>
          <button className="as-btn as-primary" onClick={onQuote}>Cotizar</button>
        </div>
      </div>
      <div className="as-sheet-body">
        <div className="as-sheet-left">
          <AngleViewer color={colors[ci]} alt={m.name} />
          <div className="as-swatches">
            {colors.map((c, i) => <button key={c.name} className={`as-sw ${i === ci ? "on" : ""}`} style={{ background: c.hex }} onClick={() => setCi(i)} aria-label={c.name} />)}
            <span className="as-muted">{colors[ci]?.name}</span>
          </div>
        </div>
        <div className="as-sheet-right">
          <div className="as-pricebox">
            <span className="as-label">{m.price_from ? "Precio desde" : "Precio"} · IVA incluido</span>
            <div className="as-bigprice">{priceTxt(m)}</div>
            {m.currency === "USD" && <span className="as-muted">≈ {fmtQ(m.price * fx)}</span>}
            {b > 0 && <div className="as-bonoline">🎁 {data.settings?.event?.bono_label || "Bono Autoshow"}: <b>− {fmtQ(b)}</b></div>}
            <span className="as-muted">Garantía {m.warranty}</span>
          </div>
          {siblings.length > 1 && (
            <div className="as-chips">{siblings.map((s) => <span key={s.id} className={`as-chip ${s.id === m.id ? "on" : ""}`}>{s.name} · {priceTxt(s)}</span>)}</div>
          )}
          <div className="as-hl">{(v.hl || m.highlights || []).map((h, i) => <div key={i}><b>{h[0]}<small>{h[1]}</small></b><span>{h[2]}</span></div>)}</div>
          {v.phev && <div className="as-note">⚡ {v.phev}</div>}
          <div className="as-seg as-seg-tabs">
            {[["resumen", "Ficha"], ...(videos.length ? [["videos", `Videos (${videos.length})`]] : []), ...(panos.length || imgs.length ? [["interior", "Interior 360°"]] : [])].map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
          </div>
          {tab === "resumen" && (
            <div className="as-specs">
              {versions.length > 1 && <div className="as-seg">{versions.map((x, i) => <button key={x.name} className={vi === i ? "on" : ""} onClick={() => setVi(i)}>{x.name}</button>)}</div>}
              {(v.specs || []).map((g) => (
                <details key={g.t} open={g === (v.specs || [])[0]}>
                  <summary>{g.t}</summary>
                  {g.rows.map(([k, val]) => <div key={k} className="as-specrow"><span>{k}</span><b>{val}</b></div>)}
                </details>
              ))}
            </div>
          )}
          {tab === "videos" && <VideoReel videos={videos} title="" cardW="31%" />}
          {tab === "interior" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {panos.length > 1 && <div className="as-seg">{panos.map((p, i) => <button key={p.src} className={pi === i ? "on" : ""} onClick={() => setPi(i)}>{p.label}</button>)}</div>}
              {panos[pi] && <Pano360 src={panos[pi].src} label={panos[pi].label} height={300} />}
              {imgs.map((x) => <img key={x.src} src={asset(x.src)} alt={x.label} style={{ width: "100%", borderRadius: 16 }} loading="lazy" />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
