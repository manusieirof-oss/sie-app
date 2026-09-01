'use client'
import { Ic } from '@/lib/icons'
import { iconTipoClase } from '@/lib/tipos'
import { hoyISO } from '@/lib/fechas'

export default function VistaDia({ fecha, hoy, fechaDisplay, citas, totalPersonas, clases, abrirPanel, setNuevaCita, setModal, horas, pausaInicio, pausaFin, descanso, maxPersonas, tiposCita=[], tiposClase=[], setEditandoCita, abrirDatosCita, abrirEntrenoCita, setVerAlertasCita, alertasPaciente=[], tareas=[], completarTarea, setModalTareas, salaFiltro='ambas', tiposFiltro=[], salas=['A','B'] }: {
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
  setNuevaCita: (fn: (p: any) => any) => void
  setModal: (v: boolean) => void
  horas?: string[]
  pausaInicio?: string
  pausaFin?: string
  descanso?: number
  maxPersonas?: number
  tiposCita?: any[]
  tiposClase?: any[]
  salaFiltro?: string
  tiposFiltro?: string[]
  salas?: string[]
}) {
  const DESCANSO = descanso || 10
  const MAX = maxPersonas || 6
  const HORAS = horas && horas.length > 0 ? horas : ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']
  const PAUSA_INICIO = pausaInicio || '12:30'
  const PAUSA_FIN = pausaFin || '15:30'
  const SALAS = salaFiltro==='ambas' ? salas : [salaFiltro]
  // minmax(0,1fr) y no 1fr: con 1fr el mínimo es el contenido, así que una sala con
  // nombres largos (o los selects en tablet) le robaba ancho a la otra y las columnas
  // dejaban de medir lo mismo.
  const GT = '56px '+SALAS.map(()=>'minmax(0,1fr)').join(' ')
  const filtrando = (tiposFiltro?.length||0) > 0

  const colorTipo = (t:string) => (tiposClase.find((x:any)=>x.valor===t)?.color) || '#5A969E'
  const nombreTipo = (t:string) => (tiposClase.find((x:any)=>x.valor===t)?.nombre) || (t ? t.charAt(0).toUpperCase()+t.slice(1) : 'Clase')
  const iconTipo = (t:string) => iconTipoClase(t, tiposClase.find((x:any)=>x.valor===t)?.icono)
  const tint = (hex:string, a:number) => {
    const h=(hex||'#5A969E').replace('#','')
    const n=h.length===3?h.split('').map(x=>x+x).join(''):h
    const r=parseInt(n.slice(0,2),16)||90, g=parseInt(n.slice(2,4),16)||150, b=parseInt(n.slice(4,6),16)||158
    return `rgba(${r},${g},${b},${a})`
  }

  function getCitasSlot(h: string, sala: string) {
    return citas.filter(c=>c.hora.startsWith(h)&&c.sala===sala&&c.fecha===fecha)
  }

  function abrirNueva(h:string, sala:string) {
    setNuevaCita((p:any)=>({...p,fecha,hora:h,sala})); setModal(true)
  }

  function FilaPaciente({ c }: { c:any }) {
    const falta = c.estado==='falta'
    const tieneAlerta = alertasPaciente.some((a:any)=>a.paciente_id===c.paciente_id)
    const col = colorTipo(c.tipo)
    const bgBase = falta?'var(--redl)':tint(col,0.18)
    const bgHover = falta?'#FBE8E8':tint(col,0.30)
    const bd = falta?'#F0C9C9':tint(col,0.45)
    return (
      <div onClick={()=>setVerAlertasCita&&setVerAlertasCita(c)} title={nombreTipo(c.tipo)}
        style={{display:'flex',alignItems:'center',gap:7,padding:'6px 8px',borderRadius:7,cursor:'pointer',marginBottom:3,background:bgBase,border:`1px solid ${bd}`,transition:'all .12s'}}
        onMouseOver={e=>{(e.currentTarget as HTMLElement).style.background=bgHover}}
        onMouseOut={e=>{(e.currentTarget as HTMLElement).style.background=bgBase}}>
        <span style={{display:'inline-flex',color:col,flexShrink:0}}><Ic name={iconTipo(c.tipo)} size={16}/></span>
        {tieneAlerta&&<span style={{display:'inline-flex',color:'var(--red)',flexShrink:0}} title="Tiene alertas activas"><Ic name="alerta" size={13}/></span>}
        <span style={{fontSize:12,color:falta?'var(--red)':'var(--n)',flex:1,fontWeight:400,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
          {falta&&<span style={{fontWeight:600,marginRight:4}}>✗</span>}{c.pacientes?.nombre} {c.pacientes?.apellidos}
        </span>
        <span onClick={e=>{e.stopPropagation();abrirEntrenoCita&&abrirEntrenoCita(c)}} style={{display:'inline-flex',color:'var(--grl)',cursor:'pointer',flexShrink:0,padding:'2px'}} title="Entrenamiento" onMouseOver={e=>(e.currentTarget as HTMLElement).style.color='var(--g)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.color='var(--grl)'}><Ic name="entreno" size={15}/></span>
        <span onClick={e=>{e.stopPropagation();abrirDatosCita&&abrirDatosCita(c)}} style={{display:'inline-flex',color:'var(--grl)',cursor:'pointer',flexShrink:0,padding:'2px'}} title="Ver datos" onMouseOver={e=>(e.currentTarget as HTMLElement).style.color='var(--g)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.color='var(--grl)'}><Ic name="usuario" size={15}/></span>
        <span onClick={e=>{e.stopPropagation();setEditandoCita&&setEditandoCita({...c})}} style={{display:'inline-flex',color:'var(--grl)',cursor:'pointer',flexShrink:0,padding:'2px'}} title="Editar cita" onMouseOver={e=>(e.currentTarget as HTMLElement).style.color='var(--g)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.color='var(--grl)'}><Ic name="editar" size={15}/></span>
      </div>
    )
  }

  return (
    <div style={{border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',background:'var(--w)',height:'calc(100vh - 150px)'}}>
      <div style={{overflowY:'auto',height:'100%'}}>
        <div style={{display:'grid',gridTemplateColumns:GT,background:'var(--bl)',borderBottom:'1px solid var(--bd)',position:'sticky',top:0,zIndex:2}}>
          <div/>
          {SALAS.map(s=><div key={s} style={{fontSize:11,fontWeight:600,color:'var(--gd)',padding:'9px 10px',textAlign:'center',letterSpacing:.4,borderLeft:'1px solid var(--bd)'}}>Sala {s}</div>)}
        </div>
        {HORAS.map(h=>{
          // Hora sin nadie en ninguna sala: ocupa menos. En tablet, con la agenda medio
          // vacía, esas filas se comían la pantalla y había que hacer scroll para llegar
          // a las horas que sí tienen gente.
          const horaVacia = SALAS.every(s=>getCitasSlot(h,s).length===0)
          return (
          <div key={h}>
            {h===PAUSA_FIN&&<div style={{padding:'5px 12px',background:'var(--gl)',borderBottom:'1px solid var(--bd)',fontSize:11,color:'var(--gd)',display:'flex',alignItems:'center',gap:6}}><Ic name="pausa" size={12}/> Pausa · {PAUSA_INICIO}–{PAUSA_FIN}</div>}
            <div style={{display:'grid',gridTemplateColumns:GT,borderBottom:'1px solid var(--bl)'}}>
              <div style={{fontSize:horaVacia?12:13,color:horaVacia?'var(--grl)':'var(--gr)',padding:horaVacia?'6px 8px':'10px 8px',borderRight:'1px solid var(--bl)',display:'flex',alignItems:'flex-start',justifyContent:'flex-end',fontWeight:500}}>{h}</div>
              {SALAS.map(sala=>{
                const scAll=getCitasSlot(h,sala)
                const scActivas=scAll.filter((c:any)=>c.estado!=='cancelada').sort((a:any,b:any)=>(a.estado==='falta'?1:0)-(b.estado==='falta'?1:0))
                const scCancAll=scAll.filter((c:any)=>c.estado==='cancelada')
                const sc = filtrando ? scActivas.filter((c:any)=>tiposFiltro.includes(c.tipo)) : scActivas
                const scCanceladas = filtrando ? scCancAll.filter((c:any)=>tiposFiltro.includes(c.tipo)) : scCancAll
                const sobre=!filtrando && scActivas.length>MAX
                const libres=filtrando?0:Math.max(0,MAX-scActivas.length)
                const renderCancelada=(c:any)=>(
                  <div key={c.id} onClick={()=>setEditandoCita&&setEditandoCita({...c})} title="Cita cancelada · pulsa para editar/deshacer"
                    style={{fontSize:11,color:'var(--grl)',textDecoration:'line-through',cursor:'pointer',padding:'2px 0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                    {c.pacientes?.nombre} {c.pacientes?.apellidos}
                  </div>
                )
                if (sc.length===0 && scCanceladas.length===0) {
                  const alto = horaVacia ? 26 : 44
                  return (
                    <div key={sala} style={{borderLeft:'1px solid var(--bl)',padding:horaVacia?4:6,minHeight:horaVacia?34:52,minWidth:0}}>
                      {filtrando ? (
                        <div style={{border:'1px dashed var(--bd2)',borderRadius:8,minHeight:alto,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'var(--bm)'}}>·</div>
                      ):(
                        <div onClick={()=>abrirNueva(h,sala)}
                          style={{border:'1.5px dashed var(--bm)',borderRadius:8,minHeight:alto,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'var(--grl)',cursor:'pointer',transition:'all .12s'}}
                          onMouseOver={e=>{const el=e.currentTarget;el.style.borderColor='var(--g)';el.style.color='var(--g)';el.style.background='var(--gl)'}}
                          onMouseOut={e=>{const el=e.currentTarget;el.style.borderColor='var(--bm)';el.style.color='var(--grl)';el.style.background=''}}>
                          + libre
                        </div>
                      )}
                    </div>
                  )
                }
                return (
                  <div key={sala} style={{borderLeft:'1px solid var(--bl)',padding:6,minHeight:52,minWidth:0}}>
                    <div style={{border:`1px solid ${sobre?'var(--amb)':'var(--bd)'}`,borderRadius:10,padding:'8px 9px',background:'var(--w)'}}>
                      {sc.length>0&&(
                        <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',marginBottom:7}}>
                          <span style={{fontSize:10,fontWeight:600,flexShrink:0,borderRadius:99,padding:'2px 9px',color:sobre?'#8A6410':'var(--gd)',background:sobre?'var(--ambl)':'var(--gl)',border:sobre?'1px solid var(--amb)':'none'}}>{filtrando?sc.length:`${scActivas.length}/${MAX}`}</span>
                        </div>
                      )}
                      {sc.map((c:any)=><FilaPaciente key={c.id} c={c}/>)}
                      {Array.from({length:libres}).map((_,i)=>(
                        <div key={'libre'+i} onClick={()=>abrirNueva(h,sala)}
                          style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'6px',marginBottom:3,borderRadius:7,border:'1.5px dashed var(--bm)',color:'var(--grl)',fontSize:11,cursor:'pointer',transition:'all .12s'}}
                          onMouseOver={e=>{const el=e.currentTarget;el.style.borderColor='var(--g)';el.style.color='var(--g)'}}
                          onMouseOut={e=>{const el=e.currentTarget;el.style.borderColor='var(--bm)';el.style.color='var(--grl)'}}>+ plaza libre</div>
                      ))}
                      {!filtrando&&libres===0&&(
                        <div onClick={()=>abrirNueva(h,sala)} style={{textAlign:'center',fontSize:10,color:sobre?'#8A6410':'var(--g)',cursor:'pointer',fontWeight:500,padding:'4px'}}>
                          {sobre?'Grupo por encima del aforo · + añadir':'+ añadir'}
                        </div>
                      )}
                      {scCanceladas.length>0&&(
                        <div style={{marginTop:8,paddingTop:7,borderTop:'1px dashed var(--bd)'}}>
                          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:4}}>Bajas · liberan plaza</div>
                          {scCanceladas.map(renderCancelada)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {!horaVacia && (
              <div style={{display:'grid',gridTemplateColumns:GT,background:'var(--bl)'}}>
                <div style={{borderRight:'1px solid var(--bm)'}}/>
                <div style={{gridColumn:'2/-1',padding:'1px 8px',borderLeft:'1px solid var(--bm)',fontSize:8,color:'var(--grl)'}}>{DESCANSO} min cambio</div>
              </div>
            )}
          </div>
          )
        })}
      </div>

    </div>
  )
}
