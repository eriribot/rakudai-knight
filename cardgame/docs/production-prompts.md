# 早期立繪與場景提示詞（歷史紀錄）

一輝 v3 已因外形問題淘汰。現用完整側身人物與動作的提示詞見 `ikki-unified-profile-prompts.md`；史黛菈動作見 `motion-prompts.md`。以下保留早期立繪與目前場景的生成紀錄，模式均為內建 image_gen。

## 一輝 v3 — assets/ikki-idle-v3.png

```text
Make ONE faithful full-body cutout game sprite of Ikki Kurogane from the 2015 TV anime, based on these real anime references. Transparent PNG.
REFERENCE PRIORITY:
1. Image 1 (small face close-up supplied by the user) is the EXACT FACE to reproduce. Preserve the shape and expression of this specific face; do not redesign it.
2. Image 2 is the clean official anime model sheet. Its right-hand full-body figure determines the exact LONG-SLEEVED white/black uniform, plaid lapels, slim body and black trousers/shoes.
3. Image 3 (anime episode 4 still, Ikki is the dark-haired boy ON THE LEFT) confirms the gentle eyes, cheek width and compact youthful lower face. The white-haired character is irrelevant and must not appear.
4. Image 4 (anime episode 1 sword pose) is only a weapon reference, not the facial expression.
FACE MUST MATCH IMAGE 1: keep the head nearly FRONTAL like the supplied face, eyes approximately level, soft relaxed upper lids, the same gray-brown irises and eye spacing, cheeks with visible width and gentle volume, SHORT lower face, small chin with a gentle taper, tiny closed-mouth friendly smile, simple short angular anime nose mark. The prior failure made the face long, gaunt, mature and aggressively pointed: do the opposite, using the actual reference outline. No long nose, no long neck, no projecting chin, no frowning V eyebrows. Do not make him a generic handsome stoic swordsman.
HAIR: directly follow Image 1's broad asymmetric dark hair masses, off-center long diagonal central bang, broad outward side tufts and relatively low crown. No tall spiky crown, no thin needle-like hair spikes, no glossy strands.
POSE: only one complete character, facing mostly forward, body slightly turned toward the RIGHT, feet shoulder-width apart, calm ready stance. One hand holds a black katana at a low diagonal toward the RIGHT. His face remains almost frontal so the exact likeness is visible. Keep entire sword and both shoes inside the canvas, with generous transparent margin. Normal anime teenager proportions matching the official standing reference, not chibi.
UNIFORM: exact official television-anime outfit, white long sleeves, narrow black piping, black high zipped collar, gray plaid lapels, official black bands on upper sleeves, long fitted jacket panels, black straight trousers, black shoes. Do not invent fantasy emblems.
ART: directly match the simple flat cel-painted TV anime look of Image 1. Thin crisp outlines, restrained one-step shadows, matte fills. No glossy painting, no cinematic light, no dramatic shadows, no novel-cover style.
Output one single full-body character on TRUE transparent background. No other characters, no duplicate pose, no collage, no text, no stat panel, no border, no watermark, no background, no aura, no fog, no glow cloud, no ground shadow. Empty pixels transparent; character colors solid and opaque. Main goal is preserving the user's exact face drawing, not elaborating it.
```

## 史黛菈 — assets/stella-idle.png

```text
Create one single full-body transparent PNG game battle sprite of Stella Vermillion from the 2015 Chivalry of a Failed Knight TV anime. Use the provided official ANIME MODEL SHEET: preserve the right-hand standing figure's face, red twin tails with yellow-green bows, and exact black-white school uniform with purple ribbon, gray plaid collar, fitted black bodice, white sleeves with black upper-arm bands, black skirt with white piping, dark thigh-high stockings, black short boots and long white coat tails.
A small movable 2D battle actor, not a poster. Normal anime proportions. Full body head to shoes, all hair and sword visible. Stand in a battle-ready pose with body facing three-quarter LEFT and face mostly forward, determined eyes and slight confident smile. Hold an ornate GOLDEN BROADSWORD with dark filigree close to her body diagonally upward toward the LEFT. Keep sword and ribbons fully inside canvas with clear margin. Absolutely only one character and one pose.
Art style closely matches the actual reference's flat television-anime cel shading, clear dark lines, solid matte colors, simple one-step shadows. No painterly glossy splash art. Fully clothed action presentation.
TRUE transparent background/alpha; no floor, no shadow, no glow, no fire aura, no gradient, no checkerboard, no text, no stats, no watermark. Keep character fully opaque with clean alpha edges. Portrait composition, feet near bottom of canvas and full silhouette usefully large.
```

## 空競技場 — assets/arena-duel.png

```text
Use case: stylized-concept.
Asset type: empty background layer for a side-view 2D anime card-battle game.
Primary request: an EMPTY magical academy training arena inspired by the television anime Chivalry of a Failed Knight. Wide 16:9 establishing view at dusk. Centered symmetrical composition with a distant monumental academy stadium, tiers of quiet empty seating, lit arches, blue evening sky, warm lights. Broad flat stone combat platform spans lower half of frame, ground viewed at a shallow side-scroller angle. The left and right positions at x=27% and x=73%, y=72% are flat uncluttered ground where separately rendered small combat sprites will stand.
Art style: Japanese television anime painted background, elegant atmospheric architecture, clean shapes, controlled detail, blue-gray and muted gold palette. Not photorealistic, no dramatic battle effects. Keep wide central negative space, depth and calm arena scale; atmospheric blue light left and a subtle warmer glow right.
Constraints: ZERO characters, ZERO people, ZERO creatures, NO weapons, NO fire bursts or foreground obstructions, NO text, NO labels, NO UI, NO cards, NO watermark. Ground must be visible and usable for 2D actors. Fully opaque.
```

## 卡牌圖像 — assets/skill-atlas.png

```text
Use case: stylized-concept.
Asset type: a single horizontal 5-panel skill-card artwork atlas for an anime sword duel card game.
Primary request: five DISTINCT rectangular artworks side by side in an evenly spaced one-row strip, equal exact-width cells, no gaps, no borders, all sharing premium dark navy and antique-gold anime painterly style. Overall canvas very wide 3:1, with each cell aspect ratio 3:5. Each illustration fills its cell edge to edge.
Panel 1: close-up dark katana slicing diagonally through icy blue sparks, powerful silver crescent arc, dark midnight blue background.
Panel 2: elegant circular turquoise energy shield struck by orange embers, rippling concentric energy, navy background.
Panel 3: extreme close-up of one focused gray-violet anime eye beneath strands of black hair, analytical thin blue light arcs.
Panel 4: black katana redirecting a golden blade with a burst of blue and amber sparks at their intersection, tense crossed-sword composition.
Panel 5: silhouette of a fully clothed black-haired swordsman dissolving into a brilliant vertical golden-white slash, amber light rays and dark speed lines, spectacular finishing-move aura.
Composition: 5 different visual motifs, each centered in its own exact one-fifth cell, simple readable focal silhouette, anime visual effects concept art, cinematic colors. Keep each panel independent. No female characters, no text, no card UI, no labels, no numbers, no border, no watermark.
```
