// v6 - GitHub Pages compatible
const CACHE = 'checklist-v6';
const FIREBASE_CACHE = 'firebase-v6';
const BASE = '/checklist-at';

const APP_FILES = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png',
];

const FB_URLS = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE).then(c => c.addAll(APP_FILES).catch(err => console.warn('[SW] app cache err:', err))),
      caches.open(FIREBASE_CACHE).then(c =>
        Promise.all(FB_URLS.map(u =>
          fetch(u).then(r => { if(r.ok) c.put(u, r); }).catch(() => {})
        ))
      )
    ])
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== FIREBASE_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  if(url.includes('firestore.googleapis.com') || url.includes('securetoken.googleapis.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"offline":true}', {status:503})));
    return;
  }

  if(url.includes('gstatic.com/firebasejs')) {
    e.respondWith(
      caches.open(FIREBASE_CACHE).then(c =>
        c.match(e.request).then(r => {
          if(r) {
            fetch(e.request).then(nr => { if(nr && nr.ok) c.put(e.request, nr.clone()); }).catch(() => {});
            return r;
          }
          return fetch(e.request).then(nr => {
            if(nr && nr.ok) c.put(e.request, nr.clone());
            return nr;
          });
        })
      )
    );
    return;
  }

  e.respondWith(
    caches.open(CACHE).then(c =>
      c.match(e.request).then(r => {
        // Update cache in background
        fetch(e.request).then(nr => {
          if(nr && nr.status === 200 && nr.type !== 'opaque') c.put(e.request, nr.clone());
        }).catch(() => {});
        // Return cache or fetch
        return r || fetch(e.request).catch(() =>
          c.match(BASE + '/index.html').then(p => p || c.match(BASE + '/'))
        );
      })
    )
  );
});

self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
