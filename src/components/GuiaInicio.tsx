'use client'
import { useEffect, useLayoutEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// GUÍA DE INICIO: SIE enseñado sobre sus pantallas de verdad.
//
// Para quien empieza (nivel 1): la primera vez que entra, un recorrido corto por Hoy,
// la Agenda y el Taller. Cada paso señala un sitio de la pantalla (los `data-guia`
// repartidos por la app) y explica en una frase qué es y qué se hace ahí. Si ese sitio
// no está en pantalla (no hay clase ahora, nadie en la sala…), el paso sale igual en
// el centro: la explicación sirve aunque falte el ejemplo.
//
// Se repite cuando se quiera desde el menú de la inicial → «Guía de inicio».
// ---------------------------------------------------------------------------

export type Paso = { ruta?: string, sitio?: string, titulo: string, texto: string }

export const PASOS: Paso[] = [
  { titulo: 'Bienvenido a SIE', texto: 'En dos minutos te enseño lo que vas a usar: Hoy, la Agenda y el Taller. Puedes salir cuando quieras y repetir la guía desde tu inicial, abajo a la izquierda.' },
  { ruta: '/hoy', sitio: 'nav/hoy', titulo: 'Hoy', texto: 'Tu punto de partida. Cada día empieza aquí: tu clase, tus tareas y tus notas.' },
  { ruta: '/hoy', sitio: 'hoy-clase', titulo: 'La clase de ahora', texto: 'Quién viene, qué sesión tiene cada uno y si hay algo que vigilar (alertas, tests). Toca a una persona y vas directo a su entreno en el Taller.' },
  { ruta: '/hoy', sitio: 'hoy-tareas', titulo: 'Tus tareas', texto: 'Las que te han puesto a ti y las del equipo. Márcalas al hacerlas.' },
  { ruta: '/hoy', sitio: 'hoy-notas', titulo: 'Mis notas', texto: 'Para apuntarte cosas tuyas. Solo las ves tú.' },
  { ruta: '/agenda', sitio: 'nav/agenda', titulo: 'Agenda', texto: 'Las clases del día por hora y sala. Desde aquí se consulta: quién viene y a qué hora.' },
  { ruta: '/agenda', sitio: 'agenda-entreno', titulo: 'El entreno de cada persona', texto: 'Este botón abre su entreno, igual que en el Taller. Es lo único que necesitas tocar en la agenda.' },
  { ruta: '/taller', sitio: 'nav/taller', titulo: 'Taller', texto: 'Donde se da la clase. Al entrar ya está en la clase de ahora y en tu sala.' },
  { ruta: '/taller', sitio: 'taller-banda', titulo: 'Arriba, la clase', texto: 'El día, la hora y la sala; con una cabeza ves a cada persona por separado y con varias, a todos a la vez. El corazón abre los pulsómetros.' },
  { ruta: '/taller', sitio: 'taller-personas', titulo: 'Las personas', texto: 'Toca a una para ver su entreno. En la elegida, «▾» te enseña su sesión, sus objetivos y sus alertas; si notas algo (una molestia, un mareo), apúntalo ahí como incidencia.' },
  { ruta: '/taller', sitio: 'taller-series', titulo: 'Apuntar lo que hace', texto: 'Toca la casilla y apunta peso, repeticiones o tiempo. Lo que sale en gris es lo previsto: si lo hace igual, no hace falta tocarlo. Se guarda solo.' },
  { ruta: '/taller', sitio: 'taller-nolohizo', titulo: 'Si no hace un ejercicio', texto: 'Desde aquí marcas «No lo hizo». Lo demás se da por hecho tal como sale.' },
  { ruta: '/taller', sitio: 'taller-finalizar', titulo: 'Al acabar la clase', texto: 'Pulsa Finalizar. Queda guardado en el historial de cada uno, con lo apuntado y lo que salía en gris.' },
  { sitio: 'menu-usuario', titulo: 'Tu menú', texto: 'Aquí cambias tu contraseña (Mi cuenta), ves tu compromiso de confidencialidad y repites esta guía. ¡Listo, a por la clase!' },
]

/**
 * GUÍA DEL NIVEL 2: lo que se suma a dar la clase. Ajustar la sesión del día sin tocar
 * su plan, la cita (falta, cancelar, sala), las fichas, la valoración y la biblioteca
 * para consultar.
 */
export const PASOS_N2: Paso[] = [
  { titulo: 'Guía del entrenador', texto: 'Además de dar la clase, ahora puedes ajustar la sesión del día de cada persona. Todo lo que cambies es solo para hoy: su sesión de siempre no se toca. Te lo enseño en un minuto.' },
  { ruta: '/pacientes', sitio: 'nav/pacientes', titulo: 'Pacientes', texto: 'Sus fichas: datos, alertas, sesiones e historial. Desde aquí puedes ver qué hizo cada día y ajustar el día de una cita concreta.' },
  { ruta: '/valoracion', sitio: 'nav/valoracion', titulo: 'Valoración', texto: 'Las valoraciones y los tests de cada paciente.' },
  { ruta: '/entrenamiento', sitio: 'nav/entrenamiento', titulo: 'Biblioteca', texto: 'Para consultar los ejercicios: cómo se hacen, en qué fijarse y sus variantes. Toca uno para ver su ficha.' },
  { ruta: '/taller', sitio: 'taller-personas', titulo: 'La persona y su cita', texto: 'En la persona elegida, «▾» abre su cita: marcar falta o cancelar, cambiar de sala, elegir otra de sus sesiones para hoy y apuntar incidencias.' },
  { ruta: '/taller', sitio: 'taller-metodo', titulo: 'El método de una parte', texto: 'El lápiz de cada parte cambia, solo para hoy, el método (circuito, superseries…), las series o vueltas y los descansos.' },
  { ruta: '/taller', sitio: 'taller-nolohizo', titulo: 'Cambiar un ejercicio', texto: 'Aquí cambias un ejercicio por otro solo hoy: primero salen los que hacen el mismo movimiento, y en «Cualquiera», toda la biblioteca.' },
  { ruta: '/taller', sitio: 'taller-series', titulo: 'Lo que hace', texto: 'Como siempre: apunta lo que cambia y lo que sale en gris se da por hecho. También puedes cambiar el régimen o el lado de hoy en su tarjeta.' },
  { ruta: '/taller', sitio: 'taller-finalizar', titulo: 'Al acabar', texto: 'Finaliza la clase. Si hay varias salas en pantalla, te pregunta cuál.' },
  { sitio: 'menu-usuario', titulo: 'Listo', texto: 'Esta guía y la de inicio están siempre en tu menú. Cambiar una sesión para siempre lo hace el encargado/a.' },
]

const CLAVE = (uid: string, n = 1) => n === 2 ? `sie_guia2_vista_${uid}` : `sie_guia_vista_${uid}`
export const guiaVista = (uid: string, n = 1) => { try { return localStorage.getItem(CLAVE(uid, n)) === '1' } catch { return true } }
const marcarVista = (uid: string, n = 1) => { try { localStorage.setItem(CLAVE(uid, n), '1') } catch {} }

export default function GuiaInicio({ uid, onCerrar, nivel = 1 }: { uid: string, onCerrar: () => void, nivel?: 1 | 2 }) {
  const PASOS_G = nivel === 2 ? PASOS_N2 : PASOS
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  /* MIENTRAS SE BUSCA EL SITIO, NO SE ENSEÑA EL GLOBO. Antes salía en el centro y al
     encontrar el sitio saltaba a su lado. Ahora aparece ya en su sitio (o en el centro
     si de verdad no está). */
  const [buscando, setBuscando] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const paso = PASOS_G[i]

  // Si el paso es de otra pantalla, se va a ella.
  useEffect(() => {
    if (paso.ruta && !pathname.startsWith(paso.ruta)) router.push(paso.ruta)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  // Durante la guía se ven los botones que normalmente solo salen al pasar el ratón
  // (los de cada persona en la agenda): si no, se señalaba un hueco vacío.
  useEffect(() => {
    document.body.classList.add('guia-on')
    return () => document.body.classList.remove('guia-on')
  }, [])

  // Busca el sitio que señala (la pantalla puede tardar en pintarlo) y lo sigue si se mueve.
  useLayoutEffect(() => {
    setRect(null)
    if (!paso.sitio) { setBuscando(false); return }
    setBuscando(true)
    let vivo = true, intentos = 0
    const visible = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const buscar = () => {
      if (!vivo) return
      const el = Array.from(document.querySelectorAll(`[data-guia="${paso.sitio}"]`)).find(x => visible(x as HTMLElement)) as HTMLElement | undefined
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setTimeout(() => { if (vivo) { setRect(el.getBoundingClientRect()); setBuscando(false) } }, 400)
        return
      }
      if (++intentos < 25) setTimeout(buscar, 120)
      else setBuscando(false)
    }
    buscar()
    const recolocar = () => {
      const el = Array.from(document.querySelectorAll(`[data-guia="${paso.sitio}"]`)).find(x => visible(x as HTMLElement)) as HTMLElement | undefined
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', recolocar)
    window.addEventListener('scroll', recolocar, true)
    return () => { vivo = false; window.removeEventListener('resize', recolocar); window.removeEventListener('scroll', recolocar, true) }
  }, [i, pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const cerrar = () => { marcarVista(uid, nivel); onCerrar() }
  const ultimo = i === PASOS_G.length - 1

  // El globo: debajo del sitio si cabe, si no encima; sin sitio, en el centro.
  const W = 340, M = 12
  let globo: React.CSSProperties = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  if (rect && typeof window !== 'undefined') {
    const left = Math.max(M, Math.min(rect.left + rect.width / 2 - W / 2, window.innerWidth - W - M))
    const abajo = window.innerHeight - rect.bottom > 220
    globo = abajo ? { left, top: rect.bottom + 14 } : { left, top: Math.max(M, rect.top - 14), transform: 'translateY(-100%)' }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      {/* El velo oscuro con un hueco sobre el sitio que se explica. */}
      {rect
        ? <div style={{ position: 'fixed', left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12, borderRadius: 14,
            boxShadow: '0 0 0 9999px rgba(38,40,37,.55)', border: '2px solid #fff', transition: 'all .25s', pointerEvents: 'none' }}/>
        : <div style={{ position: 'fixed', inset: 0, background: 'rgba(38,40,37,.55)' }}/>}
      {/* Tapa los clics: durante la guía no se toca la app sin querer. */}
      <div style={{ position: 'fixed', inset: 0 }}/>
      <div style={{ position: 'fixed', width: W, maxWidth: `calc(100vw - ${2 * M}px)`, background: '#fff', borderRadius: 16, padding: '16px 18px',
        boxShadow: '0 12px 40px rgba(0,0,0,.25)', ...globo, visibility: buscando ? 'hidden' : 'visible' }}>
        <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 4 }}>{i + 1} de {PASOS_G.length}</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--n)', marginBottom: 6 }}>{paso.titulo}</div>
        <div style={{ fontSize: 13.5, color: 'var(--gr)', lineHeight: 1.55 }}>{paso.texto}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <button onClick={cerrar} style={{ border: 0, background: 'none', color: 'var(--grl)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Salir</button>
          <span style={{ flex: 1 }}/>
          {i > 0 && <button className="btn btn-s btn-sm" onClick={() => setI(i - 1)}>Atrás</button>}
          <button className="btn btn-p btn-sm" onClick={() => ultimo ? cerrar() : setI(i + 1)}>{ultimo ? 'Terminar' : 'Siguiente'}</button>
        </div>
      </div>
    </div>
  )
}
