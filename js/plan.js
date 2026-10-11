import * as THREE from 'three';

const SIZE = 260;
const RANGE = 9.5; // world units from the centre to the plan's edge
const K = SIZE / 2 / RANGE;
const HIT_RADIUS = 14;
const CENTRE = SIZE / 2;

const deg = THREE.MathUtils.radToDeg;
const rad = THREE.MathUtils.degToRad;

// Top-down diagram: +X is right, +Z (towards the default camera) is down.
export function setupPlan({ stage, rig }) {
  const wrap = document.querySelector('#plan');
  const toggle = document.querySelector('#plan-toggle');
  const canvas = document.querySelector('#plan-canvas');
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = canvas.height = SIZE * dpr;
  canvas.style.width = canvas.style.height = `${SIZE}px`;
  const ctx = canvas.getContext('2d');

  const dir = new THREE.Vector3();
  let hits = [];
  let dragId = null;
  let raf = 0;

  const px = (x, z) => [CENTRE + x * K, CENTRE + z * K];

  function drawLight(item) {
    const { x, z } = item.group.position;
    const [lx, ly] = px(x, z);
    dir.set(0, 0, -1).applyQuaternion(item.group.quaternion);
    const flat = Math.hypot(dir.x, dir.z);
    const reach = 1.3 * K;
    const output = item.type === 'reflector' ? item.light.intensity / 30 : item.intensity / 10;
    const strength = THREE.MathUtils.clamp(output, 0, 1);

    ctx.fillStyle = ctx.strokeStyle = item.color;

    if (flat > 0.05) {
      const dx = dir.x / flat;
      const dz = dir.z / flat;
      const heading = Math.atan2(dz, dx);

      if (item.type === 'spot') {
        // Cone length and opacity grow with intensity.
        ctx.globalAlpha = 0.04 + strength * 0.2;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.arc(lx, ly, (1 + strength * 6) * K, heading - 0.5, heading + 0.5);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.globalAlpha = 0.12 + strength * 0.88;
      ctx.lineWidth = 1 + strength * 2;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + dx * reach, ly + dz * reach);
      if (item.type === 'sun') {
        // Parallel rays alongside the centre line.
        [-0.45, 0.45].forEach((o) => {
          ctx.moveTo(lx - dz * o * K, ly + dx * o * K);
          ctx.lineTo(lx - dz * o * K + dx * reach, ly + dx * o * K + dz * reach);
        });
      }
      ctx.stroke();

      const tx = lx + dx * reach;
      const ty = ly + dz * reach;
      ctx.beginPath();
      ctx.moveTo(tx + dx * 8, ty + dz * 8);
      ctx.lineTo(tx - dx * 2 - dz * 5, ty - dz * 2 + dx * 5);
      ctx.lineTo(tx - dx * 2 + dz * 5, ty - dz * 2 - dx * 5);
      ctx.fill();

      if (item.type === 'reflector') {
        // Thin dished disc seen edge-on: a line with round rim caps.
        const half = 1.63 * K;
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lx - dz * half, ly + dx * half);
        ctx.lineTo(lx + dz * half, ly - dx * half);
        ctx.stroke();
        [-1, 1].forEach((s) => {
          ctx.beginPath();
          ctx.arc(lx + s * dz * half, ly - s * dx * half, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (item.type === 'area') {
        const half = 0.8 * K;
        ctx.globalAlpha = 1;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(lx - dz * half, ly + dx * half);
        ctx.lineTo(lx + dz * half, ly - dx * half);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (item.type !== 'area' && item.type !== 'reflector') {
      ctx.beginPath();
      ctx.arc(lx, ly, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (item.id === rig.selectedId) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(lx, ly, 11, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#9a9aa6';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(`${Math.round(item.elevation)}° up`, lx + 10, ly - 9);
    hits.push({ id: item.id, x: lx, y: ly });
  }

  function drawHead() {
    const skin = '#c9a58a';
    const shade = '#a8826a';
    const oval = (x, y, rx, ry, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(x * K, y * K, rx * K, ry * K, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    oval(-0.7, -0.05, 0.12, 0.26, shade); // ears
    oval(0.7, -0.05, 0.12, 0.26, shade);
    oval(0, 0, 0.7, 0.85, skin); // skull, deeper front-to-back than wide
    oval(0, 0.92, 0.13, 0.16, shade); // nose
  }

  function drawTeapot() {
    ctx.fillStyle = '#8f4a2a';
    ctx.beginPath();
    ctx.ellipse(0, 1.0 * K, 0.14 * K, 0.4 * K, 0, 0, Math.PI * 2); // spout
    ctx.fill();
    ctx.strokeStyle = '#8f4a2a';
    ctx.lineWidth = 0.14 * K;
    ctx.beginPath();
    ctx.arc(0, -0.95 * K, 0.3 * K, 0, Math.PI * 2); // handle
    ctx.stroke();
    ctx.fillStyle = '#b4623c';
    ctx.beginPath();
    ctx.arc(0, 0, 0.8 * K, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    hits = [];

    ctx.strokeStyle = '#2f2f3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CENTRE, 0);
    ctx.lineTo(CENTRE, SIZE);
    ctx.moveTo(0, CENTRE);
    ctx.lineTo(SIZE, CENTRE);
    ctx.stroke();

    // Camera, pushed out to the rim along its current bearing and pointing at the head.
    const cam = stage.camera.position;
    const bearing = Math.atan2(cam.x, cam.z);
    const [cx, cy] = px(Math.sin(bearing) * RANGE * 0.9, Math.cos(bearing) * RANGE * 0.9);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-bearing);
    ctx.fillStyle = '#9a9aa6';
    ctx.fillRect(-7, -2, 14, 9);
    ctx.beginPath();
    ctx.moveTo(-4, -2);
    ctx.lineTo(4, -2);
    ctx.lineTo(0, -9);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#9a9aa6';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('Camera', cx + 10, cy + 3);

    // Subject, rotated by yaw; local +y is the front.
    ctx.save();
    ctx.translate(CENTRE, CENTRE);
    const planYaw = stage.headState.yaw + stage.modelYaw + (stage.subject === 'teapot' ? 180 : 0);
    ctx.rotate(-rad(planYaw));
    if (stage.subject === 'teapot') drawTeapot();
    else drawHead();
    ctx.restore();

    rig.items.forEach(drawLight);
  }

  const tick = () => {
    draw();
    raf = requestAnimationFrame(tick);
  };

  function setOpen(open) {
    canvas.hidden = !open;
    wrap.classList.toggle('collapsed', !open);
    toggle.setAttribute('aria-expanded', open);
    cancelAnimationFrame(raf);
    if (open) tick();
  }
  toggle.addEventListener('click', () => setOpen(canvas.hidden));

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * SIZE, ((e.clientY - r.top) / r.height) * SIZE];
  };
  const nearest = (x, y) => hits
    .map((h) => ({ ...h, d: Math.hypot(h.x - x, h.y - y) }))
    .filter((h) => h.d <= HIT_RADIUS)
    .sort((a, b) => a.d - b.d)[0];

  canvas.addEventListener('pointerdown', (e) => {
    const hit = nearest(...local(e));
    if (!hit) return;
    dragId = hit.id;
    rig.select(hit.id);
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(e);
    if (dragId === null) {
      canvas.style.cursor = nearest(x, y) ? 'grab' : '';
      return;
    }
    const item = rig.items.find((i) => i.id === dragId);
    if (!item) return;
    const wx = (x - CENTRE) / K;
    const wz = (y - CENTRE) / K;
    // The plan shows horizontal range only, so divide out the elevation to get the true distance.
    const distance = Math.hypot(wx, wz) / Math.cos(rad(item.elevation));
    rig.update(dragId, {
      azimuth: Math.round(deg(Math.atan2(wx, wz))),
      distance: THREE.MathUtils.clamp(Math.round(distance * 10) / 10, 1.5, 8),
    });
  });

  const end = () => { dragId = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  setOpen(true);
}
