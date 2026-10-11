import { PRESETS } from './presets.js';
import { MAX_LIGHTS, TYPE_LABELS } from './lights.js';
import { HEADS } from './heads.js';
import { kelvinToHex } from './color.js';
import { BACKGROUNDS } from './backgrounds.js';

const TEMPERATURES = [
  ['Candle', 1900], ['Tungsten', 2700], ['Studio', 3200], ['Fluorescent', 4300],
  ['Daylight', 5600], ['Overcast', 6500], ['Shade', 7500], ['Blue sky', 10000],
];

const $ = (sel) => document.querySelector(sel);

export function initUI({ stage, rig }) {
  const presetSelect = $('#preset');
  const inspector = $('#inspector');
  const list = $('#light-list');

  PRESETS.forEach((p, i) => presetSelect.add(new Option(p.name, i)));
  const showPreset = () => {
    const p = PRESETS[presetSelect.value];
    $('#preset-desc').textContent = p.description;
    rig.loadPreset(p.lights);
  };
  presetSelect.addEventListener('change', showPreset);
  $('#preset-reset').addEventListener('click', showPreset);

  document.querySelectorAll('[data-add]').forEach((btn) =>
    btn.addEventListener('click', () => rig.add({
      type: btn.dataset.add,
      azimuth: ((rig.items.length * 55 + 30 + 180) % 360) - 180,
      ...(btn.dataset.add === 'sun' && { elevation: 40, distance: 6 }),
    })));

  const format = (input) => `${input.value}${input.dataset.unit ?? ''}`;
  const showValue = (input) => { input.nextElementSibling.textContent = format(input); };

  // Inspector bindings.
  const typeSelect = $('#l-type');
  const colorInput = $('#l-color');
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
    // Only one sun is allowed.
    typeSelect.querySelector('option[value=sun]').disabled = item.type !== 'sun' && rig.hasSun();
    colorInput.value = item.color;
    swatch.style.background = item.color;
    colourText.textContent = item.kelvin ? `${item.kelvin} K` : item.color;
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
      btn.className = 'light-item' + (item.id === rig.selectedId ? ' selected' : '');
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = item.color;
      btn.append(swatch, `${item.name} (${TYPE_LABELS[item.type]})`);
      btn.addEventListener('click', () => rig.select(item.id));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger light-remove';
      remove.textContent = '\u00d7';
      remove.title = `Remove ${item.name}`;
      remove.setAttribute('aria-label', remove.title);
      remove.addEventListener('click', () => rig.remove(item.id));

      row.append(btn, remove);
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
    stage.loadHeadModel(def);
    showCredit(def);
  });
  showCredit(HEADS[0]);

  // Background (also lights the subject).
  const backgroundSelect = $('#background');
  BACKGROUNDS.forEach((b, i) => backgroundSelect.add(new Option(b.name, i)));
  backgroundSelect.addEventListener('change', () => stage.setBackground(BACKGROUNDS[backgroundSelect.value]));
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
    iconsVisible = !iconsVisible;
    rig.setGizmos(iconsVisible);
    iconsToggle.textContent = iconsVisible ? 'Hide light icons' : 'Show light icons';
  });
  $('#camera-reset').addEventListener('click', stage.resetCamera);

  showPreset();
}
