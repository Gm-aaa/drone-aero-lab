# 物理保真度增强轮 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提升多旋翼空气动力学保真度：桨叶扭转(washout)、动态阻力+升阻比、三维风与起飞耦合、特殊工作点曲线、Z-up 坐标系。

**Architecture:** 沿用 data→builder→aero→viz→ui。新增/改动 aero 纯函数走 TDD；桨叶用扭转几何；场景改 Z-up(内容组旋转)；新增曲线图与垂直气流参数。

**Tech Stack:** Vite、Three.js、原生 ES 模块、Vitest、2D Canvas。

## Global Constraints

- 纯前端静态，Vite `base: '/drone-aero-lab/'`；3D 程序化生成；教学示意级(标注示意值)；UI 中文。
- 升力/颜色/阻力随参数连续变化(非 0/1)。
- 坐标系 Z-up：X-Y 水平面、Z 竖直(升力方向)。
- 桨叶迎角 α = 0.75R 参考站；洗出 Δ=8°(根 α+Δ、尖 α−Δ)。
- 阻力 CD=CD0+k·CL²(CD0=0.02,k=0.06)；升阻比 L/D=CL/CD。
- 默认(碳纤维/α8/无风)净升力≈重量(刚好能飞)。
- commit 末尾附：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

## File Structure

- `src/aero/aero.js` / `aero.test.js` — drag/CD、L/D、三维风净升力/倾角、特殊点(TDD)
- `src/builder/builder.js` — `makeTwistedBlade` + `applyBladeTwist`(替换 applyBladePitch)
- `src/data/drones.js` — prop 几何改 `{type:'blade'}`
- `src/scene/scene.js` — Z-up：content 组 + 相机 up + 网格 XY
- `src/viz/axes.js` — Z-up 标注(X/Y 水平、Z↑ 竖直) + gizmo
- `src/viz/viz.js` — 有效升力配色 + 三维风箭头 + 下洗垂直分量
- `src/viz/airfoil.js` — 根/尖两站剖面
- `src/viz/aerochart.js` — CL/(L-D)-α 曲线 + 特殊点(新建, dataviz)
- `index.html` — 曲线图容器
- `src/ui/ui.js` — 垂直气流滑块 + 读数(有效升力/阻力/LD/倾角/净升重比/特殊点) + 图例
- `src/main.js` — 逐任务接线；机身抗风倾斜；标定 BODY_VOLUME

---

### Task 1: aero 扩展 —— 阻力/升阻比/三维风净升力/特殊点（TDD）

**Files:**
- Modify: `src/aero/aero.js`
- Test: `src/aero/aero.test.js`

**Interfaces (later tasks depend — keep EXACT):**
- `dragCoefficient(aoaDeg)` → number
- `liftDragRatio(aoaDeg)` → number
- `computeDrag({ rotorCount, bladeSpeed, refArea, aoaDeg, airDensity })` → number
- `horizontalWindDrag(windSpeed, airDensity)` → number
- `verticalWindForce(updraft, airDensity)` → number（符号随 updraft）
- `windTilt({ dragForce, weight })` → number（弧度）
- `netLift({ totalLift, weight, windSpeed, updraft, airDensity })` → `{ effectiveLift, tiltDeg, drag, status }`
- `maxLiftAoa()` → 15
- `maxLDAoa()` → number（整数度）

- [ ] **Step 1: 追加失败测试**

在 `src/aero/aero.test.js` 末尾追加：
```js
import {
  dragCoefficient, liftDragRatio, computeDrag, horizontalWindDrag,
  verticalWindForce, windTilt, netLift, maxLiftAoa, maxLDAoa,
} from './aero.js';

describe('dragCoefficient', () => {
  it('迎角越大阻力系数越大(诱导阻力)', () => {
    expect(dragCoefficient(10)).toBeGreaterThan(dragCoefficient(2));
  });
  it('0° 有基础寄生阻力', () => {
    expect(dragCoefficient(0)).toBeCloseTo(0.02, 5);
  });
});

describe('liftDragRatio', () => {
  it('存在峰值：中小迎角优于极小和极大迎角', () => {
    const peak = maxLDAoa();
    expect(liftDragRatio(peak)).toBeGreaterThan(liftDragRatio(1));
    expect(liftDragRatio(peak)).toBeGreaterThan(liftDragRatio(25));
  });
  it('maxLDAoa 落在 3–9° 区间', () => {
    expect(maxLDAoa()).toBeGreaterThanOrEqual(3);
    expect(maxLDAoa()).toBeLessThanOrEqual(9);
  });
});

describe('verticalWindForce', () => {
  it('上升气流为正、下沉为负', () => {
    expect(verticalWindForce(3, 1.225)).toBeGreaterThan(0);
    expect(verticalWindForce(-3, 1.225)).toBeLessThan(0);
  });
});

describe('windTilt', () => {
  it('阻力越大倾角越大、重量越大倾角越小', () => {
    expect(windTilt({ dragForce: 40, weight: 100 })).toBeGreaterThan(windTilt({ dragForce: 10, weight: 100 }));
    expect(windTilt({ dragForce: 40, weight: 200 })).toBeLessThan(windTilt({ dragForce: 40, weight: 100 }));
  });
});

describe('netLift', () => {
  const base = { totalLift: 110, weight: 100, airDensity: 1.225 };
  it('无风时有效升力=总升力', () => {
    const r = netLift({ ...base, windSpeed: 0, updraft: 0 });
    expect(r.effectiveLift).toBeCloseTo(110, 5);
    expect(r.tiltDeg).toBeCloseTo(0, 5);
  });
  it('侧风降低有效升力', () => {
    const r = netLift({ ...base, windSpeed: 10, updraft: 0 });
    expect(r.effectiveLift).toBeLessThan(110);
    expect(r.tiltDeg).toBeGreaterThan(0);
  });
  it('下沉气流降低、上升气流提高有效升力', () => {
    const down = netLift({ ...base, windSpeed: 0, updraft: -4 });
    const up = netLift({ ...base, windSpeed: 0, updraft: 4 });
    expect(down.effectiveLift).toBeLessThan(110);
    expect(up.effectiveLift).toBeGreaterThan(110);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test`
Expected: FAIL，新函数未定义。

- [ ] **Step 3: 实现**

在 `src/aero/aero.js` 末尾追加：
```js
const CD0 = 0.02;
const K_INDUCED = 0.06;
const BODY_CD_A = 1.1;   // 机体阻力系数×迎风面积(示意)
const VWIND_A = 0.6;     // 垂直气流作用面积(示意)

export function dragCoefficient(aoaDeg) {
  const cl = liftCoefficient(aoaDeg);
  return CD0 + K_INDUCED * cl * cl;
}

export function liftDragRatio(aoaDeg) {
  const cd = dragCoefficient(aoaDeg);
  return cd > 0 ? liftCoefficient(aoaDeg) / cd : 0;
}

export function computeDrag({ rotorCount, bladeSpeed, refArea, aoaDeg, airDensity }) {
  const cd = dragCoefficient(aoaDeg);
  return rotorCount * 0.5 * airDensity * bladeSpeed * bladeSpeed * refArea * cd;
}

export function horizontalWindDrag(windSpeed, airDensity) {
  return 0.5 * airDensity * BODY_CD_A * windSpeed * windSpeed;
}

export function verticalWindForce(updraft, airDensity) {
  return airDensity * VWIND_A * updraft * Math.abs(updraft);
}

export function windTilt({ dragForce, weight }) {
  return Math.atan2(dragForce, Math.max(1e-6, weight));
}

export function netLift({ totalLift, weight, windSpeed, updraft, airDensity }) {
  const drag = horizontalWindDrag(windSpeed, airDensity);
  const tilt = windTilt({ dragForce: drag, weight });
  const effectiveLift = totalLift * Math.cos(tilt) + verticalWindForce(updraft, airDensity);
  return { effectiveLift, tiltDeg: tilt * 180 / Math.PI, drag, status: liftStatus(effectiveLift, weight) };
}

export function maxLiftAoa() { return 15; }

export function maxLDAoa() {
  let best = 0, bestLD = -1;
  for (let a = 0; a <= 30; a += 0.5) {
    const ld = liftDragRatio(a);
    if (ld > bestLD) { bestLD = ld; best = a; }
  }
  return Math.round(best);
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test`
Expected: PASS（原有 + 新增全绿）。

- [ ] **Step 5: 提交**

```bash
git add src/aero/aero.js src/aero/aero.test.js
git commit -m "feat(aero): 动态阻力/升阻比 + 三维风净升力/倾角 + 特殊点

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 桨叶扭转（washout）+ 剖面根/尖两站

**Files:**
- Modify: `src/data/drones.js`
- Modify: `src/builder/builder.js`
- Modify: `src/viz/airfoil.js`
- Modify: `src/main.js`

**Interfaces:**
- `makeTwistedBlade(length, chord, rootPitchDeg, tipPitchDeg, segments?)` → THREE.BufferGeometry
- `applyBladeTwist(meshes, subtype, aoaDeg)` — 按 α 重建每片桨扭转几何（根 α+8、尖 α−8）
- prop 部件 `geometry` 改为 `{ type: 'blade', args: [0.42, 0.03] }`

- [ ] **Step 1: drones.js 改 prop 几何为 blade**

在 `src/data/drones.js` 的 prop 部件里，把 `geometry: { type: 'box', args: [0.42, 0.006, 0.03] }` 改为：
```js
      geometry: { type: 'blade', args: [0.42, 0.03] },
```
（保留 `armAngleDeg` 等其余字段不变。）

- [ ] **Step 2: builder.js 加 makeTwistedBlade / blade 几何 / DoubleSide / applyBladeTwist，并移除 applyBladePitch**

在 `src/builder/builder.js`：
① 追加扭转几何函数：
```js
export function makeTwistedBlade(length, chord, rootPitchDeg, tipPitchDeg, segments = 9) {
  const positions = [];
  const half = length / 2, c = chord / 2;
  const st = [];
  for (let i = 0; i <= segments; i++) {
    const x = -half + (length * i) / segments;
    const rFrac = Math.abs(x) / half;                 // 0=根(中心) 1=尖(两端)
    const pitch = (rootPitchDeg + (tipPitchDeg - rootPitchDeg) * rFrac) * Math.PI / 180;
    const s = Math.sin(pitch), cs = Math.cos(pitch);
    st.push([[x, -c * s, c * cs], [x, c * s, -c * cs]]); // 前缘, 后缘(绕X按桨距旋转)
  }
  for (let i = 0; i < segments; i++) {
    const [le0, te0] = st[i], [le1, te1] = st[i + 1];
    positions.push(...le0, ...te0, ...te1, ...le0, ...te1, ...le1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}
```
② 在 `makeGeometry` 里支持 blade（默认 α=8：根16、尖0）：
```js
function makeGeometry(g) {
  if (g.type === 'box') return new THREE.BoxGeometry(...g.args);
  if (g.type === 'cylinder') return new THREE.CylinderGeometry(...g.args);
  if (g.type === 'blade') return makeTwistedBlade(g.args[0], g.args[1], 16, 0);
  throw new Error(`未知几何体: ${g.type}`);
}
```
③ 在 `buildDrone` 里给 blade 用 DoubleSide 材质。把创建 material 的那行改为按类型设 side：
```js
    const mesh = new THREE.Mesh(
      makeGeometry(part.geometry),
      new THREE.MeshStandardMaterial({
        color, metalness: 0.3, roughness: 0.6,
        side: part.geometry.type === 'blade' ? THREE.DoubleSide : THREE.FrontSide,
      }),
    );
```
④ 用 `applyBladeTwist` 替换 `applyBladePitch`（删除旧函数，新增）：
```js
const WASHOUT = 8;
export function applyBladeTwist(meshes, subtype, aoaDeg) {
  for (const part of buildSubtypeParts(subtype)) {
    if (part.geometry.type === 'blade' && meshes[part.id]) {
      meshes[part.id].geometry.dispose();
      meshes[part.id].geometry = makeTwistedBlade(part.geometry.args[0], part.geometry.args[1], aoaDeg + WASHOUT, aoaDeg - WASHOUT);
    }
  }
}
```

- [ ] **Step 3: main.js 用 applyBladeTwist**

在 `src/main.js` 把 builder 导入里的 `applyBladePitch` 换成 `applyBladeTwist`，并把 `recompute()` 里 `applyBladePitch(current.meshes, subtype, s.aoaDeg)` 改为 `applyBladeTwist(current.meshes, subtype, s.aoaDeg)`。

- [ ] **Step 4: airfoil.js 画根/尖两站**

在 `src/viz/airfoil.js` 把 `draw(aoaDeg)` 内绘制翼型的部分改为画两条剖面（根 α+8、尖 α−8）+ 参考升力。用以下替换 `draw` 函数体中「翼型剖面」那段（保留相对来流箭头、α 标注、失速标注、升力箭头用 0.75R 的 CL）：
```js
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
```

- [ ] **Step 5: 验证**

Run: `npm run build`（成功）；`npm test`（全过）。
Expected: 通过。控制器浏览器确认桨叶可见连续扭转(根倾角大、尖小)，剖面图显示根/尖两站。

- [ ] **Step 6: 提交**

```bash
git add src/data/drones.js src/builder/builder.js src/viz/airfoil.js src/main.js
git commit -m "feat: 桨叶扭转(washout) 根大尖小 + 剖面根/尖两站

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Z-up 坐标系（X-Y 水平、Z 竖直）

**Files:**
- Modify: `src/scene/scene.js`
- Modify: `src/viz/axes.js`
- Modify: `src/main.js`

**Interfaces:**
- `createScene(container)` 额外返回 `content`（THREE.Group，`rotation.x=π/2`，局部 +Y→世界 +Z）。drone/viz/axes 加入 `content`。
- `createAxes(group)`、`createGizmo(renderer, camera)` 改 Z-up 标注（X/Y 水平、Z↑ 竖直）。

- [ ] **Step 1: scene.js 改 Z-up**

在 `src/scene/scene.js`：
① 相机 up 与机位（在 `camera.position.set(...)` 前后）：
```js
  camera.up.set(0, 0, 1);
  camera.position.set(4, -4.5, 3);
```
② 方向光位置改到世界上方：`dir.position.set(5, 5, 8);`
③ 移除原来直接加到 scene 的 `GridHelper` 那行；改为新增 content 组并把网格放入 content（放在创建 controls 之后）：
```js
  const content = new THREE.Group();
  content.rotation.x = Math.PI / 2;      // 局部 +Y -> 世界 +Z(竖直向上)
  scene.add(content);
  content.add(new THREE.GridHelper(10, 20, 0x334155, 0x1e293b)); // 局部 XZ -> 世界 XY 水平面
```
④ `return { scene, content, camera, renderer, controls, start };`

- [ ] **Step 2: axes.js 改 Z-up 标注 + gizmo**

在 `src/viz/axes.js`：
① `createAxes`：竖直轴改到局部 Y 并标 Z↑，水平两轴标 X/Y：
```js
export function createAxes(group) {
  const g = new THREE.Group();
  const L = 1.2;
  const axis = (dir, color) => g.add(new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), L, color, 0.12, 0.07));
  axis(new THREE.Vector3(1, 0, 0), 0xef4444); // 局部X -> 世界X 水平
  axis(new THREE.Vector3(0, 1, 0), 0x3b82f6); // 局部Y -> 世界Z 竖直
  axis(new THREE.Vector3(0, 0, 1), 0x22c55e); // 局部Z -> 世界Y 水平
  const xl = labelSprite('X', '#ef4444'); xl.position.set(L + 0.18, 0, 0);
  const zl = labelSprite('Z↑', '#3b82f6'); zl.position.set(0, L + 0.18, 0);
  const yl = labelSprite('Y', '#22c55e'); yl.position.set(0, 0, L + 0.18);
  g.add(xl, zl, yl);
  group.add(g);
  return g;
}
```
② `createGizmo`：让 gizmo 轴组同样旋转 π/2(与 content 一致)并按 Z-up 标注（axes 颜色同上：X红=局部X，Z↑蓝=局部Y，Y绿=局部Z）。把 gizmo 内建轴的三行改为红=（1,0,0）、蓝=（0,1,0）、绿=（0,0,1），并在 scene 里给这三条轴的父组设 `rotation.x = Math.PI/2`：
```js
  const axesRoot = new THREE.Group();
  axesRoot.rotation.x = Math.PI / 2;
  scene.add(axesRoot);
  const axis = (dir, color) => axesRoot.add(new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), 1, color, 0.28, 0.16));
  axis(new THREE.Vector3(1, 0, 0), 0xef4444);
  axis(new THREE.Vector3(0, 1, 0), 0x3b82f6);
  axis(new THREE.Vector3(0, 0, 1), 0x22c55e);
```
（其余 render()/scissor 逻辑不变。）

- [ ] **Step 3: main.js 把内容加入 content**

在 `src/main.js`：
- `const viz = createViz(ctx.scene);` → `createViz(ctx.content);`
- `createAxes(ctx.scene);` → `createAxes(ctx.content);`
- `rebuild()` 里 `ctx.scene.remove(current.group)` 和 `ctx.scene.add(current.group)` → `ctx.content.remove(...)` / `ctx.content.add(...)`。

- [ ] **Step 4: 验证**

Run: `npm run build`（成功）；`npm test`（全过）。
Expected: 通过。控制器浏览器确认：网格为水平 X-Y 面，竖直轴标 Z↑，升力沿 Z 向上、重力向下，机身立在水平面上；gizmo 与主视一致。

- [ ] **Step 5: 提交**

```bash
git add src/scene/scene.js src/viz/axes.js src/main.js
git commit -m "feat: Z-up 坐标系(X-Y 水平、Z 竖直)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 三维风可视化 + 机身抗风倾斜 + 净升力接线

**Files:**
- Modify: `src/aero/aero.js`（加 `windVector3D`）
- Test: `src/aero/aero.test.js`
- Modify: `src/viz/viz.js`
- Modify: `src/main.js`

**Interfaces:**
- `windVector3D(windSpeed, windDirDeg, updraft)` → `{ x, y, z }`（局部帧：水平在 XZ 平面，垂直分量在 Y=updraft）
- `viz.update` 接收 `wind` 为 `{x,y,z}`（三维），风箭头显示三维方向；升力配色改用有效升力。
- main：`recompute()` 用 `netLift` 求有效升力/倾角，机身按倾角抗风倾斜；`BODY_VOLUME` 标定默认刚好能飞。

- [ ] **Step 1: aero 加 windVector3D（TDD）**

在 `src/aero/aero.test.js` 追加：
```js
import { windVector3D } from './aero.js';
describe('windVector3D', () => {
  it('水平分量在 XZ、垂直分量为 updraft(Y)', () => {
    const v = windVector3D(10, 0, 3);
    expect(v.x).toBeCloseTo(10, 5);
    expect(v.z).toBeCloseTo(0, 5);
    expect(v.y).toBeCloseTo(3, 5);
  });
});
```
Run `npm test` 确认 FAIL；然后在 `src/aero/aero.js` 追加：
```js
export function windVector3D(windSpeed, windDirDeg, updraft) {
  const rad = windDirDeg * Math.PI / 180;
  return { x: windSpeed * Math.cos(rad), y: updraft, z: windSpeed * Math.sin(rad) };
}
```
Run `npm test` 确认 PASS。

- [ ] **Step 2: viz.js 风箭头三维化**

在 `src/viz/viz.js` 的 `update(s)` 里，把风箭头方向/可见性改用三维模长与方向（`s.wind` 现为 `{x,y,z}`）：
```js
    const wlen = Math.hypot(s.wind.x, s.wind.y, s.wind.z);
    wind.visible = wlen > 0.01;
    if (wlen > 0.01) {
      wind.setDirection(new THREE.Vector3(s.wind.x, s.wind.y, s.wind.z).normalize());
      wind.setLength(Math.min(2, 0.3 + wlen / 15), 0.15, 0.09);
    }
    windVec = s.wind;
```
并把升力配色改用有效升力：`update` 增加读取 `s.effectiveLift`，总升力箭头与每旋翼配色用 `liftColor(s.effectiveLift, s.weight)`（总箭头长度仍按 s.totalLift；颜色按有效升力）。具体：把 `totalLift.setColor(toColor(liftColor(s.totalLift, s.weight)));` 改为 `toColor(liftColor(s.effectiveLift, s.weight))`；每旋翼颜色 `liftColor(lift, wShare)` 保持（按各自升力）。`tick` 里下洗垂直分量：`arr[i*3+1]` 的下降速度叠加 `windVec.y` 影响（上升气流减慢下沉）：把下洗推进 `flow.seed[i] += dt * 0.35 * downStrength;` 附近不改，改 `writeParticle` 下半段 y 计算加 `+ windVec.y * 0.02 * t`（可选，最小改动即可）。

- [ ] **Step 3: main.js 接 netLift + 机身倾斜 + 标定**

在 `src/main.js`：
① 顶部加常量：`const BODY_VOLUME = 6.7;`（标定默认净升力≈重量；控制器实测微调）。
② aero 导入补 `netLift, windVector3D`（保留 `computeWeight, liftStatus, windVector, perRotorLift, MATERIALS`；`windVector` 可留作兼容或删除）。
③ 重写 `recompute()`：
```js
function recompute() {
  const s = state.get();
  applyMaterial(current.meshes, subtype, s.materialId);
  applyBladeTwist(current.meshes, subtype, s.aoaDeg);
  const aeroP = { bladeSpeed: 36, refArea: 0.02, aoaDeg: s.aoaDeg, airDensity: 1.225 };
  const single = perRotorLift(aeroP);
  const perLift = Array.from({ length: subtype.rotorCount }, () => single);
  const totalLift = single * subtype.rotorCount;
  const weight = computeWeight({ bodyVolume: BODY_VOLUME, materialId: s.materialId });
  const net = netLift({ totalLift, weight, windSpeed: s.windSpeed, updraft: s.updraft ?? 0, airDensity: 1.225 });
  const wind = windVector3D(s.windSpeed, s.windDirDeg, s.updraft ?? 0);
  // 机身抗风倾斜：绕与水平风垂直的水平轴倾转 tilt
  const wr = s.windDirDeg * Math.PI / 180;
  const tiltAxis = new THREE.Vector3(Math.sin(wr), 0, -Math.cos(wr));
  current.group.setRotationFromAxisAngle(tiltAxis, net.tiltDeg * Math.PI / 180);
  viz.update({ perLift, totalLift, effectiveLift: net.effectiveLift, weight, wind });
  renderReadout(panel.querySelector('#readout'), { totalLift, net, weight, aoaDeg: s.aoaDeg, material: MATERIALS[s.materialId] });
  airfoil.draw(s.aoaDeg);
  aerochart.draw(s.aoaDeg);   // Task 5 引入；若尚未引入，本步先省略此行，Task 5 再加
}
```
> 注：`aerochart` 在 Task 5 引入；实现本任务时先不加该行，Task 5 再补。`renderReadout` 的新签名在 Task 6 落地；本任务可临时传旧签名或最小占位，Task 6 统一。为避免破坏，**本任务 renderReadout 调用改为**：`renderReadout(panel.querySelector('#readout'), { lift: net.effectiveLift, weight, status: net.status, material: MATERIALS[s.materialId] });`（沿用现有 renderReadout 签名），Task 6 再升级为完整读数。
④ `state` 初始加 `updraft: 0`：把 `createState({ subtype:'octa', aoaDeg:8, windSpeed:4, windDirDeg:0, materialId:'carbon' })` 改为加 `updraft: 0`。`THREE` 已在 main 顶部导入。

- [ ] **Step 4: 验证 + 标定**

Run: `npm run build`（成功）；`npm test`（全过）。
控制器浏览器实测：默认(碳纤维,α8,风4,无垂直气流)净升重比应≈1.0–1.1(刚好能飞)；把风速调大或垂直气流调为下沉应转"升力不足"；机身随风倾斜；风箭头含垂直分量。据实测把 `BODY_VOLUME` 或风阻常数微调到"默认刚好能飞、风一大起不来"。

- [ ] **Step 5: 提交**

```bash
git add src/aero/aero.js src/aero/aero.test.js src/viz/viz.js src/main.js
git commit -m "feat: 三维风 + 机身抗风倾斜 + 净升力起飞判定

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 空气动力学曲线图（CL/(L/D)-α + 特殊点，dataviz）

**Files:**
- Create: `src/viz/aerochart.js`
- Modify: `index.html`
- Modify: `src/main.js`

**Interfaces:**
- `createAeroChart(canvas)` → `{ draw(aoaDeg) }`：横轴 α(0–30)，画 CL(α) 与 L/D(α) 两条曲线(各自归一化到画布高度)，标注 maxLiftAoa、maxLDAoa 与当前 α 游标。

**先加载 dataviz 技能** 获取配色/坐标/网格样式，据其定曲线与标记颜色（保持内容：两条曲线 + 三个标记 + 中文图例）。

- [ ] **Step 0: 加载 dataviz 技能**

调用 dataviz 技能，取其配色与图表规范用于本图。

- [ ] **Step 1: index.html 加曲线图容器**

在 `#airfoil-box` 之后追加：
```html
    <div id="aerochart-box" style="position:fixed;left:12px;bottom:186px;background:rgba(17,19,24,.92);
         border-radius:10px;padding:8px;backdrop-filter:blur(8px)">
      <div style="color:#cbd5e1;font-size:12px;margin:2px 4px 6px">空气动力学曲线（α）</div>
      <canvas id="aerochart" width="240" height="150"></canvas>
    </div>
```

- [ ] **Step 2: 写 aerochart.js**

Create `src/viz/aerochart.js`（配色按 dataviz 技能结论；下为结构与内容，样式可调）:
```js
import { liftCoefficient, liftDragRatio, maxLiftAoa, maxLDAoa } from '../aero/aero.js';

export function createAeroChart(canvas) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const padL = 28, padR = 10, padT = 10, padB = 20;
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
  const CL_COLOR = '#22c55e', LD_COLOR = '#f59e0b';

  function curve(color, sy, key) {
    g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
    samples.forEach((s, i) => { const X = sx(s.a), Y = sy(s[key]); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
    g.stroke();
  }
  function marker(a, color, label) {
    const X = sx(a);
    g.strokeStyle = color; g.setLineDash([3, 3]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(X, y1); g.lineTo(X, y0); g.stroke(); g.setLineDash([]);
    g.fillStyle = color; g.font = '10px sans-serif'; g.fillText(label, X - 6, y1 + 8);
  }

  function draw(aoaDeg) {
    g.clearRect(0, 0, W, H);
    // 轴
    g.strokeStyle = '#334155'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y0); g.moveTo(x0, y0); g.lineTo(x0, y1); g.stroke();
    g.fillStyle = '#64748b'; g.font = '10px sans-serif';
    g.fillText('α', x1 - 8, y0 + 14); g.fillText('0', x0 - 6, y0 + 14); g.fillText('30°', x1 - 20, y0 + 14);
    // 曲线
    curve(CL_COLOR, syCL, 'cl');
    curve(LD_COLOR, syLD, 'ld');
    // 特殊点
    marker(maxLiftAoa(), CL_COLOR, '最大升力');
    marker(maxLDAoa(), LD_COLOR, '最大升阻比');
    // 当前 α 游标
    const X = sx(aoaDeg);
    g.strokeStyle = '#e5e7eb'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(X, y1); g.lineTo(X, y0); g.stroke();
    g.fillStyle = '#e5e7eb'; g.fillText(`α=${aoaDeg}°`, Math.min(X + 3, x1 - 40), y1 + 18);
    // 图例
    g.fillStyle = CL_COLOR; g.fillText('CL', x0 + 4, y1 + 8);
    g.fillStyle = LD_COLOR; g.fillText('L/D', x0 + 30, y1 + 8);
  }
  return { draw };
}
```

- [ ] **Step 3: main.js 接曲线图**

在 `src/main.js` import 区加 `import { createAeroChart } from './viz/aerochart.js';`；在 `const airfoil = ...` 附近加 `const aerochart = createAeroChart(document.getElementById('aerochart'));`；在 `recompute()` 末尾（`airfoil.draw(s.aoaDeg);` 之后）加 `aerochart.draw(s.aoaDeg);`。

- [ ] **Step 4: 验证**

Run: `npm run build`（成功）；`npm test`（全过）。
Expected: 通过。控制器浏览器确认左下曲线图显示 CL、L/D 两条曲线 + 最大升力/最大升阻比标记 + 当前 α 游标随滑块移动。

- [ ] **Step 5: 提交**

```bash
git add src/viz/aerochart.js index.html src/main.js
git commit -m "feat(viz): 空气动力学曲线图(CL/(L/D)-α + 特殊点, dataviz)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: UI —— 垂直气流滑块 + 完整读数 + 图例

**Files:**
- Modify: `src/ui/ui.js`
- Modify: `src/main.js`

**Interfaces:**
- `createUI` 飞行参数区新增「垂直气流」滑块（−6..+6 m/s，绑定 `state.updraft`）。
- `renderReadout(el, { totalLift, net, weight, aoaDeg, material })` — 显示 总升力/有效升力/阻力/升阻比 L/D/抗风倾角 θ/净升重比(连续条)/状态 + 特殊点文字(最大升力@15°、最大升阻比@maxLDAoa)。

- [ ] **Step 1: ui.js 加滑块、升级读数、补图例**

在 `src/ui/ui.js`：
① 顶部 import 补 `liftDragRatio, maxLiftAoa, maxLDAoa` 从 `../aero/aero.js`（与 MATERIALS 并列）。
② 飞行参数区在材料下拉之前加垂直气流滑块（`s.updraft ?? 0`）：
```js
      ${slider('垂直气流', 'updraft', -6, 6, s.updraft ?? 0, 0.5, ' m/s')}
```
并在 `createUI` 末尾的绑定处加 `bind('updraft', 'updraft');`（沿用现有 bind 机制，其单位解析已通用）。
③ 图例区追加两行：
```js
      ${legendRow('#f59e0b', '升阻比 L/D 曲线 / 垂直气流')}
      <div style="color:#94a3b8;margin-top:4px">风大→机身倾斜抗风，有效升力下降；Z↑=竖直/升力方向。</div>
```
④ 用新版 `renderReadout` 替换旧的：
```js
export function renderReadout(el, { totalLift, net, weight, aoaDeg, material }) {
  const label = { climb: '爬升 ▲', hover: '悬停 ●', stall: '升力不足 ▼' }[net.status];
  const ratio = weight > 0 ? net.effectiveLift / weight : 0;
  const pct = Math.max(0, Math.min(100, (ratio / 1.5) * 100));
  const barColor = ratio >= 1 ? '#22c55e' : ratio >= 0.9 ? '#f59e0b' : '#ef4444';
  el.innerHTML = `
    <div>总升力：<b>${totalLift.toFixed(0)}</b> N（示意）</div>
    <div>有效升力：<b>${net.effectiveLift.toFixed(0)}</b> N（抗风后）</div>
    <div>阻力：<b>${net.drag.toFixed(0)}</b> N ｜ 升阻比 L/D：<b>${liftDragRatio(aoaDeg).toFixed(1)}</b></div>
    <div>抗风倾角 θ：<b>${net.tiltDeg.toFixed(0)}</b>°</div>
    <div style="margin:6px 0">状态：<b>${label}</b></div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:4px">净升重比 ${ratio.toFixed(2)}</div>
    <div style="height:10px;background:#1e293b;border-radius:5px;overflow:hidden;position:relative">
      <div style="height:100%;width:${pct}%;background:${barColor}"></div>
      <div style="position:absolute;left:66.6%;top:0;bottom:0;width:2px;background:#e5e7eb"></div>
    </div>
    <div style="margin-top:8px;font-size:12px;color:#94a3b8">
      最大升力 @${maxLiftAoa()}°　最大升阻比 @${maxLDAoa()}°</div>
    <div style="margin-top:6px;font-size:12px;color:#94a3b8">${material.name} 适用：${material.useCase}</div>`;
}
```

- [ ] **Step 2: main.js 用新 renderReadout 签名**

在 `src/main.js` 的 `recompute()` 里，把 Task 4 临时的 renderReadout 调用改为完整签名：
```js
  renderReadout(panel.querySelector('#readout'), { totalLift, net, weight, aoaDeg: s.aoaDeg, material: MATERIALS[s.materialId] });
```
（`net`、`totalLift` 已在 recompute 内计算。）

- [ ] **Step 3: 验证**

Run: `npm run build`（成功）；`npm test`（全过）。
Expected: 通过。控制器浏览器确认：垂直气流滑块可调并影响起飞；读数显示总升力/有效升力/阻力/L-D/倾角/净升重比 + 特殊点文字；图例补充完整。

- [ ] **Step 4: 提交**

```bash
git add src/ui/ui.js src/main.js
git commit -m "feat(ui): 垂直气流滑块 + 完整读数(有效升力/阻力/LD/倾角/特殊点) + 图例

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 自查（Self-Review）

- **Spec 覆盖**：桨叶扭转+剖面根尖→T2；三维风+起飞耦合+机身倾斜→T1/T4；动态阻力+L/D→T1/T6；特殊点曲线→T1(求解)/T5(图)/T6(文字)；Z-up→T3；UI 垂直气流/读数/图例→T6；aero 新函数 TDD→T1/T4。全部有任务。
- **占位符**：无 TODO/TBD；代码步骤含完整代码。T4/T6 的 renderReadout 签名过渡已显式说明(T4 用旧签名占位，T6 升级)，aerochart 行 T4 不加、T5 补，均明确。
- **类型一致**：`netLift→{effectiveLift,tiltDeg,drag,status}`、`windVector3D→{x,y,z}`、`viz.update({perLift,totalLift,effectiveLift,weight,wind:{x,y,z}})`、`makeTwistedBlade(len,chord,root,tip)`、`applyBladeTwist(meshes,subtype,aoaDeg)`、`createAeroChart(canvas).draw(aoaDeg)`、`createScene→{scene,content,camera,renderer,controls,start}`、`renderReadout({totalLift,net,weight,aoaDeg,material})` 各任务一致。
- **依赖顺序**：T1(aero) 先；T2 桨叶；T3 Z-up；T4 依赖 T1(netLift/windVector3D)；T5 依赖 T1(曲线/特殊点)；T6 依赖 T1/T4/T5。main.js 顺序修改无并发。
- **Z-up 一致性**：drone/viz/axes 全部入 content(单一帧)，风与升力同帧，避免世界/局部混用；网格局部 XZ→世界水平。
