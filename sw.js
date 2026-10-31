// Keeps the board opening when the signal drops: the page itself from this phone's copy, the data from the network
// first and this phone's last copy when there is none. ESPN's live feed is never kept. BUILD changes on every publish.
const BUILD = 'fc8e4a683d42';
const CACHE = 'bb-board-' + BUILD;
const SHELL = ['./', 'index.html', 'app.css', 'manifest.webmanifest', 'vendor/echarts.min.js', 'icons/icon.svg',
  'js/main.js', 'js/util.js', 'js/state.js', 'js/data.js', 'js/metrics.js', 'js/charts.js', 'js/ui.js', 'js/insights.js', 'js/live.js',
  'js/tg.js', 'js/lines.js', 'js/views/today.js', 'js/views/results.js', 'js/views/slices.js', 'js/views/model.js', 'js/views/lines.js',
  'js/views/money.js', 'js/views/ideas.js', 'js/trends.js', 'js/whatif.js', 'js/outlook.js', 'js/ask.js', 'js/chat.js', 'js/views/trends.js',
  'js/views/lab.js', 'js/views/fun.js', 'js/views/guide.js', 'js/views/allsports.js', 'js/guide_terms.js', 'js/views/nba.js', 'js/views/aces.js', 'js/views/more.js'];

self.addEventListener('install', (e) => {
  // fresh from the server, not the browser's own copy (GitHub Pages lets it keep one 10 minutes): a new build never caches old files
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('bb-board-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || e.request.method !== 'GET') return;
  if (url.pathname.includes('/data/p/')) return;    // the feed's parts never change under their names: js/data.js keeps them itself
  if (url.pathname.includes('/data/')) {
    const key = new Request(url.origin + url.pathname);
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
      return r;
    }).catch(() => caches.match(key).then((r) => r || new Response('', { status: 504 }))));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
