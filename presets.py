"""Preset text for the Artfat LLM Prompter v2 node.

Two layers:
  * system presets  -> HOW to write (engine / style). Read from models/LLM/prompts/*.txt
  * instruction presets -> WHAT to do (task / output format). Defined below.
Both auto-fill an editable widget on the node (web/llm_prompter_v2.js), so the
chosen text is visible and can be edited live before running.
"""

import os

import folder_paths

# System presets are read from TWO places, in this priority:
#   1. USER_DIR  -> ComfyUI/models/LLM/prompts/   (user's own presets + live overrides)
#   2. BUNDLED_DIR -> this node's own prompts/     (ships with the node via git, always present)
# A .txt in USER_DIR overrides a bundled one of the same name, so users can tweak a preset
# by dropping an edited copy into models/LLM/prompts/ without touching the node files.
_HERE = os.path.dirname(os.path.abspath(__file__))
BUNDLED_DIR = os.path.join(_HERE, "prompts")
USER_DIR = os.path.join(folder_paths.models_dir, "LLM", "prompts")
# Reference presets live in their own subfolder. They describe a PERSON, not a scene, so they
# must never appear in the scene dropdown and no scene preset may appear in theirs — picking the
# wrong one produces an identity block that is silently prepended to every caption in a batch.
# The split costs nothing: the listers below only collect *.txt, so a subdirectory is skipped.
BUNDLED_REF_DIR = os.path.join(BUNDLED_DIR, "reference")
USER_REF_DIR = os.path.join(USER_DIR, "reference")
# Qwen-Image-2.1 scene presets live in their own subfolder as well. They are the SAME kind of
# preset as the flat ones -- a style for the scene dropdown -- and are listed together with them,
# so the folder is bookkeeping rather than a second category. The split is worth it because the
# two families cannot share a file: Qwen's own rewriter asks for a 400-500 word observational
# description, while the flat presets target Krea2/Flux at 75-100 words, and converting one in
# place would break the other. The `Q21T_` filename prefix is what the panel's family filter
# matches on, so a file only belongs to the family if it is BOTH in here AND named for it.
BUNDLED_QWEN_DIR = os.path.join(BUNDLED_DIR, "qwen")
USER_QWEN_DIR = os.path.join(USER_DIR, "qwen")
# Kept for backward compatibility (older code/imports referenced PROMPTS_DIR).
PROMPTS_DIR = USER_DIR

# The one preset that works on the user's OWN prompt: image_nodes.run() hands the LLM the current
# final_prompt as [SOURCE PROMPT], skips the system preset, and skips the LLM when no boxes are drawn.
USER_EDIT_PRESET = "User prompt -> edit (keep my prompt, change only the boxes)"

# name -> instruction text ("Custom" leaves the box empty for a free / user preset)
INSTRUCTION_PRESETS = {
    "Custom": "",
    "Describe -> prompt": (
        "Look at the image and write a single detailed text-to-image prompt that "
        "faithfully describes it: subject, setting, composition, lighting and mood. "
        "Output only the prompt as one flowing paragraph, no preamble, no analysis."
    ),
    "Extreme detailed": (
        "Write an extremely detailed text-to-image prompt from the image. Elaborate on "
        "the subject's appearance, clothing textures, specific background elements, the "
        "quality and colour of light, shadows and overall atmosphere. One rich paragraph. "
        "Output only the prompt."
    ),
    "Tags": (
        "Generate a clean list of comma-separated tags for a text-to-image model based only "
        "on the visible content of the image: subject, clothing, environment, colours, lighting, "
        "composition. Max 50 unique tags, no abstract or marketing terms. Output only the tags."
    ),
    "Cinematic": (
        "Act as a master prompt engineer. Write a highly detailed, evocative cinematic prompt for "
        "an image-generation model: subject, pose, environment, lighting, mood and photographic "
        "style. Weave everything into one natural-language paragraph. Output only the prompt."
    ),
    "Refine & expand": (
        "Refine and enhance the following prompt for text-to-image generation. Keep its meaning "
        "and key words, make it more expressive and visually rich. Output only the improved prompt "
        "text itself, with no reasoning, thinking or commentary."
    ),
    "Ref face (Image1) + frame (Image2)": (
        "Take the face and head shape from the FIRST image and everything else from the "
        "SECOND image - body, pose, hair styling, clothing, light, environment, framing. "
        "The woman in the second image is given the first woman's face. Reproduce that face "
        "exactly, never narrowing or beautifying it. Output only the final prompt as one paragraph."
    ),
    "Scene only (face comes from ref_description)": (
        "Describe ONLY what changes from photo to photo: shot size and framing, camera height "
        "and angle, body and build, pose, hair styling, clothing, footwear and jewellery, skin "
        "of the body, light source and direction, environment and props, and the image character "
        "(grain, sharpness, exposure). Do NOT describe the face, head shape or facial features - "
        "the identity is supplied separately and prepended to your text, so describing it again "
        "would contradict it. Start straight at the framing. Output only the description as one "
        "flowing paragraph, no preamble."
    ),
    'Brief first + pose ref (look from persona/LoRA)': (
        "The user's [IDEA] comes FIRST. Whatever it says about wardrobe, nudity, pose, props or scene replaces what the images show: if it says nude, write 'completely nude' and name no garment; if it names a pose, describe that pose; if it places an object from an image somewhere, put it there. From Image 1 take only what the [IDEA] does not set: the pose, shot size and framing, camera height and angle, setting, light, colour and image character (grain, sharpness, exposure). Image 2 and later are add-ons: take from each only the outfit, location, prop or light it shows. When an add-on image is an outfit (flat lay or worn), list every garment, accessory and part it shows - colour, material, pattern, fit and details - and dress the woman in all of them, each worn where it belongs and in a state that fits the pose; it replaces Image 1's clothing completely. Fix each garment's extent with body landmarks (sleeves down to her wrists, hem at mid-thigh, stocking tops at mid-thigh with a lace band) and name small items with where they sit (stud earrings in both earlobes). Never write Image 1/2/3 or 'from the reference' in the output - describe the thing itself. Never describe anyone's look - no face, facial features, makeup, skin tone, freckles, hair colour, length or texture, age, ethnicity, body build, breast size or proportions; the look is supplied separately. Refer to the person only as 'the woman' (or 'the man'). Describe the pose once, through its support points (where the hands, knees and feet are relative to the shoulders and hips), never two different postures. State every element once and leave no contradictions. Start straight at the framing. Output only the description as one flowing paragraph, no preamble."
    ),
    "Swap person only (keep pose, outfit, scene from ref)": (
        "Describe everything in the image EXCEPT the person's look: shot size and framing, camera "
        "height and angle, the pose (body orientation, each limb, each hand and what it touches, head "
        "turn, gaze, expression in neutral terms such as eyes closed or lips parted), clothing, "
        "footwear and jewellery, light source and direction, environment and props, colour and the "
        "image character (grain, sharpness, exposure). Do NOT describe the face, facial features, "
        "makeup, skin tone, freckles, moles, tattoos, hair colour, hair length, hair texture, age, "
        "ethnicity, body build, breast size or body proportions - the look comes from the persona "
        "reference and is prepended to your text, so describing it again would contradict it. Refer "
        "to the person only as 'the woman' (or 'the man'). If hair position matters for the pose, "
        "state the position only. Describe the pose through its support points (where the hands, knees and feet are relative to the shoulders and hips) and never combine two different postures. State every element once: if the woman is nude, say so and list no garments. The output must contain no contradictions. Start straight at the framing. Output only the description as "
        "one flowing paragraph, no preamble."
    ),
    "BBox layout: whole frame with the [BOXES] (Artfat BBox Canvas)": (
        "The [IDEA] holds the user's idea and a [BOXES] list: numbered areas of the frame, each with its place and what must be "
        "inside it. Write ONE text-to-image prompt for the WHOLE frame as it must look in the end. If an image is given, it is "
        "the picture being edited: describe it as it will look AFTER the change - everything outside the listed areas exactly "
        "as the image shows it, and inside each area only the new content from the [BOXES] list. Never mention what an area "
        "shows now, and never write replace, change, instead, new, remove or add. If no image is given, build the scene from "
        "the [IDEA] so that every listed item sits naturally at its place. Name every listed item once, at its place in plain "
        "words (on the wall to the left, on the floor in the foreground), keeping the user's wording. For a text item write "
        "the exact words in double quotes and what they are printed on. An item marked character is the person: call them "
        "only 'the woman' (or 'the man') and never describe their look - no face, hair, skin, makeup, age or body build; the "
        "look comes from the LoRA. Never write area numbers, coordinates, percentages or the words box or [BOXES]. State "
        "every element once, with no contradictions. Output only the prompt as one flowing paragraph, no preamble."
    ),
    USER_EDIT_PRESET: (
        "[SOURCE PROMPT] is the user's own prompt for this picture. [IDEA] may hold a [BOXES] list: numbered "
        "areas of the frame, each with its place and what must be there now. Return the [SOURCE PROMPT] word for "
        "word, with only these changes: when the source already names what sits at a listed place, replace those "
        "words with the new content from the list; when it does not, add one short sentence that puts the new "
        "content at its place in plain words (on the wall to the left, in the foreground). For a text item keep "
        "the exact words in double quotes. Change nothing else - no new style, light, mood, adjectives or "
        "details, no reordering, no shortening. Never write area numbers, coordinates or the words box or "
        "[BOXES]. Output only the prompt, no preamble."
    ),
    "Scene + action, no face/hair (subj Img1 + env Img2)": (
        "Describe the full frame EXCEPT the face and the hair - both are supplied separately and "
        "prepended to your text, so describing them again would contradict the identity. With ONE "
        "image, take everything from it: the subjects and their bodies, poses, actions, clothing or "
        "nudity, plus the environment and light. With TWO images, take the people and everything they "
        "are doing (build, poses, hands, explicit acts) from Image 1, and the environment and setting "
        "(location, surfaces, furniture, props, background, lighting) from Image 2, combined into one "
        "coherent scene. Do NOT state the overall skin tone or colour (fair, tan, olive, pale, dark) - "
        "the complexion comes from the identity block and any tone you name would contradict it; "
        "describe body-skin texture and marks (pores, tan lines, moles) but never how light or dark it is. "
        "Never describe the permanent facial features (shape of eyes, nose, lips, jaw, "
        "cheekbones, facial skin) or any hair attribute (colour, length, texture, styling) - those come "
        "from the identity. DO describe the transient expression and gaze though (mouth open, moan, "
        "smile, tongue, brows, and where she is looking - into the lens or away), as they are the action "
        "of the moment. Start straight at the framing. Output only the description as one flowing "
        "paragraph, no preamble."
    ),
    "Replace subject (Image1 scene + Image2 person)": (
        "Generate a detailed prompt describing the reference Image 1. Replace the person from "
        "Image 1 with the person from Image 2, adapting the pose naturally to the scene. Output "
        "only the final prompt as one paragraph."
    ),
    "Replace + keep outfit from Image1": (
        "Generate a detailed prompt describing the reference Image 1. Replace the person from "
        "Image 1 with the person from Image 2, but she should be dressed exactly the same as in "
        "Image 1. Output only the final prompt as one paragraph."
    ),
    "Appearance only (face + body)": (
        "Describe only the appearance of the person: face first, then body. No clothing, "
        "accessories, environment, pose or action unless explicitly told. If two images are given, "
        "blend the features into one coherent person. Output only the description."
    ),
    "Scene + lighting mix": (
        "Combine the architecture and composition of Image 1 with the time-of-day lighting and "
        "colour mood of Image 2 into a single text-to-image prompt. Output only the prompt."
    ),

    # --- Qwen-Image-2.1 Edit instructions (prefix Q21E_) -----------------------------------
    # Written against the official rewriter system prompt shipped with Qwen-Image-2.1
    # (prompt_rewrite/prompts/system_prompt_edit.txt). The rules these four encode:
    #   * Attribute Disentanglement at Full Strength - edit exactly what was named, push it to an
    #     unmistakable degree, hold everything else at input fidelity. The two failure modes are
    #     symmetric: leakage (touching the unnamed) and under-editing (a result you could mistake
    #     for the input). Preservation locks CONTENT, never edit strength.
    #   * Identity comes from an image, so POINT AT THE IMAGE. Listing bone structure, eyes, nose
    #     and mouth in words makes the model regenerate them from the description and the likeness
    #     degrades - this is why the previous face-swap preset drifted the cheekbones and brows.
    #   * Name each image's role individually: which one is the canvas (its composition and its
    #     unnamed content survive), which supply material, and what is taken from each. Never
    #     compress several references into a group or a range.
    #   * <imageN> tags are mandatory at N >= 2 and forbidden at N == 1 ("the image").
    #   * Affirmative phrasing only. The official path runs at cfg 1, where a negative prompt does
    #     nothing and a "no X" phrase summons X.
    #   * Only what was asked - no extra operations, no cleaning up unmentioned defects.
    #   * COMMAND FORM: verb + the thing acted on + the state it ends in. Measured on our own
    #     runs, same node and same source image: "undress woman on <image1> to full nude"
    #     performed the edit cleanly, while "change <image1> to daylight" only graded the
    #     frame -- its grammatical object is the picture instead of the thing being changed.
    "Q21E_face_swap": (
        "Write ONE Qwen-Image-2.1 edit instruction that puts the head of the person in <image2> "
        "onto the body in <image1>. Name the role of each image separately: <image1> is the "
        "canvas, so its framing, composition, body, pose, hands, clothing, jewellery, background "
        "and lighting all survive; <image2> is the identity source and supplies nothing but the "
        "person's head. Point at <image2> for the identity instead of spelling it out - write "
        "that the head is the one shown in <image2> and that it is the same person, and leave "
        "bone structure, cheekbones, jawline, eyes, brows, nose, mouth, hairline and skin out of "
        "words entirely. Naming those features makes the model rebuild them from your description "
        "rather than carry them across, and the likeness degrades with every pass. Say 'head', "
        "never 'face' on its own: a face-level edit keeps the skull of <image1> and stretches the "
        "features of <image2> over it. Take the head orientation, tilt, gaze direction and "
        "expression from the pose already in <image1>, so the transplanted head looks where the "
        "body looks. Require the swap to be unmistakable - the person is now the one from "
        "<image2>, not a blend and not a softened compromise - while the join stays seamless: "
        "neck and jawline skin tone, light direction, shadow softness and colour temperature all "
        "come from <image1>. Name the earrings, necklace, collar, glasses, headwear, hair "
        "ornaments and the neckline of the garment in <image1> as staying exactly as they are, "
        "because a head-level edit otherwise drags the accessories of <image2> across with it. "
        "Add no other operation and touch nothing that was not named. Phrase every requirement "
        "affirmatively, as what is taken and what stays - never as what must not change, and "
        "never with 'no', 'without' or 'avoid'."
        "Open the instruction with the operation in the imperative and give it all three parts - the "
        "verb, the thing being acted on, and the state it ends in, as in 'undress the woman in "
        "<image1> to full nude'. An instruction whose grammatical object is the picture rather than "
        "the thing being changed, such as 'change <image1> to daylight', lands as a mild global grade "
        "instead of the edit that was asked for. "
        "Output only the instruction, one paragraph."
    ),
    "Q21E_replace_background": (
        "Write ONE Qwen-Image-2.1 edit instruction that replaces the surroundings of <image1> "
        "with the environment shown in <image2>. Name the role of each image separately: "
        "<image1> is the canvas, so the person, her identity, hair, body, pose, hands, clothing "
        "and accessories and the camera framing all survive down to the silhouette edge; "
        "<image2> is the environment source and supplies the location, architecture, surfaces, "
        "furniture, props, depth and perspective. Refer to the woman as the one already in "
        "<image1> and leave her face and figure undescribed - a preservation clause written out "
        "in detail reads to the model as a fresh generation instruction and drifts the likeness. "
        "Say what the new setting actually is and where in it she stands, read off <image2> "
        "itself rather than off a generic idea of that kind of place. Push the replacement to "
        "full strength: the old location is gone and the new one fills the frame behind and "
        "around her. Buy the realism with relighting, not by holding the change back - the light "
        "direction, colour temperature and contrast of <image2> fall on her, contact shadows land "
        "where her feet, hands or body meet the new ground or furniture, and the background blur "
        "follows her distance from camera. Leave every unmentioned element of <image1> alone, "
        "including clutter, overlays and blemishes that look like they want cleaning up. Phrase "
        "every requirement affirmatively, as what is taken and what stays - never as what must "
        "not change, and never with 'no', 'without' or 'avoid'."
        "Open the instruction with the operation in the imperative and give it all three parts - the "
        "verb, the thing being acted on, and the state it ends in, as in 'undress the woman in "
        "<image1> to full nude'. An instruction whose grammatical object is the picture rather than "
        "the thing being changed, such as 'change <image1> to daylight', lands as a mild global grade "
        "instead of the edit that was asked for. "
        "Output only the instruction, one "
        "paragraph."
    ),
    "Q21E_change_clothing": (
        "Write ONE Qwen-Image-2.1 edit instruction that dresses the person in <image1> in the "
        "clothing shown in <image2>. Name the role of each image separately: <image1> is the "
        "canvas, so her identity, hair, body proportions, pose, hands, jewellery, background, "
        "framing and lighting all survive; <image2> supplies the garments and nothing else - not "
        "its model, not its setting, not its light. Do not describe the woman of <image1> beyond "
        "naming her as the one already there: her likeness is carried by the image, and putting "
        "it into words makes the model repaint it. Clothing is the opposite case. Walk <image2> "
        "item by item and name every garment you can see with its type, its colour and its cut - "
        "for example a cropped white ribbed tank top, high-waisted light-blue denim shorts, white "
        "low-top sneakers - because those words are what lets the model find the right piece on "
        "the reference. Stop at type, colour and cut, and leave weave, stitching and print detail "
        "to <image2> itself. Push the change to full strength: the previous outfit is entirely "
        "gone, replaced piece for piece, not blended with it and not tinted toward it. Require "
        "the clothes to sit on this body and this pose - following her actual shape, with folds "
        "and tension where the pose creates them, hems and straps landing where her proportions "
        "put them - and to take the light direction and colour temperature of <image1>, including "
        "the shadows the fabric casts on her skin. State which skin and which accessories stay "
        "visible where the new cut covers or exposes them. Add no other operation and touch "
        "nothing that was not named. Phrase every requirement affirmatively, as what is taken and "
        "what stays - never as what must not change, and never with 'no', 'without' or 'avoid'. "
        ""
        "Open the instruction with the operation in the imperative and give it all three parts - the "
        "verb, the thing being acted on, and the state it ends in, as in 'undress the woman in "
        "<image1> to full nude'. An instruction whose grammatical object is the picture rather than "
        "the thing being changed, such as 'change <image1> to daylight', lands as a mild global grade "
        "instead of the edit that was asked for. "
        "Output only the instruction, one paragraph."
    ),
    "Q21E_restyle_iphone15": (
        "Write ONE Qwen-Image-2.1 edit instruction that restyles the single input image into a "
        "candid amateur photo shot on an iPhone 15, changing how the picture was captured and "
        "nothing else. This is a one-image task: refer to it in plain words as 'the image' and "
        "use no <image1> tag at all, because the tag format applies only when two or more images "
        "are given. Name what survives by type, position and role rather than by appearance - the "
        "woman and her identity, her hair, her pose and hands, her clothing and accessories, the "
        "room, the props and the framing are the ones already in the image - and write none of "
        "her features out, since a preservation clause spelled out in detail reads as a "
        "generation instruction and drifts the face. Then describe the capture itself in full, "
        "and push it far enough that the result could not be mistaken for the input: the wide "
        "phone lens with its mild edge distortion and deep depth of field, computational HDR "
        "lifting the shadows while it holds the highlights, slightly cool auto white balance, "
        "fine luminance noise through the darker areas, a trace of motion softness from a "
        "handheld grab, and unretouched skin carrying visible pores, stray hairs, shine and real "
        "texture. Keep the rendering medium a photograph throughout. Add no other operation: the "
        "composition stays uncropped and every unmentioned blemish, overlay and piece of clutter "
        "stays exactly where it is. Phrase every requirement affirmatively, as what stays and "
        "what the camera does - never as what must not change, and never with 'no', 'without' or "
        "'avoid'."
        "Open the instruction with the operation in the imperative and give it all three parts - the "
        "verb, the thing being acted on, and the state it ends in, as in 'undress the woman in the "
        "image to full nude'. An instruction whose grammatical object is the picture rather than the "
        "thing being changed, such as 'change the image to daylight', lands as a mild global grade "
        "instead of the edit that was asked for. "
        "Output only the instruction, one paragraph."
    ),
    "Q21E_low_light": (
        "Write ONE Qwen-Image-2.1 edit instruction that turns the evenly lit single input image "
        "into a night-time low-light photograph. This is a one-image task: refer to it in plain "
        "words as 'the image' and use no <image1> tag at all, because the tag format applies only "
        "when two or more images are given. Low light is a change of LIGHT SOURCE, not a change "
        "of exposure - the instruction must say where the light now comes from, or the model will "
        "only dim the picture and leave the old shadows sitting exactly where they were. Take the "
        "source from the user's brief if one is named; if none is, choose the one that fits the "
        "scene and commit to it - a bedside lamp low and to one side, a phone screen held below "
        "the face throwing cold blue up onto it, or street light coming through a window or "
        "blinds. Name that source, its position and its height, then build the whole frame off "
        "it: a warm falloff across the nearest surfaces, shadows deepening with every step away "
        "from it, the far side of the room dropping to near-black with the colour washing out of "
        "it, and speculars only where the source can physically reach. Require the shadows to be "
        "recomputed and redistributed - new shadows appearing where the new source casts them and "
        "the old ones gone - because a frame that is merely darker overall with its original "
        "shadow directions intact is an imitation of low light, not a relight. Add the camera's "
        "own behaviour at night: high-ISO sensor noise, heaviest in the shadows, and a slight "
        "softness from the longer handheld exposure. Colour drains out of the deep shadows as it "
        "really does, while her face keeps living skin tone wherever the light lands on it rather "
        "than going grey. Everything else survives and is named by type and position, not by "
        "appearance: the woman and her identity, her features, hair, pose and hands, her clothing "
        "and accessories, the room, the props and the framing are the ones already in the image - "
        "write none of her features out, since a preservation clause spelled out in detail reads "
        "as a generation instruction and drifts the face. Add no other operation and touch nothing "
        "that was not named. Phrase every requirement affirmatively, as what stays and what the "
        "new light does - never as what must not change, and never with 'no', 'without' or "
        "'avoid'."
        "Open the instruction with the operation in the imperative and give it all three parts - the "
        "verb, the thing being acted on, and the state it ends in, as in 'undress the woman in the "
        "image to full nude'. An instruction whose grammatical object is the picture rather than the "
        "thing being changed, such as 'change the image to daylight', lands as a mild global grade "
        "instead of the edit that was asked for. "
        "Output only the instruction, one paragraph."
    ),

    # --- Qwen-Image-2.1 MIX instructions (prefix Q21MIX_) ----------------------------------
    # MIX is the third mode, not a variant of the other two: the sampler starts on an empty
    # latent, so nothing is inherited, while the references ride along in the conditioning as
    # VAE `reference_latents` (comfy_extras/nodes_qwen.py: TextEncodeQwenImage21). Edit has a
    # canvas and t2i has no references; this has neither. Consequences the instruction below
    # encodes:
    #   * Composition, camera distance and framing are NOT inherited from anything. Whatever is
    #     not written is invented, and the frame geometry itself comes from reference #1.
    #   * Every reference reaches the model TWICE -- as a latent and as the words we write about
    #     it. For clothing and location that doubling helps. For a face it fights: spelled-out
    #     features make the model rebuild the face from the description instead of carrying it.
    #   * Measured on our own runs: the two prompts that worked carried NO <Image N> tags at all.
    "Q21MIX_from_refs": (
        "Write ONE Qwen-Image-2.1 image prompt that places the person from the identity "
        "reference into the scene the user asked for. The renderer starts from an empty canvas "
        "and the references travel with it as conditioning: they supply material, not a layout. "
        "Nothing survives on its own, so anything you leave unwritten is invented for you. "
        "The numbered roles handed to you tell you what to LOOK at. Use them to know which "
        "reference is which, then write plain prose: the finished prompt carries no <Image N> "
        "tags, no numbers and no mention of references at all. It reads as a description of a "
        "photograph that already exists. "
        "Treat each role differently, because they fail in opposite directions. "
        "IDENTITY: describe her in GENERAL terms, and never in facial detail. Her overall build "
        "belongs in the prompt and has to be there -- how tall she reads, her life stage, her "
        "figure, her hair colour and length, her skin tone: a tall young woman with an hourglass "
        "figure and long dark wavy hair. An identity reference is often cropped at the waist, and "
        "everything it does not show -- her height, her leg length, her proportion -- is invented "
        "for you unless you name it, so the general build is exactly what the words are for. What "
        "stays out of words entirely is the FACE: bone structure, cheekbones, jawline, eyes, "
        "brows, nose, mouth, hairline and skin texture. The likeness is carried by the reference, "
        "and spelling those out makes the model rebuild the face from your sentence instead of "
        "carrying it across. Where the user fixed a value -- a stated height, a named hair colour "
        "-- use theirs exactly and do not soften it. "
        "WARDROBE: the opposite. Walk the clothing reference item by item and name every garment "
        "with its type, its colour and its cut -- a cropped black long-sleeve top, a grey plaid "
        "pleated mini skirt, sheer black thigh-high stockings with lace tops, black patent "
        "stiletto heels. Those words are what lets the model find the right piece. Stop at type, "
        "colour and cut; leave weave, stitching and print detail to the reference. "
        "LOCATION: say what the place actually is and read it off the reference rather than off "
        "a generic idea of that kind of place -- its surfaces, its furniture, what stands where, "
        "how far the room runs back. "
        "POSE, if a reference carries one: describe the body position concretely -- where the "
        "weight sits, what each arm and hand is doing, where she is looking. "
        "Everything no reference carries you must write in full: the composition, where she "
        "stands in the frame, the camera distance, the framing, and the light with its source, "
        "direction and the shadows it leaves. "
        "State the camera distance and the crop explicitly -- a full-length frame from roughly "
        "two metres, a waist-up frame from roughly one metre. Scale is inherited from nothing "
        "here, and a tight identity reference will otherwise enlarge her head on a full-length "
        "shot. Keep the optical vocabulary consistent: a candid phone frame and a long portrait "
        "lens are different cameras and must not be mixed in one description. "
        "Invent no legible text. Signage, screens, whiteboards, posters and labels are called "
        "indistinct, blurred or too small to read unless the user actually asked for words, and "
        "then you write exactly the words they asked for and nothing else. "
        "Phrase everything affirmatively, as what is there -- never as what must not appear, and "
        "never with 'no', 'without' or 'avoid'. An unwanted object is displaced by naming the "
        "thing that occupies its place instead. Output only the prompt itself, as prose, with no "
        "labels, headers, commentary, reasoning or <think> blocks."
    ),

    # --- Q21MIX_turnaround -----------------------------------------------------------------
    # A viewpoint series off a fixed pair of references, for building a character sheet or a
    # training set. The shape is lifted from a dataset-generation workflow measured to hold
    # identity at cfg 3, and its whole trick is that ONLY the viewpoint moves: seven parts of
    # the instruction are constant across the series and the eighth is the angle.
    #
    # 🔴 Tags ARE used here, unlike Q21MIX_from_refs. Two references of the same face have
    # DIFFERENT jobs -- one carries identity, the other carries the geometry a front-on photo
    # physically does not contain -- and there is no way to say which is which without naming
    # them. The tagless rule in the other preset came from single-role reference sets.
    "Q21MIX_turnaround": (
        "Write ONE Qwen-Image-2.1 instruction for a single viewpoint of the SAME person, as one "
        "frame of a turnaround series. The point of the series is that every frame is identical "
        "except the angle, so write the constant parts the same way every time and change only "
        "the viewpoint sentence. "
        "Open with the medium and the crop: a new photorealistic head-and-shoulders portrait, "
        "waist-up portrait or full-length photograph of the same person shown in <image1> and "
        "<image2>, whichever the user asked for. "
        "Name what each reference is for. <image1> is the primary identity reference; <image2> "
        "is an additional reference for facial structure and geometry, and where it shows a "
        "different angle say so -- use the side-view information in <image2> to keep the facial "
        "geometry consistent. This is the whole reason there are two: a front-on photograph does "
        "not physically contain the geometry of a profile, so without the second reference the "
        "model invents it and the likeness drifts. State that both images are the exact same "
        "individual and that the identity is preserved at full fidelity. "
        "Then the one moving part: the viewpoint, stated in DEGREES and in plain geometry -- a "
        "clean left-side profile with the head rotated approximately ninety degrees and the gaze "
        "directed naturally forward; a right three-quarter view with the face turned roughly "
        "forty-five degrees and both eyes clearly visible; directly from the front, looking at "
        "the camera. Say which way the head turns from the subject's own point of view, not the "
        "viewer's, so a mirrored result cannot be blamed on the wording. "
        "Write the sentence 'Change only the viewpoint' as its own clause. It is the limiter "
        "that keeps the frame from drifting into a new photograph, and it is worth the words. "
        "Hold everything else with ONE blanket clause -- preserve all untargeted appearance from "
        "the reference images -- and do not itemise it. Listing hair, clothing and jewellery one "
        "by one reads to the model as an instruction to paint them fresh, which is exactly how a "
        "preserved element drifts. "
        "🔴 Her FACE stays out of words entirely: bone structure, cheekbones, jawline, eyes, "
        "brows, nose, mouth and hairline are carried by the references, and naming them makes "
        "the model rebuild the face from your sentence instead. "
        "Close with the background and the light, and take both FROM the references rather than "
        "inventing them -- the same plain wall and the same soft even lighting as in the "
        "reference images. A series shot against a background that changes per frame teaches "
        "whatever is trained on it that the background is part of the person. "
        "Phrase everything affirmatively, as what is there and what is kept. Output only the "
        "instruction, one paragraph, no labels, headers, commentary, reasoning or <think> blocks."
    ),
}

INSTRUCTION_NAMES = list(INSTRUCTION_PRESETS.keys())


def list_system_presets():
    """Dropdown values: 'Custom' plus every .txt from the bundled prompts/ and
    models/LLM/prompts/ (deduped by filename, user dir wins, case-insensitive sort)."""
    seen = set()
    for d in (BUNDLED_DIR, USER_DIR, BUNDLED_QWEN_DIR, USER_QWEN_DIR):
        try:
            if os.path.isdir(d):
                for fn in os.listdir(d):
                    if fn.lower().endswith(".txt"):
                        seen.add(fn)
        except Exception as e:
            print(f"[llm-prompter-v2] Could not list system presets in {d}: {e}")
    return ["Custom"] + sorted(seen, key=str.lower)


def list_ref_presets():
    """Dropdown values for ref_preset: 'Custom' plus every .txt from prompts/reference/ and
    models/LLM/prompts/reference/ (deduped by filename, user dir wins, case-insensitive sort)."""
    seen = set()
    for d in (BUNDLED_REF_DIR, USER_REF_DIR):
        try:
            if os.path.isdir(d):
                for fn in os.listdir(d):
                    if fn.lower().endswith(".txt"):
                        seen.add(fn)
        except Exception as e:
            print(f"[llm-prompter-v2] Could not list reference presets in {d}: {e}")
    return ["Custom"] + sorted(seen, key=str.lower)


def load_ref_preset(name):
    """Text of a reference preset, or None for 'Custom'/missing. User copy wins.

    Falls back to the flat prompts/ dir so a workflow saved before the split — when
    Face_Only_Identity_Im1.txt still lived there — keeps resolving instead of silently
    dropping to the built-in instruction.
    """
    if not name or name in ("Custom", "None"):
        return None
    # A bare file name only: this also answers an HTTP route, and a path here would read
    # any file the server can open.
    if os.path.basename(str(name)) != str(name):
        return None
    for d in (USER_REF_DIR, BUNDLED_REF_DIR, USER_DIR, BUNDLED_DIR):
        path = os.path.join(d, name)
        try:
            if os.path.isfile(path):
                with open(path, "r", encoding="utf-8") as f:
                    return f.read()
        except Exception as e:
            print(f"[llm-prompter-v2] Could not read reference preset {path}: {e}")
    return None


def load_system_preset(name):
    """Return the text of a .txt system preset, or None for 'Custom'/missing.
    Checks USER_DIR first (so a user copy overrides the bundled one), then BUNDLED_DIR."""
    if not name or name in ("Custom", "None"):
        return None
    # A bare file name only: this also answers an HTTP route, and a path here would read
    # any file the server can open.
    if os.path.basename(str(name)) != str(name):
        return None
    # User copies win over bundled ones, and the qwen/ subfolder is searched alongside the flat
    # dir so the dropdown value stays a bare filename -- a saved graph keeps resolving whichever
    # folder the preset later moves to.
    for d in (USER_DIR, USER_QWEN_DIR, BUNDLED_DIR, BUNDLED_QWEN_DIR):
        path = os.path.join(d, name)
        try:
            if os.path.isfile(path):
                with open(path, encoding="utf-8") as fh:
                    return fh.read()
        except Exception as e:
            print(f"[llm-prompter-v2] Could not read preset {name} from {d}: {e}")
    return None
