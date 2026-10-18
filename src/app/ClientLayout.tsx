'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import AvisoRenovacion from './AvisoRenovacion'
import { renovarCuotas } from '@/lib/bonos'
import { aplicarEstadosProgramados } from '@/lib/estadosPaciente'
import { Ic } from '@/lib/icons'

// Los pilares van en tres bloques, separados por una rayita: lo del día a día,
// lo de programar y lo de gestión. Ajustes baja al pie, junto a tu inicial.
const NAV_DIA = [
  { href: '/agenda', icon: 'agenda', label: 'Agenda' },
  { href: '/pacientes', icon: 'pacientes', label: 'Pacientes' },
  { href: '/taller', icon: 'taller', label: 'Taller' },
]
const NAV_PROGRAMAR = [
  { href: '/torno', icon: 'recuperar', label: 'El torno' },
  { href: '/entrenamiento', icon: 'biblioteca', label: 'Biblioteca' },
  { href: '/valoracion', icon: 'valoracion', label: 'Valoración' },
]
const NAV_STATS = { href: '/estadisticas', icon: 'stats', label: 'Stats' }
const NAV_AJUSTES = { href: '/ajustes', icon: 'ajustes', label: 'Ajustes' }

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
  /** Bonos activos sin cobrar (pendientes + impagos): el numerito de Cobros. */
  const [porCobrar, setPorCobrar] = useState(0)
  const [menuUsuario, setMenuUsuario] = useState(false)
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

  // El numerito de Cobros se refresca al cambiar de pantalla: así, al volver de cobrar,
  // ya ha bajado sin tener que recargar.
  useEffect(() => {
    if (!user?.id) return
    supabase.from('bonos').select('estado_pago').eq('activo', true).in('estado_pago', ['pendiente', 'impago'])
      .then(({ data }) => setPorCobrar((data || []).length))
  }, [user, pathname])

  // Red de seguridad: la página en sí nunca debe quedar desplazada (lo que hace scroll
  // es la caja de contenido). Si algo la ha movido, al cambiar de pantalla vuelve a su sitio.
  useEffect(() => {
    const raiz = document.scrollingElement
    if (raiz && raiz.scrollTop) raiz.scrollTop = 0
    const shell = document.querySelector('.shell') as HTMLElement | null
    if (shell && shell.scrollTop) shell.scrollTop = 0
  }, [pathname])

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

  const veFinanzas = perfil?.rol==='admin' || perfil?.permisos?.finanzas===true
  const veCobros   = veFinanzas || perfil?.permisos?.cobros===true

  // Un pilar de la barra: icono grande, el nombre en una burbuja al pasar el ratón y,
  // si toca, un numerito (Cobros).
  const enlace = (n: { href: string, icon: string, label: string, n?: number }) => (
    <Link key={n.href} href={n.href} className={`nav-item ${pathname.startsWith(n.href) ? 'active' : ''}`} aria-label={n.label}>
      <Ic name={n.icon} size={21} strokeWidth={1.7}/>
      {!!n.n && <span className="sb-b">{n.n > 99 ? '99+' : n.n}</span>}
      <span className="sb-tip">{n.label}</span>
    </Link>
  )

  return (
    <div className={`shell ${pathname.startsWith('/torno') ? 'inmersivo' : ''}`}>
      {/* Todo el torno es inmersivo, no solo su primera pantalla: el menú negro
          aparecía en cuanto entrabas a programar a alguien. */}
      {pathname.startsWith('/torno') && <div className="borde-izq"/>}
      <AvisoRenovacion visible={veFinanzas}/>
      <nav className="sidebar">
        {/* El logo de la clínica manda; sin logo, la pastilla verde con "SIE". */}
        {logo
          ? <img src={logo} alt="" className="sb-marca"/>
          : <div className="sb-logo">SIE</div>}
        {NAV_DIA.map(enlace)}
        <span className="sb-sep"/>
        {NAV_PROGRAMAR.map(enlace)}
        <span className="sb-sep"/>
        {veCobros && enlace({ ...NAV_COBROS, n: porCobrar })}
        {veFinanzas && enlace(NAV_FINANZAS)}
        {enlace(NAV_STATS)}
        <div className="sb-pie">
          {enlace(NAV_AJUSTES)}
          <div style={{ position: 'relative' }}>
            <button className="sb-av" onClick={() => setMenuUsuario(v => !v)} title={perfil?.nombre || user.email}>
              {((perfil?.nombre || user.email || '?').trim()[0] || '?').toUpperCase()}
            </button>
            {menuUsuario && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuUsuario(false)}/>
                <div className="sb-menu">
                  <div style={{ fontSize: 13, color: 'var(--n)', fontWeight: 500 }}>{perfil?.nombre || 'Tu cuenta'}</div>
                  <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 8 }}>{user.email}</div>
                  <button className="sb-menu-it" onClick={handleLogout}><Ic name="salir" size={15}/> Cerrar sesión</button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>
      {/* Sin barra superior: cada pantalla ya dice dónde estás (y la agenda pone la
          fecha en grande). Eran 52 px de alto en todas las pantallas. */}
      <main className="content">{children}</main>
    </div>
  )
}
