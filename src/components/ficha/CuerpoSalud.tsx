'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ZONAS } from '@/lib/mapaTrabajo'
import { RAMPA } from '@/lib/rampaCalor'
import type { MapaCalor3D } from '@/lib/anim3d/mapaCalor'

// ---------------------------------------------------------------------------
// EL CUERPO DE SU SALUD (ficha): el mismo muñeco del mapa de calor, pero pintado con lo
// que le pasa, no con lo que entrena. Tres vistas:
//   · Dolor ahora   — molestias ACTIVAS, más intenso cuanto más EVA. Es lo que más
//                     importa en el momento en que está y antes no se veía en la ficha.
//   · Operaciones   — sus operaciones (la zona sale de la biblioteca de operaciones).
//   · Patologías    — las que no están resueltas (crónicas, un poco más suaves).
// Las zonas se guardan como texto ("Rodilla", "Columna lumbar"…): se buscan en las zonas
// del cuerpo por su nombre y sus articulaciones.
// ---------------------------------------------------------------------------

export type VistaSalud = 'dolor' | 'operaciones' | 'patologias'
const nrm = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
/** Texto de zona → zonas del muñeco (puede tocar más de una, p. ej. «columna»). */
function zonasDe(texto: string): string[] {
  const t = nrm(texto)
  if (!t) return []
  const ks = ZONAS.filter(z => [z.n, ...z.art].some(a => t.includes(nrm(a)))).map(z => z.k)
  if (ks.length) return ks
  if (/espalda baja|lumbo/.test(t)) return ['lumbar']
  if (/espalda|torac/.test(t)) return ['dorsal']
  if (/cuello/.test(t)) return ['cervical']
  if (/tobill|aquil/.test(t)) return ['tobillo']
  if (/menisco|ligamento cruzado|rotul/.test(t)) return ['rodilla']
  if (/manguito|supraesp/.test(t)) return ['hombro']
  return []
}

type Item = { titulo: string, detalle: string, zonas: string[], v: number }

export default function CuerpoSalud({ pacienteId, vista }: { pacienteId: string, vista: VistaSalud }) {
  const [items, setItems] = useState<Item[] | null>(null)
  useEffect(() => {
    setItems(null)
    ;(async () => {
      if (vista === 'dolor') {
        const { data } = await supabase.from('molestias').select('zona,eva,lado,tipo').eq('paciente_id', pacienteId).eq('activa', true)
        setItems((data || []).map((m: any) => ({ titulo: m.zona, detalle: [m.eva != null ? `EVA ${m.eva}/10` : 'sin EVA', m.lado && m.lado !== 'no_aplica' ? m.lado : ''].filter(Boolean).join(' · '),
          zonas: zonasDe(m.zona), v: m.eva != null ? Math.max(0.25, m.eva / 10) : 0.5 })))
      } else if (vista === 'operaciones') {
        const { data } = await supabase.from('operaciones').select('nombre,anio,lado,biblioteca_id').eq('paciente_id', pacienteId)
        const ids = (data || []).map((o: any) => o.biblioteca_id).filter(Boolean)
        const { data: bib } = ids.length ? await supabase.from('operaciones_biblioteca').select('id,zona').in('id', ids) : { data: [] as any[] }
        const zDe = Object.fromEntries((bib || []).map((b: any) => [b.id, b.zona || '']))
        setItems((data || []).map((o: any) => ({ titulo: o.nombre, detalle: [o.anio, o.lado && o.lado !== 'no_aplica' ? o.lado : ''].filter(Boolean).join(' · '),
          zonas: zonasDe(`${zDe[o.biblioteca_id] || ''} ${o.nombre}`), v: 0.8 })))
      } else {
        const { data } = await supabase.from('patologias').select('nombre,zona,estado,lado').eq('paciente_id', pacienteId).neq('estado', 'resuelta')
        setItems((data || []).map((p: any) => ({ titulo: p.nombre, detalle: p.estado === 'cronica' ? 'crónica' : 'activa',
          zonas: zonasDe(`${p.zona || ''} ${p.nombre}`), v: p.estado === 'cronica' ? 0.55 : 0.85 })))
      }
    })()
  }, [pacienteId, vista])

  // El muñeco (igual que MapaTrabajo).
  const caja = useRef<HTMLDivElement>(null)
  const visor = useRef<MapaCalor3D | null>(null)
  const [listo, setListo] = useState(false)
  const [fallo, setFallo] = useState('')
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { crearMapaCalor } = await import('@/lib/anim3d/mapaCalor')
        if (!caja.current) return
        const v = await crearMapaCalor(caja.current, {})
        if (!vivo) { v.destruir(); return }
        visor.current = v; setListo(true)
      } catch (e: any) { setFallo(e?.message || 'No se pudo abrir el cuerpo 3D') }
    })()
    return () => { vivo = false; visor.current?.destruir(); visor.current = null }
  }, [])
  useEffect(() => {
    if (!visor.current || !items) return
    const zonas: Record<string, any> = {}
    items.forEach(it => it.zonas.forEach(k => {
      const z = ZONAS.find(x => x.k === k); if (!z) return
      zonas[k] = { v: Math.max(zonas[k]?.v || 0, it.v), huesos: z.huesos, off: z.off }
    }))
    visor.current.poner({ zonas, musculos: {} })
  }, [items, listo])

  const vacio = vista === 'dolor' ? 'Ahora no tiene ninguna molestia activa.' : vista === 'operaciones' ? 'Sin operaciones apuntadas.' : 'Sin patologías activas.'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, alignItems: 'start' }}>
      <div>
        <div ref={caja} style={{ position: 'relative', height: 420, borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
          {(!listo || !items) && !fallo && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--grl)' }}>Cargando…</div>}
          {fallo && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--grl)' }}>{fallo}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--grl)', marginTop: 6 }}>
          {vista === 'dolor' ? 'Poco' : 'Leve'} <span style={{ flex: 1, height: 6, borderRadius: 9, background: `linear-gradient(90deg,${RAMPA.join(',')})` }}/> {vista === 'dolor' ? 'EVA alta' : 'Activa'}
        </div>
      </div>
      <div>
        {items && items.length === 0 && <div style={{ fontSize: 13, color: 'var(--grl)', padding: '20px 0' }}>{vacio}</div>}
        {(items || []).map((it, i) => (
          <div key={i} style={{ padding: '8px 0', borderTop: i ? '1px solid var(--bl)' : 'none' }}>
            <div style={{ fontSize: 14, color: 'var(--n)', fontWeight: 500 }}>{it.titulo}</div>
            <div style={{ fontSize: 12, color: 'var(--gr)' }}>{it.detalle}{!it.zonas.length && <span style={{ color: '#8A6410' }}> · sin zona en el cuerpo</span>}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
