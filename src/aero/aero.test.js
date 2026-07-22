import { describe, it, expect } from 'vitest';
import {
  MATERIALS, liftCoefficient, computeLift, computeWeight, liftStatus, windVector,
  perRotorLift, liftColor, windVector3D,
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

describe('windVector3D', () => {
  it('水平分量在 XZ、垂直分量为 updraft(Y)', () => {
    const v = windVector3D(10, 0, 3);
    expect(v.x).toBeCloseTo(10, 5);
    expect(v.z).toBeCloseTo(0, 5);
    expect(v.y).toBeCloseTo(3, 5);
  });
});

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
