import { describe, expect, it } from 'vitest';
import { bladePitchAtRadius } from './builder.js';

describe('bladePitchAtRadius', () => {
  it('把用户迎角精确解释为 0.75R 参考站桨距', () => {
    expect(bladePitchAtRadius(8, 0.75)).toBe(8);
  });

  it('从桨根到桨尖保持单调 washout', () => {
    expect(bladePitchAtRadius(8, 0)).toBeGreaterThan(bladePitchAtRadius(8, 0.75));
    expect(bladePitchAtRadius(8, 0.75)).toBeGreaterThan(bladePitchAtRadius(8, 1));
  });
});
