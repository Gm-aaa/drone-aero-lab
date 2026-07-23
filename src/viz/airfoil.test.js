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
  it('分别绘制多旋翼、直升机和垂起固定翼教学图', () => {
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

    expect(() => diagram.draw({
      category: 'vtol',
      config: 'tiltrotor',
      transitionDeg: 45,
      airspeed: 18,
      wingAoaDeg: 6,
      rotorVertical: 180,
      wingLift: 140,
      forwardThrust: 160,
      weight: 300,
      safe: true,
    })).not.toThrow();
    expect(canvas.title.textContent).toBe('垂起固定翼过渡剖面');
  });
});
