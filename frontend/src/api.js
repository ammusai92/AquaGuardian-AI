const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
let token = localStorage.getItem('ag_token') || '';
export const setToken = (t) => {
  token = t || '';
  if (t) localStorage.setItem('ag_token', t); else localStorage.removeItem('ag_token');
};
export const getToken = () => token;

// ---- Offline queue: field data is NEVER lost ----
const QKEY = 'ag_queue';
const readQ = () => { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch { return []; } };
const writeQ = (q) => { localStorage.setItem(QKEY, JSON.stringify(q)); window.dispatchEvent(new Event('ag-sync')); };
export const pendingCount = () => readQ().filter((i) => !i.failed).length;

export async function flushQueue() {
  const q = readQ();
  for (let i = 0; i < q.length; i++) {
    if (q[i].failed) continue;
    try {
      const res = await fetch(API + q[i].url, {
        method: q[i].method,
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify(q[i].body),
      });
      if (res.ok) { q.splice(i, 1); i--; }
      else if (res.status < 500) { q[i].failed = true; } // bad data -> mark, don't retry forever
      else break;                                        // server error -> retry later
    } catch (_) { break; }                               // still offline -> stop
  }
  writeQ(q);
}
window.addEventListener('online', flushQueue);
setInterval(flushQueue, 30000);

async function request(method, url, body, { queue = false } = {}) {
  try {
    const res = await fetch(API + url, {
      method,
      headers: {
        ...(body && !(body instanceof FormData) && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (e) {
    if (queue && e instanceof TypeError) { // network failure while offline
      const q = readQ(); q.push({ url, method, body, at: Date.now() }); writeQ(q);
      return { queued: true };
    }
    throw e;
  }
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body, opts) => request('POST', url, body, opts),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
  postQueued: (url, body) => request('POST', url, body, { queue: true }), // offline-safe save
  async download(url, filename) {
    const res = await fetch(API + url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  },
};