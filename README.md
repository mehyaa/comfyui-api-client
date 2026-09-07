# ComfyUI API Client

A Node.js CLI for running batches of image-generation prompts against a local or remote [ComfyUI](https://github.com/comfyanonymous/ComfyUI) server. It includes ready-to-run workflow templates, tracks generation progress over WebSocket, and saves images in the format named by each input record.

## Requirements

- Node.js 18 or later
- A running ComfyUI server with the models and custom nodes required by the selected workflow

By default, the client connects to `http://127.0.0.1:8188`.

## Install

```bash
npm install
```

## Run a Workflow

```bash
npm start -- \
  --workflow qwen-image-2512-fp8-e4m3fn \
  --input input.json \
  --width 1328 \
  --height 752 \
  --image-quality 95
```

Generated files are written to `output/` by default. Existing output files are skipped, so the same batch can be resumed safely after an interruption.

## Input Format

Pass a JSON file containing an array of image records. `prompt` is required by the bundled workflows. Either `name` or `filename` must be provided. `negative_prompt`, `cfg`, and `steps` are optional.

```json
[
  {
    "filename": "sunrise.png",
    "prompt": "A cinematic sunrise over a quiet coastal town",
    "negative_prompt": "text, watermark, blurry",
    "cfg": 3.5,
    "steps": 35
  },
  {
    "name": "Forest trail",
    "prompt": "A forest trail in the morning mist"
  }
]
```

When `filename` is omitted, the client creates a JPG filename from `name`. Use a `.png`, `.jpg`, `.jpeg`, `.webp`, or `.gif` filename to select the output format. JPG and WebP output use `--image-quality`; PNG output is saved directly from ComfyUI.

## Available Workflows

- `flux2-dev-fp8mixed`
- `flux2-klein-9b-fp8`
- `qwen-image-2512-fp8-e4m3fn`
- `sd35l`
- `z-image-turbo`

Each workflow has a matching `.json` template in `workflows/`. Ensure its model and custom-node dependencies are installed in your ComfyUI instance before running it.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `--workflow <name>` | Required | Workflow module name from `workflows/`, without `.js`. |
| `--input <file>` | Required | JSON array of prompt records. |
| `--api <url>` | `http://127.0.0.1:8188` | ComfyUI HTTP endpoint. Overrides `COMFY_URL`. |
| `--api-key <key>` | `COMFY_API_KEY` | Bearer token sent to the ComfyUI HTTP and WebSocket APIs. |
| `--output <directory>` | `output/` | Directory for generated images. |
| `--width <number>` | `1024` | Generated image width. |
| `--height <number>` | `1024` | Generated image height. |
| `--steps <number>` | `30` | Default sampling steps; individual records can override it. |
| `--cfg <number>` | `4.0` | Default CFG scale; individual records can override it. |
| `--image-quality <number>` | `95` | JPG and WebP quality. |

## Remote ComfyUI Example

```bash
COMFY_URL="https://comfy.example.com" \
COMFY_API_KEY="your-api-token" \
npm start -- --workflow sd35l --input prompts.json --output generated
```

## License

[MIT](LICENSE)