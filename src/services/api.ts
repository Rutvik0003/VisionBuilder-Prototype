// Every "backend" call goes through here so the UI behaves like it's talking to an API (150–400 ms).
export function latency<T>(fn: () => T, min = 150, max = 400): Promise<T> {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try { resolve(fn()); } catch (e) { reject(e); }
    }, ms);
  });
}
