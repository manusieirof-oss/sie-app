'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import AvisoRenovacion from './AvisoRenovacion'
import { renovarCuotas } from '@/lib/bonos'
import { aplicarEstadosProgramados } from '@/lib/estadosPaciente'
import { Ic } from '@/lib/icons'

const NAV = [
  { href: '/agenda', icon: 'agenda', label: 'Agenda' },
  { href: '/pacientes', icon: 'pacientes', label: 'Pacientes' },
  { href: '/entrenamiento', icon: 'biblioteca', label: 'Biblioteca' },
  { href: '/taller', icon: 'taller', label: 'Taller' },
  { href: '/valoracion', icon: 'valoracion', label: 'Valorac.' },
  { href: '/estadisticas', icon: 'stats', label: 'Stats' },
  { href: '/ajustes', icon: 'ajustes', label: 'Ajustes' },
]

// Dos permisos distintos y a propósito: COBROS lo necesitan los empleados para
// cobrar y facturar; FINANZAS es el dinero de la clínica y solo lo ve quien
// deba. Tener Finanzas implica Cobros, no al revés.
const NAV_COBROS   = { href: '/cobros',   icon: 'recibo',   label: 'Cobros' }
const NAV_FINANZAS = { href: '/finanzas', icon: 'finanzas', label: 'Finanzas' }

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(undefined)
  const [perfil, setPerfil] = useState<any>(null)
  /** El logo de Ajustes → Clínica. Sustituye al "SIE" vertical de la barra de pilares. */
  const [logo, setLogo] = useState<string>('')
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    supabase.from('ajustes').select('valor').eq('clave','clinica_logo').maybeSingle()
      .then(({ data }) => setLogo(data?.valor || ''))
  }, [])

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
          /**
           * Los estados programados ANTES de renovar cuotas.
           *
           * El orden importa: si alguien tenía la baja puesta para hoy, hay que aplicarla
           * primero, o la renovación le vería todavía como activo y le generaría la cuota
           * del mes que no debe pagar.
           */
          aplicarEstadosProgramados().then(e => {
            if (e.aplicados > 0) console.log(`Estados aplicados: ${e.aplicados}`)
            if (e.fallidos?.length) console.error('Estados que NO se han podido aplicar:', e.fallidos)
          })
          renovarCuotas().then(r => {
            if (!r.ejecutado) return
            if (r.renovados > 0) console.log(`Cuotas renovadas: ${r.renovados}`)
            if (r.omitidos) console.log('Cuotas no renovadas (paciente de baja):', r.omitidos)
            // Un bono que no se ha podido renovar deja a alguien sin cuota este
            // mes. Que se vea, aunque de momento sea solo en la consola.
            if (r.fallidos?.length) console.error('Cuotas que NO se han podido renovar:', r.fallidos)
          })
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
    '/valoracion':'Valoración','/estadisticas':'Stats','/ajustes':'Ajustes','/finanzas':'Finanzas','/cobros':'Cobros',
  }
  const currentTitle = Object.entries(pageTitle).find(([k])=>pathname.startsWith(k))?.[1] ?? 'SIE'

  const veFinanzas = perfil?.rol==='admin' || perfil?.permisos?.finanzas===true
  const veCobros   = veFinanzas || perfil?.permisos?.cobros===true

  return (
    <div className="shell">
      <AvisoRenovacion visible={veFinanzas}/>
      <nav className="sidebar">
        {/* El logo de la clínica manda; sin logo se queda el "SIE" vertical de siempre.
            La barra es oscura, así que un logo de trazo negro no se verá: por eso el
            ajuste avisa de subirlo con fondo transparente. */}
        {logo
          ? <img src={logo} alt="" className="sb-marca"/>
          : <div className="sb-logo">SIE</div>}
        {NAV.map(n=>(
          <Link key={n.href} href={n.href} className={`nav-item ${pathname.startsWith(n.href)?'active':''}`}>
            <Ic name={n.icon} size={20} strokeWidth={2}/>
            <span className="nav-label">{n.label}</span>
          </Link>
        ))}
        {veCobros && (
          <Link href={NAV_COBROS.href} className={`nav-item ${pathname.startsWith(NAV_COBROS.href)?'active':''}`}>
            <Ic name={NAV_COBROS.icon} size={20} strokeWidth={2}/>
            <span className="nav-label">{NAV_COBROS.label}</span>
          </Link>
        )}
        {veFinanzas && (
          <Link href={NAV_FINANZAS.href} className={`nav-item ${pathname.startsWith(NAV_FINANZAS.href)?'active':''}`}>
            <Ic name={NAV_FINANZAS.icon} size={20} strokeWidth={2}/>
            <span className="nav-label">{NAV_FINANZAS.label}</span>
          </Link>
        )}
        <div style={{marginTop:'auto'}}>
          <button className="nav-item" onClick={handleLogout}>
            <Ic name="salir" size={20} strokeWidth={2}/>
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
