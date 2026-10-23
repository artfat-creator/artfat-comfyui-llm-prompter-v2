"""Data lists + frame-brief assembly for the Artfat LLM Prompter v2 node.

These are the vocabularies behind the node's combo widgets (style / camera rig / shot size /
angle / lens / aspect / pose / wardrobe / time of day / mood) and the helper that turns the
chosen fields into a compact [FRAME SPEC] brief the LLM writes the image prompt from.

Forked from the Artfat Video Prompter pack's video_presets.py with everything time-based
removed: camera MOVES, shot durations, the scene/shot timeline and its timecode maths belong
to a clip, not to a still. What is left describes the frame and the subject, which a photo
needs exactly as much as a video does.

"(auto)" / "(none)" / "(inherit)" are the "let the writer decide" sentinels — they are dropped
from the brief so an unset field is filled by the model, not forced blank.
"""

# --- capture mode: all images in one prompt, or one caption per image (dataset captioning) ---
CAPTURE_MODES = ["composite", "batch"]

# --- camera: who/what holds it, plus the framing axes. No MOVE axis: a still has no move. ---
CAMERA_RIG = [
    "(auto)",
    "self - arm's-length selfie (front, looking up)",
    "self - overhead / lying selfie",
    "self - low-angle selfie",
    "self - walking / vlog selfie",
    "self - mirror selfie (rear cam)",
    "self - rear-cam arm's-length",
    "self - over-the-shoulder rear view",
    "self - POV (down her own body / at a partner)",
    "propped phone / ring-light (static)",
    "partner shooting - handheld",
    "partner shooting - POV",
    "body-cam / chest-mounted",
    "GoPro / action cam (fisheye)",
    "CCTV / security cam",
    "webcam / laptop cam",
    "tripod / studio",
]
CAMERA_ANGLES = [
    "(auto)", "eye-level", "low angle", "high angle", "overhead top-down",
    "POV", "over-the-shoulder", "dutch tilt",
]
SHOT_SIZES = [
    "(auto)", "extreme close-up", "close-up", "medium close-up", "medium",
    "cowboy", "full body", "wide", "extreme wide",
]
LENS = ["(auto)", "normal", "wide-angle", "ultra-wide", "fisheye", "telephoto / zoom", "macro"]

# --- pose / act: SFW set + NSFW set. The node's `nsfw` toggle governs which half the UI
# offers; the Python combo lists both, because a plain LiteGraph combo cannot filter live. ---
POSE_SFW = [
    "(none)", "standing relaxed", "hands on hips", "leaning on wall", "sitting on bed edge",
    "lying on side", "walking to camera", "playful twirl", "hand in hair",
    "over-the-shoulder glance", "stretching / arching", "adjusting hair / outfit", "blowing a kiss",
]
POSE_NSFW = [
    "spread legs presenting", "fingering herself", "spreading open with fingers",
    "on all fours looking back", "arched on her back", "bent over ass to camera",
    "kneeling thighs apart", "playing with a toy", "riding a toy", "grinding",
    "blowjob POV", "deepthroat", "licking the tip/shaft", "titjob between breasts",
    "cowgirl / riding on top", "reverse cowgirl", "missionary legs up", "doggy / from behind",
    "spooning side", "prone from behind", "standing bent over", "legs on shoulders", "against the wall",
    "spitroast", "double", "cumshot on face", "cum in mouth / on tongue",
    "cum on breasts / body", "creampie",
]
POSE_ALL = POSE_SFW + POSE_NSFW

WARDROBE = ["(inherit)", "dressed", "lingerie", "topless", "bottomless", "fully nude"]

# --- style / capture: HOW the picture was taken (device + process), not what is in it.
# The vocabulary is deliberately lifted from the system presets that already ship in prompts/,
# so the dropdown and the preset files name the same looks: a user who picks "Y2K digicam"
# here and H1_Y2K_Digicam.txt there is asking for one thing, not two. Mapping, entry -> preset:
#   iPhone / Galaxy candid           -> B0_Smartphone_Default, K0_Krea2_Smartphone_Amateur
#   phone ultrawide 0.5x             -> B6_Smartphone_iPhone15Pro_Ultrawide
#   budget android                   -> B29_Smartphone_BudgetAndroid
#   flash night out / club           -> B3_Smartphone_NightOut
#   ring-light creator setup         -> B16_Smartphone_TikTokRingLight
#   mirror selfie                    -> B19_Smartphone_GymMirror
#   webcam / laptop cam              -> H5_WebcamLaptop
#   low-res call screenshot / leak   -> (no preset file)
#   CCTV / security cam              -> B30_Smartphone_CCTV_SecurityCam
#   Y2K digicam                      -> H1_Y2K_Digicam
#   Tumblr 2010s filter              -> H2_Tumblr_2010s
#   polaroid / instax                -> H3_Polaroid_Instax
#   disposable camera                -> H4_DisposableCamera
#   35mm film / analog               -> C_Vintage_Film
#   black & white film grain         -> G1_BW_FilmGrain
#   black & white digital            -> G2_BW_Digital
#   magazine / cinematic portrait    -> A_Magazine_Cinematic
#   fashion editorial                -> E_Fashion_Editorial
#   cinematic noir                   -> D_Cinematic_Noir
#   boudoir / intimate               -> F_Boudoir_Intimate
# "DSLR / mirrorless portrait" is the one entry with NO preset of its own: the shipped set
# jumps straight from the phone tier to medium-format editorial, and a plain fast-prime camera
# look had nowhere to be asked for. Kept because it is the commonest "proper camera" answer.
STYLE_CAPTURE = [
    "(auto)",
    "iPhone / Galaxy candid",
    "phone ultrawide 0.5x",
    "budget android / low-quality phone",
    "flash night out / club",
    "ring-light creator setup",
    "mirror selfie",
    "webcam / laptop cam",
    "low-res call screenshot / leak",
    "CCTV / security cam",
    "Y2K digicam (CCD + pop-up flash)",
    "Tumblr 2010s filter",
    "polaroid / instax instant film",
    "disposable camera",
    "35mm film / analog",
    "black & white film grain",
    "black & white digital",
    "DSLR / mirrorless portrait (85mm prime)",
    "magazine / cinematic portrait",
    "fashion editorial",
    "cinematic noir",
    "boudoir / intimate",
]

# --- time of day: the HOUR. A separate axis from `light`, which is the SOURCE and its quality
# (a bedside lamp is a light, 3 a.m. is not). build_frame_spec keeps them as two statements. ---
TIME_OF_DAY = [
    "(auto)", "morning", "midday", "golden hour", "blue hour", "night", "overcast",
]

# --- mood: the overall read of the frame. Overlaps `action` on purpose; build_frame_spec
# subordinates it whenever a concrete action is also set (see _mood_line). ---
MOOD = [
    "(auto)", "playful", "flirty", "sultry", "intense", "candid-happy", "relaxed",
    "bored", "tired", "shy", "confident", "melancholic", "dreamy",
]

# --- aspect: a COMPOSITION hint for the writer, never a number in the prompt.
# The real proportion comes from image_1 / custom_size on the Qwen side, and Qwen's own prompt
# rules forbid writing a resolution or ratio into the text. So the label ("portrait 2:3") stays
# in the UI and NEVER reaches the brief -- _aspect_line swaps it for the framing it implies.
# Every sentence below is deliberately digit-free. ---
ASPECT = [
    "(auto)",
    "portrait 2:3",
    "portrait 4:5",
    "square 1:1",
    "landscape 3:2",
    "landscape 16:9",
    "vertical 9:16",
]

_ASPECT_COMPOSITION = {
    "portrait 2:3": "upright standing frame - the subject fills the height, little room left or "
                    "right, the setting reading as a narrow strip behind her",
    "portrait 4:5": "upright but boxy frame - modest headroom above her and a small margin of "
                    "the setting either side, closer in than a full standing portrait",
    "square 1:1": "square frame - the subject centred with roughly equal room on every side and "
                  "the setting cropped tight at the edges",
    "landscape 3:2": "horizontal frame - the subject placed off to one side with the setting "
                     "opening out beside her",
    "landscape 16:9": "wide horizontal frame - a broad band of the setting either side of her, "
                      "tight headroom, a letterboxed cinematic read",
    "vertical 9:16": "tall phone-screen frame - the body running from just above her head to "
                     "below the hips, only a narrow slice of the setting either side",
}

# sentinels dropped from the composed brief
_AUTO = {"(auto)", "(none)", "(inherit)", "", "none", "None"}


def _clean_val(val):
    v = str(val or "").strip()
    return "" if v in _AUTO else v


# Field order (label -> widget name) for the [FRAME SPEC] block. This is the READING order of
# the brief and is independent of the widget order in INPUT_TYPES (which is frozen by
# ComfyUI's positional serialization and may only grow at the end).
FRAME_FIELD_ORDER = [
    ("style / capture", "style"),
    ("camera rig", "camera_rig"),
    ("shot size", "shot_size"),
    ("angle", "angle"),
    ("lens", "lens"),
    ("framing / composition", "aspect"),
    ("pose / act", "pose"),
    ("wardrobe / state", "wardrobe"),
    ("props / in frame", "props"),
    ("scene", "scene"),
    ("time of day", "time_of_day"),
    ("light", "light"),
    ("action / expression", "action"),
    ("overall mood", "mood"),
]


def _aspect_line(label, val):
    """Aspect -> a composition directive. The ratio itself is dropped on purpose.

    Qwen takes its proportion from the image / custom_size socket and its prompt rules forbid a
    resolution or ratio in the text, so the chosen label never leaves the UI -- only the framing
    it implies does, plus an explicit "no numbers" guard for the writer.
    """
    v = _clean_val(val)
    comp = _ASPECT_COMPOSITION.get(v)
    if not comp:
        return ""
    return ("- %s: %s. Express this as composition only - never write a resolution, a pixel "
            "size or an aspect-ratio figure into the prompt." % (label, comp))


def _mood_line(label, val, has_action):
    """Mood -> the overall read of the frame, subordinated to a concrete action when both are set.

    `mood` and `action / expression` overlap by nature. The split kept here: `action` is the
    specific thing she is doing and always wins; `mood` only colours it. Without an action the
    mood is free to drive the expression on its own.
    """
    v = _clean_val(val)
    if not v:
        return ""
    if has_action:
        return ("- %s: %s - tone of the whole frame only. The action / expression above is what "
                "she is actually doing and overrides this on any conflict." % (label, v))
    return "- %s: %s" % (label, v)


def _time_line(label, val, has_light):
    """Time of day -> the hour, kept as its own statement next to (not merged into) `light`."""
    v = _clean_val(val)
    if not v:
        return ""
    if has_light:
        return ("- %s: %s - this is the hour of the day; the light directive below stays the "
                "source and its quality. State both, do not collapse them into one." % (label, v))
    return "- %s: %s" % (label, v)


def build_frame_spec(fields):
    """Turn the chosen frame fields into a compact [FRAME SPEC] block for the LLM.

    `fields` is a dict of the widget values. Only non-sentinel values are emitted, so an
    unset field is filled by the writer instead of being forced. Returns "" when nothing is set.
    """
    has_action = bool(_clean_val(fields.get("action")))
    has_light = bool(_clean_val(fields.get("light")))
    lines = []
    for label, key in FRAME_FIELD_ORDER:
        raw = fields.get(key)
        if key == "aspect":
            line = _aspect_line(label, raw)
        elif key == "mood":
            line = _mood_line(label, raw, has_action)
        elif key == "time_of_day":
            line = _time_line(label, raw, has_light)
        else:
            v = _clean_val(raw)
            line = f"- {label}: {v}" if v else ""
        if line:
            lines.append(line)
    if not lines:
        return ""
    return ("[FRAME SPEC] Build the image prompt around these directives; fill anything unset "
            "yourself and keep it a single coherent frame:\n" + "\n".join(lines))
