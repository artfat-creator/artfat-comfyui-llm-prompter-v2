"""Shared helpers for the Artfat LLM Prompter v2 node.

These are the small utilities the node needs around the LLM call: think-tag stripping,
tensor -> base64 for the vision path, prefix/suffix wrapping, the reference-identity hash,
the CLIP text encode and widget-value coercion. They are lifted verbatim from the Artfat
LLM Prompter pack (same author, same engine) so this pack stands on its own and does not
import from a sibling custom_node directory.

It also registers the models/LLM folder, because that is where the GGUF dropdown reads from.
"""

import base64
import hashlib
import io
import os
import re

import numpy as np
from PIL import Image

import folder_paths

# --- models/LLM registration -------------------------------------------------------------
# `folder_names_and_paths` is a GLOBAL namespace shared by every installed pack, so another
# node may have claimed the "LLM" key before us — ComfyUI-Florence2 does exactly that at
# import time, and custom_nodes are imported alphabetically. Its add_model_folder_path()
# creates the key with an EMPTY extension set, and an empty set means filter_files_extensions()
# lets EVERY file through — which is why .safetensors/.bin show up in the model dropdown.
# So: merge instead of skipping — add our path if missing and union in our extensions.
# Purely additive; nothing another pack registered is removed. Running this pack next to the
# Artfat LLM Prompter pack is therefore safe: the second one to load finds the key already
# there and only unions.
_LLM_DIR = os.path.join(folder_paths.models_dir, "LLM")
_LLM_EXTS = {".gguf", ".bin", ".safetensors"}
if "LLM" not in folder_paths.folder_names_and_paths:
    folder_paths.folder_names_and_paths["LLM"] = ([_LLM_DIR], set(_LLM_EXTS))
else:
    _paths, _exts = folder_paths.folder_names_and_paths["LLM"]
    if _LLM_DIR not in _paths:
        _paths.append(_LLM_DIR)
    # An empty set is "allow everything"; only narrow it once we know who else contributed.
    if _exts:
        _exts.update(_LLM_EXTS)


class AnyType(str):
    def __ne__(self, other):
        return False


any_type = AnyType("*")

_THINK_RE = re.compile(r"<think(?:ing)?>.*?</think(?:ing)?>", re.S | re.I)
_CLOSE_RE = re.compile(r"</think(?:ing)?>", re.I)


def _clean(text, keep_think):
    if not keep_think:
        # Remove paired <think>...</think> blocks.
        text = _THINK_RE.sub("", text)
        # Some reasoning models emit thoughts with only a closing tag (no opening);
        # keep everything after the LAST closing tag.
        last = None
        for last in _CLOSE_RE.finditer(text):
            pass
        if last:
            text = text[last.end():]
    text = text.strip()
    text = text.removeprefix("```json").removeprefix("```")
    text = text.removesuffix("```")
    return text.strip()


def _tensor_to_b64(frame, max_size=None):
    arr = np.clip(255.0 * frame.cpu().numpy(), 0, 255).astype(np.uint8)
    pil = Image.fromarray(arr)
    if max_size:
        w, h = pil.size
        scale = min(max_size / max(w, h), 1.0)
        if scale < 1.0:
            pil = pil.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _wrap(text, prefix, suffix):
    """Add prefix/suffix only when they are not already there.

    A generated prompt gets fed back into final_prompt, so a re-run would glue the
    same prefix on again and again. Checking first makes the wrap idempotent —
    running the node ten times on one prompt leaves exactly one copy of each.
    """
    if prefix and not text.startswith(prefix):
        text = prefix + text
    if suffix and not text.endswith(suffix):
        text = text + suffix
    return text


def _ref_hash(frames, sys_text):
    """Content hash of the reference frames plus the instruction they are described with.

    The identity reference is described ONCE and the resulting text is reused for every run.
    Same hash on the next run => reuse, no LLM call for the reference at all. Swap the image
    (or the preset) and the hash differs => describe once, freshly.
    """
    h = hashlib.blake2b(digest_size=16)
    h.update(sys_text.encode("utf-8", "ignore"))
    for f in frames:
        try:
            h.update(f.cpu().numpy().tobytes())
        except Exception:
            h.update(repr(f).encode("utf-8", "ignore"))
    return h.hexdigest()


def _join_desc(face_block, text):
    """Identity block first, scene second — one space, no double punctuation."""
    a, b = (face_block or "").strip(), (text or "").strip()
    if not a:
        return b
    if not b:
        return a
    return f"{a} {b}"


def _image_item(b64):
    return {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}


def _encode(clip, text):
    if clip is None:
        return None
    tokens = clip.tokenize(text or "")
    return clip.encode_from_tokens_scheduled(tokens)


def _num(v, default, lo=None, hi=None, cast=float):
    """Coerce a widget value to a number, falling back to default and clamping."""
    try:
        x = cast(v)
    except (TypeError, ValueError):
        return default
    if lo is not None and x < lo:
        x = lo
    if hi is not None and x > hi:
        x = hi
    return x
