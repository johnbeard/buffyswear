/* LedStateMachine - a small state machine for animating a row of indicator
   LEDs.

   The machine owns a list of LED elements and a list of frames. Each frame is
   an array of LED indices that should be lit in that state (an empty array is
   "all off"). It advances one frame per tick on a fixed interval, rendering
   each state by toggling the `is-on` class on the LED elements.

   It is deliberately DOM-agnostic about positioning: the caller builds the LED
   elements and hands them in; the machine only manages state over time.
*/

export class LedStateMachine {
  /**
   * @param {object} options
   * @param {HTMLElement[]} options.leds      LED elements, one per indicator.
   * @param {number[][]} options.frames       States; each is lit LED indices.
   * @param {number} options.intervalMs       Time between frames (ms).
   * @param {(state: number, lit: number[]) => void} [options.onChange]
   */
  constructor({ leds, frames, intervalMs, onChange }) {
    this.leds = leds;
    this.frames = frames;
    this.intervalMs = intervalMs;
    this.onChange = onChange ?? (() => {});
    this.state = 0;
    this.timer = null;
  }

  /** Start ticking from the current state. Idempotent. */
  start() {
    if (this.timer !== null) return this;
    this.render(this.state);
    this.timer = setInterval(() => this.advance(), this.intervalMs);
    return this;
  }

  /** Stop ticking; the LEDs keep whatever state they are in. */
  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    return this;
  }

  /** Jump to a specific state (by index) and render it. */
  show(state) {
    this.state = ((state % this.frames.length) + this.frames.length) % this.frames.length;
    this.render(this.state);
    return this;
  }

  /** Move to the next state and render it. */
  advance() {
    return this.show(this.state + 1);
  }

  /** Render the given state onto the LED elements. */
  render(state) {
    const lit = new Set(this.frames[state] ?? []);
    this.leds.forEach((led, index) => {
      led.classList.toggle("is-on", lit.has(index));
    });
    this.onChange(state, this.frames[state] ?? []);
  }

  /** Stop the machine and turn every LED off. */
  turnOff() {
    this.stop();
    this.leds.forEach((led) => led.classList.remove("is-on"));
  }
}
