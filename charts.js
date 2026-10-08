// Простые SVG-графики без библиотек. Рисуются под фактическую ширину контейнера,
// чтобы подписи не масштабировались. Подсказки — по атрибутам data-tip-* (см. app.js).

const PAD = { top: 10, right: 6, bottom: 24, left: 34 };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** «Красивый» верх шкалы: 1, 2, 2.5, 5 × 10^n. */
function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
}

const fmtTick = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ","));

function frame(data, { width, height, max, ref }) {
  const top = max ?? niceMax(Math.max(ref ?? 0, ...data.map((d) => d.value ?? 0)));
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const step = innerW / data.length;
  const x = (i) => PAD.left + step * i + step / 2;
  const y = (v) => PAD.top + innerH * (1 - Math.min(v, top) / top);

  let svg = "";
  for (const t of [0, top / 2, top]) {
    svg += `<line class="grid" x1="${PAD.left}" x2="${width - PAD.right}" y1="${y(t)}" y2="${y(t)}"/>`;
    svg += `<text class="axis" x="${PAD.left - 6}" y="${y(t) + 4}" text-anchor="end">${fmtTick(t)}</text>`;
  }
  // Подписи по оси X — столько, сколько помещается без наложения
  const labelWidth = Math.max(...data.map((d) => String(d.label).length)) * 6.5 + 14;
  const every = Math.max(1, Math.ceil(labelWidth / step));
  data.forEach((d, i) => {
    if (i % every === 0 || (i === data.length - 1 && (data.length - 1) % every >= every / 2)) {
      svg += `<text class="axis" x="${x(i)}" y="${height - 6}" text-anchor="middle">${esc(d.label)}</text>`;
    }
  });
  // Зоны наведения шире самих столбцов
  const hits = data
    .map(
      (d, i) =>
        `<rect class="hit" x="${PAD.left + step * i}" y="${PAD.top}" width="${step}" height="${innerH}" rx="4"
          data-tip-title="${esc(d.tip ?? d.label)}" data-tip-value="${esc(d.tipValue ?? "")}"/>`,
    )
    .join("");
  return { svg, hits, x, y, step, top };
}

function wrap(width, height, body, label) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">${body}</svg>`;
}

/** Столбики. data: [{ label, value | null, tip, tipValue }] */
export function barChart(data, { width, height = 220, max, ref, label = "" }) {
  const f = frame(data, { width, height, max, ref });
  const w = Math.min(f.step * 0.62, 28);
  const r = Math.min(4, w / 2);
  let bars = "";
  data.forEach((d, i) => {
    if (!d.value) return;
    const x0 = f.x(i) - w / 2;
    const y0 = f.y(d.value);
    const h = f.y(0) - y0;
    const rr = Math.min(r, h);
    // скруглён только верх столбика, низ стоит на оси
    bars += `<path class="bar-mark" d="M${x0},${f.y(0)} V${y0 + rr} Q${x0},${y0} ${x0 + rr},${y0} H${x0 + w - rr} Q${x0 + w},${y0} ${x0 + w},${y0 + rr} V${f.y(0)} Z"/>`;
  });
  const refLine = ref ? `<line class="ref" x1="${PAD.left}" x2="${width - PAD.right}" y1="${f.y(ref)}" y2="${f.y(ref)}"/>` : "";
  return wrap(width, height, f.hits + f.svg + bars + refLine, label);
}

/** Накопительная линия с заливкой. data: [{ label, value, tip, tipValue }] */
export function areaChart(data, { width, height = 220, ref, label = "" }) {
  const f = frame(data, { width, height, ref });
  const pts = data.map((d, i) => [f.x(i), f.y(d.value ?? 0)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  const area = `${line} L${pts.at(-1)[0]},${f.y(0)} L${pts[0][0]},${f.y(0)} Z`;
  const last = pts.at(-1);
  const refLine = ref ? `<line class="ref" x1="${PAD.left}" x2="${width - PAD.right}" y1="${f.y(ref)}" y2="${f.y(ref)}"/>` : "";
  return wrap(
    width,
    height,
    f.hits + f.svg + `<path class="area" d="${area}"/><path class="line" d="${line}"/>` + refLine +
      `<circle class="dot" cx="${last[0]}" cy="${last[1]}" r="4.5"/>`,
    label,
  );
}
