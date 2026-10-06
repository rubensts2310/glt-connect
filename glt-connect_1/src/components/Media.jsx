import { useEffect, useRef, useState } from "react";
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

// Video del modelo (cuando el cliente nos comparta los archivos)
export function ModelVideo({ item, poster }) {
  return (
    <video src={item.src} poster={poster} autoPlay muted loop playsInline controls={!!item.controls}
      style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 18, background: "#000" }} />
  );
}
