// To add a head, drop a .glb in assets/head/ and add an entry here; map and normalMap are optional.
export const HEADS = [
  {
    name: 'Adult male (scan)',
    model: 'assets/head/LeePerrySmith.glb',
    map: 'assets/head/Map-COL.jpg',
    normalMap: 'assets/head/Infinite-Level_02_Tangent_SmoothUV.jpg',
    thickness: 'assets/head/LeePerrySmith_thickness.bin',
    credit: { text: 'Head scan by Lee Perry-Smith (CC BY 3.0)', url: 'http://www.triplegangers.com' },
  },
  // rotationY (degrees) turns the model if its spout does not face the camera.
  {
    name: 'Face scan (Face Cap)',
    model: 'assets/head/facecap.glb',
    wholeScene: true,
    rotationY: 0,
    credit: { text: 'Face Cap sample model, from the three.js examples', url: 'https://github.com/mrdoob/three.js/tree/r160/examples/models/gltf' },
  },
  {
    name: 'Clay teapot on a surface',
    kind: 'teapot',
    model: 'assets/teapot/chinese_ancient_teapot.glb',
    rotationY: 180,
    credit: {
      text: '"Chinese Ancient Teapot" by UniquePlayer (CC BY 4.0)',
      url: 'https://sketchfab.com/3d-models/chinese-ancient-teapot-a9b8dac2bf8045688d4ec6e95b2a51d2',
    },
  },
];
