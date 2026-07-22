import { describe, it, expect } from 'vitest';
import {
  MATERIALS, liftCoefficient, computeLift, computeWeight, liftStatus, windVector,
  perRotorLift, liftColor,
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
