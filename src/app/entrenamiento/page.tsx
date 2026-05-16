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

const VARIANTES = ['Bilateral','Unilateral','Alterno','Unipodal','Supino','Prono','Decúbito lateral']
const CAPACIDADES = ['Fuerza','Fuerza máxima','Movilidad','Estiramiento','Resistencia','Propiocepción','Coordinación']

type EjercicioSesion = {
  ejercicio_id: string
  nombre: string
  variante: string
  capacidad: string
  series: string
  reps: string
  peso: string
  tiempo: string
  nota: string
}

type Parte = {
  nombre: string
  ejercicios: EjercicioSesion[]
}

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
  const [modalBiblioteca, setModalBiblioteca] = useState<{parteIdx:number}|null>(null)
  const [guardando, setGuardando] = useState(false)
  const [subsubAbiertas, setSubsubAbiertas] = useState<string[]>([])
  const [buscarBiblio, setBuscarBiblio] = useState('')
  const [filtroEtBiblio, setFiltroEtBiblio] = useState<string[]>([])
  const [modalFiltrosBiblio, setModalFiltrosBiblio] = useState(false)
  const [nuevoEj, setNuevoEj] = useState({ nombre:'', descripcion:'', video_url:'', etiquetas_ids:[] as string[] })
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState({ categoria:'musculo', nombre:'', padre_id:'' })
  const [nuevaSes, setNuevaSes] = useState<{ paciente_id:string, nombre:string, descripcion:string, partes:Parte[] }>({
    paciente_id:'', nombre:'', descripcion:'',
    partes:[
      { nombre:'Calentamiento', ejercicios:[] },
      { nombre:'Parte principal', ejercicios:[] },
      { nombre:'Vuelta a la calma', ejercicios:[] },
    ]
  })
  const [ejEnConfig, setEjEnConfig] = useState<{parteIdx:number, ej:any}|null>(null)
  const [configEj, setConfigEj] = useState<EjercicioSesion>({ ejercicio_id:'', nombre:'', variante:'Bilateral', capacidad:'Fuerza', series:'3', reps:'10', peso:'', tiempo:'', nota:'' })

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

  function SelectorColumnas({ seleccionadas, onChange }: { seleccionadas: string[], onChange: (v:string[])=>void }) {
    return (
      <div style={{overflowX:'auto',overflowY:'auto',maxHeight:'65vh'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(8,minmax(140px,1fr))',gap:1,background:'var(--bm)',minWidth:1100}}>
          {CATEGORIAS.map(cat=>{
            const nivel1 = getNivel1(cat.key)
            const selCount = etiquetas.filter(e=>e.categoria===cat.key && seleccionadas.includes(e.id)).length
            return (
              <div key={cat.key} style={{background:'var(--w)',display:'flex',flexDirection:'column'}}>
                <div style={{padding:'8px 10px',background:'var(--n)',position:'sticky',top:0}}>
                  <div style={{fontSize:10,fontWeight:500,color:'#fff'}}>{cat.label}</div>
                  {selCount>0 && <div style={{fontSize:8,color:'var(--gm)',marginTop:1}}>{selCount} selec.</div>}
                </div>
                <div style={{padding:'6px 6px',flex:1}}>
                  {nivel1.map(et=>{
                    const subs = getSubs(et.id)
                    const sel = seleccionadas.includes(et.id)
                    return (
                      <div key={et.id} style={{marginBottom:4}}>
                        <div onClick={(e)=>{e.preventDefault();toggle(et.id,seleccionadas,onChange)}}
                          style={{display:'flex',alignItems:'center',gap:5,padding:'4px 6px',borderRadius:4,cursor:'pointer',background:sel?'var(--g)':'transparent',color:sel?'#fff':'var(--n)',transition:'all .1s',marginBottom:1}}
                          onMouseOver={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='var(--gl)'}}
                          onMouseOut={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                          <div style={{width:12,height:12,borderRadius:2,border:`1.5px solid ${sel?'rgba(255,255,255,.6)':'var(--bd)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            {sel && <span style={{fontSize:8,color:'var(--g)',fontWeight:700,background:'#fff',width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:1}}>✓</span>}
                          </div>
                          <span style={{fontSize:10,fontWeight:sel?500:400}}>{et.nombre}</span>
                        </div>
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
                                      <div style={{width:10,height:10,borderRadius:2,border:`1px solid ${selSub?'rgba(255,255,255,.6)':'var(--bd)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                        {selSub && <span style={{fontSize:7,color:'var(--g)',fontWeight:700,background:'#fff',width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:1}}>✓</span>}
                                      </div>
                                      <span style={{fontSize:9,fontWeight:300}}>{sub.nombre}</span>
                                    </div>
                                    {subsubs.length>0 && <div onClick={()=>toggleSubsub(sub.id)} style={{fontSize:8,color:'var(--grl)',cursor:'pointer',padding:'2px 3px',transform:subsubAbierta?'rotate(90deg)':'',transition:'transform .15s'}}>›</div>}
                                  </div>
                                  {subsubs.length>0 && subsubAbierta && (
                                    <div style={{marginLeft:10,borderLeft:'1.5px solid var(--bm)',paddingLeft:5}}>
                                      {subsubs.map(ss=>{
                                        const selSS = seleccionadas.includes(ss.id)
                                        return (
                                          <div key={ss.id} onClick={(e)=>{e.preventDefault();toggle(ss.id,seleccionadas,onChange)}}
                                            style={{display:'flex',alignItems:'center',gap:4,padding:'2px 4px',borderRadius:3,cursor:'pointer',background:selSS?'var(--g)':'transparent',color:selSS?'#fff':'var(--grl)',transition:'all .1s',marginBottom:1}}
                                            onMouseOver={e=>{if(!selSS)(e.currentTarget as HTMLElement).style.background='var(--gl)'}}
                                            onMouseOut={e=>{if(!selSS)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                                            <div style={{width:8,height:8,borderRadius:1,border:`1px solid ${selSS?'rgba(255,255,255,.6)':'var(--bd)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                              {selSS && <span style={{fontSize:6,color:'var(--g)',fontWeight:700,background:'#fff',width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:1}}>✓</span>}
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

  // BIBLIOTECA PARA SESIÓN
  const ejerciciosFiltradosBiblio = ejercicios.filter(e=>{
    const matchQ = !buscarBiblio || e.nombre.toLowerCase().includes(buscarBiblio.toLowerCase())
    const matchEt = filtroEtBiblio.length===0 || filtroEtBiblio.every(fid=>(e.etiquetas||[]).includes(fid))
    return matchQ && matchEt
  })

  function abrirConfigEj(ej: any, parteIdx: number) {
    setEjEnConfig({ parteIdx, ej })
    setConfigEj({ ejercicio_id:ej.id, nombre:ej.nombre, variante:'Bilateral', capacidad:'Fuerza', series:'3', reps:'10', peso:'', tiempo:'', nota:'' })
    setModalBiblioteca(null)
  }

  function confirmarEjercicio() {
    if (!ejEnConfig) return
    const ejSesion: EjercicioSesion = { ...configEj }
    setNuevaSes(prev=>{
      const partes = [...prev.partes]
      partes[ejEnConfig.parteIdx] = { ...partes[ejEnConfig.parteIdx], ejercicios: [...partes[ejEnConfig.parteIdx].ejercicios, ejSesion] }
      return { ...prev, partes }
    })
    setEjEnConfig(null)
  }

  function eliminarEjDeParte(parteIdx: number, ejIdx: number) {
    setNuevaSes(prev=>{
      const partes = [...prev.partes]
      partes[parteIdx] = { ...partes[parteIdx], ejercicios: partes[parteIdx].ejercicios.filter((_,i)=>i!==ejIdx) }
      return { ...prev, partes }
    })
  }

  function añadirParte() {
    setNuevaSes(prev=>({ ...prev, partes:[...prev.partes, { nombre:'Nueva parte', ejercicios:[] }] }))
  }

  function renombrarParte(idx: number, nombre: string) {
    setNuevaSes(prev=>{ const partes=[...prev.partes]; partes[idx]={...partes[idx],nombre}; return {...prev,partes} })
  }

  function eliminarParte(idx: number) {
    setNuevaSes(prev=>({ ...prev, partes:prev.partes.filter((_,i)=>i!==idx) }))
  }

  async function crearSesion() {
    if (!nuevaSes.paciente_id || !nuevaSes.nombre) { alert('Selecciona paciente y pon un nombre'); return }
    setGuardando(true)
    await supabase.from('sesiones').insert({
      paciente_id: nuevaSes.paciente_id,
      nombre: nuevaSes.nombre,
      descripcion: nuevaSes.descripcion,
      partes: nuevaSes.partes,
      estado: 'lista'
    })
    setModalSes(false)
    setNuevaSes({ paciente_id:'', nombre:'', descripcion:'', partes:[{nombre:'Calentamiento',ejercicios:[]},{nombre:'Parte principal',ejercicios:[]},{nombre:'Vuelta a la calma',ejercicios:[]}] })
    setGuardando(false)
    cargar()
  }

  async function crearEjercicio() {
    if (guardando) return
    if (!nuevoEj.nombre) { alert('El nombre es obligatorio'); return }
    setGuardando(true)
    await supabase.from('ejercicios').insert({ nombre:nuevoEj.nombre, descripcion:nuevoEj.descripcion, video_url:nuevoEj.video_url, etiquetas:nuevoEj.etiquetas_ids })
    setModalEj(false); setNuevoEj({ nombre:'', descripcion:'', video_url:'', etiquetas_ids:[] }); setGuardando(false); cargar()
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
          {filtroEtiquetas.length>0 && (
            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
              {filtroEtiquetas.map(id=>(
                <span key={id} onClick={()=>setFiltroEtiquetas(f=>f.filter(x=>x!==id))} style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--g)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                  {getNombre(id)} <span style={{opacity:.7}}>✕</span>
                </span>
              ))}
            </div>
          )}
          {loading?<div className="loading">Cargando...</div>:filtrados.length===0?(
            <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>
              {ejercicios.length===0?'No hay ejercicios. Crea el primero con + Nuevo ejercicio.':'Sin resultados.'}
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
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:400,color:'var(--n)',marginBottom:2}}>{s.nombre}</div>
                  <div style={{fontSize:10,color:'var(--grl)',fontWeight:300}}>{s.pacientes?.nombre} {s.pacientes?.apellidos} · {new Date(s.created_at).toLocaleDateString('es-ES')}</div>
                  {s.descripcion&&<div style={{fontSize:10,color:'var(--gr)',marginTop:2}}>{s.descripcion}</div>}
                </div>
                <div style={{display:'flex',gap:5,alignItems:'center'}}>
                  <span className={`badge ${s.estado==='realizada'?'badge-g':s.estado==='lista'?'badge-pen':'badge-b'}`}>{s.estado}</span>
                  {s.estado!=='realizada'&&<button className="btn btn-t btn-sm" onClick={()=>cambiarEstado(s.id,'realizada')}>✓ Realizada</button>}
                </div>
              </div>
              {(s.partes||[]).map((parte:any,pi:number)=>(
                <div key={pi} style={{marginBottom:6,background:'var(--bl)',borderRadius:6,overflow:'hidden',border:'1px solid var(--bd)'}}>
                  <div style={{padding:'5px 10px',background:'var(--bl)',borderBottom:'1px solid var(--bm)',fontSize:10,fontWeight:500,color:'var(--n)'}}>{parte.nombre}</div>
                  {(parte.ejercicios||[]).map((ej:any,ei:number)=>(
                    <div key={ei} style={{padding:'6px 10px',borderBottom:'1px solid var(--bl)',display:'flex',alignItems:'flex-start',gap:8}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{ej.nombre||ej}</div>
                        {ej.variante&&<div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>
                          {[ej.variante,ej.capacidad,ej.series&&`${ej.series} series`,ej.reps&&`${ej.reps} reps`,ej.peso&&`${ej.peso}kg`,ej.tiempo&&`${ej.tiempo}seg`].filter(Boolean).join(' · ')}
                        </div>}
                        {ej.nota&&<div style={{fontSize:9,color:'var(--amb)',marginTop:2,fontStyle:'italic'}}>📝 {ej.nota}</div>}
                      </div>
                    </div>
                  ))}
                  {(parte.ejercicios||[]).length===0&&<div style={{padding:'5px 10px',fontSize:9,color:'var(--grl)'}}>Sin ejercicios</div>}
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

      {/* MODAL FILTRO ETIQUETAS BIBLIOTECA */}
      {modalFiltro && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalFiltro(false)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'96vw',maxWidth:1200,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10,background:'var(--bl)'}}>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:400,color:'var(--n)'}}>Filtrar por etiquetas</div></div>
              {filtroEtiquetas.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setFiltroEtiquetas([])}>✕ Limpiar</button>}
              <button onClick={()=>setModalFiltro(false)} style={{background:'var(--g)',color:'#fff',border:'none',borderRadius:'var(--r)',padding:'6px 16px',fontSize:11,cursor:'pointer',fontFamily:'system-ui'}}>
                Aplicar{filtroEtiquetas.length>0?` (${filtroEtiquetas.length})`:''}
              </button>
            </div>
            <div style={{flex:1,overflow:'hidden',padding:1}}><SelectorColumnas seleccionadas={filtroEtiquetas} onChange={setFiltroEtiquetas}/></div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA SESIÓN */}
      {modalSes && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)setModalSes(false)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'92vw',maxWidth:900,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontSize:14,fontWeight:400,color:'var(--n)',flex:1}}>Nueva sesión de entrenamiento</div>
              <button onClick={()=>setModalSes(false)} style={{background:'none',border:'none',fontSize:18,color:'var(--gr)',cursor:'pointer'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              {/* DATOS BÁSICOS */}
              <div className="g2" style={{marginBottom:12}}>
                <div className="field"><label>Paciente *</label>
                  <select className="input" value={nuevaSes.paciente_id} onChange={e=>setNuevaSes(p=>({...p,paciente_id:e.target.value}))}>
                    <option value="">Seleccionar paciente...</option>
                    {pacientes.map(p=><option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>)}
                  </select>
                </div>
                <div className="field"><label>Nombre de la sesión *</label>
                  <input className="input" value={nuevaSes.nombre} onChange={e=>setNuevaSes(p=>({...p,nombre:e.target.value}))} placeholder="ej. Fuerza cuádriceps · Fase 1"/>
                </div>
                <div className="field" style={{gridColumn:'1/-1'}}><label>Objetivo / descripción</label>
                  <input className="input" value={nuevaSes.descripcion} onChange={e=>setNuevaSes(p=>({...p,descripcion:e.target.value}))} placeholder="ej. Trabajar fuerza extensora sin impacto"/>
                </div>
              </div>

              {/* PARTES */}
              {nuevaSes.partes.map((parte,pi)=>(
                <div key={pi} style={{border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',marginBottom:10}}>
                  {/* CABECERA PARTE */}
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'var(--bl)',borderBottom:'1px solid var(--bd)'}}>
                    <input value={parte.nombre} onChange={e=>renombrarParte(pi,e.target.value)}
                      style={{flex:1,fontSize:12,fontWeight:500,color:'var(--n)',border:'none',background:'transparent',fontFamily:'system-ui',padding:'2px 0'}}/>
                    <button className="btn btn-t btn-sm" onClick={()=>setModalBiblioteca({parteIdx:pi})}>+ Añadir ejercicio</button>
                    {nuevaSes.partes.length>1 && <button onClick={()=>eliminarParte(pi)} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 6px'}}>✕</button>}
                  </div>
                  {/* EJERCICIOS DE LA PARTE */}
                  <div style={{padding:8}}>
                    {parte.ejercicios.length===0 && (
                      <div onClick={()=>setModalBiblioteca({parteIdx:pi})} style={{border:'1.5px dashed var(--bm)',borderRadius:5,padding:'10px',textAlign:'center',fontSize:10,color:'var(--grl)',cursor:'pointer'}}
                        onMouseOver={e=>{const el=e.currentTarget;el.style.borderColor='var(--g)';el.style.color='var(--g)'}}
                        onMouseOut={e=>{const el=e.currentTarget;el.style.borderColor='var(--bm)';el.style.color='var(--grl)'}}>
                        + Añadir ejercicio de la biblioteca
                      </div>
                    )}
                    {parte.ejercicios.map((ej,ei)=>(
                      <div key={ei} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'7px 10px',background:'var(--bl)',borderRadius:6,border:'1px solid var(--bd)',marginBottom:4}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:3}}>{ej.nombre}</div>
                          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                            {ej.variante && <span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{ej.variante}</span>}
                            {ej.capacidad && <span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{ej.capacidad}</span>}
                            {ej.series && <span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.series} series</span>}
                            {ej.reps && <span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.reps} reps</span>}
                            {ej.peso && <span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.peso} kg</span>}
                            {ej.tiempo && <span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.tiempo} seg</span>}
                          </div>
                          {ej.nota && <div style={{fontSize:9,color:'var(--amb)',marginTop:3,fontStyle:'italic'}}>📝 {ej.nota}</div>}
                        </div>
                        <button onClick={()=>eliminarEjDeParte(pi,ei)} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 5px',flexShrink:0}}>✕</button>
                      </div>
                    ))}
                    {parte.ejercicios.length>0 && (
                      <button className="btn btn-t btn-sm" style={{marginTop:4}} onClick={()=>setModalBiblioteca({parteIdx:pi})}>+ Añadir otro ejercicio</button>
                    )}
                  </div>
                </div>
              ))}
              <button className="btn btn-s btn-sm" onClick={añadirParte}>+ Añadir parte</button>
            </div>
            <div style={{padding:'10px 16px',borderTop:'1px solid var(--bd)',display:'flex',gap:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalSes(false)} disabled={guardando}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearSesion} disabled={guardando}>{guardando?'⏳ Guardando...':'💾 Guardar sesión'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BIBLIOTECA PARA SESIÓN */}
      {modalBiblioteca && !ejEnConfig && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalBiblioteca(null)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'80vw',maxWidth:900,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontSize:13,fontWeight:400,color:'var(--n)',flex:1}}>Seleccionar ejercicio · {nuevaSes.partes[modalBiblioteca.parteIdx]?.nombre}</div>
              <button onClick={()=>setModalBiblioteca(null)} style={{background:'none',border:'none',fontSize:18,color:'var(--gr)',cursor:'pointer'}}>✕</button>
            </div>
            <div style={{padding:'10px 14px',borderBottom:'1px solid var(--bd)',display:'flex',gap:8,alignItems:'center'}}>
              <input className="input" placeholder="🔍 Buscar ejercicio..." value={buscarBiblio} onChange={e=>setBuscarBiblio(e.target.value)} style={{flex:1}}/>
              <button className="btn btn-s btn-sm" onClick={()=>setModalFiltrosBiblio(true)} style={{position:'relative'}}>
                🏷 Filtrar
                {filtroEtBiblio.length>0&&<span style={{position:'absolute',top:-5,right:-5,width:16,height:16,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:8,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>{filtroEtBiblio.length}</span>}
              </button>
              {filtroEtBiblio.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setFiltroEtBiblio([])}>✕</button>}
            </div>
            <div style={{flex:1,overflowY:'auto',padding:12}}>
              {ejerciciosFiltradosBiblio.length===0 ? (
                <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:11}}>Sin resultados</div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                  {ejerciciosFiltradosBiblio.map(e=>{
                    const etsDelEj = (e.etiquetas||[]).map((id:string)=>etiquetas.find(et=>et.id===id)).filter(Boolean)
                    return (
                      <div key={e.id} onClick={()=>abrirConfigEj(e,modalBiblioteca.parteIdx)}
                        style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'10px',cursor:'pointer',transition:'all .15s'}}
                        onMouseOver={el=>{const c=el.currentTarget;c.style.borderColor='var(--g)';c.style.background='var(--gl)'}}
                        onMouseOut={el=>{const c=el.currentTarget;c.style.borderColor='var(--bd)';c.style.background='var(--bl)'}}>
                        <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:4}}>{e.nombre}</div>
                        {e.descripcion&&<div style={{fontSize:9,color:'var(--grl)',marginBottom:5,fontWeight:300}}>{e.descripcion.slice(0,60)}...</div>}
                        <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                          {etsDelEj.slice(0,3).map((et:any)=>(
                            <span key={et.id} style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--g)',color:'#fff'}}>{et.nombre}</span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL FILTROS BIBLIOTECA SESIÓN */}
      {modalFiltrosBiblio && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalFiltrosBiblio(false)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'96vw',maxWidth:1200,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10,background:'var(--bl)'}}>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:400,color:'var(--n)'}}>Filtrar ejercicios por etiqueta</div></div>
              {filtroEtBiblio.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setFiltroEtBiblio([])}>✕ Limpiar</button>}
              <button onClick={()=>setModalFiltrosBiblio(false)} style={{background:'var(--g)',color:'#fff',border:'none',borderRadius:'var(--r)',padding:'6px 16px',fontSize:11,cursor:'pointer',fontFamily:'system-ui'}}>
                Aplicar{filtroEtBiblio.length>0?` (${filtroEtBiblio.length})`:''}
              </button>
            </div>
            <div style={{flex:1,overflow:'hidden',padding:1}}><SelectorColumnas seleccionadas={filtroEtBiblio} onChange={setFiltroEtBiblio}/></div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR EJERCICIO */}
      {ejEnConfig && (
        <div className="modal-bg">
          <div className="modal" style={{width:480}}>
            <div className="modal-title">
              Configurar ejercicio
              <button className="modal-close" onClick={()=>setEjEnConfig(null)}>✕</button>
            </div>
            <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,padding:'8px 11px',marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{ejEnConfig.ej.nombre}</div>
              {ejEnConfig.ej.descripcion&&<div style={{fontSize:9,color:'var(--grl)',marginTop:2,fontWeight:300}}>{ejEnConfig.ej.descripcion}</div>}
            </div>
            <div className="g2">
              <div className="field"><label>Variante de ejecución</label>
                <select className="input" value={configEj.variante} onChange={e=>setConfigEj(p=>({...p,variante:e.target.value}))}>
                  {VARIANTES.map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="field"><label>Capacidad</label>
                <select className="input" value={configEj.capacidad} onChange={e=>setConfigEj(p=>({...p,capacidad:e.target.value}))}>
                  {CAPACIDADES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label>Series</label>
                <input className="input" type="number" value={configEj.series} onChange={e=>setConfigEj(p=>({...p,series:e.target.value}))} placeholder="ej. 3"/>
              </div>
              <div className="field"><label>Repeticiones</label>
                <input className="input" type="number" value={configEj.reps} onChange={e=>setConfigEj(p=>({...p,reps:e.target.value}))} placeholder="ej. 10"/>
              </div>
              <div className="field"><label>Peso (kg)</label>
                <input className="input" type="number" value={configEj.peso} onChange={e=>setConfigEj(p=>({...p,peso:e.target.value}))} placeholder="ej. 20"/>
              </div>
              <div className="field"><label>Tiempo (segundos)</label>
                <input className="input" type="number" value={configEj.tiempo} onChange={e=>setConfigEj(p=>({...p,tiempo:e.target.value}))} placeholder="ej. 30"/>
              </div>
            </div>
            <div className="field"><label>Nota para este paciente</label>
              <textarea className="input" value={configEj.nota} onChange={e=>setConfigEj(p=>({...p,nota:e.target.value}))} placeholder="ej. Precaución rodilla derecha, reducir rango de movimiento..." style={{minHeight:56}}/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-s btn-sm" onClick={()=>{setEjEnConfig(null);setModalBiblioteca({parteIdx:ejEnConfig.parteIdx})}}>← Volver</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={confirmarEjercicio}>✓ Añadir a la sesión</button>
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
            <div className="field"><label>Descripción motriz</label><textarea className="input" value={nuevoEj.descripcion} onChange={e=>setNuevoEj(p=>({...p,descripcion:e.target.value}))} placeholder="Descripción del movimiento, puntos clave..." disabled={guardando}/></div>
            <div className="field"><label>Enlace vídeo</label><input className="input" value={nuevoEj.video_url} onChange={e=>setNuevoEj(p=>({...p,video_url:e.target.value}))} placeholder="https://youtube.com/..." disabled={guardando}/></div>
            <div className="field">
              <label>Etiquetas</label>
              {nuevoEj.etiquetas_ids.length>0&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:6}}>
                  {nuevoEj.etiquetas_ids.map(id=>(
                    <span key={id} onClick={()=>setNuevoEj(p=>({...p,etiquetas_ids:p.etiquetas_ids.filter(x=>x!==id)}))} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--g)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
                      {getNombre(id)} <span style={{opacity:.7}}>✕</span>
                    </span>
                  ))}
                </div>
              )}
              <button className="btn btn-s btn-sm" onClick={()=>setModalSelEt(true)} style={{width:'100%',justifyContent:'center'}}>
                🏷 {nuevoEj.etiquetas_ids.length>0?`${nuevoEj.etiquetas_ids.length} etiquetas · Cambiar`:'Seleccionar etiquetas'}
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

      {/* MODAL SELECTOR ETIQUETAS EJERCICIO */}
      {modalSelEt && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalSelEt(false)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'96vw',maxWidth:1200,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10,background:'var(--bl)'}}>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:400,color:'var(--n)'}}>Etiquetas del ejercicio</div><div style={{fontSize:10,color:'var(--grl)',fontWeight:300}}>{nuevoEj.etiquetas_ids.length} seleccionadas</div></div>
              {nuevoEj.etiquetas_ids.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setNuevoEj(p=>({...p,etiquetas_ids:[]}))}>✕ Limpiar</button>}
              <button onClick={()=>setModalSelEt(false)} style={{background:'var(--g)',color:'#fff',border:'none',borderRadius:'var(--r)',padding:'6px 16px',fontSize:11,cursor:'pointer',fontFamily:'system-ui'}}>
                Confirmar{nuevoEj.etiquetas_ids.length>0?` (${nuevoEj.etiquetas_ids.length})`:''}
              </button>
            </div>
            <div style={{flex:1,overflow:'hidden',padding:1}}><SelectorColumnas seleccionadas={nuevoEj.etiquetas_ids} onChange={ids=>setNuevoEj(p=>({...p,etiquetas_ids:ids}))}/></div>
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
