'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ModalEditarCita from '@/app/agenda/components/ModalEditarCita'

export default function EntrenoTab({ pacienteId, sesiones, onRefresh, onNuevaSesion }: { pacienteId: string, sesiones: any[], onRefresh: () => void, onNuevaSesion: () => void }) {
  const [seccion, setSeccion] = useState<'activo'|'sesiones'|'historial'>('activo')
  const [citasFuturas, setCitasFuturas] = useState<any[]>([])
  const [sesionesDisp, setSesionesDisp] = useState<any[]>([])
  const [sesionesHistorial, setSesionesHistorial] = useState<any[]>([])
  const [seleccionadas, setSeleccionadas] = useState<string[]>([])
  const [sesionAsignar, setSesionAsignar] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [verSesion, setVerSesion] = useState<any>(null)
  const [editandoCita, setEditandoCita] = useState<any>(null)
  const [tiposClase, setTiposClase] = useState<any[]>([])
  const [horas, setHoras] = useState<string[]>([])

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const hoy = new Date().toISOString().split('T')[0]
    const [{ data: c },{ data: s }] = await Promise.all([
      supabase.from('citas').select('*, sesiones:sesion_id(id,nombre,partes)').eq('paciente_id',pacienteId).gte('fecha',hoy).neq('estado','cancelada').order('fecha').order('hora'),
      supabase.from('sesiones').select('id,nombre,descripcion,partes,created_at').eq('paciente_id',pacienteId).order('created_at',{ascending:false}),
    ])
    setCitasFuturas(c||[]); setSesionesDisp(s||[])
    const { data: aj } = await supabase.from('ajustes').select('clave,valor')
    if (aj) { const map:Record<string,string>={}; aj.forEach((a:any)=>{map[a.clave]=a.valor||''}); if(map.tipos_clase){try{setTiposClase(JSON.parse(map.tipos_clase))}catch{}} if(map.horas){try{setHoras(JSON.parse(map.horas))}catch{}} }
    const { data: hist } = await supabase.from('citas').select('*, sesiones:sesion_id(id,nombre,descripcion,partes)').eq('paciente_id',pacienteId).lt('fecha',hoy).order('fecha',{ascending:false}).limit(30)
    setSesionesHistorial(hist||[])
  }

  async function asignarEnBloque() {
    if (!sesionAsignar||seleccionadas.length===0) { alert('Selecciona citas y una sesión'); return }
    setGuardando(true)
    for (const citaId of seleccionadas) await supabase.from('citas').update({sesion_id:sesionAsignar}).eq('id',citaId)
    setSeleccionadas([]); setSesionAsignar(''); setGuardando(false); cargarDatos(); onRefresh()
  }

  async function guardarEdicionCita() {
    if (!editandoCita) return
    setGuardando(true)
    const original = citasFuturas.find((c:any)=>c.id===editandoCita.id)
    await supabase.from('citas').update({fecha:editandoCita.fecha,hora:editandoCita.hora,sala:editandoCita.sala,tipo:editandoCita.tipo,notas:editandoCita.notas}).eq('id',editandoCita.id)
    if (original) {
      const registros:any[]=[]
      if (editandoCita.fecha && original.fecha && editandoCita.fecha!==original.fecha) registros.push({cita_id:editandoCita.id,paciente_id:pacienteId,campo_cambiado:'fecha',valor_anterior:original.fecha,valor_nuevo:editandoCita.fecha})
      const hAnt=(original.hora||'').slice(0,5), hNue=(editandoCita.hora||'').slice(0,5)
      if (hNue && hAnt && hNue!==hAnt) registros.push({cita_id:editandoCita.id,paciente_id:pacienteId,campo_cambiado:'hora',valor_anterior:hAnt,valor_nuevo:hNue})
      if (registros.length>0) await supabase.from('cambios_cita').insert(registros)
    }
    setEditandoCita(null); setGuardando(false); cargarDatos(); onRefresh()
  }

  async function cambiarEstadoCita(cita:any, estado:string) {
    await supabase.from('citas').update({estado}).eq('id',cita.id)
    if (estado==='cancelada') {
      const fechaFalta=new Date(cita.fecha+'T12:00:00')
      const fechaLimite=new Date(fechaFalta); fechaLimite.setDate(fechaLimite.getDate()+30)
      const { data: existing } = await supabase.from('recuperaciones').select('id').eq('cita_falta_id',cita.id).maybeSingle()
      if (!existing) await supabase.from('recuperaciones').insert({paciente_id:cita.paciente_id||pacienteId,cita_falta_id:cita.id,fecha_falta:cita.fecha,fecha_limite:fechaLimite.toISOString().split('T')[0],estado:'pendiente'})
    }
    if (estado==='falta') await supabase.from('recuperaciones').delete().eq('cita_falta_id',cita.id).eq('estado','pendiente')
    if (estado==='realizada'||estado==='programada') await supabase.from('recuperaciones').delete().eq('cita_falta_id',cita.id).eq('estado','pendiente')
    setEditandoCita(null); cargarDatos(); onRefresh()
  }

  async function eliminarCita(cita:any) {
    if (!confirm('⚠️ Al eliminar esta cita NO se guardará ningún dato (ni realizada, ni falta, ni recuperación). Úsalo solo para errores.\n\n¿Eliminar la cita?')) return
    await supabase.from('recuperaciones').delete().eq('cita_falta_id',cita.id)
    await supabase.from('citas').delete().eq('id',cita.id)
    setEditandoCita(null); cargarDatos(); onRefresh()
  }

  function toggleCita(id: string) { setSeleccionadas(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]) }

  async function duplicarSesion(s: any) {
    await supabase.from('sesiones').insert({paciente_id:pacienteId,nombre:s.nombre+' (copia)',descripcion:s.descripcion,partes:s.partes||[],estado:'lista'})
    cargarDatos()
  }

  async function eliminarSesion(id: string) {
    if (!confirm('¿Eliminar esta sesión?')) return
    await supabase.from('sesiones').delete().eq('id',id); cargarDatos()
  }

  return (
    <div>
      <div style={{display:'flex',gap:4,marginBottom:12,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:3}}>
        {([['activo','📋 Plan activo',citasFuturas.length],['sesiones','📋 Sesiones',sesionesDisp.length],['historial','📂 Historial de entrenamiento',sesionesHistorial.length]] as const).map(([k,l,n])=>(
          <button key={k} onClick={()=>setSeccion(k)}
            style={{flex:1,fontSize:10,padding:'6px 8px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'system-ui',background:seccion===k?'var(--w)':'transparent',color:seccion===k?'var(--n)':'var(--grl)',fontWeight:seccion===k?500:300,boxShadow:seccion===k?'0 1px 3px rgba(0,0,0,.08)':'none',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
            {l} <span style={{fontSize:9,padding:'1px 6px',borderRadius:99,background:seccion===k?'var(--g)':'var(--bm)',color:seccion===k?'#fff':'var(--grl)'}}>{n}</span>
          </button>
        ))}
      </div>

      {seccion==='activo'&&(
        <div>
          {(()=>{
            const total=citasFuturas.length; const conSes=citasFuturas.filter(c=>c.sesiones).length; const pct=total>0?Math.round((conSes/total)*100):0
            return total>0?(<div style={{marginBottom:10,padding:'8px 12px',background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}><span style={{fontSize:10,color:'var(--n)'}}>Sesiones asignadas</span><span style={{fontSize:10,fontWeight:500,color:'var(--g)'}}>{conSes}/{total} · {pct}%</span></div>
              <div style={{height:6,background:'var(--bm)',borderRadius:99,overflow:'hidden'}}><div style={{height:'100%',background:'var(--g)',borderRadius:99,width:pct+'%',transition:'width .3s'}}/></div>
            </div>):null
          })()}
          {seleccionadas.length>0&&(
            <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:'var(--rl)',padding:'10px 13px',marginBottom:10,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <span style={{fontSize:11,color:'var(--n)'}}>{seleccionadas.length} citas seleccionadas</span>
              <select className="input" style={{flex:1,minWidth:200}} value={sesionAsignar} onChange={e=>setSesionAsignar(e.target.value)}>
                <option value="">Seleccionar sesión...</option>
                {sesionesDisp.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <button className="btn btn-p btn-sm" onClick={asignarEnBloque} disabled={guardando}>{guardando?'⏳':'✓ Asignar'}</button>
              <button className="btn btn-d btn-sm" onClick={()=>setSeleccionadas([])}>✕</button>
            </div>
          )}
          <div style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden'}}>
            {citasFuturas.length===0&&<div style={{padding:20,textAlign:'center',fontSize:11,color:'var(--grl)'}}>Sin citas futuras programadas</div>}
            {citasFuturas.map((c,i)=>{
              const sel=seleccionadas.includes(c.id); const tieneSesion=!!c.sesiones
              const fecha=new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})
              return (
                <div key={c.id} onClick={()=>toggleCita(c.id)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:i<citasFuturas.length-1?'1px solid var(--bl)':'none',cursor:'pointer',background:sel?'var(--gl)':'var(--w)'}}
                  onMouseOver={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='rgba(90,150,158,.04)'}}
                  onMouseOut={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='var(--w)'}}>
                  <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${sel?'var(--g)':'var(--bd)'}`,background:sel?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {sel&&<span style={{fontSize:10,color:'#fff',fontWeight:700}}>✓</span>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{fecha} · {c.hora?.slice(0,5)} · Sala {c.sala}</div>
                    {tieneSesion?(
                      <div style={{display:'flex',alignItems:'center',gap:5,marginTop:1}}>
                        <span style={{fontSize:9,color:'var(--g)'}}>📋 {c.sesiones.nombre}</span>
                        <button onClick={e=>{e.stopPropagation();supabase.from('citas').update({sesion_id:null}).eq('id',c.id).then(()=>cargarDatos())}} style={{fontSize:8,color:'var(--grl)',background:'none',border:'none',cursor:'pointer',padding:'0 3px'}}>✕</button>
                      </div>
                    ):<div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>Sin sesión asignada</div>}
                  </div>
                  <button onClick={e=>{e.stopPropagation();setEditandoCita({...c,paciente_id:pacienteId})}} style={{fontSize:11,background:'none',border:'1px solid var(--bd)',borderRadius:5,padding:'3px 7px',cursor:'pointer',color:'var(--gr)',flexShrink:0}}>✎</button>
                  <div style={{width:8,height:8,borderRadius:'50%',background:tieneSesion?'var(--g)':'var(--bm)',flexShrink:0}}/>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {seccion==='sesiones'&&(
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <button className="btn btn-p btn-sm" onClick={onNuevaSesion}>+ Nueva sesión</button>
          </div>
          {sesionesDisp.length===0?<div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>No hay sesiones creadas.</div>:sesionesDisp.map(s=>{
            const citasAsignadas=citasFuturas.filter(c=>c.sesion_id===s.id); const asignada=citasAsignadas.length>0
            return (
              <div key={s.id} className="card">
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{s.nombre}</div>
                    {s.descripcion&&<div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>{s.descripcion}</div>}
                  </div>
                  <span style={{fontSize:8,padding:'2px 8px',borderRadius:99,background:asignada?'var(--gl)':'var(--ambl)',color:asignada?'var(--gd)':'#7A5800',fontWeight:500,whiteSpace:'nowrap'}}>
                    {asignada?`✓ ${citasAsignadas.length} cita${citasAsignadas.length>1?'s':''} asignada${citasAsignadas.length>1?'s':''}`:' Sin asignar'}
                  </span>
                </div>
                {(s.partes||[]).slice(0,2).map((p:any,pi:number)=>(
                  <div key={pi} style={{fontSize:9,color:'var(--grl)',marginBottom:2}}>
                    <span style={{fontWeight:500,color:'var(--gr)'}}>{p.nombre}:</span> {(p.ejercicios||[]).slice(0,2).join(' · ')}{(p.ejercicios||[]).length>2?` +${(p.ejercicios||[]).length-2} más`:''}
                  </div>
                ))}
                <div style={{display:'flex',gap:5,marginTop:8}}>
                  <button className="btn btn-s btn-sm" onClick={()=>window.location.href=`/entrenamiento?nueva_sesion=1&paciente_id=${pacienteId}`}>✏️ Editar</button>
                  <button className="btn btn-t btn-sm" onClick={()=>duplicarSesion(s)}>⧉ Duplicar</button>
                  <button className="btn btn-d btn-sm" onClick={()=>eliminarSesion(s.id)}>🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {seccion==='historial'&&(
        <div>
          {sesionesHistorial.length===0?<div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>Sin historial aún</div>:sesionesHistorial.map((c:any,i:number)=>{
            const badgeColor=c.estado==='realizada'?{bg:'var(--gl)',color:'var(--gd)',txt:'✓ Realizada'}:c.estado==='cancelada'?{bg:'var(--bm)',color:'var(--gr)',txt:'Cancelada'}:{bg:'var(--redl)',color:'var(--red)',txt:'Falta'}
            const tieneSes=!!c.sesiones
            return (
              <div key={c.id} className="card" onClick={()=>tieneSes&&setVerSesion(c.sesiones)} style={{cursor:tieneSes?'pointer':'default'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1}}>
                    {c.sesiones?.nombre?<div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:2}}>📋 {c.sesiones.nombre} <span style={{fontSize:9,color:'var(--g)'}}>· ver sesión</span></div>:<div style={{fontSize:11,fontWeight:300,color:'var(--grl)',marginBottom:2}}>Sin sesión</div>}
                    <div style={{fontSize:9,color:'var(--grl)'}}>{new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short',year:'numeric'})} · {c.hora?.slice(0,5)} · Sala {c.sala}</div>
                  </div>
                  <span style={{fontSize:8,padding:'2px 8px',borderRadius:99,background:badgeColor.bg,color:badgeColor.color,fontWeight:500}}>{badgeColor.txt}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {verSesion&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setVerSesion(null)}}>
          <div className="modal" style={{maxHeight:'85vh',overflowY:'auto'}}>
            <div className="modal-title">📋 {verSesion.nombre}<button className="modal-close" onClick={()=>setVerSesion(null)}>✕</button></div>
            {verSesion.descripcion&&<div style={{fontSize:10,color:'var(--grl)',fontWeight:300,marginBottom:10,lineHeight:1.5}}>{verSesion.descripcion}</div>}
            {(verSesion.partes||[]).length===0&&<div style={{fontSize:10,color:'var(--grl)'}}>Esta sesión no tiene ejercicios registrados.</div>}
            {(verSesion.partes||[]).map((parte:any,pi:number)=>(
              <div key={pi} style={{marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:600,color:'var(--gd)',textTransform:'uppercase',letterSpacing:.4,marginBottom:5,paddingBottom:3,borderBottom:'1px solid var(--bl)'}}>{parte.nombre||`Parte ${pi+1}`}</div>
                {(parte.ejercicios||[]).length===0?<div style={{fontSize:10,color:'var(--grl)'}}>Sin ejercicios</div>:(parte.ejercicios||[]).map((ej:any,ei:number)=>(
                  <div key={ei} style={{fontSize:10,color:'var(--n)',padding:'3px 0',display:'flex',gap:6}}>
                    <span style={{color:'var(--grl)'}}>{ei+1}.</span>
                    <span>{typeof ej==='string'?ej:(ej.nombre||ej.ejercicio||JSON.stringify(ej))}</span>
                  </div>
                ))}
              </div>
            ))}
            <div style={{display:'flex',marginTop:8}}><div style={{flex:1}}/><button className="btn btn-d btn-sm" onClick={()=>setVerSesion(null)}>Cerrar</button></div>
          </div>
        </div>
      )}
    {editandoCita&&<ModalEditarCita editandoCita={editandoCita} setEditandoCita={setEditandoCita} guardando={guardando} guardarEdicionCita={guardarEdicionCita} onCerrar={()=>setEditandoCita(null)} horas={horas} tiposClase={tiposClase} cambiarEstadoCita={cambiarEstadoCita} eliminarCita={eliminarCita}/>}
    </div>
  )
}
