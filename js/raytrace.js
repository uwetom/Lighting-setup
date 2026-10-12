import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/Pass.js';

const SAMPLE_COUNT = 256;
let pathTracerLibraryPromise;

async function getPathTracerLibrary() {
  if (!pathTracerLibraryPromise) {
    pathTracerLibraryPromise = (async () => {
      const bvh = await import('../vendor/three-mesh-bvh/build/index.module.js');
      const previousThree = globalThis.THREE;
      const previousBvh = globalThis.MeshBVHLib;
      class CompatibleScene extends THREE.Scene {
        constructor() {
          super();
          this.backgroundRotation = new THREE.Euler();
          this.environmentRotation = new THREE.Euler();
        }
      }
      globalThis.THREE = { ...THREE, FullScreenQuad };
      globalThis.THREE.Scene = CompatibleScene;
      globalThis.MeshBVHLib = bvh;
      try {
        await import('../vendor/three-gpu-pathtracer.js');
        return globalThis.ThreePathTracer;
      } finally {
        if (previousThree === undefined) delete globalThis.THREE;
        else globalThis.THREE = previousThree;
        if (previousBvh === undefined) delete globalThis.MeshBVHLib;
        else globalThis.MeshBVHLib = previousBvh;
      }
    })();
  }
  return pathTracerLibraryPromise;
}

function createPathTracingScene(scene, rig) {
  const sourceObjects = [];
  scene.traverse((object) => sourceObjects.push(object));
  const pathScene = scene.clone(true);
  pathScene.backgroundRotation ??= new THREE.Euler();
  pathScene.environmentRotation ??= new THREE.Euler();
  const clonedObjects = [];
  pathScene.traverse((object) => clonedObjects.push(object));
  const clones = new Map(sourceObjects.map((object, index) => [object.uuid, clonedObjects[index]]));
  const materialClones = new Map();

  pathScene.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    const cloneMaterial = (material) => {
      if (!materialClones.has(material.uuid)) materialClones.set(material.uuid, material.clone());
      return materialClones.get(material.uuid);
    };
    object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (material.normalMap && material.normalScale) material.normalScale.multiplyScalar(0.5);
    });
    if (object.userData.id !== undefined || materials.every((material) => material.type === 'MeshBasicMaterial')) object.visible = false;
  });

  rig.items.filter((item) => item.type === 'area').forEach((item) => {
    const group = clones.get(item.group.uuid);
    const sourceLight = clones.get(item.light.uuid);
    sourceLight.visible = false;
    const areaLight = new THREE.RectAreaLight(
      item.color,
      item.enabled ? item.light.intensity : 0,
      1.5,
      1.5,
    );
    areaLight.position.copy(sourceLight.position);
    areaLight.quaternion.copy(sourceLight.quaternion);
    group.add(areaLight);
  });

  return pathScene;
}

async function removeIsolatedBrightPixels(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const original = pixels.slice();
  const luminance = (index) => original[index] * 0.2126 + original[index + 1] * 0.7152 + original[index + 2] * 0.0722;

  for (let y = 1; y < canvas.height - 1; y += 1) {
    for (let x = 1; x < canvas.width - 1; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const center = luminance(index);
      if (center < 210) continue;
      const neighbors = [];
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          neighbors.push(((y + offsetY) * canvas.width + x + offsetX) * 4);
        }
      }
      const neighborLuminance = neighbors.map(luminance).sort((a, b) => a - b)[4];
      if (center - neighborLuminance < 35) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        const values = neighbors.map((neighbor) => original[neighbor + channel]).sort((a, b) => a - b);
        pixels[index + channel] = values[4];
      }
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

export async function renderRayTracedImage(renderer, scene, camera, rig, onProgress = () => {}) {
  const { WebGLPathTracer, DenoiseMaterial } = await getPathTracerLibrary();
  const pathScene = createPathTracingScene(scene, rig);
  const pathCamera = camera.clone();
  const pathTracer = new WebGLPathTracer(renderer);
  pathTracer.renderToCanvas = false;
  pathTracer.bounces = 5;
  pathTracer.filterGlossyFactor = 0.25;
  let denoiseMaterial;
  let denoiseQuad;

  try {
    pathTracer.setScene(pathScene, pathCamera);
    for (let sample = 1; sample <= SAMPLE_COUNT; sample += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      pathTracer.renderSample();
      onProgress(sample, SAMPLE_COUNT);
    }
    denoiseMaterial = new DenoiseMaterial({
      map: pathTracer.target.texture,
      sigma: 3,
      threshold: 0.06,
      kSigma: 1.5,
    });
    denoiseQuad = new FullScreenQuad(denoiseMaterial);
    renderer.setRenderTarget(null);
    renderer.clear();
    denoiseQuad.render(renderer);
    return await removeIsolatedBrightPixels(renderer.domElement.toDataURL('image/png'));
  } finally {
    denoiseQuad?.dispose();
    denoiseMaterial?.dispose();
    pathTracer._quad?.dispose();
    pathTracer._quad?.material?.dispose();
    pathTracer._pathTracer?.dispose();
    pathTracer._lowResPathTracer?.dispose();
  }
}