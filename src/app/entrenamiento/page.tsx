'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function EntrenamientoPage() {
  const [tab, setTab] = useState('biblioteca')
  const [ejercicios, setEjercicios] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [sesiones, setSesiones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [modalEj, setModalEj] = useState(false)
  const [modalSes, setModalSes] = useState(false)
  const [nuevoEj, setNuevoEj] = useState({ nombre:'', descripcion:'', video_url:'', etiquetas:'' })
  const [nuevaSes, setNuevaSes] = useState({ paciente_id:'', nombre:'', descripcion:'', partes: [{ nombre:'Calentamiento', ejercicios:[] as string[] }, { nombre:'Parte principal', ejercicios:[] as string[] }, { nombre:'Vuelta a la calma', ejercicios:[] as string[] }] })
  

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: e }, { data: p }, { data: s }] = await Promise.all([
      supabase.from('ejercicios').select('*').order('nombre'),
      supabase.from('pacientes').select('id,nombre,apellidos').eq('estado','activo').order('nombre'),
      supabase.from('sesiones').select('*, pacientes(nombre,apellidos)').order('created_at',{ascending:false}).limit(20),
    ])
    setEjercicios(e||[]); setPacientes(p||[]); setSesiones(s||[])
    setLoading(false)
  }

  async function crearEjercicio() {
    if (!nuevoEj.nombre) { alert('El nombre es obligatorio'); return }
    const etiquetas = nuevoEj.etiquetas.split(',').map(t=>t.trim()).filter(Boolean)
    await supabase.from('ejercicios').insert({ nombre:nuevoEj.nombre, descripcion:nuevoEj.descripcion, video_url:nuevoEj.video_url, etiquetas })
    setModalEj(false); setNuevoEj({ nombre:'', descripcion:'', video_url:'', etiquetas:'' }); cargar()
  }

  async function crearSesion() {
    if (!nuevaSes.paciente_id || !nuevaSes.nombre) { alert('Selecciona paciente y pon un nombre'); return }
    await supabase.from('sesiones').insert({ paciente_id:nuevaSes.paciente_id, nombre:nuevaSes.nombre, descripcion:nuevaSes.descripcion, partes:nuevaSes.partes, estado:'lista' })
    setModalSes(false); setNuevaSes({ paciente_id:'', nombre:'', descripcion:'', partes:[{nombre:'Calentamiento',ejercicios:[]},{nombre:'Parte principal',ejercicios:[]},{nombre:'Vuelta a la calma',ejercicios:[]}] }); cargar()
  }

  async function cambiarEstado(id: string, estado: string) {
    await supabase.from('sesiones').update({ estado }).eq('id', id); cargar()
  }

  const filtrados = ejercicios.filter(e => !buscar || e.nombre.toLowerCase().includes(buscar.toLowerCase()) || (e.etiquetas||[]).some((et:string)=>et.toLowerCase().includes(buscar.toLowerCase())))

  const iconosEj: Record<string,string> = { fuerza:'🏋', movilidad:'🌀', isometrico:'⬛', potencia:'⚡', estabilidad:'🐦', respiracion:'💨', estiramiento:'🧘' }

  return (
    <>
      <div className="tabs">
        {[['biblioteca','📚 Biblioteca'],['sesiones','📋 Sesiones'],['constructor','⚡ Constructor']].map(([k,l])=>(
          <button key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {/* BIBLIOTECA */}
      {tab==='biblioteca' && (
        <>
          <div style={{display:'flex',gap:8,marginBottom:10,alignItems:'center'}}>
            <input className="input" placeholder="🔍 Buscar ejercicio o etiqueta..." value={buscar} onChange={e=>setBuscar(e.target.value)} style={{flex:1}}/>
            <button className="btn btn-p btn-sm" onClick={()=>setModalEj(true)}>+ Nuevo ejercicio</button>
          </div>
          {loading ? <div className="loading">Cargando...</div> : (
            filtrados.length===0 ? (
              <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>
                {ejercicios.length===0 ? 'No hay ejercicios aún. Crea el primero con el botón + Nuevo ejercicio.' : 'Sin resultados para tu búsqueda.'}
              </div>
            ) : (
              <div className="g3">
                {filtrados.map(e=>{
                  const tipo = (e.etiquetas||[])[0]?.toLowerCase() || ''
                  const icon = Object.entries(iconosEj).find(([k])=>tipo.includes(k))?.[1] || '💪'
                  return (
                    <div key={e.id} style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',cursor:'pointer',transition:'border-color .15s'}}
                      onMouseOver={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                      onMouseOut={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                      <div style={{height:64,background:'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,borderBottom:'1px solid var(--bd)'}}>{icon}</div>
                      <div style={{padding:'8px 10px'}}>
                        <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:5}}>{e.nombre}</div>
                        <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                          {(e.etiquetas||[]).slice(0,3).map((et:string,i:number)=>(
                            <span key={i} style={{fontSize:8,padding:'1px 6px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{et}</span>
                          ))}
                        </div>
                        {e.video_url && <a href={e.video_url} target="_blank" rel="noopener noreferrer" style={{fontSize:9,color:'var(--g)',display:'block',marginTop:5}}>🎥 Ver vídeo ↗</a>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </>
      )}

      {/* SESIONES */}
      {tab==='sesiones' && (
        <>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <button className="btn btn-p btn-sm" onClick={()=>setModalSes(true)}>+ Nueva sesión</button>
          </div>
          {loading ? <div className="loading">Cargando...</div> : sesiones.length===0 ? (
            <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>Sin sesiones. Crea la primera con + Nueva sesión.</div>
          ) : sesiones.map(s=>(
            <div key={s.id} className="card">
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:400,color:'var(--n)',marginBottom:2}}>{s.nombre}</div>
                  <div style={{fontSize:10,color:'var(--grl)',fontWeight:300}}>{s.pacientes?.nombre} {s.pacientes?.apellidos} · {s.duracion_min} min · {new Date(s.created_at).toLocaleDateString('es-ES')}</div>
                  {s.descripcion && <div style={{fontSize:10,color:'var(--gr)',marginTop:4}}>{s.descripcion}</div>}
                </div>
                <div style={{display:'flex',gap:5,flexDirection:'column',alignItems:'flex-end'}}>
                  <span className={`badge ${s.estado==='realizada'?'badge-g':s.estado==='lista'?'badge-pen':'badge-b'}`}>{s.estado}</span>
                  <div style={{display:'flex',gap:4}}>
                    {s.estado!=='realizada' && <button className="btn btn-t btn-sm" onClick={()=>cambiarEstado(s.id,'realizada')}>✓ Realizada</button>}
                    {s.estado==='lista' && <button className="btn btn-s btn-sm" onClick={()=>cambiarEstado(s.id,'borrador')}>Borrador</button>}
                  </div>
                </div>
              </div>
              {/* PARTES */}
              {(s.partes||[]).map((parte:any,pi:number)=>(
                <div key={pi} style={{marginTop:8,background:'var(--bl)',borderRadius:6,overflow:'hidden',border:'1px solid var(--bd)'}}>
                  <div style={{padding:'6px 10px',background:'var(--bl)',borderBottom:'1px solid var(--bm)',fontSize:10,fontWeight:500,color:'var(--n)'}}>{parte.nombre}</div>
                  {(parte.ejercicios||[]).map((ej:string,ei:number)=>(
                    <div key={ei} style={{padding:'4px 10px',fontSize:10,color:'var(--n)',fontWeight:300,borderBottom:'1px solid var(--bl)'}}>{ej}</div>
                  ))}
                  {(parte.ejercicios||[]).length===0 && <div style={{padding:'4px 10px',fontSize:9,color:'var(--grl)'}}>Sin ejercicios en esta parte</div>}
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* CONSTRUCTOR */}
      {tab==='constructor' && (
        <div className="info-pill" style={{marginBottom:0}}>
          Usa el botón <strong>+ Nueva sesión</strong> en la pestaña Sesiones para crear entrenamientos completos con partes y ejercicios. Selecciona el paciente, da nombre a la sesión y describe los ejercicios de cada parte.
        </div>
      )}

      {/* MODAL NUEVO EJERCICIO */}
      {modalEj && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalEj(false)}}>
          <div className="modal">
            <div className="modal-title">Nuevo ejercicio<button className="modal-close" onClick={()=>setModalEj(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label><input className="input" value={nuevoEj.nombre} onChange={e=>setNuevoEj(p=>({...p,nombre:e.target.value}))} placeholder="ej. Sentadilla búlgara" autoFocus/></div>
            <div className="field"><label>Descripción</label><textarea className="input" value={nuevoEj.descripcion} onChange={e=>setNuevoEj(p=>({...p,descripcion:e.target.value}))} placeholder="Cómo se realiza, qué músculos trabaja..."/></div>
            <div className="field"><label>Enlace vídeo (opcional)</label><input className="input" value={nuevoEj.video_url} onChange={e=>setNuevoEj(p=>({...p,video_url:e.target.value}))} placeholder="https://youtube.com/..."/></div>
            <div className="field"><label>Etiquetas (separadas por coma)</label><input className="input" value={nuevoEj.etiquetas} onChange={e=>setNuevoEj(p=>({...p,etiquetas:e.target.value}))} placeholder="ej. Fuerza, Cuádriceps, Unilateral, Mancuernas"/></div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEj(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearEjercicio}>💾 Guardar ejercicio</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA SESIÓN */}
      {modalSes && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalSes(false)}}>
          <div className="modal" style={{width:500}}>
            <div className="modal-title">Nueva sesión de entrenamiento<button className="modal-close" onClick={()=>setModalSes(false)}>✕</button></div>
            <div className="field"><label>Paciente *</label>
              <select className="input" value={nuevaSes.paciente_id} onChange={e=>setNuevaSes(p=>({...p,paciente_id:e.target.value}))}>
                <option value="">Seleccionar paciente...</option>
                {pacientes.map(p=><option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>)}
              </select>
            </div>
            <div className="field"><label>Nombre de la sesión *</label><input className="input" value={nuevaSes.nombre} onChange={e=>setNuevaSes(p=>({...p,nombre:e.target.value}))} placeholder="ej. Fuerza cuádriceps · Fase 1"/></div>
            <div className="field"><label>Descripción / objetivo de la sesión</label><input className="input" value={nuevaSes.descripcion} onChange={e=>setNuevaSes(p=>({...p,descripcion:e.target.value}))} placeholder="ej. Sesión enfocada en tren inferior sin impacto"/></div>
            {nuevaSes.partes.map((parte,pi)=>(
              <div key={pi} style={{marginBottom:8,border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden'}}>
                <div style={{padding:'7px 10px',background:'var(--bl)',borderBottom:'1px solid var(--bd)',fontSize:10,fontWeight:500,color:'var(--n)'}}>{parte.nombre}</div>
                <div style={{padding:8}}>
                  <textarea className="input" style={{minHeight:60,fontSize:11}}
                    placeholder="Escribe los ejercicios de esta parte, uno por línea&#10;ej: Sentadilla búlgara · 4×10 · 20kg&#10;Puente glúteo · 3×30seg"
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
    </>
  )
}
