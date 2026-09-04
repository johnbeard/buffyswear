/* SwearQueue - a small FIFO queue of typed keys with a single-file playback
   head.

   Presses are appended to the back. A playback head removes entries from the
   front one at a time; the host plays each entry's clip and calls advance()
   when it ends, so a later entry only starts once the previous one finished.
   While an entry is playing, new presses just join the back of the queue.

   The queue knows nothing about audio or the DOM; it reports changes through
   callbacks:
   - onChange(items): the pending (not yet played) items changed. items is a
     copy, front entry first.
   - onPlay(letter): an entry was taken off the front and should be played.
   - onDrain(): the last entry finished and nothing is left to play.
*/

export class SwearQueue {
  /**
   * @param {object} hooks
   * @param {(items: string[]) => void} [hooks.onChange]
   * @param {(letter: string) => void} [hooks.onPlay]
   * @param {() => void} [hooks.onDrain]
   */
  constructor({ onChange, onPlay, onDrain }) {
    this.items = [];
    this.playing = false;
    this.onChange = onChange ?? (() => {});
    this.onPlay = onPlay ?? (() => {});
    this.onDrain = onDrain ?? (() => {});
  }

  /** Append a letter to the back; start playing it if nothing is playing. */
  enqueue(letter) {
    this.items.push(letter);
    this.#emit();
    this.#startIfIdle();
  }

  /** Call when the clip for the current entry has finished playing. */
  advance() {
    if (!this.items.length) {
      this.playing = false;
      this.onDrain();
      return;
    }
    const letter = this.items.shift();
    this.playing = true;
    this.#emit();
    this.onPlay(letter);
  }

  /** Drop every pending letter (does not cut a clip that is already playing). */
  clear() {
    if (!this.items.length && !this.playing) return;
    this.items.length = 0;
    this.#emit();
  }

  get size() {
    return this.items.length;
  }

  get isPlaying() {
    return this.playing;
  }

  #startIfIdle() {
    if (this.playing) return;
    const letter = this.items.shift();
    if (letter === undefined) return;
    this.playing = true;
    this.#emit();
    this.onPlay(letter);
  }

  #emit() {
    this.onChange([...this.items]);
  }
}
