# 直升机分类 设计文档

日期：2026-07-22
状态：已确认，待实现
前置：多旋翼三轮（竖切/可视化重塑/物理保真度）已完成并上线。

## 目标

新增**直升机**分类（子类：单旋翼带尾桨、共轴双旋翼），沿用 data→builder→aero→viz→ui 架构与教学示意级物理，重点教学：**反扭矩与尾桨平衡、总距升力（复用 α 体系）、周期变距→前飞（简化）、自转下滑（简化）**。同时启用真正的**分类选择器**，清偿多旋翼硬编码的扩展债。

## 范围

- 子类：`tailrotor`（单旋翼带尾桨）、`coaxial`（共轴双旋翼）。
- 气动：上述 4 项，全部简化解析模型 + TDD 纯函数。
- 不做（YAGNI）：纵列双旋翼、桨叶挥舞/锥度、真实自转空气动力学（只做状态机级示意）、垂起固定翼（下一轮）。
- 多旋翼路径行为不变（现有 31 项测试回归保证）。

## 关键决策（已确认）

- 主旋翼直接复用 `makeTwistedBlade`（其点对称双叶几何天然是双叶旋翼）；尾桨为垂直面小尺寸实例。
- 反扭矩教学核心交互：尾桨距滑块 ↔ 机身真实自旋；共轴构型扭矩自抵消。
- 周期变距、自转均为示意级（倾转矢量分解 / 状态机 + 气流反向）。
- UI 中文；数值标注示意级。

## 模块级设计

### 1. 数据（data/drones.js）

```
DRONES.helicopter = {
  name: '直升机',
  subtypes: {
    tailrotor: { name: '单旋翼带尾桨', config: 'tailrotor', mainRotorLen: 1.6, parts: [...] },
    coaxial:   { name: '共轴双旋翼',   config: 'coaxial',   mainRotorLen: 1.4, parts: [...] },
  },
}
```

部件（全声明式，无程序化展开）：

- tailrotor：机身（fuselage，圆角盒/盒）、座舱（cockpit）、主轴（mast）、主桨毂（mainHub）、**主旋翼**（mainRotor，`type:'blade'`，水平面）、尾梁（tailboom）、**尾桨**（tailRotor，`type:'blade'` 小尺寸，竖直面，`rotation` 定向）、垂尾（fin）、平尾（stab）、起落橇 ×2（skidL/R）、发动机/主减（engine）。每件带中文 `name/desc`。
- coaxial：机身、上主旋翼（rotorUpper，`spin:'cw'`）、下主旋翼（rotorLower，`spin:'ccw'`，桨毂间距 ~0.18）、双层桨毂/主轴、短尾梁+垂尾（**无尾桨**，desc 说明为什么）、起落橇、发动机。
- 主旋翼部件带 `mainRotor: true` 标记、尾桨带 `tailRotor: true` 标记（供 builder/动画/变距识别）。

统一部件入口：`getSubtypeParts(subtype)` = `subtype.arms ? buildSubtypeParts(subtype) : subtype.parts`。多旋翼继续走展开路径；main.js/builder 改用 `getSubtypeParts`。

### 2. builder

- `makeGeometry` 的 `'blade'` 分支、DoubleSide、`applyBladeTwist` 逻辑复用；`applyBladeTwist` 只作用于 `mainRotor`/多旋翼 prop（尾桨不随 α 变，随尾桨距独立）。识别方式：`part.geometry.type === 'blade' && !part.tailRotor`。
- 动态桨长仅作用于多旋翼 prop 与直升机主旋翼（`bladeLen` 对直升机映射为主旋翼长度缩放：`mainRotorLen × (bladeLen/0.42)`，滑块语义不变）。

### 3. aero（新增纯函数，TDD）

- `mainRotorTorque(totalLift, rotorLen)` → 反扭矩（示意：`k·L·R`，k=0.12）。
- `tailRotorThrust(tailPitchDeg, rpm)` → 尾桨推力（示意：`kt·pitch·(rpm/2200)²`，kt=1.6；pitch 0..12°）。
- `yawRate({ torque, tailThrust, tailArm })` → 偏航角速度（rad/s，示意：`(torque − tailThrust·tailArm)·ky`，ky=0.05；共轴时 torque 传 0）。正=机身向主旋翼反方向自旋。
- `cyclicSplit(totalLift, cyclicDeg)` → `{ vertical: L·cos, forward: L·sin }`（cyclic 0..15°）。
- `autorotation({ engineOn, aoaDeg })` → `{ mode: 'powered'|'autorotation'|'crash', rpmFactor, descentRate }`：
  - engineOn → powered, rpmFactor 1, descentRate 0（悬停语境）。
  - !engineOn && aoaDeg ≤ 6 → autorotation, rpmFactor 0.85, descentRate ≈ 4 m/s（受控）。
  - !engineOn && aoaDeg > 6 → crash, rpmFactor 随 α 线性衰减至 0.2, descentRate ≈ 10+ m/s。
- 直升机升力：复用 `perRotorLift`；tailrotor 构型 rotorCount=1，coaxial=2×0.85（共轴气动干扰折减 0.85，示意）。自转时升力 × rpmFactor²。

### 4. viz

- **扭矩弧形箭头**：绕主轴的弧形（TubeGeometry/多段线 + 箭头头），方向与主旋翼旋转相反；共轴画两个反向弧并标"抵消"。
- **尾桨推力箭头**：从尾桨沿其轴向。
- **偏航自旋**：main 渲染循环对机身 group 施加 `yawRate` 累积旋转（绕局部 Y）。平衡时停转。
- **周期变距**：机身/旋翼 group 前倾 cyclicDeg；中心升力箭头随之倾斜并画出水平**前飞分量**箭头。
- **自转气流**：engine off 且 autorotation 时，下洗粒子反向（从下向上穿过桨盘）；crash 时粒子紊乱下坠色变红。
- 主旋翼/尾桨旋转动画沿用转速机制（自转时 × rpmFactor；尾桨转速跟随主转速比例）。

### 5. UI / main

- **分类选择器**：机型卡里"分类"由固定标签变为下拉（多旋翼/直升机），切换后子类下拉与专属参数联动重建。
- 直升机专属控件（仅该分类显示）：**尾桨距**（0..12°，仅 tailrotor 子类）、**周期变距**（0..15°）、**发动机**（开关 toggle）。
- 读数（直升机时追加）：主旋翼扭矩、尾桨推力、偏航状态（**平衡 ●／左自旋 ↺／右自旋 ↻**）、前飞分量、飞行模式（**有动力／自转下滑(下降率 x m/s)／坠落警示**）。
- 图例追加：扭矩弧线、尾桨推力、自转上行气流。
- main.js 按分类分派：`state.category`；rebuild/recompute 走 per-category 路径（多旋翼路径不动）；剖面图/曲线图对直升机同样生效（共用 α）。

## 状态与数据流（增量）

state 增加：`category`（'multirotor'|'helicopter'）、`tailPitch`、`cyclicDeg`、`engineOn`。
直升机 recompute：α/rpm/bladeLen → 主旋翼升力（×共轴折减/自转 rpmFactor²）→ cyclicSplit → 垂直分量进 netLift（风体系照旧）→ torque/tailThrust/yawRate → viz（弧箭头/尾桨箭头/自旋/倾斜/气流方向）→ 读数。

## 测试策略

- 新增 aero 纯函数全部 Vitest TDD：扭矩随升力/桨长增、尾桨推力随距/转速增、yawRate 平衡点为零/符号正确、cyclicSplit 勾股一致、autorotation 三态与单调性、共轴 yawRate≈0。
- 既有 31 测试回归（多旋翼不回退）。
- 视觉（自旋/弧箭头/气流反向/分类切换）浏览器人工验证（控制器里程碑）。

## 发布

不变；合并 main 自动部署 Pages。README 路线图勾选直升机。

## 后续

垂起固定翼（独立 spec）：机翼翼型升力 + 旋翼/固定翼过渡态。
