import { describe, expect, it, vi } from 'vitest';
import { buildDrone, DRONES } from './builder/builder.js';
import { createAttitude, recompute } from './controller.js';

const baseState = {
  category: 'multirotor',
  subtype: 'quad',
  aoaDeg: 8,
  windSpeed: 4,
  windDirDeg: 0,
  materialId: 'carbon',
  updraft: 0,
  rpm: 2200,
  rotorDiameter: 0.42,
  tailPitch: 6,
  cyclicDeg: 0,
  engineOn: true,
};

function makeDeps(current, subtype) {
  const readout = { innerHTML: '' };
  return {
    current,
    subtype,
    panel: { querySelector: () => readout },
    viz: { update: vi.fn() },
    heliViz: { update: vi.fn() },
    airfoil: { draw: vi.fn() },
    aerochart: { draw: vi.fn() },
  };
}

describe('recompute', () => {
  it('与桨叶无关的状态变化不会重建桨叶几何体', () => {
    const subtype = DRONES.multirotor.subtypes.quad;
    const current = buildDrone(subtype, 'carbon');
    const deps = makeDeps(current, subtype);
    const attitude = createAttitude();

    recompute(baseState, deps, attitude);
    expect(deps.airfoil.draw).toHaveBeenLastCalledWith(expect.objectContaining({
      category: 'multirotor',
      aoaDeg: 8,
    }));
    const firstGeometry = current.meshes.prop0.geometry;
    recompute({ ...baseState, windSpeed: 10 }, deps, attitude);
    expect(current.meshes.prop0.geometry).toBe(firstGeometry);

    recompute({ ...baseState, aoaDeg: 9 }, deps, attitude);
    expect(current.meshes.prop0.geometry).not.toBe(firstGeometry);
  });

  it('自转时主旋翼和尾桨使用同一个转速系数', () => {
    const subtype = DRONES.helicopter.subtypes.tailrotor;
    const current = { meshes: {} };
    const deps = makeDeps(current, subtype);
    const attitude = createAttitude();
    const poweredState = { ...baseState, category: 'helicopter', subtype: 'tailrotor', aoaDeg: 4 };

    const powered = recompute(poweredState, deps, attitude);
    const autorotating = recompute({ ...poweredState, engineOn: false }, deps, attitude);

    expect(autorotating.rpmFactor).toBeCloseTo(0.85, 5);
    expect(autorotating.yawRate).toBeCloseTo(powered.yawRate * 0.85 ** 2, 5);
    expect(deps.viz.update).toHaveBeenLastCalledWith(expect.objectContaining({ flowDir: -1 }));
    expect(deps.airfoil.draw).toHaveBeenLastCalledWith(expect.objectContaining({
      category: 'helicopter',
      cyclicDeg: 0,
      engineOn: false,
    }));
  });

  it('发动机关闭且总距过大时仍显示自下而上的相对气流', () => {
    const subtype = DRONES.helicopter.subtypes.tailrotor;
    const deps = makeDeps({ meshes: {} }, subtype);

    recompute({
      ...baseState,
      category: 'helicopter',
      subtype: 'tailrotor',
      aoaDeg: 12,
      engineOn: false,
    }, deps, createAttitude());

    expect(deps.viz.update).toHaveBeenLastCalledWith(expect.objectContaining({ flowDir: -1 }));
  });
});
