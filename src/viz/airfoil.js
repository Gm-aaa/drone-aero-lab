import { setupHiDPICanvas } from './canvas.js';
import { bladePitchAtRadius } from '../builder/builder.js';

const BW = 420;
const BH = 260;
const COLORS = {
  text: '#f1f5f9',
  muted: '#94a3b8',
  reference: '#475569',
  blade: [191, 219, 254],
  bladeEdge: '#38bdf8',
  root: '#f59e0b',
  lift: '#22c55e',
  flow: '#22d3ee',
  warn: '#fb7185',
};

function label(g, text, x, y, color = COLORS.muted, align = 'left', font = '12px sans-serif') {
  g.fillStyle = color;
  g.font = font;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  g.fillText(text, x, y);
}

function arrow(g, x1, y1, x2, y2, color, width = 2) {
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = 8;
  g.beginPath();
  g.moveTo(x2, y2);
  g.lineTo(x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45));
  g.lineTo(x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45));
  g.closePath();
  g.fill();
}

// 简单正投影：X 为桨叶径向，Y 为弦向，Z 为升力方向。
// 弦向同时投影到屏幕横纵方向，因此桨叶绕 X 轴变距时不会被压扁到单一平面。
function project3D(origin, x, y, z) {
  return {
    x: origin.x + x + y * 0.52,
    y: origin.y - z + y * 0.24,
  };
}

function bladePoint(origin, side, radius, chord, pitchDeg, edge) {
  const pitch = pitchDeg * Math.PI / 180;
  const chordOffset = edge * chord / 2;
  return project3D(
    origin,
    side * radius,
    side * chordOffset * Math.cos(pitch),
    chordOffset * Math.sin(pitch),
  );
}

function strokePolygon(g, points, color, dash = []) {
  g.strokeStyle = color;
  g.lineWidth = 1.25;
  g.setLineDash(dash);
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  g.closePath();
  g.stroke();
  g.setLineDash([]);
}

function drawReferenceBlade(g, origin, side, rootRadius, tipRadius, rootChord, tipChord) {
  const points = [
    bladePoint(origin, side, rootRadius, rootChord, 0, -1),
    bladePoint(origin, side, tipRadius, tipChord, 0, -1),
    bladePoint(origin, side, tipRadius, tipChord, 0, 1),
    bladePoint(origin, side, rootRadius, rootChord, 0, 1),
  ];
  strokePolygon(g, points, COLORS.reference, [5, 4]);
}

function drawBlade3D(g, origin, side, aoaDeg) {
  const segments = 9;
  const rootRadius = 24;
  const tipRadius = 166;
  const rootChord = 35;
  const tipChord = 17;
  const stations = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const radius = rootRadius + (tipRadius - rootRadius) * t;
    const chord = rootChord + (tipChord - rootChord) * t;
    const pitch = bladePitchAtRadius(aoaDeg, t);
    stations.push({
      leading: bladePoint(origin, side, radius, chord, pitch, -1),
      trailing: bladePoint(origin, side, radius, chord, pitch, 1),
      radius,
      chord,
      pitch,
    });
  }

  for (let i = segments - 1; i >= 0; i--) {
    const a = stations[i];
    const b = stations[i + 1];
    const shade = 0.54 + i / segments * 0.2;
    g.fillStyle = `rgba(${COLORS.blade.join(',')},${shade})`;
    g.strokeStyle = 'rgba(56,189,248,.42)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(a.leading.x, a.leading.y);
    g.lineTo(b.leading.x, b.leading.y);
    g.lineTo(b.trailing.x, b.trailing.y);
    g.lineTo(a.trailing.x, a.trailing.y);
    g.closePath();
    g.fill();
    g.stroke();
  }

  // 前缘加粗，帮助辨认左右桨叶的点对称安装方向。
  g.strokeStyle = COLORS.bladeEdge;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(stations[0].leading.x, stations[0].leading.y);
  for (let i = 1; i < stations.length; i++) g.lineTo(stations[i].leading.x, stations[i].leading.y);
  g.stroke();

  const stationRadius = rootRadius + (tipRadius - rootRadius) * 0.75;
  const station = project3D(origin, side * stationRadius, 0, 0);
  g.fillStyle = COLORS.flow;
  g.beginPath();
  g.arc(station.x, station.y, 3.5, 0, Math.PI * 2);
  g.fill();

  return {
    root: project3D(origin, side * rootRadius, 0, 0),
    station,
    tip: project3D(origin, side * tipRadius, 0, 0),
  };
}

function drawRootEndView(g, cx, cy, pitchDeg) {
  const radius = 30;
  g.fillStyle = 'rgba(255,255,255,.025)';
  g.strokeStyle = 'rgba(255,255,255,.10)';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(cx, cy, radius + 7, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  g.strokeStyle = COLORS.reference;
  g.lineWidth = 2;
  g.setLineDash([4, 3]);
  g.beginPath();
  g.moveTo(cx - radius, cy);
  g.lineTo(cx + radius, cy);
  g.stroke();
  g.setLineDash([]);

  const angle = pitchDeg * Math.PI / 180;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  g.fillStyle = 'rgba(191,219,254,.22)';
  g.strokeStyle = COLORS.bladeEdge;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx - x, cy + y);
  g.lineTo(cx + x, cy - y);
  g.stroke();

  g.fillStyle = 'rgba(245,158,11,.18)';
  g.beginPath();
  g.moveTo(cx, cy);
  g.arc(cx, cy, 23, -angle, 0);
  g.closePath();
  g.fill();
  g.strokeStyle = COLORS.root;
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(cx, cy, 23, -angle, 0);
  g.stroke();

  g.fillStyle = COLORS.root;
  g.beginPath();
  g.arc(cx, cy, 4, 0, Math.PI * 2);
  g.fill();
  label(g, `${pitchDeg}°`, cx + 31, cy - 9, COLORS.root, 'left', 'bold 12px sans-serif');
  label(g, '沿桨根长轴看', cx, cy + 49, COLORS.text, 'center', 'bold 11px sans-serif');
}

function drawPitchReadout(g, aoaDeg, x, y) {
  label(g, `桨根  ${bladePitchAtRadius(aoaDeg, 0)}°`, x, y, COLORS.root, 'left', 'bold 12px sans-serif');
  label(g, `0.75R  ${aoaDeg}°`, x, y + 20, COLORS.flow, 'left', 'bold 12px sans-serif');
  label(g, `桨尖  ${bladePitchAtRadius(aoaDeg, 1)}°`, x, y + 40, COLORS.muted, 'left', 'bold 12px sans-serif');
}

function drawHub(g, origin, helicopter) {
  if (helicopter) {
    g.fillStyle = '#64748b';
    g.fillRect(origin.x - 5, origin.y - 4, 10, 65);
    g.fillStyle = '#e2e8f0';
    g.beginPath();
    g.arc(origin.x, origin.y, 9, 0, Math.PI * 2);
    g.fill();

    // 变距轴承、拉杆与倾斜盘。
    for (const side of [-1, 1]) {
      const rootX = origin.x + side * 24;
      g.fillStyle = COLORS.root;
      g.beginPath();
      g.arc(rootX, origin.y, 6, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = COLORS.root;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(rootX, origin.y + 6);
      g.lineTo(origin.x + side * 18, origin.y + 49);
      g.stroke();
    }
    g.fillStyle = '#475569';
    g.beginPath();
    g.ellipse(origin.x, origin.y + 54, 29, 6, 0, 0, Math.PI * 2);
    g.fill();
    label(g, '倾斜盘', origin.x, origin.y + 74, COLORS.muted, 'center', '10px sans-serif');
  } else {
    g.fillStyle = '#64748b';
    g.beginPath();
    g.ellipse(origin.x, origin.y + 3, 21, 15, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e2e8f0';
    g.beginPath();
    g.arc(origin.x, origin.y, 6, 0, Math.PI * 2);
    g.fill();
    label(g, '桨毂', origin.x, origin.y + 31, COLORS.muted, 'center', '10px sans-serif');
  }
}

function drawDiagram(g, state, helicopter) {
  const { aoaDeg, cyclicDeg = 0 } = state;
  const origin = { x: 210, y: 91 };
  const rootPitch = bladePitchAtRadius(aoaDeg, 0);

  label(
    g,
    helicopter ? '直升机：整片主桨绕桨根变距轴旋转' : '多旋翼：整片螺旋桨绕桨根长轴旋转',
    12,
    19,
    COLORS.text,
    'left',
    'bold 13px sans-serif',
  );
  if (aoaDeg > 15) label(g, '失速区', 408, 19, COLORS.warn, 'right', 'bold 12px sans-serif');

  label(g, '透视三维视图', 12, 43, COLORS.muted, 'left', '11px sans-serif');
  drawReferenceBlade(g, origin, -1, 24, 166, 35, 17);
  drawReferenceBlade(g, origin, 1, 24, 166, 35, 17);
  const left = drawBlade3D(g, origin, -1, aoaDeg);
  const right = drawBlade3D(g, origin, 1, aoaDeg);
  drawHub(g, origin, helicopter);

  label(g, '水平参考桨叶', 20, 137, COLORS.reference, 'left', '10px sans-serif');
  label(g, '当前整片桨叶', 400, 137, COLORS.bladeEdge, 'right', '10px sans-serif');
  label(g, '桨根', right.root.x + 5, right.root.y - 17, COLORS.root, 'left', 'bold 10px sans-serif');
  label(g, '0.75R', right.station.x, right.station.y - 12, COLORS.flow, 'center', 'bold 10px sans-serif');
  label(g, '桨尖', right.tip.x, right.tip.y + 17, COLORS.muted, 'center', '10px sans-serif');

  // 用虚线把三维桨根连接到轴向端视图，说明两个画面观察的是同一位置。
  g.strokeStyle = COLORS.root;
  g.lineWidth = 1;
  g.setLineDash([3, 3]);
  g.beginPath();
  g.moveTo(left.root.x, left.root.y + 7);
  g.lineTo(101, 164);
  g.stroke();
  g.setLineDash([]);
  drawRootEndView(g, 72, 190, rootPitch);

  drawPitchReadout(g, aoaDeg, 122, 177);
  if (helicopter) {
    label(g, '总距增大 → 两侧变距轴同步转动', 238, 178, COLORS.text, 'left', 'bold 11px sans-serif');
    label(g, '→ 整片主桨一起变距', 238, 200, COLORS.lift, 'left', 'bold 11px sans-serif');
    label(g, `周期变距 ${cyclicDeg}° 按旋转方位另行叠加`, 238, 222, COLORS.muted, 'left', '10.5px sans-serif');
  } else {
    label(g, 'α 增大 → 桨根绕径向轴旋转', 238, 178, COLORS.text, 'left', 'bold 11px sans-serif');
    label(g, '→ 整片桨叶同步变距', 238, 200, COLORS.lift, 'left', 'bold 11px sans-serif');
    label(g, '桨根至桨尖仍保留扭转（washout）', 238, 222, COLORS.muted, 'left', '10.5px sans-serif');
  }
  arrow(g, 364, 121, 364, 66, aoaDeg > 15 ? COLORS.warn : COLORS.lift, 2.5);
  label(g, aoaDeg > 15 ? '失速' : '升力', 375, 75, aoaDeg > 15 ? COLORS.warn : COLORS.lift, 'left', 'bold 11px sans-serif');
}

function drawMiniVtol(g, cx, cy, angleDeg, config, active, caption) {
  g.fillStyle = active ? 'rgba(56,189,248,.10)' : 'rgba(255,255,255,.018)';
  g.strokeStyle = active ? COLORS.bladeEdge : 'rgba(255,255,255,.08)';
  g.lineWidth = active ? 1.5 : 1;
  g.beginPath();
  g.roundRect(cx - 57, cy - 29, 114, 62, 8);
  g.fill();
  g.stroke();

  g.strokeStyle = active ? COLORS.text : COLORS.muted;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 28, cy + 7);
  g.lineTo(cx + 28, cy + 7);
  g.moveTo(cx - 16, cy + 1);
  g.lineTo(cx + 17, cy + 13);
  g.stroke();

  const a = angleDeg * Math.PI / 180;
  if (config === 'tiltrotor') {
    for (const x of [cx - 22, cx + 22]) {
      g.strokeStyle = COLORS.root;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(x, cy + 7);
      g.lineTo(x + Math.sin(a) * 13, cy + 7 - Math.cos(a) * 13);
      g.stroke();
      arrow(
        g,
        x + Math.sin(a) * 15,
        cy + 7 - Math.cos(a) * 15,
        x + Math.sin(a) * 29,
        cy + 7 - Math.cos(a) * 29,
        COLORS.lift,
        1.5,
      );
    }
  } else {
    const fade = 1 - 0.78 * (angleDeg / 90);
    g.save();
    g.globalAlpha = fade;
    arrow(g, cx - 21, cy + 2, cx - 21, cy - 20, COLORS.lift, 1.5);
    arrow(g, cx + 8, cy + 2, cx + 8, cy - 20, COLORS.lift, 1.5);
    g.restore();
    g.save();
    g.globalAlpha = Math.max(0.18, angleDeg / 90);
    arrow(g, cx + 24, cy + 7, cx + 45, cy + 7, COLORS.root, 1.5);
    g.restore();
  }
  label(g, caption, cx, cy + 51, active ? COLORS.text : COLORS.muted, 'center', active ? 'bold 11px sans-serif' : '11px sans-serif');
}

function drawVtolDiagram(g, state) {
  const {
    config, transitionDeg, airspeed, wingAoaDeg,
    rotorVertical, wingLift, forwardThrust, weight, safe,
  } = state;
  const phaseIndex = transitionDeg <= 10 ? 0 : transitionDeg >= 80 ? 2 : 1;
  label(
    g,
    config === 'tiltrotor' ? '倾转旋翼：推力转向，机翼接管升力' : '升力＋巡航：两套动力完成升力交接',
    12, 18, COLORS.text, 'left', 'bold 13px sans-serif',
  );
  label(g, safe ? '包线正常' : '过渡风险', 408, 18, safe ? COLORS.lift : COLORS.warn, 'right', 'bold 12px sans-serif');

  drawMiniVtol(g, 69, 58, 0, config, phaseIndex === 0, '垂直起降');
  drawMiniVtol(g, 210, 58, transitionDeg, config, phaseIndex === 1, `当前 ${transitionDeg}°`);
  drawMiniVtol(g, 351, 58, 90, config, phaseIndex === 2, '固定翼巡航');

  // 当前状态侧视图：空速、翼弦迎角、旋翼推力和机翼升力同时呈现。
  const ox = 175;
  const oy = 181;
  const wa = wingAoaDeg * Math.PI / 180;
  g.strokeStyle = COLORS.reference;
  g.setLineDash([5, 4]);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(20, oy);
  g.lineTo(402, oy);
  g.stroke();
  g.setLineDash([]);
  arrow(g, 30, oy + 18, 104, oy + 18, COLORS.flow, 2);
  label(g, `空速 ${airspeed} m/s`, 67, oy + 37, COLORS.flow, 'center', 'bold 11px sans-serif');

  g.save();
  g.translate(ox, oy);
  g.rotate(-wa);
  g.fillStyle = 'rgba(191,219,254,.22)';
  g.strokeStyle = COLORS.bladeEdge;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-55, 0);
  g.quadraticCurveTo(0, -9, 62, 0);
  g.quadraticCurveTo(0, 7, -55, 0);
  g.fill();
  g.stroke();
  g.restore();
  label(g, `机翼 αw ${wingAoaDeg}°`, ox, oy + 38, COLORS.bladeEdge, 'center', 'bold 11px sans-serif');

  const maxForce = Math.max(weight, rotorVertical + wingLift, forwardThrust, 1);
  const scale = 68 / maxForce;
  arrow(g, ox - 30, oy - 4, ox - 30, oy - 4 - rotorVertical * scale, COLORS.lift, 2.5);
  arrow(g, ox + 20, oy - 4, ox + 20, oy - 4 - wingLift * scale, '#60a5fa', 2.5);
  arrow(g, ox + 62, oy, ox + 62 + forwardThrust * scale, oy, COLORS.root, 2.5);
  label(g, `旋翼 ${rotorVertical.toFixed(0)}N`, 235, 144, COLORS.lift, 'left', '11px sans-serif');
  label(g, `机翼 ${wingLift.toFixed(0)}N`, 235, 161, '#60a5fa', 'left', '11px sans-serif');
  label(g, `推进 ${forwardThrust.toFixed(0)}N`, 235, 178, COLORS.root, 'left', '11px sans-serif');
  label(g, `重量 ${weight.toFixed(0)}N`, 235, 195, COLORS.warn, 'left', '11px sans-serif');

  const handoff = weight > 0 ? Math.max(0, Math.min(1, wingLift / weight)) : 0;
  label(g, '机翼接管比例', 235, 221, COLORS.muted, 'left', '10.5px sans-serif');
  g.fillStyle = 'rgba(255,255,255,.08)';
  g.fillRect(314, 213, 88, 9);
  g.fillStyle = safe ? '#60a5fa' : COLORS.warn;
  g.fillRect(314, 213, 88 * handoff, 9);
  label(g, `${Math.round(handoff * 100)}%`, 402, 240, safe ? COLORS.text : COLORS.warn, 'right', 'bold 11px sans-serif');
}

export function createAirfoil(canvas) {
  const { context: g, beginFrame } = setupHiDPICanvas(canvas, BW, BH);
  const title = canvas.closest?.('#airfoil-box')?.querySelector('.viz-title');

  function draw(input) {
    const state = typeof input === 'number'
      ? { category: 'multirotor', aoaDeg: input }
      : input;
    beginFrame();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (state.category === 'vtol') {
      if (title) title.textContent = '垂起固定翼过渡剖面';
      canvas.setAttribute?.('aria-label', '垂起固定翼从悬停经过过渡到固定翼巡航的推力与升力交接图');
      drawVtolDiagram(g, state);
    } else if (state.category === 'helicopter') {
      if (title) title.textContent = '主旋翼三维变距';
      canvas.setAttribute?.('aria-label', '整片主旋翼桨叶绕桨根长轴改变总距的三维与轴向双视图');
      drawDiagram(g, state, true);
    } else {
      if (title) title.textContent = '螺旋桨三维变距';
      canvas.setAttribute?.('aria-label', '整片多旋翼螺旋桨绕桨根长轴改变桨距的三维与轴向双视图');
      drawDiagram(g, state, false);
    }
  }

  return { draw };
}
