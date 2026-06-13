async function getJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export const getLive = () => getJSON("/api/live");
export const getConfig = () => getJSON("/api/config");
export const getTiming = (stage) => getJSON(`/api/timing?stage=${encodeURIComponent(stage)}`);
