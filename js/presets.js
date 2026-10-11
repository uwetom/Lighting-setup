// Azimuth 0 is straight in front of the subject; positive azimuth is to the viewer's right.
const warm = '#fff1e0';
const cool = '#dbe8ff';

export const PRESETS = [
  {
    name: 'Three-point',
    description: 'Classic portrait setup: a strong key from one side, a softer fill on the other to lift shadows, and a rim light behind for edge separation.',
    lights: [
      { type: 'spot', color: warm, intensity: 6, azimuth: 45, elevation: 35, distance: 4 },
      { type: 'area', color: cool, intensity: 2.5, azimuth: -50, elevation: 10, distance: 4.5 },
      { type: 'spot', color: '#ffffff', intensity: 6, azimuth: 150, elevation: 40, distance: 4 },
    ],
  },
  {
    name: 'Rembrandt',
    description: 'High, angled key light that leaves a small triangle of light on the shaded cheek. Dramatic and moody.',
    lights: [
      { type: 'spot', color: warm, intensity: 7, azimuth: 45, elevation: 45, distance: 4 },
      { type: 'area', color: cool, intensity: 0.8, azimuth: -60, elevation: 0, distance: 5 },
    ],
  },
  {
    name: 'Butterfly (paramount)',
    description: 'Key light high and directly in front, producing a butterfly-shaped shadow under the nose. A glamour look, often with a fill from below.',
    lights: [
      { type: 'area', color: warm, intensity: 5, azimuth: 0, elevation: 50, distance: 3.5 },
      { type: 'area', color: cool, intensity: 1.2, azimuth: 0, elevation: -35, distance: 3.5 },
    ],
  },
  {
    name: 'Loop',
    description: 'Key light slightly above and to the side, casting a small loop of shadow from the nose onto the cheek. A flattering everyday portrait light.',
    lights: [
      { type: 'spot', color: warm, intensity: 6, azimuth: 30, elevation: 25, distance: 4 },
      { type: 'area', color: cool, intensity: 1.5, azimuth: -40, elevation: 0, distance: 5 },
    ],
  },
  {
    name: 'Split',
    description: 'A single light at 90 degrees lights exactly half of the face and leaves the other half in shadow.',
    lights: [
      { type: 'spot', color: warm, intensity: 7, azimuth: 90, elevation: 0, distance: 4 },
    ],
  },
  {
    name: 'Clamshell',
    description: 'One light above and one below the face, both close to the camera axis. Even, soft beauty lighting with minimal shadows.',
    lights: [
      { type: 'area', color: warm, intensity: 5, azimuth: 0, elevation: 40, distance: 3.5 },
      { type: 'area', color: warm, intensity: 3, azimuth: 0, elevation: -30, distance: 3.5 },
    ],
  },
  {
    name: 'Rim only',
    description: 'Two lights behind the subject trace the outline of the head and leave the face dark. Good for silhouettes and drama.',
    lights: [
      { type: 'spot', color: '#ffffff', intensity: 7, azimuth: 140, elevation: 20, distance: 4 },
      { type: 'spot', color: '#ffffff', intensity: 7, azimuth: -140, elevation: 20, distance: 4 },
    ],
  },
  {
    name: 'Coloured gels',
    description: 'Magenta and cyan lights from opposite sides with a soft white key, a common creative portrait look.',
    lights: [
      { type: 'spot', color: '#ff2fa8', intensity: 6, azimuth: 70, elevation: 15, distance: 4 },
      { type: 'spot', color: '#18d6ff', intensity: 6, azimuth: -70, elevation: 15, distance: 4 },
      { type: 'area', color: '#ffffff', intensity: 1.2, azimuth: 0, elevation: 20, distance: 4.5 },
    ],
  },
  {
    name: 'Sunlight',
    description: 'A single sun: parallel rays and hard shadows, with a faint softbox bounce on the shadow side, like a clear day outdoors.',
    lights: [
      { type: 'sun', color: '#fff2dc', intensity: 6, azimuth: 40, elevation: 40, distance: 6 },
      { type: 'area', color: '#cfe0ff', intensity: 0.8, azimuth: -60, elevation: 5, distance: 5 },
    ],
  },
  {
    name: 'Flat frontal',
    description: 'A single soft light at the camera position. Minimal shadows and little sense of depth; a useful baseline for comparison.',
    lights: [
      { type: 'area', color: '#ffffff', intensity: 4, azimuth: 0, elevation: 5, distance: 4.5 },
    ],
  },
];
