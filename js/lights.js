import * as THREE from 'three';

export const MAX_LIGHTS = 6;
export const TYPE_LABELS = { spot: 'Spot', point: 'Point', area: 'Softbox', reflector: 'Reflector', sun: 'Sun' };
export const REFLECTOR_COLORS = { White: '#ffffff', Gold: '#d4af37', Silver: '#c0c0c0' };

// Scales the 0-10 UI intensity to each light type's physical units.
const POWER = { spot: 12, point: 12, area: 6, reflector: 5, sun: 0.75 };
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

    if (item.type === 'spot' || item.type === 'area' || item.type === 'reflector') {
      // Softboxes and reflectors are wide, feathered spots: RectAreaLight casts no shadows, so it lit the nose through the head.
      const soft = item.type !== 'spot';
      const angle = { spot: 0.5, area: 0.9, reflector: 1.1 }[item.type];
      light = new THREE.SpotLight(item.color, 1, 0, angle, soft ? 1 : 0.6, 2);
      light.shadow.mapSize.set(2048, 2048);
      light.shadow.bias = -0.0003;
      light.shadow.normalBias = 0.02;
      light.shadow.camera.near = 1;
      light.shadow.camera.far = 14;
      light.castShadow = true;
      group.add(light.target);
      geometry = {
        spot: () => new THREE.CylinderGeometry(0.25, 0.12, 0.5).rotateX(-Math.PI / 2),
        area: () => new THREE.BoxGeometry(1.6, 1.6, 0.08),
        // About 38 cm across: the head is 2 units tall, roughly 23 cm.
        reflector: () => new THREE.CylinderGeometry(1.63, 1.63, 0.06, 64).rotateX(Math.PI / 2),
      }[item.type]();
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
    if (item.type === 'spot' || item.type === 'area' || item.type === 'reflector') {
      const lensGeometry = {
        spot: () => new THREE.CircleGeometry(0.25, 24),
        area: () => new THREE.PlaneGeometry(1.5, 1.5),
        reflector: () => new THREE.CircleGeometry(1.58, 64),
      }[item.type]();
      lens = new THREE.Mesh(lensGeometry, new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide }));
      lens.rotation.y = Math.PI;
      lens.position.z = { spot: -0.26, area: -0.05, reflector: -0.04 }[item.type];
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
    item.aim = dir.clone();

    // Object3D.lookAt points +Z at the target, so aim at the mirrored point to make -Z follow dir.
    item.group.position.copy(pos);
    item.group.lookAt(pos.clone().sub(dir));

    // A reflector has no output of its own; refreshReflectors() sets its colour and intensity.
    if (item.type !== 'reflector') {
      item.light.color.set(item.color);
      item.light.intensity = item.intensity * POWER[item.type];
    }
    if (item.type !== 'point') item.light.target.position.set(0, 0, -d);
    // Slide the real light back along its rays; only the marker follows the distance slider.
    if (item.type === 'sun') item.light.position.set(0, 0, SUN_DISTANCE - d);

    // Point lights and the sun are one solid colour; other bodies stay dark so the lit face stands out.
    const bodyColor = item.type === 'reflector' ? 0x9aa0aa : 0x3a3a46;
    item.visual.material.color.set(item.type === 'point' || item.type === 'sun' ? item.color : bodyColor);
    item.lens?.material.color.set(item.color);
    item.arrows.forEach((a) => {
      a.setColor(item.color);
      a.setLength(1.1, 0.3, 0.18);
    });
    item.visual.visible = gizmos;
    item.halo.visible = item.id === selectedId;
  }

  const find = (id) => items.find((i) => i.id === id);

  // Spot-like lights reach the reflector only inside their cone: [half-angle, penumbra].
  const CONES = { spot: [0.5, 0.6], area: [0.9, 1] };
  // Folds the reflector's area, reflectance and Lambertian spread into one tuning constant.
  const REFLECTOR_GAIN = 10;

  // A reflector re-emits what lands on its front face, so with no other light it stays dark.
  function refreshReflectors() {
    const sources = items.filter((i) => i.type !== 'reflector');
    const toSource = new THREE.Vector3();

    items.filter((i) => i.type === 'reflector').forEach((refl) => {
      let total = 0;
      const mix = new THREE.Color(0, 0, 0);
      const sourceColor = new THREE.Color();

      sources.forEach((src) => {
        let irradiance;
        if (src.type === 'sun') {
          irradiance = src.intensity * POWER.sun * Math.max(0, -src.aim.dot(refl.aim));
        } else {
          toSource.copy(src.group.position).sub(refl.group.position);
          const distance = toSource.length();
          toSource.normalize();
          irradiance = (src.intensity * POWER[src.type]) / (distance * distance) * Math.max(0, toSource.dot(refl.aim));
          const cone = CONES[src.type];
          if (cone) {
            const [angle, penumbra] = cone;
            const cosToReflector = -toSource.dot(src.aim);
            irradiance *= THREE.MathUtils.smoothstep(cosToReflector, Math.cos(angle), Math.cos(angle * (1 - penumbra)));
          }
        }
        sourceColor.set(src.color);
        mix.r += sourceColor.r * irradiance;
        mix.g += sourceColor.g * irradiance;
        mix.b += sourceColor.b * irradiance;
        total += irradiance;
      });

      // The bounced light takes the colour of what hits the reflector, tinted by its surface.
      const tint = new THREE.Color(refl.color);
      if (total > 0) mix.multiplyScalar(1 / total);
      else mix.set(1, 1, 1);
      refl.light.color.setRGB(tint.r * mix.r, tint.g * mix.g, tint.b * mix.b);
      // The intensity slider is the surface's reflectivity; 5 is a standard white reflector.
      refl.light.intensity = (refl.intensity / 5) * total * REFLECTOR_GAIN;
    });
  }

  const rig = {
    items,
    get selectedId() { return selectedId; },
    get selected() { return find(selectedId) ?? null; },
    onChange(fn) { listeners.add(fn); },
    hasSun: () => items.some((i) => i.type === 'sun'),
    get gizmosVisible() { return gizmos; },

    // Restores the values the light had when it was added or loaded from a preset.
    reset(id) {
      const item = find(id);
      if (item) rig.update(id, { ...item.initial });
    },

    add(params = {}) {
      if (items.length >= MAX_LIGHTS) return null;
      if (params.type === 'sun' && rig.hasSun()) return null;
      const item = { ...DEFAULTS, ...params, id: ++counter };
      if (item.type === 'reflector' && !Object.values(REFLECTOR_COLORS).includes(item.color.toLowerCase())) item.color = REFLECTOR_COLORS.White;
      item.name ??= item.type === 'reflector'
        ? `Reflector ${items.filter((existing) => existing.type === 'reflector').length + 1}`
        : `Light ${item.id}`;
      const { name, type, color, kelvin, intensity, azimuth, elevation, distance, pan, tilt } = item;
      item.initial = { name, type, color, kelvin, intensity, azimuth, elevation, distance, pan, tilt };
      items.push(item);
      build(item);
      refreshReflectors();
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
      refreshReflectors();
      emit('list');
    },

    duplicate(id) {
      const src = find(id);
      if (!src) return null;
      const { type, color, kelvin, intensity, azimuth, elevation, distance, pan, tilt } = src;
      return rig.add({ name: `${src.name} copy`, type, color, kelvin, intensity, azimuth: ((azimuth + 30 + 180) % 360) - 180, elevation, distance, pan, tilt });
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
      const changes = { ...patch };
      if (changes.type === 'reflector' && !Object.values(REFLECTOR_COLORS).includes((changes.color ?? item.color).toLowerCase())) {
        changes.color = REFLECTOR_COLORS.White;
        changes.kelvin = null;
      }
      if (item.type === 'reflector' && changes.color && !Object.values(REFLECTOR_COLORS).includes(changes.color.toLowerCase())) {
        changes.color = REFLECTOR_COLORS.White;
        changes.kelvin = null;
      }
      Object.assign(item, changes);
      if (typeChanged) {
        build(item);
      } else {
        apply(item);
      }
      refreshReflectors();
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
        const radius = { area: 1.3, reflector: 1.8 }[item.type] ?? 0.9;
        const between = along > 0 && along < reach;
        const t = between ? THREE.MathUtils.smoothstep(lateral, radius * 0.6, radius * 1.4) : 1;
        const opacity = 0.12 + 0.88 * t;
        item.fadeMaterials.forEach((m) => { m.opacity = opacity; });
      });
    },
  };

  return rig;
}
