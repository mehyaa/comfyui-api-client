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

- `anima_base_v1` (Anima-Base 1.0 `bf16`)
- `anima_turbo_v1` (Anima-Base 1.0 + Turbo LoRA v0.2)
- `boogu_image_turbo` (Boogu-Image 0.1 Turbo `int8_convrot`)
- `ernie_image` (ERNIE-Image Base `bf16`)
- `ernie_image_turbo` (ERNIE-Image Turbo 8-Step `bf16`)
- `fibo2_dev` (Bria Fibo 2.0 Dev `int8_convrot`)
- `fibo2_turbo` (Bria Fibo 2.0 + 4-Step Turbo LoRA `int8_convrot`)
- `flux2_dev` / `flux2-dev-fp8mixed` (FLUX.2 Dev Base)
- `flux2_dev_turbo` (FLUX.2 Dev + Flux2TurboComfyv2 LoRA)
- `flux2_klein_4b_base` (FLUX.2 Klein 4B Base)
- `flux2_klein_4b` (FLUX.2 Klein 4B Distilled)
- `flux2_klein_9b_base` (FLUX.2 Klein 9B Base)
- `flux2_klein_9b` / `flux2-klein-9b-fp8` (FLUX.2 Klein 9B Distilled)
- `flux3_klein` (FLUX.3 Image Klein Base `int8_convrot`)
- `flux3_klein_distilled` (FLUX.3 Image Klein Distilled `int8_convrot`)
- `hidream_o1` (HiDream-O1-Image Full)
- `hidream_o1_dev` (HiDream-O1-Image Dev `fp8_scaled`)
- `ideogram4` (Ideogram 4.0 `int8_convrot`)
- `krea2_turbo` (Krea 2 Turbo `int8_convrot`)
- `lens_turbo` (Lens Turbo 4-Step `bf16`)
- `lens` (Lens Base `bf16`)
- `longcat_image` (LongCat-Image `bf16`)
- `mage_flow_turbo` (Mage-Flow Turbo `int8_convrot`)
- `mage_flow` (Mage-Flow Base `int8_convrot`)
- `ming_image_01_design` (Ming-Image-0.1-Design `int8_convrot`)
- `moss_image_sft_8steps` (MOSS-Image SFT + 8-Steps DMD LoRA)
- `moss_image_sft` (MOSS-Image SFT `int8_convrot`)
- `qwen_image_2_1` (Qwen-Image-2.1 Base `int8_convrot`)
- `qwen_image_2_1_turbo` (Qwen-Image-2.1 Turbo 4-Step `int8_convrot`)
- `qwen_image_2512` / `qwen-image-2512-fp8-e4m3fn` (Qwen-Image-2512 Base)
- `qwen_image_2512_lightning` (Qwen-Image-2512 + 4-Step Lightning LoRA)
- `sd35l` (Stable Diffusion 3.5 Large)
- `sensenova_u1_5` (SenseNova-U1.5-8B-MoT `int8_convrot`)
- `sensenova_u1_5_turbo` (SenseNova-U1.5-8B-MoT + 8-Step LoRA `int8_convrot`)
- `z_image` (Z-Image Base `int8_convrot`)
- `z_image_turbo` / `z-image-turbo` (Z-Image-Turbo `int8_convrot`)

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