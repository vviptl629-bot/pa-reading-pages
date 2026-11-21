/* PA 阅读库 · Service Worker  PWA-v1
 * 策略：app shell（合集页+图标+各书 HTML）预缓存；图片按需缓存（读过的离线可看）；
 * 导航 network-first（拿到最新，断网回退缓存）；跨域（Gist 同步 api.github.com）不拦截。
 * 所有 fetch/cache 均静默兜底，避免控制台报错干扰阅读。
 */
const CACHE = 'pa-library-pwa-v3'; /* SW404-v1 / CACHEBUMP-v3 强制清理旧缓存, 加载新清洗代码 */
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/apple-touch-icon.png'
];
// 15 本书的 HTML（体积不大，一起预缓存以便离线打开；图片不在此列）
const BOOKS = [
  './price-action-web/index.html',
  './pa-best-trades-web/index.html',
  './advanced-trend-web/index.html',
  './wave-range-web/index.html',
  './price-action-kbar-web/index.html',
  './taifei-web/index.html',
  './ghost-web/index.html',
  './zero-to-one-web/index.html',
  './cz-web/index.html',
  './nishi-web/index.html',
  './money-wars-web/index.html',
  './trade-game-web/index.html',
  './dan-web/index.html',
  './loser-wins-web/index.html',
  './advanced-reversal-web/index.html'
];

function swallow(p){ return p && p.catch ? p.catch(()=>{}) : Promise.resolve(); }

self.addEventListener('install', (e) => {
  e.waitUntil(
    swallow(
      caches.open(CACHE).then((c) =>
        swallow(Promise.all(
          SHELL.concat(BOOKS).map((u) => swallow(c.add(u)))
        ))
      ).then(() => self.skipWaiting())
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    swallow(
      caches.keys().then((keys) =>
        swallow(Promise.all(keys.filter((k) => k !== CACHE).map((k) => swallow(caches.delete(k)))))
      ).then(() => self.clients.claim())
    )
  );
});

self.addEventListener('fetch', (e) => {
  try { handleFetch(e); } catch (_) { /* swallow */ }
});

function handleFetch(e){
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // 跨域请求（Gist 同步、GitHub API）完全不拦截，交给浏览器正常网络
  if (url.origin !== self.location.origin) return;

  // 导航：network-first，拿到最新页面；断网回退缓存
  if (e.request.mode === 'navigate') {
    e.respondWith(
      swallow(
        fetch(new Request(e.request, { cache: 'reload' })).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            swallow(caches.open(CACHE).then((c) => swallow(c.put(e.request, copy))));
            return res;
          }
          // SW404-v1: 非 200（含 404）时回退缓存首页，避免显示原生404
          return swallow(caches.match(e.request)).then(r => r || caches.match('./index.html')).then(r => r || res);
        })
      ).catch(() => swallow(caches.match(e.request)).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // 静态资源（图片/图标/js/css）：cache-first，读过的即可离线
  e.respondWith(
    swallow(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return swallow(
          fetch(e.request).then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              const copy = res.clone();
              swallow(caches.open(CACHE).then((c) => swallow(c.put(e.request, copy))));
            }
            return res;
          })
        );
      })
    )
  );
}

self.addEventListener('error', () => { /* swallow */ });
