'use client'
import { Ic } from '@/lib/icons'

export default function VistaSemana({ fecha, hoy, citas, getFechasSemana, setFecha, setVista, setNuevaCita, setModal, abrirPanel, horas, pausaInicio, pausaFin, tiposCita=[], tiposClase=[], maxPersonas=6, setEditandoCita, alertasPaciente=[], setVerAlertasCita, soloHueco=false, salas=['A','B'] }: {
  fecha: string
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
  const tint = (hex:string, a:number) => {
    const h=(hex||'#5A969E').replace('#',''); const n=h.length===3?h.split('').map(x=>x+x).join(''):h
    const r=parseInt(n.slice(0,2),16)||90, g=parseInt(n.slice(2,4),16)||150, b=parseInt(n.slice(4,6),16)||158
    return `rgba(${r},${g},${b},${a})`
  }
  const getNombreCorto = (c: any) => c.pacientes?.nombre_clinica || c.pacientes?.nombre || '?'

  function SubCelda({ cd, sala, f, h }: { cd:any[], sala:string, f:string, h:string }) {
    const n = cd.length
    if (n===0) {
      return (
        <div onClick={()=>{setFecha(f);setNuevaCita((p:any)=>({...p,fecha:f,hora:h,sala}));setModal(true)}}
          style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'transparent',cursor:'pointer',borderRadius:4,minHeight:44}}
          onMouseOver={e=>{const el=e.currentTarget;el.style.background='var(--gl)';el.style.color='var(--g)'}}
          onMouseOut={e=>{const el=e.currentTarget;el.style.background='';el.style.color='transparent'}}>+</div>
      )
    }
    const lleno = n>=MAX
    const libres = Math.max(0, MAX-n)
    const borde = lleno ? 'var(--amb)' : 'var(--g)'
    const atenuar = soloHueco && lleno
    return (
      <div style={{border:`1.5px solid ${borde}`,borderRadius:5,padding:'3px 4px',background:'var(--w)',opacity:atenuar?0.3:1,transition:'opacity .15s'}}>
        <div style={{fontSize:8,fontWeight:600,color:'var(--gr)',marginBottom:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{sala} {n}/{MAX}{lleno?' · Completo':` · ${libres} libre${libres>1?'s':''}`}</div>
        {cd.map((c:any)=>(
          <div key={c.id} onClick={()=>setEditandoCita&&setEditandoCita({...c})}
            style={{fontSize:9,color:'var(--n)',fontWeight:400,padding:'1px 4px',marginBottom:1,borderRadius:3,cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:1.35,display:'flex',alignItems:'center',gap:3,background:tint(colorTipo(c.tipo),0.18)}}
            title={getNombreCorto(c)}>
            {alertasPaciente.some((a:any)=>a.paciente_id===c.paciente_id)&&<span style={{display:'inline-flex',color:'var(--red)',flexShrink:0}} title="Tiene alertas"><Ic name="alerta" size={9}/></span>}
            <span style={{overflow:'hidden',textOverflow:'ellipsis'}}>{getNombreCorto(c)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',background:'var(--w)',height:'calc(100vh - 150px)',overflowY:'auto'}}>
      <div style={{display:'grid',gridTemplateColumns:'44px repeat(6,1fr)',background:'var(--bl)',borderBottom:'1px solid var(--bd)',position:'sticky',top:0,zIndex:2}}>
        <div/>
        {fs.map((f,i)=>{
          const isH=f===hoy,d=new Date(f+'T12:00:00')
          return (
            <div key={f} onClick={()=>{setFecha(f);setVista('dia')}}
              style={{padding:'6px 4px',textAlign:'center',borderLeft:'1px solid var(--bd)',cursor:'pointer',background:isH?'var(--gl)':'transparent'}}>
              <div style={{fontSize:8,color:'var(--grl)',fontWeight:400}}>{dn[i]}</div>
              <div style={{fontSize:13,fontWeight:isH?600:400,color:isH?'var(--g)':'var(--n)'}}>{d.getDate()}</div>
            </div>
          )
        })}
      </div>
      {HORAS.map(h=>(
        <div key={h}>
          {h===PAUSA_FIN&&<div style={{padding:'4px 10px',background:'var(--gl)',borderBottom:'1px solid var(--bd)',fontSize:9,color:'var(--gd)',display:'flex',alignItems:'center',gap:5}}><Ic name="pausa" size={11}/> Pausa {PAUSA_INICIO}–{PAUSA_FIN}</div>}
          <div style={{display:'grid',gridTemplateColumns:'44px repeat(6,1fr)',borderBottom:'1px solid var(--bl)'}}>
            <div style={{fontSize:9,color:'var(--gr)',padding:'5px 3px',borderRight:'1px solid var(--bl)',display:'flex',alignItems:'flex-start',justifyContent:'flex-end',fontWeight:500}}>{h}</div>
            {fs.map(f=>{
              const isH=f===hoy
              return (
                <div key={f} style={{borderLeft:'1px solid var(--bl)',background:isH?'rgba(90,150,158,.03)':'transparent',minHeight:50,display:'grid',gridTemplateColumns:`repeat(${salas.length},1fr)`,gap:2,padding:2}}>
                  {salas.map(s=>{
                    const cd=citas.filter(c=>c.fecha===f&&c.hora.startsWith(h)&&c.sala===s&&c.estado!=='cancelada')
                    return <SubCelda key={s} cd={cd} sala={s} f={f} h={h}/>
                  })}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
