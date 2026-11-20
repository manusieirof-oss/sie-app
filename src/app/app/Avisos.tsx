'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ACTIVAR LOS AVISOS en este móvil (cita de mañana, bono que se acaba, sobre listo).
// En iPhone solo funcionan con la app instalada en la pantalla de inicio.
const CLAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
function bytes(b64: string) {
  const p = (b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(p), c => c.charCodeAt(0))
}

export default function Avisos() {
  const [estado, setEstado] = useState<'cargando' | 'no' | 'instalar' | 'apagados' | 'bloqueados' | 'activos'>('cargando')
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const instalada = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !CLAVE) { setEstado(ios && !instalada ? 'instalar' : 'no'); return }
      if (Notification.permission === 'denied') { setEstado('bloqueados'); return }
      const reg = await navigator.serviceWorker.getRegistration('/app')
      const sub = await reg?.pushManager.getSubscription()
      setEstado(sub ? 'activos' : 'apagados')
    })().catch(() => setEstado('no'))
  }, [])

  async function activar() {
    setTrabajando(true)
    try {
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') { setEstado(permiso === 'denied' ? 'bloqueados' : 'apagados'); return }
      const reg = await navigator.serviceWorker.register('/app-sw.js', { scope: '/app' })
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(CLAVE) })
      const { data } = await supabase.rpc('app_guardar_push', { sub: sub.toJSON() })
      setEstado(data === true ? 'activos' : 'apagados')
    } catch { setEstado('apagados') } finally { setTrabajando(false) }
  }
  async function quitar() {
    setTrabajando(true)
    const reg = await navigator.serviceWorker.getRegistration('/app')
    const sub = await reg?.pushManager.getSubscription()
    if (sub) { await supabase.rpc('app_quitar_push', { ep: sub.endpoint }); await sub.unsubscribe() }
    setEstado('apagados'); setTrabajando(false)
  }

  if (estado === 'cargando' || estado === 'no') return null
  return (
    <section className="capp-sec">
      <div className="capp-avisos">
        <span className="campana" aria-hidden>{estado === 'activos' ? '🔔' : '🔕'}</span>
        <div>
          {estado === 'activos' && <><b>Avisos activados</b><span>Te avisamos la víspera de cada cita, cuando se acabe tu bono y cuando llegue tu sobre.</span>
            <button type="button" className="link" disabled={trabajando} onClick={quitar}>Quitar los avisos</button></>}
          {estado === 'apagados' && <><b>¿Te avisamos?</b><span>La víspera de cada cita, cuando se acabe tu bono y cuando llegue tu sobre.</span>
            <button type="button" className="si" disabled={trabajando} onClick={activar}>{trabajando ? 'Activando…' : 'Activar avisos'}</button></>}
          {estado === 'instalar' && <><b>Avisos en tu iPhone</b><span>Para recibirlos, primero añade la app a tu pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde allí.</span></>}
          {estado === 'bloqueados' && <><b>Avisos bloqueados</b><span>Los has bloqueado en este móvil. Para activarlos, permite las notificaciones de esta app en los ajustes del móvil.</span></>}
        </div>
      </div>
    </section>
  )
}
