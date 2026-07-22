import { liftCoefficient, liftDragRatio, maxLiftAoa, maxLDAoa } from '../aero/aero.js';

// 配色（dataviz 技能：categorical 定序色板，深色画布档位，已用 validate_palette.js 校验
// CVD/对比度全部 PASS）：CL 用 slot1 blue，L/D 用 slot2 orange。文字统一用中性墨色，
// 颜色只承载在色块/线条上（"text wears text tokens, never the series color"）。
const CL_COLOR = '#3987e5';
const LD_COLOR = '#d95926';
const INK_MUTED = '#8791a6';   // 轴/刻度/次要文字（与全局 --text-secondary 一致）
const INK_PRIMARY = '#e8ebf1'; // 当前 α 游标（与全局 --text-primary 一致）
const AXIS_COLOR = '#334155';
const GRID_COLOR = 'rgba(148,163,184,.10)';

export function createAeroChart(canvas) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const padL = 46, padR = 12, padT = 24, padB = 52;
  const x0 = padL, x1 = W - padR, y0 = H - padB, y1 = padT;
  const AOA_MAX = 30;
  // 预采样曲线与量程
  const samples = [];
  let clMax = 0, ldMax = 0;
  for (let a = 0; a <= AOA_MAX; a += 0.5) {
    const cl = liftCoefficient(a), ld = liftDragRatio(a);
    samples.push({ a, cl, ld });
    clMax = Math.max(clMax, cl); ldMax = Math.max(ldMax, ld);
  }
  const sx = (a) => x0 + (a / AOA_MAX) * (x1 - x0);
  const syCL = (cl) => y0 - (cl / clMax) * (y0 - y1);
  const syLD = (ld) => y0 - (ld / ldMax) * (y0 - y1);

  function gridAndTicks() {
    // 横向网格 + 纵轴刻度(归一化 0/0.5/1.0)
    g.font = '11px sans-serif';
    [0, 0.5, 1].forEach((t) => {
      const Y = y0 - t * (y0 - y1);
      if (t > 0) {
        g.strokeStyle = GRID_COLOR; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x0, Y); g.lineTo(x1, Y); g.stroke();
      }
      g.fillStyle = INK_MUTED;
      const lbl = t.toFixed(1);
      g.fillText(lbl, x0 - 8 - g.measureText(lbl).width, Y + 4);
    });
    // 横轴刻度 0/10/20/30
    [0, 10, 20, 30].forEach((a) => {
      const X = sx(a);
      g.strokeStyle = AXIS_COLOR; g.lineWidth = 1;
      g.beginPath(); g.moveTo(X, y0); g.lineTo(X, y0 + 4); g.stroke();
      g.fillStyle = INK_MUTED;
      const lbl = String(a);
      g.fillText(lbl, X - g.measureText(lbl).width / 2, y0 + 16);
    });
    // 轴标题
    g.fillStyle = INK_MUTED;
    const xt = '迎角 α (°)';
    g.fillText(xt, (x0 + x1) / 2 - g.measureText(xt).width / 2, H - 6);
    g.save();
    g.translate(12, (y0 + y1) / 2);
    g.rotate(-Math.PI / 2);
    const yt = '归一化 CL · L/D';
    g.fillText(yt, -g.measureText(yt).width / 2, 0);
    g.restore();
  }

  function curve(color, sy, key) {
    g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
    samples.forEach((s, i) => { const X = sx(s.a), Y = sy(s[key]); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
    g.stroke();
  }

  function marker(a, color, label, row) {
    const X = sx(a);
    g.strokeStyle = color; g.setLineDash([3, 3]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(X, y1); g.lineTo(X, y0); g.stroke(); g.setLineDash([]);
    g.fillStyle = color; g.beginPath(); g.arc(X, y1, 2.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = INK_MUTED; g.font = '11px sans-serif';
    const labelX = Math.max(x0, Math.min(X - g.measureText(label).width / 2, x1 - g.measureText(label).width));
    g.fillText(label, labelX, y0 + row);
  }

  function legendItem(x, y, color, label) {
    g.strokeStyle = color; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + 12, y - 3); g.stroke();
    g.fillStyle = INK_PRIMARY; g.font = '11px sans-serif';
    g.fillText(label, x + 16, y);
    return x + 16 + g.measureText(label).width + 14;
  }

  function draw(aoaDeg) {
    g.clearRect(0, 0, W, H);
    // 轴
    g.strokeStyle = AXIS_COLOR; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y0); g.moveTo(x0, y0); g.lineTo(x0, y1); g.stroke();
    gridAndTicks();
    // 曲线
    curve(CL_COLOR, syCL, 'cl');
    curve(LD_COLOR, syLD, 'ld');
    // 特殊点（虚线+端点圆点，标签用中性墨色，颜色只承载在标记本身上）
    marker(maxLiftAoa(), CL_COLOR, '最大升力', 30);
    marker(maxLDAoa(), LD_COLOR, '最大升阻比', 30);
    // 当前 α 游标
    const X = sx(aoaDeg);
    g.strokeStyle = INK_PRIMARY; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(X, y1); g.lineTo(X, y0); g.stroke();
    // 图例（左）+ 当前 α 读数（右），同一行，颜色只在色块线段上
    let lx = x0;
    lx = legendItem(lx, 10, CL_COLOR, 'CL');
    legendItem(lx, 10, LD_COLOR, 'L/D');
    g.fillStyle = INK_PRIMARY; g.font = '11px sans-serif';
    const cursorLabel = `α=${aoaDeg}°`;
    g.fillText(cursorLabel, x1 - g.measureText(cursorLabel).width, 10);
  }
  return { draw };
}
