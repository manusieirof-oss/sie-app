'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function ResultadosPage() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [pacSelId, setPacSelId] = useState('')
  const [escalas, setEscalas] = useState<any[]>([])
  const [molestias, setMolestias] = useState<any[]>([])
  const [sesiones, setSesiones] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('pacientes').select('id,nombre,apellidos').eq('estado','activo').order('nombre').then(({data})=>setPacientes(data||[]))
  }, [])

  useEffect(() => { if(pacSelId) cargarPaciente() }, [pacSelId])

  async function cargarPaciente() {
    setLoading(true)
    const [{ data: e }, { data: m }, { data: s }] = await Promise.all([
      supabase.from('escalas').select('*').eq('paciente_id',pacSelId).order('fecha').limit(10),
      supabase.from('molestias').select('*').eq('paciente_id',pacSelId),
      supabase.from('sesiones').select('*').eq('paciente_id',pacSelId).order('created_at').limit(10),
    ])
    setEscalas(e||[]); setMolestias(m||[]); setSesiones(s||[])
    setLoading(false)
  }

  const pacSel = pacientes.find(p=>p.id===pacSelId)
  const sesRealizadas = sesiones.filter(s=>s.estado==='realizada').length
  const molActivas = molestias.filter(m=>m.activa).length

  return (
    <>
      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:12,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'9px 13px'}}>
        <label style={{fontSize:10,color:'var(--grl)',fontWeight:500,letterSpacing:.4,textTransform:'uppercase'}}>Paciente</label>
        <select className="input" style={{flex:1}} value={pacSelId} onChange={e=>setPacSelId(e.target.value)}>
          <option value="">Seleccionar paciente para ver sus resultados...</option>
          {pacientes.map(p=><option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>)}
        </select>
      </div>

      {!pacSelId && (
        <div style={{textAlign:'center',padding:60,color:'var(--grl)',fontSize:11}}>
          Selecciona un paciente para ver sus resultados y evolución
        </div>
      )}

      {pacSelId && loading && <div className="loading">Cargando datos...</div>}

      {pacSelId && !loading && (
        <>
          <div className="g4" style={{marginBottom:12}}>
            <div className="stat-card"><div className="stat-val">{sesiones.length}</div><div className="stat-label">Sesiones totales</div></div>
            <div className="stat-card"><div className="stat-val">{sesRealizadas}</div><div className="stat-label">Realizadas</div><div style={{fontSize:9,marginTop:3,color:'var(--g)'}}>{sesiones.length>0?Math.round((sesRealizadas/sesiones.length)*100):0}% asistencia</div></div>
            <div className="stat-card"><div className="stat-val">{escalas[escalas.length-1]?.borg??'—'}/10</div><div className="stat-label">Borg actual</div><div style={{fontSize:9,marginTop:3,color:escalas.length>1&&escalas[escalas.length-1]?.borg>escalas[0]?.borg?'var(--g)':'var(--grl)'}}>{escalas.length>1?`Inicio: ${escalas[0]?.borg}/10`:''}</div></div>
            <div className="stat-card"><div className="stat-val">{molActivas}</div><div className="stat-label">Molestias activas</div><div style={{fontSize:9,marginTop:3,color:molActivas===0?'var(--g)':'var(--red)'}}>{molActivas===0?'✓ Sin molestias activas':'⚠ Requiere atención'}</div></div>
          </div>

          <div className="g2">
            {/* ESCALAS */}
            <div className="card">
              <div className="card-title">Evolución Borg y estrés</div>
              {escalas.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin escalas registradas aún.</div>}
              {escalas.map((e,i)=>(
                <div key={e.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7,paddingBottom:7,borderBottom:i<escalas.length-1?'1px solid var(--bl)':'none'}}>
                  <span style={{fontSize:9,color:'var(--grl)',width:60,fontWeight:300,flexShrink:0}}>{new Date(e.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</span>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:3}}>
                      <span style={{fontSize:9,color:'var(--grl)',width:36}}>Borg</span>
                      <div style={{flex:1,height:5,background:'var(--bm)',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',borderRadius:3,background:'var(--g)',width:`${(e.borg/10)*100}%`,transition:'width .4s'}}/></div>
                      <span style={{fontSize:9,fontWeight:500,width:28,textAlign:'right'}}>{e.borg}/10</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{fontSize:9,color:'var(--grl)',width:36}}>Estrés</span>
                      <div style={{flex:1,height:5,background:'var(--bm)',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',borderRadius:3,background:e.estres>6?'var(--red)':e.estres>4?'var(--amb)':'var(--g)',width:`${(e.estres/10)*100}%`,transition:'width .4s'}}/></div>
                      <span style={{fontSize:9,fontWeight:500,width:28,textAlign:'right'}}>{e.estres}/10</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* MOLESTIAS */}
            <div className="card">
              <div className="card-title">Molestias y estado</div>
              {molestias.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin molestias registradas.</div>}
              {molestias.map(m=>(
                <div key={m.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:6,marginBottom:4,background:m.activa?'var(--redl)':'var(--gl)',border:`1px solid ${m.activa?'#F5C8C8':'var(--gm)'}`}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{m.zona}</div>
                    <div style={{fontSize:9,color:'var(--grl)'}}>EVA {m.eva}/10 · {m.tipo?.replace('_',' ')}</div>
                  </div>
                  <span style={{fontSize:8,fontWeight:500,padding:'2px 7px',borderRadius:99,background:m.activa?'var(--redl)':'var(--gl)',color:m.activa?'var(--red)':'var(--gd)',border:`1px solid ${m.activa?'var(--red)':'var(--gm)'}`}}>{m.activa?'● Activa':'✓ Resuelta'}</span>
                </div>
              ))}
            </div>

            {/* SESIONES */}
            <div className="card" style={{gridColumn:'1/-1'}}>
              <div className="card-title">Historial de sesiones</div>
              {sesiones.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin sesiones registradas.</div>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:6}}>
                {sesiones.map(s=>(
                  <div key={s.id} style={{padding:'8px 10px',background:'var(--bl)',borderRadius:6,border:'1px solid var(--bd)'}}>
                    <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:2}}>{s.nombre}</div>
                    <div style={{fontSize:9,color:'var(--grl)',marginBottom:4}}>{s.duracion_min} min · {new Date(s.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>
                    <span className={`badge ${s.estado==='realizada'?'badge-g':s.estado==='lista'?'badge-pen':'badge-b'}`}>{s.estado}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
