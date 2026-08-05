'use client'
import { useMemo, useState } from 'react'
import { Ic } from '@/lib/icons'
import { planDeReparto, rotacionActual, aplicarReparto, type CitaFutura } from '@/lib/rotacion'

/**
 * Repartir sesiones entre las citas futuras siguiendo una rotación.
 *
 * Todo el peso está en la PREVISUALIZACIÓN: se ve cita a cita qué va a quedar antes de
 * tocar nada, y sale de la misma función que va a escribir. Es una operación que cambia
 * veinte filas de golpe; un "¿seguro?" sin enseñar el resultado no da con qué decir que no.
 *
 * La rotación llega premarcada con la que ya se estaba siguiendo, deducida de las citas
 * asignadas. El caso más común —añadir tres meses de citas y rellenarlas— se resuelve
 * abriendo y dando a repartir, sin elegir nada.
 */
export default function ModalRepartir({ sesiones, citas, pacienteId, onCerrar, onHecho }: {
  /** Solo las vigentes: repartir una tanda antigua sería prescribir el programa viejo. */
  sesiones: any[]
  citas: CitaFutura[]
  pacienteId: string
  onCerrar: () => void
  onHecho: (n: number) => void
}) {
  const yaEnCurso = useMemo(() => rotacionActual(citas), [citas])
  const [orden, setOrden] = useState<string[]>(yaEnCurso)
  const [pisar, setPisar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const nombreDe = (id: string) => sesiones.find((s: any) => s.id === id)?.nombre || 'Sesión'
  const plan = useMemo(() => planDeReparto(citas, orden, { pisar }), [citas, orden, pisar])
  const nPisadas = plan.filter(r => r.pisa).length

  function alternar(id: string) {
    setOrden(o => o.includes(id) ? o.filter(x => x !== id) : [...o, id])
  }

  async function repartir() {
    setGuardando(true); setError('')
    const r = await aplicarReparto(pacienteId, plan, nombreDe)
    setGuardando(false)
    if (!r.ok) { setError(r.error); return }
    onHecho(r.n)
  }

  const sinSesion = citas.filter(c => !c.sesion_id).length

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div style={{ background: 'var(--w)', borderRadius: 'var(--rl)', width: '92vw', maxWidth: 620, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--sh-md)', overflow: 'hidden' }}>

        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd)', background: 'var(--bl)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: 'var(--n)' }}>Repartir en las citas</div>
            <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 2 }}>
              {citas.length} cita{citas.length === 1 ? '' : 's'} por delante
              {sinSesion > 0 && <> · {sinSesion} sin sesión</>}
            </div>
          </div>
          <button className="modal-close" onClick={onCerrar} aria-label="Cerrar"><Ic name="cerrar" size={16} /></button>
        </div>

        <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1 }}>

          <div className="et-mini" style={{ marginBottom: 6 }}>Rotación · pulsa en el orden en que se repiten</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {sesiones.map((s: any) => {
              const i = orden.indexOf(s.id)
              return (
                <button key={s.id} className={`chip-sel ${i >= 0 ? 'on' : ''}`} onClick={() => alternar(s.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {i >= 0 && <span style={{ fontSize: 11, opacity: .8 }}>{i + 1}</span>}
                  {s.nombre}
                </button>
              )
            })}
          </div>
          {yaEnCurso.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 12 }}>
              Viene marcada la rotación que ya seguían las citas asignadas.
            </div>
          )}

          <div className="et-mini" style={{ margin: '12px 0 6px' }}>Sobre qué citas</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className={`chip-sel ${!pisar ? 'on' : ''}`} onClick={() => setPisar(false)}>
              Solo las que no tienen sesión
            </button>
            <button className={`chip-sel ${pisar ? 'on' : ''}`} onClick={() => setPisar(true)}>
              Todas, desde la primera
            </button>
          </div>

          {orden.length === 0 ? (
            <div className="fila-p" style={{ borderLeftColor: 'var(--bd)' }}>
              <span style={{ fontSize: 13, color: 'var(--gr)' }}>Elige al menos una sesión para ver cómo queda.</span>
            </div>
          ) : plan.length === 0 ? (
            <div className="fila-p" style={{ borderLeftColor: 'var(--bd)' }}>
              <span style={{ fontSize: 13, color: 'var(--gr)' }}>
                No hay ninguna cita que rellenar. Con “todas, desde la primera” se reparte igualmente sobre las que ya tienen sesión.
              </span>
            </div>
          ) : (
            <>
              {/* Aquí está la decisión: se ve el resultado antes de escribirlo. */}
              <div className="et-mini" style={{ marginBottom: 6 }}>Cómo queda</div>
              <div style={{ display: 'grid', gap: 2 }}>
                {plan.slice(0, 14).map(r => (
                  <div key={r.cita.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 9px', background: 'var(--bl)', borderRadius: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--gr)', width: 120, flexShrink: 0 }}>
                      {new Date(r.cita.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {r.cita.hora && <> · {String(r.cita.hora).slice(0, 5)}</>}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--n)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nombreDe(r.sesionId)}
                    </span>
                    {r.pisa && (
                      <span style={{ fontSize: 12, color: '#8A6410', flexShrink: 0 }}>
                        sustituye a {nombreDe(r.cita.sesion_id || '')}
                      </span>
                    )}
                  </div>
                ))}
                {plan.length > 14 && (
                  <div style={{ fontSize: 12, color: 'var(--gr)', padding: '4px 9px' }}>
                    y {plan.length - 14} más, siguiendo la misma rotación
                  </div>
                )}
              </div>
            </>
          )}

          {nPisadas > 0 && (
            <div className="fila-p" style={{ borderLeftColor: 'var(--amb)', marginTop: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--n)' }}>
                {nPisadas} cita{nPisadas > 1 ? 's cambian' : ' cambia'} de sesión. Las citas pasadas no se tocan.
              </span>
            </div>
          )}

          {error && (
            <div className="fila-p" style={{ borderLeftColor: 'var(--red)', marginTop: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--n)' }}>{error}</span>
            </div>
          )}
        </div>

        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 7, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--gr)', flex: 1 }}>
            {plan.length === 0 ? 'Nada que repartir' : `${plan.length} cita${plan.length > 1 ? 's' : ''} a asignar`}
          </span>
          <button className="btn btn-t btn-sm" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-p" disabled={guardando || plan.length === 0} onClick={repartir}>
            {guardando ? 'Repartiendo…' : 'Repartir'}
          </button>
        </div>
      </div>
    </div>
  )
}
