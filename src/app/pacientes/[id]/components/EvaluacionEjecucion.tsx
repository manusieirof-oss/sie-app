'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

  if (loading) return <div className="loading">Cargando evaluaciones...</div>
  if (evals.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--grl)', fontSize: 11 }}>Aún no hay evaluaciones de ejecución registradas.</div>

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {evals.map(ev => {
        const cumplidos = ev.items.filter((i: any) => i.ok).length
        const total = ev.items.length
        return (
          <div key={ev.ejercicio_id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, fontSize: 12, fontWeight: 400, color: 'var(--n)' }}>{ev.nombre}</div>
              <span style={{ fontSize: 9, color: 'var(--grl)' }}>últ. eval. {new Date(ev.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
              <span style={{ fontSize: 9, fontWeight: 500, color: cumplidos === total ? 'var(--g)' : 'var(--amb)' }}>{cumplidos}/{total}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ev.items.map((it: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 12, color: it.ok ? 'var(--g)' : 'var(--red)' }}>{it.ok ? '✓' : '✗'}</span>
                  <span style={{ fontSize: 11, color: it.ok ? 'var(--n)' : 'var(--grl)' }}>{it.texto}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
