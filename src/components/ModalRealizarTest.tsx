'use client'
import { Ic } from '@/lib/icons'
import { resultadoDeItems, mide, unidadDe, valorDe } from '@/lib/tests'

/**
 * Pasar un test, con el mismo aspecto que su ficha de la biblioteca.
 *
 * Antes esto era un acordeón dentro del paso 4 de la valoración: el test se desplegaba
 * bajo su fila, con la letra a 9-11 px y los ítems en cajas de 8 px de alto. Con el
 * paciente en la camilla y la tablet en la mano, era ilegible.
 *
 * La ficha de la biblioteca ya enseñaba bien un test —imagen grande, descripción,
 * ítems—, pero solo dejaba mirarlo. Aquí es la misma ficha con los ítems convertidos en
 * casillas: a la izquierda QUÉ es el test, a la derecha QUÉ salió.
 *
 * No guarda nada. Devuelve el estado por `onCambiar` y decide quien lo abre: la
 * valoración lo acumula hasta el final y la ficha lo registra en el momento. Que el
 * formulario guardara por su cuenta sería un segundo camino de escritura, y ya sabemos
 * cómo acaba eso.
 */

const NOMBRE_LADO: Record<string, string> = { bilateral: 'Bilateral', izquierdo: 'Izquierdo', derecho: 'Derecho' }
const LADOS_BILATERAL = [['bilateral', 'Bilateral']] as const
const LADOS_LATERAL = [['izquierdo', 'Izquierdo'], ['derecho', 'Derecho']] as const

/** El estado de un test que se está pasando: qué lado se mira y qué hay en cada uno. */
export type TestEnCurso = {
  ladoActivo?: string
  frecuencia_meses?: number
  lados?: Record<string, any>
  [k: string]: any
}

export function ladoVacio(test: any, meses?: number) {
  const rev = new Date(); rev.setMonth(rev.getMonth() + (meses ?? test?.frecuencia_meses ?? 3))
  return {
    items_resultado: (test?.items || []).map((it: any) => ({ ...it, marcado: false, valor: '' })),
    resultado: 'sin_realizar', observaciones: '',
    fecha_repeticion: rev.toISOString().split('T')[0],
  }
}

export default function ModalRealizarTest({ test, tv, onCambiar, onCerrar, pie }: {
  /** La fila de la biblioteca: imagen, descripción, ítems, lógica. */
  test: any
  tv: TestEnCurso
  onCambiar: (tv: TestEnCurso) => void
  onCerrar: () => void
  /** Botonera propia de quien lo abre. Sin ella solo hay "Hecho". */
  pie?: React.ReactNode
}) {
  const ladoActivo = tv.ladoActivo || (test?.tipo_lado === 'lateral' ? 'izquierdo' : 'bilateral')
  const d = tv.lados?.[ladoActivo] || ladoVacio(test, tv.frecuencia_meses)
  const lados = test?.tipo_lado === 'lateral' ? LADOS_LATERAL : LADOS_BILATERAL
  const items = (test?.items || [])

  function cambiarLado(k: string) {
    onCambiar({ ...tv, ladoActivo: k, lados: { ...(tv.lados || {}), [k]: tv.lados?.[k] || ladoVacio(test, tv.frecuencia_meses) } })
  }

  function actualizar(cambios: any) {
    onCambiar({ ...tv, lados: { ...(tv.lados || {}), [ladoActivo]: { ...d, ...cambios } } })
  }

  // Los ítems del lado, cayendo en la definición vigente del test si aún no se ha tocado.
  const base = d.items_resultado?.length ? d.items_resultado : items.map((it: any) => ({ ...it, marcado: false, valor: '' }))

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div style={{ background: 'var(--w)', borderRadius: 'var(--rl)', width: '94vw', maxWidth: 900, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 32px rgba(38,40,37,.15)', overflow: 'hidden' }}>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--bl)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 400, color: 'var(--n)' }}>{test?.nombre || tv.nombre}</div>
          <button onClick={onCerrar} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--bd)', background: 'var(--w)', cursor: 'pointer', fontSize: 14, color: 'var(--gr)' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

            {/* QUÉ ES EL TEST · igual que en la biblioteca */}
            <div>
              {test?.imagen_url
                ? <img src={test.imagen_url} alt={test.nombre} style={{ width: '100%', height: 240, objectFit: 'contain', background: 'var(--bm)', borderRadius: 8, border: '1px solid var(--bd)' }} />
                : <div style={{ width: '100%', height: 240, background: 'var(--bm)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grl)' }}><Ic name="test" size={48} /></div>}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', margin: '10px 0' }}>
                {test?.frecuencia_meses ? <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: 'var(--bm)', color: 'var(--gr)' }}>Revisión cada {test.frecuencia_meses} meses</span> : null}
                <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: 'var(--bm)', color: 'var(--gr)' }}>{test?.tipo_lado === 'lateral' ? 'Izq / Der' : 'Bilateral'}</span>
                {test?.video_url && <a href={test.video_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, padding: '3px 9px', borderRadius: 99, background: 'var(--gl)', color: 'var(--gd)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ic name="play" size={11} /> Vídeo</a>}
              </div>
              {test?.descripcion && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--grl)', letterSpacing: .4, textTransform: 'uppercase', marginBottom: 5 }}>Cómo se hace</div>
                  <div style={{ fontSize: 13, color: 'var(--n)', fontWeight: 300, lineHeight: 1.65 }}>{test.descripcion}</div>
                </div>
              )}
            </div>

            {/* QUÉ SALIÓ */}
            <div>
              {/* PESTAÑAS DE LADO */}
              <div style={{ display: 'flex', gap: 3, background: 'var(--bl)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)', padding: 3, marginBottom: 12, width: 'fit-content' }}>
                {lados.map(([k, l]) => {
                  const tiene = tv.lados?.[k] && tv.lados[k].resultado !== 'sin_realizar'
                  return (
                    <button key={k} onClick={() => cambiarLado(k)}
                      style={{ fontSize: 12, padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: ladoActivo === k ? 'var(--w)' : 'transparent', color: ladoActivo === k ? 'var(--n)' : 'var(--grl)', fontWeight: ladoActivo === k ? 500 : 300, boxShadow: ladoActivo === k ? '0 1px 3px rgba(0,0,0,.08)' : 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {l}{tiene && <span style={{ width: 7, height: 7, borderRadius: '50%', background: tv.lados![k].resultado === 'positivo' ? 'var(--red)' : 'var(--g)' }} />}
                    </button>
                  )
                })}
              </div>

              {items.length > 0 ? (
                <>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--grl)', letterSpacing: .4, textTransform: 'uppercase', marginBottom: 6 }}>
                    Ítems · {test?.logica === 'todos' ? 'todos marcados = positivo' : 'con uno basta = positivo'}
                  </div>
                  {base.map((item: any, ii: number) => (
                    <label key={ii} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', background: item.marcado ? 'var(--redl)' : 'var(--w)', borderRadius: 7, border: `1px solid ${item.marcado ? '#F5C8C8' : 'var(--bd)'}`, marginBottom: 5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!item.marcado} onChange={e => {
                        const its = [...base]; its[ii] = { ...its[ii], marcado: e.target.checked }
                        actualizar({ items_resultado: its, resultado: resultadoDeItems(its, test?.logica) })
                      }} style={{ width: 19, height: 19, accentColor: 'var(--red)', cursor: 'pointer', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--n)', fontWeight: item.marcado ? 400 : 300 }}>{item.nombre}</span>
                      {mide(item) && item.marcado && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }} onClick={e => e.preventDefault()}>
                          <input type="number" value={valorDe(item)} onChange={e => {
                            const its = [...base]; its[ii] = { ...its[ii], valor: e.target.value }
                            actualizar({ items_resultado: its })
                          }} style={{ width: 62, fontSize: 13, padding: '5px 6px', border: '1px solid var(--red)', borderRadius: 5, background: 'var(--redl)', textAlign: 'center', fontFamily: 'inherit' }} placeholder="0" />
                          <span style={{ fontSize: 12, color: 'var(--red)' }}>{unidadDe(item).simbolo.trim()}</span>
                        </span>
                      )}
                    </label>
                  ))}

                  <div style={{ padding: '9px 12px', borderRadius: 7, background: d.resultado === 'positivo' ? 'var(--redl)' : d.resultado === 'negativo' ? 'var(--gl)' : 'var(--bl)', border: `1px solid ${d.resultado === 'positivo' ? 'var(--red)' : d.resultado === 'negativo' ? 'var(--gm)' : 'var(--bd)'}`, fontSize: 12, fontWeight: 500, color: d.resultado === 'positivo' ? 'var(--red)' : d.resultado === 'negativo' ? 'var(--gd)' : 'var(--grl)', marginTop: 8 }}>
                    {d.resultado === 'positivo' ? '+ Positivo' : d.resultado === 'negativo' ? '− Negativo' : 'Marca los ítems observados'}
                    {d.resultado !== 'sin_realizar' && ' · calculado automáticamente'}
                  </div>

                  {/* "No se lo hice" y "se lo hice y salió limpio" no son lo mismo: lo
                      segundo hay que decirlo a propósito. */}
                  {base.filter((it: any) => it.marcado).length === 0 && (
                    <div onClick={() => actualizar({ resultado: d.resultado === 'negativo' ? 'sin_realizar' : 'negativo' })}
                      style={{ marginTop: 6, padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${d.resultado === 'negativo' ? 'var(--g)' : 'var(--bd)'}`, background: d.resultado === 'negativo' ? 'var(--gl)' : 'var(--w)', cursor: 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 500, color: d.resultado === 'negativo' ? 'var(--gd)' : 'var(--grl)' }}>
                      {d.resultado === 'negativo' ? '✓ Marcado como negativo' : 'Sin hallazgos · marcar como − Negativo'}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {(['positivo', 'negativo'] as const).map(v => (
                    <div key={v} onClick={() => actualizar({ resultado: d.resultado === v ? 'sin_realizar' : v })}
                      style={{ flex: 1, padding: '13px', borderRadius: 'var(--rl)', border: `2px solid ${d.resultado === v ? (v === 'positivo' ? 'var(--red)' : 'var(--g)') : 'var(--bd)'}`, background: d.resultado === v ? (v === 'positivo' ? 'var(--redl)' : 'var(--gl)') : 'var(--w)', cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: d.resultado === v ? (v === 'positivo' ? 'var(--red)' : 'var(--gd)') : 'var(--grl)' }}>{v === 'positivo' ? '+ Positivo' : '− Negativo'}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="field" style={{ marginTop: 12 }}>
                <label>Observaciones · {NOMBRE_LADO[ladoActivo] || ladoActivo}</label>
                <textarea className="input" value={d.observaciones || ''} onChange={e => actualizar({ observaciones: e.target.value })} style={{ minHeight: 58, fontSize: 13 }} placeholder="Qué se ha visto, con qué carga, qué le dolía..." />
              </div>
              <div className="field">
                <label>Fecha de revisión</label>
                <input type="date" className="input" value={d.fecha_repeticion || ''} onChange={e => actualizar({ fecha_repeticion: e.target.value })} min={new Date().toISOString().split('T')[0]} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--bd)', flexShrink: 0 }}>
          {pie || <button className="btn btn-p" onClick={onCerrar}>Hecho</button>}
        </div>
      </div>
    </div>
  )
}
