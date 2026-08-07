'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { unidadDe, valorDe } from '@/lib/tests'
import { estadoDeMeta, cerrarMetaAMano, TIPOS_META, antagonistaDe, type Meta } from '@/lib/metas'

/**
 * Las metas medibles de un objetivo, dentro de la ficha del paciente.
 *
 * El objetivo dice QUÉ se trabaja —"Fuerza de hombro"— y la meta dice cuánto y de dónde
 * sale el número. Sin esto el objetivo no se puede cerrar y se queda abierto para siempre,
 * que es lo que pasaba antes.
 *
 * TODA META NACE ATADA A UN ÍTEM DE TEST. No se puede crear una meta sin decir qué
 * medición la evalúa: una meta que nadie mide es una intención con un número al lado, y
 * volveríamos a decidir a ojo. Por eso el selector de test es obligatorio y solo ofrece
 * ítems que tengan unidad.
 */

export default function MetasObjetivo({ pacienteId, objetivo, metas, resultados, tests, etiquetas, onCambio }: {
  pacienteId: string
  objetivo: any
  metas: Meta[]
  resultados: any[]
  tests: any[]
  etiquetas: any[]
  onCambio: () => void
}) {
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [f, setF] = useState<any>({ movimiento_id: '', lado: 'bilateral', tipo: 'mejorar', test_id: '', item_indice: '', item_par_indice: '', valor_inicial: '', meta_pct: '20', meta_valor: '', manual: false })

  const nombreEt = (id: string) => etiquetas.find((e: any) => e.id === id)?.nombre || ''
  const movimientos = (objetivo.movimientos || []).map((id: string) => ({ id, nombre: nombreEt(id) })).filter((m: any) => m.nombre)

  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

  /**
   * Qué test e ítem miden este movimiento, resuelto solo.
   *
   * Desde que los tests de medición espejan a los espacios métricos —"Fuerza de hombro"
   * tiene su "Hombro · fuerza" con los mismos movimientos como ítems— no hay nada que
   * elegir: el objetivo dice la zona y la métrica, el movimiento dice el ítem.
   *
   * Preguntarlo era pedirle al usuario que resolviera a mano una correspondencia que la
   * app conoce, y en una lista que además ofrecía tests de otras zonas.
   */
  const sugerida = useMemo(() => {
    const mov = f.movimiento_id ? nombreEt(f.movimiento_id) : ''
    if (!mov) return null
    const deLaZona = tests.filter((t: any) => (t.etiquetas_relacionadas || []).includes(objetivo.articulacion_id))
    const conMetrica = deLaZona.filter((t: any) => norm(t.nombre).includes(norm(objetivo.metrica || '')))
    for (const t of (conMetrica.length ? conMetrica : deLaZona)) {
      const i = (t.items || []).findIndex((it: any) => norm(it.nombre) === norm(mov))
      if (i >= 0) return { test_id: t.id, item_indice: i, nombre: t.nombre, item: t.items[i] }
    }
    return null
  }, [f.movimiento_id, tests, objetivo, etiquetas])

  // La sugerencia se aplica sola al cambiar de movimiento, salvo que se haya pedido
  // elegir a mano. Sin esto habría que confirmarla en cada meta.
  useEffect(() => {
    if (f.manual || !sugerida) return
    setF((p: any) => ({ ...p, test_id: sugerida.test_id, item_indice: String(sugerida.item_indice) }))
  }, [sugerida, f.manual])

  const testSel = tests.find((t: any) => t.id === f.test_id)
  /** Solo los ítems que se miden: una casilla de sí/no no puede cerrar un "+20%". */
  const itemsMedibles = ((testSel?.items || []) as any[])
    .map((it, i) => ({ ...it, i }))
    .filter(it => unidadDe(it).id !== '')

  const itemElegido = f.item_indice !== '' ? itemsMedibles.find(it => it.i === Number(f.item_indice)) : null
  const unidad = itemElegido ? unidadDe(itemElegido).id : ''

  /**
   * Lo último medido en ese ítem y lado, para proponerlo como punto de partida.
   *
   * Se propone, no se impone: puede que el valor de partida bueno sea el de la valoración
   * inicial y no el de ayer. Pero teclearlo a mano teniendo el dato delante es pedir una
   * errata.
   */
  const ultimoValor = useMemo(() => {
    if (!f.test_id || f.item_indice === '') return null
    const filas = resultados
      .filter(r => r.test_id === f.test_id && (r.lado || 'bilateral') === f.lado)
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
    const it = (filas[0]?.items_resultado || [])[Number(f.item_indice)]
    const v = it ? parseFloat(valorDe(it)) : NaN
    return Number.isFinite(v) ? v : null
  }, [f.test_id, f.item_indice, f.lado, resultados])

  /** El ítem del movimiento contrario, propuesto solo. Flexión busca extensión. */
  const parSugerido = useMemo(() => {
    if (f.tipo !== 'igualar_par' || !f.movimiento_id) return null
    const contrario = antagonistaDe(nombreEt(f.movimiento_id))
    if (!contrario) return null
    const n = contrario.toLowerCase()
    const it = itemsMedibles.find(x => (x.nombre || '').toLowerCase().includes(n))
    return it ? { indice: it.i, nombre: it.nombre, contrario } : { indice: null, nombre: null, contrario }
  }, [f.tipo, f.movimiento_id, itemsMedibles, etiquetas])

  function abrir() {
    setF({ movimiento_id: movimientos[0]?.id || '', lado: 'bilateral', tipo: 'mejorar', test_id: '', item_indice: '', item_par_indice: '', valor_inicial: '', meta_pct: '20', meta_valor: '', manual: false })
    setModal(true)
  }

  async function guardar() {
    if (!f.test_id || f.item_indice === '') { alert('Elige el test y el ítem que la miden'); return }
    if (f.tipo === 'igualar_par' && f.item_par_indice === '') { alert('Elige el ítem del movimiento contrario'); return }
    setGuardando(true)
    const { error } = await supabase.from('objetivos_metas').insert({
      paciente_id: pacienteId,
      objetivo_id: objetivo.id,
      movimiento_id: f.movimiento_id || null,
      lado: f.lado,
      tipo: f.tipo,
      unidad: unidad || null,
      valor_inicial: f.valor_inicial !== '' ? Number(f.valor_inicial) : (ultimoValor ?? null),
      meta_pct: f.tipo === 'mejorar' && f.meta_valor === '' && f.meta_pct !== '' ? Number(f.meta_pct) : null,
      meta_valor: f.tipo === 'mejorar' && f.meta_valor !== '' ? Number(f.meta_valor) : null,
      test_id: f.test_id,
      item_indice: Number(f.item_indice),
      item_par_indice: f.tipo === 'igualar_par' && f.item_par_indice !== '' ? Number(f.item_par_indice) : null,
    })
    setGuardando(false)
    if (error) { alert(error.message); return }
    setModal(false); onCambio()
  }

  async function borrar(m: Meta) {
    if (!confirm('¿Quitar esta meta?')) return
    await supabase.from('objetivos_metas').delete().eq('id', m.id)
    onCambio()
  }

  const LADOS = [['bilateral', 'Bilateral'], ['izquierdo', 'Izquierdo'], ['derecho', 'Derecho']] as const

  return (
    <div style={{ marginTop: 7 }}>
      {metas.length > 0 && (
        <div style={{ display: 'grid', gap: 3, marginBottom: 6 }}>
          {metas.map(m => {
            const e = estadoDeMeta(m, resultados)
            const cumplida = e.cumplida || m.cumplida
            const mov = m.movimiento_id ? nombreEt(m.movimiento_id) : ''
            const tipoNom = TIPOS_META.find(t => t.id === m.tipo)?.nombre || m.tipo
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: 'var(--bl)', borderRadius: 4 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                  <span style={{ color: 'var(--n)' }}>
                    {mov || 'Meta'}
                    {m.lado !== 'bilateral' && <span style={{ color: 'var(--gr)' }}> · {m.lado}</span>}
                  </span>
                  <span style={{ color: 'var(--grl)' }}> · {tipoNom.toLowerCase()}</span>
                  <span style={{ display: 'block', color: cumplida ? 'var(--gd)' : 'var(--gr)', marginTop: 1 }}>{e.texto}</span>
                </span>
                {/* La barra solo aparece si hay con qué calcularla. Una barra a cero cuando
                    aún no se ha medido nada dice algo falso. */}
                {e.progreso != null && !cumplida && (
                  <span style={{ width: 54, height: 5, background: 'var(--bm)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.round(e.progreso * 100)}%`, background: 'var(--g)' }} />
                  </span>
                )}
                <button className="et-b" title={cumplida ? 'Reabrir' : 'Dar por cumplida'} style={{ flexShrink: 0 }}
                  onClick={async () => { await cerrarMetaAMano(m.id, !cumplida); onCambio() }}>
                  <Ic name={cumplida ? 'check' : 'checkbox'} size={13} />
                </button>
                <button className="et-b et-b-r" title="Quitar" style={{ flexShrink: 0 }} onClick={() => borrar(m)}>
                  <Ic name="papelera" size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <button className="btn btn-t btn-sm" onClick={abrir}>
        <Ic name="mas" size={12} /> Añadir meta
      </button>

      {modal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget && !guardando) setModal(false) }}>
          <div className="modal">
            <div className="modal-title">
              Meta de {objetivo.nombre}
              <button className="modal-close" onClick={() => setModal(false)}><Ic name="cerrar" size={15} /></button>
            </div>

            {movimientos.length > 0 && (
              <div className="field"><label>Movimiento</label>
                <select className="input" value={f.movimiento_id}
                  onChange={e => setF((p: any) => ({ ...p, movimiento_id: e.target.value }))}>
                  {movimientos.map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>
            )}

            {/* En "igualar lados" el lado no significa nada: la comparación es simétrica,
                mide la diferencia entre los dos. Pedir un dato que no cambia el resultado
                hace pensar que sí lo cambia. */}
            {f.tipo !== 'igualar_lados' && (
              <div className="field"><label>Lado</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {LADOS.map(([v, l]) => (
                    <button key={v} className={`chip-sel ${f.lado === v ? 'on' : ''}`}
                      onClick={() => setF((p: any) => ({ ...p, lado: v }))}>{l}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="field"><label>Qué se busca</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {TIPOS_META.map(t => (
                  <button key={t.id} className={`chip-sel ${f.tipo === t.id ? 'on' : ''}`} title={t.ayuda}
                    onClick={() => setF((p: any) => ({ ...p, tipo: t.id }))}>{t.nombre}</button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 4 }}>
                {TIPOS_META.find(t => t.id === f.tipo)?.ayuda}
              </div>
            </div>

            {/* Obligatorio: una meta que nadie mide es una intención con un número.
                Pero ya no se pregunta si la app puede resolverlo sola. */}
            <div className="field"><label>Se mide con</label>
              {sugerida && !f.manual ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--gl)', borderRadius: 'var(--r)' }}>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--n)' }}>
                    {sugerida.nombre} <span style={{ color: 'var(--gr)' }}>›</span> {sugerida.item.nombre}
                    <span style={{ color: 'var(--gr)' }}> · {unidadDe(sugerida.item).nombre.toLowerCase()}</span>
                  </span>
                  <button className="btn btn-t btn-sm" onClick={() => setF((p: any) => ({ ...p, manual: true }))}>
                    Cambiar
                  </button>
                </div>
              ) : (
                <>
                  {!sugerida && f.movimiento_id && (
                    <div style={{ fontSize: 12, color: '#8A6410', marginBottom: 5 }}>
                      No hay ningún test de esta zona con un ítem que mida ese movimiento. Elígelo a mano
                      o crea la medición en Biblioteca → Tests.
                    </div>
                  )}
                  <select className="input" value={f.test_id}
                    onChange={e => setF((p: any) => ({ ...p, test_id: e.target.value, item_indice: '', item_par_indice: '' }))}>
                    <option value="">— Elige el test —</option>
                    {tests.filter((t: any) => (t.items || []).some((i: any) => unidadDe(i).id !== ''))
                      // Los de la zona del objetivo primero: ofrecer "Cadera · fuerza" para
                      // un hombro es ruido que además invita a equivocarse.
                      .sort((a: any, b: any) => {
                        const za = (a.etiquetas_relacionadas || []).includes(objetivo.articulacion_id) ? 0 : 1
                        const zb = (b.etiquetas_relacionadas || []).includes(objetivo.articulacion_id) ? 0 : 1
                        return za - zb || a.nombre.localeCompare(b.nombre)
                      })
                      .map((t: any) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                  {f.test_id && (
                    <select className="input" style={{ marginTop: 5 }} value={f.item_indice}
                      onChange={e => setF((p: any) => ({ ...p, item_indice: e.target.value }))}>
                      <option value="">— Qué ítem —</option>
                      {itemsMedibles.map(it => (
                        <option key={it.i} value={it.i}>{it.nombre} ({unidadDe(it).nombre.toLowerCase()})</option>
                      ))}
                    </select>
                  )}
                  {f.test_id && itemsMedibles.length === 0 && (
                    <div style={{ fontSize: 12, color: '#8A6410', marginTop: 4 }}>
                      Este test no tiene ningún ítem con unidad, así que no puede medir una meta.
                    </div>
                  )}
                </>
              )}
            </div>

            {f.tipo === 'igualar_par' && f.test_id && (
              <div className="field"><label>Ítem del movimiento contrario *</label>
                <select className="input" value={f.item_par_indice}
                  onChange={e => setF((p: any) => ({ ...p, item_par_indice: e.target.value }))}>
                  <option value="">— Elige —</option>
                  {itemsMedibles.filter(it => String(it.i) !== String(f.item_indice))
                    .map(it => <option key={it.i} value={it.i}>{it.nombre}</option>)}
                </select>
                {parSugerido && (
                  <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 4 }}>
                    El contrario de este movimiento es <b>{parSugerido.contrario}</b>
                    {parSugerido.nombre
                      ? <>. Parece que es «{parSugerido.nombre}».</>
                      : <>, pero no encuentro un ítem que lo mida en este test.</>}
                  </div>
                )}
              </div>
            )}

            {f.tipo === 'mejorar' && (
              <>
                <div className="field"><label>Punto de partida{unidad ? ` (${unidad})` : ''}</label>
                  <input className="input" type="number" value={f.valor_inicial}
                    onChange={e => setF((p: any) => ({ ...p, valor_inicial: e.target.value }))}
                    placeholder={ultimoValor != null ? String(ultimoValor) : 'Sin medición previa'} />
                  <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 3 }}>
                    {ultimoValor != null
                      ? <>Lo último medido es <b>{ultimoValor}{unidad ? ' ' + unidad : ''}</b>. Si lo dejas vacío se usa ese.</>
                      : 'Todavía no hay medición de este ítem. Sin punto de partida, un porcentaje no se puede calcular y la meta quedará esperando a la primera.'}
                  </div>
                </div>
                <div className="field"><label>Meta</label>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                    <input className="input" type="number" value={f.meta_pct} style={{ width: 90 }}
                      onChange={e => setF((p: any) => ({ ...p, meta_pct: e.target.value, meta_valor: '' }))} />
                    <span style={{ fontSize: 13, color: 'var(--gr)' }}>% de mejora</span>
                    <span style={{ fontSize: 13, color: 'var(--grl)' }}>o</span>
                    <input className="input" type="number" value={f.meta_valor} style={{ width: 90 }}
                      placeholder="valor" onChange={e => setF((p: any) => ({ ...p, meta_valor: e.target.value, meta_pct: '' }))} />
                    <span style={{ fontSize: 13, color: 'var(--gr)' }}>{unidad}</span>
                  </div>
                </div>
              </>
            )}

            {f.tipo !== 'mejorar' && (
              <div className="fila-p" style={{ borderLeftColor: 'var(--bd)' }}>
                <span style={{ fontSize: 13, color: 'var(--gr)' }}>
                  Compara las dos mediciones y se da por cumplida cuando la diferencia baja del 10%. No hace falta decir cuál es la más débil: eso lo dicen los números.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-t btn-sm" onClick={() => setModal(false)} disabled={guardando}>Cancelar</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-p" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Añadir meta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
