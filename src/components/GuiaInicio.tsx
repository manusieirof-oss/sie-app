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
/* NIVEL 2: SOLO LO NUEVO respecto al nivel 1 (lo de dar la clase ya lo enseñó su guía). */
export const PASOS_N2: Paso[] = [
  { titulo: 'Guía del entrenador', texto: 'Ahora puedes ajustar la clase de hoy de cada persona. Todo lo que cambies es solo para hoy: su sesión de siempre no se toca. Te enseño solo lo nuevo, en un minuto.' },
  { ruta: '/taller', sitio: 'taller-personas', titulo: 'Si no viene', texto: 'Toca a la persona elegida para abrir su cita. Si avisa de que no viene, Cancelada; si no aparece sin avisar, Falta. Desde ahí también cambias su sesión de hoy por otra de las suyas.' },
  { ruta: '/taller', sitio: 'taller-metodo', titulo: 'El método de una parte', haz: 'metodo', texto: 'Hazlo tú: toca el lápiz de una parte y cambia algo solo para hoy: el método (circuito, superseries…), las series o vueltas o los descansos.' },
  { ruta: '/taller', sitio: 'taller-anadir', titulo: 'Añadir un ejercicio', haz: 'anadir', texto: 'Hazlo tú: si la sesión se queda corta, el «+» de la parte añade un ejercicio solo para hoy. Te enseña los similares a los de esa parte.' },
  { ruta: '/taller', sitio: 'taller-nolohizo', titulo: 'Cambiar un ejercicio', haz: 'cambiar', texto: 'Hazlo tú: con ⇄ cambias un ejercicio por otro similar, solo hoy. También desde su cromo: toca la foto, pasa con ‹ › por su familia y pulsa «Hacer este hoy».' },
  { ruta: '/taller', sitio: 'taller-franja', titulo: 'Cómo se hace hoy', haz: 'franja', texto: 'Hazlo tú: toca cada palabra de la franja para cambiarla solo hoy: el lado, la ejecución y si va por repeticiones o segundos. En ámbar, lo que hoy es distinto al plan.' },
  { ruta: '/entrenamiento', sitio: 'bib-cliente', titulo: 'La biblioteca', texto: 'Para consultar los ejercicios. Busca aquí a un cliente y verás SUS ejercicios con sus cifras; sin nadie, los de toda la clínica. Toca un ejercicio para ver su cromo.' },
  { ruta: '/entrenamiento', sitio: 'bib-lente', titulo: 'Un botón, varias vistas', texto: 'Cada toque cambia lo que ves debajo de cada ejercicio: qué trabaja, su cromo, su intensidad, su uso o sus objetivos.' },
  { ruta: '/agenda', sitio: 'agenda-lente', titulo: 'Lo mismo en la agenda', texto: 'Junto a cada persona: la sesión que tiene hoy, su asistencia (el grupo se ordena de quien más viene a quien menos) o sus alertas.' },
  { sitio: 'menu-usuario', titulo: 'Listo', texto: 'Sigues en modo práctica: prueba todo lo que has visto. Esta guía y la de inicio están siempre en tu menú. Cambiar una sesión para siempre lo hace el encargado/a.' },
]

/**
 * GUÍA DEL NIVEL 3: SOLO LO NUEVO respecto al nivel 2. Preparar el entreno de una persona
 * de principio a fin, HACIÉNDOLO, con un paciente de prueba: su objetivo en la ficha, el
 * torno (elegir, montar, guardar), repartirlo en sus citas, cambiar para siempre en el
 * taller y amasar un ejercicio de práctica.
 *
 * Todo lo que se toca es de práctica: los pacientes de prueba y sus sesiones, y los
 * ejercicios «(práctica)» (sql/biblioteca-practica.sql). Las sesiones de plantilla de la
 * biblioteca son las de verdad, pero aquí solo se COPIAN (Aceptar hace una copia suya).
 */
export const PASOS_N3: Paso[] = [
  { titulo: 'Guía del entrenador 3', texto: 'Ahora preparas el entreno de cada persona: sus objetivos, sus sesiones y qué días las hace. Lo vas a hacer tú, de principio a fin, con un paciente de prueba. Unos diez minutos.' },
  { ruta: '/pacientes', sitio: 'nav/pacientes', haz: 'ficha', titulo: 'Abre su ficha', texto: 'Hazlo tú: entra en Pacientes y abre la ficha de un paciente de prueba (Carmen, Antonio, Laura o Javier). En modo práctica solo salen ellos.' },
  { ruta: '/pacientes', sitio: 'ficha-pestanas', titulo: 'Lo que hay en la ficha', texto: 'Ficha: su resumen, alertas y anamnesis. Historial: todo lo que le ha pasado. Entrenamiento: sus sesiones y sus citas. Resultados: cómo evoluciona. La salud la ves para tenerla en cuenta, pero no la cambias: es de quien valora.' },
  { ruta: '/pacientes', sitio: 'ficha-objetivos', titulo: 'Sus objetivos', texto: 'Los pone quien hace la valoración; tú partes de ellos. Los pacientes de prueba ya tienen los suyos. En el torno todo sale de aquí: sin objetivos no hay nada que programar.' },
  { ruta: '/torno', sitio: 'nav/torno', haz: 'torno-paciente', titulo: 'El torno', texto: 'Donde se monta el entreno. Hazlo tú: toca «A quién más le falta» o busca, y elige al mismo paciente de prueba.' },
  { ruta: '/torno', sitio: 'origen-bib', haz: 'torno-origen', titulo: '¿Con qué lo montas?', texto: 'Hazlo tú: elige «De la biblioteca». Parte de sus objetivos y te ofrece lo que ya los trabaja.' },
  { ruta: '/torno', sitio: 'torno-sesion', haz: 'torno-empezar', titulo: 'Una sesión o un ciclo', texto: 'Un ciclo son fases con varias sesiones; una sesión, partes y ejercicios. Hazlo tú: elige «Una sesión» y pulsa Empezar.' },
  { ruta: '/torno', sitio: 'torno-objetivos', haz: 'torno-objetivo', titulo: 'Sus objetivos, arriba', texto: 'Hazlo tú: toca uno de sus objetivos. Abajo se encienden las sesiones y los ejercicios que lo trabajan; lo demás se apaga.' },
  { ruta: '/torno', sitio: 'torno-banda', haz: 'torno-aceptar', titulo: 'Elige el material', texto: 'Hazlo tú: toca una sesión de plantilla o unos ejercicios encendidos y pulsa Aceptar, abajo. La plantilla no se toca: se hace una copia para él.' },
  { ruta: '/torno', sitio: 'torno-guardar', haz: 'torno-guardar', titulo: 'Dale forma y guarda', texto: 'A la derecha está su sesión: quita, reordena, cambia series o método. Hazlo tú: cuando te guste, Guardar. Queda como sesión suya, con su propio historial.' },
  { ruta: '/torno', sitio: 'torno-citas', haz: 'torno-citas', titulo: 'Ponerlo en sus citas', texto: 'Hazlo tú: pulsa «Ponerlo en sus citas». Es la única forma de poner sesiones en las citas, se entre por donde se entre.' },
  { ruta: '/torno', sitio: 'torno-programar', haz: 'torno-programar', titulo: 'Repartir en el calendario', texto: 'Son sus citas de las próximas semanas. Hazlo tú: elige la sesión arriba, toca los días en que la hace y pulsa Programar. Si te equivocas, Deshacer.' },
  { ruta: '/taller', sitio: 'taller-nolohizo', haz: 'para-siempre', titulo: 'Cambiar para siempre', texto: 'En el taller ya cambiabas cosas solo para hoy. Ahora también «Para siempre»: se cambia su sesión y queda en su historial. Hazlo tú: con ⇄ cambia un ejercicio de un paciente de prueba y elige «Para siempre».' },
  { ruta: '/entrenamiento', sitio: 'nav/entrenamiento', titulo: 'La biblioteca, completa', texto: 'Además de consultar, ves Sesiones, Sistemas y Objetivos, y creas ejercicios. En modo práctica hay seis con «(práctica)» en el nombre: esos se pueden cambiar; los de verdad están protegidos. Las sesiones de plantilla sí son las de verdad: no las cambies practicando.' },
  { ruta: '/torno', sitio: 'torno-buscar', haz: 'amasar-guardar', titulo: 'Amasar un ejercicio', texto: 'Hazlo tú: en el torno pasa a Ejercicios, busca «práctica» y abre uno. Complétalo (descripción, etiquetas, cómo se mide, puntos de buena ejecución) y guarda. El rosco te dice lo que le falta.' },
  { sitio: 'menu-usuario', titulo: 'Listo', texto: 'Ya sabes preparar un entreno de principio a fin. Sigues en modo práctica: repítelo con otro paciente de prueba. Esta guía está en tu menú. Valoraciones, tests, salud, agenda, cobros, tareas y salas los llevan dirección o encargado.' },
]

const CLAVE = (uid: string, n = 1) => n === 3 ? `sie_guia3_vista_${uid}` : n === 2 ? `sie_guia2_vista_${uid}` : `sie_guia_vista_${uid}`
export const guiaVista = (uid: string, n = 1) => { try { return localStorage.getItem(CLAVE(uid, n)) === '1' } catch { return true } }
const marcarVista = (uid: string, n = 1) => { try { localStorage.setItem(CLAVE(uid, n), '1') } catch {} }

export default function GuiaInicio({ uid, onCerrar, nivel = 1 }: { uid: string, onCerrar: () => void, nivel?: 1 | 2 | 3 }) {
  const PASOS_G = nivel === 3 ? PASOS_N3 : nivel === 2 ? PASOS_N2 : PASOS
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
        // Si el sitio no cabe en la pantalla (una lista larga), se lleva arriba del todo.
        const alto = el.getBoundingClientRect().height > window.innerHeight * 0.6
        el.scrollIntoView({ block: alto ? 'start' : 'center', behavior: 'smooth' })
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

  // El globo: debajo del sitio si cabe, si no encima; si no cabe en ninguno, abajo del
  // todo, encima del sitio. Y SIEMPRE dentro de la pantalla.
  //
  // Se atascaba con un sitio más alto que la pantalla (las tareas, con muchas): no cabía
  // ni debajo ni encima y el globo se iba fuera, con sus botones, y la tapa no dejaba
  // hacer scroll. Ahora se mide solo la parte visible del sitio.
  const W = 340, M = 12
  let globo: React.CSSProperties = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  let marco: { left: number, top: number, width: number, height: number } | null = null
  if (rect && typeof window !== 'undefined') {
    const vw = window.innerWidth, vh = window.innerHeight
    const t = Math.max(8, rect.top), b = Math.min(vh - 8, rect.bottom), l = Math.max(8, rect.left), r = Math.min(vw - 8, rect.right)
    marco = { left: l, top: t, width: Math.max(0, r - l), height: Math.max(0, b - t) }
    const left = Math.max(M, Math.min(l + (r - l) / 2 - W / 2, vw - W - M))
    if (vh - b > 230) globo = { left, top: b + 14 }
    else if (t > 230) globo = { left, top: t - 14, transform: 'translateY(-100%)' }
    else globo = { left, bottom: M }
  }

  /* HAZLO TÚ: sin velo ni tapa, para poder tocar la app. Un aro señala el sitio y la
     tarjeta va abajo a la izquierda, encima de las ventanas que se abran. */
  if (paso.haz) return (
    <>
      {marco && <div style={{ position: 'fixed', zIndex: 1000, left: marco.left - 6, top: marco.top - 6, width: marco.width + 12, height: marco.height + 12, borderRadius: 14,
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
      {marco
        ? <div style={{ position: 'fixed', left: marco.left - 6, top: marco.top - 6, width: marco.width + 12, height: marco.height + 12, borderRadius: 14,
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
