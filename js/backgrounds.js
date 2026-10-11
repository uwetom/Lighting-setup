// HDRIs are 1K OpenEXR files from ambientCG.com (CC0), stored in assets/hdri/.
// A background with `url` or `light` also lights the subject; envScale tames bright flat colours.
export const BACKGROUNDS = [
  { name: 'Default (dark)', color: 0x0b0b0e },
  { name: 'Black', color: 0x000000 },
  { name: 'White', color: 0xffffff, light: true, envScale: 0.4 },
  { name: 'Clear sky', url: 'assets/hdri/DaySkyHDRI067B.exr' },
  { name: 'Overcast sky', url: 'assets/hdri/DaySkyHDRI068B.exr' },
  { name: 'Golden hour', url: 'assets/hdri/EveningSkyHDRI046B.exr' },
  { name: 'Night sky', url: 'assets/hdri/NightSkyHDRI003.exr' },
  { name: 'Park (daytime)', url: 'assets/hdri/DayEnvironmentHDRI043.exr' },
  { name: 'Indoor classroom', url: 'assets/hdri/IndoorEnvironmentHDRI023.exr' },
];
