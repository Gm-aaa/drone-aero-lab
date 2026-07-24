import { describe, expect, it, vi } from 'vitest';
import { createPatchScheduler } from './ui.js';

describe('createPatchScheduler', () => {
  it('合并同一帧的参数更新', () => {
    let callback;
    const state = { set: vi.fn() };
    const scheduler = createPatchScheduler(state, {
      requestFrame: (fn) => { callback = fn; return 1; },
      cancelFrame: vi.fn(),
    });
    scheduler.schedule({ rpm: 2400 });
    scheduler.schedule({ aoaDeg: 9 });
    callback();
    expect(state.set).toHaveBeenCalledWith({ rpm: 2400, aoaDeg: 9 });
  });

  it('销毁旧 UI 后取消并丢弃待提交状态', () => {
    let callback;
    const state = { set: vi.fn() };
    const cancelFrame = vi.fn();
    const scheduler = createPatchScheduler(state, {
      requestFrame: (fn) => { callback = fn; return 7; },
      cancelFrame,
    });
    scheduler.schedule({ rotorDiameter: 0.6 });
    scheduler.dispose();
    callback();
    expect(cancelFrame).toHaveBeenCalledWith(7);
    expect(state.set).not.toHaveBeenCalled();
  });
});
