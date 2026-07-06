'use client'
import { useState } from 'react'

export default function VistaDia({ fecha, hoy, fechaDisplay, citas, totalPersonas, clases, abrirPanel, setNuevaCita, setModal, horas, pausaInicio, pausaFin, descanso, maxPersonas, tiposCita=[], tiposClase=[], setEditandoCita, abrirDatosCita, abrirEntrenoCita, setVerAlertasCita, alertasPaciente=[], tareas=[], completarTarea, setModalTareas }: {
  fecha: string
  hoy: string
  fechaDisplay: string
  citas: any[]
  totalPersonas: number
  clases: number
  abrirPanel: (c: any) => void
  setEditandoCita?: (c: any) => void
  abrirDatosCita?: (c: any) => void
  abrirEntrenoCita?: (c: any) => void
  setVerAlertasCita?: (c: any) => void
  alertasPaciente?: any[]
  tareas?: any[]
  completarTarea?: (id:string,v:boolean)=>void
  setModalTareas?: (v:boolean)=>void
  setEditandoCita?: (c: any) => void
  setNuevaCita: (fn: (p: any) => any) => void
  setModal: (v: boolean) => void
  horas?: string[]
  pausaInicio?: string
  pausaFin?: string
  descanso?: number
  maxPersonas?: number
}) {
  const DESCANSO = descanso || 10
  const MAX = maxPersonas || 6
  const HORAS = horas && horas.length > 0 ? horas : ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']
  const PAUSA_INICIO = pausaInicio || '12:30'
  const PAUSA_FIN = pausaFin || '15:30'
  const [alertasExpand, setAlertasExpand] = useState(false)

  function getCitasSlot(h: string, sala: string) {
    return citas.filter(c=>c.hora.startsWith(h)&&c.sala===sala&&c.fecha===fecha)
  }

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 190px',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',background:'var(--w)',height:'calc(100vh - 150px)'}}>
      <div style={{overflowY:'auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'48px 1fr 1fr',background:'var(--bl)',borderBottom:'1px solid var(--bd)',position:'sticky',top:0,zIndex:2}}>
          <div/>
          {['Sala A','Sala B'].map(s=><div key={s} style={{fontSize:9,fontWeight:600,color:'var(--g)',padding:'7px 10px',textAlign:'center',letterSpacing:.5,borderLeft:'1px solid var(--bd)'}}>{s}</div>)}
        </div>
        {HORAS.map(h=>(
          <div key={h}>
            {h===PAUSA_FIN&&<div style={{padding:'4px 10px',background:'var(--bm)',borderBottom:'1px solid var(--bd)',fontSize:8,color:'var(--gr)'}}>— Pausa · {PAUSA_INICIO}–{PAUSA_FIN}</div>}
            <div style={{display:'grid',gridTemplateColumns:'48px 1fr 1fr',borderBottom:'1px solid var(--bl)'}}>
              <div style={{fontSize:9,color:'var(--grl)',padding:'6px 3px',borderRight:'1px solid var(--bl)',display:'flex',alignItems:'flex-start',justifyContent:'flex-end',fontWeight:300}}>{h}</div>
              {(['A','B'] as const).map(sala=>{
                const scAll=getCitasSlot(h,sala)
                const sc=scAll.filter((c:any)=>c.estado!=='cancelada').sort((a:any,b:any)=>(a.estado==='falta'?1:0)-(b.estado==='falta'?1:0))
                const scCanceladas=scAll.filter((c:any)=>c.estado==='cancelada')
                const tipo=sc[0]?.tipo
                const renderCancelada=(c:any)=>(
                  <div key={c.id} onClick={()=>setEditandoCita&&setEditandoCita({...c})}
                    style={{display:'flex',alignItems:'center',gap:3,padding:'2px 4px',borderRadius:3,cursor:'pointer',marginBottom:1,minHeight:22,opacity:.5}} title="Cita cancelada · pulsa para editar/deshacer">
                    <span style={{fontSize:10,color:'var(--grl)',flex:1,fontWeight:300,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',textAlign:'center',textDecoration:'line-through'}}>{c.pacientes?.nombre} {c.pacientes?.apellidos}</span>
                    <span style={{fontSize:7,color:'var(--grl)',flexShrink:0}}>cancelada</span>
                  </div>
                )
                return (
                  <div key={sala} style={{borderLeft:'1px solid var(--bl)',padding:3,minHeight:52}}>
                    {sc.length===0?(
                      <>
                      <div onClick={()=>{setNuevaCita((p:any)=>({...p,fecha,hora:h,sala}));setModal(true)}}
                        style={{border:'1.5px dashed var(--bm)',borderRadius:4,minHeight:44,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'var(--grl)',cursor:'pointer',transition:'all .12s'}}
                        onMouseOver={e=>{const el=e.currentTarget;el.style.borderColor='var(--g)';el.style.color='var(--g)';el.style.background='var(--gl)'}}
                        onMouseOut={e=>{const el=e.currentTarget;el.style.borderColor='var(--bm)';el.style.color='var(--grl)';el.style.background=''}}>
                        + libre
                      </div>
                      {scCanceladas.map(renderCancelada)}
                      </>
                    ):(
                      <div style={{borderRadius:4,padding:'3px 5px'}}>
                        <div style={{fontSize:7,color:'var(--gr)',marginBottom:3,display:'flex',justifyContent:'flex-end'}}>
                          <span>{sc.length}/{MAX}</span>
                        </div>
                        {sc.map(c=>(
                          <div key={c.id} onClick={()=>setVerAlertasCita&&setVerAlertasCita(c)}
                            style={{display:'flex',alignItems:'center',gap:3,padding:'4px 6px',borderRadius:4,cursor:'pointer',marginBottom:2,minHeight:28,background:c.estado==='falta'?'var(--redl)':(tiposClase.find((t:any)=>t.valor===c.tipo)?.color||'#5A969E')+'33',border:c.estado==='falta'?'1px solid #F5C8C8':'none'}}
                            onMouseOver={e=>(e.currentTarget as HTMLElement).style.opacity='0.8'}
                            onMouseOut={e=>(e.currentTarget as HTMLElement).style.opacity='1'}>
                            {alertasPaciente.some((a:any)=>a.paciente_id===c.paciente_id)&&<span style={{fontSize:10,flexShrink:0}} title="Tiene alertas activas">⚠️</span>}
                            <span style={{fontSize:11,color:c.estado==='falta'?'var(--red)':'var(--n)',flex:1,fontWeight:400,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',textAlign:'center'}}>{c.estado==='falta'&&<span style={{fontWeight:600,marginRight:3}}>✗</span>}{c.pacientes?.nombre} {c.pacientes?.apellidos}</span>
                            <span onClick={e=>{e.stopPropagation();abrirEntrenoCita&&abrirEntrenoCita(c)}} style={{fontSize:10,color:'var(--grl)',cursor:'pointer',flexShrink:0,padding:'0 2px'}} title="Entrenamiento" onMouseOver={e=>(e.currentTarget as HTMLElement).style.color='var(--g)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.color='var(--grl)'}>🏋</span>
                            <span onClick={e=>{e.stopPropagation();abrirDatosCita&&abrirDatosCita(c)}} style={{fontSize:10,color:'var(--grl)',cursor:'pointer',flexShrink:0,padding:'0 2px'}} title="Ver datos" onMouseOver={e=>(e.currentTarget as HTMLElement).style.color='var(--g)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.color='var(--grl)'}>👤</span>
                            <span onClick={e=>{e.stopPropagation();setEditandoCita&&setEditandoCita({...c})}} style={{fontSize:10,color:'var(--grl)',cursor:'pointer',flexShrink:0,padding:'0 2px'}} title="Editar cita" onMouseOver={e=>(e.currentTarget as HTMLElement).style.color='var(--g)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.color='var(--grl)'}>✎</span>
                          </div>
                        ))}
                        {sc.length<MAX&&(
                          <div onClick={e=>{e.stopPropagation();setNuevaCita((p:any)=>({...p,fecha,hora:h,sala}));setModal(true)}}
                            style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'3px',marginTop:3,borderRadius:4,border:'1px dashed var(--bm)',color:'var(--grl)',fontSize:11,cursor:'pointer'}}
                            onMouseOver={e=>{const el=e.currentTarget;el.style.borderColor='var(--g)';el.style.color='var(--g)'}}
                            onMouseOut={e=>{const el=e.currentTarget;el.style.borderColor='var(--bm)';el.style.color='var(--grl)'}}>+ añadir</div>
                        )}
                        {scCanceladas.map(renderCancelada)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'48px 1fr 1fr',background:'var(--bl)'}}>
              <div style={{borderRight:'1px solid var(--bm)'}}/>
              <div style={{gridColumn:'2/-1',padding:'1px 6px',borderLeft:'1px solid var(--bm)',fontSize:7,color:'var(--grl)'}}>{DESCANSO} min cambio</div>
            </div>
          </div>
        ))}
      </div>

      {/* PANEL DERECHO */}
      <div style={{borderLeft:'1px solid var(--bd)',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'9px 11px',borderBottom:'1px solid var(--bd)',background:'var(--bl)'}}>
          <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>Resumen del día</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,padding:'8px 9px',borderBottom:'1px solid var(--bd)'}}>
          {[['Personas',totalPersonas],['Clases',clases]].map(([l,v])=>(
            <div key={String(l)} style={{background:'var(--bl)',borderRadius:4,padding:'5px 6px'}}>
              <div style={{fontSize:16,fontWeight:300,color:'var(--n)'}}>{v}</div>
              <div style={{fontSize:8,color:'var(--grl)'}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'7px 9px'}}>
          {(()=>{
            const pacsHoy = new Set(citas.filter((c:any)=>c.fecha===fecha).map((c:any)=>c.paciente_id))
            const alertasHoy = (alertasPaciente||[]).filter((a:any)=>pacsHoy.has(a.paciente_id))
            if (alertasHoy.length===0) return null
            const nombrePac=(pid:string)=>{const c=citas.find((x:any)=>x.paciente_id===pid);return c?.pacientes?`${c.pacientes.nombre} ${c.pacientes.apellidos||''}`:''}
            return (
              <>
                <div style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:5}}>⚠️ Alertas de hoy</div>
                {(alertasExpand?alertasHoy:alertasHoy.slice(0,5)).map((a:any)=>(
                  <div key={a.id} style={{borderRadius:5,padding:'5px 8px',borderLeft:`2px solid ${a.afecta_sesion?'var(--red)':'var(--g)'}`,background:a.afecta_sesion?'var(--redl)':'var(--gl)',marginBottom:4}}>
                    <div style={{fontSize:8,color:a.afecta_sesion?'var(--red)':'var(--gd)',marginBottom:1,fontWeight:500}}>{nombrePac(a.paciente_id)}{a.afecta_sesion&&' · afecta sesión'}</div>
                    <div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.4}}>{a.descripcion}</div>
                  </div>
                ))}
                {alertasHoy.length>5&&(
                  <div onClick={()=>setAlertasExpand(!alertasExpand)} style={{fontSize:9,color:'var(--g)',cursor:'pointer',fontWeight:500,textAlign:'center',padding:'4px',marginBottom:2}}>
                    {alertasExpand?'ver menos':`+${alertasHoy.length-5} alertas más`}
                  </div>
                )}
              </>
            )
          })()}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5,marginTop:8}}>
            <div style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase'}}>Tareas pendientes</div>
            <span onClick={()=>setModalTareas&&setModalTareas(true)} style={{fontSize:8,color:'var(--g)',cursor:'pointer',fontWeight:500}}>ver todas</span>
          </div>
          {(tareas||[]).filter((t:any)=>!t.completada).length===0&&<div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>Sin tareas pendientes</div>}
          {(tareas||[]).filter((t:any)=>!t.completada).slice(0,5).map((t:any)=>{
            const hoyStr=new Date().toISOString().split('T')[0]
            const venc=t.fecha_limite&&t.fecha_limite<hoyStr
            const esHoy=t.fecha_limite===hoyStr
            const bd=venc?'var(--red)':esHoy?'var(--amb)':'var(--bm)'
            const bg=venc?'var(--redl)':esHoy?'var(--ambl)':'var(--bl)'
            return (
              <div key={t.id} style={{display:'flex',alignItems:'flex-start',gap:6,borderRadius:5,padding:'6px 8px',borderLeft:`2px solid ${bd}`,background:bg,marginBottom:4}}>
                <div onClick={()=>completarTarea&&completarTarea(t.id,true)} style={{width:14,height:14,borderRadius:3,border:'2px solid var(--bm)',background:'transparent',cursor:'pointer',flexShrink:0,marginTop:1}} title="Marcar hecha"/>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.3}}>{t.titulo}</div>
                  {t.fecha_limite&&<div style={{fontSize:8,color:venc?'var(--red)':esHoy?'#7A5800':'var(--grl)',marginTop:1,fontWeight:venc||esHoy?600:400}}>📅 {t.fecha_limite}{venc?' · vencida':esHoy?' · hoy':''}</div>}
                </div>
              </div>
            )
          })}
          {(tareas||[]).filter((t:any)=>!t.completada).length>5&&(
            <div onClick={()=>setModalTareas&&setModalTareas(true)} style={{fontSize:9,color:'var(--g)',cursor:'pointer',fontWeight:500,textAlign:'center',padding:'4px',marginTop:2}}>
              +{(tareas||[]).filter((t:any)=>!t.completada).length-5} tareas más
            </div>
          )}
        </div>
        <div style={{padding:'7px 9px',borderTop:'1px solid var(--bd)',fontSize:9,color:'var(--g)',cursor:'pointer',fontWeight:500,display:'flex',alignItems:'center',gap:5}} onClick={()=>setModalTareas&&setModalTareas(true)}>
          <span>✓</span> + Nueva tarea
        </div>
      </div>
    </div>
  )
}
