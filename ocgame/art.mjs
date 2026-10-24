// Whole-image coordinates, measured from the shipped RGBA sources.
// Both poses share the same source-pixel scale. The anchor is the ground/stance centre.
export const STELLA_ART = Object.freeze({
  baseHeight: 1160,
  ready: {
    src: "assets/stella-front-ready-v5.png",
    size: [1254, 1254],
    anchor: [694, 1240],
    flame: [
      "M520 705 490 748 468 739 464 787 422 809 417 780 385 848 349 858 351 827 306 910 270 927 274 895 222 991 181 1014 188 980 126 1088 38 1206 151 1100 176 1102 205 1058 228 1075 278 1002 309 994 319 956 350 952 386 899 420 891 442 839 480 824 506 768Z",
      "M521 724 435 837 451 787 352 936 366 890 265 1023 284 976 38 1206 284 1006 424 861Z",
    ],
  },
  cut: {
    src: "assets/stella-front-cut-v5.png",
    size: [1254, 1254],
    anchor: [727, 1231],
    flame: [
      "M530 581 503 535 477 533 464 482 433 481 429 438 391 418 391 380 343 359 344 318 300 305 290 263 241 236 237 201 191 183 177 143 131 125 28 61 127 174 132 213 176 228 188 266 238 280 255 319 301 345 313 385 358 408 377 452 423 469 441 511 488 557Z",
      "M524 579 436 465 463 475 368 390 392 391 290 299 317 303 28 61 296 331 442 497Z",
    ],
  },
});

export function registerStella(root) {
  for (const pose of ["ready", "cut"]) {
    const spec = STELLA_ART[pose];
    const cell = root.querySelector(`.sprite-cell.${pose}`);
    cell.style.backgroundImage = `url("${spec.src}")`;
    for (const [key, value] of Object.entries({
      "source-w": spec.size[0],
      "source-h": spec.size[1],
      "anchor-x": spec.anchor[0],
      "anchor-y": spec.anchor[1],
    }))
      cell.style.setProperty(`--${key}`, value);
    // Vector fire follows the measured blade, not the face or body.
    cell.innerHTML = `<svg class="weapon-flame" viewBox="0 0 ${spec.size.join(" ")}" aria-hidden="true">${spec.flame.map((d) => `<path d="${d}"/>`).join("")}</svg>`;
  }
}
