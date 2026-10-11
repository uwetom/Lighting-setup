// Azimuth 0 is straight in front of the subject; positive azimuth is to the viewer's right.
// Each preset's `link` points at a public reference article on that lighting style.
const WIKI = 'https://en.wikipedia.org/wiki/';
const warm = '#fff1e0';
const cool = '#dbe8ff';

export const PRESETS = [
  {
    name: 'Three-point',
    link: { text: 'Wikipedia: Three-point lighting', url: `${WIKI}Three-point_lighting` },
    description: 'Classic portrait setup: a strong key from one side, a softer fill on the other to lift shadows, and a rim light behind for edge separation.',
    lights: [
      { name: 'Key light', type: 'spot', color: warm, intensity: 4, azimuth: 45, elevation: 35, distance: 4 },
      { name: 'Fill light', type: 'area', color: cool, intensity: 1.5, azimuth: -50, elevation: 10, distance: 4.5 },
      { name: 'Back light', type: 'spot', color: '#ffffff', intensity: 3.5, azimuth: 150, elevation: 40, distance: 4 },
    ],
  },
  {
    name: 'Rembrandt',
    link: { text: 'Wikipedia: Rembrandt lighting', url: `${WIKI}Rembrandt_lighting` },
    description: 'High, angled key light that leaves a small triangle of light on the shaded cheek. Dramatic and moody.',
    lights: [
      { name: 'Key light', type: 'spot', color: warm, intensity: 4.5, azimuth: 45, elevation: 45, distance: 4 },
      { name: 'Fill light', type: 'area', color: cool, intensity: 0.5, azimuth: -60, elevation: 0, distance: 5 },
    ],
  },
  {
    name: 'Butterfly (paramount)',
    link: { text: 'Wikipedia: Portrait photography, butterfly lighting', url: `${WIKI}Portrait_photography#Butterfly_lighting` },
    description: 'Key light high and directly in front, producing a butterfly-shaped shadow under the nose. A glamour look, often with a fill from below.',
    lights: [
      { name: 'Top key', type: 'area', color: warm, intensity: 3.3, azimuth: 0, elevation: 50, distance: 3.5 },
      { name: 'Low fill', type: 'area', color: cool, intensity: 0.8, azimuth: 0, elevation: -35, distance: 3.5 },
    ],
  },
  {
    name: 'Loop',
    link: { text: 'Wikipedia: Photographic lighting, basic patterns', url: `${WIKI}Photographic_lighting#Basic_lighting_patterns` },
    description: 'Key light slightly above and to the side, casting a small loop of shadow from the nose onto the cheek. A flattering everyday portrait light.',
    lights: [
      { name: 'Key light', type: 'spot', color: warm, intensity: 4, azimuth: 30, elevation: 25, distance: 4 },
      { name: 'Fill light', type: 'area', color: cool, intensity: 1, azimuth: -40, elevation: 0, distance: 5 },
    ],
  },
  {
    name: 'Split',
    link: { text: 'Wikipedia: Photographic lighting, basic patterns', url: `${WIKI}Photographic_lighting#Basic_lighting_patterns` },
    description: 'A single light at 90 degrees lights exactly half of the face and leaves the other half in shadow.',
    lights: [
      { name: 'Side light', type: 'spot', color: warm, intensity: 4.5, azimuth: 90, elevation: 0, distance: 4 },
    ],
  },
  {
    name: 'Clamshell',
    link: { text: 'Digital Photography School: Clamshell lighting, a two-light setup', url: 'https://digital-photography-school.com/clamshell-lighting-two-light-setup/' },
    description: 'One light above and one below the face, both close to the camera axis. Even, soft beauty lighting with minimal shadows.',
    lights: [
      { name: 'Top light', type: 'area', color: warm, intensity: 3.3, azimuth: 0, elevation: 40, distance: 3.5 },
      { name: 'Bottom light', type: 'area', color: warm, intensity: 2, azimuth: 0, elevation: -30, distance: 3.5 },
    ],
  },
  {
    name: 'Rim only',
    link: { text: 'Wikipedia: Backlighting (lighting design)', url: `${WIKI}Backlighting_(lighting_design)` },
    description: 'Two lights behind the subject trace the outline of the head and leave the face dark. Good for silhouettes and drama.',
    lights: [
      { name: 'Right back light', type: 'spot', color: '#ffffff', intensity: 4.5, azimuth: 140, elevation: 20, distance: 4 },
      { name: 'Left back light', type: 'spot', color: '#ffffff', intensity: 4.5, azimuth: -140, elevation: 20, distance: 4 },
    ],
  },
  {
    name: 'Coloured gels',
    link: { text: 'Wikipedia: Colour gel', url: `${WIKI}Color_gel` },
    description: 'Magenta and cyan lights from opposite sides with a soft white key, a common creative portrait look.',
    lights: [
      { name: 'Magenta gel', type: 'spot', color: '#ff2fa8', intensity: 4, azimuth: 70, elevation: 15, distance: 4 },
      { name: 'Cyan gel', type: 'spot', color: '#18d6ff', intensity: 4, azimuth: -70, elevation: 15, distance: 4 },
      { name: 'White fill', type: 'area', color: '#ffffff', intensity: 0.8, azimuth: 0, elevation: 20, distance: 4.5 },
    ],
  },
  {
    name: 'Sunlight',
    link: { text: 'Wikipedia: Photographic lighting, natural light', url: `${WIKI}Photographic_lighting#The_natural_light_baseline` },
    description: 'A single sun: parallel rays and hard shadows, with a faint softbox bounce on the shadow side, like a clear day outdoors.',
    lights: [
      { name: 'Sun', type: 'sun', color: '#fff2dc', intensity: 4, azimuth: 40, elevation: 40, distance: 6 },
      { name: 'Bounce fill', type: 'area', color: '#cfe0ff', intensity: 0.5, azimuth: -60, elevation: 5, distance: 5 },
    ],
  },
  {
    name: 'Flat frontal',
    link: { text: 'Wikipedia: Hard and soft light', url: `${WIKI}Hard_and_soft_light` },
    description: 'A single soft light at the camera position. Minimal shadows and little sense of depth; a useful baseline for comparison.',
    lights: [
      { name: 'Front light', type: 'area', color: '#ffffff', intensity: 2.6, azimuth: 0, elevation: 5, distance: 4.5 },
    ],
  },
];
