import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { asset } from "../lib/supabase";
import { priceMain, priceSub } from "../lib/format";
import { TopBar } from "../components/Shell";
import { AngleViewer, ModelVideo, Pano360 } from "../components/Media";
import { IBack } from "../components/icons";

export default function ModelDetail() {
  const { id } = useParams();
  const { models } = useStore();
  const m = models.find((x) => x.id === id);
  const [ci, setCi] = useState(0);
  const [vi, setVi] = useState(null);
  const [pi, setPi] = useState(0);
  if (!m) return <div className="card"><h2>Modelo no encontrado</h2><Link to="/catalogo" className="btn ghost sm">Volver al catálogo</Link></div>;
  const colors = (m.colors || []).filter((c) => c.img);
  const versions = m.versions?.length ? m.versions : [{ name: m.version, specs: m.specs, hl: m.highlights }];
  // versión que corresponde a este modelo dentro de su familia
  const defaultVi = Math.max(0, versions.findIndex((v) => (m.powertrain.includes("Híbrido") ? /h[íi]brid/i.test(v.name) : !/h[íi]brid/i.test(v.name))));
  const v = versions[vi ?? defaultVi];
  const siblings = models.filter((x) => x.family === m.family && x.id !== m.id);
  const panos = (m.media || []).filter((x) => x.type === "pano");
  const videos = (m.media || []).filter((x) => x.type === "video");
  const images = (m.media || []).filter((x) => x.type === "image");
  // Comparativo de versiones: todas las filas de todas las versiones
  const rows = [...new Set(versions.flatMap((x) => x.specs.flatMap((g) => g.rows.map((r) => r[0]))))];
  const val = (ver, k) => ver.specs.flatMap((g) => g.rows).find((r) => r[0] === k)?.[1] ?? "—";

  return (
    <>
      <TopBar title={m.name} crumbs={<Link to="/catalogo" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><IBack /> Catálogo</Link>}>
        <span className="chip">{m.powertrain}</span><span className="chip good">Garantía {m.warranty}</span>
      </TopBar>
      <div className="grid g-main">
        <div className="card">
          {videos[0] ? <ModelVideo item={videos[0]} poster={asset(colors[ci]?.img)} /> : <AngleViewer color={colors[ci]} alt={m.name} />}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {colors.map((c, i) => <button key={c.name} className={`swatch ${i === ci ? "on" : ""}`} style={{ background: c.hex }} title={c.name} aria-label={c.name} onClick={() => setCi(i)} />)}
            <span className="muted">{colors[ci]?.name}</span>
          </div>
          {videos[0] && <AngleViewer color={colors[ci]} alt={m.name} />}
        </div>
        <div className="card">
          <span className="label">{m.price_from ? "Desde" : "Precio"} · IVA incluido</span>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.03em" }} className="num">{priceMain(m)}</div>
          {priceSub(m) && <span className="faint">{priceSub(m)}</span>}
          <p className="muted" style={{ margin: 0 }}>{m.tagline}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {(v.hl || []).map((h, i) => <div key={i} style={{ background: "var(--card2)", borderRadius: 14, padding: 10, textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800 }}>{h[0]}<span style={{ fontSize: 11, marginLeft: 2 }}>{h[1]}</span></div><div className="faint" style={{ fontSize: 11 }}>{h[2]}</div></div>)}
          </div>
          {v.phev && <div className="card flat" style={{ padding: 12 }}><span className="label">Híbrido enchufable</span><span style={{ fontSize: 13 }}>{v.phev}</span></div>}
          {siblings.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><span className="faint" style={{ fontSize: 12, width: "100%" }}>Otras versiones a la venta</span>{siblings.map((x) => <Link key={x.id} to={`/catalogo/${x.id}`} className="pill">{x.name} · {priceMain(x)}</Link>)}</div>}
        </div>
      </div>

      {(panos.length > 0 || images.length > 0) && (
        <div className="card">
          <div className="card-head"><h2>Interior</h2>
            {panos.length > 1 && <div className="seg">{panos.map((p, i) => <button key={p.src} className={i === pi ? "on" : ""} onClick={() => setPi(i)}>{p.label}</button>)}</div>}
          </div>
          {panos[pi] && <Pano360 src={panos[pi].src} label={panos[pi].label} height={320} />}
          {images.length > 0 && <div className="grid g3">{images.map((x) => <img key={x.src} src={asset(x.src)} alt={x.label} loading="lazy" style={{ width: "100%", borderRadius: 14, aspectRatio: "16/10", objectFit: "cover" }} />)}</div>}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Ficha técnica</h2>
          {versions.length > 1 && <div className="seg">{versions.map((x, i) => <button key={x.name} className={(vi ?? defaultVi) === i ? "on" : ""} onClick={() => setVi(i)}>{x.name}{x.sub ? ` · ${x.sub}` : ""}</button>)}</div>}
        </div>
        <div className="grid g3">
          {v.specs.map((g) => (
            <div key={g.t} className="card flat" style={{ gap: 4 }}>
              <span className="label">{g.t}</span>
              {g.rows.map(([k, val2]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}><span className="muted">{k}</span><b style={{ textAlign: "right" }}>{val2}</b></div>)}
            </div>
          ))}
        </div>
      </div>

      {versions.length > 1 && (
        <div className="card">
          <h2>Comparativo de versiones</h2>
          <div className="tablewrap"><table className="t">
            <thead><tr><th>Característica</th>{versions.map((x) => <th key={x.name}>{x.name}{x.sub ? ` · ${x.sub}` : ""}</th>)}</tr></thead>
            <tbody>{rows.map((k) => <tr key={k}><td className="muted">{k}</td>{versions.map((x) => <td key={x.name} style={{ whiteSpace: "normal" }}><b>{val(x, k)}</b></td>)}</tr>)}</tbody>
          </table></div>
        </div>
      )}
      <p className="faint" style={{ fontSize: 12 }}>Fichas basadas en materiales oficiales de fábrica. Datos marcados "validar" se confirman con el sales kit de Grupo Los Tres.</p>
    </>
  );
}
