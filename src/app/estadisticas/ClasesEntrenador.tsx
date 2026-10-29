'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/paginar'
import { cargarTurnos, responsableDe, type Turno } from '@/lib/turnos'
import { hoyISO } from '@/lib/fechas'

// ---------------------------------------------------------------------------
// CLASES POR ENTRENADOR Y MES (para la nómina)
//
// Una clase es una hora en una sala con al menos una persona que vino o viene (ni
// falta ni cancelada). Se le cuenta a quien la lleva según la agenda (lib/turnos):
// el cambio de ese día, si no su horario de esa sala, si no el de todas las salas.
// Si nadie la tenía asignada, se cuenta a quien estaba trabajando a esa hora, pero
// aparte («sin asignar»), porque es una deducción y conviene revisarla.
//
// Las de hoy que aún no han empezado y las de días que vienen salen como
// «previstas»: dependen de que no falten ni cancelen.
// ---------------------------------------------------------------------------

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const hhmm = (h: any) => String(h || '').slice(0, 5)

type Fila = { nombre: string, dadas: number, previstas: number, deducidas: number, dias: Record<string, string[]> }

export default function ClasesEntrenador() {
  const hoy = hoyISO()
  const [mes, setMes] = useState(hoy.slice(0, 7))
  const [citas, setCitas] = useState<any[] | null>(null)
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [abierto, setAbierto] = useState<string | null>(null)

  useEffect(() => { cargarTurnos().then(setTurnos) }, [])
  useEffect(() => {
    setCitas(null)
    const [a, m] = mes.split('-').map(Number)
    const desde = `${mes}-01`
    const hasta = `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`
    traerTodo((d, h) => supabase.from('citas').select('id,fecha,hora,sala,estado')
      .gte('fecha', desde).lte('fecha', hasta).order('id').range(d, h))
      .then(r => setCitas(r.filas))
  }, [mes])

  const filas = useMemo(() => {
    if (!citas) return null
    // Las clases: hora y sala con alguien que vino o viene.
    const clases = new Map<string, { fecha: string, hora: string, sala: string }>()
    citas.forEach(c => {
      if (['falta', 'cancelada'].includes(c.estado || 'programada') || !c.hora) return
      const k = `${c.fecha}|${hhmm(c.hora)}|${c.sala || ''}`
      if (!clases.has(k)) clases.set(k, { fecha: c.fecha, hora: hhmm(c.hora), sala: c.sala || '' })
    })
    const ahora = new Date()
    const horaAhora = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0')
    const por: Record<string, Fila> = {}
    let sinNadie = 0
    clases.forEach(cl => {
      const { lista, deducido } = responsableDe(turnos, cl.fecha, cl.hora, cl.sala)
      if (lista.length === 0) { sinNadie++; return }
      const prevista = cl.fecha > hoy || (cl.fecha === hoy && cl.hora > horaAhora)
      const vistos = new Set<string>()
      lista.forEach(t => {
        const nombre = (t.perfil?.nombre || '').trim() || 'Sin nombre'
        if (vistos.has(nombre)) return
        vistos.add(nombre)
        const f = (por[nombre] ||= { nombre, dadas: 0, previstas: 0, deducidas: 0, dias: {} })
        if (prevista) f.previstas++; else f.dadas++
        if (deducido) f.deducidas++
        ;(f.dias[cl.fecha] ||= []).push(`${cl.hora} ${cl.sala}${deducido ? '*' : ''}`)
      })
    })
    return { lista: Object.values(por).sort((a, b) => (b.dadas + b.previstas) - (a.dadas + a.previstas)), sinNadie }
  }, [citas, turnos, hoy])

  const mover = (n: number) => {
    const [a, m] = mes.split('-').map(Number)
    const d = new Date(a, m - 1 + n, 1)
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const [a, m] = mes.split('-').map(Number)
  const th: React.CSSProperties = { textAlign: 'right', fontSize: 11, color: 'var(--grl)', fontWeight: 500, padding: '6px 8px' }
  const td: React.CSSProperties = { textAlign: 'right', padding: '8px', fontSize: 13 }

  return (
    <div className="card">
      <div className="card-title" style={{ justifyContent: 'space-between' }}>
        <span className="ct-l">Clases por entrenador</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <button className="btn btn-s btn-sm" onClick={() => mover(-1)}>‹</button>
          <b style={{ fontSize: 13, minWidth: 120, textAlign: 'center' }}>{MESES[m - 1]} {a}</b>
          <button className="btn btn-s btn-sm" onClick={() => mover(1)}>›</button>
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 10 }}>
        Una clase es una hora en una sala con al menos una persona que vino o viene. Se cuenta a quien la lleva según la agenda.
      </div>
      {!filas ? <div style={{ fontSize: 12, color: 'var(--grl)', padding: 12 }}>Contando…</div> : filas.lista.length === 0
        ? <div style={{ fontSize: 12, color: 'var(--grl)', padding: 12 }}>No hay clases con responsable este mes.</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid var(--bd)' }}>
            <th style={{ ...th, textAlign: 'left' }}>Entrenador</th><th style={th}>Dadas</th><th style={th}>Previstas</th><th style={th}>Total</th><th style={th} title="Nadie tenía la sala asignada: se le cuenta por estar trabajando a esa hora">Sin asignar *</th>
          </tr></thead>
          <tbody>
            {filas.lista.map(f => (<Fragment key={f.nombre}>
              <tr key={f.nombre} onClick={() => setAbierto(x => x === f.nombre ? null : f.nombre)} style={{ borderBottom: '1px solid var(--bl)', cursor: 'pointer' }}>
                <td style={{ ...td, textAlign: 'left', fontWeight: 500 }}>{abierto === f.nombre ? '▾' : '▸'} {f.nombre}</td>
                <td style={td}>{f.dadas}</td>
                <td style={{ ...td, color: 'var(--gr)' }}>{f.previstas || '—'}</td>
                <td style={{ ...td, fontWeight: 700 }}>{f.dadas + f.previstas}</td>
                <td style={{ ...td, color: f.deducidas ? '#7A5800' : 'var(--grl)' }}>{f.deducidas || '—'}</td>
              </tr>
              {abierto === f.nombre && (
                <tr key={f.nombre + '-d'}><td colSpan={5} style={{ padding: '4px 8px 12px 22px', fontSize: 12, color: 'var(--gr)', lineHeight: 1.7 }}>
                  {Object.keys(f.dias).sort().map(d => (
                    <div key={d}><b style={{ color: 'var(--n)', fontWeight: 500 }}>{d.slice(8, 10)}/{d.slice(5, 7)}</b> · {f.dias[d].sort().join(', ')}</div>
                  ))}
                  <div style={{ fontSize: 11, color: 'var(--grl)', marginTop: 4 }}>* sin asignar: estaba trabajando a esa hora.</div>
                </td></tr>
              )}
            </Fragment>))}
          </tbody>
        </table>
      )}
      {filas && filas.sinNadie > 0 && (
        <div style={{ fontSize: 11.5, color: '#7A5800', marginTop: 10 }}>{filas.sinNadie} clase{filas.sinNadie === 1 ? '' : 's'} sin nadie en el horario a esa hora: no se cuentan a nadie.</div>
      )}
    </div>
  )
}
