# 直升机分类 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增直升机分类（单旋翼带尾桨 / 共轴双旋翼）：反扭矩+尾桨平衡（机身真实自旋）、总距升力（复用 α 体系）、周期变距→前飞、自转下滑，并启用真正的分类选择器。

**Architecture:** 沿用 data→builder→aero→viz→ui。直升机部件全声明式（无机臂展开），统一 `getSubtypeParts` 入口；主旋翼复用点对称扭转桨叶几何；新增 viz/heli.js（扭矩弧+尾桨推力箭头）；main.js 按分类分派 recompute 与动画。

**Tech Stack:** Vite、Three.js、原生 ES 模块、Vitest。

## Global Constraints

- 纯前端静态，Vite `base:'/drone-aero-lab/'`；3D 程序化；教学示意级（标注示意值）；UI 中文；升力/颜色连续。
- 坐标：局部帧 Y-up（content 组映射到世界 Z-up）；机身前方 = 局部 +X。
- 多旋翼路径行为不变（现有 31 项测试回归必须全绿）。
- 直升机常量：反扭矩 k=0.12；尾桨推力 kt=1.6、尾桨距 0..12°；yawRate ky=0.05；周期变距 0..15°；自转阈值 α≤6°、rpmFactor 0.85/衰减至 0.2；共轴升力折减 0.85。
- commit 末尾附：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

## File Structure

- `src/aero/aero.js` / `aero.test.js` — 直升机纯函数（TDD）
- `src/data/drones.js` — `DRONES.helicopter` 两子类部件 + `getSubtypeParts`
- `src/data/drones.test.js` — 直升机数据测试
- `src/builder/builder.js` — `applyBladeTwist` 跳过尾桨；`applyMaterial`/`buildDrone` 改用 `getSubtypeParts`
- `src/viz/heli.js` — 扭矩弧箭头 + 尾桨推力箭头（新建）
- `src/viz/viz.js` — `setRotors` 支持自定义高度 y；下洗方向参数 `flowDir`
- `src/ui/ui.js` — 分类选择器 + 直升机控件（尾桨距/周期变距/发动机）+ 读数追加 + 图例
- `src/main.js` — 分类分派、直升机 recompute、偏航/旋翼/尾桨/倾斜动画

---

### Task 1: aero 直升机纯函数（TDD）

**Files:**
- Modify: `src/aero/aero.js`
- Test: `src/aero/aero.test.js`

**Interfaces:**
- Produces（后续任务依赖，签名精确）:
  - `mainRotorTorque(totalLift, rotorLen)` → number（示意 N·m）
  - `tailRotorThrust(tailPitchDeg, rpm)` → number
  - `yawRate({ torque, tailThrust, tailArm })` → number（rad/s；正=向主旋翼反方向自旋）
  - `cyclicSplit(totalLift, cyclicDeg)` → `{ vertical, forward }`
  - `autorotation({ engineOn, aoaDeg })` → `{ mode:'powered'|'autorotation'|'crash', rpmFactor, descentRate }`

- [ ] **Step 1: 追加失败测试**

在 `src/aero/aero.test.js` 末尾追加：
```js
import { mainRotorTorque, tailRotorThrust, yawRate, cyclicSplit, autorotation } from './aero.js';

describe('mainRotorTorque', () => {
  it('随升力与桨长增大', () => {
    expect(mainRotorTorque(200, 1.6)).toBeGreaterThan(mainRotorTorque(100, 1.6));
    expect(mainRotorTorque(200, 1.6)).toBeGreaterThan(mainRotorTorque(200, 1.2));
  });
});

describe('tailRotorThrust', () => {
  it('随尾桨距与转速增大，0 距为 0', () => {
    expect(tailRotorThrust(0, 2200)).toBe(0);
    expect(tailRotorThrust(8, 2200)).toBeGreaterThan(tailRotorThrust(4, 2200));
    expect(tailRotorThrust(8, 3000)).toBeGreaterThan(tailRotorThrust(8, 2200));
  });
});

describe('yawRate', () => {
  it('尾桨推力×力臂=扭矩时为零（平衡）', () => {
    expect(yawRate({ torque: 24, tailThrust: 16, tailArm: 1.5 })).toBeCloseTo(0, 5);
  });
  it('尾桨不足→正（自旋），过强→负', () => {
    expect(yawRate({ torque: 24, tailThrust: 5, tailArm: 1.5 })).toBeGreaterThan(0);
    expect(yawRate({ torque: 24, tailThrust: 30, tailArm: 1.5 })).toBeLessThan(0);
  });
});

describe('cyclicSplit', () => {
  it('0° 全部垂直；分量满足勾股', () => {
    const z = cyclicSplit(100, 0);
    expect(z.vertical).toBeCloseTo(100, 5);
    expect(z.forward).toBeCloseTo(0, 5);
    const s = cyclicSplit(100, 10);
    expect(Math.hypot(s.vertical, s.forward)).toBeCloseTo(100, 5);
    expect(s.forward).toBeGreaterThan(0);
  });
});

describe('autorotation', () => {
  it('有动力→powered', () => {
    expect(autorotation({ engineOn: true, aoaDeg: 8 }).mode).toBe('powered');
  });
  it('无动力小总距→自转维持', () => {
    const r = autorotation({ engineOn: false, aoaDeg: 4 });
    expect(r.mode).toBe('autorotation');
    expect(r.rpmFactor).toBeCloseTo(0.85, 5);
    expect(r.descentRate).toBeGreaterThan(0);
  });
  it('无动力大总距→crash，rpmFactor 随 α 单调下降', () => {
    const a = autorotation({ engineOn: false, aoaDeg: 10 });
    const b = autorotation({ engineOn: false, aoaDeg: 20 });
    expect(a.mode).toBe('crash');
    expect(b.rpmFactor).toBeLessThan(a.rpmFactor);
    expect(b.rpmFactor).toBeGreaterThanOrEqual(0.2);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test` — Expected: FAIL，新函数未定义。

- [ ] **Step 3: 实现**

在 `src/aero/aero.js` 末尾追加：
```js
// ===== 直升机（教学示意级） =====
const TORQUE_K = 0.12;
const TAIL_KT = 1.6;
const YAW_KY = 0.05;

export function mainRotorTorque(totalLift, rotorLen) {
  return TORQUE_K * totalLift * rotorLen;
}

export function tailRotorThrust(tailPitchDeg, rpm) {
  const n = rpm / 2200;
  return TAIL_KT * tailPitchDeg * n * n;
}

export function yawRate({ torque, tailThrust, tailArm }) {
  return (torque - tailThrust * tailArm) * YAW_KY;
}

export function cyclicSplit(totalLift, cyclicDeg) {
  const r = cyclicDeg * Math.PI / 180;
  return { vertical: totalLift * Math.cos(r), forward: totalLift * Math.sin(r) };
}

export function autorotation({ engineOn, aoaDeg }) {
  if (engineOn) return { mode: 'powered', rpmFactor: 1, descentRate: 0 };
  if (aoaDeg <= 6) return { mode: 'autorotation', rpmFactor: 0.85, descentRate: 4 };
  // 总距过大：旋翼被气流拖慢，α 越大衰减越多（10°→0.7 线性降至 30°→0.2）
  const f = Math.max(0.2, 0.7 - (aoaDeg - 10) * 0.025);
  return { mode: 'crash', rpmFactor: f, descentRate: 10 + (aoaDeg - 6) * 0.3 };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test` — Expected: PASS（31 + 新增全绿）。

- [ ] **Step 5: 提交**

```bash
git add src/aero/aero.js src/aero/aero.test.js
git commit -m "feat(aero): 直升机纯函数——反扭矩/尾桨推力/偏航/周期变距/自转

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 直升机部件数据 + getSubtypeParts 统一入口（TDD）

**Files:**
- Modify: `src/data/drones.js`
- Test: `src/data/drones.test.js`
- Modify: `src/builder/builder.js`

**Interfaces:**
- Produces:
  - `DRONES.helicopter.subtypes.{tailrotor|coaxial}`：`{ name, config, mainRotorLen, tailArm?, parts:[Part] }`
  - Part 新增可选标记：`mainRotor: true`、`tailRotor: true`
  - `getSubtypeParts(subtype)` → Part 数组（多旋翼走 `buildSubtypeParts` 展开，直升机直接返回 `parts`）
  - builder：`applyBladeTwist` 只作用于**非尾桨** blade；`applyMaterial`、`buildDrone` 改用 `getSubtypeParts`

- [ ] **Step 1: 追加失败测试**

在 `src/data/drones.test.js` 末尾追加：
```js
import { getSubtypeParts } from './drones.js';

describe('DRONES.helicopter', () => {
  it('含 tailrotor 与 coaxial 两子类', () => {
    expect(Object.keys(DRONES.helicopter.subtypes)).toEqual(
      expect.arrayContaining(['tailrotor', 'coaxial']),
    );
  });
  it('tailrotor 有且仅有一个主旋翼与一个尾桨；coaxial 两主旋翼无尾桨', () => {
    const tr = getSubtypeParts(DRONES.helicopter.subtypes.tailrotor);
    expect(tr.filter((p) => p.mainRotor)).toHaveLength(1);
    expect(tr.filter((p) => p.tailRotor)).toHaveLength(1);
    const co = getSubtypeParts(DRONES.helicopter.subtypes.coaxial);
    expect(co.filter((p) => p.mainRotor)).toHaveLength(2);
    expect(co.filter((p) => p.tailRotor)).toHaveLength(0);
  });
  it('coaxial 两主旋翼 spin 相反', () => {
    const spins = getSubtypeParts(DRONES.helicopter.subtypes.coaxial)
      .filter((p) => p.mainRotor).map((p) => p.spin);
    expect(new Set(spins)).toEqual(new Set(['cw', 'ccw']));
  });
  it('getSubtypeParts 对多旋翼等价于 buildSubtypeParts', () => {
    const st = DRONES.multirotor.subtypes.quad;
    expect(getSubtypeParts(st)).toHaveLength(buildSubtypeParts(st).length);
  });
  it('每个直升机部件都有 name/desc/geometry', () => {
    for (const st of Object.values(DRONES.helicopter.subtypes)) {
      for (const p of getSubtypeParts(st)) {
        expect(p.name).toBeTruthy();
        expect(p.desc).toBeTruthy();
        expect(p.geometry).toBeTruthy();
      }
    }
  });
});
```
（文件顶部已 import `DRONES, buildSubtypeParts`；补 `getSubtypeParts` 到该 import。）

- [ ] **Step 2: 运行确认失败**

Run: `npm test` — Expected: FAIL。

- [ ] **Step 3: drones.js 加直升机数据与入口**

在 `src/data/drones.js` 的 `DRONES` 对象中 `multirotor` 之后加 `helicopter`（注意机身前方=+X，高度=y；尾桨**不设** rotation——动画每帧合成朝向）：
```js
  helicopter: {
    name: '直升机',
    subtypes: {
      tailrotor: {
        name: '单旋翼带尾桨', config: 'tailrotor', mainRotorLen: 1.6, tailArm: 1.5,
        parts: [
          { id: 'fuselage', name: '机身', desc: '承载动力、燃料/电池与航电的主体结构。',
            geometry: { type: 'box', args: [1.0, 0.42, 0.42] }, position: [0, 0.30, 0], materialRole: 'structural' },
          { id: 'cockpit', name: '座舱', desc: '驾驶/任务设备舱段。',
            geometry: { type: 'box', args: [0.34, 0.30, 0.36] }, position: [0.55, 0.34, 0], materialRole: 'fixed', color: 0x93c5fd },
          { id: 'engine', name: '发动机/主减速器', desc: '驱动主旋翼与尾桨；主减把高转速降到旋翼转速。',
            geometry: { type: 'box', args: [0.30, 0.18, 0.30] }, position: [-0.20, 0.56, 0], materialRole: 'fixed', color: 0xf59e0b },
          { id: 'mast', name: '主轴', desc: '把动力传给主旋翼的旋转轴。',
            geometry: { type: 'cylinder', args: [0.03, 0.03, 0.26, 10] }, position: [0, 0.70, 0], materialRole: 'fixed', color: 0x94a3b8 },
          { id: 'mainHub', name: '主桨毂', desc: '连接桨叶与主轴，容纳变距机构。',
            geometry: { type: 'cylinder', args: [0.07, 0.07, 0.06, 12] }, position: [0, 0.84, 0], materialRole: 'fixed', color: 0x64748b },
          { id: 'mainRotor', name: '主旋翼', desc: '产生升力的核心。总距=所有桨叶同时变距（即桨叶迎角 α）。',
            geometry: { type: 'blade', args: [1.6, 0.09] }, position: [0, 0.88, 0], materialRole: 'fixed', color: 0xcbd5e1,
            mainRotor: true, spin: 'cw' },
          { id: 'tailboom', name: '尾梁', desc: '延伸到尾部，安装尾桨与尾面。',
            geometry: { type: 'cylinder', args: [0.05, 0.03, 1.05, 10] }, position: [-1.0, 0.42, 0], rotation: [0, 0, Math.PI / 2], materialRole: 'structural' },
          { id: 'fin', name: '垂尾', desc: '提供航向安定性，并安装尾桨。',
            geometry: { type: 'box', args: [0.14, 0.36, 0.02] }, position: [-1.5, 0.55, 0], materialRole: 'structural' },
          { id: 'stab', name: '平尾', desc: '提供俯仰安定性。',
            geometry: { type: 'box', args: [0.14, 0.02, 0.40] }, position: [-1.25, 0.46, 0], materialRole: 'structural' },
          { id: 'tailRotor', name: '尾桨', desc: '产生侧向推力抵消主旋翼反扭矩——没有它机身会自旋。',
            geometry: { type: 'blade', args: [0.40, 0.05] }, position: [-1.52, 0.55, 0.06], materialRole: 'fixed', color: 0xcbd5e1,
            tailRotor: true, spin: 'cw' },
          { id: 'skidL', name: '起落橇', desc: '滑橇式起落架，轻且结构简单。',
            geometry: { type: 'cylinder', args: [0.02, 0.02, 1.0, 8] }, position: [0.05, 0.05, 0.24], rotation: [0, 0, Math.PI / 2], materialRole: 'structural' },
          { id: 'skidR', name: '起落橇', desc: '滑橇式起落架，轻且结构简单。',
            geometry: { type: 'cylinder', args: [0.02, 0.02, 1.0, 8] }, position: [0.05, 0.05, -0.24], rotation: [0, 0, Math.PI / 2], materialRole: 'structural' },
        ],
      },
      coaxial: {
        name: '共轴双旋翼', config: 'coaxial', mainRotorLen: 1.4,
        parts: [
          { id: 'fuselage', name: '机身', desc: '共轴构型机身更紧凑，无长尾梁需求。',
            geometry: { type: 'box', args: [0.82, 0.40, 0.40] }, position: [0, 0.28, 0], materialRole: 'structural' },
          { id: 'cockpit', name: '座舱', desc: '驾驶/任务设备舱段。',
            geometry: { type: 'box', args: [0.30, 0.28, 0.34] }, position: [0.46, 0.32, 0], materialRole: 'fixed', color: 0x93c5fd },
          { id: 'engine', name: '发动机/主减速器', desc: '通过同轴反转齿轮组驱动上下两副旋翼。',
            geometry: { type: 'box', args: [0.28, 0.18, 0.28] }, position: [-0.14, 0.52, 0], materialRole: 'fixed', color: 0xf59e0b },
          { id: 'mast', name: '共轴主轴', desc: '内外套轴反向旋转，分别驱动上下旋翼。',
            geometry: { type: 'cylinder', args: [0.035, 0.035, 0.46, 10] }, position: [0, 0.76, 0], materialRole: 'fixed', color: 0x94a3b8 },
          { id: 'hubLower', name: '下桨毂', desc: '下旋翼桨毂。',
            geometry: { type: 'cylinder', args: [0.065, 0.065, 0.05, 12] }, position: [0, 0.86, 0], materialRole: 'fixed', color: 0x64748b },
          { id: 'rotorLower', name: '下主旋翼', desc: '与上旋翼反向旋转，扭矩相互抵消——所以不需要尾桨。',
            geometry: { type: 'blade', args: [1.4, 0.085] }, position: [0, 0.90, 0], materialRole: 'fixed', color: 0xcbd5e1,
            mainRotor: true, spin: 'ccw' },
          { id: 'hubUpper', name: '上桨毂', desc: '上旋翼桨毂。',
            geometry: { type: 'cylinder', args: [0.065, 0.065, 0.05, 12] }, position: [0, 1.04, 0], materialRole: 'fixed', color: 0x64748b },
          { id: 'rotorUpper', name: '上主旋翼', desc: '与下旋翼反向旋转，扭矩相互抵消。',
            geometry: { type: 'blade', args: [1.4, 0.085] }, position: [0, 1.08, 0], materialRole: 'fixed', color: 0xcbd5e1,
            mainRotor: true, spin: 'cw' },
          { id: 'tailboom', name: '短尾梁', desc: '共轴构型尾梁短，仅安装尾面。',
            geometry: { type: 'cylinder', args: [0.04, 0.025, 0.6, 10] }, position: [-0.68, 0.40, 0], rotation: [0, 0, Math.PI / 2], materialRole: 'structural' },
          { id: 'fin', name: '垂尾', desc: '航向安定面（无尾桨）。',
            geometry: { type: 'box', args: [0.12, 0.28, 0.02] }, position: [-0.96, 0.50, 0], materialRole: 'structural' },
          { id: 'skidL', name: '起落橇', desc: '滑橇式起落架。',
            geometry: { type: 'cylinder', args: [0.02, 0.02, 0.9, 8] }, position: [0.02, 0.05, 0.22], rotation: [0, 0, Math.PI / 2], materialRole: 'structural' },
          { id: 'skidR', name: '起落橇', desc: '滑橇式起落架。',
            geometry: { type: 'cylinder', args: [0.02, 0.02, 0.9, 8] }, position: [0.02, 0.05, -0.22], rotation: [0, 0, Math.PI / 2], materialRole: 'structural' },
        ],
      },
    },
  },
```
在文件末尾追加统一入口：
```js
export function getSubtypeParts(subtype) {
  return subtype.arms ? buildSubtypeParts(subtype) : subtype.parts;
}
```

- [ ] **Step 4: builder.js 改用 getSubtypeParts 并跳过尾桨变距**

在 `src/builder/builder.js`：
① import 行补 `getSubtypeParts`：
```js
import { buildSubtypeParts, getSubtypeParts, DRONES } from '../data/drones.js';
```
② `buildDrone`、`applyMaterial` 中的 `buildSubtypeParts(subtype)` 全部改为 `getSubtypeParts(subtype)`。
③ `applyBladeTwist` 循环条件改为跳过尾桨（尾桨距独立，不随 α）：
```js
    if (part.geometry.type === 'blade' && !part.tailRotor && meshes[part.id]) {
```
且其内部 `buildSubtypeParts(subtype)` 同样改为 `getSubtypeParts(subtype)`。
④ 末尾 export 补 `getSubtypeParts`：
```js
export { DRONES, buildSubtypeParts, getSubtypeParts };
```

- [ ] **Step 5: 运行确认通过**

Run: `npm test` — Expected: PASS（含回归）。`npm run build` 成功。

- [ ] **Step 6: 提交**

```bash
git add src/data/drones.js src/data/drones.test.js src/builder/builder.js
git commit -m "feat(data): 直升机两子类部件数据 + getSubtypeParts 统一入口

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: viz —— 扭矩弧/尾桨推力箭头 + viz.js 小扩展

**Files:**
- Create: `src/viz/heli.js`
- Modify: `src/viz/viz.js`

**Interfaces:**
- Produces:
  - `createHeliViz(group, subtype)` → `{ update({ torque, tailThrust }), dispose() }`：往机身 group 添加扭矩弧箭头（tailrotor 一条；coaxial 两条反向并互相抵消的弧）与尾桨推力箭头（仅 tailrotor）；`update` 按数值缩放透明度/长度；`dispose` 移除并释放材质/几何。
  - viz.js：`setRotors(rotors)` 的 rotor 支持 `{ x, z, y? }`（y 缺省为原 ROTOR_Y）；`update(s)` 新增可选 `s.flowDir`（1=下洗默认，-1=自转上行），`tick` 据此反向粒子。

- [ ] **Step 1: 写 heli.js**

Create `src/viz/heli.js`:
```js
import * as THREE from 'three';

// 绕 Y 轴的弧形箭头（扭矩示意）：半径 r、高度 y、弧 250°，末端加锥头
function makeArc(r, y, color, flip = false) {
  const pts = [];
  const a0 = 0, a1 = Math.PI * 1.4;
  for (let i = 0; i <= 40; i++) {
    const a = a0 + (a1 - a0) * (i / 40) * (flip ? -1 : 1);
    pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 40, 0.012, 6, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }),
  );
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.14, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }),
  );
  const end = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  head.position.copy(end);
  head.lookAt(end.clone().add(end.clone().sub(prev)));
  head.rotateX(Math.PI / 2);
  const g = new THREE.Group();
  g.add(tube, head);
  return { group: g, mats: [tube.material, head.material], geos: [tube.geometry, head.geometry] };
}

export function createHeliViz(group, subtype) {
  const root = new THREE.Group();
  group.add(root);
  const mats = [], geos = [];
  const track = (a) => { mats.push(...a.mats); geos.push(...a.geos); root.add(a.group); };

  const arcs = [];
  if (subtype.config === 'coaxial') {
    const up = makeArc(0.55, 1.12, 0xf97316, false);   // 上旋翼反扭矩
    const dn = makeArc(0.55, 0.82, 0x38bdf8, true);    // 下旋翼反扭矩（反向）
    track(up); track(dn); arcs.push(up, dn);
  } else {
    const arc = makeArc(0.6, 0.92, 0xf97316, false);   // 主旋翼反扭矩（机身被反向拧）
    track(arc); arcs.push(arc);
  }

  // 尾桨推力箭头（仅 tailrotor）：沿 +Z（侧向）
  let tailArrow = null;
  if (subtype.config === 'tailrotor') {
    tailArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1.52, 0.55, 0.1), 0.4, 0x22d3ee, 0.1, 0.06,
    );
    root.add(tailArrow);
  }

  function update({ torque, tailThrust }) {
    const t = Math.max(0.15, Math.min(1, torque / 200));
    for (const a of arcs) a.group.children.forEach((m) => { m.material.opacity = 0.25 + 0.65 * t; });
    if (tailArrow) {
      tailArrow.setLength(Math.max(0.08, Math.min(0.9, tailThrust / 40)), 0.1, 0.06);
      tailArrow.visible = tailThrust > 0.01;
    }
  }

  function dispose() {
    group.remove(root);
    mats.forEach((m) => m.dispose());
    geos.forEach((g) => g.dispose());
    if (tailArrow) { tailArrow.line.material.dispose(); tailArrow.cone.material.dispose(); }
  }

  return { update, dispose };
}
```

- [ ] **Step 2: viz.js 支持 rotor 高度与气流方向**

在 `src/viz/viz.js`：
① `setRotors` 与 `writeParticle` 里的固定 `ROTOR_Y` 改用每 rotor 的 y：`setRotors(rs)` 存 `rotors = rs.map(r => ({ y: ROTOR_Y, ...r }))`；`writeParticle` 中所有 `ROTOR_Y` 替换为 `rotor.y`；每旋翼升力箭头位置 y 用 `r.y + 0.06`。
② 模块内加 `let flowDir = 1;`；`update(s)` 末尾加 `flowDir = s.flowDir ?? 1;`；`writeParticle` 的两段 y 计算改为随方向翻转：
```js
    if (phase < 0.35) {
      const t = phase / 0.35;
      y = rotor.y + flowDir * INTAKE_H * (1 - t);
      x = rotor.x + (1 - t) * jitter * 6;
    } else {
      const t = (phase - 0.35) / 0.65;
      y = rotor.y - flowDir * DOWN_H * t;
      ...
```
（flowDir=-1 时吸入口在下方、流出在上方=自转上行气流。）

- [ ] **Step 3: 验证**

Run: `npm run build`（成功）；`npm test`（全绿——多旋翼回归含 setRotors 默认 y 行为不变）。

- [ ] **Step 4: 提交**

```bash
git add src/viz/heli.js src/viz/viz.js
git commit -m "feat(viz): 扭矩弧/尾桨推力箭头 + 下洗方向与 rotor 高度参数化

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: UI —— 分类选择器 + 直升机控件 + 读数/图例

**Files:**
- Modify: `src/ui/ui.js`

**Interfaces:**
- Consumes: `DRONES`（两分类）、现有 slider/card/bind 机制
- Produces:
  - `createUI(panel, { state, onSubtypeChange, onCategoryChange })`：机型卡"分类"变为下拉（`#category`，选项来自 `Object.entries(DRONES)`），选中后子类下拉只列该分类子类；直升机分类时飞行参数卡追加：**尾桨距** slider（`#tailpitch`，0..12°，绑 `tailPitch`，仅 `config==='tailrotor'` 子类显示）、**周期变距** slider（`#cyclic`，0..15°，绑 `cyclicDeg`）、**发动机** checkbox 开关（`#engine`，绑 `engineOn`，label "发动机（关闭演示自转）"）。多旋翼分类时这些控件不渲染。
  - `renderReadout(el, data)`：`data.heli` 可选：`{ torque, tailThrust, yawState:'balanced'|'spinLeft'|'spinRight'|null, forward, mode, descentRate }`；存在时在倾角行之后追加：主旋翼扭矩、尾桨推力（tailrotor 才有 tailThrust!=null）、偏航（平衡 ●/左自旋 ↺/右自旋 ↻/共轴自平衡）、前飞分量、飞行模式（有动力/自转下滑（下降率 x m/s）/坠落警示——坠落用红色）。
  - 图例：直升机分类时追加两行（橙=主旋翼反扭矩弧、青=尾桨推力）与一句"发动机关闭→气流反向上行驱动旋翼（自转）"。

- [ ] **Step 1: 实现（结构性描述——集成到现有 token/class 风格，保持既有多旋翼渲染路径不变）**

createUI 重构点（完整逻辑，样式沿用现有 class）：
```js
export function createUI(panel, { state, onSubtypeChange, onCategoryChange }) {
  const s = state.get();
  const cat = DRONES[s.category ?? 'multirotor'];
  const subs = cat.subtypes;
  const isHeli = (s.category ?? 'multirotor') === 'helicopter';
  const curSub = subs[s.subtype];
  // 机型卡：
  //   分类 <select id="category">（Object.entries(DRONES) → option，selected=s.category）
  //   子类 <select id="subtype">（当前分类的 subtypes）
  // 飞行参数卡：现有滑块全保留；isHeli 时追加：
  //   ${curSub.config === 'tailrotor' ? slider('尾桨距', 'tailpitch', 0, 12, s.tailPitch ?? 6, 0.5, '°', 'var(--wind)') : ''}
  //   ${slider('周期变距', 'cyclic', 0, 15, s.cyclicDeg ?? 0, 1, '°', 'var(--warn)')}
  //   发动机开关：
  //   <label class="engine-row"><input type="checkbox" id="engine" ${ (s.engineOn ?? true) ? 'checked' : '' }> 发动机（关闭演示自转）</label>
  // 图例卡：isHeli 时追加 legendRow('#f97316','主旋翼反扭矩（弧形箭头）') + legendRow('#22d3ee','尾桨推力')
  //   + <div class="legend-note">发动机关闭→气流自下而上驱动旋翼（自转下滑）。</div>
  // 绑定：
  panel.querySelector('#category').onchange = (e) => {
    const c = e.target.value;
    state.set({ category: c, subtype: Object.keys(DRONES[c].subtypes)[0] });
    onCategoryChange();
  };
  // #subtype/滑块/材质绑定沿用现有 bind；isHeli 时补：
  //   bind('tailpitch','tailPitch',...)（存在才绑）; bind('cyclic','cyclicDeg',...);
  //   panel.querySelector('#engine').onchange = (e) => state.set({ engineOn: e.target.checked });
}
```
renderReadout 追加块（在倾角行后）：
```js
  ${data.heli ? `
    <div class="readout-row"><span>主旋翼扭矩</span><span class="readout-value">${data.heli.torque.toFixed(0)} N·m（示意）</span></div>
    ${data.heli.tailThrust != null ? `<div class="readout-row"><span>尾桨推力</span><span class="readout-value">${data.heli.tailThrust.toFixed(1)} N</span></div>` : ''}
    <div class="readout-row"><span>偏航</span><span class="readout-value">${
      data.heli.yawState === 'balanced' ? '平衡 ●' : data.heli.yawState === 'spinLeft' ? '左自旋 ↺' : data.heli.yawState === 'spinRight' ? '右自旋 ↻' : '共轴自平衡 ●'
    }</span></div>
    <div class="readout-row"><span>前飞分量</span><span class="readout-value">${data.heli.forward.toFixed(0)} N</span></div>
    <div class="readout-row"><span>飞行模式</span><span class="readout-value" ${data.heli.mode === 'crash' ? 'style="color:var(--weight)"' : ''}>${
      data.heli.mode === 'powered' ? '有动力' : data.heli.mode === 'autorotation' ? `自转下滑（约 ${data.heli.descentRate.toFixed(0)} m/s）` : '坠落警示！总距过大'
    }</span></div>` : ''}
```

- [ ] **Step 2: 验证**

Run: `npm run build`（成功）；`npm test`（全绿）。onCategoryChange 回调此时 main 还未提供——createUI 的调用方（main.js 现状）只传 onSubtypeChange，需给 `onCategoryChange` 缺省空函数 `= () => {}` 防炸。

- [ ] **Step 3: 提交**

```bash
git add src/ui/ui.js
git commit -m "feat(ui): 分类选择器 + 直升机控件(尾桨距/周期变距/发动机) + 读数图例

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: main —— 分类分派 recompute + 偏航/旋翼动画 + 自转气流

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: Task 1-4 全部产物（`mainRotorTorque/tailRotorThrust/yawRate/cyclicSplit/autorotation/getSubtypeParts/createHeliViz/新 createUI 签名`）
- Produces: 完整的直升机体验；多旋翼路径不变。

- [ ] **Step 1: state 与导入**

state 初始加：`category: 'multirotor', tailPitch: 6, cyclicDeg: 0, engineOn: true`。
导入补：`mainRotorTorque, tailRotorThrust, yawRate, cyclicSplit, autorotation`（aero）、`getSubtypeParts`（builder）、`createHeliViz`（'./viz/heli.js'）。`buildSubtypeParts` 的现有用法全部改为 `getSubtypeParts`。

- [ ] **Step 2: rebuild 分类化**

```js
const HELI_BODY_VOLUME = 48;   // 标定：直升机默认净升重比≈1.0-1.1（控制器实测微调）
let heliViz = null;
function rebuild() {
  if (current) { /* 现有 dispose 逻辑不变 */ }
  if (heliViz) { heliViz.dispose(); heliViz = null; }
  const s = state.get();
  subtype = DRONES[s.category].subtypes[s.subtype];
  current = buildDrone(subtype, s.materialId);
  ctx.content.add(current.group);
  if (s.category === 'multirotor') {
    const rotors = getSubtypeParts(subtype)
      .filter((p) => p.id.startsWith('motor'))
      .map((p) => ({ x: p.position[0], z: p.position[2] }));
    viz.setRotors(rotors);
  } else {
    // 主旋翼位置（含高度）作为下洗发射点；共轴取两副
    const rotors = getSubtypeParts(subtype)
      .filter((p) => p.mainRotor)
      .map((p) => ({ x: p.position[0], z: p.position[2], y: p.position[1] }));
    viz.setRotors(rotors);
    heliViz = createHeliViz(current.group, subtype);
  }
  yawAngle = 0;   // 切换机型复位偏航
}
```

- [ ] **Step 3: recompute 分类分派**

多旋翼分支 = 现有 recompute 内容原样。直升机分支：
```js
let heliState = { yawRate: 0, rpmFactor: 1 };
function recomputeHeli(s) {
  applyMaterial(current.meshes, subtype, s.materialId);
  const mainLen = subtype.mainRotorLen * (s.bladeLen / 0.42);
  applyBladeTwist(current.meshes, subtype, s.aoaDeg, mainLen);
  const auto = autorotation({ engineOn: s.engineOn, aoaDeg: s.aoaDeg });
  const aeroP = { bladeSpeed: bladeLinearSpeed(s.rpm, mainLen) * auto.rpmFactor, refArea: mainLen * (0.02 / 0.42), aoaDeg: s.aoaDeg, airDensity: 1.225 };
  const nRotor = subtype.config === 'coaxial' ? 2 * 0.85 : 1;
  const totalLift = perRotorLift(aeroP) * nRotor;
  const cyc = cyclicSplit(totalLift, s.cyclicDeg);
  const weight = computeWeight({ bodyVolume: HELI_BODY_VOLUME, materialId: s.materialId });
  const net = netLift({ totalLift: cyc.vertical, weight, windSpeed: s.windSpeed, updraft: s.updraft ?? 0, airDensity: 1.225 });
  const torque = subtype.config === 'coaxial' ? 0 : mainRotorTorque(totalLift, mainLen);
  const tailThrust = subtype.config === 'tailrotor' ? tailRotorThrust(s.tailPitch, s.rpm) : null;
  const yr = subtype.config === 'tailrotor'
    ? yawRate({ torque, tailThrust, tailArm: subtype.tailArm })
    : 0;
  heliState = { yawRate: yr, rpmFactor: auto.rpmFactor };
  // 机身姿态：风倾 × 周期变距前倾（绕局部 Z 负向）——偏航在渲染循环叠加
  const wr = s.windDirDeg * Math.PI / 180;
  qWind.setFromAxisAngle(_axis.set(Math.sin(wr), 0, -Math.cos(wr)), net.tiltDeg * Math.PI / 180);
  qPitch.setFromAxisAngle(_axisZ, -s.cyclicDeg * Math.PI / 180);
  baseQuat.copy(qWind).multiply(qPitch);
  const wind = windVector3D(s.windSpeed, s.windDirDeg, s.updraft ?? 0);
  viz.update({ perLift: [], totalLift: cyc.vertical, effectiveLift: net.effectiveLift, weight, wind, flowDir: auto.mode === 'autorotation' ? -1 : 1 });
  heliViz.update({ torque, tailThrust: tailThrust ?? 0 });
  const aeroDrag = computeDrag({ ...aeroP, rotorCount: 1 });
  const yawState = subtype.config === 'coaxial' ? null : Math.abs(yr) < 0.02 ? 'balanced' : yr > 0 ? 'spinLeft' : 'spinRight';
  renderReadout(panel.querySelector('#readout'), {
    totalLift, net, weight, aoaDeg: s.aoaDeg, aeroDrag, material: MATERIALS[s.materialId],
    heli: { torque, tailThrust, yawState, forward: cyc.forward, mode: auto.mode, descentRate: auto.descentRate },
  });
  airfoil.draw(s.aoaDeg);
  aerochart.draw(s.aoaDeg);
}
```
模块级预置（避免每次分配）：
```js
const qWind = new THREE.Quaternion(), qPitch = new THREE.Quaternion(), qYaw = new THREE.Quaternion();
const baseQuat = new THREE.Quaternion();
const _axis = new THREE.Vector3(), _axisZ = new THREE.Vector3(0, 0, 1), _up = new THREE.Vector3(0, 1, 0);
let yawAngle = 0;
```
多旋翼分支的姿态改成同样写入 `baseQuat`（qPitch 置单位），渲染循环统一 `current.group.quaternion.copy(baseQuat).multiply(qYaw)`。

- [ ] **Step 4: 渲染循环——偏航自旋 + 主旋翼/尾桨动画**

```js
ctx.start(
  () => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    viz.tick(dt);
    const st = state.get();
    // 偏航（直升机不平衡时机身自旋）
    yawAngle += heliState.yawRate * dt;
    qYaw.setFromAxisAngle(_up, yawAngle);
    current.group.quaternion.copy(baseQuat).multiply(qYaw);
    // 旋翼/螺旋桨旋转
    spinAngle += (st.rpm / 60) * 2 * Math.PI * 0.05 * dt * heliState.rpmFactor;
    for (const mesh of Object.values(current.meshes)) {
      const p = mesh.userData.part;
      if (p.tailRotor) {
        // 尾桨：竖直平面内旋转（先倾 90° 再绕自身盘面转，×4 倍速）
        mesh.quaternion.setFromAxisAngle(_axisX, Math.PI / 2);
        _q.setFromAxisAngle(_up, spinAngle * 4);
        mesh.quaternion.multiply(_q);
      } else if (p.spin) {
        mesh.rotation.y = (p.spin === 'cw' ? -1 : 1) * spinAngle;
      }
    }
  },
  () => gizmo.render(),
);
```
（模块级补 `const _axisX = new THREE.Vector3(1, 0, 0), _q = new THREE.Quaternion();`；多旋翼时 `heliState = {yawRate:0, rpmFactor:1}` 保证行为不变。）

- [ ] **Step 5: createUI 接 onCategoryChange**

```js
createUI(panel, {
  state,
  onSubtypeChange: () => { rebuild(); recompute(); renderPartList(...); },
  onCategoryChange: () => {
    rebuild();
    createUI(panel, { state, onSubtypeChange: ..., onCategoryChange: ... });  // 控件随分类重建（抽成函数 refreshUI 避免递归字面量）
    recompute();
    renderPartList(panel.querySelector('#partlist'), getSubtypeParts(subtype), null, selectPart);
  },
});
```
实现时抽 `function refreshUI()` 封装 createUI 调用避免自引用问题；子类切换（同分类内 tailrotor↔coaxial）也需 refreshUI（尾桨距控件随构型出现/消失）：`onSubtypeChange` 内 rebuild 后调 refreshUI。

- [ ] **Step 6: 验证**

Run: `npm run build`（成功）；`npm test`（全绿回归）。`npm run dev` 短启无报错。
控制器浏览器里程碑：分类切换、尾桨距=0 时机身自旋、平衡点停转、共轴双弧无自旋、周期变距前倾+前飞分量、发动机关闭→气流反向+自转/坠落状态、标定 HELI_BODY_VOLUME。

- [ ] **Step 7: 提交**

```bash
git add src/main.js
git commit -m "feat: 直升机分类分派——反扭矩自旋/周期变距/自转 + 分类选择联动

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: README 路线图 + 回归收尾

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** 路线图勾选直升机：`- [x] 直升机（主旋翼/尾桨、反扭矩、周期变距、自转）`；特性表补一行直升机要点。
- [ ] **Step 2:** Run: `npm run build && npm test` 全绿。
- [ ] **Step 3:** 提交：
```bash
git add README.md
git commit -m "docs: README 路线图勾选直升机

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 自查（Self-Review）

- **Spec 覆盖**：两子类结构→T2；反扭矩+尾桨+自旋→T1/T3/T5；总距升力复用→T5(recomputeHeli 用现有 α/rpm/bladeLen/风/材料体系)；周期变距→T1(cyclicSplit)/T5(倾斜+前飞读数)；自转→T1(autorotation)/T3(flowDir)/T5(rpmFactor/模式读数)；分类选择器→T4/T5；扩展债(getSubtypeParts/去硬编码)→T2/T5；README→T6。
- **占位符**：T4/T5 部分以"结构性完整逻辑+精确接口"给出（实现者据现有 token/class 风格集成），无 TBD；关键代码均完整。
- **类型一致**：`autorotation→{mode,rpmFactor,descentRate}`、`cyclicSplit→{vertical,forward}`、`yawRate({torque,tailThrust,tailArm})`、`createHeliViz(group,subtype)→{update({torque,tailThrust}),dispose}`、`setRotors([{x,z,y?}])`、`update({...flowDir})`、`renderReadout data.heli` 形状、`createUI({...onCategoryChange})` 各任务一致。
- **回归**：多旋翼路径：rebuild 分支、recompute 原样分支、heliState 默认 {0,1}、setRotors y 缺省 ROTOR_Y、applyBladeTwist 对 prop 不变——31 项测试兜底。
- **依赖顺序**：T1→T5；T2→T3/T5；T4→T5；T6 收尾。main.js 仅 T5 修改，无并发冲突。
