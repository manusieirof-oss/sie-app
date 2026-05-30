'use client'

const HORAS = ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']

export default function VistaMes({ fecha, hoy, citas, getDiasMes, setFecha, setVista }: {
  fecha: string
  hoy: string
  citas: any[]
  getDiasMes: () => (string|null)[]
  setFecha: (f: string) => void
  setVista: (v: 'dia'|'semana'|'mes') => void
}) {
  return (
    <div style={{border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',background:'var(--w)'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',background:'var(--bl)',borderBottom:'1px solid var(--bd)'}}>
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>(
          <div key={d} style={{fontSize:9,fontWeight:600,color:'var(--grl)',padding:'7px',textAlign:'center',letterSpacing:.3}}>{d}</div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
        {getDiasMes().map((f,i)=>{
          if (!f) return <div key={i} style={{minHeight:80,borderRight:'1px solid var(--bl)',borderBottom:'1px solid var(--bl)',background:'var(--bl)'}}/>
          const cd=citas.filter(c=>c.fecha===f),isH=f===hoy,d=new Date(f+'T12:00:00')
          return (
            <div key={f} onClick={()=>{setFecha(f);setVista('dia')}}
              style={{minHeight:80,padding:'4px 5px',borderRight:'1px solid var(--bl)',borderBottom:'1px solid var(--bl)',cursor:'pointer',background:isH?'var(--gl)':'var(--w)',transition:'background .1s'}}
              onMouseOver={e=>{if(!isH)(e.currentTarget as HTMLElement).style.background='rgba(90,150,158,.05)'}}
              onMouseOut={e=>{if(!isH)(e.currentTarget as HTMLElement).style.background='var(--w)'}}>
              <div style={{fontSize:11,fontWeight:isH?600:300,color:isH?'var(--g)':'var(--n)',marginBottom:3}}>{d.getDate()}</div>
              {cd.slice(0,3).map(c=>(
                <div key={c.id} style={{fontSize:8,padding:'1px 4px',borderRadius:2,background:'var(--g)',color:'#fff',marginBottom:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  {c.hora?.slice(0,5)} {c.pacientes?.nombre}
                </div>
              ))}
              {cd.length>3&&<div style={{fontSize:8,color:'var(--g)',fontWeight:500}}>+{cd.length-3} más</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
