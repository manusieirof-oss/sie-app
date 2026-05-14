'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/agenda', icon: '📅', label: 'Agenda' },
  { href: '/pacientes', icon: '👥', label: 'Pacientes' },
  { href: '/entrenamiento', icon: '🏋', label: 'Entreno' },
  { href: '/valoracion', icon: '📋', label: 'Valorac.' },
  { href: '/resultados', icon: '📊', label: 'Result.' },
  { href: '/estadisticas', icon: '📈', label: 'Stats' },
]

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (!session && pathname !== '/login') router.push('/login')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (!session && pathname !== '/login') router.push('/login')
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--n)'}}>
      <span style={{color:'var(--g)',fontSize:14,letterSpacing:4}}>SIE</span>
    </div>
  )

  if (pathname === '/login') return <>{children}</>
  if (!user) return null

  const todayStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const pageTitle: Record<string,string> = {
    '/agenda':'Agenda','/pacientes':'Pacientes','/entrenamiento':'Entrenamiento',
    '/valoracion':'Valoración','/resultados':'Resultados','/estadisticas':'Estadísticas',
  }
  const currentTitle = Object.entries(pageTitle).find(([k])=>pathname.startsWith(k))?.[1] ?? 'SIE'

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="sb-logo">SIE</div>
        {NAV.map(n=>(
          <Link key={n.href} href={n.href} className={`nav-item ${pathname.startsWith(n.href)?'active':''}`}>
            <span>{n.icon}</span>
            <span className="nav-label">{n.label}</span>
          </Link>
        ))}
        <div style={{marginTop:'auto'}}>
          <button className="nav-item" onClick={handleLogout}>
            <span>🚪</span>
            <span className="nav-label">Salir</span>
          </button>
        </div>
      </nav>
      <header className="topbar">
        <span className="tb-logo">SIE</span>
        <span className="tb-title">{currentTitle}</span>
        <span className="tb-sep"/>
        <span className="tb-sub">{todayStr}</span>
        <div className="tb-right">
          <span style={{fontSize:10,color:'var(--grl)'}}>{user.email}</span>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  )
}
