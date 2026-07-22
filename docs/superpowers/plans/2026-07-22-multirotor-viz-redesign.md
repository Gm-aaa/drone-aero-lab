# 多旋翼可视化重塑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已完成的多旋翼竖切上重塑可视化与 UI：坐标轴、桨叶迎角（含剖面图）、下洗气流、每旋翼+总升力连续图形化、专业 UI。

**Architecture:** 沿用 data→builder→aero→viz→ui 架构。新增 aero 纯函数（每旋翼升力、连续升力颜色）走 TDD；可视化重写在 viz.js/新增 viz 模块；UI 用 frontend-design 重设计。

**Tech Stack:** Vite、Three.js（含 addons）、原生 ES 模块、Vitest。剖面图用 2D Canvas。

## Global Constraints

- 纯前端静态，发布 GitHub Pages，Vite `base: '/drone-aero-lab/'`。
- 3D 全部程序化生成，不引入外部 GLTF/贴图。
- 空气动力学为教学示意级；UI 数值标注"示意值，非精确工程值"。
- UI 中文。
- 升力/颜色随参数**连续**变化，不得回到 0/1 阈值跳变。
- commit message 末尾附：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

## File Structure

- `src/aero/aero.js` / `aero.test.js` — 新增 `perRotorLift`、`liftColor`（重构 `computeLift` 复用 perRotorLift）
- `src/scene/scene.js` — `start` 增加 afterRender 回调（供角落 gizmo 在主渲染后叠加）
- `src/viz/axes.js` — 原点坐标轴 + 角落视角 gizmo（新建）
- `src/data/drones.js` — prop 部件加 `armAngleDeg`（供桨叶倾转）
- `src/builder/builder.js` — 新增 `applyBladePitch`
- `src/viz/airfoil.js` — 桨叶剖面 2D Canvas 教学图（新建）
- `src/viz/viz.js` — 重写：下洗流线 + 每旋翼/总升力箭头 + 连续色
- `src/ui/ui.js` + `index.html` — UI 重设计 + 图例 + 分组 + 升重比条 + 部件列表
- `src/main.js` — 逐任务接线

---

### Task 1: aero 新增 perRotorLift 与 liftColor（TDD）

**Files:**
- Modify: `src/aero/aero.js`
- Test: `src/aero/aero.test.js`

**Interfaces:**
- Consumes: 现有 `liftCoefficient`
- Produces:
  - `perRotorLift({ bladeSpeed, refArea, aoaDeg, airDensity })` → number（单旋翼升力）
  - `computeLift` 重构为 `rotorCount * perRotorLift(rest)`（数值不变）
  - `liftColor(lift, weight)` → `{ r, g, b }`（0..1，随升重比连续插值：红→橙→绿）

- [ ] **Step 1: 追加失败测试**

在 `src/aero/aero.test.js` 末尾追加：
```js
import { perRotorLift, liftColor } from './aero.js';

describe('perRotorLift', () => {
  it('总升力 = 旋翼数 × 单旋翼升力', () => {
    const p = { bladeSpeed: 36, refArea: 0.02, aoaDeg: 8, airDensity: 1.225 };
    const single = perRotorLift(p);
    expect(computeLift({ ...p, rotorCount: 6 })).toBeCloseTo(single * 6, 5);
  });
});

describe('liftColor', () => {
  it('升力远小于重力偏红（g 通道低）', () => {
    const c = liftColor(50, 100);
    expect(c.r).toBeGreaterThan(c.g);
  });
  it('升力远大于重力偏绿（g 通道高）', () => {
    const c = liftColor(130, 100);
    expect(c.g).toBeGreaterThan(c.r);
  });
  it('g 通道随升重比单调不减（连续过渡）', () => {
    const g = (ratio) => liftColor(ratio * 100, 100).g;
    expect(g(0.9)).toBeGreaterThanOrEqual(g(0.7));
    expect(g(1.1)).toBeGreaterThanOrEqual(g(0.9));
  });
  it('相近升力颜色相近（无跳变）', () => {
    const a = liftColor(99, 100), b = liftColor(101, 100);
    expect(Math.abs(a.g - b.g)).toBeLessThan(0.15);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test`
Expected: FAIL，`perRotorLift`/`liftColor` 未定义。

- [ ] **Step 3: 实现**

在 `src/aero/aero.js`，把 `computeLift` 替换为下面两个函数（保持其余不变）：
```js
export function perRotorLift({ bladeSpeed, refArea, aoaDeg, airDensity }) {
  const cl = liftCoefficient(aoaDeg);
  return 0.5 * airDensity * bladeSpeed * bladeSpeed * refArea * cl;
}

export function computeLift({ rotorCount, bladeSpeed, refArea, aoaDeg, airDensity }) {
  return rotorCount * perRotorLift({ bladeSpeed, refArea, aoaDeg, airDensity });
}
```
在文件末尾追加：
```js
export function liftColor(lift, weight) {
  const ratio = weight > 0 ? lift / weight : 0;
  const t = Math.max(0, Math.min(1, (ratio - 0.8) / 0.4));
  const red = { r: 0.94, g: 0.27, b: 0.27 };
  const orange = { r: 0.98, g: 0.62, b: 0.15 };
  const green = { r: 0.13, g: 0.77, b: 0.37 };
  const lerp = (a, b, u) => ({ r: a.r + (b.r - a.r) * u, g: a.g + (b.g - a.g) * u, b: a.b + (b.b - a.b) * u });
  return t < 0.5 ? lerp(red, orange, t / 0.5) : lerp(orange, green, (t - 0.5) / 0.5);
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test`
Expected: PASS（原有 + 新增全绿）。

- [ ] **Step 5: 提交**

```bash
git add src/aero/aero.js src/aero/aero.test.js
git commit -m "feat(aero): 新增 perRotorLift 与连续 liftColor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 坐标轴 + 角落视角 gizmo

**Files:**
- Create: `src/viz/axes.js`
- Modify: `src/scene/scene.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: scene、renderer、camera
- Produces:
  - `createAxes(scene)` — 原点加带 X / Y↑ / Z 文字标注的坐标轴。
  - `createGizmo(renderer, mainCamera)` → `{ render() }`，在右下角用 scissor 视口叠加一个跟随主相机朝向的小三轴。
  - `scene.start(renderCb, afterRenderCb)` — 新增第二个回调，在主渲染**之后**调用（供 gizmo 叠加）。

- [ ] **Step 1: scene.js 的 start 增加 afterRender 回调**

在 `src/scene/scene.js` 把 `start` 函数替换为：
```js
  function start(renderCb, afterRenderCb) {
    function loop() {
      requestAnimationFrame(loop);
      controls.update();
      if (renderCb) renderCb();
      renderer.render(scene, camera);
      if (afterRenderCb) afterRenderCb();
    }
    loop();
  }
```

- [ ] **Step 2: 写 axes.js**

Create `src/viz/axes.js`:
```js
import * as THREE from 'three';

function labelSprite(text, cssColor) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = cssColor;
  g.font = 'bold 40px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 32);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  spr.scale.set(0.35, 0.18, 1);
  return spr;
}

export function createAxes(scene) {
  const group = new THREE.Group();
  const L = 1.2;
  const axis = (dir, color) =>
    group.add(new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), L, color, 0.12, 0.07));
  axis(new THREE.Vector3(1, 0, 0), 0xef4444);
  axis(new THREE.Vector3(0, 1, 0), 0x22c55e);
  axis(new THREE.Vector3(0, 0, 1), 0x3b82f6);
  const xl = labelSprite('X', '#ef4444'); xl.position.set(L + 0.18, 0, 0);
  const yl = labelSprite('Y↑', '#22c55e'); yl.position.set(0, L + 0.18, 0);
  const zl = labelSprite('Z', '#3b82f6'); zl.position.set(0, 0, L + 0.18);
  group.add(xl, yl, zl);
  scene.add(group);
  return group;
}

export function createGizmo(renderer, mainCamera) {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10);
  const axis = (dir, color) =>
    scene.add(new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), 1, color, 0.28, 0.16));
  axis(new THREE.Vector3(1, 0, 0), 0xef4444);
  axis(new THREE.Vector3(0, 1, 0), 0x22c55e);
  axis(new THREE.Vector3(0, 0, 1), 0x3b82f6);
  const SIZE = 110, PAD = 12;
  const sz = new THREE.Vector2();
  function render() {
    renderer.getSize(sz);
    cam.position.set(0, 0, 4).applyQuaternion(mainCamera.quaternion);
    cam.quaternion.copy(mainCamera.quaternion);
    renderer.setScissorTest(true);
    renderer.setViewport(sz.x - SIZE - PAD, PAD, SIZE, SIZE);
    renderer.setScissor(sz.x - SIZE - PAD, PAD, SIZE, SIZE);
    renderer.clearDepth();
    renderer.render(scene, cam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, sz.x, sz.y);
  }
  return { render };
}
```

- [ ] **Step 3: main.js 接入 axes + gizmo**

在 `src/main.js` 顶部 import 区加：
```js
import { createAxes, createGizmo } from './viz/axes.js';
```
在 `const viz = createViz(ctx.scene);` 之后加：
```js
createAxes(ctx.scene);
const gizmo = createGizmo(ctx.renderer, ctx.camera);
```
把文件末尾的 `ctx.start(() => { ... viz.tick ... });` 改为传入第二个回调：
```js
let last = performance.now();
ctx.start(
  () => { const now = performance.now(); viz.tick((now - last) / 1000); last = now; },
  () => gizmo.render(),
);
```

- [ ] **Step 4: 验证**

Run: `npm run build` （必须成功）；`npm test`（14+ 全过）。
Expected: 构建通过、测试通过。控制器做浏览器视觉确认（原点三色轴 + 右下角跟随视角的小三轴）。

- [ ] **Step 5: 提交**

```bash
git add src/viz/axes.js src/scene/scene.js src/main.js
git commit -m "feat(viz): 原点坐标轴 + 角落视角 gizmo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 桨叶迎角实际倾转

**Files:**
- Modify: `src/data/drones.js`
- Modify: `src/builder/builder.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `buildSubtypeParts`
- Produces:
  - prop 部件数据新增 `armAngleDeg`（该桨所在机臂角度）。
  - `applyBladePitch(meshes, subtype, aoaDeg)` — 每片桨绕其机臂径向轴倾转 α 角。

- [ ] **Step 1: drones.js 给 prop 加 armAngleDeg**

在 `src/data/drones.js` 的 `buildSubtypeParts` 内，prop 部件对象里加一个字段（其余不变）：
```js
    parts.push({
      id: `prop${i}`, name: i % 2 === 0 ? '螺旋桨（正桨 CW）' : '螺旋桨（反桨 CCW）',
      desc: '相邻电机正反桨交替，抵消反扭矩以保持偏航稳定。',
      geometry: { type: 'box', args: [0.42, 0.006, 0.03] },
      position: [ax, 0.09, az], materialRole: 'fixed', color: 0xcbd5e1,
      spin: i % 2 === 0 ? 'cw' : 'ccw',
      armAngleDeg: arm.angleDeg,
    });
```

- [ ] **Step 2: builder.js 新增 applyBladePitch**

在 `src/builder/builder.js` 追加（`THREE` 已导入）：
```js
export function applyBladePitch(meshes, subtype, aoaDeg) {
  const a = aoaDeg * Math.PI / 180;
  for (const part of buildSubtypeParts(subtype)) {
    if (part.id.startsWith('prop') && meshes[part.id]) {
      const rad = part.armAngleDeg * Math.PI / 180;
      const axis = new THREE.Vector3(Math.cos(rad), 0, Math.sin(rad)).normalize();
      meshes[part.id].setRotationFromAxisAngle(axis, a);
    }
  }
}
```

- [ ] **Step 3: main.js 在 recompute 里应用桨距**

在 `src/main.js` 的 builder import 补上 `applyBladePitch`：
```js
import { buildDrone, DRONES, applyMaterial, highlightPart, applyBladePitch } from './builder/builder.js';
```
在 `recompute()` 内 `applyMaterial(...)` 之后加一行：
```js
  applyBladePitch(current.meshes, subtype, s.aoaDeg);
```

- [ ] **Step 4: 验证**

Run: `npm run build`（成功）；`npm test`（全过）。
Expected: 构建/测试通过。控制器浏览器确认拖动迎角滑块时桨叶可见倾转。

- [ ] **Step 5: 提交**

```bash
git add src/data/drones.js src/builder/builder.js src/main.js
git commit -m "feat: 桨叶随迎角实际倾转（迎角=桨叶迎角）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 桨叶剖面教学图（2D Canvas）

**Files:**
- Create: `src/viz/airfoil.js`
- Modify: `index.html`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `liftCoefficient`（from aero）
- Produces:
  - `createAirfoil(canvas)` → `{ draw(aoaDeg) }`：绘制翼型剖面（随 α 倾转）+ 相对来流箭头 + 升力箭头（长度随 CL 连续、失速变橙）+ α 数值标注。

- [ ] **Step 1: index.html 加剖面容器**

在 `index.html` 的 `<div id="panel"></div>` 之后加：
```html
    <div id="airfoil-box" style="position:fixed;left:12px;bottom:12px;background:rgba(20,22,28,.9);
         border-radius:10px;padding:8px;backdrop-filter:blur(6px)">
      <div style="color:#cbd5e1;font-size:12px;margin:2px 4px 6px">桨叶剖面（迎角示意）</div>
      <canvas id="airfoil" width="240" height="150"></canvas>
    </div>
```

- [ ] **Step 2: 写 airfoil.js**

Create `src/viz/airfoil.js`:
```js
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
    // 翼型剖面（随迎角倾转，屏幕 y 向下，故取负角）
    g.save();
    g.translate(cx, cy);
    g.rotate(-aoaDeg * Math.PI / 180);
    g.fillStyle = '#cbd5e1';
    g.beginPath();
    g.moveTo(-40, 0);
    g.quadraticCurveTo(-8, -11, 42, -2);
    g.quadraticCurveTo(-8, 7, -40, 0);
    g.fill();
    g.strokeStyle = 'rgba(148,163,184,.6)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-40, 0); g.lineTo(42, -1); g.stroke(); // 弦线
    g.restore();
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
```

- [ ] **Step 3: main.js 接剖面图**

在 `src/main.js` import 区加：
```js
import { createAirfoil } from './viz/airfoil.js';
```
在 `const panel = ...` 附近加：
```js
const airfoil = createAirfoil(document.getElementById('airfoil'));
```
在 `recompute()` 内追加一行（用当前迎角）：
```js
  airfoil.draw(s.aoaDeg);
```

- [ ] **Step 4: 验证**

Run: `npm run build`（成功）；`npm test`（全过）。
Expected: 通过。控制器浏览器确认左下角剖面图随迎角滑块联动（翼型转、升力箭头伸缩、失速标注）。

- [ ] **Step 5: 提交**

```bash
git add src/viz/airfoil.js index.html src/main.js
git commit -m "feat(viz): 桨叶剖面教学图（迎角/来流/升力矢量，2D Canvas）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 重写 viz.js —— 下洗流线 + 每旋翼/总升力箭头 + 连续色

**Files:**
- Modify: `src/viz/viz.js`（整体重写）
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `liftColor`（from aero）
- Produces:
  - `createViz(scene)` → `{ setRotors(rotors), update(state), tick(dt) }`
  - `setRotors(rotors)`：`rotors = [{ x, z }]`，重建每旋翼升力箭头与该旋翼的下洗粒子束。
  - `update({ perLift:[N], totalLift, weight, wind:{x,z} })`：每旋翼箭头长度∝perLift[i]、颜色=liftColor(perLift[i], weight/N)；中心总升力箭头长度∝totalLift、色=liftColor(totalLift,weight)；红色重力箭头长度∝weight；青色风箭头；记录下洗强度∝totalLift。
  - `tick(dt)`：下洗粒子沿"上方吸入→穿过桨盘→向下成柱"路径运动并被风平流，循环复位。

- [ ] **Step 1: 重写 viz.js**

用以下内容整体替换 `src/viz/viz.js`：
```js
import * as THREE from 'three';
import { liftColor } from '../aero/aero.js';

const PER_ROTOR_PARTICLES = 26;
const ROTOR_Y = 0.09;      // 桨盘高度（与建造器 prop 高度一致）
const INTAKE_H = 0.45;     // 桨盘上方吸入高度
const DOWN_H = 0.9;        // 下洗柱向下延伸

function toColor(c) { return new THREE.Color(c.r, c.g, c.b); }

export function createViz(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // 全局矢量：总升力（中心）、重力、风
  const totalLift = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, ROTOR_Y, 0), 1, 0x22c55e, 0.18, 0.11);
  const gravity = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, ROTOR_Y, 0), 1, 0xef4444, 0.15, 0.09);
  const wind = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1.4, 0.5, 0), 1, 0x22d3ee, 0.15, 0.09);
  root.add(totalLift, gravity, wind);

  // 每旋翼动态部分
  let rotors = [];
  let rotorArrows = [];
  let flow = null;          // { points, geo, seed, rotorOf }
  let windVec = { x: 0, z: 0 };
  let downStrength = 0.5;   // 0..1，随总升力

  function clearRotors() {
    for (const a of rotorArrows) root.remove(a);
    rotorArrows = [];
    if (flow) { root.remove(flow.points); flow.geo.dispose(); flow.points.material.dispose(); flow = null; }
  }

  function setRotors(rs) {
    clearRotors();
    rotors = rs;
    // 每旋翼升力箭头
    for (const r of rotors) {
      const a = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(r.x, ROTOR_Y + 0.06, r.z), 0.4, 0x22c55e, 0.1, 0.06);
      rotorArrows.push(a); root.add(a);
    }
    // 下洗粒子束（每旋翼一列）
    const N = rotors.length * PER_ROTOR_PARTICLES;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);   // 相位 0..1
    const rotorOf = new Int16Array(N);
    let k = 0;
    for (let ri = 0; ri < rotors.length; ri++) {
      for (let j = 0; j < PER_ROTOR_PARTICLES; j++) {
        seed[k] = Math.random();
        rotorOf[k] = ri;
        writeParticle(pos, k, rotors[ri], seed[k]);
        k++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x7dd3fc, size: 0.025, transparent: true, opacity: 0.85 }));
    root.add(points);
    flow = { points, geo, seed, rotorOf };
  }

  // 相位 phase(0..1)：0=桨盘上方吸入口，经桨盘，1=下洗柱底部
  function writeParticle(arr, i, rotor, phase) {
    const jitter = (i % 7 - 3) * 0.012;
    let x = rotor.x, y, z = rotor.z + jitter;
    if (phase < 0.35) {
      // 上方吸入：从外侧上方收拢到桨盘中心
      const t = phase / 0.35;
      y = ROTOR_Y + INTAKE_H * (1 - t);
      x = rotor.x + (1 - t) * jitter * 6;
    } else {
      // 桨盘下方：向下成柱 + 轻微外扩 + 风平流
      const t = (phase - 0.35) / 0.65;
      y = ROTOR_Y - DOWN_H * t;
      x = rotor.x + jitter * (1 + t * 1.5) + windVec.x * 0.05 * t;
      z = rotor.z + jitter * (1 + t * 1.5) + windVec.z * 0.05 * t;
    }
    arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
  }

  function update(s) {
    const N = rotors.length || 1;
    const wShare = s.weight / N;
    for (let i = 0; i < rotorArrows.length; i++) {
      const lift = s.perLift[i] ?? 0;
      const len = Math.max(0.05, Math.min(1.2, lift / 120));
      rotorArrows[i].setLength(len, 0.1, 0.06);
      rotorArrows[i].setColor(toColor(liftColor(lift, wShare)));
    }
    totalLift.setLength(Math.max(0.1, Math.min(2.4, s.totalLift / 120)), 0.18, 0.11);
    totalLift.setColor(toColor(liftColor(s.totalLift, s.weight)));
    gravity.setLength(Math.max(0.1, Math.min(2.4, s.weight / 120)), 0.15, 0.09);
    const wlen = Math.hypot(s.wind.x, s.wind.z);
    wind.visible = wlen > 0.01;
    if (wlen > 0.01) {
      wind.setDirection(new THREE.Vector3(s.wind.x, 0, s.wind.z).normalize());
      wind.setLength(Math.min(2, 0.3 + wlen / 15), 0.15, 0.09);
    }
    windVec = s.wind;
    downStrength = Math.max(0.25, Math.min(1.4, s.totalLift / (s.weight || 1)));
  }

  function tick(dt) {
    if (!flow) return;
    const arr = flow.geo.attributes.position.array;
    for (let i = 0; i < flow.seed.length; i++) {
      flow.seed[i] += dt * 0.35 * downStrength;
      if (flow.seed[i] > 1) flow.seed[i] -= 1;
      writeParticle(arr, i, rotors[flow.rotorOf[i]], flow.seed[i]);
    }
    flow.geo.attributes.position.needsUpdate = true;
  }

  return { setRotors, update, tick };
}
```

- [ ] **Step 2: main.js 计算每旋翼升力/旋翼位置并接入**

在 `src/main.js` aero import 补上 `perRotorLift`：
```js
import { computeLift, computeWeight, liftStatus, windVector, MATERIALS, perRotorLift } from './aero/aero.js';
```
在 builder import 补上 `buildSubtypeParts`：
```js
import { buildDrone, DRONES, applyMaterial, highlightPart, applyBladePitch, buildSubtypeParts } from './builder/builder.js';
```
> 注：`buildSubtypeParts` 目前经 builder.js 的 `export { DRONES }` 未导出，需在 builder.js 增加 `export { buildSubtypeParts };`（与 DRONES 并列）。若已导出则忽略。

在 `rebuild()` 末尾（`ctx.scene.add(current.group);` 之后）加：设置旋翼位置。
```js
  const rotors = buildSubtypeParts(subtype)
    .filter((p) => p.id.startsWith('motor'))
    .map((p) => ({ x: p.position[0], z: p.position[2] }));
  viz.setRotors(rotors);
```
把 `recompute()` 改为计算每旋翼升力并传新结构：
```js
function recompute() {
  const s = state.get();
  applyMaterial(current.meshes, subtype, s.materialId);
  applyBladePitch(current.meshes, subtype, s.aoaDeg);
  const aeroP = { bladeSpeed: 36, refArea: 0.02, aoaDeg: s.aoaDeg, airDensity: 1.225 };
  const single = perRotorLift(aeroP);
  const perLift = Array.from({ length: subtype.rotorCount }, () => single);
  const totalLift = single * subtype.rotorCount;
  const weight = computeWeight({ bodyVolume: 6, materialId: s.materialId });
  const status = liftStatus(totalLift, weight);
  viz.update({ perLift, totalLift, weight, wind: windVector(s.windSpeed, s.windDirDeg) });
  renderReadout(panel.querySelector('#readout'), { lift: totalLift, weight, status, material: MATERIALS[s.materialId] });
  airfoil.draw(s.aoaDeg);
}
```
> 说明：现有 `computeLift`、`liftStatus` 仍用于状态文字；`viz.update` 不再接收 status，颜色由 viz 内 `liftColor` 连续决定。确保 `rebuild()` 在首次 `recompute()` 前调用（顺序不变）。

- [ ] **Step 3: 验证**

Run: `npm run build`（成功）；`npm test`（全过）。
Expected: 通过。控制器浏览器确认：每桨上方一支升力箭头（长度/颜色随参数连续变化）、中心总升力箭头 vs 红重力箭头、下洗气流成柱向下并随风偏斜（不再是随机雪点）。

- [ ] **Step 4: 提交**

```bash
git add src/viz/viz.js src/builder/builder.js src/main.js
git commit -m "feat(viz): 下洗流线 + 每旋翼/总升力箭头 + 连续升力色

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: UI 重设计（分组 / 图例 / 升重比条 / 部件列表）

**Files:**
- Modify: `src/ui/ui.js`（重写）
- Modify: `index.html`（面板样式）
- Modify: `src/main.js`（部件高亮联动）

**Interfaces:**
- Consumes: `DRONES`、`MATERIALS`、`buildSubtypeParts`
- Produces:
  - `createUI(panel, { state, onSubtypeChange })` — 分组面板：① 机型（多旋翼固定标签 + 子类下拉）② 飞行参数（桨叶迎角 α / 风速 / 风向 / 材料，滑块就近显示当前值+单位）③ 图例（升力绿/重力红/风青/下洗蓝、Y↑=升力方向、失速色变）④ 实时读数（总升力、重量、升重比水平条）⑤ 部件说明。
  - `renderReadout(el, { lift, weight, status, material })` — 含升重比连续水平条。
  - `renderPartInfo(el, part)` — 不变签名。
  - `renderPartList(el, parts, selectedId, onSelect)` — 部件列表，选中项高亮，点击回调。

**先用 frontend-design 技能定视觉方向（配色、层次、排版、卡片），再实现下面结构。** 具体配色/圆角/间距由 frontend-design 决定；下面代码给出结构与必须包含的内容，样式可按 frontend-design 结论调整，但必须：中文、分区标题、图例齐全、滑块就近显示值、升重比连续条。

- [ ] **Step 0: 加载 frontend-design 技能**

调用 frontend-design 技能获取视觉方向，据其调整下面的配色与样式细节（保持结构与内容不变）。

- [ ] **Step 1: index.html 面板容器样式微调**

把 `#panel` 的样式改为更适合分组（可按 frontend-design 结论调整数值）：
```css
      #panel {
        position: fixed; top: 0; right: 0; width: 340px; height: 100%;
        background: rgba(17,19,24,.94); color: #e5e7eb; padding: 18px 16px;
        overflow-y: auto; font-size: 13px; line-height: 1.5; backdrop-filter: blur(8px);
      }
```

- [ ] **Step 2: 重写 ui.js**

用以下内容整体替换 `src/ui/ui.js`（样式细节可按 frontend-design 结论优化）：
```js
import { DRONES } from '../data/drones.js';
import { MATERIALS } from '../aero/aero.js';

const section = (title, body) => `
  <div style="margin:0 0 16px">
    <div style="font-size:12px;letter-spacing:.05em;color:#94a3b8;text-transform:uppercase;margin-bottom:8px">${title}</div>
    ${body}
  </div>`;

function slider(label, id, min, max, val, step, unit) {
  return `<label style="display:block;margin:10px 0">
    <span style="display:flex;justify-content:space-between">
      <span>${label}</span><span id="${id}-v" style="color:#38bdf8;font-variant-numeric:tabular-nums">${val}${unit}</span>
    </span>
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" style="width:100%">
  </label>`;
}

const legendRow = (color, text) =>
  `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
     <span style="width:14px;height:14px;border-radius:3px;background:${color};display:inline-block"></span>${text}</div>`;

export function createUI(panel, { state, onSubtypeChange }) {
  const s = state.get();
  const subs = DRONES.multirotor.subtypes;
  panel.innerHTML = `
    <h2 style="font-size:18px;margin-bottom:2px">无人机空气动力学实验室</h2>
    <div style="color:#64748b;font-size:12px;margin-bottom:16px">多旋翼 · 示意值，非精确工程值</div>

    ${section('机型', `
      <div style="margin-bottom:8px">分类：<b>多旋翼</b></div>
      <label>子类
        <select id="subtype" style="width:100%;margin-top:4px">
          ${Object.entries(subs).map(([k, v]) => `<option value="${k}" ${k === s.subtype ? 'selected' : ''}>${v.name}</option>`).join('')}
        </select></label>`)}

    ${section('飞行参数', `
      ${slider('桨叶迎角 α', 'aoa', 0, 30, s.aoaDeg, 1, '°')}
      ${slider('风速', 'wind', 0, 15, s.windSpeed, 0.5, ' m/s')}
      ${slider('风向', 'wdir', 0, 360, s.windDirDeg, 5, '°')}
      <label style="display:block;margin-top:10px">材料
        <select id="material" style="width:100%;margin-top:4px">
          ${Object.values(MATERIALS).map((m) => `<option value="${m.id}" ${m.id === s.materialId ? 'selected' : ''}>${m.name}</option>`).join('')}
        </select></label>`)}

    ${section('图例', `
      ${legendRow('#22c55e', '升力（绿，向上；越长越大）')}
      ${legendRow('#ef4444', '重力（红，向下）')}
      ${legendRow('#22d3ee', '风')}
      ${legendRow('#7dd3fc', '下洗气流')}
      <div style="color:#94a3b8;margin-top:6px">坐标轴 Y↑ = 升力方向；升力色由绿→橙→红表示裕度下降/失速。</div>`)}

    ${section('实时读数', `<div id="readout"></div>`)}

    ${section('部件', `<div id="partlist"></div><div id="partinfo" style="margin-top:8px;color:#94a3b8">点击部件查看说明</div>`)}
  `;

  panel.querySelector('#subtype').onchange = (e) => { state.set({ subtype: e.target.value }); onSubtypeChange(); };
  const bind = (id, key) => {
    const el = panel.querySelector(`#${id}`);
    const unit = el.parentElement.querySelector(`#${id}-v`).textContent.replace(/[\d.]/g, '');
    el.oninput = () => {
      panel.querySelector(`#${id}-v`).textContent = el.value + unit;
      state.set({ [key]: Number(el.value) });
    };
  };
  bind('aoa', 'aoaDeg');
  bind('wind', 'windSpeed');
  bind('wdir', 'windDirDeg');
  panel.querySelector('#material').onchange = (e) => state.set({ materialId: e.target.value });
}

export function renderReadout(el, { lift, weight, status, material }) {
  const label = { climb: '爬升 ▲', hover: '悬停 ●', stall: '升力不足 ▼' }[status];
  const ratio = weight > 0 ? lift / weight : 0;
  const pct = Math.max(0, Math.min(100, (ratio / 1.5) * 100));
  const barColor = ratio >= 1 ? '#22c55e' : ratio >= 0.9 ? '#f59e0b' : '#ef4444';
  el.innerHTML = `
    <div>总升力：<b>${lift.toFixed(0)}</b> N（示意）</div>
    <div>重量：<b>${weight.toFixed(0)}</b> N（示意）</div>
    <div style="margin:6px 0">状态：<b>${label}</b></div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:4px">升重比 ${ratio.toFixed(2)}</div>
    <div style="height:10px;background:#1e293b;border-radius:5px;overflow:hidden;position:relative">
      <div style="height:100%;width:${pct}%;background:${barColor};transition:width .1s"></div>
      <div style="position:absolute;left:66.6%;top:0;bottom:0;width:2px;background:#e5e7eb" title="升重比=1"></div>
    </div>
    <div style="margin-top:8px;font-size:12px;color:#94a3b8">${material.name} 适用：${material.useCase}</div>`;
}

export function renderPartInfo(el, part) {
  el.innerHTML = part
    ? `<div style="font-weight:600;color:#e5e7eb">${part.name}</div><div style="margin-top:4px">${part.desc}</div>`
    : `<div style="color:#94a3b8">点击部件查看说明</div>`;
}

export function renderPartList(el, parts, selectedId, onSelect) {
  // 按 name 去重，展示唯一部件类型
  const seen = new Map();
  for (const p of parts) if (!seen.has(p.name)) seen.set(p.name, p);
  el.innerHTML = [...seen.values()].map((p) =>
    `<button data-id="${p.id}" style="display:block;width:100%;text-align:left;margin:2px 0;padding:5px 8px;
      border:none;border-radius:6px;cursor:pointer;font-size:12px;
      background:${p.id === selectedId ? '#2563eb' : '#1e293b'};color:#e5e7eb">${p.name}</button>`).join('');
  el.querySelectorAll('button').forEach((b) => { b.onclick = () => onSelect(b.dataset.id); });
}
```

- [ ] **Step 3: main.js 接入部件列表与高亮联动**

在 `src/main.js` ui import 补上 `renderPartList`：
```js
import { createUI, renderReadout, renderPartInfo, renderPartList } from './ui/ui.js';
```
新增一个选中部件并联动高亮/列表的函数（放在 `createUI(...)` 之后）：
```js
let selectedPartId = null;
function selectPart(partId) {
  selectedPartId = partId;
  const part = current.meshes[partId]?.userData.part;
  highlightPart(current.meshes, partId);
  renderPartInfo(panel.querySelector('#partinfo'), part);
  renderPartList(panel.querySelector('#partlist'), buildSubtypeParts(subtype), partId, selectPart);
}
```
在 `rebuild()` 之后、`createUI` 之后，初始渲染部件列表：
```js
renderPartList(panel.querySelector('#partlist'), buildSubtypeParts(subtype), selectedPartId, selectPart);
```
把 raycaster 命中处理改为调用 `selectPart`：
```js
  if (hits.length) {
    selectPart(hits[0].object.userData.part.id);
  }
```
子类切换时（`onSubtypeChange`）在 `rebuild(); recompute();` 后补一行重渲染列表：
```js
onSubtypeChange: () => { rebuild(); recompute(); renderPartList(panel.querySelector('#partlist'), buildSubtypeParts(subtype), selectedPartId, selectPart); },
```

- [ ] **Step 4: 验证**

Run: `npm run build`（成功）；`npm test`（全过）。
Expected: 通过。控制器浏览器确认：面板分组清晰、图例齐全、滑块就近显示值+单位、升重比条随参数连续移动、点击 3D 部件或列表项两侧联动高亮。

- [ ] **Step 5: 提交**

```bash
git add src/ui/ui.js index.html src/main.js
git commit -m "feat(ui): 分组面板 + 图例 + 升重比条 + 部件列表联动（frontend-design）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 自查（Self-Review）

- **Spec 覆盖**：坐标轴+gizmo→T2；桨叶迎角(倾转+剖面图)→T3/T4；下洗气流→T5；每旋翼+总升力连续箭头+连续色→T1/T5；UI 分组/图例/升重比条/部件列表→T6；aero 新函数 TDD→T1。全部有任务。
- **占位符**：无 TODO/TBD；每个代码步骤含完整代码（T6 样式细节明确交由 frontend-design 调整，但结构/内容完整）。
- **类型一致**：`perRotorLift(rest)`/`computeLift({rotorCount,...})`、`liftColor→{r,g,b}`、`viz.setRotors([{x,z}])`、`viz.update({perLift,totalLift,weight,wind})`、`applyBladePitch(meshes,subtype,aoaDeg)`、`createAirfoil(canvas).draw(aoaDeg)`、`renderPartList(el,parts,selectedId,onSelect)`、`scene.start(renderCb, afterRenderCb)` 在各任务间一致。
- **依赖顺序**：T5 依赖 T1（perRotorLift/liftColor）；T3 需 T3-Step1 的 armAngleDeg；T5 需 builder 导出 buildSubtypeParts（T5-Step2 已注明补 export）。T2/T3/T4 相互独立。main.js 由多任务顺序修改，无并发。
