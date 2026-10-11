// Bakes a per-vertex "thickness" for a glb: the distance from each vertex inward along its normal to the far surface.
// Usage: node tools/make-thickness.mjs <input.glb> <output.bin>
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
const MAX_DISTANCE = 4; // distances at or beyond this count as fully thick (1.0)

const glb = readFileSync(input);
const jsonLength = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
const bin = glb.subarray(20 + jsonLength + 8);

const primitive = json.meshes[0].primitives[0];
function read(accessorIndex, ArrayType) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const size = { SCALAR: 1, VEC3: 3 }[accessor.type];
  return new ArrayType(bin.buffer.slice(bin.byteOffset + offset, bin.byteOffset + offset + accessor.count * size * ArrayType.BYTES_PER_ELEMENT));
}

const positions = read(primitive.attributes.POSITION, Float32Array);
const normals = read(primitive.attributes.NORMAL, Float32Array);
const indices = read(primitive.indices, json.accessors[primitive.indices].componentType === 5125 ? Uint32Array : Uint16Array);

const vertexCount = positions.length / 3;
const triangleCount = indices.length / 3;

// Triangle origin and edges, for Moller-Trumbore.
const tri = new Float32Array(triangleCount * 9);
for (let t = 0; t < triangleCount; t++) {
  const [a, b, c] = [indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]];
  for (let k = 0; k < 3; k++) {
    const p0 = positions[a * 3 + k];
    tri[t * 9 + k] = p0;
    tri[t * 9 + 3 + k] = positions[b * 3 + k] - p0;
    tri[t * 9 + 6 + k] = positions[c * 3 + k] - p0;
  }
}

const result = new Float32Array(vertexCount);
for (let v = 0; v < vertexCount; v++) {
  let nx = normals[v * 3];
  let ny = normals[v * 3 + 1];
  let nz = normals[v * 3 + 2];
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len; ny /= len; nz /= len;

  // Start just inside the surface and fire along the inward normal.
  const ox = positions[v * 3] - nx * 0.02;
  const oy = positions[v * 3 + 1] - ny * 0.02;
  const oz = positions[v * 3 + 2] - nz * 0.02;
  const dx = -nx;
  const dy = -ny;
  const dz = -nz;

  let nearest = Infinity;
  for (let t = 0; t < triangleCount; t++) {
    const i = t * 9;
    const e1x = tri[i + 3], e1y = tri[i + 4], e1z = tri[i + 5];
    const e2x = tri[i + 6], e2y = tri[i + 7], e2z = tri[i + 8];
    const px = dy * e2z - dz * e2y;
    const py = dz * e2x - dx * e2z;
    const pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-9) continue;
    const inv = 1 / det;
    const sx = ox - tri[i], sy = oy - tri[i + 1], sz = oz - tri[i + 2];
    const u = (sx * px + sy * py + sz * pz) * inv;
    if (u < 0 || u > 1) continue;
    const qx = sy * e1z - sz * e1y;
    const qy = sz * e1x - sx * e1z;
    const qz = sx * e1y - sy * e1x;
    const w = (dx * qx + dy * qy + dz * qz) * inv;
    if (w < 0 || u + w > 1) continue;
    const dist = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (dist > 1e-4 && dist < nearest) nearest = dist;
  }
  result[v] = Math.min(nearest, MAX_DISTANCE) / MAX_DISTANCE;
}

writeFileSync(output, Buffer.from(result.buffer));
const sorted = [...result].sort((a, b) => a - b);
console.log(`vertices ${vertexCount}, triangles ${triangleCount}`);
console.log(`thickness min ${sorted[0].toFixed(3)}, median ${sorted[sorted.length >> 1].toFixed(3)}, max ${sorted.at(-1).toFixed(3)}`);
console.log(`thin (<0.25): ${((sorted.filter((x) => x < 0.25).length / vertexCount) * 100).toFixed(1)}%`);
