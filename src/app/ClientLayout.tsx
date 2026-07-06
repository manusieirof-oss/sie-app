'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import AvisoRenovacion from './AvisoRenovacion'
import { renovarCuotas } from '@/lib/bonos'

const NAV = [
  { href: '/agenda', icon: '📅', label: 'Agenda' },
  { href: '/pacientes', icon: '👥', label: 'Pacientes' },
  { href: '/entrenamiento', icon: '📚', label: 'Biblioteca' },
  { href: '/taller', icon: '🔧', label: 'Taller' },
  { href: '/valoracion', icon: '📋', label: 'Valorac.' },
  { href: '/estadisticas', icon: '📊', label: 'Stats' },
  { href: '/ajustes', icon: '⚙️', label: 'Ajustes' },
]

const NAV_FINANZAS = { href: '/finanzas', icon: '💰', label: 'Finanzas' }

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(undefined)
  const [perfil, setPerfil] = useState<any>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user?.id) {
      supabase.from('perfiles').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
        setPerfil(data)
        if (data?.rol==='admin' || data?.permisos?.finanzas===true) {
          renovarCuotas().then(r => { if (r.ejecutado && r.renovados>0) console.log(`Cuotas renovadas: ${r.renovados}`) })
        }
      })
    }
  }, [user])

  useEffect(() => {
    if (user === null && pathname !== '/login') router.push('/login')
  }, [user, pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (user === undefined) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--n)'}}>
      <span style={{color:'var(--g)',fontSize:14,letterSpacing:4}}>SIE</span>
    </div>
  )

  if (pathname === '/login') return <>{children}</>
  if (!user) return null

  const todayStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const pageTitle: Record<string,string> = {
    '/agenda':'Agenda','/pacientes':'Pacientes','/entrenamiento':'Biblioteca','/taller':'Taller',
    '/valoracion':'Valoración','/estadisticas':'Stats','/ajustes':'Ajustes','/finanzas':'Finanzas',
  }
  const currentTitle = Object.entries(pageTitle).find(([k])=>pathname.startsWith(k))?.[1] ?? 'SIE'

  const veFinanzas = perfil?.rol==='admin' || perfil?.permisos?.finanzas===true

  return (
    <div className="shell">
      <AvisoRenovacion visible={veFinanzas}/>
      <nav className="sidebar">
        <div className="sb-logo">SIE</div>
        {NAV.map(n=>(
          <Link key={n.href} href={n.href} className={`nav-item ${pathname.startsWith(n.href)?'active':''}`}>
            <span>{n.icon}</span>
            <span className="nav-label">{n.label}</span>
          </Link>
        ))}
        {(perfil?.rol==='admin' || perfil?.permisos?.finanzas===true) && (
          <Link href={NAV_FINANZAS.href} className={`nav-item ${pathname.startsWith(NAV_FINANZAS.href)?'active':''}`}>
            <span>{NAV_FINANZAS.icon}</span>
            <span className="nav-label">{NAV_FINANZAS.label}</span>
          </Link>
        )}
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
