'use client'
import { createContext, useContext } from 'react'

// NIVELES DEL EQUIPO. Un solo sitio que dice quién puede qué, para que la barra, las
// rutas y los botones del taller no tengan cada uno su propia regla.
//
//   1 · Principiante → Hoy, Agenda (solo consulta) y Taller: da la clase, apunta
//                      series y hechos y marca faltas. No cambia nada de lo planificado.
//   2 · Entrenador   → además Pacientes y Valoración, cambia ejercicios de las
//                      sesiones (hoy o para siempre), elige sesión y cancela o cambia
//                      de sala.
//   3 · Encargado/a  → además El torno y la Biblioteca (crea sesiones y ejercicios) y
//                      Cobros.
//   4 · Dirección    → todo (rol 'admin'): Finanzas, Stats, Ajustes y el equipo.
//
// LA MISMA REGLA EN LOS DOS SITIOS. Los mínimos de abajo son los de serie; los que
// mandan están en la tabla permisos_nivel, que lee la app (ClientLayout) y también las
// reglas de la base de datos (función puedo() en sql/seguridad_niveles.sql). Cambiar un
// mínimo en Ajustes → Equipo cambia a la vez lo que se enseña y lo que se deja hacer.

export type Nivel = 1 | 2 | 3 | 4

export const NIVELES: { n: 1 | 2 | 3, nombre: string, que: string }[] = [
  { n: 1, nombre: 'Principiante', que: 'Hoy, Agenda (solo consulta) y Taller: da las clases, apunta y marca faltas' },
  { n: 2, nombre: 'Entrenador', que: 'Además Pacientes y Valoración; cambia ejercicios de las sesiones' },
  { n: 3, nombre: 'Encargado/a', que: 'Además crea sesiones y ejercicios, y cobra' },
]
export const nombreNivel = (n: number) => n >= 4 ? 'Dirección' : NIVELES.find(x => x.n === n)?.nombre || 'Entrenador'

/** El mínimo nivel para cada cosa, de serie (si la tabla aún no existe o falla). */
export const MINIMO = {
  pacientes: 2,
  valoracion: 2,
  editar_agenda: 2,        // crear, mover, editar o borrar citas (el 1 solo la consulta)
  cambiar_ejercicios: 2,   // ⇄ solo hoy, para siempre o quitarlo de su sesión
  cambiar_sesion: 2,       // asignar, cambiar o quitar la sesión de la cita
  cancelar_cita: 2,        // cancelar y cambiar de sala (la falta la marca cualquiera)
  torno: 3,
  biblioteca: 3,
  cobros: 3,
  medida_biblioteca: 3,    // 🔧 cambiar cómo se mide un ejercicio para todos
  direccion: 4,
} as const
export type Accion = keyof typeof MINIMO
export type Minimos = Record<Accion, number>

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
  cambiar_ejercicios: 'Cambiar ejercicios en el taller',
  cambiar_sesion: 'Elegir o quitar la sesión de una cita',
  cancelar_cita: 'Cancelar y cambiar de sala desde el taller',
  torno: 'El torno: planificar y crear sesiones',
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
  ['/torno', 'torno'], ['/entrenamiento', 'biblioteca'],
  ['/estadisticas', 'direccion'],
]

const Ctx = createContext<{ nivel: Nivel, minimos: Minimos }>({ nivel: 4, minimos: MINIMO })
export const ProveedorNivel = Ctx.Provider

/** puede('cambiar_ejercicios') → true/false según quien está dentro. */
export function usePuede() {
  const { nivel, minimos } = useContext(Ctx)
  return (que: Accion) => nivel >= minimos[que]
}
export const useNivel = () => useContext(Ctx).nivel
