'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { avisosDeCondiciones, tituloAviso, type AvisoZona } from '@/lib/avisosZona'

// ---------------------------------------------------------------------------
// EL AVISO DE LA MOLESTIA, FUERA DEL TALLER
//
// Mismo cruce que en la sala, pero para verlo ANTES: al mirar la sesion del
// paciente. Se carga solo -molestias, arbol de etiquetas y etiquetas de cada
// ejercicio- y lo guarda en memoria, porque en una sesion de doce ejercicios
// habria doce componentes preguntando lo mismo.
// ---------------------------------------------------------------------------

let arbol: any[] | null = null
let cargandoArbol: Promise<any[]> | null = null
const molPorPaciente: Record<string, { molestias: any[], patologias: any[] }> = {}
const etsPorEjercicio: Record<string, string[]> = {}

async function etiquetasArbol(): Promise<any[]> {
  if (arbol) return arbol
  if (cargandoArbol == null) {
    cargandoArbol = (async () => {
      const { data } = await supabase.from('etiquetas').select('id,nombre,categoria,padre_id')
      arbol = data || []
      return arbol
    })()
  }
  return cargandoArbol
}

async function condicionesDe(pacienteId: string) {
  if (molPorPaciente[pacienteId]) return molPorPaciente[pacienteId]
  const [m, p] = await Promise.all([
    supabase.from('molestias').select('*').eq('paciente_id', pacienteId).eq('activa', true),
    supabase.from('patologias').select('*').eq('paciente_id', pacienteId),
  ])
  molPorPaciente[pacienteId] = { molestias: m.data || [], patologias: p.data || [] }
  return molPorPaciente[pacienteId]
}

async function etiquetasDe(ejercicioId: string) {
  if (etsPorEjercicio[ejercicioId]) return etsPorEjercicio[ejercicioId]
  const { data } = await supabase.from('ejercicios').select('etiquetas')
    .eq('id', ejercicioId).maybeSingle()
  etsPorEjercicio[ejercicioId] = Array.isArray(data?.etiquetas) ? data!.etiquetas : []
  return etsPorEjercicio[ejercicioId]
}

/** Para cuando el paciente cambia de molestias sin recargar la pagina. */
export function olvidarMolestias(pacienteId?: string) {
  if (pacienteId) delete molPorPaciente[pacienteId]
  else Object.keys(molPorPaciente).forEach(k => delete molPorPaciente[k])
}

export default function AvisoMolestia({ pacienteId, ejercicioId, compacto = false }: {
  pacienteId?: string | null
  ejercicioId?: string | null
  /** Solo el titulo, sin la nota: para listas muy apretadas. */
  compacto?: boolean
}) {
  const [avisos, setAvisos] = useState<AvisoZona[]>([])

  useEffect(() => {
    let vivo = true
    if (!pacienteId || !ejercicioId) { setAvisos([]); return }
    ;(async () => {
      const [ets, cond, ids] = await Promise.all([
        etiquetasArbol(), condicionesDe(pacienteId), etiquetasDe(ejercicioId),
      ])
      if (vivo) setAvisos(avisosDeCondiciones(cond, ets, ids))
    })()
    return () => { vivo = false }
  }, [pacienteId, ejercicioId])

  if (avisos.length === 0) return null

  return (
    <div style={{ display: 'grid', gap: 3, marginTop: 3 }}>
      {avisos.map((a, k) => (
        <div key={k} style={{ display: 'flex', gap: 5, alignItems: 'flex-start', fontSize: 10.5,
          lineHeight: 1.4, color: a.clase === 'patologia' ? 'var(--rj, #B4544F)' : '#7A5800' }}
          title={a.nota || ''}>
          <span style={{ flexShrink: 0 }}>⚠</span>
          <span>
            <b style={{ fontWeight: 600 }}>{tituloAviso(a)}</b>
            {compacto === false && a.nota ? ' — ' + a.nota : ''}
          </span>
        </div>
      ))}
    </div>
  )
}
