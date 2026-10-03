# 一輝：完整側身模型重製

最終素材：`assets/ikki-unified-profile.png`（完整人物母版）、`assets/ikki-unified-motion.png`（動作圖）。頭身使用同一張完整繪圖，不接入已淘汰的分離頭部圖層。

使用者否定分離頭身的光影、線條及銜接。此版本重新生成一個完整人物，頭部與身體在同一張素材內，不使用 CSS 拼接頭部。

模式：內建 image_gen；透明 alpha。
輸入：動畫第 5 集側臉裁圖（使用者要求從動畫截取），以及動畫官方制服設計圖。
側臉原始來源：https://ittoshura.com/story/img/onair_p05_6.jpg
制服來源：https://ittoshura.com/character/chara_ikki.jpg

## 完整人物母版

Use case: identity-preserve. Create ONE unified, complete full-body 2D anime battle character of Ikki Kurogane facing SCREEN RIGHT, on a genuinely transparent alpha background. This is a clean character-model master for a game, not a collage and not a sprite sheet.
Input 1 is the actual anime side-profile face crop and is the PRIMARY identity and viewing-angle reference. Input 2 is the anime official character design sheet: use its rightmost full-body figure ONLY for white long-sleeved uniform, gray lapels, black piping, black undershirt, black trousers, shoes, and slender body proportions. Ignore all text and other figures.
Draw the ENTIRE person in a SINGLE consistent 2015 TV anime cel-animation rendering, with one line thickness, one neutral palette and one coherent soft frontal light. Reconstruct the head and body together with a natural neck/collar connection; do NOT paste a photographic-looking cropped head onto a different body. Preserve the first input's exact recognizable right-facing side-face design: narrow understated gray-brown visible eye under heavy diagonal black bangs, modest straight nose profile, closed neutral mouth, subtle short chin, black slightly tousled silhouette with long side locks. Keep the same hairstyle, bang direction, eye shape and calm serious temperament; do not turn it into a generic smiling anime boy. Remove the source frame's pink/green lighting from the entire design and consistently shade skin, hair and uniform in neutral anime colors.
Pose: head AND torso both turned toward the right in a coherent three-quarter side-view, torso only slightly toward camera. Upright slender swordsman with a slight forward readiness, relaxed bent knees, one foot a small step forward. A compact believable fencing guard, not an exaggerated wide squat. Hold his black katana Intetsu with both hands in front of his waist; sword blade angles forward toward right, slightly down, with whole tip visible. The sword has a restrained dark guard, black blade with thin silver edge. Do not look toward the viewer. Human anime proportions about 7 to 7.5 heads tall, head naturally proportioned to shoulders, slim youthful build, fully clothed, no chibi proportions.
One figure only, crown to soles and the whole sword inside frame with 5% breathing room, no extra heads or inset portraits. Flat clean cel shading and crisp outlines throughout. No glow, shadow on ground, gradient backdrop, text, grid, scenery, speed lines or effects. Transparent output. Do not use any previously generated Ikki or pasted-head sprites as a reference; use only these two original anime inputs.

