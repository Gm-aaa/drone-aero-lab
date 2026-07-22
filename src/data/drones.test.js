import { describe, it, expect } from 'vitest';
import { DRONES, buildSubtypeParts } from './drones.js';

describe('DRONES 数据', () => {
  it('多旋翼含四/六/八轴', () => {
    expect(Object.keys(DRONES.multirotor.subtypes)).toEqual(
      expect.arrayContaining(['quad', 'hexa', 'octa']),
    );
  });
  it('rotorCount 与轴数一致', () => {
    expect(DRONES.multirotor.subtypes.quad.rotorCount).toBe(4);
    expect(DRONES.multirotor.subtypes.hexa.rotorCount).toBe(6);
    expect(DRONES.multirotor.subtypes.octa.rotorCount).toBe(8);
  });
});

describe('buildSubtypeParts', () => {
  it('八轴电机数量等于 rotorCount', () => {
    const parts = buildSubtypeParts(DRONES.multirotor.subtypes.octa);
    const motors = parts.filter((p) => p.id.startsWith('motor'));
    expect(motors).toHaveLength(8);
  });
  it('每个部件都有 name 与 geometry', () => {
    const parts = buildSubtypeParts(DRONES.multirotor.subtypes.quad);
    for (const p of parts) {
      expect(p.name).toBeTruthy();
      expect(p.geometry).toBeTruthy();
    }
  });
});
