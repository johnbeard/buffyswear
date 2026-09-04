/* Layout data recovered from the original Flash movie (buffy.swf).

   The Flash stage is 507x429 px. The background canvas used here is
   508x430 px (it carries a 1 px bleed on the right/bottom), so every overlay
   is positioned in a 508x430 logical space and converted to percentages at
   runtime.

   Each entry describes where the rendered swear-word sprite for a key sits on
   the stage. Coordinates and sizes are in stage pixels and were verified by
   re-compositing all words over the background and diffing against the
   decompiled reference frame. */

export const STAGE = { width: 508, height: 430 };

export const IMAGE_BASE = "static/images";
export const WORD_IMAGE_BASE = `${IMAGE_BASE}/swear_sprites`;
export const SOUND_BASE = `${IMAGE_BASE}/swear_sounds`;

/* The "Mouth" overlay: a pixelated close-up of Buffy's open mouth that the
   original movie showed while a key was held down. */
export const MOUTH = {
  src: `${IMAGE_BASE}/mouth.png`,
  x: 391,
  y: 139,
  w: 48,
  h: 42,
};

/* Keyed by the logical key name ('a'..'z' and 'space'). */
export const WORDS = {
  a: { x: 60, y: 207, w: 403, h: 170 },
  b: { x: 58, y: 212, w: 423, h: 171 },
  c: { x: 49, y: 216, w: 424, h: 165 },
  d: { x: 82, y: 205, w: 347, h: 195 },
  e: { x: 100, y: 216, w: 296, h: 158 },
  f: { x: 114, y: 205, w: 257, h: 154 },
  g: { x: 109, y: 170, w: 287, h: 192 },
  h: { x: 89, y: 177, w: 329, h: 222 },
  i: { x: 71, y: 214, w: 359, h: 160 },
  j: { x: 37, y: 248, w: 436, h: 93 },
  k: { x: 79, y: 210, w: 357, h: 164 },
  l: { x: 140, y: 239, w: 230, h: 110 },
  m: { x: 7, y: 159, w: 491, h: 276 },
  n: { x: 92, y: 217, w: 324, h: 163 },
  o: { x: 49, y: 217, w: 423, h: 162 },
  p: { x: 37, y: 217, w: 458, h: 176 },
  q: { x: 86, y: 225, w: 334, h: 158 },
  r: { x: 66, y: 229, w: 373, h: 152 },
  s: { x: 10, y: 226, w: 482, h: 157 },
  space: { x: 10, y: 227, w: 474, h: 139 },
  t: { x: 115, y: 232, w: 276, h: 115 },
  u: { x: 31, y: 202, w: 432, h: 185 },
  v: { x: 51, y: 220, w: 401, h: 143 },
  w: { x: 65, y: 188, w: 361, h: 203 },
  x: { x: 15, y: 143, w: 473, h: 308 },
  y: { x: 90, y: 149, w: 335, h: 283 },
  z: { x: 68, y: 165, w: 380, h: 254 },
};

/* Clickable hit areas, one per sworn key, positioned over the keyboard keys
   drawn in the background artwork. Measured from the artwork (letter keys sit
   in three staggered rows; the space bar is the wide key below). Coordinates
   and sizes are stage pixels, verified by overlaying the boxes on the image. */
export const KEY_HITS = {
  q: { x: 43, y: 280, w: 29, h: 29 },
  w: { x: 76, y: 280, w: 29, h: 29 },
  e: { x: 109, y: 280, w: 30, h: 29 },
  r: { x: 143, y: 280, w: 29, h: 29 },
  t: { x: 176, y: 280, w: 28, h: 29 },
  y: { x: 209, y: 280, w: 29, h: 29 },
  u: { x: 243, y: 280, w: 29, h: 29 },
  i: { x: 276, y: 280, w: 29, h: 29 },
  o: { x: 311, y: 280, w: 28, h: 29 },
  p: { x: 343, y: 280, w: 29, h: 29 },
  a: { x: 52, y: 313, w: 28, h: 29 },
  s: { x: 84, y: 313, w: 29, h: 29 },
  d: { x: 118, y: 313, w: 29, h: 29 },
  f: { x: 151, y: 313, w: 29, h: 29 },
  g: { x: 185, y: 313, w: 29, h: 29 },
  h: { x: 217, y: 313, w: 29, h: 29 },
  j: { x: 250, y: 313, w: 30, h: 29 },
  k: { x: 285, y: 313, w: 29, h: 29 },
  l: { x: 318, y: 313, w: 29, h: 29 },
  z: { x: 68, y: 346, w: 29, h: 29 },
  x: { x: 102, y: 346, w: 28, h: 29 },
  c: { x: 134, y: 346, w: 30, h: 29 },
  v: { x: 169, y: 346, w: 27, h: 29 },
  b: { x: 201, y: 346, w: 29, h: 29 },
  n: { x: 234, y: 346, w: 29, h: 29 },
  m: { x: 267, y: 346, w: 30, h: 29 },
  space: { x: 151, y: 379, w: 163, h: 29 },
};

/* Decorative indicator LEDs on the keyboard bezel. The original movie cycled
   four pre-drawn stills; here the LEDs are drawn live as small red dots that
   chase left to right and then switch off. Each entry in `frames` lists which
   LED indices are lit for that state. Centres and diameter are in background
   image pixels. */
export const LEDS = {
  centers: [
    { x: 387, y: 208 },
    { x: 415, y: 208 },
    { x: 444, y: 208 },
  ],
  diameter: 4,
  intervalMs: 200,
  frames: [[0], [1], [2], []],
};
/* Red lens-flare bursts that light up over Buffy's eyes while the 0 key is
   held. `centers` are the eye positions in background-image pixels. Each
   burst is drawn as a soft red/white lens flare: a bright core with a long,
   blurred horizontal streak and a shorter vertical one. `width`/`height` is
   the drawing box (px) that the flare fills. */
export const EYES = {
  centers: [
    { x: 400, y: 100 },
    { x: 440, y: 106 },
  ],
  width: 40,
  height: 22,
};