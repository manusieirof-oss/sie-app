'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'

const hoy = () => new Date().toISOString().slice(0,10)

export default function ModoClase({ pacientes }: { pacientes: any[] }) {
  const [fecha, setFecha] = useState(hoy())
  const [seleccion, setSeleccion] = useState<any[]>([])
  const [activo, setActivo] = useState<string>('')
  const [busquedaPac, setBusquedaPac] = useState('')
  const timers = useRef<Record<string, any>>({})
  const restaurado = useRef(false)
  const SKEY = 'taller_clase'
  const [objetivosLib, setObjetivosLib] = useState<any[]>([])
  const [objsPorPaciente, setObjsPorPaciente] = useState<Record<string,any[]>>({})

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('objetivos').select('id,nombre,color').eq('activo',true).order('nombre')
      setObjetivosLib(data||[])
    })()
  }, [])

  async function cargarObjsPaciente(pid: string) {
    const { data } = await supabase.from('pacientes_objetivos').select('objetivo_id,origen,vias').eq('paciente_id', pid)
    setObjsPorPaciente(prev => ({ ...prev, [pid]: data||[] }))
  }

  async function toggleObjetivo(pid: string, objetivoId: string, ejercicioId?: string, ejercicioNombre?: string) {
    const actuales = objsPorPaciente[pid] || []
    const existe = actuales.find((o:any)=>o.objetivo_id===objetivoId)
    const ref = ejercicioId || ''
    const etiqueta = ejercicioNombre ? ('Ejercicio: ' + ejercicioNombre) : 'Ejecucion'
    if (existe) {
      const vias = Array.isArray(existe.vias) ? existe.vias : []
      const restantes = vias.filter((v:any)=>!(v.tipo==='ejecucion' && v.ref===ref))
      if (restantes.length===0) {
        const { error } = await supabase.from('pacientes_objetivos')
          .delete().eq('paciente_id', pid).eq('objetivo_id', objetivoId)
        if (error) { alert('Error: '+error.message); return }
      } else {
        const todasResueltas = restantes.every((v:any)=>v.resuelto)
        const { error } = await supabase.from('pacientes_objetivos')
          .update({ vias:restantes, logrado:todasResueltas, fecha_logrado: todasResueltas?new Date().toISOString().slice(0,10):null })
          .eq('paciente_id', pid).eq('objetivo_id', objetivoId)
        if (error) { alert('Error: '+error.message); return }
      }
    } else {
      const nuevaVia = { tipo:'ejecucion', ref, etiqueta, resuelto:false, fecha_resuelto:null }
      const { error } = await supabase.from('pacientes_objetivos')
        .insert({ paciente_id: pid, objetivo_id: objetivoId, origen: 'ejecucion', vias:[nuevaVia] })
      if (error) { alert('Error: '+error.message); return }
    }
    await cargarObjsPaciente(pid)
  }

  async function resolverViaEjecucionClase(pid: string, objetivoIds: string[], ejercicioId: string, resuelto: boolean) {
    for (const oid of objetivoIds) {
      const { data: po } = await supabase.from('pacientes_objetivos')
        .select('vias').eq('paciente_id', pid).eq('objetivo_id', oid).maybeSingle()
      if (!po) continue
      const vias = Array.isArray(po.vias) ? po.vias : []
      let cambio = false
      const nuevas = vias.map((v:any)=>{
        if (v.tipo==='ejecucion' && v.ref===ejercicioId && v.resuelto!==resuelto) { cambio=true; return {...v, resuelto, fecha_resuelto: resuelto?new Date().toISOString().slice(0,10):null} }
        return v
      })
      if (cambio) {
        const todasResueltas = nuevas.length>0 && nuevas.every((v:any)=>v.resuelto)
        await supabase.from('pacientes_objetivos').update({
          vias:nuevas, logrado:todasResueltas, fecha_logrado: todasResueltas?new Date().toISOString().slice(0,10):null,
        }).eq('paciente_id', pid).eq('objetivo_id', oid)
      }
    }
    cargarObjsPaciente(pid)
  }

  // cargar ejercicios+borrador de una sesion sin depender del estado (para restaurar)
  async function cargarDatosSesion(pid: string, ses: any) {
    const ejs: any[] = []
    ;(ses.partes||[]).forEach((parte:any)=>{
      ;(parte.ejercicios||[]).forEach((ej:any)=>{
        const n = parseInt(ej.series)||4
        ejs.push({
          ejercicio_id: ej.ejercicio_id||null, nombre: ej.nombre,
          imagen_url: ej.imagen_url||'', variante: ej.variante||'',
          plan:{peso:ej.peso,reps:ej.reps},
          series: Array.from({length:n},()=>({peso:'',reps:''})),
          comentario:'', ultimo:null, guardado:false,
        })
      })
    })
    const ids = ejs.map(e=>e.ejercicio_id).filter(Boolean)
    if (ids.length) {
      const { data: tipos } = await supabase.from('ejercicios').select('id,tipo_medida,items_ejecucion,feedbacks').in('id', ids)
      const tipoMap:Record<string,any>={}
      ;(tipos||[]).forEach((t:any)=>{ tipoMap[t.id]=t })
      ejs.forEach(e=>{
        const t = e.ejercicio_id ? tipoMap[e.ejercicio_id] : null
        e.tipo_medida = t?.tipo_medida || 'peso_reps'
        e.items = t?.items_ejecucion || []
        e.feedbacks = t?.feedbacks || []
        if (!e.items_evaluados) e.items_evaluados = {}
      })
    } else {
      ejs.forEach(e=>{ e.tipo_medida = 'peso_reps'; e.items = []; e.feedbacks = []; if(!e.items_evaluados) e.items_evaluados = {} })
    }
    if (ids.length) {
      const { data: fin } = await supabase.from('registros_ejercicio')
        .select('ejercicio_id,series,fecha,created_at,comentario')
        .eq('paciente_id', pid).eq('finalizado', true).in('ejercicio_id', ids)
        .order('fecha',{ascending:false}).order('created_at',{ascending:false})
      const ultMap:Record<string,any>={}
      ;(fin||[]).forEach((r:any)=>{ if(!ultMap[r.ejercicio_id]) ultMap[r.ejercicio_id]=r })
      const { data: curso } = await supabase.from('registros_ejercicio')
        .select('ejercicio_id,series,comentario,items_evaluados')
        .eq('paciente_id', pid).eq('sesion_id', ses.id).eq('finalizado', false).in('ejercicio_id', ids)
      const cursoMap:Record<string,any>={}
      ;(curso||[]).forEach((r:any)=>{ cursoMap[r.ejercicio_id]=r })
      ejs.forEach(e=>{
        if (e.ejercicio_id){
          e.ultimo = ultMap[e.ejercicio_id]?.series || null
          e.ultimoComent = ultMap[e.ejercicio_id]?.comentario || ''
          const c = cursoMap[e.ejercicio_id]
          if (c && Array.isArray(c.series)) {
            // fusionar: mantener nº de series de la plantilla, rellenar con lo guardado
            const merged = e.series.map((orig:any, idx:number) => c.series[idx] || orig)
            // si el borrador tenia mas series que la plantilla, añadirlas
            for (let k=e.series.length; k<c.series.length; k++) merged.push(c.series[k])
            e.series = merged; e.comentario = c.comentario||''; e.guardado = true
          }
          if (c && c.items_evaluados && typeof c.items_evaluados==='object') e.items_evaluados = c.items_evaluados
        }
      })
    }
    return ejs
  }

  // RESTAURAR: espera a que 'pacientes' este cargado (viene async por props)
  useEffect(() => {
    if (restaurado.current) return
    if (!pacientes.length) return
    (async () => {
      try {
        const raw = sessionStorage.getItem(SKEY)
        if (!raw) { restaurado.current = true; return }
        const saved = JSON.parse(raw)
        if (saved.fecha) setFecha(saved.fecha)
        const nueva: any[] = []
        for (const it of (saved.items||[])) {
          const pac = pacientes.find((p:any)=>p.id===it.pid)
          if (!pac) continue
          const { data: ses } = await supabase.from('sesiones')
            .select('*').eq('paciente_id', pac.id).order('created_at',{ascending:false})
          const sesElegida = (ses||[]).find((x:any)=>x.id===it.sesionId)
          let datos: any[] = []
          if (sesElegida) datos = await cargarDatosSesion(pac.id, sesElegida)
          nueva.push({ paciente:pac, sesionId:it.sesionId||'', sesiones:ses||[], datos, cargado:!!sesElegida, finalizado:!!it.finalizado })
          cargarObjsPaciente(pac.id)
        }
        restaurado.current = true
        setSeleccion(nueva)
        if (saved.activo) setActivo(saved.activo)
      } catch(e) { console.error('restaurar clase', e); restaurado.current = true }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacientes])

  // GUARDAR cuando cambia (solo lo minimo)
  useEffect(() => {
    if (!restaurado.current) return
    if (seleccion.length===0) { try { sessionStorage.removeItem(SKEY) } catch {}; return }
    try {
      const items = seleccion.map((s:any)=>({ pid:s.paciente.id, sesionId:s.sesionId, finalizado:s.finalizado }))
      sessionStorage.setItem(SKEY, JSON.stringify({ fecha, activo, items }))
    } catch(e) {}
  }, [seleccion, activo, fecha])

  const nombrePac = (p:any) => `${p.nombre} ${p.apellidos||''}`.trim()
  const yaElegido = (id:string) => seleccion.some(s => s.paciente.id === id)
  const pacFiltrados = pacientes.filter((p:any)=>{
    if (yaElegido(p.id)) return false
    return `${p.nombre} ${p.apellidos} ${p.nombre_clinica||''}`.toLowerCase().includes(busquedaPac.toLowerCase())
  })

  async function addPaciente(p: any) {
    const { data: ses } = await supabase.from('sesiones')
      .select('*').eq('paciente_id', p.id).order('created_at',{ascending:false})
    setSeleccion(prev => [...prev, { paciente:p, sesionId:'', sesiones:ses||[], datos:[], cargado:false, finalizado:false }])
    setActivo(p.id)
    setBusquedaPac('')
    cargarObjsPaciente(p.id)
  }

  function quitarPaciente(pid: string) {
    setSeleccion(prev => prev.filter(s => s.paciente.id !== pid))
    if (activo === pid) setActivo('')
  }

  function limpiarTodo() {
    if (!confirm('¿Quitar todos los pacientes de la clase? (lo guardado no se borra)')) return
    setSeleccion([]); setActivo('')
  }

  async function elegirSesion(pid: string, sesionId: string) {
    setSeleccion(prev => prev.map(s => s.paciente.id===pid ? {...s, sesionId, finalizado:false} : s))
    if (!sesionId) return
    const item = seleccion.find(s => s.paciente.id===pid)
    const ses = item?.sesiones.find((x:any)=>x.id===sesionId)
    if (!ses) return
    const ejs: any[] = []
    ;(ses.partes||[]).forEach((parte:any)=>{
      ;(parte.ejercicios||[]).forEach((ej:any)=>{
        const n = parseInt(ej.series)||4
        ejs.push({
          ejercicio_id: ej.ejercicio_id||null, nombre: ej.nombre,
          imagen_url: ej.imagen_url||'', variante: ej.variante||'',
          plan:{peso:ej.peso,reps:ej.reps},
          series: Array.from({length:n},()=>({peso:'',reps:''})),
          comentario:'', ultimo:null, guardado:false,
        })
      })
    })
    const ids = ejs.map(e=>e.ejercicio_id).filter(Boolean)
    if (ids.length) {
      const { data: tipos } = await supabase.from('ejercicios').select('id,tipo_medida,items_ejecucion,feedbacks').in('id', ids)
      const tipoMap:Record<string,any>={}
      ;(tipos||[]).forEach((t:any)=>{ tipoMap[t.id]=t })
      ejs.forEach(e=>{
        const t = e.ejercicio_id ? tipoMap[e.ejercicio_id] : null
        e.tipo_medida = t?.tipo_medida || 'peso_reps'
        e.items = t?.items_ejecucion || []
        e.feedbacks = t?.feedbacks || []
        if (!e.items_evaluados) e.items_evaluados = {}
      })
    } else {
      ejs.forEach(e=>{ e.tipo_medida = 'peso_reps'; e.items = []; e.feedbacks = []; if(!e.items_evaluados) e.items_evaluados = {} })
    }
    if (ids.length) {
      // ultimo finalizado (referencia)
      const { data: fin } = await supabase.from('registros_ejercicio')
        .select('ejercicio_id,series,fecha,created_at,comentario')
        .eq('paciente_id', pid).eq('finalizado', true).in('ejercicio_id', ids)
        .order('fecha',{ascending:false}).order('created_at',{ascending:false})
      const ultMap:Record<string,any>={}
      ;(fin||[]).forEach((r:any)=>{ if(!ultMap[r.ejercicio_id]) ultMap[r.ejercicio_id]=r })
      // borrador en curso de esta sesion
      const { data: curso } = await supabase.from('registros_ejercicio')
        .select('ejercicio_id,series,comentario,items_evaluados')
        .eq('paciente_id', pid).eq('sesion_id', sesionId).eq('finalizado', false).in('ejercicio_id', ids)
      const cursoMap:Record<string,any>={}
      ;(curso||[]).forEach((r:any)=>{ cursoMap[r.ejercicio_id]=r })
      ejs.forEach(e=>{
        if (e.ejercicio_id){
          e.ultimo = ultMap[e.ejercicio_id]?.series || null
          e.ultimoComent = ultMap[e.ejercicio_id]?.comentario || ''
          const c = cursoMap[e.ejercicio_id]
          if (c && Array.isArray(c.series)) {
            // fusionar: mantener nº de series de la plantilla, rellenar con lo guardado
            const merged = e.series.map((orig:any, idx:number) => c.series[idx] || orig)
            // si el borrador tenia mas series que la plantilla, añadirlas
            for (let k=e.series.length; k<c.series.length; k++) merged.push(c.series[k])
            e.series = merged; e.comentario = c.comentario||''; e.guardado = true
          }
          if (c && c.items_evaluados && typeof c.items_evaluados==='object') e.items_evaluados = c.items_evaluados
        }
      })
    }
    setSeleccion(prev => prev.map(s => s.paciente.id===pid ? {...s, datos:ejs, cargado:true} : s))
  }

  function programarAutosave(pid:string, ei:number, ejData:any, sesionId:string){
    const key = `${pid}_${ei}`
    if (timers.current[key]) clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(()=>{ autoguardar(pid, ei, ejData, sesionId) }, 700)
  }

  async function autoguardar(pid:string, ei:number, ej:any, sesionId:string){
    const seriesLlenas = ej.series.filter((x:any)=>x.peso!==''||x.reps!==''||(x.segundos!==''&&x.segundos!==undefined))
    const hayComent = (ej.comentario||'').trim()!==''
    const iv = ej.items_evaluados || {}
    const hayItems = Object.values(iv).some((v:any)=>v===true)
    if (seriesLlenas.length===0 && !hayComent && !hayItems) return
    const fila:any = {
      paciente_id: pid, ejercicio_id: ej.ejercicio_id, ejercicio_nombre: ej.nombre,
      sesion_id: sesionId, series: seriesLlenas, comentario: ej.comentario||null, items_evaluados: iv, finalizado:false,
    }
    let error
    if (ej.ejercicio_id){
      const { data: existe } = await supabase.from('registros_ejercicio')
        .select('id').eq('paciente_id',pid).eq('ejercicio_id',ej.ejercicio_id)
        .eq('sesion_id',sesionId).eq('finalizado',false).maybeSingle()
      if (existe){
        ({ error } = await supabase.from('registros_ejercicio')
          .update({ series:seriesLlenas, comentario:ej.comentario||null, ejercicio_nombre:ej.nombre, items_evaluados:iv })
          .eq('id', existe.id))
      } else {
        ({ error } = await supabase.from('registros_ejercicio').insert(fila))
      }
    } else {
      ({ error } = await supabase.from('registros_ejercicio').insert(fila))
    }
    if (error){ console.error('autoguardar clase', error.message); return }
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; if(datos[ei]) datos[ei]={...datos[ei],guardado:true}
      return {...s,datos}
    }))
  }

  function mutarSerie(pid:string, ei:number, si:number, campo:string, val:string){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; const series=[...datos[ei].series]
      series[si]={...series[si],[campo]:val}
      datos[ei]={...datos[ei],series,guardado:false}
      programarAutosave(pid,ei,datos[ei],s.sesionId)
      return {...s,datos}
    }))
  }
  function addSerie(pid:string, ei:number){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; datos[ei]={...datos[ei],series:[...datos[ei].series,{peso:'',reps:''}]}
      return {...s,datos}
    }))
  }
  function quitarSerie(pid:string, ei:number, si:number){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; datos[ei]={...datos[ei],series:datos[ei].series.filter((_:any,i:number)=>i!==si),guardado:false}
      programarAutosave(pid,ei,datos[ei],s.sesionId)
      return {...s,datos}
    }))
  }
  function setComent(pid:string, ei:number, val:string){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; datos[ei]={...datos[ei],comentario:val,guardado:false}
      programarAutosave(pid,ei,datos[ei],s.sesionId)
      return {...s,datos}
    }))
  }

  function toggleItem(pid:string, ei:number, ii:number){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]
      const iv={...(datos[ei].items_evaluados||{})}; iv[ii]=!iv[ii]
      datos[ei]={...datos[ei],items_evaluados:iv,guardado:false}
      programarAutosave(pid,ei,datos[ei],s.sesionId)
      const ej = datos[ei]
      const item = (ej.items||[])[ii]
      const cumplido = iv[ii]===true
      if (item && (item.objetivos||[]).length>0 && ej.ejercicio_id) {
        resolverViaEjecucionClase(pid, item.objetivos, ej.ejercicio_id, cumplido)
      }
      return {...s,datos}
    }))
  }

  async function finalizarPaciente(pid:string){
    const item = seleccion.find(s=>s.paciente.id===pid); if(!item) return
    // forzar guardado de todo lo lleno
    Object.keys(timers.current).forEach(k=>{ if(k.startsWith(pid+'_')){ clearTimeout(timers.current[k]); delete timers.current[k] } })
    for (let i=0;i<item.datos.length;i++){
      const ej=item.datos[i]
      const llenas=ej.series.filter((x:any)=>x.peso!==''||x.reps!==''||(x.segundos!==''&&x.segundos!==undefined))
      const hayComent=(ej.comentario||'').trim()!==''
      if (llenas.length>0 || hayComent) await autoguardar(pid,i,ej,item.sesionId)
    }
    // limpiar finalizados previos del dia y marcar
    const ids = item.datos.map((e:any)=>e.ejercicio_id).filter(Boolean)
    if (ids.length){
      await supabase.from('registros_ejercicio').delete()
        .eq('paciente_id',pid).eq('fecha',fecha).eq('finalizado',true).in('ejercicio_id',ids)
    }
    const { error } = await supabase.from('registros_ejercicio')
      .update({ finalizado:true })
      .eq('paciente_id',pid).eq('sesion_id',item.sesionId).eq('finalizado',false)
    if (error){ alert('Error al finalizar: '+error.message); return }
    setSeleccion(prev => prev.map(s=>s.paciente.id===pid?{...s,finalizado:true}:s))
  }

  const act = seleccion.find(s=>s.paciente.id===activo)
  const progreso = (s:any)=> s.datos.length ? `${s.datos.filter((e:any)=>e.guardado).length}/${s.datos.length}` : ''

  return (
    <>
      {/* CABECERA CLASE */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'9px 13px',flexWrap:'wrap'}}>
        <span style={{fontSize:12,fontWeight:500,color:'var(--n)',display:'inline-flex',alignItems:'center',gap:6}}><Ic name="pacientes" size={14}/> Día de fuerza</span>
        <input type="date" className="input" value={fecha} onChange={e=>setFecha(e.target.value)} style={{maxWidth:150,fontSize:11}}/>
        <div style={{flex:1}}/>
        {seleccion.length>0 && <button className="btn btn-d btn-sm" onClick={limpiarTodo}><Ic name="papelera" size={12}/> Limpiar</button>}
        <div style={{position:'relative',width:260}}>
          <input className="input" value={busquedaPac} onChange={e=>setBusquedaPac(e.target.value)} placeholder="Añadir paciente..." style={{fontSize:11}}/>
          {busquedaPac && (
            <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:20,marginTop:4,border:'1px solid var(--bd)',borderRadius:6,maxHeight:240,overflowY:'auto',background:'var(--w)',boxShadow:'0 4px 16px rgba(0,0,0,.1)'}}>
              {pacFiltrados.slice(0,30).map((p:any)=>(
                <div key={p.id} onClick={()=>addPaciente(p)} style={{padding:'8px 11px',cursor:'pointer',fontSize:11,borderBottom:'1px solid var(--bl)'}} onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                  {p.nombre} {p.apellidos}{p.nombre_clinica?<span style={{color:'var(--grl)',fontSize:9}}> · {p.nombre_clinica}</span>:null}
                </div>
              ))}
              {pacFiltrados.length===0 && <div style={{padding:'8px 11px',fontSize:10,color:'var(--grl)'}}>Sin pacientes que coincidan</div>}
            </div>
          )}
        </div>
      </div>

      {/* CHIPS PACIENTES */}
      {seleccion.length>0 && (
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
          {seleccion.map(s=>(
            <div key={s.paciente.id} onClick={()=>setActivo(s.paciente.id)}
              style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:99,cursor:'pointer',
                border:`1.5px solid ${activo===s.paciente.id?'var(--g)':'var(--bd)'}`,
                background:activo===s.paciente.id?'var(--g)':'var(--w)',
                color:activo===s.paciente.id?'#fff':'var(--gr)'}}>
              {s.finalizado&&<span style={{fontSize:9}}>✓</span>}
              <span style={{fontSize:10}}>{nombrePac(s.paciente)}</span>
              {!s.finalizado&&progreso(s)&&<span style={{fontSize:8,opacity:.8}}>{progreso(s)}</span>}
              <span onClick={(e)=>{e.stopPropagation();quitarPaciente(s.paciente.id)}} style={{fontSize:11,opacity:.7}}>✕</span>
            </div>
          ))}
        </div>
      )}

      {/* CUERPO */}
      {seleccion.length===0 ? (
        <div style={{textAlign:'center',padding:60,color:'var(--grl)',fontSize:11}}>Añade los pacientes que vienen hoy a la clase de fuerza.</div>
      ) : !act ? (
        <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>Selecciona un paciente arriba para anotar su trabajo.</div>
      ) : (
        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:400,color:'var(--n)',flex:1}}>{nombrePac(act.paciente)}{act.finalizado&&<span style={{fontSize:9,color:'var(--g)',marginLeft:8}}>✓ finalizado</span>}</div>
            <select className="input" style={{maxWidth:240,fontSize:11}} value={act.sesionId} onChange={e=>elegirSesion(act.paciente.id, e.target.value)}>
              <option value="">Elegir sesión de fuerza...</option>
              {act.sesiones.map((s:any)=><option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            {act.sesionId && act.datos.length>0 && (
              <button className="btn btn-p btn-sm" onClick={()=>finalizarPaciente(act.paciente.id)}>✓ Guardar y finalizar</button>
            )}
          </div>

          {!act.sesionId ? (
            <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:10}}>Elige la sesión que va a hacer este paciente.</div>
          ) : act.datos.length===0 ? (
            <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:10}}>Esta sesión no tiene ejercicios.</div>
          ) : act.datos.map((ej:any,ei:number)=>(
            <div key={ei} style={{background:'var(--bl)',borderRadius:8,border:`1px solid ${ej.guardado?'var(--g)':'var(--bd)'}`,marginBottom:8,padding:'9px 11px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
                {ej.imagen_url?<img src={ej.imagen_url} alt={ej.nombre} style={{width:30,height:30,objectFit:'cover',borderRadius:4}}/>:<div style={{width:30,height:30,background:'var(--bm)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--grl)'}}><Ic name="fuerza" size={14}/></div>}
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{ej.nombre}{ej.variante&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--gl)',color:'var(--gd)',marginLeft:6}}>{ej.variante}</span>}</div>
                  {!ej.ultimo&&<div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>Sin registro previo{ej.plan?.peso?` · plan ${ej.plan.peso}kg`:''}</div>}
                  {ej.ultimoComent&&<div style={{fontSize:9,color:'var(--g)',marginTop:2,fontStyle:'italic',display:'flex',alignItems:'center',gap:4}}><Ic name="mensaje" size={10}/> última vez: {ej.ultimoComent}</div>}
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
                const prev = ej.ultimo && ej.ultimo[si] ? fmtPrev(ej.ultimo[si]) : null
                return (
                  <div key={si} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                    <span style={{fontSize:10,color:'var(--grl)',width:16,textAlign:'center'}}>{si+1}</span>
                    {tm!=='tiempo' && <>
                      <input inputMode="decimal" value={ser.peso||''} onChange={e=>mutarSerie(act.paciente.id,ei,si,'peso',e.target.value)} placeholder="—" style={{width:56,fontSize:12,padding:'5px 6px',border:'1px solid var(--bd)',borderRadius:5,textAlign:'center'}}/>
                      <span style={{fontSize:9,color:'var(--grl)'}}>kg</span>
                    </>}
                    {tm==='peso_reps' && <>
                      <span style={{fontSize:11,color:'var(--bm)'}}>×</span>
                      <input inputMode="numeric" value={ser.reps||''} onChange={e=>mutarSerie(act.paciente.id,ei,si,'reps',e.target.value)} placeholder="—" style={{width:56,fontSize:12,padding:'5px 6px',border:'1px solid var(--bd)',borderRadius:5,textAlign:'center'}}/>
                      <span style={{fontSize:9,color:'var(--grl)'}}>reps</span>
                    </>}
                    {(tm==='tiempo'||tm==='peso_tiempo') && <>
                      {tm==='peso_tiempo' && <span style={{fontSize:11,color:'var(--bm)'}}>·</span>}
                      <input inputMode="numeric" value={ser.segundos||''} onChange={e=>mutarSerie(act.paciente.id,ei,si,'segundos',e.target.value)} placeholder="—" style={{width:56,fontSize:12,padding:'5px 6px',border:'1px solid var(--bd)',borderRadius:5,textAlign:'center'}}/>
                      <span style={{fontSize:9,color:'var(--grl)'}}>seg</span>
                    </>}
                    <div style={{flex:1}}/>
                    {prev&&<span style={{fontSize:10,color:'var(--g)',whiteSpace:'nowrap'}}>ant: {prev}</span>}
                    {ej.series.length>1&&<button onClick={()=>quitarSerie(act.paciente.id,ei,si)} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 5px'}}>✕</button>}
                  </div>
                )
              })}
              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                <button onClick={()=>addSerie(act.paciente.id,ei)} style={{fontSize:9,color:'var(--g)',background:'none',border:'none',cursor:'pointer'}}>+ serie</button>
                <input value={ej.comentario} onChange={e=>setComent(act.paciente.id,ei,e.target.value)} placeholder="Comentario..." style={{flex:1,fontSize:10,padding:'4px 7px',border:'1px solid var(--bd)',borderRadius:4}}/>
              </div>
              {(ej.items||[]).length>0 && (
                <div style={{marginTop:8,paddingTop:8,borderTop:'1px dashed var(--bm)'}}>
                  <div style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Ejecución</div>
                  {(ej.items||[]).map((it:any,ii:number)=>{
                    const cumple = ej.items_evaluados?.[ii]
                    const objs = (it.objetivos||[]).map((oid:string)=>objetivosLib.find((o:any)=>o.id===oid)).filter(Boolean)
                    const objsPac = objsPorPaciente[act.paciente.id] || []
                    return (
                      <div key={ii} style={{padding:'3px 0'}}>
                        <div onClick={()=>toggleItem(act.paciente.id,ei,ii)} style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer'}}>
                          <span style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${cumple?'var(--g)':'var(--bd)'}`,background:cumple?'var(--g)':'transparent',color:'#fff',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{cumple?'✓':''}</span>
                          <span style={{fontSize:10,color:'var(--n)'}}>{it.texto}</span>
                        </div>
                        {!cumple && objs.length>0 && (
                          <div style={{display:'flex',flexWrap:'wrap',gap:4,marginLeft:23,marginTop:3}}>
                            {objs.map((o:any)=>{
                              const yaActivo = objsPac.some((po:any)=>po.objetivo_id===o.id)
                              return (
                                <span key={o.id} onClick={()=>toggleObjetivo(act.paciente.id,o.id,ej.ejercicio_id,ej.nombre)}
                                  title={yaActivo?'Quitar objetivo del paciente':'Activar este objetivo'}
                                  style={{fontSize:8,padding:'2px 7px',borderRadius:99,cursor:'pointer',border:`1px solid ${o.color||'var(--g)'}`,background:yaActivo?(o.color||'var(--g)'):'var(--w)',color:yaActivo?'#fff':(o.color||'var(--gd)')}}>
                                  {yaActivo?'✓ ':'+ '}{o.nombre}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {(ej.feedbacks||[]).length>0 && (
                <div style={{marginTop:6,display:'flex',flexWrap:'wrap',gap:4}}>
                  {(ej.feedbacks||[]).map((fb:any,fi:number)=>(
                    <span key={fi} style={{fontSize:9,padding:'2px 7px',borderRadius:99,background:'var(--bl)',color:'var(--gr)',display:'inline-flex',alignItems:'center',gap:3}}><Ic name="mensaje" size={9}/> {fb.texto}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
