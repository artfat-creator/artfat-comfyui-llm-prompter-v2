import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

/* Artfat LLM Prompter v2 — modern DOM-widget UI.
 * Targets ONLY the "ArtfatLLMPrompterV2" node (neither sibling pack is ever touched).
 *
 * CONTRACT, inherited from the image pack and kept verbatim: this file does NOT create, move or
 * serialize-flag any widget. Every widget is declared in Python (image_nodes.py INPUT_TYPES) and
 * lives in that frozen positional order; a tab here is only a way to SHOW widgets that already
 * exist. ComfyUI serializes widget values as a positional list, so a widget created in JS shifts
 * every saved value after it — the drift bug this pack was bitten by twice. Built this way, it is
 * impossible by construction.
 *
 * The one exception is the panel itself, attached with addDOMWidget("alp2_ui", ...) whose
 * getValue() returns "" — it carries no state and is not part of the Python widget order.
 *
 * Everything is wrapped so that if the UI build throws, the node falls back to its plain (still
 * fully functional) native widgets. Sockets stay native on the node edges. */

const HIDDEN = "artfat_lp2_hidden";
const CSS_ID = "alp2-css";

const CSS = `
.alp2{--bg:#1e1e24;--s2:#26262e;--s3:#33333c;--bd:#3a3a44;--bds:#4a4a56;
  --tx:#e6e6ea;--tx2:#a8a8b3;--mut:#6f6f78;--acc:#79c9e8;--accbg:rgba(121,201,232,.13);--accbd:rgba(121,201,232,.4);
  --ok:#4ade80;--okbg:rgba(74,222,128,.13);--okbd:rgba(74,222,128,.35);
  font:12px system-ui,Segoe UI,sans-serif;color:var(--tx);box-sizing:border-box;width:100%;
  background:var(--bg);border:1px solid var(--bds);border-radius:12px;overflow:hidden;}
.alp2 *{box-sizing:border-box;}
.alp2 .hd{background:var(--accbg);border-bottom:1px solid var(--accbd);padding:8px 11px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.alp2 .hd b{color:var(--acc);font-weight:600;font-size:13px;margin-right:auto;}
.alp2 .seg{display:flex;border:1px solid var(--bd);border-radius:8px;overflow:hidden;}
.alp2 .seg button{background:var(--s2);color:var(--tx2);border:0;padding:5px 10px;font:inherit;cursor:pointer;}
.alp2 .seg button.on{background:var(--accbg);color:var(--acc);font-weight:600;}
.alp2 select{background:var(--s2);color:var(--tx);border:1px solid var(--bds);border-radius:7px;padding:5px 8px;font:inherit;width:100%;cursor:pointer;}
.alp2 textarea,.alp2 input[type=text]{background:var(--s2);color:var(--tx);border:1px solid var(--bd);border-radius:7px;padding:6px 8px;font:inherit;width:100%;resize:vertical;}
.alp2 textarea{min-height:34px;line-height:1.4;}
.alp2 .sw{width:34px;height:19px;border-radius:10px;border:1px solid var(--bds);background:var(--s3);position:relative;cursor:pointer;flex:none;transition:.15s;}
.alp2 .sw i{position:absolute;width:15px;height:15px;border-radius:50%;background:var(--mut);top:1px;left:1px;transition:.15s;}
.alp2 .sw.on{background:var(--acc);}.alp2 .sw.on i{left:16px;background:#1a1a1a;}
.alp2 .swrap{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--tx2);}
.alp2 .tabs{display:flex;gap:4px;padding:8px 10px 0;}
.alp2 .tab{font-size:11.5px;padding:5px 12px;border-radius:8px 8px 0 0;border:1px solid var(--bd);border-bottom:none;background:var(--s2);color:var(--tx2);cursor:pointer;}
.alp2 .tab.on{background:var(--accbg);border-color:var(--accbd);color:var(--acc);font-weight:600;}
.alp2 .panel{border-top:1px solid var(--accbd);padding:10px;}
.alp2 .grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;}
.alp2 .fld{display:flex;flex-direction:column;gap:3px;}
.alp2 .fld.full{grid-column:1 / -1;}
.alp2 .lbl{font-size:9.5px;color:var(--tx2);text-transform:uppercase;letter-spacing:.03em;}
.alp2 .lbl.n{color:var(--acc);}
.alp2 .prev .lbl{color:var(--acc);}
.alp2 .hint{font-size:10px;color:var(--mut);line-height:1.4;padding:2px 0;}
.alp2 .sock{font-size:10px;color:var(--tx2);background:var(--s2);border:1px dashed var(--bd);border-radius:7px;padding:6px 8px;line-height:1.6;}
.alp2 .sock b{color:var(--acc);font-weight:600;}
.alp2 .refgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:7px;}
.alp2 .refcell{position:relative;border:1px solid var(--bd);border-radius:8px;overflow:hidden;background:var(--s2);}
.alp2 .refthumb{width:100%;height:70px;object-fit:cover;display:block;background:var(--s3);}
.alp2 .refrm{position:absolute;top:2px;right:3px;color:#fff;background:rgba(0,0,0,.55);border-radius:5px;font-size:11px;line-height:1.3;padding:0 4px;cursor:pointer;}
.alp2 .refrm:hover{color:#ef6b6b;}
.alp2 .refrole{width:100%;border:0;border-top:1px solid var(--bd);border-radius:0;font-size:9.5px;padding:2px 3px;}
.alp2 .refnote{width:100%;border:0;border-top:1px solid var(--bd);border-radius:0;font-size:9px;padding:2px 4px;background:var(--s2);color:var(--tx);}
.alp2 .refnum{width:100%;border:0;border-top:1px solid var(--bd);border-radius:0;font-size:9px;padding:2px 3px;color:var(--acc);background:var(--s3);cursor:pointer;}
.alp2 .refnote::placeholder{color:var(--mut);}
.alp2 .refbadge{position:absolute;top:2px;left:3px;background:rgba(0,0,0,.6);color:#fff;font-size:8.5px;border-radius:4px;padding:1px 4px;}
.alp2 .refname{font-size:8.5px;color:var(--tx2);padding:1px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-top:1px solid var(--bd);}
.alp2 .addrow{display:flex;gap:6px;margin-top:7px;}
.alp2 .addbtn{flex:1;text-align:center;color:var(--acc);border:1px dashed var(--accbd);border-radius:8px;padding:7px;cursor:pointer;font-size:10.5px;}
.alp2 .refdrop{outline:2px dashed var(--acc);outline-offset:-3px;border-radius:10px;}
.alp2 .refcell.bad{border-color:#ef6b6b;box-shadow:0 0 0 1px #ef6b6b inset;}
.alp2 .refbad{position:absolute;bottom:2px;left:3px;background:#ef6b6b;color:#1a1a1a;font-size:8.5px;border-radius:5px;padding:0 4px;font-weight:600;}
.alp2 .refcell.sockcell{border-style:dashed;border-color:var(--acc);}
.alp2 .refsockthumb{width:100%;height:70px;display:flex;align-items:center;justify-content:center;background:var(--s3);font-size:24px;line-height:1;user-select:none;}
.alp2 .refcell.sockcell .refrole,.alp2 .refcell.sockcell .refnote,.alp2 .refcell.sockcell .refnum{opacity:.5;cursor:default;}
.alp2 .srchwrap{display:flex;flex-direction:column;gap:3px;}
.alp2 input[type=text].srch{font-size:11px;padding:4px 7px;}
.alp2 input[type=text].srch::placeholder{color:var(--mut);}
.alp2 .srchcount{font-size:9.5px;color:var(--mut);padding:1px 0 0;}
.alp2 .srchcount.hit{color:var(--acc);}
.alp2 .swpair{display:flex;align-items:center;gap:7px;}
.alp2 .swpair span{font-size:11px;color:var(--mut);cursor:pointer;user-select:none;white-space:nowrap;}
.alp2 .swpair span.on{color:var(--acc);font-weight:600;}
.alp2 .sect{font-size:9.5px;color:var(--acc);letter-spacing:.06em;text-transform:uppercase;border-top:1px solid var(--accbd);margin-top:13px;padding-top:9px;}
.alp2 .sect.first{border-top:none;margin-top:0;padding-top:0;}
.alp2 .blk{gap:6px;margin-top:5px;}
`;

function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    const s = document.createElement("style");
    s.id = CSS_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
}

function W(node, name) {
    return node.widgets ? node.widgets.find((w) => w.name === name) : null;
}
function hideNative(w) {
    if (!w || w.type === HIDDEN) return;
    w._ot = w.type; w._oc = w.computeSize;
    w.type = HIDDEN; w.computeSize = () => [0, -4];
    // Some widget kinds (boolean toggles, combos) still draw their control at their slot even
    // after the type swap; `hidden` makes newer ComfyUI skip drawing them entirely.
    w.hidden = true;
    if (w.linkedWidgets) w.linkedWidgets.forEach(hideNative);
}

// Push every widget's (restored) value back into its DOM control. Called after ComfyUI restores
// saved widget values on load (onConfigure) so the panel shows the saved state, not the defaults
// it read when the node was first created.
function resyncAll(node) {
    (node.widgets || []).forEach((w) => {
        if (w && w._domSync) { try { w._domSync(); } catch (e) {} }
    });
}

// Build a <select> bound to an EXISTING combo widget.
function selFor(node, name) {
    const w = W(node, name);
    const el = document.createElement("select");
    if (!w) { el.disabled = true; return el; }
    const vals = (w.options && w.options.values) || [];
    for (const v of vals) {
        const o = document.createElement("option");
        o.value = v; o.textContent = v; el.appendChild(o);
    }
    el.value = w.value;
    el.addEventListener("change", () => {
        w.value = el.value;
        if (w.callback) w.callback(w.value);
        node.setDirtyCanvas(true, true);
    });
    w._domSync = () => { el.value = w.value; };
    return el;
}

// --- preset search + family filter -------------------------------------------------------
// The preset lists are long enough to scroll past what you want. Both controls below are PLAIN
// DOM (an <input> and a <select> living in our panel); neither is a widget, so the frozen
// Python widget order is untouched and no saved graph shifts. They only rewrite the <option>
// list of the select that is already bound to the native combo — the widget stays the single
// source of truth and keeps its value whatever the filter shows.
//
// Family is marked by a NAME PREFIX, so adding a preset never means touching this code.
// A family narrows the two preset lists SEPARATELY, because the format files and the task
// entries are not named from the same vocabulary. One prefix across both lists is what made
// picking "Qwen 2.1 Edit" empty the format list: the edit presets exist only as tasks.
// An empty prefix means "do not narrow this list at all".
//   sys = format presets (HOW it is written, the .txt files)
//   ins = task presets   (WHAT to do, the entries in presets.py)
// Mix deliberately reuses the T2I formats: both write a whole frame to the same Qwen contract
// and only the task differs, so duplicating 64 style files under a second prefix would buy
// nothing. T2I leaves its task list unfiltered, since any ordinary task fits a t2i style.
const PRESET_FAMILIES = [
    { label: "Any / general", sys: "", ins: "" },
    { label: "Qwen 2.1 Edit", sys: "Q21E_", ins: "Q21E_" },
    { label: "Qwen 2.1 T2I", sys: "Q21T_", ins: "" },
    { label: "Qwen 2.1 Mix", sys: "Q21T_", ins: "Q21MIX_" },
];

// Rebuild `el`'s options from the widget's FULL value list, narrowed by free text and family.
// Returns how many entries matched.
function fillFilteredOptions(w, el, query, prefix) {
    const all = (w.options && w.options.values) || [];
    const q = String(query || "").trim().toLowerCase();
    const keep = all.filter((v) => {
        const s = String(v);
        if (prefix && !s.startsWith(prefix)) return false;
        return !q || s.toLowerCase().includes(q);
    });
    const cur = w.value;
    el.textContent = "";
    // A value the filter hides is still offered, flagged, and stays selected. Dropping it would
    // silently rewrite whatever preset a saved workflow was built around.
    if (cur !== undefined && cur !== null && !keep.includes(cur)) {
        const o = document.createElement("option");
        o.value = cur;
        o.textContent = cur + "  — current (outside filter)";
        el.appendChild(o);
    }
    for (const v of keep) {
        const o = document.createElement("option");
        o.value = v; o.textContent = v; el.appendChild(o);
    }
    el.value = cur;
    return keep.length;
}

// A <select> bound to an existing combo, with its own search box above it.
// Returns { wrap, refresh } — `refresh` re-applies the current search + the shared family.
function searchableSel(node, name, placeholder, getPrefix) {
    const wrap = document.createElement("div");
    wrap.className = "srchwrap";
    const el = selFor(node, name);
    const w = W(node, name);
    if (!w) { wrap.appendChild(el); return { wrap, refresh: () => {} }; }

    const box = document.createElement("input");
    box.type = "text";
    box.className = "srch";
    box.placeholder = placeholder || "search...";
    const count = document.createElement("div");
    count.className = "srchcount";

    // Suggestion list. Built like the "@" reference picker: a fixed-position menu parked on
    // document.body, so the node's own scrolling panel can never clip it. The <select> below
    // stays the bound control and the single source of truth -- picking here only writes to it.
    const menu = document.createElement("div");
    menu.className = "alp2 presetmenu";
    menu.style.cssText = "position:fixed;z-index:99998;display:none;max-height:240px;" +
        "overflow-y:auto;background:#26262e;border:1px solid #4a4a56;border-radius:8px;" +
        "padding:4px;box-shadow:0 6px 24px rgba(0,0,0,.5);";
    document.body.appendChild(menu);

    let cursor = 0;
    const closeMenu = () => { menu.style.display = "none"; };
    const isOpen = () => menu.style.display !== "none";
    const hits = () => {
        const all = (w.options && w.options.values) || [];
        const q = box.value.trim().toLowerCase();
        const pre = getPrefix ? getPrefix() : "";
        return all.filter((v) => {
            const t = String(v);
            if (pre && !t.startsWith(pre)) return false;
            return !q || t.toLowerCase().includes(q);
        });
    };
    const rowEls = () => [...menu.children].filter((c) => c.dataset && c.dataset.i !== undefined);
    const highlight = (i) => {
        const list = rowEls();
        if (!list.length) return;
        cursor = Math.max(0, Math.min(i, list.length - 1));
        list.forEach((r, k) => { r.style.background = k === cursor ? "rgba(121,201,232,.13)" : ""; });
        list[cursor].scrollIntoView({ block: "nearest" });
    };
    const pick = (v) => {
        el.value = v;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        box.value = "";
        refresh();
        closeMenu();
    };
    const openMenu = () => {
        const list = hits();
        menu.replaceChildren();
        if (!list.length) {
            const empty = document.createElement("div");
            empty.style.cssText = "padding:6px 8px;color:#6f6f78;font-size:11px;";
            empty.textContent = "nothing matches";
            menu.appendChild(empty);
        }
        list.forEach((v, i) => {
            const row = document.createElement("div");
            row.dataset.i = String(i);
            row.style.cssText = "padding:5px 8px;border-radius:5px;cursor:pointer;font-size:11px;" +
                "color:#e6e6ea;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
            if (v === w.value) row.style.color = "#79c9e8";
            row.textContent = String(v);
            row.addEventListener("mouseenter", () => highlight(i));
            row.addEventListener("mousedown", (e) => { e.preventDefault(); pick(v); });
            menu.appendChild(row);
        });
        const b = box.getBoundingClientRect();
        menu.style.left = Math.round(b.left) + "px";
        menu.style.top = Math.round(b.bottom + 3) + "px";
        menu.style.minWidth = Math.round(b.width) + "px";
        menu.style.maxWidth = Math.max(280, Math.round(b.width)) + "px";
        menu.style.display = "block";
        highlight(0);
    };

    const refresh = () => {
        const q = box.value;
        const pre = getPrefix ? getPrefix() : "";
        const n = fillFilteredOptions(w, el, q, pre);
        const total = ((w.options && w.options.values) || []).length;
        const filtering = !!(q.trim() || pre);
        count.className = "srchcount" + (filtering ? " hit" : "");
        count.textContent = filtering ? (n + " of " + total + " shown") : "";
    };
    box.addEventListener("input", () => { refresh(); openMenu(); });
    box.addEventListener("focus", openMenu);
    box.addEventListener("blur", () => setTimeout(closeMenu, 120));
    box.addEventListener("keydown", (e) => {
        // Esc closes the list first and only then clears the box, so one key never does both.
        if (e.key === "Escape") {
            e.stopPropagation();
            if (isOpen()) closeMenu();
            else { box.value = ""; refresh(); }
            return;
        }
        if (!isOpen()) {
            if (e.key === "ArrowDown") { e.preventDefault(); openMenu(); }
            return;
        }
        if (e.key === "ArrowDown") { e.preventDefault(); highlight(cursor + 1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); highlight(cursor - 1); }
        else if (e.key === "Enter" || e.key === "Tab") {
            const list = hits();
            if (list[cursor] !== undefined) { e.preventDefault(); pick(list[cursor]); }
        }
    });
    // selFor installed a _domSync that assumes an unfiltered list; go through the filter instead
    // so a restored value outside the current filter still shows up selected.
    w._domSync = () => { refresh(); el.value = w.value; };

    wrap.appendChild(box);
    wrap.appendChild(el);
    wrap.appendChild(count);
    return { wrap, refresh };
}

// Build a <textarea>/<input> bound to an EXISTING string/number widget.
function txtFor(node, name, multiline) {
    const w = W(node, name);
    const el = document.createElement(multiline ? "textarea" : "input");
    if (!multiline) el.type = "text";
    if (!w) { el.disabled = true; return el; }
    el.value = w.value !== undefined && w.value !== null ? w.value : "";
    if (w.options && w.options.placeholder) el.placeholder = w.options.placeholder;
    const sync = () => { w.value = el.value; };
    el.addEventListener("input", sync);
    el.addEventListener("change", () => { sync(); node.setDirtyCanvas(true, true); });
    w._domEl = el; // so onExecuted can push generated text back
    w._domSync = () => { el.value = w.value !== undefined && w.value !== null ? w.value : ""; };
    return el;
}
// Toggle switch bound to an EXISTING BOOLEAN widget. onToggle(value) fires after each flip.
function swFor(node, name, label, onToggle) {
    const w = W(node, name);
    const wrap = document.createElement("div");
    wrap.className = "swrap";
    const sw = document.createElement("div");
    sw.className = "sw" + (w && w.value ? " on" : "");
    sw.appendChild(document.createElement("i"));
    sw.addEventListener("click", () => {
        if (!w) return;
        w.value = !w.value;
        sw.classList.toggle("on", !!w.value);
        if (w.callback) w.callback(w.value);
        if (onToggle) onToggle(!!w.value);
        node.setDirtyCanvas(true, true);
    });
    const t = document.createElement("span");
    t.textContent = label;
    wrap.appendChild(sw); wrap.appendChild(t);
    if (w) w._domSync = () => { sw.classList.toggle("on", !!w.value); };
    return wrap;
}
// Segmented control bound to an EXISTING combo widget (2-3 short values).
function segFor(node, name, labelOf, onPick) {
    const w = W(node, name);
    const seg = document.createElement("div");
    seg.className = "seg";
    const vals = (w && w.options && w.options.values) || [];
    vals.forEach((v) => {
        const b = document.createElement("button");
        b.textContent = labelOf ? labelOf(v) : v;
        b.dataset.v = v;
        if (w && w.value === v) b.classList.add("on");
        b.addEventListener("click", () => {
            if (!w) return;
            w.value = v;
            seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.v === v));
            if (w.callback) w.callback(v);
            if (onPick) onPick(v);
            node.setDirtyCanvas(true, true);
        });
        seg.appendChild(b);
    });
    if (w) w._domSync = () => {
        seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.v === w.value));
        if (onPick) onPick(w.value);
    };
    return seg;
}

// A two-value combo drawn as a slider with BOTH values written out, one either side, the live
// one lit. The widget stays a combo, so a saved graph keeps storing the value as a string and
// the schema is untouched -- this is only how the panel paints it. Naming both sides is the
// point: a bare on/off slider would leave you remembering which end is `mix`, and neither of
// these values is an "off". Distinct from segFor above, which is for three-plus options.
function swPairFor(node, name) {
    const w = W(node, name);
    const wrap = document.createElement("div");
    wrap.className = "swpair";
    if (!w) return wrap;
    const vals = ((w.options && w.options.values) || []).slice(0, 2);
    if (vals.length < 2) return wrap;

    const left = document.createElement("span");
    left.textContent = String(vals[0]);
    const right = document.createElement("span");
    right.textContent = String(vals[1]);
    const sw = document.createElement("div");
    sw.className = "sw";
    sw.appendChild(document.createElement("i"));

    const paint = () => {
        const isRight = String(w.value) === String(vals[1]);
        sw.classList.toggle("on", isRight);
        left.classList.toggle("on", !isRight);
        right.classList.toggle("on", isRight);
    };
    const set = (v) => {
        if (String(w.value) === String(v)) return;
        w.value = v;
        if (w.callback) w.callback(w.value);
        paint();
        node.setDirtyCanvas(true, true);
    };
    sw.addEventListener("click", () => set(String(w.value) === String(vals[1]) ? vals[0] : vals[1]));
    left.addEventListener("click", () => set(vals[0]));
    right.addEventListener("click", () => set(vals[1]));

    wrap.appendChild(left);
    wrap.appendChild(sw);
    wrap.appendChild(right);
    paint();
    w._domSync = paint;
    return wrap;
}

// SFW pose names (mirror of POSE_SFW in image_presets.py) — used to filter the pose list when
// the nsfw toggle is OFF.
const POSE_SFW = new Set([
    "(none)", "standing relaxed", "hands on hips", "leaning on wall", "sitting on bed edge",
    "lying on side", "walking to camera", "playful twirl", "hand in hair",
    "over-the-shoulder glance", "stretching / arching", "adjusting hair / outfit", "blowing a kiss",
]);

// Type "@" in a text field and the references of the active set drop down: pick one and the tag
// goes in. Written by hand, <Image 3> is a number you have to count off the gallery and re-count
// every time a reference moves, and getting it wrong is invisible until the render comes back.
function attachRefPicker(el, node) {
    if (!el || el.tagName !== "TEXTAREA") return el;
    const menu = document.createElement("div");
    menu.className = "alp2 refmenu";
    menu.style.cssText = "position:fixed;z-index:99998;display:none;max-height:210px;" +
        "overflow-y:auto;background:#26262e;border:1px solid #4a4a56;border-radius:8px;" +
        "padding:4px;min-width:210px;box-shadow:0 6px 24px rgba(0,0,0,.5);";
    document.body.appendChild(menu);

    const refsOf = () => {
        // Same pool, same order, same function the gallery and the wire cap use.
        const pool = refPoolInfo(node);
        const out = [];
        let ci = 0;
        for (const e of pool.order) {
            if (e.wire) {
                out.push({ tag: "<Image " + (++ci) + ">", label: "connected input" });
                continue;
            }
            const it = e.file;
            const name = String(it.file || "").split("/").pop();
            const role = String(it.note || it.role || "").trim();
            out.push({ tag: "<Image " + (++ci) + ">", label: role || name });
        }
        return out;
    };

    let at = -1;   // where the "@" that opened the menu sits
    const close = () => { menu.style.display = "none"; at = -1; };

    const insert = (tag) => {
        const value = el.value;
        const head = value.slice(0, at);
        const tail = value.slice(el.selectionStart);
        el.value = head + tag + " " + tail;
        const caret = head.length + tag.length + 1;
        el.setSelectionRange(caret, caret);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        close();
        el.focus();
    };

    let cursor = 0;
    const rows = () => [...menu.children].filter((c) => c.dataset && c.dataset.i !== undefined);
    const highlight = (i) => {
        const list = rows();
        if (!list.length) return;
        cursor = Math.max(0, Math.min(i, list.length - 1));
        list.forEach((r, k) => { r.style.background = k === cursor ? "rgba(121,201,232,.13)" : ""; });
        list[cursor].scrollIntoView({ block: "nearest" });
    };

    const open = () => {
        const list = refsOf();
        menu.replaceChildren();
        if (!list.length) {
            const empty = document.createElement("div");
            empty.style.cssText = "padding:6px 8px;color:#6f6f78;font-size:11px;";
            empty.textContent = "no references in this set yet";
            menu.appendChild(empty);
        }
        list.forEach((r, i) => {
            const row = document.createElement("div");
            row.style.cssText = "padding:5px 8px;border-radius:5px;cursor:pointer;font-size:11px;" +
                                "color:#e6e6ea;display:flex;gap:8px;";
            row.dataset.i = String(i);
            const t = document.createElement("b");
            t.style.cssText = "color:#79c9e8;font-weight:600;white-space:nowrap;";
            t.textContent = r.tag;
            const l = document.createElement("span");
            l.style.cssText = "color:#a8a8b3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
            l.textContent = r.label || "";
            row.appendChild(t); row.appendChild(l);
            row.addEventListener("mouseenter", () => highlight(i));
            row.addEventListener("mousedown", (e) => { e.preventDefault(); insert(r.tag); });
            menu.appendChild(row);
        });
        const box = el.getBoundingClientRect();
        menu.style.left = Math.round(box.left) + "px";
        menu.style.top = Math.round(box.bottom + 4) + "px";
        menu.style.display = "block";
        highlight(0);
    };

    el.addEventListener("input", () => {
        const caret = el.selectionStart;
        const before = el.value.slice(0, caret);
        const hit = before.lastIndexOf("@");
        // Still inside the token that "@" started, and it has no spaces in it yet.
        if (hit >= 0 && !/\s/.test(before.slice(hit + 1))) { at = hit; open(); }
        else close();
    });
    el.addEventListener("keydown", (e) => {
        if (menu.style.display === "none") return;
        if (e.key === "ArrowDown") { e.preventDefault(); highlight(cursor + 1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); highlight(cursor - 1); }
        else if (e.key === "Enter" || e.key === "Tab") {
            const list = rows();
            if (list.length) {
                e.preventDefault();
                const r = refsOf()[cursor];
                if (r) insert(r.tag);
            }
        } else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    el.addEventListener("blur", () => setTimeout(close, 120));
    return el;
}

// Pose <select> that filters its options by the nsfw toggle. Exposes ._refresh().
function buildPoseSelect(node) {
    const w = W(node, "pose");
    const el = document.createElement("select");
    const populate = () => {
        const nsfwOn = !!(W(node, "nsfw") && W(node, "nsfw").value);
        const vals = (w && w.options && w.options.values) || [];
        while (el.firstChild) el.removeChild(el.firstChild);
        for (const v of vals) {
            if (!nsfwOn && !POSE_SFW.has(v)) continue;
            const o = document.createElement("option");
            o.value = v; o.textContent = v; el.appendChild(o);
        }
        if (w) {
            const ok = Array.from(el.options).some((o) => o.value === w.value);
            if (!ok) w.value = "(none)";
            el.value = w.value;
        }
    };
    populate();
    el.addEventListener("change", () => {
        if (w) { w.value = el.value; node.setDirtyCanvas(true, true); }
    });
    el._refresh = populate;
    if (w) w._domSync = populate; // restore on configure re-reads w.value
    return el;
}

function imageView(name) {
    if (!name || name === "(none)") return "";
    let filename = name, subfolder = "";
    const m = String(name).match(/^(.*)\/([^\/]+)$/);
    if (m) { subfolder = m[1]; filename = m[2]; }
    return api.apiURL(`/view?filename=${encodeURIComponent(filename)}&type=input&subfolder=${encodeURIComponent(subfolder)}&t=${Date.now()}`);
}
// Full-screen lightbox for a reference image (click or Esc to close).
function openLightbox(url) {
    if (!url) return;
    const ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;";
    const img = document.createElement("img");
    img.src = url;
    img.style.cssText = "max-width:60vw;max-height:65vh;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.6);";
    img.addEventListener("click", (e) => e.stopPropagation());
    ov.appendChild(img);
    const close = () => { if (ov.parentNode) ov.parentNode.removeChild(ov); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    ov.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    document.body.appendChild(ov);
}

// ---- Node config (save/load via ComfyUI userdata). Own directory: sharing the video pack's
// would mix two different widget sets into one file list. ----
const CFG_DIR = "artfat_llm_v2";
const ALWAYS_SKIP = new Set(["final_prompt"]);                              // never persisted
const REF_KEYS = new Set(["refs_json", "persona_image", "ref_description"]); // refs: autosave only
async function listConfigs() {
    try {
        const r = await api.fetchApi("/userdata?dir=" + encodeURIComponent(CFG_DIR));
        if (r.status !== 200) return [];
        const arr = await r.json();
        return arr.filter((f) => String(f).endsWith(".json")).map((f) => String(f).replace(/\.json$/, ""))
            .filter((n) => !n.startsWith("_")).sort();  // hide _autosave and other internal slots
    } catch (e) { return []; }
}
async function saveConfig(node, name, includeRefs) {
    const skip = new Set(ALWAYS_SKIP);
    if (!includeRefs) REF_KEYS.forEach((k) => skip.add(k));
    const obj = {};
    for (const wdg of (node.widgets || [])) {
        if (!wdg || !wdg.name || skip.has(wdg.name)) continue;
        const v = wdg.value;
        if (v === null || ["string", "number", "boolean"].includes(typeof v)) obj[wdg.name] = v;
    }
    const file = CFG_DIR + "/" + name + ".json";
    const r = await api.fetchApi("/userdata/" + encodeURIComponent(file) + "?overwrite=true",
        { method: "POST", body: JSON.stringify(obj, null, 2) });
    return r.status === 200;
}
async function loadConfig(node, name) {
    const file = CFG_DIR + "/" + name + ".json";
    const r = await api.fetchApi("/userdata/" + encodeURIComponent(file));
    if (r.status !== 200) return false;
    const obj = await r.json();
    for (const k in obj) {
        if (ALWAYS_SKIP.has(k)) continue;
        const wdg = W(node, k);
        if (wdg) { wdg.value = obj[k]; if (wdg.callback) { try { wdg.callback(wdg.value); } catch (e) {} } }
    }
    resyncAll(node);
    node.setDirtyCanvas(true, true);
    return true;
}

// Persona reference image — an in-node LoadImage-style upload bound to the EXISTING
// `persona_image` combo widget. Describe-only; the reference_image socket overrides it.
function personaUpload(node) {
    const w = W(node, "persona_image");
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:6px;";
    if (!w) { wrap.textContent = "(persona_image widget missing — restart ComfyUI)"; return wrap; }
    const thumb = document.createElement("img");
    thumb.style.cssText = "max-height:130px;max-width:100%;border-radius:8px;border:1px solid var(--bd);object-fit:contain;background:var(--s2);";
    thumb.hidden = true;
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:6px;align-items:center;";
    const sel = document.createElement("select");
    sel.style.flex = "1 1 auto";
    const btn = document.createElement("button");
    btn.textContent = "⬆ upload";
    btn.style.cssText = "background:var(--accbg);color:var(--acc);border:1px solid var(--accbd);border-radius:7px;padding:5px 10px;cursor:pointer;font:inherit;flex:none;";
    const file = document.createElement("input");
    file.type = "file"; file.accept = "image/*"; file.style.display = "none";
    row.appendChild(sel); row.appendChild(btn);
    wrap.appendChild(thumb); wrap.appendChild(row); wrap.appendChild(file);

    const showThumb = () => {
        const u = imageView(w.value);
        if (u) { thumb.src = u; thumb.hidden = false; } else { thumb.hidden = true; }
    };
    const rebuildOptions = () => {
        const vals = (w.options && w.options.values) || [];
        while (sel.firstChild) sel.removeChild(sel.firstChild);
        for (const v of vals) {
            const o = document.createElement("option");
            o.value = v; o.textContent = v; sel.appendChild(o);
        }
        sel.value = w.value;
    };
    rebuildOptions(); showThumb();
    sel.addEventListener("change", () => { w.value = sel.value; showThumb(); node.setDirtyCanvas(true, true); });
    w._domSync = () => { rebuildOptions(); showThumb(); };
    btn.addEventListener("click", () => file.click());
    file.addEventListener("change", async () => {
        if (!file.files || !file.files[0]) return;
        const body = new FormData();
        body.append("image", file.files[0]);
        body.append("overwrite", "false");
        try {
            const resp = await api.fetchApi("/upload/image", { method: "POST", body });
            if (resp.status === 200) {
                const data = await resp.json();
                const name = data.subfolder ? data.subfolder + "/" + data.name : data.name;
                const vals = (w.options && w.options.values) || (w.options.values = []);
                if (!vals.includes(name)) vals.push(name);
                w.value = name;
                rebuildOptions(); showThumb();
                node.setDirtyCanvas(true, true);
            }
        } catch (e) {
            console.error("[artfat-llm-v2] persona upload failed", e);
        }
        file.value = "";
    });
    return wrap;
}

// Refs gallery — an in-node upload grid bound to the EXISTING `refs_json` string widget. Each
// item is {file, role, note, set}; images become <Image N> for the writer, after the
// image_1/image_2 sockets. Add by button, picker, or drag & drop.
const REF_ROLES = ["(auto)", "identity", "location", "outfit", "pose", "partner", "prop",
                   "style", "background", "action", "lighting", "composition"];
const REF_MAX_IMAGES = 10;  // mirrors MAX_REF_IMAGES in image_nodes.py

// ---- one visible "refs" output, many real wires ------------------------------------------
// Python declares ref_1..ref_10 statically (ref_1 at index 6, ref_2..ref_10 trailing at 9..17).
// The canvas shows a single socket instead -- `refs` -- and every wire you drag out of it is an
// ORDINARY LiteGraph link on that one slot. We add exactly two things:
//   * a number painted on each wire (1, 2, 3 ... in connection order), and
//   * a rewrite of each wire's origin slot at queue time: wire 1 keeps slot 9 (ref_1), wire 2
//     becomes slot 10 (ref_2), wire 3 slot 11, and so on.
// Nothing is faked. The consumer's autogrow group really is connected, so it grows its next
// slot as usual; undo/redo, copy/paste, save/load and graph serialization are all plain
// LiteGraph. Our only foothold is graphToPrompt.
//
// (The first cut of this stored virtual links in node.properties and cancelled the real
// connection. TextEncodeQwenImage21 then never grew images.image_2, so a second wire had
// nowhere to land [screen]. Hence: keep the link, renumber the slot.)
//
// Rules that keep saved graphs intact:
//   * the nine fixed outputs (positive..positive_list) always keep indices 0-8 and `refs` is
//     appended AFTER them, because ComfyUI wires outputs BY INDEX, not by name;
//   * a graph saved by an earlier build is migrated on load -- its ref_N links are moved onto
//     the single `refs` slot in ref_N order;
//   * `ref_outputs` stays in Python INPUT_TYPES (widget values serialize POSITIONALLY, so
//     deleting it would shift every value saved after it) but no longer drives anything: the
//     Refs tab is what decides how many references exist.
// Nothing here creates a LiteGraph widget.
const REF_OUT_MAX = REF_MAX_IMAGES;    // mirrors MAX_REF_OUTPUTS in image_nodes.py
const REFS_OUT_NAME = "refs";
// Where ref_1..ref_9 sit in RETURN_TYPES, and where the collapsed `refs` socket lands on the
// canvas. Both are LEARNED from the node definition in rewriteRefOutputsInDef, so image_nodes.py
// stays the one place the output order is written down and this file cannot drift from it.
// ref_1 keeps its position (that IS the visible socket) and ref_2..ref_9 are stripped, so they
// have to be trailing in RETURN_TYPES -- see the note there.
let REF_BACKEND_SLOTS = null;          // [slot of ref_1, ref_2, ... ref_9]
let REFS_UI_INDEX = -1;                // index of `refs` among the outputs the canvas shows
const REF_BACKEND_SLOTS_FALLBACK = [6, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const REFS_UI_INDEX_FALLBACK = 6;
const REF_LINK_ORPHAN = "#ef6b6b";     // wire number past the end of the reference pool

function refSlotFor(index) {
    const table = (REF_BACKEND_SLOTS && REF_BACKEND_SLOTS.length)
        ? REF_BACKEND_SLOTS : REF_BACKEND_SLOTS_FALLBACK;
    return index >= 0 && index < table.length ? table[index] : -1;
}
function refsUiIndex() {
    return REFS_UI_INDEX >= 0 ? REFS_UI_INDEX : REFS_UI_INDEX_FALLBACK;
}
const NODE_CLASS_V2 = "ArtfatLLMPrompterV2";
const REF_OUT_RE = /^ref_(\d+)$/;
// Left over from the abandoned virtual-link cut; read once on load so a graph saved in between
// does not lose its wires, then deleted.
const LEGACY_LINKS_PROP = "artfat_v2_virtual_ref_links";

function isRefOutput(name) { return REF_OUT_RE.test(String(name || "")); }

function isPrompterV2(node) {
    return Boolean(node) && (node.comfyClass === NODE_CLASS_V2 || node.type === NODE_CLASS_V2);
}

// ---- the reference pool, read off the node -------------------------------------------------
// Rebuilt here exactly as _build_ref_pool() builds it in image_nodes.py: the entries of the
// PRIMARY set in their order, wires and files in ONE sequence. A `ref in` wire is an entry
// {wire: "<source id>:<slot>", set} next to the gallery's {file, role, note, set}; the gallery
// keeps one per wire in every set (syncWireEntries), so a wire can sit at a different number in
// each set. A wire no entry mentions yet goes last -- the same place a new upload goes, so
// adding a reference never renumbers the ones already there. Index N-1 is <Image N>. The
// gallery cards, the "@" picker, the wire numbers and the wire cap all read this one function,
// so they cannot end up telling the user different stories about the same pool.
function wireKey(l) { return Number(l.source_id) + ":" + (Number(l.source_slot) || 0); }

function refPoolInfo(node) {
    const socketLinks = liveRefInLinks(node);
    const byKey = new Map(socketLinks.map((l) => [wireKey(l), l]));
    const setWidget = W(node, "primary_set");
    const active = setWidget ? (parseInt(setWidget.value, 10) || 1) : 1;
    const jsonWidget = W(node, "refs_json");
    let items = [];
    try { items = JSON.parse((jsonWidget && jsonWidget.value) || "[]"); } catch (e) { items = []; }
    if (!Array.isArray(items)) items = [];
    const inSet = items.filter((it) => {
        const n = parseInt(it && it.set, 10);
        return it && (n >= 1 ? n : 1) === active;
    });
    const order = [];      // [{ wire: link } | { file: item }] in <Image N> order
    const placed = new Set();
    for (const it of inSet) {
        if (it.wire != null) {
            const k = String(it.wire);
            const l = byKey.get(k);
            if (l && !placed.has(k)) { placed.add(k); order.push({ wire: l }); }
        } else {
            order.push({ file: it });
        }
    }
    for (const l of socketLinks) {
        if (!placed.has(wireKey(l))) { placed.add(wireKey(l)); order.push({ wire: l }); }
    }
    const files = inSet.filter((it) => it.wire == null);
    const sockets = socketLinks.map((_, i) => "ref in " + (i + 1));
    return { sockets, socketLinks, files, order, active, size: socketLinks.length + files.length };
}

// <Image N> of one `ref in` wire in the active set (0-based), or -1.
function refInPoolIndex(pool, link) {
    return pool.order.findIndex((e) => e.wire === link);
}

// How many wires the pool can actually fill.
// A connected socket may carry a BATCH, and how many frames that is only becomes known at run
// time, so there the counted size is a LOWER bound: allow the full nine rather than block a
// wire the user genuinely needs. With no socket connected the count is exact and is the limit.
function refWireCap(node) {
    const pool = refPoolInfo(node);
    const batchy = pool.sockets.length > 0;
    return {
        size: pool.size,
        batchy,
        cap: batchy ? REF_OUT_MAX : Math.min(pool.size, REF_OUT_MAX),
    };
}

const REFS_OUT_TOOLTIP = "Reference images. Drag one wire per reference into "
    + "TextEncodeQwenImage21's image slot -- the number painted on each wire is the number the "
    + "prompt calls it by, so wire 3 is <Image 3>.";

// Rewrite the node DEFINITION: keep ref_1 where it is but rename it `refs`, and strip
// ref_2..ref_9 (the wires dragged out of `refs` are renumbered onto them at queue time).
// ref_1's position is remembered on the way past, which is how this file learns the backend
// slot numbers instead of repeating them. Done at definition level, not per instance, so the
// builds that reconcile node.outputs against the def after configure() keep the socket instead
// of quietly deleting it.
function rewriteRefOutputsInDef(nodeData) {
    if (!nodeData) return;
    const names = Array.isArray(nodeData.output_name) ? nodeData.output_name : null;
    const types = Array.isArray(nodeData.output) ? nodeData.output : null;
    if (names && types) {
        const refs = [];
        names.forEach((n, i) => {
            const m = REF_OUT_RE.exec(String(n || ""));
            if (m) refs.push({ n: Number(m[1]), i });
        });
        if (!refs.length) return;                       // already rewritten -- nothing to learn
        refs.sort((a, b) => a.n - b.n);
        REF_BACKEND_SLOTS = refs.map((e) => e.i);
        const first = refs[0].i;
        const drop = new Set(refs.slice(1).map((e) => e.i));
        REFS_UI_INDEX = first - refs.slice(1).filter((e) => e.i < first).length;
        const keep = names.map((_, i) => i).filter((i) => !drop.has(i));
        const pick = (v) => (Array.isArray(v) ? keep.map((i) => v[i]) : v);
        nodeData.output = pick(types);
        nodeData.output_name = pick(names);
        if (Array.isArray(nodeData.output_is_list)) nodeData.output_is_list = pick(nodeData.output_is_list);
        if (Array.isArray(nodeData.output_tooltips)) {
            nodeData.output_tooltips = pick(nodeData.output_tooltips);
            nodeData.output_tooltips[REFS_UI_INDEX] = REFS_OUT_TOOLTIP;
        }
        nodeData.output[REFS_UI_INDEX] = "*";
        nodeData.output_name[REFS_UI_INDEX] = REFS_OUT_NAME;
        return;
    }
    // Older builds expose a frontend `outputs` array instead of the parallel arrays. No index
    // information to learn from there, so the fallback table stands in.
    if (Array.isArray(nodeData.outputs)) {
        const at = nodeData.outputs.findIndex((o) => isRefOutput(o && o.name));
        nodeData.outputs = nodeData.outputs
            .filter((o) => !isRefOutput(o && o.name) && (o && o.name) !== REFS_OUT_NAME);
        const slot = { name: REFS_OUT_NAME, type: "*" };
        if (at >= 0 && at <= nodeData.outputs.length) nodeData.outputs.splice(at, 0, slot);
        else nodeData.outputs.push(slot);
    }
}

function graphLink(graph, linkId) {
    if (!graph || linkId == null) return null;
    for (const links of [graph.links, graph._links]) {
        if (!links) continue;
        if (typeof links.get === "function") {
            const l = links.get(linkId) || links.get(String(linkId));
            if (l) return l;
        }
        const l = links[linkId] || links[String(linkId)];
        if (l) return l;
    }
    return null;
}

function linkTargetId(link) {
    return Number(link && (link.target_id != null ? link.target_id : link.targetId));
}
function linkTargetSlot(link) {
    return Number(link && (link.target_slot != null ? link.target_slot : link.targetSlot)) || 0;
}

// Re-point every outgoing link at the slot its output now occupies. The aliases cover the Vue
// graph adapter and older workflow snapshots; the link's identity is never changed.
function refreshOutputSlots(node) {
    const graph = (node && node.graph) || app.graph;
    if (!graph || !Array.isArray(node && node.outputs)) return;
    node.outputs.forEach((output, index) => {
        if (output && "slot_index" in output) output.slot_index = index;
        const ids = Array.isArray(output && output.links) ? output.links
                  : (!output || output.link == null) ? [] : [output.link];
        for (const id of ids) {
            const link = graphLink(graph, id);
            if (!link) continue;
            link.origin_slot = index;
            if ("originSlot" in link) link.originSlot = index;
            if ("from_slot" in link) link.from_slot = index;
            if ("fromSlot" in link) link.fromSlot = index;
        }
    });
}

// Drop one output AND the links hanging off it. node.removeOutput disconnects for us; the
// fallback covers builds that expose no such method.
function removeOutputAt(node, index) {
    const output = node && node.outputs && node.outputs[index];
    const graph = (node && node.graph) || app.graph;
    const ids = Array.isArray(output && output.links) ? output.links.slice()
              : (!output || output.link == null) ? [] : [output.link];
    if (typeof node.removeOutput !== "function" && graph && graph.removeLink) {
        for (const id of ids) graph.removeLink(id);
    }
    if (typeof node.removeOutput === "function") { node.removeOutput(index); return; }
    if (node.outputs) node.outputs.splice(index, 1);
}

function refsOutputIndex(node) {
    const outs = (node && node.outputs) || [];
    for (let i = 0; i < outs.length; i++) {
        if (outs[i] && String(outs[i].name || "") === REFS_OUT_NAME) return i;
    }
    return -1;
}

// ---- wire order --------------------------------------------------------------------------
// The number on a wire IS its reference number: wire N reads the RETURN_TYPES slot that
// refSlotFor(N-1) names -- ref_N -- which _build_ref_pool() in image_nodes.py fills with
// <Image N>. So the order has to survive a save/load round trip unchanged.
//
// Ordering key: the CONSUMER's own slot order, counted per consumer node. TextEncodeQwenImage21
// lines its references up by the number in the slot name -- sorted(images, key=int(suffix)),
// comfy_extras/nodes_qwen.py:149 -- so the wire on image_1 must carry ref_1, the next one up
// ref_2, and so on, whatever order the wires were drawn in. (Numbering by link.id, i.e. by
// connection order, was the first cut: the moment a consumer's wires were redrawn out of order
// the painted number and the slot the encoder read it from disagreed [screen, 5 Oct].)
// Key inside one consumer: the trailing number of the input name (images.image_3 -> 3), then
// the slot index, then link.id. Every consumer numbers from 1 in its own right, so two encoders
// can each take references 1..N.
// The wires are found from the CONSUMER side -- every input whose link starts at our `refs`
// slot -- because that is what graphToPrompt serializes. Our own outputs[slot].links can miss
// some (seen 5 Oct: two encoder inputs fed from `refs` that the list did not hold, so they went
// out un-renumbered as ref_1 and drew white); the consumer's input.link cannot.
// Returns [{ link, index, targetId, key }] where index 0 = ref_1 and key is the input name.
function orderedRefLinks(node) {
    const graph = (node && node.graph) || app.graph;
    const slot = refsOutputIndex(node);
    if (!graph || slot < 0) return [];
    const ourId = Number(node.id);
    const groups = new Map();
    for (const tnode of graph._nodes || []) {
        (tnode.inputs || []).forEach((tinput, tslot) => {
            if (!tinput || tinput.link == null) return;
            const link = graphLink(graph, tinput.link);
            const origin = linkOrigin(link);
            if (!origin || origin.id !== ourId || origin.slot !== slot) return;
            const m = /(\d+)$/.exec(String(tinput.name || ""));
            const lid = Number(link.id != null ? link.id : tinput.link);
            const entry = { link, targetId: Number(tnode.id), key: String(tinput.name || ""),
                            num: m ? Number(m[1]) : Infinity, tslot,
                            lid: Number.isFinite(lid) ? lid : 0 };
            if (!groups.has(entry.targetId)) groups.set(entry.targetId, []);
            groups.get(entry.targetId).push(entry);
        });
    }
    const out = [];
    for (const list of groups.values()) {
        list.sort((a, b) => (a.num - b.num) || (a.tslot - b.tslot) || (a.lid - b.lid));
        list.forEach((e, index) => out.push({ link: e.link, index, targetId: e.targetId, key: e.key }));
    }
    return out;
}

// ---- rendering ---------------------------------------------------------------------------
// The wires themselves are drawn by LiteGraph; we only stamp the number on top. `link._pos` is
// the link's centre, written by the renderer for every link it just drew (the same field its
// own centre-marker hit test reads), so there is no curve maths here and no second code path to
// keep in sync with the link render mode.
function drawRefLinkNumbers(canvas, ctx) {
    const graph = (canvas && canvas.graph) || app.graph;
    const LG = globalThis.LiteGraph;
    if (!graph || !Array.isArray(graph._nodes)) return;
    if (LG && canvas.links_render_mode === LG.HIDDEN_LINK) return;
    if (((canvas.ds && canvas.ds.scale) || 1) < 0.6) return;
    if (canvas.low_quality) return;
    const fallback = (globalThis.LGraphCanvas && globalThis.LGraphCanvas.link_type_colors
        && globalThis.LGraphCanvas.link_type_colors.IMAGE) || "#64B5F6";
    for (const node of graph._nodes) {
        if (!isPrompterV2(node)) continue;
        const links = orderedRefLinks(node);
        if (!links.length) continue;
        // A wire past the end of the pool is repainted RED along its whole length, and stays.
        // Removing a wire the user drew by hand is not ours to do, and the pool shrinks for
        // ordinary reasons -- a file dropped from the gallery, a set switched, a socket pulled --
        // so the honest move is to show that the wire now points at nothing and let them decide.
        // (With a socket connected the pool may really be longer than anything here can count,
        // because a batch socket eats one number per frame; such a wire reads red until it runs,
        // and the backend blocks the branch only if it truly is empty.)
        // The number marker is NOT recoloured: it says which reference the wire carries, not
        // what state it is in.
        const counted = refPoolInfo(node).size;
        const red = (canvas.connections_width || 3) + 2;
        links.forEach(({ link, index }) => {
            const pos = link._pos;
            if (!pos || !Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) return;
            // link.path is the Path2D the frontend's own renderer built for this link a moment
            // ago -- it strokes that object itself and then parks it on the link, next to _pos.
            // Re-stroking it is pixel-exact for every links_render_mode and leaves no geometry
            // of ours to drift; a couple of px wider so no blue edge shows through underneath.
            // A link routed through a reroute parks its path on the REROUTE instead, and an
            // older frontend may not park one at all: then there is nothing to repaint, and the
            // number marker goes red instead so the wire is still flagged.
            let repainted = false;
            if (index >= counted && link.path) {
                ctx.save();
                try {
                    ctx.lineJoin = "round";
                    ctx.lineCap = "round";
                    ctx.lineWidth = red;
                    ctx.strokeStyle = REF_LINK_ORPHAN;
                    ctx.stroke(link.path);
                    repainted = true;
                } catch (e) { /* not a Path2D on this build -- fall back to the marker */ }
                ctx.restore();
            }
            ctx.save();
            ctx.beginPath();
            ctx.arc(pos[0], pos[1], 7, 0, Math.PI * 2);
            ctx.fillStyle = (index >= counted && !repainted)
                ? REF_LINK_ORPHAN : (link.color || fallback);
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(0,0,0,0.55)";
            ctx.stroke();
            ctx.fillStyle = "#fff";
            ctx.font = "bold 9px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(index + 1), pos[0], pos[1] + 0.5);
            ctx.restore();
        });
    }
}

// ---- global patches -----------------------------------------------------------------------
// canvas.drawConnections and app.graphToPrompt are SHARED. The SatoDive Minimax-H3 pack patches
// both and may load before or after us, so: keep whatever was there, always call it, guard with
// OUR OWN idempotency flag (never theirs), and only ever touch our own wires / our own nodes.
// Either load order ends with two wrappers chained, each delegating to the one underneath.
// The numbers have to be painted AFTER the original ran -- that is when link._pos is fresh.

function patchCanvasForRefLinks() {
    const canvas = app.canvas;
    if (!canvas || typeof canvas.drawConnections !== "function") return false;
    if (canvas.__artfatV2CanvasPatched) return true;
    canvas.__artfatV2CanvasPatched = true;
    const originalDraw = canvas.drawConnections;
    canvas.drawConnections = function artfatV2DrawConnections(ctx) {
        const result = originalDraw ? originalDraw.apply(this, arguments) : undefined;
        try {
            const target = ctx || this.bgctx || this.ctx;
            if (target) drawRefInWires(this, target);
            if (target) drawRefLinkNumbers(this, target);
        } catch (e) {}
        return result;
    };
    return true;
}

// Point each wire at the ref_N slot its number says, e.g.
//   output["30"].inputs["images.image_2"] = ["12", 10]      // slot 10 == ref_2
// The base graphToPrompt has already written every one of these as [ourId, <refs slot>] because
// that is where the link really starts; we only move the slot number. An entry that does not
// look exactly like that (consumer bypassed, rewired by ComfyUI, someone else's patch) is left
// alone, but it still consumes its number so the canvas and the prompt never disagree.
function renumberRefLinks(promptData) {
    const output = promptData && promptData.output;
    if (!output) return;
    const graph = app.graph;
    for (const node of (graph && graph._nodes) || []) {
        if (!isPrompterV2(node)) continue;
        const ourId = String(node.id);
        if (!output[ourId]) continue;            // muted / bypassed / pruned -- leave it alone
        const refsSlot = refsOutputIndex(node);
        if (refsSlot < 0) continue;
        orderedRefLinks(node).forEach(({ index, targetId, key }) => {
            if (index >= REF_OUT_MAX) return;    // only ref_1..ref_N exist
            const targetPrompt = output[String(targetId)];
            if (!targetPrompt || !targetPrompt.inputs) return;
            if (!key) return;
            const existing = targetPrompt.inputs[key];
            if (!Array.isArray(existing) || String(existing[0]) !== ourId
                || Number(existing[1]) !== refsSlot) return;
            const slot = refSlotFor(index);
            if (slot < 0) return;
            targetPrompt.inputs[key] = [ourId, slot];
        });
    }
}

function patchGraphToPromptForRefLinks() {
    if (app.__artfatV2PromptPatched || typeof app.graphToPrompt !== "function") return;
    app.__artfatV2PromptPatched = true;
    const original = app.graphToPrompt;
    app.graphToPrompt = async function artfatV2GraphToPrompt() {
        const promptData = await original.apply(this, arguments);
        try { renumberRefLinks(promptData); }
        catch (e) { console.error("[artfat-llm-v2] ref wire renumbering failed:", e); }
        return promptData;
    };
}

// ---- one visible "ref in" input, many wires ----------------------------------------------
// The mirror of `refs`, done the way SatoDive's `media` input does it (minimax_h3_easy_ui.js,
// MIT). A LiteGraph input holds exactly ONE link, so nine wires cannot really end on one
// socket. Instead: the wire you drop on `ref_in` is caught in onConnectionsChange, its origin
// is written into node.properties, and the real link is taken off again -- the socket is always
// free for the next one. We draw those wires ourselves with their number, and at queue time
// graphToPrompt files wire N onto the backend's optional image_N input.
// (The reason this is fine here and was NOT fine for `refs`: on the output side the consumer's
// autogrow needs a real link to grow its next slot. On the input side we ARE the consumer.)
// Order = the order in the array = the number on the wire = <Image N>, ahead of the gallery.
// Removing one: click its number. The backend keeps image_1/image_2 under their old names, so
// a graph saved with those two wired is migrated on load (onConfigure) without losing a wire.
const REF_IN_NAME = "ref_in";
// What the canvas shows. Labels only: saved graphs wire inputs and outputs BY NAME, so the
// names themselves (ref_in, refs, reference_image) never change.
const REF_IN_LABEL = "refs in";
const REFS_OUT_LABEL = "refs out";
const PERSONA_IN_NAME = "reference_image";
const PERSONA_IN_LABEL = "persona ref";

function applySocketLabels(node) {
    for (const inp of (node && node.inputs) || []) {
        if (inp && inp.name === REF_IN_NAME) inp.label = REF_IN_LABEL;
        if (inp && inp.name === PERSONA_IN_NAME) inp.label = PERSONA_IN_LABEL;
    }
    const i = refsOutputIndex(node);
    if (i >= 0) node.outputs[i].label = REFS_OUT_LABEL;
}
const REF_IN_PROP = "artfat_v2_ref_in_links";
const REF_IN_SOCKET_RE = /^image_(\d+)$/;
const REF_IN_TOOLTIP = "Reference images in. Drop as many wires here as you like (max "
    + REF_MAX_IMAGES + "): each is numbered in the order you connect it and becomes <Image N>, "
    + "ahead of the gallery. Click a wire's number to disconnect it.";

function rewriteRefInputsInDef(nodeData) {
    const input = nodeData && nodeData.input;
    const opt = input && input.optional;
    if (!opt || !opt.image_1) return;                    // already rewritten
    const rebuilt = {};
    for (const [k, v] of Object.entries(opt)) {
        if (REF_IN_SOCKET_RE.test(k)) {
            if (k === "image_1") rebuilt[REF_IN_NAME] = ["IMAGE", { tooltip: REF_IN_TOOLTIP }];
            continue;
        }
        rebuilt[k] = v;
    }
    input.optional = rebuilt;
    const order = nodeData.input_order && nodeData.input_order.optional;
    if (Array.isArray(order)) {
        const out = [];
        for (const k of order) {
            if (!REF_IN_SOCKET_RE.test(k)) out.push(k);
            else if (k === "image_1") out.push(REF_IN_NAME);
        }
        nodeData.input_order.optional = out;
    }
}

function refInLinks(node) {
    if (!node) return [];
    node.properties = node.properties || {};
    if (!Array.isArray(node.properties[REF_IN_PROP])) node.properties[REF_IN_PROP] = [];
    return node.properties[REF_IN_PROP];
}

// Wires whose source node still exists, in wire order. A deleted source simply drops out (and
// the numbers behind it move up), exactly as a deleted file drops out of the gallery.
function liveRefInLinks(node) {
    const graph = (node && node.graph) || app.graph;
    const all = refInLinks(node);
    if (!graph || typeof graph.getNodeById !== "function") return all.slice();
    const live = all.filter((l) => graph.getNodeById(Number(l.source_id)));
    if (live.length !== all.length) node.properties[REF_IN_PROP] = live;
    return live.slice();
}

// The preview a source node already shows on the canvas: Load Image keeps it in node.imgs.
// A frontend-only Reroute in between is walked back to the real producer.
function refInThumbUrl(l) {
    const graph = app.graph;
    if (!l || !graph || typeof graph.getNodeById !== "function") return "";
    let src = graph.getNodeById(Number(l.source_id));
    for (let guard = 0; src && src.isVirtualNode && guard < 32; guard++) {
        const inp = src.inputs && src.inputs[0];
        const o = linkOrigin(inp ? graphLink(graph, inp.link) : null);
        src = o ? graph.getNodeById(o.id) : null;
    }
    const im = src && Array.isArray(src.imgs) ? src.imgs[0] : null;
    return (im && im.src) || "";
}

// Wires vanish behind our back -- a source node deleted, a Load Image switched to another
// file -- and nothing tells the Refs tab. The canvas redraw sees it, so the draw pass compares
// a fingerprint of the wires and their previews and re-renders the gallery when it moved.
function resyncRefInGallery(node) {
    const sig = liveRefInLinks(node)
        .map((l) => l.source_id + ":" + l.source_slot + ":" + refInThumbUrl(l)).join("|");
    if (node._alp2RefInSig === sig) return;
    const first = node._alp2RefInSig === undefined;
    node._alp2RefInSig = sig;
    if (first) return;
    setTimeout(() => { try { if (node._alp2RefsRender) node._alp2RefsRender(); } catch (e) {} }, 0);
}

function refInChanged(node) {
    try { node.setDirtyCanvas(true, true); } catch (e) {}
    try { (node.graph || app.graph).setDirtyCanvas(true, true); } catch (e) {}
    try { (node.graph || app.graph).change && (node.graph || app.graph).change(); } catch (e) {}
    try { if (node._alp2RefsRender) node._alp2RefsRender(); } catch (e) {}
}

function addRefInLink(node, sourceId, sourceSlot) {
    const links = refInLinks(node);
    const id = Number(sourceId), slot = Number(sourceSlot) || 0;
    if (!Number.isFinite(id) || id === Number(node.id)) return false;
    if (links.some((l) => Number(l.source_id) === id && Number(l.source_slot) === slot)) return false;
    if (refPoolInfo(node).size >= REF_MAX_IMAGES) {
        console.warn("[artfat-llm-v2] ref in: the pool (wires + gallery) already holds " + REF_MAX_IMAGES + ".");
        return false;
    }
    links.push({ source_id: id, source_slot: slot });
    refInChanged(node);
    return true;
}

function removeRefInLink(node, index) {
    const links = liveRefInLinks(node);
    if (index < 0 || index >= links.length) return;
    links.splice(index, 1);
    node.properties[REF_IN_PROP] = links;
    refInChanged(node);
}

function linkOrigin(link) {
    if (!link) return null;
    const id = link.origin_id != null ? link.origin_id : (link.originId != null ? link.originId : link.from_id);
    const slot = link.origin_slot != null ? link.origin_slot : (link.originSlot != null ? link.originSlot : link.from_slot);
    return id == null ? null : { id: Number(id), slot: Number(slot) || 0 };
}

// Take a REAL link off the given input and keep it as a numbered wire instead.
function captureRefInLink(node, inputIndex) {
    const input = node && node.inputs && node.inputs[inputIndex];
    if (!input || input.link == null || node.__alp2RefInClearing) return false;
    const graph = node.graph || app.graph;
    const origin = linkOrigin(graphLink(graph, input.link));
    node.__alp2RefInClearing = true;
    try {
        if (typeof node.disconnectInput === "function") node.disconnectInput(inputIndex);
        else if (graph && graph.removeLink) graph.removeLink(input.link);
        if (node.inputs[inputIndex]) node.inputs[inputIndex].link = null;
    } finally {
        node.__alp2RefInClearing = false;
    }
    if (origin) addRefInLink(node, origin.id, origin.slot);
    else refInChanged(node);
    return true;
}

// The visible socket, plus the migration of a graph saved with real image_1..image_N links:
// those become wires 1..N in their N order, then the old inputs go. Idempotent.
function ensureRefInInput(node) {
    if (!node || !Array.isArray(node.inputs)) return;
    const old = [];
    node.inputs.forEach((inp, i) => {
        const m = REF_IN_SOCKET_RE.exec(String((inp && inp.name) || ""));
        if (m) old.push({ i, n: Number(m[1]) });
    });
    if (old.length) {
        const graph = node.graph || app.graph;
        const sorted = old.slice().sort((a, b) => a.n - b.n);
        const origins = sorted.map((o) => node.inputs[o.i].link == null
            ? null : linkOrigin(graphLink(graph, node.inputs[o.i].link)));
        // A wired input whose link is not in the store yet (mid-configure): leave everything
        // for the deferred pass rather than drop that wire.
        if (sorted.some((o, k) => node.inputs[o.i].link != null && !origins[k])) return;
        const migrated = origins.filter(Boolean);
        node.__alp2RefInClearing = true;
        try {
            for (const o of old.slice().sort((a, b) => b.i - a.i)) {
                if (node.inputs[o.i] && node.inputs[o.i].link != null && node.disconnectInput) node.disconnectInput(o.i);
                if (typeof node.removeInput === "function") node.removeInput(o.i);
                else node.inputs.splice(o.i, 1);
            }
        } finally {
            node.__alp2RefInClearing = false;
        }
        for (const m of migrated) addRefInLink(node, m.id, m.slot);
        // Those inputs used to be numbered ahead of the gallery: keep them there.
        if (migrated.length) {
            const jw = W(node, "refs_json");
            let items = [];
            try { items = JSON.parse((jw && jw.value) || "[]"); } catch (e) { items = []; }
            if (jw && Array.isArray(items)) {
                const setOfIt = (it) => { const n = parseInt(it && it.set, 10); return n >= 1 ? n : 1; };
                const sets = [...new Set([1, ...items.map(setOfIt)])];
                const keys = migrated.map((m) => m.id + ":" + (m.slot || 0));
                for (const s of sets) {
                    const at = items.findIndex((it) => setOfIt(it) === s);
                    const add = keys.map((k) => ({ wire: k, set: s }));
                    if (at < 0) items.push(...add); else items.splice(at, 0, ...add);
                }
                jw.value = JSON.stringify(items);
                try { if (jw._domSync) jw._domSync(); } catch (e) {}
            }
        }
    }
    let at = node.inputs.findIndex((x) => x && x.name === REF_IN_NAME);
    if (at < 0 && typeof node.addInput === "function") {
        node.addInput(REF_IN_NAME, "IMAGE", { tooltip: REF_IN_TOOLTIP });
        at = node.inputs.findIndex((x) => x && x.name === REF_IN_NAME);
    }
    if (at >= 0) {
        node.inputs[at].label = REF_IN_LABEL;
        if (node.inputs[at].link != null) captureRefInLink(node, at);
    }
}

function refInInputIndex(node) {
    return ((node && node.inputs) || []).findIndex((x) => x && x.name === REF_IN_NAME);
}

function nodeOutputPos(node, slot) {
    try {
        if (typeof node.getOutputPos === "function") {
            const p = node.getOutputPos(slot);
            if (p && Number.isFinite(p[0])) return [p[0], p[1]];
        }
        if (typeof node.getConnectionPos === "function") {
            const out = [0, 0];
            const p = node.getConnectionPos(false, slot, out) || out;
            if (Number.isFinite(p[0])) return [p[0], p[1]];
        }
    } catch (e) {}
    return [node.pos[0] + node.size[0], node.pos[1] + 14 + slot * 20];
}

function nodeInputPos(node, slot) {
    try {
        if (typeof node.getInputPos === "function") {
            const p = node.getInputPos(slot);
            if (p && Number.isFinite(p[0])) return [p[0], p[1]];
        }
        if (typeof node.getConnectionPos === "function") {
            const out = [0, 0];
            const p = node.getConnectionPos(true, slot, out) || out;
            if (Number.isFinite(p[0])) return [p[0], p[1]];
        }
    } catch (e) {}
    return [node.pos[0], node.pos[1] + 14 + slot * 20];
}

function bezierMid(a, b) {
    // t = 0.5 on the same curve drawRefInWires strokes (control points +-80 px horizontally).
    const c1 = [a[0] + 80, a[1]], c2 = [b[0] - 80, b[1]];
    return [0.125 * a[0] + 0.375 * c1[0] + 0.375 * c2[0] + 0.125 * b[0],
            0.125 * a[1] + 0.375 * c1[1] + 0.375 * c2[1] + 0.125 * b[1]];
}

// Every drawn wire with its geometry, for drawing and for the click test alike.
function refInWireGeometry(graph) {
    const out = [];
    for (const node of (graph && graph._nodes) || []) {
        if (!isPrompterV2(node)) continue;
        const at = refInInputIndex(node);
        if (at < 0) continue;
        const end = nodeInputPos(node, at);
        const pool = refPoolInfo(node);
        liveRefInLinks(node).forEach((l) => {
            const index = refInPoolIndex(pool, l);
            const src = graph.getNodeById(Number(l.source_id));
            if (!src) return;
            const start = nodeOutputPos(src, Number(l.source_slot) || 0);
            const output = src.outputs && src.outputs[Number(l.source_slot) || 0];
            out.push({ node, src, index, start, end, mid: bezierMid(start, end),
                       type: (output && output.type) || "IMAGE" });
        });
    }
    return out;
}

function drawRefInWires(canvas, ctx) {
    const graph = (canvas && canvas.graph) || app.graph;
    const LG = globalThis.LiteGraph;
    if (!graph || (LG && canvas.links_render_mode === LG.HIDDEN_LINK)) return;
    const colors = (globalThis.LGraphCanvas && globalThis.LGraphCanvas.link_type_colors) || {};
    const width = canvas.connections_width || 3;
    const showNumbers = ((canvas.ds && canvas.ds.scale) || 1) >= 0.6 && !canvas.low_quality;
    for (const node of graph._nodes || []) {
        if (isPrompterV2(node)) { try { resyncRefInGallery(node); } catch (e) {} }
    }
    for (const w of refInWireGeometry(graph)) {
        const color = colors[w.type] || colors.IMAGE || "#64B5F6";
        ctx.save();
        ctx.lineJoin = "round";
        const path = () => {
            ctx.beginPath();
            ctx.moveTo(w.start[0], w.start[1]);
            ctx.bezierCurveTo(w.start[0] + 80, w.start[1], w.end[0] - 80, w.end[1], w.end[0], w.end[1]);
        };
        if (canvas.render_connections_border !== false && !canvas.low_quality) {
            path(); ctx.lineWidth = width + 4; ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.stroke();
        }
        path(); ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
        if (showNumbers) {
            ctx.beginPath();
            ctx.arc(w.mid[0], w.mid[1], 7, 0, Math.PI * 2);
            ctx.fillStyle = w.index >= REF_MAX_IMAGES ? REF_LINK_ORPHAN : color;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(0,0,0,0.55)";
            ctx.stroke();
            ctx.fillStyle = "#fff";
            ctx.font = "bold 9px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(w.index + 1), w.mid[0], w.mid[1] + 0.5);
        }
        ctx.restore();
    }
}

// Canvas point under a pointer event -- the DragAndScale mapping LiteGraph itself uses.
function canvasPointOf(canvas, e) {
    const rect = canvas.canvas && canvas.canvas.getBoundingClientRect();
    const scale = (canvas.ds && canvas.ds.scale) || 1;
    const off = (canvas.ds && canvas.ds.offset) || [0, 0];
    if (!rect) return null;
    return [(e.clientX - rect.left) / scale - off[0], (e.clientY - rect.top) / scale - off[1]];
}

function patchCanvasForRefInWires() {
    const canvas = app.canvas;
    if (!canvas || !canvas.canvas || canvas.__artfatV2RefInPatched) return;
    canvas.__artfatV2RefInPatched = true;
    canvas.canvas.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        if (canvas.linkConnector && canvas.linkConnector.isConnecting) return;
        const p = canvasPointOf(canvas, e);
        if (!p) return;
        const scale = (canvas.ds && canvas.ds.scale) || 1;
        let hit = null, best = 10 / Math.min(scale, 1);
        for (const w of refInWireGeometry(canvas.graph || app.graph)) {
            const d = Math.hypot(p[0] - w.mid[0], p[1] - w.mid[1]);
            if (d <= best) { best = d; hit = w; }
        }
        if (!hit) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const LG = globalThis.LiteGraph;
        const remove = () => removeRefInLink(hit.node, hit.index);
        if (LG && LG.ContextMenu) {
            new LG.ContextMenu([{ content: "Disconnect refs in " + (hit.index + 1), callback: remove }],
                               { event: e });
        } else {
            remove();
        }
    }, true);
}

// Wire N -> image_N, pointed at the real producer (a frontend-only Reroute in between is
// walked back). A source that is not in the prompt (muted / bypassed) is skipped; the backend
// compacts the pool, so the numbers behind it move up, the same as a deleted source.
function resolvePromptOrigin(graph, output, id, slot) {
    let node = graph.getNodeById(Number(id));
    let s = Number(slot) || 0;
    for (let guard = 0; node && node.isVirtualNode && guard < 32; guard++) {
        const inp = node.inputs && node.inputs[0];
        const o = linkOrigin(inp ? graphLink(graph, inp.link) : null);
        if (!o) return null;
        node = graph.getNodeById(o.id);
        s = o.slot;
    }
    if (!node || !output[String(node.id)]) return null;
    return [String(node.id), s];
}

function fillRefInInputs(promptData) {
    const output = promptData && promptData.output;
    const graph = app.graph;
    if (!output || !graph) return;
    for (const node of graph._nodes || []) {
        if (!isPrompterV2(node)) continue;
        const p = output[String(node.id)];
        if (!p || !p.inputs) continue;
        delete p.inputs[REF_IN_NAME];
        for (let i = 1; i <= REF_MAX_IMAGES; i++) delete p.inputs["image_" + i];
        const socketOf = new Map();
        liveRefInLinks(node).forEach((l, index) => {
            if (index >= REF_MAX_IMAGES) return;
            const origin = resolvePromptOrigin(graph, output, l.source_id, l.source_slot);
            if (origin) p.inputs["image_" + (index + 1)] = origin;
            socketOf.set(wireKey(l), index + 1);
        });
        // The order lives in refs_json as {wire: key} entries; the backend wants the image_k
        // each of those wires was just filed onto.
        if (typeof p.inputs.refs_json === "string") {
            let items = null;
            try { items = JSON.parse(p.inputs.refs_json || "[]"); } catch (e) { items = null; }
            if (Array.isArray(items)) {
                const out = [];
                for (const it of items) {
                    if (it && it.wire != null) {
                        const k = socketOf.get(String(it.wire));
                        if (k) out.push({ socket: k, set: it.set });
                    } else {
                        out.push(it);
                    }
                }
                p.inputs.refs_json = JSON.stringify(out);
            }
        }
    }
}

function patchGraphToPromptForRefIn() {
    if (app.__artfatV2RefInPromptPatched || typeof app.graphToPrompt !== "function") return;
    app.__artfatV2RefInPromptPatched = true;
    const original = app.graphToPrompt;
    app.graphToPrompt = async function artfatV2GraphToPromptRefIn() {
        const promptData = await original.apply(this, arguments);
        try { fillRefInInputs(promptData); }
        catch (e) { console.error("[artfat-llm-v2] ref in wiring failed:", e); }
        return promptData;
    };
}

// ---- per-node setup -----------------------------------------------------------------------

function firstFreeInputSlot(targetNode, preferredName, base) {
    const inputs = (targetNode && targetNode.inputs) || [];
    const free = (i) => inputs[i] && inputs[i].link == null;
    for (let i = 0; i < inputs.length; i++) {
        if (String(inputs[i].name || "") === preferredName && free(i)) return i;
    }
    if (base) {
        const re = new RegExp("^" + base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "_\\d+$");
        for (let i = 0; i < inputs.length; i++) {
            if (re.test(String(inputs[i].name || "")) && free(i)) return i;
        }
    }
    return -1;
}

// Exactly one `refs` output after the nine fixed ones, plus the migration of a graph saved by
// an earlier build. Migration MOVES real links (it never deletes them): the ref_N wires are
// re-drawn from the single `refs` slot in ref_N order, so the new link ids come out ascending
// and the numbering matches what the old graph meant. Gaps cannot survive -- ref_1 + ref_3
// comes back as wires 1 and 2 -- because the wire's position is the number now.
function ensureRefsOutput(node) {
    if (!node) return false;
    if (!Array.isArray(node.outputs)) node.outputs = [];
    const graph = node.graph || app.graph;
    let changed = false;
    const pending = [];   // { rank, target_id, target_name, target_base, target_slot }

    // (a) real ref_N outputs from the released build
    const legacy = [];
    node.outputs.forEach((o, i) => {
        const m = o && REF_OUT_RE.exec(String(o.name || ""));
        if (m) legacy.push({ index: i, n: Number(m[1]), output: o });
    });
    if (legacy.length) {
        legacy.slice().sort((a, b) => a.n - b.n).forEach((entry) => {
            const o = entry.output;
            const ids = Array.isArray(o.links) ? o.links.slice() : (o.link == null ? [] : [o.link]);
            for (const id of ids) {
                const l = graphLink(graph, id);
                if (!l) continue;
                const tid = linkTargetId(l);
                const tslot = linkTargetSlot(l);
                const tnode = graph && graph.getNodeById ? graph.getNodeById(tid) : null;
                const input = tnode && tnode.inputs ? tnode.inputs[tslot] : null;
                if (!input) continue;
                const name = String(input.name || "");
                pending.push({ rank: entry.n, target_id: tid, target_name: name,
                               target_base: (name.match(/^(.+)_\d+$/) || [])[1] || "",
                               target_slot: tslot });
            }
        });
        legacy.slice().sort((a, b) => b.index - a.index).forEach((e) => removeOutputAt(node, e.index));
        changed = true;
    }

    // (b) leftovers from the abandoned virtual-link cut, if a graph was saved while it was live
    const stale = node.properties && node.properties[LEGACY_LINKS_PROP];
    if (Array.isArray(stale) && stale.length) {
        stale.forEach((l, i) => {
            const tid = Number(l && l.target_id);
            if (!Number.isFinite(tid)) return;
            const name = String((l && l.target_input) || "");
            pending.push({ rank: Number(l && l.order) || (i + 1), target_id: tid, target_name: name,
                           target_base: String((l && l.target_base) || ""), target_slot: -1 });
        });
    }
    if (node.properties && LEGACY_LINKS_PROP in node.properties) {
        delete node.properties[LEGACY_LINKS_PROP];
        changed = true;
    }

    // (c) exactly one `refs` output, at the index ref_1 occupies in the definition
    const seats = [];
    node.outputs.forEach((o, i) => { if (o && String(o.name || "") === REFS_OUT_NAME) seats.push(i); });
    const want = Math.min(refsUiIndex(), Math.max(0, node.outputs.length - seats.length));
    if (!seats.length) {
        // "*" on purpose: TextEncodeQwenImage21's image slot is a strict IMAGE autogrow template
        // and the frontend only lets a wildcard output into it. See image_nodes.py.
        if (typeof node.addOutput === "function") {
            node.addOutput(REFS_OUT_NAME, "*");
            node.outputs.splice(want, 0, node.outputs.pop());
        } else {
            node.outputs.splice(want, 0, { name: REFS_OUT_NAME, type: "*", links: null });
        }
        changed = true;
    } else {
        seats.slice(1).reverse().forEach((i) => { removeOutputAt(node, i); changed = true; });
        const at = seats[0];
        const keep = node.outputs[at];
        if (keep && keep.type !== "*") { keep.type = "*"; changed = true; }
        if (keep && at !== want) {
            node.outputs.splice(at, 1);
            node.outputs.splice(want, 0, keep);
            // Only reachable from a graph saved before the output order changed. Its other
            // output wires point at slots that have since moved, and nothing here can guess
            // which -- say so instead of letting it look fine.
            console.warn("[artfat-llm-v2] `refs` moved from output " + at + " to " + want
                + ": this graph predates the output reorder, re-check the other output wires");
            changed = true;
        }
    }

    // (d) re-draw the migrated wires, in rank order, so the new link ids ascend with the number
    if (pending.length && typeof node.connect === "function") {
        const refsSlot = refsOutputIndex(node);
        let dropped = 0;
        pending.sort((a, b) => a.rank - b.rank).forEach((p) => {
            const tnode = graph && graph.getNodeById ? graph.getNodeById(p.target_id) : null;
            if (!tnode || refsSlot < 0) { dropped++; return; }
            let slot = p.target_slot;
            if (slot < 0 || !tnode.inputs || !tnode.inputs[slot] || tnode.inputs[slot].link != null) {
                slot = firstFreeInputSlot(tnode, p.target_name, p.target_base);
            }
            if (slot < 0) { dropped++; return; }
            try { node.connect(refsSlot, tnode, slot); } catch (e) { dropped++; }
        });
        console.info("[artfat-llm-v2] migrated " + (pending.length - dropped) + "/" + pending.length
            + " ref wire(s) onto the single `refs` output"
            + (dropped ? " -- " + dropped + " could not be re-attached, re-drag them" : ""));
        changed = true;
    }

    if (changed) {
        refreshOutputSlots(node);
        try {
            const want = node.computeSize();
            if (want && node.size && want[1] > node.size[1]) node.setSize([node.size[0], want[1]]);
        } catch (e) {}
        if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
        if (graph && graph.setDirtyCanvas) graph.setDirtyCanvas(true, true);
    }
    return changed;
}

async function uploadRefFile(f) {
    const body = new FormData();
    body.append("image", f); body.append("overwrite", "false");
    const resp = await api.fetchApi("/upload/image", { method: "POST", body });
    if (resp.status !== 200) return null;
    const d = await resp.json();
    return d.subfolder ? d.subfolder + "/" + d.name : d.name;
}
function refsGallery(node) {
    const w = W(node, "refs_json");
    const wrap = document.createElement("div");
    if (!w) { wrap.textContent = "(refs_json missing — restart ComfyUI)"; return wrap; }
    let items = [];
    try { items = JSON.parse(w.value || "[]"); } catch (e) { items = []; }
    if (!Array.isArray(items)) items = [];

    // Reference sets. A set is a whole alternate pool, not a filtered view of one: swap the
    // pool and the same brief renders a different location or wardrobe. Entries without a set
    // belong to set 1, which is why a gallery that predates sets behaves exactly as it did.
    const MAX_SETS = 100;
    const setOf = (it) => {
        const n = parseInt(it && it.set, 10);
        return n >= 1 && n <= MAX_SETS ? n : 1;
    };
    let activeSet = 1;
    const primaryW = W(node, "primary_set");
    if (primaryW) activeSet = parseInt(primaryW.value, 10) || 1;
    // Sets created but still empty. A set otherwise exists only through the references filed
    // under it, so a new empty one would vanish the moment you looked at another tab. Not
    // persisted: an empty set carries nothing, so losing it on reload costs nothing.
    const declared = new Set();
    const setsUsed = () => {
        const found = new Set([1, activeSet, ...declared]);
        items.forEach((it) => found.add(setOf(it)));
        return [...found].sort((a, b) => a - b);
    };

    const tabs = document.createElement("div");
    tabs.className = "addrow";
    // One row that scrolls sideways: wrapping would push the gallery down every time a set is
    // added, and a tab that silently moved to a second line reads as a tab that vanished.
    tabs.style.cssText = "margin-bottom:6px;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;" +
                         "padding-bottom:3px;scrollbar-width:thin;";

    const counter = document.createElement("div");
    counter.className = "lbl"; counter.style.marginBottom = "6px";
    const grid = document.createElement("div");
    grid.className = "refgrid";
    // Set order first. Order WITHIN a set IS the <Image N> numbering, and Array.sort is stable,
    // so grouping by set keeps each pool's numbering from shifting when another pool grows.
    const regroup = () => { items.sort((a, b) => setOf(a) - setOf(b)); };
    const save = () => { regroup(); w.value = JSON.stringify(items); node.setDirtyCanvas(true, true); };
    const countOf = () => items.filter((it) => setOf(it) === activeSet).length;
    // One {wire} entry per live `ref in` wire in every set, dead ones dropped. A new wire is
    // appended, so it takes the next number and nothing already numbered moves.
    const syncWireEntries = () => {
        const keys = liveRefInLinks(node).map(wireKey);
        const live = new Set(keys);
        let changed = false;
        for (let k = items.length - 1; k >= 0; k--) {
            if (items[k] && items[k].wire != null && !live.has(String(items[k].wire))) {
                items.splice(k, 1); changed = true;
            }
        }
        for (const s of setsUsed()) {
            const have = new Set(items.filter((it) => setOf(it) === s && it.wire != null)
                                      .map((it) => String(it.wire)));
            for (const k of keys) {
                if (!have.has(k)) { items.push({ wire: k, set: s }); changed = true; }
            }
        }
        if (changed) { regroup(); w.value = JSON.stringify(items); }
    };
    let dragIdx = null; // index of the cell being dragged to reorder

    const setPrimary = (n) => {
        if (!primaryW) return;
        primaryW.value = n;
        if (primaryW.callback) primaryW.callback(n);
    };

    const render = () => {
        syncWireEntries();
        regroup();
        // `ref in` wires are entries of the set like files, numbered in the same sequence. The
        // rule lives in refPoolInfo(), which the "@" picker and the wire numbers read as well.
        const poolNow = refPoolInfo(node);
        const sockOff = poolNow.socketLinks.length;     // for the counter line only
        const wireByKey = new Map(poolNow.socketLinks.map((l) => [wireKey(l), l]));
        counter.textContent = "set " + activeSet + " — images " + countOf() + "/" + REF_MAX_IMAGES +
            (sockOff ? "  ·  " + sockOff + " from socket" + (sockOff > 1 ? "s" : "") : "") +
            (setsUsed().length > 1 ? "   (only the starred set reaches the writer)" : "");
        while (grid.firstChild) grid.removeChild(grid.firstChild);
        let ci = 0;         // running <Image N>, wires included
        let filePos = 0;    // position among THIS set's entries -- what the # picker moves

        // Tab strip: one per set in use, then the two ways to make another. Copy is the common
        // case — the cast carries over and only the surroundings change — so a new set starts as
        // a duplicate you prune, not an empty grid you refill.
        while (tabs.firstChild) tabs.removeChild(tabs.firstChild);
        const used = setsUsed();
        const primary = primaryW ? (parseInt(primaryW.value, 10) || 1) : 1;

        // Dragging a tab moves the whole set and renumbers to close the gap, because the number
        // IS the identity: set 2 must keep meaning the set the user thinks of as second.
        const moveSet = (from, to) => {
            if (from === to) return;
            const order = setsUsed();
            const at = order.indexOf(from);
            if (at < 0) return;
            order.splice(at, 1);
            order.splice(order.indexOf(to) + (to > from ? 1 : 0), 0, from);
            const remap = new Map();
            order.forEach((old, i) => remap.set(old, i + 1));
            items.forEach((it) => { it.set = remap.get(setOf(it)) || setOf(it); });
            const moved = [...declared].map((d) => remap.get(d) || d);
            declared.clear();
            moved.forEach((d) => declared.add(d));
            activeSet = remap.get(activeSet) || activeSet;
            const p = remap.get(primary);
            if (p) setPrimary(p);
            save();
            render();
        };
        let dragSet = null;
        used.forEach((n) => {
            const t = document.createElement("div");
            t.className = "addbtn";
            // Fixed width, no stretching: with flex:1 every tab resizes whenever a set is added
            // or removed, and the one you were aiming at moves out from under the cursor.
            t.style.cssText = "flex:none;white-space:nowrap;padding:8px 12px;display:flex;" +
                              "align-items:center;font-size:12px;";
            t.draggable = true;
            t.addEventListener("dragstart", (e) => {
                dragSet = n;
                t.style.opacity = ".4";
                e.dataTransfer.effectAllowed = "move";
                try { e.dataTransfer.setData("text/plain", "set"); } catch (_) {}
            });
            t.addEventListener("dragend", () => { dragSet = null; t.style.opacity = ""; });
            t.addEventListener("dragover", (e) => {
                if (dragSet === null || dragSet === n) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                t.style.borderColor = "var(--acc)";
            });
            t.addEventListener("dragleave", () => { if (n !== activeSet) t.style.borderColor = ""; });
            t.addEventListener("drop", (e) => {
                if (dragSet === null || dragSet === n) return;
                e.preventDefault();
                e.stopPropagation();
                const from = dragSet;
                dragSet = null;
                moveSet(from, n);
            });
            const star = document.createElement("span");
            star.textContent = n === primary ? "★ " : "☆ ";
            star.style.cursor = "pointer";
            star.style.fontSize = "13px";
            star.style.color = n === primary ? "var(--acc)" : "var(--mut)";
            star.title = n === primary
                ? "this set is the pool the writer sees"
                : "make set " + n + " the one the writer works from";
            t.appendChild(star);
            const count = items.filter((x) => setOf(x) === n).length;
            t.appendChild(document.createTextNode("set " + n + " (" + count + ")"));
            // Set 1 has no cross: it is where entries without a set belong, so there is nowhere
            // to send its contents. The refs themselves stay uploaded; only the grouping goes.
            if (n !== 1) {
                const x = document.createElement("span");
                x.textContent = "✕";
                // Pushed to the far edge with a gap: right after the label it is one slipped
                // finger away from wiping a set.
                x.style.cssText = "margin-left:14px;padding:0 2px;color:var(--mut);" +
                                  "cursor:pointer;font-size:12px;opacity:.55;";
                x.title = "remove set " + n + (count ? " and its " + count + " reference(s)" : "");
                x.addEventListener("mouseenter", () => { x.style.opacity = "1"; x.style.color = "#ef6b6b"; });
                x.addEventListener("mouseleave", () => { x.style.opacity = ".55"; x.style.color = "var(--mut)"; });
                x.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (count && !confirm("Remove set " + n + " and its " + count +
                                          " reference(s) from the gallery?")) return;
                    for (let k = items.length - 1; k >= 0; k--) {
                        if (setOf(items[k]) === n) items.splice(k, 1);
                    }
                    const shifted = [...declared].filter((d) => d !== n).map((d) => (d > n ? d - 1 : d));
                    declared.clear();
                    shifted.forEach((d) => declared.add(d));
                    // Later sets close the gap, so numbering stays 1,2,3 with no holes.
                    items.forEach((it) => { if (setOf(it) > n) it.set = setOf(it) - 1; });
                    if (activeSet >= n) activeSet = Math.max(1, activeSet - 1);
                    if (primaryW && (parseInt(primaryW.value, 10) || 1) >= n) {
                        setPrimary(Math.max(1, (parseInt(primaryW.value, 10) || 1) - 1));
                    }
                    save(); render();
                });
                t.appendChild(x);
            } else {
                // Set 1 keeps no cross but keeps its width, or the row reads as ragged.
                const pad = document.createElement("span");
                pad.textContent = "✕";
                pad.style.cssText = "margin-left:14px;padding:0 2px;font-size:12px;" +
                                    "visibility:hidden;pointer-events:none;";
                t.appendChild(pad);
            }
            if (n === activeSet) { t.style.borderColor = "var(--acc)"; t.style.color = "var(--acc)"; }
            // Opening a set is also choosing it: one action instead of two, and the star can
            // never end up on a set you are not looking at.
            t.addEventListener("click", () => { activeSet = n; setPrimary(n); renderAndRepaint(); });
            tabs.appendChild(t);
        });
        if (used.length < MAX_SETS) {
            const free = [...Array(MAX_SETS).keys()].map((k) => k + 1).find((n) => !used.includes(n));
            const copy = document.createElement("div");
            copy.className = "addbtn";
            copy.style.cssText = "flex:none;white-space:nowrap;padding:8px 12px;font-size:12px;";
            copy.textContent = "＋ set (copy)";
            copy.title = "Start set " + free + " as a duplicate of set " + activeSet +
                         ", then remove what this shot does not need";
            copy.addEventListener("click", () => {
                items.filter((x) => setOf(x) === activeSet)
                     .map((x) => Object.assign({}, x, { set: free }))
                     .forEach((x) => items.push(x));
                activeSet = free; declared.add(free); setPrimary(free); save(); renderAndRepaint();
            });
            tabs.appendChild(copy);
            const blank = document.createElement("div");
            blank.className = "addbtn";
            blank.style.cssText = "flex:none;white-space:nowrap;padding:8px 12px;font-size:12px;";
            blank.textContent = "＋ set (new)";
            blank.title = "Add set " + free + ", empty.";
            blank.addEventListener("click", () => {
                activeSet = free; declared.add(free); setPrimary(free); renderAndRepaint();
            });
            tabs.appendChild(blank);
        }

        const markBad = (cell, it, reason) => {
            it.invalid = reason; cell.classList.add("bad");
            if (!cell.querySelector(".refbad")) {
                const bb = document.createElement("span");
                bb.className = "refbad"; bb.textContent = "⚠ " + reason; bb.title = reason;
                cell.appendChild(bb);
            }
        };
        items.forEach((it, i) => {
            // Other sets stay in the array (so drag indices and numbering stay honest) but are
            // not drawn: one pool on screen at a time is the whole point of a set.
            if (setOf(it) !== activeSet) return;
            const isWire = it.wire != null;
            const wireLink = isWire ? wireByKey.get(String(it.wire)) : null;
            if (isWire && !wireLink) return;   // dropped by syncWireEntries on the next pass
            const cell = document.createElement("div");
            cell.className = isWire ? "refcell sockcell" : "refcell";
            // A wire's card shows the source's own canvas preview when it has one (Load Image
            // always does; most other nodes only after a run that shows an image), else a plug.
            const url = isWire ? refInThumbUrl(wireLink) : imageView(it.file);
            if (url) {
                const img = document.createElement("img");
                img.className = "refthumb"; img.src = url;
                img.style.cursor = "zoom-in"; img.title = "click to enlarge";
                img.addEventListener("click", () => openLightbox(url));
                if (!isWire) img.addEventListener("error", () => markBad(cell, it, "unreadable"));
                cell.appendChild(img);
            } else {
                const icon = document.createElement("div");
                icon.className = "refsockthumb";
                icon.textContent = "🔌";
                cell.appendChild(icon);
            }
            if (isWire) {
                cell.title = "connected to refs in — ✕ here or a click on the wire's number on the canvas disconnects it";
            }
            const typePos = ++filePos;
            const badge = document.createElement("span");
            badge.className = "refbadge";
            badge.textContent = "Image " + (++ci);
            badge.draggable = true; badge.style.cursor = "move"; badge.title = "drag to reorder";
            badge.addEventListener("dragstart", (e) => {
                dragIdx = i; e.dataTransfer.effectAllowed = "move";
                try { e.dataTransfer.setData("text/plain", "ref"); } catch (_) {}
            });
            badge.addEventListener("dragend", () => { dragIdx = null; });
            cell.appendChild(badge);
            cell.addEventListener("dragover", (e) => { if (dragIdx !== null) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } });
            cell.addEventListener("drop", (e) => {
                if (dragIdx === null) return;
                e.preventDefault(); e.stopPropagation();
                const from = dragIdx, to = i; dragIdx = null;
                if (from !== to) { items.splice(to, 0, items.splice(from, 1)[0]); save(); renderAndRepaint(); }
            });
            const nm = document.createElement("div");
            nm.className = "refname";
            if (isWire) {
                // The cross disconnects the wire itself (it belongs to the node, so it leaves
                // every set). Role and label come from nothing a wire carries, so they stay inert.
                const rm = document.createElement("span");
                rm.className = "refrm"; rm.textContent = "✕";
                rm.title = "disconnect this wire from refs in (all sets)";
                rm.addEventListener("click", () => {
                    const at = liveRefInLinks(node).findIndex((l) => wireKey(l) === String(it.wire));
                    if (at >= 0) removeRefInLink(node, at);
                });
                cell.appendChild(rm);
                nm.textContent = "connected input";
                cell.appendChild(nm);
                const mk = (tag, cls, txt) => {
                    const el = document.createElement(tag);
                    el.className = cls;
                    el.disabled = true;
                    if (tag === "select") {
                        const o = document.createElement("option");
                        o.textContent = txt;
                        el.appendChild(o);
                    } else {
                        el.type = "text";
                        el.placeholder = txt;
                    }
                    cell.appendChild(el);
                };
                mk("select", "refrole", "(from socket)");
                mk("input", "refnote", "—");
            } else {
                const rm = document.createElement("span");
                rm.className = "refrm"; rm.textContent = "✕"; rm.title = "remove";
                rm.addEventListener("click", () => { items.splice(i, 1); save(); render(); });
                cell.appendChild(rm);
                nm.textContent = String(it.file).split("/").pop();
                cell.appendChild(nm);
            }
            if (!isWire) {
                const role = document.createElement("select");
                role.className = "refrole";
                for (const r of REF_ROLES) {
                    const o = document.createElement("option");
                    o.value = r; o.textContent = r; role.appendChild(o);
                }
                role.value = REF_ROLES.includes(it.role) ? it.role : "(auto)";
                role.addEventListener("change", () => { it.role = role.value; save(); });
                cell.appendChild(role);
                if (it.invalid) markBad(cell, it, it.invalid);
                // Optional custom label — overrides the role dropdown in the [REFERENCES] block.
                const note = document.createElement("input");
                note.type = "text"; note.className = "refnote";
                note.placeholder = "custom label (optional)";
                note.value = it.note || "";
                note.addEventListener("input", () => { it.note = note.value; save(); });
                cell.appendChild(note);
            }
            // Reference number picker — reorders this ref within the active set.
            const num = document.createElement("select");
            num.className = "refnum"; num.title = "reference number";
            const total = countOf();
            for (let k = 1; k <= total; k++) {
                const o = document.createElement("option");
                o.value = String(k); o.textContent = "# " + k;
                num.appendChild(o);
            }
            num.value = String(typePos);
            num.addEventListener("change", () => {
                const want = parseInt(num.value, 10) - 1;
                const slots = [], seq = [];
                items.forEach((x, gi) => { if (setOf(x) === activeSet) { slots.push(gi); seq.push(x); } });
                const cur = seq.indexOf(it);
                if (cur >= 0 && want >= 0 && want < seq.length && want !== cur) {
                    seq.splice(cur, 1);
                    seq.splice(want, 0, it);
                    slots.forEach((gi, k) => { items[gi] = seq[k]; });
                }
                save(); renderAndRepaint();
            });
            cell.appendChild(num);
            grid.appendChild(cell);
        });
    };

    const addFiles = async (fileList) => {
        for (const f of Array.from(fileList || [])) {
            // One ceiling for gallery + ref in wires together.
            if (refPoolInfo(node).size >= REF_MAX_IMAGES) continue;
            try {
                const name = await uploadRefFile(f);
                if (name) items.push({ file: name, role: "(auto)", set: activeSet });
            } catch (e) { console.error("[artfat-llm-v2] ref upload failed", e); }
        }
        save(); render();
    };

    const addrow = document.createElement("div");
    addrow.className = "addrow";
    const addBtn = document.createElement("div");
    addBtn.className = "addbtn"; addBtn.textContent = "＋ image";
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*"; inp.multiple = true; inp.style.display = "none";
    addBtn.addEventListener("click", () => inp.click());
    inp.addEventListener("change", () => { addFiles(inp.files); inp.value = ""; });
    addBtn.appendChild(inp);
    addrow.appendChild(addBtn);

    // drag & drop anywhere on the gallery
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
    wrap.addEventListener("dragover", (e) => { if (hasFiles(e)) { e.preventDefault(); wrap.classList.add("refdrop"); } });
    wrap.addEventListener("dragleave", (e) => { if (e.target === wrap) wrap.classList.remove("refdrop"); });
    wrap.addEventListener("drop", (e) => {
        wrap.classList.remove("refdrop");
        if (hasFiles(e)) { e.preventDefault(); addFiles(e.dataTransfer.files); }
    });

    w._domSync = () => {
        try { const s = JSON.parse(w.value || "[]"); items = Array.isArray(s) ? s : []; } catch (e) {}
        if (primaryW) activeSet = parseInt(primaryW.value, 10) || 1;
        renderAndRepaint();
    };
    // Anything that redraws the gallery may have changed the pool size, and the pool size is
    // what decides which ref wires are drawn red. Those live on the background layer, which only
    // repaints when it is marked dirty -- switching sets is the path that would otherwise leave
    // a stale colour on the canvas. (save() already dirties; this covers the paths that do not.)
    // A declaration, not a const: w._domSync above closes over it before this line runs.
    function renderAndRepaint() { render(); node.setDirtyCanvas(true, true); }
    wrap.appendChild(tabs); wrap.appendChild(counter); wrap.appendChild(grid); wrap.appendChild(addrow);
    // Plugging or pulling a wire on image_1/image_2 changes the numbering, and nothing in the
    // DOM hears about that; onConnectionsChange calls this. Not a widget, just a hook.
    node._alp2RefsRender = renderAndRepaint;
    render();
    return wrap;
}

function field(label, control, opts) {
    const f = document.createElement("div");
    f.className = "fld" + (opts && opts.full ? " full" : "");
    const l = document.createElement("div");
    l.className = "lbl" + (opts && opts.nsfw ? " n" : "");
    l.textContent = label;
    f.appendChild(l);
    f.appendChild(control);
    return f;
}

function buildUI(node) {
    injectCSS();
    const root = document.createElement("div");
    root.className = "alp2";
    let poseEl = null;          // filled when the Shot pane builds its pose select
    let applyCaptureMode = () => {};

    // --- header: title / capture mode / toggles / clear buttons ---
    const hd = document.createElement("div");
    hd.className = "hd";
    const title = document.createElement("b");
    title.textContent = "LLM Prompter v2";
    hd.appendChild(title);
    hd.appendChild(segFor(node, "capture_mode", null, () => applyCaptureMode()));
    hd.appendChild(swFor(node, "llm_enabled", "LLM"));
    hd.appendChild(swFor(node, "force_offload", "unload"));
    hd.appendChild(swFor(node, "keep_prompt", "keep"));

    // --- clear buttons. Two scopes on purpose: the daily one wipes only the shot content,
    // identity is a separate (confirmed) click because a persona description costs an LLM pass.
    const setW = (name, val) => {
        const w = W(node, name);
        if (!w) return;
        w.value = val;
        if (w.callback) { try { w.callback(val, app.canvas, node); } catch (e) {} }
    };
    const setNeutral = (name, prefer) => {
        const w = W(node, name);
        if (!w) return;
        const vals = (w.options && w.options.values) || [];
        const hit = prefer.find((p) => vals.includes(p));
        if (hit !== undefined) setW(name, hit);
    };
    const clearBtn = (label, title, fn) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.title = title;
        b.style.cssText = "background:var(--s2);border:1px solid var(--bd);color:var(--tx2);border-radius:7px;" +
            "padding:3px 9px;font-size:11px;cursor:pointer;flex:0 0 auto;";
        b.addEventListener("mouseenter", () => { b.style.color = "var(--tx)"; });
        b.addEventListener("mouseleave", () => { b.style.color = "var(--tx2)"; });
        b.addEventListener("click", fn);
        hd.appendChild(b);
        return b;
    };

    clearBtn("clear", "Clear the SHOT: brief/scene/light/props/action, final prompt, negative, prefix/suffix, batch prompts and the framing dropdowns (style, aspect, time of day and mood included). Model, presets and identity are untouched.", () => {
        ["brief", "scene", "light", "props", "action", "final_prompt", "negative",
         "prefix", "suffix", "batch_prompts", "system_prompt", "instruction"].forEach((n) => setW(n, ""));
        setNeutral("pose", ["(none)", "(auto)"]);
        setNeutral("wardrobe", ["(inherit)", "(none)", "(auto)"]);
        ["camera_rig", "angle", "shot_size", "lens",
         "style", "aspect", "time_of_day", "mood"].forEach((n) => setNeutral(n, ["(auto)", "(none)"]));
        resyncAll(node);
        node.setDirtyCanvas(true, true);
    });

    clearBtn("clear id", "Clear the IDENTITY: reference gallery, persona image and the cached persona description. Asks first - rebuilding a description costs an LLM pass.", () => {
        if (!confirm("Clear identity?\n\nRemoves the reference gallery, the persona image and the cached persona description.\nThe shot text, presets and model settings stay as they are.")) return;
        setW("refs_json", "[]");
        setW("ref_description", "");
        setNeutral("persona_image", ["(none)", "none", "(auto)"]);
        setNeutral("ref_preset", ["(none)", "Custom", "(auto)"]);
        resyncAll(node);
        node.setDirtyCanvas(true, true);
    });

    root.appendChild(hd);

    // --- tabs ---
    const tabs = document.createElement("div");
    tabs.className = "tabs";
    const panel = document.createElement("div");
    panel.className = "panel";
    const TABS = ["Prompts", "Frame", "Refs", "Presets", "Advanced"];
    const panes = {};
    TABS.forEach((name, i) => {
        const t = document.createElement("div");
        t.className = "tab" + (i === 0 ? " on" : "");
        t.textContent = name;
        t.addEventListener("click", () => {
            tabs.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === t));
            for (const k in panes) panes[k].style.display = k === name ? "" : "none";
            node.setDirtyCanvas(true, true);
        });
        tabs.appendChild(t);
        const pane = document.createElement("div");
        pane.style.display = i === 0 ? "" : "none";
        panes[name] = pane;
        panel.appendChild(pane);
    });
    root.appendChild(tabs);
    root.appendChild(panel);
    node._alp2ActivateTab = (name) => {
        tabs.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x.textContent === name));
        for (const k in panes) panes[k].style.display = k === name ? "" : "none";
        node.setDirtyCanvas(true, true);
    };

    // ---- Shot pane ----
    // Reading order is deliberate: the three prose boxes first (WHAT is happening, at full
    // width and the same height so none of them looks like the minor one), then every dial
    // that only says HOW it is shot. scene before action -- the place, then what she does in it.
    const shot = panes["Frame"];
    const gp = document.createElement("div");
    gp.className = "grid";
    gp.appendChild(field("brief / idea (overall concept) — type @ to insert a reference",
                         attachRefPicker(txtFor(node, "brief", true), node), { full: true }));
    gp.appendChild(field("scene (environment) — type @ to insert a reference",
                         attachRefPicker(txtFor(node, "scene", true), node), { full: true }));
    gp.appendChild(field("action / expression — type @ to insert a reference",
                         attachRefPicker(txtFor(node, "action", true), node), { full: true }));
    shot.appendChild(gp);
    const g = document.createElement("div");
    g.className = "grid";
    g.style.marginTop = "10px";
    g.style.borderTop = "1px solid var(--bd)";
    g.style.paddingTop = "10px";
    const combo = (label, name, nsfw) => g.appendChild(field(label, selFor(node, name), { nsfw }));
    // Two-column grid: keep the count of cells EVEN so the last row is not half-empty and the
    // panel height stays predictable. 12 cells = 6 full rows.
    combo("style / capture", "style");
    combo("aspect (composition hint)", "aspect");
    combo("rig", "camera_rig");
    combo("size", "shot_size");
    combo("angle", "angle");
    combo("lens", "lens");
    poseEl = buildPoseSelect(node);
    g.appendChild(field("pose / act", poseEl, { nsfw: true }));
    combo("wardrobe", "wardrobe");
    g.appendChild(field("light", txtFor(node, "light", false)));
    g.appendChild(field("props / in frame", txtFor(node, "props", false)));
    combo("time of day", "time_of_day");
    combo("mood", "mood");
    shot.appendChild(g);
    const shotHint = document.createElement("div");
    shotHint.className = "hint";
    shotHint.style.marginTop = "6px";
    shotHint.textContent = "Unset dropdowns are left to the writer — they are dropped from the brief rather than sent as blanks. "
        + "time of day is the hour, light is the source; mood colours the frame while action / expression stays the concrete thing she is doing. "
        + "props is what is physically in the frame and in her hands — naming one is how you displace an object you do not want, since asking for its absence tends to summon it. "
        + "aspect only steers how the frame is composed — the ratio itself is never written into the prompt, the real proportion comes from the sampler side.";
    shot.appendChild(shotHint);

    // ---- Refs pane ----
    const refs = panes["Refs"];
    const modeBanner = document.createElement("div");
    modeBanner.style.cssText = "border:1px solid var(--accbd);background:var(--accbg);color:var(--acc);border-radius:9px;padding:7px 9px;margin-bottom:8px;font-size:11.5px;line-height:1.45;";
    refs.appendChild(modeBanner);
    // What the references are FOR. Sits above the gallery because it decides whether anything
    // in that gallery reaches the model at all, or only the writer.
    // Two switches, deliberately independent: one decides whether the references reach the
    // model at all, the other decides where the frame geometry comes from. An edit can be
    // plain (geometry off reference 1) or mixed (geometry yours) -- different questions.
    const modeGrid = document.createElement("div");
    modeGrid.className = "grid";
    modeGrid.appendChild(field("references", swPairFor(node, "ref_mode")));
    modeGrid.appendChild(field("latent", swPairFor(node, "latent_mode")));
    refs.appendChild(modeGrid);
    const refModeHint = document.createElement("div");
    refModeHint.className = "hint";
    refModeHint.style.margin = "4px 0 8px";
    refModeHint.textContent = "references · edit — they leave as images and Qwen carries the persona, wardrobe and location into the render. "
        + "t2i — they stay behind: the writer still describes them in words, the model gets text only. "
        + "latent · edit — the latent output stays silent, so the sampler falls through to the encoder's own latent, sized on reference 1. "
        + "mix — the latent on the input passes through, so the frame shape is yours. "
        + "In t2i the encoder has no reference to size a latent on and falls back to a square, so pair it with mix.";
    refs.appendChild(refModeHint);
    refs.appendChild(refsGallery(node));
    const rsock = document.createElement("div");
    rsock.className = "sock"; rsock.style.marginTop = "8px";
    rsock.appendChild(document.createTextNode("🔌 Drop wires on "));
    const rib = document.createElement("b");
    rib.textContent = "refs in";
    rsock.appendChild(rib);
    rsock.appendChild(document.createTextNode(" (up to " + REF_MAX_IMAGES + ", click a wire's number "
        + "to disconnect it) and each one takes a dashed card above, numbered in connection order "
        + "before the files. A wire carrying a BATCH eats one number per frame and only the "
        + "backend knows how many, so with a batch the numbers shown here are approximate."
        + "  —  persona identity: persona ref (describe-only, overrides the Presets tab upload)"));
    refs.appendChild(rsock);
    const rh = document.createElement("div");
    rh.className = "hint";
    refs.appendChild(rh);

    // Ref passthrough wires. One `refs` output on the canvas; drag from it once per
    // reference. They are real links -- the number painted on each is the number the prompt
    // uses, so wire 3 IS <Image 3>. Nothing to set here: the gallery above decides how many
    // references exist.
    const ro = document.createElement("div");
    ro.style.cssText = "margin-top:10px;border-top:1px solid var(--bd);padding-top:8px;";
    const rot = document.createElement("div");
    rot.className = "sock";
    rot.textContent = "\ud83d\udd0c refs out \u2014 drag one wire per reference";
    ro.appendChild(rot);
    const roh = document.createElement("div");
    roh.className = "hint";
    roh.textContent = "The node hands the reference images out through a single `refs` socket. "
        + "Drag from it onto the image slot of TextEncodeQwenImage21, once per reference (max "
        + REF_OUT_MAX + "); the slot grows for the next one by itself. Every wire carries its "
        + "number and that number is what the prompt calls it (<Image 1> = wire 1), counted in "
        + "the order you connected them. They are ordinary links -- delete one the usual way. "
        + "You can only draw as many wires as the pool above holds. If the pool later shrinks, "
        + "the wires left over are NOT deleted for you -- they turn red so you can see they "
        + "point at nothing, and they block their branch rather than firing an empty image. "
        + "A connected socket may carry a batch, which only the backend can count, so with one "
        + "plugged in the limit opens up to " + REF_OUT_MAX + " and the extra wires stay red "
        + "until they run.";
    ro.appendChild(roh);
    refs.appendChild(ro);

    applyCaptureMode = () => {
        const w = W(node, "capture_mode");
        const batch = !!(w && w.value === "batch");
        modeBanner.textContent = batch
            ? "batch — each image gets its OWN caption in a separate call. Only ONE image is in the call, so the numbered reference roles are not sent; the persona identity block still is."
            : "composite — every image goes into ONE call and produces ONE prompt. Roles are handed to the writer as <Image N>.";
        rh.textContent = batch
            ? "One caption per image, joined in 'prompt' and split across 'prompt_list'. Roles and custom labels are ignored in this mode."
            : "These become <Image N> for the writer. Set a role (or a custom label) so it knows what each one is for.";
    };
    applyCaptureMode();

    // ---- Presets pane ----
    const presets = panes["Presets"];
    // Node config: save/load ALL fields except the refs — one-click restore of brief/settings.
    const cfgWrap = document.createElement("div");
    cfgWrap.style.cssText = "border:1px solid var(--bd);border-radius:9px;padding:8px;margin-bottom:10px;background:var(--s2);";
    const cfgTop = document.createElement("div");
    cfgTop.className = "lbl"; cfgTop.textContent = "NODE CONFIG (fills everything except refs)"; cfgTop.style.marginBottom = "6px";
    cfgWrap.appendChild(cfgTop);
    const cfgRow = document.createElement("div");
    cfgRow.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;";
    const cfgSel = document.createElement("select"); cfgSel.style.flex = "1 1 120px";
    const cfgName = document.createElement("input"); cfgName.type = "text"; cfgName.placeholder = "name to save"; cfgName.style.flex = "1 1 100px";
    const btnCss = "background:var(--accbg);color:var(--acc);border:1px solid var(--accbd);border-radius:7px;padding:5px 9px;cursor:pointer;font:inherit;flex:none;";
    const cfgLoad = document.createElement("button"); cfgLoad.textContent = "📂 Load"; cfgLoad.style.cssText = btnCss;
    const cfgSave = document.createElement("button"); cfgSave.textContent = "💾 Save"; cfgSave.style.cssText = btnCss;
    const cfgRestore = document.createElement("button"); cfgRestore.textContent = "↺ Restore last"; cfgRestore.style.cssText = btnCss; cfgRestore.title = "load the auto-saved last state (survives node deletion)";
    cfgRow.appendChild(cfgSel); cfgRow.appendChild(cfgLoad); cfgRow.appendChild(cfgName); cfgRow.appendChild(cfgSave);
    cfgWrap.appendChild(cfgRow);
    const cfgRow2 = document.createElement("div"); cfgRow2.style.cssText = "display:flex;gap:6px;margin-top:6px;";
    cfgRow2.appendChild(cfgRestore);
    cfgWrap.appendChild(cfgRow2);
    const cfgMsg = document.createElement("div"); cfgMsg.className = "hint"; cfgWrap.appendChild(cfgMsg);
    cfgRestore.addEventListener("click", async () => {
        cfgMsg.textContent = (await loadConfig(node, "_autosave")) ? "restored last auto-saved state" : "no autosave yet";
    });
    presets.appendChild(cfgWrap);
    const cfgRefresh = async (select) => {
        const list = await listConfigs();
        while (cfgSel.firstChild) cfgSel.removeChild(cfgSel.firstChild);
        if (!list.length) { const o = document.createElement("option"); o.value = ""; o.textContent = "(no saved configs)"; cfgSel.appendChild(o); }
        for (const n of list) { const o = document.createElement("option"); o.value = n; o.textContent = n; cfgSel.appendChild(o); }
        if (select) cfgSel.value = select;
    };
    cfgRefresh();
    cfgLoad.addEventListener("click", async () => {
        const n = cfgSel.value;
        if (!n) { cfgMsg.textContent = "nothing to load"; return; }
        cfgMsg.textContent = (await loadConfig(node, n)) ? ("loaded: " + n) : "load failed";
    });
    cfgSave.addEventListener("click", async () => {
        const n = (cfgName.value.trim() || cfgSel.value).replace(/[^a-zA-Z0-9 _-]/g, "").trim();
        if (!n) { cfgMsg.textContent = "type a name first"; return; }
        const ok = await saveConfig(node, n, false);  // named = reusable template (no refs)
        cfgMsg.textContent = ok ? ("saved: " + n) : "save failed";
        if (ok) { cfgName.value = ""; cfgRefresh(n); }
    });
    // Autosave the current state (except refs) to a fixed slot every ~10s when it changes —
    // always restorable via "Restore last", even after the node is deleted.
    node._alp2CfgSig = null;
    if (node._alp2AutosaveTimer) clearInterval(node._alp2AutosaveTimer);
    node._alp2AutosaveTimer = setInterval(() => {
        try {
            const sig = JSON.stringify((node.widgets || []).filter((x) => x && x.name && !ALWAYS_SKIP.has(x.name)).map((x) => [x.name, x.value]));
            if (sig !== node._alp2CfgSig) { node._alp2CfgSig = sig; saveConfig(node, "_autosave", true).catch(() => {}); }
        } catch (e) {}
    }, 10000);

    // Three blocks, each preset sitting DIRECTLY above the text box it writes. They used to be
    // stacked as three dropdowns and then three text boxes, which put a preset and its own text
    // several controls apart -- picking one changed something you could not see without scrolling.
    const famSel = document.createElement("select");
    PRESET_FAMILIES.forEach((f, i) => {
        const o = document.createElement("option");
        o.value = String(i); o.textContent = f.label; famSel.appendChild(o);
    });
    const famOf = () => PRESET_FAMILIES[Number(famSel.value) || 0] || PRESET_FAMILIES[0];
    const sysPrefix = () => famOf().sys || "";
    const insPrefix = () => famOf().ins || "";
    const sysSearch = searchableSel(node, "system_preset", "filter format presets...", sysPrefix);
    const insSearch = searchableSel(node, "instruction_preset", "filter task presets...", insPrefix);
    famSel.addEventListener("change", () => { sysSearch.refresh(); insSearch.refresh(); });

    const block = (title) => {
        const h = document.createElement("div");
        h.className = "sect";
        h.textContent = title;
        presets.appendChild(h);
        const b = document.createElement("div");
        b.className = "grid blk";
        presets.appendChild(b);
        return b;
    };
    const note = (text) => {
        const h = document.createElement("div");
        h.className = "hint";
        h.textContent = text;
        presets.appendChild(h);
    };

    const bFam = block("filter");
    bFam.previousSibling.className = "sect first";
    bFam.appendChild(field("prompting family (narrows both preset lists · nothing is reset)",
                           famSel, { full: true }));
    note("The family and the search box only narrow what the lists show — a preset already chosen stays chosen and is listed as 'current (outside filter)'.");

    const bFmt = block("format · HOW it is written");
    bFmt.appendChild(field("format preset", sysSearch.wrap, { full: true }));
    bFmt.appendChild(field("system prompt (from the preset, editable)",
                           txtFor(node, "system_prompt", true), { full: true }));

    const bTask = block("task · WHAT to do");
    bTask.appendChild(field("task preset", insSearch.wrap, { full: true }));
    bTask.appendChild(field("instruction (from the preset, editable)",
                            txtFor(node, "instruction", true), { full: true }));
    note("The preset is the authority: picking one overwrites the box under it. Select 'Custom' to keep your own text.");

    const bPer = block("persona · WHO is in the frame");
    bPer.appendChild(field("persona ref preset", selFor(node, "ref_preset"), { full: true }));
    // Persona reference image — in-node upload (describe-only). The reference_image socket wins.
    bPer.appendChild(field("persona reference image (describe-only · socket overrides)",
                           personaUpload(node), { full: true }));
    bPer.appendChild(field("persona identity block (written from the persona image, reused)",
                           txtFor(node, "ref_description", true), { full: true }));
    presets.appendChild(swFor(node, "refresh_ref", "re-describe persona"));

    sysSearch.refresh();
    insSearch.refresh();

    // ---- Advanced pane ----
    const adv = panes["Advanced"];
    const ag = document.createElement("div");
    ag.className = "grid";
    ag.appendChild(field("model", selFor(node, "model"), { full: true }));
    ag.appendChild(field("mmproj", selFor(node, "mmproj")));
    ag.appendChild(field("chat handler", selFor(node, "chat_handler")));
    ["n_ctx", "vram_limit", "n_cpu_moe", "seed", "max_tokens", "temperature",
     "top_k", "top_p", "min_p", "typical_p", "repeat_penalty", "frequency_penalty",
     "mirostat_mode", "mirostat_tau", "mirostat_eta",
     "max_size", "image_min_tokens", "image_max_tokens", "mtp_draft_max"].forEach((n) => {
        ag.appendChild(field(n, txtFor(node, n, false)));
    });
    ag.appendChild(field("type_k", selFor(node, "type_k")));
    ag.appendChild(field("type_v", selFor(node, "type_v")));
    ag.appendChild(field("prefix", txtFor(node, "prefix", false)));
    ag.appendChild(field("suffix", txtFor(node, "suffix", false)));
    adv.appendChild(ag);
    // The extended pose lists. A list filter only: nothing is written into the brief.
    const morePoses = swFor(node, "nsfw", "more poses", () => { if (poseEl && poseEl._refresh) poseEl._refresh(); });
    morePoses.style.marginTop = "8px";
    adv.appendChild(morePoses);
    adv.appendChild(swFor(node, "mtp_speculative", "MTP speculative decoding (text-only)"));
    const advh = document.createElement("div");
    advh.className = "hint"; advh.style.marginTop = "8px";
    advh.textContent = "MTP is ignored unless the GGUF carries NextN heads, and is disabled automatically when an mmproj is loaded. mirostat_mode 0 = off.";
    adv.appendChild(advh);

    // ---- Prompts pane ----
    const prev = panes["Prompts"];
    prev.className = "prev";
    const oh = document.createElement("div");
    oh.style.cssText = "display:flex;align-items:center;gap:12px;margin-bottom:6px;";
    const ohl = document.createElement("div");
    ohl.className = "lbl"; ohl.style.color = "var(--acc)"; ohl.textContent = "PROMPTS";
    oh.appendChild(ohl);
    const ohnote = document.createElement("span");
    ohnote.className = "hint";
    ohnote.textContent = "LLM toggle is in the header — turn it OFF to type your own prompt below.";
    oh.appendChild(ohnote);
    prev.appendChild(oh);
    prev.appendChild(field("final prompt (LLM output, or type your own with LLM off)", attachRefPicker(txtFor(node, "final_prompt", true), node), { full: true }));
    prev.appendChild(field("negative", txtFor(node, "negative", true), { full: true }));
    const fpW = W(node, "final_prompt");
    if (fpW && fpW._domEl) fpW._domEl.style.minHeight = "90px";

    // Prompt-list mode: one prompt per line -> positive_list -> one image per line per Queue.
    const bl = document.createElement("div");
    bl.style.cssText = "margin-top:10px;border-top:1px solid var(--bd);padding-top:8px;";
    bl.appendChild(swFor(node, "batch_mode", "prompt list mode (skips the LLM)"));
    const blBox = field("batch prompts — one per line, or numbered '1.' blocks", attachRefPicker(txtFor(node, "batch_prompts", true), node), { full: true });
    blBox.style.marginTop = "6px";
    bl.appendChild(blBox);
    const blh = document.createElement("div");
    blh.className = "hint";
    blh.textContent = "Wire the positive_list output to KSampler.positive: ComfyUI runs the graph once per entry, so one Queue renders the whole list. prefix/suffix still wrap each entry.";
    bl.appendChild(blh);
    prev.appendChild(bl);

    // Hide every native widget — the DOM panel drives them now. No widget is created here, so
    // the Python positional order (and every saved workflow) is untouched.
    (node.widgets || []).slice().forEach((w) => hideNative(w));

    // Attach the panel as a stateless DOM widget (getValue() -> "", so it serializes nothing).
    node.addDOMWidget("alp2_ui", "alp2", root, {
        getValue() { return ""; },
        setValue() {},
        getHeight() { return root.scrollHeight ? root.scrollHeight + 8 : 480; },
    });

    // Preset auto-fill from this pack's own routes (/artfat_llm_v2/...). The sibling packs use
    // /artfat_llm/... and /artfat_video/...; aiohttp raises on a duplicate route, so each pack
    // needs its own namespace and answers out of its own prompts/ directory.
    const bindAuto = (presetName, targetName, route) => {
        const p = W(node, presetName), t = W(node, targetName);
        if (!p || !t) return;
        const orig = p.callback;
        p.callback = async (v) => {
            if (orig) orig.call(p, v);
            if (v && v !== "Custom" && v !== "None") {
                try {
                    const r = await fetch(`${route}?name=${encodeURIComponent(v)}`);
                    const j = await r.json();
                    t.value = j.text || "";
                    if (t._domSync) t._domSync();
                } catch (e) {}
            }
        };
    };
    bindAuto("system_preset", "system_prompt", "/artfat_llm_v2/system_preset");
    bindAuto("instruction_preset", "instruction", "/artfat_llm_v2/instruction_preset");

    setTimeout(() => {
        const want = 620;
        if (node.size[1] < want) node.setSize([Math.max(node.size[0], 360), want]);
        resyncAll(node); // belt-and-suspenders: if configure already ran, reflect saved values
        node.setDirtyCanvas(true, true);
    }, 30);
}

app.registerExtension({
    name: "artfat.llm.prompter.v2",
    async setup() {
        // Both of these are shared globals. We wrap and always delegate; see the notes above
        // patchCanvasForRefLinks.
        try { patchGraphToPromptForRefLinks(); } catch (e) {}
        try { patchGraphToPromptForRefIn(); } catch (e) {}
        try { patchCanvasForRefLinks(); } catch (e) {}
        try { patchCanvasForRefInWires(); } catch (e) {}
    },
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "ArtfatLLMPrompterV2") return;

        // Replace the nine static ref_* outputs with ONE `refs` socket at DEFINITION level.
        // Some builds keep a second copy of the def on the type, so rewrite every copy we can
        // reach or a stale one puts the dead sockets back.
        rewriteRefOutputsInDef(nodeData);
        if (nodeType.nodeData && nodeType.nodeData !== nodeData) rewriteRefOutputsInDef(nodeType.nodeData);
        const ctorData = nodeType.prototype && nodeType.prototype.constructor
            && nodeType.prototype.constructor.nodeData;
        if (ctorData && ctorData !== nodeData) rewriteRefOutputsInDef(ctorData);
        // Same for the inputs: image_1..image_9 collapse into ONE `ref_in` socket.
        rewriteRefInputsInDef(nodeData);
        if (nodeType.nodeData && nodeType.nodeData !== nodeData) rewriteRefInputsInDef(nodeType.nodeData);
        if (ctorData && ctorData !== nodeData) rewriteRefInputsInDef(ctorData);

        const onCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onCreated && onCreated.apply(this, arguments);
            // Match the canvas body to the panel inside it so the node reads as one surface
            // instead of a dark rectangle framed by LiteGraph's default grey. Set only at
            // creation: onConfigure restores whatever colour a saved graph carries.
            this.bgcolor = "#1e1e24";
            this.color = "#26262e";
            // Width only. Forcing a height leaves dead space under whichever tab is shortest,
            // and the DOM widget already reports its own height as it changes.
            try {
                const want = this.computeSize();
                this.size = [Math.max(460, want[0]), want[1]];
            } catch (e) {}
            try {
                buildUI(this);
            } catch (e) {
                console.error("[artfat-llm-v2] UI build failed, falling back to plain widgets:", e);
            }
            try { ensureRefsOutput(this); } catch (e) {}
            try { ensureRefInInput(this); } catch (e) {}
            try { applySocketLabels(this); } catch (e) {}
            try { patchCanvasForRefLinks(); } catch (e) {}
            try { patchCanvasForRefInWires(); } catch (e) {}
        };

        // A node dropped into the graph (paste, undo, template) reaches onAdded with its links
        // already restored, so re-check there too. The canvas can also have been rebuilt since
        // (new graph, new tab) and the patch flag lives on the canvas instance, so re-arm it.
        const onAdded = nodeType.prototype.onAdded;
        nodeType.prototype.onAdded = function () {
            onAdded && onAdded.apply(this, arguments);
            try { ensureRefsOutput(this); } catch (e) {}
            try { ensureRefInInput(this); } catch (e) {}
            try { applySocketLabels(this); } catch (e) {}
            try { patchCanvasForRefLinks(); } catch (e) {}
            try { patchCanvasForRefInWires(); } catch (e) {}
        };

        // `ref_in` takes any number of wires, up to the pool limit.
        const onConnectInput = nodeType.prototype.onConnectInput;
        nodeType.prototype.onConnectInput = function (inputIndex) {
            if (onConnectInput && onConnectInput.apply(this, arguments) === false) return false;
            try {
                const input = this.inputs && this.inputs[inputIndex];
                if (input && input.name === REF_IN_NAME
                    && refPoolInfo(this).size >= REF_MAX_IMAGES) {
                    console.warn("[artfat-llm-v2] ref in: wires + gallery = " + REF_MAX_IMAGES + " is the limit.");
                    return false;
                }
            } catch (e) {}
        };

        // One wire per reference in the pool, and never more than the nine ref_N slots behind
        // the `refs` socket. Refusing here is the only cheap moment: once the wire exists it is
        // the user's, and pulling it out from under them is worse than drawing it red.
        const onConnectOutput = nodeType.prototype.onConnectOutput;
        nodeType.prototype.onConnectOutput = function (outputIndex) {
            if (onConnectOutput && onConnectOutput.apply(this, arguments) === false) return false;
            try {
                if (outputIndex !== refsOutputIndex(this)) return;
                // Numbers run per consumer now, so the busiest consumer is what counts.
                const count = orderedRefLinks(this).reduce((m, e) => Math.max(m, e.index + 1), 0);
                const limit = refWireCap(this);
                if (count >= limit.cap) {
                    console.warn("[artfat-llm-v2] refs: " + count + " wire(s) already, and the pool"
                        + " holds " + limit.size + " reference(s)"
                        + (limit.batchy ? " plus whatever the connected socket carries (hard limit "
                            + REF_OUT_MAX + ")" : "")
                        + ". Add a reference in the Refs tab before drawing another wire.");
                    return false;
                }
            } catch (e) {}
        };

        // The wire numbers are painted into the background layer, so a connection change has
        // to repaint it -- LiteGraph does that for the links themselves, this just makes sure.
        // Connecting image_1/image_2 also shifts the reference numbering, which only the Refs
        // gallery can redraw.
        const onConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (type, index, connected) {
            onConnectionsChange && onConnectionsChange.apply(this, arguments);
            // A real wire just landed on `ref_in`: keep it as a numbered wire and free the
            // socket again. Next tick, once LiteGraph has finished registering the link.
            try {
                const input = this.inputs && this.inputs[index];
                if (connected && type === 1 && input && input.name === REF_IN_NAME
                    && !this.__alp2RefInClearing) {
                    setTimeout(() => {
                        try {
                            const at = refInInputIndex(this);
                            if (at >= 0) captureRefInLink(this, at);
                        } catch (e) {}
                    }, 0);
                }
            } catch (e) {}
            try { this.setDirtyCanvas(true, true); } catch (e) {}
            try { if (this._alp2RefsRender) this._alp2RefsRender(); } catch (e) {}
        };

        // ComfyUI restores saved widget values via configure() AFTER onNodeCreated built the DOM,
        // so the panel initially shows defaults. Re-sync the DOM from the restored values.
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            onConfigure && onConfigure.apply(this, arguments);
            // Reconcile the outputs against the RESTORED graph: a save from the earlier
            // ref_1..ref_N build has its real ref links migrated to virtual ones here, and any
            // save gets exactly one `refs` socket. The nine fixed outputs keep indices 0-8, so
            // nothing else in the graph reconnects.
            try { ensureRefsOutput(this); } catch (e) {}
            try { ensureRefInInput(this); } catch (e) {}
            try { applySocketLabels(this); } catch (e) {}
            try { patchCanvasForRefLinks(); } catch (e) {}
            setTimeout(() => {
                // Migration of image_1/image_2 links needs the graph's link store complete, so
                // it runs again here, after configure() returned.
                try { ensureRefInInput(this); } catch (e) {}
                try { resyncAll(this); } catch (e) {}
                // Second pass on the next tick: some builds reconcile node.outputs against the
                // node definition AFTER configure returns, which would silently drop the
                // socket we just restored.
                try { ensureRefsOutput(this); } catch (e) {}
                try { applySocketLabels(this); } catch (e) {}
            }, 0);
        };

        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            onExecuted && onExecuted.apply(this, arguments);
            if (!message) return;
            const put = (name, val) => {
                const w = W(this, name);
                if (!w) return;
                w.value = val;
                if (w._domEl) w._domEl.value = val;
            };
            if (message.text) {
                const text = Array.isArray(message.text) ? message.text.join("\n\n") : message.text;
                put("final_prompt", text);
                if (this._alp2ActivateTab) this._alp2ActivateTab("Prompts"); // jump to the result
            }
            if (message.ref_desc !== undefined) {
                const rd = Array.isArray(message.ref_desc) ? message.ref_desc.join("\n\n") : message.ref_desc;
                if (rd) put("ref_description", rd);
            }
            this.setDirtyCanvas(true, true);
            saveConfig(this, "_autosave", true).catch(() => {}); // checkpoint full state each run
        };

        // Stop the autosave timer when the node is removed so it doesn't leak.
        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            if (this._alp2AutosaveTimer) { clearInterval(this._alp2AutosaveTimer); this._alp2AutosaveTimer = null; }
            onRemoved && onRemoved.apply(this, arguments);
        };
    },
});
