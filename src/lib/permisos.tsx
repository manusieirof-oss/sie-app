'use client'
import { createContext, useContext } from 'react'

// NIVELES DEL EQUIPO. Un solo sitio que dice quién puede qué, para que la barra, las
// rutas y los botones del taller no tengan cada uno su propia regla.
//
//   1 · Eventual     → Hoy, Agenda (solo consulta) y Taller: da la clase, apunta
//                      series y hechos y marca faltas. No cambia nada de lo planificado.
//   2 · Entrenador   → además Pacientes y Valoración, cambia ejercicios de las
//                      sesiones (hoy o para siempre), elige sesión y cancela o cambia
//                      de sala.
//   3 · Encargado/a  → además El torno y la Biblioteca (crea sesiones y ejercicios) y
//                      Cobros.
//   4 · Dirección    → todo (rol 'admin'): Finanzas, Stats, Ajustes y el equipo.
//
// Es lo que se ENSEÑA a cada uno. Los datos siguen protegidos por RLS como hasta
// ahora; esto ordena la app, no sustituye a la seguridad de la base de datos.

export type Nivel = 1 | 2 | 3 | 4

export const NIVELES: { n: 1 | 2 | 3, nombre: string, que: string }[] = [
  { n: 1, nombre: 'Eventual', que: 'Hoy, Agenda (solo consulta) y Taller: da las clases, apunta y marca faltas' },
  { n: 2, nombre: 'Entrenador', que: 'Además Pacientes y Valoración; cambia ejercicios de las sesiones' },
  { n: 3, nombre: 'Encargado/a', que: 'Además crea sesiones y ejercicios, y cobra' },
]
export const nombreNivel = (n: number) => n >= 4 ? 'Dirección' : NIVELES.find(x => x.n === n)?.nombre || 'Entrenador'

/** El mínimo nivel para cada cosa. */
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

const Ctx = createContext<Nivel>(4)
export const ProveedorNivel = Ctx.Provider

/** puede('cambiar_ejercicios') → true/false según quien está dentro. */
export function usePuede() {
  const nivel = useContext(Ctx)
  return (que: Accion) => nivel >= MINIMO[que]
}
export const useNivel = () => useContext(Ctx)
