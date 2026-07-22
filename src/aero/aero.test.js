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

import { bladeLinearSpeed } from './aero.js';
describe('bladeLinearSpeed', () => {
  it('默认工况(2200RPM, 0.42m)约等于 36 m/s(保持既有标定)', () => {
    expect(bladeLinearSpeed(2200, 0.42)).toBeGreaterThan(34);
    expect(bladeLinearSpeed(2200, 0.42)).toBeLessThan(38);
  });
  it('随转速与桨长单调增大', () => {
    expect(bladeLinearSpeed(3000, 0.42)).toBeGreaterThan(bladeLinearSpeed(2200, 0.42));
    expect(bladeLinearSpeed(2200, 0.6)).toBeGreaterThan(bladeLinearSpeed(2200, 0.42));
  });
});

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
