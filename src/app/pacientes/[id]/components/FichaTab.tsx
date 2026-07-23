'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function FichaTab({ pac, bono, citas, recuperaciones, editando, form, setForm, setModalBono, bonoLabel, mes, anio, alertas, abrirAlertas, cerrarAlerta, cambiarPago }: any) {
  const [valoracion, setValoracion] = useState<any>(null)
  const [objetivosTrabajo, setObjetivosTrabajo] = useState<any[]>([])
  const TIPOS_AL: Record<string,string> = {dolor:'🤕 Dolor / molestia',lesion:'🩹 Lesión',cita_medica:'🏥 Cita médica',personal:'💬 Situación personal',duda:'❓ Duda / consulta',otro:'📌 Otro'}

  useEffect(() => {
    if (pac?.id) {
      supabase.from('valoraciones').select('*').eq('paciente_id', pac.id).order('fecha', {ascending: false}).limit(1).then(({data}) => {
        if (data && data.length > 0) {
          const v = data[0]
          const eg = v.estado_general ? JSON.parse(v.estado_general) : {}
          setValoracion({...v, ...eg})
        }
      })
      supabase.from('pacientes_objetivos').select('origen, vias, logrado, fecha_logrado, objetivos(id,nombre,color,descripcion)').eq('paciente_id', pac.id).then(({data}) => {
        setObjetivosTrabajo((data||[]).map((r:any)=>({...r.objetivos, origen:r.origen, vias:r.vias||[], logrado:r.logrado, fecha_logrado:r.fecha_logrado})).filter((o:any)=>o.id))
      })
    }
  }, [pac?.id])


  return (
    <div className="g2">
      <div>
        {/* ALERTAS */}
        <div className="card">
          <div className="card-title">⚠️ Alertas activas <button className="btn btn-p btn-sm" onClick={abrirAlertas}>+ Alerta</button></div>
          {(!alertas||alertas.length===0) ? (
            <div style={{fontSize:10,color:'var(--grl)'}}>Sin alertas activas</div>
          ) : alertas.map((a:any)=>(
            <div key={a.id} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'8px 10px',borderRadius:6,border:`1px solid ${a.afecta_sesion?'#F5C8C8':'var(--bd)'}`,background:a.afecta_sesion?'var(--redl)':'var(--bl)',marginBottom:5}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,fontWeight:500,color:'var(--n)'}}>{TIPOS_AL[a.tipo]||a.tipo}{a.afecta_sesion&&<span style={{fontSize:8,color:'var(--red)',marginLeft:5}}>afecta sesión</span>}</div>
                <div style={{fontSize:10,color:'var(--gr)',marginTop:2}}>{a.descripcion}</div>
                {a.fecha_inicio&&<div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>desde {a.fecha_inicio}</div>}
              </div>
              <button onClick={()=>cerrarAlerta(a.id)} style={{fontSize:9,color:'var(--g)',background:'none',border:'1px solid var(--g)',borderRadius:5,padding:'3px 8px',cursor:'pointer',flexShrink:0}}>Cerrar</button>
            </div>
          ))}
        </div>

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
              <div className="field" style={{gridColumn:'1/-1'}}><label>📌 Notas <span style={{fontWeight:300,color:'var(--grl)',textTransform:'none',letterSpacing:0}}>· información del paciente</span></label><textarea className="input" value={form.notas_fijas||''} onChange={e=>setForm((p:any)=>({...p,notas_fijas:e.target.value}))} style={{minHeight:60}} placeholder="ej. Viene en silla de ruedas · Prefiere entrenar de pie"/></div>
            </div>
          ) : (
            <div>
              {[['DNI',pac.dni],['Teléfono',pac.telefono],['Email',pac.email],['Tipo clase',pac.tipo_clase],['Cómo nos conoció',pac.como_nos_conocio]].map(([l,v])=>v?(
                <div key={l} style={{display:'flex',gap:8,marginBottom:5,fontSize:11}}>
                  <span style={{color:'var(--grl)',minWidth:120,fontWeight:300}}>{l}</span>
                  <span style={{fontWeight:400}}>{v}</span>
                </div>
              ):null)}
              {pac.notas_fijas && <div style={{marginTop:8,padding:'8px 10px',background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:5,fontSize:10,color:'var(--n)',fontWeight:400,whiteSpace:'pre-line'}}>📌 {pac.notas_fijas}</div>}
            </div>
          )}
        </div>

        {/* VALORACIÓN — OBJETIVOS Y ANAMNESIS */}
        {valoracion && (
          <>
            {(valoracion.objetivos?.length>0||valoracion.deseo) && (
              <div className="card">
                <div className="card-title">🎯 Objetivos del paciente <span style={{fontWeight:300,fontSize:9,color:'var(--grl)'}}>· lo que pide</span></div>
                {(valoracion.objetivos||[]).map((o:string,i:number)=>(
                  <div key={i} style={{display:'flex',alignItems:'flex-start',gap:6,padding:'4px 7px',background:'var(--gl)',borderRadius:5,marginBottom:3,fontSize:10}}>
                    <div style={{width:15,height:15,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:8,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</div>{o}
                  </div>
                ))}
                {valoracion.deseo&&<div style={{marginTop:6,padding:'6px 8px',background:'var(--ambl)',borderRadius:5,border:'1px solid var(--amb)',fontSize:9,color:'#7A5800'}}>⭐ {valoracion.deseo}</div>}
              </div>
            )}
            {objetivosTrabajo.length>0 && (
              <div className="card">
                <div className="card-title">📊 Objetivos de trabajo <span style={{fontWeight:300,fontSize:9,color:'var(--grl)'}}>· lo que prescribimos</span></div>
                {objetivosTrabajo.map((o:any)=>{
                  const vias = Array.isArray(o.vias)?o.vias:[]
                  const pendientes = vias.filter((v:any)=>!v.resuelto).length
                  return (
                  <div key={o.id} style={{padding:'6px 8px',borderRadius:5,marginBottom:4,background:o.logrado?'var(--gl)':'var(--bl)',borderLeft:`3px solid ${o.logrado?'var(--g)':(o.color||'var(--g)')}`,opacity:o.logrado?.85:1}}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:7}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:10,fontWeight:500,color:'var(--n)',textDecoration:o.logrado?'line-through':'none'}}>{o.nombre}</div>
                        {o.descripcion&&<div style={{fontSize:9,color:'var(--grl)',marginTop:1,fontWeight:300,lineHeight:1.4}}>{o.descripcion}</div>}
                      </div>
                      {o.logrado
                        ? <span style={{fontSize:8,fontWeight:500,padding:'2px 7px',borderRadius:99,background:'var(--g)',color:'#fff',flexShrink:0}}>✓ Logrado</span>
                        : (vias.length>0 && <span style={{fontSize:8,padding:'2px 6px',borderRadius:99,background:'var(--bm)',color:'var(--gr)',flexShrink:0}}>{pendientes}/{vias.length}</span>)
                      }
                    </div>
                    {vias.length>0 && (
                      <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:5}}>
                        {vias.map((v:any,vi:number)=>(
                          <span key={vi} title={v.resuelto?('Resuelto '+(v.fecha_resuelto||'')):'Pendiente'}
                            style={{fontSize:8,padding:'2px 7px',borderRadius:99,border:`1px solid ${v.resuelto?'var(--g)':'var(--bd)'}`,background:v.resuelto?'var(--gl)':'var(--w)',color:v.resuelto?'var(--gd)':'var(--gr)',textDecoration:v.resuelto?'line-through':'none'}}>
                            {v.resuelto?'✓ ':(v.tipo==='test'?'🔍 ':'💪 ')}{v.etiqueta||v.tipo}
                          </span>
                        ))}
                      </div>
                    )}
                    {vias.length===0 && o.origen==='test' && <span style={{fontSize:8,padding:'2px 6px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>🔍 test</span>}
                  </div>
                )})}
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
              {bono.descuento_tipo && bono.descuento_valor > 0 && (
                <div style={{fontSize:9,color:'#7A5800',background:'var(--ambl)',borderRadius:5,padding:'3px 7px',marginBottom:8,display:'inline-block'}}>
                  🏷 Descuento {bono.descuento_tipo==='porcentaje'?`${bono.descuento_valor}%`:`${bono.descuento_valor}€`}{bono.descuento_motivo?` · ${bono.descuento_motivo}`:''}
                </div>
              )}
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {[['pagado','✓ Pagado','btn-p'],['pendiente','⏳ Pendiente','btn-amb'],['impago','⚠ Impago','btn-d']].map(([v,l,cls])=>(
                  <button key={v} className={`btn btn-sm ${bono.estado_pago===v?cls:'btn-t'}`} onClick={()=>cambiarPago(v)}>
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

      </div>
    </div>
  )
}
