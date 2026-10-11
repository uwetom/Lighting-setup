// Approximates a blackbody colour (Tanner Helland's fit); good enough for 1000-12000 K.
export function kelvinToHex(kelvin) {
  const t = kelvin / 100;
  const clamp = (v) => Math.round(Math.min(255, Math.max(0, v)));

  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;

  return `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('')}`;
}
