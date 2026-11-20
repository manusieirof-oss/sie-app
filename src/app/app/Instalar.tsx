'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// INSTALAR LA APP EN EL MÓVIL. Registra el service worker (lo necesitan la instalación y
// los avisos) y, si aún no está instalada, ofrece hacerlo: en Android con el botón del
// propio navegador; en iPhone explicando los dos toques (Compartir → Añadir a inicio).
// Si dice «Ahora no», no vuelve a salir en 2 semanas.
export default function Instalar() {
  const ruta = usePathname()
  const [aviso, setAviso] = useState<null | 'android' | 'iphone'>(null)
  const [evento, setEvento] = useState<any>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/app-sw.js', { scope: '/app' }).catch(() => {})
    const instalada = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone
    let tarde = false
    try { tarde = Date.now() < Number(localStorage.getItem('capp_instalar_no') || 0) } catch {}
    if (instalada || tarde) return
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (ios) { setAviso('iphone'); return }
    const antes = (e: any) => { e.preventDefault(); setEvento(e); setAviso('android') }
    window.addEventListener('beforeinstallprompt', antes)
    return () => window.removeEventListener('beforeinstallprompt', antes)
  }, [])

  // Solo en el inicio, y no en la pantalla de entrar.
  if (!aviso || ruta !== '/app') return null
  const ahoraNo = () => { try { localStorage.setItem('capp_instalar_no', String(Date.now() + 14 * 864e5)) } catch {}; setAviso(null) }
  return (
    <div className="capp-instalar" role="dialog" aria-label="Instalar la app">
      <img src="/app-icono-192.png" alt="" width={46} height={46}/>
      <div>
        <b>Tenla en tu pantalla de inicio</b>
        {aviso === 'iphone'
          ? <span>Toca <span aria-label="Compartir">Compartir</span> (el cuadrado con la flecha) y luego «Añadir a pantalla de inicio».</span>
          : <span>Se abre como una app y te podemos avisar de tus citas.</span>}
        <div className="botones">
          {aviso === 'android' && <button type="button" className="si" onClick={async () => { await evento?.prompt?.(); setAviso(null) }}>Instalar</button>}
          <button type="button" onClick={ahoraNo}>{aviso === 'iphone' ? 'Entendido' : 'Ahora no'}</button>
        </div>
      </div>
    </div>
  )
}
