/**
 * Detects single vs double tap gestures on an element.
 * Provides callbacks for single and double tap events.
 */
export class GestureDetector {
  #lastTap = 0;
  #tapTimeout = null;
  #threshold;

  /**
   * @param {() => void} onSingleTap - called when single tap is detected
   * @param {(e: PointerEvent) => void} onDoubleTap - called when double tap is detected
   * @param {number} [threshold=300] - time in ms between taps to trigger double tap
   */
  constructor(onSingleTap, onDoubleTap, threshold = 300) {
    this.onSingleTap = onSingleTap;
    this.onDoubleTap = onDoubleTap;
    this.#threshold = threshold;
  }

  /**
   * Call this from pointerdown handler to prevent accidental selection during double tap
   */
  handlePointerDown(e) {
    const tapLength = performance.now() - this.#lastTap;
    if (tapLength < this.#threshold && tapLength > 0) {
      e.preventDefault();
    }
  }

  /**
   * Call this from pointerup handler to detect tap type
   */
  handlePointerUp(e) {
    const tapLength = performance.now() - this.#lastTap;

    if (tapLength < this.#threshold && tapLength > 0) {
      // Double tap detected
      clearTimeout(this.#tapTimeout);
      this.onDoubleTap(e);
    } else {
      // Potential single tap — wait to see if there's a second tap
      clearTimeout(this.#tapTimeout);
      this.#tapTimeout = setTimeout(
        () => this.onSingleTap(),
        this.#threshold
      );
    }

    this.#lastTap = performance.now();
  }

  /**
   * Clean up pending timeouts (call on component disconnect)
   */
  cleanup() {
    clearTimeout(this.#tapTimeout);
  }
}
