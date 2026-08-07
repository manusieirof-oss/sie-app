'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { ordenAnatomico } from '@/lib/anatomia'

/**
 * La biblioteca de objetivos.
 *
 * TRES FAMILIAS Y SOLO UNA LLEVA NÚMERO. Antes se pintaban todas iguales, así que un
 * objetivo métrico y uno de aprendizaje parecían lo mismo y nadie sabía cuál se podía
 * cerrar solo. Ahora la familia manda en la vista:
 *
 *   metrico      Fuerza o movilidad, con sus movimientos. Lo cierra una medición.
 *   fase         Progresión de una tanda a la siguiente. La avanza el entrenador.
 *   cualitativo  Se cumple o no.
 *
 * LA MÉTRICA NO LLEVA MOVIMIENTO NI LADO: son del paciente, no de la ficha. "Fuerza de
 * hombro" es el espacio; que a este paciente le toque rotación interna derecha al 20% se
 * decide al asignárselo. Es lo que evita las 160 fichas del programa anterior.
 */

const COLORES = ['#7C9A6B','#6B8F9A','#9A6B8F','#9A8F6B','#C17A54','#54A0A0','#A05454','#6B6B9A']

const FAMILIAS = [
  { id: 'metrico', nombre: 'Medibles', ayuda: 'Fuerza o movilidad. Los cierra una medición de un test.' },
  { id: 'fase', nombre: 'Por fases', ayuda: 'Progresan de una tanda del programa a la siguiente.' },
  { id: 'cualitativo', nombre: 'Cualitativos', ayuda: 'Se cumplen o no. Aprender algo, corregir un hábito.' },
] as const

export default function ObjetivosTab({ objetivos, testsLib, etiquetas = [], cargar }: any) {
  const [buscar, setBuscar] = useState('')
  const [familia, setFamilia] = useState<string>('')
  const [zona, setZona] = useState<string>('')
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState<any>({ id:'', nombre:'', descripcion:'', color:COLORES[0], test_id:'', tipo:'cualitativo', metrica:'', articulacion_id:'', fases:'', etiquetas:[] as string[] })
  const [enUso, setEnUso] = useState<Record<string, number>>({})

  // Cuántos pacientes tienen cada objetivo abierto. Es lo que dice si una ficha se usa o
  // sobra, y hasta ahora no se sabía: la biblioteca crecía sin que nadie la podase.
  useEffect(() => {
    supabase.from('pacientes_objetivos').select('objetivo_id,logrado').then(({ data }) => {
      const m: Record<string, number> = {}
      ;(data || []).forEach((p: any) => { if (!p.logrado) m[p.objetivo_id] = (m[p.objetivo_id] || 0) + 1 })
      setEnUso(m)
    })
  }, [objetivos])

  const nombreEt = (id: string) => etiquetas.find((e: any) => e.id === id)?.nombre || ''
  const nombreTest = (id: string) => (testsLib || []).find((t: any) => t.id === id)?.nombre || ''

  /** Las zonas que de verdad se usan, en orden de la cabeza a los pies. */
  const zonas = useMemo(() => {
    const ids = Array.from(new Set([
      ...(objetivos || []).map((o: any) => o.articulacion_id),
      ...(objetivos || []).flatMap((o: any) => o.etiquetas || []),
    ].filter(Boolean))) as string[]
    return ids.map(id => ({ id, nombre: nombreEt(id) }))
      .filter(z => z.nombre)
      .sort((a, b) => ordenAnatomico(a.nombre, b.nombre))
  }, [objetivos, etiquetas])

  const filtrados = (objetivos || []).filter((o: any) => {
    const q = buscar.toLowerCase()
    const matchQ = !q || o.nombre.toLowerCase().includes(q) || (o.descripcion || '').toLowerCase().includes(q)
    const matchF = !familia || (o.tipo || 'cualitativo') === familia
    // Por articulación O por etiqueta libre: buscar "Trocantéritis" tiene que encontrar
    // el objetivo de trocanteritis, que la lleva como patología y no como zona.
    const matchZ = !zona || o.articulacion_id === zona || (o.etiquetas || []).includes(zona)
    return matchQ && matchF && matchZ
  })

  const cuentaFamilia = (f: string) => (objetivos || []).filter((o: any) => (o.tipo || 'cualitativo') === f).length
  // Los sembrados con los tests se quedaron sin familia. Conviene verlos para repasarlos.
  const sinFamilia = (objetivos || []).filter((o: any) => !o.tipo).length

  function abrirNuevo() {
    setForm({ id:'', nombre:'', descripcion:'', color:COLORES[0], test_id:'', tipo:'cualitativo', metrica:'', articulacion_id:'', fases:'', etiquetas:[] })
    setModal(true)
  }
  function abrirEditar(o: any) {
    setForm({
      id:o.id, nombre:o.nombre||'', descripcion:o.descripcion||'', color:o.color||COLORES[0],
      test_id:o.test_id||'', tipo:o.tipo||'cualitativo', metrica:o.metrica||'',
      articulacion_id:o.articulacion_id||'', fases:o.fases||'', etiquetas:o.etiquetas||[],
    })
    setModal(true)
  }

  async function guardar() {
    if (!form.nombre) { alert('El nombre es obligatorio'); return }
    setGuardando(true)
    const payload: any = {
      nombre: form.nombre, descripcion: form.descripcion, color: form.color,
      test_id: form.test_id || null,
      tipo: form.tipo,
      // Cada familia guarda lo suyo y limpia lo de las otras: un objetivo que fue métrico
      // y pasa a cualitativo no puede quedarse con la métrica puesta.
      metrica: form.tipo === 'metrico' ? (form.metrica || null) : null,
      fases: form.tipo === 'fase' ? (parseInt(form.fases) || null) : null,
      articulacion_id: form.articulacion_id || null,
      // Solo en fases y cualitativos: los métricos ya se describen con su articulación y
      // sus movimientos, y repetirlo aquí serían dos verdades para lo mismo.
      etiquetas: form.tipo === 'metrico' ? [] : (form.etiquetas || []),
    }
    const r = form.id
      ? await supabase.from('objetivos').update(payload).eq('id', form.id)
      : await supabase.from('objetivos').insert({ ...payload, activo: true })
    setGuardando(false)
    if (r.error) { alert(r.error.message); return }
    setModal(false); cargar()
  }

  async function eliminar(o: any) {
    const n = enUso[o.id] || 0
    if (!confirm(
      `Eliminar "${o.nombre}".\n\n` +
      (n > 0 ? `${n} paciente${n > 1 ? 's lo tienen' : ' lo tiene'} abierto ahora mismo y lo perderá${n > 1 ? 'n' : ''}.\n` : 'No lo tiene nadie abierto.\n') +
      `\nNo se puede deshacer.`)) return
    await supabase.from('objetivos').delete().eq('id', o.id)
    cargar()
  }

  const articulaciones = etiquetas
    .filter((e: any) => e.categoria === 'articulacion')
    .sort((a: any, b: any) => ordenAnatomico(a.nombre, b.nombre))

  return (
    <div className="panel">
      <div className="sec">
        <div className="sec-h">
          <span className="sh-l">
            <span className="ct-l"><Ic name="objetivo" size={13} /> Objetivos</span>
            <button className="btn btn-p btn-sm" onClick={abrirNuevo}>+ Nuevo</button>
          </span>
          <span className="sh-r">
            {(objetivos || []).length} en total{sinFamilia > 0 && <> · {sinFamilia} sin clasificar</>}
          </span>
        </div>

        <input className="input" placeholder="Buscar objetivo…" value={buscar}
          onChange={e => setBuscar(e.target.value)} style={{ marginBottom: 10 }} />

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {FAMILIAS.map(f => (
            <button key={f.id} className={`chip-sel ${familia === f.id ? 'on' : ''}`} title={f.ayuda}
              onClick={() => setFamilia(familia === f.id ? '' : f.id)}>
              {f.nombre} · {cuentaFamilia(f.id)}
            </button>
          ))}
          {sinFamilia > 0 && (
            <button className={`chip-sel ${familia === 'sin' ? 'on' : ''}`}
              title="Los que sembré con los tests, de antes del modelo nuevo. Conviene repasarlos."
              onClick={() => setFamilia(familia === 'sin' ? '' : 'sin')}>
              Sin clasificar · {sinFamilia}
            </button>
          )}
        </div>

        {/* Por zona, de la cabeza a los pies. Sale de la misma etiqueta con la que se
            filtran ejercicios y tests, así que el vocabulario es uno solo. */}
        {zonas.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className={`chip-sel ${!zona ? 'on' : ''}`} onClick={() => setZona('')}>Todas las zonas</button>
            {zonas.map(z => (
              <button key={z.id} className={`chip-sel ${zona === z.id ? 'on' : ''}`}
                onClick={() => setZona(zona === z.id ? '' : z.id)}>{z.nombre}</button>
            ))}
          </div>
        )}

        {filtrados.length === 0 ? (
          <div className="muted">
            {(objetivos || []).length === 0 ? 'Sin objetivos todavía.' : 'Ninguno coincide.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 5 }}>
            {filtrados
              .filter((o: any) => familia !== 'sin' || !o.tipo)
              .map((o: any) => {
                const tipo = o.tipo || null
                const movs = (o.movimientos || []).map((id: string) => nombreEt(id)).filter(Boolean)
                const n = enUso[o.id] || 0
                return (
                  <div key={o.id} className="fila-p" style={{ borderLeftColor: o.color || 'var(--g)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--n)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {o.nombre}
                        {tipo === 'metrico' && o.metrica && <span className="pill pill-o on">{o.metrica === 'fuerza' ? 'Fuerza' : 'Movilidad'}</span>}
                        {tipo === 'fase' && <span className="pill pill-soft">{o.fases || '?'} fases</span>}
                        {!tipo && <span className="pill pill-soft" title="De antes del modelo nuevo">Sin clasificar</span>}
                        {o.articulacion_id && <span style={{ fontSize: 12, color: 'var(--gr)' }}>{nombreEt(o.articulacion_id)}</span>}
                      </div>
                      {o.descripcion && (
                        <div style={{ fontSize: 12, color: 'var(--gr)', lineHeight: 1.5, marginTop: 2 }}>{o.descripcion}</div>
                      )}
                      {/* Los movimientos son el menú del que se elige al poner una meta.
                          Verlos aquí es lo que dice si el espacio está bien montado. */}
                      {movs.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--grl)', marginTop: 3 }}>
                          {movs.join(' · ')}
                        </div>
                      )}
                      {(o.etiquetas || []).length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {(o.etiquetas || []).map((id: string) => (
                            <span key={id} className="pill pill-soft">{nombreEt(id)}</span>
                          ))}
                        </div>
                      )}
                      {o.test_id && (
                        <div style={{ fontSize: 12, color: 'var(--gd)', marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Ic name="test" size={11} /> Lo abre: {nombreTest(o.test_id)}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: n > 0 ? 'var(--gd)' : 'var(--grl)', flexShrink: 0, whiteSpace: 'nowrap' }}
                      title={n > 0 ? `${n} pacientes lo tienen abierto` : 'No lo tiene abierto nadie'}>
                      {n > 0 ? `${n} abiertos` : '—'}
                    </span>
                    <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
                      <button className="et-b" title="Editar" onClick={() => abrirEditar(o)}><Ic name="editar" size={13} /></button>
                      <button className="et-b et-b-r" title="Borrar" onClick={() => eliminar(o)}><Ic name="papelera" size={13} /></button>
                    </span>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget && !guardando) setModal(false) }}>
          <div className="modal">
            <div className="modal-title">
              {form.id ? 'Editar objetivo' : 'Nuevo objetivo'}
              <button className="modal-close" onClick={() => setModal(false)}><Ic name="cerrar" size={15} /></button>
            </div>

            <div className="field"><label>Familia</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {FAMILIAS.map(f => (
                  <button key={f.id} className={`chip-sel ${form.tipo === f.id ? 'on' : ''}`} title={f.ayuda}
                    onClick={() => setForm((p: any) => ({ ...p, tipo: f.id }))}>{f.nombre}</button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 4 }}>
                {FAMILIAS.find(f => f.id === form.tipo)?.ayuda}
              </div>
            </div>

            <div className="field"><label>Nombre *</label>
              <input className="input" value={form.nombre} autoFocus disabled={guardando}
                onChange={e => setForm((p: any) => ({ ...p, nombre: e.target.value }))}
                placeholder={form.tipo === 'metrico' ? 'ej. Fuerza de hombro' : 'ej. Aprender el puente de glúteo'} />
              {form.tipo === 'metrico' && (
                <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 3 }}>
                  Sin movimiento ni lado en el nombre: eso se elige al asignárselo a un paciente.
                </div>
              )}
            </div>

            {form.tipo === 'metrico' && (
              <div className="field"><label>Qué se mide</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[['fuerza', 'Fuerza'], ['movilidad', 'Movilidad']].map(([v, l]) => (
                    <button key={v} className={`chip-sel ${form.metrica === v ? 'on' : ''}`}
                      onClick={() => setForm((p: any) => ({ ...p, metrica: v }))}>{l}</button>
                  ))}
                </div>
              </div>
            )}

            {form.tipo === 'fase' && (
              <div className="field"><label>Cuántas fases</label>
                <input className="input" type="number" min={2} max={8} value={form.fases}
                  onChange={e => setForm((p: any) => ({ ...p, fases: e.target.value }))} placeholder="4" />
              </div>
            )}

            <div className="field"><label>Zona</label>
              <select className="input" value={form.articulacion_id} disabled={guardando}
                onChange={e => setForm((p: any) => ({ ...p, articulacion_id: e.target.value }))}>
                <option value="">— Sin zona concreta —</option>
                {articulaciones.map((a: any) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>

            {/* Solo en fases y cualitativos. Los métricos se describen con su articulación
                y sus movimientos, que además tienen un papel: con ellos la app resuelve
                sola qué test mide cada meta. */}
            {form.tipo !== 'metrico' && (
              <div className="field"><label>Músculo y patología</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxHeight: 132, overflowY: 'auto' }}>
                  {etiquetas
                    .filter((e: any) => e.categoria === 'musculo' || e.categoria === 'patologia')
                    .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre))
                    .map((e: any) => {
                      const sel = (form.etiquetas || []).includes(e.id)
                      return (
                        <button key={e.id} className={`chip-sel ${sel ? 'on' : ''}`}
                          onClick={() => setForm((p: any) => ({
                            ...p, etiquetas: sel
                              ? (p.etiquetas || []).filter((x: string) => x !== e.id)
                              : [...(p.etiquetas || []), e.id],
                          }))}>{e.nombre}</button>
                      )
                    })}
                </div>
                <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 4 }}>
                  Con la patología puesta, a un paciente al que le registres esa patología se le
                  podrán proponer estos objetivos sin buscarlos.
                </div>
              </div>
            )}

            <div className="field"><label>Descripción</label>
              <textarea className="input" value={form.descripcion} disabled={guardando}
                onChange={e => setForm((p: any) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Qué se busca y cuándo se da por conseguido" />
            </div>

            <div className="field"><label>Color</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {COLORES.map(c => (
                  <div key={c} onClick={() => setForm((p: any) => ({ ...p, color: c }))}
                    style={{ width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '3px solid var(--n)' : '2px solid var(--bd)' }} />
                ))}
              </div>
            </div>

            <div className="field"><label>Test que lo abre (opcional)</label>
              <select className="input" value={form.test_id} disabled={guardando}
                onChange={e => setForm((p: any) => ({ ...p, test_id: e.target.value }))}>
                <option value="">— Ninguno —</option>
                {(testsLib || []).map((t: any) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 3 }}>
                Si ese test da positivo, este objetivo se abre solo en el paciente.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-t btn-sm" onClick={() => setModal(false)} disabled={guardando}>Cancelar</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-p" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
