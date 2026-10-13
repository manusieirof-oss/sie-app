'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { sugerirObjetivos } from '@/lib/ejercicioObjetivos'

/**
 * CON QUÉ SE ESTÁ TRABAJANDO ESTE OBJETIVO, Y CÓMO VA.
 *
 * Lo que le da credibilidad al objetivo mientras se trabaja: qué ejercicios suyos lo
 * trabajan (el vínculo ejercicio → objetivo de sus sesiones), cuántas clases los ha
 * hecho y cómo han progresado. Solo SUS registros del taller: es su evolución desde
 * que empezó, no una comparación con nadie.
 *
 * El progreso de cada ejercicio es la primera vez contra la última:
 *   - con peso, el peso máximo del día;
 *   - sin peso, los segundos si se mide por tiempo, y si no las repeticiones.
 * Si cambió de variante (bilateral → unipodal) se dice: es progreso aunque el número baje.
 */

type Fila = {
  id: string
  nombre: string
  dias: number
  primero?: { fecha: string, valor: number, variante: string | null }
  ultimo?: { fecha: string, valor: number, variante: string | null }
  unidad: 'kg' | 's' | 'reps'
}

const num = (x: any) => { const n = parseFloat(String(x ?? '').replace(',', '.')); return Number.isFinite(n) ? n : NaN }
const fechaCorta = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

export default function TrabajoObjetivo({ pacienteId, objetivo, sesiones }: {
  pacienteId: string, objetivo: any, sesiones: any[],
}) {
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [clases, setClases] = useState<{ n: number, desde: string | null }>({ n: 0, desde: null })

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const oid = objetivo?.id
      if (!oid) { setFilas([]); return }
      // Los ejercicios de sus sesiones que dicen trabajarlo. Las sesiones de antes del
      // vínculo no lo llevan guardado: ahí se sugiere por etiquetas, como en el taller.
      const elegidos = new Map<string, string>()
      const porSugerir = new Map<string, string>()
      for (const s of sesiones || []) {
        const laTiene = (s.sesiones_objetivos || []).some((r: any) => r.objetivo_id === oid)
        for (const p of (s.partes || [])) for (const ej of (p.ejercicios || [])) {
          if (!ej?.ejercicio_id) continue
          if (Array.isArray(ej.objetivos)) { if (ej.objetivos.includes(oid)) elegidos.set(ej.ejercicio_id, ej.nombre || 'Ejercicio') }
          else if (laTiene) porSugerir.set(ej.ejercicio_id, ej.nombre || 'Ejercicio')
        }
      }
      const pend = Array.from(porSugerir.keys()).filter(id => !elegidos.has(id))
      if (pend.length > 0) {
        const { data: ets } = await supabase.from('ejercicios').select('id,etiquetas').in('id', pend)
        ;(ets || []).forEach((e: any) => {
          if (sugerirObjetivos(e.etiquetas || [], [objetivo]).includes(oid)) elegidos.set(e.id, porSugerir.get(e.id) || 'Ejercicio')
        })
      }
      const ids = Array.from(elegidos.keys())
      if (ids.length === 0) { if (vivo) { setFilas([]); setClases({ n: 0, desde: null }) }; return }

      const { data: regs, error } = await supabase.from('registros_ejercicio')
        .select('ejercicio_id,fecha,variante,series').eq('paciente_id', pacienteId)
        .eq('finalizado', true).in('ejercicio_id', ids).order('fecha')
      if (error || !vivo) { if (vivo) setFilas([]); return }

      const conDato = (regs || []).filter((r: any) => Array.isArray(r.series) && r.series.length > 0)
      const dias = Array.from(new Set(conDato.map((r: any) => r.fecha))).sort()
      setClases({ n: dias.length, desde: dias[0] || null })

      const out: Fila[] = ids.map(id => {
        const suyos = conDato.filter((r: any) => r.ejercicio_id === id)
        const todas = suyos.flatMap((r: any) => r.series)
        const unidad: Fila['unidad'] = todas.some((x: any) => num(x?.peso) > 0) ? 'kg'
          : todas.some((x: any) => num(x?.tiempo) > 0) ? 's' : 'reps'
        const campo = unidad === 'kg' ? 'peso' : unidad === 's' ? 'tiempo' : 'reps'
        const valorDia = (r: any) => Math.max(...r.series.map((x: any) => num(x?.[campo])).filter((n: number) => !isNaN(n)), -Infinity)
        const validos = suyos.map((r: any) => ({ fecha: r.fecha, valor: valorDia(r), variante: r.variante || null }))
          .filter((x: any) => Number.isFinite(x.valor))
        return {
          id, nombre: elegidos.get(id) || 'Ejercicio',
          dias: new Set(suyos.map((r: any) => r.fecha)).size,
          primero: validos[0], ultimo: validos[validos.length - 1], unidad,
        }
      })
      if (vivo) setFilas(out)
    })()
    return () => { vivo = false }
  }, [pacienteId, objetivo?.id, sesiones]) // eslint-disable-line react-hooks/exhaustive-deps

  if (filas == null || filas.length === 0) return null

  return (
    <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--bl)' }}>
      <div className="et-mini" style={{ marginBottom: 5 }}>
        Se trabaja con
        {clases.n > 0 && (
          <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'var(--gd)' }}>
            {' · '}{clases.n} clase{clases.n === 1 ? '' : 's'} desde el {fechaCorta(clases.desde!)}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gap: 3 }}>
        {filas.map(f => {
          const u = f.unidad === 'reps' ? ' reps' : ` ${f.unidad}`
          const hay2 = f.primero && f.ultimo && f.primero.fecha !== f.ultimo.fecha
          const dif = hay2 ? f.ultimo!.valor - f.primero!.valor : 0
          // Mejorar es subir en los tres casos: más peso, más segundos, más reps.
          const pct = hay2 && f.primero!.valor > 0 ? Math.round(dif / f.primero!.valor * 100) : null
          const cambioVar = hay2 && (f.primero!.variante || '') !== (f.ultimo!.variante || '') ? f.ultimo!.variante : null
          return (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              padding: '6px 10px', borderRadius: 7, border: '1px solid var(--bd)', background: 'var(--w)', fontSize: 12.5 }}>
              <span style={{ flex: 1, minWidth: 140 }}>{f.nombre}</span>
              {f.dias === 0 ? (
                <span style={{ fontSize: 11.5, color: 'var(--grl)' }}>sin hacer todavía</span>
              ) : !hay2 ? (
                <span style={{ fontSize: 11.5, color: 'var(--gr)' }}>
                  1 vez{f.ultimo ? ` · ${f.ultimo.valor}${u}` : ''}
                </span>
              ) : (
                <>
                  <span style={{ fontSize: 12, color: 'var(--gr)' }}>
                    {f.primero!.valor}{u} → <b style={{ color: 'var(--n)', fontWeight: 500 }}>{f.ultimo!.valor}{u}</b>
                  </span>
                  {dif !== 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 99,
                      background: dif > 0 ? 'var(--gl)' : 'var(--bl)', color: dif > 0 ? 'var(--gd)' : 'var(--gr)',
                      border: `1px solid ${dif > 0 ? 'var(--gm)' : 'var(--bd)'}` }}>
                      {dif > 0 ? '+' : '−'}{pct != null ? `${Math.abs(pct)}%` : `${Math.abs(dif)}${u}`}
                    </span>
                  )}
                  {cambioVar && <span style={{ fontSize: 11, color: 'var(--gd)' }}>· pasó a {cambioVar}</span>}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
