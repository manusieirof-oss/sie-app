'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import ModoClase from './ModoClase'

export default function TallerPage() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [ejercicios, setEjercicios] = useState<any[]>([])
  const [sesiones, setSesiones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pacienteId, setPacienteId] = useState('')
  const [modalSesion, setModalSesion] = useState(false)
  const [editandoSesion, setEditandoSesion] = useState<any>(null)
  const [guardando, setGuardando] = useState(false)
  const [buscarEj, setBuscarEj] = useState('')
  const [formSesion, setFormSesion] = useState({
    nombre: '', descripcion: '',
    partes: [
      { nombre: 'Calentamiento', ejercicios: [] as any[] },
      { nombre: 'Parte principal', ejercicios: [] as any[] },
      { nombre: 'Vuelta a la calma', ejercicios: [] as any[] },
    ]
  })
  const [parteActiva, setParteActiva] = useState(0)
  const [configEj, setConfigEj] = useState<any>(null)
  const [registrando, setRegistrando] = useState<any>(null)
  const [datosReg, setDatosReg] = useState<any[]>([])
  const [ultimos, setUltimos] = useState<Record<string,any>>({})
  const [guardandoReg, setGuardandoReg] = useState(false)
  const [tab, setTab] = useState<'individual'|'clase'>('individual')
  const autosaveTimers = useRef<Record<number, any>>({})

  useEffect(() => { cargar() }, [])
  useEffect(() => { if (pacienteId) cargarSesiones() }, [pacienteId])

  async function cargar() {
    setLoading(true)
    const [{ data: p }, { data: e }] = await Promise.all([
      supabase.from('pacientes').select('id,nombre,apellidos,nombre_clinica').eq('estado','activo').order('nombre'),
      supabase.from('ejercicios').select('*').order('nombre'),
    ])
    setPacientes(p||[]); setEjercicios(e||[])
    setLoading(false)
  }

  async function cargarSesiones() {
    const { data: s } = await supabase.from('sesiones').select('*').eq('paciente_id', pacienteId).order('created_at',{ascending:false})
    setSesiones(s||[])
  }

  async function guardarSesion() {
    if (!formSesion.nombre || !pacienteId) { alert('Selecciona paciente y pon un nombre'); return }
    setGuardando(true)
    if (editandoSesion) {
      await supabase.from('sesiones').update({ nombre:formSesion.nombre, descripcion:formSesion.descripcion, partes:formSesion.partes }).eq('id', editandoSesion.id)
    } else {
      await supabase.from('sesiones').insert({ paciente_id:pacienteId, nombre:formSesion.nombre, descripcion:formSesion.descripcion, partes:formSesion.partes, estado:'lista' })
    }
    setModalSesion(false); setEditandoSesion(null); resetForm(); setGuardando(false); cargarSesiones()
  }

  async function duplicarSesion(s: any) {
    await supabase.from('sesiones').insert({ paciente_id:pacienteId, nombre:s.nombre+' (copia)', descripcion:s.descripcion, partes:s.partes||[], estado:'lista' })
    cargarSesiones()
  }

  async function abrirRegistro(s: any) {
    // aplanar todos los ejercicios de todas las partes
    const ejs: any[] = []
    ;(s.partes||[]).forEach((parte: any) => {
      ;(parte.ejercicios||[]).forEach((ej: any) => {
        const nSeries = parseInt(ej.series) || 4
        ejs.push({
          ejercicio_id: ej.ejercicio_id || null,
          nombre: ej.nombre,
          imagen_url: ej.imagen_url || '',
          variante: ej.variante || '',
          plan: { series: ej.series, reps: ej.reps, peso: ej.peso, tiempo: ej.tiempo },
          series: Array.from({length: nSeries}, () => ({ peso: '', reps: '' })),
          comentario: '', guardado: false,
        })
      })
    })
    setRegistrando(s)
    const ids = ejs.map(e => e.ejercicio_id).filter(Boolean)
    if (ids.length) {
      // ultimo registro FINALIZADO por ejercicio (referencia "ultima vez")
      const { data: fin } = await supabase.from('registros_ejercicio')
        .select('ejercicio_id,series,fecha,created_at')
        .eq('paciente_id', pacienteId).eq('finalizado', true)
        .in('ejercicio_id', ids)
        .order('fecha', { ascending: false }).order('created_at', { ascending: false })
      const ultMap: Record<string,any> = {}
      ;(fin||[]).forEach((r: any) => { if (!ultMap[r.ejercicio_id]) ultMap[r.ejercicio_id] = r })
      setUltimos(ultMap)
      // borrador EN CURSO (no finalizado) de esta sesion -> precargar
      const { data: curso } = await supabase.from('registros_ejercicio')
        .select('ejercicio_id,series,comentario')
        .eq('paciente_id', pacienteId).eq('sesion_id', s.id).eq('finalizado', false)
        .in('ejercicio_id', ids)
      const cursoMap: Record<string,any> = {}
      ;(curso||[]).forEach((r: any) => { cursoMap[r.ejercicio_id] = r })
      ejs.forEach(e => {
        if (e.ejercicio_id && cursoMap[e.ejercicio_id]) {
          const r = cursoMap[e.ejercicio_id]
          if (Array.isArray(r.series)) { e.series = r.series; e.comentario = r.comentario||''; e.guardado = true }
        }
      })
    } else {
      setUltimos({})
    }
    setDatosReg(ejs)
  }

  function programarAutosave(ejIdx: number, ejData: any) {
    if (autosaveTimers.current[ejIdx]) clearTimeout(autosaveTimers.current[ejIdx])
    autosaveTimers.current[ejIdx] = setTimeout(() => { autoguardar(ejIdx, ejData) }, 700)
  }

  function setSerie(ejIdx: number, serIdx: number, campo: string, val: string) {
    setDatosReg(prev => {
      const d = [...prev]
      const series = [...d[ejIdx].series]
      series[serIdx] = { ...series[serIdx], [campo]: val }
      d[ejIdx] = { ...d[ejIdx], series }
      programarAutosave(ejIdx, d[ejIdx])
      return d
    })
  }

  function addSerie(ejIdx: number) {
    setDatosReg(prev => {
      const d = [...prev]
      d[ejIdx] = { ...d[ejIdx], series: [...d[ejIdx].series, { peso:'', reps:'' }] }
      return d
    })
  }

  function quitarSerie(ejIdx: number, serIdx: number) {
    setDatosReg(prev => {
      const d = [...prev]
      d[ejIdx] = { ...d[ejIdx], series: d[ejIdx].series.filter((_:any,i:number)=>i!==serIdx) }
      programarAutosave(ejIdx, d[ejIdx])
      return d
    })
  }

  function setComentarioReg(ejIdx: number, val: string) {
    setDatosReg(prev => {
      const d = [...prev]
      d[ejIdx] = { ...d[ejIdx], comentario: val }
      programarAutosave(ejIdx, d[ejIdx])
      return d
    })
  }

  // autoguardado silencioso por ejercicio (buscar-y-decidir, finalizado=false)
  async function autoguardar(ei: number, ejData: any) {
    if (!registrando) return
    const ej = ejData
    const seriesLlenas = ej.series.filter((x:any) => x.peso !== '' || x.reps !== '')
    if (seriesLlenas.length === 0) return
    const fila:any = {
      paciente_id: pacienteId, ejercicio_id: ej.ejercicio_id, ejercicio_nombre: ej.nombre,
      sesion_id: registrando.id, series: seriesLlenas, comentario: ej.comentario||null, finalizado: false,
    }
    let error
    if (ej.ejercicio_id) {
      const { data: existe } = await supabase.from('registros_ejercicio')
        .select('id').eq('paciente_id', pacienteId).eq('ejercicio_id', ej.ejercicio_id)
        .eq('sesion_id', registrando.id).eq('finalizado', false).maybeSingle()
      if (existe) {
        ({ error } = await supabase.from('registros_ejercicio')
          .update({ series: seriesLlenas, comentario: ej.comentario||null, ejercicio_nombre: ej.nombre })
          .eq('id', existe.id))
      } else {
        ({ error } = await supabase.from('registros_ejercicio').insert(fila))
      }
    } else {
      ({ error } = await supabase.from('registros_ejercicio').insert(fila))
    }
    if (error) { console.error('autoguardar', error.message); return }
    setDatosReg(prev => { const d=[...prev]; if(d[ei]) d[ei]={...d[ei],guardado:true}; return d })
  }

  // finalizar: marca todo el borrador en curso como finalizado y cierra
  async function finalizarRegistro() {
    setGuardandoReg(true)
    // cancelar autosaves pendientes y forzar guardado de todo lo lleno
    Object.values(autosaveTimers.current).forEach((t:any)=>clearTimeout(t))
    autosaveTimers.current = {}
    for (let i=0;i<datosReg.length;i++){
      const ej=datosReg[i]
      const llenas=ej.series.filter((x:any)=>x.peso!==''||x.reps!=='')
      if (llenas.length>0) { await autoguardar(i, ej) }
    }
    // borrar finalizados previos del mismo dia para estos ejercicios (evita choque con indice)
    const hoy = new Date().toISOString().slice(0,10)
    const ids = datosReg.map((e:any)=>e.ejercicio_id).filter(Boolean)
    if (ids.length) {
      await supabase.from('registros_ejercicio')
        .delete()
        .eq('paciente_id', pacienteId).eq('fecha', hoy).eq('finalizado', true)
        .in('ejercicio_id', ids)
    }
    const { error } = await supabase.from('registros_ejercicio')
      .update({ finalizado: true })
      .eq('paciente_id', pacienteId).eq('sesion_id', registrando.id).eq('finalizado', false)
    setGuardandoReg(false)
    if (error) { alert('Error al finalizar: '+error.message); return }
    setRegistrando(null); setDatosReg([]); setUltimos({})
  }

  function resumenUltimo(ejercicio_id: string) {
    const u = ultimos[ejercicio_id]
    if (!u || !Array.isArray(u.series)) return null
    return u.series.map((x:any) => `${x.peso||'—'}${x.reps?'×'+x.reps:''}`).join(', ')
  }

  async function eliminarSesion(id: string) {
    if (!confirm('¿Eliminar esta sesión?')) return
    await supabase.from('sesiones').delete().eq('id', id)
    cargarSesiones()
  }

  function resetForm() {
    setFormSesion({ nombre:'', descripcion:'', partes:[{nombre:'Calentamiento',ejercicios:[]},{nombre:'Parte principal',ejercicios:[]},{nombre:'Vuelta a la calma',ejercicios:[]}] })
    setParteActiva(0); setBuscarEj('')
  }

  function abrirEditar(s: any) {
    setEditandoSesion(s)
    setFormSesion({ nombre:s.nombre||'', descripcion:s.descripcion||'', partes:s.partes||[] })
    setParteActiva(0); setModalSesion(true)
  }

  function abrirNueva() {
    setEditandoSesion(null); resetForm(); setModalSesion(true)
  }

  function addEjercicio(ej: any) {
    setConfigEj({ ejercicio_id:ej.id, nombre:ej.nombre, imagen_url:ej.imagen_url||'', video_url:ej.video_url||'', variante:'Bilateral', capacidad:'Fuerza', series:'3', reps:'10', peso:'', tiempo:'', nota:'' })
  }

  function confirmarEjercicio() {
    if (!configEj) return
    setFormSesion(prev => {
      const partes = [...prev.partes]
      partes[parteActiva] = { ...partes[parteActiva], ejercicios: [...(partes[parteActiva].ejercicios||[]), configEj] }
      return { ...prev, partes }
    })
    setConfigEj(null)
  }

  function quitarEjercicio(parteIdx: number, ejIdx: number) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      partes[parteIdx] = { ...partes[parteIdx], ejercicios: partes[parteIdx].ejercicios.filter((_:any,i:number)=>i!==ejIdx) }
      return { ...prev, partes }
    })
  }

  const ejFiltrados = ejercicios.filter(e => !buscarEj || e.nombre.toLowerCase().includes(buscarEj.toLowerCase()))
  const pacSel = pacientes.find(p=>p.id===pacienteId)

  return (
    <>
      {/* SELECTOR DE MODO */}
      <div style={{display:'flex',gap:6,marginBottom:12}}>
        {[['individual','🔧 Individual'],['clase','👥 Día de fuerza']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k as any)}
            style={{fontSize:11,padding:'6px 14px',borderRadius:99,cursor:'pointer',fontFamily:'system-ui',
              border:`1.5px solid ${tab===k?'var(--g)':'var(--bd)'}`,
              background:tab===k?'var(--g)':'var(--w)',color:tab===k?'#fff':'var(--gr)'}}>{l}</button>
        ))}
      </div>

      {tab==='clase' ? <ModoClase pacientes={pacientes}/> : (
      <>
      {/* CABECERA */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'9px 13px'}}>
        <span style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>🔧 Taller de sesiones</span>
        <div style={{flex:1}}/>
        <select className="input" style={{maxWidth:260}} value={pacienteId} onChange={e=>setPacienteId(e.target.value)}>
          <option value="">Seleccionar paciente...</option>
          {pacientes.map(p=><option key={p.id} value={p.id}>{p.nombre_clinica||p.nombre} {p.apellidos}</option>)}
        </select>
        {pacienteId && (
          <a href={`/entrenamiento?nueva_sesion=1&paciente_id=${pacienteId}&paciente_nombre=${encodeURIComponent((pacSel?.nombre_clinica||pacSel?.nombre||'')+' '+(pacSel?.apellidos||''))}`}
            className="btn btn-p btn-sm">+ Nueva sesión</a>
        )}
      </div>

      {!pacienteId ? (
        <div style={{textAlign:'center',padding:60,color:'var(--grl)',fontSize:11}}>Selecciona un paciente para ver y crear sus sesiones</div>
      ) : loading ? <div className="loading">Cargando...</div> : (
        <>
          {sesiones.length===0 ? (
            <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>
              {pacSel?.nombre_clinica||pacSel?.nombre} no tiene sesiones aún.
              <br/><button className="btn btn-p btn-sm" style={{marginTop:10}} onClick={abrirNueva}>+ Crear primera sesión</button>
            </div>
          ) : (
            <div className="g2">
              {sesiones.map(s=>{
                const totalEj = (s.partes||[]).reduce((acc:number,p:any)=>acc+(p.ejercicios||[]).length,0)
                return (
                  <div key={s.id} className="card">
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{s.nombre}</div>
                        {s.descripcion&&<div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>{s.descripcion}</div>}
                      </div>
                      <span style={{fontSize:9,color:'var(--grl)'}}>{totalEj} ejercicios</span>
                    </div>
                    {(s.partes||[]).map((parte:any,pi:number)=>(
                      parte.ejercicios?.length>0&&(
                        <div key={pi} style={{marginBottom:6}}>
                          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:4}}>{parte.nombre}</div>
                          {(parte.ejercicios||[]).map((ej:any,ei:number)=>(
                            <div key={ei} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 7px',background:'var(--bl)',borderRadius:4,marginBottom:2}}>
                              {ej.imagen_url?<img src={ej.imagen_url} alt={ej.nombre} style={{width:24,height:24,objectFit:'cover',borderRadius:3,flexShrink:0}}/>:<span style={{fontSize:14}}>💪</span>}
                              <span style={{fontSize:10,color:'var(--n)',flex:1}}>{ej.nombre}</span>
                              {ej.series&&<span style={{fontSize:9,color:'var(--grl)'}}>{ej.series}x{ej.reps}</span>}
                              {ej.peso&&<span style={{fontSize:9,color:'var(--g)',fontWeight:500}}>{ej.peso}kg</span>}
                            </div>
                          ))}
                        </div>
                      )
                    ))}
                    <div style={{display:'flex',gap:5,marginTop:8,borderTop:'1px solid var(--bl)',paddingTop:8}}>
                      <button className="btn btn-p btn-sm" onClick={()=>abrirRegistro(s)} disabled={totalEj===0} style={{opacity:totalEj===0?.4:1}}>▶ Registrar</button>
                      <button className="btn btn-s btn-sm" onClick={()=>abrirEditar(s)}>✏️ Editar</button>
                      <button className="btn btn-t btn-sm" onClick={()=>duplicarSesion(s)}>⧉ Duplicar</button>
                      <button className="btn btn-d btn-sm" onClick={()=>eliminarSesion(s.id)}>🗑</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
      </>
      )}

      {/* MODAL CONSTRUCTOR */}
      {modalSesion && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalSesion(false)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'90vw',maxWidth:900,maxHeight:'90vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,.15)'}}>
            {/* CABECERA MODAL */}
            <div style={{padding:'14px 18px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1}}>
                <input className="input" value={formSesion.nombre} onChange={e=>setFormSesion(p=>({...p,nombre:e.target.value}))} placeholder="Nombre de la sesión *" style={{fontSize:14,fontWeight:400,border:'none',background:'transparent',padding:'0',outline:'none'}} autoFocus/>
                <input className="input" value={formSesion.descripcion} onChange={e=>setFormSesion(p=>({...p,descripcion:e.target.value}))} placeholder="Descripción / objetivo (opcional)" style={{fontSize:11,color:'var(--grl)',border:'none',background:'transparent',padding:'0',outline:'none',width:'100%',marginTop:3}}/>
              </div>
              <button className="btn btn-p" onClick={guardarSesion} disabled={guardando}>{guardando?'⏳':'💾 Guardar'}</button>
              <button onClick={()=>setModalSesion(false)} style={{width:24,height:24,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontSize:12,color:'var(--gr)'}}>✕</button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 320px',flex:1,overflow:'hidden'}}>
              {/* IZQUIERDA — PARTES Y EJERCICIOS */}
              <div style={{overflowY:'auto',padding:14,borderRight:'1px solid var(--bd)'}}>
                {/* TABS PARTES */}
                <div style={{display:'flex',gap:4,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
                  {formSesion.partes.map((p,i)=>(
                    <button key={i} onClick={()=>setParteActiva(i)}
                      style={{fontSize:10,padding:'4px 10px',borderRadius:99,border:`1.5px solid ${parteActiva===i?'var(--g)':'var(--bd)'}`,background:parteActiva===i?'var(--g)':'var(--w)',color:parteActiva===i?'#fff':'var(--gr)',cursor:'pointer',fontFamily:'system-ui'}}>
                      {p.nombre} <span style={{opacity:.7}}>({(p.ejercicios||[]).length})</span>
                    </button>
                  ))}
                  <button onClick={()=>{setFormSesion(p=>({...p,partes:[...p.partes,{nombre:`Parte ${p.partes.length+1}`,ejercicios:[]}]}));setParteActiva(formSesion.partes.length)}}
                    style={{fontSize:10,padding:'4px 10px',borderRadius:99,border:'1.5px dashed var(--bd)',background:'var(--w)',color:'var(--grl)',cursor:'pointer',fontFamily:'system-ui'}}>
                    + Parte
                  </button>
                </div>

                {/* NOMBRE PARTE */}
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <input className="input" value={formSesion.partes[parteActiva]?.nombre||''} 
                    onChange={e=>setFormSesion(prev=>{const p=[...prev.partes];p[parteActiva]={...p[parteActiva],nombre:e.target.value};return{...prev,partes:p}})}
                    style={{fontWeight:500,fontSize:12}}/>
                  {formSesion.partes.length>1&&(
                    <button onClick={()=>{setFormSesion(prev=>({...prev,partes:prev.partes.filter((_,i)=>i!==parteActiva)}));setParteActiva(Math.max(0,parteActiva-1))}}
                      className="btn btn-d btn-sm">🗑 Eliminar parte</button>
                  )}
                </div>

                {/* EJERCICIOS DE LA PARTE */}
                {(formSesion.partes[parteActiva]?.ejercicios||[]).length===0 ? (
                  <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:10,border:'1.5px dashed var(--bm)',borderRadius:'var(--rl)'}}>
                    Selecciona ejercicios de la biblioteca →
                  </div>
                ) : (
                  (formSesion.partes[parteActiva]?.ejercicios||[]).map((ej:any,ei:number)=>(
                    <div key={ei} style={{background:'var(--bl)',borderRadius:7,border:'1px solid var(--bd)',marginBottom:6,overflow:'hidden'}}>
                      <div style={{display:'flex',alignItems:'center',gap:7,padding:'7px 9px'}}>
                        {ej.imagen_url?<img src={ej.imagen_url} alt={ej.nombre} style={{width:36,height:36,objectFit:'cover',borderRadius:4,flexShrink:0}}/>:<div style={{width:36,height:36,background:'var(--bm)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>💪</div>}
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{ej.nombre}</div>
                          <div style={{display:'flex',gap:3,marginTop:2}}>
                            {ej.variante&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{ej.variante}</span>}
                            {ej.capacidad&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{ej.capacidad}</span>}
                          </div>
                        </div>
                        <button onClick={()=>quitarEjercicio(parteActiva,ei)} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 5px'}}>✕</button>
                      </div>
                      <div style={{padding:'5px 9px 8px',borderTop:'1px solid var(--bm)',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                        {[['series','Series',40],['reps','Reps',40],['peso','Kg',40],['tiempo','Seg',40]].map(([k,l,w])=>(
                          <div key={k} style={{display:'flex',alignItems:'center',gap:3}}>
                            <span style={{fontSize:9,color:'var(--grl)'}}>{l}</span>
                            <input type="number" value={(ej as any)[k]||''} onChange={e=>{
                              setFormSesion(prev=>{
                                const partes=[...prev.partes]
                                const ejercicios=[...partes[parteActiva].ejercicios]
                                ejercicios[ei]={...ejercicios[ei],[k]:e.target.value}
                                partes[parteActiva]={...partes[parteActiva],ejercicios}
                                return{...prev,partes}
                              })
                            }} style={{width:w,fontSize:11,padding:'2px 4px',border:'1px solid var(--bd)',borderRadius:4,textAlign:'center',fontFamily:'system-ui'}} placeholder="—"/>
                          </div>
                        ))}
                        <input value={ej.nota||''} onChange={e=>{
                          setFormSesion(prev=>{
                            const partes=[...prev.partes]
                            const ejercicios=[...partes[parteActiva].ejercicios]
                            ejercicios[ei]={...ejercicios[ei],nota:e.target.value}
                            partes[parteActiva]={...partes[parteActiva],ejercicios}
                            return{...prev,partes}
                          })
                        }} style={{flex:1,fontSize:10,padding:'2px 6px',border:'1px solid var(--bd)',borderRadius:4,fontFamily:'system-ui',minWidth:80}} placeholder="📝 Nota..."/>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* DERECHA — BIBLIOTECA */}
              <div style={{overflowY:'auto',padding:10,background:'var(--bl)'}}>
                <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:7}}>Biblioteca de ejercicios</div>
                <input className="input" placeholder="🔍 Buscar..." value={buscarEj} onChange={e=>setBuscarEj(e.target.value)} style={{marginBottom:8,fontSize:11}}/>
                {ejFiltrados.map(e=>(
                  <div key={e.id} onClick={()=>addEjercicio(e)}
                    style={{display:'flex',alignItems:'center',gap:7,padding:'6px 8px',background:'var(--w)',borderRadius:6,border:'1px solid var(--bd)',marginBottom:4,cursor:'pointer',transition:'all .12s'}}
                    onMouseOver={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                    onMouseOut={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                    {e.imagen_url?<img src={e.imagen_url} alt={e.nombre} style={{width:28,height:28,objectFit:'cover',borderRadius:3,flexShrink:0}}/>:<div style={{width:28,height:28,background:'var(--bm)',borderRadius:3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>💪</div>}
                    <span style={{fontSize:10,color:'var(--n)',flex:1,fontWeight:300}}>{e.nombre}</span>
                    <span style={{fontSize:12,color:'var(--g)'}}>+</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIG EJERCICIO */}
      {configEj&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setConfigEj(null)}}>
          <div className="modal" style={{width:380}}>
            <div className="modal-title">Configurar ejercicio<button className="modal-close" onClick={()=>setConfigEj(null)}>✕</button></div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,padding:'8px 10px',background:'var(--bl)',borderRadius:6}}>
              {configEj.imagen_url?<img src={configEj.imagen_url} alt={configEj.nombre} style={{width:40,height:40,objectFit:'cover',borderRadius:4}}/>:<div style={{width:40,height:40,background:'var(--bm)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>💪</div>}
              <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{configEj.nombre}</div>
            </div>
            <div className="g2">
              <div className="field"><label>Variante</label>
                <select className="input" value={configEj.variante} onChange={e=>setConfigEj((p:any)=>({...p,variante:e.target.value}))}>
                  {['Bilateral','Unilateral','Alterno','Unipodal'].map(v=><option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="field"><label>Capacidad</label>
                <select className="input" value={configEj.capacidad} onChange={e=>setConfigEj((p:any)=>({...p,capacidad:e.target.value}))}>
                  {['Fuerza','Fuerza máxima','Movilidad','Isométrico','Excéntrico','Estiramiento'].map(v=><option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="field"><label>Series</label><input className="input" type="number" value={configEj.series} onChange={e=>setConfigEj((p:any)=>({...p,series:e.target.value}))} placeholder="3"/></div>
              <div className="field"><label>Reps</label><input className="input" type="number" value={configEj.reps} onChange={e=>setConfigEj((p:any)=>({...p,reps:e.target.value}))} placeholder="10"/></div>
              <div className="field"><label>Peso (kg)</label><input className="input" type="number" value={configEj.peso} onChange={e=>setConfigEj((p:any)=>({...p,peso:e.target.value}))} placeholder="0"/></div>
              <div className="field"><label>Tiempo (seg)</label><input className="input" type="number" value={configEj.tiempo} onChange={e=>setConfigEj((p:any)=>({...p,tiempo:e.target.value}))} placeholder="—"/></div>
            </div>
            <div className="field"><label>Nota</label><input className="input" value={configEj.nota} onChange={e=>setConfigEj((p:any)=>({...p,nota:e.target.value}))} placeholder="Indicaciones específicas..."/></div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setConfigEj(null)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={confirmarEjercicio}>✓ Añadir a la sesión</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRO (individual) */}
      {registrando && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setRegistrando(null)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'92vw',maxWidth:680,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,.15)'}}>
            <div style={{padding:'14px 18px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:400,color:'var(--n)'}}>▶ {registrando.nombre}</div>
                <div style={{fontSize:10,color:'var(--grl)',marginTop:2}}>{pacSel?.nombre_clinica||pacSel?.nombre} · guarda cada ejercicio; al salir queda como borrador</div>
              </div>
              <button className="btn btn-p" onClick={finalizarRegistro} disabled={guardandoReg}>{guardandoReg?'⏳':'✓ Guardar y finalizar'}</button>
              <button onClick={()=>setRegistrando(null)} style={{width:24,height:24,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontSize:12,color:'var(--gr)'}}>✕</button>
            </div>
            <div style={{overflowY:'auto',padding:14}}>
              {datosReg.length===0 ? (
                <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:11}}>Esta sesión no tiene ejercicios.</div>
              ) : datosReg.map((ej:any,ei:number)=>{
                const ult = ej.ejercicio_id ? (ultimos[ej.ejercicio_id]?.series || null) : null
                return (
                  <div key={ei} style={{background:'var(--bl)',borderRadius:8,border:`1px solid ${ej.guardado?'var(--g)':'var(--bd)'}`,marginBottom:8,padding:'9px 11px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
                      {ej.imagen_url?<img src={ej.imagen_url} alt={ej.nombre} style={{width:30,height:30,objectFit:'cover',borderRadius:4,flexShrink:0}}/>:<div style={{width:30,height:30,background:'var(--bm)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>💪</div>}
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{ej.nombre}{ej.variante&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--gl)',color:'var(--gd)',marginLeft:6}}>{ej.variante}</span>}</div>
                        {!ult&&<div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>Sin registro previo{ej.plan?.peso?` · plan ${ej.plan.peso}kg`:''}</div>}
                      </div>
                      {ej.guardado&&<span style={{fontSize:9,color:'var(--g)'}}>✓ guardado</span>}
                    </div>
                    {ej.series.map((ser:any,si:number)=>{
                      const prev = ult && ult[si] ? `${ult[si].peso||'—'}${ult[si].reps?'×'+ult[si].reps:''}` : null
                      return (
                        <div key={si} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                          <span style={{fontSize:10,color:'var(--grl)',width:16,textAlign:'center'}}>{si+1}</span>
                          <input inputMode="decimal" value={ser.peso} onChange={e=>setSerie(ei,si,'peso',e.target.value)} placeholder="—" style={{width:56,fontSize:12,padding:'5px 6px',border:'1px solid var(--bd)',borderRadius:5,textAlign:'center'}}/>
                          <span style={{fontSize:9,color:'var(--grl)'}}>kg</span>
                          <span style={{fontSize:11,color:'var(--bm)'}}>×</span>
                          <input inputMode="numeric" value={ser.reps} onChange={e=>setSerie(ei,si,'reps',e.target.value)} placeholder="—" style={{width:56,fontSize:12,padding:'5px 6px',border:'1px solid var(--bd)',borderRadius:5,textAlign:'center'}}/>
                          <span style={{fontSize:9,color:'var(--grl)'}}>reps</span>
                          <div style={{flex:1}}/>
                          {prev&&<span style={{fontSize:10,color:'var(--g)',whiteSpace:'nowrap'}}>ant: {prev}</span>}
                          {ej.series.length>1&&<button onClick={()=>quitarSerie(ei,si)} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 5px'}}>✕</button>}
                        </div>
                      )
                    })}
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                      <button onClick={()=>addSerie(ei)} style={{fontSize:9,color:'var(--g)',background:'none',border:'none',cursor:'pointer',padding:'2px 0'}}>+ serie</button>
                      <input value={ej.comentario} onChange={e=>setComentarioReg(ei,e.target.value)} placeholder="📝 comentario..." style={{flex:1,fontSize:10,padding:'4px 7px',border:'1px solid var(--bd)',borderRadius:4}}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
