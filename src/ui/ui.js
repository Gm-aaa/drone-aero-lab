import { DRONES } from '../data/drones.js';
import { MATERIALS } from '../aero/aero.js';

function slider(label, id, min, max, val, step) {
  return `<label style="display:block;margin:8px 0">${label}
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" style="width:100%">
    <span id="${id}-v">${val}</span></label>`;
}

export function createUI(panel, { state, onSubtypeChange }) {
  const s = state.get();
  const subs = DRONES.multirotor.subtypes;
  panel.innerHTML = `
    <h2 style="margin-bottom:8px">无人机空气动力学实验室</h2>
    <div style="opacity:.6;font-size:12px;margin-bottom:12px">多旋翼 · 示意值，非精确工程值</div>
    <label>子类
      <select id="subtype" style="width:100%;margin:4px 0 12px">
        ${Object.entries(subs).map(([k, v]) => `<option value="${k}" ${k === s.subtype ? 'selected' : ''}>${v.name}</option>`).join('')}
      </select></label>
    ${slider('迎角 (°)', 'aoa', 0, 30, s.aoaDeg, 1)}
    ${slider('风速 (m/s)', 'wind', 0, 15, s.windSpeed, 0.5)}
    ${slider('风向 (°)', 'wdir', 0, 360, s.windDirDeg, 5)}
    <label>材料
      <select id="material" style="width:100%;margin:4px 0 12px">
        ${Object.values(MATERIALS).map((m) => `<option value="${m.id}" ${m.id === s.materialId ? 'selected' : ''}>${m.name}</option>`).join('')}
      </select></label>
    <div id="readout" style="margin-top:12px"></div>
    <div id="partinfo" style="margin-top:12px;padding-top:12px;border-top:1px solid #333"></div>
  `;

  panel.querySelector('#subtype').onchange = (e) => { state.set({ subtype: e.target.value }); onSubtypeChange(); };
  const bind = (id, key, cast) => {
    const el = panel.querySelector(`#${id}`);
    el.oninput = () => {
      panel.querySelector(`#${id}-v`).textContent = el.value;
      state.set({ [key]: cast(el.value) });
    };
  };
  bind('aoa', 'aoaDeg', Number);
  bind('wind', 'windSpeed', Number);
  bind('wdir', 'windDirDeg', Number);
  panel.querySelector('#material').onchange = (e) => state.set({ materialId: e.target.value });
}

export function renderReadout(el, { lift, weight, status, material }) {
  const label = { climb: '爬升 ▲', hover: '悬停 ●', stall: '升力不足 ▼' }[status];
  el.innerHTML = `
    <div>升力：${lift.toFixed(0)} N（示意）</div>
    <div>重量：${weight.toFixed(0)} N（示意）</div>
    <div style="margin:4px 0;font-weight:600">状态：${label}</div>
    <div style="opacity:.8;font-size:12px">${material.name} 适用：${material.useCase}</div>`;
}

export function renderPartInfo(el, part) {
  el.innerHTML = part
    ? `<div style="font-weight:600">${part.name}</div><div style="opacity:.8;margin-top:4px">${part.desc}</div>`
    : `<div style="opacity:.6">点击机身部件查看说明</div>`;
}
