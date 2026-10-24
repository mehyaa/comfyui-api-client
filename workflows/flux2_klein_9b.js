import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_FILE = "flux2_klein_9b.json";

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
  negativePrompt,
  slug,
  cfg,
  steps,
  seed,
  width,
  height,
}) {
  const workflowData = await loadTemplate();

  workflowData["6"].inputs.text = prompt;
  if (negativePrompt) {
    workflowData["7"].inputs.text = negativePrompt;
  }
  workflowData["9"].inputs.filename_prefix = slug;
  workflowData["13"].inputs.width = width;
  workflowData["13"].inputs.height = height;
  workflowData["17"].inputs.width = width;
  workflowData["17"].inputs.height = height;
  workflowData["22"].inputs.cfg = cfg;
  workflowData["17"].inputs.steps = steps;
  workflowData["25"].inputs.noise_seed = seed;

  return workflowData;
}
