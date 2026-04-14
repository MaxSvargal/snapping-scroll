let activeEffect = null;
let pending = false;
const queue = new Set();

export const getActiveEffect = () => activeEffect;
export const setActiveEffect = (fn) => { activeEffect = fn; };

export function scheduleEffect(fn) {
  queue.add(fn);
  if (!pending) {
    pending = true;
    queueMicrotask(flushQueue);
  }
}

export function cancelEffect(fn) {
  queue.delete(fn);
}

function flushQueue() {
  const fns = [...queue];
  queue.clear();
  pending = false;
  for (const fn of fns) {
    try { fn(); } catch (e) { console.error(e); }
  }
}
