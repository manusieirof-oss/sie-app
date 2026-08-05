'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { todasLasRondas, crearRonda, cerrarRonda, reabrirRonda, eliminarRonda, type Ronda } from '@/lib/rondas'

/**
 * Rondas de preguntas: crear, cerrar y consultar las cerradas.
 *
 * La ronda ABIERTA se trabaja en la lista de pacientes, que es donde están las personas.
 * Aquí solo se abre y se cierra, que es lo que se hace dos veces al año.
 *
 * Solo puede haber UNA abierta. Dos columnas de preguntas distintas en la misma lista es
 * pedir que alguien marque en la equivocada, y nadie se daría cuenta hasta septiembre.
 */
export default function RondasTab() {
  const [rondas, setRondas] = useState<Ronda[]>([])
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cuentas, setCuentas] = useState<Record<string, number>>({})
  const [verRonda, setVerRonda] = useState<Ronda | null>(null)
  const [detalle, setDetalle] = useState<any[]>([])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const rs = await todasLasRondas()
    setRondas(rs)
    const { data } = await supabase.from('rondas_respuestas').select('ronda_id')
    const c: Record<string, number> = {}
    ;(data || []).forEach((r: any) => { c[r.ronda_id] = (c[r.ronda_id] || 0) + 1 })
    setCuentas(c)
  }

  const abierta = rondas.find(r => r.estado === 'abierta')

  async function crear() {
    setGuardando(true)
    const r = await crearRonda(nombre, descripcion)
    setGuardando(false)
    if (!r.ok) { alert(r.error); return }
    setNombre(''); setDescripcion(''); cargar()
  }

  async function abrirDetalle(r: Ronda) {
    setVerRonda(r)
    const { data } = await supabase.from('rondas_respuestas')
      .select('estado,respuesta,pacientes:paciente_id(nombre,apellidos,nombre_clinica)')
      .eq('ronda_id', r.id)
    setDetalle(data || [])
  }

  return (
    <div className="panel">
      <div className="sec">
        <div className="sec-h">
          <span className="sh-l"><span className="ct-l"><Ic name="checkbox" size={13} /> Rondas de preguntas</span></span>
          <span className="sh-r">para saber a quién has preguntado ya</span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--gr)', lineHeight: 1.6, marginBottom: 14 }}>
          Una ronda añade una columna a la lista de pacientes donde marcas a quién has
          preguntado y anotas lo que te dijo. <b>Solo puede haber una abierta a la vez.</b> Al
          cerrarla desaparece la columna, pero las respuestas se conservan.
        </p>

        {abierta ? (
          <div className="fila-p" style={{ borderLeftColor: 'var(--g)', marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--n)' }}>
              Hay una ronda abierta: <b style={{ fontWeight: 500 }}>{abierta.nombre}</b>. Ciérrala
              antes de empezar otra.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 200px', margin: 0 }}>
              <label>Nombre</label>
              <input className="input" value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="ej. Horarios de septiembre" />
            </div>
            <div className="field" style={{ flex: '1 1 240px', margin: 0 }}>
              <label>Contexto (opcional)</label>
              <input className="input" value={descripcion} onChange={e => setDescripcion(e.target.value)}
                placeholder="ej. cerrar la agenda antes del 20 de agosto" />
            </div>
            <button className="btn btn-p" onClick={crear} disabled={guardando || !nombre.trim()}>
              {guardando ? 'Creando…' : 'Abrir ronda'}
            </button>
          </div>
        )}

        {rondas.length === 0 ? (
          <div className="muted">Todavía no has hecho ninguna ronda.</div>
        ) : (
          <div style={{ display: 'grid', gap: 5 }}>
            {rondas.map(r => (
              <div key={r.id} className="fila-p" style={{ borderLeftColor: r.estado === 'abierta' ? 'var(--g)' : 'var(--bd)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 13, color: 'var(--n)' }}>
                    {r.nombre}
                    <span className={`pill ${r.estado === 'abierta' ? 'pill-o on' : 'pill-soft'}`} style={{ marginLeft: 7 }}>
                      {r.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 2 }}>
                    {r.descripcion ? r.descripcion + ' · ' : ''}
                    {cuentas[r.id] || 0} marcados
                    {r.created_at && <> · desde el {new Date(r.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</>}
                  </div>
                </div>
                <button className="btn btn-t btn-sm" onClick={() => abrirDetalle(r)}>Ver respuestas</button>
                {r.estado === 'abierta' ? (
                  <button className="btn btn-s btn-sm" onClick={async () => {
                    if (!confirm(`Cerrar "${r.nombre}"?\n\nDesaparece la columna de la lista de pacientes. Las respuestas se conservan y podrás consultarlas aquí.`)) return
                    await cerrarRonda(r.id); cargar()
                  }}>Cerrar</button>
                ) : (
                  <button className="btn btn-t btn-sm" disabled={!!abierta}
                    title={abierta ? 'Cierra antes la que está abierta' : 'Vuelve a mostrar su columna'}
                    onClick={async () => { await reabrirRonda(r.id); cargar() }}>Reabrir</button>
                )}
                {/* Borrar solo tiene sentido para las creadas por error: se lleva las
                    respuestas, y esas son el motivo de haber hecho la ronda. */}
                {(cuentas[r.id] || 0) === 0 && (
                  <button className="btn btn-t btn-sm" style={{ color: 'var(--red)' }}
                    onClick={async () => { if (confirm('¿Eliminar esta ronda vacía?')) { await eliminarRonda(r.id); cargar() } }}>
                    <Ic name="papelera" size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {verRonda && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setVerRonda(null) }}>
          <div style={{ background: 'var(--w)', borderRadius: 'var(--rl)', width: '92vw', maxWidth: 620, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--sh-md)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd)', background: 'var(--bl)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, color: 'var(--n)' }}>{verRonda.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 2 }}>{detalle.length} marcados</div>
              </div>
              <button className="modal-close" onClick={() => setVerRonda(null)} aria-label="Cerrar"><Ic name="cerrar" size={16} /></button>
            </div>
            <div style={{ padding: '12px 18px', overflowY: 'auto' }}>
              {detalle.length === 0 ? (
                <div className="muted">Nadie marcado todavía.</div>
              ) : (
                <div style={{ display: 'grid', gap: 3 }}>
                  {detalle.map((d: any, i: number) => {
                    const p = Array.isArray(d.pacientes) ? d.pacientes[0] : d.pacientes
                    return (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 9px', background: 'var(--bl)', borderRadius: 4, alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, color: 'var(--n)', width: 170, flexShrink: 0 }}>
                          {p?.nombre} {p?.apellidos}
                        </span>
                        <span style={{ fontSize: 13, color: d.respuesta ? 'var(--n)' : 'var(--gr)', flex: 1 }}>
                          {d.respuesta || (d.estado === 'preguntado' ? 'Preguntado, sin contestar' : d.estado === 'no_procede' ? 'No procede' : 'Respondido')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
