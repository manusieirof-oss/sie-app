// SERVICE WORKER DE LA APP DE CLIENTES (solo /app). De momento: que se pueda instalar y
// recibir avisos (push). No guarda páginas: siempre se ve lo último.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})

self.addEventListener('push', e => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { cuerpo: e.data && e.data.text() } }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Mi entreno', {
    body: d.cuerpo || '', icon: '/app-icono-192.png', badge: '/app-icono-192.png', data: { url: d.url || '/app' }, lang: 'es',
  }))
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/app'
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(ws => {
    for (const w of ws) if (w.url.includes('/app') && 'focus' in w) { w.navigate(url); return w.focus() }
    return self.clients.openWindow(url)
  }))
})
