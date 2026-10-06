// Gráficas SVG con mood infográfico: anillos, gauge, área, lollipop, embudo.

export function Ring({ value, max = 100, size = 64, stroke = 8, color = "var(--ink)", track = "var(--card2)", label, sub }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, value / max));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? value}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y={sub ? "47%" : "53%"} textAnchor="middle" dominantBaseline="middle" fontWeight="800" fontSize={size * 0.27} fill="var(--ink)" style={{ fontVariantNumeric: "tabular-nums" }}>{label ?? value}</text>
      {sub && <text x="50%" y="68%" textAnchor="middle" fontSize={size * 0.13} fill="var(--ink3)" fontWeight="600">{sub}</text>}
    </svg>
  );
}

export function Gauge({ value, size = 180, label }) {
  const w = size, h = size * 0.62, r = size * 0.4, cx = w / 2, cy = h - 8;
  const a0 = Math.PI, p = Math.max(0, Math.min(1, value / 100));
  const pt = (t) => [cx + r * Math.cos(a0 + t * Math.PI), cy + r * Math.sin(a0 + t * Math.PI)];
  const arc = (t0, t1) => { const [x0, y0] = pt(t0), [x1, y1] = pt(t1); return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`; };
  const color = value >= 70 ? "var(--hot)" : value >= 40 ? "var(--warm)" : "var(--cold)";
  const [nx, ny] = pt(p);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: size }} role="img" aria-label={`Puntaje ${value}`}>
      <path d={arc(0, 0.4)} stroke="#e7eef5" strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d={arc(0.4, 0.7)} stroke="#fff1d6" strokeWidth="14" fill="none" />
      <path d={arc(0.7, 1)} stroke="#ffe7e1" strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d={arc(0, Math.max(0.001, p))} stroke={color} strokeWidth="14" fill="none" strokeLinecap="round" />
      <circle cx={nx} cy={ny} r="9" fill="#fff" stroke={color} strokeWidth="4" />
      <text x={cx} y={cy - 16} textAnchor="middle" fontSize={size * 0.2} fontWeight="800" fill="var(--ink)">{value}</text>
      {label && <text x={cx} y={cy + 2} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink3)">{label}</text>}
    </svg>
  );
}

// Curva con área: series [{name,color,values}] sobre labels
export function AreaChart({ labels, series, height = 220, fmt = (v) => v, markers = [] }) {
  const W = 640, H = height, L = 40, R = 14, T = 14, B = 28;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(1, ...all) * 1.12;
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, labels.length - 1);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round((max / 1.12) * t));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
      {ticks.map((t, i) => (
        <g key={i}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={i ? "3 5" : ""} />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--ink3)">{fmt(t)}</text></g>
      ))}
      {labels.map((l, i) => (i % Math.ceil(labels.length / 10) === 0 || i === labels.length - 1) && (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--ink3)">{l}</text>
      ))}
      {markers.map((m, i) => (
        <g key={i}><line x1={x(m.i)} x2={x(m.i)} y1={T} y2={H - B} stroke="var(--blue)" strokeDasharray="4 4" />
          <text x={x(m.i) + 5} y={T + 10} fontSize="10.5" fontWeight="700" fill="var(--blue)">{m.label}</text></g>
      ))}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
        return (
          <g key={si}>
            {s.area !== false && <polygon points={`${x(0)},${y(0)} ${pts} ${x(s.values.length - 1)},${y(0)}`} fill={s.color} opacity={s.opacity ?? 0.12} />}
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth={s.width ?? 2.5} strokeLinejoin="round" strokeDasharray={s.dash} />
            {s.dotLast && <circle cx={x(s.values.length - 1)} cy={y(s.values[s.values.length - 1])} r="5" fill={s.color} stroke="#fff" strokeWidth="2" />}
          </g>
        );
      })}
    </svg>
  );
}

// Lollipop horizontal: items [{label,value,color,sub}]
export function Lollipop({ items, max, fmt = (v) => v, rowH = 34, labelW = 130, width = 520 }) {
  const W = width, H = items.length * rowH + 8, L = labelW, R = 60;
  const mx = max ?? Math.max(1, ...items.map((i) => Math.abs(i.value)));
  const min = Math.min(0, ...items.map((i) => i.value));
  const x = (v) => L + ((v - min) / (mx - min)) * (W - L - R);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
      {min < 0 && <line x1={x(0)} x2={x(0)} y1={0} y2={H} stroke="var(--line)" />}
      {items.map((it, i) => {
        const cy = i * rowH + rowH / 2 + 4;
        return (
          <g key={i}>
            <text x={L - 12} y={cy + 4} textAnchor="end" fontSize="12.5" fontWeight={it.bold ? 800 : 600} fill="var(--ink)">{it.label}</text>
            <line x1={x(Math.min(0, it.value))} x2={x(Math.max(0, it.value))} y1={cy} y2={cy} stroke={it.color || "var(--ink)"} strokeWidth="3" strokeLinecap="round" opacity=".35" />
            <circle cx={x(it.value)} cy={cy} r="8" fill={it.color || "var(--ink)"} />
            <text x={it.value < 0 ? x(0) + 10 : x(it.value) + 14} y={cy + 4} textAnchor="start" fontSize="12" fontWeight="700" fill="var(--ink2)" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(it.value)}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Donut con segmentos [{label,value,color}]
export function Donut({ items, size = 150, stroke = 22, center, sub }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, total = items.reduce((a, b) => a + b.value, 0) || 1;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card2)" strokeWidth={stroke} />
      {items.map((it, i) => {
        const len = (it.value / total) * c;
        const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={it.color} strokeWidth={stroke}
          strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
        acc += len; return el;
      })}
      {center != null && <text x="50%" y={sub ? "46%" : "52%"} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.19} fontWeight="800" fill="var(--ink)">{center}</text>}
      {sub && <text x="50%" y="62%" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink3)">{sub}</text>}
    </svg>
  );
}

// Embudo como píldoras escalonadas
export function Funnel({ steps }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr) 48px", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.label}</span>
          <div style={{ height: 26, background: "var(--card2)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(4, (s.value / max) * 100)}%`, height: "100%", borderRadius: 99, background: s.color || "var(--ink)", opacity: 1 - i * 0.07 }} />
          </div>
          <b className="num" style={{ textAlign: "right" }}>{s.value}</b>
        </div>
      ))}
    </div>
  );
}

export function Spark({ values, color = "var(--blue)", w = 110, h = 34 }) {
  const max = Math.max(1, ...values), min = Math.min(...values);
  const x = (i) => (i * w) / Math.max(1, values.length - 1), y = (v) => h - 3 - ((v - min) / Math.max(1, max - min)) * (h - 6);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity=".12" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3" fill={color} />
    </svg>
  );
}
