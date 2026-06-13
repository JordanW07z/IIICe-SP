import { useEffect, useRef, useState } from "react";

// Polls `fetcher` every `intervalMs`. Exposes {data, error, loading}.
// On error it keeps the last good data and flags `error` so the UI can show "offline".
export function usePolling(fetcher, intervalMs, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const savedFetcher = useRef(fetcher);
  savedFetcher.current = fetcher;

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const next = await savedFetcher.current();
        if (alive) { setData(next); setError(null); }
      } catch (e) {
        if (alive) setError(e);
      } finally {
        if (alive) setLoading(false);
      }
    }
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading };
}
