// Catálogo del stand: info rápida por modelo para mostrarle al cliente
import { useState } from "react";
import { useAS } from "./store";
import { asset } from "../lib/supabase";
import { fmtQ, fmtUSD } from "../lib/format";
import { AngleViewer, Pano360, VideoReel } from "../components/Media";

export const priceTxt = (m) => (m.currency === "USD" ? fmtUSD(m.price) : fmtQ(m.price));
// Foto de un color: la propia o, si no tiene, la de referencia (otro color del mismo modelo)
export const colorPhoto = (c) => (c?.img ? c : c?.ref ? { ...c, img: c.ref, isRef: true } : null);
export const modelPhoto = (m) => colorPhoto((m?.colors || []).find((c) => c.img) || (m?.colors || []).find((c) => c.ref));
export const bonusFor = (settings, id) => { const ev = settings?.event || {}; const v = ev.bono_por_modelo?.[id]; return Number(v ?? ev.bono_q ?? 0) || 0; };

export function Stand({ onQuote, onCapture }) {
  const { data } = useAS();
  const [f, setF] = useState("todos");
  const [open, setOpen] = useState(null);
  const ms = (data.models || []).filter((m) => f === "todos" || (f === "hibrido" ? /h[íi]brid/i.test(m.powertrain || "") : !/h[íi]brid/i.test(m.powertrain || "")));
  const groups = [["En el stand", ms.filter((m) => m.in_show !== false)], ["Otros modelos", ms.filter((m) => m.in_show === false)]].filter(([, l]) => l.length);
  return (
    <div className="as-page">
      <div className="as-row-between">
        <div className="as-seg">
          {[["todos", "Todos"], ["gasolina", "Gasolina"], ["hibrido", "Híbridos PHEV"]].map(([k, l]) => <button key={k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}</button>)}
        </div>
        <button className="as-btn as-primary" onClick={() => onCapture(null)}>＋ Registrar cliente</button>
      </div>
      {groups.map(([title, list]) => (
        <section key={title} className="as-group">
          {groups.length > 1 && <h3 className="as-group-title">{title}</h3>}
          <div className="as-grid">
            {list.map((m) => {
              const c = modelPhoto(m);
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
        </section>
      ))}
      {open && <ModelSheet m={open} onClose={() => setOpen(null)} onQuote={() => { setOpen(null); onQuote(open); }} onCapture={() => { setOpen(null); onCapture(open); }} />}
    </div>
  );
}

export function ModelSheet({ m, onClose, onQuote, onCapture }) {
  const { data, fx } = useAS();
  const colors = m.colors || [];
  const interiors = m.interior_colors || [];
  const [ci, setCi] = useState(0);
  const photo = colorPhoto(colors[ci]);
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
          <div className="as-photo">
            {photo ? <AngleViewer color={photo} alt={m.name} /> : <div className="as-nophoto">Foto próximamente</div>}
            {photo?.isRef && <span className="as-refnote">Foto referencial</span>}
          </div>
          <div className="as-swatches">
            {colors.map((c, i) => <button key={c.name} className={`as-sw ${i === ci ? "on" : ""}`} style={{ background: c.hex }} onClick={() => setCi(i)} aria-label={c.name} />)}
            <span className="as-muted">{colors[ci]?.name}</span>
          </div>
          {interiors.length > 0 && (
            <div className="as-interiors">
              <span className="as-label">Interior</span>
              {interiors.map((c) => <span key={c.name} className="as-int"><i style={{ background: c.hex }} />{c.name}</span>)}
            </div>
          )}
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
