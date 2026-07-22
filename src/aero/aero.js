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
