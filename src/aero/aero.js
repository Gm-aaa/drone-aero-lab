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

export function perRotorLift({ bladeSpeed, refArea, aoaDeg, airDensity }) {
  const cl = liftCoefficient(aoaDeg);
  return 0.5 * airDensity * bladeSpeed * bladeSpeed * refArea * cl;
}

export function computeLift({ rotorCount, bladeSpeed, refArea, aoaDeg, airDensity }) {
  return rotorCount * perRotorLift({ bladeSpeed, refArea, aoaDeg, airDensity });
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

export function windVector3D(windSpeed, windDirDeg, updraft) {
  const rad = windDirDeg * Math.PI / 180;
  return { x: windSpeed * Math.cos(rad), y: updraft, z: windSpeed * Math.sin(rad) };
}

export function liftColor(lift, weight) {
  const ratio = weight > 0 ? lift / weight : 0;
  const t = Math.max(0, Math.min(1, (ratio - 0.8) / 0.4));
  const red = { r: 0.94, g: 0.27, b: 0.27 };
  const orange = { r: 0.98, g: 0.62, b: 0.15 };
  const green = { r: 0.13, g: 0.77, b: 0.37 };
  const lerp = (a, b, u) => ({ r: a.r + (b.r - a.r) * u, g: a.g + (b.g - a.g) * u, b: a.b + (b.b - a.b) * u });
  return t < 0.5 ? lerp(red, orange, t / 0.5) : lerp(orange, green, (t - 0.5) / 0.5);
}

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

const _maxLDAoa = (() => {
  let best = 0, bestLD = -1;
  for (let a = 0; a <= 20; a += 0.5) {
    const ld = liftDragRatio(a);
    if (ld > bestLD) { bestLD = ld; best = a; }
  }
  return Math.round(best);
})();
export function maxLDAoa() { return _maxLDAoa; }

// 转速(RPM)+旋翼直径 → 0.75R 参考站桨叶线速度(m/s)
export function bladeLinearSpeed(rpm, rotorDiameter) {
  const radius = rotorDiameter / 2;
  return (rpm / 60) * 2 * Math.PI * 0.75 * radius;
}

// ===== 直升机（教学示意级） =====
const TORQUE_K = 0.24;
const TAIL_KT = 16.7; // 标定：默认尾桨距6°@2200RPM 恰好平衡默认主旋翼扭矩(~150N·m/臂1.5m)
const YAW_KY = 0.05;

export function mainRotorTorque(totalLift, rotorDiameter) {
  const radius = rotorDiameter / 2;
  return TORQUE_K * totalLift * radius;
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
  const t = Math.min(1, (aoaDeg - 6) / 24);
  const rpmFactor = Math.max(0.2, 0.85 - 0.65 * t);
  const descentRate = 4 + 7.2 * t;
  return { mode: 'crash', rpmFactor, descentRate };
}

// ===== 垂起固定翼（教学示意级） =====
const WING_EFFICIENCY = 0.82;
const WING_CD0 = 0.035;

export function fixedWingForces({
  airspeed, wingArea, aspectRatio, aoaDeg, airDensity = 1.225,
}) {
  const speed = Math.max(0, airspeed);
  const cl = liftCoefficient(aoaDeg);
  const induced = cl * cl / (Math.PI * Math.max(1, aspectRatio) * WING_EFFICIENCY);
  const cd = WING_CD0 + induced;
  const dynamicPressure = 0.5 * airDensity * speed * speed;
  return {
    lift: dynamicPressure * wingArea * cl,
    drag: dynamicPressure * wingArea * cd,
    cl,
    cd,
    stalled: aoaDeg > STALL_DEG,
  };
}

export function transitionBlend(transitionDeg) {
  const t = Math.max(0, Math.min(1, transitionDeg / 90));
  // smoothstep 避免动力分配在两端出现突变。
  return t * t * (3 - 2 * t);
}

export function vtolPhase(transitionDeg) {
  if (transitionDeg <= 10) return 'hover';
  if (transitionDeg >= 80) return 'cruise';
  return 'transition';
}

export function wingStallSpeed({ weight, wingArea, airDensity = 1.225 }) {
  return Math.sqrt(
    Math.max(0, 2 * weight / (airDensity * Math.max(1e-6, wingArea) * CL_MAX)),
  );
}

export function transitionSafety({
  verticalLift, weight, airspeed, stallSpeed, wingStalled,
}) {
  const reasons = [];
  if (wingStalled) reasons.push('机翼迎角超过失速角');
  if (verticalLift < weight * 0.9) reasons.push('垂直升力存在明显缺口');
  if (airspeed < stallSpeed && verticalLift < weight * 0.98) reasons.push('空速尚不足以由机翼接管');
  return { safe: reasons.length === 0, reasons };
}
