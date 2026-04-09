let activeEffect = null;
let pending = false;
const queue = new Set();

function flushQueue() {
  queue.forEach((fn) => fn());
  queue.clear();
  pending = false;
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
}

export function signal(initialValue) {
  const subscribers = new Set();
  let value = initialValue;

  return {
    get value() {
      if (activeEffect) subscribers.add(activeEffect);
      return value;
    },
    set value(newValue) {
      if (value !== newValue) {
        value = newValue;
        subscribers.forEach((sub) => sub());
      }
    },
  };
}
