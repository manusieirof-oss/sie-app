import { useEffect, useState } from 'react'

// EL PULSO EN DIRECTO, PARA PINTARLO DONDE ESTÉ CADA PACIENTE.
//
// Quien tiene las bandas (PulsoClase) publica aquí cada segundo el pulso de los que la
// llevan; la columna del paciente en «Todos» y su cabecera en «Uno a uno» lo leen. Así
// no hace falta una rejilla con todos: muchos días no todos hacen la parte aeróbica.

export interface PulsoVivo { bpm: number, zona: number, pct: number | null, color: string, banda: string }
let actual: Record<string, PulsoVivo> = {}
const oyentes = new Set<() => void>()

export function publicarPulso(m: Record<string, PulsoVivo>) {
  actual = m
  oyentes.forEach(f => f())
}

/** El pulso en directo de un paciente, o null si no lleva banda o no llega señal. */
export function usePulso(pid?: string | null): PulsoVivo | null {
  const [, set] = useState(0)
  useEffect(() => { const f = () => set(x => x + 1); oyentes.add(f); return () => { oyentes.delete(f) } }, [])
  return pid ? actual[pid] || null : null
}
