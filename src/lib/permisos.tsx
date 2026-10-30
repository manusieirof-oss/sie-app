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
  { n: 3, nombre: 'Encargado/a', que: 'Además Pacientes y Valoración; crea y cambia sesiones para siempre, ejercicios, y cobra' },
]
export const nombreNivel = (n: number) => n >= 4 ? 'Dirección' : NIVELES.find(x => x.n === n)?.nombre || 'Entrenador'

/** El mínimo nivel para cada cosa, de serie (si la tabla aún no existe o falla). */
export const MINIMO = {
  pacientes: 3,
  valoracion: 3,           // valoraciones y tests (también los que tocan en clase)
  editar_agenda: 4,        // crear, mover, editar o borrar citas: por persona (POR_PERSONA)
  turnos: 3,               // quién se hace cargo de cada sala (agenda) y los horarios
  tareas: 3,               // poner y borrar tareas, y ver las de todos (cada uno marca las suyas)
  cambiar_ejercicios: 2,   // cambios de UN DÍA en el taller: ejercicio, método, series (solo hoy)
  editar_plan: 3,          // cambiar la sesión PARA SIEMPRE: editor, «para siempre», crear, borrar
  cambiar_sesion: 2,       // asignar, cambiar o quitar la sesión de la cita
  cancelar_cita: 4,        // falta, cancelada y cambio de sala: por persona (POR_PERSONA)
  torno: 3,
  ver_biblioteca: 2,       // la biblioteca de ejercicios, solo para consultar
  biblioteca: 3,
  cobros: 3,
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
  editar_agenda: 'Crear, mover y borrar citas',
  turnos: 'Cambiar quién lleva cada sala',
  tareas: 'Poner tareas y ver las de todos',
  cambiar_ejercicios: 'Cambiar ejercicios y método en el taller (solo hoy)',
  editar_plan: 'Cambiar sesiones para siempre (crear, editar, borrar)',
  cambiar_sesion: 'Elegir o quitar la sesión de una cita',
  cancelar_cita: 'Marcar faltas, cancelar y cambiar de sala',
  torno: 'El torno: planificar y crear sesiones',
  ver_biblioteca: 'Consultar la biblioteca de ejercicios',
  biblioteca: 'Crear y editar ejercicios',
  cobros: 'Cobrar y emitir facturas',
  medida_biblioteca: 'Cambiar cómo se mide un ejercicio para todos',
  direccion: 'Finanzas, estadísticas, ajustes y equipo',
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
  ['/estadisticas', 'direccion'],
]

const Ctx = createContext<{ nivel: Nivel, minimos: Minimos, sueltos?: Record<string, any> }>({ nivel: 4, minimos: MINIMO })
export const ProveedorNivel = Ctx.Provider

/** puede('cambiar_ejercicios') → true/false según quien está dentro. */
export function usePuede() {
  const { nivel, minimos, sueltos } = useContext(Ctx)
  return (que: Accion) => nivel >= minimos[que] || (!!POR_PERSONA[que] && sueltos?.[POR_PERSONA[que]!] === true)
}
export const useNivel = () => useContext(Ctx).nivel
