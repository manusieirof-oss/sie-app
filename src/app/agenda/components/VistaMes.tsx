'use client'
import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Ic } from '@/lib/icons'
import { supabase } from '@/lib/supabase'
import { festivoDe, COLOR_FESTIVO, LABEL_FESTIVO } from '@/lib/festivos'

export default function VistaMes({ fecha, hoy, citas, getDiasMes, setFecha, setVista, pacientes=[], tiposClase=[], onEditarMulti, maxPersonas=6, eventos=[] }: {
  fecha: string
  hoy: string
  citas: any[]
  getDiasMes: () => (string|null)[]
  setFecha: (f: string) => void
  setVista: (v: 'dia'|'semana'|'mes') => void
  pacientes?: any[]
  tiposClase?: any[]
  onEditarMulti?: (citas:any[], nombre:string) => void
  maxPersonas?: number
  eventos?: any[]
}) {
  const [q, setQ] = useState('')
  const [pacSel, setPacSel] = useState<{id:string,nombre:string}|null>(null)
  const [pagos, setPagos] = useState<{pendiente:number,impago:number}>({pendiente:0,impago:0})
  const MAX = maxPersonas || 6

  useEffect(() => {
    supabase.from('bonos').select('estado_pago').eq('activo',true).then(({data})=>{
      const p = data||[]
      setPagos({ pendiente:p.filter((x:any)=>x.estado_pago==='pendiente').length, impago:p.filter((x:any)=>x.estado_pago==='impago').length })
    })
  }, [])

  const colorTipo = (t:string) => (tiposClase.find((x:any)=>x.valor===t)?.color) || '#5A969E'
  const nombreTipo = (t:string) => (tiposClase.find((x:any)=>x.valor===t)?.nombre) || t
  const tint = (hex:string, a:number) => {
    const h=(hex||'#5A969E').replace('#',''); const n=h.length===3?h.split('').map(x=>x+x).join(''):h
    const r=parseInt(n.slice(0,2),16)||90, g=parseInt(n.slice(2,4),16)||150, b=parseInt(n.slice(4,6),16)||158
    return `rgba(${r},${g},${b},${a})`
  }
  const resultados = q.trim() ? pacientes.filter((p:any)=>`${p.nombre} ${p.apellidos} ${p.nombre_clinica||''}`.toLowerCase().includes(q.toLowerCase())).slice(0,8) : []

  const citasPac = pacSel ? citas.filter((c:any)=>c.paciente_id===pacSel.id) : []
  const abrirMulti = () => { if (pacSel && onEditarMulti) onEditarMulti(citasPac, pacSel.nombre) }

  const dias = getDiasMes()
  const nRows = Math.max(1, Math.ceil(dias.length/7))
  const padded = [...dias, ...Array(nRows*7 - dias.length).fill(null)]
  const mesLabel = new Date(fecha+'T12:00:00').toLocaleDateString('es-ES',{month:'long',year:'numeric'})

  // ---- Estadísticas del mes ----
  const activas = citas.filter((c:any)=>c.estado!=='cancelada')
  const personasMes = activas.length
  const clasesMes = new Set(activas.map((c:any)=>`${c.fecha}|${(c.hora||'').slice(0,5)}|${c.sala}`)).size
  const faltasMes = citas.filter((c:any)=>c.estado==='falta').length
  const cancelMes = citas.filter((c:any)=>c.estado==='cancelada').length
  const porTipo = Object.entries(activas.reduce((acc:Record<string,number>,c:any)=>{acc[c.tipo]=(acc[c.tipo]||0)+1;return acc},{} as Record<string,number>))
    .sort((a:any,b:any)=>b[1]-a[1])
  const dataTipo = porTipo.map(([tipo,n]:any)=>({ tipo, name:nombreTipo(tipo), value:n, color:colorTipo(tipo) }))

  const cumplesDe = (f:string) => pacientes.filter((p:any)=>p.fecha_nacimiento && p.fecha_nacimiento.slice(5)===f.slice(5))
  const enRango = (e:any, f:string) => {
    if (e.anual) { const md=f.slice(5), ini=e.fecha_inicio.slice(5), fin=(e.fecha_fin||e.fecha_inicio).slice(5); return md>=ini && md<=fin }
    return f>=e.fecha_inicio && f<=(e.fecha_fin||e.fecha_inicio)
  }
  const eventosDia = (f:string, tipo:string) => (eventos||[]).filter((e:any)=>e.tipo===tipo && enRango(e,f))
  const mesNum = fecha.slice(5,7)
  const cumplesMes = pacientes.filter((p:any)=>p.fecha_nacimiento && p.fecha_nacimiento.slice(5,7)===mesNum)
    .sort((a:any,b:any)=>a.fecha_nacimiento.slice(8,10).localeCompare(b.fecha_nacimiento.slice(8,10)))

  const StatCard = ({label,valor,color}:{label:string,valor:any,color?:string}) => (
    <div style={{background:'var(--bl)',borderRadius:8,padding:'8px 10px'}}>
      <div style={{fontSize:20,fontWeight:300,color:color||'var(--n)'}}>{valor}</div>
      <div style={{fontSize:9,color:'var(--grl)'}}>{label}</div>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 150px)'}}>
      {/* Buscador / filtro por paciente */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,flexWrap:'wrap',flexShrink:0}}>
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

      <div style={{flex:1,display:'flex',gap:10,minHeight:0}}>
        {/* Calendario */}
        <div style={{flex:1,border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden',background:'var(--w)',display:'flex',flexDirection:'column'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',background:'var(--bl)',borderBottom:'1px solid var(--bd)',flexShrink:0}}>
            {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>(
              <div key={d} style={{fontSize:9,fontWeight:600,color:'var(--grl)',padding:'7px',textAlign:'center',letterSpacing:.3}}>{d}</div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gridTemplateRows:`repeat(${nRows},1fr)`,flex:1,overflowY:'auto'}}>
            {padded.map((f,i)=>{
              if (!f) return <div key={i} style={{borderRight:'1px solid var(--bl)',borderBottom:'1px solid var(--bl)',background:'var(--bl)'}}/>
              const isH=f===hoy,d=new Date(f+'T12:00:00')
              const evFest = eventosDia(f,'festivo')[0]
              const fest = festivoDe(f) || (evFest ? { nombre: evFest.titulo || 'Festivo', tipo: 'local' as const } : null)
              const cierre = eventosDia(f,'cierre')[0]
              const vacas = eventosDia(f,'vacaciones')
              const cumples = cumplesDe(f)
              const cdAll=citas.filter((c:any)=>c.fecha===f&&c.estado!=='cancelada')
              const cd = pacSel ? cdAll.filter((c:any)=>c.paciente_id===pacSel.id) : cdAll
              const atenuar = !!pacSel && cd.length===0
              const clasesDia = new Set(cdAll.map((c:any)=>`${(c.hora||'').slice(0,5)}|${c.sala}`)).size
              const cap = clasesDia*MAX
              const pct = cap>0 ? Math.round(cdAll.length/cap*100) : 0
              const barCol = pct>=90 ? 'var(--amb)' : 'var(--g)'
              const onClickDia = () => {
                if (pacSel && cd.length>0) abrirMulti()
                else { setFecha(f); setVista('dia') }
              }
              return (
                <div key={f} onClick={onClickDia}
                  style={{minHeight:0,padding:'4px 5px',borderRight:'1px solid var(--bl)',borderBottom:'1px solid var(--bl)',cursor:'pointer',background:fest?tint(COLOR_FESTIVO[fest.tipo],0.08):cierre?'var(--bl)':(isH?'var(--gl)':'var(--w)'),opacity:atenuar?0.45:1,transition:'background .1s',overflowY:'auto',display:'flex',flexDirection:'column'}}
                  onMouseOver={e=>{if(!isH&&!fest&&!cierre&&!atenuar)(e.currentTarget as HTMLElement).style.background='rgba(90,150,158,.05)'}}
                  onMouseOut={e=>{if(!isH&&!fest)(e.currentTarget as HTMLElement).style.background=cierre?'var(--bl)':'var(--w)'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
                    <span style={{fontSize:12,fontWeight:isH?600:400,color:isH?'var(--g)':'var(--n)'}}>{d.getDate()}</span>
                    {cumples.length>0&&<span style={{display:'inline-flex',color:'#C486A0'}} title={'Cumpleaños: '+cumples.map((p:any)=>`${p.nombre} ${p.apellidos||''}`.trim()).join(', ')}><Ic name="corazon" size={12}/></span>}
                  </div>
                  {fest&&<div style={{marginTop:3,fontSize:8,fontWeight:600,color:COLOR_FESTIVO[fest.tipo],background:'var(--w)',border:`1px solid ${COLOR_FESTIVO[fest.tipo]}`,borderRadius:4,padding:'1px 5px',lineHeight:1.25,flexShrink:0}} title={`${fest.nombre} · ${LABEL_FESTIVO[fest.tipo]}`}>{fest.nombre}</div>}
                  {cierre&&<div style={{marginTop:3,fontSize:8,fontWeight:600,color:'var(--gr)',background:'var(--bm)',borderRadius:4,padding:'2px 6px',display:'flex',alignItems:'center',gap:4,flexShrink:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={cierre.titulo||'Cerrado'}><Ic name="pausa" size={10}/> {cierre.titulo||'Cerrado'}</div>}
                  {vacas.map((v:any,vi:number)=><div key={'v'+vi} style={{marginTop:3,fontSize:8,fontWeight:600,color:'#4A557E',background:'#E9ECF5',borderRadius:4,padding:'2px 6px',display:'flex',alignItems:'center',gap:4,flexShrink:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={'Vacaciones: '+(v.titulo||'')}><Ic name="sol" size={10}/> {v.titulo||'Vacaciones'}</div>)}
                  {cumples.length>0&&!pacSel&&<div style={{fontSize:8,color:'#9E4E74',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',flexShrink:0}}>{cumples[0].nombre}{cumples.length>1?` +${cumples.length-1}`:''}</div>}
                  {pacSel ? (
                    cd.slice(0,6).map((c:any)=>(
                      <div key={c.id} style={{fontSize:9,padding:'2px 6px',borderRadius:3,marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',background:tint(colorTipo(c.tipo),0.2),border:`1.5px solid ${colorTipo(c.tipo)}`,color:'var(--n)',flexShrink:0}}>
                        {c.hora?.slice(0,5)} · Sala {c.sala}
                      </div>
                    ))
                  ) : (!cierre && clasesDia>0) ? (
                    <div style={{marginTop:'auto',paddingTop:4,flexShrink:0}}>
                      <div style={{fontSize:9,color:'var(--grl)'}}>{clasesDia} clase{clasesDia>1?'s':''} · {cdAll.length}</div>
                      <div style={{height:4,borderRadius:2,background:'var(--bm)',marginTop:2,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,pct)}%`,background:barCol}}/></div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel de estadísticas del mes */}
        <div style={{width:240,flexShrink:0,border:'1px solid var(--bd)',borderRadius:'var(--rl)',background:'var(--w)',overflowY:'auto',padding:'12px 13px'}}>
          <div style={{fontSize:12,fontWeight:500,color:'var(--n)',marginBottom:10,textTransform:'capitalize'}}>Resumen · {mesLabel}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:12}}>
            <StatCard label="Personas" valor={personasMes}/>
            <StatCard label="Clases" valor={clasesMes}/>
            <StatCard label="Faltas" valor={faltasMes} color={faltasMes>0?'var(--red)':undefined}/>
            <StatCard label="Cancelaciones" valor={cancelMes} color={cancelMes>0?'#8A6410':undefined}/>
          </div>

          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:7}}>Reservas por tipo</div>
          {dataTipo.length===0 ? <div style={{fontSize:10,color:'var(--grl)',marginBottom:12}}>Sin citas este mes</div> : (
            <>
              <div style={{position:'relative',height:150,marginBottom:6}}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dataTipo} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={66} paddingAngle={2} stroke="none">
                      {dataTipo.map((d:any,i:number)=><Cell key={i} fill={d.color}/>)}
                    </Pie>
                    <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee',padding:'4px 8px'}} formatter={(v:any,n:any)=>[`${v} (${personasMes>0?Math.round(v/personasMes*100):0}%)`, n]}/>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                  <div style={{fontSize:22,fontWeight:300,color:'var(--n)',lineHeight:1}}>{personasMes}</div>
                  <div style={{fontSize:8,color:'var(--grl)'}}>reservas</div>
                </div>
              </div>
              <div>
                {dataTipo.map((d:any)=>{
                  const pct = personasMes>0 ? Math.round(d.value/personasMes*100) : 0
                  return (
                    <div key={d.tipo} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:10,padding:'3px 0'}}>
                      <span style={{display:'flex',alignItems:'center',gap:6,color:'var(--n)',minWidth:0}}><span style={{width:9,height:9,borderRadius:3,background:d.color,flexShrink:0}}/><span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{d.name}</span></span>
                      <span style={{color:'var(--gr)',flexShrink:0,marginLeft:8}}><b style={{fontWeight:600,color:'var(--n)'}}>{d.value}</b> · {pct}%</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {cumplesMes.length>0 && (
            <>
              <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',margin:'14px 0 7px',display:'flex',alignItems:'center',gap:5}}><Ic name="corazon" size={11} style={{color:'#C486A0'}}/> Cumpleaños del mes</div>
              {cumplesMes.map((p:any)=>{
                const dia = parseInt(p.fecha_nacimiento.slice(8,10))
                const esHoy = p.fecha_nacimiento.slice(5)===hoy.slice(5)
                return (
                  <div key={p.id} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0',borderBottom:'1px solid var(--bl)'}}>
                    <span style={{width:26,flexShrink:0,textAlign:'center',fontSize:11,fontWeight:600,color:esHoy?'#9E4E74':'var(--gr)'}}>{dia}</span>
                    <span style={{fontSize:11,color:'var(--n)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.nombre} {p.apellidos}</span>
                    {esHoy&&<span style={{marginLeft:'auto',fontSize:8,fontWeight:600,color:'#9E4E74',background:'#F7E5EE',borderRadius:99,padding:'2px 7px',flexShrink:0}}>hoy</span>}
                  </div>
                )
              })}
            </>
          )}

          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',margin:'14px 0 7px'}}>Cobros (activos)</div>
          <div style={{display:'flex',gap:7}}>
            <div style={{flex:1,background:'var(--ambl)',borderRadius:8,padding:'8px 10px'}}>
              <div style={{fontSize:18,fontWeight:300,color:'#8A6410'}}>{pagos.pendiente}</div>
              <div style={{fontSize:9,color:'#8A6410'}}>Pendientes</div>
            </div>
            <div style={{flex:1,background:'var(--redl)',borderRadius:8,padding:'8px 10px'}}>
              <div style={{fontSize:18,fontWeight:300,color:'var(--red)'}}>{pagos.impago}</div>
              <div style={{fontSize:9,color:'var(--red)'}}>Impagos</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
