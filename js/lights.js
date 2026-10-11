import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/RectAreaLightUniformsLib.js';

export const MAX_LIGHTS = 6;
export const TYPE_LABELS = { spot: 'Spot', point: 'Point', area: 'Softbox', sun: 'Sun' };

// Scales the 0-10 UI intensity to each light type's physical units.
const POWER = { spot: 12, point: 12, area: 3, sun: 0.75 };
const UP = new THREE.Vector3(0, 1, 0);
// The sun's THREE.DirectionalLight sits this far from the subject whatever the marker distance, so shadows never change with it.
const SUN_DISTANCE = 10;
const rad = THREE.MathUtils.degToRad;

const DEFAULTS = {
  type: 'spot',
  color: '#ffffff',
  intensity: 5,
  azimuth: 30,
  elevation: 20,
  distance: 4,
  pan: 0,
  tilt: 0,
};

export function createLightRig(scene) {
  RectAreaLightUniformsLib.init();

  const root = new THREE.Group();
  scene.add(root);

  const items = [];
  const listeners = new Set();
  let selectedId = null;
  let gizmos = true;
  let counter = 0;

  const emit = (kind) => listeners.forEach((fn) => fn(kind));

  function dispose(item) {
    root.remove(item.group);
    item.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    item.light.dispose?.();
  }

  function build(item) {
    if (item.group) dispose(item);

    const group = new THREE.Group();
    let light;
    let geometry;

    if (item.type === 'spot') {
      light = new THREE.SpotLight(item.color, 1, 0, 0.5, 0.6, 2);
      light.shadow.mapSize.set(2048, 2048);
      light.shadow.bias = -0.0003;
      light.shadow.normalBias = 0.02;
      light.shadow.camera.near = 1;
      light.shadow.camera.far = 14;
      light.castShadow = true;
      group.add(light.target);
      geometry = new THREE.CylinderGeometry(0.25, 0.12, 0.5).rotateX(-Math.PI / 2);
    } else if (item.type === 'point') {
      light = new THREE.PointLight(item.color, 1, 0, 2);
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.bias = -0.0003;
      light.shadow.normalBias = 0.02;
      light.shadow.camera.near = 0.5;
      light.shadow.camera.far = 14;
      light.castShadow = true;
      geometry = new THREE.SphereGeometry(0.18, 24, 16);
    } else if (item.type === 'sun') {
      // THREE.DirectionalLight: parallel rays, so only its direction matters.
      light = new THREE.DirectionalLight(item.color, 1);
      light.shadow.mapSize.set(2048, 2048);
      light.shadow.bias = -0.0003;
      light.shadow.normalBias = 0.02;
      Object.assign(light.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 25 });
      light.castShadow = true;
      group.add(light.target);
      geometry = new THREE.SphereGeometry(0.28, 24, 16);
    } else {
      light = new THREE.RectAreaLight(item.color, 1, 1.6, 1.6);
      geometry = new THREE.BoxGeometry(1.6, 1.6, 0.08);
    }
    group.add(light);

    const visual = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ toneMapped: false }));
    visual.userData.id = item.id;
    const halo = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, toneMapped: false }),
    );
    halo.scale.setScalar(1.25);
    visual.add(halo);
    group.add(visual);

    // Directional lights get a bright lens on the emitting face and aim arrows (several parallel ones for the sun).
    let lens = null;
    let arrows = [];
    if (item.type === 'spot' || item.type === 'area') {
      lens = new THREE.Mesh(
        item.type === 'spot' ? new THREE.CircleGeometry(0.25, 24) : new THREE.PlaneGeometry(1.5, 1.5),
        new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide }),
      );
      lens.rotation.y = Math.PI;
      lens.position.z = item.type === 'spot' ? -0.26 : -0.05;
      visual.add(lens);
    }
    if (item.type !== 'point') {
      const offsets = item.type === 'sun' ? [[0, 0], [0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]] : [[0, 0]];
      arrows = offsets.map(([x, y]) => {
        const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(x, y, -0.3), 1, 0xffffff, 0.35, 0.2);
        arrow.line.material.toneMapped = false;
        arrow.cone.material.toneMapped = false;
        visual.add(arrow);
        return arrow;
      });
    }

    Object.assign(item, { group, light, visual, halo, lens, arrows });
    // Every part of the marker fades together when it blocks the camera's view.
    item.fadeMaterials = [visual, halo, lens, ...arrows.flatMap((a) => [a.line, a.cone])]
      .filter(Boolean)
      .map((o) => o.material);
    item.fadeMaterials.forEach((m) => { m.transparent = true; });
    root.add(group);
    apply(item);
  }

  function apply(item) {
    const az = rad(item.azimuth);
    const el = rad(item.elevation);
    const d = item.distance;
    const pos = new THREE.Vector3(
      Math.cos(el) * Math.sin(az) * d,
      Math.sin(el) * d,
      Math.cos(el) * Math.cos(az) * d,
    );

    // Aim at the head, then offset by pan (around Y) and tilt (around the light's right axis).
    const dir = pos.clone().negate().normalize();
    dir.applyAxisAngle(UP, rad(item.pan));
    dir.applyAxisAngle(new THREE.Vector3().crossVectors(dir, UP).normalize(), rad(item.tilt));

    // Object3D.lookAt points +Z at the target, so aim at the mirrored point to make -Z follow dir.
    item.group.position.copy(pos);
    item.group.lookAt(pos.clone().sub(dir));

    item.light.color.set(item.color);
    item.light.intensity = item.intensity * POWER[item.type];
    if (item.type === 'spot' || item.type === 'sun') item.light.target.position.set(0, 0, -d);
    // Slide the real light back along its rays; only the marker follows the distance slider.
    if (item.type === 'sun') item.light.position.set(0, 0, SUN_DISTANCE - d);

    // Point lights and the sun are one solid colour; other bodies stay dark so the lit face stands out.
    item.visual.material.color.set(item.type === 'point' || item.type === 'sun' ? item.color : 0x3a3a46);
    item.lens?.material.color.set(item.color);
    item.arrows.forEach((a) => {
      a.setColor(item.color);
      a.setLength(1.1, 0.3, 0.18);
    });
    item.visual.visible = gizmos;
    item.halo.visible = item.id === selectedId;
  }

  const find = (id) => items.find((i) => i.id === id);

  const rig = {
    items,
    get selectedId() { return selectedId; },
    get selected() { return find(selectedId) ?? null; },
    onChange(fn) { listeners.add(fn); },
    hasSun: () => items.some((i) => i.type === 'sun'),

    // Restores the values the light had when it was added or loaded from a preset.
    reset(id) {
      const item = find(id);
      if (item) rig.update(id, { ...item.initial });
    },

    add(params = {}) {
      if (items.length >= MAX_LIGHTS) return null;
      if (params.type === 'sun' && rig.hasSun()) return null;
      const item = { ...DEFAULTS, ...params, id: ++counter };
      item.name = `${TYPE_LABELS[item.type]} ${item.id}`;
      const { type, color, kelvin, intensity, azimuth, elevation, distance, pan, tilt } = item;
      item.initial = { type, color, kelvin, intensity, azimuth, elevation, distance, pan, tilt };
      items.push(item);
      build(item);
      rig.select(item.id);
      return item;
    },

    remove(id) {
      const i = items.findIndex((it) => it.id === id);
      if (i < 0) return;
      const [item] = items.splice(i, 1);
      dispose(item);
      if (selectedId === id) selectedId = items.at(-1)?.id ?? null;
      items.forEach(apply);
      emit('list');
    },

    duplicate(id) {
      const src = find(id);
      if (!src) return null;
      const { type, color, kelvin, intensity, azimuth, elevation, distance, pan, tilt } = src;
      return rig.add({ type, color, kelvin, intensity, azimuth: ((azimuth + 30 + 180) % 360) - 180, elevation, distance, pan, tilt });
    },

    select(id) {
      selectedId = id;
      items.forEach((it) => { it.halo.visible = it.id === id; });
      emit('list');
    },

    update(id, patch) {
      const item = find(id);
      if (!item) return;
      // Only one sun is allowed.
      if (patch.type === 'sun' && patch.type !== item.type && rig.hasSun()) return;
      const typeChanged = patch.type && patch.type !== item.type;
      Object.assign(item, patch);
      if (typeChanged) {
        item.name = `${TYPE_LABELS[item.type]} ${item.id}`;
        build(item);
      } else {
        apply(item);
      }
      emit(typeChanged ? 'list' : 'item');
    },

    loadPreset(lights) {
      items.forEach(dispose);
      items.length = 0;
      selectedId = null;
      lights.forEach((l) => rig.add(l));
      rig.select(items[0]?.id ?? null);
    },

    setGizmos(visible) {
      gizmos = visible;
      items.forEach(apply);
    },

    // Light markers the pointer can grab; empty when markers are hidden.
    pickables: () => (gizmos ? items.map((i) => i.visual) : []),

    // Makes markers that sit on the line between the camera and the subject translucent.
    fade(cameraPosition) {
      const reach = cameraPosition.length();
      const u = cameraPosition.clone().negate().normalize();
      const v = new THREE.Vector3();
      items.forEach((item) => {
        v.copy(item.group.position).sub(cameraPosition);
        const along = v.dot(u);
        const lateral = v.addScaledVector(u, -along).length();
        const radius = item.type === 'area' ? 1.3 : 0.9;
        const between = along > 0 && along < reach;
        const t = between ? THREE.MathUtils.smoothstep(lateral, radius * 0.6, radius * 1.4) : 1;
        const opacity = 0.12 + 0.88 * t;
        item.fadeMaterials.forEach((m) => { m.opacity = opacity; });
      });
    },
  };

  return rig;
}
