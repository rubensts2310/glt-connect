// Gráficas SVG interactivas: animan al aparecer y muestran el valor al pasar el mouse (o el dedo).
import { useEffect, useRef, useState } from "react";

// true un instante después de montar → dispara transiciones de entrada
function useMounted() {
  const [on, setOn] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true))); return () => cancelAnimationFrame(r); }, []);
  return on;
}
const EASE = "cubic-bezier(.2,.7,.2,1)";

// Número que cuenta hasta su valor
export function CountUp({ value, fmt = (v) => Math.round(v).toLocaleString("en-US"), ms = 900 }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const target = Number(value) || 0, start = performance.now(), f0 = from.current;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(target); from.current = target; return; }
    let raf;
    const step = (t) => { const p = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - p, 3); const cur = f0 + (target - f0) * e; setV(cur); if (p < 1) raf = requestAnimationFrame(step); else from.current = target; };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{fmt(v)}</>;
}

// Globo de valor flotante (HTML, posicionado en % sobre el SVG)
function Tip({ x, y, children, align = "center" }) {
  return (
    <div className="ctip" style={{ left: `${x}%`, top: `${y}%`, transform: `translate(${align === "left" ? "8px" : align === "right" ? "calc(-100% - 8px)" : "-50%"}, calc(-100% - 10px))` }}>
      {children}
    </div>
  );
}

export function Ring({ value, max = 100, size = 64, stroke = 8, color = "var(--ink)", track = "var(--card2)", label, sub }) {
  const on = useMounted();
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, value / max));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? value}`} className="ring-h">
      <title>{`${label ?? value}${sub ? ` · ${sub}` : ""}`}</title>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${on ? c * p : 0} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: `stroke-dasharray 1s ${EASE}` }} />
      <text x="50%" y={sub ? "47%" : "53%"} textAnchor="middle" dominantBaseline="middle" fontWeight="800" fontSize={size * 0.27} fill="var(--ink)" style={{ fontVariantNumeric: "tabular-nums" }}>{label ?? value}</text>
      {sub && <text x="50%" y="68%" textAnchor="middle" fontSize={size * 0.13} fill="var(--ink3)" fontWeight="600">{sub}</text>}
    </svg>
  );
}

export function Gauge({ value, size = 180, label }) {
  const on = useMounted();
  const w = size, h = size * 0.62, r = size * 0.4, cx = w / 2, cy = h - 8;
  const a0 = Math.PI, p = Math.max(0, Math.min(1, (on ? value : 0) / 100));
  const pt = (t) => [cx + r * Math.cos(a0 + t * Math.PI), cy + r * Math.sin(a0 + t * Math.PI)];
  const arc = (t0, t1) => { const [x0, y0] = pt(t0), [x1, y1] = pt(t1); return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`; };
  const color = value >= 70 ? "var(--hot)" : value >= 40 ? "var(--warm)" : "var(--cold)";
  const half = Math.PI * r;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: size }} role="img" aria-label={`Puntaje ${value}`}>
      <path d={arc(0, 0.4)} stroke="#e7eef5" strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d={arc(0.4, 0.7)} stroke="#fff1d6" strokeWidth="14" fill="none" />
      <path d={arc(0.7, 1)} stroke="#ffe7e1" strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d={arc(0, 1)} stroke={color} strokeWidth="14" fill="none" strokeLinecap="round" strokeDasharray={`${half * p} ${half}`} style={{ transition: `stroke-dasharray 1.1s ${EASE}` }} />
      <g style={{ transform: `rotate(${p * 180}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: `transform 1.1s ${EASE}` }}>
        <circle cx={cx - r} cy={cy} r="9" fill="#fff" stroke={color} strokeWidth="4" />
      </g>
      <text x={cx} y={cy - 16} textAnchor="middle" fontSize={size * 0.2} fontWeight="800" fill="var(--ink)"><CountUp value={value} /></text>
      {label && <text x={cx} y={cy + 2} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink3)">{label}</text>}
    </svg>
  );
}

// Curva con área + cursor: series [{name,color,values}] sobre labels
export function AreaChart({ labels, series, height = 220, fmt = (v) => v, markers = [], tipLabels, tipFmt }) {
  const W = 640, H = height, L = 40, R = 14, T = 14, B = 28;
  const [hi, setHi] = useState(null);
  const ref = useRef(null);
  const all = series.flatMap((s) => s.values);
  const max = Math.max(1, ...all) * 1.12;
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, labels.length - 1);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round((max / 1.12) * t));
  const move = (e) => {
    const r = ref.current.getBoundingClientRect();
    const cx = ((e.touches?.[0]?.clientX ?? e.clientX) - r.left) / r.width * W;
    const i = Math.round(((cx - L) / (W - L - R)) * (labels.length - 1));
    setHi(Math.max(0, Math.min(labels.length - 1, i)));
  };
  const key = labels.join("|") + series.map((s) => s.values.join(",")).join("|");
  const tipX = hi != null ? (x(hi) / W) * 100 : 0;
  const tipTop = hi != null ? (Math.min(...series.map((s) => y(s.values[hi] ?? 0))) / H) * 100 : 0;
  return (
    <div className="chart-wrap">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" onMouseMove={move} onMouseLeave={() => setHi(null)} onTouchStart={move} onTouchMove={move} style={{ cursor: "crosshair", touchAction: "pan-y" }}>
        {ticks.map((t, i) => (
          <g key={i}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={i ? "3 5" : ""} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--ink3)">{fmt(t)}</text></g>
        ))}
        {labels.map((l, i) => (i % Math.ceil(labels.length / 10) === 0 || i === labels.length - 1) && (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill={hi === i ? "var(--ink)" : "var(--ink3)"} fontWeight={hi === i ? 700 : 400}>{l}</text>
        ))}
        {markers.map((m, i) => (
          <g key={i}><line x1={x(m.i)} x2={x(m.i)} y1={T} y2={H - B} stroke="var(--blue)" strokeDasharray="4 4" />
            <text x={x(m.i) + 5} y={T + 10} fontSize="10.5" fontWeight="700" fill="var(--blue)">{m.label}</text></g>
        ))}
        <g key={key}>
          {series.map((s, si) => {
            const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
            const dim = hi != null ? 1 : 1;
            return (
              <g key={si} opacity={dim}>
                {s.area !== false && <polygon className="c-fade" style={{ animationDelay: `${0.25 + si * 0.12}s` }} points={`${x(0)},${y(0)} ${pts} ${x(s.values.length - 1)},${y(0)}`} fill={s.color} opacity={s.opacity ?? 0.12} />}
                <polyline className={s.dash ? "c-fade" : "c-draw"} pathLength="1" style={{ animationDelay: `${si * 0.12}s` }} points={pts} fill="none" stroke={s.color} strokeWidth={s.width ?? 2.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash} />
                {s.dotLast && hi == null && <circle className="c-pop" cx={x(s.values.length - 1)} cy={y(s.values[s.values.length - 1])} r="5" fill={s.color} stroke="#fff" strokeWidth="2" />}
              </g>
            );
          })}
        </g>
        {hi != null && (
          <g pointerEvents="none">
            <line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} stroke="var(--ink)" strokeOpacity=".25" />
            {series.map((s, si) => s.values[hi] != null && <circle key={si} cx={x(hi)} cy={y(s.values[hi])} r="5.5" fill={s.color} stroke="#fff" strokeWidth="2.5" />)}
          </g>
        )}
      </svg>
      {hi != null && (
        <Tip x={tipX} y={tipTop} align={tipX > 72 ? "right" : tipX < 22 ? "left" : "center"}>
          <b style={{ textTransform: "capitalize" }}>{(tipLabels || labels)[hi]}</b>
          {series.map((s, si) => ({ s, si })).filter(({ s }) => s.values[hi] != null).sort((a, b) => b.s.values[hi] - a.s.values[hi]).map(({ s, si }) => (
            <div key={si} className="ctip-row"><i style={{ background: s.color }} /><span>{s.name || `Serie ${si + 1}`}</span><b>{(tipFmt || fmt)(s.values[hi])}</b></div>
          ))}
        </Tip>
      )}
    </div>
  );
}

// Lollipop horizontal: items [{label,value,color,sub}]
export function Lollipop({ items, max, fmt = (v) => v, rowH = 34, labelW = 130, width = 520 }) {
  const on = useMounted();
  const [hi, setHi] = useState(null);
  const W = width, H = items.length * rowH + 8, L = labelW, R = 60;
  const mx = max ?? Math.max(1, ...items.map((i) => Math.abs(i.value)));
  const min = Math.min(0, ...items.map((i) => i.value));
  const x = (v) => L + ((v - min) / (mx - min)) * (W - L - R);
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" onMouseLeave={() => setHi(null)}>
        {min < 0 && <line x1={x(0)} x2={x(0)} y1={0} y2={H} stroke="var(--line)" />}
        {items.map((it, i) => {
          const cy = i * rowH + rowH / 2 + 4;
          const vx = on ? x(it.value) : x(0);
          const h = hi === i, faded = hi != null && !h;
          return (
            <g key={i} onMouseEnter={() => setHi(i)} onTouchStart={() => setHi(i)} style={{ cursor: "default", opacity: faded ? 0.4 : 1, transition: "opacity .2s" }}>
              <rect x={0} y={cy - rowH / 2} width={W} height={rowH} fill={h ? "var(--card2)" : "transparent"} rx="10" />
              <text x={L - 12} y={cy + 4} textAnchor="end" fontSize="12.5" fontWeight={it.bold || h ? 800 : 600} fill="var(--ink)">{it.label}</text>
              <line x1={x(Math.min(0, it.value))} x2={on ? x(Math.max(0, it.value)) : x(Math.min(0, it.value))} y1={cy} y2={cy} stroke={it.color || "var(--ink)"} strokeWidth={h ? 5 : 3} strokeLinecap="round" opacity=".35" style={{ transition: `all .9s ${EASE} ${i * 0.05}s` }} />
              <circle cx={vx} cy={cy} r={h ? 10 : 8} fill={it.color || "var(--ink)"} style={{ transition: `cx .9s ${EASE} ${i * 0.05}s, r .2s` }} />
              <text x={it.value < 0 ? x(0) + 10 : x(it.value) + 14} y={cy + 4} textAnchor="start" fontSize="12" fontWeight="700" fill="var(--ink2)" style={{ fontVariantNumeric: "tabular-nums", opacity: on ? 1 : 0, transition: `opacity .4s ${0.5 + i * 0.05}s` }}>{fmt(it.value)}</text>
            </g>
          );
        })}
      </svg>
      {hi != null && items[hi]?.sub && (
        <Tip x={(x(items[hi].value) / W) * 100} y={((hi * rowH + 4) / H) * 100} align={x(items[hi].value) / W > 0.7 ? "right" : "center"}>
          <b>{items[hi].label}</b><div className="ctip-row"><span>{items[hi].sub}</span></div>
        </Tip>
      )}
    </div>
  );
}

// Donut con segmentos [{label,value,color}]: al pasar el mouse muestra el segmento en el centro
export function Donut({ items, size = 150, stroke = 22, center, sub, fmt = (v) => v }) {
  const on = useMounted();
  const [hi, setHi] = useState(null);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, total = items.reduce((a, b) => a + b.value, 0) || 1;
  let acc = 0;
  const h = hi != null ? items[hi] : null;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" onMouseLeave={() => setHi(null)} style={{ overflow: "visible" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card2)" strokeWidth={stroke} />
      {items.map((it, i) => {
        const len = (it.value / total) * c;
        const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={it.color} strokeWidth={hi === i ? stroke + 8 : stroke}
          strokeDasharray={`${on ? Math.max(0, len - 2) : 0} ${c}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          onMouseEnter={() => setHi(i)} onTouchStart={() => setHi(i)}
          style={{ cursor: "pointer", opacity: hi != null && hi !== i ? 0.35 : 1, transition: `stroke-dasharray .9s ${EASE} ${i * 0.08}s, stroke-width .2s, opacity .2s` }}>
          <title>{`${it.label}: ${fmt(it.value)} (${Math.round((it.value / total) * 100)}%)`}</title>
        </circle>;
        acc += len; return el;
      })}
      {h ? (
        <>
          <text x="50%" y="44%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.17} fontWeight="800" fill="var(--ink)">{fmt(h.value)}</text>
          <text x="50%" y="58%" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink2)">{String(h.label).slice(0, 16)}</text>
          <text x="50%" y="69%" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--ink3)">{Math.round((h.value / total) * 100)}%</text>
        </>
      ) : (
        <>
          {center != null && <text x="50%" y={sub ? "46%" : "52%"} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.19} fontWeight="800" fill="var(--ink)">{typeof center === "number" ? <CountUp value={center} /> : center}</text>}
          {sub && <text x="50%" y="62%" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink3)">{sub}</text>}
        </>
      )}
    </svg>
  );
}

// Embudo como píldoras escalonadas; al pasar el mouse muestra la conversión desde la etapa anterior
export function Funnel({ steps }) {
  const on = useMounted();
  const [hi, setHi] = useState(null);
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }} onMouseLeave={() => setHi(null)}>
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : null;
        return (
          <div key={i} onMouseEnter={() => setHi(i)} style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr) 48px", gap: 10, alignItems: "center", opacity: hi != null && hi !== i ? 0.45 : 1, transition: "opacity .2s" }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.label}</span>
            <div style={{ height: 26, background: "var(--card2)", borderRadius: 99, overflow: "hidden", position: "relative" }}>
              <div style={{ width: on ? `${Math.max(4, (s.value / max) * 100)}%` : "0%", height: "100%", borderRadius: 99, background: s.color || "var(--ink)", opacity: 1 - i * 0.07, transition: `width .9s ${EASE} ${i * 0.07}s` }} />
              {hi === i && prev != null && <span className="funnel-tip">{prev ? Math.round((s.value / prev) * 100) : 0}% de la etapa anterior</span>}
            </div>
            <b className="num" style={{ textAlign: "right" }}><CountUp value={s.value} /></b>
          </div>
        );
      })}
    </div>
  );
}

export function Spark({ values, color = "var(--blue)", w = 110, h = 34 }) {
  const max = Math.max(1, ...values), min = Math.min(...values);
  const x = (i) => (i * w) / Math.max(1, values.length - 1), y = (v) => h - 3 - ((v - min) / Math.max(1, max - min)) * (h - 6);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <title>{values.join(" · ")}</title>
      <polygon className="c-fade" style={{ animationDelay: ".3s" }} points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity=".12" />
      <polyline className="c-draw" pathLength="1" points={pts} fill="none" stroke={color} strokeWidth="2" />
      <circle className="c-pop" cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3" fill={color} />
    </svg>
  );
}
