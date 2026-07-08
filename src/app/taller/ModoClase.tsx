'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const hoy = () => new Date().toISOString().slice(0,10)

export default function ModoClase({ pacientes }: { pacientes: any[] }) {
  const [fecha, setFecha] = useState(hoy())
  const [seleccion, setSeleccion] = useState<any[]>([]) // [{paciente, sesionId, sesiones:[], datos:[], cargado}]
  const [activo, setActivo] = useState<string>('') // paciente_id activo
  const [addOpen, setAddOpen] = useState(false)
  const [buscarPac, setBuscarPac] = useState('')

  const pacFiltrados = pacientes.filter(p => {
    if (seleccion.some(s => s.paciente.id === p.id)) return false
    const nom = ((p.nombre_clinica||p.nombre)+' '+(p.apellidos||'')).toLowerCase()
    return !buscarPac || nom.includes(buscarPac.toLowerCase())
  })

  const nombrePac = (p:any) => (p.nombre_clinica||p.nombre)+' '+(p.apellidos||'')

  async function addPaciente(p: any) {
    const { data: ses } = await supabase.from('sesiones')
      .select('*').eq('paciente_id', p.id).order('created_at',{ascending:false})
    setSeleccion(prev => [...prev, { paciente:p, sesionId:'', sesiones:ses||[], datos:[], cargado:false }])
    setActivo(p.id)
    setAddOpen(false); setBuscarPac('')
  }

  function quitarPaciente(pid: string) {
    setSeleccion(prev => prev.filter(s => s.paciente.id !== pid))
    if (activo === pid) setActivo('')
  }

  // cargar ejercicios de la sesion elegida + ultimos registros
  async function elegirSesion(pid: string, sesionId: string) {
    setSeleccion(prev => prev.map(s => s.paciente.id===pid ? {...s, sesionId} : s))
    if (!sesionId) return
    const item = seleccion.find(s => s.paciente.id===pid)
    const ses = item?.sesiones.find((x:any)=>x.id===sesionId)
    if (!ses) return
    const ejs: any[] = []
    ;(ses.partes||[]).forEach((parte:any)=>{
      ;(parte.ejercicios||[]).forEach((ej:any)=>{
        const n = parseInt(ej.series)||3
        ejs.push({
          ejercicio_id: ej.ejercicio_id||null, nombre: ej.nombre,
          imagen_url: ej.imagen_url||'', variante: ej.variante||'',
          plan:{peso:ej.peso,reps:ej.reps},
          series: Array.from({length:n},()=>({peso:'',reps:''})),
          comentario:'', ultimo:null, guardado:false,
        })
      })
    })
    // cargar ultimos + lo ya registrado hoy (por si vuelve)
    const ids = ejs.map(e=>e.ejercicio_id).filter(Boolean)
    if (ids.length) {
      const { data: prev } = await supabase.from('registros_ejercicio')
        .select('ejercicio_id,series,fecha,comentario')
        .eq('paciente_id', pid).in('ejercicio_id', ids)
        .order('fecha',{ascending:false})
      const ultMap:Record<string,any>={}, hoyMap:Record<string,any>={}
      ;(prev||[]).forEach((r:any)=>{
        if (r.fecha===fecha) { if(!hoyMap[r.ejercicio_id]) hoyMap[r.ejercicio_id]=r }
        else if (!ultMap[r.ejercicio_id]) ultMap[r.ejercicio_id]=r
      })
      ejs.forEach(e=>{
        if (e.ejercicio_id){
          e.ultimo = ultMap[e.ejercicio_id]?.series || null
          const ya = hoyMap[e.ejercicio_id]
          if (ya && Array.isArray(ya.series)) { e.series = ya.series; e.comentario = ya.comentario||''; e.guardado = true }
        }
      })
    }
    setSeleccion(prev => prev.map(s => s.paciente.id===pid ? {...s, datos:ejs, cargado:true} : s))
  }

  function setSerie(pid:string, ei:number, si:number, campo:string, val:string){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; const series=[...datos[ei].series]
      series[si]={...series[si],[campo]:val}
      datos[ei]={...datos[ei],series,guardado:false}
      return {...s,datos}
    }))
  }
  function addSerie(pid:string, ei:number){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; datos[ei]={...datos[ei],series:[...datos[ei].series,{peso:'',reps:''}],guardado:false}
      return {...s,datos}
    }))
  }
  function quitarSerie(pid:string, ei:number, si:number){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; datos[ei]={...datos[ei],series:datos[ei].series.filter((_:any,i:number)=>i!==si),guardado:false}
      return {...s,datos}
    }))
  }
  function setComent(pid:string, ei:number, val:string){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; datos[ei]={...datos[ei],comentario:val,guardado:false}
      return {...s,datos}
    }))
  }

  // guardado incremental por ejercicio (upsert paciente+ejercicio+fecha)
  async function guardarEj(pid:string, ei:number){
    const item = seleccion.find(s=>s.paciente.id===pid); if(!item) return
    const ej = item.datos[ei]
    const seriesLlenas = ej.series.filter((x:any)=>x.peso!==''||x.reps!=='')
    if (seriesLlenas.length===0){ alert('Sin series que guardar'); return }
    const fila:any = {
      paciente_id: pid, ejercicio_id: ej.ejercicio_id, ejercicio_nombre: ej.nombre,
      fecha, series: seriesLlenas, comentario: ej.comentario||null,
    }
    let error
    if (ej.ejercicio_id) {
      // buscar si ya existe registro para paciente+ejercicio+fecha
      const { data: existe } = await supabase.from('registros_ejercicio')
        .select('id')
        .eq('paciente_id', pid).eq('ejercicio_id', ej.ejercicio_id).eq('fecha', fecha)
        .maybeSingle()
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
    if (error){ alert('Error: '+error.message); return }
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; datos[ei]={...datos[ei],guardado:true}
      return {...s,datos}
    }))
  }

  const act = seleccion.find(s=>s.paciente.id===activo)
  const progreso = (s:any)=> s.datos.length ? `${s.datos.filter((e:any)=>e.guardado).length}/${s.datos.length}` : ''

  return (
    <>
      {/* CABECERA CLASE */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'9px 13px',flexWrap:'wrap'}}>
        <span style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>👥 Día de fuerza</span>
        <input type="date" className="input" value={fecha} onChange={e=>setFecha(e.target.value)} style={{maxWidth:150,fontSize:11}}/>
        <div style={{flex:1}}/>
        <button className="btn btn-p btn-sm" onClick={()=>setAddOpen(true)}>+ Añadir paciente</button>
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
              <span style={{fontSize:10}}>{nombrePac(s.paciente)}</span>
              {progreso(s)&&<span style={{fontSize:8,opacity:.8}}>{progreso(s)}</span>}
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
            <div style={{fontSize:13,fontWeight:400,color:'var(--n)',flex:1}}>{nombrePac(act.paciente)}</div>
            <select className="input" style={{maxWidth:260,fontSize:11}} value={act.sesionId} onChange={e=>elegirSesion(act.paciente.id, e.target.value)}>
              <option value="">Elegir sesión de fuerza...</option>
              {act.sesiones.map((s:any)=><option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          {!act.sesionId ? (
            <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:10}}>Elige la sesión que va a hacer este paciente.</div>
          ) : act.datos.length===0 ? (
            <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:10}}>Esta sesión no tiene ejercicios.</div>
          ) : act.datos.map((ej:any,ei:number)=>(
            <div key={ei} style={{background:'var(--bl)',borderRadius:8,border:`1px solid ${ej.guardado?'var(--g)':'var(--bd)'}`,marginBottom:8,padding:'9px 11px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
                {ej.imagen_url?<img src={ej.imagen_url} alt={ej.nombre} style={{width:30,height:30,objectFit:'cover',borderRadius:4}}/>:<div style={{width:30,height:30,background:'var(--bm)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>💪</div>}
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{ej.nombre}{ej.variante&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--gl)',color:'var(--gd)',marginLeft:6}}>{ej.variante}</span>}</div>
                  {ej.ultimo
                    ? <div style={{fontSize:9,color:'var(--g)',marginTop:2}}>Última vez: {ej.ultimo.map((x:any)=>`${x.peso||'—'}${x.reps?'×'+x.reps:''}`).join(', ')}</div>
                    : <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>Sin registro previo{ej.plan?.peso?` · plan ${ej.plan.peso}kg`:''}</div>}
                </div>
                {ej.guardado&&<span style={{fontSize:9,color:'var(--g)'}}>✓ guardado</span>}
              </div>
              {ej.series.map((ser:any,si:number)=>(
                <div key={si} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                  <span style={{fontSize:9,color:'var(--grl)',width:18}}>{si+1}</span>
                  <input type="number" value={ser.peso} onChange={e=>setSerie(act.paciente.id,ei,si,'peso',e.target.value)} placeholder="kg" style={{width:60,fontSize:11,padding:'4px 6px',border:'1px solid var(--bd)',borderRadius:4,textAlign:'center'}}/>
                  <span style={{fontSize:10,color:'var(--grl)'}}>×</span>
                  <input type="number" value={ser.reps} onChange={e=>setSerie(act.paciente.id,ei,si,'reps',e.target.value)} placeholder="reps" style={{width:60,fontSize:11,padding:'4px 6px',border:'1px solid var(--bd)',borderRadius:4,textAlign:'center'}}/>
                  {ej.series.length>1&&<button onClick={()=>quitarSerie(act.paciente.id,ei,si)} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 5px'}}>✕</button>}
                </div>
              ))}
              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:5}}>
                <button onClick={()=>addSerie(act.paciente.id,ei)} style={{fontSize:9,color:'var(--g)',background:'none',border:'none',cursor:'pointer'}}>+ serie</button>
                <input value={ej.comentario} onChange={e=>setComent(act.paciente.id,ei,e.target.value)} placeholder="📝 comentario..." style={{flex:1,fontSize:10,padding:'3px 7px',border:'1px solid var(--bd)',borderRadius:4}}/>
                <button className="btn btn-p btn-sm" onClick={()=>guardarEj(act.paciente.id,ei)}>{ej.guardado?'✓':'💾'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL AÑADIR PACIENTE */}
      {addOpen && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setAddOpen(false)}}>
          <div className="modal" style={{width:360}}>
            <div className="modal-title">Añadir paciente<button className="modal-close" onClick={()=>setAddOpen(false)}>✕</button></div>
            <input className="input" placeholder="🔍 Buscar..." value={buscarPac} onChange={e=>setBuscarPac(e.target.value)} style={{marginBottom:8,fontSize:11}} autoFocus/>
            <div style={{maxHeight:300,overflowY:'auto'}}>
              {pacFiltrados.map(p=>(
                <div key={p.id} onClick={()=>addPaciente(p)}
                  style={{padding:'7px 9px',background:'var(--bl)',borderRadius:6,border:'1px solid var(--bd)',marginBottom:4,cursor:'pointer',fontSize:11,color:'var(--n)'}}>
                  {nombrePac(p)}
                </div>
              ))}
              {pacFiltrados.length===0 && <div style={{textAlign:'center',padding:20,color:'var(--grl)',fontSize:10}}>Sin resultados</div>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
