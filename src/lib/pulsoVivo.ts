import { useEffect, useState } from 'react'

// EL PULSO EN DIRECTO, PARA PINTARLO DONDE ESTÉ CADA PACIENTE.
//
// Quien tiene las bandas (PulsoClase) publica aquí cada segundo el pulso de los que la
// llevan; la columna del paciente en «Todos» y su cabecera en «Uno a uno» lo leen. Así
// no hace falta una rejilla con todos: muchos días no todos hacen la parte aeróbica.
// Tocar el pulso o el nombre abre su velo (VeloPulso), que se monta una sola vez.

export interface PulsoVivo {
  bpm: number, zona: number, pct: number | null, color: string, banda: string
  nombre: string, fcMax: number | null, fcMedida: boolean
  seg: number, zonas: number[], media: number | null, max: number, bateria: number | null
  muestras: [number, number][]
}
let actual: Record<string, PulsoVivo> = {}
let abierto: string | null = null
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach(f => f())

export function publicarPulso(m: Record<string, PulsoVivo>) { actual = m; avisar() }
export function abrirPulso(pid: string | null) { abierto = pid; avisar() }
export const hayPulso = (pid?: string | null) => !!(pid && actual[pid])

function useCambios() {
  const [, set] = useState(0)
  useEffect(() => { const f = () => set(x => x + 1); oyentes.add(f); return () => { oyentes.delete(f) } }, [])
}
/** El pulso en directo de un paciente, o null si no lleva banda o no llega señal. */
export function usePulso(pid?: string | null): PulsoVivo | null { useCambios(); return pid ? actual[pid] || null : null }
/** De quién está abierto el velo. */
export function useAbierto(): string | null { useCambios(); return abierto }
