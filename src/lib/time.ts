import { useEffect, useState } from 'react';
import dayjs from 'dayjs';

// The prototype runs on real time. Features are driven by actions (fulfil, accept, publish…), not by a clock.
export const nowIso = () => dayjs().format('YYYY-MM-DDTHH:mm:ss');
export const todayIso = () => dayjs().format('YYYY-MM-DD');

/** Re-renders every `ms` so time displays stay current. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(nowIso);
  useEffect(() => {
    const id = setInterval(() => setNow(nowIso()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
