import { createStage } from './scene.js';
import { createLightRig } from './lights.js';
import { setupInteraction } from './interaction.js';
import { initUI } from './ui.js';
import { setupPlan } from './plan.js';
import { HEADS } from './heads.js';

const stage = await createStage(document.querySelector('#viewport'), document.querySelector('#status'));
await stage.loadHeadModel(HEADS[0]);
const rig = createLightRig(stage.scene);
rig.onChange(() => stage.clearSnapshotPreview());

setupInteraction({ stage, rig });
stage.onFrame(() => rig.fade(stage.camera.position));
initUI({ stage, rig });
setupPlan({ stage, rig });
