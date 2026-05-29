'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function FichaTab({ pac, bono, citas, recuperaciones, editando, form, setForm, setModalBono, bonoLabel, mes, anio }: any) {
  const [valoracion, setValoracion] = useState<any>(null)

  useEffect(() => {
    if (pac?.id) {
      supabase.from('valoraciones').select('*').eq('paciente_id', pac.id).order('fecha', {ascending: false}).limit(1).then(({data}) => {
        if (data && data.length > 0) {
          const v = data[0]
          const eg = v.estado_general ? JSON.parse(v.estado_general) : {}
          setValoracion({...v, ...eg})
        }
      })
    }
  }, [pac?.id])

  const realizadas = citas.filter((c:any)=>c.estado==='realizada').length
  const faltas = citas.filter((c:any)=>c.estado==='falta').length
  const canceladas = citas.filter((c:any)=>c.estado==='cancelada').length
  const total = realizadas + faltas
  const pct = total>0 ? Math.round((realizadas/total)*100) : 0
  const faltasRecuperables = citas.filter((c:any)=>c.estado==='falta' && c.recuperable).length
  const proximas = citas.filter((c:any)=>['programada','clase'].includes(c.estado)).slice(0,5)

  return (
    <div className="g2">
      <div>
        {/* DATOS PERSONALES */}
        <div className="card">
          <div className="card-title">Datos personales</div>
          {editando ? (
            <div className="g2">
              {[['dni','DNI'],['telefono','Teléfono'],['email','Email']].map(([k,l])=>(
                <div key={k} className="field"><label>{l}</label><input className="input" value={form[k]||''} onChange={e=>setForm((p:any)=>({...p,[k]:e.target.value}))}/></div>
              ))}
              <div className="field"><label>Altura (cm)</label><input className="input" type="number" value={form.altura_cm||''} onChange={e=>setForm((p:any)=>({...p,altura_cm:e.target.value}))}/></div>
              <div className="field"><label>Peso (kg)</label><input className="input" type="number" value={form.peso_kg||''} onChange={e=>setForm((p:any)=>({...p,peso_kg:e.target.value}))}/></div>
              <div className="field" style={{gridColumn:'1/-1'}}><label>Tipo de clase</label>
                <select className="input" value={form.tipo_clase||''} onChange={e=>setForm((p:any)=>({...p,tipo_clase:e.target.value}))}>
                  <option value="entrenamiento">🏋 Entrenamiento</option>
                  <option value="pilates">🧘 Pilates</option>
                  <option value="rehabilitacion">🏥 Rehabilitación</option>
                  <option value="individual">👤 Individual</option>
                  <option value="embarazadas">🤰 Embarazadas</option>
                </select>
              </div>
              <div className="field" style={{gridColumn:'1/-1'}}><label>Notas internas</label><textarea className="input" value={form.notas||''} onChange={e=>setForm((p:any)=>({...p,notas:e.target.value}))} style={{minHeight:60}}/></div>
            </div>
          ) : (
            <div>
              {[['DNI',pac.dni],['Teléfono',pac.telefono],['Email',pac.email],['Tipo clase',pac.tipo_clase],['Cómo nos conoció',pac.como_nos_conocio]].map(([l,v])=>v?(
                <div key={l} style={{display:'flex',gap:8,marginBottom:5,fontSize:11}}>
                  <span style={{color:'var(--grl)',minWidth:120,fontWeight:300}}>{l}</span>
                  <span style={{fontWeight:400}}>{v}</span>
                </div>
              ):null)}
              {pac.notas && <div style={{marginTop:8,padding:'7px 9px',background:'var(--bl)',borderRadius:5,fontSize:10,color:'var(--n)',fontWeight:300,whiteSpace:'pre-line'}}>{pac.notas}</div>}
            </div>
          )}
        </div>

        {/* VALORACIÓN — OBJETIVOS Y ANAMNESIS */}
        {valoracion && (
          <>
            {(valoracion.objetivos?.length>0||valoracion.deseo) && (
              <div className="card">
                <div className="card-title">🎯 Objetivos</div>
                {(valoracion.objetivos||[]).map((o:string,i:number)=>(
                  <div key={i} style={{display:'flex',alignItems:'flex-start',gap:6,padding:'4px 7px',background:'var(--gl)',borderRadius:5,marginBottom:3,fontSize:10}}>
                    <div style={{width:15,height:15,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:8,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</div>{o}
                  </div>
                ))}
                {valoracion.deseo&&<div style={{marginTop:6,padding:'6px 8px',background:'var(--ambl)',borderRadius:5,border:'1px solid var(--amb)',fontSize:9,color:'#7A5800'}}>⭐ {valoracion.deseo}</div>}
              </div>
            )}
            {valoracion.anamnesis && (
              <div className="card">
                <div className="card-title">📋 Anamnesis</div>
                <div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.6,whiteSpace:'pre-line'}}>{valoracion.anamnesis}</div>
                {valoracion.trabajo&&<div style={{marginTop:6,fontSize:9,color:'var(--grl)'}}>💼 {valoracion.trabajo}{valoracion.tipo_jornada&&' · '+valoracion.tipo_jornada}</div>}
                {valoracion.hace_deporte&&valoracion.deportes?.length>0&&<div style={{marginTop:3,fontSize:9,color:'var(--grl)'}}>🏃 Deportes: {valoracion.deportes.join(', ')}</div>}
              </div>
            )}
            {valoracion.notas_plan && (
              <div className="card">
                <div className="card-title">📝 Notas del plan</div>
                <div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.6,whiteSpace:'pre-line'}}>{valoracion.notas_plan}</div>
              </div>
            )}
          </>
        )}

        {/* CLASES A RECUPERAR */}
        {recuperaciones.filter((r:any)=>r.estado==='pendiente').length>0 && (
          <div className="card">
            <div className="card-title">🔄 Clases a recuperar</div>
            {recuperaciones.filter((r:any)=>r.estado==='pendiente').map((r:any)=>{
              const tieneCita = !!r.cita_recuperacion_id
              return (
                <div key={r.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 8px',background:tieneCita?'var(--gl)':'var(--ambl)',borderRadius:5,border:`1px solid ${tieneCita?'var(--gm)':'var(--amb)'}`,marginBottom:3}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,fontWeight:400,color:'var(--n)'}}>Falta del {new Date(r.fecha_falta+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>
                    <div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>Vence el {new Date(r.fecha_limite+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>
                  </div>
                  <span style={{fontSize:8,padding:'2px 7px',borderRadius:99,background:tieneCita?'var(--g)':'var(--amb)',color:'#fff',fontWeight:500}}>
                    {tieneCita?'📅 Programada':'Pendiente'}
                  </span>
                </div>
              )
            })}
            {recuperaciones.filter((r:any)=>r.estado==='recuperada').length>0&&(
              <div style={{fontSize:9,color:'var(--grl)',marginTop:4}}>✓ {recuperaciones.filter((r:any)=>r.estado==='recuperada').length} clases recuperadas</div>
            )}
          </div>
        )}
      </div>

      <div>
        {/* BONO ACTIVO */}
        <div className="card">
          <div className="card-title">Bono activo <button className="btn btn-s btn-sm" onClick={()=>setModalBono(true)}>{bono?'Cambiar':'+ Asignar'}</button></div>
          {bono ? (
            <div style={{background:'var(--bl)',border:'1px solid var(--bm)',borderRadius:7,padding:'9px 11px'}}>
              <div style={{fontSize:12,fontWeight:400,color:'var(--n)',marginBottom:2}}>{bonoLabel[bono.tipo]||bono.tipo}</div>
              <div style={{fontSize:9,color:'var(--grl)',marginBottom:8}}>Mes {mes}/{anio}</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {[['pagado','✓ Pagado','btn-p'],['pendiente','⏳ Pendiente','btn-amb'],['impago','⚠ Impago','btn-d']].map(([v,l,cls])=>(
                  <button key={v} className={`btn btn-sm ${bono.estado_pago===v?cls:'btn-t'}`} onClick={async()=>{await supabase.from('bonos').update({estado_pago:v}).eq('id',bono.id)}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{fontSize:10,color:'var(--grl)'}}>Sin bono activo</div>
          )}
        </div>

        {/* PREFERENCIAS HORARIO */}
        {valoracion && (valoracion.dias_asistencia||valoracion.franja) && (
          <div className="card">
            <div className="card-title">🕐 Preferencias de horario</div>
            {valoracion.dias_asistencia&&<div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:6}}>{valoracion.dias_asistencia.split(',').filter(Boolean).map((d:string)=><span key={d} style={{fontSize:10,padding:'3px 9px',borderRadius:99,background:'var(--g)',color:'#fff'}}>{d}</span>)}</div>}
            {valoracion.franja&&<div style={{fontSize:10,color:'var(--grl)'}}>Franja: {valoracion.franja==='manana'?'☀️ Mañanas':valoracion.franja==='tarde'?'🌤 Tardes':valoracion.franja==='noche'?'🌙 Noches':'🔄 Flexible'}</div>}
          </div>
        )}

        {/* PRÓXIMAS CITAS */}
        <div className="card">
          <div className="card-title">Próximas citas</div>
          {proximas.length===0&&<div style={{fontSize:10,color:'var(--grl)'}}>Sin citas programadas</div>}
          {proximas.map((c:any)=>(
            <div key={c.id} className="ri">
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})} · {c.hora?.slice(0,5)}</div>
                <div style={{fontSize:9,color:'var(--grl)'}}>Sala {c.sala} · {c.tipo}</div>
              </div>
              <span className={`badge ${c.estado==='realizada'?'badge-g':'badge-b'}`}>{c.estado}</span>
            </div>
          ))}
        </div>

        {/* RESUMEN ASISTENCIA COMPACTO */}
        <div className="card">
          <div className="card-title">Asistencia</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:8}}>
            {[['Realizadas',realizadas,'var(--g)'],['Faltas',faltas,'var(--red)'],['% Asist.',total>0?pct+'%':'—','var(--n)']].map(([l,v,c])=>(
              <div key={String(l)} style={{background:'var(--bl)',borderRadius:6,padding:'6px 8px',textAlign:'center'}}>
                <div style={{fontSize:18,fontWeight:300,color:c}}>{v}</div>
                <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
          {total>0&&<div style={{background:'var(--bm)',borderRadius:99,height:5,overflow:'hidden'}}><div style={{width:pct+'%',height:'100%',background:'var(--g)',borderRadius:99}}/></div>}
        </div>
      </div>
    </div>
  )
}
