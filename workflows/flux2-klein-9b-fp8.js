import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_FILE = "flux2-klein-9b-fp8.json";

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

  workflowData["6"].inputs.text = prompt;

  workflowData["9"].inputs.filename_prefix = slug;

  workflowData["47"].inputs.width = width;
  workflowData["48"].inputs.width = width;

  workflowData["47"].inputs.height = height;
  workflowData["48"].inputs.height = height;

  workflowData["26"].inputs.guidance = cfg;
  workflowData["48"].inputs.steps = steps;
  workflowData["25"].inputs.noise_seed = seed;

  return workflowData;
}
