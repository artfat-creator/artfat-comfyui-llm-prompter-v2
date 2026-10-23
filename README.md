# Artfat LLM Prompter v2

One ComfyUI node that turns a brief plus reference images into a finished image prompt with a
resident llama.cpp VLM, and encodes the result to `CONDITIONING`.

    (reference gallery / image_1 / image_2 / text) -> LLM -> prompt -> CLIP -> CONDITIONING

Node: **Artfat LLM Prompter v2** (`ArtfatLLMPrompterV2`), category `artfat/llm`.

It is a fork of the Artfat Video Prompter pack: the same tabbed panel and reference gallery,
with every time-based part removed (task modes, scene length, the shot/cut table, the native
MiniMax-H3 conditioning and its media transports) and the image-side features folded back in
(composite/batch captioning, prompt-list mode, `image_1`/`image_2` and `queue` sockets).

## Install

Clone into `ComfyUI/custom_nodes/`, install the requirements, restart ComfyUI.

    pip install -r requirements.txt

`llama-cpp-python` ships here as a CPU wheel so the node always imports. `install.py` detects
the CUDA version your torch was built against and fetches the matching JamePeng GPU wheel
(Windows + NVIDIA). If the model loads on CPU, the console prints the exact manual command.

Put GGUF models in `ComfyUI/models/LLM/` (a matching `mmproj-*.gguf` next to them for vision).
`ComfyUI/models/text_encoders` is scanned too, because GGUF VL encoders conventionally live there.

## Panel

Five tabs over the node's native widgets:

| Tab | Holds |
|---|---|
| Prompts | final prompt, negative, prompt-list mode |
| Shot | brief, rig / size / angle / lens / pose / wardrobe, scene, light, action |
| Refs | reference gallery with sets, roles and custom labels |
| Presets | format + task + persona presets, their editable text, persona image, identity block, config save/load |
| Advanced | model, mmproj, chat handler, context, sampler |

The panel **creates no widgets**. Every widget is declared in `image_nodes.py` `INPUT_TYPES`
and lives in that frozen positional order; `web/llm_prompter_v2.js` only groups, styles and
hides them. ComfyUI serializes widget values as a positional list, so a widget created in JS
shifts every saved value after it — built this way, that drift is impossible by construction.
New widgets go at the END of `required`, never in the middle.

## Modes

**composite** (default) — every image goes into one call and produces one prompt. The reference
roles are handed to the writer as a numbered `[REFERENCES]` block (`<Image 1> = identity`, ...).

**batch** — each image gets its own caption in its own call. Captions are joined in `prompt` and
split across `prompt_list`. Only one image is in each call, so the numbered role block is not
sent; the persona identity block still is.

**prompt list** (`batch_mode`) — the LLM is skipped entirely and `batch_prompts` is read as a
list: one prompt per line, or split on numbered `1.` / `2.` markers so a multi-line prompt stays
whole. `#` lines are comments. Wire `positive_list` to `KSampler.positive` and one Queue renders
the whole list.

## Persona identity

`reference_image` (socket) or the in-node persona image (Presets tab) is **describe-only**: it is
described once with `ref_preset`, the text lands in `ref_description`, and that block is prepended
to every prompt. It is never sent alongside the frames. Sending it with each frame made the model
re-describe the face per call, so one batch came back with several different faces.

The description is reused while the image and the preset hash the same. Tick `refresh_ref` to
force a re-describe; edit `ref_description` freely, your text is what gets prepended.

## Reference sets

A set is a whole alternate pool, not a filtered view of one: each set numbers from `<Image 1>` in
its own right. Only the starred set reaches the writer. `＋ set (copy)` duplicates the open set so
you prune rather than refill. Entries with no set belong to set 1.

Type `@` in the brief or action field to insert a reference tag from the active set, so the number
in the text always matches the gallery.

## Outputs

| Output | Notes |
|---|---|
| `positive` / `negative` | CONDITIONING (needs `clip`; unconnected -> `None`) |
| `prompt` | the final text |
| `prompt_list` | LIST: one entry per caption in batch mode |
| `image_1` / `image_2` | passthrough |
| `queue` | passthrough, to force execution order between prompter nodes |
| `clip` | passthrough |
| `positive_list` | LIST: one CONDITIONING per `batch_prompts` entry |

## Presets

`prompts/*.txt` are format profiles (HOW to write); `prompts/reference/*.txt` are persona-identity
profiles. A copy in `ComfyUI/models/LLM/prompts/` (and `.../prompts/reference/`) overrides a
bundled file of the same name, so a preset can be tweaked without touching pack files.

Task presets ("WHAT to do") are Python strings in `presets.py`.

The preset is the authority: picking one overwrites the matching text box. Select `Custom` to keep
your own text.

## Running next to the sibling packs

This pack is self-contained and is designed to sit beside Artfat LLM Prompter and Artfat Video
Prompter. The three collide in exactly three global namespaces, and each is claimed separately here:

* HTTP routes — `/artfat_llm_v2/...` (aiohttp raises on a duplicate route)
* the `model_management` VRAM-cleanup guard — `mm._llm_prompter_v2_hooked` (each pack owns its own
  `LLMEngine` class, so a shared guard would leave the second pack's model resident)
* the `folder_paths` `LLM` key — registered additively: the path is appended if missing and the
  extensions are unioned, so nothing another pack registered is removed

Each pack also answers preset requests out of its own `prompts/` directory, which is what its
dropdowns list.

Three resident llama.cpp models can be loaded at once if three nodes run with different settings.
`force_offload` on the nodes you are not using, or wire them through `queue`.

## License

MIT. `llama_core.py` is adapted from lihaoyun6/ComfyUI-llama-cpp (MIT).
