'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// La barra de abajo de la app de clientes: Inicio y Álbum (lo demás irá llegando).
export default function Navegacion() {
  const p = usePathname()
  const it = (href: string, txt: string, icono: React.ReactNode) => (
    <Link href={href} className={p === href ? 'on' : ''} aria-current={p === href ? 'page' : undefined}>{icono}<span>{txt}</span></Link>
  )
  return (
    <nav className="capp-nav">
      {it('/app', 'Inicio', <svg viewBox="0 0 24 24" aria-hidden><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>)}
      {it('/app/album', 'Álbum', <svg viewBox="0 0 24 24" aria-hidden><rect x="3.5" y="3" width="7.5" height="10" rx="1.5"/><rect x="13" y="3" width="7.5" height="10" rx="1.5"/><rect x="3.5" y="15" width="7.5" height="6" rx="1.5"/><rect x="13" y="15" width="7.5" height="6" rx="1.5"/></svg>)}
    </nav>
  )
}
