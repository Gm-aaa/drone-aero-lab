import { describe, expect, it } from 'vitest';
import { createAirfoil } from './airfoil.js';

function makeCanvas() {
  const context = new Proxy({}, {
    get(target, key) {
      if (!(key in target)) target[key] = () => {};
      return target[key];
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  const title = { textContent: '' };
  return {
    width: 336,
    height: 210,
    getContext: () => context,
    closest: () => ({ querySelector: () => title }),
    title,
  };
}

describe('createAirfoil', () => {
  it('分别绘制多旋翼局部迎角和直升机变距图', () => {
    const canvas = makeCanvas();
    const diagram = createAirfoil(canvas);

    expect(() => diagram.draw({ category: 'multirotor', aoaDeg: 8 })).not.toThrow();
    expect(canvas.title.textContent).toBe('螺旋桨三维变距');

    expect(() => diagram.draw({
      category: 'helicopter',
      aoaDeg: 10,
      cyclicDeg: 7,
      engineOn: true,
    })).not.toThrow();
    expect(canvas.title.textContent).toBe('主旋翼三维变距');

    expect(() => diagram.draw({
      category: 'helicopter',
      aoaDeg: 4,
      cyclicDeg: 0,
      engineOn: false,
    })).not.toThrow();
  });
});
