'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const LATERALIDADES = ['Bilateral','Unilateral','Alterno','Unipodal','Bipodal','Contralateral']

function EditorLista({ items, onChange, disabled, label, placeholder, icono }: any) {
  const add = () => onChange([...(items||[]), { texto:'' }])
  const upd = (i:number, val:string) => onChange(items.map((v:any,idx:number)=>idx===i?{...v,texto:val}:v))
  const del = (i:number) => onChange(items.filter((_:any,idx:number)=>idx!==i))
  return (
    <div className="field">
      <label>{label}</label>
      {(items||[]).map((it:any,i:number)=>(
        <div key={i} style={{display:'flex',gap:6,alignItems:'center',marginBottom:5}}>
          <span style={{fontSize:11}}>{icono}</span>
          <input className="input" value={it.texto||''} onChange={e=>upd(i,e.target.value)} placeholder={placeholder} disabled={disabled} style={{flex:1,fontSize:11}}/>
          <button className="btn btn-d btn-sm" onClick={()=>del(i)} disabled={disabled}>✕</button>
        </div>
      ))}
      <button className="btn btn-s btn-sm" onClick={add} disabled={disabled} style={{width:'100%',justifyContent:'center'}}>+ Añadir</button>
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
    const ext = file.name.split('.').pop()
    const path = `ejercicios/${ejercicioId}/variante-${i}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(path, file, { upsert:true })
    if (!error) {
      const { data:{ publicUrl } } = supabase.storage.from('fotos').getPublicUrl(path)
      upd(i, 'imagen_url', publicUrl)
    } else { alert('Error al subir imagen') }
    setSubiendo(-1)
  }
  return (
    <div className="field">
      <label>Variantes</label>
      {(variantes||[]).map((v:any,i:number)=>(
        <div key={i} style={{border:'1px solid var(--bd)',borderRadius:6,padding:8,marginBottom:6,background:'var(--bl)'}}>
          <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:5}}>
            <select className="input" value={LATERALIDADES.includes(v.nombre)?v.nombre:'__libre'} onChange={e=>{const val=e.target.value; upd(i,'nombre', val==='__libre'?'':val)}} disabled={disabled} style={{flex:1,fontSize:11}}>
              {LATERALIDADES.map(l=><option key={l} value={l}>{l}</option>)}
              <option value="__libre">Otra (escribir)…</option>
            </select>
            <button className="btn btn-d btn-sm" onClick={()=>del(i)} disabled={disabled}>✕</button>
          </div>
          {!LATERALIDADES.includes(v.nombre) && <input className="input" value={v.nombre} onChange={e=>upd(i,'nombre',e.target.value)} placeholder="Nombre de la variante" disabled={disabled} style={{fontSize:11,marginBottom:5}}/>}
          <textarea className="input" value={v.descripcion||''} onChange={e=>upd(i,'descripcion',e.target.value)} placeholder="Descripción / ejecución de esta variante" disabled={disabled} style={{fontSize:11,minHeight:48,marginBottom:5}}/>
          <input className="input" value={v.video_url||''} onChange={e=>upd(i,'video_url',e.target.value)} placeholder="🎥 Enlace vídeo (opcional)" disabled={disabled} style={{fontSize:11,marginBottom:5}}/>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {v.imagen_url ? (
              <>
                <img src={v.imagen_url} alt="" style={{width:44,height:44,objectFit:'cover',borderRadius:5,border:'1px solid var(--bd)'}}/>
                <button className="btn btn-d btn-sm" onClick={()=>upd(i,'imagen_url','')} disabled={disabled}>✕ Quitar imagen</button>
              </>
            ) : (
              <label className="btn btn-s btn-sm" style={{cursor:ejercicioId?'pointer':'not-allowed',opacity:ejercicioId?1:.5}}>
                {subiendo===i?'⏳ Subiendo...':'🖼 Subir imagen'}
                <input type="file" accept="image/*" style={{display:'none'}} disabled={disabled||!ejercicioId||subiendo===i} onChange={e=>{const file=e.target.files?.[0]; if(file) subirImg(i,file)}}/>
              </label>
            )}
            {!ejercicioId && <span style={{fontSize:8,color:'var(--grl)'}}>Guarda primero para subir imagen</span>}
          </div>
        </div>
      ))}
      <button className="btn btn-s btn-sm" onClick={add} disabled={disabled} style={{width:'100%',justifyContent:'center'}}>+ Añadir variante</button>
    </div>
  )
}

export default function BibliotecaTab({ ejercicios, etiquetas, cargar, getNombre, SelectorColumnas }: any) {
  const [buscar, setBuscar] = useState('')
  const [filtroEtiquetas, setFiltroEtiquetas] = useState<string[]>([])
  const [modalFiltro, setModalFiltro] = useState(false)
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

  const filtrados = ejercicios.filter((e:any) => {
    const matchQ = !buscar || e.nombre.toLowerCase().includes(buscar.toLowerCase()) || (e.descripcion||'').toLowerCase().includes(buscar.toLowerCase())
    const matchEt = filtroEtiquetas.length===0 || filtroEtiquetas.every(fid=>(e.etiquetas||[]).includes(fid))
    return matchQ && matchEt
  })

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
      const ext = editEj.imagen_file.name.split('.').pop()
      const path = `ejercicios/${editEj.id}/foto.${ext}`
      const { error: upErr } = await supabase.storage.from('fotos').upload(path, editEj.imagen_file, { upsert: true })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('fotos').getPublicUrl(path)
        imagenUrlFinal = `${publicUrl}?t=${Date.now()}`
      }
    }
    const { error } = await supabase.from('ejercicios').update({ nombre:editEj.nombre, descripcion:editEj.descripcion, video_url:editEj.video_url, etiquetas:editEj.etiquetas_ids, imagen_url:imagenUrlFinal, tipo_medida:editEj.tipo_medida, variantes:editEj.variantes, items_ejecucion:editEj.items_ejecucion, feedbacks:editEj.feedbacks }).eq('id', editEj.id)
    setSubiendoImg(false); setGuardando(false)
    if (error) { alert('Error al actualizar'); return }
    setEjSeleccionado({ ...ejSeleccionado, nombre:editEj.nombre, descripcion:editEj.descripcion, video_url:editEj.video_url, etiquetas:editEj.etiquetas_ids, imagen_url:imagenUrlFinal, tipo_medida:editEj.tipo_medida, variantes:editEj.variantes, items_ejecucion:editEj.items_ejecucion, feedbacks:editEj.feedbacks })
    setEditando(false); cargar()
  }

  async function crearEjercicio() {
    if (guardando) return
    if (!nuevoEj.nombre) { alert('El nombre es obligatorio'); return }
    setGuardando(true); setSubiendoImg(true)
    const { data: ejData, error } = await supabase.from('ejercicios').insert({ nombre:nuevoEj.nombre, descripcion:nuevoEj.descripcion, video_url:nuevoEj.video_url, etiquetas:nuevoEj.etiquetas_ids, imagen_url:'', tipo_medida:nuevoEj.tipo_medida, variantes:nuevoEj.variantes, items_ejecucion:nuevoEj.items_ejecucion, feedbacks:nuevoEj.feedbacks }).select().single()
    if (error || !ejData) { alert('Error al crear ejercicio'); setGuardando(false); setSubiendoImg(false); return }
    if (nuevoEj.imagen_file) {
      const ext = nuevoEj.imagen_file.name.split('.').pop()
      const path = `ejercicios/${ejData.id}/foto.${ext}`
      const { error: upErr } = await supabase.storage.from('fotos').upload(path, nuevoEj.imagen_file, { upsert: true })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('fotos').getPublicUrl(path)
        await supabase.from('ejercicios').update({ imagen_url: publicUrl }).eq('id', ejData.id)
      }
    }
    setSubiendoImg(false); setModalEj(false)
    setNuevoEj({ nombre:'', descripcion:'', video_url:'', imagen_url:'', etiquetas_ids:[], imagen_file:null, tipo_medida:'peso_reps', variantes:[], items_ejecucion:[], feedbacks:[] })
    setGuardando(false); cargar()
  }

  return (
    <>
      <div style={{display:'flex',gap:8,marginBottom:8,alignItems:'center',flexWrap:'wrap'}}>
        <input className="input" placeholder="🔍 Buscar ejercicio..." value={buscar} onChange={e=>setBuscar(e.target.value)} style={{flex:1,minWidth:200}}/>
        <button className="btn btn-s" onClick={()=>setModalFiltro(true)} style={{position:'relative'}}>
          🏷 Filtrar
          {filtroEtiquetas.length>0&&<span style={{position:'absolute',top:-6,right:-6,width:18,height:18,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:9,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>{filtroEtiquetas.length}</span>}
        </button>
        {filtroEtiquetas.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setFiltroEtiquetas([])}>✕ Limpiar</button>}
        <span style={{fontSize:10,color:'var(--grl)'}}>{filtrados.length} ejercicios</span>
        <button className="btn btn-p btn-sm" onClick={()=>setModalEj(true)}>+ Nuevo ejercicio</button>
      </div>

      {filtrados.length===0?(
        <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>
          {ejercicios.length===0?'No hay ejercicios aún.':'Sin resultados.'}
        </div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:9}}>
          {filtrados.map((e:any)=>{
            const etsDelEj = (e.etiquetas||[]).map((id:string)=>etiquetas.find((et:any)=>et.id===id)).filter(Boolean)
            return (
              <div key={e.id} style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',cursor:'pointer'}}
                onMouseOver={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                onMouseOut={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                {e.imagen_url?<img src={e.imagen_url} alt={e.nombre} onClick={()=>setEjSeleccionado(e)} style={{width:'100%',height:100,objectFit:'contain',background:'var(--bm)',borderBottom:'1px solid var(--bd)',display:'block'}}/>:<div onClick={()=>setEjSeleccionado(e)} style={{height:100,background:'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,borderBottom:'1px solid var(--bd)'}}>💪</div>}
                <div style={{padding:'8px 10px'}}>
                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:4}}>{e.nombre}</div>
                  {e.descripcion&&<div style={{fontSize:9,color:'var(--grl)',marginBottom:5,fontWeight:300,lineHeight:1.4}}>{e.descripcion.slice(0,80)}{e.descripcion.length>80?'...':''}</div>}
                  <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                    {etsDelEj.slice(0,4).map((et:any)=><span key={et.id} style={{fontSize:8,padding:'1px 6px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{et.nombre}</span>)}
                    {etsDelEj.length>4&&<span style={{fontSize:8,color:'var(--grl)'}}>+{etsDelEj.length-4}</span>}
                  </div>
                  {e.video_url&&<a href={e.video_url} target="_blank" rel="noopener noreferrer" style={{fontSize:9,color:'var(--g)',display:'block',marginTop:5}}>🎥 Ver vídeo ↗</a>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL EJERCICIO (vista / edición) */}
      {ejSeleccionado&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando){setEjSeleccionado(null);setEditando(false)}}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'94vw',maxWidth:880,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            {/* cabecera */}
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10,background:'var(--bl)'}}>
              <div style={{flex:1,fontSize:14,fontWeight:400,color:'var(--n)'}}>{editando?'Editar ejercicio':ejSeleccionado.nombre}</div>
              {!editando&&<button className="btn btn-s btn-sm" onClick={abrirEdicion}>✎ Editar</button>}
              <button onClick={()=>{setEjSeleccionado(null);setEditando(false)}} style={{width:26,height:26,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontSize:13,color:'var(--gr)'}} disabled={guardando}>✕</button>
            </div>

            <div style={{flex:1,overflowY:'auto'}}>
              {editando?(
                /* ===== MODO EDICIÓN ===== */
                <div style={{padding:16}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                    <div>
                      <label style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',display:'block',marginBottom:6}}>Imagen</label>
                      {editEj.imagen_url?<img src={editEj.imagen_url} alt="preview" style={{width:'100%',height:240,objectFit:'contain',background:'var(--bm)',borderRadius:8,border:'1px solid var(--bd)'}}/>:<div style={{width:'100%',height:240,background:'var(--bm)',borderRadius:8,border:'1.5px dashed var(--bd)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:40}}>💪</div>}
                      <div style={{display:'flex',gap:6,marginTop:8}}>
                        <label style={{cursor:'pointer',flex:1}}><div className="btn btn-s btn-sm" style={{width:'100%',justifyContent:'center'}}>📷 Cambiar imagen</div><input type="file" accept="image/*" onChange={handleImagenEdit} style={{display:'none'}} disabled={guardando}/></label>
                        {editEj.imagen_url&&<button className="btn btn-d btn-sm" onClick={()=>setEditEj(p=>({...p,imagen_url:'',imagen_file:null}))} disabled={guardando}>✕</button>}
                      </div>
                    </div>
                    <div>
                      <div className="field"><label>Nombre *</label><input className="input" value={editEj.nombre} onChange={e=>setEditEj(p=>({...p,nombre:e.target.value}))} disabled={guardando}/></div>
                      <div className="field"><label>Descripción</label><textarea className="input" value={editEj.descripcion} onChange={e=>setEditEj(p=>({...p,descripcion:e.target.value}))} disabled={guardando}/></div>
                      <div className="field"><label>Enlace vídeo</label><input className="input" value={editEj.video_url} onChange={e=>setEditEj(p=>({...p,video_url:e.target.value}))} disabled={guardando}/></div>
                      <div className="field"><label>Se mide en</label><select className="input" value={editEj.tipo_medida} onChange={e=>setEditEj(p=>({...p,tipo_medida:e.target.value}))} disabled={guardando}><option value="peso_reps">Peso y repeticiones</option><option value="tiempo">Tiempo (segundos)</option><option value="peso_tiempo">Peso y tiempo</option></select></div>
                      <EditorVariantes variantes={editEj.variantes} onChange={(v:any[])=>setEditEj(p=>({...p,variantes:v}))} disabled={guardando} ejercicioId={editEj.id}/>
                      <EditorLista items={editEj.items_ejecucion} onChange={(v:any[])=>setEditEj(p=>({...p,items_ejecucion:v}))} disabled={guardando} label="Ítems de ejecución correcta" placeholder="ej. Rodillas alineadas con los pies" icono="✅"/>
                      <EditorLista items={editEj.feedbacks} onChange={(v:any[])=>setEditEj(p=>({...p,feedbacks:v}))} disabled={guardando} label="Feedbacks" placeholder="ej. Mete el core" icono="💬"/>
                      <div className="field">
                        <label>Etiquetas</label>
                        {editEj.etiquetas_ids.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:6}}>{editEj.etiquetas_ids.map(id=><span key={id} onClick={()=>setEditEj(p=>({...p,etiquetas_ids:p.etiquetas_ids.filter(x=>x!==id)}))} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--g)',color:'#fff',cursor:'pointer'}}>{getNombre(id)} ✕</span>)}</div>}
                        <button className="btn btn-s btn-sm" onClick={()=>setModalSelEtEdit(true)} style={{width:'100%',justifyContent:'center'}}>🏷 {editEj.etiquetas_ids.length>0?`${editEj.etiquetas_ids.length} seleccionadas · Cambiar`:'Seleccionar etiquetas'}</button>
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,marginTop:16,paddingTop:14,borderTop:'1px solid var(--bd)'}}>
                    <button className="btn btn-d btn-sm" onClick={()=>setEditando(false)} disabled={guardando}>Cancelar</button>
                    <div style={{flex:1}}/>
                    <button className="btn btn-p" onClick={actualizarEjercicio} disabled={guardando}>{guardando?(subiendoImg?'⏳ Subiendo...':'⏳ Guardando...'):'💾 Guardar cambios'}</button>
                  </div>
                </div>
              ):(
                /* ===== MODO VISTA ===== */
                <div style={{padding:16}}>
                  <div style={{display:'grid',gridTemplateColumns:'1.1fr 1fr',gap:18}}>
                    <div>
                      {(() => {
                        const img = varianteActiva>=0 ? (ejSeleccionado.variantes?.[varianteActiva]?.imagen_url || ejSeleccionado.imagen_url) : ejSeleccionado.imagen_url
                        return img?<img src={img} alt={ejSeleccionado.nombre} style={{width:'100%',height:300,objectFit:'contain',background:'var(--bm)',borderRadius:8,border:'1px solid var(--bd)'}}/>:<div style={{width:'100%',height:300,background:'var(--bm)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:56}}>💪</div>
                      })()}
                    </div>
                    <div>
                      {(ejSeleccionado.variantes||[]).length>0 && (
                        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12}}>
                          <button onClick={()=>setVarianteActiva(-1)} style={{fontSize:10,padding:'4px 11px',borderRadius:99,cursor:'pointer',fontFamily:'system-ui',border:`1.5px solid ${varianteActiva===-1?'var(--g)':'var(--bd)'}`,background:varianteActiva===-1?'var(--g)':'var(--w)',color:varianteActiva===-1?'#fff':'var(--gr)'}}>Principal</button>
                          {(ejSeleccionado.variantes||[]).map((v:any,i:number)=>(
                            <button key={i} onClick={()=>setVarianteActiva(i)} style={{fontSize:10,padding:'4px 11px',borderRadius:99,cursor:'pointer',fontFamily:'system-ui',border:`1.5px solid ${varianteActiva===i?'var(--g)':'var(--bd)'}`,background:varianteActiva===i?'var(--g)':'var(--w)',color:varianteActiva===i?'#fff':'var(--gr)'}}>{v.nombre||'Variante'}</button>
                          ))}
                        </div>
                      )}
                      {(() => {
                        const desc = varianteActiva>=0 ? (ejSeleccionado.variantes?.[varianteActiva]?.descripcion||'') : (ejSeleccionado.descripcion||'')
                        return desc ? <div style={{marginBottom:14}}><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>Descripción{varianteActiva>=0?` · ${ejSeleccionado.variantes[varianteActiva]?.nombre||''}`:''}</div><div style={{fontSize:12,color:'var(--n)',fontWeight:300,lineHeight:1.6}}>{desc}</div></div> : null
                      })()}
                      {(() => {
                        const vurl = varianteActiva>=0 ? (ejSeleccionado.variantes?.[varianteActiva]?.video_url||'') : (ejSeleccionado.video_url||'')
                        return vurl ? <a href={vurl} target="_blank" rel="noopener noreferrer" className="btn btn-s btn-sm" style={{marginBottom:14,display:'inline-flex'}}>🎥 Ver vídeo{varianteActiva>=0?` · ${ejSeleccionado.variantes[varianteActiva]?.nombre||''}`:''} ↗</a> : null
                      })()}
                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>Se mide en</div>
                        <span style={{fontSize:10,padding:'3px 10px',borderRadius:99,background:'var(--bl)',color:'var(--n)'}}>{ejSeleccionado.tipo_medida==='tiempo'?'⏱ Tiempo (segundos)':ejSeleccionado.tipo_medida==='peso_tiempo'?'🏋️⏱ Peso y tiempo':'🏋️ Peso y repeticiones'}</span>
                      </div>
                      <div>
                        <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>Etiquetas</div>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          {(ejSeleccionado.etiquetas||[]).map((id:string)=>{const et=etiquetas.find((e:any)=>e.id===id);return et?<span key={id} style={{fontSize:10,padding:'3px 10px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{et.nombre}</span>:null})}
                          {!(ejSeleccionado.etiquetas||[]).length&&<span style={{fontSize:10,color:'var(--grl)'}}>Sin etiquetas</span>}
                        </div>
                      </div>
                      {(ejSeleccionado.items_ejecucion||[]).length>0 && (
                        <div style={{marginTop:14}}>
                          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>Ejecución correcta</div>
                          {(ejSeleccionado.items_ejecucion||[]).map((it:any,i:number)=>(
                            <div key={i} style={{fontSize:11,color:'var(--n)',marginBottom:3,display:'flex',gap:6}}><span>✅</span><span>{it.texto}</span></div>
                          ))}
                        </div>
                      )}
                      {(ejSeleccionado.feedbacks||[]).length>0 && (
                        <div style={{marginTop:14}}>
                          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>Feedbacks</div>
                          {(ejSeleccionado.feedbacks||[]).map((fb:any,i:number)=>(
                            <div key={i} style={{fontSize:11,color:'var(--n)',marginBottom:3,display:'flex',gap:6}}><span>💬</span><span>{fb.texto}</span></div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {(()=>{
                    const variantes = ejercicios.filter((e:any)=>e.id!==ejSeleccionado.id&&(e.etiquetas||[]).some((et:string)=>(ejSeleccionado.etiquetas||[]).includes(et))).slice(0,6)
                    return variantes.length>0?(
                      <div style={{marginTop:18,paddingTop:14,borderTop:'1px solid var(--bd)'}}>
                        <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:8}}>Ejercicios similares</div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:6}}>
                          {variantes.map((v:any)=>(
                            <div key={v.id} onClick={()=>{setEjSeleccionado(v);setEditando(false)}} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:6,border:'1px solid var(--bd)',cursor:'pointer',background:'var(--bl)'}}
                              onMouseOver={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                              onMouseOut={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                              <div style={{width:36,height:36,background:'var(--bm)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
                                {v.imagen_url?<img src={v.imagen_url} alt={v.nombre} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<span>💪</span>}
                              </div>
                              <span style={{fontSize:10,color:'var(--n)',flex:1,fontWeight:300}}>{v.nombre}</span>
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
              {editEj.etiquetas_ids.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setEditEj(p=>({...p,etiquetas_ids:[]}))}>✕ Limpiar</button>}
              <button onClick={()=>setModalSelEtEdit(false)} style={{background:'var(--g)',color:'#fff',border:'none',borderRadius:'var(--r)',padding:'6px 16px',fontSize:11,cursor:'pointer',fontFamily:'system-ui'}}>Confirmar{editEj.etiquetas_ids.length>0?` (${editEj.etiquetas_ids.length})`:''}</button>
            </div>
            <div style={{flex:1,overflow:'hidden',padding:1}}><SelectorColumnas seleccionadas={editEj.etiquetas_ids} onChange={(ids:string[])=>setEditEj(p=>({...p,etiquetas_ids:ids}))}/></div>
          </div>
        </div>
      )}

      {/* MODAL FILTRO */}
      {modalFiltro&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalFiltro(false)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'96vw',maxWidth:1200,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10,background:'var(--bl)'}}>
              <div style={{flex:1,fontSize:13,fontWeight:400,color:'var(--n)'}}>Filtrar por etiquetas</div>
              {filtroEtiquetas.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setFiltroEtiquetas([])}>✕ Limpiar</button>}
              <button onClick={()=>setModalFiltro(false)} style={{background:'var(--g)',color:'#fff',border:'none',borderRadius:'var(--r)',padding:'6px 16px',fontSize:11,cursor:'pointer',fontFamily:'system-ui'}}>Aplicar{filtroEtiquetas.length>0?` (${filtroEtiquetas.length})`:''}</button>
            </div>
            <div style={{flex:1,overflow:'hidden',padding:1}}><SelectorColumnas seleccionadas={filtroEtiquetas} onChange={setFiltroEtiquetas}/></div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO EJERCICIO */}
      {modalEj&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)setModalEj(false)}}>
          <div className="modal" style={{width:480}}>
            <div className="modal-title">Nuevo ejercicio<button className="modal-close" onClick={()=>setModalEj(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevoEj.nombre} onChange={e=>setNuevoEj(p=>({...p,nombre:e.target.value}))} autoFocus disabled={guardando}/></div>
            <div className="field"><label>Descripción</label><textarea className="input" value={nuevoEj.descripcion} onChange={e=>setNuevoEj(p=>({...p,descripcion:e.target.value}))} disabled={guardando}/></div>
            <div className="field"><label>Enlace vídeo</label><input className="input" value={nuevoEj.video_url} onChange={e=>setNuevoEj(p=>({...p,video_url:e.target.value}))} disabled={guardando}/></div>
            <div className="field"><label>Se mide en</label><select className="input" value={nuevoEj.tipo_medida} onChange={e=>setNuevoEj(p=>({...p,tipo_medida:e.target.value}))} disabled={guardando}><option value="peso_reps">Peso y repeticiones</option><option value="tiempo">Tiempo (segundos)</option><option value="peso_tiempo">Peso y tiempo</option></select></div>
            <EditorVariantes variantes={nuevoEj.variantes} onChange={(v:any[])=>setNuevoEj(p=>({...p,variantes:v}))} disabled={guardando}/>
            <EditorLista items={nuevoEj.items_ejecucion} onChange={(v:any[])=>setNuevoEj(p=>({...p,items_ejecucion:v}))} disabled={guardando} label="Ítems de ejecución correcta" placeholder="ej. Rodillas alineadas con los pies" icono="✅"/>
            <EditorLista items={nuevoEj.feedbacks} onChange={(v:any[])=>setNuevoEj(p=>({...p,feedbacks:v}))} disabled={guardando} label="Feedbacks" placeholder="ej. Mete el core" icono="💬"/>
            <div className="field">
              <label>Imagen</label>
              <div style={{display:'flex',alignItems:'center',gap:10,marginTop:4}}>
                {nuevoEj.imagen_url?<div style={{position:'relative'}}><img src={nuevoEj.imagen_url} alt="preview" style={{width:80,height:80,objectFit:'cover',borderRadius:6}}/><button onClick={()=>setNuevoEj(p=>({...p,imagen_url:'',imagen_file:null}))} style={{position:'absolute',top:-6,right:-6,width:18,height:18,borderRadius:'50%',background:'var(--red)',color:'#fff',border:'none',cursor:'pointer',fontSize:9}}>✕</button></div>:<div style={{width:80,height:80,background:'var(--bm)',borderRadius:6,border:'1.5px dashed var(--bd)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>💪</div>}
                <label style={{cursor:'pointer'}}><div className="btn btn-s btn-sm">📷 Subir imagen</div><input type="file" accept="image/*" onChange={handleImagenEjercicio} style={{display:'none'}} disabled={guardando}/></label>
              </div>
            </div>
            <div className="field">
              <label>Etiquetas</label>
              {nuevoEj.etiquetas_ids.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:6}}>{nuevoEj.etiquetas_ids.map(id=><span key={id} onClick={()=>setNuevoEj(p=>({...p,etiquetas_ids:p.etiquetas_ids.filter(x=>x!==id)}))} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--g)',color:'#fff',cursor:'pointer'}}>{getNombre(id)} ✕</span>)}</div>}
              <button className="btn btn-s btn-sm" onClick={()=>setModalSelEt(true)} style={{width:'100%',justifyContent:'center'}}>🏷 {nuevoEj.etiquetas_ids.length>0?`${nuevoEj.etiquetas_ids.length} seleccionadas · Cambiar`:'Seleccionar etiquetas'}</button>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEj(false)} disabled={guardando}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearEjercicio} disabled={guardando}>{guardando?(subiendoImg?'⏳ Subiendo...':'⏳ Guardando...'):'💾 Guardar'}</button>
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
              {nuevoEj.etiquetas_ids.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setNuevoEj(p=>({...p,etiquetas_ids:[]}))}>✕ Limpiar</button>}
              <button onClick={()=>setModalSelEt(false)} style={{background:'var(--g)',color:'#fff',border:'none',borderRadius:'var(--r)',padding:'6px 16px',fontSize:11,cursor:'pointer',fontFamily:'system-ui'}}>Confirmar{nuevoEj.etiquetas_ids.length>0?` (${nuevoEj.etiquetas_ids.length})`:''}</button>
            </div>
            <div style={{flex:1,overflow:'hidden',padding:1}}><SelectorColumnas seleccionadas={nuevoEj.etiquetas_ids} onChange={(ids:string[])=>setNuevoEj(p=>({...p,etiquetas_ids:ids}))}/></div>
          </div>
        </div>
      )}
    </>
  )
}
