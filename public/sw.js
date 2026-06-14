'use strict';
const CACHE = 'safepoint-v2';
const STATIC = ['/', '/index.html', '/app.js', '/style.css', '/logo.svg'];
const QUEUE_DB_NAME = 'sp-offline-queue';
const QUEUE_STORE = 'requests';

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueRequest(url, method, body, headers) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).add({ url, method, body, headers: Object.fromEntries([...headers.entries()].filter(([k]) => k !== 'content-length')), ts: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function replayQueue() {
  const db = await openQueueDB();
  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  for (const item of items) {
    try {
      await fetch(item.url, { method: item.method, headers: { 'Content-Type': 'application/json', 'Cookie': item.headers.cookie || '' }, body: item.body });
      const db2 = await openQueueDB();
      await new Promise((resolve, reject) => {
        const tx = db2.transaction(QUEUE_STORE, 'readwrite');
        tx.objectStore(QUEUE_STORE).delete(item.id);
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
    } catch { /* leave in queue */ }
  }
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'GET' && !url.pathname.startsWith('/api/')) {
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return resp;
    })));
    return;
  }
  if (e.request.method === 'GET' && url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  if (['POST', 'PUT', 'DELETE'].includes(e.request.method) && url.pathname.startsWith('/api/')) {
    e.respondWith(
      e.request.clone().text().then(bodyText =>
        fetch(e.request).catch(async () => {
          await enqueueRequest(e.request.url, e.request.method, bodyText, e.request.headers);
          return new Response(JSON.stringify({ ok: true, queued: true, offline: true }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
          });
        })
      )
    );
    return;
  }
});

self.addEventListener('sync', e => {
  if (e.tag === 'sp-sync') e.waitUntil(replayQueue());
});

self.addEventListener('message', e => {
  if (e.data === 'SYNC_NOW') replayQueue().then(() => e.source.postMessage({ type: 'SYNC_DONE' }));
});
