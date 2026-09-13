import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_FILE = "qwen-image-2512-fp8-e4m3fn.json";

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

  workflowData["238:227"].inputs.text = prompt;

  workflowData["60"].inputs.filename_prefix = slug;

  if (negativePrompt) {
    workflowData["238:228"].inputs.text = negativePrompt;
  }

  workflowData["238:232"].inputs.width = width;
  workflowData["238:232"].inputs.height = height;

  workflowData["238:230"].inputs.cfg = cfg;
  workflowData["238:230"].inputs.steps = steps;
  workflowData["238:230"].inputs.seed = seed;

  return workflowData;
}
