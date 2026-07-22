# 物理保真度增强轮 设计文档

日期：2026-07-22
状态：已确认，待实现
前置：在多旋翼竖切 + 可视化重塑之上继续增强。

## 背景与动机

用户对空气动力学保真度提出进一步要求：

1. **桨叶要有扭转（washout）**：真实螺旋桨叶片根部迎角大于尖部，不能整片刚性平转。
2. **风要三维**：除水平风外要有垂直气流（上升/下沉），且风（风向、风速、垂直气流）连同总重共同决定升力是否够起飞。
3. **空气阻力随迎角动态计算，并展示升阻比 L/D**。
4. **标注特殊工作点**：最大升力、最大升阻比等，在读数/曲线中体现。
5. **坐标轴修正**：X-Y 为水平面、Z 为竖直方向（此前错为 Y 竖直）。

## 目标

在数据驱动架构上提升空气动力学建模保真度：桨叶扭转、三维风与起飞耦合、动态阻力与升阻比、特殊点曲线、Z-up 坐标系。仍为纯前端静态 + GitHub Pages，教学示意级。

## 范围

仅多旋翼。aero 核心用简化解析模型（非 CFD）。新增/修改的 aero 纯函数继续 TDD。

明确不做：真实 CFD；每片桨沿展向数值积分升力（升力仍按 0.75R 参考站解析计算）；直升机/垂起。

## 关键决策（已确认）

- 桨叶迎角 α = **0.75R 参考站**迎角；沿展向线性扭转，根 = α+Δ、尖 = α−Δ（Δ≈8°，0.75R 处 = α）。
- 风 = 水平风（风速+风向）+ **垂直气流**（上升 +/下沉 −）；两者都进入起飞判定。
- 阻力 **CD(α) = CD₀ + k·CL²**（CD₀≈0.02、k≈0.06）；升阻比 **L/D = CL/CD**。
- 特殊点：最大升力（失速点 α≈15°）、最大升阻比（L/D 峰值 α）；用曲线图 + 读数展示。
- 坐标系 **Z-up**：X-Y 水平面、Z 竖直（升力 +Z、重力 −Z）。
- 标定：默认无风时总升力 ≈ 重量（刚好能飞），加侧风/下沉气流即起不来。
- UI 中文。

## 模块级设计

### 1. aero 扩展（纯函数，TDD）

保持既有 `liftCoefficient`、`perRotorLift`、`computeLift`、`computeWeight`、`liftColor`、`windVector`。新增：

- `dragCoefficient(aoaDeg)` → CD = CD0 + k·CL(α)²（CD0=0.02, k=0.06）。
- `liftDragRatio(aoaDeg)` → CL/CD（α=0 时 CL=0 → 比值 0）。
- `computeDrag({ bladeSpeed, refArea, aoaDeg, airDensity, rotorCount })` → 总阻力（与升力同量纲，示意）。
- `verticalWindForce(updraft, refArea, airDensity)` → 垂直气流力（∝ ρ·A·updraft·|updraft|，符号随 updraft；上升为正）。
- `windTilt({ dragForce, weight })` → 抗水平风的机身倾角 θ = atan(dragForce/weight)（rad）。此处 dragForce 为水平风施加的机体阻力，见下。
- `horizontalWindDrag(windSpeed, refArea, airDensity)` → 水平风对机体的阻力 ∝ 0.5·ρ·Cd_body·A·windSpeed²（Cd_body≈1.1）。
- `netLift({ totalLift, weight, windSpeed, updraft, refArea, airDensity })` → `{ effectiveLift, tiltDeg, drag, status }`：
  - dragH = horizontalWindDrag(windSpeed,...)；θ = windTilt({dragForce:dragH, weight})。
  - effectiveLift = totalLift·cos(θ) + verticalWindForce(updraft,...)。
  - status = liftStatus(effectiveLift, weight)（复用现有阈值）。
- `maxLiftAoa()` → 15（失速点，最大 CL 处）。
- `maxLDAoa()` → 数值扫描 0..30° 取 L/D 峰值对应 α（返回整数度）。

标定：调整 `bodyVolume` 或 `bladeSpeed`，使默认（碳纤维、α=8、无风、无垂直气流）总升力 ≈ 重量（净升重比 ~1.0–1.05，刚好能飞）。具体数值在实现时用浏览器实测校准（见测试策略）。

### 2. 桨叶扭转（washout）

- 数据：prop 部件保留 `armAngleDeg`。
- 建造：`makeTwistedBlade(length, chord, thickness, rootPitchDeg, tipPitchDeg)` → 沿展向分段（约 9 段）的几何，每段绕叶展轴（局部 X）扭转到该处线性插值的桨距；中心（桨毂）段 = 根桨距（大），两端 = 尖桨距（小）。
- prop mesh 用该扭转几何。`applyBladeTwist(meshes, subtype, aoaDeg)`：按 α 计算 root=α+Δ、tip=α−Δ，重建每片 prop 的扭转几何（dispose 旧几何）。替换原 `applyBladePitch`。
- 剖面图 `airfoil.js` 升级：并排/叠画**根剖面（α+Δ）**与**尖剖面（α−Δ）**两个翼型（不同倾角），标注"根 α+Δ / 尖 α−Δ / 参考 0.75R=α"，升力矢量按 0.75R 的 CL。

### 3. Z-up 坐标系

- 场景内容（drone group、viz root、原点坐标轴）统一放入一个 `content` 组，`content.rotation.x = +π/2`，使局部 +Y → 世界 +Z（竖直向上）。
- 网格改为世界 X-Y 水平面（GridHelper 绕 X 旋转 +π/2，置于世界，不入 content）。
- 相机 `camera.up = (0,0,1)`，机位调整为从斜上方观察；OrbitControls 适配。
- 原点坐标轴与标注（世界系）：X（红，水平）、Y（绿，水平）、Z↑（蓝，竖直=升力方向）。
- 角落 gizmo 改为 Z-up 标注。
- 说明：drone/viz 内部仍用局部 Y-up 帧（升力局部 +Y → 世界 +Z），无需改其内部；仅新增 content 包裹与网格/轴/相机调整。

### 4. 三维风可视化 + 机身抗风倾斜

- `windVector3D(windSpeed, windDirDeg, updraft)` → 世界向量：水平分量（X-Y 平面，按风向）+ 垂直分量（Z = updraft）。
- 风箭头三维化：显示含垂直分量的合成风向。
- **机身抗风倾斜**：drone group 按 netLift 的 tiltDeg 朝迎风方向倾斜（局部帧内绕水平轴倾转），直观显示"为抗风而倾斜"。
- 下洗气流随水平风与垂直气流偏斜（既有 tick 逻辑扩展垂直分量）。
- 升力/箭头颜色改用 **有效升力**（effectiveLift）对重量的比值（liftColor(effectiveLift, weight)）。

### 5. 空气动力学曲线图（dataviz）

- 面板内一个小图（Canvas 或内联 SVG），用 dataviz 技能定配色/坐标/网格样式：
  - 横轴 α（0–30°）；两条曲线 **CL(α)** 与 **L/D(α)**（双 y 轴或各自归一化，图例标注）。
  - 标记：最大升力点（maxLiftAoa）、最大升阻比点（maxLDAoa）、当前 α 游标（随滑块移动）。
- 随 α 变化实时更新当前游标。

### 6. UI

- 新增「垂直气流」滑块（上升 +/下沉 −，如 −6..+6 m/s）。
- 读数：总升力、**有效升力**、**阻力**、**升阻比 L/D**、抗风倾角 θ、**净升重比**（有效升力/重量）+ 状态；文字点出最大升力/最大升阻比对应 α。
- 图例补充：垂直气流、机身抗风倾斜、Z↑=竖直/升力方向。
- 曲线图嵌入实时读数附近。

## 状态与数据流（增量）

state 增加 `updraft`。数据流：UI 改状态 → aero 算 CL/CD/L/D、总升力、netLift(有效升力/倾角/阻力/状态)、特殊点 → viz 更新箭头(有效升力色)/三维风/机身倾斜/下洗 + airfoil 根尖剖面 + 曲线图游标 + builder 桨叶扭转 → 渲染（Z-up）。

## 测试策略

- 新增 aero 纯函数 TDD：dragCoefficient 随 α 增（诱导阻力）、liftDragRatio 在中小 α 有峰值、verticalWindForce 符号与单调、windTilt 随阻力增/随重量减、netLift（无风=totalLift、侧风降低有效升力、下沉气流降低、上升气流提高）、maxLDAoa 落在合理区间（约 4–8°）。
- 标定与可视化（桨叶扭转、Z-up、机身倾斜、曲线图、三维风）用浏览器截图人工验证（控制器里程碑）。

## 发布

不变：Vite base '/drone-aero-lab/'，GitHub Actions gh-pages。

## 后续（不在本轮）

- 分类选择器 + 直升机/垂起（per-category builder）。
- 沿展向数值积分的更精细桨叶气动。
