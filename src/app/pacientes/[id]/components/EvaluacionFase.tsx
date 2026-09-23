'use client'
import { useEffect, useState } from 'react'
import { Ic } from '@/lib/icons'
import { hoyISO } from '@/lib/fechas'
import { esCuestionario } from '@/lib/cuestionarios'
import { evaluacionDe, abrirEvaluacion, moverEvaluacion, borrarEvaluacion,
         resumenDeEvaluacion, type ObjetivoEnEvaluacion } from '@/lib/evaluaciones'

// ---------------------------------------------------------------------------
// LA EVALUACION DE UNA FASE
//
// No decide nada: dice que hay que pasarle y para cuando. El test se hace como
// siempre y cierra el objetivo como siempre; cuando estan todos, la fase avanza
// sola porque el sistema mira los objetivos logrados, no esta lista.
//
// Por eso puede quedarse a medias sin problema: dos el jueves, tres el lunes.
// ---------------------------------------------------------------------------

export default function EvaluacionFase({ pacienteId, asignacion, fase, color, onCambio }: {
  pacienteId: string
  asignacion: any
  fase: any
  color: string
  /** Solo al abrir, mover o quitar: la planificación marca el día. No al cargar,
   *  que volvería a montar esto y se quedaría dando vueltas. */
  onCambio?: () => void
}) {
  const [ev, setEv] = useState<any>(null)
  const [lista, setLista] = useState<ObjetivoEnEvaluacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => { cargar() }, [asignacion?.id, fase?.id])

  async function cargar() {
    setCargando(true)
    const e = await evaluacionDe(asignacion.id, fase.id)
    setEv(e)
    // TODOS los objetivos de la fase, no solo los que el paciente lleva: que no
    // lleve uno es justo uno de los motivos por los que la fase no cierra, y
    // filtrarlo lo dejaba invisible.
    if (e) setLista(await resumenDeEvaluacion(e.id, pacienteId, fase.objetivos || []))
    else setLista([])
    setCargando(false)
  }

  async function abrir() {
    const r = await abrirEvaluacion({ pacienteId, asignacionId: asignacion.id, faseId: fase.id })
    if (r.ok === false) { alert(r.error); return }
    setAbierto(true); cargar(); onCambio?.()
  }

  async function quitar() {
    if (confirm('¿Quitar la evaluación de esta fase? Los tests ya pasados se quedan.') === false) return
    await borrarEvaluacion(ev.id); cargar(); onCambio?.()
  }

  const nObj = (fase?.objetivos || []).length
  if (nObj === 0) return null

  // Se cuenta en OBJETIVOS y no en tests: la fase no se cierra pasando tests,
  // se cierra cuando sus objetivos estan logrados.
  const hechos = lista.filter(o => o.logrado).length
  const total = lista.length
  const completa = total > 0 && hechos === total

  return (
    <div style={{ border: '1px solid var(--bd)', borderLeft: `3px solid ${color}`, borderRadius: 7,
      padding: '8px 11px', marginTop: 8, background: 'var(--w)' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--gr)', letterSpacing: '.5px',
          textTransform: 'uppercase' }}>Evaluación</span>
        <span style={{ fontSize: 12, color: 'var(--n)' }}>{fase.nombre}</span>

        {cargando ? <span style={{ fontSize: 11, color: 'var(--grl)' }}>…</span>
          : ev == null ? (
            <>
              <span style={{ flex: 1, fontSize: 11, color: 'var(--grl)' }}>Sin programar</span>
              <button className="btn btn-s btn-sm" onClick={abrir}>Evaluar esta fase</button>
            </>
          ) : (
            <>
              <span className={`pill ${completa ? 'pill-o on' : 'pill-soft'}`}
                title="Objetivos logrados de los que tiene la fase">
                {hechos} de {total}
              </span>
              <input className="input" type="date" style={{ width: 145, padding: '4px 8px', fontSize: 12 }}
                value={ev.fecha || hoyISO()}
                onChange={e => { setEv({ ...ev, fecha: e.target.value }); moverEvaluacion(ev.id, { fecha: e.target.value }).then(() => onCambio?.()) }}/>
              <div style={{ flex: 1 }}/>
              <button className="pill pill-soft" style={{ border: 'none', cursor: 'pointer' }}
                onClick={() => setAbierto(v => v === false)}>
                {abierto ? 'ocultar' : 'ver qué falta'}
              </button>
              <button className="btn btn-s btn-sm" title="Quitar" onClick={quitar}>✕</button>
            </>
          )}
      </div>

      {ev && abierto && (
        <div style={{ marginTop: 9 }}>
          {total === 0 && (
            <div style={{ fontSize: 11, color: 'var(--gr)' }}>
              Esta fase no tiene objetivos: salen de las sesiones que lleva dentro.
            </div>
          )}
          {/* POR OBJETIVO, con su moneda, y diciendo POR QUE sigue abierto. La lista de
              tests no lo contestaba: los tres motivos por los que un objetivo no cierra
              —falta pasar su test, el paciente no lo lleva, o no tiene con que medirse—
              se arreglan en sitios distintos. */}
          {lista.map(o => (
            <div key={o.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '9px 0', borderTop: '1px solid var(--bd2)' }}>

              {/* La misma moneda que en su ficha: es como se reconoce un objetivo. */}
              <span className="obj-moneda" style={{ marginTop: 1,
                background: o.imagen_url ? 'var(--bl)' : 'var(--gl)',
                borderColor: o.logrado ? 'var(--gm)' : 'var(--g)',
                opacity: o.logrado ? .55 : 1 }}>
                {o.imagen_url
                  ? <img src={o.imagen_url} alt=""/>
                  : <b style={{ color: 'var(--g)' }}>{(o.nombre || '?').trim().charAt(0).toUpperCase()}</b>}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12.5, color: o.logrado ? 'var(--grl)' : 'var(--n)' }}>
                    {o.nombre}
                  </span>
                  {o.logrado && <span style={{ fontSize: 11, color: 'var(--gd)' }}><Ic name="check" size={11}/></span>}
                </div>

                {o.logrado === false && (
                  <div style={{ fontSize: 11, marginTop: 2, lineHeight: 1.5,
                    color: o.lleva && o.tests.length > 0 ? 'var(--gr)' : '#8A6410' }}>
                    {o.motivo}
                  </div>
                )}

                {/* CON QUE SE COMPRUEBA, con la foto: es lo que hay que sacar y montar,
                    y se reconoce por la imagen antes que por el nombre. */}
                {o.tests.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    {o.tests.map(p => (
                      <div key={p.test.id} style={{ display: 'flex', gap: 7, alignItems: 'center',
                        border: '1px solid var(--bd)', borderRadius: 7, padding: '4px 9px 4px 4px',
                        background: p.hecho ? 'var(--gl)' : 'var(--w)', opacity: p.hecho ? .75 : 1 }}>
                        {p.test.imagen_url
                          ? <img src={p.test.imagen_url} alt="" style={{ width: 38, height: 30, objectFit: 'cover',
                              borderRadius: 5, background: 'var(--bm)', flexShrink: 0, display: 'block' }}/>
                          : <span style={{ width: 38, height: 30, borderRadius: 5, background: 'var(--bm)',
                              color: 'var(--grl)', fontSize: 14, flexShrink: 0, display: 'flex',
                              alignItems: 'center', justifyContent: 'center' }}>
                              {esCuestionario(p.test) ? '✎' : '◎'}
                            </span>}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, color: 'var(--n)', lineHeight: 1.3 }}>
                            {p.hecho && <span style={{ color: 'var(--gd)' }}>✓ </span>}{p.test.nombre}
                          </div>
                          {/* El item, si lo tiene: es lo unico que se mira de ese test. */}
                          {p.items.length > 0 && (
                            <div style={{ fontSize: 10.5, color: 'var(--gd)', lineHeight: 1.3 }}>
                              {p.items.join(' · ')}
                            </div>
                          )}
                          {p.hecho && p.fecha && (
                            <div style={{ fontSize: 10, color: 'var(--grl)', lineHeight: 1.3 }}>
                              {new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {total > 0 && (
            <div style={{ fontSize: 10, color: 'var(--grl)', marginTop: 7, lineHeight: 1.6 }}>
              Se pasan donde siempre, desde su ficha. Al registrarlos se marcan aquí solos.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
