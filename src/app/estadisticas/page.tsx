'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cargarBonosTipos, BonoTipo } from '@/lib/bonos'

export default function StatsPage() {
  const [loading, setLoading] = useState(true)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [citas, setCitas] = useState<any[]>([])
  const [bonos, setBonos] = useState<any[]>([])
  const [recuperaciones, setRecuperaciones] = useState<any[]>([])
  const [molestias, setMolestias] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [bonosOpts, setBonosOpts] = useState<BonoTipo[]>([])

  useEffect(() => { cargar(); cargarBonosTipos(false).then(setBonosOpts) }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: p },{ data: c },{ data: b },{ data: r },{ data: m },{ data: t }] = await Promise.all([
      supabase.from('pacientes').select('id,estado,tipo_clase,fecha_nacimiento').order('created_at'),
      supabase.from('citas').select('id,fecha,estado,paciente_id,pacientes(nombre,apellidos)').order('fecha',{ascending:false}).limit(500),
      supabase.from('bonos').select('*').eq('activo',true),
      supabase.from('recuperaciones').select('*').order('created_at',{ascending:false}),
      supabase.from('molestias').select('zona,activa').eq('activa',true),
      supabase.from('resultados_tests').select('resultado,tests(nombre)').order('created_at',{ascending:false}).limit(200),
    ])
    setPacientes(p||[]); setCitas(c||[]); setBonos(b||[])
    setRecuperaciones(r||[]); setMolestias(m||[]); setTests(t||[])
    setLoading(false)
  }

  if (loading) return <div className="loading">Cargando estadísticas...</div>

  // CÁLCULOS
  const activos = pacientes.filter(p=>p.estado==='activo').length
  const bajas = pacientes.filter(p=>p.estado==='baja').length
  const pausas = pacientes.filter(p=>p.estado==='pausa').length

  const realizadas = citas.filter(c=>c.estado==='realizada').length
  const faltas = citas.filter(c=>c.estado==='falta').length
  const canceladas = citas.filter(c=>c.estado==='cancelada').length
  const total = realizadas + faltas
  const pctAsistencia = total>0 ? Math.round((realizadas/total)*100) : 0

  const pagados = bonos.filter(b=>b.estado_pago==='pagado').length
  const pendientes = bonos.filter(b=>b.estado_pago==='pendiente').length
  const impagos = bonos.filter(b=>b.estado_pago==='impago').length

  const recPendientes = recuperaciones.filter(r=>r.estado==='pendiente').length
  const recRecuperadas = recuperaciones.filter(r=>r.estado==='recuperada').length

  // ASISTENCIA POR MES (últimos 6 meses)
  const mesesMap: Record<string,{r:number,f:number}> = {}
  citas.forEach(c=>{
    const mes = c.fecha?.slice(0,7); if(!mes) return
    if(!mesesMap[mes]) mesesMap[mes]={r:0,f:0}
    if(c.estado==='realizada') mesesMap[mes].r++
    if(c.estado==='falta') mesesMap[mes].f++
  })
  const meses = Object.entries(mesesMap).sort(([a],[b])=>a.localeCompare(b)).slice(-6)
  const maxMes = Math.max(...meses.map(([,v])=>v.r+v.f),1)

  // RANKING ASISTENCIA POR PACIENTE
  const asistenciaPac: Record<string,{r:number,f:number}> = {}
  citas.forEach(c=>{
    if(!asistenciaPac[c.paciente_id]) asistenciaPac[c.paciente_id]={r:0,f:0}
    if(c.estado==='realizada') asistenciaPac[c.paciente_id].r++
    if(c.estado==='falta') asistenciaPac[c.paciente_id].f++
  })
  const rankingFaltas = Object.entries(asistenciaPac)
    .filter(([,v])=>v.f>0)
    .sort(([,a],[,b])=>b.f-a.f)
    .slice(0,5)

  // MOLESTIAS MÁS COMUNES
  const zonasMap: Record<string,number> = {}
  molestias.forEach(m=>{
    const zona = m.zona?.toLowerCase().split(' ')[0] || 'otra'
    zonasMap[zona] = (zonasMap[zona]||0)+1
  })
  const zonas = Object.entries(zonasMap).sort(([,a],[,b])=>b-a).slice(0,5)

  // TESTS MÁS FRECUENTES
  const testsMap: Record<string,{pos:number,neg:number}> = {}
  tests.forEach((t:any)=>{
    const nombre = t.tests?.nombre||'Desconocido'
    if(!testsMap[nombre]) testsMap[nombre]={pos:0,neg:0}
    if(t.resultado==='positivo') testsMap[nombre].pos++
    else testsMap[nombre].neg++
  })
  const testsRanking = Object.entries(testsMap).sort(([,a],[,b])=>(b.pos+b.neg)-(a.pos+a.neg)).slice(0,5)

  // BONOS POR TIPO
  const bonosMap: Record<string,number> = {}
  bonos.forEach(b=>{ bonosMap[b.tipo]=(bonosMap[b.tipo]||0)+1 })
  const bonoLabel: Record<string,string> = Object.fromEntries(bonosOpts.map(b=>[b.id,b.nombre]))

  return (
    <div>
      {/* RESUMEN GLOBAL */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
        {[
          ['Pacientes activos',activos,'var(--g)'],
          ['% Asistencia',pctAsistencia+'%','var(--g)'],
          ['Faltas pendientes',recPendientes,'var(--amb)'],
          ['Impagos',impagos,'var(--red)'],
        ].map(([l,v,c])=>(
          <div key={String(l)} style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:28,fontWeight:300,color:c as string}}>{v}</div>
            <div style={{fontSize:9,color:'var(--grl)',marginTop:3}}>{l}</div>
          </div>
        ))}
      </div>

      <div className="g2" style={{marginBottom:14}}>
        {/* ESTADO PACIENTES */}
        <div className="card">
          <div className="card-title">Estado de pacientes</div>
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:10}}>
            <svg viewBox="0 0 36 36" width="90" height="90" style={{transform:'rotate(-90deg)',flexShrink:0}}>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bm)" strokeWidth="3"/>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--g)" strokeWidth="3"
                strokeDasharray={`${Math.round((activos/pacientes.length)*100)} ${100-Math.round((activos/pacientes.length)*100)}`}
                strokeLinecap="round"/>
            </svg>
            <div style={{flex:1}}>
              {[['Activos',activos,'var(--g)'],['Pausas',pausas,'var(--amb)'],['Bajas',bajas,'var(--red)']].map(([l,v,c])=>(
                <div key={String(l)} style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:c as string,flexShrink:0}}/>
                  <span style={{fontSize:10,color:'var(--n)',flex:1}}>{l}</span>
                  <span style={{fontSize:12,fontWeight:400,color:c as string}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{borderTop:'1px solid var(--bl)',paddingTop:8}}>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>Por tipo de clase</div>
            {['entrenamiento','pilates','rehabilitacion'].map(tipo=>{
              const n = pacientes.filter(p=>p.tipo_clase===tipo&&p.estado==='activo').length
              const pct = activos>0?Math.round((n/activos)*100):0
              const label: Record<string,string> = {entrenamiento:'🏋 Entrenamiento',pilates:'🧘 Pilates',rehabilitacion:'🏥 Rehabilitación'}
              return (
                <div key={tipo} style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                  <span style={{fontSize:9,color:'var(--n)',width:110,flexShrink:0}}>{label[tipo]}</span>
                  <div style={{flex:1,height:5,background:'var(--bm)',borderRadius:3,overflow:'hidden'}}>
                    <div style={{height:'100%',background:'var(--g)',borderRadius:3,width:pct+'%'}}/>
                  </div>
                  <span style={{fontSize:9,fontWeight:500,color:'var(--n)',width:20,textAlign:'right'}}>{n}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* PAGOS */}
        <div className="card">
          <div className="card-title">Estado de pagos · mes actual</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
            {[['✓ Pagados',pagados,'var(--g)','var(--gl)'],['⏳ Pendientes',pendientes,'#7A5800','var(--ambl)'],['⚠ Impagos',impagos,'var(--red)','var(--redl)']].map(([l,v,c,bg])=>(
              <div key={String(l)} style={{background:bg as string,borderRadius:6,padding:'8px',textAlign:'center'}}>
                <div style={{fontSize:22,fontWeight:300,color:c as string}}>{v}</div>
                <div style={{fontSize:8,color:c as string,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{borderTop:'1px solid var(--bl)',paddingTop:8}}>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>Distribución de bonos</div>
            {Object.entries(bonosMap).map(([tipo,n])=>{
              const pct = bonos.length>0?Math.round((n/bonos.length)*100):0
              return (
                <div key={tipo} style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                  <span style={{fontSize:9,color:'var(--n)',width:80,flexShrink:0}}>{bonoLabel[tipo]||tipo}</span>
                  <div style={{flex:1,height:5,background:'var(--bm)',borderRadius:3,overflow:'hidden'}}>
                    <div style={{height:'100%',background:'var(--g)',borderRadius:3,width:pct+'%'}}/>
                  </div>
                  <span style={{fontSize:9,fontWeight:500,color:'var(--n)',width:20,textAlign:'right'}}>{n}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ASISTENCIA POR MES */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-title">Asistencia global por mes</div>
        {meses.length===0 ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin datos suficientes</div> : (
          <div style={{display:'flex',alignItems:'flex-end',gap:8,height:100}}>
            {meses.map(([mes,datos])=>{
              const pct = datos.r+datos.f>0?Math.round((datos.r/(datos.r+datos.f))*100):0
              const hR = Math.round((datos.r/maxMes)*80)
              const hF = Math.round((datos.f/maxMes)*80)
              const [,m] = mes.split('-')
              const nm = new Date(2024,parseInt(m)-1,1).toLocaleDateString('es-ES',{month:'short'})
              return (
                <div key={mes} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <div style={{fontSize:8,color:'var(--grl)',marginBottom:2}}>{pct}%</div>
                  <div style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:80,gap:1}}>
                    {datos.f>0&&<div style={{width:'70%',height:hF,background:'var(--red)',borderRadius:'2px 2px 0 0',opacity:.7}}/>}
                    <div style={{width:'70%',height:hR,background:'var(--g)',borderRadius:'2px 2px 0 0'}}/>
                  </div>
                  <div style={{fontSize:8,color:'var(--grl)',textTransform:'capitalize'}}>{nm}</div>
                </div>
              )
            })}
          </div>
        )}
        <div style={{display:'flex',gap:12,marginTop:8}}>
          <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,background:'var(--g)',borderRadius:1}}/><span style={{fontSize:8,color:'var(--grl)'}}>Realizadas</span></div>
          <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,background:'var(--red)',borderRadius:1,opacity:.7}}/><span style={{fontSize:8,color:'var(--grl)'}}>Faltas</span></div>
        </div>
      </div>

      <div className="g2" style={{marginBottom:14}}>
        {/* RANKING FALTAS */}
        <div className="card">
          <div className="card-title">Pacientes con más faltas</div>
          {rankingFaltas.length===0 ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin faltas registradas</div> : (
            rankingFaltas.map(([pacId,datos],i)=>{
              const pac = pacientes.find(p=>p.id===pacId)
              const pct = datos.r+datos.f>0?Math.round((datos.r/(datos.r+datos.f))*100):0
              return (
                <div key={pacId} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid var(--bl)'}}>
                  <div style={{width:18,height:18,borderRadius:'50%',background:'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:600,color:'var(--gr)',flexShrink:0}}>{i+1}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,fontWeight:400,color:'var(--n)'}}>{(()=>{const c=citas.find((ci:any)=>ci.paciente_id===pacId);return c?.pacientes?`${c.pacientes.nombre} ${c.pacientes.apellidos}`:'Paciente'})()}</div>
                    <div style={{fontSize:8,color:'var(--grl)'}}>{pct}% asistencia</div>
                  </div>
                  <span style={{fontSize:12,fontWeight:300,color:'var(--red)'}}>{datos.f}</span>
                  <span style={{fontSize:8,color:'var(--grl)'}}>faltas</span>
                </div>
              )
            })
          )}
          <div style={{marginTop:8,padding:'6px 9px',background:'var(--gl)',borderRadius:5,fontSize:9,color:'var(--gd)'}}>
            ✓ {recRecuperadas} faltas recuperadas · {recPendientes} pendientes
          </div>
        </div>

        {/* MOLESTIAS Y TESTS */}
        <div>
          <div className="card" style={{marginBottom:8}}>
            <div className="card-title">Molestias activas más frecuentes</div>
            {zonas.length===0 ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin molestias activas</div> : (
              zonas.map(([zona,n])=>{
                const maxZ = zonas[0][1]
                const pct = Math.round((n/maxZ)*100)
                return (
                  <div key={zona} style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                    <span style={{fontSize:10,color:'var(--n)',width:80,flexShrink:0,textTransform:'capitalize'}}>{zona}</span>
                    <div style={{flex:1,height:5,background:'var(--bm)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',background:'var(--red)',borderRadius:3,width:pct+'%',opacity:.7}}/>
                    </div>
                    <span style={{fontSize:9,fontWeight:500,color:'var(--red)',width:16,textAlign:'right'}}>{n}</span>
                  </div>
                )
              })
            )}
          </div>
          <div className="card">
            <div className="card-title">Tests más realizados</div>
            {testsRanking.length===0 ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin tests registrados</div> : (
              testsRanking.map(([nombre,datos])=>(
                <div key={nombre} style={{marginBottom:6,padding:'5px 8px',background:'var(--bl)',borderRadius:5}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                    <span style={{fontSize:10,fontWeight:400,color:'var(--n)',flex:1}}>{nombre}</span>
                    <span style={{fontSize:8,padding:'1px 6px',borderRadius:99,background:'var(--redl)',color:'var(--red)'}}>{datos.pos} +</span>
                    <span style={{fontSize:8,padding:'1px 6px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{datos.neg} −</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
