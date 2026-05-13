'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const STEPS = ['Paciente','Anamnesis','Historial','Molestias','Tests','Plan','Resumen']

export default function ValoracionPage() {
  const [step, setStep] = useState(1)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    paciente_id:'', nombre:'', apellidos:'', telefono:'', email:'', dni:'', fecha_nacimiento:'', altura_cm:'', peso_kg:'', tipo_clase:'entrenamiento',
    anamnesis:'', trabajo:'', tipo_jornada:'sedentario', objetivo1:'', objetivo2:'', objetivo3:'', deseo:'', borg:5, estres:5,
    medicacion:'', operaciones:'', alergias:'', patologias:'', dieta:'sin_restricciones', plantillas:false,
    molestias:[{ zona:'', tipo:'molestia', eva:5, observaciones:'' }],
    test_thomas:'sin_realizar', test_trend:'sin_realizar', test_lumbar:'sin_realizar', test_obs:'',
    tipo_clase_def:'entrenamiento', bono:'esencial', dias_asistencia:'', franja:'manana', notas_plan:'',
  })
  const up = (k: string, v: any) => setForm(p=>({...p,[k]:v}))

  useEffect(() => {
    supabase.from('pacientes').select('id,nombre,apellidos').eq('estado','activo').order('nombre').then(({data})=>setPacientes(data||[]))
  }, [])

  async function finalizar() {
    setGuardando(true)
    try {
      let pacienteId = form.paciente_id
      if (!pacienteId) {
        if (!form.nombre || !form.apellidos) { alert('Nombre y apellidos son obligatorios'); setGuardando(false); return }
        const { data: p, error } = await supabase.from('pacientes').insert({ nombre:form.nombre, apellidos:form.apellidos, telefono:form.telefono, email:form.email, dni:form.dni, fecha_nacimiento:form.fecha_nacimiento||null, altura_cm:form.altura_cm?parseInt(form.altura_cm):null, peso_kg:form.peso_kg?parseFloat(form.peso_kg):null, tipo_clase:form.tipo_clase_def, estado:'activo' }).select().single()
        if (error || !p) { alert('Error al crear el paciente'); setGuardando(false); return }
        pacienteId = p.id
      }
      const diasMap: Record<string,number> = { esencial:2, progreso:3, avanzado:4, avanzado_mas1:5 }
      await Promise.all([
        supabase.from('bonos').insert({ paciente_id:pacienteId, tipo:form.bono, dias_semana:diasMap[form.bono]||2, estado_pago:'pendiente', mes:new Date().getMonth()+1, anio:new Date().getFullYear(), fecha_inicio:new Date().toISOString().split('T')[0], activo:true }),
        supabase.from('valoraciones').insert({ paciente_id:pacienteId, fecha:new Date().toISOString().split('T')[0], tipo:'inicial', anamnesis:form.anamnesis, trabajo:form.trabajo, tipo_jornada:form.tipo_jornada, objetivos:[form.objetivo1,form.objetivo2,form.objetivo3].filter(Boolean), deseo:form.deseo, borg:form.borg, estres:form.estres }),
        ...form.molestias.filter(m=>m.zona).map(m=>supabase.from('molestias').insert({ paciente_id:pacienteId, zona:m.zona, tipo:m.tipo, eva:m.eva, observaciones:m.observaciones, activa:true })),
        ...[form.patologias].filter(Boolean).map(p=>supabase.from('patologias').insert({ paciente_id:pacienteId, nombre:p, estado:'activa' })),
        ...[form.medicacion].filter(Boolean).map(m=>supabase.from('medicamentos').insert({ paciente_id:pacienteId, nombre:m })),
        supabase.from('escalas').insert({ paciente_id:pacienteId, fecha:new Date().toISOString().split('T')[0], borg:form.borg, estres:form.estres }),
      ])
      const fechaRev = new Date(); fechaRev.setMonth(fechaRev.getMonth()+3)
      const tests = [
        { nombre:'Test de Thomas', resultado:form.test_thomas },
        { nombre:'Test Trendelenburg', resultado:form.test_trend },
        { nombre:'Test SIE Control motor lumbar', resultado:form.test_lumbar },
      ].filter(t=>t.resultado!=='sin_realizar')
      for (const t of tests) {
        const { data: testData } = await supabase.from('tests').select('id').ilike('nombre',`%${t.nombre}%`).single()
        if (testData) await supabase.from('resultados_tests').insert({ test_id:testData.id, paciente_id:pacienteId, fecha:new Date().toISOString().split('T')[0], resultado:t.resultado, observaciones:form.test_obs, fecha_repeticion:t.resultado==='positivo'?fechaRev.toISOString().split('T')[0]:null })
      }
      setExito(true)
      setTimeout(()=>router.push(`/pacientes/${pacienteId}`), 2000)
    } catch(e) { alert('Error al guardar: '+String(e)) }
    setGuardando(false)
  }

  const pct = Math.round((step/STEPS.length)*100)

  if (exito) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'60vh',gap:12}}>
      <div style={{fontSize:48}}>✅</div>
      <div style={{fontSize:16,fontWeight:400,color:'var(--n)'}}>Valoración guardada correctamente</div>
      <div style={{fontSize:11,color:'var(--grl)'}}>Redirigiendo a la ficha del paciente...</div>
    </div>
  )

  return (
    <>
      {/* BARRA PASOS */}
      <div style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'12px 16px',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:8}}>
          {STEPS.map((s,i)=>{
            const idx=i+1; const cls=idx<step?'done':idx===step?'active':'pending'
            return (
              <div key={s} style={{display:'flex',alignItems:'center',flex:1}}>
                <div onClick={()=>idx<step&&setStep(idx)} style={{width:24,height:24,borderRadius:'50%',border:`1.5px solid ${cls==='done'?'var(--g)':cls==='active'?'var(--g)':'var(--bd)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:500,color:cls==='done'||cls==='active'?'var(--g)':'var(--grl)',background:cls==='done'?'var(--g)':'var(--w)',cursor:idx<step?'pointer':'default',flexShrink:0}}>
                  {cls==='done'?<span style={{color:'#fff'}}>✓</span>:idx}
                </div>
                {i<STEPS.length-1 && <div style={{flex:1,height:1.5,background:idx<step?'var(--g)':'var(--bd)',margin:'0 3px'}}/>}
              </div>
            )
          })}
        </div>
        <div style={{display:'flex'}}>
          {STEPS.map((s,i)=>(
            <div key={s} style={{flex:1,textAlign:'center',fontSize:8,color:i+1===step?'var(--g)':i+1<step?'var(--g)':'var(--grl)',fontWeight:i+1===step?500:300}}>{s}</div>
          ))}
        </div>
        <div style={{height:3,background:'var(--bm)',borderRadius:2,overflow:'hidden',marginTop:8}}>
          <div style={{height:'100%',borderRadius:2,background:'var(--g)',width:`${pct}%`,transition:'width .3s'}}/>
        </div>
      </div>

      {/* PASO 1 */}
      {step===1 && (
        <div className="g2">
          <div className="card">
            <div className="card-title">¿Es un paciente existente o nuevo?</div>
            <div className="field"><label>Paciente existente (opcional)</label>
              <select className="input" value={form.paciente_id} onChange={e=>up('paciente_id',e.target.value)}>
                <option value="">— Paciente nuevo —</option>
                {pacientes.map(p=><option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>)}
              </select>
            </div>
            {!form.paciente_id && (
              <>
                <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',margin:'8px 0 6px'}}>Datos del nuevo paciente</div>
                <div className="g2">
                  <div className="field"><label>Nombre *</label><input className="input" value={form.nombre} onChange={e=>up('nombre',e.target.value)}/></div>
                  <div className="field"><label>Apellidos *</label><input className="input" value={form.apellidos} onChange={e=>up('apellidos',e.target.value)}/></div>
                  <div className="field"><label>Teléfono</label><input className="input" value={form.telefono} onChange={e=>up('telefono',e.target.value)}/></div>
                  <div className="field"><label>Email</label><input className="input" type="email" value={form.email} onChange={e=>up('email',e.target.value)}/></div>
                  <div className="field"><label>DNI</label><input className="input" value={form.dni} onChange={e=>up('dni',e.target.value)}/></div>
                  <div className="field"><label>F. nacimiento</label><input className="input" type="date" value={form.fecha_nacimiento} onChange={e=>up('fecha_nacimiento',e.target.value)}/></div>
                  <div className="field"><label>Altura (cm)</label><input className="input" type="number" value={form.altura_cm} onChange={e=>up('altura_cm',e.target.value)}/></div>
                  <div className="field"><label>Peso (kg)</label><input className="input" type="number" value={form.peso_kg} onChange={e=>up('peso_kg',e.target.value)}/></div>
                </div>
              </>
            )}
          </div>
          <div>
            <div className="card">
              <div className="card-title">Tipo de clase <span style={{fontSize:9,color:'var(--grl)',textTransform:'none',letterSpacing:0,fontWeight:300}}>(orientativo)</span></div>
              <div className="g3">
                {[['entrenamiento','🏋','Entrenamiento'],['pilates','🧘','Pilates'],['rehabilitacion','🏥','Rehabilitación']].map(([v,ic,l])=>(
                  <div key={v} onClick={()=>up('tipo_clase',v)} style={{border:`1.5px solid ${form.tipo_clase===v?'var(--g)':'var(--bd)'}`,borderRadius:'var(--rl)',padding:10,textAlign:'center',cursor:'pointer',background:form.tipo_clase===v?'var(--gl)':'var(--w)',transition:'all .15s'}}>
                    <div style={{fontSize:22,marginBottom:4}}>{ic}</div>
                    <div style={{fontSize:10,fontWeight:400}}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title">Consentimiento</div>
              <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,padding:'8px 11px',fontSize:9,color:'var(--gd)',lineHeight:1.6,marginBottom:8}}>
                Autorizo a SIE a tratar mis datos personales y de salud con fines terapéuticos, de acuerdo con el RGPD y la LOPD-GDD. Los datos no serán cedidos a terceros sin consentimiento expreso.
              </div>
              <div style={{border:'1.5px solid var(--g)',borderRadius:6,padding:'10px',textAlign:'center',cursor:'pointer',background:'var(--gl)',color:'var(--gd)',fontSize:11}}>
                ✓ Firmado digitalmente · {new Date().toLocaleDateString('es-ES')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PASO 2 */}
      {step===2 && (
        <div>
          <div className="card" style={{marginBottom:8}}>
            <div className="card-title">Anamnesis inicial · motivo de consulta</div>
            <textarea className="input" style={{minHeight:110,fontSize:13,lineHeight:1.6}} placeholder="¿Por qué empieza en SIE? Situación actual, historial, expectativas..." value={form.anamnesis} onChange={e=>up('anamnesis',e.target.value)}/>
            <div className="g2" style={{marginTop:8}}>
              <div className="field"><label>Trabajo / profesión</label><input className="input" value={form.trabajo} onChange={e=>up('trabajo',e.target.value)} placeholder="ej. Administrativo, enfermera..."/></div>
              <div className="field"><label>Tipo de jornada</label>
                <select className="input" value={form.tipo_jornada} onChange={e=>up('tipo_jornada',e.target.value)}>
                  <option value="sedentario">Sedentario · principalmente sentado</option>
                  <option value="de_pie">De pie la mayor parte</option>
                  <option value="mixto">Mixto</option>
                  <option value="fisico">Esfuerzo físico continuo</option>
                </select>
              </div>
            </div>
          </div>
          <div className="g3">
            <div className="card">
              <div className="card-title">Objetivos</div>
              <div className="field"><label>Principal</label><input className="input" value={form.objetivo1} onChange={e=>up('objetivo1',e.target.value)} placeholder="ej. Reducir dolor de espalda"/></div>
              <div className="field"><label>Secundario</label><input className="input" value={form.objetivo2} onChange={e=>up('objetivo2',e.target.value)} placeholder="ej. Ganar fuerza"/></div>
              <div className="field"><label>Personal</label><input className="input" value={form.objetivo3} onChange={e=>up('objetivo3',e.target.value)} placeholder="ej. Perder peso"/></div>
            </div>
            <div className="card">
              <div className="card-title">Deseo</div>
              <div className="field"><label>Si pudiera concederle un deseo ¿cuál sería?</label><textarea className="input" style={{minHeight:80}} value={form.deseo} onChange={e=>up('deseo',e.target.value)} placeholder="ej. Poder jugar con mis hijos sin dolor..."/></div>
            </div>
            <div className="card">
              <div className="card-title">Escalas</div>
              <div className="field">
                <label>Borg · bienestar general ({form.borg}/10)</label>
                <input type="range" min={0} max={10} value={form.borg} onChange={e=>up('borg',parseInt(e.target.value))} style={{width:'100%',accentColor:'var(--g)'}}/>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:8,color:'var(--grl)'}}>
                  <span>0 Mal</span><span style={{fontWeight:500,color:'var(--g)'}}>{form.borg}</span><span>10 Perfecto</span>
                </div>
              </div>
              <div className="field">
                <label>Nivel de estrés ({form.estres}/10)</label>
                <input type="range" min={0} max={10} value={form.estres} onChange={e=>up('estres',parseInt(e.target.value))} style={{width:'100%',accentColor:'var(--red)'}}/>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:8,color:'var(--grl)'}}>
                  <span>0 Sin estrés</span><span style={{fontWeight:500,color:'var(--red)'}}>{form.estres}</span><span>10 Máximo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PASO 3 */}
      {step===3 && (
        <div className="g2">
          <div>
            <div className="card"><div className="card-title">Medicación actual</div>
              <div className="field"><label>Medicamentos (uno por línea)</label><textarea className="input" style={{minHeight:70}} value={form.medicacion} onChange={e=>up('medicacion',e.target.value)} placeholder="ej. Ibuprofeno 400mg · puntual&#10;Anticonceptivos · diario"/></div>
            </div>
            <div className="card"><div className="card-title">Operaciones / cirugías</div>
              <div className="field"><textarea className="input" style={{minHeight:60}} value={form.operaciones} onChange={e=>up('operaciones',e.target.value)} placeholder="ej. Apendicectomía 2018&#10;Artroscopia rodilla derecha 2020"/></div>
            </div>
            <div className="card"><div className="card-title">Alergias</div>
              <div className="field"><input className="input" value={form.alergias} onChange={e=>up('alergias',e.target.value)} placeholder="ej. Lactosa, penicilina..."/></div>
            </div>
          </div>
          <div>
            <div className="card"><div className="card-title">Patologías y alteraciones</div>
              <div style={{fontSize:9,color:'var(--grl)',marginBottom:7}}>Una por línea. Podrás subir informes desde la ficha del paciente.</div>
              <textarea className="input" style={{minHeight:80}} value={form.patologias} onChange={e=>up('patologias',e.target.value)} placeholder="ej. Hernia L4-L5 · activa&#10;Escoliosis leve&#10;Hiperpronación bilateral"/>
            </div>
            <div className="card"><div className="card-title">Otros</div>
              <div className="field"><label>Dieta</label>
                <select className="input" value={form.dieta} onChange={e=>up('dieta',e.target.value)}>
                  <option value="sin_restricciones">Sin restricciones</option>
                  <option value="sin_lactosa">Sin lactosa</option>
                  <option value="sin_gluten">Sin gluten</option>
                  <option value="vegetariana">Vegetariana</option>
                  <option value="vegana">Vegana</option>
                </select>
              </div>
              <div className="field"><label>¿Usa plantillas?</label>
                <div style={{display:'flex',gap:8,marginTop:4}}>
                  {[['No',false],['Sí',true]].map(([l,v])=>(
                    <span key={String(l)} onClick={()=>up('plantillas',v)} style={{padding:'4px 12px',borderRadius:99,border:`1px solid ${form.plantillas===v?'var(--g)':'var(--bd)'}`,background:form.plantillas===v?'var(--g)':'var(--w)',color:form.plantillas===v?'#fff':'var(--gr)',cursor:'pointer',fontSize:11}}>{l}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PASO 4 */}
      {step===4 && (
        <div>
          <div className="info-pill">Anota cada zona con molestia. Las molestias activas aparecerán como alertas en la agenda.</div>
          {form.molestias.map((m,i)=>(
            <div key={i} className="card">
              <div className="card-title">Zona de molestia {i+1} {i>0&&<button className="btn btn-d btn-sm" onClick={()=>up('molestias',form.molestias.filter((_:any,j:number)=>j!==i))}>Eliminar</button>}</div>
              <div className="g2">
                <div className="field"><label>Zona / localización</label><input className="input" value={m.zona} onChange={e=>{const ms=[...form.molestias];ms[i]={...ms[i],zona:e.target.value};up('molestias',ms)}} placeholder="ej. Lumbar izquierda, rodilla derecha..."/></div>
                <div className="field"><label>Tipo</label>
                  <select className="input" value={m.tipo} onChange={e=>{const ms=[...form.molestias];ms[i]={...ms[i],tipo:e.target.value};up('molestias',ms)}}>
                    <option value="molestia">Molestia</option><option value="dolor_agudo">Dolor agudo</option><option value="dolor_cronico">Dolor crónico</option><option value="rigidez">Rigidez</option>
                  </select>
                </div>
                <div className="field" style={{gridColumn:'1/-1'}}>
                  <label>Intensidad EVA ({m.eva}/10)</label>
                  <input type="range" min={0} max={10} value={m.eva} onChange={e=>{const ms=[...form.molestias];ms[i]={...ms[i],eva:parseInt(e.target.value)};up('molestias',ms)}} style={{width:'100%',accentColor:'var(--red)'}}/>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:8,color:'var(--grl)'}}><span>0 Sin dolor</span><span style={{fontWeight:500,color:'var(--red)'}}>{m.eva}</span><span>10 Máximo</span></div>
                </div>
                <div className="field" style={{gridColumn:'1/-1'}}>
                  <label>Observaciones</label>
                  <input className="input" value={m.observaciones} onChange={e=>{const ms=[...form.molestias];ms[i]={...ms[i],observaciones:e.target.value};up('molestias',ms)}} placeholder="Cuándo aparece, qué lo provoca, sensación..."/>
                </div>
              </div>
            </div>
          ))}
          <button className="btn btn-t" onClick={()=>up('molestias',[...form.molestias,{zona:'',tipo:'molestia',eva:5,observaciones:''}])}>+ Añadir zona</button>
        </div>
      )}

      {/* PASO 5 */}
      {step===5 && (
        <div>
          <div className="warn-pill">Tests sugeridos según las molestias y patologías registradas. Anota el resultado de cada uno.</div>
          {[['test_thomas','Test de Thomas · Flexores cadera','Evalúa acortamiento de psoas y recto femoral. Sugerido por: molestia lumbar.'],
            ['test_trend','Test Trendelenburg · Glúteo medio','Evalúa fuerza del glúteo medio y estabilidad pélvica.'],
            ['test_lumbar','Test SIE · Control motor lumbar','Test propio del método SIE. Evalúa estabilidad y control motor lumbar.'],
          ].map(([key,nombre,desc])=>(
            <div key={key} style={{background:'var(--w)',border:`1px solid ${form[key as keyof typeof form]==='positivo'?'#F5C8C8':form[key as keyof typeof form]==='negativo'?'var(--gm)':'var(--bd)'}`,borderRadius:'var(--rl)',padding:'11px 13px',marginBottom:7,backgroundColor:form[key as keyof typeof form]==='positivo'?'var(--redl)':form[key as keyof typeof form]==='negativo'?'var(--gl)':'var(--w)'}}>
              <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:3}}>🔍 {nombre}</div>
              <div style={{fontSize:9,color:'var(--gr)',marginBottom:7,fontWeight:300}}>{desc}</div>
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {[['positivo','+ Positivo','btn-d'],['negativo','− Negativo','btn-p'],['sin_realizar','Sin realizar','btn-s']].map(([v,l,cls])=>(
                  <button key={v} className={`btn btn-sm ${form[key as keyof typeof form]===v?cls:'btn-s'}`} onClick={()=>up(key,v)}>{l}{form[key as keyof typeof form]===v?' ✓':''}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="card" style={{marginTop:8}}>
            <div className="card-title">Observaciones generales de los tests</div>
            <textarea className="input" value={form.test_obs} onChange={e=>up('test_obs',e.target.value)} placeholder="Notas sobre los tests realizados..." style={{minHeight:60}}/>
          </div>
        </div>
      )}

      {/* PASO 6 */}
      {step===6 && (
        <div className="g2">
          <div>
            <div className="card"><div className="card-title">Tipo de clase definitivo</div>
              <div className="g3">
                {[['entrenamiento','🏋','Entrenamiento'],['pilates','🧘','Pilates'],['rehabilitacion','🏥','Rehabilitación']].map(([v,ic,l])=>(
                  <div key={v} onClick={()=>up('tipo_clase_def',v)} style={{border:`1.5px solid ${form.tipo_clase_def===v?'var(--g)':'var(--bd)'}`,borderRadius:'var(--rl)',padding:10,textAlign:'center',cursor:'pointer',background:form.tipo_clase_def===v?'var(--gl)':'var(--w)',transition:'all .15s'}}>
                    <div style={{fontSize:20,marginBottom:4}}>{ic}</div><div style={{fontSize:10,fontWeight:400}}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card"><div className="card-title">Bono definitivo</div>
              {[['esencial','Esencial','2 días/semana'],['progreso','Progreso','3 días/semana'],['avanzado','Avanzado','4 días/semana'],['avanzado_mas1','Avanzado +1','5 días/semana']].map(([v,l,d])=>(
                <div key={v} onClick={()=>up('bono',v)} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:6,border:`1.5px solid ${form.bono===v?'var(--g)':'var(--bd)'}`,background:form.bono===v?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:4,transition:'all .15s'}}>
                  <div style={{flex:1}}><div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{l}</div><div style={{fontSize:9,color:'var(--grl)'}}>{d}</div></div>
                  {form.bono===v && <div style={{width:16,height:16,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:10,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>✓</div>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="card"><div className="card-title">Horario</div>
              <div className="field"><label>Días de asistencia</label><input className="input" value={form.dias_asistencia} onChange={e=>up('dias_asistencia',e.target.value)} placeholder="ej. Lunes y Miércoles, o Lun/Mié/Vie"/></div>
              <div className="field"><label>Franja horaria preferida</label>
                <select className="input" value={form.franja} onChange={e=>up('franja',e.target.value)}>
                  <option value="manana">Mañana · 08:30–12:30</option>
                  <option value="tarde">Tarde · 15:30–19:00</option>
                  <option value="noche">Noche · 19:00–22:30</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>
            </div>
            <div className="card"><div className="card-title">Notas del plan</div>
              <textarea className="input" style={{minHeight:100}} value={form.notas_plan} onChange={e=>up('notas_plan',e.target.value)} placeholder="Qué se le ha explicado al paciente, plan de entrenamiento propuesto, observaciones..."/>
            </div>
          </div>
        </div>
      )}

      {/* PASO 7 RESUMEN */}
      {step===7 && (
        <div className="g2">
          <div>
            <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
              <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>👤 Paciente</div>
              <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:3}}>{form.nombre||'(existente)'} {form.apellidos}</div>
              <div style={{fontSize:10,color:'var(--grl)',fontWeight:300}}>{form.tipo_clase_def} · Bono {form.bono?.replace('_',' ')}</div>
            </div>
            <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
              <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>🎯 Objetivos</div>
              {[form.objetivo1,form.objetivo2,form.objetivo3].filter(Boolean).map((o,i)=>(
                <div key={i} style={{display:'flex',alignItems:'flex-start',gap:6,padding:'4px 7px',background:'var(--gl)',borderRadius:5,marginBottom:3,fontSize:10}}>
                  <div style={{width:15,height:15,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:8,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</div>
                  {o}
                </div>
              ))}
              {form.deseo && <div style={{marginTop:6,padding:'6px 8px',background:'var(--ambl)',borderRadius:5,border:'1px solid var(--amb)',fontSize:9,color:'#7A5800'}}>⭐ {form.deseo}</div>}
            </div>
            <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
              <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>🔍 Tests</div>
              {[['test_thomas','Test de Thomas'],['test_trend','Test Trendelenburg'],['test_lumbar','Test SIE Lumbar']].map(([k,n])=>(
                form[k as keyof typeof form]!=='sin_realizar' && (
                  <div key={k} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 7px',background:form[k as keyof typeof form]==='positivo'?'var(--redl)':'var(--gl)',borderRadius:4,marginBottom:3,fontSize:10}}>
                    <span>{form[k as keyof typeof form]==='positivo'?'🔴':'🟢'}</span>
                    <span style={{fontWeight:500}}>{n} · {form[k as keyof typeof form]==='positivo'?'Positivo':'Negativo'}</span>
                  </div>
                )
              ))}
            </div>
          </div>
          <div>
            <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
              <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>📋 Anamnesis</div>
              <div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.5}}>{form.anamnesis||'No registrada'}</div>
            </div>
            <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
              <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>🗺 Molestias</div>
              {form.molestias.filter(m=>m.zona).map((m,i)=>(
                <div key={i} style={{display:'flex',gap:7,marginBottom:4,fontSize:10}}>
                  <span style={{color:'var(--red)',fontWeight:500}}>{m.zona}</span>
                  <span style={{color:'var(--grl)'}}>EVA {m.eva}/10</span>
                </div>
              ))}
            </div>
            <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:7,padding:'10px 12px',marginBottom:12,fontSize:10,color:'var(--gd)'}}>
              ✓ Revaloración programada en 3 meses automáticamente para los tests positivos.
            </div>
            <button className="btn btn-p" style={{width:'100%',justifyContent:'center',padding:'11px',fontSize:13}} onClick={finalizar} disabled={guardando}>
              {guardando ? 'Guardando...' : '✓ Guardar valoración completa'}
            </button>
          </div>
        </div>
      )}

      {/* NAVEGACIÓN PASOS */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12,paddingTop:12,borderTop:'1px solid var(--bd)'}}>
        <button className="btn btn-s" onClick={()=>setStep(s=>Math.max(1,s-1))} style={{visibility:step===1?'hidden':'visible'}}>← Atrás</button>
        <span style={{fontSize:10,color:'var(--grl)'}}>Paso {step} de {STEPS.length} · {STEPS[step-1]}</span>
        {step<STEPS.length ? (
          <button className="btn btn-p" onClick={()=>setStep(s=>Math.min(STEPS.length,s+1))}>Continuar →</button>
        ) : (
          <button className="btn btn-p" onClick={finalizar} disabled={guardando} style={{display:'none'}}>.</button>
        )}
      </div>
    </>
  )
}
