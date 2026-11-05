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

/**
 * `haz`: PASO INTERACTIVO. No se sigue con «Siguiente»: hay que hacerlo de verdad (la app
 * avisa con ese nombre, lib/guiaEventos). Se hace en modo práctica, así que no se rompe
 * nada. Si algo falla, «Saltar este paso».
 */
export type Paso = { ruta?: string, sitio?: string, titulo: string, texto: string, haz?: string }

export const PASOS: Paso[] = [
  { titulo: 'Bienvenido a SIE', texto: 'Te enseño lo que vas a usar: Hoy, la Agenda y el Taller. Estás en MODO PRÁCTICA, con pacientes de prueba: en algunos pasos tendrás que hacerlo tú, tranquilo, que no toca a ningún paciente real.' },
  { ruta: '/hoy', sitio: 'nav/hoy', titulo: 'Hoy', texto: 'Tu punto de partida. Cada día empieza aquí: tu clase, tus tareas y tus notas.' },
  { ruta: '/hoy', sitio: 'hoy-clase', titulo: 'La clase de ahora', texto: 'Quién viene, qué sesión tiene cada uno y si hay algo que vigilar (alertas, tests).' },
  { ruta: '/hoy', sitio: 'hoy-tareas', titulo: 'Tus tareas', texto: 'Las que te han puesto a ti y las del equipo. Márcalas al hacerlas.' },
  { ruta: '/hoy', sitio: 'hoy-notas', titulo: 'Mis notas', texto: 'Para apuntarte cosas tuyas. Solo las ves tú.' },
  { ruta: '/agenda', sitio: 'nav/agenda', titulo: 'Agenda', texto: 'Las clases del día por hora y sala: quién viene y a qué hora.' },
  { ruta: '/agenda', sitio: 'agenda-entreno', titulo: 'Su sesión, desde la agenda', haz: 'agenda-entreno', texto: 'Hazlo tú: toca la mancuerna de una persona. Se abre su entreno de hoy, igual que en el Taller, y en «Programación» ves las sesiones que le tocan los próximos días.' },
  { ruta: '/taller', sitio: 'nav/taller', titulo: 'Taller', texto: 'Donde se da la clase. Al entrar ya está en la clase de ahora y en tu sala.' },
  { ruta: '/taller', sitio: 'taller-banda', titulo: 'Arriba, la clase', texto: 'El día, la hora y la sala; con una cabeza ves a cada persona por separado y con varias, a todos a la vez. El corazón abre los pulsómetros.' },
  { ruta: '/taller', sitio: 'taller-personas', titulo: 'Elegir a una persona', haz: 'persona', texto: 'Hazlo tú: toca a otra persona de la fila. Abajo sale su entreno de hoy.' },
  { ruta: '/taller', sitio: 'taller-personas', titulo: 'Su cita y sus alertas', haz: 'alerta', texto: 'Hazlo tú: vuelve a tocar a la persona elegida. Se abre su cita: su sesión de hoy, su objetivo y sus alertas. Apunta una alerta (por ejemplo «Dolor / molestia: le molesta la rodilla al bajar») y pulsa Activar.' },
  { ruta: '/taller', sitio: 'taller-series', titulo: 'Apuntar lo que hace', haz: 'serie', texto: 'Hazlo tú: toca la casilla de un ejercicio y apunta peso, repeticiones o tiempo. Lo que sale en gris es lo previsto: si lo hace igual, no hace falta tocarlo. Se guarda solo.' },
  { ruta: '/taller', sitio: 'taller-notas', titulo: 'Notas', haz: 'nota', texto: 'Hazlo tú: toca el lápiz de un ejercicio y escribe una nota («mejor con goma 2»). Ahí también ves lo que dice el plan. La próxima vez se ve.' },
  { ruta: '/taller', sitio: 'taller-ejecucion', titulo: 'Ejecución', haz: 'ejecucion', texto: 'Hazlo tú: toca el contador (0/4) y marca un punto de buena ejecución que haga bien. Así se ve si mejora la técnica.' },
  { ruta: '/taller', sitio: 'taller-nolohizo', titulo: 'Si no hace un ejercicio', haz: 'nolohizo', texto: 'Hazlo tú: toca este botón y marca «No lo hizo». Se deshace tocando otra vez. Lo demás se da por hecho tal como sale.' },
  { ruta: '/taller', sitio: 'taller-finalizar', titulo: 'Al acabar la clase', haz: 'finalizar', texto: 'Hazlo tú: pulsa Finalizar. Queda guardado en el historial de cada uno, con lo apuntado y lo que salía en gris.' },
  { sitio: 'menu-usuario', titulo: 'Tu menú', texto: 'Aquí cambias tu contraseña (Mi cuenta), ves tu compromiso de confidencialidad y repites esta guía. Sigues en modo práctica: prueba lo que quieras y sal con «Salir» en la franja naranja.' },
]

/**
 * GUÍA DEL NIVEL 2: lo que se suma a dar la clase. Ajustar la sesión del día sin tocar
 * su plan, la cita (falta, cancelar, sala), las fichas, la valoración y la biblioteca
 * para consultar.
 */
export const PASOS_N2: Paso[] = [
  { titulo: 'Guía del entrenador', texto: 'Además de dar la clase, ahora puedes ajustar la clase de hoy de cada persona. Todo lo que cambies es solo para hoy: su sesión de siempre no se toca. Te lo enseño en un minuto.' },
  { ruta: '/entrenamiento', sitio: 'nav/entrenamiento', titulo: 'Biblioteca', texto: 'Para consultar los ejercicios: cómo se hacen, en qué fijarse y sus variantes. Toca uno para ver su ficha.' },
  { ruta: '/taller', sitio: 'taller-personas', titulo: 'La sesión de hoy', texto: 'En la persona elegida, «▾» abre su cita: puedes cambiar la sesión de hoy por otra de las suyas y apuntar alertas.' },
  { ruta: '/taller', sitio: 'taller-metodo', titulo: 'El método de una parte', haz: 'metodo', texto: 'Hazlo tú: toca el lápiz de una parte y cambia algo solo para hoy: el método (circuito, superseries…), las series o vueltas o los descansos.' },
  { ruta: '/taller', sitio: 'taller-anadir', titulo: 'Añadir un ejercicio', haz: 'anadir', texto: 'Hazlo tú: si la sesión se queda corta, el «+» de la parte añade un ejercicio solo para hoy. Te enseña los similares a los de esa parte.' },
  { ruta: '/taller', sitio: 'taller-nolohizo', titulo: 'Cambiar un ejercicio', haz: 'cambiar', texto: 'Hazlo tú: aquí cambias un ejercicio por otro similar, solo hoy: salen los que hacen el mismo movimiento.' },
  { ruta: '/taller', sitio: 'taller-franja', titulo: 'Cómo se hace hoy', haz: 'franja', texto: 'Hazlo tú: toca cada palabra para cambiarla solo hoy: el lado (bilateral, unilateral, alterno), la ejecución (concéntrico, isométrico…) y si va por repeticiones o segundos. En ámbar, lo que hoy es distinto al plan.' },
  { ruta: '/taller', sitio: 'taller-finalizar', titulo: 'Al acabar', texto: 'Finaliza la clase. Si hay varias salas en pantalla, te pregunta cuál.' },
  { sitio: 'menu-usuario', titulo: 'Listo', texto: 'Ahora sigues en modo práctica: prueba todo lo que has visto. Esta guía y la de inicio están siempre en tu menú. Cambiar una sesión para siempre lo hace el encargado/a.' },
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
  /* PASO INTERACTIVO: se espera a que la app avise de que se ha hecho. */
  const [hecho, setHecho] = useState(false)
  useEffect(() => {
    setHecho(false)
    if (!paso.haz) return
    let t: any
    const oir = (e: Event) => {
      if ((e as CustomEvent).detail !== paso.haz) return
      // NO SALTA SOLO: al hacerlo se queda abierto lo que se haya abierto (su entreno, la
      // nota…) y se sigue con «Siguiente» cuando se haya mirado. Saltando solo, la pantalla
      // cambiaba antes de poder ver nada.
      setHecho(true)
    }
    window.addEventListener('sie-guia', oir)
    return () => { window.removeEventListener('sie-guia', oir); clearTimeout(t) }
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

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
  /* SIN PARPADEO: al cambiar de paso el globo se queda donde estaba hasta encontrar el
     sitio nuevo (antes desaparecía y volvía a salir en cada paso). Solo se esconde al
     principio, mientras aún no hay ningún sitio. */
  useLayoutEffect(() => {
    if (!paso.sitio) { setRect(null); setBuscando(false); return }
    let vivo = true, intentos = 0
    const visible = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const buscar = () => {
      if (!vivo) return
      const el = Array.from(document.querySelectorAll(`[data-guia="${paso.sitio}"]`)).find(x => visible(x as HTMLElement)) as HTMLElement | undefined
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setTimeout(() => { if (vivo) { setRect(el.getBoundingClientRect()); setBuscando(false) } }, 350)
        return
      }
      if (++intentos < 25) setTimeout(buscar, 120)
      else { setRect(null); setBuscando(false) }
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

  /* HAZLO TÚ: sin velo ni tapa, para poder tocar la app. Un aro señala el sitio y la
     tarjeta va abajo a la izquierda, encima de las ventanas que se abran. */
  if (paso.haz) return (
    <>
      {rect && <div style={{ position: 'fixed', zIndex: 1000, left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12, borderRadius: 14,
        border: '3px solid #E8A33D', boxShadow: '0 0 0 6px rgba(232,163,61,.25)', pointerEvents: 'none', transition: 'all .25s' }}/>}
      <div style={{ position: 'fixed', zIndex: 1000, left: 16, bottom: 72, width: 340, maxWidth: 'calc(100vw - 32px)', background: '#fff', borderRadius: 16,
        padding: '14px 16px', boxShadow: '0 12px 40px rgba(0,0,0,.25)', border: '2px solid #E8A33D' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', color: '#7A5800', background: '#FCEFD6', borderRadius: 99, padding: '2px 8px' }}>HAZLO TÚ</span>
          <span style={{ fontSize: 11, color: 'var(--grl)' }}>{i + 1} de {PASOS_G.length}</span>
        </div>
        <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--n)', marginBottom: 6 }}>{paso.titulo}</div>
        <div style={{ fontSize: 13, color: 'var(--gr)', lineHeight: 1.5 }}>{paso.texto}</div>
        {hecho && <div style={{ fontSize: 13, color: 'var(--gd)', fontWeight: 600, marginTop: 6 }}>✓ ¡Muy bien! Mira lo que ha salido y pulsa Siguiente.</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <button onClick={cerrar} style={{ border: 0, background: 'none', color: 'var(--grl)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Salir</button>
          <span style={{ flex: 1 }}/>
          {i > 0 && <button className="btn btn-s btn-sm" onClick={() => setI(i - 1)}>Atrás</button>}
          {hecho
            ? <button className="btn btn-p btn-sm" onClick={() => ultimo ? cerrar() : setI(i + 1)}>{ultimo ? 'Terminar' : 'Siguiente'}</button>
            : <button className="btn btn-s btn-sm" onClick={() => ultimo ? cerrar() : setI(i + 1)} title="Si no te sale o ya lo sabes">Saltar este paso</button>}
        </div>
      </div>
    </>
  )

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
