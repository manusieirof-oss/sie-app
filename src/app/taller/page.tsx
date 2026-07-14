'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import ModoClase from './ModoClase'
import ModalEditarSesion from '@/app/entrenamiento/components/ModalEditarSesion'

export default function TallerPage() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [ejercicios, setEjercicios] = useState<any[]>([])
  const [sesiones, setSesiones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pacienteId, setPacienteId] = useState('')
  const [sesionEditando, setSesionEditando] = useState<any>(null)
  const [registrando, setRegistrando] = useState<any>(null)
  const [datosReg, setDatosReg] = useState<any[]>([])
  const [ultimos, setUltimos] = useState<Record<string,any>>({})
  const [guardandoReg, setGuardandoReg] = useState(false)
  const [tab, setTab] = useState<'individual'|'clase'>('individual')
  const autosaveTimers = useRef<Record<number, any>>({})
  const [modoAccion, setModoAccion] = useState<''|'registrar'|'editar'|'duplicar'|'eliminar'>('')
  const [busquedaPac, setBusquedaPac] = useState('')

  function ejecutarAccion(s: any) {
    const a = modoAccion
    setModoAccion('')
    if (a==='registrar') { if ((s.partes||[]).reduce((n:number,p:any)=>n+(p.ejercicios||[]).length,0)===0){alert('Esta sesión no tiene ejercicios');return} abrirRegistro(s) }
    else if (a==='editar') abrirEditar(s)
    else if (a==='duplicar') duplicarSesion(s)
    else if (a==='eliminar') eliminarSesion(s.id)
  }

  const restaurarInd = useRef<{done:boolean, pid?:string, regId?:string}>({done:false})
  const IKEY = 'taller_individual'

  useEffect(() => { cargar() }, [])
  useEffect(() => { if (pacienteId) cargarSesiones() }, [pacienteId])

  // aplicar restauracion una sola vez cuando hay pacientes cargados
  useEffect(() => {
    if (restaurarInd.current.done) return
    if (!pacientes.length) return
    let intencion: any = null
    try { const raw = sessionStorage.getItem(IKEY); if (raw) intencion = JSON.parse(raw) } catch {}
    if (intencion?.pid && pacientes.some(p=>p.id===intencion.pid)) {
      restaurarInd.current = { done:true, pid:intencion.pid, regId:intencion.regId||'' }
      setPacienteId(intencion.pid)
    } else {
      restaurarInd.current = { done:true }
    }
  }, [pacientes])

  // cuando cargan las sesiones del paciente restaurado, reabrir modal si procede
  useEffect(() => {
    const r = restaurarInd.current
    if (r.done && r.regId && pacienteId===r.pid && sesiones.length) {
      const ses = sesiones.find((x:any)=>x.id===r.regId)
      if (ses) abrirRegistro(ses)
      restaurarInd.current = { done:true } // limpiar intencion de modal para no reabrir de nuevo
    }
  }, [sesiones, pacienteId])

  // guardar intencion (solo cuando ya restauramos y hay paciente)
  useEffect(() => {
    if (!restaurarInd.current.done) return
    if (!pacienteId) { try { sessionStorage.removeItem(IKEY) } catch {}; return }
    try { sessionStorage.setItem(IKEY, JSON.stringify({ pid: pacienteId, regId: registrando?.id||'' })) } catch {}
  }, [pacienteId, registrando])

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
    // cargar tipo_medida real de cada ejercicio (opcion A: siempre actualizado)
    if (ids.length) {
      const { data: tipos } = await supabase.from('ejercicios').select('id,tipo_medida').in('id', ids)
      const tipoMap: Record<string,string> = {}
      ;(tipos||[]).forEach((t:any)=>{ tipoMap[t.id] = t.tipo_medida||'peso_reps' })
      ejs.forEach(e=>{ e.tipo_medida = e.ejercicio_id ? (tipoMap[e.ejercicio_id]||'peso_reps') : 'peso_reps' })
    } else {
      ejs.forEach(e=>{ e.tipo_medida = 'peso_reps' })
    }
    if (ids.length) {
      // ultimo registro FINALIZADO por ejercicio (referencia "ultima vez")
      const { data: fin } = await supabase.from('registros_ejercicio')
        .select('ejercicio_id,series,fecha,created_at,comentario')
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
          if (Array.isArray(r.series)) {
            const merged = e.series.map((orig:any, idx:number) => r.series[idx] || orig)
            for (let k=e.series.length; k<r.series.length; k++) merged.push(r.series[k])
            e.series = merged; e.comentario = r.comentario||''; e.guardado = true
          }
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
    const seriesLlenas = ej.series.filter((x:any) => x.peso !== '' || x.reps !== '' || (x.segundos !== '' && x.segundos !== undefined))
    const hayComent = (ej.comentario||'').trim() !== ''
    if (seriesLlenas.length === 0 && !hayComent) return
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
      const llenas=ej.series.filter((x:any)=>x.peso!==''||x.reps!==''||(x.segundos!==''&&x.segundos!==undefined))
      const hayComent=(ej.comentario||'').trim()!==''
      if (llenas.length>0 || hayComent) { await autoguardar(i, ej) }
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

  function abrirEditar(s: any) {
    setSesionEditando(s)
  }

  function abrirNueva() {
    setSesionEditando({ paciente_id: pacienteId, nombre:'', descripcion:'', partes:[{nombre:'Calentamiento',ejercicios:[]},{nombre:'Parte principal',ejercicios:[]},{nombre:'Vuelta a la calma',ejercicios:[]}] })
  }

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

      <div style={{display: tab==='clase' ? 'block' : 'none'}}>
        <ModoClase pacientes={pacientes}/>
      </div>

      <div style={{display: tab==='individual' ? 'block' : 'none'}}>
      {/* CABECERA */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'9px 13px',flexWrap:'wrap'}}>
        <span style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>🔧 Taller de sesiones</span>
        {pacienteId && sesiones.length>0 && (
          <div style={{display:'flex',gap:5}}>
            {([['registrar','▶ Registrar','btn-p'],['editar','✏️ Editar','btn-s'],['duplicar','⧉ Duplicar','btn-t'],['eliminar','🗑 Eliminar','btn-d']] as any[]).map(([k,l,cls])=>(
              <button key={k} className={`btn ${cls} btn-sm`} onClick={()=>setModoAccion(modoAccion===k?'':k)}
                style={{outline:modoAccion===k?'2px solid var(--n)':'none',outlineOffset:1}}>{l}</button>
            ))}
          </div>
        )}
        <div style={{flex:1}}/>
        <div style={{position:'relative',width:260}}>
          {pacienteId ? (
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px',border:'1px solid var(--bd)',borderRadius:'var(--rl)',background:'var(--w)',fontSize:11}}>
              <span style={{flex:1,color:'var(--n)'}}>{pacSel?.nombre} {pacSel?.apellidos}{pacSel?.nombre_clinica?<span style={{color:'var(--grl)',fontSize:9}}> · {pacSel.nombre_clinica}</span>:null}</span>
              <button onClick={()=>{setPacienteId('');setModoAccion('')}} style={{fontSize:12,color:'var(--gr)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
            </div>
          ) : (
            <>
              <input className="input" value={busquedaPac} onChange={e=>setBusquedaPac(e.target.value)} placeholder="🔍 Buscar paciente..." style={{fontSize:11}}/>
              {busquedaPac && (
                <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:20,marginTop:4,border:'1px solid var(--bd)',borderRadius:6,maxHeight:240,overflowY:'auto',background:'var(--w)',boxShadow:'0 4px 16px rgba(0,0,0,.1)'}}>
                  {pacientes.filter((p:any)=>`${p.nombre} ${p.apellidos} ${p.nombre_clinica||''}`.toLowerCase().includes(busquedaPac.toLowerCase())).slice(0,30).map((p:any)=>(
                    <div key={p.id} onClick={()=>{setPacienteId(p.id);setBusquedaPac('')}} style={{padding:'8px 11px',cursor:'pointer',fontSize:11,borderBottom:'1px solid var(--bl)'}} onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                      {p.nombre} {p.apellidos}{p.nombre_clinica?<span style={{color:'var(--grl)',fontSize:9}}> · {p.nombre_clinica}</span>:null}
                    </div>
                  ))}
                  {pacientes.filter((p:any)=>`${p.nombre} ${p.apellidos} ${p.nombre_clinica||''}`.toLowerCase().includes(busquedaPac.toLowerCase())).length===0 && (
                    <div style={{padding:'8px 11px',fontSize:10,color:'var(--grl)'}}>Sin pacientes que coincidan</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {pacienteId && (
          <button className="btn btn-p btn-sm" onClick={abrirNueva}>+ Nueva sesión</button>
        )}
      </div>

      {modoAccion && (
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,padding:'8px 13px',borderRadius:'var(--rl)',background:'var(--gl)',border:'1px solid var(--g)',fontSize:11,color:'var(--gd)'}}>
          <span>👉 Selecciona una sesión para <b>{modoAccion}</b></span>
          <div style={{flex:1}}/>
          <button className="btn btn-d btn-sm" onClick={()=>setModoAccion('')}>Cancelar</button>
        </div>
      )}

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
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:10}}>
              {sesiones.map(s=>{
                const totalEj = (s.partes||[]).reduce((acc:number,p:any)=>acc+(p.ejercicios||[]).length,0)
                return (
                  <div key={s.id} className="card"
                    onClick={()=>{ if(modoAccion) ejecutarAccion(s) }}
                    style={modoAccion?{cursor:'pointer',outline:'2px dashed var(--g)',outlineOffset:2,transition:'all .1s'}:undefined}>
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
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
      </div>

      {sesionEditando && <ModalEditarSesion sesion={sesionEditando} ejercicios={ejercicios} onGuardado={()=>{cargarSesiones()}} onCerrar={()=>setSesionEditando(null)}/>}

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
                const ultComent = ej.ejercicio_id ? (ultimos[ej.ejercicio_id]?.comentario || '') : ''
                return (
                  <div key={ei} style={{background:'var(--bl)',borderRadius:8,border:`1px solid ${ej.guardado?'var(--g)':'var(--bd)'}`,marginBottom:8,padding:'9px 11px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
                      {ej.imagen_url?<img src={ej.imagen_url} alt={ej.nombre} style={{width:30,height:30,objectFit:'cover',borderRadius:4,flexShrink:0}}/>:<div style={{width:30,height:30,background:'var(--bm)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>💪</div>}
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{ej.nombre}{ej.variante&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--gl)',color:'var(--gd)',marginLeft:6}}>{ej.variante}</span>}</div>
                        {!ult&&<div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>Sin registro previo{ej.plan?.peso?` · plan ${ej.plan.peso}kg`:''}</div>}
                        {ultComent&&<div style={{fontSize:9,color:'var(--g)',marginTop:2,fontStyle:'italic'}}>💬 última vez: {ultComent}</div>}
                      </div>
                      {ej.guardado&&<span style={{fontSize:9,color:'var(--g)'}}>✓ guardado</span>}
                    </div>
                    {ej.series.map((ser:any,si:number)=>{
                      const tm = ej.tipo_medida || 'peso_reps'
                      const fmtPrev = (x:any) => {
                        if (!x) return null
                        if (tm==='tiempo') return x.segundos?`${x.segundos}s`:null
                        if (tm==='peso_tiempo') return (x.peso||x.segundos)?`${x.peso||'—'}kg·${x.segundos||'—'}s`:null
                        return (x.peso||x.reps)?`${x.peso||'—'}${x.reps?'×'+x.reps:''}`:null
                      }
                      const prev = ult && ult[si] ? fmtPrev(ult[si]) : null
                      return (
                        <div key={si} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                          <span style={{fontSize:10,color:'var(--grl)',width:16,textAlign:'center'}}>{si+1}</span>
                          {tm!=='tiempo' && <>
                            <input inputMode="decimal" value={ser.peso||''} onChange={e=>setSerie(ei,si,'peso',e.target.value)} placeholder="—" style={{width:56,fontSize:12,padding:'5px 6px',border:'1px solid var(--bd)',borderRadius:5,textAlign:'center'}}/>
                            <span style={{fontSize:9,color:'var(--grl)'}}>kg</span>
                          </>}
                          {tm==='peso_reps' && <>
                            <span style={{fontSize:11,color:'var(--bm)'}}>×</span>
                            <input inputMode="numeric" value={ser.reps||''} onChange={e=>setSerie(ei,si,'reps',e.target.value)} placeholder="—" style={{width:56,fontSize:12,padding:'5px 6px',border:'1px solid var(--bd)',borderRadius:5,textAlign:'center'}}/>
                            <span style={{fontSize:9,color:'var(--grl)'}}>reps</span>
                          </>}
                          {(tm==='tiempo'||tm==='peso_tiempo') && <>
                            {tm==='peso_tiempo' && <span style={{fontSize:11,color:'var(--bm)'}}>·</span>}
                            <input inputMode="numeric" value={ser.segundos||''} onChange={e=>setSerie(ei,si,'segundos',e.target.value)} placeholder="—" style={{width:56,fontSize:12,padding:'5px 6px',border:'1px solid var(--bd)',borderRadius:5,textAlign:'center'}}/>
                            <span style={{fontSize:9,color:'var(--grl)'}}>seg</span>
                          </>}
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
