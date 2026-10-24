import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_FILE = "mage_flow_turbo.json";

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

  workflowData["6"].inputs.prompt = prompt;
  if (negativePrompt) {
    workflowData["6"].inputs.negative_prompt = negativePrompt;
  }
  workflowData["9"].inputs.filename_prefix = slug;
  workflowData["6"].inputs.width = width;
  workflowData["6"].inputs.height = height;
  workflowData["30"].inputs.cfg = cfg;
  workflowData["30"].inputs.steps = steps;
  workflowData["30"].inputs.seed = seed;

  return workflowData;
}
