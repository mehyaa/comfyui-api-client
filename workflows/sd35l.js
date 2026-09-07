import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_FILE = "sd35l.json";

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
  height,
  width,
}) {
  const workflowData = await loadTemplate();

  workflowData["16"].inputs.text = prompt;

  workflowData["9"].inputs.filename_prefix = slug;

  if (negativePrompt) {
    workflowData["40"].inputs.text = negativePrompt;
  }

  workflowData["53"].inputs.height = height;
  workflowData["53"].inputs.width = width;

  workflowData["3"].inputs.cfg = cfg;
  workflowData["3"].inputs.steps = steps;
  workflowData["3"].inputs.seed = seed;

  return workflowData;
}
