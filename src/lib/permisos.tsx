'use client'
import { createContext, useContext } from 'react'

// NIVELES DEL EQUIPO. Un solo sitio que dice quién puede qué, para que la barra, las
// rutas y los botones del taller no tengan cada uno su propia regla.
//
//   1 · Principiante → Hoy, Agenda (solo consulta) y Taller: da la clase, apunta
//                      series y hechos. No marca faltas ni cambia nada de lo planificado.
//   2 · Entrenador   → además ajusta la sesión del día en el taller (solo hoy), elige
//                      sesión y consulta la biblioteca. Sin fichas ni valoraciones.
//   3 · Encargado/a  → además Pacientes y Valoración, el torno y la Biblioteca (crea
//                      sesiones y ejercicios) y Cobros.
//
// LA AGENDA VA POR PERSONA, no por nivel: editarla (crear, mover, faltas, cancelar)
// es de quien lleva el teléfono, y eso no depende de cuánto sepa de entrenamiento.
// Se da en Ajustes → Equipo con el interruptor «Agenda» (perfiles.permisos.agenda).
//   4 · Dirección    → todo (rol 'admin'): Finanzas, Stats, Ajustes y el equipo.
//
// LA MISMA REGLA EN LOS DOS SITIOS. Los mínimos de abajo son los de serie; los que
// mandan están en la tabla permisos_nivel, que lee la app (ClientLayout) y también las
// reglas de la base de datos (función puedo() en sql/seguridad_niveles.sql). Cambiar un
// mínimo en Ajustes → Equipo cambia a la vez lo que se enseña y lo que se deja hacer.

export type Nivel = 1 | 2 | 3 | 4

export const NIVELES: { n: 1 | 2 | 3, nombre: string, que: string }[] = [
  { n: 1, nombre: 'Principiante', que: 'Hoy, Agenda (solo consulta) y Taller: da las clases y apunta lo que se hace' },
  { n: 2, nombre: 'Entrenador', que: 'Además ajusta la sesión del día (solo hoy) y consulta la biblioteca' },
  { n: 3, nombre: 'Entrenador que programa', que: 'Además fichas (la salud solo la ve), el torno, sesiones para siempre y ejercicios' },
]
export const nombreNivel = (n: number) => n >= 4 ? 'Dirección' : NIVELES.find(x => x.n === n)?.nombre || 'Entrenador'

/** El mínimo nivel para cada cosa, de serie (si la tabla aún no existe o falla). */
export const MINIMO = {
  pacientes: 3,
  valoracion: 4,           // valoraciones y tests (también los que tocan en clase): el especialista
  editar_salud: 4,         // editar la salud de la ficha (el nivel 3 la ve, no la cambia)
  editar_agenda: 4,        // crear, mover, editar o borrar citas: por persona (POR_PERSONA)
  turnos: 3,               // quién se hace cargo de cada sala (agenda) y los horarios
  tareas: 4,               // poner y borrar tareas, y ver las de todos: el encargado (cada uno marca las suyas)
  cambiar_ejercicios: 2,   // cambios de UN DÍA en el taller: ejercicio, método, series (solo hoy)
  editar_plan: 3,          // cambiar la sesión PARA SIEMPRE: editor, «para siempre», crear, borrar
  cambiar_sesion: 2,       // asignar, cambiar o quitar la sesión de la cita
  cancelar_cita: 4,        // falta, cancelada y cambio de sala: por persona (POR_PERSONA)
  citas_taller: 2,         // falta o cancelada SOLO desde el taller: lo que nos avisan en sala
  torno: 3,
  ver_biblioteca: 2,       // la biblioteca de ejercicios, solo para consultar
  biblioteca: 3,
  cobros: 4,               // cobrar y facturar: quien administra
  medida_biblioteca: 3,    // 🔧 cambiar cómo se mide un ejercicio para todos
  direccion: 4,
} as const
export type Accion = keyof typeof MINIMO
export type Minimos = Record<Accion, number>

/** Lo que se da a cada persona aparte de su nivel (clave en perfiles.permisos). */
export const POR_PERSONA: Partial<Record<Accion, string>> = { editar_agenda: 'agenda', cancelar_cita: 'agenda' }

/** Lo de la tabla manda; lo que no esté, el de serie. */
export function mezclarMinimos(filas: { accion: string, minimo: number }[] | null | undefined): Minimos {
  const m: any = { ...MINIMO }
  ;(filas || []).forEach(f => { if (f.accion in m && f.minimo >= 1 && f.minimo <= 4) m[f.accion] = f.minimo })
  return m
}

/** Lo que se ve en Ajustes → Equipo para cada acción. */
export const ETIQUETA_ACCION: Record<Accion, string> = {
  pacientes: 'Ver y editar fichas de pacientes',
  valoracion: 'Valoraciones y tests',
  editar_salud: 'Editar la salud de la ficha',
  editar_agenda: 'Crear, mover y borrar citas',
  turnos: 'Cambiar quién lleva cada sala',
  tareas: 'Poner tareas y ver las de todos',
  cambiar_ejercicios: 'Cambiar ejercicios y método en el taller (solo hoy)',
  editar_plan: 'Cambiar sesiones para siempre (crear, editar, borrar)',
  cambiar_sesion: 'Elegir o quitar la sesión de una cita',
  cancelar_cita: 'Marcar faltas, cancelar y cambiar de sala',
  citas_taller: 'En el taller: marcar falta o cancelada',
  torno: 'El torno: planificar y crear sesiones',
  ver_biblioteca: 'Consultar la biblioteca de ejercicios',
  biblioteca: 'Crear y editar ejercicios',
  cobros: 'Cobrar y emitir facturas',
  medida_biblioteca: 'Cambiar cómo se mide un ejercicio para todos',
  direccion: 'Finanzas, estadísticas, ajustes y equipo',
}

/** Qué supone cada permiso, dicho para quien lo da (Ajustes → Equipo → Qué puede cada nivel). */
export const EXPLICA_ACCION: Record<Accion, string> = {
  pacientes: 'Entra en Pacientes y en la ficha de cada uno: datos, historial, entreno y resultados.',
  valoracion: 'Hace valoraciones y pasa tests, también los que tocan en clase. Ve Tests, Cuestionarios, Etiquetas y Clínico en la biblioteca.',
  editar_salud: 'Cambia la salud de la ficha (molestias, patologías, medicación…). Sin esto, la ve pero no la toca.',
  editar_agenda: 'Crea, mueve y borra citas en la agenda.',
  turnos: 'Cambia quién lleva cada sala y los horarios del equipo.',
  tareas: 'Pone tareas al equipo y ve las de todos. Sin esto, solo ve y marca las suyas y las de todo el equipo.',
  cambiar_ejercicios: 'En el taller, solo para hoy: cambia o añade ejercicios similares, el método de una parte y la franja (lado, ejecución, reps o segundos).',
  editar_plan: 'Cambia sesiones para siempre: editor de sesiones, «para siempre» en el taller, crear y borrar. En el taller puede poner una sesión de la biblioteca.',
  cambiar_sesion: 'Cambia la sesión de hoy de una cita por otra de las del paciente (taller y Programación de la agenda).',
  cancelar_cita: 'Marca faltas, cancela y cambia de sala desde la agenda.',
  citas_taller: 'Desde el taller marca Falta (no vino sin avisar) o Cancelada (avisó). Mueve sus sesiones igual que la agenda.',
  torno: 'Entra en el torno: crea sesiones y las reparte en las citas con el calendario de programar.',
  ver_biblioteca: 'Consulta la biblioteca de ejercicios: cromos, buscador de clientes y el botón de vistas. Sin tocar nada.',
  biblioteca: 'Crea y edita ejercicios (Amasar en el torno) y ve Sesiones, Sistemas y Objetivos en la biblioteca.',
  cobros: 'Cobra, emite facturas y ve el modo Cobro del botón de la agenda.',
  medida_biblioteca: 'Cambia para todos cómo se mide un ejercicio (reps, tiempo, goma…).',
  direccion: 'Finanzas, estadísticas, ajustes, equipo y avisos del equipo.',
}

/**
 * El nivel de alguien. Dirección puede «ver como» un nivel para comprobar qué ven
 * los demás: queda en este equipo ('sie_ver_como' = '1' | '2' | '3'). El valor
 * antiguo 'entrenador' cuenta como nivel 2.
 */
export function nivelDe(perfil: any): Nivel {
  if (!perfil) return 1
  if (perfil.rol === 'admin') {
    let v: string | null = null
    try { v = localStorage.getItem('sie_ver_como') } catch {}
    if (v === 'entrenador') return 2
    if (v === '1' || v === '2' || v === '3') return Number(v) as Nivel
    return 4
  }
  // Sin nivel puesto, el más bajo: se sube a mano en Ajustes → Equipo.
  const n = Number(perfil.nivel)
  return (n === 2 || n === 3 ? n : 1) as Nivel
}

/** Qué rutas pide cada nivel (por prefijo). Lo que no sale aquí, lo ve cualquiera. */
export const RUTAS: [string, Accion][] = [
  ['/pacientes', 'pacientes'], ['/movil/pacientes', 'pacientes'], ['/resultados', 'pacientes'],
  ['/valoracion', 'valoracion'], ['/camara', 'valoracion'], ['/vald', 'torno'],
  // La biblioteca se consulta desde el 2; sus pantallas de trabajo (/entrenamiento/…), del 3.
  ['/torno', 'torno'], ['/entrenamiento/', 'biblioteca'], ['/entrenamiento', 'ver_biblioteca'],
  ['/estadisticas', 'direccion'], ['/avisos', 'direccion'],
]

const Ctx = createContext<{ nivel: Nivel, minimos: Minimos, sueltos?: Record<string, any> }>({ nivel: 4, minimos: MINIMO })
export const ProveedorNivel = Ctx.Provider

/** puede('cambiar_ejercicios') → true/false según quien está dentro. */
export function usePuede() {
  const { nivel, minimos, sueltos } = useContext(Ctx)
  return (que: Accion) => nivel >= minimos[que] || (!!POR_PERSONA[que] && sueltos?.[POR_PERSONA[que]!] === true)
}
export const useNivel = () => useContext(Ctx).nivel
