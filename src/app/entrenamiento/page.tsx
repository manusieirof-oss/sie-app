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
  const [modalEj, setModalEj] = useState(false)
  const [modalSes, setModalSes] = useState(false)
  const [modalEtiqueta, setModalEtiqueta] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [catAbierta, setCatAbierta] = useState<string[]>([])
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

  function getEtiquetasPorCategoria(cat: string) {
    return etiquetas.filter(e=>e.categoria===cat && e.padre_id===null)
  }

  function getSubetiquetas(padreId: string) {
    return etiquetas.filter(e=>e.padre_id===padreId)
  }

  function getEtiquetaNombre(id: string) {
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

  function toggleEtiqueta(id: string, lista: string[], setLista: (v:string[])=>void) {
    setLista(lista.includes(id) ? lista.filter(x=>x!==id) : [...lista, id])
  }

  function toggleCat(cat: string) {
    setCatAbierta(prev=>prev.includes(cat)?prev.filter(c=>c!==cat):[...prev,cat])
  }

  async function crearEjercicio() {
    if (guardando) return
    if (!nuevoEj.nombre) { alert('El nombre es obligatorio'); return }
    setGuardando(true)
    await supabase.from('ejercicios').insert({
      nombre: nuevoEj.nombre,
      descripcion: nuevoEj.descripcion,
      video_url: nuevoEj.video_url,
      etiquetas: nuevoEj.etiquetas_ids,
    })
    setModalEj(false)
    setNuevoEj({ nombre:'', descripcion:'', video_url:'', etiquetas_ids:[] })
    setGuardando(false)
    cargar()
  }

  async function crearSesion() {
    if (!nuevaSes.paciente_id || !nuevaSes.nombre) { alert('Selecciona paciente y pon un nombre'); return }
    await supabase.from('sesiones').insert({ paciente_id:nuevaSes.paciente_id, nombre:nuevaSes.nombre, descripcion:nuevaSes.descripcion, partes:nuevaSes.partes, estado:'lista' })
    setModalSes(false)
    setNuevaSes({ paciente_id:'', nombre:'', descripcion:'', partes:[{nombre:'Calentamiento',ejercicios:[]},{nombre:'Parte principal',ejercicios:[]},{nombre:'Vuelta a la calma',ejercicios:[]}] })
    cargar()
  }

  async function crearEtiqueta() {
    if (!nuevaEtiqueta.nombre) { alert('Escribe el nombre'); return }
    await supabase.from('etiquetas').insert({ categoria:nuevaEtiqueta.categoria, nombre:nuevaEtiqueta.nombre, padre_id:nuevaEtiqueta.padre_id||null })
    setModalEtiqueta(false)
    setNuevaEtiqueta({ categoria:'musculo', nombre:'', padre_id:'' })
    cargar()
  }

  async function cambiarEstado(id: string, estado: string) {
    await supabase.from('sesiones').update({ estado }).eq('id',id); cargar()
  }

  const filtrados = ejercicios.filter(e=>{
    const matchQ = !buscar || e.nombre.toLowerCase().includes(buscar.toLowerCase()) || (e.descripcion||'').toLowerCase().includes(buscar.toLowerCase())
    const matchEt = filtroEtiquetas.length===0 || filtroEtiquetas.every(fid=>(e.etiquetas||[]).includes(fid))
    return matchQ && matchEt
  })

  const iconosEj: Record<string,string> = { musculo:'💪', articulacion:'🦴', movimiento:'🔄', posicion:'📍', material:'🏋', apoyo:'🦶', agarre:'✋', patologia:'🏥' }

  function SelectorEtiquetas({ seleccionadas, onChange }: { seleccionadas: string[], onChange: (v:string[])=>void }) {
    return (
      <div style={{border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',maxHeight:320,overflowY:'auto'}}>
        {CATEGORIAS.map(cat=>{
          const nivel1 = getEtiquetasPorCategoria(cat.key)
          const abierta = catAbierta.includes(cat.key)
          const selCount = nivel1.filter(e=>seleccionadas.includes(e.id) || getSubetiquetas(e.id).some(s=>seleccionadas.includes(s.id) || getSubetiquetas(s.id).some(ss=>seleccionadas.includes(ss.id)))).length
          return (
            <div key={cat.key} style={{borderBottom:'1px solid var(--bl)'}}>
              <div onClick={()=>toggleCat(cat.key)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 11px',cursor:'pointer',background:'var(--bl)',userSelect:'none'}}
                onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'}
                onMouseOut={e=>(e.currentTarget as HTMLElement).style.background='var(--bl)'}>
                <span style={{fontSize:12}}>{cat.label}</span>
                <div style={{flex:1}}/>
                {selCount>0 && <span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--g)',color:'#fff'}}>{selCount}</span>}
                <span style={{fontSize:10,color:'var(--grl)',transform:abierta?'rotate(90deg)':'',transition:'transform .15s'}}>›</span>
              </div>
              {abierta && (
                <div style={{padding:'5px 8px',background:'var(--w)'}}>
                  {nivel1.map(et=>{
                    const subs = getSubetiquetas(et.id)
                    const sel = seleccionadas.includes(et.id)
                    return (
                      <div key={et.id} style={{marginBottom:3}}>
                        <div onClick={()=>toggleEtiqueta(et.id,seleccionadas,onChange)}
                          style={{display:'flex',alignItems:'center',gap:6,padding:'4px 7px',borderRadius:5,cursor:'pointer',background:sel?'var(--g)':'transparent',color:sel?'#fff':'var(--n)',transition:'all .1s'}}
                          onMouseOver={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='var(--gl)'}}
                          onMouseOut={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                          <div style={{width:14,height:14,borderRadius:3,border:`1.5px solid ${sel?'#fff':'var(--bd)'}`,background:sel?'#fff':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            {sel && <span style={{fontSize:9,color:'var(--g)',fontWeight:700}}>✓</span>}
                          </div>
                          <span style={{fontSize:11,fontWeight:400}}>{et.nombre}</span>
                        </div>
                        {subs.length>0 && (
                          <div style={{marginLeft:16,borderLeft:'1.5px solid var(--bm)',paddingLeft:8,marginTop:2}}>
                            {subs.map(sub=>{
                              const subsubs = getSubetiquetas(sub.id)
                              const selSub = seleccionadas.includes(sub.id)
                              return (
                                <div key={sub.id}>
                                  <div onClick={()=>toggleEtiqueta(sub.id,seleccionadas,onChange)}
                                    style={{display:'flex',alignItems:'center',gap:6,padding:'3px 6px',borderRadius:4,cursor:'pointer',background:selSub?'var(--g)':'transparent',color:selSub?'#fff':'var(--n)',transition:'all .1s',marginBottom:2}}
                                    onMouseOver={e=>{if(!selSub)(e.currentTarget as HTMLElement).style.background='var(--gl)'}}
                                    onMouseOut={e=>{if(!selSub)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                                    <div style={{width:12,height:12,borderRadius:2,border:`1.5px solid ${selSub?'#fff':'var(--bd)'}`,background:selSub?'#fff':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                      {selSub && <span style={{fontSize:8,color:'var(--g)',fontWeight:700}}>✓</span>}
                                    </div>
                                    <span style={{fontSize:10,fontWeight:300}}>{sub.nombre}</span>
                                  </div>
                                  {subsubs.length>0 && (
                                    <div style={{marginLeft:14,borderLeft:'1.5px solid var(--bm)',paddingLeft:7}}>
                                      {subsubs.map(ss=>{
                                        const selSS = seleccionadas.includes(ss.id)
                                        return (
                                          <div key={ss.id} onClick={()=>toggleEtiqueta(ss.id,seleccionadas,onChange)}
                                            style={{display:'flex',alignItems:'center',gap:5,padding:'2px 5px',borderRadius:3,cursor:'pointer',background:selSS?'var(--g)':'transparent',color:selSS?'#fff':'var(--n)',transition:'all .1s',marginBottom:2}}
                                            onMouseOver={e=>{if(!selSS)(e.currentTarget as HTMLElement).style.background='var(--gl)'}}
                                            onMouseOut={e=>{if(!selSS)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                                            <div style={{width:10,height:10,borderRadius:2,border:`1.5px solid ${selSS?'#fff':'var(--bd)'}`,background:selSS?'#fff':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                              {selSS && <span style={{fontSize:7,color:'var(--g)',fontWeight:700}}>✓</span>}
                                            </div>
                                            <span style={{fontSize:9,fontWeight:300}}>{ss.nombre}</span>
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
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <div className="tabs">
        {[['biblioteca','📚 Biblioteca'],['sesiones','📋 Sesiones'],['etiquetas','🏷 Etiquetas']].map(([k,l])=>(
          <button key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {/* BIBLIOTECA */}
      {tab==='biblioteca' && (
        <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:10}}>
          {/* FILTROS */}
          <div style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:10,position:'sticky',top:0,maxHeight:'calc(100vh - 120px)',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <span style={{fontSize:10,fontWeight:500,color:'var(--n)'}}>Filtrar por etiqueta</span>
              {filtroEtiquetas.length>0 && <button className="btn btn-t btn-sm" onClick={()=>setFiltroEtiquetas([])}>Limpiar</button>}
            </div>
            <SelectorEtiquetas seleccionadas={filtroEtiquetas} onChange={setFiltroEtiquetas}/>
          </div>

          {/* GRID EJERCICIOS */}
          <div>
            <div style={{display:'flex',gap:8,marginBottom:10,alignItems:'center'}}>
              <input className="input" placeholder="🔍 Buscar ejercicio..." value={buscar} onChange={e=>setBuscar(e.target.value)} style={{flex:1}}/>
              <span style={{fontSize:10,color:'var(--grl)',whiteSpace:'nowrap'}}>{filtrados.length} ejercicios</span>
              <button className="btn btn-p btn-sm" onClick={()=>setModalEj(true)}>+ Nuevo ejercicio</button>
            </div>
            {loading ? <div className="loading">Cargando...</div> : filtrados.length===0 ? (
              <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>
                {ejercicios.length===0?'No hay ejercicios. Crea el primero con + Nuevo ejercicio.':'Sin resultados.'}
              </div>
            ) : (
              <div className="g3">
                {filtrados.map(e=>{
                  const etsDelEj = (e.etiquetas||[]).map((id:string)=>etiquetas.find(et=>et.id===id)).filter(Boolean)
                  return (
                    <div key={e.id} style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',cursor:'pointer',transition:'border-color .15s'}}
                      onMouseOver={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                      onMouseOut={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                      <div style={{height:60,background:'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,borderBottom:'1px solid var(--bd)'}}>💪</div>
                      <div style={{padding:'8px 10px'}}>
                        <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:5}}>{e.nombre}</div>
                        {e.descripcion && <div style={{fontSize:9,color:'var(--grl)',marginBottom:5,fontWeight:300,lineHeight:1.4}}>{e.descripcion.slice(0,60)}{e.descripcion.length>60?'...':''}</div>}
                        <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                          {etsDelEj.slice(0,4).map((et:any)=>(
                            <span key={et.id} style={{fontSize:8,padding:'1px 6px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{et.nombre}</span>
                          ))}
                          {etsDelEj.length>4 && <span style={{fontSize:8,color:'var(--grl)'}}>+{etsDelEj.length-4}</span>}
                        </div>
                        {e.video_url && <a href={e.video_url} target="_blank" rel="noopener noreferrer" style={{fontSize:9,color:'var(--g)',display:'block',marginTop:5}}>🎥 Ver vídeo ↗</a>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
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
                  <div style={{fontSize:10,color:'var(--grl)',fontWeight:300}}>{s.pacientes?.nombre} {s.pacientes?.apellidos} · {s.duracion_min} min · {new Date(s.created_at).toLocaleDateString('es-ES')}</div>
                  {s.descripcion && <div style={{fontSize:10,color:'var(--gr)',marginTop:3}}>{s.descripcion}</div>}
                </div>
                <div style={{display:'flex',gap:5,flexDirection:'column',alignItems:'flex-end'}}>
                  <span className={`badge ${s.estado==='realizada'?'badge-g':s.estado==='lista'?'badge-pen':'badge-b'}`}>{s.estado}</span>
                  <div style={{display:'flex',gap:4}}>
                    {s.estado!=='realizada'&&<button className="btn btn-t btn-sm" onClick={()=>cambiarEstado(s.id,'realizada')}>✓ Realizada</button>}
                  </div>
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
          <div className="g2">
            {CATEGORIAS.map(cat=>{
              const nivel1 = getEtiquetasPorCategoria(cat.key)
              return (
                <div key={cat.key} className="card">
                  <div className="card-title">{cat.label} <span style={{fontSize:9,color:'var(--grl)',fontWeight:300,textTransform:'none',letterSpacing:0}}>{nivel1.length} etiquetas</span></div>
                  {nivel1.map(et=>{
                    const subs = getSubetiquetas(et.id)
                    return (
                      <div key={et.id} style={{marginBottom:5}}>
                        <div style={{fontSize:11,fontWeight:400,color:'var(--n)',padding:'3px 0'}}>{et.nombre}</div>
                        {subs.length>0 && (
                          <div style={{marginLeft:10,borderLeft:'1.5px solid var(--bm)',paddingLeft:8}}>
                            {subs.map(sub=>{
                              const subsubs = getSubetiquetas(sub.id)
                              return (
                                <div key={sub.id}>
                                  <div style={{fontSize:10,fontWeight:300,color:'var(--gr)',padding:'2px 0'}}>{sub.nombre}</div>
                                  {subsubs.length>0 && (
                                    <div style={{marginLeft:8,borderLeft:'1.5px solid var(--bm)',paddingLeft:7}}>
                                      {subsubs.map(ss=>(
                                        <div key={ss.id} style={{fontSize:9,fontWeight:300,color:'var(--grl)',padding:'1px 0'}}>{ss.nombre}</div>
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
              )
            })}
          </div>
        </>
      )}

      {/* MODAL NUEVO EJERCICIO */}
      {modalEj && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)setModalEj(false)}}>
          <div className="modal" style={{width:520,maxHeight:'90vh'}}>
            <div className="modal-title">Nuevo ejercicio<button className="modal-close" onClick={()=>setModalEj(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevoEj.nombre} onChange={e=>setNuevoEj(p=>({...p,nombre:e.target.value}))} placeholder="ej. Curl de bíceps" autoFocus disabled={guardando}/></div>
            <div className="field"><label>Descripción motriz</label><textarea className="input" value={nuevoEj.descripcion} onChange={e=>setNuevoEj(p=>({...p,descripcion:e.target.value}))} placeholder="Descripción del movimiento, puntos clave de ejecución..." disabled={guardando}/></div>
            <div className="field"><label>Enlace vídeo (YouTube u otro)</label><input className="input" value={nuevoEj.video_url} onChange={e=>setNuevoEj(p=>({...p,video_url:e.target.value}))} placeholder="https://youtube.com/..." disabled={guardando}/></div>
            <div className="field">
              <label>Etiquetas · selecciona las que apliquen</label>
              <div style={{marginTop:5}}>
                <SelectorEtiquetas seleccionadas={nuevoEj.etiquetas_ids} onChange={ids=>setNuevoEj(p=>({...p,etiquetas_ids:ids}))}/>
              </div>
              {nuevoEj.etiquetas_ids.length>0 && (
                <div style={{marginTop:6,display:'flex',flexWrap:'wrap',gap:3}}>
                  {nuevoEj.etiquetas_ids.map(id=>(
                    <span key={id} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--g)',color:'#fff'}}>{getEtiquetaNombre(id)}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEj(false)} disabled={guardando}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearEjercicio} disabled={guardando}>{guardando?'⏳ Guardando...':'💾 Guardar ejercicio'}</button>
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
            <div className="field"><label>Nombre de la sesión *</label><input className="input" value={nuevaSes.nombre} onChange={e=>setNuevaSes(p=>({...p,nombre:e.target.value}))} placeholder="ej. Fuerza cuádriceps · Fase 1"/></div>
            <div className="field"><label>Descripción / objetivo</label><input className="input" value={nuevaSes.descripcion} onChange={e=>setNuevaSes(p=>({...p,descripcion:e.target.value}))} placeholder="ej. Sesión enfocada en tren inferior sin impacto"/></div>
            {nuevaSes.partes.map((parte,pi)=>(
              <div key={pi} style={{marginBottom:8,border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden'}}>
                <div style={{padding:'7px 10px',background:'var(--bl)',borderBottom:'1px solid var(--bd)',fontSize:10,fontWeight:500,color:'var(--n)'}}>{parte.nombre}</div>
                <div style={{padding:8}}>
                  <textarea className="input" style={{minHeight:56,fontSize:11}} placeholder="Escribe los ejercicios uno por línea&#10;ej: Curl bíceps · 3×12 · 8kg · unilateral"
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
            <div className="field"><label>Etiqueta padre (opcional · si es subetiqueta)</label>
              <select className="input" value={nuevaEtiqueta.padre_id} onChange={e=>setNuevaEtiqueta(p=>({...p,padre_id:e.target.value}))}>
                <option value="">— Es etiqueta principal —</option>
                {etiquetas.filter(e=>e.categoria===nuevaEtiqueta.categoria).map(e=>{
                  const prefijo = e.padre_id ? (etiquetas.find(p=>p.id===e.padre_id)?.nombre||'')+' › ' : ''
                  return <option key={e.id} value={e.id}>{prefijo}{e.nombre}</option>
                })}
              </select>
            </div>
            <div className="field"><label>Nombre de la etiqueta *</label><input className="input" value={nuevaEtiqueta.nombre} onChange={e=>setNuevaEtiqueta(p=>({...p,nombre:e.target.value}))} placeholder="ej. Bíceps Femoral" autoFocus/></div>
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
