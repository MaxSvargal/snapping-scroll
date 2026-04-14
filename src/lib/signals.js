let activeEffect = null;
let pending = false;
const queue = new Set();

/**
 * Flushes the effect queue in a stable order without re-entrant cascading updates.
 *
 * **V8 Optimization:** Creates a snapshot of the queue before iteration. This prevents
 * the Set from being mutated during `forEach()`, which per ECMA spec would visit newly-added
 * items in the same pass and cause cascading synchronous update loops. By snapshotting,
 * we guarantee FIFO order and prevent O(n²) effect re-runs under rapid mutations.
 *
 * @returns {void}
 */
function flushQueue() {
  const fns = [...queue];
  queue.clear();
  pending = false;
  for (const fn of fns) {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  }
}

export function effect(fn) {
  const wrapper = () => {
    queue.add(fn);
    if (!pending) {
      pending = true;
      queueMicrotask(flushQueue);
    }
  };

  activeEffect = wrapper;
  fn();
  activeEffect = null;

  return () => {
    queue.delete(fn);
  };
}

/**
 * Reactive signal primitive with automatic dependency tracking and change notification.
 *
 * **V8 Hidden Class Optimization:** Using a class ensures all signal instances share one
 * Hidden Class, making `.value` access **monomorphic** (IC cache always hits with the same
 * type). Factory functions returning plain objects create unique closures with different
 * captured variables, fragmenting into N different Hidden Classes (one per signal).
 *
 * When `_mapBindings()` reads `.value` across 13 signals, the old factory approach
 * created 13 different IC shapes (megamorphic → dictionary lookup). With `class Signal`,
 * all 13 signals are type-stable → TurboFan emits a single fast path using inline caching.
 *
 * Private fields (`#subscribers`, `#value`) are part of the class's Hidden Class shape,
 * so accessor methods always use the same layout. No extra property lookups.
 *
 * @example
 * const count = signal(0);
 * effect(() => console.log(count.value)); // subscribes automatically
 * count.value++; // triggers effect, runs subscriber callbacks
 */
class Signal {
  #subscribers = new Set();
  #value;

  constructor(initialValue) {
    this.#value = initialValue;
  }

  get value() {
    if (activeEffect) this.#subscribers.add(activeEffect);
    return this.#value;
  }

  set value(newValue) {
    if (this.#value !== newValue) {
      this.#value = newValue;
      this.#subscribers.forEach((sub) => sub());
    }
  }
}

/**
 * Factory for creating new Signal instances.
 *
 * **Public API:** Call sites never change — `signal("0")`, `signal(false)`, etc.
 * remain identical. But now all returned objects share one prototype (Signal.prototype),
 * so V8 assigns them the same Hidden Class and `.value` access stays monomorphic.
 *
 * @param {*} initialValue - Initial value for the signal
 * @returns {Signal} - New Signal instance with automatic subscription tracking
 */
export function signal(initialValue) {
  return new Signal(initialValue);
}
