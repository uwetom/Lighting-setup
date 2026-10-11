import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import { EXRLoader } from 'three/addons/EXRLoader.js';
import { TeapotGeometry } from 'three/addons/TeapotGeometry.js';

const HEAD_HEIGHT = 2;
const CAMERA_HOME = new THREE.Vector3(0, 0.2, 7.5);

export async function createStage(container, statusEl) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b0e);
  scene.add(new THREE.AmbientLight(0xffffff, 0.03));

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.copy(CAMERA_HOME);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 40;

  const headPivot = new THREE.Group();
  headPivot.rotation.order = 'YXZ';
  scene.add(headPivot);

  const headState = { yaw: 0, pitch: 0, roll: 0 };
  const headListeners = new Set();
  const setHead = (patch) => {
    Object.assign(headState, patch);
    // Objects on a surface can only turn about the vertical axis.
    if (subject === 'teapot') headState.pitch = headState.roll = 0;
    headPivot.rotation.set(
      THREE.MathUtils.degToRad(headState.pitch),
      THREE.MathUtils.degToRad(headState.yaw),
      THREE.MathUtils.degToRad(headState.roll),
    );
    headListeners.forEach((fn) => fn(headState));
  };

  let headMesh = null;
  let subject = 'head';
  let loadToken = 0;

  // Fixed in the scene (not the rotating pivot) so the teapot turns on it.
  const surface = new THREE.Mesh(
    new THREE.CircleGeometry(7, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x8c8c96, roughness: 0.85 }),
  );
  surface.receiveShadow = true;
  surface.visible = false;
  scene.add(surface);

  // Softbox lights cast no shadows, so a soft dark blob stands in for contact shadow under the object.
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, toneMapped: false }),
  );
  contact.visible = false;
  scene.add(contact);

  const gltfLoader = new GLTFLoader();

  // Backgrounds also light the subject: the background is prefiltered into scene.environment.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const exrLoader = new EXRLoader();
  const hdriCache = new Map();
  let envTarget = null;
  let envScale = 1;
  let envIntensity = 1;
  let backgroundToken = 0;
  let sourceTexture = null;
  let rotatedTexture = null;
  let rotation = 0;
  let rotateQueued = false;

  // three r160 has no background rotation, so spin an equirect image by wrapping its columns.
  function rotateTexture(src, degrees) {
    const { data, width, height } = src.image;
    const shift = Math.round((((degrees % 360) + 360) % 360) / 360 * width);
    if (shift === 0) return src;
    const out = new data.constructor(data.length);
    const row = width * 4;
    for (let y = 0; y < height; y++) {
      const base = y * row;
      out.set(data.subarray(base + shift * 4, base + row), base);
      out.set(data.subarray(base, base + shift * 4), base + row - shift * 4);
    }
    const tex = new THREE.DataTexture(out, width, height, src.format, src.type);
    tex.mapping = src.mapping;
    tex.colorSpace = src.colorSpace;
    tex.flipY = src.flipY;
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  function showHdri() {
    if (rotatedTexture) rotatedTexture.dispose();
    rotatedTexture = rotateTexture(sourceTexture, rotation);
    envTarget?.dispose();
    envTarget = pmrem.fromEquirectangular(rotatedTexture);
    scene.environment = envTarget.texture;
    scene.background = rotatedTexture;
    applyEnvIntensity();
  }

  function applyEnvIntensity() {
    [headPivot, surface].forEach((root) => root.traverse((o) => {
      [o.material].flat().forEach((m) => { if (m && 'envMapIntensity' in m) m.envMapIntensity = envIntensity * envScale; });
    }));
  }

  async function setBackground(def) {
    const token = ++backgroundToken;
    let background = new THREE.Color(def.color ?? 0x0b0b0e);
    let env = null;

    try {
      if (def.url) {
        statusEl.classList.remove('error');
        statusEl.textContent = 'Loading background...';
        statusEl.hidden = false;
        if (!hdriCache.has(def.url)) {
          const texture = await exrLoader.loadAsync(def.url);
          texture.mapping = THREE.EquirectangularReflectionMapping;
          hdriCache.set(def.url, texture);
        }
        if (token !== backgroundToken) return;
        sourceTexture = hdriCache.get(def.url);
        envScale = def.envScale ?? 1;
        showHdri();
        statusEl.hidden = true;
        return;
      }
      if (def.light) {
        // A flat colour lights the subject evenly, like an infinity cove.
        const room = new THREE.Scene();
        room.background = background;
        env = pmrem.fromScene(room);
      }
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Could not load the background image.';
      statusEl.classList.add('error');
      return;
    }

    sourceTexture = null;
    if (rotatedTexture) rotatedTexture.dispose();
    rotatedTexture = null;
    envTarget?.dispose();
    envTarget = env;
    envScale = def.envScale ?? 1;
    scene.environment = env?.texture ?? null;
    scene.background = background;
    applyEnvIntensity();
  }

  async function loadHeadModel(def) {
    const token = ++loadToken;
    statusEl.classList.remove('error');
    statusEl.textContent = 'Loading model...';
    statusEl.hidden = false;
    try {
      const mesh = await loadHead(def, gltfLoader);
      if (token !== loadToken) return;
      // Cast shadows from both faces; thin or open scans otherwise let light leak onto the far side.
      mesh.traverse((o) => [o.material].flat().forEach((m) => { if (m) m.shadowSide = THREE.DoubleSide; }));
      if (headMesh) {
        headPivot.remove(headMesh);
        headMesh.traverse((o) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
      }
      headMesh = mesh;
      headPivot.add(headMesh);
      subject = def.kind ?? 'head';
      surface.visible = subject === 'teapot';
      surface.position.y = mesh.userData.floorY ?? 0;
      contact.visible = subject === 'teapot';
      contact.position.y = surface.position.y + 0.002;
      contact.scale.setScalar((mesh.userData.footprint ?? 1) * 2.6);
      applyEnvIntensity();
      setHead({});
      statusEl.hidden = true;
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Could not load the head model. Serve this folder over HTTP (see README).';
      statusEl.classList.add('error');
    }
  }

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  const frameListeners = new Set();
  renderer.setAnimationLoop(() => {
    controls.update();
    frameListeners.forEach((fn) => fn());
    renderer.render(scene, camera);
  });

  return {
    scene,
    camera,
    controls,
    renderer,
    get headMesh() { return headMesh; },
    get subject() { return subject; },
    headState,
    setHead,
    loadHeadModel,
    setBackground,
    // Coalesces slider drags into one rebuild per frame.
    setBackgroundRotation: (degrees) => {
      rotation = degrees;
      if (!sourceTexture || rotateQueued) return;
      rotateQueued = true;
      requestAnimationFrame(() => {
        rotateQueued = false;
        if (sourceTexture) showHdri();
      });
    },
    setEnvIntensity: (v) => {
      envIntensity = v;
      applyEnvIntensity();
    },
    onFrame: (fn) => frameListeners.add(fn),
    onHeadChange: (fn) => headListeners.add(fn),
    setExposure: (v) => { renderer.toneMappingExposure = v; },
    resetCamera: () => {
      camera.position.copy(CAMERA_HOME);
      controls.target.set(0, 0, 0);
    },
  };
}

// Textures are optional: heads without them fall back to the maps embedded in the glb.
async function loadHead(def, loader) {
  if (def.kind === 'teapot') {
    if (!def.model) return makeTeapot();
    try {
      return await loadObject(def, loader);
    } catch (err) {
      console.warn(`Could not load ${def.model}; using the built-in teapot.`, err);
      return makeTeapot();
    }
  }
  const textures = new THREE.TextureLoader();
  const [gltf, colour, normal] = await Promise.all([
    loader.loadAsync(def.model),
    def.map ? textures.loadAsync(def.map) : null,
    def.normalMap ? textures.loadAsync(def.normalMap) : null,
  ]);

  let source;
  gltf.scene.traverse((o) => { if (o.isMesh && !source) source = o; });
  const geometry = source.geometry;
  const map = colour ?? source.material.map ?? null;
  const normalMap = normal ?? source.material.normalMap ?? null;

  if (map) map.colorSpace = THREE.SRGBColorSpace;
  if (map) map.anisotropy = 8;
  if (normalMap) normalMap.anisotropy = 8;

  const material = new THREE.MeshPhysicalMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.55,
    sheen: 0.4,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0xffd7c4),
    clearcoat: 0.08,
    clearcoatRoughness: 0.4,
  });

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = HEAD_HEIGHT / size.y;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.setScalar(scale);
  mesh.position.copy(center).multiplyScalar(-scale);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// Loads a whole glb scene, scaled to a fixed height and centred on the pivot.
async function loadObject(def, loader) {
  const { scene } = await loader.loadAsync(def.model);
  scene.rotation.y = THREE.MathUtils.degToRad(def.rotationY ?? 0);
  scene.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  scene.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = (def.kind === 'teapot' ? HEAD_HEIGHT * 0.8 : HEAD_HEIGHT) / size.y;

  const holder = new THREE.Group();
  scene.scale.setScalar(scale);
  scene.position.copy(center).multiplyScalar(-scale);
  holder.add(scene);
  holder.userData.floorY = (box.min.y - center.y) * scale;
  holder.userData.footprint = (Math.max(size.x, size.z) / 2) * scale;
  return holder;
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.6)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeTeapot() {
  // The model's spout points +X; turn it to +Z so "front" matches the head.
  const geometry = new TeapotGeometry(1, 18).rotateY(-Math.PI / 2);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const scale = (HEAD_HEIGHT * 0.8) / (box.max.y - box.min.y);
  const center = box.getCenter(new THREE.Vector3());

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0xb4623c, roughness: 0.8 }),
  );
  mesh.scale.setScalar(scale);
  mesh.position.copy(center).multiplyScalar(-scale);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.floorY = box.min.y * scale - center.y * scale;
  mesh.userData.footprint = (Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2) * scale;
  return mesh;
}
