'use client'
import { useRef, useState } from 'react'
import Flotante from './Flotante'
import { REGIMENES } from '@/lib/capacidades'

// ---------------------------------------------------------------------------
// COMO SE HACE HOY
//
// La capacidad se deduce de las repeticiones; el regimen no sale de ningun
// numero. Si el paciente acaba haciendolo excentrico porque no controla la
// subida, eso solo se sabe mirandolo, asi que se cambia aqui y se guarda con
// el registro del dia. La sesion no se toca: manana vuelve lo planificado.
// ---------------------------------------------------------------------------

export default function PildoraRegimen({ ej, onCambio }: any) {
  const [abierto, setAbierto] = useState(false)
  const ancla = useRef<HTMLButtonElement>(null)
  const plan = ej.plan?.regimen || ''
  const hoy = ej.regimen || plan
  const cambiado = ej.regimen != null && ej.regimen !== '' && ej.regimen !== plan

  return (
    <>
      <button ref={ancla} onClick={e => { e.stopPropagation(); setAbierto(v => v === false) }}
        title={cambiado ? `Planificado: ${plan}` : 'Cómo se hace · pulsa para cambiarlo hoy'}
        style={{ fontSize: 10.5, padding: '2px 9px', borderRadius: 99, fontFamily: 'inherit',
          cursor: 'pointer', border: '1px solid var(--gm)',
          color: cambiado ? '#fff' : 'var(--gd)',
          background: cambiado ? 'var(--gd)' : 'var(--w)' }}>
        {hoy}
      </button>

      <Flotante abierto={abierto} ancla={ancla} onCerrar={() => setAbierto(false)} ancho={196}>
        <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--grl)', letterSpacing: .5,
          textTransform: 'uppercase', marginBottom: 6 }}>Cómo se hace hoy</div>
        {REGIMENES.map(r => (
          <button key={r} className="menu-it" style={{ width: '100%', textAlign: 'left' }}
            onClick={() => { onCambio(r); setAbierto(false) }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 11, color: 'var(--gd)' }}>{hoy === r ? '✓' : ''}</span>
              <span style={{ fontSize: 12 }}>{r}</span>
            </span>
          </button>
        ))}
        {cambiado && (
          <button className="menu-it" style={{ width: '100%', textAlign: 'left', fontSize: 11,
            color: 'var(--gr)' }}
            onClick={() => { onCambio(''); setAbierto(false) }}>
            Volver a lo planificado · {plan}
          </button>
        )}
      </Flotante>
    </>
  )
}
