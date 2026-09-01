'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { leerItems } from '@/lib/ejecucion'

/**
 * Qué falla en el gesto, criterio a criterio, en la última evaluación de cada ejercicio.
 *
 * No confundir con Resultados → Progresión → "Cómo ejecuta": aquella dice si va a
 * mejor, esta dice qué está fallando ahora. Son dos preguntas distintas y por eso los
 * títulos ya no se repiten.
 */
export default function EvaluacionEjecucion({ pacienteId }: { pacienteId: string }) {
  const [loading, setLoading] = useState(true)
  const [evals, setEvals] = useState<any[]>([])

  useEffect(() => { cargar() }, [pacienteId])

  async function cargar() {
    setLoading(true)
    // La ejecución es del paciente y del ejercicio, no de la sesión: una fila por par.
    const { data: regs } = await supabase.from('ejecucion_paciente')
      .select('ejercicio_id,items,fecha')
      .eq('paciente_id', pacienteId)
      .order('fecha', { ascending: false })

    const porEjercicio: Record<string, any> = {}
    ;(regs || []).forEach((r: any) => {
      if (!r.ejercicio_id) return
      if (Object.keys(r.items || {}).length === 0) return
      porEjercicio[r.ejercicio_id] = { ...r, items_evaluados: r.items, comentario: '' }
    })

    const ids = Object.keys(porEjercicio)
    if (ids.length === 0) { setEvals([]); setLoading(false); return }

    const { data: ejs } = await supabase.from('ejercicios')
      .select('id,nombre,items_ejecucion,imagen_url,video_url').in('id', ids)
    const bib: Record<string, any> = {}
    ;(ejs || []).forEach((e: any) => { bib[e.id] = e })

    const resultado = ids.map(id => {
      const r = porEjercicio[id]
      const e = bib[id] || {}
      const { items, huerfanos, dudoso } = leerItems(r.items_evaluados, e.items_ejecucion || [])
      return {
        ejercicio_id: id,
        nombre: e.nombre || '—',
        fecha: r.fecha,
        comentario: r.comentario || '',
        imagen_url: e.imagen_url || '',
        video_url: e.video_url || '',
        items, huerfanos, dudoso,
      }
    }).filter(e => e.items.length > 0 || e.huerfanos.length > 0)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))

    setEvals(resultado)
    setLoading(false)
  }

  if (loading) return <div className="loading">Cargando evaluaciones…</div>

  return (
    <div className="panel">
      <div className="sec">
        <div className="sec-h">
          <span className="sh-l"><span className="ct-l"><Ic name="ok" size={13}/> Qué falla en el gesto</span></span>
          {evals.length > 0 && <span className="sh-r">Última evaluación de cada ejercicio</span>}
        </div>
        {evals.length === 0 && <div className="muted">Aún no hay evaluaciones de ejecución registradas.</div>}

        {evals.map(ev => {
          const cumplidos = ev.items.filter((i: any) => i.ok).length
          const total = ev.items.length
          const pleno = total > 0 && cumplidos === total
          return (
            <div key={ev.ejercicio_id} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                {/* La foto, para reconocer el gesto que se está evaluando. */}
                {ev.imagen_url
                  ? <img src={ev.imagen_url} alt={ev.nombre} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 5, flexShrink: 0, background: 'var(--bm)' }} />
                  : <div style={{ width: 52, height: 52, background: 'var(--bm)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grl)', flexShrink: 0 }}><Ic name="fuerza" size={20} /></div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--n)' }}>{ev.nombre}</div>
                  <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 1 }}>
                    {new Date(ev.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                {ev.video_url && (
                  <a href={ev.video_url} target="_blank" rel="noopener noreferrer" className="btn btn-t btn-sm">
                    <Ic name="play" size={12} /> Vídeo
                  </a>
                )}
                {total > 0 && <span className={`pill ${pleno ? 'pill-o on' : 'pill-a'}`}>{cumplidos} de {total}</span>}
              </div>

              {/* Registro anterior al cambio de formato: la lectura se hace por posición
                  y puede no corresponder si los criterios se tocaron desde entonces. */}
              {ev.dudoso && (
                <div style={{ background: 'var(--ambl)', borderLeft: '3px solid var(--amb)', padding: '7px 11px', fontSize: 12, color: '#7A5800', marginBottom: 6 }}>
                  Evaluación anterior al cambio de formato. Se lee por posición, así que si has añadido o reordenado criterios desde entonces puede no corresponder.
                </div>
              )}

              {ev.items.map((it: any, i: number) => (
                <div key={i} className="fila-p" style={{ borderLeftColor: it.ok ? 'var(--g)' : 'var(--red)', marginBottom: 4 }}>
                  <span style={{ display: 'inline-flex', color: it.ok ? 'var(--gd)' : 'var(--red)', flexShrink: 0 }}>
                    <Ic name={it.ok ? 'check' : 'cerrar'} size={14} />
                  </span>
                  <span style={{ fontSize: 13, color: it.ok ? 'var(--n)' : 'var(--gr)' }}>{it.texto}</span>
                </div>
              ))}

              {/* Criterios que se evaluaron y ya no están en la biblioteca. Se enseñan
                  para no hacer desaparecer trabajo que sí se hizo. */}
              {ev.huerfanos.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 4 }}>Ya no están en la biblioteca</div>
                  {ev.huerfanos.map((it: any, i: number) => (
                    <div key={i} className="fila-p" style={{ borderLeftColor: 'var(--bd)', marginBottom: 4, opacity: .7 }}>
                      <span style={{ display: 'inline-flex', color: 'var(--grl)', flexShrink: 0 }}>
                        <Ic name={it.ok ? 'check' : 'cerrar'} size={14} />
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--gr)' }}>{it.texto}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* El comentario del taller se guardaba y no se leía en ningún sitio. */}
              {ev.comentario && (
                <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginTop: 7, background: 'var(--bl)', padding: '8px 11px', borderRadius: 'var(--r)' }}>
                  <span style={{ color: 'var(--gr)', display: 'inline-flex', flexShrink: 0, marginTop: 1 }}><Ic name="nota" size={12} /></span>
                  <span style={{ fontSize: 13, color: 'var(--n)', fontStyle: 'italic' }}>{ev.comentario}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
