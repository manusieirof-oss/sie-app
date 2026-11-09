'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { hoyISO } from '@/lib/fechas'
import { Ic } from '@/lib/icons'

// ---------------------------------------------------------------------------
// SU PLANIFICACIÓN COMO EN EL TORNO (ficha › Entrenamiento), pero para MIRAR: los
// meses con sus citas, cada sesión con su color. Siempre el mes pasado, el actual y el
// siguiente; con el filtro, 6 meses o un año. Para cambiar algo se va al torno, que es
// el que sabe de candados, fases y repartir: aquí no se toca nada.
// ---------------------------------------------------------------------------

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const PALETA = ['#5A969E', '#C9A84C', '#B0708C', '#6E8FC7', '#7C9A6B', '#C77F5A', '#8A7CC7', '#4F9C8A']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** Qué meses se ven: [desde el mes actual menos X, hasta más Y]. */
const RANGOS: { k: string, t: string, antes: number, despues: number }[] = [
  { k: '3m', t: '3 meses', antes: 1, despues: 1 },
  { k: '6m', t: '6 meses', antes: 2, despues: 3 },
  { k: '1a', t: '1 año', antes: 5, despues: 6 },
]

export default function CalendarioCitasPaciente({ pacienteId, puedeEditar }: { pacienteId: string, puedeEditar: boolean }) {
  const router = useRouter()
  const [rango, setRango] = useState('3m')
  const [citas, setCitas] = useState<any[] | null>(null)
  const r = RANGOS.find(x => x.k === rango) || RANGOS[0]
  const meses = useMemo(() => {
    const h = new Date(); const out: Date[] = []
    for (let i = -r.antes; i <= r.despues; i++) out.push(new Date(h.getFullYear(), h.getMonth() + i, 1))
    return out
  }, [r.antes, r.despues])
  const desde = iso(meses[0]), hasta = iso(new Date(meses[meses.length - 1].getFullYear(), meses[meses.length - 1].getMonth() + 1, 0))
  useEffect(() => {
    setCitas(null)
    supabase.from('citas').select('id,fecha,hora,estado,sesion_id,sesiones:sesion_id(id,nombre,fija)')
      .eq('paciente_id', pacienteId).gte('fecha', desde).lte('fecha', hasta)
      .in('estado', ['programada', 'realizada', 'falta', 'cancelada']).order('fecha').order('hora')
      .then(({ data }) => setCitas(data || []))
  }, [pacienteId, desde, hasta])

  const hoy = hoyISO()
  const ses = (c: any) => Array.isArray(c.sesiones) ? c.sesiones[0] : c.sesiones
  // Un color por sesión, en el orden en que salen (como el torno).
  const colorSes = useMemo(() => {
    const m: Record<string, string> = {}
    ;(citas || []).forEach(c => { if (c.sesion_id && !m[c.sesion_id]) m[c.sesion_id] = PALETA[Object.keys(m).length % PALETA.length] })
    return m
  }, [citas])
  const porDia = useMemo(() => {
    const m: Record<string, any[]> = {}
    ;(citas || []).forEach(c => { (m[c.fecha] = m[c.fecha] || []).push(c) })
    return m
  }, [citas])
  const leyenda = useMemo(() => {
    const m: Record<string, { nombre: string, n: number }> = {}
    ;(citas || []).forEach(c => { const s = ses(c); if (s) { m[c.sesion_id] = m[c.sesion_id] || { nombre: s.nombre, n: 0 }; m[c.sesion_id].n++ } })
    return Object.entries(m)
  }, [citas])
  const alTorno = () => { if (puedeEditar) router.push(`/torno/${pacienteId}/citas`) }

  return (
    <div>
      {/* El filtro de cuántos meses, discreto. */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginBottom: 12 }}>
        {RANGOS.map(x => <button key={x.k} type="button" className={'atajo' + (rango === x.k ? ' on' : '')} onClick={() => setRango(x.k)}>{x.t}</button>)}
      </div>
      {citas === null ? <div className="muted" style={{ textAlign: 'center', padding: 30 }}>Cargando…</div> : <>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 28 }}>
          {meses.map((m, mi) => {
            const primero = (new Date(m.getFullYear(), m.getMonth(), 1).getDay() + 6) % 7
            const nDias = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
            const celdas: (string | null)[] = [...Array(primero).fill(null), ...Array.from({ length: nDias }, (_, i) => iso(new Date(m.getFullYear(), m.getMonth(), i + 1)))]
            return (
              <div key={mi} style={{ width: 336 }}>
                <div style={{ fontSize: 14, marginBottom: 8, textAlign: 'center', textTransform: 'capitalize' }}>
                  {m.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                  {DIAS.map(d => <div key={d} style={{ fontSize: 10, color: 'var(--grl)', textAlign: 'center' }}>{d}</div>)}
                  {celdas.map((f, i) => {
                    if (!f) return <div key={i}/>
                    const cs = porDia[f] || []
                    const pasado = f < hoy
                    return (
                      <div key={i} style={{ minHeight: 50, minWidth: 0, borderRadius: 8, padding: 3, background: cs.length ? 'var(--bl)' : 'transparent', opacity: pasado ? .55 : 1 }}>
                        <div style={{ fontSize: 10, color: f === hoy ? 'var(--gd)' : 'var(--grl)', fontWeight: f === hoy ? 700 : 400 }}>{Number(f.slice(8))}</div>
                        {cs.map(c => {
                          const s = ses(c)
                          const falta = c.estado === 'falta', cancelada = c.estado === 'cancelada'
                          return (
                            <button key={c.id} type="button" onClick={alTorno} disabled={!puedeEditar}
                              title={`${c.hora ? String(c.hora).slice(0, 5) : ''} ${s ? s.nombre : 'sin sesión'}${falta ? ' · faltó' : cancelada ? ' · cancelada' : ''}${puedeEditar ? ' · tocar para cambiarlo en el torno' : ''}`}
                              style={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 6, padding: '2px 4px', marginTop: 2, fontFamily: 'inherit', fontSize: 10.5,
                                cursor: puedeEditar ? 'pointer' : 'default', background: s && !falta && !cancelada ? colorSes[c.sesion_id] : '#fff',
                                color: s && !falta && !cancelada ? '#fff' : falta ? 'var(--red)' : 'var(--gr)',
                                border: s && !falta && !cancelada ? 'none' : `1px dashed ${falta ? 'var(--red)' : 'var(--bd)'}`,
                                textDecoration: cancelada ? 'line-through' : 'none' }}>
                              {falta ? '× ' : ''}{c.hora ? String(c.hora).slice(0, 5) : '·'}
                              {s?.fija && <span title="Con candado" style={{ marginLeft: 3 }}><Ic name="candado" size={9}/></span>}
                              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9.5, opacity: .9 }}>{s ? s.nombre : ''}</span>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        {/* Qué sesión es cada color, y cuántas veces sale en estos meses. */}
        {leyenda.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 16px', marginTop: 16, fontSize: 12 }}>
          {leyenda.map(([id, x]) => <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: colorSes[id] }}/>{x.nombre} <b style={{ fontWeight: 600 }}>{x.n}</b></span>)}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--red)' }}>× faltó</span>
        </div>}
        {puedeEditar && <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--grl)', marginTop: 8 }}>Toca una cita para cambiarla en el torno.</div>}
      </>}
    </div>
  )
}
