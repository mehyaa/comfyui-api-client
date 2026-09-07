import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { argv } from "node:process";
import sharp from "sharp";
import WebSocket from "ws";

const COMFY_URL = "http://127.0.0.1:8188";
const OUTPUT_DIR = "output";

const DEFAULT_STEPS = 30;
const DEFAULT_CFG = 4.0;

const DEFAULT_HEIGHT = 1024;
const DEFAULT_WIDTH = 1024;

const DEFAULT_IMAGE_QUALITY = 95;

const PROMPT_TIMEOUT_MS = 10 * 60 * 1000;

const SUPPORTED_OPTIONS = Object.freeze([
  "api",
  "api-key",
  "cfg",
  "height",
  "image-quality",
  "input",
  "output",
  "steps",
  "width",
  "workflow",
]);

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replaceAll(/\s+/g, "-") // Replace spaces with hyphens
    .replaceAll(/[^\w-]+/g, "") // Remove non-alphanumeric and non-hyphen characters
    .replaceAll(/-{2,}/g, "-") // Replace multiple hyphens with a single hyphen
    .replace(/^-+/, "") // Remove leading hyphens
    .replace(/-+$/, ""); // Remove trailing hyphens
}

function parseIntOrDefault(value, defaultValue) {
  if (value == null || value === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function parseFloatOrDefault(value, defaultValue) {
  if (value == null || value === "") {
    return defaultValue;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function kebabToCamelCase(str) {
  return str.replaceAll(/-([a-z])/g, (_, p1) => p1.toUpperCase());
}

function toWebSocketUrl(httpUrl) {
  const url = new URL(httpUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  return url.toString();
}

function buildAuthHeaders(apiKey) {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

function createComfyWebSocket(api, clientId, apiKey) {
  const wsUrl = toWebSocketUrl(api);
  const url = `${wsUrl}?clientId=${encodeURIComponent(clientId)}`;
  return new WebSocket(url, { headers: buildAuthHeaders(apiKey) });
}

function closeWebSocket(ws) {
  return new Promise((resolve) => {
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }

    if (ws.readyState === WebSocket.CLOSING) {
      ws.once("close", () => resolve());
      return;
    }

    const timeoutId = setTimeout(() => {
      resolve();
    }, 1000);

    ws.once("close", () => {
      clearTimeout(timeoutId);
      resolve();
    });

    ws.close(1000, "Job completed");
  });
}

function parseWebSocketMessage(raw) {
  if (typeof raw === "string") {
    return raw;
  }

  if (raw instanceof Buffer) {
    return raw.toString("utf8");
  }

  if (Array.isArray(raw)) {
    return Buffer.concat(raw).toString("utf8");
  }

  return null;
}

function waitForSocketOpen(ws, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    let timeoutId;

    const onOpen = () => {
      cleanup();
      resolve();
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      ws.off("open", onOpen);
      ws.off("error", onError);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    ws.on("open", onOpen);
    ws.on("error", onError);

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while opening websocket connection."));
    }, timeoutMs);
  });
}

function waitForPromptCompletionOverWebSocket(
  ws,
  promptId,
  onProgress,
  timeoutMs = PROMPT_TIMEOUT_MS,
) {
  return new Promise((resolve, reject) => {
    let done = false;

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for prompt ${promptId} completion.`));
    }, timeoutMs);

    const cleanup = () => {
      ws.off("message", onMessage);
      ws.off("error", onError);
      ws.off("close", onClose);
      clearTimeout(timeoutId);
    };

    const finish = () => {
      if (done) {
        return;
      }

      done = true;
      cleanup();
      resolve();
    };

    const onError = (error) => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      reject(error);
    };

    const onClose = () => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      reject(new Error("Websocket closed before prompt completion."));
    };

    const onMessage = (raw) => {
      if (done) {
        return;
      }

      const rawText = parseWebSocketMessage(raw);

      if (!rawText) {
        return;
      }

      let payload;
      try {
        payload = JSON.parse(rawText);
      } catch {
        return;
      }

      const { type, data } = payload;

      if (!data || data.prompt_id !== promptId) {
        return;
      }

      if (type === "progress" && typeof onProgress === "function") {
        const value = Number(data.value);
        const max = Number(data.max);

        if (Number.isFinite(value) && Number.isFinite(max) && max > 0) {
          onProgress(value, max, data.node);
        }
      }

      if (type === "execution_error") {
        onError(
          new Error(
            data.exception_message ??
              data.exception ??
              `ComfyUI reported execution_error for prompt ${promptId}.`,
          ),
        );
        return;
      }

      if (
        type === "execution_success" ||
        (type === "executing" && data.node == null)
      ) {
        finish();
      }
    };

    ws.on("message", onMessage);
    ws.on("error", onError);
    ws.on("close", onClose);
  });
}

async function getGeneratedFilenameFromHistory(api, promptId, apiKey) {
  const historyResponse = await fetch(`${api}/history/${promptId}`, {
    headers: buildAuthHeaders(apiKey),
  });

  if (!historyResponse.ok) {
    throw new Error(
      `Failed to read history for ${promptId}, HTTP ${historyResponse.status}`,
    );
  }

  const history = await historyResponse.json();
  const outputs = history?.[promptId]?.outputs;

  if (!outputs) {
    return null;
  }

  const files = Object.values(outputs)
    .flatMap((output) => output.images ?? [])
    .map((image) => image.filename);

  return files.length > 0 ? files[0] : null;
}

function parseCliArgs(args) {
  const options = {
    error: [],
  };

  for (let i = 0; i < args.length; i++) {
    const token = args[i];

    if (
      !token.startsWith("--") ||
      !SUPPORTED_OPTIONS.includes(token.slice(2).split("=")[0])
    ) {
      options.error.push(`${token} is not a supported option.`);
      continue;
    }

    const optionToken = token.slice(2);
    const equalSignIndex = optionToken.indexOf("=");

    let key = optionToken;
    let value;

    if (equalSignIndex >= 0) {
      key = optionToken.slice(0, equalSignIndex);
      value = optionToken.slice(equalSignIndex + 1);
    } else {
      const nextToken = args[i + 1];
      if (nextToken != null && !nextToken.startsWith("--")) {
        value = nextToken;
        i++;
      } else {
        value = "true";
      }
    }

    if (key) {
      options[kebabToCamelCase(key)] = value;
    }
  }

  return options;
}

async function main() {
  const options = parseCliArgs(argv.slice(2));

  const selectedWorkflow = options.workflow;
  const inputFileArg = options.input;

  if (!selectedWorkflow || !inputFileArg || options.error.length > 0) {
    if (!selectedWorkflow) {
      console.error("Error: --workflow argument is required.");
    }

    if (!inputFileArg) {
      console.error("Error: --input argument is required.");
    }

    if (options.error.length > 0) {
      options.error.forEach((err) => console.error(`Error: ${err}`));
    }

    console.error(
      "\nUsage: node index.js --workflow <workflow-name> --input <input-json-file> [--api <url>] [--api-key <key>] [--width <number>] [--height <number>] [--steps <number>] [--cfg <number>] [--image-quality <number>] [--output <output-directory>]",
    );

    return;
  }

  const inputFilePath = path.isAbsolute(inputFileArg)
    ? inputFileArg
    : path.join(process.cwd(), inputFileArg);

  if (
    !existsSync(path.join(process.cwd(), "workflows", `${selectedWorkflow}.js`))
  ) {
    console.error(
      `Workflow file "${selectedWorkflow}" does not exist in the "workflows" directory.`,
    );
    return;
  }

  const module = await import(`./workflows/${selectedWorkflow}.js`);

  const getWorkflowDataFn = module.default;

  let outputDir = options.output ?? OUTPUT_DIR;

  if (!path.isAbsolute(outputDir)) {
    outputDir = path.join(process.cwd(), outputDir);
  }

  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    await fs.mkdir(outputDir, { recursive: true });
  }

  const api = options.api ?? process.env.COMFY_URL ?? COMFY_URL;
  const apiKey = options.apiKey ?? process.env.COMFY_API_KEY;

  const width = parseIntOrDefault(options.width, DEFAULT_WIDTH);
  const height = parseIntOrDefault(options.height, DEFAULT_HEIGHT);
  const defaultSteps = parseIntOrDefault(options.steps, DEFAULT_STEPS);
  const defaultCfg = parseFloatOrDefault(options.cfg, DEFAULT_CFG);
  const imageQuality = parseIntOrDefault(
    options.imageQuality,
    DEFAULT_IMAGE_QUALITY,
  );

  const seed = Math.floor(Math.random() * 1000000000000000);

  // Read JSON files
  console.log("Reading files...");

  const inputRaw = await fs.readFile(inputFilePath, "utf8");

  const input = JSON.parse(inputRaw);

  console.log(`Processing ${input.length} records. Seed: ${seed}\n`);

  const wsClientId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ws = createComfyWebSocket(api, wsClientId, apiKey);

  try {
    await waitForSocketOpen(ws);

    // Process each item sequentially to avoid overloading the GPU
    for (let index = 0; index < input.length; index++) {
      const item = input[index];

      let filename = item.filename;
      let slug;

      if (!filename) {
        slug = slugify(item.name);

        filename = `${slug}.jpg`;
      }

      const fileType = path.extname(filename).toLowerCase();

      if (!slug) {
        slug = path.basename(filename, fileType);
      }

      const outputImagePath = path.join(outputDir, filename);

      // If the file already exists, skip it (resume logic in case the process is interrupted)
      if (existsSync(outputImagePath)) {
        console.log(
          `[${index + 1}/${input.length}] SKIPPED: ${filename} already exists.`,
        );
        console.log("");
        continue;
      }

      const timerLabel = `  └ Elapsed time for ${filename}`;

      console.time(timerLabel);

      console.log(`[${index + 1}/${input.length}] STARTING: ${filename}`);

      const effectiveSteps = parseIntOrDefault(item.steps, defaultSteps);
      const effectiveCfg = parseFloatOrDefault(item.cfg, defaultCfg);

      console.log(`  ├ Params: cfg=${effectiveCfg}, steps=${effectiveSteps}`);

      let promptData = await getWorkflowDataFn({
        prompt: item.prompt,
        negativePrompt: item.negative_prompt,
        slug,
        cfg: effectiveCfg,
        steps: effectiveSteps,
        seed,
        height,
        width,
      });

      let generatedFilename = null;

      try {
        if (ws.readyState !== WebSocket.OPEN) {
          throw new Error("Shared websocket connection is not open.");
        }

        const response = await fetch(`${api}/prompt`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...buildAuthHeaders(apiKey),
          },
          body: JSON.stringify({ prompt: promptData, client_id: wsClientId }),
        });

        if (!response.ok) {
          console.error(
            `  ├ ERROR: Failed to enqueue ${filename}, HTTP ${response.status}`,
          );
          console.timeEnd(timerLabel);
          console.log("");
          continue;
        }

        const { prompt_id } = await response.json();

        console.log(`  ├ Job enqueued. ID: ${prompt_id}`);

        let hasInlineProgress = true;

        process.stdout.write(`\r  ├ Progress: 0% (0/${effectiveSteps})`);

        // 2. STEP: Wait for the job to complete (WebSocket)
        await waitForPromptCompletionOverWebSocket(
          ws,
          prompt_id,
          (value, max, node) => {
            const percent = Math.floor((value / max) * 100);

            const nodeLabel = node ? ` node=${node}` : "";

            hasInlineProgress = true;

            process.stdout.write(
              `\r  ├ Progress: ${percent}% (${value}/${max})${nodeLabel}`,
            );
          },
        );

        if (hasInlineProgress) {
          process.stdout.write("\n");
        }

        generatedFilename = await getGeneratedFilenameFromHistory(
          api,
          prompt_id,
          apiKey,
        );
      } catch (error) {
        if (hasInlineProgress) {
          process.stdout.write("\n");
        }
        console.error(`  ├ ERROR: ${error?.message ?? error}`);
        console.timeEnd(timerLabel);
        console.log("");
        continue;
      }

      if (!generatedFilename) {
        console.warn(
          `  ├ WARNING: Image was generated but filename could not be retrieved.`,
        );
        console.timeEnd(timerLabel);
        console.log("");
        continue;
      }

      // 3. STEP: Download the generated image (PNG)
      const imageResponse = await fetch(
        `${api}/view?filename=${generatedFilename}&type=output`,
        { headers: buildAuthHeaders(apiKey) },
      );

      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 4. STEP: Convert (if necessary) the image to desired format using Sharp and save it
      switch (fileType) {
        case ".gif":
          await sharp(buffer).gif().toFile(outputImagePath);

          console.log(`  ├ ${filename} saved as GIF.`);

          break;

        case ".png":
          await fs.writeFile(outputImagePath, buffer);

          console.log(`  ├ ${filename} saved as PNG.`);

          break;

        case ".webp":
          await sharp(buffer)
            .webp({ quality: imageQuality })
            .toFile(outputImagePath);

          console.log(
            `  ├ ${filename} saved as WebP with ${imageQuality}% quality.`,
          );
          break;

        case ".jpg":
        case ".jpeg":
        default:
          await sharp(buffer)
            .jpeg({ quality: imageQuality })
            .toFile(outputImagePath);

          console.log(
            `  ├ ${filename} saved as JPG with ${imageQuality}% quality.`,
          );
      }

      console.timeEnd(timerLabel);
      console.log("");
    }
  } finally {
    await closeWebSocket(ws);
  }

  console.log("All tasks completed.");
}

main().catch(console.error);
