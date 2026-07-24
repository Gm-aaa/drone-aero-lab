import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { advanceFlowPhase, createViz } from './viz.js';

describe('advanceFlowPhase', () => {
  it('即使时间步很大也始终将粒子相位保持在 0..1', () => {
    const phase = advanceFlowPhase(0.8, 120, 1.4);
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThan(1);
  });
});

describe('createViz 姿态变换', () => {
  it('旋翼箭头原点和方向跟随机体四元数旋转', () => {
    const scene = new THREE.Group();
    const viz = createViz(scene);
    viz.setRotors([{ x: 1, y: 0.09, z: 0 }]);
    viz.update({
      perLift: [100],
      totalLift: 100,
      effectiveLift: 100,
      weight: 100,
      wind: { x: 0, y: 0, z: 0 },
    });
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      Math.PI / 2,
    );
    viz.tick(0, q);

    const rotorArrow = viz.root.children[3];
    expect(rotorArrow.position.x).toBeCloseTo(-0.15, 5);
    expect(rotorArrow.position.y).toBeCloseTo(1, 5);
  });
});
