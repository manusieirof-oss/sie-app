import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// EL COLOR DE CADA SESIÓN, EL MISMO EN TODAS LAS PANTALLAS. Antes cada pantalla los
// repartía en el orden en que le salían, y una misma sesión era verde en la ficha y
// ocre en el torno. Ahora sale de la lista de TODAS las sesiones del paciente ordenadas
// siempre igual (por id): la misma sesión, el mismo color, se mire donde se mire.
// ---------------------------------------------------------------------------

export const PALETA_SESIONES = ['#5A969E', '#C9A84C', '#B0708C', '#6E8FC7', '#7C9A6B', '#C77F5A', '#8A7CC7', '#4F9C8A']

/** id → color, para las sesiones dadas (siempre todas las del paciente). */
export function coloresDe(ids: string[]): Record<string, string> {
  const orden = Array.from(new Set(ids.filter(Boolean))).sort()
  return Object.fromEntries(orden.map((id, i) => [id, PALETA_SESIONES[i % PALETA_SESIONES.length]]))
}

export async function coloresDelPaciente(pacienteId: string): Promise<Record<string, string>> {
  const { data } = await supabase.from('sesiones').select('id').eq('paciente_id', pacienteId)
  return coloresDe((data || []).map((s: any) => s.id))
}

/** Lo mismo como gancho: {} mientras carga. */
export function useColoresSesion(pacienteId?: string | null) {
  const [c, setC] = useState<Record<string, string>>({})
  useEffect(() => { if (pacienteId) coloresDelPaciente(pacienteId).then(setC) }, [pacienteId])
  return c
}
