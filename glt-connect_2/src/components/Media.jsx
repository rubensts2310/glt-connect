import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { asset } from "../lib/supabase";

// Interior 360°: arrastre horizontal sobre una panorámica equirectangular, con giro automático suave
export function Pano360({ src, height = 280, label }) {
  const ref = useRef(null);
  const [x, setX] = useState(0);
  const drag = useRef(null);
  const auto = useRef(true);
  useEffect(() => {
    let raf, last = performance.now();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const step = (t) => { if (auto.current && !reduce) setX((v) => v - (t - last) * 0.02); last = t; raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  const down = (e) => { auto.current = false; drag.current = { sx: e.clientX ?? e.touches?.[0].clientX, x0: x }; };
  const move = (e) => { if (!drag.current) return; const cx = e.clientX ?? e.touches?.[0].clientX; setX(drag.current.x0 + (cx - drag.current.sx) * 1.4); };
  const up = () => { drag.current = null; };
  return (
    <div ref={ref} role="img" aria-label={`Vista 360° · ${label || "interior"}`}
      onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up} onTouchStart={down} onTouchMove={move} onTouchEnd={up}
      style={{ height, borderRadius: 18, cursor: "grab", position: "relative", overflow: "hidden", touchAction: "pan-y",
        backgroundImage: `url(${asset(src)})`, backgroundSize: "350% auto", backgroundPosition: `${x}px center`, backgroundRepeat: "repeat-x", userSelect: "none" }}>
      <span style={{ position: "absolute", left: 12, bottom: 12, background: "rgba(13,16,20,.72)", color: "#fff", fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 99 }}>360° · {label || "Interior"} · arrastre para girar</span>
    </div>
  );
}

// Visor de ángulos (frente, lateral, trasera) para un color
export function AngleViewer({ color, alt, rounded = true }) {
  const views = ["hero", ...(color?.angles || [])];
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [color?.img]);
  if (!color?.img) return null;
  const src = (v) => asset(v === "hero" ? color.img : color.img.replace("_hero", `_${v}`));
  const name = { hero: "Frente", side: "Lateral", rear: "Trasera" };
  return (
    <div style={{ position: "relative" }}>
      <img className="car-img" src={src(views[i])} alt={`${alt} · ${name[views[i]]}`} style={rounded ? undefined : { borderRadius: 0 }} key={views[i]} />
      {views.length > 1 && (
        <div style={{ position: "absolute", right: 10, bottom: 10, display: "flex", gap: 4, background: "rgba(255,255,255,.85)", borderRadius: 99, padding: 3 }}>
          {views.map((v, k) => <button key={v} onClick={() => setI(k)} className="btn sm" style={{ padding: "5px 10px", background: k === i ? "var(--ink)" : "transparent", color: k === i ? "#fff" : "var(--ink)" }}>{name[v]}</button>)}
        </div>
      )}
    </div>
  );
}

// Video vertical que se reproduce solo cuando está en pantalla
function ReelCard({ v, onOpen, w }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && e.intersectionRatio > 0.6) el.play().catch(() => {}); else el.pause(); }, { threshold: [0, 0.6, 1] });
    io.observe(el); return () => io.disconnect();
  }, []);
  return (
    <button onClick={onOpen} className="reel" style={{ width: w }} aria-label={`Ver ${v.label} con sonido`}>
      <video ref={ref} src={v.src} poster={v.poster} muted loop playsInline preload="metadata" />
      <span className="reel-play">▶</span>
    </button>
  );
}

// Carrusel de videos estilo reels + visor a pantalla completa con sonido
export function VideoReel({ videos, title = "Véala en acción", dark = false, cardW = "44%" }) {
  const [open, setOpen] = useState(null);
  if (!videos?.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 style={{ color: dark ? "#fff" : undefined }}>{title}</h2>
        <span style={{ fontSize: 12, opacity: 0.6, color: dark ? "#fff" : undefined }}>{videos.length} {videos.length === 1 ? "video" : "videos"} · toque para sonido</span>
      </div>
      <div className="reel-row">
        {videos.map((v, i) => <ReelCard key={v.src} v={v} w={videos.length === 1 ? "60%" : cardW} onOpen={() => setOpen(i)} />)}
      </div>
      {open !== null && createPortal(
        <div className="reel-modal" onClick={() => setOpen(null)} role="dialog" aria-label="Video">
          <video src={videos[open].src} poster={videos[open].poster} autoPlay controls playsInline onClick={(e) => e.stopPropagation()} onEnded={() => setOpen((open + 1) % videos.length)} />
          <button className="reel-x" onClick={() => setOpen(null)} aria-label="Cerrar">✕</button>
          {videos.length > 1 && <div className="reel-dots">{videos.map((_, i) => <span key={i} onClick={(e) => { e.stopPropagation(); setOpen(i); }} className={i === open ? "on" : ""} />)}</div>}
        </div>, document.body
      )}
    </div>
  );
}

// Video del modelo (cuando el cliente nos comparta los archivos)
export function ModelVideo({ item, poster }) {
  return (
    <video src={item.src} poster={poster} autoPlay muted loop playsInline controls={!!item.controls}
      style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 18, background: "#000" }} />
  );
}
