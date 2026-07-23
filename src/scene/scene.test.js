import { describe, expect, it } from 'vitest';
import { frameDeltaSeconds } from './scene.js';

describe('frameDeltaSeconds', () => {
  it('限制后台恢复产生的超大时间步', () => {
    expect(frameDeltaSeconds(61_000, 1_000)).toBe(0.05);
  });

  it('系统时钟回退时不会返回负时间步', () => {
    expect(frameDeltaSeconds(900, 1_000)).toBe(0);
  });
});
