'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'

const PAL = { g:'#5A969E', gd:'#3E7179', bg:'#EBF4F5', red:'#C25B5B', amb:'#D4A24E' }
const GREY='#9CA3AF'
const DIAS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
const MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

type Tab = 'actividad' | 'pacientes' | 'clinico'

export default function StatsPage() {
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('actividad')
  const [ventana, setVentana] = useState<'prev'|'next'>('next')
  const [pacientes, setPacientes] = useState<any[]>([])
  const [citas, setCitas] = useState<any[]>([])
  const [recuperaciones, setRecuperaciones] = useState<any[]>([])
  const [molestias, setMolestias] = useState<any[]>([])
  const [patologias, setPatologias] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [objetivos, setObjetivos] = useState<any[]>([])
  const [pacObj, setPacObj] = useState<any[]>([])
  const [sesiones, setSesiones] = useState<any[]>([])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: p },{ data: c },{ data: r },{ data: m },{ data: pat },{ data: t },{ data: o },{ data: po },{ data: s }] = await Promise.all([
      supabase.from('pacientes').select('id,estado,tipo_clase,fecha_nacimiento,created_at').order('created_at'),
      supabase.from('citas').select('id,fecha,hora,estado,tipo,paciente_id,pacientes(nombre,apellidos)').order('fecha',{ascending:false}).limit(3000),
      supabase.from('recuperaciones').select('*').order('created_at',{ascending:false}),
      supabase.from('molestias').select('zona,activa,eva').eq('activa',true),
      supabase.from('patologias').select('nombre,estado'),
      supabase.from('resultados_tests').select('resultado,tests(nombre)').order('created_at',{ascending:false}).limit(400),
      supabase.from('objetivos').select('id,nombre,activo'),
      supabase.from('pacientes_objetivos').select('paciente_id,objetivo_id'),
      supabase.from('sesiones').select('id,created_at,estado').order('created_at',{ascending:false}).limit(2000),
    ])
    setPacientes(p||[]); setCitas(c||[]); setRecuperaciones(r||[])
    setMolestias(m||[]); setPatologias(pat||[]); setTests(t||[])
    setObjetivos(o||[]); setPacObj(po||[]); setSesiones(s||[])
    setLoading(false)
  }

  if (loading) return <div className="loading">Cargando estadísticas...</div>

  // ===== CÁLCULOS ACTIVIDAD =====
  const pasadas = citas.filter(c=>['realizada','falta','cancelada'].includes(c.estado))
  const realizadas = citas.filter(c=>c.estado==='realizada').length
  const faltas = citas.filter(c=>c.estado==='falta').length
  const totalAsist = realizadas + faltas
  const pctAsistencia = totalAsist>0 ? Math.round((realizadas/totalAsist)*100) : 0
  const recPendientes = recuperaciones.filter(r=>r.estado==='pendiente').length
  const recRecuperadas = recuperaciones.filter(r=>r.estado==='recuperada').length

  const ahora = new Date()
  const mesActual = ahora.toISOString().slice(0,7)
  const sesionesMes = citas.filter(c=>c.estado==='realizada'&&c.fecha?.slice(0,7)===mesActual).length

  // Asistencia por mes (últimos 6, solo pasadas)
  const mesesMap: Record<string,{r:number,f:number,c:number}> = {}
  pasadas.forEach(c=>{
    const mes = c.fecha?.slice(0,7); if(!mes) return
    if(!mesesMap[mes]) mesesMap[mes]={r:0,f:0,c:0}
    if(c.estado==='realizada') mesesMap[mes].r++
    if(c.estado==='falta') mesesMap[mes].f++
    if(c.estado==='cancelada') mesesMap[mes].c++
  })
  const dataMeses = Object.entries(mesesMap).sort(([a],[b])=>a.localeCompare(b)).slice(-6).map(([mes,v])=>{
    const [,m]=mes.split('-')
    return { mes: MESES_ES[parseInt(m)-1], Realizadas:v.r, Faltas:v.f, Canceladas:v.c }
  })

  // Ventana de ocupación: últimas 4 sem (prev) o próximas 4 sem (next)
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const finVentana = new Date(hoy)
  if(ventana==='next') finVentana.setDate(hoy.getDate()+28)
  else finVentana.setDate(hoy.getDate()-28)
  const [vIni,vFin] = ventana==='next' ? [hoy,finVentana] : [finVentana,hoy]
  const enVentana = citas.filter(c=>{
    if(c.estado==='cancelada'||!c.fecha) return false
    const d = new Date(c.fecha+'T00:00:00')
    return d>=vIni && d<=vFin
  })
  const SEMANAS = 4 // dividimos por 4 semanas para dar media semanal

  // Ocupación por día de la semana (media semanal en la ventana)
  const diaMap = [0,0,0,0,0,0,0]
  enVentana.forEach(c=>{
    const d = new Date(c.fecha+'T00:00:00').getDay()
    diaMap[d===0?6:d-1]++
  })
  const dataDias = DIAS.map((d,i)=>({ dia:d, Citas:Math.round((diaMap[i]/SEMANAS)*10)/10 }))

  // Ocupación por franja horaria (media semanal en la ventana)
  const horaMap: Record<string,number> = {}
  enVentana.filter(c=>c.hora).forEach(c=>{
    const h = c.hora.slice(0,2)+':00'
    horaMap[h]=(horaMap[h]||0)+1
  })
  const dataHoras = Object.entries(horaMap).sort(([a],[b])=>a.localeCompare(b)).map(([h,n])=>({ hora:h, Citas:Math.round((n/SEMANAS)*10)/10 }))

  // Ranking faltas
  const asistenciaPac: Record<string,{r:number,f:number}> = {}
  pasadas.forEach(c=>{
    if(!asistenciaPac[c.paciente_id]) asistenciaPac[c.paciente_id]={r:0,f:0}
    if(c.estado==='realizada') asistenciaPac[c.paciente_id].r++
    if(c.estado==='falta') asistenciaPac[c.paciente_id].f++
  })
  const rankingFaltas = Object.entries(asistenciaPac).filter(([,v])=>v.f>0).sort(([,a],[,b])=>b.f-a.f).slice(0,5)

  const KPI = ({label,value,color}:{label:string,value:any,color:string}) => (
    <div style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'12px',textAlign:'center'}}>
      <div style={{fontSize:28,fontWeight:300,color}}>{value}</div>
      <div style={{fontSize:9,color:'var(--grl)',marginTop:3}}>{label}</div>
    </div>
  )

  return (
    <div>
      {/* PESTAÑAS */}
      <div style={{display:'flex',gap:6,marginBottom:14,borderBottom:'1px solid var(--bd)'}}>
        {([['actividad','📅 Actividad'],['pacientes','👥 Pacientes'],['clinico','🩺 Clínico']] as [Tab,string][]).map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            background:'none',border:'none',padding:'8px 14px',fontSize:12,cursor:'pointer',
            color: tab===id?PAL.gd:'var(--grl)', fontWeight: tab===id?600:400,
            borderBottom: tab===id?`2px solid ${PAL.g}`:'2px solid transparent', marginBottom:-1
          }}>{label}</button>
        ))}
      </div>

      {tab==='actividad' && (
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
            <KPI label="Sesiones este mes" value={sesionesMes} color={PAL.g}/>
            <KPI label="% Asistencia global" value={pctAsistencia+'%'} color={PAL.gd}/>
            <KPI label="Faltas totales" value={faltas} color={PAL.red}/>
            <KPI label="Recuperaciones pendientes" value={recPendientes} color={PAL.amb}/>
          </div>

          <div className="card" style={{marginBottom:14}}>
            <div className="card-title">Asistencia por mes</div>
            {dataMeses.length===0 ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin datos suficientes</div> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dataMeses} margin={{top:5,right:10,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="gRe" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PAL.g} stopOpacity={0.35}/>
                      <stop offset="100%" stopColor={PAL.g} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                  <XAxis dataKey="mes" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}}/>
                  <Legend wrapperStyle={{fontSize:11}}/>
                  <Area type="monotone" dataKey="Realizadas" stroke={PAL.g} strokeWidth={2.5} fill="url(#gRe)"/>
                  <Area type="monotone" dataKey="Faltas" stroke={PAL.red} strokeWidth={1.5} fill="none" strokeDasharray="4 3"/>
                  <Area type="monotone" dataKey="Canceladas" stroke={PAL.amb} strokeWidth={1.5} fill="none" strokeDasharray="4 3"/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase'}}>Ocupación · media semanal</div>
            <div style={{display:'flex',gap:2,marginLeft:'auto',background:'var(--bm)',borderRadius:6,padding:2}}>
              {([['prev','Últimas 4 sem'],['next','Próximas 4 sem']] as ['prev'|'next',string][]).map(([id,lbl])=>(
                <button key={id} onClick={()=>setVentana(id)} style={{
                  background: ventana===id?'var(--w)':'transparent', border:'none', borderRadius:4,
                  padding:'4px 10px', fontSize:10, cursor:'pointer',
                  fontWeight: ventana===id?600:400, color: ventana===id?PAL.gd:'var(--grl)',
                  boxShadow: ventana===id?'0 1px 2px rgba(0,0,0,.08)':'none'
                }}>{lbl}</button>
              ))}
            </div>
          </div>
          <div className="g2" style={{marginBottom:14}}>
            <div className="card">
              <div className="card-title">Citas por día (media/semana)</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dataDias} margin={{top:5,right:10,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                  <XAxis dataKey="dia" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}} cursor={{fill:'#F7F7F7'}}/>
                  <Bar dataKey="Citas" fill={PAL.g} radius={[6,6,0,0]} barSize={26}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <div className="card-title">Citas por franja horaria (media/semana)</div>
              {dataHoras.length===0 ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin horas registradas</div> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dataHoras} margin={{top:5,right:10,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                    <XAxis dataKey="hora" tick={{fontSize:9,fill:GREY}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}} cursor={{fill:'#F7F7F7'}}/>
                    <Bar dataKey="Citas" fill={PAL.gd} radius={[6,6,0,0]} barSize={18}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Pacientes con más faltas</div>
            {rankingFaltas.length===0 ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin faltas registradas</div> : (
              rankingFaltas.map(([pacId,datos],i)=>{
                const pct = datos.r+datos.f>0?Math.round((datos.r/(datos.r+datos.f))*100):0
                const c = citas.find((ci:any)=>ci.paciente_id===pacId)
                const nombre = c?.pacientes?`${c.pacientes.nombre} ${c.pacientes.apellidos}`:'Paciente'
                return (
                  <div key={pacId} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid var(--bl)'}}>
                    <div style={{width:18,height:18,borderRadius:'50%',background:'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:600,color:'var(--gr)',flexShrink:0}}>{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,fontWeight:400,color:'var(--n)'}}>{nombre}</div>
                      <div style={{fontSize:8,color:'var(--grl)'}}>{pct}% asistencia</div>
                    </div>
                    <span style={{fontSize:12,fontWeight:300,color:PAL.red}}>{datos.f}</span>
                    <span style={{fontSize:8,color:'var(--grl)'}}>faltas</span>
                  </div>
                )
              })
            )}
            <div style={{marginTop:8,padding:'6px 9px',background:'var(--gl)',borderRadius:5,fontSize:9,color:'var(--gd)'}}>
              ✓ {recRecuperadas} recuperadas · {recPendientes} pendientes
            </div>
          </div>
        </div>
      )}

      {tab==='pacientes' && (
        <div className="card"><div style={{fontSize:11,color:'var(--grl)',padding:20,textAlign:'center'}}>Pestaña Pacientes — próximo bloque</div></div>
      )}

      {tab==='clinico' && (
        <div className="card"><div style={{fontSize:11,color:'var(--grl)',padding:20,textAlign:'center'}}>Pestaña Clínico — próximo bloque</div></div>
      )}
    </div>
  )
}
