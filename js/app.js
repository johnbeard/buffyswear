/* Buffy's Swearing Keyboard - HTML5 remake.
   A vanilla ES-module port of the Flash behaviour:

   - key down on A-Z or Space: show that swear-word sprite over the keyboard,
     open Buffy's mouth, and play the key's sound clip;
   - releasing a held swear key stops its repeats, but the word itself is not
     blanked instantly: a short grace period lets a quick re-press of the SAME
     key keep the word visible without it blinking off and on, and the word
     hides shortly after you stop pressing;
   - the keys drawn in the artwork double as clickable hit areas, so mouse and
     touch users can press them directly (no separate keyboard component);
   - three decorative indicator LEDs on the keyboard bezel chase left to right
     and blink off, driven by a small state machine (see js/leds.js);
   - pressing the 0 key lights a red laser starburst over each of Buffy's eyes
     while the key is held;
   - optional "use swearqueue" mode (checkbox below the stage): each press
     collects a letter into a queue that Buffy then plays back one entry at a
     time, so rapid typing is never cut short (see js/queue.js).
*/

import {
  STAGE,
  WORD_IMAGE_BASE,
  SOUND_BASE,
  MOUTH,
  WORDS,
  KEY_HITS,
  LEDS,
  EYES,
} from "./data.js";
import { LedStateMachine } from "./leds.js";
import { SwearQueue } from "./queue.js";

const stageEl = document.getElementById("stage");
const queueToggle = document.getElementById("useSwearQueue");
const queueText = document.getElementById("queueText");
const queueStatus = document.getElementById("queueStatus");

/* Canonical pending-queue text last rendered into the queue field. New input
   is fired by diffing the field against this, so backlog letters are never
   re-fired. */
let queueAnchor = "";

/* Remember the queue-mode checkbox across loads so the setting survives a
   page reload (and, with localStorage, later visits). */
const QUEUE_STORAGE_KEY = "buffyswear.queueMode";

function readQueueSetting() {
  try {
    return localStorage.getItem(QUEUE_STORAGE_KEY) === "1";
  } catch {
    return false; // storage unavailable (private mode etc.)
  }
}

function writeQueueSetting(enabled) {
  try {
    if (enabled) {
      localStorage.setItem(QUEUE_STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(QUEUE_STORAGE_KEY);
    }
  } catch {
    /* storage unavailable; ignore */
  }
}

/* Logical stage pixels -> percentages so overlays track the scaled stage. */
const pctX = (v) => (v / STAGE.width) * 100;
const pctY = (v) => (v / STAGE.height) * 100;

const state = {
  held: new Set(), // keys currently producing a visible word
  repeatOn: new Set(), // held keys whose clip should keep repeating
  clickTimers: new Map(), // letter -> auto-hide timer for click activation
  pointerOwners: new Map(), // pointerId -> letter
};

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

function makeOverlay({ src, box, kind, letter }) {
  const img = document.createElement("img");
  img.className = `stage__layer stage__layer--${kind}`;
  img.src = src;
  img.alt = "";
  img.width = box.w;
  img.height = box.h;
  if (letter) img.dataset.letter = letter;
  img.style.left = `${pctX(box.x)}%`;
  img.style.top = `${pctY(box.y)}%`;
  img.style.width = `${pctX(box.w)}%`;
  img.style.height = `${pctY(box.h)}%`;
  stageEl.appendChild(img);
  return img;
}

const mouthEl = makeOverlay({ src: MOUTH.src, box: MOUTH, kind: "mouth" });

const wordEls = {};
for (const [letter, box] of Object.entries(WORDS)) {
  wordEls[letter] = makeOverlay({
    src: `${WORD_IMAGE_BASE}/${letter}.png`,
    box,
    kind: "word",
    letter,
  });
}

/* ------------------------------------------------------------------ */
/* Audio                                                               */
/* ------------------------------------------------------------------ */

/* Every utterance plays on its own fresh <audio> element. That lets quick,
   repeated presses in live mode overlap instead of the later press cutting
   the earlier clip short (a single shared element can only restart). The
   clips are tiny and served locally, so the cost is negligible.

   When an utterance finishes it reports back through handleClipEnded(), which
   either starts the next queued entry (queue mode) or, in live mode, starts
   the clip again while its key is still held down (repeat while held). */
function playSound(letter) {
  const audio = new Audio(`${SOUND_BASE}/${letter}.mp3`);
  audio.preload = "auto";
  audio.addEventListener("ended", () => handleClipEnded(letter));
  audio.play().catch(() => {
    /* Autoplay can be rejected before the first user gesture; ignore. */
  });
}

/* Warm the HTTP cache so the first press of each key starts instantly. */
for (const letter of Object.keys(WORDS)) {
  const warm = new Audio(`${SOUND_BASE}/${letter}.mp3`);
  warm.preload = "auto";
}

/* ------------------------------------------------------------------ */
/* Activation model                                                    */
/* ------------------------------------------------------------------ */

function clearClickTimer(letter) {
  const timer = state.clickTimers.get(letter);
  if (timer) {
    clearTimeout(timer);
    state.clickTimers.delete(letter);
  }
}

function setMouth(open) {
  mouthEl.classList.toggle("is-active", open);
}

function activate(letter, { repeat = true } = {}) {
  if (state.held.has(letter)) return;
  state.held.add(letter);
  if (repeat) state.repeatOn.add(letter);
  clearClickTimer(letter);
  /* Live mode shows one word at a time: the most recently pressed key, so
     switching keys replaces the overlay instead of stacking words. */
  hideWords();
  wordEls[letter].classList.add("is-active");
  setMouth(true);
  playSound(letter);
}

function deactivateLetter(letter) {
  if (!state.held.has(letter)) return;
  state.held.delete(letter);
  state.repeatOn.delete(letter);
  clearClickTimer(letter);
  wordEls[letter].classList.remove("is-active");
  if (state.held.size === 0) setMouth(false);
}

/* The original movie hid every word and the mouth on ANY key release. */
function deactivateAll() {
  if (state.held.size === 0) return;
  for (const letter of [...state.held]) deactivateLetter(letter);
}

/* A click (no hold) shows the word for a moment, roughly the clip length. */
function activateFromClick(letter) {
  if (state.held.has(letter)) return;
  activate(letter, { repeat: false });
  const timer = setTimeout(() => deactivateLetter(letter), 700);
  state.clickTimers.set(letter, timer);
}

/* ------------------------------------------------------------------ */
/* Swear queue (optional queue-driven playback)                        */
/* ------------------------------------------------------------------ */

/* In queue mode every press appends a letter to the pending string shown
   below the stage; Buffy plays the queue back one entry at a time. Holds add
   a letter once only (browser auto-repeat is filtered in the key handler). */
function isQueueMode() {
  return queueToggle.checked;
}

function showWord(letter) {
  wordEls[letter].classList.add("is-active");
}

function hideWords() {
  for (const el of Object.values(wordEls)) el.classList.remove("is-active");
}

const swearQueue = new SwearQueue({
  onChange: (items) => {
    /* The pending queue is mirrored into the composer field so it shows the
       letters still waiting to be spoken (they drop off the front as each
       clip starts), and announced to assistive tech. */
    queueAnchor = items.map((key) => (key === "space" ? " " : key)).join("");
    queueStatus.textContent = queueAnchor;
    queueText.value = queueAnchor;
  },
  onPlay: (letter) => {
    hideWords();
    showWord(letter);
    setMouth(true);
    playSound(letter);
  },
  onDrain: () => {
    hideWords();
    setMouth(false);
  },
});

/* A finished clip either advances the queue (queue mode) or keeps a held key
   swearing (live mode). */
function handleClipEnded(letter) {
  if (isQueueMode()) {
    swearQueue.advance();
    return;
  }
  if (state.held.has(letter) && state.repeatOn.has(letter)) {
    playSound(letter);
  }
}

/* A key "press" queues the letter (queue mode) or swears it immediately,
   holding while the key stays down (live mode). */
function pressKey(letter) {
  if (isQueueMode()) {
    swearQueue.enqueue(letter);
  } else {
    cancelLiveRelease();
    activate(letter);
  }
}

function pressKeyFromClick(letter) {
  if (isQueueMode()) {
    swearQueue.enqueue(letter);
  } else {
    cancelLiveRelease();
    activateFromClick(letter);
  }
}

/* In live mode a released key stops repeating right away, but its word stays
   visible for a short grace period. If the same (or a different) key is
   pressed again within that window the pending hide is cancelled, so rapidly
   tapping one key never makes the word blink off and on; if nothing follows
   the release, the word hides once the grace period elapses. */
const LIVE_RELEASE_DELAY_MS = 250;
let liveReleaseTimer = null;

function cancelLiveRelease() {
  if (liveReleaseTimer !== null) {
    clearTimeout(liveReleaseTimer);
    liveReleaseTimer = null;
  }
}

function releaseLiveKey(letter) {
  if (isQueueMode()) return;
  state.held.delete(letter);
  state.repeatOn.delete(letter);
  clearClickTimer(letter);
  cancelLiveRelease();
  liveReleaseTimer = setTimeout(() => {
    liveReleaseTimer = null;
    if (state.held.size === 0) {
      hideWords();
      setMouth(false);
    }
  }, LIVE_RELEASE_DELAY_MS);
}

/* Switching modes must not strand live or queued state. */
queueToggle.addEventListener("change", () => {
  writeQueueSetting(queueToggle.checked);
  cancelLiveRelease();
  deactivateAll();
  swearQueue.clear();
  hideWords();
  setMouth(false);
  /* The composer exists only in queue mode. */
  const queueOn = isQueueMode();
  queueText.hidden = !queueOn;
  queueText.disabled = !queueOn;
  queueText.value = "";
  queueAnchor = "";
  if (!queueOn && document.activeElement === queueText) queueText.blur();
  /* Return focus to the page so the main keyboard drives the app (the queue
     must keep receiving key events after the checkbox is ticked). */
  queueToggle.blur();
});

/* Restore the persisted queue-mode setting on load so the queue composer is
   already visible when the checkbox was left enabled. Always sync (not just
   when unchecked): some browsers restore a checkbox's form state on reload
   without firing a change event, which would otherwise leave the box ticked
   but the composer hidden. */
queueToggle.checked = readQueueSetting();
queueToggle.dispatchEvent(new Event("change"));

/* ------------------------------------------------------------------ */
/* Clickable key hotspots over the artwork                             */
/* ------------------------------------------------------------------ */

/* Each button sits exactly over one key drawn in the background image and
   behaves like the physical key: press to start swearing, release to stop. */
function buildHotspots() {
  for (const [letter, hit] of Object.entries(KEY_HITS)) {
    const keyEl = document.createElement("button");
    keyEl.type = "button";
    keyEl.className = "key-hotspot";
    keyEl.dataset.letter = letter;
    const label =
      letter === "space" ? "Space bar" : `Key ${letter.toUpperCase()}`;
    keyEl.setAttribute("aria-label", label);
    keyEl.title = label;
    keyEl.style.left = `${pctX(hit.x)}%`;
    keyEl.style.top = `${pctY(hit.y)}%`;
    keyEl.style.width = `${pctX(hit.w)}%`;
    keyEl.style.height = `${pctY(hit.h)}%`;
    attachHotspotHandlers(keyEl, letter);
    stageEl.appendChild(keyEl);
  }
}

function attachHotspotHandlers(keyEl, letter) {
  keyEl.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return; // primary button / touch only
    event.preventDefault();
    try {
      keyEl.setPointerCapture?.(event.pointerId);
    } catch {
      /* No active pointer (e.g. synthetic events); hold still works. */
    }
    state.pointerOwners.set(event.pointerId, letter);
    keyEl.dataset.pointerHandled = "1";
    keyEl.classList.add("is-held");
    pressKey(letter);
  });

  const releasePointer = (event) => {
    if (state.pointerOwners.get(event.pointerId) !== letter) return;
    state.pointerOwners.delete(event.pointerId);
    keyEl.classList.remove("is-held");
    /* A tap must not leave the key with a lingering focus ring: touch taps
       focus the button and the highlight would stay until another tap.
       Keyboard activation (Enter/Space) never reaches here, so assistive
       users keep their visible focus ring. */
    keyEl.blur();
    releaseLiveKey(letter);
  };

  keyEl.addEventListener("pointerup", releasePointer);
  keyEl.addEventListener("pointercancel", releasePointer);
  keyEl.addEventListener("lostpointercapture", releasePointer);

  /* Enter / Space on a focused hotspot (assistive tech, keyboard users). */
  keyEl.addEventListener("click", () => {
    if (keyEl.dataset.pointerHandled === "1") {
      delete keyEl.dataset.pointerHandled;
      return;
    }
    pressKeyFromClick(letter);
  });

  /* Keep long-press on touch from opening the browser context menu. */
  keyEl.addEventListener("contextmenu", (event) => event.preventDefault());
}

/* ------------------------------------------------------------------ */
/* Decorative indicator LEDs                                          */
/* ------------------------------------------------------------------ */

/* Small round dots placed over the three indicator lights drawn on the
   keyboard bezel. The LedStateMachine (js/leds.js) cycles which one is lit. */
function buildLeds() {
  const leds = [];
  for (const center of LEDS.centers) {
    const led = document.createElement("span");
    led.className = "led";
    led.style.left = `${pctX(center.x)}%`;
    led.style.top = `${pctY(center.y)}%`;
    led.style.width = `${pctX(LEDS.diameter)}%`;
    led.style.height = `${pctY(LEDS.diameter)}%`;
    stageEl.appendChild(led);
    leds.push(led);
  }
  return leds;
}

/* ------------------------------------------------------------------ */
/* "0" key: red lens-flare bursts over Buffy's eyes                    */
/* ------------------------------------------------------------------ */

/* Pressing 0 lights a small soft red lens flare on each eye. They stay lit
   while the key is held and for a short grace period after, so quick taps
   do not make them flicker.

   Note: shapes that carry a Gaussian-blur filter must be rects or circles.
   Chromium (and librsvg) do not paint <line> elements with filters because
   a line has no area, so every blurred streak below is a thin rect. */
let eyeReleaseTimer = null;

function cancelEyeRelease() {
  if (eyeReleaseTimer !== null) {
    clearTimeout(eyeReleaseTimer);
    eyeReleaseTimer = null;
  }
}

function buildEyeFlares() {
  const flares = [];
  const svgNS = "http://www.w3.org/2000/svg";
  EYES.centers.forEach((eye, index) => {
    const W = EYES.width;
    const H = EYES.height;
    const cx = W / 2;
    const cy = H / 2;
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "eye-flare__svg");
    svg.setAttribute("aria-hidden", "true");

    const defs = document.createElementNS(svgNS, "defs");
    const addFilter = (name, std) => {
      const filter = document.createElementNS(svgNS, "filter");
      filter.setAttribute("id", `${name}-${index}`);
      filter.setAttribute("x", "-100%");
      filter.setAttribute("y", "-100%");
      filter.setAttribute("width", "300%");
      filter.setAttribute("height", "300%");
      const blur = document.createElementNS(svgNS, "feGaussianBlur");
      blur.setAttribute("stdDeviation", String(std));
      filter.appendChild(blur);
      defs.appendChild(filter);
    };
    /* Soft, mid, tight and fine blur levels for the lens flare. */
    addFilter("flare-soft", 1.6);
    addFilter("flare-mid", 0.9);
    addFilter("flare-tight", 0.4);
    addFilter("flare-fine", 0.18);
    svg.appendChild(defs);

    const add = (name, attrs) => {
      const el = document.createElementNS(svgNS, name);
      for (const [key, value] of Object.entries(attrs)) {
        el.setAttribute(key, value);
      }
      svg.appendChild(el);
    };
    /* Centred horizontal/vertical streak as a thin rounded rect. */
    const hStreak = (x1, x2, y, h, rx, fill, opacity, filter) =>
      add("rect", {
        x: Math.min(x1, x2),
        y,
        width: Math.abs(x2 - x1),
        height: h,
        rx,
        fill,
        opacity,
        filter,
      });
    const vStreak = (x, y1, y2, w, rx, fill, opacity, filter) =>
      add("rect", {
        x,
        y: Math.min(y1, y2),
        width: w,
        height: Math.abs(y2 - y1),
        rx,
        fill,
        opacity,
        filter,
      });
    const soft = `url(#flare-soft-${index})`;
    const mid = `url(#flare-mid-${index})`;
    const tight = `url(#flare-tight-${index})`;
    const fine = `url(#flare-fine-${index})`;

    /* Wide, very soft red smear behind everything. */
    add("circle", {
      cx,
      cy,
      r: 6.5,
      fill: "#ff2b39",
      opacity: 0.32,
      filter: soft,
    });
    /* Horizontal streak is the hero: a long blurred bar with a brighter
       core line down its middle, like a horizontal lens flare. */
    hStreak(1, W - 1, cy - 2.0, 4.0, 2.0, "#ff2b39", 0.55, soft);
    hStreak(3, W - 3, cy - 1.4, 2.8, 1.4, "#ff3344", 0.9, mid);
    hStreak(8, W - 8, cy - 0.7, 1.4, 0.7, "#ffd9dc", 0.95, fine);
    /* Shorter, softer vertical streak. */
    vStreak(cx - 1.1, cy - 5, cy + 5, 2.2, 1.1, "#ff2b39", 0.5, soft);
    vStreak(cx - 0.7, cy - 3, cy + 3, 1.4, 0.7, "#ff5f6a", 0.8, tight);
    /* Bright star-like core: red dot with a white hot centre. */
    add("circle", { cx, cy, r: 4.0, fill: "#ff2b39", opacity: 0.65, filter: mid });
    add("circle", { cx, cy, r: 2.3, fill: "#ff4050", filter: tight });
    add("circle", { cx, cy, r: 1.1, fill: "#ffffff" });

    const flare = document.createElement("span");
    flare.className = "eye-flare";
    flare.style.left = `${pctX(eye.x)}%`;
    flare.style.top = `${pctY(eye.y)}%`;
    flare.style.width = `${pctX(W)}%`;
    flare.style.height = `${pctY(H)}%`;
    flare.appendChild(svg);
    stageEl.appendChild(flare);
    flares.push(flare);
  });
  return flares;
}

const eyeFlares = buildEyeFlares();

function showEyeFlares() {
  for (const flare of eyeFlares) flare.classList.add("is-active");
}

function hideEyeFlares() {
  for (const flare of eyeFlares) flare.classList.remove("is-active");
}

function pressEyes() {
  cancelEyeRelease();
  showEyeFlares();
}

function releaseEyes() {
  cancelEyeRelease();
  eyeReleaseTimer = setTimeout(() => {
    eyeReleaseTimer = null;
    hideEyeFlares();
  }, LIVE_RELEASE_DELAY_MS);
}

/* ------------------------------------------------------------------ */
/* Physical keyboard                                                   */
/* ------------------------------------------------------------------ */

const codeToLetter = new Map();
for (const letter of Object.keys(WORDS)) {
  codeToLetter.set(letter === "space" ? "Space" : `Key${letter.toUpperCase()}`, letter);
}

function isEditableTarget(target) {
  if (!(target instanceof Element)) return false;
  /* Only text-entry fields should swallow key presses. Checkboxes and buttons
     must not, or the queue would never see main-keyboard events while the
     "use swearqueue" toggle (an <input>) holds focus. */
  return Boolean(
    target.closest(
      'textarea, select, [contenteditable="true"], ' +
        'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):' +
        'not([type="submit"]):not([type="reset"]):not([type="range"]):' +
        'not([type="color"]):not([type="file"])'
    )
  );
}

/* Space on a focused checkbox must toggle it, not swear. */
function isQueueToggleSpace(event) {
  return event.target === queueToggle && event.code === "Space";
}

window.addEventListener("keydown", (event) => {
  if (event.repeat) return; // the original movie fired once per press
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  /* Keys typed into the hidden queue capture field are NOT routed here:
     software keyboards (especially iOS) do not deliver reliable keydown
     codes, so that field consumes its own text via `input` events below. */
  if (isEditableTarget(event.target)) return;
  if (isQueueToggleSpace(event)) return; // let the checkbox toggle
  const letter = codeToLetter.get(event.code);
  if (letter) {
    event.preventDefault();
    pressKey(letter);
    return;
  }
  if (event.code === "Digit0") {
    event.preventDefault();
    pressEyes();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (isEditableTarget(event.target)) return;
  if (isQueueToggleSpace(event)) return;
  const letter = codeToLetter.get(event.code);
  if (letter) {
    event.preventDefault();
    releaseLiveKey(letter);
    return;
  }
  if (event.code === "Digit0") {
    event.preventDefault();
    releaseEyes();
  }
});

/* If the window loses focus while a key is held, never leave a word stuck. */
window.addEventListener("blur", () => {
  cancelEyeRelease();
  hideEyeFlares();
  if (isQueueMode()) return;
  cancelLiveRelease();
  deactivateAll();
});

/* ------------------------------------------------------------------ */
/* Queue text composer                                                 */
/* ------------------------------------------------------------------ */

/* In queue mode the bar's field is a real text input that mirrors the queue:
   it shows the letters still waiting to be spoken, and typing adds to the
   queue immediately - every new character fires exactly like pressing that
   key - then the queue re-renders the field, so letters appear as they are
   queued and drop off the front as Buffy speaks them. No separate "done"
   step. Letter keys pressed on the page itself (desktop, field not focused)
   still enqueue one entry per press via the window keydown handler. */

queueText.addEventListener("input", () => {
  const value = queueText.value;
  if (value.startsWith(queueAnchor)) {
    /* Only the newly typed tail is new input; fire it immediately. */
    const added = value.slice(queueAnchor.length);
    if (added) routeCapturedText(added); // enqueues; onChange re-renders
  } else {
    /* Editing or deleting the pending readout is not supported: those letters
       are already queued, so restore the canonical text. */
    queueText.value = queueAnchor;
  }
});

/* Enter/Escape only dismiss the keyboard; there is no submit step. */
queueText.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === "Escape") {
    queueText.blur();
  }
});

/* Map fired text to queue entries: letters become their key, runs of
   whitespace collapse to a single space, everything else is dropped.
   pressKeyFromClick enqueues in queue mode (the composer is only shown in
   queue mode), or swears once in live mode. */
function routeCapturedText(text) {
  let spacePending = false;
  for (const ch of text) {
    if (/[A-Za-z]/.test(ch)) {
      spacePending = false;
      pressKeyFromClick(ch.toLowerCase());
    } else if (/\s/.test(ch)) {
      if (!spacePending) pressKeyFromClick("space");
      spacePending = true;
    } else {
      spacePending = false;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

buildHotspots();

/* Indicator LEDs: chase left to right, then all off, every 200 ms. The
   blinking stops for users who request reduced motion (LEDs stay off). */
const ledEls = buildLeds();
const ledMachine = new LedStateMachine({
  leds: ledEls,
  frames: LEDS.frames,
  intervalMs: LEDS.intervalMs,
});

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
function syncLedMotion() {
  if (reduceMotion.matches) {
    ledMachine.turnOff();
  } else {
    ledMachine.start();
  }
}
syncLedMotion();
reduceMotion.addEventListener?.("change", syncLedMotion);
