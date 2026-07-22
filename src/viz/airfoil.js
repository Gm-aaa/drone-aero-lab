import { liftCoefficient } from '../aero/aero.js';

function arrow(g, x1, y1, x2, y2, color) {
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const h = 8;
  g.beginPath();
  g.moveTo(x2, y2);
  g.lineTo(x2 - h * Math.cos(ang - 0.4), y2 - h * Math.sin(ang - 0.4));
  g.lineTo(x2 - h * Math.cos(ang + 0.4), y2 - h * Math.sin(ang + 0.4));
  g.closePath(); g.fill();
}

export function createAirfoil(canvas) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const clMax = liftCoefficient(15);
  function draw(aoaDeg) {
    g.clearRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.58;
    // 相对来流（水平从左指向翼型）
    arrow(g, 24, cy, cx - 42, cy, '#7dd3fc');
    g.fillStyle = '#7dd3fc'; g.font = '12px sans-serif';
    g.fillText('相对来流', 20, cy - 8);
    // 根/尖两站剖面：根(α+8, 深色实心) 尖(α-8, 浅色描边)
    const drawSection = (deg, fill, stroke) => {
      g.save(); g.translate(cx, cy); g.rotate(-deg * Math.PI / 180);
      g.beginPath();
      g.moveTo(-40, 0); g.quadraticCurveTo(-8, -11, 42, -2); g.quadraticCurveTo(-8, 7, -40, 0);
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); }
      g.restore();
    };
    drawSection(aoaDeg + 8, '#cbd5e1', null);   // 根：迎角大
    drawSection(aoaDeg - 8, null, '#64748b');   // 尖：迎角小
    g.fillStyle = '#94a3b8'; g.font = '11px sans-serif';
    g.fillText(`根 α+8°`, W - 70, H - 22);
    g.fillText(`尖 α−8°`, W - 70, H - 8);
    // 升力箭头（垂直向上，长度随 CL 连续，失速变橙）
    const cl = liftCoefficient(aoaDeg);
    const len = 18 + 78 * Math.max(0, Math.min(1, cl / clMax));
    arrow(g, cx, cy - 6, cx, cy - 6 - len, aoaDeg > 15 ? '#f97316' : '#22c55e');
    g.fillStyle = aoaDeg > 15 ? '#f97316' : '#22c55e';
    g.fillText('升力', cx + 8, cy - 6 - len + 6);
    // α 标注
    g.fillStyle = '#e5e7eb';
    g.fillText(`桨叶迎角 α = ${aoaDeg}°`, 8, 16);
    if (aoaDeg > 15) { g.fillStyle = '#f97316'; g.fillText('失速', W - 42, 16); }
  }
  return { draw };
}
