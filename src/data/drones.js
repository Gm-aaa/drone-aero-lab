// 静态机身部件（不随轴数变化）
const staticParts = [
  { id: 'frame', name: '机架中心板', desc: '承载飞控、电池等核心部件的结构中心。',
    geometry: { type: 'box', args: [0.5, 0.06, 0.5] }, position: [0, 0, 0], materialRole: 'structural' },
  { id: 'fc', name: '飞控 FC', desc: '飞行控制器，读取传感器并解算姿态、输出控制指令。',
    geometry: { type: 'box', args: [0.16, 0.04, 0.16] }, position: [0, 0.06, 0], materialRole: 'fixed', color: 0x22c55e },
  { id: 'battery', name: '电池', desc: '锂聚合物电池，为电机和电子设备供电。',
    geometry: { type: 'box', args: [0.28, 0.08, 0.14] }, position: [0, -0.08, 0], materialRole: 'fixed', color: 0xef4444 },
  { id: 'gps', name: 'GPS', desc: '卫星定位模块，提供位置与返航能力。',
    geometry: { type: 'cylinder', args: [0.06, 0.06, 0.02, 16] }, position: [0, 0.12, -0.12], materialRole: 'fixed', color: 0xf59e0b },
  { id: 'legL', name: '脚架', desc: '起落架，保护机身着陆。',
    geometry: { type: 'cylinder', args: [0.015, 0.015, 0.25, 8] }, position: [-0.18, -0.16, 0.18], materialRole: 'structural' },
  { id: 'legR', name: '脚架', desc: '起落架，保护机身着陆。',
    geometry: { type: 'cylinder', args: [0.015, 0.015, 0.25, 8] }, position: [0.18, -0.16, -0.18], materialRole: 'structural' },
];

function armLayout(n) {
  return Array.from({ length: n }, (_, i) => ({ angleDeg: (360 / n) * i }));
}

export const DRONES = {
  multirotor: {
    name: '多旋翼',
    defaults: { aoaDeg: 8, rpm: 2200, rotorDiameter: 0.42 },
    controls: { rotorDiameter: [0.25, 0.6] },
    subtypes: {
      quad: {
        name: '四轴', rotorCount: 4, arms: armLayout(4), parts: staticParts,
        massModel: { fixedMass: 3, structuralVolume: 1.9 },
      },
      hexa: {
        name: '六轴', rotorCount: 6, arms: armLayout(6), parts: staticParts,
        massModel: { fixedMass: 4, structuralVolume: 2.6 },
      },
      octa: {
        name: '八轴', rotorCount: 8, arms: armLayout(8), parts: staticParts,
        massModel: { fixedMass: 5, structuralVolume: 3.4 },
      },
    },
  },
  helicopter: {
    name: '直升机',
    defaults: { aoaDeg: 8, rpm: 2200, rotorDiameter: 1.6, cyclicDeg: 0, tailPitch: 6, engineOn: true },
    controls: { rotorDiameter: [1.0, 2.0] },
    subtypes: {
      tailrotor: {
        name: '单旋翼带尾桨', config: 'tailrotor', tailArm: 1.5,
        defaults: { rotorDiameter: 1.6 },
        massModel: { fixedMass: 45, structuralVolume: 20 },
        parts: [
          { id: 'fuselage', name: '机身', desc: '承载动力、燃料/电池与航电的主体结构。',
            geometry: { type: 'box', args: [1.0, 0.42, 0.42] }, position: [0, 0.30, 0], materialRole: 'structural' },
          { id: 'cockpit', name: '座舱', desc: '驾驶/任务设备舱段。',
            geometry: { type: 'box', args: [0.34, 0.30, 0.36] }, position: [0.55, 0.34, 0], materialRole: 'fixed', color: 0x93c5fd },
          { id: 'engine', name: '发动机/主减速器', desc: '驱动主旋翼与尾桨；主减把高转速降到旋翼转速。',
            geometry: { type: 'box', args: [0.30, 0.18, 0.30] }, position: [-0.20, 0.56, 0], materialRole: 'fixed', color: 0xf59e0b },
          { id: 'mast', name: '主轴', desc: '把动力传给主旋翼的旋转轴。',
            geometry: { type: 'cylinder', args: [0.03, 0.03, 0.26, 10] }, position: [0, 0.70, 0], materialRole: 'fixed', color: 0x94a3b8 },
          { id: 'mainHub', name: '主桨毂', desc: '连接桨叶与主轴，容纳变距机构。',
            geometry: { type: 'cylinder', args: [0.07, 0.07, 0.06, 12] }, position: [0, 0.84, 0], materialRole: 'fixed', color: 0x64748b },
          { id: 'mainRotor', name: '主旋翼', desc: '产生升力的核心。总距=所有桨叶同时变距（即桨叶迎角 α）。',
            geometry: { type: 'blade', args: [1.6, 0.09] }, position: [0, 0.88, 0], materialRole: 'fixed', color: 0xcbd5e1,
            mainRotor: true, spin: 'cw' },
          { id: 'tailboom', name: '尾梁', desc: '延伸到尾部，安装尾桨与尾面。',
            geometry: { type: 'cylinder', args: [0.05, 0.03, 1.05, 10] }, position: [-1.0, 0.42, 0], rotation: [0, 0, Math.PI / 2], materialRole: 'structural' },
          { id: 'fin', name: '垂尾', desc: '提供航向安定性，并安装尾桨。',
            geometry: { type: 'box', args: [0.14, 0.36, 0.02] }, position: [-1.5, 0.55, 0], materialRole: 'structural' },
          { id: 'stab', name: '平尾', desc: '提供俯仰安定性。',
            geometry: { type: 'box', args: [0.14, 0.02, 0.40] }, position: [-1.25, 0.46, 0], materialRole: 'structural' },
          { id: 'tailRotor', name: '尾桨', desc: '产生侧向推力抵消主旋翼反扭矩——没有它机身会自旋。',
            geometry: { type: 'blade', args: [0.40, 0.05] }, position: [-1.52, 0.55, 0.06], materialRole: 'fixed', color: 0xcbd5e1,
            tailRotor: true, spin: 'cw' },
          { id: 'skidL', name: '起落橇', desc: '滑橇式起落架，轻且结构简单。',
            geometry: { type: 'cylinder', args: [0.02, 0.02, 1.0, 8] }, position: [0.05, 0.05, 0.24], rotation: [0, 0, Math.PI / 2], materialRole: 'structural' },
          { id: 'skidR', name: '起落橇', desc: '滑橇式起落架，轻且结构简单。',
            geometry: { type: 'cylinder', args: [0.02, 0.02, 1.0, 8] }, position: [0.05, 0.05, -0.24], rotation: [0, 0, Math.PI / 2], materialRole: 'structural' },
        ],
      },
      coaxial: {
        name: '共轴双旋翼', config: 'coaxial',
        defaults: { rotorDiameter: 1.4 },
        massModel: { fixedMass: 42, structuralVolume: 20 },
        parts: [
          { id: 'fuselage', name: '机身', desc: '共轴构型机身更紧凑，无长尾梁需求。',
            geometry: { type: 'box', args: [0.82, 0.40, 0.40] }, position: [0, 0.28, 0], materialRole: 'structural' },
          { id: 'cockpit', name: '座舱', desc: '驾驶/任务设备舱段。',
            geometry: { type: 'box', args: [0.30, 0.28, 0.34] }, position: [0.46, 0.32, 0], materialRole: 'fixed', color: 0x93c5fd },
          { id: 'engine', name: '发动机/主减速器', desc: '通过同轴反转齿轮组驱动上下两副旋翼。',
            geometry: { type: 'box', args: [0.28, 0.18, 0.28] }, position: [-0.14, 0.52, 0], materialRole: 'fixed', color: 0xf59e0b },
          { id: 'mast', name: '共轴主轴', desc: '内外套轴反向旋转，分别驱动上下旋翼。',
            geometry: { type: 'cylinder', args: [0.035, 0.035, 0.46, 10] }, position: [0, 0.76, 0], materialRole: 'fixed', color: 0x94a3b8 },
          { id: 'hubLower', name: '下桨毂', desc: '下旋翼桨毂。',
            geometry: { type: 'cylinder', args: [0.065, 0.065, 0.05, 12] }, position: [0, 0.86, 0], materialRole: 'fixed', color: 0x64748b },
          { id: 'rotorLower', name: '下主旋翼', desc: '与上旋翼反向旋转，扭矩相互抵消——所以不需要尾桨。',
            geometry: { type: 'blade', args: [1.4, 0.085] }, position: [0, 0.90, 0], materialRole: 'fixed', color: 0xcbd5e1,
            mainRotor: true, spin: 'ccw' },
          { id: 'hubUpper', name: '上桨毂', desc: '上旋翼桨毂。',
            geometry: { type: 'cylinder', args: [0.065, 0.065, 0.05, 12] }, position: [0, 1.04, 0], materialRole: 'fixed', color: 0x64748b },
          { id: 'rotorUpper', name: '上主旋翼', desc: '与下旋翼反向旋转，扭矩相互抵消。',
            geometry: { type: 'blade', args: [1.4, 0.085] }, position: [0, 1.08, 0], materialRole: 'fixed', color: 0xcbd5e1,
            mainRotor: true, spin: 'cw' },
          { id: 'tailboom', name: '短尾梁', desc: '共轴构型尾梁短，仅安装尾面。',
            geometry: { type: 'cylinder', args: [0.04, 0.025, 0.6, 10] }, position: [-0.68, 0.40, 0], rotation: [0, 0, Math.PI / 2], materialRole: 'structural' },
          { id: 'fin', name: '垂尾', desc: '航向安定面（无尾桨）。',
            geometry: { type: 'box', args: [0.12, 0.28, 0.02] }, position: [-0.96, 0.50, 0], materialRole: 'structural' },
          { id: 'skidL', name: '起落橇', desc: '滑橇式起落架。',
            geometry: { type: 'cylinder', args: [0.02, 0.02, 0.9, 8] }, position: [0.02, 0.05, 0.22], rotation: [0, 0, Math.PI / 2], materialRole: 'structural' },
          { id: 'skidR', name: '起落橇', desc: '滑橇式起落架。',
            geometry: { type: 'cylinder', args: [0.02, 0.02, 0.9, 8] }, position: [0.02, 0.05, -0.22], rotation: [0, 0, Math.PI / 2], materialRole: 'structural' },
        ],
      },
    },
  },
  vtol: {
    name: '垂起固定翼',
    defaults: {
      aoaDeg: 8, rpm: 2600, rotorDiameter: 0.58,
      transitionDeg: 0, airspeed: 0, wingAoaDeg: 6,
    },
    controls: { rotorDiameter: [0.35, 0.9] },
    subtypes: {
      tiltrotor: {
        name: '倾转旋翼', config: 'tiltrotor', rotorCount: 2,
        wingArea: 1.65, wingSpan: 2.8, aspectRatio: 5.8,
        rotorLiftScale: 1.9,
        massModel: { fixedMass: 18, structuralVolume: 7.75 },
        parts: [
          { id: 'fuselage', name: '流线型机身', desc: '容纳载荷、能源与飞控；巡航时尽量减小迎风阻力。',
            geometry: { type: 'box', args: [1.75, 0.30, 0.34] }, position: [0, 0.12, 0], materialRole: 'structural' },
          { id: 'nose', name: '机鼻与航电舱', desc: '安装空速、姿态、导航传感器；过渡控制依赖可靠的空速与姿态信息。',
            geometry: { type: 'box', args: [0.38, 0.24, 0.30] }, position: [0.93, 0.14, 0], materialRole: 'fixed', color: 0x93c5fd },
          { id: 'wing', name: '固定翼', desc: '空速建立后承担主要升力。低速时机翼升力很小，不能过早卸载旋翼。',
            geometry: { type: 'wing', args: [2.8, 0.62, 0.30, 0.045] }, position: [0.05, 0.17, 0], materialRole: 'structural', fixedWing: true },
          { id: 'tailplane', name: '平尾', desc: '提供俯仰静稳定与配平，过渡段协助抑制俯仰耦合。',
            geometry: { type: 'wing', args: [0.94, 0.30, 0.16, 0.025] }, position: [-0.76, 0.25, 0], materialRole: 'structural' },
          { id: 'fin', name: '垂尾', desc: '提供航向稳定；巡航速度建立后作用显著增强。',
            geometry: { type: 'box', args: [0.34, 0.40, 0.035] }, position: [-0.74, 0.43, 0], rotation: [0, 0, -0.22], materialRole: 'structural' },
          { id: 'gearL', name: '主起落架', desc: '支撑垂直起降和常规滑跑着陆。',
            geometry: { type: 'cylinder', args: [0.018, 0.018, 0.34, 8] }, position: [-0.10, -0.10, 0.34], rotation: [0.25, 0, 0], materialRole: 'structural' },
          { id: 'gearR', name: '主起落架', desc: '支撑垂直起降和常规滑跑着陆。',
            geometry: { type: 'cylinder', args: [0.018, 0.018, 0.34, 8] }, position: [-0.10, -0.10, -0.34], rotation: [-0.25, 0, 0], materialRole: 'structural' },
          { id: 'nacelleL', name: '左倾转短舱', desc: '连同旋翼绕横向轴倾转；0° 向上托举，90° 向前推进。',
            geometry: { type: 'cylinder', args: [0.105, 0.085, 0.32, 16] }, position: [0.05, 0.25, 1.08], materialRole: 'fixed', color: 0x64748b, tiltNacelle: true },
          { id: 'nacelleR', name: '右倾转短舱', desc: '与左短舱同步倾转；两侧不同步会产生危险滚转与偏航。',
            geometry: { type: 'cylinder', args: [0.105, 0.085, 0.32, 16] }, position: [0.05, 0.25, -1.08], materialRole: 'fixed', color: 0x64748b, tiltNacelle: true },
          { id: 'tiltRotorL', name: '左倾转旋翼', desc: '悬停时提供升力，巡航时转为前向推力；过渡中同时具有垂直和水平分量。',
            geometry: { type: 'blade', args: [0.58, 0.055] }, position: [0.05, 0.43, 1.08], materialRole: 'fixed', color: 0xcbd5e1,
            vtolRotor: true, tiltRotor: true, tiltPivot: [0.05, 0.25, 1.08], tiltOffset: 0.18, spin: 'cw' },
          { id: 'tiltRotorR', name: '右倾转旋翼', desc: '与左旋翼反向旋转以抵消反扭矩。',
            geometry: { type: 'blade', args: [0.58, 0.055] }, position: [0.05, 0.43, -1.08], materialRole: 'fixed', color: 0xcbd5e1,
            vtolRotor: true, tiltRotor: true, tiltPivot: [0.05, 0.25, -1.08], tiltOffset: 0.18, spin: 'ccw' },
        ],
      },
      liftcruise: {
        name: '升力＋巡航', config: 'liftcruise', rotorCount: 4,
        wingArea: 1.45, wingSpan: 2.65, aspectRatio: 6.1,
        rotorLiftScale: 1.0,
        massModel: { fixedMass: 19.5, structuralVolume: 7.4 },
        parts: [
          { id: 'fuselage', name: '流线型机身', desc: '连接机翼、升力系统与巡航推进系统。',
            geometry: { type: 'box', args: [1.85, 0.28, 0.32] }, position: [0, 0.12, 0], materialRole: 'structural' },
          { id: 'nose', name: '机鼻与任务舱', desc: '安装航电与任务载荷。',
            geometry: { type: 'box', args: [0.38, 0.23, 0.28] }, position: [0.98, 0.14, 0], materialRole: 'fixed', color: 0x93c5fd },
          { id: 'wing', name: '固定翼', desc: '过渡后由机翼接管升力，使巡航效率远高于持续依靠升力旋翼。',
            geometry: { type: 'wing', args: [2.65, 0.58, 0.28, 0.045] }, position: [0.08, 0.17, 0], materialRole: 'structural', fixedWing: true },
          { id: 'tailplane', name: 'V 尾/平尾', desc: '提供俯仰与航向稳定。',
            geometry: { type: 'wing', args: [0.90, 0.29, 0.15, 0.025] }, position: [-0.82, 0.26, 0], materialRole: 'structural' },
          { id: 'fin', name: '垂尾', desc: '巡航时提供航向稳定。',
            geometry: { type: 'box', args: [0.32, 0.38, 0.035] }, position: [-0.80, 0.42, 0], rotation: [0, 0, -0.20], materialRole: 'structural' },
          { id: 'boomL', name: '左动力梁', desc: '安装前后升力电机并传递载荷。',
            geometry: { type: 'box', args: [1.05, 0.055, 0.06] }, position: [0, 0.22, 0.82], materialRole: 'structural' },
          { id: 'boomR', name: '右动力梁', desc: '安装前后升力电机并传递载荷。',
            geometry: { type: 'box', args: [1.05, 0.055, 0.06] }, position: [0, 0.22, -0.82], materialRole: 'structural' },
          { id: 'liftRotorFL', name: '左前升力旋翼', desc: '仅负责垂直升力；随机翼接管而逐步降功率。',
            geometry: { type: 'blade', args: [0.58, 0.05] }, position: [0.43, 0.30, 0.82], materialRole: 'fixed', color: 0xcbd5e1,
            vtolRotor: true, liftRotor: true, spin: 'cw' },
          { id: 'liftRotorFR', name: '右前升力旋翼', desc: '仅负责垂直升力；与相邻旋翼反转以抵消反扭矩。',
            geometry: { type: 'blade', args: [0.58, 0.05] }, position: [0.43, 0.30, -0.82], materialRole: 'fixed', color: 0xcbd5e1,
            vtolRotor: true, liftRotor: true, spin: 'ccw' },
          { id: 'liftRotorRL', name: '左后升力旋翼', desc: '悬停时与前旋翼共同控制高度和姿态。',
            geometry: { type: 'blade', args: [0.58, 0.05] }, position: [-0.43, 0.30, 0.82], materialRole: 'fixed', color: 0xcbd5e1,
            vtolRotor: true, liftRotor: true, spin: 'ccw' },
          { id: 'liftRotorRR', name: '右后升力旋翼', desc: '巡航时降至低功率或停转，减小耗能与阻力。',
            geometry: { type: 'blade', args: [0.58, 0.05] }, position: [-0.43, 0.30, -0.82], materialRole: 'fixed', color: 0xcbd5e1,
            vtolRotor: true, liftRotor: true, spin: 'cw' },
          { id: 'pusherMotor', name: '巡航电机', desc: '独立驱动后推螺旋桨，建立空速让机翼产生升力。',
            geometry: { type: 'cylinder', args: [0.075, 0.075, 0.20, 16] }, position: [-1.01, 0.15, 0], rotation: [0, 0, Math.PI / 2], materialRole: 'fixed', color: 0x64748b },
          { id: 'pusher', name: '巡航推进桨', desc: '产生前向推力，不直接承担垂直升力。',
            geometry: { type: 'blade', args: [0.48, 0.045] }, position: [-1.14, 0.15, 0], materialRole: 'fixed', color: 0xcbd5e1,
            vtolRotor: true, cruiseRotor: true, spin: 'cw' },
        ],
      },
    },
  },
};

const ARM_LEN = 0.55;

export function buildSubtypeParts(subtype) {
  const parts = [...subtype.parts];
  subtype.arms.forEach((arm, i) => {
    const rad = arm.angleDeg * Math.PI / 180;
    const ax = Math.cos(rad) * ARM_LEN;
    const az = Math.sin(rad) * ARM_LEN;
    // 机臂
    parts.push({
      id: `arm${i}`, name: '机臂', desc: '连接机架与电机的臂，决定轴距与刚性。',
      geometry: { type: 'box', args: [ARM_LEN, 0.03, 0.04] },
      position: [ax / 2, 0, az / 2], rotation: [0, -rad, 0], materialRole: 'structural',
    });
    // 电机
    parts.push({
      id: `motor${i}`, name: '无刷电机', desc: '驱动螺旋桨旋转产生升力/推力。',
      geometry: { type: 'cylinder', args: [0.045, 0.045, 0.05, 16] },
      position: [ax, 0.05, az], materialRole: 'fixed', color: 0x94a3b8,
    });
    // 电调
    parts.push({
      id: `esc${i}`, name: '电调 ESC', desc: '电子调速器，按飞控指令控制电机转速。',
      geometry: { type: 'box', args: [0.06, 0.015, 0.03] },
      position: [ax / 2, 0.02, az / 2], rotation: [0, -rad, 0], materialRole: 'fixed', color: 0x0ea5e9,
    });
    // 螺旋桨（正/反桨交替）
    parts.push({
      id: `prop${i}`, name: i % 2 === 0 ? '螺旋桨（正桨 CW）' : '螺旋桨（反桨 CCW）',
      desc: '相邻电机正反桨交替，抵消反扭矩以保持偏航稳定。',
      geometry: { type: 'blade', args: [0.42, 0.03] },
      position: [ax, 0.09, az], materialRole: 'fixed', color: 0xcbd5e1,
      spin: i % 2 === 0 ? 'cw' : 'ccw',
      armAngleDeg: arm.angleDeg,
    });
  });
  return parts;
}

const _partsCache = new WeakMap();
export function getSubtypeParts(subtype) {
  if (!_partsCache.has(subtype)) {
    _partsCache.set(subtype, subtype.arms ? buildSubtypeParts(subtype) : subtype.parts);
  }
  return _partsCache.get(subtype);
}
