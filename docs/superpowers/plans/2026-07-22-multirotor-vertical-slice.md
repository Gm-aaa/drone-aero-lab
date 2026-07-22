# 多旋翼竖切 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Three.js + Vite 实现"无人机空气动力学实验室"的多旋翼竖切：程序化展示四/六/八轴结构，并按迎角/材料/风速/风向实时示意升力与气流。

**Architecture:** 数据驱动——机型部件写成声明式数据，通用建造器用 Three.js 基础几何体拼出带标注模型。空气动力学是可单测的纯函数，其输出驱动矢量箭头与流线可视化。UI 改状态 → aero 计算 → viz 更新 → 渲染循环。

**Tech Stack:** Vite、Three.js（含 addons/OrbitControls）、原生 ES 模块、Vitest（测 aero 纯函数）。

## Global Constraints

- 纯前端静态，最终发布到 GitHub Pages，Vite `base: '/drone-aero-lab/'`。
- 3D 全部程序化生成，不导入外部 GLTF/贴图资源。
- 空气动力学为"教学示意级"简化物理，UI 上标注"示意值，非精确工程值"。
- UI 语言：中文。
- 依赖用较新稳定版：`three`、`vite`、`vitest`（安装时取 latest）。
- 频繁提交，每个 Task 末尾提交一次。commit message 末尾附：
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## File Structure

- `package.json` — 依赖与脚本（dev/build/preview/test）
- `vite.config.js` — base 路径 + test 配置
- `index.html` — 挂载点 + 侧栏容器
- `src/main.js` — 装配、状态、渲染循环、事件绑定
- `src/state.js` — 单一状态对象 + 订阅
- `src/data/drones.js` — 机型/子类/部件声明式定义（唯一事实源）
- `src/scene/scene.js` — Three.js 场景/相机/光/控制器/renderer
- `src/builder/builder.js` — 由子类定义生成带命名部件 Group + 高亮
- `src/aero/aero.js` — 纯函数：CL、升力、重量、升重比状态、风矢量
- `src/aero/aero.test.js` — aero 单测
- `src/viz/viz.js` — 升力/重力/风箭头 + 气流流线
- `src/ui/ui.js` — 控件面板 + 信息面板
- `.github/workflows/deploy.yml` — 构建并部署 gh-pages
- `README.md` — 开发/部署说明

---

### Task 1: 项目脚手架（Vite + Three）

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.js`

**Interfaces:**
- Consumes: 无
- Produces: `npm run dev` 可启动的空白页；`#app` 画布容器与 `#panel` 侧栏容器 DOM。

- [ ] **Step 1: 初始化 package.json 与依赖**

Run:
```bash
cd /home/gmaaa/Projects/drone-aero-lab
npm init -y
npm install three
npm install -D vite vitest
```

- [ ] **Step 2: 写 vite.config.js**

Create `vite.config.js`:
```js
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/drone-aero-lab/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
```

- [ ] **Step 3: 设置 package.json 脚本**

Edit `package.json`，把 `"scripts"` 段替换为：
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run"
},
"type": "module"
```

- [ ] **Step 4: 写 index.html**

Create `index.html`:
```html
<!doctype html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>无人机空气动力学实验室</title>
    <style>
      * { margin: 0; box-sizing: border-box; }
      html, body { height: 100%; overflow: hidden; font-family: system-ui, sans-serif; }
      #app { position: fixed; inset: 0; }
      #panel {
        position: fixed; top: 0; right: 0; width: 320px; height: 100%;
        background: rgba(20,22,28,.9); color: #eee; padding: 16px;
        overflow-y: auto; font-size: 14px; backdrop-filter: blur(6px);
      }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <div id="panel"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 5: 写占位 main.js**

Create `src/main.js`:
```js
document.getElementById('panel').textContent = '加载中…';
```

- [ ] **Step 6: 验证 dev 启动**

Run: `npm run dev`（启动后 Ctrl-C）
Expected: 输出 `Local: http://localhost:5173/drone-aero-lab/`，无报错。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "chore: Vite + Three 脚手架

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 场景模块

**Files:**
- Create: `src/scene/scene.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `#app` 容器
- Produces: `createScene(container)` 返回 `{ scene, camera, renderer, controls, start(renderCb) }`，其中 `start` 接收每帧回调并启动渲染循环，内部处理窗口 resize。

- [ ] **Step 1: 写 scene.js**

Create `src/scene/scene.js`:
```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1016);

  const camera = new THREE.PerspectiveCamera(
    50, container.clientWidth / container.clientHeight, 0.1, 1000,
  );
  camera.position.set(3, 2.5, 4);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(5, 8, 5);
  scene.add(dir);
  scene.add(new THREE.GridHelper(10, 20, 0x334155, 0x1e293b));

  function onResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', onResize);

  function start(renderCb) {
    function loop() {
      requestAnimationFrame(loop);
      controls.update();
      if (renderCb) renderCb();
      renderer.render(scene, camera);
    }
    loop();
  }

  return { scene, camera, renderer, controls, start };
}
```

- [ ] **Step 2: 在 main.js 挂场景 + 临时立方体**

Replace `src/main.js`:
```js
import * as THREE from 'three';
import { createScene } from './scene/scene.js';

const ctx = createScene(document.getElementById('app'));
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x38bdf8 }),
);
ctx.scene.add(cube);
ctx.start(() => { cube.rotation.y += 0.005; });
```

- [ ] **Step 3: 浏览器验证**

Run: `npm run dev`，浏览器打开地址。
Expected: 深色场景 + 网格地面 + 可用鼠标旋转的蓝色立方体，无控制台报错。截图确认后 Ctrl-C。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: Three.js 场景模块（相机/光/OrbitControls/渲染循环）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 空气动力学纯函数（TDD）

**Files:**
- Create: `src/aero/aero.js`
- Test: `src/aero/aero.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `MATERIALS` — 对象，键为材料 id，值 `{ id, name, density, color, useCase }`（density 单位相对值 kg/单位体积）。
  - `liftCoefficient(aoaDeg)` → number。线性段 `2π·α(rad)`，失速角 15° 后骤降。
  - `computeLift({ rotorCount, bladeSpeed, refArea, aoaDeg, airDensity })` → number（牛顿，示意）。
  - `computeWeight({ bodyVolume, materialId })` → number（牛顿，`density·volume·g`，g=9.81）。
  - `liftStatus(lift, weight)` → `'climb' | 'hover' | 'stall'`（lift>weight*1.05→climb，0.95..1.05→hover，否则 stall）。
  - `windVector(windSpeed, windDirDeg)` → `{ x, z }`（水平风矢量，0°=+x 方向）。

- [ ] **Step 1: 写失败测试**

Create `src/aero/aero.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  MATERIALS, liftCoefficient, computeLift, computeWeight, liftStatus, windVector,
} from './aero.js';

describe('liftCoefficient', () => {
  it('0° 迎角升力系数为 0', () => {
    expect(liftCoefficient(0)).toBeCloseTo(0, 5);
  });
  it('线性段随迎角增大', () => {
    expect(liftCoefficient(10)).toBeGreaterThan(liftCoefficient(5));
  });
  it('失速角(15°)之后骤降', () => {
    expect(liftCoefficient(20)).toBeLessThan(liftCoefficient(15));
  });
});

describe('computeWeight', () => {
  it('材料密度越大重量越大', () => {
    const w = (id) => computeWeight({ bodyVolume: 1, materialId: id });
    expect(w('carbon')).toBeLessThan(w('aluminum'));
  });
});

describe('computeLift', () => {
  it('桨数越多升力越大', () => {
    const base = { bladeSpeed: 50, refArea: 0.02, aoaDeg: 8, airDensity: 1.225 };
    expect(computeLift({ ...base, rotorCount: 8 }))
      .toBeGreaterThan(computeLift({ ...base, rotorCount: 4 }));
  });
});

describe('liftStatus', () => {
  it('升力显著大于重力→爬升', () => expect(liftStatus(120, 100)).toBe('climb'));
  it('升力约等于重力→悬停', () => expect(liftStatus(100, 100)).toBe('hover'));
  it('升力不足→失速/起不来', () => expect(liftStatus(50, 100)).toBe('stall'));
});

describe('windVector', () => {
  it('0° 风向指向 +x', () => {
    const v = windVector(10, 0);
    expect(v.x).toBeCloseTo(10, 5);
    expect(v.z).toBeCloseTo(0, 5);
  });
  it('90° 风向指向 +z', () => {
    const v = windVector(10, 90);
    expect(v.x).toBeCloseTo(0, 5);
    expect(v.z).toBeCloseTo(10, 5);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，报 `aero.js` 无法解析或函数未定义。

- [ ] **Step 3: 写 aero.js 实现**

Create `src/aero/aero.js`:
```js
const G = 9.81;
const STALL_DEG = 15;
const CL_MAX = 2 * Math.PI * (STALL_DEG * Math.PI / 180);

export const MATERIALS = {
  carbon:   { id: 'carbon',   name: '碳纤维', density: 1.6, color: 0x22272e, useCase: '竞速/高性能航拍：轻而刚，成本高' },
  aluminum: { id: 'aluminum', name: '铝',     density: 2.7, color: 0xb0b7c3, useCase: '工业/耐用机型：性价比与强度兼顾' },
  plastic:  { id: 'plastic',  name: '塑料',   density: 1.1, color: 0x3b82f6, useCase: '玩具/入门：便宜量产，刚性一般' },
  wood:     { id: 'wood',     name: '木',     density: 0.7, color: 0x9a6b3f, useCase: 'DIY/原型：易加工，适合验证结构' },
};

export function liftCoefficient(aoaDeg) {
  if (aoaDeg <= STALL_DEG) {
    return 2 * Math.PI * (aoaDeg * Math.PI / 180);
  }
  // 失速后线性衰减
  const over = aoaDeg - STALL_DEG;
  return Math.max(0, CL_MAX * (1 - over / 20));
}

export function computeLift({ rotorCount, bladeSpeed, refArea, aoaDeg, airDensity }) {
  const cl = liftCoefficient(aoaDeg);
  return rotorCount * 0.5 * airDensity * bladeSpeed * bladeSpeed * refArea * cl;
}

export function computeWeight({ bodyVolume, materialId }) {
  const m = MATERIALS[materialId];
  return m.density * bodyVolume * G;
}

export function liftStatus(lift, weight) {
  const r = lift / weight;
  if (r > 1.05) return 'climb';
  if (r >= 0.95) return 'hover';
  return 'stall';
}

export function windVector(windSpeed, windDirDeg) {
  const rad = windDirDeg * Math.PI / 180;
  return { x: windSpeed * Math.cos(rad), z: windSpeed * Math.sin(rad) };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS，所有用例绿。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 空气动力学纯函数 + 单测（升力系数/升力/重量/升重比/风矢量）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 机型部件数据

**Files:**
- Create: `src/data/drones.js`
- Test: `src/data/drones.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `DRONES` — 结构：`{ multirotor: { name, subtypes: { quad|hexa|octa: { name, rotorCount, arms:[{angleDeg}], parts:[Part] } } } }`。
  - `Part` 形状：`{ id, name, desc, geometry: { type, args }, position:[x,y,z], rotation?:[x,y,z], materialRole: 'structural'|'fixed', color?, spin?: 'cw'|'ccw' }`。
  - `buildSubtypeParts(subtype)` → 展开后的 Part 数组（机臂/电机/桨按 `arms` 角度程序化复制）。

- [ ] **Step 1: 写失败测试**

Create `src/data/drones.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { DRONES, buildSubtypeParts } from './drones.js';

describe('DRONES 数据', () => {
  it('多旋翼含四/六/八轴', () => {
    expect(Object.keys(DRONES.multirotor.subtypes)).toEqual(
      expect.arrayContaining(['quad', 'hexa', 'octa']),
    );
  });
  it('rotorCount 与轴数一致', () => {
    expect(DRONES.multirotor.subtypes.quad.rotorCount).toBe(4);
    expect(DRONES.multirotor.subtypes.hexa.rotorCount).toBe(6);
    expect(DRONES.multirotor.subtypes.octa.rotorCount).toBe(8);
  });
});

describe('buildSubtypeParts', () => {
  it('八轴电机数量等于 rotorCount', () => {
    const parts = buildSubtypeParts(DRONES.multirotor.subtypes.octa);
    const motors = parts.filter((p) => p.id.startsWith('motor'));
    expect(motors).toHaveLength(8);
  });
  it('每个部件都有 name 与 geometry', () => {
    const parts = buildSubtypeParts(DRONES.multirotor.subtypes.quad);
    for (const p of parts) {
      expect(p.name).toBeTruthy();
      expect(p.geometry).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test`
Expected: FAIL，`drones.js` 未定义。

- [ ] **Step 3: 写 drones.js**

Create `src/data/drones.js`:
```js
// 静态机身部件（不随轴数变化）
const staticParts = [
  { id: 'frame', name: '机架中心板', desc: '承载飞控、电池等核心部件的结构中心。',
    geometry: { type: 'box', args: [0.5, 0.06, 0.5] }, position: [0, 0, 0], materialRole: 'structural' },
  { id: 'fc', name: '飞控 FC', desc: '飞行控制器，读取传感器并解算姿态、输出控制指令。',
    geometry: { type: 'box', args: [0.16, 0.04, 0.16] }, position: [0, 0.06, 0], materialRole: 'fixed', color: 0x22c55e },
  { id: 'battery', name: '电池', desc: '锂聚合物电池，为电机和电子设备供电。',
    geometry: { type: 'box', args: [0.28, 0.08, 0.14] }, position: [0, -0.08, 0], materialRole: 'fixed', color: 0xef4444 },
  { id: 'gps', name: 'GPS', desc: '卫星定位模块，提供位置与返航能力。',
    geometry: { type: 'cylinder', args: [0.06, 0.06, 0.02, 16] }, position: [0, 0.12, -0.12], materialRole: 'fixed', color: 0xf59e0b },
  { id: 'legL', name: '脚架', desc: '起落架，保护机身着陆。',
    geometry: { type: 'cylinder', args: [0.015, 0.015, 0.25, 8] }, position: [-0.18, -0.16, 0.18], materialRole: 'structural' },
  { id: 'legR', name: '脚架', desc: '起落架，保护机身着陆。',
    geometry: { type: 'cylinder', args: [0.015, 0.015, 0.25, 8] }, position: [0.18, -0.16, -0.18], materialRole: 'structural' },
];

function armLayout(n) {
  return Array.from({ length: n }, (_, i) => ({ angleDeg: (360 / n) * i }));
}

export const DRONES = {
  multirotor: {
    name: '多旋翼',
    subtypes: {
      quad: { name: '四轴', rotorCount: 4, arms: armLayout(4), parts: staticParts },
      hexa: { name: '六轴', rotorCount: 6, arms: armLayout(6), parts: staticParts },
      octa: { name: '八轴', rotorCount: 8, arms: armLayout(8), parts: staticParts },
    },
  },
};

const ARM_LEN = 0.55;

export function buildSubtypeParts(subtype) {
  const parts = [...subtype.parts];
  subtype.arms.forEach((arm, i) => {
    const rad = arm.angleDeg * Math.PI / 180;
    const ax = Math.cos(rad) * ARM_LEN;
    const az = Math.sin(rad) * ARM_LEN;
    // 机臂
    parts.push({
      id: `arm${i}`, name: '机臂', desc: '连接机架与电机的臂，决定轴距与刚性。',
      geometry: { type: 'box', args: [ARM_LEN, 0.03, 0.04] },
      position: [ax / 2, 0, az / 2], rotation: [0, -rad, 0], materialRole: 'structural',
    });
    // 电机
    parts.push({
      id: `motor${i}`, name: '无刷电机', desc: '驱动螺旋桨旋转产生升力/推力。',
      geometry: { type: 'cylinder', args: [0.045, 0.045, 0.05, 16] },
      position: [ax, 0.05, az], materialRole: 'fixed', color: 0x94a3b8,
    });
    // 电调
    parts.push({
      id: `esc${i}`, name: '电调 ESC', desc: '电子调速器，按飞控指令控制电机转速。',
      geometry: { type: 'box', args: [0.06, 0.015, 0.03] },
      position: [ax / 2, 0.02, az / 2], rotation: [0, -rad, 0], materialRole: 'fixed', color: 0x0ea5e9,
    });
    // 螺旋桨（正/反桨交替）
    parts.push({
      id: `prop${i}`, name: i % 2 === 0 ? '螺旋桨（正桨 CW）' : '螺旋桨（反桨 CCW）',
      desc: '相邻电机正反桨交替，抵消反扭矩以保持偏航稳定。',
      geometry: { type: 'box', args: [0.42, 0.006, 0.03] },
      position: [ax, 0.09, az], materialRole: 'fixed', color: 0xcbd5e1,
      spin: i % 2 === 0 ? 'cw' : 'ccw',
    });
  });
  return parts;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 多旋翼四/六/八轴部件声明式数据 + 展开函数

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 建造器（数据→带标注 3D 模型）

**Files:**
- Create: `src/builder/builder.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `buildSubtypeParts` (Task 4)、`MATERIALS` (Task 3)
- Produces:
  - `buildDrone(subtype, materialId)` → `{ group, meshes }`，`group` 是 THREE.Group，`meshes` 是 `{ [partId]: Mesh }`；每个 mesh 的 `userData` 含 `{ part }`。structural 部件用材料颜色，fixed 部件用自身 color。
  - `highlightPart(meshes, partId)` — 高亮指定部件（emissive），其余复原。
  - `applyMaterial(meshes, subtype, materialId)` — 更新 structural 部件颜色。

- [ ] **Step 1: 写 builder.js**

Create `src/builder/builder.js`:
```js
import * as THREE from 'three';
import { buildSubtypeParts, DRONES } from '../data/drones.js';
import { MATERIALS } from '../aero/aero.js';

function makeGeometry(g) {
  if (g.type === 'box') return new THREE.BoxGeometry(...g.args);
  if (g.type === 'cylinder') return new THREE.CylinderGeometry(...g.args);
  throw new Error(`未知几何体: ${g.type}`);
}

export function buildDrone(subtype, materialId) {
  const group = new THREE.Group();
  const meshes = {};
  const structColor = MATERIALS[materialId].color;
  for (const part of buildSubtypeParts(subtype)) {
    const color = part.materialRole === 'structural' ? structColor : (part.color ?? 0xffffff);
    const mesh = new THREE.Mesh(
      makeGeometry(part.geometry),
      new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.6 }),
    );
    mesh.position.set(...part.position);
    if (part.rotation) mesh.rotation.set(...part.rotation);
    mesh.userData.part = part;
    meshes[part.id] = mesh;
    group.add(mesh);
  }
  return { group, meshes };
}

export function highlightPart(meshes, partId) {
  for (const [id, mesh] of Object.entries(meshes)) {
    mesh.material.emissive = new THREE.Color(id === partId ? 0x2563eb : 0x000000);
    mesh.material.emissiveIntensity = id === partId ? 0.8 : 0;
  }
}

export function applyMaterial(meshes, subtype, materialId) {
  const structColor = MATERIALS[materialId].color;
  for (const part of buildSubtypeParts(subtype)) {
    if (part.materialRole === 'structural' && meshes[part.id]) {
      meshes[part.id].material.color.setHex(structColor);
    }
  }
}
export { DRONES };
```

- [ ] **Step 2: 在 main.js 装配一架**

Replace `src/main.js`:
```js
import { createScene } from './scene/scene.js';
import { buildDrone, DRONES } from './builder/builder.js';

const ctx = createScene(document.getElementById('app'));
const { group } = buildDrone(DRONES.multirotor.subtypes.octa, 'carbon');
ctx.scene.add(group);
ctx.start();
```

- [ ] **Step 3: 浏览器验证**

Run: `npm run dev`
Expected: 场景中出现一架八轴无人机（中心板 + 8 机臂/电机/桨 + 电池/飞控/GPS/脚架），可旋转查看。截图确认后 Ctrl-C。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: 建造器——数据驱动生成带标注多旋翼模型 + 高亮/材料上色

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 空气动力学可视化（箭头 + 流线）

**Files:**
- Create: `src/viz/viz.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `computeLift`、`computeWeight`、`liftStatus`、`windVector`、`MATERIALS` (Task 3)
- Produces:
  - `createViz(scene)` → `{ update(aeroState), tick(dt) }`。
  - `update(aeroState)`：`aeroState = { lift, weight, status, wind:{x,z} }`；据此设升力箭头长度（绿）、重力箭头（红）、风箭头（青），status=stall 时升力箭头变红闪烁色。
  - `tick(dt)`：推进气流粒子沿风向 + 向下下洗（downwash）流动，循环复位。

- [ ] **Step 1: 写 viz.js**

Create `src/viz/viz.js`:
```js
import * as THREE from 'three';

export function createViz(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const lift = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.1, 0), 1, 0x22c55e, 0.15, 0.09);
  const gravity = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0.1, 0), 1, 0xef4444, 0.15, 0.09);
  const wind = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1.2, 0.3, 0), 1, 0x22d3ee, 0.15, 0.09);
  group.add(lift, gravity, wind);

  // 气流粒子
  const N = 200;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const seed = [];
  for (let i = 0; i < N; i++) {
    const p = [(Math.random() - 0.5) * 2, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 2];
    seed.push(p); pos.set(p, i * 3);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x7dd3fc, size: 0.03 }));
  group.add(points);

  let windVec = { x: 0, z: 0 };

  function update(s) {
    const liftLen = Math.min(2, 0.2 + s.lift / 400);
    lift.setLength(liftLen, 0.15, 0.09);
    lift.setColor(s.status === 'stall' ? 0xf97316 : 0x22c55e);
    gravity.setLength(Math.min(2, 0.2 + s.weight / 400), 0.15, 0.09);
    const wlen = Math.hypot(s.wind.x, s.wind.z);
    wind.visible = wlen > 0.01;
    if (wlen > 0.01) {
      wind.setDirection(new THREE.Vector3(s.wind.x, 0, s.wind.z).normalize());
      wind.setLength(Math.min(2, 0.3 + wlen / 15), 0.15, 0.09);
    }
    windVec = s.wind;
  }

  function tick(dt) {
    const arr = geo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      arr[i * 3]     += (windVec.x * 0.02 + 0) * dt * 60 / 60;
      arr[i * 3 + 1] -= 0.6 * dt;            // 下洗
      arr[i * 3 + 2] += windVec.z * 0.02 * dt * 60 / 60;
      if (arr[i * 3 + 1] < -0.6) {           // 复位
        arr.set(seed[i], i * 3);
      }
    }
    geo.attributes.position.needsUpdate = true;
  }

  return { update, tick };
}
```

- [ ] **Step 2: main.js 接入可视化 + aero 计算**

Replace `src/main.js`:
```js
import { createScene } from './scene/scene.js';
import { buildDrone, DRONES } from './builder/builder.js';
import { createViz } from './viz/viz.js';
import { computeLift, computeWeight, liftStatus, windVector } from './aero/aero.js';

const ctx = createScene(document.getElementById('app'));
const subtype = DRONES.multirotor.subtypes.octa;
const { group } = buildDrone(subtype, 'carbon');
ctx.scene.add(group);

const viz = createViz(ctx.scene);
const params = { aoaDeg: 8, windSpeed: 4, windDirDeg: 0, materialId: 'carbon' };

function recompute() {
  const lift = computeLift({ rotorCount: subtype.rotorCount, bladeSpeed: 55, refArea: 0.02, aoaDeg: params.aoaDeg, airDensity: 1.225 });
  const weight = computeWeight({ bodyVolume: 6, materialId: params.materialId });
  viz.update({ lift, weight, status: liftStatus(lift, weight), wind: windVector(params.windSpeed, params.windDirDeg) });
}
recompute();

let last = performance.now();
ctx.start(() => {
  const now = performance.now();
  viz.tick((now - last) / 1000);
  last = now;
});
```

- [ ] **Step 3: 浏览器验证**

Run: `npm run dev`
Expected: 无人机周围出现绿色升力箭头、红色重力箭头、青色风箭头，蓝色粒子向下/顺风飘动并循环。截图确认后 Ctrl-C。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: 空气动力学可视化（升力/重力/风箭头 + 气流粒子流线）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: 状态管理 + 控制/信息面板

**Files:**
- Create: `src/state.js`
- Create: `src/ui/ui.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `DRONES` (Task 4)、`MATERIALS` (Task 3)
- Produces:
  - `state.js`：`createState(initial)` → `{ get(), set(patch), subscribe(fn) }`。`set` 浅合并并通知订阅者。
  - `ui.js`：`createUI(panelEl, { state, onSubtypeChange })` 渲染子类选择、迎角/风速/风向滑块、材料下拉；读写 `state`。`renderPartInfo(panelEl, part)` 显示选中部件信息；`renderReadout(el, { lift, weight, status, material })` 显示升力/重量/状态/材料适用场景（含"示意值"标注）。

- [ ] **Step 1: 写 state.js**

Create `src/state.js`:
```js
export function createState(initial) {
  let state = { ...initial };
  const subs = new Set();
  return {
    get: () => state,
    set(patch) { state = { ...state, ...patch }; subs.forEach((f) => f(state)); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
```

- [ ] **Step 2: 写 ui.js**

Create `src/ui/ui.js`:
```js
import { DRONES } from '../data/drones.js';
import { MATERIALS } from '../aero/aero.js';

function slider(label, id, min, max, val, step) {
  return `<label style="display:block;margin:8px 0">${label}
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" style="width:100%">
    <span id="${id}-v">${val}</span></label>`;
}

export function createUI(panel, { state, onSubtypeChange }) {
  const s = state.get();
  const subs = DRONES.multirotor.subtypes;
  panel.innerHTML = `
    <h2 style="margin-bottom:8px">无人机空气动力学实验室</h2>
    <div style="opacity:.6;font-size:12px;margin-bottom:12px">多旋翼 · 示意值，非精确工程值</div>
    <label>子类
      <select id="subtype" style="width:100%;margin:4px 0 12px">
        ${Object.entries(subs).map(([k, v]) => `<option value="${k}" ${k === s.subtype ? 'selected' : ''}>${v.name}</option>`).join('')}
      </select></label>
    ${slider('迎角 (°)', 'aoa', 0, 30, s.aoaDeg, 1)}
    ${slider('风速 (m/s)', 'wind', 0, 15, s.windSpeed, 0.5)}
    ${slider('风向 (°)', 'wdir', 0, 360, s.windDirDeg, 5)}
    <label>材料
      <select id="material" style="width:100%;margin:4px 0 12px">
        ${Object.values(MATERIALS).map((m) => `<option value="${m.id}" ${m.id === s.materialId ? 'selected' : ''}>${m.name}</option>`).join('')}
      </select></label>
    <div id="readout" style="margin-top:12px"></div>
    <div id="partinfo" style="margin-top:12px;padding-top:12px;border-top:1px solid #333"></div>
  `;

  panel.querySelector('#subtype').onchange = (e) => { state.set({ subtype: e.target.value }); onSubtypeChange(); };
  const bind = (id, key, cast) => {
    const el = panel.querySelector(`#${id}`);
    el.oninput = () => {
      panel.querySelector(`#${id}-v`).textContent = el.value;
      state.set({ [key]: cast(el.value) });
    };
  };
  bind('aoa', 'aoaDeg', Number);
  bind('wind', 'windSpeed', Number);
  bind('wdir', 'windDirDeg', Number);
  panel.querySelector('#material').onchange = (e) => state.set({ materialId: e.target.value });
}

export function renderReadout(el, { lift, weight, status, material }) {
  const label = { climb: '爬升 ▲', hover: '悬停 ●', stall: '升力不足 ▼' }[status];
  el.innerHTML = `
    <div>升力：${lift.toFixed(0)} N（示意）</div>
    <div>重量：${weight.toFixed(0)} N（示意）</div>
    <div style="margin:4px 0;font-weight:600">状态：${label}</div>
    <div style="opacity:.8;font-size:12px">${material.name} 适用：${material.useCase}</div>`;
}

export function renderPartInfo(el, part) {
  el.innerHTML = part
    ? `<div style="font-weight:600">${part.name}</div><div style="opacity:.8;margin-top:4px">${part.desc}</div>`
    : `<div style="opacity:.6">点击机身部件查看说明</div>`;
}
```

- [ ] **Step 3: main.js 接状态 + UI（暂不接点击拾取）**

Replace `src/main.js`:
```js
import { createScene } from './scene/scene.js';
import { buildDrone, DRONES, applyMaterial } from './builder/builder.js';
import { createViz } from './viz/viz.js';
import { computeLift, computeWeight, liftStatus, windVector, MATERIALS } from './aero/aero.js';
import { createState } from './state.js';
import { createUI, renderReadout, renderPartInfo } from './ui/ui.js';

const ctx = createScene(document.getElementById('app'));
const viz = createViz(ctx.scene);
const panel = document.getElementById('panel');

const state = createState({ subtype: 'octa', aoaDeg: 8, windSpeed: 4, windDirDeg: 0, materialId: 'carbon' });

let subtype, current;
function rebuild() {
  if (current) ctx.scene.remove(current.group);
  subtype = DRONES.multirotor.subtypes[state.get().subtype];
  current = buildDrone(subtype, state.get().materialId);
  ctx.scene.add(current.group);
}

function recompute() {
  const s = state.get();
  applyMaterial(current.meshes, subtype, s.materialId);
  const lift = computeLift({ rotorCount: subtype.rotorCount, bladeSpeed: 55, refArea: 0.02, aoaDeg: s.aoaDeg, airDensity: 1.225 });
  const weight = computeWeight({ bodyVolume: 6, materialId: s.materialId });
  const status = liftStatus(lift, weight);
  viz.update({ lift, weight, status, wind: windVector(s.windSpeed, s.windDirDeg) });
  renderReadout(panel.querySelector('#readout'), { lift, weight, status, material: MATERIALS[s.materialId] });
}

rebuild();
createUI(panel, { state, onSubtypeChange: () => { rebuild(); recompute(); } });
renderPartInfo(panel.querySelector('#partinfo'), null);
state.subscribe(recompute);
recompute();

let last = performance.now();
ctx.start(() => { const now = performance.now(); viz.tick((now - last) / 1000); last = now; });
```

- [ ] **Step 4: 浏览器验证**

Run: `npm run dev`
Expected: 右侧面板出现子类下拉、三个滑块、材料下拉与读数。切子类模型重建；调迎角/风/材料时箭头、粒子、读数实时变化；材料改变机身颜色并显示适用场景；迎角>15° 时状态可显示"升力不足"。截图确认后 Ctrl-C。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 状态管理 + 控制/信息面板（子类/迎角/风/材料 + 读数）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: 部件点击拾取与高亮

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `highlightPart`、`renderPartInfo`、场景 `ctx`（camera/renderer）
- Produces: 点击画布用 Raycaster 命中部件 → 高亮 + 显示部件说明。

- [ ] **Step 1: main.js 增加拾取**

在 `src/main.js` 顶部 import 补上 `highlightPart`：
```js
import { buildDrone, DRONES, applyMaterial, highlightPart } from './builder/builder.js';
```
在文件末尾（`ctx.start(...)` 之前）追加：
```js
import * as THREE from 'three';
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
ctx.renderer.domElement.addEventListener('click', (e) => {
  const r = ctx.renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(mouse, ctx.camera);
  const hits = raycaster.intersectObjects(current.group.children, false);
  if (hits.length) {
    const part = hits[0].object.userData.part;
    highlightPart(current.meshes, part.id);
    renderPartInfo(panel.querySelector('#partinfo'), part);
  }
});
```
> 注：`import` 需置于文件顶部；将该 `import * as THREE` 移到其它 import 旁。

- [ ] **Step 2: 浏览器验证**

Run: `npm run dev`
Expected: 点击任一部件（如电机、机臂、电池）该部件高亮发蓝光，右下信息区显示其名称与作用；切子类后仍可点击新模型。截图确认后 Ctrl-C。

- [ ] **Step 3: 全量测试**

Run: `npm test`
Expected: 所有单测仍 PASS。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: 部件点击拾取——高亮 + 显示部件说明

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: 构建产物 + GitHub Pages 部署

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`

**Interfaces:**
- Consumes: 无
- Produces: push 到 `main` 时 GitHub Actions 构建并部署到 Pages。

- [ ] **Step 1: 本地验证构建**

Run: `npm run build && npm run preview`
Expected: `dist/` 生成，preview 打开 `/drone-aero-lab/` 能正常显示与交互。Ctrl-C。

- [ ] **Step 2: 写部署工作流**

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: 写 README.md**

Create `README.md`:
```markdown
# 无人机空气动力学实验室 (drone-aero-lab)

纯前端 Three.js 项目，用于学习无人机各部件结构与空气动力学（教学示意级）。
当前已实现多旋翼竖切：四/六/八轴结构展示，可调迎角、材料、风速、风向，实时示意升力与气流。

## 开发
```bash
npm install
npm run dev     # http://localhost:5173/drone-aero-lab/
npm test        # 运行空气动力学单测
```

## 部署
推送到 `main` 分支即由 GitHub Actions 自动构建并发布到 GitHub Pages。
需在仓库 Settings → Pages → Source 选择 **GitHub Actions**。

> 空气动力学为教学示意级简化模型，数值为示意，非精确工程值。
```

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: GitHub Pages 部署工作流 + README

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5（需用户操作）: 推送与开启 Pages**

创建 GitHub 仓库并推送后，在仓库 Settings → Pages → Source 选 GitHub Actions。等待 Action 完成后访问 `https://<user>.github.io/drone-aero-lab/`。

---

## 自查（Self-Review）

- **Spec 覆盖**：结构展示→Task 4/5/8；四/六/八轴子类→Task 4/7；迎角/材料/风速/风向参数→Task 3/6/7；升力与气流可视化→Task 6；材料影响重量+适用场景→Task 3/7；Vite+Pages→Task 1/9；aero TDD→Task 3；扩展预留（DRONES 顶层可加 helicopter/vtol）→Task 4 数据结构。全部有对应任务。
- **占位符**：无 TODO/TBD；每个代码步骤含完整代码。
- **类型一致**：`buildDrone`→`{group,meshes}`、`meshes[id].userData.part`、`viz.update({lift,weight,status,wind})`、`state.{get,set,subscribe}`、`MATERIALS[id].{name,color,useCase,density}` 在各任务间一致。
```
