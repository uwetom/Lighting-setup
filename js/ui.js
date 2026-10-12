import { PRESETS } from './presets.js';
import { MAX_LIGHTS, TYPE_LABELS, REFLECTOR_COLORS } from './lights.js';
import { HEADS } from './heads.js';
import { kelvinToHex } from './color.js';
import { BACKGROUNDS } from './backgrounds.js';
import { ICON_SHAPES } from './icons.js';

const TEMPERATURES = [
  ['Candle', 1900], ['Tungsten', 2700], ['Studio', 3200], ['Fluorescent', 4300],
  ['Daylight', 5600], ['Overcast', 6500], ['Shade', 7500], ['Blue sky', 10000],
];

const $ = (sel) => document.querySelector(sel);

// Returns the preset the current lights roughly match (same lights, within a small tolerance), if any.
function matchingPreset(items) {
  const close = (a, b, tolerance) => Math.abs(a - b) <= tolerance;
  const same = (item, l) => item.type === l.type
    && item.color.toLowerCase() === l.color.toLowerCase()
    && close(item.intensity, l.intensity, 1)
    && close(item.azimuth, l.azimuth, 5)
    && close(item.elevation, l.elevation, 5)
    && close(item.distance, l.distance, 0.5)
    && close(item.pan, l.pan ?? 0, 5)
    && close(item.tilt, l.tilt ?? 0, 5);

  return PRESETS.find((preset) => {
    if (preset.lights.length !== items.length) return false;
    const unmatched = [...items];
    return preset.lights.every((l) => {
      const i = unmatched.findIndex((item) => same(item, l));
      if (i < 0) return false;
      unmatched.splice(i, 1);
      return true;
    });
  });
}

// Numbers persist across reloads so earlier snapshots are never overwritten.
function nextSnapshotName(base) {
  let counts = {};
  try { counts = JSON.parse(localStorage.getItem('snapshotCounts') ?? '{}'); } catch { /* start fresh */ }
  const n = (counts[base] ?? 0) + 1;
  counts[base] = n;
  try { localStorage.setItem('snapshotCounts', JSON.stringify(counts)); } catch { /* storage unavailable */ }
  return `${base}-${String(n).padStart(2, '0')}.png`;
}

function typeIcon(type) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('type-icon');
  svg.innerHTML = ICON_SHAPES[type];
  return svg;
}

export function initUI({ stage, rig }) {
  const presetSelect = $('#preset');
  const inspector = $('#inspector');
  const list = $('#light-list');

  PRESETS.forEach((p, i) => presetSelect.add(new Option(p.name, i)));
  const showPreset = () => {
    const p = PRESETS[presetSelect.value];
    const desc = $('#preset-desc');
    desc.textContent = p.description;
    if (p.link) {
      const a = document.createElement('a');
      a.href = p.link.url;
      a.textContent = p.link.text;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      desc.append(document.createElement('br'), a);
    }
    rig.loadPreset(p.lights);
  };
  presetSelect.addEventListener('change', showPreset);
  $('#preset-reset').addEventListener('click', showPreset);

  document.querySelectorAll('[data-add]').forEach((btn) => {
    btn.querySelector('span').after(typeIcon(btn.dataset.add));
    btn.addEventListener('click', () => rig.add({
      type: btn.dataset.add,
      azimuth: ((rig.items.length * 55 + 30 + 180) % 360) - 180,
      ...(btn.dataset.add === 'sun' && { elevation: 40, distance: 6 }),
    }));
  });

  const format = (input) => `${input.value}${input.dataset.unit ?? ''}`;
  const showValue = (input) => { input.nextElementSibling.textContent = format(input); };

  // Inspector bindings.
  const typeSelect = $('#l-type');
  const nameInput = $('#l-name');
  nameInput.addEventListener('input', () => rig.update(rig.selectedId, { name: nameInput.value }));
  const colorInput = $('#l-color');
  const standardColourControls = $('#standard-colour-controls');
  const reflectorColourControls = $('#reflector-colour-controls');
  const sliders = [...inspector.querySelectorAll('input[data-key]')];

  typeSelect.addEventListener('change', () => rig.update(rig.selectedId, { type: typeSelect.value }));
  colorInput.addEventListener('input', () => rig.update(rig.selectedId, { color: colorInput.value, kelvin: null }));

  // Colour temperature lives inside the colour picker; picking a colour by hand clears the stored temperature.
  const picker = $('#l-picker');
  const swatch = $('#l-swatch');
  const colourText = $('#l-colour-text');
  const kelvinRange = $('#l-kelvin-range');
  const kelvinInput = $('#l-kelvin');
  const kelvinOut = $('#l-kelvin-out');
  const applyKelvin = (kelvin) => rig.update(rig.selectedId, { color: kelvinToHex(kelvin), kelvin });

  reflectorColourControls.querySelectorAll('[data-reflector-colour]').forEach((button) => {
    button.addEventListener('click', () => rig.update(rig.selectedId, { color: button.dataset.reflectorColour, kelvin: null }));
  });

  // The slider track previews the colour at each temperature.
  kelvinRange.style.background = `linear-gradient(to right, ${
    Array.from({ length: 12 }, (_, i) => kelvinToHex(1000 + i * 1000)).join(', ')})`;

  $('#l-chips').append(...TEMPERATURES.map(([name, kelvin]) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.title = `${name} (${kelvin} K)`;
    chip.textContent = name;
    chip.addEventListener('click', () => applyKelvin(kelvin));
    return chip;
  }));

  kelvinRange.addEventListener('input', () => applyKelvin(Number(kelvinRange.value)));
  kelvinInput.addEventListener('change', () => {
    const typed = Number(kelvinInput.value);
    if (kelvinInput.value === '' || Number.isNaN(typed)) {
      kelvinInput.value = rig.selected.kelvin ?? '';
      return;
    }
    applyKelvin(Math.round(Math.min(12000, Math.max(1000, typed))));
  });

  // Close the popover when clicking elsewhere.
  document.addEventListener('pointerdown', (e) => {
    if (!picker.contains(e.target)) picker.open = false;
  });

  // Each slider gets a number box so exact values can be typed; typed values are clamped to the slider range.
  const numbers = new Map(sliders.map((s) => {
    const num = document.createElement('input');
    num.type = 'number';
    num.min = s.min;
    num.max = s.max;
    num.step = s.step;
    num.setAttribute('aria-label', s.closest('label').firstChild.textContent.trim());
    s.nextElementSibling.replaceWith(num);
    return [s, num];
  }));
  sliders.forEach((s) => {
    const num = numbers.get(s);
    s.addEventListener('input', () => rig.update(rig.selectedId, { [s.dataset.key]: Number(s.value) }));
    num.addEventListener('change', () => {
      const typed = Number(num.value);
      const item = rig.selected;
      if (num.value === '' || Number.isNaN(typed)) {
        num.value = item[s.dataset.key];
        return;
      }
      rig.update(item.id, { [s.dataset.key]: Math.min(Number(s.max), Math.max(Number(s.min), typed)) });
    });
  });
  $('#l-reset').addEventListener('click', () => rig.reset(rig.selectedId));
  $('#l-delete').addEventListener('click', () => rig.remove(rig.selectedId));
  $('#l-duplicate').addEventListener('click', () => rig.duplicate(rig.selectedId));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Delete' || rig.selectedId === null) return;
    if (e.target.closest('input, select, textarea')) return;
    rig.remove(rig.selectedId);
  });

  function syncInspector() {
    const item = rig.selected;
    inspector.hidden = !item;
    if (!item) return;
    typeSelect.value = item.type;
    standardColourControls.hidden = item.type === 'reflector';
    reflectorColourControls.hidden = item.type !== 'reflector';
    // A reflector's intensity is how reflective its surface is, not an output level.
    sliders.find((s) => s.dataset.key === 'intensity').closest('label').firstChild.textContent = item.type === 'reflector' ? 'Reflectivity ' : 'Intensity ';
    $('#l-type-icon').replaceChildren(typeIcon(item.type));
    if (nameInput.value !== item.name) nameInput.value = item.name;
    // Only one sun is allowed.
    typeSelect.querySelector('option[value=sun]').disabled = item.type !== 'sun' && rig.hasSun();
    colorInput.value = item.color;
    swatch.style.background = item.color;
    const reflectorFinish = Object.entries(REFLECTOR_COLORS).find(([, colour]) => colour === item.color.toLowerCase())?.[0];
    colourText.textContent = item.type === 'reflector' ? reflectorFinish : item.kelvin ? `${item.kelvin} K` : item.color;
    reflectorColourControls.querySelectorAll('[data-reflector-colour]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.reflectorColour === item.color.toLowerCase()));
    });
    kelvinInput.value = item.kelvin ?? '';
    kelvinOut.textContent = item.kelvin ? `${item.kelvin} K` : 'custom colour';
    if (item.kelvin) kelvinRange.value = item.kelvin;
    sliders.forEach((s) => {
      s.value = item[s.dataset.key];
      numbers.get(s).value = item[s.dataset.key];
    });
    inspector.querySelectorAll('[data-for]').forEach((el) => {
      el.hidden = !el.dataset.for.split(' ').includes(item.type);
    });
  }

  function renderList() {
    list.replaceChildren(...rig.items.map((item) => {
      const row = document.createElement('div');
      row.className = 'light-row';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'light-item' + (item.id === rig.selectedId ? ' selected' : '') + (!item.enabled ? ' disabled' : '');
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = item.color;
      const label = document.createElement('span');
      label.className = 'light-label';
      label.textContent = `${item.name.trim() || 'Untitled'} (${TYPE_LABELS[item.type]})`;
      btn.title = label.textContent;
      btn.append(swatch, typeIcon(item.type), label);
      btn.addEventListener('click', () => rig.select(item.id));

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'light-toggle';
      toggle.textContent = item.enabled ? 'On' : 'Off';
      toggle.setAttribute('aria-pressed', String(item.enabled));
      toggle.title = `${item.enabled ? 'Turn off' : 'Turn on'} ${item.name}`;
      toggle.setAttribute('aria-label', toggle.title);
      toggle.addEventListener('click', () => rig.update(item.id, { enabled: !item.enabled }));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger light-remove';
      remove.textContent = '\u00d7';
      remove.title = `Remove ${item.name}`;
      remove.setAttribute('aria-label', remove.title);
      remove.addEventListener('click', () => rig.remove(item.id));

      row.append(btn, toggle, remove);
      return row;
    }));
    $('#light-count').textContent = `${rig.items.length}/${MAX_LIGHTS}`;
    document.querySelectorAll('[data-add]').forEach((b) => { b.disabled = rig.items.length >= MAX_LIGHTS || (b.dataset.add === 'sun' && rig.hasSun()); });
  }

  rig.onChange((kind) => {
    if (kind === 'list') renderList();
    syncInspector();
    // Keep the swatch colour current while editing.
    if (kind === 'item') renderList();
  });

  // Head model.
  const creditEl = $('#head-credit');
  const showCredit = ({ credit }) => {
    creditEl.replaceChildren();
    if (!credit) return;
    const a = document.createElement('a');
    a.href = credit.url;
    a.textContent = credit.text;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    creditEl.append(a);
  };
  const headModel = $('#head-model');
  HEADS.forEach((h, i) => headModel.add(new Option(h.name, i)));
  headModel.hidden = HEADS.length < 2;
  headModel.addEventListener('change', () => {
    const def = HEADS[headModel.value];
    showCredit(def);
    stage.loadHeadModel(def);
  });
  showCredit(HEADS[0]);

  // Background (also lights the subject).
  const backgroundSelect = $('#background');
  const bgRotation = $('#bg-rotation');
  BACKGROUNDS.forEach((b, i) => backgroundSelect.add(new Option(b.name, i)));
  backgroundSelect.addEventListener('change', () => {
    const def = BACKGROUNDS[backgroundSelect.value];
    stage.setBackground(def);
    // Only 360° images can be rotated.
    bgRotation.disabled = !def.url;
  });
  bgRotation.addEventListener('input', () => {
    stage.setBackgroundRotation(Number(bgRotation.value));
    showValue(bgRotation);
  });
  showValue(bgRotation);
  const envIntensity = $('#env-intensity');
  const applyEnvIntensity = () => {
    stage.setEnvIntensity(Number(envIntensity.value));
    showValue(envIntensity);
  };
  envIntensity.addEventListener('input', applyEnvIntensity);
  applyEnvIntensity();

  // Scene controls.
  const exposure = $('#exposure');
  const applyExposure = () => {
    stage.setExposure(Number(exposure.value));
    showValue(exposure);
  };
  exposure.addEventListener('input', applyExposure);
  applyExposure();
  const iconsToggle = $('#icons-toggle');
  let iconsVisible = true;
  iconsToggle.addEventListener('click', () => {
    stage.clearSnapshotPreview();
    iconsVisible = !iconsVisible;
    rig.setGizmos(iconsVisible);
    iconsToggle.setAttribute('aria-pressed', iconsVisible);
  });
  $('#camera-reset').addEventListener('click', stage.resetCamera);

  let snapshotUrl = null;
  let snapshotKind = 'standard';
  const raytraceButton = $('#raytrace-snapshot');
  const status = $('#status');
  const saveButton = $('#save-snapshot');
  const showSnapshot = (url, kind) => {
    snapshotUrl = url;
    snapshotKind = kind;
    stage.showSnapshotPreview(url);
    saveButton.disabled = false;
    status.hidden = true;
  };
  stage.onSnapshotClear(() => {
    snapshotUrl = null;
    saveButton.disabled = true;
    status.hidden = true;
  });
  const snapshotButton = $('#snapshot');
  saveButton.addEventListener('click', () => {
    if (!snapshotUrl) return;
    const preset = matchingPreset(rig.items);
    const base = preset ? preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'lighting-setup';
    const name = snapshotKind === 'ray-traced' ? `${base}-ray-traced` : base;
    const link = document.createElement('a');
    link.href = snapshotUrl;
    link.download = nextSnapshotName(name);
    document.body.append(link);
    link.click();
    link.remove();
  });

  snapshotButton.addEventListener('click', async () => {
    snapshotButton.disabled = true;
    snapshotButton.setAttribute('aria-busy', 'true');
    saveButton.disabled = true;
    status.classList.remove('error');
    status.hidden = false;
    status.textContent = 'Preparing ray-traced snapshot...';
    try {
      const url = await stage.captureRayTracedImage(rig, (sample, total) => {
        if (sample === 1 || sample === total || sample % 4 === 0) {
          status.textContent = `Ray-tracing snapshot: ${sample}/${total} samples`;
        }
      });
      showSnapshot(url, 'ray-traced');
    } catch (error) {
      status.textContent = `Ray-traced snapshot failed: ${error.message}`;
      status.classList.add('error');
    } finally {
      snapshotButton.disabled = false;
      snapshotButton.removeAttribute('aria-busy');
      saveButton.disabled = !snapshotUrl;
    }
  });

  showPreset();
}
