import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
const deg = THREE.MathUtils.radToDeg;

// Dragging a light marker orbits it around the subject.
export function setupInteraction({ stage, rig }) {
  const canvas = stage.renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  let drag = null;

  const aim = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, stage.camera);
  };

  const pickLight = () => {
    const lightHit = raycaster.intersectObjects(rig.pickables(), false)[0];
    if (!lightHit) return null;
    const modelHit = stage.headMesh && raycaster.intersectObject(stage.headMesh, true)[0];
    return modelHit && modelHit.distance < lightHit.distance ? null : lightHit;
  };

  // Capture phase so we can claim the drag before OrbitControls starts its own.
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    aim(e);
    const light = pickLight();
    if (!light) return;
    const id = light.object.userData.id;
    rig.select(id);
    drag = { id };
    stage.controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
  }, true);

  canvas.addEventListener('pointermove', (e) => {
    aim(e);
    if (!drag) {
      canvas.style.cursor = pickLight() ? 'grab' : '';
      return;
    }
    const item = rig.items.find((i) => i.id === drag.id);
    const sphere = new THREE.Sphere(new THREE.Vector3(), item.distance);
    if (!raycaster.ray.intersectSphere(sphere, hit)) return;
    rig.update(item.id, {
      azimuth: Math.round(deg(Math.atan2(hit.x, hit.z))),
      elevation: clamp(Math.round(deg(Math.asin(hit.y / item.distance))), -80, 85),
    });
  });

  const end = (e) => {
    if (!drag) return;
    drag = null;
    stage.controls.enabled = true;
    canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
