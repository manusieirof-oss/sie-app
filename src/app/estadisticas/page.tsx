'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function EstadisticasPage() {
  const [data, setData] = useState<any>({ pacientes:[], bonos:[], molestias:[], patologias:[] })
  const [loading, setLoading] = useState(true)
  
  const mes = new Date().getMonth()+1
  const anio = new Date().getFullYear()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: p },{ data: b },{ data: m },{ data: pat }] = await Promise.all([
      supabase.from('pacientes').select('*').eq('estado','activo'),
      supabase.from('bonos').select('*').eq('mes',mes).eq('anio',anio).eq('activo',true),
      supabase.from('molestias').select('*').eq('activa',true),
      supabase.from('patologias').select('*').neq('estado','resuelta'),
    ])
    setData({ pacientes:p||[], bonos:b||[], molestias:m||[], patologias:pat||[] })
    setLoading(false)
  }

  if (loading) return <div className="loading">Cargando estadísticas...</div>

  const { pacientes, bonos, molestias, patologias } = data
  const pagados = bonos.filter((b:any)=>b.estado_pago==='pagado').length
  const pendientes = bonos.filter((b:any)=>b.estado_pago==='pendiente').length
  const impagos = bonos.filter((b:any)=>b.estado_pago==='impago').length

  const byTipo: Record<string,number> = {}
  pacientes.forEach((p:any)=>{ byTipo[p.tipo_clase]=(byTipo[p.tipo_clase]||0)+1 })

  const byBono: Record<string,number> = {}
  bonos.forEach((b:any)=>{ byBono[b.tipo]=(byBono[b.tipo]||0)+1 })

  const byPat: Record<string,number> = {}
  patologias.forEach((p:any)=>{ byPat[p.nombre]=(byPat[p.nombre]||0)+1 })
  const topPat = Object.entries(byPat).sort(([,a],[,b])=>b-a).slice(0,6)

  const byMol: Record<string,number> = {}
  molestias.forEach((m:any)=>{ byMol[m.zona]=(byMol[m.zona]||0)+1 })
  const topMol = Object.entries(byMol).sort(([,a],[,b])=>b-a).slice(0,5)

  return (
    <>
      {/* KPIs */}
      <div className="g4" style={{marginBottom:12}}>
        <div className="stat-card"><div className="stat-val">{pacientes.length}</div><div className="stat-label">Pacientes activos</div></div>
        <div className="stat-card"><div className="stat-val">{pagados}</div><div className="stat-label">Pagados este mes</div><div style={{fontSize:9,marginTop:3,color:'var(--g)'}}>de {bonos.length} con bono</div></div>
        <div className="stat-card"><div className="stat-val">{impagos}</div><div className="stat-label">Impagos</div><div style={{fontSize:9,marginTop:3,color:impagos>0?'var(--red)':'var(--g)'}}>{impagos>0?'⚠ Requiere atención':'✓ Sin impagos'}</div></div>
        <div className="stat-card"><div className="stat-val">{molestias.length}</div><div className="stat-label">Molestias activas</div><div style={{fontSize:9,marginTop:3,color:'var(--gr)'}}>en {new Set(molestias.map((m:any)=>m.paciente_id)).size} pacientes</div></div>
      </div>

      <div className="g2" style={{marginBottom:10}}>
        {/* TIPO DE CLASE */}
        <div className="card">
          <div className="card-title">Distribución por tipo de clase</div>
          {[['entrenamiento','🏋 Entrenamiento'],['pilates','🧘 Pilates'],['rehabilitacion','🏥 Rehabilitación']].map(([k,l])=>{
            const v=byTipo[k]||0; const pct=pacientes.length>0?Math.round((v/pacientes.length)*100):0
            return (
              <div key={k} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{fontSize:10,minWidth:130,fontWeight:300}}>{l}</span>
                <div style={{flex:1,height:8,background:'var(--bm)',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',borderRadius:4,background:'var(--g)',width:`${pct}%`,transition:'width .4s'}}/></div>
                <span style={{fontSize:10,fontWeight:500,minWidth:50,textAlign:'right'}}>{v} ({pct}%)</span>
              </div>
            )
          })}
        </div>

        {/* BONOS */}
        <div className="card">
          <div className="card-title">Distribución de bonos activos</div>
          {[['esencial','Esencial'],['progreso','Progreso'],['avanzado','Avanzado'],['avanzado_mas1','Avanzado +1']].map(([k,l])=>{
            const v=byBono[k]||0; const pct=bonos.length>0?Math.round((v/bonos.length)*100):0
            return (
              <div key={k} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{fontSize:10,minWidth:90,fontWeight:300}}>{l}</span>
                <div style={{flex:1,height:8,background:'var(--bm)',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',borderRadius:4,background:'var(--g)',width:`${pct}%`,transition:'width .4s'}}/></div>
                <span style={{fontSize:10,fontWeight:500,minWidth:50,textAlign:'right'}}>{v} ({pct}%)</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="g2">
        {/* PATOLOGÍAS */}
        <div className="card">
          <div className="card-title">Patologías más frecuentes</div>
          {topPat.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin patologías registradas aún.</div>}
          {topPat.map(([nombre,count])=>(
            <div key={nombre} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 10px',background:'var(--bl)',borderRadius:6,border:'1px solid var(--bd)',marginBottom:4}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{nombre}</div>
              </div>
              <div style={{width:80,height:5,background:'var(--bm)',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:3,background:'var(--g)',width:`${Math.min(100,(count/Math.max(...topPat.map(([,c])=>c)))*100)}%`}}/>
              </div>
              <span style={{fontSize:12,fontWeight:500,color:'var(--g)',minWidth:20,textAlign:'right'}}>{count}</span>
            </div>
          ))}
        </div>

        {/* MOLESTIAS ACTIVAS + PAGOS */}
        <div>
          <div className="card" style={{marginBottom:8}}>
            <div className="card-title">Molestias activas ahora</div>
            {topMol.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin molestias activas. ¡Estupendo!</div>}
            {topMol.map(([zona,count])=>(
              <div key={zona} style={{display:'flex',alignItems:'center',gap:9,padding:'6px 10px',background:'var(--redl)',borderRadius:5,border:'1px solid #F5C8C8',marginBottom:3}}>
                <div style={{flex:1,fontSize:11,fontWeight:400,color:'var(--n)'}}>{zona}</div>
                <span style={{fontSize:12,fontWeight:500,color:'var(--red)'}}>{count}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-title">Pagos · mes actual</div>
            {[['✓ Pagado',pagados,'var(--g)'],[`⏳ Pendiente`,pendientes,'var(--amb)'],[`⚠ Impago`,impagos,'var(--red)']].map(([l,v,c])=>(
              <div key={String(l)} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
                <span style={{fontSize:10,minWidth:90,fontWeight:300}}>{l}</span>
                <div style={{flex:1,height:7,background:'var(--bm)',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',borderRadius:3,background:String(c),width:bonos.length>0?`${((v as number)/bonos.length)*100}%`:'0%',transition:'width .4s'}}/></div>
                <span style={{fontSize:10,fontWeight:500,minWidth:20,textAlign:'right'}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
