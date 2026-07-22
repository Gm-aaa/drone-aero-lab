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

export function maxLDAoa() {
  let best = 0, bestLD = -1;
  for (let a = 0; a <= 20; a += 0.5) {
    const ld = liftDragRatio(a);
    if (ld > bestLD) { bestLD = ld; best = a; }
  }
  return Math.round(best);
}

// 转速(RPM)+桨长 → 0.75R 参考站桨叶线速度(m/s)
export function bladeLinearSpeed(rpm, bladeLen) {
  return (rpm / 60) * 2 * Math.PI * 0.75 * (bladeLen / 2);
}
