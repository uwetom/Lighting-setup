import * as THREE from 'three';

const DEFAULT_SIZE = 260;
const MIN_SIZE = 260;
const MAX_SIZE = 500;
const SIZE_STEP = 60;
const RANGE = 9.5; // world units from the centre to the plan's edge
const HIT_RADIUS = 14;

const deg = THREE.MathUtils.radToDeg;
const rad = THREE.MathUtils.degToRad;

// Top-down diagram: +X is right, +Z (towards the default camera) is down.
export function setupPlan({ stage, rig }) {
  const wrap = document.querySelector('#plan');
  const toggle = document.querySelector('#plan-toggle');
  const canvas = document.querySelector('#plan-canvas');
  const smaller = document.querySelector('#plan-smaller');
  const larger = document.querySelector('#plan-larger');
  const download = document.querySelector('#plan-download');
  const dpr = Math.min(devicePixelRatio, 2);
  const ctx = canvas.getContext('2d');

  const dir = new THREE.Vector3();
  let size = DEFAULT_SIZE;
  let centre = size / 2;
  let k = size / 2 / RANGE;
  let hits = [];
  let dragId = null;
  let raf = 0;

  const px = (x, z) => [centre + x * k, centre + z * k];

  function resize(nextSize) {
    size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, nextSize));
    centre = size / 2;
    k = size / 2 / RANGE;
    canvas.width = canvas.height = size * dpr;
    canvas.style.width = canvas.style.height = `${size}px`;
    smaller.disabled = size === MIN_SIZE;
    larger.disabled = size === MAX_SIZE;
  }

  function drawLight(item) {
    const { x, z } = item.group.position;
    const [lx, ly] = px(x, z);
    dir.set(0, 0, -1).applyQuaternion(item.group.quaternion);
    const flat = Math.hypot(dir.x, dir.z);
    const reach = 1.3 * k;
    const output = item.enabled ? (item.type === 'reflector' ? item.light.intensity / 30 : item.intensity / 10) : 0;
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
        ctx.arc(lx, ly, (1 + strength * 6) * k, heading - 0.5, heading + 0.5);
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
          ctx.moveTo(lx - dz * o * k, ly + dx * o * k);
          ctx.lineTo(lx - dz * o * k + dx * reach, ly + dx * o * k + dz * reach);
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
        const half = 1.63 * k;
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
        const half = 0.8 * k;
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

    hits.push({ id: item.id, x: lx, y: ly });
  }

  function drawHead() {
    const skin = '#c9a58a';
    const shade = '#a8826a';
    const oval = (x, y, rx, ry, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(x * k, y * k, rx * k, ry * k, 0, 0, Math.PI * 2);
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
    ctx.ellipse(0, 1.0 * k, 0.14 * k, 0.4 * k, 0, 0, Math.PI * 2); // spout
    ctx.fill();
    ctx.strokeStyle = '#8f4a2a';
      ctx.ellipse(x * k, y * k, rx * k, ry * k, 0, 0, Math.PI * 2);
    ctx.beginPath();
    ctx.arc(0, -0.95 * k, 0.3 * k, 0, Math.PI * 2); // handle
    oval(-0.7, -0.05, 0.12, 0.26, shade); // ears
    oval(0.7, -0.05, 0.12, 0.26, shade);
    oval(0, 0, 0.7, 0.85, skin); // skull, deeper front-to-back than wide
    oval(0, 0.92, 0.13, 0.16, shade);
    ctx.fill();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    hits = [];

    ctx.strokeStyle = '#2f2f3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centre, 0);
    ctx.lineTo(centre, size);
    ctx.moveTo(0, centre);
    ctx.lineTo(size, centre);
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
    ctx.translate(centre, centre);
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
  smaller.addEventListener('click', () => resize(size - SIZE_STEP));
  larger.addEventListener('click', () => resize(size + SIZE_STEP));
  download.addEventListener('click', () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportContext = exportCanvas.getContext('2d');
    exportContext.fillStyle = '#16161b';
    exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportContext.drawImage(canvas, 0, 0);
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'lighting-plan.png';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  });
  resize(size);
  toggle.addEventListener('click', () => setOpen(canvas.hidden));

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * size, ((e.clientY - r.top) / r.height) * size];
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
    const wx = (x - centre) / k;
    const wz = (y - centre) / k;
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
