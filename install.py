"""Auto-install a CUDA (GPU) build of llama-cpp-python matching THIS ComfyUI's torch
CUDA version, for the Artfat LLM Prompter v2 node.

Why this exists:
  * `pip install llama-cpp-python` pulls the CPU-only PyPI wheel -> the LLM silently
    runs on CPU (slow). That is the #1 "why is it slow" support issue.
  * A CUDA wheel only works if its CUDA MAJOR matches torch's. `ggml-cuda.dll` links
    against `cudart64_<major>.dll`, which is shipped by torch (torch/lib). So a cu128
    wheel (needs cudart64_12) on a cu130 torch (ships cudart64_13) fails to load and
    silently falls back to CPU. We therefore read torch.version.cuda and install the
    JamePeng wheel whose CUDA major matches.

Runs automatically via ComfyUI-Manager right after the node is cloned. Also safe to run
by hand (with ComfyUI FULLY CLOSED, else the llama DLLs are locked):
    <python.exe> install.py

Skips the GPU build when: non-Windows, no NVIDIA GPU, or torch is a CPU-only build /
not installed. If llama-cpp-python is then still missing, it installs the plain CPU build
(prebuilt wheel when one exists) so the node imports. It is not in requirements.txt: with
no wheel for the running Python, pip would try to compile it, and on ComfyUI portable that
fails and takes the other requirements down with it.
"""

import subprocess
import sys

# --- JamePeng release this installer targets. Bump all three when upgrading. ------------
# Newest wheels: https://github.com/JamePeng/llama-cpp-python/releases
_LLAMA_VER = "0.3.48"
_REL_DATE = "20260821"
# CUDA major -> cu-tags JamePeng ships for it (ascending). Within a major we pick the
# highest tag whose minor is <= torch's minor; cudart64_<major> is forward-compatible
# across minors, so a same-major wheel loads against torch's runtime DLLs.
_CU_TAGS = {
    12: [124, 126, 128],
    13: [130, 131],
}
# ---------------------------------------------------------------------------------------


def _torch_cuda():
    """(major, minor) of torch's CUDA build, or None if torch is CPU-only / absent."""
    try:
        import torch
    except Exception:
        return None
    cuda = getattr(torch.version, "cuda", None)  # "13.0", or None on a CPU build
    if not cuda:
        return None
    try:
        major, minor = (int(x) for x in cuda.split(".")[:2])
        return major, minor
    except Exception:
        return None


def _pick_cu_tag(major, minor):
    """Best cu-tag: same major, highest tag whose minor <= torch minor (else lowest)."""
    tags = _CU_TAGS.get(major)
    if not tags:
        return None
    fitting = [t for t in tags if (t % 10) <= minor]  # 128 -> minor 8
    return fitting[-1] if fitting else tags[0]


def _has_nvidia():
    try:
        subprocess.run(["nvidia-smi"], capture_output=True, check=True)
        return True
    except Exception:
        return False


def _installed_wheel():
    """(version, source_url) of the llama-cpp-python already installed, or None.

    Read from metadata instead of importing: importing loads the DLLs and would make
    them impossible to replace in this same process.

    The version alone is not enough to tell builds apart. pip drops the local segment,
    so a cu128 and a cu130 wheel both report plain "0.3.48" and the CUDA tag is lost.
    pip does record the exact URL it installed from in direct_url.json, so that is what
    we compare against. Returns url=None for a wheel installed from PyPI (the CPU build).
    """
    try:
        from importlib.metadata import distribution
        dist = distribution("llama_cpp_python")
        ver = dist.version
    except Exception:
        return None
    url = None
    try:
        import json
        raw = dist.read_text("direct_url.json")
        if raw:
            url = json.loads(raw).get("url")
    except Exception:
        pass
    return ver, url


def _llama_already_loaded():
    """True when llama_cpp is imported in THIS process, so its DLLs are locked.

    ComfyUI-Manager runs install scripts inside the running ComfyUI process. If the node
    has been used in this session, --force-reinstall deletes the old package and then
    fails to write the new one, leaving a broken llama_cpp. That is worse than not
    upgrading at all, so we bail out and print the command to run by hand instead.
    """
    return "llama_cpp" in sys.modules


def _cpu_fallback():
    """Plain CPU build, only when nothing is installed yet. Never replaces a GPU build."""
    if _installed_wheel() is not None or _llama_already_loaded():
        return
    cmd = [sys.executable, "-m", "pip", "install", "--prefer-binary", "llama-cpp-python",
           "--extra-index-url", "https://abetlen.github.io/llama-cpp-python/whl/cpu"]
    print("[llm-prompter-v2] Installing the CPU build of llama-cpp-python (the LLM will run on CPU) ...")
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"[llm-prompter-v2] CPU install failed ({e}). Install llama-cpp-python by hand: "
              "https://github.com/JamePeng/llama-cpp-python/releases")


def main():
    _gpu()
    _cpu_fallback()


def _gpu():
    if sys.platform != "win32":
        print("[llm-prompter-v2] Non-Windows platform - GPU auto-install not wired up yet; "
              "see the load-time warning for the manual command.")
        return
    if not _has_nvidia():
        print("[llm-prompter-v2] No NVIDIA GPU detected (nvidia-smi missing) - "
              "leaving llama-cpp-python as-is.")
        return

    tc = _torch_cuda()
    if tc is None:
        print("[llm-prompter-v2] torch has no CUDA (CPU-only build / not installed) - "
              "skipping GPU install.")
        return
    major, minor = tc

    cu = _pick_cu_tag(major, minor)
    if cu is None:
        print(f"[llm-prompter-v2] No known JamePeng wheel for CUDA {major}.{minor}. "
              "Install manually: https://github.com/JamePeng/llama-cpp-python/releases")
        return

    py = f"cp{sys.version_info.major}{sys.version_info.minor}"
    url = (f"https://github.com/JamePeng/llama-cpp-python/releases/download/"
           f"v{_LLAMA_VER}-cu{cu}-win-{_REL_DATE}/"
           f"llama_cpp_python-{_LLAMA_VER}+cu{cu}-{py}-{py}-win_amd64.whl")

    # Nothing to do if this exact wheel is already in place. Without this the installer
    # re-downloads ~300 MB on every run, including every Manager update check.
    have = _installed_wheel()
    if have and have[1] == url:
        print(f"[llm-prompter-v2] llama-cpp-python {_LLAMA_VER}+cu{cu} already installed - nothing to do.")
        return

    if _llama_already_loaded():
        print("=" * 72)
        print("[llm-prompter-v2] llama-cpp-python is already loaded in this process, so its DLLs "
              "are locked and cannot be replaced safely.")
        if have:
            print(f"[llm-prompter-v2] Installed: {have[0]} from {have[1] or 'PyPI (CPU build)'}")
        print(f"[llm-prompter-v2] Wanted:    {_LLAMA_VER}+cu{cu}")
        print("[llm-prompter-v2] CLOSE ComfyUI completely, then run:")
        print(f'[llm-prompter-v2]   "{sys.executable}" -m pip install --force-reinstall --no-deps {url}')
        print("=" * 72)
        return

    if have:
        print(f"[llm-prompter-v2] Found {have[0]} ({have[1] or 'PyPI CPU build'}), "
              f"upgrading to {_LLAMA_VER}+cu{cu} ...")
    print(f"[llm-prompter-v2] torch CUDA {major}.{minor} -> installing cu{cu} build for {py} ...")
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--force-reinstall", "--no-deps", url],
            check=True,
        )
        print("[llm-prompter-v2] Done. Restart ComfyUI; the LLM will run on the GPU.")
    except subprocess.CalledProcessError as e:
        print(f"[llm-prompter-v2] CUDA install failed ({e}). Install manually - see "
              "https://github.com/JamePeng/llama-cpp-python/releases")


if __name__ == "__main__":
    main()
