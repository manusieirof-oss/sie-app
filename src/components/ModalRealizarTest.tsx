'use client'
import { Ic } from '@/lib/icons'
import {
  resultadoDeTest, mide, unidadDe, valorDe, tieneBarra, evaluaItem, textoRegla, medicionesPendientes,
  esSuma, puntuacionDe, puntuacionesPendientes, bandaDe, rangoTotal,
} from '@/lib/tests'

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
  /**
   * En un test LATERAL no se elige lado por ti.
   *
   * Esto caía en 'izquierdo' cuando no había ninguno puesto, así que se podía rellenar y
   * guardar el test entero sin haber tocado nunca el selector: quedaba registrado como
   * izquierdo un lado que nadie decidió, y luego la meta salía del lado equivocado. Un
   * test de tobillo sin decir qué tobillo no es un dato incompleto, es un dato falso.
   *
   * Bilateral sí se resuelve solo: ahí no hay nada que elegir.
   */
  const ladoActivo = tv.ladoActivo || (test?.tipo_lado === 'lateral' ? '' : 'bilateral')
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

  // Barras sin valor. El veredicto se sigue calculando igual, pero deja de anunciarse como
  // si estuviera el test entero mirado.
  const pendientes = medicionesPendientes(base)

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

              {!ladoActivo ? (
                <div className="fila-p" style={{ borderLeftColor: '#E0C068' }}>
                  <span style={{ fontSize: 13, color: 'var(--gr)' }}>
                    Elige arriba <b>qué lado</b> estás midiendo. Este test se registra por separado
                    en cada uno, y sin decirlo el resultado no significa nada.
                  </span>
                </div>
              ) : esSuma(test) ? (
                /* TEST DE PUNTUACIÓN.
                   Aquí no se marca nada: cada ítem aporta su número y el veredicto sale
                   del total. Va en su propia rama y no dentro de la de siempre porque lo
                   que hay que ver es distinto —el total mandando, arriba y grande— y
                   porque las casillas y el atajo de "sin hallazgos" no pintan nada. */
                (() => {
                  const total = puntuacionDe(base)
                  const banda = bandaDe(test, total)
                  const faltan = puntuacionesPendientes(base)
                  const rango = rangoTotal(base)
                  const ponValor = (ii: number, x: string) => {
                    const its = [...base]; its[ii] = { ...its[ii], valor: x }
                    actualizar({ items_resultado: its, resultado: resultadoDeTest(test, its) })
                  }
                  return (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--grl)', letterSpacing: .4, textTransform: 'uppercase', marginBottom: 6 }}>
                        Puntuación · {base.length} ítem{base.length === 1 ? '' : 's'}
                      </div>

                      {base.map((item: any, ii: number) => {
                        const min = Number(item.min ?? 0), max = Number(item.max ?? 10)
                        const v = valorDe(item)
                        const puesto = v !== ''
                        /* Escalas cortas —el FPI-6 va de -2 a +2— con botones y no con una
                           barra: con la tablet en la mano, acertar un -1 exacto arrastrando
                           el dedo es más difícil que pulsarlo, y aquí no hay valores
                           intermedios que buscar. */
                        const pocos = isFinite(min) && isFinite(max) && (max - min) <= 10
                        return (
                          <div key={ii} style={{ padding: '10px 12px', background: puesto ? 'var(--gl)' : 'var(--w)', borderRadius: 7, border: `1px solid ${puesto ? 'var(--gm)' : 'var(--bd)'}`, marginBottom: 5 }}>
                            <div style={{ fontSize: 13, color: 'var(--n)', fontWeight: puesto ? 400 : 300, marginBottom: 7 }}>{item.nombre}</div>
                            {pocos ? (
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                {Array.from({ length: max - min + 1 }, (_, k) => min + k).map(o => (
                                  <button key={o} onClick={() => ponValor(ii, String(o))}
                                    style={{ minWidth: 42, padding: '7px 0', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                                      border: `1.5px solid ${String(o) === v ? 'var(--g)' : 'var(--bd)'}`,
                                      background: String(o) === v ? 'var(--g)' : 'var(--w)',
                                      color: String(o) === v ? '#fff' : 'var(--gr)' }}>
                                    {o > 0 ? '+' + o : String(o)}
                                  </button>
                                ))}
                                {puesto && (
                                  <button onClick={() => ponValor(ii, '')}
                                    style={{ fontSize: 10, color: 'var(--grl)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }}>
                                    Borrar
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="range" min={min} max={max} step={1}
                                  value={v === '' ? String((min + max) / 2) : v}
                                  onChange={e => ponValor(ii, e.target.value)}
                                  style={{ flex: 1, accentColor: 'var(--g)', cursor: 'pointer' }} />
                                <input type="number" value={v} onChange={e => ponValor(ii, e.target.value)} placeholder="—"
                                  style={{ width: 72, fontSize: 13, padding: '5px 7px', border: '1px solid var(--bd)', borderRadius: 5, textAlign: 'center', fontFamily: 'inherit' }} />
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* EL TOTAL, QUE ES EL RESULTADO. Sin banda no hay veredicto: un
                          total que no cae en ninguna es un test mal configurado, y decir
                          "negativo" ahí sería inventárselo. */}
                      <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 8,
                        border: `1.5px solid ${!banda ? 'var(--bd)' : banda.hallazgo ? 'var(--red)' : 'var(--gm)'}`,
                        background: !banda ? 'var(--bl)' : banda.hallazgo ? 'var(--redl)' : 'var(--gl)' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--grl)', letterSpacing: .4, textTransform: 'uppercase' }}>Total</span>
                          <span style={{ fontSize: 28, fontWeight: 300, color: total === null ? 'var(--grl)' : !banda ? 'var(--n)' : banda.hallazgo ? 'var(--red)' : 'var(--gd)' }}>
                            {total === null ? '—' : total}
                          </span>
                          {rango && <span style={{ fontSize: 11, color: 'var(--grl)' }}>de {rango.min} a {rango.max}</span>}
                        </div>
                        <div style={{ fontSize: 13, marginTop: 3, color: !banda ? 'var(--grl)' : banda.hallazgo ? 'var(--red)' : 'var(--gd)' }}>
                          {faltan.length > 0
                            ? `Falta puntuar ${faltan.length} ítem${faltan.length === 1 ? '' : 's'}: ${faltan.join(', ')}`
                            : banda
                              ? `${banda.etiqueta} · ${banda.hallazgo ? '+ Positivo' : '− Negativo'}`
                              : `El total ${total} no cae en ninguna banda del test. Revísalas en la biblioteca: así no se puede registrar.`}
                        </div>
                      </div>
                    </>
                  )
                })()
              ) : items.length > 0 ? (
                <>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--grl)', letterSpacing: .4, textTransform: 'uppercase', marginBottom: 6 }}>
                    Ítems · {test?.logica === 'todos' ? 'todos marcados = positivo' : 'con uno basta = positivo'}
                  </div>
                  {base.map((item: any, ii: number) => {
                    /* ÍTEM CON BARRA: no se marca, se mide. El veredicto sale del número,
                       así que la casilla sobra y encima invitaba a contradecirlo. */
                    if (tieneBarra(item)) {
                      const hallazgo = evaluaItem(item)
                      const min = Number(item.min ?? 0), max = Number(item.max ?? 100)
                      const v = valorDe(item)
                      const col = hallazgo === true ? 'var(--red)' : hallazgo === false ? 'var(--g)' : 'var(--bd)'
                      const ponValor = (x: string) => {
                        const its = [...base]; its[ii] = { ...its[ii], valor: x }
                        actualizar({ items_resultado: its, resultado: resultadoDeTest(test, its) })
                      }
                      return (
                        <div key={ii} style={{ padding: '12px 13px', background: hallazgo === true ? 'var(--redl)' : hallazgo === false ? 'var(--gl)' : 'var(--w)', borderRadius: 7, border: `1px solid ${col}`, marginBottom: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 9 }}>
                            <span style={{ flex: 1, fontSize: 13, color: 'var(--n)' }}>{item.nombre}</span>
                            <span style={{ fontSize: 20, fontWeight: 300, color: v === '' ? 'var(--grl)' : col }}>
                              {v === '' ? '—' : v}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--grl)' }}>{unidadDe(item).simbolo.trim()}</span>
                          </div>
                          <input type="range" min={min} max={max} step={item.paso ?? 1}
                            value={v === '' ? String((min + max) / 2) : v}
                            onChange={e => ponValor(e.target.value)}
                            style={{ width: '100%', accentColor: hallazgo === true ? 'var(--red)' : 'var(--g)', cursor: 'pointer' }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: 10, color: 'var(--grl)' }}>{min}</span>
                            <span style={{ flex: 1, textAlign: 'center', fontSize: 10, color: hallazgo === true ? 'var(--red)' : 'var(--grl)' }}>
                              {textoRegla(item)}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--grl)' }}>{max}</span>
                          </div>
                          {/* Se puede teclear: con la tablet en la mano la barra es cómoda,
                              pero un 10,5 exacto con el dedo no se acierta. */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                            <input type="number" value={v} onChange={e => ponValor(e.target.value)}
                              placeholder="Escribir"
                              style={{ width: 90, fontSize: 12, padding: '5px 7px', border: '1px solid var(--bd)', borderRadius: 5, textAlign: 'center', fontFamily: 'inherit' }} />
                            {v !== '' && (
                              <button onClick={() => ponValor('')}
                                style={{ fontSize: 10, color: 'var(--grl)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                Borrar
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    }
                    return (
                    <label key={ii} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', background: item.marcado ? 'var(--redl)' : 'var(--w)', borderRadius: 7, border: `1px solid ${item.marcado ? '#F5C8C8' : 'var(--bd)'}`, marginBottom: 5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!item.marcado} onChange={e => {
                        const its = [...base]; its[ii] = { ...its[ii], marcado: e.target.checked }
                        actualizar({ items_resultado: its, resultado: resultadoDeTest(test, its) })
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
                    )
                  })}

                  <div style={{ padding: '9px 12px', borderRadius: 7, background: d.resultado === 'positivo' ? 'var(--redl)' : d.resultado === 'negativo' ? 'var(--gl)' : 'var(--bl)', border: `1px solid ${d.resultado === 'positivo' ? 'var(--red)' : d.resultado === 'negativo' ? 'var(--gm)' : 'var(--bd)'}`, fontSize: 12, fontWeight: 500, color: d.resultado === 'positivo' ? 'var(--red)' : d.resultado === 'negativo' ? 'var(--gd)' : 'var(--grl)', marginTop: 8 }}>
                    {d.resultado === 'positivo' ? '+ Positivo' : d.resultado === 'negativo' ? '− Negativo' : 'Marca los ítems observados'}
                    {d.resultado !== 'sin_realizar' && (pendientes.length > 0 ? ' · con mediciones sin hacer' : ' · calculado automáticamente')}
                  </div>

                  {/* UNA BARRA SIN VALOR NO ES UN CERO.
                      `resultadoDeItems` la cuenta como no marcada, así que un test de tres
                      mediciones con una sola hecha decía "− Negativo · calculado
                      automáticamente" habiendo mirado un tercio. El aviso va aquí, que es
                      donde se decide dar el test por bueno. */}
                  {pendientes.length > 0 && d.resultado !== 'sin_realizar' && (
                    <div className="fila-p" style={{ borderLeftColor: '#E0C068', marginTop: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--gr)' }}>
                        Falta medir <b>{pendientes.join(', ')}</b>. El resultado de arriba solo
                        tiene en cuenta lo que sí has medido.
                      </span>
                    </div>
                  )}

                  {/* "No se lo hice" y "se lo hice y salió limpio" no son lo mismo: lo
                      segundo hay que decirlo a propósito. */}
                  {base.filter((it: any) => it.marcado).length === 0 && !base.some((it: any) => tieneBarra(it)) && (
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
