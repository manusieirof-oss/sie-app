'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const CATEGORIAS = [
  { key: 'musculo', label: '💪 Músculo' },
  { key: 'articulacion', label: '🦴 Articulación' },
  { key: 'movimiento', label: '🔄 Movimiento' },
  { key: 'posicion', label: '📍 Posición' },
  { key: 'material', label: '🏋 Material' },
  { key: 'apoyo', label: '🦶 Apoyo' },
  { key: 'agarre', label: '✋ Agarre' },
  { key: 'patologia', label: '🏥 Patología' },
]

export default function EntrenamientoPage() {
  const [tab, setTab] = useState('biblioteca')
  const [ejercicios, setEjercicios] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [sesiones, setSesiones] = useState<any[]>([])
  const [etiquetas, setEtiquetas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [filtroEtiquetas, setFiltroEtiquetas] = useState<string[]>([])
  const [modalFiltro, setModalFiltro] = useState(false)
  const [modalEj, setModalEj] = useState(false)
  const [modalSes, setModalSes] = useState(false)
  const [modalEtiqueta, setModalEtiqueta] = useState(false)
  const [modalSelEt, setModalSelEt] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [subsubAbiertas, setSubsubAbiertas] = useState<string[]>([])
  const [nuevoEj, setNuevoEj] = useState({ nombre:'', descripcion:'', video_url:'', etiquetas_ids:[] as string[] })
  const [nuevaSes, setNuevaSes] = useState({ paciente_id:'', nombre:'', descripcion:'', partes:[{nombre:'Calentamiento',ejercicios:[] as string[]},{nombre:'Parte principal',ejercicios:[] as string[]},{nombre:'Vuelta a la calma',ejercicios:[] as string[]}] })
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState({ categoria:'musculo', nombre:'', padre_id:'' })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: e },{ data: p },{ data: s },{ data: et }] = await Promise.all([
      supabase.from('ejercicios').select('*').order('nombre'),
      supabase.from('pacientes').select('id,nombre,apellidos').eq('estado','activo').order('nombre'),
      supabase.from('sesiones').select('*, pacientes(nombre,apellidos)').order('created_at',{ascending:false}).limit(20),
      supabase.from('etiquetas').select('*').order('categoria').order('nombre'),
    ])
    setEjercicios(e||[]); setPacientes(p||[]); setSesiones(s||[]); setEtiquetas(et||[])
    setLoading(false)
  }

  function getNivel1(cat: string) { return etiquetas.filter(e=>e.categoria===cat && !e.padre_id) }
  function getSubs(padreId: string) { return etiquetas.filter(e=>e.padre_id===padreId) }
  function getNombre(id: string) {
    const et = etiquetas.find(e=>e.id===id)
    if (!et) return ''
    if (et.padre_id) {
      const padre = etiquetas.find(e=>e.id===et.padre_id)
      if (padre?.padre_id) {
        const abuelo = etiquetas.find(e=>e.id===padre.padre_id)
        return `${abuelo?.nombre} › ${padre?.nombre} › ${et.nombre}`
      }
      return `${padre?.nombre} › ${et.nombre}`
    }
    return et.nombre
  }

  function toggle(id: string, lista: string[], setLista: (v:string[])=>void) {
    setLista(lista.includes(id) ? lista.filter(x=>x!==id) : [...lista, id])
  }

  function toggleSubsub(id: string) {
    setSubsubAbiertas(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])
  }

  // COMPONENTE SELECTOR DE ETIQUETAS EN COLUMNAS
  function SelectorColumnas({ seleccionadas, onChange }: { seleccionadas: string[], onChange: (v:string[])=>void }) {
    return (
      <div style={{overflowX:'auto',overflowY:'auto',maxHeight:'65vh'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(8,minmax(140px,1fr))',gap:1,background:'var(--bm)',minWidth:1100}}>
          {CATEGORIAS.map(cat=>{
            const nivel1 = getNivel1(cat.key)
            const selCount = etiquetas.filter(e=>e.categoria===cat.key && seleccionadas.includes(e.id)).length
            return (
              <div key={cat.key} style={{background:'var(--w)',display:'flex',flexDirection:'column'}}>
                {/* CABECERA CATEGORÍA */}
                <div style={{padding:'8px 10px',background:'var(--n)',position:'sticky',top:0}}>
                  <div style={{fontSize:10,fontWeight:500,color:'#fff'}}>{cat.label}</div>
                  {selCount>0 && <div style={{fontSize:8,color:'var(--gm)',marginTop:1}}>{selCount} seleccionadas</div>}
                </div>
                {/* ETIQUETAS */}
                <div style={{padding:'6px 6px',flex:1,overflowY:'auto'}}>
                  {nivel1.map(et=>{
                    const subs = getSubs(et.id)
                    const sel = seleccionadas.includes(et.id)
                    return (
                      <div key={et.id} style={{marginBottom:4}}>
                        {/* NIVEL 1 */}
                        <div onClick={(e)=>{e.preventDefault();toggle(et.id,seleccionadas,onChange)}}
                          style={{display:'flex',alignItems:'center',gap:5,padding:'4px 6px',borderRadius:4,cursor:'pointer',background:sel?'var(--g)':'transparent',color:sel?'#fff':'var(--n)',transition:'all .1s',marginBottom:1}}
                          onMouseOver={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='var(--gl)'}}
                          onMouseOut={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                          <div style={{width:12,height:12,borderRadius:2,border:`1.5px solid ${sel?'rgba(255,255,255,.6)':'var(--bd)'}`,background:sel?'rgba(255,255,255,.2)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            {sel && <span style={{fontSize:8,color:'#fff',fontWeight:700}}>✓</span>}
                          </div>
                          <span style={{fontSize:10,fontWeight:sel?500:400}}>{et.nombre}</span>
                        </div>
                        {/* NIVEL 2 — siempre visible */}
                        {subs.length>0 && (
                          <div style={{marginLeft:8,borderLeft:'1.5px solid var(--bm)',paddingLeft:6}}>
                            {subs.map(sub=>{
                              const subsubs = getSubs(sub.id)
                              const selSub = seleccionadas.includes(sub.id)
                              const subsubAbierta = subsubAbiertas.includes(sub.id)
                              return (
                                <div key={sub.id} style={{marginBottom:2}}>
                                  <div style={{display:'flex',alignItems:'center',gap:3}}>
                                    <div onClick={(e)=>{e.preventDefault();toggle(sub.id,seleccionadas,onChange)}}
                                      style={{display:'flex',alignItems:'center',gap:4,padding:'3px 5px',borderRadius:3,cursor:'pointer',flex:1,background:selSub?'var(--g)':'transparent',color:selSub?'#fff':'var(--gr)',transition:'all .1s'}}
                                      onMouseOver={e=>{if(!selSub)(e.currentTarget as HTMLElement).style.background='var(--gl)'}}
                                      onMouseOut={e=>{if(!selSub)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                                      <div style={{width:10,height:10,borderRadius:2,border:`1px solid ${selSub?'rgba(255,255,255,.6)':'var(--bd)'}`,background:selSub?'rgba(255,255,255,.2)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                        {selSub && <span style={{fontSize:7,color:'#fff',fontWeight:700}}>✓</span>}
                                      </div>
                                      <span style={{fontSize:9,fontWeight:300}}>{sub.nombre}</span>
                                    </div>
                                    {subsubs.length>0 && (
                                      <div onClick={()=>toggleSubsub(sub.id)} style={{fontSize:8,color:'var(--grl)',cursor:'pointer',padding:'2px 3px',transform:subsubAbierta?'rotate(90deg)':'',transition:'transform .15s'}}>›</div>
                                    )}
                                  </div>
                                  {/* NIVEL 3 — solo si se expande */}
                                  {subsubs.length>0 && subsubAbierta && (
                                    <div style={{marginLeft:10,borderLeft:'1.5px solid var(--bm)',paddingLeft:5}}>
                                      {subsubs.map(ss=>{
                                        const selSS = seleccionadas.includes(ss.id)
                                        return (
                                          <div key={ss.id} onClick={(e)=>{e.preventDefault();toggle(ss.id,seleccionadas,onChange)}}
                                            style={{display:'flex',alignItems:'center',gap:4,padding:'2px 4px',borderRadius:3,cursor:'pointer',background:selSS?'var(--g)':'transparent',color:selSS?'#fff':'var(--grl)',transition:'all .1s',marginBottom:1}}
                                            onMouseOver={e=>{if(!selSS)(e.currentTarget as HTMLElement).style.background='var(--gl)'}}
                                            onMouseOut={e=>{if(!selSS)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                                            <div style={{width:8,height:8,borderRadius:1,border:`1px solid ${selSS?'rgba(255,255,255,.6)':'var(--bd)'}`,background:selSS?'rgba(255,255,255,.2)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                              {selSS && <span style={{fontSize:6,color:'#fff',fontWeight:700}}>✓</span>}
                                            </div>
                                            <span style={{fontSize:8,fontWeight:300}}>{ss.nombre}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  async function crearEjercicio() {
    if (guardando) return
    if (!nuevoEj.nombre) { alert('El nombre es obligatorio'); return }
    setGuardando(true)
    await supabase.from('ejercicios').insert({ nombre:nuevoEj.nombre, descripcion:nuevoEj.descripcion, video_url:nuevoEj.video_url, etiquetas:nuevoEj.etiquetas_ids })
    setModalEj(false); setNuevoEj({ nombre:'', descripcion:'', video_url:'', etiquetas_ids:[] }); setGuardando(false); cargar()
  }

  async function crearSesion() {
    if (!nuevaSes.paciente_id || !nuevaSes.nombre) { alert('Selecciona paciente y pon un nombre'); return }
    await supabase.from('sesiones').insert({ paciente_id:nuevaSes.paciente_id, nombre:nuevaSes.nombre, descripcion:nuevaSes.descripcion, partes:nuevaSes.partes, estado:'lista' })
    setModalSes(false); setNuevaSes({ paciente_id:'', nombre:'', descripcion:'', partes:[{nombre:'Calentamiento',ejercicios:[]},{nombre:'Parte principal',ejercicios:[]},{nombre:'Vuelta a la calma',ejercicios:[]}] }); cargar()
  }

  async function crearEtiqueta() {
    if (!nuevaEtiqueta.nombre) { alert('Escribe el nombre'); return }
    await supabase.from('etiquetas').insert({ categoria:nuevaEtiqueta.categoria, nombre:nuevaEtiqueta.nombre, padre_id:nuevaEtiqueta.padre_id||null })
    setModalEtiqueta(false); setNuevaEtiqueta({ categoria:'musculo', nombre:'', padre_id:'' }); cargar()
  }

  async function cambiarEstado(id: string, estado: string) {
    await supabase.from('sesiones').update({ estado }).eq('id',id); cargar()
  }

  const filtrados = ejercicios.filter(e=>{
    const matchQ = !buscar || e.nombre.toLowerCase().includes(buscar.toLowerCase()) || (e.descripcion||'').toLowerCase().includes(buscar.toLowerCase())
    const matchEt = filtroEtiquetas.length===0 || filtroEtiquetas.every(fid=>(e.etiquetas||[]).includes(fid))
    return matchQ && matchEt
  })

  return (
    <>
      <div className="tabs">
        {[['biblioteca','📚 Biblioteca'],['sesiones','📋 Sesiones'],['etiquetas','🏷 Etiquetas']].map(([k,l])=>(
          <button key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {/* BIBLIOTECA */}
      {tab==='biblioteca' && (
        <>
          <div style={{display:'flex',gap:8,marginBottom:8,alignItems:'center',flexWrap:'wrap'}}>
            <input className="input" placeholder="🔍 Buscar ejercicio..." value={buscar} onChange={e=>setBuscar(e.target.value)} style={{flex:1,minWidth:200}}/>
            <button className="btn btn-s" onClick={()=>setModalFiltro(true)} style={{position:'relative'}}>
              🏷 Filtrar por etiquetas
              {filtroEtiquetas.length>0 && <span style={{position:'absolute',top:-6,right:-6,width:18,height:18,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:9,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>{filtroEtiquetas.length}</span>}
            </button>
            {filtroEtiquetas.length>0 && <button className="btn btn-t btn-sm" onClick={()=>setFiltroEtiquetas([])}>✕ Limpiar</button>}
            <span style={{fontSize:10,color:'var(--grl)'}}>{filtrados.length} ejercicios</span>
            <button className="btn btn-p btn-sm" onClick={()=>setModalEj(true)}>+ Nuevo ejercicio</button>
          </div>

          {/* CHIPS FILTROS ACTIVOS */}
          {filtroEtiquetas.length>0 && (
            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
              {filtroEtiquetas.map(id=>(
                <span key={id} onClick={()=>setFiltroEtiquetas(f=>f.filter(x=>x!==id))} style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--g)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                  {getNombre(id)} <span style={{fontSize:10,opacity:.7}}>✕</span>
                </span>
              ))}
            </div>
          )}

          {loading?<div className="loading">Cargando...</div>:filtrados.length===0?(
            <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>
              {ejercicios.length===0?'No hay ejercicios. Crea el primero con + Nuevo ejercicio.':'Sin resultados para esta búsqueda.'}
            </div>
          ):(
            <div className="g3">
              {filtrados.map(e=>{
                const etsDelEj = (e.etiquetas||[]).map((id:string)=>etiquetas.find(et=>et.id===id)).filter(Boolean)
                return (
                  <div key={e.id} style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',cursor:'pointer',transition:'border-color .15s'}}
                    onMouseOver={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                    onMouseOut={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                    <div style={{height:56,background:'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,borderBottom:'1px solid var(--bd)'}}>💪</div>
                    <div style={{padding:'8px 10px'}}>
                      <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:4}}>{e.nombre}</div>
                      {e.descripcion&&<div style={{fontSize:9,color:'var(--grl)',marginBottom:5,fontWeight:300,lineHeight:1.4}}>{e.descripcion.slice(0,80)}{e.descripcion.length>80?'...':''}</div>}
                      <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                        {etsDelEj.slice(0,4).map((et:any)=>(
                          <span key={et.id} style={{fontSize:8,padding:'1px 6px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{et.nombre}</span>
                        ))}
                        {etsDelEj.length>4&&<span style={{fontSize:8,color:'var(--grl)'}}>+{etsDelEj.length-4}</span>}
                      </div>
                      {e.video_url&&<a href={e.video_url} target="_blank" rel="noopener noreferrer" style={{fontSize:9,color:'var(--g)',display:'block',marginTop:5}}>🎥 Ver vídeo ↗</a>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* SESIONES */}
      {tab==='sesiones' && (
        <>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <button className="btn btn-p btn-sm" onClick={()=>setModalSes(true)}>+ Nueva sesión</button>
          </div>
          {loading?<div className="loading">Cargando...</div>:sesiones.length===0?(
            <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>Sin sesiones. Crea la primera con + Nueva sesión.</div>
          ):sesiones.map(s=>(
            <div key={s.id} className="card">
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:400,color:'var(--n)',marginBottom:2}}>{s.nombre}</div>
                  <div style={{fontSize:10,color:'var(--grl)',fontWeight:300}}>{s.pacientes?.nombre} {s.pacientes?.apellidos} · {new Date(s.created_at).toLocaleDateString('es-ES')}</div>
                  {s.descripcion&&<div style={{fontSize:10,color:'var(--gr)',marginTop:3}}>{s.descripcion}</div>}
                </div>
                <div style={{display:'flex',gap:5,flexDirection:'column',alignItems:'flex-end'}}>
                  <span className={`badge ${s.estado==='realizada'?'badge-g':s.estado==='lista'?'badge-pen':'badge-b'}`}>{s.estado}</span>
                  {s.estado!=='realizada'&&<button className="btn btn-t btn-sm" onClick={()=>cambiarEstado(s.id,'realizada')}>✓ Realizada</button>}
                </div>
              </div>
              {(s.partes||[]).map((parte:any,pi:number)=>(
                <div key={pi} style={{marginTop:8,background:'var(--bl)',borderRadius:6,overflow:'hidden',border:'1px solid var(--bd)'}}>
                  <div style={{padding:'5px 10px',background:'var(--bl)',borderBottom:'1px solid var(--bm)',fontSize:10,fontWeight:500,color:'var(--n)'}}>{parte.nombre}</div>
                  {(parte.ejercicios||[]).map((ej:string,ei:number)=>(
                    <div key={ei} style={{padding:'4px 10px',fontSize:10,color:'var(--n)',fontWeight:300,borderBottom:'1px solid var(--bl)'}}>{ej}</div>
                  ))}
                  {(parte.ejercicios||[]).length===0&&<div style={{padding:'4px 10px',fontSize:9,color:'var(--grl)'}}>Sin ejercicios</div>}
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* ETIQUETAS */}
      {tab==='etiquetas' && (
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontSize:11,color:'var(--grl)',fontWeight:300}}>{etiquetas.length} etiquetas en total</div>
            <button className="btn btn-p btn-sm" onClick={()=>setModalEtiqueta(true)}>+ Nueva etiqueta</button>
          </div>
          <div style={{overflowX:'auto'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(8,minmax(160px,1fr))',gap:8,minWidth:1100}}>
              {CATEGORIAS.map(cat=>{
                const nivel1 = getNivel1(cat.key)
                return (
                  <div key={cat.key} className="card" style={{padding:0,overflow:'hidden'}}>
                    <div style={{padding:'8px 11px',background:'var(--n)',borderBottom:'1px solid var(--bd)'}}>
                      <div style={{fontSize:10,fontWeight:500,color:'#fff'}}>{cat.label}</div>
                      <div style={{fontSize:8,color:'var(--gm)',marginTop:1}}>{nivel1.length} etiquetas</div>
                    </div>
                    <div style={{padding:'8px 10px'}}>
                      {nivel1.map(et=>{
                        const subs = getSubs(et.id)
                        return (
                          <div key={et.id} style={{marginBottom:6}}>
                            <div style={{fontSize:10,fontWeight:400,color:'var(--n)'}}>{et.nombre}</div>
                            {subs.length>0&&(
                              <div style={{marginLeft:8,borderLeft:'1.5px solid var(--bm)',paddingLeft:6,marginTop:2}}>
                                {subs.map(sub=>{
                                  const subsubs = getSubs(sub.id)
                                  return (
                                    <div key={sub.id} style={{marginBottom:2}}>
                                      <div style={{fontSize:9,fontWeight:300,color:'var(--gr)'}}>{sub.nombre}</div>
                                      {subsubs.length>0&&(
                                        <div style={{marginLeft:7,borderLeft:'1px solid var(--bm)',paddingLeft:5}}>
                                          {subsubs.map(ss=>(
                                            <div key={ss.id} style={{fontSize:8,fontWeight:300,color:'var(--grl)'}}>{ss.nombre}</div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* MODAL FILTRO ETIQUETAS */}
      {modalFiltro && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalFiltro(false)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'96vw',maxWidth:1200,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10,background:'var(--bl)'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:400,color:'var(--n)'}}>Filtrar por etiquetas</div>
                <div style={{fontSize:10,color:'var(--grl)',fontWeight:300}}>Pulsa para seleccionar · Las subsubetiquetas se expanden con ›</div>
              </div>
              {filtroEtiquetas.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setFiltroEtiquetas([])}>✕ Limpiar todo</button>}
              <button onClick={()=>setModalFiltro(false)} style={{background:'var(--g)',color:'#fff',border:'none',borderRadius:'var(--r)',padding:'6px 16px',fontSize:11,cursor:'pointer',fontFamily:'system-ui',fontWeight:500}}>
                Aplicar{filtroEtiquetas.length>0?` (${filtroEtiquetas.length})`:''}
              </button>
            </div>
            <div style={{flex:1,overflow:'hidden',padding:1}}>
              <SelectorColumnas seleccionadas={filtroEtiquetas} onChange={setFiltroEtiquetas}/>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO EJERCICIO */}
      {modalEj && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)setModalEj(false)}}>
          <div className="modal" style={{width:480}}>
            <div className="modal-title">Nuevo ejercicio<button className="modal-close" onClick={()=>setModalEj(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevoEj.nombre} onChange={e=>setNuevoEj(p=>({...p,nombre:e.target.value}))} placeholder="ej. Curl de bíceps" autoFocus disabled={guardando}/></div>
            <div className="field"><label>Descripción motriz</label><textarea className="input" value={nuevoEj.descripcion} onChange={e=>setNuevoEj(p=>({...p,descripcion:e.target.value}))} placeholder="Descripción del movimiento, puntos clave de ejecución..." disabled={guardando}/></div>
            <div className="field"><label>Enlace vídeo</label><input className="input" value={nuevoEj.video_url} onChange={e=>setNuevoEj(p=>({...p,video_url:e.target.value}))} placeholder="https://youtube.com/..." disabled={guardando}/></div>
            <div className="field">
              <label>Etiquetas</label>
              {nuevoEj.etiquetas_ids.length>0 && (
                <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:6}}>
                  {nuevoEj.etiquetas_ids.map(id=>(
                    <span key={id} onClick={()=>setNuevoEj(p=>({...p,etiquetas_ids:p.etiquetas_ids.filter(x=>x!==id)}))} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--g)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                      {getNombre(id)} <span style={{opacity:.7}}>✕</span>
                    </span>
                  ))}
                </div>
              )}
              <button className="btn btn-s btn-sm" onClick={()=>setModalSelEt(true)} style={{width:'100%',justifyContent:'center'}}>
                🏷 {nuevoEj.etiquetas_ids.length>0?`${nuevoEj.etiquetas_ids.length} etiquetas seleccionadas · Cambiar`:'Seleccionar etiquetas'}
              </button>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEj(false)} disabled={guardando}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearEjercicio} disabled={guardando}>{guardando?'⏳ Guardando...':'💾 Guardar ejercicio'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SELECTOR ETIQUETAS PARA EJERCICIO */}
      {modalSelEt && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalSelEt(false)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'96vw',maxWidth:1200,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10,background:'var(--bl)'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:400,color:'var(--n)'}}>Seleccionar etiquetas del ejercicio</div>
                <div style={{fontSize:10,color:'var(--grl)',fontWeight:300}}>{nuevoEj.etiquetas_ids.length} seleccionadas</div>
              </div>
              {nuevoEj.etiquetas_ids.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setNuevoEj(p=>({...p,etiquetas_ids:[]}))}>✕ Limpiar</button>}
              <button onClick={()=>setModalSelEt(false)} style={{background:'var(--g)',color:'#fff',border:'none',borderRadius:'var(--r)',padding:'6px 16px',fontSize:11,cursor:'pointer',fontFamily:'system-ui',fontWeight:500}}>
                Confirmar{nuevoEj.etiquetas_ids.length>0?` (${nuevoEj.etiquetas_ids.length})`:''}
              </button>
            </div>
            <div style={{flex:1,overflow:'hidden',padding:1}}>
              <SelectorColumnas seleccionadas={nuevoEj.etiquetas_ids} onChange={ids=>setNuevoEj(p=>({...p,etiquetas_ids:ids}))}/>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA SESIÓN */}
      {modalSes && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalSes(false)}}>
          <div className="modal" style={{width:500}}>
            <div className="modal-title">Nueva sesión<button className="modal-close" onClick={()=>setModalSes(false)}>✕</button></div>
            <div className="field"><label>Paciente *</label>
              <select className="input" value={nuevaSes.paciente_id} onChange={e=>setNuevaSes(p=>({...p,paciente_id:e.target.value}))}>
                <option value="">Seleccionar paciente...</option>
                {pacientes.map(p=><option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>)}
              </select>
            </div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevaSes.nombre} onChange={e=>setNuevaSes(p=>({...p,nombre:e.target.value}))} placeholder="ej. Fuerza cuádriceps · Fase 1"/></div>
            <div className="field"><label>Descripción / objetivo</label><input className="input" value={nuevaSes.descripcion} onChange={e=>setNuevaSes(p=>({...p,descripcion:e.target.value}))} placeholder="ej. Sesión enfocada en tren inferior sin impacto"/></div>
            {nuevaSes.partes.map((parte,pi)=>(
              <div key={pi} style={{marginBottom:8,border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden'}}>
                <div style={{padding:'7px 10px',background:'var(--bl)',borderBottom:'1px solid var(--bd)',fontSize:10,fontWeight:500}}>{parte.nombre}</div>
                <div style={{padding:8}}>
                  <textarea className="input" style={{minHeight:56,fontSize:11}} placeholder="Un ejercicio por línea&#10;ej: Curl bíceps · 3×12 · 8kg"
                    onChange={e=>setNuevaSes(prev=>{const p=[...prev.partes];p[pi]={...p[pi],ejercicios:e.target.value.split('\n').filter(Boolean)};return{...prev,partes:p}})}/>
                </div>
              </div>
            ))}
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalSes(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearSesion}>💾 Guardar sesión</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA ETIQUETA */}
      {modalEtiqueta && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalEtiqueta(false)}}>
          <div className="modal">
            <div className="modal-title">Nueva etiqueta<button className="modal-close" onClick={()=>setModalEtiqueta(false)}>✕</button></div>
            <div className="field"><label>Categoría</label>
              <select className="input" value={nuevaEtiqueta.categoria} onChange={e=>setNuevaEtiqueta(p=>({...p,categoria:e.target.value,padre_id:''}))}>
                {CATEGORIAS.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div className="field"><label>Etiqueta padre (si es subetiqueta)</label>
              <select className="input" value={nuevaEtiqueta.padre_id} onChange={e=>setNuevaEtiqueta(p=>({...p,padre_id:e.target.value}))}>
                <option value="">— Es etiqueta principal —</option>
                {etiquetas.filter(e=>e.categoria===nuevaEtiqueta.categoria).map(e=>{
                  const prefijo = e.padre_id?(etiquetas.find(p=>p.id===e.padre_id)?.nombre||'')+' › ':''
                  return <option key={e.id} value={e.id}>{prefijo}{e.nombre}</option>
                })}
              </select>
            </div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevaEtiqueta.nombre} onChange={e=>setNuevaEtiqueta(p=>({...p,nombre:e.target.value}))} placeholder="ej. Bíceps Femoral" autoFocus/></div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEtiqueta(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearEtiqueta}>💾 Guardar etiqueta</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
