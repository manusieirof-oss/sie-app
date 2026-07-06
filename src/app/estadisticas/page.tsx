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

  // ===== CÁLCULOS PACIENTES =====
  const activos = pacientes.filter(p=>p.estado==='activo').length
  const enPausa = pacientes.filter(p=>p.estado==='pausa').length
  const bajas = pacientes.filter(p=>p.estado==='baja').length
  const totalPac = pacientes.length

  const altasMes = pacientes.filter(p=>p.created_at?.slice(0,7)===mesActual).length

  // Edad media (solo con fecha_nacimiento)
  const edades = pacientes.map(p=>{
    if(!p.fecha_nacimiento) return null
    const n = new Date(p.fecha_nacimiento)
    let e = ahora.getFullYear()-n.getFullYear()
    const md = ahora.getMonth()-n.getMonth()
    if(md<0 || (md===0 && ahora.getDate()<n.getDate())) e--
    return e
  }).filter((e):e is number=>e!=null && e>0 && e<120)
  const edadMedia = edades.length>0 ? Math.round(edades.reduce((a,b)=>a+b,0)/edades.length) : null

  // Altas nuevas por mes (últimos 6)
  const altasMap: Record<string,number> = {}
  pacientes.forEach(p=>{
    const mes=p.created_at?.slice(0,7); if(!mes) return
    altasMap[mes]=(altasMap[mes]||0)+1
  })
  const dataAltas = Object.entries(altasMap).sort(([a],[b])=>a.localeCompare(b)).slice(-6).map(([mes,n])=>{
    const [,m]=mes.split('-')
    return { mes: MESES_ES[parseInt(m)-1], Altas:n }
  })

  // Distribución por tipo de clase (solo activos)
  const claseMap: Record<string,number> = {}
  pacientes.filter(p=>p.estado==='activo').forEach(p=>{
    const t=p.tipo_clase||'sin_definir'
    claseMap[t]=(claseMap[t]||0)+1
  })
  const CLASE_LABEL: Record<string,string> = {entrenamiento:'🏋 Entrenamiento',pilates:'🧘 Pilates',rehabilitacion:'🏥 Rehabilitación',sin_definir:'Sin definir'}
  const dataClases = Object.entries(claseMap).sort(([,a],[,b])=>b-a).map(([t,n])=>({ clase:CLASE_LABEL[t]||t, n }))

  // Patologías más frecuentes (top 8)
  const patMap: Record<string,number> = {}
  patologias.forEach(p=>{
    const nom=(p.nombre||'').trim(); if(!nom) return
    patMap[nom]=(patMap[nom]||0)+1
  })
  const dataPat = Object.entries(patMap).sort(([,a],[,b])=>b-a).slice(0,8).map(([nombre,n])=>({ nombre, n }))

  const estadoDonut = [
    {label:'Activos', n:activos, color:PAL.g},
    {label:'Pausa', n:enPausa, color:PAL.amb},
    {label:'Bajas', n:bajas, color:PAL.red},
  ]
  const pctActivos = totalPac>0 ? Math.round((activos/totalPac)*100) : 0

  // ===== CÁLCULOS CLÍNICO =====
  // Molestias por zona (top 8)
  const zonaMap: Record<string,number> = {}
  molestias.forEach(m=>{
    const z=(m.zona||'').toLowerCase().split(' ')[0]||'otra'
    zonaMap[z]=(zonaMap[z]||0)+1
  })
  const dataZonas = Object.entries(zonaMap).sort(([,a],[,b])=>b-a).slice(0,8).map(([zona,n])=>({ zona:zona.charAt(0).toUpperCase()+zona.slice(1), n }))

  // Tests por tipo (positivo/negativo)
  const testMap: Record<string,{pos:number,neg:number}> = {}
  tests.forEach((t:any)=>{
    const nom=t.tests?.nombre||'Desconocido'
    if(!testMap[nom]) testMap[nom]={pos:0,neg:0}
    if(t.resultado==='positivo') testMap[nom].pos++
    else testMap[nom].neg++
  })
  const dataTests = Object.entries(testMap).sort(([,a],[,b])=>(b.pos+b.neg)-(a.pos+a.neg)).slice(0,8).map(([nombre,v])=>({ nombre, Positivos:v.pos, Negativos:v.neg }))
  const totalTests = tests.length
  const totalPos = tests.filter((t:any)=>t.resultado==='positivo').length

  // Objetivos: activos vs total, y asignaciones a pacientes
  const objActivos = objetivos.filter(o=>o.activo).length
  const objTotal = objetivos.length
  const asignaciones = pacObj.length
  const objConteo: Record<string,number> = {}
  pacObj.forEach(po=>{ objConteo[po.objetivo_id]=(objConteo[po.objetivo_id]||0)+1 })
  const objNombre: Record<string,string> = Object.fromEntries(objetivos.map(o=>[o.id,o.nombre]))
  const dataObj = Object.entries(objConteo).sort(([,a],[,b])=>b-a).slice(0,8).map(([id,n])=>({ nombre:objNombre[id]||'—', n }))

  // Sesiones realizadas por mes (solo con paciente, últimos 6)
  const sesMap: Record<string,number> = {}
  sesiones.forEach(se=>{
    const mes=se.created_at?.slice(0,7); if(!mes) return
    sesMap[mes]=(sesMap[mes]||0)+1
  })
  const dataSes = Object.entries(sesMap).sort(([a],[b])=>a.localeCompare(b)).slice(-6).map(([mes,n])=>{
    const [,m]=mes.split('-')
    return { mes: MESES_ES[parseInt(m)-1], Sesiones:n }
  })

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
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
            <KPI label="Pacientes activos" value={activos} color={PAL.g}/>
            <KPI label="Altas este mes" value={altasMes} color={PAL.gd}/>
            <KPI label="Edad media" value={edadMedia!=null?edadMedia+' años':'—'} color={PAL.gd}/>
            <KPI label="Total en ficha" value={totalPac} color={GREY}/>
          </div>

          <div className="g2" style={{marginBottom:14}}>
            <div className="card">
              <div className="card-title">Estado de pacientes</div>
              <div style={{display:'flex',alignItems:'center',gap:16}}>
                <svg viewBox="0 0 36 36" width="96" height="96" style={{flexShrink:0}}>
                  {(()=>{
                    let acc=0
                    return estadoDonut.map((seg,i)=>{
                      const pct = totalPac>0?(seg.n/totalPac)*100:0
                      const dash=`${pct} ${100-pct}`
                      const off=25-acc
                      acc+=pct
                      return <circle key={i} cx="18" cy="18" r="15.9" fill="none" stroke={seg.color} strokeWidth="3.4" strokeDasharray={dash} strokeDashoffset={off}/>
                    })
                  })()}
                  <text x="18" y="17" textAnchor="middle" style={{fontSize:6,fontWeight:600,fill:PAL.gd}}>{pctActivos}%</text>
                  <text x="18" y="22.5" textAnchor="middle" style={{fontSize:2.6,fill:GREY}}>activos</text>
                </svg>
                <div style={{flex:1}}>
                  {estadoDonut.map(seg=>(
                    <div key={seg.label} style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:seg.color,flexShrink:0}}/>
                      <span style={{fontSize:11,color:'var(--n)',flex:1}}>{seg.label}</span>
                      <span style={{fontSize:13,fontWeight:400,color:seg.color}}>{seg.n}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Por tipo de clase (activos)</div>
              {dataClases.length===0 ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin datos</div> : (
                <ResponsiveContainer width="100%" height={Math.max(120,dataClases.length*40)}>
                  <BarChart data={dataClases} layout="vertical" margin={{top:0,right:24,left:10,bottom:0}}>
                    <XAxis type="number" hide allowDecimals={false}/>
                    <YAxis type="category" dataKey="clase" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false} width={110}/>
                    <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}} cursor={{fill:'#F7F7F7'}}/>
                    <Bar dataKey="n" fill={PAL.g} radius={[0,6,6,0]} barSize={20}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card" style={{marginBottom:14}}>
            <div className="card-title">Altas nuevas por mes</div>
            {dataAltas.length===0 ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin datos suficientes</div> : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dataAltas} margin={{top:5,right:10,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="gAl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PAL.gd} stopOpacity={0.35}/>
                      <stop offset="100%" stopColor={PAL.gd} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                  <XAxis dataKey="mes" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}}/>
                  <Area type="monotone" dataKey="Altas" stroke={PAL.gd} strokeWidth={2.5} fill="url(#gAl)"/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <div className="card-title">Patologías más frecuentes</div>
            {dataPat.length===0 ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin patologías registradas</div> : (
              <ResponsiveContainer width="100%" height={Math.max(120,dataPat.length*36)}>
                <BarChart data={dataPat} layout="vertical" margin={{top:0,right:24,left:10,bottom:0}}>
                  <XAxis type="number" hide allowDecimals={false}/>
                  <YAxis type="category" dataKey="nombre" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false} width={130}/>
                  <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}} cursor={{fill:'#F7F7F7'}}/>
                  <Bar dataKey="n" fill={PAL.red} radius={[0,6,6,0]} barSize={16}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {tab==='clinico' && (
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
            <KPI label="Objetivos activos" value={objActivos} color={PAL.g}/>
            <KPI label="Asignados a pacientes" value={asignaciones} color={PAL.gd}/>
            <KPI label="Tests realizados" value={totalTests} color={PAL.gd}/>
            <KPI label="Tests positivos" value={totalPos} color={PAL.red}/>
          </div>

          <div className="g2" style={{marginBottom:14}}>
            <div className="card">
              <div className="card-title">Molestias activas por zona</div>
              {dataZonas.length===0 ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin molestias activas</div> : (
                <ResponsiveContainer width="100%" height={Math.max(120,dataZonas.length*34)}>
                  <BarChart data={dataZonas} layout="vertical" margin={{top:0,right:24,left:10,bottom:0}}>
                    <XAxis type="number" hide allowDecimals={false}/>
                    <YAxis type="category" dataKey="zona" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false} width={90}/>
                    <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}} cursor={{fill:'#F7F7F7'}}/>
                    <Bar dataKey="n" fill={PAL.red} radius={[0,6,6,0]} barSize={15}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <div className="card-title">Objetivos más asignados</div>
              {dataObj.length===0 ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin objetivos asignados</div> : (
                <ResponsiveContainer width="100%" height={Math.max(120,dataObj.length*34)}>
                  <BarChart data={dataObj} layout="vertical" margin={{top:0,right:24,left:10,bottom:0}}>
                    <XAxis type="number" hide allowDecimals={false}/>
                    <YAxis type="category" dataKey="nombre" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false} width={120}/>
                    <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}} cursor={{fill:'#F7F7F7'}}/>
                    <Bar dataKey="n" fill={PAL.g} radius={[0,6,6,0]} barSize={15}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card" style={{marginBottom:14}}>
            <div className="card-title">Tests por tipo · positivos vs negativos</div>
            {dataTests.length===0 ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin tests registrados</div> : (
              <ResponsiveContainer width="100%" height={Math.max(140,dataTests.length*38)}>
                <BarChart data={dataTests} layout="vertical" margin={{top:0,right:24,left:10,bottom:0}}>
                  <XAxis type="number" hide allowDecimals={false}/>
                  <YAxis type="category" dataKey="nombre" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false} width={130}/>
                  <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}} cursor={{fill:'#F7F7F7'}}/>
                  <Legend wrapperStyle={{fontSize:11}}/>
                  <Bar dataKey="Positivos" stackId="t" fill={PAL.red} radius={[0,0,0,0]} barSize={16}/>
                  <Bar dataKey="Negativos" stackId="t" fill={PAL.g} radius={[0,6,6,0]} barSize={16}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <div className="card-title">Sesiones registradas por mes</div>
            {dataSes.length===0 ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin sesiones registradas</div> : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dataSes} margin={{top:5,right:10,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="gSe" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PAL.g} stopOpacity={0.35}/>
                      <stop offset="100%" stopColor={PAL.g} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                  <XAxis dataKey="mes" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}}/>
                  <Area type="monotone" dataKey="Sesiones" stroke={PAL.g} strokeWidth={2.5} fill="url(#gSe)"/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
