'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
// Se repite cuando se quiera desde el menú de la inicial → «Guía del entrenador 1».
// ---------------------------------------------------------------------------

/**
 * `haz`: PASO INTERACTIVO. No se sigue con «Siguiente»: hay que hacerlo de verdad (la app
 * avisa con ese nombre, lib/guiaEventos). Se hace en modo práctica, así que no se rompe
 * nada. Si algo falla, «Saltar este paso».
 */
export type Paso = {
  ruta?: string, sitio?: string, titulo: string, texto: string, haz?: string,
  /** La ruta tiene que ser esa justo (no una de dentro). */
  exacta?: boolean,
  /** Otros sitios que también se pueden tocar en este «Hazlo tú». */
  deja?: string[],
  /** Se puede tocar toda la pantalla (menos el menú de la app): pasos con varias cosas. */
  libre?: boolean,
  /** Lo que se dice en la tira de arriba cuando hay una ventana abierta. */
  corto?: string,
}

export const PASOS: Paso[] = [
  { titulo: 'Bienvenido a SIE', texto: 'Te enseño lo que vas a usar: Hoy, la Agenda y el Taller. Estás en MODO PRÁCTICA, con pacientes de prueba: en algunos pasos tendrás que hacerlo tú, tranquilo, que no toca a ningún paciente real.' },
  { ruta: '/hoy', sitio: 'nav/hoy', titulo: 'Hoy', texto: 'Tu punto de partida. Cada día empieza aquí: tu clase, tus tareas y tus notas.' },
  { ruta: '/hoy', sitio: 'hoy-clase', titulo: 'La clase de ahora', texto: 'Quién viene, qué sesión tiene cada uno y si hay algo que vigilar (alertas, tests).' },
  { ruta: '/hoy', sitio: 'hoy-tareas', titulo: 'Tus tareas', texto: 'Las que te han puesto a ti y las del equipo. Márcalas al hacerlas.' },
  { ruta: '/hoy', sitio: 'hoy-notas', titulo: 'Mis notas', texto: 'Para apuntarte cosas tuyas. Solo las ves tú.' },
  { ruta: '/agenda', sitio: 'nav/agenda', titulo: 'Agenda', texto: 'Las clases del día por hora y sala: quién viene y a qué hora.' },
  { ruta: '/agenda', sitio: 'agenda-entreno', titulo: 'Su sesión, desde la agenda', haz: 'agenda-entreno', corto: 'Mira su entreno de hoy y su «Programación».', texto: 'Hazlo tú: toca la mancuerna de una persona. Se abre su entreno de hoy, igual que en el Taller, y en «Programación» ves las sesiones que le tocan los próximos días.' },
  { ruta: '/taller', sitio: 'nav/taller', titulo: 'Taller', texto: 'Donde se da la clase. Al entrar ya está en la clase de ahora y en tu sala.' },
  { ruta: '/taller', sitio: 'taller-banda', titulo: 'Arriba, la clase', texto: 'El día, la hora y la sala; con una cabeza ves a cada persona por separado y con varias, a todos a la vez. El corazón abre los pulsómetros.' },
  { ruta: '/taller', sitio: 'taller-personas', titulo: 'Elegir a una persona', haz: 'persona', texto: 'Hazlo tú: toca a otra persona de la fila. Abajo sale su entreno de hoy.' },
  { ruta: '/taller', sitio: 'taller-personas', titulo: 'Su cita y sus alertas', haz: 'alerta', corto: 'Apunta una alerta (por ejemplo «le molesta la rodilla al bajar») y pulsa Activar.', texto: 'Hazlo tú: vuelve a tocar a la persona elegida. Se abre su cita: su sesión de hoy, su objetivo y sus alertas. Apunta una alerta (por ejemplo «Dolor / molestia: le molesta la rodilla al bajar») y pulsa Activar.' },
  { ruta: '/taller', sitio: 'taller-series', titulo: 'Apuntar lo que hace', haz: 'serie', deja: ['taller-confirmar'], corto: 'Apunta peso, repeticiones o tiempo.', texto: 'Hazlo tú: toca la casilla de un ejercicio y apunta peso, repeticiones o tiempo. Lo que sale en gris es lo previsto: si lo hace igual, no hace falta tocarlo. Se guarda solo.' },
  { ruta: '/taller', sitio: 'taller-notas', titulo: 'Notas', haz: 'nota', corto: 'Escribe una nota («mejor con goma 2») y guárdala.', texto: 'Hazlo tú: toca el lápiz de un ejercicio y escribe una nota («mejor con goma 2»). Ahí también ves lo que dice el plan. La próxima vez se ve.' },
  { ruta: '/taller', sitio: 'taller-ejecucion', titulo: 'Ejecución', haz: 'ejecucion', corto: 'Marca un punto de buena ejecución.', texto: 'Hazlo tú: toca el contador (0/4) y marca un punto de buena ejecución que haga bien. Así se ve si mejora la técnica.' },
  { ruta: '/taller', sitio: 'taller-nolohizo', titulo: 'Si no hace un ejercicio', haz: 'nolohizo', corto: 'Marca «No lo hizo».', texto: 'Hazlo tú: toca este botón y marca «No lo hizo». Se deshace tocando otra vez. Lo demás se da por hecho tal como sale.' },
  { ruta: '/taller', sitio: 'taller-finalizar', titulo: 'Al acabar la clase', haz: 'finalizar', texto: 'Hazlo tú: pulsa Finalizar. Queda guardado en el historial de cada uno, con lo apuntado y lo que salía en gris.' },
  { sitio: 'menu-usuario', titulo: 'Tu menú', texto: 'Aquí cambias tu contraseña (Mi cuenta), ves tu compromiso de confidencialidad y repites esta guía. Sigues en modo práctica: prueba lo que quieras y para salir, toca «Modo práctica» abajo a la derecha y «Salir de práctica».' },
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
  { ruta: '/taller', sitio: 'taller-metodo', titulo: 'El método de una parte', haz: 'metodo', corto: 'Cambia el método, las series o los descansos, solo para hoy.', texto: 'Hazlo tú: toca el lápiz de una parte y cambia algo solo para hoy: el método (circuito, superseries…), las series o vueltas o los descansos.' },
  { ruta: '/taller', sitio: 'taller-anadir', titulo: 'Añadir un ejercicio', haz: 'anadir', corto: 'Elige un ejercicio para añadirlo solo hoy.', texto: 'Hazlo tú: si la sesión se queda corta, el «+» de la parte añade un ejercicio solo para hoy. Te enseña los similares a los de esa parte.' },
  { ruta: '/taller', sitio: 'taller-nolohizo', titulo: 'Cambiar un ejercicio', haz: 'cambiar', corto: 'Elige el ejercicio que lo cambia, solo hoy.', texto: 'Hazlo tú: con ⇄ cambias un ejercicio por otro similar, solo hoy. También desde su cromo: toca la foto, pasa con ‹ › por su familia y pulsa «Hacer este hoy».' },
  { ruta: '/taller', sitio: 'taller-franja', titulo: 'Cómo se hace hoy', haz: 'franja', corto: 'Cambia el lado, la ejecución o repeticiones/segundos.', texto: 'Hazlo tú: toca cada palabra de la franja para cambiarla solo hoy: el lado, la ejecución y si va por repeticiones o segundos. En ámbar, lo que hoy es distinto al plan.' },
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
  { titulo: 'Guía del entrenador 3', texto: 'Ahora preparas el entreno de cada persona: sus objetivos, sus sesiones y qué días las hace. Lo vas a hacer tú, paso a paso, con un paciente de prueba. En cada paso solo se puede tocar lo que está marcado en naranja.' },
  { ruta: '/pacientes', exacta: true, sitio: 'pac-fila', haz: 'ficha', titulo: 'Abre su ficha', texto: 'Hazlo tú: toca un paciente de prueba (Carmen, Antonio, Laura o Javier). En modo práctica solo salen ellos.' },
  { ruta: '/pacientes', sitio: 'ficha-pestanas', titulo: 'Lo que hay en la ficha', texto: 'Ficha: su resumen, alertas y anamnesis. Historial: todo lo que le ha pasado. Entrenamiento: sus sesiones y sus citas. Resultados: cómo evoluciona. La salud la ves, pero no la cambias: es de quien valora.' },
  { ruta: '/pacientes', sitio: 'ficha-objetivos', titulo: 'Sus objetivos', texto: 'Los pone quien hace la valoración; tú partes de ellos. En el torno todo sale de aquí: sin objetivos no hay nada que programar. Ahora vamos al torno.' },
  { ruta: '/torno', exacta: true, sitio: 'torno-buscar', deja: ['torno-paciente'], haz: 'torno-paciente', titulo: 'El torno', texto: 'Donde se monta el entreno. Hazlo tú: toca el buscador, sale la lista, y elige al mismo paciente de prueba.' },
  { ruta: '/torno', sitio: 'origen-bib', haz: 'torno-origen', titulo: '¿Con qué lo montas?', texto: 'Hazlo tú: elige «De la biblioteca». Parte de sus objetivos y te ofrece lo que ya los trabaja.' },
  { ruta: '/torno', sitio: 'torno-sesion', deja: ['torno-empezar'], haz: 'torno-empezar', titulo: 'Una sesión o un ciclo', texto: 'Un ciclo son fases con varias sesiones; una sesión, partes y ejercicios. Hazlo tú: toca «Una sesión» y después Empezar.' },
  { ruta: '/torno', sitio: 'torno-objetivos', haz: 'torno-objetivo', titulo: 'Sus objetivos, arriba', texto: 'Hazlo tú: toca uno de sus objetivos. Abajo se encienden las sesiones y los ejercicios que lo trabajan. En práctica solo salen unos pocos de ejemplo.' },
  { ruta: '/torno', sitio: 'torno-banda', haz: 'torno-elegir', titulo: 'Elige el material', texto: 'Hazlo tú: toca la sesión de ejemplo que se ha encendido. Se marca con un borde verde.' },
  { ruta: '/torno', sitio: 'torno-aceptar', haz: 'torno-aceptar', titulo: 'Acepta lo elegido', texto: 'Abajo ha salido una barra con lo que has elegido. Hazlo tú: pulsa «Aceptar». La plantilla no se toca: se hace una copia para él.' },
  { ruta: '/torno', sitio: 'torno-guardar', libre: true, haz: 'torno-guardar', titulo: 'Dale forma y guarda', texto: 'Arrastra lo elegido a la derecha, a «Lo que se le programa». Ahí quitas lo que sobre; con «Tornear» abres la sesión y arrastras solo partes o ejercicios. Hazlo tú: cuando te guste, pulsa «Guardar como suyo».', corto: 'Arrástralo a la derecha y pulsa «Guardar como suyo».' },
  { ruta: '/torno', sitio: 'torno-citas', haz: 'torno-citas', titulo: 'Ponerlo en sus citas', texto: 'Ya es una sesión suya, con su propio historial. Hazlo tú: pulsa «Ponerlo en sus citas». Es la única forma de poner sesiones en las citas.' },
  { ruta: '/torno', sitio: 'torno-programar', libre: true, haz: 'torno-programar', titulo: 'Repartir en el calendario', texto: 'Son sus citas de las próximas semanas. Hazlo tú: elige cómo repartir (alternando, por día…) y pulsa Pintar, o toca los días a mano. Abajo sale «Programar»: púlsalo. Si te equivocas, Deshacer.', corto: 'Reparte con Pintar o a mano y pulsa Programar.' },
  { ruta: '/taller', sitio: 'taller-nolohizo', haz: 'para-siempre', titulo: 'Cambiar para siempre', texto: 'En el taller ya cambiabas cosas solo para hoy. Ahora también «Para siempre»: se cambia su sesión y queda en su historial. Hazlo tú: toca este botón, cambia el ejercicio y elige «Para siempre».', corto: 'Cambia el ejercicio y elige «Para siempre».' },
  { ruta: '/entrenamiento', sitio: 'nav/entrenamiento', titulo: 'La biblioteca, completa', texto: 'Además de consultar, ves Sesiones, Sistemas y Objetivos, y creas ejercicios. En modo práctica solo salen unos pocos de ejemplo, con «(práctica)» en el nombre. La biblioteca de verdad no se ve ni se cambia desde aquí.' },
  { ruta: '/torno', exacta: true, sitio: 'torno-que', libre: true, haz: 'amasar-abrir', titulo: 'Amasar un ejercicio', texto: 'Hazlo tú: en el torno toca la pesa (Ejercicios), luego el buscador, y abre uno de los «(práctica)».' },
  { ruta: '/torno/amasar', libre: true, haz: 'amasar-guardar', titulo: 'Complétalo y guarda', texto: 'Hazlo tú: rellena lo que le falta (descripción, etiquetas, cómo se mide, puntos de buena ejecución) y guarda. El rosco te dice lo que le falta.', corto: 'Rellena lo que le falta y guarda.' },
  { sitio: 'menu-usuario', titulo: 'Listo', texto: 'Ya sabes preparar un entreno de principio a fin. Sigues en modo práctica: repítelo con otro paciente de prueba. Esta guía está en tu menú. Valoraciones, tests, salud, agenda, cobros, tareas y salas los llevan dirección o encargado.' },
]

/**
 * GUÍA DEL NIVEL 4: SOLO LO NUEVO respecto al 3. El entrenador que valora: la valoración
 * y la revaloración, la salud de la ficha, los objetivos del paciente, los tests y el
 * DynaMo. En modo práctica, con los pacientes de prueba.
 */
export const PASOS_N4: Paso[] = [
  { titulo: 'Guía del entrenador 4', texto: 'Ahora también valoras: haces la valoración, pasas tests, llevas la salud de la ficha y pones los objetivos. Te enseño solo lo nuevo; preparar entrenos ya lo viste en la guía del 3.' },
  { ruta: '/valoracion', sitio: 'nav/valoracion', titulo: 'Valoración', texto: 'Aquí haces la valoración de alguien nuevo o la revaloración de quien ya viene. Lo que salga de aquí mueve sus objetivos.' },
  { ruta: '/valoracion', sitio: 'val-pasos', titulo: 'Paso a paso', texto: 'Va por pasos: paciente, anamnesis, historial, tests, plan (su bono y sus clases) y resumen con la firma. Se guarda al final. La revaloración no vuelve a firmar ni abre otro bono: pregunta qué ha cambiado.' },
  { ruta: '/pacientes', exacta: true, sitio: 'pac-fila', haz: 'ficha', titulo: 'Su ficha', texto: 'Hazlo tú: abre un paciente de prueba (Carmen, Antonio, Laura o Javier).' },
  { ruta: '/pacientes', sitio: 'ficha-salud', titulo: 'La salud, ahora la cambias tú', texto: 'Molestias, patologías, medicación, alergias, operaciones… El botón de la izquierda cambia lo que ves en el cuerpo (dolor ahora, operaciones…). Ahora lo anotas y lo corriges tú; antes solo lo veías.' },
  { ruta: '/pacientes', sitio: 'ficha-objetivo', haz: 'objetivo', titulo: 'Ponerle un objetivo', texto: 'Hazlo tú: pulsa Añadir, elige un objetivo y guárdalo. Es un paciente de prueba: no toca a nadie real.', corto: 'Elige un objetivo y guárdalo.' },
  { ruta: '/pacientes', sitio: 'ficha-objetivos', titulo: 'Cómo se cierran', texto: 'Un objetivo se cierra cuando sus tests dan negativo, o a mano con «Dar por logrado». Si un test da positivo, su objetivo se abre solo.' },
  { ruta: '/pacientes', sitio: 'ficha-pestanas', titulo: 'Tests y DynaMo', texto: 'Los tests los pasas en la valoración, desde un objetivo de la ficha o en el taller cuando le toca. En Resultados, la pestaña DynaMo trae los tests del VALD.' },
  { sitio: 'menu-usuario', titulo: 'Listo', texto: 'Ya sabes lo que añade el nivel 4. Sigues en modo práctica: prueba una revaloración con un paciente de prueba. Esta guía está en tu menú. Tareas, salas, cobros y la agenda siguen siendo de dirección o encargado.' },
]

const CLAVE = (uid: string, n = 1) => n === 4 ? `sie_guia4_vista_${uid}` : n === 3 ? `sie_guia3_vista_${uid}` : n === 2 ? `sie_guia2_vista_${uid}` : `sie_guia_vista_${uid}`
export const guiaVista = (uid: string, n = 1) => { try { return localStorage.getItem(CLAVE(uid, n)) === '1' } catch { return true } }
const marcarVista = (uid: string, n = 1) => { try { localStorage.setItem(CLAVE(uid, n), '1') } catch {} }

/* Ventanas que la app abre al hacer algo (su cita, la nota, el menú de un ejercicio…).
   En un «Hazlo tú» se pueden tocar: son el resultado de lo que se pidió. */
const VENTANAS = '.modal-bg, .modal, .m-velo, .m-hoja, .menu-flot, .nota-an, .capa-bib, .ag-pop, .pop-busca, .ind-pop, [role="dialog"]'
/* Lo que NUNCA se toca durante un «Hazlo tú»: el menú de la app y el aviso de práctica.
   Así no se puede ir a otra pantalla por delante de la guía. */
const FUERA = '.sidebar, .topbar, .borde-izq, [data-guia-no]'

const esUI = (el: Element | null) => !!el?.closest('[data-guia-ui]')
/** La ventana flotante (fija en pantalla) en la que está `el`, si la hay. */
function ventanaDe(el: Element | null): Element | null {
  const v = el?.closest(VENTANAS)
  if (v) return v
  for (let x: Element | null = el; x && x !== document.body; x = x.parentElement) {
    if (getComputedStyle(x).position === 'fixed') return x
  }
  return null
}

export default function GuiaInicio({ uid, onCerrar, nivel = 1 }: { uid: string, onCerrar: () => void, nivel?: 1 | 2 | 3 | 4 }) {
  const PASOS_G = nivel === 4 ? PASOS_N4 : nivel === 3 ? PASOS_N3 : nivel === 2 ? PASOS_N2 : PASOS
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  /* Mientras se busca el sitio, no se enseña el globo: aparece ya en su sitio. */
  const [buscando, setBuscando] = useState(true)
  /* El sitio no aparece (no hay clase ahora, falta un dato…): el paso se deja hacer igual. */
  const [sinSitio, setSinSitio] = useState(false)
  /* Hay una ventana abierta encima (la que abrió lo que se ha tocado): la tarjeta se
     hace pequeña y se va arriba, para no taparla. */
  const [ventana, setVentana] = useState(false)
  /* YA HA EMPEZADO A HACERLO: al tocar lo señalado suele abrirse algo justo al lado (el
     menú de la franja, un editor…) y la tarjeta grande lo tapaba. Desde el primer toque
     pasa a la tira pequeña. */
  const [toco, setToco] = useState(false)
  useEffect(() => { setToco(false) }, [i])
  /* Se ha tocado fuera de lo señalado: la tarjeta lo dice. */
  const [aviso, setAviso] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const paso = PASOS_G[i]
  const ultimo = i === PASOS_G.length - 1

  /* PASOS YA HECHOS: al volver con «Atrás» a uno hecho, no hay que repetirlo. */
  const [hechos, setHechos] = useState<Set<number>>(new Set())
  const hecho = hechos.has(i)
  const siguiente = () => { if (ultimo) cerrar(); else { setI(i + 1); setAviso(false) } }
  const atras = () => { setI(i - 1); setAviso(false) }

  /* PASO INTERACTIVO: se espera a que la app avise de que se ha hecho. Y entonces SIGUE
     SOLA si el paso siguiente es en la misma pantalla (explica lo que ha salido). Si el
     siguiente lleva a otra pantalla, espera a «Siguiente» para que se pueda mirar.
     Ojo: el temporizador NO se cancela al cambiar de pantalla. Antes sí, y como al hacerlo
     la app suele cambiar de pantalla (elegir paciente → origen), la guía se quedaba
     atrás mientras la persona seguía, y luego «Atrás» la devolvía al buscador del torno. */
  const avance = useRef<any>(null)
  /* Lo que ya se ha hecho (y cuándo), para cuando se hace algo antes de que la guía lo
     pida: al llegar a ese paso, se da por hecho y sigue. */
  const hechoEn = useRef<Record<string, number>>({})
  const empezoPaso = useRef<number[]>([])
  useEffect(() => {
    const oir = (e: Event) => { const n = (e as CustomEvent).detail; if (typeof n === 'string') hechoEn.current[n] = Date.now() }
    window.addEventListener('sie-guia', oir)
    return () => window.removeEventListener('sie-guia', oir)
  }, [])
  useEffect(() => {
    empezoPaso.current[i] = Date.now()
    if (!paso.haz) return
    const darPorHecho = () => {
      setHechos(h => new Set(h).add(i))
      const sig = PASOS_G[i + 1]
      const aqui = window.location.pathname
      const mismaPantalla = !sig || !sig.ruta || aqui.startsWith(sig.ruta) || sig.ruta === paso.ruta
      if (!ultimo && mismaPantalla) {
        clearTimeout(avance.current)
        avance.current = setTimeout(() => { setI(x => x === i ? i + 1 : x); setAviso(false) }, 900)
      }
    }
    // ¿Ya lo hizo, antes de que se lo pidiera (desde el paso anterior)?
    const desde = empezoPaso.current[i - 1] ?? Infinity
    if (!hechos.has(i) && (hechoEn.current[paso.haz] ?? 0) >= desde) darPorHecho()
    const oir = (e: Event) => { if ((e as CustomEvent).detail === paso.haz) darPorHecho() }
    window.addEventListener('sie-guia', oir)
    return () => { window.removeEventListener('sie-guia', oir); clearTimeout(avance.current) }
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  // Si el paso es de otra pantalla, se va a ella.
  useEffect(() => {
    if (!paso.ruta) return
    const ok = paso.exacta ? pathname === paso.ruta : pathname.startsWith(paso.ruta)
    if (!ok) router.push(paso.ruta)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  // El torno recuerda la última búsqueda: en la guía se empieza siempre con el buscador vacío.
  useEffect(() => { try { ['torno-busca', 'torno-scroll', 'torno-familias'].forEach(k => sessionStorage.removeItem(k)) } catch {} }, [])
  // Durante la guía se ven los botones que normalmente solo salen al pasar el ratón.
  useEffect(() => {
    document.body.classList.add('guia-on')
    return () => document.body.classList.remove('guia-on')
  }, [])

  const buscarSitio = () => {
    if (!paso.sitio) return undefined
    return Array.from(document.querySelectorAll(`[data-guia="${paso.sitio}"]`))
      .find(x => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 }) as HTMLElement | undefined
  }

  // Busca el sitio (la pantalla puede tardar en pintarlo), lo lleva a la vista y lo SIGUE:
  // cada poco se vuelve a medir, porque la pantalla cambia al hacer cosas.
  useLayoutEffect(() => {
    setSinSitio(false)
    if (!paso.sitio) { setRect(null); setBuscando(false); return }
    let vivo = true, intentos = 0, encontrado = false
    const buscar = () => {
      if (!vivo) return
      const el = buscarSitio()
      if (el) {
        encontrado = true
        const alto = el.getBoundingClientRect().height > window.innerHeight * 0.6
        el.scrollIntoView({ block: alto ? 'start' : 'center', behavior: 'smooth' })
        setTimeout(() => { if (vivo) { setRect(el.getBoundingClientRect()); setBuscando(false) } }, 350)
        return
      }
      if (++intentos < 60) setTimeout(buscar, 120)
      else { setRect(null); setBuscando(false); setSinSitio(true) }
    }
    buscar()
    const seguir = setInterval(() => {
      if (!vivo || !encontrado) return
      const el = buscarSitio()
      setRect(el ? el.getBoundingClientRect() : null)
    }, 300)
    return () => { vivo = false; clearInterval(seguir) }
  }, [i, pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ¿HAY UNA VENTANA ENCIMA? Se mira qué hay en el centro de la pantalla: si es algo
     flotante que no es lo señalado ni la guía, es una ventana que se ha abierto. */
  useEffect(() => {
    if (!paso.haz) { setVentana(false); return }
    const mirar = () => {
      const capas = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight / 2).filter(x => !esUI(x))
      const v = ventanaDe(capas[0] || null)
      setVentana(!!v && !v.closest(FUERA) && !(paso.sitio && v.querySelector(`[data-guia="${paso.sitio}"]`)) && !v.closest(`[data-guia="${paso.sitio}"]`))
    }
    mirar()
    const t = setInterval(mirar, 350)
    return () => clearInterval(t)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  /* TODO GUIADO: en un «Hazlo tú» solo se toca lo señalado (y lo que se abra al tocarlo).
     Lo demás no responde, y la tarjeta avisa. Así no se puede ir por delante de la guía. */
  useEffect(() => {
    if (!paso.haz) return
    const permitido = (t: Element) => {
      if (esUI(t)) return true
      if (t.closest(FUERA)) return false
      if (paso.libre || sinSitio || hecho) return true
      const sel = [paso.sitio, ...(paso.deja || [])].filter(Boolean).map(s => `[data-guia="${s}"]`).join(',')
      if (sel && t.closest(sel)) return true
      // Una ventana que se ha abierto al hacerlo (y que no es donde está lo señalado).
      const v = ventanaDe(t)
      if (v && !(sel && v.querySelector(sel))) return true
      return false
    }
    const parar = (e: Event) => {
      const t = e.target as Element
      if (!t || !(t instanceof Element)) return
      if (permitido(t)) { if (e.type === 'pointerdown' && !esUI(t)) setToco(true); return }
      e.preventDefault(); e.stopPropagation()
      if (e.type === 'click') { setAviso(true); setTimeout(() => setAviso(false), 2500) }
    }
    const tipos = ['pointerdown', 'mousedown', 'click', 'dblclick', 'contextmenu']
    tipos.forEach(n => window.addEventListener(n, parar, true))
    return () => tipos.forEach(n => window.removeEventListener(n, parar, true))
  }, [i, sinSitio, hecho]) // eslint-disable-line react-hooks/exhaustive-deps

  const cerrar = () => { marcarVista(uid, nivel); onCerrar() }

  // El globo: debajo del sitio si cabe, si no encima; si no cabe en ninguno, abajo del
  // todo. SIEMPRE dentro de la pantalla. Se mide solo la parte visible del sitio.
  const W = 360, M = 12
  let globo: React.CSSProperties = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  let marco: { left: number, top: number, width: number, height: number } | null = null
  if (rect && typeof window !== 'undefined') {
    const vw = window.innerWidth, vh = window.innerHeight
    const t = Math.max(8, rect.top), b = Math.min(vh - 8, rect.bottom), l = Math.max(8, rect.left), r = Math.min(vw - 8, rect.right)
    marco = { left: l, top: t, width: Math.max(0, r - l), height: Math.max(0, b - t) }
    const left = Math.max(M, Math.min(l + (r - l) / 2 - W / 2, vw - W - M))
    if (vh - b > 250) globo = { left, top: b + 16 }
    else if (t > 250) globo = { left, top: t - 16, transform: 'translateY(-100%)' }
    else if (l > W + 2 * M) globo = { left: l - W - M, top: Math.max(M, Math.min(t, vh - 260)) }
    else if (vw - r > W + 2 * M) globo = { left: r + M, top: Math.max(M, Math.min(t, vh - 260)) }
    else globo = { left, bottom: M }
  }

  const contador = <span style={{ fontSize: 12, color: 'var(--grl)' }}>Paso {i + 1} de {PASOS_G.length}</span>
  const botones = (haz: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
      <button onClick={cerrar} style={{ border: 0, background: 'none', color: 'var(--grl)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Salir de la guía</button>
      <span style={{ flex: 1 }}/>
      {i > 0 && <button className="btn btn-s btn-sm" onClick={atras}>Atrás</button>}
      {!haz || hecho
        ? <button className="btn btn-p btn-sm" onClick={siguiente}>{ultimo ? 'Terminar' : 'Siguiente'}</button>
        : <button className="btn btn-s btn-sm" onClick={siguiente} title="Si no te sale o ya lo sabes">Saltar</button>}
    </div>
  )

  /* HAZLO TÚ: sin velo, para poder tocar lo señalado. Un aro naranja lo marca y la
     tarjeta va a su lado, sin taparlo. */
  if (paso.haz) {
    const marcoVisible = marco && !(paso.libre && !paso.sitio)
    return (
      <div data-guia-ui>
        {marcoVisible && marco && <div style={{ position: 'fixed', zIndex: 1000, left: marco.left - 6, top: marco.top - 6, width: marco.width + 12, height: marco.height + 12, borderRadius: 14,
          border: '3px solid #E8A33D', boxShadow: aviso ? '0 0 0 10px rgba(232,163,61,.45)' : '0 0 0 6px rgba(232,163,61,.25)', pointerEvents: 'none', transition: 'all .25s' }}/>}
        {ventana || toco ? (
          /* Con una ventana abierta: una tira arriba, pequeña. */
          <div style={{ position: 'fixed', zIndex: 1001, ...(marco && marco.top < 140 && !ventana ? { bottom: 14 } : { top: 10 }), left: '50%', transform: 'translateX(-50%)', width: 'min(560px, calc(100vw - 24px))',
            background: '#fff', borderRadius: 12, padding: '9px 14px', boxShadow: '0 8px 26px rgba(0,0,0,.22)', border: '2px solid #E8A33D',
            display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#7A5800', background: '#FCEFD6', borderRadius: 99, padding: '2px 8px', flexShrink: 0 }}>HAZLO TÚ</span>
            <span style={{ fontSize: 14, color: 'var(--n)', flex: 1, lineHeight: 1.35 }}>
              {hecho ? <b style={{ color: 'var(--gd)' }}>✓ ¡Hecho! {ventana ? 'Cierra la ventana cuando lo hayas mirado.' : 'Míralo y pulsa Siguiente.'}</b> : (paso.corto || paso.titulo)}
            </span>
            {hecho && !ultimo && <button className="btn btn-p btn-sm" onClick={siguiente}>Siguiente</button>}
            {!hecho && <button onClick={siguiente} title="Si no te sale o ya lo sabes" style={{ border: 0, background: 'none', color: 'var(--grl)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Saltar</button>}
          </div>
        ) : (
          <div style={{ position: 'fixed', zIndex: 1001, width: W, maxWidth: `calc(100vw - ${2 * M}px)`, background: '#fff', borderRadius: 16,
            padding: '16px 18px', boxShadow: '0 12px 40px rgba(0,0,0,.25)', border: '2px solid #E8A33D',
            ...(marco ? globo : { left: 16, bottom: 76 }), visibility: buscando ? 'hidden' : 'visible', transition: 'top .25s, left .25s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', color: '#7A5800', background: '#FCEFD6', borderRadius: 99, padding: '2px 8px' }}>HAZLO TÚ</span>
              {contador}
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--n)', marginBottom: 6 }}>{paso.titulo}</div>
            <div style={{ fontSize: 14.5, color: 'var(--gr)', lineHeight: 1.5 }}>{paso.texto}</div>
            {aviso && !hecho && <div style={{ fontSize: 14, color: '#A15C00', fontWeight: 600, marginTop: 8 }}>Toca lo que está marcado en naranja.</div>}
            {hecho && <div style={{ fontSize: 14, color: 'var(--gd)', fontWeight: 600, marginTop: 8 }}>✓ ¡Muy bien!</div>}
            {botones(true)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div data-guia-ui style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      {/* El velo oscuro con un hueco sobre el sitio que se explica. */}
      {marco
        ? <div style={{ position: 'fixed', left: marco.left - 6, top: marco.top - 6, width: marco.width + 12, height: marco.height + 12, borderRadius: 14,
            boxShadow: '0 0 0 9999px rgba(38,40,37,.55)', border: '2px solid #fff', transition: 'all .25s', pointerEvents: 'none' }}/>
        : <div style={{ position: 'fixed', inset: 0, background: 'rgba(38,40,37,.55)' }}/>}
      {/* Tapa los clics: en los pasos que solo explican no se toca la app. */}
      <div style={{ position: 'fixed', inset: 0 }}/>
      <div style={{ position: 'fixed', width: W, maxWidth: `calc(100vw - ${2 * M}px)`, background: '#fff', borderRadius: 16, padding: '16px 18px',
        boxShadow: '0 12px 40px rgba(0,0,0,.25)', ...globo, visibility: buscando ? 'hidden' : 'visible' }}>
        <div style={{ marginBottom: 4 }}>{contador}</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--n)', marginBottom: 6 }}>{paso.titulo}</div>
        <div style={{ fontSize: 14.5, color: 'var(--gr)', lineHeight: 1.55 }}>{paso.texto}</div>
        {botones(false)}
      </div>
    </div>
  )
}
