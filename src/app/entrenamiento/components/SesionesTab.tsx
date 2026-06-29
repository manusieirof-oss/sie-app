'use client'
import { useState, useEffect } from 'react'
import ModalEditarSesion from './ModalEditarSesion'
import { supabase } from '@/lib/supabase'

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
  imagen_url?: string
}

type Parte = {
  nombre: string
  ejercicios: EjercicioSesion[]
}

const VARIANTES = ['Bilateral','Unilateral','Alterno','Unipodal','Supino','Prono','Decúbito lateral']
const CAPACIDADES = ['Fuerza','Fuerza máxima','Movilidad','Estiramiento','Resistencia','Propiocepción','Coordinación']

export default function SesionesTab({ sesiones, pacientes, ejercicios, etiquetas, objetivos, cargar, getNombre, pacienteIdInicial }: any) {
  const [modalSes, setModalSes] = useState(false)
  const [buscarSes, setBuscarSes] = useState('')
  const [sesionVista, setSesionVista] = useState<any>(null)
  const [guardando, setGuardando] = useState(false)
  const [modalBiblioteca, setModalBiblioteca] = useState<{parteIdx:number}|null>(null)
  const [ejEnConfig, setEjEnConfig] = useState<{parteIdx:number,ej:any}|null>(null)
  const [buscarBiblio, setBuscarBiblio] = useState('')
  const [filtroEtBiblio, setFiltroEtBiblio] = useState<string[]>([])
  const [configEj, setConfigEj] = useState<EjercicioSesion>({ ejercicio_id:'', nombre:'', variante:'Bilateral', capacidad:'Fuerza', series:'3', reps:'10', peso:'', tiempo:'', nota:'' })
  const [sesionEditando, setSesionEditando] = useState<any>(null)
  const [aplicarTodos, setAplicarTodos] = useState<{parteIdx:number}|null>(null)
  const [configBloque, setConfigBloque] = useState({series:'', reps:'', tiempo:'', descanso:''})
  const [nuevaSes, setNuevaSes] = useState<{paciente_id:string,nombre:string,descripcion:string,partes:Parte[]}>({
    paciente_id:'', nombre:'', descripcion:'',
    partes:[{nombre:'Calentamiento',ejercicios:[]},{nombre:'Parte principal',ejercicios:[]},{nombre:'Vuelta a la calma',ejercicios:[]}]
  })

  useEffect(() => {
    if (pacienteIdInicial) {
      setNuevaSes(p=>({...p, paciente_id: pacienteIdInicial}))
      setModalSes(true)
    }
  }, [pacienteIdInicial])

  const ejerciciosFiltrados = ejercicios.filter((e:any) => {
    const matchQ = !buscarBiblio || e.nombre.toLowerCase().includes(buscarBiblio.toLowerCase())
    const matchEt = filtroEtBiblio.length===0 || filtroEtBiblio.every((fid:string)=>(e.etiquetas||[]).includes(fid))
    return matchQ && matchEt
  })

  function abrirConfigEj(ej: any, parteIdx: number) {
    setEjEnConfig({ parteIdx, ej })
    setConfigEj({ ejercicio_id:ej.id, nombre:ej.nombre, variante:'Bilateral', capacidad:'Fuerza', series:'3', reps:'10', peso:'', tiempo:'', nota:'', imagen_url:ej.imagen_url||'' })
    setModalBiblioteca(null)
  }

  function confirmarEjercicio() {
    if (!ejEnConfig) return
    setNuevaSes(prev=>{
      const partes=[...prev.partes]
      partes[ejEnConfig.parteIdx]={...partes[ejEnConfig.parteIdx],ejercicios:[...partes[ejEnConfig.parteIdx].ejercicios,{...configEj}]}
      return {...prev,partes}
    })
    setEjEnConfig(null)
  }

  function eliminarEjDeParte(parteIdx:number, ejIdx:number) {
    setNuevaSes(prev=>{
      const partes=[...prev.partes]
      partes[parteIdx]={...partes[parteIdx],ejercicios:partes[parteIdx].ejercicios.filter((_,i)=>i!==ejIdx)}
      return {...prev,partes}
    })
  }

  function añadirParte() { setNuevaSes(prev=>({...prev,partes:[...prev.partes,{nombre:'Nueva parte',ejercicios:[]}]})) }
  function renombrarParte(idx:number, nombre:string) { setNuevaSes(prev=>{const partes=[...prev.partes];partes[idx]={...partes[idx],nombre};return {...prev,partes}}) }
  function eliminarParte(idx:number) { setNuevaSes(prev=>({...prev,partes:prev.partes.filter((_,i)=>i!==idx)})) }

  async function crearSesion() {
    if (!nuevaSes.paciente_id || !nuevaSes.nombre) { alert('Selecciona paciente y pon un nombre'); return }
    setGuardando(true)
    await supabase.from('sesiones').insert({ paciente_id:nuevaSes.paciente_id, nombre:nuevaSes.nombre, descripcion:nuevaSes.descripcion, partes:nuevaSes.partes, estado:'lista' })
    setModalSes(false)
    setNuevaSes({paciente_id:'',nombre:'',descripcion:'',partes:[{nombre:'Calentamiento',ejercicios:[]},{nombre:'Parte principal',ejercicios:[]},{nombre:'Vuelta a la calma',ejercicios:[]}]})
    setGuardando(false)
    cargar()
  }

  function objsDeSesion(s:any) {
    const ids = (s.sesiones_objetivos||[]).map((r:any)=>r.objetivo_id)
    return (objetivos||[]).filter((o:any)=>ids.includes(o.id))
  }
  const sesionesFiltradas = sesiones.filter((s:any)=>{
    if(!buscarSes) return true
    const q = buscarSes.toLowerCase()
    return (s.nombre||'').toLowerCase().includes(q) || (s.descripcion||'').toLowerCase().includes(q)
  })

  return (
    <>
      {/* CABECERA: buscador + nueva */}
      <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
        <input className="input" placeholder="🔍 Buscar por nombre u objetivo..." value={buscarSes} onChange={e=>setBuscarSes(e.target.value)} style={{flex:1,minWidth:200}}/>
        <span style={{fontSize:10,color:'var(--grl)'}}>{sesionesFiltradas.length} sesiones</span>
        <button className="btn btn-p btn-sm" onClick={()=>setModalSes(true)}>+ Nueva sesión</button>
      </div>

      {sesionesFiltradas.length===0?(
        <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>
          {sesiones.length===0?'Sin sesiones. Crea la primera con + Nueva sesión.':'Sin resultados.'}
        </div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:10}}>
          {sesionesFiltradas.map((s:any)=>{
            const nEj = (s.partes||[]).reduce((acc:number,p:any)=>acc+(p.ejercicios||[]).length,0)
            const nPartes = (s.partes||[]).length
            return (
              <div key={s.id} onClick={()=>setSesionVista(s)} className="card" style={{cursor:'pointer',display:'flex',flexDirection:'column',gap:8,margin:0}}
                onMouseOver={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                onMouseOut={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:'var(--n)',marginBottom:3}}>{s.nombre}</div>
                  {s.descripcion&&<div style={{fontSize:10,color:'var(--gr)',fontWeight:300,lineHeight:1.4}}>{s.descripcion.slice(0,90)}{s.descripcion.length>90?'...':''}</div>}
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:'auto'}}>
                  <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{nPartes} {nPartes===1?'parte':'partes'}</span>
                  <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{nEj} {nEj===1?'ejercicio':'ejercicios'}</span>
                </div>
                {objsDeSesion(s).length>0&&(
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {objsDeSesion(s).map((o:any)=><span key={o.id} style={{fontSize:8,padding:'2px 7px',borderRadius:99,background:o.color||'var(--g)',color:'#fff'}}>🎯 {o.nombre}</span>)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL VISTA SESIÓN (solo lectura) */}
      {sesionVista&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setSesionVista(null)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'92vw',maxWidth:760,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:400,color:'var(--n)'}}>{sesionVista.nombre}</div>
                {sesionVista.descripcion&&<div style={{fontSize:10,color:'var(--gr)',fontWeight:300,marginTop:2}}>{sesionVista.descripcion}</div>}
                {objsDeSesion(sesionVista).length>0&&(
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:5}}>
                    {objsDeSesion(sesionVista).map((o:any)=><span key={o.id} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:o.color||'var(--g)',color:'#fff'}}>🎯 {o.nombre}</span>)}
                  </div>
                )}
              </div>
              <button className="btn btn-s btn-sm" onClick={()=>{const s=sesionVista;setSesionVista(null);setSesionEditando(s)}}>✏️ Editar</button>
              <button onClick={()=>setSesionVista(null)} style={{width:26,height:26,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontSize:13,color:'var(--gr)'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              {(sesionVista.partes||[]).map((parte:any,pi:number)=>(
                <div key={pi} style={{marginBottom:10,background:'var(--bl)',borderRadius:6,overflow:'hidden',border:'1px solid var(--bd)'}}>
                  <div style={{padding:'6px 12px',borderBottom:'1px solid var(--bm)',fontSize:11,fontWeight:500,color:'var(--n)'}}>{parte.nombre}</div>
                  {(parte.ejercicios||[]).map((ej:any,ei:number)=>(
                    <div key={ei} style={{padding:'8px 12px',borderBottom:'1px solid var(--bl)',display:'flex',alignItems:'flex-start',gap:10}}>
                      {ej.imagen_url&&<img src={ej.imagen_url} alt={ej.nombre} style={{width:44,height:44,objectFit:'contain',background:'var(--bm)',borderRadius:4,flexShrink:0}}/>}
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:3}}>{ej.nombre||ej}</div>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          {ej.variante&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{ej.variante}</span>}
                          {ej.capacidad&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{ej.capacidad}</span>}
                          {ej.series&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.series} series</span>}
                          {ej.reps&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.reps} reps</span>}
                          {ej.peso&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.peso} kg</span>}
                          {ej.tiempo&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.tiempo} seg</span>}
                        </div>
                        {ej.nota&&<div style={{fontSize:9,color:'var(--amb)',marginTop:3,fontStyle:'italic'}}>📝 {ej.nota}</div>}
                      </div>
                    </div>
                  ))}
                  {(parte.ejercicios||[]).length===0&&<div style={{padding:'6px 12px',fontSize:9,color:'var(--grl)'}}>Sin ejercicios</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA SESIÓN */}
      {modalSes&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)setModalSes(false)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'92vw',maxWidth:900,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontSize:14,fontWeight:400,color:'var(--n)',flex:1}}>Nueva sesión de entrenamiento</div>
              <button onClick={()=>setModalSes(false)} style={{background:'none',border:'none',fontSize:18,color:'var(--gr)',cursor:'pointer'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              <div className="g2" style={{marginBottom:12}}>
                <div className="field"><label>Paciente *</label>
                  <select className="input" value={nuevaSes.paciente_id} onChange={e=>setNuevaSes(p=>({...p,paciente_id:e.target.value}))}>
                    <option value="">Seleccionar paciente...</option>
                    {pacientes.map((p:any)=><option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>)}
                  </select>
                </div>
                <div className="field"><label>Nombre de la sesión *</label>
                  <input className="input" value={nuevaSes.nombre} onChange={e=>setNuevaSes(p=>({...p,nombre:e.target.value}))} placeholder="ej. Fuerza cuádriceps · Fase 1"/>
                </div>
                <div className="field" style={{gridColumn:'1/-1'}}><label>Objetivo / descripción</label>
                  <input className="input" value={nuevaSes.descripcion} onChange={e=>setNuevaSes(p=>({...p,descripcion:e.target.value}))} placeholder="ej. Trabajar fuerza extensora sin impacto"/>
                </div>
              </div>
              {nuevaSes.partes.map((parte,pi)=>(
                <div key={pi} style={{border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'var(--bl)',borderBottom:'1px solid var(--bd)'}}>
                    <input value={parte.nombre} onChange={e=>renombrarParte(pi,e.target.value)} style={{flex:1,fontSize:12,fontWeight:500,color:'var(--n)',border:'none',background:'transparent',fontFamily:'system-ui',padding:'2px 0'}}/>
                    <button className="btn btn-t btn-sm" onClick={()=>setModalBiblioteca({parteIdx:pi})}>+ Añadir ejercicio</button>
                    {parte.ejercicios.length>0&&<button className="btn btn-s btn-sm" onClick={()=>{setConfigBloque({series:'',reps:'',tiempo:'',descanso:''});setAplicarTodos({parteIdx:pi})}}>⚡ Aplicar a todos</button>}
                    {nuevaSes.partes.length>1&&<button onClick={()=>eliminarParte(pi)} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 6px'}}>✕</button>}
                  </div>
                  <div style={{padding:8}}>
                    {parte.ejercicios.length===0&&(
                      <div onClick={()=>setModalBiblioteca({parteIdx:pi})} style={{border:'1.5px dashed var(--bm)',borderRadius:5,padding:'10px',textAlign:'center',fontSize:10,color:'var(--grl)',cursor:'pointer'}}
                        onMouseOver={e=>{const el=e.currentTarget;el.style.borderColor='var(--g)';el.style.color='var(--g)'}}
                        onMouseOut={e=>{const el=e.currentTarget;el.style.borderColor='var(--bm)';el.style.color='var(--grl)'}}>
                        + Añadir ejercicio de la biblioteca
                      </div>
                    )}
                    {parte.ejercicios.map((ej,ei)=>(
                      <div key={ei} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'7px 10px',background:'var(--bl)',borderRadius:6,border:'1px solid var(--bd)',marginBottom:4}}>
                        {ej.imagen_url&&<img src={ej.imagen_url} alt={ej.nombre} style={{width:36,height:36,objectFit:'cover',borderRadius:4,flexShrink:0}}/>}
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:3}}>{ej.nombre}</div>
                          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                            {ej.variante&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{ej.variante}</span>}
                            {ej.capacidad&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{ej.capacidad}</span>}
                            {ej.series&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.series} series</span>}
                            {ej.reps&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.reps} reps</span>}
                            {ej.peso&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.peso} kg</span>}
                            {ej.tiempo&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.tiempo} seg</span>}
                          </div>
                          {ej.nota&&<div style={{fontSize:9,color:'var(--amb)',marginTop:3,fontStyle:'italic'}}>📝 {ej.nota}</div>}
                        </div>
                        <button onClick={()=>eliminarEjDeParte(pi,ei)} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 5px',flexShrink:0}}>✕</button>
                      </div>
                    ))}
                    {parte.ejercicios.length>0&&<button className="btn btn-t btn-sm" style={{marginTop:4}} onClick={()=>setModalBiblioteca({parteIdx:pi})}>+ Añadir otro ejercicio</button>}
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

      {sesionEditando&&(
        <ModalEditarSesion
          sesion={sesionEditando}
          ejercicios={ejercicios}
          onGuardado={cargar}
          onCerrar={()=>setSesionEditando(null)}
        />
      )}

      {/* MODAL APLICAR A TODOS */}
      {aplicarTodos&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setAplicarTodos(null)}}>
          <div className="modal" style={{width:400}}>
            <div className="modal-title">
              ⚡ Aplicar a todos · {nuevaSes.partes[aplicarTodos.parteIdx]?.nombre}
              <button className="modal-close" onClick={()=>setAplicarTodos(null)}>✕</button>
            </div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:12}}>
              Se aplicará a los {nuevaSes.partes[aplicarTodos.parteIdx]?.ejercicios.length} ejercicios de este bloque. Deja en blanco lo que no quieras cambiar.
            </div>
            <div className="g2">
              <div className="field"><label>Series</label>
                <input className="input" type="number" value={configBloque.series} onChange={e=>setConfigBloque(p=>({...p,series:e.target.value}))} placeholder="ej. 3"/>
              </div>
              <div className="field"><label>Repeticiones</label>
                <input className="input" type="number" value={configBloque.reps} onChange={e=>setConfigBloque(p=>({...p,reps:e.target.value}))} placeholder="ej. 10"/>
              </div>
              <div className="field"><label>Tiempo (segundos)</label>
                <input className="input" type="number" value={configBloque.tiempo} onChange={e=>setConfigBloque(p=>({...p,tiempo:e.target.value}))} placeholder="ej. 60"/>
              </div>
              <div className="field"><label>Descanso entre ejercicios (seg)</label>
                <input className="input" type="number" value={configBloque.descanso} onChange={e=>setConfigBloque(p=>({...p,descanso:e.target.value}))} placeholder="ej. 60"/>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setAplicarTodos(null)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={()=>{
                setNuevaSes(prev=>{
                  const partes=[...prev.partes]
                  partes[aplicarTodos.parteIdx]={
                    ...partes[aplicarTodos.parteIdx],
                    ejercicios: partes[aplicarTodos.parteIdx].ejercicios.map(ej=>({
                      ...ej,
                      ...(configBloque.series&&{series:configBloque.series}),
                      ...(configBloque.reps&&{reps:configBloque.reps}),
                      ...(configBloque.tiempo&&{tiempo:configBloque.tiempo}),
                      ...(configBloque.descanso&&{nota:ej.nota?ej.nota+` · Descanso ${configBloque.descanso}seg`:`Descanso ${configBloque.descanso}seg`}),
                    }))
                  }
                  return {...prev,partes}
                })
                setAplicarTodos(null)
              }}>✓ Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BIBLIOTECA */}
      {modalBiblioteca&&!ejEnConfig&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalBiblioteca(null)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'80vw',maxWidth:900,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontSize:13,fontWeight:400,color:'var(--n)',flex:1}}>Seleccionar ejercicio · {nuevaSes.partes[modalBiblioteca.parteIdx]?.nombre}</div>
              <button onClick={()=>setModalBiblioteca(null)} style={{background:'none',border:'none',fontSize:18,color:'var(--gr)',cursor:'pointer'}}>✕</button>
            </div>
            <div style={{padding:'10px 14px',borderBottom:'1px solid var(--bd)'}}>
              <input className="input" placeholder="🔍 Buscar ejercicio..." value={buscarBiblio} onChange={e=>setBuscarBiblio(e.target.value)} style={{width:'100%'}}/>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:12}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                {ejerciciosFiltrados.map((e:any)=>(
                  <div key={e.id} onClick={()=>abrirConfigEj(e,modalBiblioteca.parteIdx)}
                    style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',cursor:'pointer'}}
                    onMouseOver={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                    onMouseOut={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                    {e.imagen_url?<img src={e.imagen_url} alt={e.nombre} style={{width:'100%',height:70,objectFit:'cover',borderBottom:'1px solid var(--bd)',display:'block'}}/>:<div style={{height:70,background:'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,borderBottom:'1px solid var(--bd)'}}>💪</div>}
                    <div style={{padding:'8px 10px'}}>
                      <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{e.nombre}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR EJERCICIO */}
      {ejEnConfig&&(
        <div className="modal-bg">
          <div className="modal" style={{width:480}}>
            <div className="modal-title">Configurar ejercicio<button className="modal-close" onClick={()=>setEjEnConfig(null)}>✕</button></div>
            <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,padding:'8px 11px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
              {ejEnConfig.ej.imagen_url&&<img src={ejEnConfig.ej.imagen_url} alt={ejEnConfig.ej.nombre} style={{width:48,height:48,objectFit:'cover',borderRadius:5,flexShrink:0}}/>}
              <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{ejEnConfig.ej.nombre}</div>
            </div>
            <div className="g2">
              <div className="field"><label>Variante</label>
                <select className="input" value={configEj.variante} onChange={e=>setConfigEj(p=>({...p,variante:e.target.value}))}>
                  {VARIANTES.map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="field"><label>Capacidad</label>
                <select className="input" value={configEj.capacidad} onChange={e=>setConfigEj(p=>({...p,capacidad:e.target.value}))}>
                  {CAPACIDADES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label>Series</label><input className="input" type="number" value={configEj.series} onChange={e=>setConfigEj(p=>({...p,series:e.target.value}))}/></div>
              <div className="field"><label>Reps</label><input className="input" type="number" value={configEj.reps} onChange={e=>setConfigEj(p=>({...p,reps:e.target.value}))}/></div>
              <div className="field"><label>Peso (kg)</label><input className="input" type="number" value={configEj.peso} onChange={e=>setConfigEj(p=>({...p,peso:e.target.value}))}/></div>
              <div className="field"><label>Tiempo (seg)</label><input className="input" type="number" value={configEj.tiempo} onChange={e=>setConfigEj(p=>({...p,tiempo:e.target.value}))}/></div>
            </div>
            <div className="field"><label>Nota</label><textarea className="input" value={configEj.nota} onChange={e=>setConfigEj(p=>({...p,nota:e.target.value}))} style={{minHeight:56}} placeholder="ej. Precaución rodilla derecha..."/></div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-s btn-sm" onClick={()=>{setEjEnConfig(null);setModalBiblioteca({parteIdx:ejEnConfig.parteIdx})}}>← Volver</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={confirmarEjercicio}>✓ Añadir a la sesión</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
