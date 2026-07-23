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
      <input type="range" id="${id}" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${val}" style="--thumb-color:${accent}">
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

export function createUI(panel, { state, onSubtypeChange, onCategoryChange = () => {} }) {
  const s = state.get();
  const catKey = s.category ?? 'multirotor';
  const cat = DRONES[catKey];
  const subs = cat.subtypes;
  const isHeli = catKey === 'helicopter';
  const isVtol = catKey === 'vtol';
  const curSub = subs[s.subtype];

  // Fix #11: 保留面板滚动位置
  const scrollTop = panel.scrollTop;

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">无人机空气动力学实验室</div>
      <div class="panel-subtitle">${cat.name} · 示意值，非精确工程值</div>
    </div>

    ${card('机型', `
      <label>
        <span class="field-label">分类</span>
        <select id="category">
          ${Object.entries(DRONES).map(([k, v]) => `<option value="${k}" ${k === catKey ? 'selected' : ''}>${v.name}</option>`).join('')}
        </select>
      </label>
      <label style="display:block;margin-top:12px">
        <span class="field-label">子类</span>
        <select id="subtype">
          ${Object.entries(subs).map(([k, v]) => `<option value="${k}" ${k === s.subtype ? 'selected' : ''}>${v.name}</option>`).join('')}
        </select>
      </label>`)}

    ${card('飞行参数', `
      ${isVtol ? slider(
        curSub?.config === 'tiltrotor' ? '旋翼倾转角 β' : '巡航动力交接',
        'transition', 0, 90, s.transitionDeg ?? 0, 1, '°', 'var(--warn)',
      ) : ''}
      ${isVtol ? slider('真空速', 'airspeed', 0, 40, s.airspeed ?? 0, 1, ' m/s', 'var(--wind)') : ''}
      ${isVtol ? slider('机翼迎角 αw', 'wingaoa', -5, 25, s.wingAoaDeg ?? 6, 1, '°', '#60a5fa') : ''}
      ${slider(isHeli ? '主旋翼总距 α' : isVtol ? '升力桨局部迎角 αr' : '桨叶局部迎角 α', 'aoa', 0, 30, s.aoaDeg, 1, '°', 'var(--lift)')}
      ${slider('转速', 'rpm', 1000, 4000, s.rpm ?? 2200, 100, ' RPM', 'var(--lift)')}
      ${slider('旋翼直径', 'rotordiameter', 0.25, isVtol ? 0.9 : 0.6, s.rotorDiameter ?? 0.42, 0.01, ' m', 'var(--lift)')}
      ${slider(isVtol ? '环境风速' : '风速', 'wind', 0, 15, s.windSpeed, 0.5, ' m/s', 'var(--wind)')}
      ${slider('风向', 'wdir', 0, 360, s.windDirDeg, 5, '°', 'var(--wind)')}
      ${slider('垂直气流', 'updraft', -6, 6, s.updraft ?? 0, 0.5, ' m/s', 'var(--warn)')}
      ${isHeli && curSub?.config === 'tailrotor' ? slider('尾桨距', 'tailpitch', 0, 12, s.tailPitch ?? 6, 0.5, '°', 'var(--wind)') : ''}
      ${isHeli ? slider('周期变距', 'cyclic', 0, 15, s.cyclicDeg ?? 0, 1, '°', 'var(--warn)') : ''}
      ${isHeli ? `
      <label class="engine-row" style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:12.5px;color:var(--text-secondary);cursor:pointer">
        <input type="checkbox" id="engine" ${(s.engineOn ?? true) ? 'checked' : ''}> 发动机（关闭演示自转）
      </label>` : ''}
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
      ${isVtol ? legendRow('#60a5fa', '机翼升力（随空速²建立）') : ''}
      ${isVtol ? legendRow('#f59e0b', '前向推进力') : ''}
      ${isHeli ? legendRow('#f97316', '主旋翼反扭矩（弧形箭头）') : ''}
      ${isHeli && curSub?.config === 'tailrotor' ? legendRow('#22d3ee', '尾桨推力') : ''}
      ${isHeli && curSub?.config === 'coaxial' ? legendRow('#38bdf8', '下旋翼反扭矩——两弧反向，相互抵消') : ''}
      <div class="legend-note">坐标轴 Z↑ = 升力方向；升力箭头颜色由绿→橙→红表示裕度下降 / 失速。<br>风大→机身倾斜抗风，有效升力下降。</div>
      ${isHeli ? `<div class="legend-note">发动机关闭→气流自下而上驱动旋翼（自转下滑）。</div>` : ''}
      ${isVtol ? `<div class="legend-note">过渡必须先建立空速，让机翼升力接管，再卸载垂直旋翼；只推动“过渡”滑块并不会自动获得空速。</div>` : ''}`)}

    ${card('实时读数', `<div id="readout"></div>`)}

    ${card('部件', `
      <div id="partlist" class="part-list"></div>
      <div id="partinfo" class="part-info"></div>`)}

    ${card('关于', `
      <div style="font-size:12px;color:var(--text-secondary);line-height:1.7">
        交互式学习无人机<b>结构组成</b>与<b>空气动力学</b>的教学项目。
        当前涵盖多旋翼、直升机与垂起固定翼（倾转旋翼/升力＋巡航）。<br>
        所有数值为<b>教学示意</b>（简化解析模型，非 CFD / 工程值）。<br>
        <a href="https://github.com/Gm-aaa/drone-aero-lab" target="_blank" rel="noopener"
           style="color:var(--wind);text-decoration:none">GitHub 源码 ↗</a>
      </div>`)}
  `;

  // Fix #11: 恢复滚动位置
  panel.scrollTop = scrollTop;

  panel.querySelector('#category').onchange = (e) => {
    const c = e.target.value;
    onCategoryChange({
      ...DRONES[c].defaults,
      category: c,
      subtype: Object.keys(DRONES[c].subtypes)[0],
    });
  };
  panel.querySelector('#subtype').onchange = (e) => onSubtypeChange({ subtype: e.target.value });

  // Fix #12: rAF 合并——同一帧内多次滑块拖动只触发一次 state.set
  let pendingPatch = null;
  let flushScheduled = false;
  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    requestAnimationFrame(() => {
      flushScheduled = false;
      if (pendingPatch) { state.set(pendingPatch); pendingPatch = null; }
    });
  }

  const bind = (id, key, accent) => {
    const el = panel.querySelector(`#${id}`);
    const valueEl = panel.querySelector(`#${id}-v`);
    const unit = valueEl.textContent.replace(/^-?[\d.]+/, '');
    paintRange(el, accent);
    el.oninput = () => {
      valueEl.textContent = el.value + unit;
      paintRange(el, accent);
      pendingPatch = { ...pendingPatch, [key]: Number(el.value) };
      scheduleFlush();
    };
  };
  bind('aoa', 'aoaDeg', 'var(--lift)');
  if (isVtol) bind('transition', 'transitionDeg', 'var(--warn)');
  if (isVtol) bind('airspeed', 'airspeed', 'var(--wind)');
  if (isVtol) bind('wingaoa', 'wingAoaDeg', '#60a5fa');
  bind('rpm', 'rpm', 'var(--lift)');
  bind('rotordiameter', 'rotorDiameter', 'var(--lift)');
  bind('wind', 'windSpeed', 'var(--wind)');
  bind('wdir', 'windDirDeg', 'var(--wind)');
  bind('updraft', 'updraft', 'var(--warn)');
  if (isHeli && curSub?.config === 'tailrotor') bind('tailpitch', 'tailPitch', 'var(--wind)');
  if (isHeli) bind('cyclic', 'cyclicDeg', 'var(--warn)');
  if (isHeli) panel.querySelector('#engine').onchange = (e) => state.set({ engineOn: e.target.checked });
  panel.querySelector('#material').onchange = (e) => state.set({ materialId: e.target.value });
}

const STATUS_META = {
  climb: { label: '爬升 ▲', bg: 'rgba(34,197,94,.15)', fg: 'var(--lift)' },
  hover: { label: '悬停 ●', bg: 'rgba(148,163,184,.14)', fg: 'var(--text-secondary)' },
  stall: { label: '升力不足 ▼', bg: 'rgba(239,68,68,.15)', fg: 'var(--weight)' },
};

export function renderReadout(el, { totalLift, net, weight, aoaDeg, aeroDrag, material, heli, vtol }) {
  const meta = STATUS_META[net.status];
  const ratio = weight > 0 ? net.effectiveLift / weight : 0;
  const pct = Math.max(0, Math.min(100, (ratio / 1.5) * 100));
  const barColor = ratio >= 1 ? 'var(--lift)' : ratio >= 0.9 ? 'var(--warn)' : 'var(--weight)';

  el.innerHTML = `
    <div class="readout-row"><span>${vtol ? '合计垂直升力' : '总升力'}</span><span class="readout-value">${totalLift.toFixed(0)} N</span></div>
    <div class="readout-row"><span>有效升力（抗风后）</span><span class="readout-value">${net.effectiveLift.toFixed(0)} N</span></div>
    <div class="readout-row"><span>气动阻力（随α）｜ 升阻比 L/D</span><span class="readout-value">${aeroDrag.toFixed(0)} N ｜ ${liftDragRatio(aoaDeg).toFixed(1)}</span></div>
    <div class="readout-row"><span>风阻 ｜ 抗风倾角 θ</span><span class="readout-value">${net.drag.toFixed(0)} N ｜ ${net.tiltDeg.toFixed(0)}°</span></div>
    ${heli ? `
    <div class="readout-row"><span>主旋翼扭矩</span><span class="readout-value">${heli.torque.toFixed(0)} N·m（示意）</span></div>
    ${heli.tailThrust != null ? `<div class="readout-row"><span>尾桨推力</span><span class="readout-value">${heli.tailThrust.toFixed(1)} N</span></div>` : ''}
    <div class="readout-row"><span>偏航</span><span class="readout-value">${
      heli.yawState === 'balanced' ? '平衡 ●' : heli.yawState === 'spinLeft' ? '左自旋 ↺' : heli.yawState === 'spinRight' ? '右自旋 ↻' : '共轴自平衡 ●'
    }</span></div>
    <div class="readout-row"><span>前飞分量</span><span class="readout-value">${heli.forward.toFixed(0)} N</span></div>
    <div class="readout-row"><span>飞行模式</span><span class="readout-value"${heli.mode === 'crash' ? ' style="color:var(--weight)"' : ''}>${
      heli.mode === 'powered' ? '有动力' : heli.mode === 'autorotation' ? `自转下滑（约 ${heli.descentRate.toFixed(0)} m/s）` : '坠落警示！总距过大'
    }</span></div>` : ''}
    ${vtol ? `
    <div class="readout-row"><span>旋翼垂直分量</span><span class="readout-value">${vtol.rotorVertical.toFixed(0)} N</span></div>
    <div class="readout-row"><span>机翼升力</span><span class="readout-value">${vtol.wingLift.toFixed(0)} N</span></div>
    <div class="readout-row"><span>推进力 ｜ 机翼阻力</span><span class="readout-value">${vtol.forwardThrust.toFixed(0)} ｜ ${vtol.wingDrag.toFixed(0)} N</span></div>
    <div class="readout-row"><span>真空速 ｜ 估算失速速度</span><span class="readout-value">${vtol.airspeed.toFixed(0)} ｜ ${vtol.stallSpeed.toFixed(1)} m/s</span></div>
    <div class="readout-row"><span>飞行阶段</span><span class="readout-value">${
      vtol.phase === 'hover' ? '垂直起降' : vtol.phase === 'transition' ? '过渡' : '固定翼巡航'
    }</span></div>
    <div style="margin:9px 0 4px;padding:8px 9px;border-radius:7px;font-size:11.5px;line-height:1.5;background:${
      vtol.safety.safe ? 'rgba(34,197,94,.10)' : 'rgba(239,68,68,.12)'
    };color:${vtol.safety.safe ? 'var(--lift)' : 'var(--weight)'}">${
      vtol.safety.safe ? '过渡包线正常' : `过渡风险：${vtol.safety.reasons.join('；')}`
    }</div>` : ''}
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
  const nameCount = new Map();
  for (const p of parts) nameCount.set(p.name, (nameCount.get(p.name) ?? 0) + 1);
  const nameIdx = new Map();
  el.innerHTML = parts
    .map((p) => {
      let label = p.name;
      if (nameCount.get(p.name) > 1) {
        const i = (nameIdx.get(p.name) ?? 0) + 1;
        nameIdx.set(p.name, i);
        label += ` ${i}`;
      }
      return `<button class="part-btn${p.id === selectedId ? ' selected' : ''}" data-id="${p.id}">${label}</button>`;
    })
    .join('');
  el.querySelectorAll('button').forEach((b) => { b.onclick = () => onSelect(b.dataset.id); });
}
