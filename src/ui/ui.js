import { DRONES } from '../data/drones.js';
import { MATERIALS, liftDragRatio, maxLiftAoa, maxLDAoa } from '../aero/aero.js';

// 视觉方向（frontend-design 结论）：仪表盘美学 —— 数值一律等宽数字字体，
// 每个滑块的强调色对应其在 3D 场景 / 图例中的箭头颜色（迎角→升力绿，风速/风向→风青），
// 让"控制"与"可视化"的颜色语言保持一致，是本面板的视觉签名。

const card = (title, body) => `
  <div class="card">
    <div class="section-label">${title}</div>
    ${body}
  </div>`;

function slider(label, id, min, max, val, step, unit, accent) {
  return `
    <div class="slider-row">
      <div class="slider-head">
        <span class="label">${label}</span>
        <span class="slider-value" id="${id}-v" style="color:${accent}">${val}${unit}</span>
      </div>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" style="--thumb-color:${accent}">
    </div>`;
}

const legendRow = (color, text) => `
  <div class="legend-row">
    <span class="legend-swatch" style="background:${color}"></span>
    <span>${text}</span>
  </div>`;

// 手动为自定义 range 轨道上色（已用 -webkit-appearance:none 关闭原生填充）
function paintRange(el, accent) {
  const min = Number(el.min), max = Number(el.max), val = Number(el.value);
  const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
  el.style.background = `linear-gradient(to right, ${accent} 0%, ${accent} ${pct}%, var(--border-strong) ${pct}%, var(--border-strong) 100%)`;
}

export function createUI(panel, { state, onSubtypeChange }) {
  const s = state.get();
  const subs = DRONES.multirotor.subtypes;

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">无人机空气动力学实验室</div>
      <div class="panel-subtitle">多旋翼 · 示意值，非精确工程值</div>
    </div>

    ${card('机型', `
      <div style="margin-bottom:10px">分类 <span class="chip">多旋翼</span></div>
      <label>
        <span class="field-label">子类</span>
        <select id="subtype">
          ${Object.entries(subs).map(([k, v]) => `<option value="${k}" ${k === s.subtype ? 'selected' : ''}>${v.name}</option>`).join('')}
        </select>
      </label>`)}

    ${card('飞行参数', `
      ${slider('桨叶迎角 α', 'aoa', 0, 30, s.aoaDeg, 1, '°', 'var(--lift)')}
      ${slider('转速', 'rpm', 1000, 4000, s.rpm ?? 2200, 100, ' RPM', 'var(--lift)')}
      ${slider('桨叶长度', 'bladelen', 0.25, 0.6, s.bladeLen ?? 0.42, 0.01, ' m', 'var(--lift)')}
      ${slider('风速', 'wind', 0, 15, s.windSpeed, 0.5, ' m/s', 'var(--wind)')}
      ${slider('风向', 'wdir', 0, 360, s.windDirDeg, 5, '°', 'var(--wind)')}
      ${slider('垂直气流', 'updraft', -6, 6, s.updraft ?? 0, 0.5, ' m/s', 'var(--warn)')}
      <label style="display:block;margin-top:12px">
        <span class="field-label">材料</span>
        <select id="material">
          ${Object.values(MATERIALS).map((m) => `<option value="${m.id}" ${m.id === s.materialId ? 'selected' : ''}>${m.name}</option>`).join('')}
        </select>
      </label>`)}

    ${card('图例', `
      ${legendRow('var(--lift)', '升力（绿，向上；越长越大）')}
      ${legendRow('var(--weight)', '重力（红，向下）')}
      ${legendRow('var(--wind)', '风')}
      ${legendRow('var(--downwash)', '下洗气流')}
      ${legendRow('var(--warn)', '升阻比 L/D 曲线 / 垂直气流')}
      <div class="legend-note">坐标轴 Z↑ = 升力方向；升力箭头颜色由绿→橙→红表示裕度下降 / 失速。<br>风大→机身倾斜抗风，有效升力下降。</div>`)}

    ${card('实时读数', `<div id="readout"></div>`)}

    ${card('部件', `
      <div id="partlist" class="part-list"></div>
      <div id="partinfo" class="part-info"></div>`)}
  `;

  panel.querySelector('#subtype').onchange = (e) => { state.set({ subtype: e.target.value }); onSubtypeChange(); };

  const bind = (id, key, accent) => {
    const el = panel.querySelector(`#${id}`);
    const valueEl = panel.querySelector(`#${id}-v`);
    const unit = valueEl.textContent.replace(/^-?[\d.]+/, '');
    paintRange(el, accent);
    el.oninput = () => {
      valueEl.textContent = el.value + unit;
      paintRange(el, accent);
      state.set({ [key]: Number(el.value) });
    };
  };
  bind('aoa', 'aoaDeg', 'var(--lift)');
  bind('rpm', 'rpm', 'var(--lift)');
  bind('bladelen', 'bladeLen', 'var(--lift)');
  bind('wind', 'windSpeed', 'var(--wind)');
  bind('wdir', 'windDirDeg', 'var(--wind)');
  bind('updraft', 'updraft', 'var(--warn)');
  panel.querySelector('#material').onchange = (e) => state.set({ materialId: e.target.value });
}

const STATUS_META = {
  climb: { label: '爬升 ▲', bg: 'rgba(34,197,94,.15)', fg: 'var(--lift)' },
  hover: { label: '悬停 ●', bg: 'rgba(148,163,184,.14)', fg: 'var(--text-secondary)' },
  stall: { label: '升力不足 ▼', bg: 'rgba(239,68,68,.15)', fg: 'var(--weight)' },
};

export function renderReadout(el, { totalLift, net, weight, aoaDeg, aeroDrag, material }) {
  const meta = STATUS_META[net.status];
  const ratio = weight > 0 ? net.effectiveLift / weight : 0;
  const pct = Math.max(0, Math.min(100, (ratio / 1.5) * 100));
  const barColor = ratio >= 1 ? 'var(--lift)' : ratio >= 0.9 ? 'var(--warn)' : 'var(--weight)';

  el.innerHTML = `
    <div class="readout-row"><span>总升力</span><span class="readout-value">${totalLift.toFixed(0)} N</span></div>
    <div class="readout-row"><span>有效升力（抗风后）</span><span class="readout-value">${net.effectiveLift.toFixed(0)} N</span></div>
    <div class="readout-row"><span>气动阻力（随α）｜ 升阻比 L/D</span><span class="readout-value">${aeroDrag.toFixed(0)} N ｜ ${liftDragRatio(aoaDeg).toFixed(1)}</span></div>
    <div class="readout-row"><span>风阻 ｜ 抗风倾角 θ</span><span class="readout-value">${net.drag.toFixed(0)} N ｜ ${net.tiltDeg.toFixed(0)}°</span></div>
    <div class="status-row">
      <span style="font-size:12.5px;color:var(--text-secondary)">状态</span>
      <span class="status-pill" style="background:${meta.bg};color:${meta.fg}">${meta.label}</span>
    </div>
    <div class="ratio-block">
      <div class="ratio-label"><span>净升重比</span><b>${ratio.toFixed(2)}</b></div>
      <div class="ratio-gauge">
        <div class="ratio-zones"></div>
        <div class="ratio-fill" style="width:${pct}%;background:${barColor}"></div>
        <div class="ratio-tick"></div>
      </div>
    </div>
    <div style="font-size:11.5px;color:var(--text-tertiary);line-height:1.6;margin-top:2px">最大升力 @${maxLiftAoa()}°　最大升阻比 @${maxLDAoa()}°</div>
    <div class="material-note"><b>${material.name}</b> 适用：${material.useCase}</div>`;
}

export function renderPartInfo(el, part) {
  el.innerHTML = part
    ? `<div class="part-info-name">${part.name}</div><div class="part-info-desc">${part.desc}</div>`
    : `<div class="part-info-empty">点击部件查看说明</div>`;
}

export function renderPartList(el, parts, selectedId, onSelect) {
  // 按 name 去重，展示唯一部件类型
  const selectedName = parts.find((p) => p.id === selectedId)?.name;
  const seen = new Map();
  for (const p of parts) if (!seen.has(p.name)) seen.set(p.name, p);
  el.innerHTML = [...seen.values()]
    .map((p) => `<button class="part-btn${p.name === selectedName ? ' selected' : ''}" data-id="${p.id}">${p.name}</button>`)
    .join('');
  el.querySelectorAll('button').forEach((b) => { b.onclick = () => onSelect(b.dataset.id); });
}
