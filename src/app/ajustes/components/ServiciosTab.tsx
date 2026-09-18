'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { cargarBonosTipos, BonoTipo } from '@/lib/bonos'
import { MODALIDADES, textoModalidad } from '@/lib/bonoSesiones'
import { cargarCategorias, CLAVE_CATEGORIAS, CATEGORIAS_POR_DEFECTO } from '@/lib/servicios'

// ---------------------------------------------------------------------------
// TODO LO QUE VENDES, EN UN SITIO
//
// Antes esto eran "Tipos de bono" aquí y "Tarifas" en otra pestaña, con los
// precios de las tarifas metidos dentro de un JSON. O sea: Finanzas controlaba
// la mitad de los precios y la otra mitad se editaba aquí sin que se enterara.
//
// EL PRECIO NO SE TOCA EN ESTA PANTALLA. Se ve, para no tener que ir a mirarlo,
// pero se edita en Finanzas -> Planes. Aquí defines QUÉ vendes; allí, a cuánto.
// Es lo único que impide volver a tener dos sitios donde cambiar un precio.
// ---------------------------------------------------------------------------

function slugify(nombre: string) {
  return nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/**
 * Cuota mensual, bono de sesiones o venta suelta. Es la decisión que más cambia
 * el comportamiento —si se asigna, si se renueva, si se gasta, si caduca—, así
 * que va arriba y con su explicación debajo, no escondida en un desplegable.
 */
function SelectorModalidad({ valor, onChange }: { valor: string, onChange: (m: string) => void }) {
  const activa = MODALIDADES.find(m => m.id === valor) || MODALIDADES[0]
  return (
    <div className="field">
      <label>Modalidad</label>
      <div style={{ display: 'flex', gap: 6 }}>
        {MODALIDADES.map(m => {
          const on = m.id === valor
          return (
            <button key={m.id} type="button" onClick={() => onChange(m.id)}
              style={{ flex: 1, padding: '7px 6px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10,
                       border: `1.5px solid ${on ? 'var(--g)' : 'var(--bd)'}`,
                       background: on ? 'var(--g)' : 'var(--w)', color: on ? '#fff' : 'var(--gr)' }}>
              {m.nombre}
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: 9, color: 'var(--grl)', marginTop: 4, lineHeight: 1.5 }}>{activa.ayuda}</div>
    </div>
  )
}

const VACIO = { nombre: '', dias_semana: '2', descripcion: '', modalidad: 'mensual',
                sesiones: '8', caduca_meses: '3', categoria: '' }

export default function ServiciosTab() {
  const [bonos, setBonos] = useState<BonoTipo[]>([])
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_POR_DEFECTO)
  const [loading, setLoading] = useState(true)
  const [modalBono, setModalBono] = useState(false)
  const [nuevoBono, setNuevoBono] = useState({ ...VACIO })
  const [editando, setEditando] = useState<string | null>(null)
  const [formEdit, setFormEdit] = useState({ ...VACIO })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [editaCats, setEditaCats] = useState(false)
  const [nuevaCat, setNuevaCat] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [bs, cs] = await Promise.all([cargarBonosTipos(false, true), cargarCategorias()])
    setBonos(bs)
    setCategorias(cs.categorias)
    setLoading(false)
  }

  async function guardarCategorias(lista: string[]) {
    setCategorias(lista)
    const { error: err } = await supabase.from('ajustes')
      .upsert({ clave: CLAVE_CATEGORIAS, valor: JSON.stringify(lista) }, { onConflict: 'clave' })
    if (err) setError('No se han podido guardar las categorías: ' + err.message)
  }

  /** Los campos que la base espera según la modalidad. Mismo criterio al crear y al editar. */
  function camposDe(f: typeof VACIO) {
    const deSesiones = f.modalidad === 'sesiones'
    const suelto = f.modalidad === 'suelto'
    return {
      nombre: f.nombre.trim(),
      // Un suelto no tiene días: se vende una vez. Va a 1 porque la columna no
      // admite nulo, y no se enseña en ningún sitio.
      dias_semana: suelto ? 1 : (parseInt(f.dias_semana) || 1),
      descripcion: f.descripcion || null,
      modalidad: f.modalidad,
      categoria: f.categoria || categorias[0] || 'Presencial',
      // `sesiones` tiene que ir a null fuera de los bonos de sesiones: hay un
      // check en la base que lo impide, porque sería mentira.
      sesiones: deSesiones ? (parseInt(f.sesiones) || null) : null,
      caduca_meses: deSesiones ? (parseInt(f.caduca_meses) || null) : null,
    }
  }

  function valida(f: typeof VACIO): string {
    if (f.modalidad === 'sesiones' && !(parseInt(f.sesiones) > 0))
      return 'Un bono de sesiones necesita cuántas sesiones trae'
    return ''
  }

  async function crear() {
    setError('')
    if (!nuevoBono.nombre.trim()) return
    const id = slugify(nuevoBono.nombre)
    if (!id || bonos.some(b => b.id === id)) { setError('Ya existe un servicio con ese nombre'); return }
    const fallo = valida(nuevoBono)
    if (fallo) { setError(fallo); return }
    setGuardando(true)
    const orden = bonos.length ? Math.max(...bonos.map(b => b.orden)) + 1 : 1
    const { error: err } = await supabase.from('bonos_tipos')
      .insert({ id, orden, activo: true, ...camposDe(nuevoBono) })
    if (err) { setError('Error al guardar: ' + err.message); setGuardando(false); return }
    setNuevoBono({ ...VACIO })
    setModalBono(false)
    setGuardando(false)
    cargar()
  }

  function iniciarEdicion(b: any) {
    setError('')
    setEditando(b.id)
    setFormEdit({
      nombre: b.nombre, dias_semana: String(b.dias_semana ?? 1), descripcion: b.descripcion || '',
      modalidad: b.modalidad || 'mensual', sesiones: String(b.sesiones ?? 8),
      caduca_meses: String(b.caduca_meses ?? 3), categoria: b.categoria || '',
    })
  }

  async function guardarEdicion(id: string) {
    setError('')
    const fallo = valida(formEdit)
    if (fallo) { setError(fallo); return }
    setGuardando(true)
    const { error: err } = await supabase.from('bonos_tipos').update(camposDe(formEdit)).eq('id', id)
    if (err) { setError('No se ha podido guardar: ' + err.message); setGuardando(false); return }
    setEditando(null)
    setGuardando(false)
    cargar()
  }

  async function toggleActivo(b: BonoTipo) {
    await supabase.from('bonos_tipos').update({ activo: !b.activo }).eq('id', b.id)
    cargar()
  }

  if (loading) return <div style={{ fontSize: 11, color: 'var(--grl)', padding: 20 }}>Cargando servicios...</div>

  // Primero las categorías definidas y en su orden; después las que aparezcan en
  // datos viejos y ya no estén en la lista, para que nada se quede sin pintar.
  const extras = Array.from(new Set(bonos.map((b: any) => b.categoria || 'Sin categoría')))
    .filter(c => !categorias.includes(c))
  const grupos = [...categorias, ...extras]
    .map(cat => ({ cat, items: bonos.filter((b: any) => (b.categoria || 'Sin categoría') === cat) }))
    .filter(g => g.items.length > 0)

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div className="card-title" style={{ margin: 0 }}><span className="ct-l"><Ic name="etiqueta"/> Servicios</span></div>
          <button className="btn btn-p btn-sm" onClick={() => { setNuevoBono({ ...VACIO, categoria: categorias[0] || '' }); setModalBono(true) }}>+ Nuevo servicio</button>
        </div>
        <div style={{ fontSize: 9, color: 'var(--grl)', marginBottom: 12, lineHeight: 1.6 }}>
          Aquí defines qué vendes. El precio se pone en Finanzas → Planes, para que no haya dos sitios donde cambiarlo.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 14,
                      paddingBottom: 12, borderBottom: '1px solid var(--bd)' }}>
          <span style={{ fontSize: 9, color: 'var(--grl)', textTransform: 'uppercase', letterSpacing: .4 }}>Categorías</span>
          {categorias.map(c => (
            <span key={c} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 99, background: 'var(--bl)',
                                   border: '1px solid var(--bd)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {c}
              {editaCats && (
                <button onClick={() => guardarCategorias(categorias.filter(x => x !== c))}
                  title={bonos.some((b: any) => b.categoria === c) ? 'Tiene servicios dentro: quedarán al final de la lista' : 'Quitar'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grl)', padding: 0, fontSize: 11 }}>✕</button>
              )}
            </span>
          ))}
          {editaCats ? (
            <>
              <input className="input" style={{ width: 130, padding: '3px 8px', fontSize: 10 }}
                value={nuevaCat} onChange={e => setNuevaCat(e.target.value)} placeholder="ej. Online" autoFocus
                onKeyDown={e => {
                  if (e.key !== 'Enter') return
                  const v = nuevaCat.trim()
                  if (v && !categorias.includes(v)) guardarCategorias([...categorias, v])
                  setNuevaCat('')
                }}/>
              <button className="btn btn-d btn-sm" onClick={() => { setEditaCats(false); setNuevaCat('') }}>Listo</button>
            </>
          ) : (
            <button onClick={() => setEditaCats(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gd)', fontSize: 10, fontFamily: 'inherit' }}>
              editar
            </button>
          )}
        </div>

        {grupos.map(({ cat, items }) => (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--grl)', textTransform: 'uppercase',
                          letterSpacing: .5, marginBottom: 6 }}>{cat}</div>
            {items.map((b: any) => {
              if (editando === b.id) {
                return (
                  <div key={b.id} style={{ padding: 14, borderRadius: 8, background: 'var(--gl)', border: '1px solid var(--gm)', marginBottom: 6, maxWidth: 420 }}>
                    <div className="field"><label>Nombre</label><input className="input" value={formEdit.nombre} onChange={e => setFormEdit(p => ({ ...p, nombre: e.target.value }))} autoFocus /></div>

                    <SelectorModalidad valor={formEdit.modalidad} onChange={m => setFormEdit(p => ({ ...p, modalidad: m }))} />

                    <div className="field">
                      <label>Categoría</label>
                      <select className="input" value={formEdit.categoria} onChange={e => setFormEdit(p => ({ ...p, categoria: e.target.value }))}>
                        {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                        {!categorias.includes(formEdit.categoria) && formEdit.categoria && (
                          <option value={formEdit.categoria}>{formEdit.categoria}</option>
                        )}
                      </select>
                    </div>

                    {formEdit.modalidad === 'sesiones' && (
                      <div className="g2">
                        <div className="field"><label>Sesiones</label><input className="input" type="number" value={formEdit.sesiones} onChange={e => setFormEdit(p => ({ ...p, sesiones: e.target.value }))} /></div>
                        <div className="field"><label>Caduca a los (meses)</label><input className="input" type="number" value={formEdit.caduca_meses} onChange={e => setFormEdit(p => ({ ...p, caduca_meses: e.target.value }))} placeholder="vacío = no caduca" /></div>
                      </div>
                    )}
                    {formEdit.modalidad === 'mensual' && (
                      <div className="field"><label>Días/semana</label><input className="input" type="number" value={formEdit.dias_semana} onChange={e => setFormEdit(p => ({ ...p, dias_semana: e.target.value }))} /></div>
                    )}

                    <div className="field"><label>Descripción</label><input className="input" value={formEdit.descripcion} onChange={e => setFormEdit(p => ({ ...p, descripcion: e.target.value }))} /></div>

                    {(b.modalidad || 'mensual') !== formEdit.modalidad && (
                      <div style={{ fontSize: 9.5, color: 'var(--amb)', marginTop: 4, display: 'flex', gap: 4, alignItems: 'flex-start', lineHeight: 1.5 }}>
                        <Ic name="alerta" size={11}/> Cambias la modalidad. Lo ya vendido de este tipo no se toca; solo cambia lo que se asigne a partir de ahora.
                      </div>
                    )}

                    {error && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 6 }}>{error}</div>}
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                      <button className="btn btn-d btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
                      <button className="btn btn-p btn-sm" onClick={() => guardarEdicion(b.id)} disabled={guardando}>{guardando ? '…' : <><Ic name="guardar" size={12}/> Guardar</>}</button>
                    </div>
                  </div>
                )
              }
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 6, border: '1px solid var(--bd)', marginBottom: 6, background: b.activo ? 'var(--bl)' : 'var(--gl)', opacity: b.activo ? 1 : .55 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: b.activo ? 'var(--g)' : 'var(--grl)', flexShrink: 0 }} />
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => iniciarEdicion(b)}>
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--n)' }}>{b.nombre}{!b.activo && ' (inactivo)'}</div>
                    <div style={{ fontSize: 9, color: 'var(--grl)' }}>{b.descripcion}{b.descripcion && ' · '}{textoModalidad(b)}</div>
                  </div>
                  <button onClick={() => iniciarEdicion(b)} style={{ color: 'var(--grl)', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex' }}><Ic name="editar" size={13}/></button>
                  <button onClick={() => toggleActivo(b)} style={{ color: b.activo ? 'var(--red)' : 'var(--g)', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex' }}>{b.activo ? <Ic name="papelera" size={13}/> : '↺'}</button>
                </div>
              )
            })}
          </div>
        ))}
        {bonos.length === 0 && <div style={{ fontSize: 11, color: 'var(--grl)', padding: 10 }}>Sin servicios</div>}
      </div>

      {modalBono && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setModalBono(false) }}>
          <div className="modal">
            <div className="modal-title">Nuevo servicio<button className="modal-close" onClick={() => setModalBono(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevoBono.nombre} onChange={e => setNuevoBono(p => ({ ...p, nombre: e.target.value }))} autoFocus placeholder="ej. Premium" /></div>

            <SelectorModalidad valor={nuevoBono.modalidad} onChange={m => setNuevoBono(p => ({ ...p, modalidad: m }))} />

            <div className="field">
              <label>Categoría</label>
              <select className="input" value={nuevoBono.categoria} onChange={e => setNuevoBono(p => ({ ...p, categoria: e.target.value }))}>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {nuevoBono.modalidad === 'sesiones' && (
              <div className="g2">
                <div className="field"><label>Sesiones *</label><input className="input" type="number" value={nuevoBono.sesiones} onChange={e => setNuevoBono(p => ({ ...p, sesiones: e.target.value }))} placeholder="8" /></div>
                <div className="field"><label>Caduca a los (meses)</label><input className="input" type="number" value={nuevoBono.caduca_meses} onChange={e => setNuevoBono(p => ({ ...p, caduca_meses: e.target.value }))} placeholder="vacío = no caduca" /></div>
              </div>
            )}
            {nuevoBono.modalidad === 'mensual' && (
              <div className="field"><label>Días por semana</label><input className="input" type="number" value={nuevoBono.dias_semana} onChange={e => setNuevoBono(p => ({ ...p, dias_semana: e.target.value }))} /></div>
            )}

            <div className="field"><label>Descripción</label><input className="input" value={nuevoBono.descripcion} onChange={e => setNuevoBono(p => ({ ...p, descripcion: e.target.value }))} placeholder={nuevoBono.modalidad === 'sesiones' ? 'ej. Individual · 8 sesiones' : 'ej. 3 días/semana + 1 individual'} /></div>
            {error && <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 6 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-d btn-sm" onClick={() => setModalBono(false)}>Cancelar</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-p" onClick={crear} disabled={guardando}>{guardando ? '…' : <><Ic name="guardar" size={13}/> Añadir servicio</>}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
