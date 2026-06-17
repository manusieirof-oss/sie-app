'use client'

export default function VistaDia({ fecha, hoy, fechaDisplay, citas, notasDia, totalPersonas, clases, abrirPanel, setNuevaCita, setModal, toggleNotaResuelta, eliminarNota, setModalNota, proximasAlertas, horas, pausaInicio, pausaFin, descanso, maxPersonas, tiposCita=[], tiposClase=[], setEditandoCita, abrirDatosCita, abrirEntrenoCita }: {
  fecha: string
  hoy: string
  fechaDisplay: string
  citas: any[]
  notasDia: any[]
  totalPersonas: number
  clases: number
  abrirPanel: (c: any) => void
  setEditandoCita?: (c: any) => void
  abrirDatosCita?: (c: any) => void
  abrirEntrenoCita?: (c: any) => void
  setEditandoCita?: (c: any) => void
  setNuevaCita: (fn: (p: any) => any) => void
  setModal: (v: boolean) => void
  toggleNotaResuelta: (id: string, resuelta: boolean) => void
  eliminarNota: (id: string) => void
  setModalNota: (v: boolean) => void
  proximasAlertas?: any[]
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
                const sc=scAll.filter((c:any)=>c.estado!=='cancelada')
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
                      <div style={{borderRadius:4,padding:'3px 5px',background:(tiposClase.find((t:any)=>t.valor===tipo)?.color||'#5A969E')+'33',borderLeft:`4px solid ${tiposClase.find((t:any)=>t.valor===tipo)?.color||'#5A969E'}`}}>
                        <div style={{fontSize:7,color:'var(--gr)',marginBottom:3,display:'flex',justifyContent:'flex-end'}}>
                          <span>{sc.length}/{MAX}</span>
                        </div>
                        {sc.map(c=>(
                          <div key={c.id} onClick={()=>abrirPanel(c)}
                            style={{display:'flex',alignItems:'center',gap:3,padding:'2px 4px',borderRadius:3,cursor:'pointer',marginBottom:1,minHeight:28}}
                            onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='rgba(90,150,158,.15)'}
                            onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                            <span style={{fontSize:11,color:'var(--n)',flex:1,fontWeight:400,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',textAlign:'center'}}>{c.pacientes?.nombre} {c.pacientes?.apellidos}</span>
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
          {citas.filter(c=>c.notas&&c.fecha===fecha).length>0&&(
            <>
              <div style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:5}}>Alertas pacientes</div>
              {citas.filter(c=>c.notas&&c.fecha===fecha).map(c=>(
                <div key={c.id} style={{borderRadius:5,padding:'5px 8px',borderLeft:'2px solid var(--g)',background:'var(--gl)',marginBottom:4}}>
                  <div style={{fontSize:8,color:'var(--gd)',marginBottom:1}}>{c.pacientes?.nombre}</div>
                  <div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.4}}>{c.notas}</div>
                </div>
              ))}
            </>
          )}
          <div style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:5,marginTop:8}}>Notas del día</div>
          {notasDia.length===0&&<div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>Sin notas para hoy</div>}
          {notasDia.map(n=>(
            <div key={n.id} style={{borderRadius:5,padding:'6px 8px',borderLeft:'2px solid var(--amb)',background:n.resuelta?'var(--bl)':'var(--ambl)',marginBottom:4,opacity:n.resuelta?0.6:1}}>
              <div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.4,textDecoration:n.resuelta?'line-through':'none'}}>{n.texto}</div>
              <div style={{display:'flex',gap:5,marginTop:4}}>
                <button onClick={()=>toggleNotaResuelta(n.id,n.resuelta)} style={{fontSize:8,padding:'1px 6px',borderRadius:3,border:'1px solid var(--amb)',background:'transparent',color:'var(--amb)',cursor:'pointer',fontFamily:'system-ui'}}>
                  {n.resuelta?'↩ Reabrir':'✓ Hecho'}
                </button>
                <button onClick={()=>eliminarNota(n.id)} style={{fontSize:8,padding:'1px 6px',borderRadius:3,border:'1px solid var(--red)',background:'transparent',color:'var(--red)',cursor:'pointer',fontFamily:'system-ui'}}>✕</button>
              </div>
            </div>
          ))}
        </div>
        {proximasAlertas && proximasAlertas.length>0&&(
          <div style={{padding:'7px 9px',borderBottom:'1px solid var(--bd)'}}>
            <div style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:5}}>🔔 Próximas alertas</div>
            {proximasAlertas.map((a:any,i:number)=>(
              <div key={i} style={{borderRadius:5,padding:'5px 8px',borderLeft:'2px solid var(--amb)',background:'var(--ambl)',marginBottom:4}}>
                <div style={{fontSize:8,color:'#7A5800',marginBottom:1,fontWeight:500}}>{new Date(a.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>
                <div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.4}}>{a.texto?.replace('🔔 ','')}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{padding:'7px 9px',borderTop:'1px solid var(--bd)',fontSize:9,color:'var(--amb)',cursor:'pointer',fontWeight:500,display:'flex',alignItems:'center',gap:5}} onClick={()=>setModalNota(true)}>
          <span>📝</span> + Nota del día
        </div>
      </div>
    </div>
  )
}
