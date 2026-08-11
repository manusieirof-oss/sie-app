'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { cargarBonosTipos, BonoTipo } from '@/lib/bonos'
import { MODALIDADES, esDeSesiones, textoModalidad } from '@/lib/bonoSesiones'

function slugify(nombre: string) {
  return nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/**
 * Cuota mensual o bono de sesiones. Es la decisión que más cambia el
 * comportamiento del bono —si se renueva solo, si se gasta, si caduca—, así que
 * va arriba y con su explicación debajo, no escondida en un desplegable.
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

export default function BonosTab() {
  const [bonos, setBonos] = useState<BonoTipo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalBono, setModalBono] = useState(false)
  const [nuevoBono, setNuevoBono] = useState({ nombre: '', dias_semana: '2', descripcion: '', modalidad: 'mensual', sesiones: '8', caduca_meses: '3' })
  const [editando, setEditando] = useState<string | null>(null)
  const [formEdit, setFormEdit] = useState({ nombre: '', dias_semana: '1', descripcion: '', modalidad: 'mensual', sesiones: '8', caduca_meses: '3' })
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
    // La base rechaza un bono de sesiones sin sesiones. Mejor decirlo aquí que
    // dejar que vuelva un error de constraint que no le dice nada a nadie.
    if (nuevoBono.modalidad === 'sesiones' && !(parseInt(nuevoBono.sesiones) > 0)) {
      setError('Un bono de sesiones necesita cuántas sesiones trae'); return
    }
    setGuardando(true)
    const orden = bonos.length ? Math.max(...bonos.map(b => b.orden)) + 1 : 1
    const deSesiones = nuevoBono.modalidad === 'sesiones'
    const { error: err } = await supabase.from('bonos_tipos').insert({
      id, nombre: nuevoBono.nombre.trim(), dias_semana: parseInt(nuevoBono.dias_semana) || 1,
      descripcion: nuevoBono.descripcion || null, orden, activo: true,
      modalidad: nuevoBono.modalidad,
      // `sesiones` tiene que ir a null en los mensuales: hay un check en la base
      // que impide un bono mensual con número de sesiones, porque sería mentira.
      sesiones: deSesiones ? (parseInt(nuevoBono.sesiones) || null) : null,
      caduca_meses: deSesiones ? (parseInt(nuevoBono.caduca_meses) || null) : null,
    })
    if (err) { setError('Error al guardar: ' + err.message); setGuardando(false); return }
    setNuevoBono({ nombre: '', dias_semana: '2', descripcion: '', modalidad: 'mensual', sesiones: '8', caduca_meses: '3' })
    setModalBono(false)
    setGuardando(false)
    cargar()
  }

  function iniciarEdicion(b: BonoTipo) {
    setEditando(b.id)
    setFormEdit({ nombre: b.nombre, dias_semana: String(b.dias_semana ?? 1), descripcion: b.descripcion || '',
      modalidad: (b as any).modalidad || 'mensual',
      sesiones: String((b as any).sesiones ?? 8),
      caduca_meses: String((b as any).caduca_meses ?? 3) })
  }

  async function guardarEdicion(id: string) {
    setError('')
    if (formEdit.modalidad === 'sesiones' && !(parseInt(formEdit.sesiones) > 0)) {
      setError('Un bono de sesiones necesita cuántas sesiones trae'); return
    }
    setGuardando(true)
    const deSesiones = formEdit.modalidad === 'sesiones'
    const { error: err } = await supabase.from('bonos_tipos').update({
      nombre: formEdit.nombre.trim(), dias_semana: parseInt(formEdit.dias_semana) || 1,
      descripcion: formEdit.descripcion || null,
      modalidad: formEdit.modalidad,
      sesiones: deSesiones ? (parseInt(formEdit.sesiones) || null) : null,
      caduca_meses: deSesiones ? (parseInt(formEdit.caduca_meses) || null) : null,
    }).eq('id', id)
    if (err) { setError('No se ha podido guardar: ' + err.message); setGuardando(false); return }
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
              // Ancho acotado. Estirado a toda la tarjeta, cada campo medía media
              // pantalla y el ojo tenía que recorrerla entera para leer un
              // "Días/semana" con un 3 dentro. Un formulario se lee en columna.
              <div key={b.id} style={{ padding: 14, borderRadius: 8, background: 'var(--gl)', border: '1px solid var(--gm)', marginBottom: 6, maxWidth: 420 }}>
                <div className="field"><label>Nombre</label><input className="input" value={formEdit.nombre} onChange={e => setFormEdit(p => ({ ...p, nombre: e.target.value }))} autoFocus /></div>

                <SelectorModalidad valor={formEdit.modalidad} onChange={m => setFormEdit(p => ({ ...p, modalidad: m }))} />

                {formEdit.modalidad === 'sesiones' ? (
                  <div className="g2">
                    <div className="field"><label>Sesiones</label><input className="input" type="number" value={formEdit.sesiones} onChange={e => setFormEdit(p => ({ ...p, sesiones: e.target.value }))} /></div>
                    <div className="field"><label>Caduca a los (meses)</label><input className="input" type="number" value={formEdit.caduca_meses} onChange={e => setFormEdit(p => ({ ...p, caduca_meses: e.target.value }))} placeholder="vacío = no caduca" /></div>
                  </div>
                ) : (
                  <div className="field"><label>Días/semana</label><input className="input" type="number" value={formEdit.dias_semana} onChange={e => setFormEdit(p => ({ ...p, dias_semana: e.target.value }))} /></div>
                )}

                <div className="field"><label>Descripción</label><input className="input" value={formEdit.descripcion} onChange={e => setFormEdit(p => ({ ...p, descripcion: e.target.value }))} /></div>

                {/* Cambiar la modalidad de un tipo que ya se ha vendido no toca los
                    bonos vendidos: esos copiaron sus sesiones al comprarse. Solo
                    cambia lo que se venda a partir de ahora. */}
                {esDeSesiones(b) !== (formEdit.modalidad === 'sesiones') && (
                  <div style={{ fontSize: 9.5, color: 'var(--amb)', marginTop: 4, display: 'flex', gap: 4, alignItems: 'flex-start', lineHeight: 1.5 }}>
                    <Ic name="alerta" size={11}/> Cambias la modalidad. Los bonos ya vendidos de este tipo no se tocan; solo cambia lo que se asigne a partir de ahora.
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
        {bonos.length === 0 && <div style={{ fontSize: 11, color: 'var(--grl)', padding: 10 }}>Sin tipos de bono</div>}
      </div>

      {modalBono && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setModalBono(false) }}>
          <div className="modal">
            <div className="modal-title">Nuevo bono<button className="modal-close" onClick={() => setModalBono(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevoBono.nombre} onChange={e => setNuevoBono(p => ({ ...p, nombre: e.target.value }))} autoFocus placeholder="ej. Premium" /></div>

            <SelectorModalidad valor={nuevoBono.modalidad} onChange={m => setNuevoBono(p => ({ ...p, modalidad: m }))} />

            {nuevoBono.modalidad === 'sesiones' ? (
              <div className="g2">
                <div className="field"><label>Sesiones *</label><input className="input" type="number" value={nuevoBono.sesiones} onChange={e => setNuevoBono(p => ({ ...p, sesiones: e.target.value }))} placeholder="8" /></div>
                <div className="field"><label>Caduca a los (meses)</label><input className="input" type="number" value={nuevoBono.caduca_meses} onChange={e => setNuevoBono(p => ({ ...p, caduca_meses: e.target.value }))} placeholder="vacío = no caduca" /></div>
              </div>
            ) : (
              <div className="field"><label>Días por semana</label><input className="input" type="number" value={nuevoBono.dias_semana} onChange={e => setNuevoBono(p => ({ ...p, dias_semana: e.target.value }))} /></div>
            )}

            <div className="field"><label>Descripción</label><input className="input" value={nuevoBono.descripcion} onChange={e => setNuevoBono(p => ({ ...p, descripcion: e.target.value }))} placeholder={nuevoBono.modalidad === 'sesiones' ? 'ej. Individual · 8 sesiones' : 'ej. 3 días/semana + 1 individual'} /></div>
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
