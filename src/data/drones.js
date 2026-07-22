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
    subtypes: {
      quad: { name: '四轴', rotorCount: 4, arms: armLayout(4), parts: staticParts },
      hexa: { name: '六轴', rotorCount: 6, arms: armLayout(6), parts: staticParts },
      octa: { name: '八轴', rotorCount: 8, arms: armLayout(8), parts: staticParts },
    },
  },
  helicopter: {
    name: '直升机',
    subtypes: {
      tailrotor: {
        name: '单旋翼带尾桨', config: 'tailrotor', mainRotorLen: 1.6, tailArm: 1.5,
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
        name: '共轴双旋翼', config: 'coaxial', mainRotorLen: 1.4,
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

export function getSubtypeParts(subtype) {
  return subtype.arms ? buildSubtypeParts(subtype) : subtype.parts;
}
