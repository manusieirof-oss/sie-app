'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'

export default function VistaMes({ fecha, hoy, citas, getDiasMes, setFecha, setVista, pacientes=[], tiposClase=[], onEditarMulti }: {
  fecha: string
  hoy: string
  citas: any[]
  getDiasMes: () => (string|null)[]
  setFecha: (f: string) => void
  setVista: (v: 'dia'|'semana'|'mes') => void
  pacientes?: any[]
  tiposClase?: any[]
  onEditarMulti?: (citas:any[], nombre:string) => void
}) {
  const [q, setQ] = useState('')
  const [pacSel, setPacSel] = useState<{id:string,nombre:string}|null>(null)

  const colorTipo = (t:string) => (tiposClase.find((x:any)=>x.valor===t)?.color) || '#5A969E'
  const tint = (hex:string, a:number) => {
    const h=(hex||'#5A969E').replace('#',''); const n=h.length===3?h.split('').map(x=>x+x).join(''):h
    const r=parseInt(n.slice(0,2),16)||90, g=parseInt(n.slice(2,4),16)||150, b=parseInt(n.slice(4,6),16)||158
    return `rgba(${r},${g},${b},${a})`
  }
  const resultados = q.trim() ? pacientes.filter((p:any)=>`${p.nombre} ${p.apellidos} ${p.nombre_clinica||''}`.toLowerCase().includes(q.toLowerCase())).slice(0,8) : []

  const citasPac = pacSel ? citas.filter((c:any)=>c.paciente_id===pacSel.id) : []
  const abrirMulti = () => { if (pacSel && onEditarMulti) onEditarMulti(citasPac, pacSel.nombre) }

  return (
    <div>
      {/* Buscador / filtro por paciente */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,flexWrap:'wrap'}}>
        {!pacSel ? (
          <div style={{position:'relative',width:260}}>
            <input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Filtrar por paciente en el mes..." style={{fontSize:12,paddingLeft:30}}/>
            <span style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'var(--grl)',display:'inline-flex'}}><Ic name="buscar" size={14}/></span>
            {resultados.length>0 && (
              <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',boxShadow:'var(--sh-md)',zIndex:30,marginTop:3,maxHeight:260,overflowY:'auto'}}>
                {resultados.map((p:any)=>(
                  <div key={p.id} onClick={()=>{setPacSel({id:p.id,nombre:`${p.nombre} ${p.apellidos||''}`.trim()});setQ('')}}
                    style={{padding:'8px 11px',cursor:'pointer',fontSize:12,borderBottom:'1px solid var(--bl)'}}
                    onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                    {p.nombre} {p.apellidos}{p.nombre_clinica?<span style={{color:'var(--grl)',fontSize:10}}> · "{p.nombre_clinica}"</span>:null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <span style={{display:'inline-flex',alignItems:'center',gap:7,fontSize:12,background:'var(--gl)',border:'1px solid var(--g)',color:'var(--gd)',borderRadius:99,padding:'5px 12px',fontWeight:500}}>
              <Ic name="usuario" size={13}/> {pacSel.nombre}
              <span onClick={()=>{setPacSel(null);setQ('')}} style={{cursor:'pointer',display:'inline-flex'}} title="Quitar filtro"><Ic name="cerrar" size={13}/></span>
            </span>
            <span style={{fontSize:11,color:'var(--grl)'}}>{citasPac.length} sesion{citasPac.length===1?'':'es'} este mes</span>
            {citasPac.length>0 && <button className="btn btn-p btn-sm" onClick={abrirMulti}><Ic name="editar" size={13}/> Editar sesiones</button>}
          </>
        )}
      </div>

      <div style={{border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',background:'var(--w)'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',background:'var(--bl)',borderBottom:'1px solid var(--bd)'}}>
          {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>(
            <div key={d} style={{fontSize:9,fontWeight:600,color:'var(--grl)',padding:'7px',textAlign:'center',letterSpacing:.3}}>{d}</div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
          {getDiasMes().map((f,i)=>{
            if (!f) return <div key={i} style={{minHeight:82,borderRight:'1px solid var(--bl)',borderBottom:'1px solid var(--bl)',background:'var(--bl)'}}/>
            const isH=f===hoy,d=new Date(f+'T12:00:00')
            const cdAll=citas.filter(c=>c.fecha===f&&c.estado!=='cancelada')
            const cd = pacSel ? cdAll.filter((c:any)=>c.paciente_id===pacSel.id) : cdAll
            const atenuar = !!pacSel && cd.length===0
            const onClickDia = () => {
              if (pacSel && cd.length>0) abrirMulti()
              else { setFecha(f); setVista('dia') }
            }
            return (
              <div key={f} onClick={onClickDia}
                style={{minHeight:82,padding:'4px 5px',borderRight:'1px solid var(--bl)',borderBottom:'1px solid var(--bl)',cursor:'pointer',background:isH?'var(--gl)':'var(--w)',opacity:atenuar?0.4:1,transition:'background .1s'}}
                onMouseOver={e=>{if(!isH&&!atenuar)(e.currentTarget as HTMLElement).style.background='rgba(90,150,158,.05)'}}
                onMouseOut={e=>{if(!isH)(e.currentTarget as HTMLElement).style.background=isH?'var(--gl)':'var(--w)'}}>
                <div style={{fontSize:11,fontWeight:isH?600:400,color:isH?'var(--g)':'var(--n)',marginBottom:3}}>{d.getDate()}</div>
                {cd.slice(0,3).map((c:any)=>(
                  <div key={c.id} style={{fontSize:8,padding:'2px 5px',borderRadius:3,marginBottom:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',background:tint(colorTipo(c.tipo),0.2),border:pacSel?`1.5px solid ${colorTipo(c.tipo)}`:'none',color:'var(--n)'}}>
                    {c.hora?.slice(0,5)} {pacSel?`· Sala ${c.sala}`:c.pacientes?.nombre}
                  </div>
                ))}
                {cd.length>3&&<div style={{fontSize:8,color:'var(--g)',fontWeight:500}}>+{cd.length-3} más</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
