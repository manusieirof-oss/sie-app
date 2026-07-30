'use client'
import { Ic } from '@/lib/icons'
import { modoParte, TIPOS_TIEMPO, textoModo } from '@/lib/sesiones'
import { textoDescanso } from '@/lib/capacidades'

/**
 * Cómo se mide el ejercicio. Aquí solo se puede mirar lo guardado en la sesión: el
 * detalle no tiene la biblioteca a mano. Sin dato se enseñan reps y peso, que es lo
 * habitual, y el que vaya por tiempo lo delata su propio campo.
 */
function medidaEj(ej: any): string {
  if (ej?.tipo_medida) return ej.tipo_medida
  if (ej?.tiempo && !ej?.reps) return 'tiempo'
  return 'peso_reps'
}

// Vista de una sesión. Antes había dos modales distintos para lo mismo:
// desde Sesiones se veía con imágenes, series, pesos y notas; desde Historial,
// solo una lista de nombres. Ahora es el mismo, y lo único que cambia son las
// acciones: en Historial estás consultando el pasado, no editándolo.
export default function DetalleSesion({ sesion, objetivos = [], onCerrar, onEditar, onDuplicar, onEliminar, onAsignar, nCitas, ejecutado }: {
  sesion: any
  objetivos?: any[]
  onCerrar: () => void
  onEditar?: () => void
  onDuplicar?: () => void
  onEliminar?: () => void
  /** Asignar esta sesión a citas. Solo desde la ficha: el historial no se reprograma. */
  onAsignar?: () => void
  /** Citas futuras que ya la tienen, para decirlo antes de abrir el selector. */
  nCitas?: number
  /**
   * Lo que de verdad se registró ese día, de `registros_ejercicio`.
   *
   * Sin esto el historial enseña el PLAN y no el resultado: abrías una cita de hace
   * un mes y veías lo que prescribiste, no lo que hizo. La diferencia entre las dos
   * cosas es justo el dato por el que decidimos que el taller no edita la sesión.
   */
  ejecutado?: any[]
}) {
  // Series reales de un ejercicio: "40×10, 40×10, 35×8" o "45 s, 40 s".
  function hizo(ejercicioId?: string) {
    if (!ejecutado || !ejercicioId) return null
    const reg = ejecutado.find((r: any) => r.ejercicio_id === ejercicioId)
    const series = Array.isArray(reg?.series) ? reg.series : []
    if (series.length === 0) return reg?.comentario ? { texto: '', comentario: reg.comentario } : null
    const texto = series.map((s: any) => {
      if (s.segundos !== '' && s.segundos != null) return `${s.segundos} s`
      if (s.peso !== '' && s.peso != null && s.reps !== '' && s.reps != null) return `${s.peso}×${s.reps}`
      if (s.reps !== '' && s.reps != null) return `${s.reps} reps`
      return null
    }).filter(Boolean).join(', ')
    return { texto, comentario: reg?.comentario || '' }
  }
  const hayAcciones = !!(onEditar || onDuplicar || onEliminar || onAsignar)

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      {/* Más ancho que antes: la rejilla de seis columnas no cabía en 720. */}
      <div style={{ background: 'var(--w)', borderRadius: 'var(--rl)', width: '92vw', maxWidth: 900, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--sh-md)', overflow: 'hidden' }}>

        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd)', background: 'var(--bl)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: 'var(--n)' }}>{sesion.nombre}</div>
            {sesion.descripcion && <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 2 }}>{sesion.descripcion}</div>}
            {objetivos.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
                {objetivos.map((o: any) => (
                  <span key={o.id} style={{ fontSize: 12, padding: '2px 9px', borderRadius: 99, background: o.color || 'var(--g)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Ic name="objetivo" size={11} /> {o.nombre}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button className="modal-close" onClick={onCerrar} aria-label="Cerrar"><Ic name="cerrar" size={16} /></button>
        </div>

        {hayAcciones && (
          <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {onAsignar && (
              <button className="btn btn-p btn-sm" onClick={onAsignar}>
                <Ic name="calendario" size={12} /> Asignar a citas
              </button>
            )}
            {onEditar && <button className="btn btn-s btn-sm" onClick={onEditar}><Ic name="editar" size={12} /> Editar</button>}
            {onDuplicar && <button className="btn btn-t btn-sm" onClick={onDuplicar}><Ic name="copiar" size={12} /> Duplicar</button>}
            {typeof nCitas === 'number' && (
              <span style={{ fontSize: 12, color: 'var(--gr)' }}>
                {nCitas === 0 ? 'Sin citas asignadas' : `En ${nCitas} cita${nCitas > 1 ? 's' : ''} por delante`}
              </span>
            )}
            <div style={{ flex: 1 }} />
            {onEliminar && <button className="btn btn-d btn-sm" onClick={onEliminar}><Ic name="papelera" size={12} /> Eliminar</button>}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {(sesion.partes || []).length === 0 && <div className="muted">Esta sesión no tiene ejercicios.</div>}
          {(sesion.partes || []).map((parte: any, pi: number) => (
            <div key={pi} style={{ marginBottom: 12, background: 'var(--bl)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--bd)' }}>
              <div style={{ padding: '8px 13px', borderBottom: '1px solid var(--bm)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--n)', flex: 1 }}>
                  {parte.nombre || `Parte ${pi + 1}`}
                </span>
                {/* Cómo se recorre el bloque. Sin esto solo se veía dentro del editor. */}
                <span className="pill pill-o on" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Ic name={modoParte(parte.modo).icono} size={11} /> {textoModo(parte)}
                </span>
              </div>
              {(parte.ejercicios || []).length === 0
                ? <div style={{ padding: '8px 13px', fontSize: 12, color: 'var(--gr)' }}>Sin ejercicios</div>
                : (
                  /* Misma rejilla que el editor pero de solo lectura: editabas en
                     columnas y consultabas en una sopa de píldoras todas del mismo
                     peso. Aquí se mira con el paciente delante, así que manda que se
                     lea rápido y de lejos. */
                  <div className="tabla-ej det" style={{ padding: '4px 13px 10px' }}>
                    <div className="ej-cab">
                      <span>Ejercicio</span>
                      <span>Cómo se hace</span>
                      <span className="c">Series</span>
                      <span className="c">{parte.ejercicios.some((e: any) => medidaEj(e) === 'tiempo') ? 'Reps · s' : 'Reps'}</span>
                      <span className="c">Peso</span>
                      <span className="c">Descanso</span>
                    </div>
                    {(parte.ejercicios || []).map((ej: any, ei: number) => {
                      const nombre = typeof ej === 'string' ? ej : (ej.nombre || ej.ejercicio || '')
                      if (typeof ej === 'string') {
                        return <div key={ei} className="ej-row"><div className="ej-nom"><span className="ej-txt">{nombre}</span></div></div>
                      }
                      const med = medidaEj(ej)
                      return (
                        <div key={ei} className="ej-row">
                          <div className="ej-nom">
                            {/* La letra solo significa algo si el bloque es superserie. */}
                            {parte.modo === 'superserie' && ej.grupo && <span className="grupo-ss">{ej.grupo}</span>}
                            {ej.imagen_url
                              ? <img src={ej.imagen_url} alt={nombre} className="ej-img" />
                              : <div className="ej-img ej-img-no"><Ic name="fuerza" size={24} /></div>}
                            <div style={{ minWidth: 0 }}>
                              <div className="ej-txt">{nombre}</div>
                              {ej.variante && (
                                <div className="ej-sub"><span className="badge badge-g">{ej.variante}</span></div>
                              )}
                            </div>
                          </div>

                          <div className="celda apilada" data-l="Cómo se hace">
                            <span className="chip-ed" style={{ cursor: 'default' }}>{ej.regimen || 'Concéntrico'}</span>
                            {ej.capacidad && <span className="chip-ed chip-ed-a" style={{ cursor: 'default' }}>{ej.capacidad}</span>}
                          </div>

                          <div className="celda" data-l="Series"><span className="val">{parte.modo === 'circuito' ? (parte.vueltas || '—') : (ej.series || '—')}</span></div>
                          <div className="celda" data-l={med === 'tiempo' ? 'Duración' : 'Repeticiones'}>
                            <span className="val">{med === 'tiempo' ? (ej.tiempo ? `${ej.tiempo} s` : '—') : (ej.reps || '—')}</span>
                          </div>
                          <div className="celda" data-l="Peso">
                            <span className="val">{med === 'tiempo' ? '—' : (ej.peso ? `${ej.peso} kg` : '—')}</span>
                          </div>
                          <div className="celda" data-l="Descanso">
                            <span className="val">{ej.descanso ? textoDescanso(ej.descanso) : '—'}</span>
                          </div>

                          {ej.nota && (
                            <div className="ej-nota">
                              <span style={{ color: '#7A5800', display: 'inline-flex' }}><Ic name="nota" size={12} /></span>
                              <span style={{ fontSize: 12, color: '#7A5800', fontStyle: 'italic' }}>{ej.nota}</span>
                            </div>
                          )}
                          {/* Lo prescrito arriba, lo ejecutado debajo y en verde. Se
                              ponen juntos a propósito: la comparación es el dato. */}
                          {(() => {
                            const h = hizo(ej.ejercicio_id)
                            if (!h) return null
                            return (
                              <div className="ej-nota hecho">
                                <span style={{ display: 'inline-flex' }}><Ic name="check" size={12} /></span>
                                <span>
                                  {h.texto || 'Registrado'}
                                  {h.comentario && <span style={{ fontStyle: 'italic', opacity: .85 }}> · {h.comentario}</span>}
                                </span>
                              </div>
                            )
                          })()}
                        </div>
                      )
                    })}
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
