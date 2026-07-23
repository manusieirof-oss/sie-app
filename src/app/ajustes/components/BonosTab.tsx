'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { cargarBonosTipos, BonoTipo } from '@/lib/bonos'

function slugify(nombre: string) {
  return nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export default function BonosTab() {
  const [bonos, setBonos] = useState<BonoTipo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalBono, setModalBono] = useState(false)
  const [nuevoBono, setNuevoBono] = useState({ nombre: '', dias_semana: 2, descripcion: '' })
  const [editando, setEditando] = useState<string | null>(null)
  const [formEdit, setFormEdit] = useState({ nombre: '', dias_semana: 1, descripcion: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    setBonos(await cargarBonosTipos(false))
    setLoading(false)
  }

  async function crear() {
    setError('')
    if (!nuevoBono.nombre.trim()) return
    const id = slugify(nuevoBono.nombre)
    if (!id || bonos.some(b => b.id === id)) { setError('Ya existe un bono con ese nombre'); return }
    setGuardando(true)
    const orden = bonos.length ? Math.max(...bonos.map(b => b.orden)) + 1 : 1
    const { error: err } = await supabase.from('bonos_tipos').insert({
      id, nombre: nuevoBono.nombre.trim(), dias_semana: nuevoBono.dias_semana,
      descripcion: nuevoBono.descripcion || null, orden, activo: true
    })
    if (err) { setError('Error al guardar: ' + err.message); setGuardando(false); return }
    setNuevoBono({ nombre: '', dias_semana: 2, descripcion: '' })
    setModalBono(false)
    setGuardando(false)
    cargar()
  }

  function iniciarEdicion(b: BonoTipo) {
    setEditando(b.id)
    setFormEdit({ nombre: b.nombre, dias_semana: b.dias_semana, descripcion: b.descripcion || '' })
  }

  async function guardarEdicion(id: string) {
    setGuardando(true)
    await supabase.from('bonos_tipos').update({
      nombre: formEdit.nombre.trim(), dias_semana: formEdit.dias_semana, descripcion: formEdit.descripcion || null
    }).eq('id', id)
    setEditando(null)
    setGuardando(false)
    cargar()
  }

  async function toggleActivo(b: BonoTipo) {
    await supabase.from('bonos_tipos').update({ activo: !b.activo }).eq('id', b.id)
    cargar()
  }

  if (loading) return <div style={{ fontSize: 11, color: 'var(--grl)', padding: 20 }}>Cargando bonos...</div>

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="card-title" style={{ margin: 0 }}><span className="ct-l"><Ic name="etiqueta"/> Tipos de bono</span></div>
          <button className="btn btn-p btn-sm" onClick={() => setModalBono(true)}>+ Nuevo bono</button>
        </div>

        {bonos.map((b) => {
          if (editando === b.id) {
            return (
              <div key={b.id} style={{ padding: 12, borderRadius: 8, background: 'var(--gl)', border: '1px solid var(--gm)', marginBottom: 6 }}>
                <div className="g2" style={{ marginBottom: 8 }}>
                  <div className="field"><label>Nombre</label><input className="input" value={formEdit.nombre} onChange={e => setFormEdit(p => ({ ...p, nombre: e.target.value }))} autoFocus /></div>
                  <div className="field"><label>Días/semana</label><input className="input" type="number" value={formEdit.dias_semana} onChange={e => setFormEdit(p => ({ ...p, dias_semana: parseInt(e.target.value) || 1 }))} /></div>
                </div>
                <div className="field"><label>Descripción</label><input className="input" value={formEdit.descripcion} onChange={e => setFormEdit(p => ({ ...p, descripcion: e.target.value }))} /></div>
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
                <div style={{ fontSize: 9, color: 'var(--grl)' }}>{b.descripcion} · {b.dias_semana} día{b.dias_semana !== 1 ? 's' : ''}/semana</div>
              </div>
              <button onClick={() => iniciarEdicion(b)} style={{ color: 'var(--grl)', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex' }}><Ic name="editar" size={13}/></button>
              <button onClick={() => toggleActivo(b)} style={{ color: b.activo ? 'var(--red)' : 'var(--g)', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex' }}>{b.activo ? <Ic name="papelera" size={13}/> : '↺'}</button>
            </div>
          )
        })}
        {bonos.length === 0 && <div style={{ fontSize: 11, color: 'var(--grl)', padding: 10 }}>Sin tipos de bono</div>}
      </div>

      {modalBono && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setModalBono(false) }}>
          <div className="modal">
            <div className="modal-title">Nuevo bono<button className="modal-close" onClick={() => setModalBono(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevoBono.nombre} onChange={e => setNuevoBono(p => ({ ...p, nombre: e.target.value }))} autoFocus placeholder="ej. Premium" /></div>
            <div className="field"><label>Días por semana</label><input className="input" type="number" value={nuevoBono.dias_semana} onChange={e => setNuevoBono(p => ({ ...p, dias_semana: parseInt(e.target.value) || 1 }))} /></div>
            <div className="field"><label>Descripción</label><input className="input" value={nuevoBono.descripcion} onChange={e => setNuevoBono(p => ({ ...p, descripcion: e.target.value }))} placeholder="ej. 3 días/semana + 1 individual" /></div>
            {error && <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 6 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-d btn-sm" onClick={() => setModalBono(false)}>Cancelar</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-p" onClick={crear} disabled={guardando}>{guardando ? '…' : <><Ic name="guardar" size={13}/> Añadir bono</>}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
