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

export default function BibliotecaPage() {
  const [tab, setTab] = useState('ejercicios')
  const [ejercicios, setEjercicios] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [etiquetas, setEtiquetas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [buscarTest, setBuscarTest] = useState('')
  const [filtroEtiquetas, setFiltroEtiquetas] = useState<string[]>([])
  const [catAbierta, setCatAbierta] = useState<string[]>([])
  const [ejSeleccionado, setEjSeleccionado] = useState<any>(null)
  const [testSeleccionado, setTestSeleccionado] = useState<any>(null)
  const [modalEj, setModalEj] = useState(false)
  const [modalTest, setModalTest] = useState(false)
  const [modalEtiqueta, setModalEtiqueta] = useState(false)
  const [modalEditEj, setModalEditEj] = useState(false)
  const [modalEditTest, setModalEditTest] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const [nuevoEj, setNuevoEj] = useState({ nombre:'', descripcion:'', video_url:'', etiquetas_ids:[] as string[] })
  const [editEj, setEditEj] = useState<any>(null)
  const [nuevoTest, setNuevoTest] = useState({ nombre:'', descripcion:'', video_url:'', frecuencia_meses:3, logica:'cualquiera', items:[] as any[], etiquetas_relacionadas:[] as string[] })
  const [editTest, setEditTest] = useState<any>(null)
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState({ categoria:'musculo', nombre:'', padre_id:'' })
  const [nuevoItem, setNuevoItem] = useState({ nombre:'', tiene_grados:false })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: e },{ data: t },{ data: et }] = await Promise.all([
      supabase.from('ejercicios').select('*').order('nombre'),
      supabase.from('tests').select('*').order('nombre'),
      supabase.from('etiquetas').select('*').order('categoria').order('nombre'),
    ])
    setEjercicios(e||[]); setTests(t||[]); setEtiquetas(et||[])
    setLoading(false)
  }

  function getEtiquetasPorCategoria(cat: string) {
    return etiquetas.filter(e=>e.categoria===cat && !e.padre_id)
  }
  function getSubetiquetas(padreId: string) {
    return etiquetas.filter(e=>e.padre_id===padreId)
  }
  function getEtiquetaNombre(id: string) {
    return etiquetas.find(e=>e.id===id)?.nombre||''
  }
  function toggleEtiqueta(id: string, lista: string[], setLista: (v:string[])=>void) {
    setLista(lista.includes(id)?lista.filter(x=>x!==id):[...lista,id])
  }
  function toggleCat(cat: string) {
    setCatAbierta(prev=>prev.includes(cat)?prev.filter(c=>c!==cat):[...prev,cat])
  }

  function getVariantes(ej: any) {
    if (!ej?.etiquetas?.length) return []
    return ejercicios.filter(e=>e.id!==ej.id && (e.etiquetas||[]).some((et:string)=>(ej.etiquetas||[]).includes(et))).slice(0,6)
  }

  async function crearEjercicio() {
    if (guardando||!nuevoEj.nombre) return
    setGuardando(true)
    await supabase.from('ejercicios').insert({ nombre:nuevoEj.nombre, descripcion:nuevoEj.descripcion, video_url:nuevoEj.video_url, etiquetas:nuevoEj.etiquetas_ids })
    setModalEj(false); setNuevoEj({ nombre:'', descripcion:'', video_url:'', etiquetas_ids:[] }); setGuardando(false); cargar()
  }

  async function guardarEditEj() {
    if (!editEj) return
    setGuardando(true)
    await supabase.from('ejercicios').update({ nombre:editEj.nombre, descripcion:editEj.descripcion, video_url:editEj.video_url, etiquetas:editEj.etiquetas||[] }).eq('id',editEj.id)
    setModalEditEj(false); setGuardando(false); cargar()
    setEjSeleccionado((prev:any)=>prev?{...prev,...editEj}:null)
  }

  async function eliminarEj(id: string) {
    if (!confirm('¿Eliminar este ejercicio?')) return
    await supabase.from('ejercicios').delete().eq('id',id)
    setEjSeleccionado(null); cargar()
  }

  async function crearTest() {
    if (guardando||!nuevoTest.nombre) return
    setGuardando(true)
    await supabase.from('tests').insert({ nombre:nuevoTest.nombre, descripcion:nuevoTest.descripcion, video_url:nuevoTest.video_url, frecuencia_meses:nuevoTest.frecuencia_meses, logica:nuevoTest.logica, items:nuevoTest.items, etiquetas_relacionadas:nuevoTest.etiquetas_relacionadas })
    setModalTest(false); setNuevoTest({ nombre:'', descripcion:'', video_url:'', frecuencia_meses:3, logica:'cualquiera', items:[], etiquetas_relacionadas:[] }); setGuardando(false); cargar()
  }

  async function guardarEditTest() {
    if (!editTest) return
    setGuardando(true)
    await supabase.from('tests').update({ nombre:editTest.nombre, descripcion:editTest.descripcion, video_url:editTest.video_url, frecuencia_meses:editTest.frecuencia_meses, logica:editTest.logica, items:editTest.items||[], etiquetas_relacionadas:editTest.etiquetas_relacionadas||[] }).eq('id',editTest.id)
    setModalEditTest(false); setGuardando(false); cargar()
    setTestSeleccionado((prev:any)=>prev?{...prev,...editTest}:null)
  }

  async function eliminarTest(id: string) {
    if (!confirm('¿Eliminar este test?')) return
    await supabase.from('tests').delete().eq('id',id)
    setTestSeleccionado(null); cargar()
  }

  async function crearEtiqueta() {
    if (!nuevaEtiqueta.nombre) return
    await supabase.from('etiquetas').insert({ categoria:nuevaEtiqueta.categoria, nombre:nuevaEtiqueta.nombre, padre_id:nuevaEtiqueta.padre_id||null })
    setModalEtiqueta(false); setNuevaEtiqueta({ categoria:'musculo', nombre:'', padre_id:'' }); cargar()
  }

  const filtrados = ejercicios.filter(e=>{
    const matchQ = !buscar||e.nombre.toLowerCase().includes(buscar.toLowerCase())
    const matchEt = filtroEtiquetas.length===0||filtroEtiquetas.every(fid=>(e.etiquetas||[]).includes(fid))
    return matchQ && matchEt
  })

  const filtradosTests = tests.filter(t=>!buscarTest||t.nombre.toLowerCase().includes(buscarTest.toLowerCase()))

  function SelectorEtiquetas({ seleccionadas, onChange }: { seleccionadas: string[], onChange: (v:string[])=>void }) {
    return (
      <div style={{border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',maxHeight:280,overflowY:'auto'}}>
        {CATEGORIAS.map(cat=>{
          const nivel1 = getEtiquetasPorCategoria(cat.key)
          const abierta = catAbierta.includes(cat.key)
          const selCount = nivel1.filter(e=>seleccionadas.includes(e.id)||getSubetiquetas(e.id).some((s:any)=>seleccionadas.includes(s.id))).length
          return (
            <div key={cat.key} style={{borderBottom:'1px solid var(--bl)'}}>
              <div onClick={()=>toggleCat(cat.key)} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 11px',cursor:'pointer',background:'var(--bl)',userSelect:'none'}}>
                <span style={{fontSize:11}}>{cat.label}</span>
                <div style={{flex:1}}/>
                {selCount>0&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--g)',color:'#fff'}}>{selCount}</span>}
                <span style={{fontSize:10,color:'var(--grl)',transform:abierta?'rotate(90deg)':'',transition:'transform .15s'}}>›</span>
              </div>
              {abierta&&(
                <div style={{padding:'5px 8px',background:'var(--w)'}}>
                  {nivel1.map((et:any)=>{
                    const subs = getSubetiquetas(et.id)
                    const sel = seleccionadas.includes(et.id)
                    return (
                      <div key={et.id} style={{marginBottom:3}}>
                        <div onClick={()=>toggleEtiqueta(et.id,seleccionadas,onChange)}
                          style={{display:'flex',alignItems:'center',gap:6,padding:'4px 7px',borderRadius:5,cursor:'pointer',background:sel?'var(--g)':'',color:sel?'#fff':'var(--n)'}}>
                          <div style={{width:13,height:13,borderRadius:3,border:`1.5px solid ${sel?'#fff':'var(--bd)'}`,background:sel?'rgba(255,255,255,.3)':'',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            {sel&&<span style={{fontSize:8,color:'#fff',fontWeight:700}}>✓</span>}
                          </div>
                          <span style={{fontSize:11}}>{et.nombre}</span>
                        </div>
                        {subs.length>0&&(
                          <div style={{marginLeft:16,borderLeft:'1.5px solid var(--bm)',paddingLeft:8,marginTop:2}}>
                            {subs.map((sub:any)=>{
                              const selSub = seleccionadas.includes(sub.id)
                              const subsubs = getSubetiquetas(sub.id)
                              return (
                                <div key={sub.id}>
                                  <div onClick={()=>toggleEtiqueta(sub.id,seleccionadas,onChange)}
                                    style={{display:'flex',alignItems:'center',gap:5,padding:'3px 6px',borderRadius:4,cursor:'pointer',background:selSub?'var(--g)':'',color:selSub?'#fff':'var(--n)',marginBottom:2}}>
                                    <div style={{width:11,height:11,borderRadius:2,border:`1.5px solid ${selSub?'#fff':'var(--bd)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                      {selSub&&<span style={{fontSize:7,color:'#fff',fontWeight:700}}>✓</span>}
                                    </div>
                                    <span style={{fontSize:10}}>{sub.nombre}</span>
                                  </div>
                                  {subsubs.length>0&&subsubs.map((ss:any)=>{
                                    const selSS = seleccionadas.includes(ss.id)
                                    return (
                                      <div key={ss.id} onClick={()=>toggleEtiqueta(ss.id,seleccionadas,onChange)}
                                        style={{display:'flex',alignItems:'center',gap:5,padding:'2px 6px 2px 18px',borderRadius:3,cursor:'pointer',background:selSS?'var(--g)':'',color:selSS?'#fff':'var(--n)',marginBottom:1}}>
                                        <span style={{fontSize:9}}>{ss.nombre}</span>
                                      </div>
                                    )
                                  })}
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
        {[['ejercicios','💪 Ejercicios'],['tests','🔍 Tests'],['etiquetas','🏷 Etiquetas']].map(([k,l])=>(
          <button key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ── EJERCICIOS ── */}
      {tab==='ejercicios' && (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input className="input" placeholder="🔍 Buscar ejercicio..." value={buscar} onChange={e=>setBuscar(e.target.value)} style={{flex:1}}/>
            <span style={{fontSize:10,color:'var(--grl)'}}>{filtrados.length} ejercicios</span>
            <button className="btn btn-p btn-sm" onClick={()=>setModalEj(true)}>+ Nuevo</button>
          </div>

          {loading ? <div className="loading">Cargando...</div> : filtrados.length===0 ? (
            <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>
              {ejercicios.length===0?'No hay ejercicios. Crea el primero.':'Sin resultados.'}
            </div>
          ) : (
            <div className="g3">
              {filtrados.map(e=>{
                const etsDelEj = (e.etiquetas||[]).map((id:string)=>etiquetas.find((et:any)=>et.id===id)).filter(Boolean)
                return (
                  <div key={e.id} onClick={()=>setEjSeleccionado(e)}
                    style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',cursor:'pointer',transition:'all .15s'}}
                    onMouseOver={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                    onMouseOut={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                    <div style={{height:80,background:'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',borderBottom:'1px solid var(--bd)',overflow:'hidden'}}>
                      {e.imagen_url ? <img src={e.imagen_url} alt={e.nombre} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{fontSize:32}}>💪</span>}
                    </div>
                    <div style={{padding:'8px 10px'}}>
                      <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:5}}>{e.nombre}</div>
                      <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                        {etsDelEj.slice(0,3).map((et:any)=>(
                          <span key={et.id} style={{fontSize:8,padding:'1px 6px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{et.nombre}</span>
                        ))}
                        {etsDelEj.length>3&&<span style={{fontSize:8,color:'var(--grl)'}}>+{etsDelEj.length-3}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* FILTRO FIJO ABAJO */}
          <div style={{position:'sticky',bottom:0,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:10,marginTop:4}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <span style={{fontSize:10,fontWeight:500,color:'var(--n)'}}>Filtrar por etiqueta</span>
              {filtroEtiquetas.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setFiltroEtiquetas([])}>Limpiar ({filtroEtiquetas.length})</button>}
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {CATEGORIAS.map(cat=>{
                const nivel1 = getEtiquetasPorCategoria(cat.key)
                const abierta = catAbierta.includes(cat.key+'_filtro')
                const selCount = nivel1.filter(e=>filtroEtiquetas.includes(e.id)||getSubetiquetas(e.id).some((s:any)=>filtroEtiquetas.includes(s.id))).length
                return (
                  <div key={cat.key} style={{position:'relative'}}>
                    <button onClick={()=>setCatAbierta(prev=>prev.includes(cat.key+'_filtro')?prev.filter(c=>c!==cat.key+'_filtro'):[...prev,cat.key+'_filtro'])}
                      style={{fontSize:10,padding:'4px 10px',borderRadius:99,border:`1px solid ${selCount>0?'var(--g)':'var(--bd)'}`,background:selCount>0?'var(--gl)':'var(--w)',color:selCount>0?'var(--gd)':'var(--gr)',cursor:'pointer',fontFamily:'system-ui',display:'flex',alignItems:'center',gap:4}}>
                      {cat.label.split(' ')[0]} {cat.label.split(' ').slice(1).join(' ')}
                      {selCount>0&&<span style={{fontSize:9,background:'var(--g)',color:'#fff',borderRadius:99,padding:'0 5px'}}>{selCount}</span>}
                    </button>
                    {abierta&&(
                      <div style={{position:'absolute',bottom:'100%',left:0,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:8,minWidth:160,zIndex:10,boxShadow:'0 4px 16px rgba(0,0,0,.1)',marginBottom:4}}>
                        {nivel1.map((et:any)=>{
                          const sel = filtroEtiquetas.includes(et.id)
                          const subs = getSubetiquetas(et.id)
                          return (
                            <div key={et.id}>
                              <div onClick={()=>toggleEtiqueta(et.id,filtroEtiquetas,setFiltroEtiquetas)}
                                style={{display:'flex',alignItems:'center',gap:5,padding:'3px 6px',borderRadius:4,cursor:'pointer',background:sel?'var(--g)':'transparent',color:sel?'#fff':'var(--n)',marginBottom:2}}>
                                <span style={{fontSize:10}}>{et.nombre}</span>
                              </div>
                              {subs.map((sub:any)=>{
                                const selSub = filtroEtiquetas.includes(sub.id)
                                return (
                                  <div key={sub.id} onClick={()=>toggleEtiqueta(sub.id,filtroEtiquetas,setFiltroEtiquetas)}
                                    style={{display:'flex',alignItems:'center',gap:5,padding:'2px 6px 2px 16px',borderRadius:3,cursor:'pointer',background:selSub?'var(--g)':'transparent',color:selSub?'#fff':'var(--n)',marginBottom:1}}>
                                    <span style={{fontSize:9}}>{sub.nombre}</span>
                                  </div>
                                )
                              })}
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
        </div>
      )}

      {/* ── TESTS ── */}
      {tab==='tests' && (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input className="input" placeholder="🔍 Buscar test..." value={buscarTest} onChange={e=>setBuscarTest(e.target.value)} style={{flex:1}}/>
            <span style={{fontSize:10,color:'var(--grl)'}}>{filtradosTests.length} tests</span>
            <button className="btn btn-p btn-sm" onClick={()=>setModalTest(true)}>+ Nuevo</button>
          </div>
          {loading?<div className="loading">Cargando...</div>:filtradosTests.length===0?(
            <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>Sin tests. Crea el primero.</div>
          ):(
            <div className="g3">
              {filtradosTests.map(t=>{
                const etsRel = (t.etiquetas_relacionadas||[]).map((id:string)=>etiquetas.find((et:any)=>et.id===id)).filter(Boolean)
                return (
                  <div key={t.id} onClick={()=>setTestSeleccionado(t)}
                    style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',cursor:'pointer',transition:'all .15s'}}
                    onMouseOver={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                    onMouseOut={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                    <div style={{height:80,background:'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',borderBottom:'1px solid var(--bd)',overflow:'hidden'}}>
                      {t.imagen_url?<img src={t.imagen_url} alt={t.nombre} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:32}}>🔍</span>}
                    </div>
                    <div style={{padding:'8px 10px'}}>
                      <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:4}}>{t.nombre}</div>
                      <div style={{fontSize:9,color:'var(--grl)',marginBottom:4}}>Revisión cada {t.frecuencia_meses} meses</div>
                      <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                        {etsRel.slice(0,3).map((et:any)=>(
                          <span key={et.id} style={{fontSize:8,padding:'1px 6px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{et.nombre}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ETIQUETAS ── */}
      {tab==='etiquetas' && (
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontSize:11,color:'var(--grl)'}}>{etiquetas.length} etiquetas</div>
            <button className="btn btn-p btn-sm" onClick={()=>setModalEtiqueta(true)}>+ Nueva etiqueta</button>
          </div>
          <div className="g2">
            {CATEGORIAS.map(cat=>{
              const nivel1 = getEtiquetasPorCategoria(cat.key)
              return (
                <div key={cat.key} className="card">
                  <div className="card-title">{cat.label} <span style={{fontSize:9,color:'var(--grl)',fontWeight:300,textTransform:'none',letterSpacing:0}}>{nivel1.length}</span></div>
                  {nivel1.map((et:any)=>{
                    const subs = getSubetiquetas(et.id)
                    return (
                      <div key={et.id} style={{marginBottom:5}}>
                        <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{et.nombre}</div>
                        {subs.length>0&&(
                          <div style={{marginLeft:10,borderLeft:'1.5px solid var(--bm)',paddingLeft:8,marginTop:2}}>
                            {subs.map((sub:any)=>{
                              const subsubs = getSubetiquetas(sub.id)
                              return (
                                <div key={sub.id}>
                                  <div style={{fontSize:10,fontWeight:300,color:'var(--gr)'}}>{sub.nombre}</div>
                                  {subsubs.map((ss:any)=>(
                                    <div key={ss.id} style={{fontSize:9,fontWeight:300,color:'var(--grl)',paddingLeft:10}}>{ss.nombre}</div>
                                  ))}
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

      {/* PANEL EJERCICIO SELECCIONADO */}
      {ejSeleccionado && (
        <>
          <div onClick={()=>setEjSeleccionado(null)} style={{position:'fixed',inset:0,background:'rgba(38,40,37,.16)',zIndex:48}}/>
          <div style={{position:'fixed',top:0,right:0,width:360,height:'100vh',background:'var(--w)',borderLeft:'1px solid var(--bd)',zIndex:49,display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(38,40,37,.08)'}}>
            <div style={{padding:'12px 14px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1,fontSize:13,fontWeight:400,color:'var(--n)'}}>{ejSeleccionado.nombre}</div>
              <button onClick={()=>{setEditEj({...ejSeleccionado,etiquetas:ejSeleccionado.etiquetas||[]});setModalEditEj(true)}} className="btn btn-s btn-sm">✏️ Editar</button>
              <button onClick={()=>eliminarEj(ejSeleccionado.id)} className="btn btn-d btn-sm">🗑</button>
              <button onClick={()=>setEjSeleccionado(null)} style={{width:24,height:24,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontSize:12,color:'var(--gr)'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto'}}>
              {ejSeleccionado.imagen_url && (
                <img src={ejSeleccionado.imagen_url} alt={ejSeleccionado.nombre} style={{width:'100%',height:180,objectFit:'cover'}}/>
              )}
              <div style={{padding:14}}>
                {ejSeleccionado.descripcion && (
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Descripción</div>
                    <div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.6}}>{ejSeleccionado.descripcion}</div>
                  </div>
                )}
                {ejSeleccionado.video_url && (
                  <a href={ejSeleccionado.video_url} target="_blank" rel="noopener noreferrer" className="btn btn-s btn-sm" style={{marginBottom:12,display:'inline-flex'}}>🎥 Ver vídeo</a>
                )}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Etiquetas</div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {(ejSeleccionado.etiquetas||[]).map((id:string)=>{
                      const et = etiquetas.find((e:any)=>e.id===id)
                      return et?<span key={id} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{et.nombre}</span>:null
                    })}
                    {!(ejSeleccionado.etiquetas||[]).length&&<span style={{fontSize:10,color:'var(--grl)'}}>Sin etiquetas</span>}
                  </div>
                </div>
                {getVariantes(ejSeleccionado).length>0&&(
                  <div>
                    <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:8}}>Variantes y ejercicios similares</div>
                    {getVariantes(ejSeleccionado).map((v:any)=>(
                      <div key={v.id} onClick={()=>setEjSeleccionado(v)}
                        style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:6,border:'1px solid var(--bd)',marginBottom:4,cursor:'pointer',background:'var(--bl)'}}
                        onMouseOver={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                        onMouseOut={e=>(e.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                        <div style={{width:32,height:32,background:'var(--bm)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
                          {v.imagen_url?<img src={v.imagen_url} alt={v.nombre} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>💪</span>}
                        </div>
                        <span style={{fontSize:11,color:'var(--n)',flex:1}}>{v.nombre}</span>
                        <span style={{fontSize:10,color:'var(--grl)'}}>›</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* PANEL TEST SELECCIONADO */}
      {testSeleccionado && (
        <>
          <div onClick={()=>setTestSeleccionado(null)} style={{position:'fixed',inset:0,background:'rgba(38,40,37,.16)',zIndex:48}}/>
          <div style={{position:'fixed',top:0,right:0,width:360,height:'100vh',background:'var(--w)',borderLeft:'1px solid var(--bd)',zIndex:49,display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(38,40,37,.08)'}}>
            <div style={{padding:'12px 14px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1,fontSize:13,fontWeight:400,color:'var(--n)'}}>{testSeleccionado.nombre}</div>
              <button onClick={()=>{setEditTest({...testSeleccionado});setModalEditTest(true)}} className="btn btn-s btn-sm">✏️ Editar</button>
              <button onClick={()=>eliminarTest(testSeleccionado.id)} className="btn btn-d btn-sm">🗑</button>
              <button onClick={()=>setTestSeleccionado(null)} style={{width:24,height:24,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontSize:12,color:'var(--gr)'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:14}}>
              {testSeleccionado.descripcion&&<div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.6,marginBottom:12}}>{testSeleccionado.descripcion}</div>}
              {testSeleccionado.video_url&&<a href={testSeleccionado.video_url} target="_blank" rel="noopener noreferrer" className="btn btn-s btn-sm" style={{marginBottom:12,display:'inline-flex'}}>🎥 Ver vídeo</a>}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Configuración</div>
                <div style={{fontSize:10,color:'var(--n)'}}>Revisión cada <strong>{testSeleccionado.frecuencia_meses}</strong> meses · Positivo si <strong>{testSeleccionado.logica==='todos'?'todos los ítems':'algún ítem'}</strong></div>
              </div>
              {(testSeleccionado.items||[]).length>0&&(
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Ítems de evaluación</div>
                  {testSeleccionado.items.map((item:any,i:number)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px',borderRadius:4,background:'var(--bl)',marginBottom:3}}>
                      <span style={{fontSize:10,color:'var(--n)',flex:1}}>{item.nombre}</span>
                      {item.tiene_grados&&<span style={{fontSize:8,padding:'1px 6px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>°grados</span>}
                    </div>
                  ))}
                </div>
              )}
              {(testSeleccionado.etiquetas_relacionadas||[]).length>0&&(
                <div>
                  <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Ejercicios relacionados cuando positivo</div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {testSeleccionado.etiquetas_relacionadas.map((id:string)=>{
                      const et = etiquetas.find((e:any)=>e.id===id)
                      return et?<span key={id} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{et.nombre}</span>:null
                    })}
                  </div>
                  <div style={{marginTop:8}}>
                    <div style={{fontSize:9,color:'var(--grl)',marginBottom:5}}>Ejercicios de la biblioteca con estas etiquetas:</div>
                    {ejercicios.filter(e=>(testSeleccionado.etiquetas_relacionadas||[]).some((etId:string)=>(e.etiquetas||[]).includes(etId))).slice(0,4).map((e:any)=>(
                      <div key={e.id} style={{fontSize:10,color:'var(--n)',padding:'3px 7px',background:'var(--gl)',borderRadius:4,marginBottom:2}}>💪 {e.nombre}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* MODAL NUEVO EJERCICIO */}
      {modalEj&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalEj(false)}}>
          <div className="modal" style={{width:500}}>
            <div className="modal-title">Nuevo ejercicio<button className="modal-close" onClick={()=>setModalEj(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevoEj.nombre} onChange={e=>setNuevoEj(p=>({...p,nombre:e.target.value}))} autoFocus/></div>
            <div className="field"><label>Descripción motriz</label><textarea className="input" value={nuevoEj.descripcion} onChange={e=>setNuevoEj(p=>({...p,descripcion:e.target.value}))} placeholder="Descripción del movimiento, puntos clave..."/></div>
            <div className="field"><label>Enlace vídeo</label><input className="input" value={nuevoEj.video_url} onChange={e=>setNuevoEj(p=>({...p,video_url:e.target.value}))} placeholder="https://youtube.com/..."/></div>
            <div className="field"><label>Etiquetas</label><SelectorEtiquetas seleccionadas={nuevoEj.etiquetas_ids} onChange={ids=>setNuevoEj(p=>({...p,etiquetas_ids:ids}))}/></div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEj(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearEjercicio} disabled={guardando}>{guardando?'Guardando...':'💾 Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR EJERCICIO */}
      {modalEditEj&&editEj&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalEditEj(false)}}>
          <div className="modal" style={{width:500}}>
            <div className="modal-title">Editar ejercicio<button className="modal-close" onClick={()=>setModalEditEj(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={editEj.nombre} onChange={e=>setEditEj((p:any)=>({...p,nombre:e.target.value}))}/></div>
            <div className="field"><label>Descripción</label><textarea className="input" value={editEj.descripcion||''} onChange={e=>setEditEj((p:any)=>({...p,descripcion:e.target.value}))}/></div>
            <div className="field"><label>Enlace vídeo</label><input className="input" value={editEj.video_url||''} onChange={e=>setEditEj((p:any)=>({...p,video_url:e.target.value}))}/></div>
            <div className="field"><label>Etiquetas</label><SelectorEtiquetas seleccionadas={editEj.etiquetas||[]} onChange={ids=>setEditEj((p:any)=>({...p,etiquetas:ids}))}/></div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEditEj(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardarEditEj} disabled={guardando}>{guardando?'Guardando...':'💾 Guardar cambios'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO TEST */}
      {modalTest&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalTest(false)}}>
          <div className="modal" style={{width:520,maxHeight:'90vh'}}>
            <div className="modal-title">Nuevo test<button className="modal-close" onClick={()=>setModalTest(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevoTest.nombre} onChange={e=>setNuevoTest(p=>({...p,nombre:e.target.value}))} autoFocus/></div>
            <div className="field"><label>Descripción</label><textarea className="input" value={nuevoTest.descripcion} onChange={e=>setNuevoTest(p=>({...p,descripcion:e.target.value}))}/></div>
            <div className="field"><label>Enlace vídeo</label><input className="input" value={nuevoTest.video_url} onChange={e=>setNuevoTest(p=>({...p,video_url:e.target.value}))} placeholder="https://youtube.com/..."/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div className="field"><label>Revisión cada (meses)</label><input className="input" type="number" value={nuevoTest.frecuencia_meses} onChange={e=>setNuevoTest(p=>({...p,frecuencia_meses:parseInt(e.target.value)||3}))}/></div>
              <div className="field"><label>Positivo si</label>
                <select className="input" value={nuevoTest.logica} onChange={e=>setNuevoTest(p=>({...p,logica:e.target.value}))}>
                  <option value="cualquiera">Algún ítem marcado</option>
                  <option value="todos">Todos los ítems marcados</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Ítems de evaluación</label>
              <div style={{display:'flex',gap:6,marginBottom:6}}>
                <input className="input" value={nuevoItem.nombre} onChange={e=>setNuevoItem(p=>({...p,nombre:e.target.value}))} placeholder="Nombre del ítem" onKeyDown={e=>{if(e.key==='Enter'&&nuevoItem.nombre){setNuevoTest(p=>({...p,items:[...p.items,{...nuevoItem}]}));setNuevoItem({nombre:'',tiene_grados:false})}}}/>
                <label style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'var(--n)',whiteSpace:'nowrap'}}>
                  <input type="checkbox" checked={nuevoItem.tiene_grados} onChange={e=>setNuevoItem(p=>({...p,tiene_grados:e.target.checked}))}/>°grados
                </label>
                <button className="btn btn-t btn-sm" onClick={()=>{if(nuevoItem.nombre){setNuevoTest(p=>({...p,items:[...p.items,{...nuevoItem}]}));setNuevoItem({nombre:'',tiene_grados:false})}}}>+</button>
              </div>
              {nuevoTest.items.map((item,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 8px',background:'var(--bl)',borderRadius:4,marginBottom:3}}>
                  <span style={{fontSize:10,flex:1}}>{item.nombre}</span>
                  {item.tiene_grados&&<span style={{fontSize:8,color:'var(--amb)'}}>°</span>}
                  <button onClick={()=>setNuevoTest(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))} style={{fontSize:10,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                </div>
              ))}
            </div>
            <div className="field">
              <label>Etiquetas de ejercicios relacionados (cuando positivo)</label>
              <SelectorEtiquetas seleccionadas={nuevoTest.etiquetas_relacionadas} onChange={ids=>setNuevoTest(p=>({...p,etiquetas_relacionadas:ids}))}/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalTest(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearTest} disabled={guardando}>{guardando?'Guardando...':'💾 Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR TEST */}
      {modalEditTest&&editTest&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalEditTest(false)}}>
          <div className="modal" style={{width:520,maxHeight:'90vh'}}>
            <div className="modal-title">Editar test<button className="modal-close" onClick={()=>setModalEditTest(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={editTest.nombre} onChange={e=>setEditTest((p:any)=>({...p,nombre:e.target.value}))}/></div>
            <div className="field"><label>Descripción</label><textarea className="input" value={editTest.descripcion||''} onChange={e=>setEditTest((p:any)=>({...p,descripcion:e.target.value}))}/></div>
            <div className="field"><label>Enlace vídeo</label><input className="input" value={editTest.video_url||''} onChange={e=>setEditTest((p:any)=>({...p,video_url:e.target.value}))}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div className="field"><label>Revisión cada (meses)</label><input className="input" type="number" value={editTest.frecuencia_meses||3} onChange={e=>setEditTest((p:any)=>({...p,frecuencia_meses:parseInt(e.target.value)||3}))}/></div>
              <div className="field"><label>Positivo si</label>
                <select className="input" value={editTest.logica||'cualquiera'} onChange={e=>setEditTest((p:any)=>({...p,logica:e.target.value}))}>
                  <option value="cualquiera">Algún ítem marcado</option>
                  <option value="todos">Todos los ítems marcados</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Etiquetas de ejercicios relacionados</label>
              <SelectorEtiquetas seleccionadas={editTest.etiquetas_relacionadas||[]} onChange={ids=>setEditTest((p:any)=>({...p,etiquetas_relacionadas:ids}))}/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEditTest(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardarEditTest} disabled={guardando}>{guardando?'Guardando...':'💾 Guardar cambios'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA ETIQUETA */}
      {modalEtiqueta&&(
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
                  const padre = e.padre_id?etiquetas.find((p:any)=>p.id===e.padre_id):null
                  return <option key={e.id} value={e.id}>{padre?padre.nombre+' › ':''}{e.nombre}</option>
                })}
              </select>
            </div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevaEtiqueta.nombre} onChange={e=>setNuevaEtiqueta(p=>({...p,nombre:e.target.value}))} autoFocus/></div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEtiqueta(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearEtiqueta}>💾 Guardar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
