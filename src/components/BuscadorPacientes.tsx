'use client'
import { useState } from 'react'

// Selector de paciente por búsqueda. Lo usan la agenda (nueva cita) y la
// valoración. La valoración tenía un <select> con TODOS los pacientes dentro,
// que con unos cuantos cientos deja de ser usable.

export default function BuscadorPacientes({
  pacientes, valor, onElegir, onLimpiar, placeholder = 'Buscar paciente por nombre...',
  disabled = false, autoFocus = false, etiqueta, max = 30,
}: {
  pacientes: any[]
  /** id del paciente seleccionado, o '' si ninguno. */
  valor: string
  onElegir: (p: any) => void
  onLimpiar: () => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  /** Distintivo opcional a la derecha de cada resultado (p. ej. "pendiente"). */
  etiqueta?: (p: any) => string | null | undefined
  max?: number
}) {
  const [q, setQ] = useState('')

  const sel = valor ? pacientes.find((p: any) => p.id === valor) : null
  if (sel) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 'var(--r)', border: '1.5px solid var(--g)', background: 'var(--gl)' }}>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--n)' }}>
          {sel.nombre} {sel.apellidos}
          {sel.nombre_clinica && <span style={{ color: 'var(--gr)' }}> · “{sel.nombre_clinica}”</span>}
        </span>
        <button onClick={() => { setQ(''); onLimpiar() }} disabled={disabled}
          style={{ fontSize: 12, color: 'var(--gd)', background: 'none', border: 'none', cursor: 'pointer' }}>
          Cambiar
        </button>
      </div>
    )
  }

  // Busca también por nombre de clínica y por teléfono: en la agenda muchas
  // veces se busca por el mote o por el número desde el que han llamado.
  const coincide = (p: any) =>
    `${p.nombre} ${p.apellidos} ${p.nombre_clinica || ''} ${p.telefono || ''}`
      .toLowerCase().includes(q.toLowerCase())
  const resultados = q ? pacientes.filter(coincide) : []

  return (
    <div>
      <input className="input" value={q} onChange={e => setQ(e.target.value)}
        placeholder={placeholder} disabled={disabled} autoFocus={autoFocus} />
      {q && (
        <div style={{ border: '1px solid var(--bd)', borderRadius: 'var(--r)', maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
          {resultados.slice(0, max).map((p: any) => {
            const et = etiqueta?.(p)
            return (
              <div key={p.id} onClick={() => { setQ(''); onElegir(p) }}
                style={{ padding: '8px 11px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--bl)', display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseOver={e => (e.currentTarget as HTMLElement).style.background = 'var(--gl)'}
                onMouseOut={e => (e.currentTarget as HTMLElement).style.background = ''}>
                <span style={{ flex: 1, color: 'var(--n)' }}>
                  {p.nombre} {p.apellidos}
                  {p.nombre_clinica && <span style={{ color: 'var(--gr)' }}> · “{p.nombre_clinica}”</span>}
                </span>
                {et && <span style={{ fontSize: 12, color: '#7A5800', background: 'var(--ambl)', borderRadius: 99, padding: '1px 8px', flexShrink: 0 }}>{et}</span>}
              </div>
            )
          })}
          {resultados.length === 0 && (
            <div style={{ padding: '8px 11px', fontSize: 13, color: 'var(--gr)' }}>Sin pacientes que coincidan</div>
          )}
          {resultados.length > max && (
            <div style={{ padding: '6px 11px', fontSize: 12, color: 'var(--gr)' }}>
              y {resultados.length - max} más · afina la búsqueda
            </div>
          )}
        </div>
      )}
    </div>
  )
}
