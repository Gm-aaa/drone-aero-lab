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
      geometry: { type: 'box', args: [0.42, 0.006, 0.03] },
      position: [ax, 0.09, az], materialRole: 'fixed', color: 0xcbd5e1,
      spin: i % 2 === 0 ? 'cw' : 'ccw',
    });
  });
  return parts;
}
