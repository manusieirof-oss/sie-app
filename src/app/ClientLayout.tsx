'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import AvisoRenovacion from './AvisoRenovacion'
import { renovarCuotas } from '@/lib/bonos'
import { aplicarEstadosProgramados } from '@/lib/estadosPaciente'
import { Ic } from '@/lib/icons'
import HojaCita from './movil/components/HojaCita'
import { PuertaConfidencialidad } from '@/components/Confidencialidad'
import { firmaVigente } from '@/lib/confidencialidad'
import { esCompartido, marcarCompartido, recordar, apuntarActividad, caducada, MINUTOS_INACTIVO } from '@/lib/compartido'
import { pulsoActivo } from '@/lib/pulsoVivo'
import GuiaInicio, { guiaVista } from '@/components/GuiaInicio'
import { nivelDe, MINIMO, RUTAS, ProveedorNivel, NIVELES, mezclarMinimos, type Minimos, type Accion } from '@/lib/permisos'

// Los pilares van en tres bloques, separados por una rayita: lo del día a día,
// lo de programar y lo de gestión. Ajustes baja al pie, junto a tu inicial.
// `acc`: la acción que pide (lib/permisos). Sin `acc`, lo ve todo el equipo.
const NAV_DIA = [
  { href: '/hoy', icon: 'sol', label: 'Hoy' },
  { href: '/agenda', icon: 'agenda', label: 'Agenda' },
  { href: '/pacientes', icon: 'pacientes', label: 'Pacientes', acc: 'pacientes' as Accion },
  { href: '/taller', icon: 'taller', label: 'Taller' },
]
const NAV_PROGRAMAR = [
  { href: '/torno', icon: 'recuperar', label: 'El torno', acc: 'torno' as Accion },
  { href: '/entrenamiento', icon: 'biblioteca', label: 'Biblioteca', acc: 'biblioteca' as Accion },
  { href: '/valoracion', icon: 'valoracion', label: 'Valoración', acc: 'valoracion' as Accion },
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
  /** Bonos activos sin cobrar (pendientes + impagos): el numerito de Cobros. */
  const [porCobrar, setPorCobrar] = useState(0)
  const [menuUsuario, setMenuUsuario] = useState(false)
  const [citaMovil, setCitaMovil] = useState(false)
  /** ¿Ha aceptado el compromiso de confidencialidad vigente? undefined = mirando. */
  const [firmada, setFirmada] = useState<boolean | undefined>(undefined)
  const [perfilListo, setPerfilListo] = useState(false)
  /** La guía de inicio en pantalla (sale sola la primera vez al nivel 1; siempre desde el menú). */
  const [guia, setGuia] = useState(false)
  /** Este equipo es compartido (tablet de sala, ordenador central): lib/compartido. */
  const [compartido, setCompartido] = useState(false)
  useEffect(() => { setCompartido(esCompartido()) }, [])
  /** Mínimos de cada acción: los de la tabla permisos_nivel, o los de serie. */
  const [minimos, setMinimos] = useState<Minimos>(MINIMO)
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
    if (!user?.id) return
    // Si la tabla aún no existe (antes de lanzar el SQL) no se bloquea a nadie: mejor
    // dejar entrar que dejar a toda la clínica fuera por un paso pendiente.
    firmaVigente(user.id).then(f => setFirmada(!!f)).catch(() => setFirmada(true))
  }, [user?.id])

  useEffect(() => {
    if (user?.id) {
      supabase.from('perfiles').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
        setPerfil(data)
        setPerfilListo(true)
        if (esCompartido()) recordar(user.email || '', data?.nombre || '')
        supabase.from('permisos_nivel').select('accion,minimo').then(({ data: f }) => { if (f) setMinimos(mezclarMinimos(f)) })
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

  // EN EL MÓVIL, A LA VERSIÓN MÓVIL. Al abrir la app (o la agenda) en una pantalla
  // estrecha se va a /movil. Si alguien eligió la versión completa desde "Yo", se
  // respeta: queda apuntado en este móvil.
  useEffect(() => {
    if (!user) return
    const estrecha = window.matchMedia?.('(max-width: 760px)').matches
    let completa = false
    try { completa = localStorage.getItem('sie_version') === 'completa' } catch {}
    if (estrecha && !completa && (pathname === '/' || pathname === '/agenda' || pathname === '/hoy')) router.replace('/movil')
  }, [user, pathname])

  // QUIEN ENTRA POR UNA DIRECCIÓN QUE NO LE TOCA (un enlace guardado, la ficha desde
  // la agenda…) vuelve a Hoy. Se espera a tener el perfil para no echar a nadie
  // mientras carga.
  useEffect(() => {
    if (!user || !perfilListo) return
    const n = nivelDe(perfil)
    const regla = RUTAS.find(([pre]) => pathname === pre || pathname.startsWith(pre + '/'))
    const dinero = pathname.startsWith('/finanzas') ? !(n >= 4 || (perfil?.rol !== 'admin' && perfil?.permisos?.finanzas === true))
      : pathname.startsWith('/cobros') ? !(n >= minimos.cobros || perfil?.permisos?.cobros === true || perfil?.permisos?.finanzas === true)
      : false
    if ((regla && n < minimos[regla[1]]) || dinero) router.replace('/hoy')
  }, [user, perfilListo, perfil, pathname, minimos])

  // EQUIPO COMPARTIDO: la sesión se cierra sola tras MINUTOS_INACTIVO sin tocarlo. La
  // marca de «último toque» se guarda, así que también vale si la tablet se durmió o
  // se recarga a la mañana siguiente. Con bandas de pulso emitiendo no se cierra:
  // en plena clase la pantalla puede estar un buen rato sin que nadie la toque.
  useEffect(() => {
    if (!user?.id || !compartido) return
    const cerrar = async () => {
      await supabase.auth.signOut()
      window.location.href = '/login?motivo=inactivo'
    }
    if (caducada()) { cerrar(); return }
    apuntarActividad()
    let ultimo = Date.now()
    // Cada toque no se escribe: basta con uno cada 15 s.
    const toque = () => { const n = Date.now(); if (n - ultimo > 15_000) { ultimo = n; apuntarActividad() } }
    const mirar = () => {
      if (pulsoActivo()) { apuntarActividad(); return }
      if (caducada()) cerrar()
    }
    const ev = ['pointerdown', 'keydown', 'touchstart', 'wheel']
    ev.forEach(e => window.addEventListener(e, toque, { passive: true }))
    document.addEventListener('visibilitychange', mirar)
    const iv = setInterval(mirar, 30_000)
    return () => {
      ev.forEach(e => window.removeEventListener(e, toque))
      document.removeEventListener('visibilitychange', mirar)
      clearInterval(iv)
    }
  }, [user?.id, compartido])

  const alternarCompartido = () => {
    const v = !compartido
    marcarCompartido(v)
    if (v && user) recordar(user.email || '', perfil?.nombre || '')
    setCompartido(v)
  }

  // LA PRIMERA VEZ DE QUIEN EMPIEZA: la guía sale sola, una vez por persona y equipo,
  // ya firmado el compromiso de confidencialidad (que va antes que nada).
  useEffect(() => {
    if (!user?.id || !perfilListo || firmada !== true) return
    if (nivelDe(perfil) === 1 && !guiaVista(user.id)) setGuia(true)
  }, [user?.id, perfilListo, firmada, perfil])

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

  // Sin el compromiso de confidencialidad aceptado no se ve nada de SIE.
  if (firmada === undefined) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--n)'}}>
      <span style={{color:'var(--g)',fontSize:14,letterSpacing:4}}>SIE</span>
    </div>
  )
  if (!firmada) return <PuertaConfidencialidad nombre={perfil?.nombre || user.email || ''} onAceptado={() => setFirmada(true)} onSalir={handleLogout}/>

  // NIVELES (lib/permisos): Dirección lo ve todo; cada nivel de entrenador, lo suyo,
  // para que la barra no le pese. Dirección puede «ver como» un nivel para comprobar
  // qué ven los demás; queda apuntado en este equipo.
  const nivel = nivelDe(perfil)
  const esAdmin = perfil?.rol==='admin'
  const esDireccion = nivel >= 4
  const veFinanzas = esDireccion || (!esAdmin && perfil?.permisos?.finanzas===true)
  const veCobros   = veFinanzas || nivel >= minimos.cobros || perfil?.permisos?.cobros===true
  const ve = (n: { acc?: Accion }) => !n.acc || nivel >= minimos[n.acc]
  /** Dirección «ve como» un nivel (1-3) o vuelve a lo suyo (null). */
  const cambiarVista = (v: string | null) => {
    try { v ? localStorage.setItem('sie_ver_como', v) : localStorage.removeItem('sie_ver_como') } catch {}
    setMenuUsuario(false)
    window.location.href = '/hoy'
  }

  // Un pilar de la barra: icono grande, el nombre en una burbuja al pasar el ratón y,
  // si toca, un numerito (Cobros).
  const enlace = (n: { href: string, icon: string, label: string, n?: number, acc?: Accion }) => (
    <Link key={n.href} href={n.href} data-guia={'nav' + n.href} className={`nav-item ${pathname.startsWith(n.href) ? 'active' : ''}`} aria-label={n.label}>
      <Ic name={n.icon} size={21} strokeWidth={1.7}/>
      {!!n.n && <span className="sb-b">{n.n > 99 ? '99+' : n.n}</span>}
      <span className="sb-tip">{n.label}</span>
    </Link>
  )

  // VERSIÓN MÓVIL: sin barra lateral; abajo, una barra de pestañas a un pulgar.
  if (pathname.startsWith('/movil')) {
    const tab = (href: string, icono: string, txt: string) => {
      const on = href === '/movil' ? pathname === '/movil' || pathname.startsWith('/movil/clase') : pathname.startsWith(href)
      return <Link href={href} className={`m-tab ${on ? 'on' : ''}`}><Ic name={icono} size={21} strokeWidth={1.8}/>{txt}</Link>
    }
    return (
      <div className="m-shell">
        <main className="m-main"><ProveedorNivel value={{ nivel, minimos }}>{children}</ProveedorNivel></main>
        <nav className="m-tabs">
          {tab('/movil', 'agenda', 'Hoy')}
          {nivel >= minimos.pacientes && tab('/movil/pacientes', 'pacientes', 'Pacientes')}
          <button className="m-tab-mas" onClick={() => setCitaMovil(true)} aria-label="Nueva cita"><Ic name="mas" size={22}/></button>
          {tab('/movil/avisos', 'campana', 'Avisos')}
          {tab('/movil/yo', 'usuario', 'Yo')}
        </nav>
        {citaMovil && <HojaCita onCerrar={() => setCitaMovil(false)} onCreada={() => window.dispatchEvent(new Event('sie-cita'))}/>}
        {guia && <GuiaInicio uid={user.id} onCerrar={() => setGuia(false)}/>}
      </div>
    )
  }

  return (
    <div className={`shell ${pathname.startsWith('/torno') ? 'inmersivo' : ''}`}>
      {/* Todo el torno es inmersivo, no solo su primera pantalla: el menú negro
          aparecía en cuanto entrabas a programar a alguien. */}
      {pathname.startsWith('/torno') && <div className="borde-izq"/>}
      <AvisoRenovacion visible={veFinanzas}/>
      <nav className="sidebar">
        {/* El logo del PROGRAMA, siempre. El de Ajustes → Clínica es el de la clínica y va
            en informes y facturas; mezclarlos obligaba a elegir entre los dos. */}
        <img src="/marca/sie-logo.svg" alt="SIE" className="sb-marca"/>
        {NAV_DIA.filter(ve).map(enlace)}
        {NAV_PROGRAMAR.some(ve) && <span className="sb-sep"/>}
        {NAV_PROGRAMAR.filter(ve).map(enlace)}
        <span className="sb-sep"/>
        {veCobros && enlace({ ...NAV_COBROS, n: porCobrar })}
        {veFinanzas && enlace(NAV_FINANZAS)}
        {esDireccion && enlace(NAV_STATS)}
        <div className="sb-pie">
          {esDireccion && enlace(NAV_AJUSTES)}
          <div style={{ position: 'relative' }}>
            <button className="sb-av" data-guia="menu-usuario" onClick={() => setMenuUsuario(v => !v)} title={perfil?.nombre || user.email}>
              {((perfil?.nombre || user.email || '?').trim()[0] || '?').toUpperCase()}
            </button>
            {menuUsuario && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuUsuario(false)}/>
                <div className="sb-menu">
                  <div style={{ fontSize: 13, color: 'var(--n)', fontWeight: 500 }}>{perfil?.nombre || 'Tu cuenta'}</div>
                  <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 8 }}>{user.email}</div>
                  <Link href="/movil" className="sb-menu-it" style={{ color: 'var(--gd)' }}
                    onClick={() => { try { localStorage.removeItem('sie_version') } catch {}; setMenuUsuario(false) }}>
                    <Ic name="telefono" size={15}/> Versión móvil
                  </Link>
                  {/* Solo dirección marca o desmarca un equipo como compartido: si lo pudiera
                      quitar cualquiera, la sesión volvería a quedarse abierta en la tablet. */}
                  {esAdmin && <button className="sb-menu-it" onClick={alternarCompartido}
                    title={`Se cierra la sesión tras ${MINUTOS_INACTIVO} min sin tocarlo y al entrar se elige quién eres`}>
                    <Ic name={compartido ? 'check' : 'pacientes'} size={15}/> {compartido ? 'Equipo compartido ✓' : 'Este equipo es compartido'}
                  </button>}
                  <Link href="/ajustes?tab=cuenta" className="sb-menu-it" onClick={() => setMenuUsuario(false)}>
                    <Ic name="candado" size={15}/> Mi cuenta
                  </Link>
                  <button className="sb-menu-it" onClick={() => { setMenuUsuario(false); setGuia(true) }}>
                    <Ic name="ayuda" size={15}/> Guía de inicio
                  </button>
                  <Link href="/confidencialidad" className="sb-menu-it" onClick={() => setMenuUsuario(false)}>
                    <Ic name="firmar" size={15}/> Confidencialidad
                  </Link>
                  {esAdmin && (esDireccion
                    ? NIVELES.map(x => (
                      <button key={x.n} className="sb-menu-it" onClick={() => cambiarVista(String(x.n))}>
                        <Ic name="ojo" size={15}/> Ver como {x.nombre.toLowerCase()}
                      </button>))
                    : <button className="sb-menu-it" onClick={() => cambiarVista(null)}>
                        <Ic name="ojo" size={15}/> Volver a dirección
                      </button>)}
                  <button className="sb-menu-it" onClick={handleLogout}><Ic name="salir" size={15}/> {compartido ? 'Cambiar de usuario' : 'Cerrar sesión'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>
      {/* Sin barra superior: cada pantalla ya dice dónde estás (y la agenda pone la
          fecha en grande). Eran 52 px de alto en todas las pantallas. */}
      <main className="content"><ProveedorNivel value={{ nivel, minimos }}>{children}</ProveedorNivel></main>
      {guia && <GuiaInicio uid={user.id} onCerrar={() => setGuia(false)}/>}
    </div>
  )
}
