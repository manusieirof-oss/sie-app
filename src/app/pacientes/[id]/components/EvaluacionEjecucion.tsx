'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'

export default function EvaluacionEjecucion({ pacienteId }: { pacienteId: string }) {
  const [loading, setLoading] = useState(true)
  const [evals, setEvals] = useState<any[]>([])

  useEffect(() => { cargar() }, [pacienteId])

  async function cargar() {
    setLoading(true)
    // registros con items evaluados, mas recientes primero
    const { data: regs } = await supabase.from('registros_ejercicio')
      .select('ejercicio_id,ejercicio_nombre,fecha,items_evaluados,created_at')
      .eq('paciente_id', pacienteId)
      .order('fecha', { ascending: false }).order('created_at', { ascending: false })

    // quedarnos con la ultima evaluacion por ejercicio que tenga items marcados
    const porEjercicio: Record<string, any> = {}
    ;(regs || []).forEach((r: any) => {
      const iv = r.items_evaluados || {}
      const tieneItems = Object.keys(iv).length > 0
      if (!tieneItems) return
      if (!r.ejercicio_id) return
      if (!porEjercicio[r.ejercicio_id]) porEjercicio[r.ejercicio_id] = r
    })

    const ids = Object.keys(porEjercicio)
    if (ids.length === 0) { setEvals([]); setLoading(false); return }

    // traer los items actuales de cada ejercicio (para el texto)
    const { data: ejs } = await supabase.from('ejercicios')
      .select('id,items_ejecucion').in('id', ids)
    const itemsMap: Record<string, any[]> = {}
    ;(ejs || []).forEach((e: any) => { itemsMap[e.id] = e.items_ejecucion || [] })

    const resultado = ids.map(id => {
      const r = porEjercicio[id]
      const items = itemsMap[id] || []
      const iv = r.items_evaluados || {}
      return {
        ejercicio_id: id,
        nombre: r.ejercicio_nombre,
        fecha: r.fecha,
        items: items.map((it: any, i: number) => ({ texto: it.texto, ok: iv[i] === true })),
      }
    }).filter(e => e.items.length > 0)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))

    setEvals(resultado)
    setLoading(false)
  }

  if (loading) return <div className="loading">Cargando evaluaciones…</div>

  return (
    <div className="panel">
      <div className="sec">
        <div className="sec-h">
          <span className="sh-l"><span className="ct-l"><Ic name="ok" size={13}/> Cómo ejecuta</span></span>
          {evals.length>0 && <span className="sh-r">Última evaluación de cada ejercicio</span>}
        </div>
        {evals.length === 0 && <div className="muted">Aún no hay evaluaciones de ejecución registradas.</div>}
        {evals.map(ev => {
          const cumplidos = ev.items.filter((i: any) => i.ok).length
          const total = ev.items.length
          const pleno = cumplidos === total
          return (
            <div key={ev.ejercicio_id} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--n)' }}>{ev.nombre}</div>
                <span style={{ fontSize: 12, color: 'var(--gr)' }}>
                  {new Date(ev.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className={`pill ${pleno ? 'pill-o on' : 'pill-a'}`}>{cumplidos} de {total}</span>
              </div>
              {ev.items.map((it: any, i: number) => (
                <div key={i} className="fila-p" style={{ borderLeftColor: it.ok ? 'var(--g)' : 'var(--red)', marginBottom: 4 }}>
                  <span style={{ display: 'inline-flex', color: it.ok ? 'var(--gd)' : 'var(--red)', flexShrink: 0 }}>
                    <Ic name={it.ok ? 'check' : 'cerrar'} size={14} />
                  </span>
                  <span style={{ fontSize: 13, color: it.ok ? 'var(--n)' : 'var(--gr)' }}>{it.texto}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
