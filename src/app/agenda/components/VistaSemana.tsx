'use client'

const HORAS = ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']

export default function VistaSemana({ fecha, hoy, citas, getFechasSemana, setFecha, setVista, setNuevaCita, setModal, abrirPanel }: {
  fecha: string
  hoy: string
  citas: any[]
  getFechasSemana: () => string[]
  setFecha: (f: string) => void
  setVista: (v: 'dia'|'semana'|'mes') => void
  setNuevaCita: (fn: (p: any) => any) => void
  setModal: (v: boolean) => void
  abrirPanel: (c: any) => void
}) {
  const fs = getFechasSemana()
  const dn = ['Lun','Mar','Mié','Jue','Vie','Sáb']

  function getNombreCorto(c: any) {
    return c.pacientes?.nombre_clinica || c.pacientes?.nombre || '?'
  }

  return (
    <div style={{border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',background:'var(--w)',height:'calc(100vh - 150px)',overflowY:'auto'}}>
      <div style={{display:'grid',gridTemplateColumns:'44px repeat(6,1fr)',background:'var(--bl)',borderBottom:'1px solid var(--bd)',position:'sticky',top:0,zIndex:2}}>
        <div/>
        {fs.map((f,i)=>{
          const isH=f===hoy,d=new Date(f+'T12:00:00')
          return (
            <div key={f} onClick={()=>{setFecha(f);setVista('dia')}}
              style={{padding:'5px 4px',textAlign:'center',borderLeft:'1px solid var(--bd)',cursor:'pointer',background:isH?'var(--gl)':'transparent'}}>
              <div style={{fontSize:8,color:'var(--grl)',fontWeight:300}}>{dn[i]}</div>
              <div style={{fontSize:12,fontWeight:isH?600:300,color:isH?'var(--g)':'var(--n)'}}>{d.getDate()}</div>
            </div>
          )
        })}
      </div>
      {HORAS.map(h=>(
        <div key={h}>
          {h==='15:30'&&<div style={{padding:'3px 10px',background:'var(--bm)',borderBottom:'1px solid var(--bd)',fontSize:8,color:'var(--gr)'}}>— Pausa 12:30–15:30</div>}
          <div style={{display:'grid',gridTemplateColumns:'44px repeat(6,1fr)',borderBottom:'1px solid var(--bl)'}}>
            <div style={{fontSize:8,color:'var(--grl)',padding:'4px 2px',borderRight:'1px solid var(--bl)',display:'flex',alignItems:'flex-start',justifyContent:'flex-end',fontWeight:300}}>{h}</div>
            {fs.map(f=>{
              const cdA=citas.filter(c=>c.fecha===f&&c.hora.startsWith(h)&&c.sala==='A')
              const cdB=citas.filter(c=>c.fecha===f&&c.hora.startsWith(h)&&c.sala==='B')
              const isH=f===hoy
              const tieneGente=cdA.length>0||cdB.length>0
              return (
                <div key={f} style={{borderLeft:'1px solid var(--bl)',background:isH?'rgba(90,150,158,.03)':'transparent',minHeight:52}}>
                  {!tieneGente ? (
                    <div onClick={()=>{setFecha(f);setNuevaCita((p:any)=>({...p,hora:h}));setModal(true)}}
                      style={{height:'100%',minHeight:50,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'transparent',cursor:'pointer'}}
                      onMouseOver={e=>{const el=e.currentTarget;el.style.background='var(--gl)';el.style.color='var(--g)';el.textContent='+'}}
                      onMouseOut={e=>{const el=e.currentTarget;el.style.background='';el.style.color='transparent';el.textContent='+'}}>+</div>
                  ) : (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',height:'100%',gap:1,padding:1}}>
                      <div style={{background:cdA.length>0?'var(--gl)':'transparent',borderRadius:3,padding:'2px 3px',borderLeft:cdA.length>0?'2px solid var(--g)':'none',minHeight:48}}>
                        {cdA.length>0&&<div style={{fontSize:7,color:'var(--g)',fontWeight:600,marginBottom:1,letterSpacing:.3}}>A {cdA.length}/6</div>}
                        {cdA.map(c=>(
                          <div key={c.id} onClick={()=>abrirPanel(c)}
                            style={{fontSize:8,color:'var(--n)',fontWeight:300,padding:'1px',cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:1.3}}
                            onMouseOver={e=>(e.currentTarget as HTMLElement).style.color='var(--g)'}
                            onMouseOut={e=>(e.currentTarget as HTMLElement).style.color='var(--n)'}>
                            {getNombreCorto(c)}
                          </div>
                        ))}
                        {cdA.length===0&&cdB.length>0&&<div style={{fontSize:7,color:'var(--grl)',padding:'1px',fontStyle:'italic'}}>libre</div>}
                      </div>
                      <div style={{background:cdB.length>0?'rgba(90,150,158,.06)':'transparent',borderRadius:3,padding:'2px 3px',borderLeft:cdB.length>0?'2px solid var(--gm)':'none',minHeight:48}}>
                        {cdB.length>0&&<div style={{fontSize:7,color:'var(--gm)',fontWeight:600,marginBottom:1,letterSpacing:.3}}>B {cdB.length}/6</div>}
                        {cdB.map(c=>(
                          <div key={c.id} onClick={()=>abrirPanel(c)}
                            style={{fontSize:8,color:'var(--n)',fontWeight:300,padding:'1px',cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:1.3}}
                            onMouseOver={e=>(e.currentTarget as HTMLElement).style.color='var(--g)'}
                            onMouseOut={e=>(e.currentTarget as HTMLElement).style.color='var(--n)'}>
                            {getNombreCorto(c)}
                          </div>
                        ))}
                        {cdB.length===0&&cdA.length>0&&<div style={{fontSize:7,color:'var(--grl)',padding:'1px',fontStyle:'italic'}}>libre</div>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
