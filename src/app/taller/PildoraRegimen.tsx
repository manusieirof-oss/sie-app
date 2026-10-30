'use client'
import { useRef, useState } from 'react'
import Flotante from './Flotante'
import { useConfigTrabajo, nombresEjecucion } from '@/lib/usarTrabajo'

// ---------------------------------------------------------------------------
// COMO SE HACE HOY
//
// La capacidad se deduce de las repeticiones; el regimen no sale de ningun
// numero. Si el paciente acaba haciendolo excentrico porque no controla la
// subida, eso solo se sabe mirandolo, asi que se cambia aqui y se guarda con
// el registro del dia. La sesion no se toca: manana vuelve lo planificado.
// ---------------------------------------------------------------------------

// Sirve tambien para la LATERALIDAD (campo 'lado'): misma logica, otras opciones.
export const LADOS = ['Bilateral', 'Unilateral', 'Alterno']

/** Si hoy se hace distinto de lo planificado (lo usa la franja para ponerse ámbar). */
export const cambiadoHoy = (ej: any, campo: string, defecto = '') => {
  const plan = ej.plan?.[campo] || defecto
  return ej[campo] != null && ej[campo] !== '' && ej[campo] !== plan
}
export default function PildoraRegimen({ ej, onCambio, campo = 'regimen', opciones,
  defecto = '', titulo = 'Cómo se hace hoy', color = 'var(--gd)', borde = 'var(--gm)', texto = false }: any) {
  const [abierto, setAbierto] = useState(false)
  const ancla = useRef<HTMLButtonElement>(null)
  // Sin lista propia, las ejecuciones de Ajustes › Entrenador (lib/usarTrabajo).
  const cfg = useConfigTrabajo()
  const lista: string[] = opciones || nombresEjecucion(cfg)
  const plan = ej.plan?.[campo] || defecto
  const hoy = ej[campo] || plan
  const cambiado = ej[campo] != null && ej[campo] !== '' && ej[campo] !== plan

  return (
    <>
      {/* Sin onCambio (nivel 1) se ve, pero no se toca. */}
      <button ref={ancla} onClick={e => { e.stopPropagation(); if (onCambio) setAbierto(v => v === false) }}
        title={cambiado ? `Planificado: ${plan}` : onCambio ? 'Cómo se hace · pulsa para cambiarlo hoy' : 'Cómo se hace'}
        style={texto
          // Dentro de la franja de la tarjeta (RejillaParte): solo la palabra, el color lo pone la franja.
          ? { fontSize: 12, fontWeight: 700, letterSpacing: .4, textTransform: 'uppercase', fontFamily: 'inherit',
              cursor: onCambio ? 'pointer' : 'default', border: 'none', background: 'none', color: 'inherit', padding: 0 }
          : { fontSize: 10.5, padding: '2px 9px', borderRadius: 99, fontFamily: 'inherit',
              cursor: onCambio ? 'pointer' : 'default', border: '1px solid ' + borde,
              color: cambiado ? '#fff' : color,
              background: cambiado ? color : 'var(--w)' }}>
        {hoy}
      </button>

      <Flotante abierto={abierto} ancla={ancla} onCerrar={() => setAbierto(false)} ancho={196}>
        <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--grl)', letterSpacing: .5,
          textTransform: 'uppercase', marginBottom: 6 }}>{titulo}</div>
        {lista.map((r: string) => (
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
