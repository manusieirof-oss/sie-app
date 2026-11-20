'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useActivas, tiene } from './activas'

// La barra de abajo de la app de clientes: Inicio, Sesión y Álbum (cada una si la tiene).
export default function Navegacion() {
  const p = usePathname()
  const activas = useActivas()
  const it = (href: string, txt: string, icono: React.ReactNode) => {
    const on = href === '/app' ? p === href : (p || '').startsWith(href)
    return <Link href={href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>{icono}<span>{txt}</span></Link>
  }
  return (
    <nav className="capp-nav">
      {it('/app', 'Inicio', <svg viewBox="0 0 24 24" aria-hidden><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>)}
      {tiene(activas, 'sesion') && it('/app/sesion', 'Sesión', <svg viewBox="0 0 24 24" aria-hidden><path d="M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11"/></svg>)}
      {tiene(activas, 'entreno') && it('/app/entrenar', 'Entrenar', <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="8.5"/><path d="M10 8.5v7l5.5-3.5z"/></svg>)}
      {tiene(activas, 'album') && it('/app/album', 'Álbum', <svg viewBox="0 0 24 24" aria-hidden><rect x="3.5" y="3" width="7.5" height="10" rx="1.5"/><rect x="13" y="3" width="7.5" height="10" rx="1.5"/><rect x="3.5" y="15" width="7.5" height="6" rx="1.5"/><rect x="13" y="15" width="7.5" height="6" rx="1.5"/></svg>)}
    </nav>
  )
}
