'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import { responsableDe, guardarTurno, borrarTurno, type Turno } from '@/lib/turnos'

// ---------------------------------------------------------------------------
// QUIEN LLEVA ESTA FRANJA, Y EL CAMBIO DE HOY
//
// El horario de siempre se pone en Ajustes; aqui se cambia el de HOY, que es
// cuando de verdad pasa: estas mirando el dia, falta alguien y lo cubres. Se
// guarda como un turno con fecha, que tapa al fijo sin tocarlo, asi que nadie
// tiene que acordarse de deshacerlo manana.
// ---------------------------------------------------------------------------

export default function ResponsableFranja({ turnos, perfiles, fecha, hora, horaFin, sala, onCambio }: {
  turnos: Turno[]
  perfiles: any[]
  fecha: string
  hora: string
  horaFin: string
  sala: string
  onCambio: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const { lista, deducido } = responsableDe(turnos, fecha, hora, sala)
  const nombres = lista.map(t => (t.perfil?.nombre || '').trim()).filter(Boolean)
  // El de hoy, si lo hay: cambiarlo dos veces no puede dejar dos filas.
  const deHoy = turnos.filter(t => t.fecha === fecha && String(t.sala || '') === sala
    && String(t.hora_inicio).slice(0, 5) === hora.slice(0, 5))

  async function poner(perfilId: string | null) {
    setGuardando(true)
    for (const t of deHoy) await borrarTurno(t.id)
    if (perfilId !== '' as any) {
      await guardarTurno({ perfil_id: perfilId, fecha, hora_inicio: hora, hora_fin: horaFin, sala })
    }
    setGuardando(false); setAbierto(false); onCambio()
  }

  return (
    <span style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <button type="button" onClick={() => setAbierto(v => v === false)}
        title={deducido
          ? 'Nadie asignado a esta sala: es quien está a esa hora. Pulsa para asignarlo hoy.'
          : 'Quién se hace cargo · pulsa para cambiarlo solo hoy'}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10,
          fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: 'none',
          padding: 0, maxWidth: '100%', overflow: 'hidden',
          color: nombres.length === 0 ? 'var(--fant, var(--grl))'
            : deducido ? 'var(--grl)' : 'var(--gd)',
          fontStyle: deducido ? 'italic' : 'normal' }}>
        <Ic name="usuario" size={11}/>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {nombres.length > 0 ? nombres.join(' · ') : 'sin asignar'}
        </span>
        {deHoy.length > 0 && (
          <span style={{ fontSize: 8, padding: '0 5px', borderRadius: 99,
            background: 'var(--ambl)', color: '#7A5800', flexShrink: 0 }}>hoy</span>
        )}
      </button>

      {abierto && (
        <>
          <span onClick={() => setAbierto(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 59 }}/>
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 60, minWidth: 190,
            background: 'var(--w)', border: '1px solid var(--bd)', borderRadius: 'var(--r)',
            boxShadow: 'var(--sh-md)', padding: 4, marginTop: 4 }}>
            <div style={{ fontSize: 9, color: 'var(--grl)', padding: '4px 8px', lineHeight: 1.4 }}>
              Solo para hoy. El horario de siempre, en Ajustes.
            </div>
            {perfiles.map(p => (
              <button key={p.id} className="menu-it" disabled={guardando}
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => poner(p.id)}>{p.nombre || p.rol}</button>
            ))}
            <button className="menu-it" disabled={guardando}
              style={{ width: '100%', textAlign: 'left', color: 'var(--gr)' }}
              onClick={() => poner(null)}>Nadie</button>
            {deHoy.length > 0 && (
              <button className="menu-it" disabled={guardando}
                style={{ width: '100%', textAlign: 'left', color: 'var(--gd)' }}
                onClick={() => poner('' as any)}>Volver al horario de siempre</button>
            )}
          </div>
        </>
      )}
    </span>
  )
}
