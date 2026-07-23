import { describe, expect, it } from 'vitest';
import { advanceFlowPhase } from './viz.js';

describe('advanceFlowPhase', () => {
  it('即使时间步很大也始终将粒子相位保持在 0..1', () => {
    const phase = advanceFlowPhase(0.8, 120, 1.4);
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThan(1);
  });
});
