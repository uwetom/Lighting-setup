import * as THREE from 'three';
import { ICON_SHAPES } from './icons.js';

const DEFAULT_SIZE = 260;
const MIN_SIZE = 260;
const KEYBOARD_SIZE_STEP = 20;
const RANGE = 9.5; // world units from the centre to the plan's edge
const HIT_RADIUS = 14;
const ICON_SIZE = 18;

const deg = THREE.MathUtils.radToDeg;
const rad = THREE.MathUtils.degToRad;

// Top-down diagram: +X is right, +Z (towards the default camera) is down.
export function setupPlan({ stage, rig }) {
  const wrap = document.querySelector('#plan');
  const toggle = document.querySelector('#plan-toggle');
  const canvas = document.querySelector('#plan-canvas');
  const fullscreen = document.querySelector('#plan-fullscreen');
  const resizeHandle = document.querySelector('#plan-resize');
  const download = document.querySelector('#plan-download');
  const dpr = Math.min(devicePixelRatio, 2);
  const ctx = canvas.getContext('2d');

  const dir = new THREE.Vector3();
  const iconImages = {};
  Object.entries(ICON_SHAPES).forEach(([type, shape]) => {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e6e6ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>`)}`;
    iconImages[type] = image;
  });
  let size = DEFAULT_SIZE;
  let centre = size / 2;
  let k = size / 2 / RANGE;
  let cameraMarker = { x: 0, y: 0 };
  let hits = [];
  let dragId = null;
  let resizeStart = null;
  let sizeBeforeFullscreen = null;
  let cameraControlsEnabled = true;
  let labelBounds = [];
  let raf = 0;

  const px = (x, z) => [centre + x * k, centre + z * k];

  function drawLabel(text, x, y) {
    ctx.font = '10px system-ui, sans-serif';
    const textWidth = ctx.measureText(text).width;
    const width = textWidth + 8;
    const height = 15;
    const options = [
      [x + 12, y - height - 3],
      [x + 12, y + 3],
      [x - width - 12, y - height - 3],
      [x - width - 12, y + 3],
    ];
    const pos = options.find(([left, top]) => left >= 2 && top >= 2 && left + width <= size - 2 && top + height <= size - 2
      && labelBounds.every((box) => left + width < box.left || left > box.right || top + height < box.top || top > box.bottom));
    const [left, top] = pos ?? options[0].map((value, index) => Math.max(2, Math.min(size - (index === 0 ? width : height) - 2, value)));
    labelBounds.push({ left, top, right: left + width, bottom: top + height });
    ctx.fillStyle = '#16161b';
    ctx.fillRect(left, top, width, height);
    ctx.fillStyle = '#e6e6ea';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, left + 4, top + height / 2);
  }

  function resize(nextSize) {
    const viewport = wrap.parentElement;
    const fullscreenActive = document.fullscreenElement === wrap || wrap.classList.contains('fullscreen-fallback');
    const width = fullscreenActive ? innerWidth : viewport.clientWidth;
    const height = fullscreenActive ? innerHeight : viewport.clientHeight;
    const maxSize = Math.max(MIN_SIZE, Math.min(width - 24, height - 24));
    size = Math.min(maxSize, Math.max(MIN_SIZE, nextSize));
    centre = size / 2;
    k = size / 2 / RANGE;
    canvas.width = canvas.height = size * dpr;
    canvas.style.width = canvas.style.height = `${size}px`;
    resizeHandle.setAttribute('aria-valuemax', maxSize);
    resizeHandle.setAttribute('aria-valuenow', size);
  }

  function drawLight(item) {
    const { x, z } = item.group.position;
    const [lx, ly] = px(x, z);
    dir.set(0, 0, -1).applyQuaternion(item.group.quaternion);
    const flat = Math.hypot(dir.x, dir.z);
    const output = item.enabled ? (item.type === 'reflector' ? item.light.intensity / 30 : item.intensity / 10) : 0;
    const strength = THREE.MathUtils.clamp(output, 0, 1);
    const reach = (item.type === 'area' || item.type === 'spot' ? 1 + strength * 6 : 1.3) * k;

    ctx.fillStyle = ctx.strokeStyle = item.color;

    if (item.type === 'point') {
      ctx.globalAlpha = 0.04 + strength * 0.2;
      ctx.beginPath();
      ctx.arc(lx, ly, (1 + strength * 6) * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (flat > 0.05) {
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
      } else if (item.type === 'area') {
        const half = 0.8 * k;
        const startX = lx + dx * 10;
        const startY = ly + dz * 10;
        const endX = lx + dx * reach;
        const endY = ly + dz * reach;
        ctx.globalAlpha = 0.08 + strength * 0.12;
        ctx.beginPath();
        ctx.moveTo(startX - dz * half, startY + dx * half);
        ctx.lineTo(endX - dz * half, endY + dx * half);
        ctx.lineTo(endX + dz * half, endY - dx * half);
        ctx.lineTo(startX + dz * half, startY - dx * half);
        ctx.closePath();
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

      if (item.type !== 'area') {
        const tx = lx + dx * reach;
        const ty = ly + dz * reach;
        ctx.beginPath();
        ctx.moveTo(tx + dx * 8, ty + dz * 8);
        ctx.lineTo(tx - dx * 2 - dz * 5, ty - dz * 2 + dx * 5);
        ctx.lineTo(tx - dx * 2 + dz * 5, ty - dz * 2 - dx * 5);
        ctx.fill();
      }

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

    ctx.fillStyle = '#16161b';
    ctx.beginPath();
    ctx.arc(lx, ly, ICON_SIZE * 0.65, 0, Math.PI * 2);
    ctx.fill();
    const icon = iconImages[item.type];
    if (icon?.complete && icon.naturalWidth) ctx.drawImage(icon, lx - ICON_SIZE / 2, ly - ICON_SIZE / 2, ICON_SIZE, ICON_SIZE);

    if (item.id === rig.selectedId) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(lx, ly, 13, 0, Math.PI * 2);
      ctx.stroke();
    }

    hits.push({ id: item.id, x: lx, y: ly });
    drawLabel(item.name.trim() || 'Untitled', lx, ly);
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
    labelBounds = [];

    ctx.strokeStyle = '#2f2f3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centre, 0);
    ctx.lineTo(centre, size);
    ctx.moveTo(0, centre);
    ctx.lineTo(size, centre);
    ctx.stroke();

    // The camera is shown at its actual horizontal world position, facing the head.
    const cam = stage.camera.position;
    const bearing = Math.atan2(cam.x, cam.z);
    const [cx, cy] = px(cam.x, cam.z);
    cameraMarker = { x: cx, y: cy };
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-bearing);
    ctx.fillStyle = '#3a3a46';
    ctx.strokeStyle = '#d6d6df';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-10, -6, 20, 15, 3);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-4, -9, 8, 4, 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 1, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#15151a';
    ctx.fill();
    ctx.strokeStyle = '#d6d6df';
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 1, 1.7, 0, Math.PI * 2);
    ctx.fillStyle = '#7aa7ff';
    ctx.fill();
    ctx.restore();
    drawLabel('Camera', cx, cy);

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
    toggle.setAttribute('aria-label', open ? 'Hide plan view' : 'Show plan view');
    toggle.title = open ? 'Hide plan view' : 'Show plan view';
    toggle.querySelector('path').setAttribute('d', open ? 'M5 12h14' : 'M12 5v14M5 12h14');
    cancelAnimationFrame(raf);
    if (open) tick();
  }
  resizeHandle.addEventListener('pointerdown', (e) => {
    resizeStart = { x: e.clientX, y: e.clientY, size };
    resizeHandle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  resizeHandle.addEventListener('pointermove', (e) => {
    if (!resizeStart) return;
    const delta = ((resizeStart.x - e.clientX) + (e.clientY - resizeStart.y)) / 2;
    resize(resizeStart.size + delta);
  });
  const endResize = () => { resizeStart = null; };
  resizeHandle.addEventListener('pointerup', endResize);
  resizeHandle.addEventListener('pointercancel', endResize);
  resizeHandle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') resize(size + KEYBOARD_SIZE_STEP);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') resize(size - KEYBOARD_SIZE_STEP);
    else return;
    e.preventDefault();
  });
  async function setFullscreen(active) {
    if (active) {
      sizeBeforeFullscreen = size;
      try {
        await wrap.requestFullscreen();
      } catch {
        wrap.classList.add('fullscreen-fallback');
      }
      resize(Math.min(innerWidth - 24, innerHeight - 24));
    } else if (document.fullscreenElement === wrap) {
      await document.exitFullscreen();
    } else {
      wrap.classList.remove('fullscreen-fallback');
    }
    if (!active) {
      const restoreSize = sizeBeforeFullscreen;
      sizeBeforeFullscreen = null;
      if (restoreSize !== null) resize(restoreSize);
    }
    syncFullscreen();
  }
  function syncFullscreen() {
    const active = document.fullscreenElement === wrap || wrap.classList.contains('fullscreen-fallback');
    fullscreen.setAttribute('aria-pressed', active);
    fullscreen.setAttribute('aria-label', active ? 'Exit full screen' : 'Enter full screen');
    fullscreen.title = active ? 'Exit full screen' : 'Enter full screen';
    fullscreen.querySelector('path').setAttribute('d', active
      ? 'M8 3v5H3M16 3v5h5M3 16h5v5M21 16h-5v5'
      : 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5');
    resize(size);
  }
  fullscreen.addEventListener('click', () => setFullscreen(!fullscreen.matches('[aria-pressed=true]')));
  document.addEventListener('fullscreenchange', syncFullscreen);
  window.addEventListener('resize', () => resize(size));
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
  syncFullscreen();
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
    const point = local(e);
    if (Math.hypot(cameraMarker.x - point[0], cameraMarker.y - point[1]) <= HIT_RADIUS) {
      dragId = 'camera';
      cameraControlsEnabled = stage.controls.enabled;
      stage.controls.enabled = false;
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    const hit = nearest(...point);
    if (!hit) return;
    dragId = hit.id;
    rig.select(hit.id);
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(e);
    if (dragId === null) {
      canvas.style.cursor = Math.hypot(cameraMarker.x - x, cameraMarker.y - y) <= HIT_RADIUS || nearest(x, y) ? 'grab' : '';
      return;
    }
    if (dragId === 'camera') {
      stage.clearSnapshotPreview();
      const { target } = stage.controls;
      const offsetX = (x - centre) / k - target.x;
      const offsetZ = (y - centre) / k - target.z;
      const horizontal = Math.hypot(offsetX, offsetZ);
      const directionX = horizontal > 0 ? offsetX / horizontal : 0;
      const directionZ = horizontal > 0 ? offsetZ / horizontal : 1;
      const height = stage.camera.position.y - target.y;
      const minHorizontal = Math.sqrt(Math.max(0, stage.controls.minDistance ** 2 - height ** 2));
      const maxHorizontal = Math.min(
        RANGE - 0.5,
        Math.sqrt(Math.max(0, stage.controls.maxDistance ** 2 - height ** 2)),
      );
      const distance = THREE.MathUtils.clamp(horizontal, minHorizontal, maxHorizontal);
      stage.camera.position.x = target.x + directionX * distance;
      stage.camera.position.z = target.z + directionZ * distance;
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

  const end = () => {
    if (dragId === 'camera') stage.controls.enabled = cameraControlsEnabled;
    dragId = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  setOpen(true);
}
