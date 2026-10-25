"""Artfat LLM Prompter v2 — an IMAGE prompt node with the video prompter's panel UI.

Own pack, own node. It carries its own copy of the shared core — the resident llama.cpp engine
(llama_core), the preset system (presets) and the clean/wrap/encode helpers (helpers) — so it
does not import from either sibling pack; all three can be installed side by side.

Flow:  (reference gallery / image_1 / image_2 / text) -> LLM -> prompt -> CLIP -> CONDITIONING

It is a fork of the Artfat Video Prompter node with every time-based part removed (task modes,
scene length, shot table, timed cuts, H3 conditioning and the media transports), and the image
pack's own features folded back in: composite/batch captioning, the batch_prompts list mode,
the image_1/image_2 sockets and the queue chain socket.

EVERY widget is declared here in INPUT_TYPES. web/llm_prompter_v2.js only groups and styles the
widgets this file creates — it never adds one. ComfyUI stores widget values as a POSITIONAL
list, so a widget created (or inserted mid-list) anywhere else shifts every saved value after it.
New widgets therefore go at the END of `required`, and the JS stays a pure view layer.
"""

import gc
import hashlib
import json
import os
import random
import re

import comfy.model_management as mm
import folder_paths

from .llama_core import LLMEngine, CHAT_HANDLERS, normalize_handler
from .presets import (
    INSTRUCTION_PRESETS,
    USER_EDIT_PRESET,
    INSTRUCTION_NAMES,
    list_ref_presets,
    list_system_presets,
    load_ref_preset,
    load_system_preset,
)
from .image_presets import (
    CAPTURE_MODES,
    CAMERA_RIG,
    CAMERA_ANGLES,
    SHOT_SIZES,
    LENS,
    POSE_ALL,
    WARDROBE,
    STYLE_CAPTURE,
    TIME_OF_DAY,
    MOOD,
    ASPECT,
    build_frame_spec,
)
# Small shared utilities (think-stripping, tensor->b64, wrap, ref hash, CLIP encode, numeric
# coercion). They live in this pack's own helpers.py, which also registers the models/LLM folder
# the GGUF dropdown reads from -- nothing is imported from a sibling custom_node directory.
from .helpers import (
    any_type,
    _clean,
    _wrap,
    _encode,
    _num,
    _tensor_to_b64,
    _ref_hash,
    _join_desc,
    _image_item,
)
from .support.cqdm import cqdm

# An unpopulated ref_* socket must not hand `None` to a downstream IMAGE input -- a strict
# IMAGE slot (Qwen's autogrow template, VAEEncode, PreviewImage...) would raise on it. An
# ExecutionBlocker silently skips only the branch hanging off that one spare socket and leaves
# the populated siblings executable, which is what the SatoDive splitter does for the same case.
try:
    from comfy_execution.graph_utils import ExecutionBlocker
except Exception:  # very old ComfyUI: fall back to None and accept the downstream error
    ExecutionBlocker = None


def _latent_out(kw):
    """The latent handed on to the sampler, or None when the mode says to stay out of the way.

    In `edit` the frame is supposed to take its geometry from the Qwen encoder, whose own latent
    is sized on reference #1 -- so this output goes quiet and an Any Switch downstream falls
    through to it. In `mix` and `t2i` the caller's latent passes through untouched, which is the
    only way to get a frame whose shape is not dictated by whatever reference happens to sit in
    slot one. Nothing is resized or re-encoded here; the node is a gate, not a converter.
    """
    if str(kw.get("latent_mode") or "edit") == "edit":
        return None
    return kw.get("latent")


def _blocked():
    return ExecutionBlocker(None) if ExecutionBlocker is not None else None


# Per-node reference-identity cache (independent of either sibling pack's).
_REF_LAST = {}

# How many gallery images one reference set may hold. Not a model limit here (a VLM takes what
# its context allows) -- a practical ceiling that matches the gallery grid in the UI.
MAX_REF_IMAGES = 10
# Reference sets: alternate whole pools, so a series can change location/wardrobe without
# re-uploading. Each set numbers from <Image 1> in its own right.
MAX_REF_SETS = 100
# How many ref_* passthrough sockets the node declares. Tied to MAX_REF_IMAGES on purpose: the
# sockets hand out exactly the <Image N> pool the writer is told about, and the gallery cannot
# contribute more than MAX_REF_IMAGES entries to one set, so a larger number would only ever
# declare sockets that the image_1/image_2 frames alone could fill.
MAX_REF_OUTPUTS = MAX_REF_IMAGES

# Numbered-list marker in batch_prompts: "1.", "4. text", "4.Prompt". The negative lookahead
# keeps decimals like "2.5" / "f2.8" intact.
_BATCH_MARK = re.compile(r"^\s*\d+\.(?!\d)\s*")

_TWO_IMAGE_RE = re.compile(
    r"\bimages?\s*[12]\b"
    r"|\b(?:first|second)\s+(?:input\s+|reference\s+)?image\b"
    r"|\btwo\s+images\b",
    re.I)


def _warn_two_image_preset(sys_text, user_text):
    """A preset written for the old two-image flow silently poisons the identity-block flow.

    With a persona reference in play the identity arrives as TEXT, not as a picture, so an
    instruction that says "take the face from the FIRST image" leaves the model hunting for a
    photo that is not among the frames — it falls back to the frame's own face and invents an
    identity, which is the drift the fixed identity block exists to prevent. Cheap to detect,
    so say it out loud instead of letting a whole batch come back wrong.
    """
    for label, text in (("system_prompt / system_preset", sys_text),
                        ("instruction / instruction_preset", user_text)):
        m = _TWO_IMAGE_RE.search(text or "")
        if m:
            print(f"[llm-prompter-v2] WARNING: a persona reference is in use, but {label} still "
                  f"talks about two images (found {m.group(0)!r}). The identity arrives as text, "
                  f"so that preset will make the model describe the frame's own face. Switch to a "
                  f"scene-only preset (e.g. 'Scene only (face comes from ref_description)').")


def _ref_default(presets):
    """Preselect the bundled face-only preset for the persona pass when it is installed."""
    for want in ("Face_Only_Identity_Im1.txt", "Face_And_Hair_Identity_Im1.txt"):
        if want in presets:
            return want
    return "Custom"


def _ref_set_of(item):
    """Which reference set a gallery entry belongs to. Missing or malformed -> set 1."""
    try:
        value = int(item.get("set") or 1)
    except Exception:
        return 1
    return value if 1 <= value <= MAX_REF_SETS else 1


def _split_batch_prompts(text):
    """Split the batch_prompts box into individual prompts.

    If numbered markers ("1.", "2.") are present, split ON them: everything from one marker to
    the next is ONE prompt (so a multi-line prompt stays whole) and any preamble before the first
    marker is dropped. Otherwise one prompt per line. Lines starting with "#" are comments.
    """
    raw = (text or "").splitlines()
    marks = [i for i, l in enumerate(raw) if _BATCH_MARK.match(l)]
    out = []
    if marks:
        for j, start in enumerate(marks):
            end = marks[j + 1] if j + 1 < len(marks) else len(raw)
            block = list(raw[start:end])
            block[0] = _BATCH_MARK.sub("", block[0], count=1)
            txt = " ".join(l.strip() for l in block
                           if l.strip() and not l.strip().startswith("#")).strip()
            if txt:
                out.append(txt)
    else:
        for ln in raw:
            ln = ln.strip()
            if ln and not ln.startswith("#"):
                out.append(ln)
    return out


class ArtfatLLMPrompterV2:
    @classmethod
    def INPUT_TYPES(cls):
        # GGUF only: the engine is llama-cpp-python, so a .safetensors/.bin pick could only ever
        # fail with a generic "Failed to load model from file". Also scan "clip"
        # (models/text_encoders) -- GGUF vision/text encoders conventionally live there too.
        llms = folder_paths.get_filename_list("LLM") if "LLM" in folder_paths.folder_names_and_paths else []
        try:
            clips = folder_paths.get_filename_list("clip")
        except Exception:
            clips = []
        ggufs = sorted({f for f in list(llms) + list(clips) if f.lower().endswith(".gguf")})
        models = [f for f in ggufs if "mmproj" not in f.lower()] or ["<put GGUF in models/LLM or models/text_encoders>"]
        mmprojs = ["None"] + [f for f in ggufs if "mmproj" in f.lower()]
        sys_presets = list_system_presets()
        ref_presets = list_ref_presets()
        _sys_def = "0_Prompt_Enhancer.txt" if "0_Prompt_Enhancer.txt" in sys_presets else "Custom"
        _instr_def = "Describe -> prompt" if "Describe -> prompt" in INSTRUCTION_NAMES else "Custom"
        # Persona reference image loaded IN-NODE (describe-only): list uploadable images from input/.
        try:
            _in_dir = folder_paths.get_input_directory()
            _persona_files = ["(none)"] + sorted(
                f for f in os.listdir(_in_dir)
                if os.path.isfile(os.path.join(_in_dir, f))
                and f.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"))
            )
        except Exception:
            _persona_files = ["(none)"]
        return {
            "required": {
                # --- backend ---
                "model": (models,),
                "mmproj": (mmprojs, {"default": "None"}),
                "chat_handler": (CHAT_HANDLERS, {"default": "None",
                    "tooltip": "Chat template FAMILY of the model. Use a (no thinking) entry to avoid reasoning leaking into the prompt."}),
                "n_ctx": ("INT", {"default": 8192, "min": 1024, "max": 327680, "step": 128}),
                "vram_limit": ("INT", {"default": -1, "min": -1, "max": 1024, "step": 1,
                    "tooltip": "VRAM budget in GB for the LLM (-1 = put all layers on GPU)."}),
                "n_cpu_moe": ("INT", {"default": 0, "min": 0, "max": 999, "step": 1,
                    "tooltip": "Keep the MoE experts of the first N layers on CPU (frees VRAM on MoE models)."}),
                "llm_enabled": ("BOOLEAN", {"default": True,
                    "tooltip": "OFF = skip the LLM and encode 'final_prompt' directly."}),
                # --- capture mode + posture filter ---
                "capture_mode": (CAPTURE_MODES, {"default": "composite",
                    "tooltip": "composite: every image -> ONE prompt. batch: each image -> its own caption (dataset captioning), joined in 'prompt' and split across 'prompt_list'."}),
                "nsfw": ("BOOLEAN", {"default": False,
                    "tooltip": "More poses: adds more interesting poses to the pose list (Frame tab). A list filter only -- nothing is written into the brief."}),
                "system_preset": (sys_presets, {"default": _sys_def,
                    "tooltip": "The format profile: HOW to write (engine / style). Auto-fills system_prompt, which stays editable."}),
                "instruction_preset": (INSTRUCTION_NAMES, {"default": _instr_def,
                    "tooltip": "The task: WHAT to do. Auto-fills instruction, which stays editable."}),
                # --- frame fields ---
                "camera_rig": (CAMERA_RIG, {"default": "(auto)"}),
                "shot_size": (SHOT_SIZES, {"default": "(auto)"}),
                "angle": (CAMERA_ANGLES, {"default": "(auto)"}),
                "lens": (LENS, {"default": "(auto)"}),
                "pose": (POSE_ALL, {"default": "(none)",
                    "tooltip": "Pose / act. Want more interesting poses? Turn on 'more poses' in Advanced."}),
                "wardrobe": (WARDROBE, {"default": "(inherit)"}),
                # --- text fields ---
                "brief": ("STRING", {"default": "", "multiline": True,
                    "placeholder": "the overall idea of the shot (who / what). The writer expands this with the frame fields above."}),
                "scene": ("STRING", {"default": "", "multiline": True,
                    "placeholder": "environment / setting (only if it should change from the reference)"}),
                "light": ("STRING", {"default": "", "multiline": False,
                    "placeholder": "lighting (lamp, window, flash, overcast...)"}),
                "action": ("STRING", {"default": "", "multiline": True,
                    "placeholder": "what she is doing / expression held in the frame"}),
                # --- editable system/instruction/prompt (auto-filled from presets) ---
                "system_prompt": ("STRING", {"default": "", "multiline": True,
                    "placeholder": "system prompt (auto-filled from system_preset, editable)"}),
                "instruction": ("STRING", {"default": "", "multiline": True,
                    "placeholder": "task / instruction (auto-filled from instruction_preset, editable)"}),
                "final_prompt": ("STRING", {"default": "", "multiline": True,
                    "placeholder": "the generated prompt appears here (editable, copyable). With LLM off, type your prompt here."}),
                "negative": ("STRING", {"default": "", "multiline": True,
                    "placeholder": "negative prompt (encoded to the negative output)"}),
                "prefix": ("STRING", {"default": "", "multiline": False,
                    "placeholder": "prepended to the prompt (e.g. LoRA trigger / persona name)"}),
                "suffix": ("STRING", {"default": "", "multiline": False,
                    "placeholder": "appended to the prompt (e.g. quality tags)"}),
                "seed": ("INT", {"default": 0, "min": -1, "max": 0xffffffffffffffff, "step": 1,
                    "tooltip": "Fixed seed + unchanged inputs = cached result (no LLM call). -1 = random each call."}),
                "force_offload": ("BOOLEAN", {"default": False,
                    "tooltip": "Unload the LLM from VRAM after running (frees VRAM for diffusion)."}),
                # --- advanced sampler ---
                "max_tokens": ("INT", {"default": 512, "min": 16, "max": 8192, "step": 16}),
                "temperature": ("FLOAT", {"default": 0.6, "min": 0.0, "max": 2.0, "step": 0.01}),
                "top_k": ("INT", {"default": 40, "min": 0, "max": 1000, "step": 1}),
                "top_p": ("FLOAT", {"default": 0.9, "min": 0.0, "max": 1.0, "step": 0.01}),
                "min_p": ("FLOAT", {"default": 0.05, "min": 0.0, "max": 1.0, "step": 0.01}),
                "typical_p": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "repeat_penalty": ("FLOAT", {"default": 1.05, "min": 0.0, "max": 10.0, "step": 0.01}),
                "frequency_penalty": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 2.0, "step": 0.01}),
                "mirostat_mode": ("INT", {"default": 0, "min": 0, "max": 2, "step": 1}),
                "mirostat_tau": ("FLOAT", {"default": 5.0, "min": 0.0, "max": 10.0, "step": 0.01}),
                "mirostat_eta": ("FLOAT", {"default": 0.1, "min": 0.0, "max": 1.0, "step": 0.01}),
                "type_k": (["f16", "q8_0", "q4_0"], {"default": "f16"}),
                "type_v": (["f16", "q8_0", "q4_0"], {"default": "f16"}),
                "max_size": ("INT", {"default": 512, "min": 128, "max": 4096, "step": 64,
                    "tooltip": "Downscale each image to this max side before encoding it for the VLM."}),
                "image_min_tokens": ("INT", {"default": 0, "min": 0, "max": 4096, "step": 32}),
                "image_max_tokens": ("INT", {"default": 0, "min": 0, "max": 4096, "step": 32}),
                "mtp_speculative": ("BOOLEAN", {"default": False,
                    "tooltip": "Use the model's built-in MTP/NextN heads to draft tokens. TEXT-ONLY: automatically disabled when an mmproj is loaded. Only works on '-mtp' GGUF builds; ignored on any other model."}),
                "mtp_draft_max": ("INT", {"default": 2, "min": 1, "max": 8, "step": 1,
                    "tooltip": "How many tokens MTP drafts ahead per step."}),
                # --- persona / reference identity (describe-only, never one of the frames) ---
                "ref_preset": (ref_presets, {"default": _ref_default(ref_presets),
                    "tooltip": "Preset for the ONE call that describes the persona image. The resulting block is prepended to every prompt as the locked subject."}),
                "ref_description": ("STRING", {"default": "", "multiline": True,
                    "placeholder": "identity block - written from the persona image, reused every run (editable)"}),
                "refresh_ref": ("BOOLEAN", {"default": False,
                    "tooltip": "Re-describe the persona even if it has not changed."}),
                "persona_image": (_persona_files, {"default": "(none)",
                    "tooltip": "Persona face image loaded IN-NODE, DESCRIBE-ONLY: the LLM writes the identity block from it, and it is never sent along with the frames. The reference_image socket overrides it."}),
                # --- reference gallery ---
                "refs_json": ("STRING", {"default": "[]",
                    "tooltip": "Reference gallery (Refs tab) as JSON: a list of {file, role, set}. These images are what the LLM actually looks at, as <Image N>. The `ref in` wires count in the same pool, first."}),
                "primary_set": ("INT", {"default": 1, "min": 1, "max": MAX_REF_SETS,
                    "tooltip": "Which reference set the writer works from. Sets are whole alternate pools, each numbered from <Image 1> in its own right."}),
                # --- batch prompt list (appended LAST: ComfyUI stores widget values positionally,
                # so a widget inserted mid-list shifts every saved value after it) ---
                "batch_mode": ("BOOLEAN", {"default": False,
                    "tooltip": "ON: ignore the LLM and treat 'batch_prompts' as a list (one prompt per line, or split on '1.'/'2.' markers). Wire 'positive_list' to KSampler.positive -> one image per line from a single Queue."}),
                "batch_prompts": ("STRING", {"default": "", "multiline": True,
                    "placeholder": "batch mode: one prompt per line (or numbered '1.' blocks). Blank lines skipped, '#' lines are comments. prefix/suffix still apply to each."}),
                # --- ref passthrough sockets (appended LAST: see the positional-widget note at
                # the top of this file -- a widget inserted mid-list shifts every saved value) ---
                # RETIRED, kept on purpose: ComfyUI serializes widget values POSITIONALLY, so
                # deleting this entry would shift every value saved after it and silently rewire
                # old graphs. The frontend no longer shows it and nothing reads it any more --
                # the Refs tab (i.e. the pool) is what decides how many references exist.
                "ref_outputs": ("INT", {"default": 0, "min": 0, "max": MAX_REF_OUTPUTS, "step": 1,
                    "tooltip": "Retired and ignored. The node now has ONE 'refs' output: drag a wire out of it per reference and the number drawn on the wire is the <Image N> the prompt uses."}),
                # --- frame fields added later (appended LAST, in this order, for the same
                # positional reason as everything above: ComfyUI serializes widget values as a
                # flat list, so an entry inserted mid-`required` shifts every saved value after
                # it and silently rewires old graphs). The Frame tab shows them next to the
                # original framing dropdowns; only the ORDER HERE is load-bearing. ---
                "style": (STYLE_CAPTURE, {"default": "(auto)",
                    "tooltip": "STYLE / CAPTURE: how the picture was taken (device + process). Named to match the system presets in prompts/ -- e.g. 'Y2K digicam' here is the look H1_Y2K_Digicam.txt writes."}),
                "time_of_day": (TIME_OF_DAY, {"default": "(auto)",
                    "tooltip": "The HOUR. A different axis from 'light': light is the source and its quality, this is the time of day. Both are written as separate statements in the brief."}),
                "mood": (MOOD, {"default": "(auto)",
                    "tooltip": "The overall read of the frame. 'action / expression' stays the concrete gesture and wins on any conflict -- mood only colours it."}),
                "aspect": (ASPECT, {"default": "(auto)",
                    "tooltip": "COMPOSITION hint only. The real proportion comes from image_1 / custom_size on the sampler side, so the ratio itself is never written into the prompt -- only the framing it implies."}),
                "props": ("STRING", {"default": "", "multiline": False,
                    "placeholder": "props / what is in her hands (phone, glass, towel, sheet...)",
                    "tooltip": "Objects in the frame and in her hands. Its own field because an axis that is never named gets collapsed by the model, and because on cfg1 a negative summons what it forbids -- an unwanted object is displaced by naming a prop that takes its place, not by asking for its absence."}),
                "ref_mode": (["edit", "t2i"], {"default": "edit",
                    "tooltip": "Whether the references reach the MODEL. edit: they leave the node as images, Qwen encodes them into reference_latents, and the persona, wardrobe and location travel into the render. t2i: they stay behind -- the writer still looks at them and describes them in the prompt, but the model receives text only. The ref sockets then carry None rather than a blocker, which the Qwen encoder skips; a blocker would take the whole encode node down with it. Independent of `latent_mode`."}),
                "latent_mode": (["edit", "mix"], {"default": "edit",
                    "tooltip": "Where the sampler gets its frame geometry. edit: the `latent` output stays silent, so an Any Switch downstream falls through to the Qwen encoder's own latent -- sized on reference #1, which is what an edit wants. mix: the latent on the input is passed through untouched, so the frame shape is yours instead of whatever reference happens to sit in slot one. Independent of `ref_mode`: t2i with edit here would leave the encoder no reference to size a latent on and fall back to a square."}),
                # Appended last on purpose: widget values are saved by position.
                "keep_prompt": ("BOOLEAN", {"default": False,
                    "tooltip": "ON = reuse the prompt already in final_prompt, the LLM is not called (fast re-runs of the same shot, e.g. a box edit of a held frame). OFF = write a new prompt every run."}),
            },
            "optional": {
                # The panel's own brief when `brief` is wired (e.g. from Artfat BBox Canvas). A wired
                # input hides the widget's text from the backend, so the JS files it here at queue
                # time; the socket itself is removed in the UI.
                "brief_panel": ("STRING", {"forceInput": True}),
                "image_1": ("IMAGE", {"tooltip": "Frames to caption / build the prompt from. Counted before the gallery, so this is <Image 1>."}),
                "image_2": ("IMAGE", {"tooltip": "More frames, counted after image_1 and before the gallery."}),
                # image_3..image_9 complete the `ref in` socket. The canvas shows ONE input and
                # every wire dropped on it is filed onto the next image_N at queue time
                # (web/llm_prompter_v2.js), the mirror of the `refs` output. image_1/image_2 keep
                # their names so a graph saved with them wired still loads its links.
                **{f"image_{i}": ("IMAGE", {"tooltip": f"Reference wire {i} of `ref in`."})
                   for i in range(3, MAX_REF_IMAGES + 1)},
                "reference_image": ("IMAGE", {"tooltip": "Persona identity reference, DESCRIBE-ONLY. Described once with ref_preset and that text is prepended to every prompt, so a whole batch carries one identity. Overrides the in-node persona_image."}),
                "clip": ("CLIP",),
                "queue": (any_type, {"tooltip": "Optional chain input to force execution order between prompter nodes."}),
                "latent": ("LATENT", {"tooltip": "A latent of your own -- the size you actually want the frame to be. It leaves again on the `latent` output in mix and t2i, and is held back in edit so the sampler takes the encoder's latent instead. Nothing is done to it on the way through."}),
            },
            "hidden": {"unique_id": "UNIQUE_ID"},
        }

    # ComfyUI wires outputs BY INDEX, and the frontend HIDES ref_2..ref_9 (the canvas shows one
    # socket named `refs` and each wire dragged out of it is renumbered onto a ref_N slot at
    # queue time -- web/llm_prompter_v2.js). Hiding a slot does not renumber the backend, so
    # every hidden slot has to be TRAILING or the outputs after it would be read as the wrong
    # thing. Hence this layout:
    #     0-5   the data outputs, in reading order
    #     6     ref_1     -- drawn on the canvas as the single `refs` socket
    #     7     queue     -- the execution-order helper, kept at the bottom
    #     8     latent    -- the pass-through gate, and it MUST sit before the hidden block
    #     9-17  ref_2..ref_10 -- hidden, trailing
    # `latent` sits at 8 and not at the end for a reason that cost an evening: the frontend
    # deletes the hidden slots from the node definition, so every output BEHIND them carries a
    # canvas index eight lower than its backend index -- and ComfyUI serializes a link by its
    # CANVAS index. graphToPrompt is patched to renumber the `refs` wires and only those, so a
    # wire dragged from a trailing `latent` arrived at the backend as slot 8, which is ref_2:
    # the sampler was handed an IMAGE and died on `latent["samples"]` with "too many indices
    # for tensor of dimension 4". Before the hidden block the two numbering schemes agree, so
    # nothing has to be translated. Any future output goes here too, never after ref_9.
    # The JS learns these positions from the node definition itself (rewriteRefOutputsInDef),
    # so this tuple is the only place the order is written down. Reordering it here is enough;
    # it also invalidates saved graphs, which is why it is not done lightly.
    # image_1/image_2 are no longer handed back out: the same frames leave through `refs`,
    # first in the pool, so a passthrough socket would just be a second name for <Image 1>.
    # ref type is "*", not "IMAGE", deliberately: Qwen's TextEncodeQwenImage21 image slot is a
    # strict COMFY_AUTOGROW_V3 IMAGE template, and "*" is what the frontend lets connect to it.
    # Do not "fix" it to IMAGE without testing that link.
    RETURN_TYPES = ("CONDITIONING", "CONDITIONING", "STRING", "STRING", "CONDITIONING", "CLIP",
                    "*", any_type, "LATENT") + ("*",) * (MAX_REF_OUTPUTS - 1)
    RETURN_NAMES = ("positive", "negative", "prompt", "prompt_list", "positive_list", "clip",
                    "ref_1", "queue", "latent") + tuple(
                        "ref_%d" % i for i in range(2, MAX_REF_OUTPUTS + 1))
    # prompt_list: one entry per caption in batch capture mode (1 entry otherwise).
    # positive_list: one CONDITIONING per batch_prompts line (1 entry otherwise).
    OUTPUT_IS_LIST = (False, False, False, True, True, False,
                      False, False, False) + ((False,) * (MAX_REF_OUTPUTS - 1))
    FUNCTION = "run"
    CATEGORY = "artfat/llm"
    # NOT an OUTPUT_NODE: that would force re-execution every queue and defeat caching.

    @classmethod
    def VALIDATE_INPUTS(cls, **kwargs):
        # Accept anything; run() coerces every value to a safe default, so a node saved under an
        # older widget layout keeps running instead of hard-erroring.
        return True

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        h = hashlib.sha256()
        # BATCH list mode: only the fields that shape positive_list matter (the LLM is skipped).
        if bool(kwargs.get("batch_mode", False)):
            h.update((f"batch|bp={kwargs.get('batch_prompts', '')!r}|neg={kwargs.get('negative', '')!r}"
                      f"|pre={kwargs.get('prefix', '')!r}|suf={kwargs.get('suffix', '')!r}"
                      f"|clip={kwargs.get('clip') is not None}").encode("utf-8", "ignore"))
            return h.hexdigest()
        # LLM OFF: only final_prompt is encoded, so skip hashing the image tensors entirely
        # (a multi-MB .cpu()+sha256 per queue) and go straight to the sampler.
        if not bool(kwargs.get("llm_enabled", True)):
            h.update((f"off|fp={kwargs.get('final_prompt', '')!r}|neg={kwargs.get('negative', '')!r}"
                      f"|pre={kwargs.get('prefix', '')!r}|suf={kwargs.get('suffix', '')!r}"
                      f"|clip={kwargs.get('clip') is not None}").encode("utf-8", "ignore"))
            return h.hexdigest()
        for name in sorted(kwargs):
            v = kwargs[name]
            if v is not None and hasattr(v, "cpu") and hasattr(v, "numpy"):
                try:
                    h.update(name.encode())
                    h.update(v.cpu().numpy().tobytes())
                    continue
                except Exception:
                    pass
            h.update(f"{name}={v!r}".encode("utf-8", "ignore"))
        return h.hexdigest()

    # --- helpers -------------------------------------------------------------

    def _collect_frames(self, *imgs):
        frames = []
        for img in imgs:
            if img is not None:
                for i in range(img.shape[0]):
                    frames.append(img[i])
        return frames

    def _load_image_file(self, name):
        """Load an image from input/ by name. Returns an IMAGE tensor or None."""
        if not name or name in ("(none)", "None", ""):
            return None
        try:
            import nodes as _nodes  # lazy: avoid any import-time coupling
            img, _mask = _nodes.LoadImage().load_image(name)
            return img
        except Exception as e:
            print("[llm-prompter-v2] reference image load failed:", e)
            return None

    def _build_ref_pool(self, image_socks, refs_json, primary):
        """The reference pool in <Image N> order, for the active set.

        Index N-1 IS <Image N>. This one list feeds three things that must never disagree -- the
        frames sent to the VLM, the "[REFERENCES] <Image N> = role" lines in the brief, and the
        ref_N output sockets -- so all three are built from it rather than re-derived.

        The order is the order of the set's entries in the Refs-tab JSON. An entry is either a
        gallery file {file, role, note, set} or a `ref in` wire {socket: k, set}, where k is the
        image_k input the frontend filed that wire onto at queue time (web/llm_prompter_v2.js,
        fillRefInInputs). Wires and files are numbered in ONE sequence, so a reference added
        later -- wired or uploaded -- goes after the ones already there and nothing shifts.
        A connected image_k that no entry mentions (a prompt from another frontend) goes last.
        Entries without a set belong to set 1. Bad entries are skipped.
        """
        try:
            items = json.loads(refs_json) if str(refs_json or "").strip() else []
        except Exception:
            items = []
        if not isinstance(items, list):
            items = []
        entries = [it for it in items if isinstance(it, dict) and _ref_set_of(it) == int(primary)]

        pool = []
        placed = set()

        def _add_socket(k):
            if k in placed or not (1 <= k <= len(image_socks)):
                return
            placed.add(k)
            img = image_socks[k - 1]
            if img is None:
                return
            for _i in range(img.shape[0]):
                pool.append((img[_i], "connected input"))

        for it in entries:
            if "socket" in it:
                try:
                    _add_socket(int(it.get("socket")))
                except (TypeError, ValueError):
                    pass
                continue
            note = str(it.get("note") or "").strip()
            role = note if note else str(it.get("role") or "")
            img = self._load_image_file(str(it.get("file") or ""))
            if img is not None:
                for _i in range(img.shape[0]):
                    pool.append((img[_i], role))
        for k in range(1, len(image_socks) + 1):
            _add_socket(k)
        # One shared ceiling for wires + gallery: there are only MAX_REF_OUTPUTS ref_N sockets,
        # and a reference the model can never receive must not be described to the writer either.
        if len(pool) > MAX_REF_IMAGES:
            print(f"[llm-prompter-v2] reference pool {len(pool)} > {MAX_REF_IMAGES}: "
                  f"keeping the first {MAX_REF_IMAGES}")
            pool = pool[:MAX_REF_IMAGES]
        return pool

    def _ref_sockets(self, ref_pool, count, ref_mode="edit"):
        """ref_1..ref_MAX as batched IMAGE tensors in <Image N> order; unfilled sockets are None.

        The pool holds single frames ([H,W,C]); an IMAGE consumer wants a batch ([B,H,W,C]), so
        each frame is unsqueezed back into a one-image batch. `count` is now always
        MAX_REF_OUTPUTS: the pool alone decides how far the fill reaches.

        A socket the pool cannot fill hands out None, so all nine wires can be run to the
        consumer ONCE and left there -- drop a reference into the set and its channel comes
        alive on its own, take it out and the channel goes quiet. Qwen is written for exactly
        this: comfy_extras/nodes_qwen.py skips a None slot, and a set of three references over
        nine wires simply encodes three reference latents.

        These used to be ExecutionBlockers, on the reasoning that a wire dragged for a
        reference that does not exist should stop its branch rather than fire an empty image.
        The blocker turned out to be the wrong tool: it does not blank one input, it removes
        the WHOLE consuming node from the run, so a permanently wired encoder vanished
        silently the moment the set held fewer references than there were wires -- no error,
        no render, nothing to read. The warning it was meant to give is already on screen and
        earlier: the panel paints a wire past the pool red before anything is queued.

        ref_mode == "t2i" hands out None on every socket, filled or not. The references still
        reached the writer, so they survive in the prompt as words while the model gets text
        only.
        """
        if ref_mode == "t2i":
            return tuple(None for _ in range(MAX_REF_OUTPUTS))
        out = []
        for i in range(MAX_REF_OUTPUTS):
            if i < count and i < len(ref_pool):
                out.append(ref_pool[i][0].unsqueeze(0))
            else:
                out.append(None)
        return tuple(out)

    def _sampler(self, **kw):
        return dict(
            max_tokens=kw["max_tokens"], temperature=kw["temperature"], top_k=kw["top_k"],
            top_p=kw["top_p"], min_p=kw["min_p"], typical_p=kw["typical_p"],
            repeat_penalty=kw["repeat_penalty"], frequency_penalty=kw["frequency_penalty"],
            mirostat_mode=kw["mirostat_mode"], mirostat_tau=kw["mirostat_tau"],
            mirostat_eta=kw["mirostat_eta"],
        )

    def _gen(self, messages, run_seed, sampler):
        out = LLMEngine.llm.create_chat_completion(messages=messages, seed=run_seed, **sampler)
        return out["choices"][0]["message"]["content"].removeprefix(": ").lstrip()

    # --- main ----------------------------------------------------------------

    def run(self, **kw):
        g = kw.get
        # --- backend / sampler (sanitized) ---
        model = str(g("model") or "")
        mmproj = str(g("mmproj") or "None")
        # Resolve through normalize_handler, not a membership test: a workflow saved under an
        # older label must keep working instead of silently falling back to None and losing vision.
        chat_handler = normalize_handler(g("chat_handler")) or "None"
        n_ctx = int(_num(g("n_ctx"), 8192, 1024, cast=int))
        vram_limit = int(_num(g("vram_limit"), -1, -1, cast=int))
        n_cpu_moe = int(_num(g("n_cpu_moe"), 0, 0, cast=int))
        llm_enabled = bool(g("llm_enabled", True))
        sampler_vals = dict(
            max_tokens=int(_num(g("max_tokens"), 512, 16, 8192, cast=int)),
            temperature=_num(g("temperature"), 0.6, 0.0, 2.0),
            top_k=int(_num(g("top_k"), 40, 0, cast=int)),
            top_p=_num(g("top_p"), 0.9, 0.0, 1.0),
            min_p=_num(g("min_p"), 0.05, 0.0, 1.0),
            typical_p=_num(g("typical_p"), 1.0, 0.0, 1.0),
            repeat_penalty=_num(g("repeat_penalty"), 1.05, 0.0, 10.0),
            frequency_penalty=_num(g("frequency_penalty"), 0.0, 0.0, 2.0),
            mirostat_mode=int(_num(g("mirostat_mode"), 0, 0, 2, cast=int)),
            mirostat_tau=_num(g("mirostat_tau"), 5.0, 0.0, 10.0),
            mirostat_eta=_num(g("mirostat_eta"), 0.1, 0.0, 1.0),
        )
        # A (thinking) handler spends tokens on its reasoning first. With the 512 default it can
        # run out before </think>, and the reasoning then ends up in the prompt. Give it room.
        if "(thinking)" in chat_handler and sampler_vals["max_tokens"] < 2048:
            sampler_vals["max_tokens"] = min(2048, max(512, n_ctx // 2))
        type_k = g("type_k") if g("type_k") in ("f16", "q8_0", "q4_0") else "f16"
        type_v = g("type_v") if g("type_v") in ("f16", "q8_0", "q4_0") else "f16"
        max_size = int(_num(g("max_size"), 512, 128, cast=int))
        image_min_tokens = int(_num(g("image_min_tokens"), 0, 0, cast=int))
        image_max_tokens = int(_num(g("image_max_tokens"), 0, 0, cast=int))
        mtp_speculative = bool(g("mtp_speculative", False))
        mtp_draft_max = int(_num(g("mtp_draft_max"), 2, 1, 8, cast=int))
        seed = int(_num(g("seed"), 0, -1, cast=int))
        force_offload = bool(g("force_offload", False))
        # --- text / prompt fields ---
        capture_mode = g("capture_mode") if g("capture_mode") in CAPTURE_MODES else "composite"
        system_preset = str(g("system_preset") or "Custom")
        system_prompt = str(g("system_prompt") or "")
        instruction_preset = str(g("instruction_preset") or "Custom")
        instruction = str(g("instruction") or "")
        if instruction_preset not in INSTRUCTION_PRESETS:
            instruction_preset = "Custom"
        brief = str(g("brief") or "")
        # Your own brief (typed in the panel) + the one on the wire (the canvas idea and its boxes):
        # both reach the writer, yours first. Either alone works as before.
        panel_brief = str(g("brief_panel") or "").strip()
        if panel_brief and panel_brief not in brief:
            brief = (panel_brief + "\n\n" + brief.strip()).strip()
        final_prompt = str(g("final_prompt") or "")
        negative = str(g("negative") or "")
        prefix = str(g("prefix") or "")
        suffix = str(g("suffix") or "")
        batch_mode = bool(g("batch_mode", False))
        batch_prompts = str(g("batch_prompts") or "")
        ref_preset = str(g("ref_preset") or "Custom")
        ref_description = str(g("ref_description") or "")
        refresh_ref = bool(g("refresh_ref", False))
        persona_image = str(g("persona_image") or "")
        refs_json = str(g("refs_json") or "[]")
        clip = g("clip")
        queue = g("queue")
        unique_id = g("unique_id")
        image_socks = [g(f"image_{i}") for i in range(1, MAX_REF_IMAGES + 1)]
        reference_image = g("reference_image")
        try:
            primary = int(g("primary_set") or 1)
        except Exception:
            primary = 1
        primary = primary if 1 <= primary <= MAX_REF_SETS else 1
        # ref_outputs is retired (see INPUT_TYPES); read and dropped so a stale saved value
        # cannot reach anything.
        _ = _num(g("ref_outputs"), 0, 0, MAX_REF_OUTPUTS, cast=int)

        # --- BATCH LIST MODE: one prompt per line -> one CONDITIONING each (LLM skipped) ---
        # Wire `positive_list` to KSampler.positive: ComfyUI runs the graph once per list item,
        # so a single Queue produces one image per line. prefix/suffix still wrap each.
        if batch_mode and batch_prompts.strip():
            wrapped = [_wrap(t, prefix, suffix) for t in _split_batch_prompts(batch_prompts)] or [""]
            print(f"[llm-prompter-v2] batch_mode: {len(wrapped)} prompt(s) -> positive_list (LLM skipped)")
            pos_list = [_encode(clip, t) for t in wrapped]
            neg_cond = _encode(clip, negative)
            # The refs still leave the node here: batch mode only skips the LLM, it does not
            # empty the gallery. An empty gallery costs nothing (_build_ref_pool loops zero
            # entries), so the pool is simply built -- which socket is actually wired is a
            # frontend fact the backend never sees.
            _pool = self._build_ref_pool(image_socks, refs_json, primary)
            _refs = self._ref_sockets(_pool, MAX_REF_OUTPUTS, str(g("ref_mode") or "edit"))
            result = (pos_list[0], neg_cond, wrapped[0], wrapped, pos_list, clip,
                      _refs[0], queue, _latent_out(kw)) + _refs[1:]
            return {"ui": {"text": ["\n\n".join(wrapped)]}, "result": result}

        # --- reference pool: the sockets first, then the active set of the gallery. That order
        # is the <Image N> numbering the [REFERENCES] block hands the writer, and the same order
        # the panel's "@" picker prints, so a tag typed in the brief points where it says. ---
        ref_pool = self._build_ref_pool(image_socks, refs_json, primary)

        # --- resolve system + instruction text (the preset is the authority) ---
        # A named preset wins over whatever sits in the matching text box; select "Custom" to use
        # your own text. The reverse made the dropdown a lie: text left behind by an earlier preset
        # kept running, and re-picking the displayed value fires no change event either.
        sys_text = system_prompt.strip()
        if system_preset not in ("Custom", "None", ""):
            sys_text = load_system_preset(system_preset) or sys_text
        instr = instruction.strip()
        if instruction_preset != "Custom":
            instr = INSTRUCTION_PRESETS.get(instruction_preset) or instr
        # "User prompt -> edit": the user's own final_prompt is the source and the LLM only rewrites what
        # the boxes change. A style system preset would reword the whole thing, so it is left out.
        user_edit = instruction_preset == USER_EDIT_PRESET
        if user_edit:
            sys_text = ""

        # --- compose the user brief: instruction + reference roles + frame spec + idea ---
        frame_fields = {
            "camera_rig": g("camera_rig"), "shot_size": g("shot_size"), "angle": g("angle"),
            "lens": g("lens"), "pose": g("pose"), "wardrobe": g("wardrobe"),
            "scene": g("scene"), "light": g("light"), "action": g("action"),
            # Appended-later fields. A graph saved before they existed sends nothing, and the
            # missing key reads as "(auto)" -- i.e. dropped from the brief, same as unset.
            "style": g("style"), "time_of_day": g("time_of_day"),
            "mood": g("mood"), "aspect": g("aspect"), "props": g("props"),
        }
        spec = build_frame_spec(frame_fields)
        blocks = [instr]

        def _role_of(r, fallback):
            r = str(r or "").strip()
            return r if r and r not in ("(auto)", "none", "None") else fallback

        # Reference roles are only meaningful when the model sees every image at once. In batch
        # capture mode each call carries exactly ONE image, so a numbered list of nine would be a
        # lie -- the writer would look for pictures that are not in the call.
        if ref_pool and capture_mode != "batch":
            ref_lines = ["<Image %d> = %s" % (i, _role_of(role, "reference image"))
                         for i, (_t, role) in enumerate(ref_pool, 1)]
            blocks.append("[REFERENCES] Use these references by number:\n" + "\n".join(ref_lines))
        if spec:
            blocks.append(spec)
        if user_edit and final_prompt.strip():
            blocks.append("[SOURCE PROMPT] " + final_prompt.strip())
        if brief.strip():
            blocks.append("[IDEA] " + brief.strip())
        # The `nsfw` toggle deliberately writes NOTHING here. It is a UI filter that hides the
        # explicit pose options and nothing more: an appended "keep it strictly SFW" line sits
        # last and reads as an imperative, so it outranked the user's own [IDEA]. Explicit
        # permission lives in the instruction preset, where it belongs.
        user_text = "\n\n".join(b for b in blocks if b and b.strip())

        frames = [t for t, _r in ref_pool]
        # Persona describe-source: the reference_image socket (upstream override) wins; otherwise
        # the in-node persona_image upload. Describe-only, never sent along with the frames.
        if reference_image is not None:
            ref_frames = self._collect_frames(reference_image)
        else:
            ref_frames = self._collect_frames(self._load_image_file(persona_image))
        if user_edit:
            ref_frames = []  # the identity block would add to the user's prompt; this preset adds nothing
        keep_think = False  # reasoning is always stripped from the prompt output

        def finalize(p):
            p = _clean(p, keep_think) if llm_enabled else p.strip()
            return _wrap(p, prefix, suffix)

        prompts = []
        face_block = ""
        # keep_prompt: reuse the text the LLM already wrote into final_prompt. It already carries
        # prefix/suffix and the identity block, so it is encoded as it is. Empty field -> generate.
        kept = bool(llm_enabled and g("keep_prompt", False) and final_prompt.strip())

        if not llm_enabled:
            # LLM off: encode ONLY final_prompt. The LLM-only fields (instruction, system_prompt,
            # presets, frame spec) are inert here and must not leak into the prompt.
            prompts = [finalize(final_prompt.strip())]
        elif kept:
            print("[llm-prompter-v2] keep_prompt: reusing final_prompt, LLM not called")
            prompts = [final_prompt.strip()]
        elif user_edit and final_prompt.strip() and "[BOXES]" not in brief:
            print("[llm-prompter-v2] user prompt -> edit: no boxes, final_prompt passed on, LLM not called")
            prompts = [final_prompt.strip()]
        else:
            config = {
                "model": model, "mmproj": mmproj, "chat_handler": chat_handler,
                "n_ctx": n_ctx, "vram_limit": vram_limit, "n_cpu_moe": n_cpu_moe,
                "type_k": type_k, "type_v": type_v,
                "image_min_tokens": image_min_tokens, "image_max_tokens": image_max_tokens,
                "mtp_speculative": mtp_speculative, "mtp_draft_max": mtp_draft_max,
            }
            LLMEngine.ensure_loaded(config)
            # llama-cpp-python >= 0.3.44 renamed the handler's vision-projector path from
            # `clip_model_path` to `mmproj_path`. Accept either so both builds work.
            _handler = LLMEngine.chat_handler
            _mmproj = getattr(_handler, "mmproj_path", None) or getattr(_handler, "clip_model_path", None)
            if (frames or ref_frames) and _mmproj is None:
                raise ValueError("Images are connected but the loaded model has no mmproj (vision) module.")

            run_seed = seed if seed >= 0 else random.randint(0, 2 ** 31 - 1)
            sampler = self._sampler(**sampler_vals)
            base_msgs = [{"role": "system", "content": sys_text}] if sys_text else []

            # --- persona identity: describe ONCE, reuse, prepend as the locked subject ---
            # The persona is deliberately NOT sent with each frame. Sending it made the model
            # re-describe the face on every call, so a six-image batch came back with six
            # different faces. One fixed block, reused verbatim, cannot drift.
            if ref_frames:
                _warn_two_image_preset(sys_text, user_text)
                ref_sys = ""
                if ref_preset not in ("Custom", "None", ""):
                    ref_sys = load_ref_preset(ref_preset) or ""
                if not ref_sys.strip():
                    ref_sys = (
                        "Describe ONLY the permanent facial identity and hair of the person: face "
                        "proportions, jaw, eyes with exact iris colour, brows, nose, lips, skin tone "
                        "and texture, and hair colour, length and texture. Never mention clothing, "
                        "pose, expression, background or lighting. Reproduce the actual widths; "
                        "never narrow, refine or beautify. Output ONE 60-80 word paragraph, "
                        "English only.")
                rhash = _ref_hash(ref_frames, ref_sys)
                key = str(unique_id)
                known = _REF_LAST.get(key)
                have = ref_description.strip()
                # Reuse when there is text AND either this process has never seen a reference for
                # this node (restart: adopt what the workflow saved) or the reference is unchanged.
                reuse = bool(have) and not refresh_ref and (known is None or known == rhash)
                if reuse:
                    face_block = have
                    print(f"[llm-prompter-v2] persona unchanged -> reusing stored description "
                          f"({len(face_block.split())} words), LLM not called for it")
                else:
                    why = ("refresh_ref" if refresh_ref else
                           "no stored description" if not have else "persona changed")
                    print(f"[llm-prompter-v2] describing the persona reference ({why}), "
                          f"{len(ref_frames)} frame(s)")
                    ref_content = [{"type": "text", "text": "Describe this person."}]
                    for rf in ref_frames:
                        ref_content.append(_image_item(_tensor_to_b64(rf, max_size)))
                    ref_msgs = [{"role": "system", "content": ref_sys},
                                {"role": "user", "content": ref_content}]
                    face_block = _clean(self._gen(ref_msgs, run_seed, sampler), keep_think).strip()
                _REF_LAST[key] = rhash

            # The identity block is prepended AFTER cleaning but BEFORE prefix/suffix, so a LoRA
            # trigger word still ends up first in the encoded prompt.
            def finalize_with_face(raw):
                return _wrap(_join_desc(face_block, _clean(raw, keep_think)), prefix, suffix)

            if not frames:
                msgs = base_msgs + [{"role": "user", "content": user_text}]
                prompts = [finalize_with_face(self._gen(msgs, run_seed, sampler))]
            elif capture_mode == "batch":
                print(f"[llm-prompter-v2] batch captioning {len(frames)} image(s)"
                      + (" (+ fixed identity block)" if face_block else ""))
                for frame in cqdm(frames):
                    if mm.processing_interrupted():
                        raise mm.InterruptProcessingException()
                    # ONLY the frame goes in. The face travels as text (face_block), not as an
                    # image, so every caption in the batch carries the exact same identity.
                    content = [{"type": "text", "text": user_text},
                               _image_item(_tensor_to_b64(frame, max_size))]
                    msgs = base_msgs + [{"role": "user", "content": content}]
                    prompts.append(finalize_with_face(self._gen(msgs, run_seed, sampler)))
            else:  # composite
                if mm.processing_interrupted():
                    raise mm.InterruptProcessingException()
                content = [{"type": "text", "text": user_text}]
                for frame in frames:
                    content.append(_image_item(_tensor_to_b64(frame, max_size)))
                msgs = base_msgs + [{"role": "user", "content": content}]
                prompts = [finalize_with_face(self._gen(msgs, run_seed, sampler))]

            LLMEngine.reset_context(chat_handler)
            if force_offload:
                LLMEngine.unload()

        main_prompt = ("\n\n".join(prompts) if capture_mode == "batch" and len(prompts) > 1
                       else (prompts[0] if prompts else ""))
        positive = _encode(clip, main_prompt)
        negative_cond = _encode(clip, negative)

        # Only collect after a real LLM run freed context/VRAM. In OFF mode nothing was
        # allocated, so skip the (heap-walking, ~0.5-1s) GC to keep that path instant.
        if llm_enabled:
            gc.collect()
        # ref_1..ref_N come off the very pool the writer was shown, so the slot behind wire 3
        # is the picture the prompt calls <Image 3>. Every slot is filled from the pool: the
        # backend cannot tell which of them the canvas actually wired up. ref_1 sits between
        # `clip` and `queue`, the rest trail behind -- see the RETURN_TYPES note.
        refs = self._ref_sockets(ref_pool, MAX_REF_OUTPUTS, str(g("ref_mode") or "edit"))
        result = (positive, negative_cond, main_prompt, prompts, [positive], clip,
                  refs[0], queue, _latent_out(kw)) + refs[1:]
        return {"ui": {"text": [main_prompt], "ref_desc": [face_block]}, "result": result}


NODE_CLASS_MAPPINGS = {"ArtfatLLMPrompterV2": ArtfatLLMPrompterV2}
NODE_DISPLAY_NAME_MAPPINGS = {"ArtfatLLMPrompterV2": "Artfat LLM Prompter v2"}


# --- server routes: serve preset text to the web UI for live auto-fill --------------------
# Own namespace (/artfat_llm_v2/...) on purpose. The Artfat LLM Prompter pack registers
# /artfat_llm/... and the Video Prompter pack /artfat_video/..., and aiohttp raises on a
# duplicate route, so sharing a path would break whichever pack loaded second. Separate paths
# also mean each pack answers out of ITS OWN prompts/ directory, which is what its dropdowns list.
try:
    from server import PromptServer
    from aiohttp import web as _aiohttp_web

    @PromptServer.instance.routes.get("/artfat_llm_v2/system_preset")
    async def _v2_sys_preset(request):
        name = request.query.get("name", "")
        return _aiohttp_web.json_response({"text": load_system_preset(name) or ""})

    @PromptServer.instance.routes.get("/artfat_llm_v2/instruction_preset")
    async def _v2_instr_preset(request):
        name = request.query.get("name", "")
        return _aiohttp_web.json_response({"text": INSTRUCTION_PRESETS.get(name, "")})
except Exception as e:
    print(f"[llm-prompter-v2] Preset routes not registered: {e}")
