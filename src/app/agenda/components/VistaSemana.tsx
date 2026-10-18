'use client'
import { Ic } from '@/lib/icons'
import { iconTipoClase } from '@/lib/tipos'
import { responsableDe } from '@/lib/turnos'

export default function VistaSemana({ fecha, hoy, citas, getFechasSemana, setFecha, setVista, setNuevaCita, setModal, abrirPanel, horas, pausaInicio, pausaFin, tiposCita=[], tiposClase=[], maxPersonas=6, setEditandoCita, alertasPaciente=[], setVerAlertasCita, soloHueco=false, salas=['A','B'], turnos=[] }: {
  fecha: string
  turnos?: any[]
  hoy: string
  citas: any[]
  getFechasSemana: () => string[]
  setFecha: (f: string) => void
  setVista: (v: 'dia'|'semana'|'mes') => void
  setNuevaCita: (fn: (p: any) => any) => void
  setModal: (v: boolean) => void
  abrirPanel: (c: any) => void
  tiposCita?: any[]
  tiposClase?: any[]
  alertasPaciente?: any[]
  setVerAlertasCita?: (c:any)=>void
  maxPersonas?: number
  setEditandoCita?: (c: any) => void
  horas?: string[]
  pausaInicio?: string
  pausaFin?: string
  soloHueco?: boolean
  salas?: string[]
}) {
  const HORAS = horas && horas.length > 0 ? horas : ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']
  const PAUSA_INICIO = pausaInicio || '12:30'
  const PAUSA_FIN = pausaFin || '15:30'
  const MAX = maxPersonas || 6
  const fs = getFechasSemana()
  const dn = ['Lun','Mar','Mié','Jue','Vie','Sáb']

  const colorTipo = (t:string) => (tiposClase.find((x:any)=>x.valor===t)?.color) || '#5A969E'
  const iconTipo = (t:string) => iconTipoClase(t, tiposClase.find((x:any)=>x.valor===t)?.icono)
  const nombreTipo = (t:string) => (tiposClase.find((x:any)=>x.valor===t)?.nombre) || t
  const tint = (hex:string, a:number) => {
    const h=(hex||'#5A969E').replace('#',''); const n=h.length===3?h.split('').map(x=>x+x).join(''):h
    const r=parseInt(n.slice(0,2),16)||90, g=parseInt(n.slice(2,4),16)||150, b=parseInt(n.slice(4,6),16)||158
    return `rgba(${r},${g},${b},${a})`
  }
  const getNombreCorto = (c: any) => c.pacientes?.nombre_clinica || c.pacientes?.nombre || '?'

  // Lo mismo que en la vista de día: tarjeta suave por clase, aforo en barrita y el
  // tipo de clase como un punto de color. Sin bordes de celda ni rayas.
  function SubCelda({ cd, sala, f, h }: { cd:any[], sala:string, f:string, h:string }) {
    const n = cd.length
    // Quien se hace cargo. Si nadie esta asignado a esta sala, el que este a esa
    // hora, en cursiva: es deduccion, no decision. Ver `lib/turnos`.
    const resp = responsableDe(turnos, f, h, sala)
    const quien = resp.lista.map((t:any)=>(t.perfil?.nombre||'').trim()).filter(Boolean).join(' · ')
    if (n===0) {
      return (
        <div className="sem-vacia" title={`Sala ${sala} · nueva cita`}
          onClick={()=>{setFecha(f);setNuevaCita((p:any)=>({...p,fecha:f,hora:h,sala}));setModal(true)}}>+</div>
      )
    }
    const lleno = n>=MAX
    const atenuar = soloHueco && lleno
    const pct = Math.min(100, Math.round(n/MAX*100))
    return (
      <div className={`sem-clase ${lleno?'llena':''}`} style={{opacity:atenuar?0.3:1}}>
        <div className="sem-cab" title={lleno?'Completa':`${MAX-n} libre${MAX-n>1?'s':''}`}>
          {salas.length>1&&<b>{sala}</b>}
          <span className="ag-barra" style={{flex:1,width:'auto'}}><i style={{width:pct+'%'}}/></span>
          <span>{n}/{MAX}</span>
        </div>
        {quien && (
          <div className="sem-quien" title={resp.deducido ? 'Nadie asignado a esta sala: es quien está a esa hora' : 'Se hace cargo'}
            style={{fontStyle:resp.deducido?'italic':'normal',color:resp.deducido?'var(--grl)':'var(--gd)'}}>
            {quien}
          </div>
        )}
        {cd.map((c:any)=>(
          <div key={c.id} className="sem-pac" onClick={()=>setEditandoCita&&setEditandoCita({...c})}
            title={`${getNombreCorto(c)} · ${nombreTipo(c.tipo)}`}>
            <span className="ag-punto" style={{background:colorTipo(c.tipo),width:6,height:6}}/>
            <span className="sem-nom">{getNombreCorto(c)}</span>
            {alertasPaciente.some((a:any)=>a.paciente_id===c.paciente_id)&&<span style={{display:'inline-flex',color:'var(--red)',flexShrink:0}} title="Tiene alertas"><Ic name="alerta" size={10}/></span>}
            {c._ultimaBono&&<span title="Gasta la última sesión de su bono: toca renovar" className="sem-ult">últ.</span>}
          </div>
        ))}
        {/* Apuntar a alguien más en esta misma clase. Antes solo se podía desde un hueco
            vacío, así que una clase con una persona no dejaba añadir a nadie. */}
        <div className="sem-mas" onClick={()=>{setFecha(f);setNuevaCita((p:any)=>({...p,fecha:f,hora:h,sala}));setModal(true)}}
          title={lleno?'Clase completa: añadir igualmente':'Apuntar a alguien'}>
          <Ic name="mas" size={10}/>{lleno?'añadir':`${MAX-n} libre${MAX-n>1?'s':''}`}
        </div>
      </div>
    )
  }

  const GT = '52px repeat(6,minmax(0,1fr))'
  return (
    <div className="ag-dia" style={{overflowY:'auto'}}>
      <div className="sem-fila sem-dias" style={{gridTemplateColumns:GT}}>
        <div/>
        {fs.map((f,i)=>{
          const isH=f===hoy,d=new Date(f+'T12:00:00')
          return (
            <div key={f} className={`sem-dia ${isH?'hoy':''}`} onClick={()=>{setFecha(f);setVista('dia')}} title="Ver el día">
              <span>{dn[i]}</span><b>{d.getDate()}</b>
            </div>
          )
        })}
      </div>
      {HORAS.map(h=>{
        const vacia = fs.every(f=>citas.every(c=>!(c.fecha===f&&c.hora.startsWith(h)&&c.estado!=='cancelada'&&c.estado!=='falta')))
        return (
        <div key={h}>
          {h===PAUSA_FIN&&<div className="ag-pausa">Pausa · {PAUSA_INICIO} – {PAUSA_FIN}</div>}
          <div className="sem-fila ag-sep" style={{gridTemplateColumns:GT}}>
            <div className="ag-hora" style={{paddingTop:9,fontWeight:vacia?500:600,color:vacia?'var(--grl)':'var(--n)'}}>{h}</div>
            {fs.map(f=>(
              <div key={f} className={`sem-celda ${f===hoy?'hoy':''}`} style={{gridTemplateColumns:`repeat(${salas.length},minmax(0,1fr))`}}>
                {salas.map(s=>{
                  /* NI CANCELADAS NI FALTAS. La semanal es la foto de quien viene y de
                     cuantas plazas quedan; quien avisó y quien no se ve en la vista de
                     día y en su ficha, que es donde eso importa. */
                  const cd=citas.filter(c=>c.fecha===f&&c.hora.startsWith(h)&&c.sala===s
                    &&c.estado!=='cancelada'&&c.estado!=='falta')
                  return <SubCelda key={s} cd={cd} sala={s} f={f} h={h}/>
                })}
              </div>
            ))}
          </div>
        </div>
        )
      })}
      <div style={{height:12}}/>
    </div>
  )
}
