import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_FILE = "flux2-dev-fp8mixed.json";

let template;

async function loadTemplate() {
  if (template) {
    return structuredClone(template);
  }

  const content = await fs.readFile(path.join(__dirname, TEMPLATE_FILE), "utf8");

  template = JSON.parse(content);

  return structuredClone(template);
}

export default async function getWorkflowData({
  prompt,
  slug,
  cfg,
  steps,
  seed,
  width,
  height
}) {
  const workflowData = await loadTemplate();

  workflowData["76"].inputs.value = prompt;

  workflowData["9"].inputs.filename_prefix = slug;

  workflowData["75:68"].inputs.value = width;
  workflowData["75:69"].inputs.value = height;

  workflowData["75:63"].inputs.cfg = cfg;
  workflowData["75:62"].inputs.steps = steps;
  workflowData["75:73"].inputs.noise_seed = seed;

  return workflowData;
}
