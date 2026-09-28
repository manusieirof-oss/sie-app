'use client'
import { useState } from 'react'
import { SALIDAS, cerrarEvaluacion, type Salida, type ObjetivoEnEvaluacion } from '@/lib/evaluaciones'

// ---------------------------------------------------------------------------
// CERRAR LA EVALUACION
//
// La salida deja el dato contable -cuantas fases se repitieron el ano pasado-
// y el texto deja el porque, que es justo lo que hoy no se guarda en ningun
// sitio. Delante, lo que la sostiene: que objetivos estaban y cuales no.
// ---------------------------------------------------------------------------

export default function CerrarEvaluacion({ pacienteId, evaluacionId, faseNombre, lista,
  onHecho, onCerrar }: {
  pacienteId: string
  evaluacionId: string
  faseNombre?: string
  lista: ObjetivoEnEvaluacion[]
  onHecho: () => void
  onCerrar: () => void
}) {
  const hechos = lista.filter(o => o.logrado).length
  const total = lista.length
  // Lo que suele tocar: si estan todos, avanza; si no, repite.
  const [salida, setSalida] = useState<Salida>(total > 0 && hechos === total ? 'avanza' : 'repite')
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    const r = await cerrarEvaluacion(evaluacionId, {
      pacienteId, faseNombre, salida, conclusion: texto,
    })
    setGuardando(false)
    if (r.ok === false) { alert('No se ha podido cerrar: ' + r.error); return }
    onHecho()
  }

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="modal" style={{ width: 460 }}>
        <div className="modal-title">
          Cerrar la evaluación
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>

        {faseNombre && (
          <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 11 }}>
            {faseNombre} · {hechos} de {total} objetivos logrados
          </div>
        )}

        {/* LO QUE LA SOSTIENE, delante: cerrar con "avanza" faltando tres
            objetivos es una decision legitima, pero que se tome viendolos. */}
        {lista.length > 0 && (
          <div style={{ border: '1px solid var(--bd)', borderRadius: 7, padding: '7px 10px',
            marginBottom: 13, maxHeight: 132, overflowY: 'auto' }}>
            {lista.map(o => (
              <div key={o.id} style={{ display: 'flex', gap: 7, fontSize: 11.5,
                padding: '3px 0', color: o.logrado ? 'var(--gd)' : 'var(--gr)' }}>
                <span style={{ width: 11 }}>{o.logrado ? '✓' : '·'}</span>
                <span style={{ flex: 1, minWidth: 0 }}>{o.nombre}</span>
              </div>
            ))}
          </div>
        )}

        <div className="field">
          <label>Qué se decide</label>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {SALIDAS.map(s => (
              <button key={s.valor} type="button" onClick={() => setSalida(s.valor)}
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 99, cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: salida === s.valor ? s.fondo : 'transparent',
                  color: salida === s.valor ? s.color : 'var(--gr)',
                  border: `1px solid ${salida === s.valor ? s.color : 'var(--bd)'}` }}>
                {s.nombre}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Por qué</label>
          <textarea className="input" rows={3} value={texto} autoFocus
            onChange={e => setTexto(e.target.value)}
            placeholder="Sigue positivo pero mejora; mantenemos fase y subimos carga."/>
        </div>

        <div style={{ fontSize: 10.5, color: 'var(--grl)', marginBottom: 11, lineHeight: 1.55 }}>
          Esto no mueve la fase: sigue avanzando por sus objetivos. Queda escrito para
          cuando dentro de un año haya que saber por qué.
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-s" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-p" onClick={guardar} disabled={guardando}>
            {guardando ? 'Cerrando…' : 'Cerrar la evaluación'}
          </button>
        </div>
      </div>
    </div>
  )
}
