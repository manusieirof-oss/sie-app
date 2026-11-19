'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DIAS, SALA_OFICINA, fijosEnCelda, pintarCelda, type Turno } from '@/lib/turnos'
import { horasDeAgenda } from '@/lib/generarHoras'

// ---------------------------------------------------------------------------
// EL HORARIO DEL EQUIPO, PINTADO EN LA SEMANA. Como la vista semana de la agenda: las
// mismas horas de clase (salen de los ajustes de la agenda), un día por columna y, en
// cada hora, una línea por sala más la OFICINA (quien trabaja pero no da clase).
//
// Se elige a una persona arriba y se tocan las casillas: se pone o se quita. La goma
// quita a quien haya. Lo que se pinta es el horario fijo de cada semana: es lo que sale
// en la agenda, en el taller y en Hoy. Los cambios de un día van en la lista de abajo.
// ---------------------------------------------------------------------------

const COLORES = ['#5A969E', '#D4A24E', '#C25B5B', '#6E9457', '#7A6FB0', '#3E7179', '#B8743A', '#9C5B8A']

export default function HorarioSemana({ turnos, perfiles, salas, onCambio }: { turnos: Turno[], perfiles: any[], salas: string[], onCambio: () => void }) {
  const [horas, setHoras] = useState<string[]>([])
  const [minutos, setMinutos] = useState(60)
  const [pincel, setPincel] = useState<string | null | undefined>(undefined)   // undefined = nada elegido; null = goma
  const [ocupado, setOcupado] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('ajustes').select('clave,valor').then(({ data }) => {
      const map: Record<string, string> = {}
      ;(data || []).forEach((a: any) => { map[a.clave] = a.valor || '' })
      setHoras(horasDeAgenda(map))
      setMinutos(parseInt(map.clinica_duracion_clase || '50') + parseInt(map.clinica_tiempo_cambio || '10'))
    })
  }, [])

  const equipo = useMemo(() => perfiles.filter(p => p.nombre), [perfiles])
  const color = (pid: string | null) => COLORES[Math.max(0, equipo.findIndex(p => p.id === pid)) % COLORES.length]
  const nombre = (pid: string | null) => equipo.find(p => p.id === pid)?.nombre || '—'
  const lineas = [...salas, SALA_OFICINA]

  async function tocar(dia: number, hora: string, sala: string) {
    if (pincel === undefined) { alert('Elige arriba a quién pintar (o la goma para quitar).'); return }
    const k = `${dia}|${hora}|${sala}`
    setOcupado(k)
    await pintarCelda(turnos, { perfil: pincel, dia, hora, minutos, sala, salasClase: salas })
    setOcupado(null)
    onCambio()
  }

  // Horas a la semana de cada uno (solo lo fijo), para ver si cuadra con su contrato.
  const horasDe = (pid: string) => {
    let m = 0
    turnos.filter(t => t.fecha == null && t.perfil_id === pid).forEach(t => {
      const a = String(t.hora_inicio).split(':').map(Number), b = String(t.hora_fin).split(':').map(Number)
      m += (b[0] * 60 + b[1]) - (a[0] * 60 + a[1])
    })
    return Math.round(m / 6) / 10
  }

  return (
    <div style={{ marginBottom: 18 }}>
      {/* EL PINCEL: a quién se pinta. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: 'var(--gr)', marginRight: 4 }}>Pinta a:</span>
        {equipo.map(p => (
          <button key={p.id} type="button" onClick={() => setPincel(p.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
              border: `1.5px solid ${pincel === p.id ? color(p.id) : 'var(--bd)'}`, background: pincel === p.id ? color(p.id) : 'var(--w)', color: pincel === p.id ? '#fff' : 'var(--n)' }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: pincel === p.id ? '#fff' : color(p.id) }}/>
            {p.nombre}<span style={{ fontSize: 11, opacity: .75 }}>{horasDe(p.id)} h</span>
          </button>
        ))}
        <button type="button" onClick={() => setPincel(null)}
          style={{ padding: '5px 11px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
            border: `1.5px solid ${pincel === null ? 'var(--n)' : 'var(--bd)'}`, background: pincel === null ? 'var(--n)' : 'var(--w)', color: pincel === null ? '#fff' : 'var(--gr)' }}>
          Goma (quitar)
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--grl)', marginBottom: 10 }}>
        Toca una casilla para poner o quitar a quien tienes elegido. Cada hora tiene una línea por sala y la oficina (trabaja pero no da clase). Las horas a la semana salen al lado de cada nombre.
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 3, width: '100%', minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ width: 52 }}/>
              {DIAS.map(d => <th key={d.valor} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--n)', padding: '4px 0' }}>{d.nombre}</th>)}
            </tr>
          </thead>
          <tbody>
            {horas.map(h => (
              <tr key={h}>
                <td style={{ fontSize: 12, color: 'var(--gr)', verticalAlign: 'top', paddingTop: 4 }}>{h}</td>
                {DIAS.map(d => (
                  <td key={d.valor} style={{ background: 'var(--bl)', borderRadius: 8, padding: 3, verticalAlign: 'top' }}>
                    {lineas.map(sala => {
                      const quien = fijosEnCelda(turnos, d.valor, h, sala).map(t => t.perfil_id).filter((x, i, a) => x && a.indexOf(x) === i) as string[]
                      const k = `${d.valor}|${h}|${sala}`
                      return (
                        <button key={sala} type="button" onClick={() => tocar(d.valor, h, sala)} disabled={ocupado != null}
                          title={`${d.nombre} ${h} · ${sala === SALA_OFICINA ? 'Oficina' : 'Sala ' + sala}${quien.length ? ': ' + quien.map(nombre).join(', ') : ''}`}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', minHeight: 22, margin: '1px 0', padding: '2px 5px', borderRadius: 6, cursor: 'pointer',
                            border: 0, fontFamily: 'inherit', textAlign: 'left', opacity: ocupado === k ? .4 : 1,
                            background: quien.length ? color(quien[0]) : (sala === SALA_OFICINA ? 'transparent' : 'var(--w)'),
                            outline: sala === SALA_OFICINA && !quien.length ? '1px dashed var(--bd)' : 'none' }}>
                          <span style={{ fontSize: 9.5, fontWeight: 700, width: 16, color: quien.length ? 'rgba(255,255,255,.85)' : 'var(--grl)' }}>{sala === SALA_OFICINA ? 'Of' : sala}</span>
                          <span style={{ fontSize: 11.5, color: quien.length ? '#fff' : 'var(--grl)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {quien.map(nombre).map(n => n.split(' ')[0]).join(' · ')}
                          </span>
                        </button>
                      )
                    })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
