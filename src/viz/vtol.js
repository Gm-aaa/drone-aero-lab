import * as THREE from 'three';
import { liftColor } from '../aero/aero.js';

function disposeArrow(group, arrow) {
  group.remove(arrow);
  arrow.line.geometry.dispose();
  arrow.line.material.dispose();
  arrow.cone.geometry.dispose();
  arrow.cone.material.dispose();
}

export function createVtolViz(group, subtype) {
  const halfSpan = subtype.wingSpan / 2;
  const wingOrigins = [-1, 1].map((side) => new THREE.Vector3(0.05, 0.23, side * halfSpan * 0.48));
  const wingArrows = wingOrigins.map((origin) => {
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0), origin, 0.1, 0x60a5fa, 0.12, 0.075,
    );
    group.add(arrow);
    return arrow;
  });
  const forward = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0.25, 0.12, 0),
    0.1,
    0xf59e0b,
    0.13,
    0.08,
  );
  group.add(forward);

  function update({ wingLift, forwardThrust, weight }) {
    const perWing = wingLift / 2;
    const color = new THREE.Color(liftColor(wingLift, weight));
    for (const arrow of wingArrows) {
      arrow.visible = wingLift > 1;
      arrow.setLength(Math.max(0.08, Math.min(1.3, perWing / 120)), 0.12, 0.075);
      arrow.setColor(color);
    }
    forward.visible = forwardThrust > 1;
    forward.setLength(Math.max(0.08, Math.min(1.5, forwardThrust / 150)), 0.13, 0.08);
  }

  function dispose() {
    wingArrows.forEach((arrow) => disposeArrow(group, arrow));
    disposeArrow(group, forward);
  }

  return { update, dispose };
}
