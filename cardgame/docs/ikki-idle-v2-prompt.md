# 一輝動畫小人 · 修訂版

生成方式：內建 `image_gen`，透明背景。

唯一人物參照：[使用者提供的動畫設定圖](../assets/references/ikki-anime.png)。

目標：先固定一張待機小人的動畫臉型、髮型與長袖制服，再以此作為後續動作參照。此前三姿勢版本因人物相似度不足，未選為定稿。

## 完整提示詞

```text
Use case: identity-preserve.
Asset type: ONE transparent full-body 2D battle character sprite for a game. This task is specifically to correct a prior failure of character likeness. Match the supplied ANIME MODEL SHEET closely, not a generic anime swordsman.
Input image 1 is the ONLY character reference: Ikki Kurogane (黑鐵一輝) official anime character sheet. The large face on the left-center is the primary facial likeness anchor; the full-body figure on the right is the exact costume and body reference. Treat the profile's words/stats/background as irrelevant.
Primary request: create a single clean full-body sprite of this EXACT anime Ikki, facing three-quarter RIGHT in a restrained battle-ready standing pose. This is not an action illustration. Preserve the anime reference's recognizable identity meticulously.
Highest priority — FACE AND HAIR: reproduce the reference's slender youthful angular face, narrow chin, gray-dark expressive eyes with the SAME eye shape, brow placement and spacing, small nose, calm understated mouth, reserved and earnest expression. Reproduce the distinctive BLACK hair silhouette and fringe from the reference: tousled triangular layered spikes, long irregular asymmetric bangs sweeping down across the forehead and beside the eyes, the prominent outward tufts on both sides, long pointed side locks. Do not replace with fluffy brown hair, a rounded baby face, oversized cute eyes, a smug smirk, or a generic sharp-eyed fantasy hero. Keep the source's hair volume and pointed tuft arrangement, source facial proportions. It must immediately read as the actual television-anime Ikki Kurogane.
COSTUME: copy the reference full-body outfit exactly. Fitted LONG-SLEEVED white school blazer, clean angular DOUBLE black piping, broad gray plaid angular lapel panels over black high-neck zip shirt, narrow waist, white blazer tails with correct black-edged geometry; black straight slim trousers, simple black shoes. No novel short sleeves, no decorative fantasy coat filigree, no added gold trim, no invented arm bands or extra decorations beyond those in the model sheet.
BODY: preserve the reference's normal slim anime proportions, roughly 7 heads tall. Not chibi, not muscular, not a childlike doll. Both feet fully visible, modest knee bend, torso nearly upright, shoulders relaxed. Show face clearly at a similar three-quarter angle to the supplied portrait, looking RIGHT. Hold a plain BLACK katana Intetsu naturally at a low ready angle toward the RIGHT, with entire blade visible within the image. Sword is secondary to accurate face and outfit.
STYLE: match the supplied television-animation model sheet's flat restrained cel shading, simple solid color fills, thin clean dark outlines, only one main shadow tone, clean matte color. Do NOT turn into glossy light-novel cover art, painterly splash art, 3D, or hyper-detailed fan illustration. At 250px on screen silhouette should remain clear, face recognizable.
COMPOSITION: exactly ONE character only, vertically centered full-body, at least 8% transparent empty margin around head, sword and shoes. Portrait or square canvas as needed to fit the full sword. No duplicates, no sprite sheet, no extra poses, no facial close-up inset.
BACKGROUND: genuinely transparent alpha, all non-character pixels transparent. NO painted black backdrop, NO gray gradient, NO glow cloud, NO fog, NO aura, NO shadow, NO checkerboard graphic, NO floor. No typography, UI, numbers, frames, watermark, logos. Preserve clean opaque character colors and fine alpha edges.
Quality check: exact character likeness and anime uniform first; no spectacle. Treat this as faithful preparation of the supplied anime character for a small movable game actor.
```
