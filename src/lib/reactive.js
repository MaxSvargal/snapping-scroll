import { getActiveEffect, setActiveEffect, scheduleEffect, cancelEffect } from "./scheduler.js";

// Maps target object -> property -> Set of effects
const targetMap = new WeakMap();

/**
 * Track which effects depend on which properties of which objects.
 * Called automatically during Proxy.get - implements the "read = subscribe" pattern.
 *
 * @param {object} target - The reactive proxy target
 * @param {string|symbol} prop - The property being accessed
 * @returns {void}
 */
function track(target, prop) {
  const ae = getActiveEffect();
  if (!ae) return;
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }
  let dep = depsMap.get(prop);
  if (!dep) {
    depsMap.set(prop, (dep = new Set()));
  }
  if (!dep.has(ae)) {
    dep.add(ae);
  }
}

/**
 * Notify all effects that depend on a specific property of a specific object.
 * Called automatically during Proxy.set - implements the "write = notify" pattern.
 *
 * @param {object} target - The reactive proxy target
 * @param {string|symbol} prop - The property that changed
 * @returns {void}
 */
function trigger(target, prop) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  const dep = depsMap.get(prop);
  if (!dep) return;

  // Schedule effects for batched execution
  dep.forEach(scheduleEffect);
}

/**
 * Creates a reactive proxy that tracks property reads and writes automatically.
 * Uses Proxy traps + Reflect API to:
 * - Track dependencies when properties are read (get trap)
 * - Notify subscribers when properties are written (set trap)
 * - Preserve correct `this` context via Reflect for inheritance support
 *
 * **Reflect API benefits:**
 * - `Reflect.get(target, prop, receiver)` preserves the correct `this` context for getters
 *   when objects use prototypal inheritance (child objects override parent properties)
 * - `Reflect.set(target, prop, value, receiver)` ensures setters run with proper context
 * - Methods on the object maintain their original `this` binding
 *
 * @param {object} target - The object to make reactive
 * @returns {Proxy} - Proxy that auto-tracks reads/writes
 *
 * @example
 * const state = reactive({ count: 0, name: 'test' });
 * effect(() => console.log(state.count)); // auto-subscribes on read
 * state.count++; // auto-notifies on write, effect re-runs
 *
 * // Works with getters and inheritance:
 * const base = reactive({ firstName: 'John', get fullName() { return this.firstName; } });
 * const child = Object.create(base);
 * child.firstName = 'Jane'; // fullName getter gets correct this=child context
 */
export function reactive(target) {
  return new Proxy(target, {
    get(target, prop, receiver) {
      // Track dependency: reading a property subscribes activeEffect to it
      if (getActiveEffect()) {
        track(target, prop);
      }
      // Use Reflect to preserve correct `this` context for getters/inheritance
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      // Perform the actual assignment
      const result = Reflect.set(target, prop, value, receiver);
      // Trigger: writing notifies all effects depending on this property
      trigger(target, prop);
      return result;
    },
  });
}

/**
 * Creates a reactive effect that auto-runs whenever its reactive dependencies change.
 * The effect function is wrapped with the scheduler, tracked during initial run,
 * and re-runs whenever tracked properties are modified.
 *
 * @param {Function} fn - Effect function that may depend on reactive properties
 * @returns {Function} - Dispose function to cancel future effect runs
 *
 * @example
 * const state = reactive({ count: 0 });
 * effect(() => console.log(state.count)); // logs "0"
 * state.count = 5; // logs "5" (async, batched)
 */
export function effect(fn) {
  const wrapper = () => scheduleEffect(fn);
  setActiveEffect(wrapper);
  fn();
  setActiveEffect(null);
  return () => cancelEffect(fn);
}
