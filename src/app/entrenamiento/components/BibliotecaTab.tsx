'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import ExploradorEjercicios from '@/components/ExploradorEjercicios'
import { subirImagenEjercicio, subirImagenVariante, eliminarEjercicio, usosDeEjercicio, promoverVariante, similaresA, LATERALIDADES } from '@/lib/ejercicios'


function EditorLista({ items, onChange, disabled, label, placeholder, icono }: any) {
  const add = () => onChange([...(items||[]), { texto:'' }])
  const upd = (i:number, val:string) => onChange(items.map((v:any,idx:number)=>idx===i?{...v,texto:val}:v))
  const del = (i:number) => onChange(items.filter((_:any,idx:number)=>idx!==i))
  return (
    <div className="field">
      <label>{label}</label>
      {(items||[]).map((it:any,i:number)=>(
        <div key={i} style={{display:'flex',gap:6,alignItems:'center',marginBottom:5}}>
          <span style={{display:'inline-flex',color:'var(--gr)',flexShrink:0}}><Ic name={icono||'mensaje'} size={13}/></span>
          <input className="input" value={it.texto||''} onChange={e=>upd(i,e.target.value)} placeholder={placeholder} disabled={disabled} style={{flex:1,fontSize:13}}/>
          <button className="btn btn-d btn-sm" onClick={()=>del(i)} disabled={disabled} title="Quitar"><Ic name="cerrar" size={12}/></button>
        </div>
      ))}
      <button className="btn btn-s btn-sm" onClick={add} disabled={disabled} style={{width:'100%',justifyContent:'center'}}>+ Añadir</button>
    </div>
  )
}

/**
 * Elige objetivos de un catálogo largo sin pintarlo entero: solo los seleccionados,
 * más un buscador. Es el mismo patrón que en el editor de sesión — aquí hacía más
 * falta todavía, porque el muro de chips se repetía por cada ítem de ejecución.
 */
function ElegirObjetivos({ objetivos, seleccionados, onToggle, disabled }: any) {
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState('')
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function fuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) { setAbierto(false); setQ('') }
    }
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') { setAbierto(false); setQ('') } }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto])

  const disponibles = (objetivos || [])
    .filter((o: any) => !seleccionados.includes(o.id))
    .filter((o: any) => !q || (o.nombre || '').toLowerCase().includes(q.toLowerCase()))

  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
      {(objetivos || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--gr)' }}>No hay objetivos creados</span>}
      {seleccionados.map((oid: string) => {
        const o = (objetivos || []).find((x: any) => x.id === oid)
        if (!o) return null
        return (
          <button key={oid} type="button" className="chip-obj" title="Quitar" disabled={disabled}
            onClick={() => onToggle(oid)}
            style={{ borderColor: o.color || 'var(--g)', background: o.color || 'var(--g)', color: '#fff' }}>
            {o.nombre}<Ic name="cerrar" size={11} style={{ verticalAlign: '-1px', marginLeft: 5 }} />
          </button>
        )
      })}
      {(objetivos || []).length > 0 && (
        <div style={{ position: 'relative' }} ref={caja}>
          <button type="button" className="chip-obj" style={{ borderStyle: 'dashed' }} disabled={disabled}
            onClick={() => setAbierto(v => !v)}>+ Añadir</button>
          {abierto && (
            <div className="pop-busca">
              <input className="input" autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar objetivo…" />
              <div style={{ maxHeight: 180, overflowY: 'auto', marginTop: 6 }}>
                {disponibles.slice(0, 40).map((o: any) => (
                  <div key={o.id} className="pop-it" onClick={() => { onToggle(o.id); setQ(''); setAbierto(false) }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: o.color || 'var(--g)', flexShrink: 0 }} />
                    {o.nombre}
                  </div>
                ))}
                {disponibles.length === 0 && <div style={{ padding: '7px 10px', fontSize: 13, color: 'var(--gr)' }}>Sin resultados</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EditorItems({ items, onChange, disabled, objetivos }: any) {
  const add = () => onChange([...(items||[]), { texto:'', objetivos:[] }])
  const upd = (i:number, campo:string, val:any) => onChange(items.map((v:any,idx:number)=>idx===i?{...v,[campo]:val}:v))
  const del = (i:number) => onChange(items.filter((_:any,idx:number)=>idx!==i))
  const toggleObj = (i:number, oid:string) => {
    const actuales = items[i].objetivos || []
    const nuevos = actuales.includes(oid) ? actuales.filter((x:string)=>x!==oid) : [...actuales, oid]
    upd(i, 'objetivos', nuevos)
  }
  return (
    <div className="field">
      <label>Ítems de ejecución correcta</label>
      {(items||[]).map((it:any,i:number)=>(
        <div key={i} style={{border:'1px solid var(--bd)',borderRadius:6,padding:8,marginBottom:6,background:'var(--bl)'}}>
          <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
            <span style={{display:'inline-flex',color:'var(--g)',flexShrink:0}}><Ic name="ok" size={13}/></span>
            <input className="input" value={it.texto||''} onChange={e=>upd(i,'texto',e.target.value)} placeholder="ej. Rodillas alineadas con los pies" disabled={disabled} style={{flex:1,fontSize:13}}/>
            <button className="btn btn-d btn-sm" onClick={()=>del(i)} disabled={disabled} title="Quitar"><Ic name="cerrar" size={12}/></button>
          </div>
          <div className="et-mini" style={{marginBottom:5}}>Si no lo cumple, trabajar</div>
          {/* Solo los elegidos, más un buscador. Pintar el catálogo entero se repetía
              por cada ítem de ejecución: con veinte objetivos y cinco ítems eran cien
              chips en el mismo modal. */}
          <ElegirObjetivos objetivos={objetivos} seleccionados={it.objetivos||[]} disabled={disabled}
            onToggle={(oid:string)=>toggleObj(i,oid)}/>
        </div>
      ))}
      <button className="btn btn-s btn-sm" onClick={add} disabled={disabled} style={{width:'100%',justifyContent:'center'}}>+ Añadir ítem</button>
    </div>
  )
}

function EditorVariantes({ variantes, onChange, disabled, ejercicioId }: any) {
  const [subiendo, setSubiendo] = useState(-1)
  const add = () => onChange([...(variantes||[]), { nombre:'Unilateral', descripcion:'' }])
  const upd = (i:number, campo:string, val:string) => onChange(variantes.map((v:any,idx:number)=>idx===i?{...v,[campo]:val}:v))
  const del = (i:number) => onChange(variantes.filter((_:any,idx:number)=>idx!==i))
  const subirImg = async (i:number, file:File) => {
    if (!ejercicioId) { alert('Guarda el ejercicio primero para subir imágenes de variante'); return }
    setSubiendo(i)
    const r = await subirImagenVariante(ejercicioId, i, file)
    if (r.ok) upd(i, 'imagen_url', r.url)
    else alert('No se pudo subir la imagen: '+r.error)
    setSubiendo(-1)
  }
  return (
    <div className="field">
      <label>Variantes</label>
      {(variantes||[]).map((v:any,i:number)=>(
        <div key={i} style={{border:'1px solid var(--bd)',borderRadius:6,padding:8,marginBottom:6,background:'var(--bl)'}}>
          <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:5}}>
            <select className="input" value={LATERALIDADES.includes(v.nombre)?v.nombre:'__libre'} onChange={e=>{const val=e.target.value; upd(i,'nombre', val==='__libre'?'':val)}} disabled={disabled} style={{flex:1,fontSize:13}}>
              {LATERALIDADES.map(l=><option key={l} value={l}>{l}</option>)}
              <option value="__libre">Otra (escribir)…</option>
            </select>
            <button className="btn btn-d btn-sm" onClick={()=>del(i)} disabled={disabled} title="Quitar"><Ic name="cerrar" size={12}/></button>
          </div>
          {!LATERALIDADES.includes(v.nombre) && <input className="input" value={v.nombre} onChange={e=>upd(i,'nombre',e.target.value)} placeholder="Nombre de la variante" disabled={disabled} style={{fontSize:13,marginBottom:5}}/>}
          <textarea className="input" value={v.descripcion||''} onChange={e=>upd(i,'descripcion',e.target.value)} placeholder="Descripción / ejecución de esta variante" disabled={disabled} style={{fontSize:13,minHeight:48,marginBottom:5}}/>
          <input className="input" value={v.video_url||''} onChange={e=>upd(i,'video_url',e.target.value)} placeholder="Enlace vídeo (opcional)" disabled={disabled} style={{fontSize:13,marginBottom:5}}/>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {v.imagen_url ? (
              <>
                <img src={v.imagen_url} alt="" style={{width:44,height:44,objectFit:'cover',borderRadius:5,border:'1px solid var(--bd)'}}/>
                <button className="btn btn-d btn-sm" onClick={()=>upd(i,'imagen_url','')} disabled={disabled}><Ic name="cerrar" size={12}/> Quitar imagen</button>
              </>
            ) : (
              <label className="btn btn-s btn-sm" style={{cursor:ejercicioId?'pointer':'not-allowed',opacity:ejercicioId?1:.5}}>
                {subiendo===i?'Subiendo…':<><Ic name="imagen" size={12}/> Subir imagen</>}
                <input type="file" accept="image/*" style={{display:'none'}} disabled={disabled||!ejercicioId||subiendo===i} onChange={e=>{const file=e.target.files?.[0]; if(file) subirImg(i,file)}}/>
              </label>
            )}
            {!ejercicioId && <span style={{fontSize:12,color:'var(--gr)'}}>Guarda primero para subir imagen</span>}
          </div>
        </div>
      ))}
      <button className="btn btn-s btn-sm" onClick={add} disabled={disabled} style={{width:'100%',justifyContent:'center'}}>+ Añadir variante</button>
    </div>
  )
}

export default function BibliotecaTab({ ejercicios, etiquetas, objetivos, cargar, getNombre, SelectorColumnas }: any) {
  const [modalEj, setModalEj] = useState(false)
  const [ejSeleccionado, setEjSeleccionado] = useState<any>(null)
  const [guardando, setGuardando] = useState(false)
  const [subiendoImg, setSubiendoImg] = useState(false)
  const [modalSelEt, setModalSelEt] = useState(false)
  const [varianteActiva, setVarianteActiva] = useState(-1) // -1 = principal
  useEffect(() => { setVarianteActiva(-1) }, [ejSeleccionado?.id])
  const [nuevoEj, setNuevoEj] = useState({ nombre:'', descripcion:'', video_url:'', imagen_url:'', etiquetas_ids:[] as string[], imagen_file:null as File|null, tipo_medida:'peso_reps', variantes:[] as any[], items_ejecucion:[] as any[], feedbacks:[] as any[] })
  const [editando, setEditando] = useState(false)
  const [editEj, setEditEj] = useState({ id:'', nombre:'', descripcion:'', video_url:'', imagen_url:'', etiquetas_ids:[] as string[], imagen_file:null as File|null, tipo_medida:'peso_reps', variantes:[] as any[], items_ejecucion:[] as any[], feedbacks:[] as any[] })
  const [modalSelEtEdit, setModalSelEtEdit] = useState(false)

  async function handleImagenEjercicio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setNuevoEj(p=>({...p, imagen_file: file, imagen_url: URL.createObjectURL(file)}))
  }

  function handleImagenEdit(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEditEj(p=>({...p, imagen_file: file, imagen_url: URL.createObjectURL(file)}))
  }

  function abrirEdicion() {
    if (!ejSeleccionado) return
    setEditEj({ id:ejSeleccionado.id, nombre:ejSeleccionado.nombre||'', descripcion:ejSeleccionado.descripcion||'', video_url:ejSeleccionado.video_url||'', imagen_url:ejSeleccionado.imagen_url||'', etiquetas_ids:ejSeleccionado.etiquetas||[], imagen_file:null, tipo_medida:ejSeleccionado.tipo_medida||'peso_reps', variantes:ejSeleccionado.variantes||[], items_ejecucion:ejSeleccionado.items_ejecucion||[], feedbacks:ejSeleccionado.feedbacks||[] })
    setEditando(true)
  }

  async function actualizarEjercicio() {
    if (guardando) return
    if (!editEj.nombre) { alert('El nombre es obligatorio'); return }
    setGuardando(true); setSubiendoImg(true)
    let imagenUrlFinal = editEj.imagen_url
    if (editEj.imagen_file) {
      // Comprimida y a ruta fija: antes se subía el original del móvil, 3-4 MB, y
      // con la extensión en el nombre, así que un PNG seguido de un JPG dejaba los dos.
      const r = await subirImagenEjercicio(editEj.id, editEj.imagen_file)
      if (!r.ok) { alert('No se pudo subir la imagen: '+r.error); setSubiendoImg(false); setGuardando(false); return }
      imagenUrlFinal = r.url
    }
    const { error } = await supabase.from('ejercicios').update({ nombre:editEj.nombre, descripcion:editEj.descripcion, video_url:editEj.video_url, etiquetas:editEj.etiquetas_ids, imagen_url:imagenUrlFinal, tipo_medida:editEj.tipo_medida, variantes:editEj.variantes, items_ejecucion:editEj.items_ejecucion, feedbacks:editEj.feedbacks }).eq('id', editEj.id)
    setSubiendoImg(false); setGuardando(false)
    if (error) { alert('Error al actualizar'); return }
    setEjSeleccionado({ ...ejSeleccionado, nombre:editEj.nombre, descripcion:editEj.descripcion, video_url:editEj.video_url, etiquetas:editEj.etiquetas_ids, imagen_url:imagenUrlFinal, tipo_medida:editEj.tipo_medida, variantes:editEj.variantes, items_ejecucion:editEj.items_ejecucion, feedbacks:editEj.feedbacks })
    setEditando(false); cargar()
  }

  /**
   * Borrar un ejercicio del catálogo. No existía: una prueba mal hecha se quedaba
   * para siempre, y ahora que la biblioteca se abre al montar sesiones, se ve.
   *
   * Se avisa de cuántas veces se ejecutó, porque ese histórico se queda huérfano —
   * a propósito: `registros_ejercicio` guarda el nombre, así que las sesiones pasadas
   * siguen contando qué se hizo. Borrar el rastro sería reescribir la historia
   * clínica para limpiar el catálogo.
   */
  async function borrarEjercicio(ej: any) {
    setGuardando(true)
    const usos = await usosDeEjercicio(ej.id)
    setGuardando(false)

    const nVar = (ej.variantes || []).length
    const conVariantes = nVar > 0
      ? `\n\nSe borran también sus ${nVar} variante${nVar > 1 ? 's' : ''} y sus imágenes. Si alguna te sirve por su cuenta, conviértela en ejercicio antes de borrar.`
      : ''
    const aviso = usos > 0
      ? `"${ej.nombre}" se ha ejecutado ${usos} ${usos === 1 ? 'vez' : 'veces'}.\n\nEsos registros se conservan con el nombre del ejercicio, pero dejarán de tener ficha: no verás su foto ni sus criterios de ejecución.${conVariantes}\n\n¿Eliminarlo de la biblioteca?`
      : `¿Eliminar "${ej.nombre}" de la biblioteca?\n\nNunca se ha ejecutado, así que no se pierde ningún registro.${conVariantes}`
    if (!confirm(aviso)) return

    setGuardando(true)
    const r = await eliminarEjercicio(ej.id)
    setGuardando(false)
    if (!r.ok) { alert('No se pudo eliminar: ' + r.error); return }
    setEjSeleccionado(null); setEditando(false); cargar()
  }

  /**
   * Saca una variante del ejercicio y la convierte en uno propio. No borra la
   * variante del padre: puede seguir teniendo sentido ahí, y quitarla rompería el
   * desplegable de las sesiones que ya la usan.
   */
  async function promover(indice: number) {
    const v = (ejSeleccionado.variantes||[])[indice]
    if (!v) return
    if (!confirm(`Se creará "${ejSeleccionado.nombre} · ${v.nombre}" como ejercicio propio.\n\nHereda las etiquetas, los criterios de ejecución y cómo se mide. A partir de ahí tendrá su propia progresión de cargas.\n\nLa variante se queda también en "${ejSeleccionado.nombre}".`)) return
    setGuardando(true)
    const r = await promoverVariante(ejSeleccionado, indice)
    setGuardando(false)
    if (!r.ok) { alert('No se pudo convertir: '+r.error); return }
    cargar()
    setEjSeleccionado(r.ejercicio); setVarianteActiva(-1); setEditando(false)
  }

  async function crearEjercicio() {
    if (guardando) return
    if (!nuevoEj.nombre) { alert('El nombre es obligatorio'); return }
    setGuardando(true); setSubiendoImg(true)
    const { data: ejData, error } = await supabase.from('ejercicios').insert({ nombre:nuevoEj.nombre, descripcion:nuevoEj.descripcion, video_url:nuevoEj.video_url, etiquetas:nuevoEj.etiquetas_ids, imagen_url:'', tipo_medida:nuevoEj.tipo_medida, variantes:nuevoEj.variantes, items_ejecucion:nuevoEj.items_ejecucion, feedbacks:nuevoEj.feedbacks }).select().single()
    if (error || !ejData) { alert('Error al crear ejercicio'); setGuardando(false); setSubiendoImg(false); return }
    if (nuevoEj.imagen_file) {
      // La imagen va después porque la ruta necesita el id. Si falla, se avisa: antes
      // te quedaba el ejercicio creado sin foto y sin explicación.
      const r = await subirImagenEjercicio(ejData.id, nuevoEj.imagen_file)
      if (r.ok) await supabase.from('ejercicios').update({ imagen_url: r.url }).eq('id', ejData.id)
      else alert('El ejercicio se creó, pero la imagen no se pudo subir: '+r.error)
    }
    setSubiendoImg(false); setModalEj(false)
    setNuevoEj({ nombre:'', descripcion:'', video_url:'', imagen_url:'', etiquetas_ids:[], imagen_file:null, tipo_medida:'peso_reps', variantes:[], items_ejecucion:[], feedbacks:[] })
    setGuardando(false); cargar()
  }

  return (
    <>
      {/* La rejilla, el buscador y los filtros son ahora los mismos que al montar una
          sesión: `ExploradorEjercicios`. Eran dos copias del mismo catálogo y ya
          habían empezado a divergir —esta filtraba por nombre y descripción, la otra
          solo por nombre, y los filtros por etiqueta no agrupaban por categoría. */}
      <ExploradorEjercicios
        ejercicios={ejercicios}
        etiquetas={etiquetas}
        onAbrir={(e:any)=>setEjSeleccionado(e)}
        acciones={<button className="btn btn-p btn-sm" onClick={()=>setModalEj(true)}>+ Nuevo ejercicio</button>}
      />

      {/* MODAL EJERCICIO (vista / edición) */}
      {ejSeleccionado&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando){setEjSeleccionado(null);setEditando(false)}}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'94vw',maxWidth:880,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            {/* cabecera */}
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10,background:'var(--bl)'}}>
              <div style={{flex:1,fontSize:14,fontWeight:400,color:'var(--n)'}}>{editando?'Editar ejercicio':ejSeleccionado.nombre}</div>
              {!editando&&<button className="btn btn-s btn-sm" onClick={abrirEdicion}><Ic name="editar" size={12}/> Editar</button>}
              <button onClick={()=>{setEjSeleccionado(null);setEditando(false)}} className="modal-close" disabled={guardando} aria-label="Cerrar"><Ic name="cerrar" size={16}/></button>
            </div>

            <div style={{flex:1,overflowY:'auto'}}>
              {editando?(
                /* ===== MODO EDICIÓN ===== */
                <div style={{padding:16}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                    <div>
                      <label className="et-mini" style={{display:'flex',marginBottom:6}}>Imagen</label>
                      {editEj.imagen_url?<img src={editEj.imagen_url} alt="preview" style={{width:'100%',aspectRatio:'1',objectFit:'cover',background:'var(--bm)',borderRadius:8,border:'1px solid var(--bd)',display:'block'}}/>:<div style={{width:'100%',aspectRatio:'1',background:'var(--bm)',borderRadius:8,border:'1.5px dashed var(--bd)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--gr)'}}><Ic name="fuerza" size={40}/></div>}
                      <div style={{display:'flex',gap:6,marginTop:8}}>
                        <label style={{cursor:'pointer',flex:1}}><div className="btn btn-s btn-sm" style={{width:'100%',justifyContent:'center'}}><Ic name="camara" size={12}/> Cambiar imagen</div><input type="file" accept="image/*" onChange={handleImagenEdit} style={{display:'none'}} disabled={guardando}/></label>
                        {editEj.imagen_url&&<button className="btn btn-d btn-sm" onClick={()=>setEditEj(p=>({...p,imagen_url:'',imagen_file:null}))} disabled={guardando} title="Quitar imagen"><Ic name="cerrar" size={12}/></button>}
                      </div>
                    </div>
                    <div>
                      <div className="field"><label>Nombre *</label><input className="input" value={editEj.nombre} onChange={e=>setEditEj(p=>({...p,nombre:e.target.value}))} disabled={guardando}/></div>
                      <div className="field"><label>Descripción</label><textarea className="input" value={editEj.descripcion} onChange={e=>setEditEj(p=>({...p,descripcion:e.target.value}))} disabled={guardando}/></div>
                      <div className="field"><label>Enlace vídeo</label><input className="input" value={editEj.video_url} onChange={e=>setEditEj(p=>({...p,video_url:e.target.value}))} disabled={guardando}/></div>
                      <div className="field"><label>Se mide en</label><select className="input" value={editEj.tipo_medida} onChange={e=>setEditEj(p=>({...p,tipo_medida:e.target.value}))} disabled={guardando}><option value="peso_reps">Peso y repeticiones</option><option value="tiempo">Tiempo (segundos)</option><option value="peso_tiempo">Peso y tiempo</option></select></div>
                      <EditorVariantes variantes={editEj.variantes} onChange={(v:any[])=>setEditEj(p=>({...p,variantes:v}))} disabled={guardando} ejercicioId={editEj.id}/>
                      <EditorItems items={editEj.items_ejecucion} onChange={(v:any[])=>setEditEj(p=>({...p,items_ejecucion:v}))} disabled={guardando} objetivos={objetivos}/>
                      <EditorLista items={editEj.feedbacks} onChange={(v:any[])=>setEditEj(p=>({...p,feedbacks:v}))} disabled={guardando} label="Feedbacks" placeholder="ej. Mete el core" icono="mensaje"/>
                      <div className="field">
                        <label>Etiquetas</label>
                        {editEj.etiquetas_ids.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:6}}>{editEj.etiquetas_ids.map(id=><span key={id} onClick={()=>setEditEj(p=>({...p,etiquetas_ids:p.etiquetas_ids.filter(x=>x!==id)}))} style={{fontSize:12,padding:'2px 8px',borderRadius:99,background:'var(--g)',color:'#fff',cursor:'pointer'}}>{getNombre(id)} <Ic name="cerrar" size={10}/></span>)}</div>}
                        <button className="btn btn-s btn-sm" onClick={()=>setModalSelEtEdit(true)} style={{width:'100%',justifyContent:'center'}}><Ic name="etiqueta" size={12}/> {editEj.etiquetas_ids.length>0?`${editEj.etiquetas_ids.length} seleccionadas · Cambiar`:'Seleccionar etiquetas'}</button>
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,marginTop:16,paddingTop:14,borderTop:'1px solid var(--bd)',alignItems:'center',flexWrap:'wrap'}}>
                    {/* El borrado vive en edición y no en la vista: es donde estás
                        tocando el ejercicio, no donde lo consultas. */}
                    <button className="btn btn-d btn-sm" onClick={()=>borrarEjercicio(ejSeleccionado)} disabled={guardando}>
                      <Ic name="papelera" size={12}/> Eliminar ejercicio
                    </button>
                    <div style={{flex:1}}/>
                    <button className="btn btn-t btn-sm" onClick={()=>setEditando(false)} disabled={guardando}>Cancelar</button>
                    <button className="btn btn-p" onClick={actualizarEjercicio} disabled={guardando}>{guardando?(subiendoImg?'Subiendo…':'Guardando…'):<><Ic name="guardar" size={13}/> Guardar cambios</>}</button>
                  </div>
                </div>
              ):(
                /* ===== MODO VISTA ===== */
                <div style={{padding:16}}>
                  <div style={{display:'grid',gridTemplateColumns:'1.1fr 1fr',gap:18}}>
                    <div>
                      {(() => {
                        const img = varianteActiva>=0 ? (ejSeleccionado.variantes?.[varianteActiva]?.imagen_url || ejSeleccionado.imagen_url) : ejSeleccionado.imagen_url
                        return img?<img src={img} alt={ejSeleccionado.nombre} style={{width:'100%',aspectRatio:'1',objectFit:'cover',background:'var(--bm)',borderRadius:8,border:'1px solid var(--bd)',display:'block'}}/>:<div style={{width:'100%',aspectRatio:'1',background:'var(--bm)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--gr)'}}><Ic name="fuerza" size={56}/></div>
                      })()}
                    </div>
                    <div>
                      {(ejSeleccionado.variantes||[]).length>0 && (
                        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12}}>
                          <button onClick={()=>setVarianteActiva(-1)} style={{fontSize:12,padding:'4px 11px',borderRadius:99,cursor:'pointer',fontFamily:'system-ui',border:`1.5px solid ${varianteActiva===-1?'var(--g)':'var(--bd)'}`,background:varianteActiva===-1?'var(--g)':'var(--w)',color:varianteActiva===-1?'#fff':'var(--gr)'}}>Principal</button>
                          {(ejSeleccionado.variantes||[]).map((v:any,i:number)=>(
                            <button key={i} onClick={()=>setVarianteActiva(i)} style={{fontSize:12,padding:'4px 11px',borderRadius:99,cursor:'pointer',fontFamily:'system-ui',border:`1.5px solid ${varianteActiva===i?'var(--g)':'var(--bd)'}`,background:varianteActiva===i?'var(--g)':'var(--w)',color:varianteActiva===i?'#fff':'var(--gr)'}}>{v.nombre||'Variante'}</button>
                          ))}
                        </div>
                      )}
                      {(() => {
                        const desc = varianteActiva>=0 ? (ejSeleccionado.variantes?.[varianteActiva]?.descripcion||'') : (ejSeleccionado.descripcion||'')
                        return desc ? <div style={{marginBottom:14}}><div className="et-mini" style={{marginBottom:6}}>Descripción{varianteActiva>=0?` · ${ejSeleccionado.variantes[varianteActiva]?.nombre||''}`:''}</div><div style={{fontSize:12,color:'var(--n)',fontWeight:300,lineHeight:1.6}}>{desc}</div></div> : null
                      })()}
                      {/* Una variante no se puede prescribir sola ni tiene criterios
                          propios. Cuando ya es otro ejercicio, esto la saca del padre. */}
                      {varianteActiva>=0 && (
                        <button className="btn btn-s btn-sm" style={{marginBottom:12}} disabled={guardando}
                          onClick={()=>promover(varianteActiva)}>
                          <Ic name="copiar" size={12}/> Convertir en ejercicio
                        </button>
                      )}
                      {(() => {
                        const vurl = varianteActiva>=0 ? (ejSeleccionado.variantes?.[varianteActiva]?.video_url||'') : (ejSeleccionado.video_url||'')
                        return vurl ? <a href={vurl} target="_blank" rel="noopener noreferrer" className="btn btn-s btn-sm" style={{marginBottom:14,display:'inline-flex'}}><Ic name="play" size={12}/> Ver vídeo{varianteActiva>=0?` · ${ejSeleccionado.variantes[varianteActiva]?.nombre||''}`:''}</a> : null
                      })()}
                      <div style={{marginBottom:14}}>
                        <div className="et-mini" style={{marginBottom:6}}>Se mide en</div>
                        <span style={{fontSize:12,padding:'3px 10px',borderRadius:99,background:'var(--bl)',color:'var(--n)'}}>{ejSeleccionado.tipo_medida==='tiempo'?'Tiempo (segundos)':ejSeleccionado.tipo_medida==='peso_tiempo'?'Peso y tiempo':'Peso y repeticiones'}</span>
                      </div>
                      <div>
                        <div className="et-mini" style={{marginBottom:6}}>Etiquetas</div>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          {(ejSeleccionado.etiquetas||[]).map((id:string)=>{const et=etiquetas.find((e:any)=>e.id===id);return et?<span key={id} style={{fontSize:12,padding:'3px 10px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{et.nombre}</span>:null})}
                          {!(ejSeleccionado.etiquetas||[]).length&&<span style={{fontSize:12,color:'var(--gr)'}}>Sin etiquetas</span>}
                        </div>
                      </div>
                      {(ejSeleccionado.items_ejecucion||[]).length>0 && (
                        <div style={{marginTop:14}}>
                          <div className="et-mini" style={{marginBottom:6}}>Ejecución correcta</div>
                          {(ejSeleccionado.items_ejecucion||[]).map((it:any,i:number)=>(
                            <div key={i} style={{fontSize:13,color:'var(--n)',marginBottom:3,display:'flex',gap:6,alignItems:'center'}}><span style={{color:'var(--g)',display:'inline-flex'}}><Ic name="ok" size={13}/></span><span>{it.texto}</span></div>
                          ))}
                        </div>
                      )}
                      {(ejSeleccionado.feedbacks||[]).length>0 && (
                        <div style={{marginTop:14}}>
                          <div className="et-mini" style={{marginBottom:6}}>Feedbacks</div>
                          {(ejSeleccionado.feedbacks||[]).map((fb:any,i:number)=>(
                            <div key={i} style={{fontSize:13,color:'var(--n)',marginBottom:3,display:'flex',gap:6,alignItems:'center'}}><span style={{color:'var(--gr)',display:'inline-flex'}}><Ic name="mensaje" size={13}/></span><span>{fb.texto}</span></div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {(()=>{
                    const variantes = similaresA(ejercicios, ejSeleccionado, 6, etiquetas)
                    return variantes.length>0?(
                      <div style={{marginTop:18,paddingTop:14,borderTop:'1px solid var(--bd)'}}>
                        <div className="et-mini" style={{marginBottom:8}}>Ejercicios similares</div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:6}}>
                          {variantes.map((v:any)=>(
                            <div key={v.id} onClick={()=>{setEjSeleccionado(v);setEditando(false)}} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:6,border:'1px solid var(--bd)',cursor:'pointer',background:'var(--bl)'}}
                              onMouseOver={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                              onMouseOut={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                              <div style={{width:36,height:36,background:'var(--bm)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
                                {v.imagen_url?<img src={v.imagen_url} alt={v.nombre} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{color:'var(--gr)',display:'inline-flex'}}><Ic name="fuerza" size={18}/></span>}
                              </div>
                              <span style={{fontSize:12,color:'var(--n)',flex:1,fontWeight:300}}>{v.nombre}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ):null
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL SELECTOR ETIQUETAS (edición) */}
      {modalSelEtEdit&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalSelEtEdit(false)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'96vw',maxWidth:1200,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10,background:'var(--bl)'}}>
              <div style={{flex:1,fontSize:13,fontWeight:400,color:'var(--n)'}}>Etiquetas del ejercicio</div>
              {editEj.etiquetas_ids.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setEditEj(p=>({...p,etiquetas_ids:[]}))}><Ic name="cerrar" size={12}/> Limpiar</button>}
              <button onClick={()=>setModalSelEtEdit(false)} style={{background:'var(--g)',color:'#fff',border:'none',borderRadius:'var(--r)',padding:'6px 16px',fontSize:13,cursor:'pointer',fontFamily:'system-ui'}}>Confirmar{editEj.etiquetas_ids.length>0?` (${editEj.etiquetas_ids.length})`:''}</button>
            </div>
            <div style={{flex:1,overflow:'hidden',padding:1}}><SelectorColumnas seleccionadas={editEj.etiquetas_ids} onChange={(ids:string[])=>setEditEj(p=>({...p,etiquetas_ids:ids}))}/></div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO EJERCICIO */}
      {modalEj&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)setModalEj(false)}}>
          <div className="modal" style={{width:480}}>
            <div className="modal-title">Nuevo ejercicio<button className="modal-close" onClick={()=>setModalEj(false)} aria-label="Cerrar"><Ic name="cerrar" size={16}/></button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevoEj.nombre} onChange={e=>setNuevoEj(p=>({...p,nombre:e.target.value}))} autoFocus disabled={guardando}/></div>
            <div className="field"><label>Descripción</label><textarea className="input" value={nuevoEj.descripcion} onChange={e=>setNuevoEj(p=>({...p,descripcion:e.target.value}))} disabled={guardando}/></div>
            <div className="field"><label>Enlace vídeo</label><input className="input" value={nuevoEj.video_url} onChange={e=>setNuevoEj(p=>({...p,video_url:e.target.value}))} disabled={guardando}/></div>
            <div className="field"><label>Se mide en</label><select className="input" value={nuevoEj.tipo_medida} onChange={e=>setNuevoEj(p=>({...p,tipo_medida:e.target.value}))} disabled={guardando}><option value="peso_reps">Peso y repeticiones</option><option value="tiempo">Tiempo (segundos)</option><option value="peso_tiempo">Peso y tiempo</option></select></div>
            <EditorVariantes variantes={nuevoEj.variantes} onChange={(v:any[])=>setNuevoEj(p=>({...p,variantes:v}))} disabled={guardando}/>
            <EditorItems items={nuevoEj.items_ejecucion} onChange={(v:any[])=>setNuevoEj(p=>({...p,items_ejecucion:v}))} disabled={guardando} objetivos={objetivos}/>
            <EditorLista items={nuevoEj.feedbacks} onChange={(v:any[])=>setNuevoEj(p=>({...p,feedbacks:v}))} disabled={guardando} label="Feedbacks" placeholder="ej. Mete el core" icono="mensaje"/>
            <div className="field">
              <label>Imagen</label>
              <div style={{display:'flex',alignItems:'center',gap:10,marginTop:4}}>
                {nuevoEj.imagen_url?<div style={{position:'relative'}}><img src={nuevoEj.imagen_url} alt="preview" style={{width:80,height:80,objectFit:'cover',borderRadius:6}}/><button onClick={()=>setNuevoEj(p=>({...p,imagen_url:'',imagen_file:null}))} title="Quitar imagen" style={{position:'absolute',top:-6,right:-6,width:20,height:20,borderRadius:'50%',background:'var(--red)',color:'#fff',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Ic name="cerrar" size={12}/></button></div>:<div style={{width:80,height:80,background:'var(--bm)',borderRadius:6,border:'1.5px dashed var(--bd)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--gr)'}}><Ic name="fuerza" size={24}/></div>}
                <label style={{cursor:'pointer'}}><div className="btn btn-s btn-sm"><Ic name="camara" size={12}/> Subir imagen</div><input type="file" accept="image/*" onChange={handleImagenEjercicio} style={{display:'none'}} disabled={guardando}/></label>
              </div>
            </div>
            <div className="field">
              <label>Etiquetas</label>
              {nuevoEj.etiquetas_ids.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:6}}>{nuevoEj.etiquetas_ids.map(id=><span key={id} onClick={()=>setNuevoEj(p=>({...p,etiquetas_ids:p.etiquetas_ids.filter(x=>x!==id)}))} style={{fontSize:12,padding:'2px 8px',borderRadius:99,background:'var(--g)',color:'#fff',cursor:'pointer'}}>{getNombre(id)} <Ic name="cerrar" size={10}/></span>)}</div>}
              <button className="btn btn-s btn-sm" onClick={()=>setModalSelEt(true)} style={{width:'100%',justifyContent:'center'}}><Ic name="etiqueta" size={12}/> {nuevoEj.etiquetas_ids.length>0?`${nuevoEj.etiquetas_ids.length} seleccionadas · Cambiar`:'Seleccionar etiquetas'}</button>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEj(false)} disabled={guardando}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearEjercicio} disabled={guardando}>{guardando?(subiendoImg?'Subiendo…':'Guardando…'):<><Ic name="guardar" size={13}/> Guardar</>}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SELECTOR ETIQUETAS */}
      {modalSelEt&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalSelEt(false)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'96vw',maxWidth:1200,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10,background:'var(--bl)'}}>
              <div style={{flex:1,fontSize:13,fontWeight:400,color:'var(--n)'}}>Etiquetas del ejercicio</div>
              {nuevoEj.etiquetas_ids.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setNuevoEj(p=>({...p,etiquetas_ids:[]}))}><Ic name="cerrar" size={12}/> Limpiar</button>}
              <button onClick={()=>setModalSelEt(false)} style={{background:'var(--g)',color:'#fff',border:'none',borderRadius:'var(--r)',padding:'6px 16px',fontSize:13,cursor:'pointer',fontFamily:'system-ui'}}>Confirmar{nuevoEj.etiquetas_ids.length>0?` (${nuevoEj.etiquetas_ids.length})`:''}</button>
            </div>
            <div style={{flex:1,overflow:'hidden',padding:1}}><SelectorColumnas seleccionadas={nuevoEj.etiquetas_ids} onChange={(ids:string[])=>setNuevoEj(p=>({...p,etiquetas_ids:ids}))}/></div>
          </div>
        </div>
      )}
    </>
  )
}
