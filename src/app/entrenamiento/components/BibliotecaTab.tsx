'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function BibliotecaTab({ ejercicios, etiquetas, cargar, getNombre, SelectorColumnas }: any) {
  const [buscar, setBuscar] = useState('')
  const [filtroEtiquetas, setFiltroEtiquetas] = useState<string[]>([])
  const [modalFiltro, setModalFiltro] = useState(false)
  const [modalEj, setModalEj] = useState(false)
  const [ejSeleccionado, setEjSeleccionado] = useState<any>(null)
  const [guardando, setGuardando] = useState(false)
  const [subiendoImg, setSubiendoImg] = useState(false)
  const [modalSelEt, setModalSelEt] = useState(false)
  const [nuevoEj, setNuevoEj] = useState({ nombre:'', descripcion:'', video_url:'', imagen_url:'', etiquetas_ids:[] as string[], imagen_file:null as File|null })

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

  async function crearEjercicio() {
    if (guardando) return
    if (!nuevoEj.nombre) { alert('El nombre es obligatorio'); return }
    setGuardando(true); setSubiendoImg(true)
    const { data: ejData, error } = await supabase.from('ejercicios').insert({ nombre:nuevoEj.nombre, descripcion:nuevoEj.descripcion, video_url:nuevoEj.video_url, etiquetas:nuevoEj.etiquetas_ids, imagen_url:'' }).select().single()
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
    setNuevoEj({ nombre:'', descripcion:'', video_url:'', imagen_url:'', etiquetas_ids:[], imagen_file:null })
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

      {/* PANEL LATERAL EJERCICIO */}
      {ejSeleccionado&&(
        <>
          <div onClick={()=>setEjSeleccionado(null)} style={{position:'fixed',inset:0,background:'rgba(38,40,37,.16)',zIndex:48}}/>
          <div style={{position:'fixed',top:0,right:0,width:360,height:'100vh',background:'var(--w)',borderLeft:'1px solid var(--bd)',zIndex:49,display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(38,40,37,.08)'}}>
            <div style={{padding:'12px 14px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1,fontSize:13,fontWeight:400,color:'var(--n)'}}>{ejSeleccionado.nombre}</div>
              <button onClick={()=>setEjSeleccionado(null)} style={{width:24,height:24,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontSize:12,color:'var(--gr)'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto'}}>
              {ejSeleccionado.imagen_url?<img src={ejSeleccionado.imagen_url} alt={ejSeleccionado.nombre} style={{width:'100%',height:200,objectFit:'contain',background:'var(--bm)'}}/>:<div style={{height:160,background:'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:48}}>💪</div>}
              <div style={{padding:14}}>
                {ejSeleccionado.descripcion&&<div style={{marginBottom:12}}><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Descripción</div><div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.6}}>{ejSeleccionado.descripcion}</div></div>}
                {ejSeleccionado.video_url&&<a href={ejSeleccionado.video_url} target="_blank" rel="noopener noreferrer" className="btn btn-s btn-sm" style={{marginBottom:12,display:'inline-flex'}}>🎥 Ver vídeo</a>}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Etiquetas</div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {(ejSeleccionado.etiquetas||[]).map((id:string)=>{const et=etiquetas.find((e:any)=>e.id===id);return et?<span key={id} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{et.nombre}</span>:null})}
                    {!(ejSeleccionado.etiquetas||[]).length&&<span style={{fontSize:10,color:'var(--grl)'}}>Sin etiquetas</span>}
                  </div>
                </div>
                {(()=>{
                  const variantes = ejercicios.filter((e:any)=>e.id!==ejSeleccionado.id&&(e.etiquetas||[]).some((et:string)=>(ejSeleccionado.etiquetas||[]).includes(et))).slice(0,5)
                  return variantes.length>0?(
                    <div>
                      <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:8}}>Ejercicios similares</div>
                      {variantes.map((v:any)=>(
                        <div key={v.id} onClick={()=>setEjSeleccionado(v)} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:6,border:'1px solid var(--bd)',marginBottom:4,cursor:'pointer',background:'var(--bl)'}}
                          onMouseOver={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                          onMouseOut={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                          <div style={{width:36,height:36,background:'var(--bm)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
                            {v.imagen_url?<img src={v.imagen_url} alt={v.nombre} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<span>💪</span>}
                          </div>
                          <span style={{fontSize:11,color:'var(--n)',flex:1,fontWeight:300}}>{v.nombre}</span>
                          <span style={{fontSize:12,color:'var(--grl)'}}>›</span>
                        </div>
                      ))}
                    </div>
                  ):null
                })()}
              </div>
            </div>
          </div>
        </>
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
