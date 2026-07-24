const BOUNDS = {
  aoaDeg: [0, 30], rpm: [1000, 4000], rotorDiameter: [0.25, 2],
  windSpeed: [0, 15], windDirDeg: [0, 360], updraft: [-6, 6],
  tailPitch: [0, 12], cyclicDeg: [0, 15],
  transitionDeg: [0, 90], airspeed: [0, 40], wingAoaDeg: [-5, 25],
};

function validate(patch) {
  const out = {};
  for (const [k, v] of Object.entries(patch)) {
    const b = BOUNDS[k];
    out[k] = b && typeof v === 'number' ? Math.max(b[0], Math.min(b[1], v)) : v;
  }
  return out;
}

export function createState(initial) {
  let state = { ...initial };
  const subs = new Set();
  return {
    get: () => state,
    set(patch) { state = { ...state, ...validate(patch) }; subs.forEach((f) => f(state)); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
