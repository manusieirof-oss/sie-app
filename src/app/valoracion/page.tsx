'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const STEPS = ['Paciente','Anamnesis','Historial','Molestias','Tests','Plan','Resumen']

export default function ValoracionPage() {
  const [step, setStep] = useState(1)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const router = useRouter()
  

  const [testsLib, setTestsLib] = useState<any[]>([])
  const [testsValoracion, setTestsValoracion] = useState<{test_id:string, nombre:string, lado:string, items_resultado:any[], resultado:string, observaciones:string, fecha_repeticion:string, frecuencia_meses:number}[]>([])
  const [testActivo, setTestActivo] = useState<number|null>(null)

  const [form, setForm] = useState({
    paciente_id:'', nombre:'', apellidos:'', nombre_clinica:'', telefono:'', email:'', dni:'', fecha_nacimiento:'', altura_cm:'', peso_kg:'', tipo_clase:'entrenamiento', como_nos_conocio:'',
    anamnesis:'', trabajo:'', tipo_jornada:'sedentario', objetivo1:'', objetivo2:'', objetivo3:'', deseo:'', borg:5, estres:5,
    medicacion:[] as {nombre:string,frecuencia:string}[], operaciones:'', alergias:[] as string[], intolerancias:[] as string[], patologias:'', dieta:'sin_restricciones', plantillas:false, tipo_plantilla:'',
    molestias:[{ zona:'', tipo:'molestia', eva:5, observaciones:'' }],

    tipo_clase_def:'entrenamiento', bono:'esencial', dias_asistencia:'', franja:'manana', notas_plan:'',
  })
  const up = (k: string, v: any) => setForm(p=>({...p,[k]:v}))
  const [firmaAceptada, setFirmaAceptada] = useState(false)
  const [medsBiblio, setMedsBiblio] = useState<any[]>([])
  const [alergiasBiblio, setAlergiasBiblio] = useState<any[]>([])
  const [intolBiblio, setIntolBiblio] = useState<any[]>([])
  const [buscarMed, setBuscarMed] = useState('')
  const [buscarAlerg, setBuscarAlerg] = useState('')
  const [buscarIntol, setBuscarIntol] = useState('')
  const [modalNuevoMed, setModalNuevoMed] = useState(false)
  const [modalNuevaAlerg, setModalNuevaAlerg] = useState(false)
  const [modalNuevaIntol, setModalNuevaIntol] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [firmaCanvas, setFirmaCanvas] = useState<string>('')
  const [dibujando, setDibujando] = useState(false)

  function calcularResultadoVal(items: any[], logica: string): string {
    const marcados = items.filter(i=>i.marcado).length
    if (logica==='todos') return marcados===items.length && items.length>0?'positivo':'negativo'
    return marcados>0?'positivo':'negativo'
  }

  useEffect(() => {
    supabase.from('pacientes').select('id,nombre,apellidos').eq('estado','activo').order('nombre').then(({data})=>setPacientes(data||[]))
    supabase.from('medicamentos_biblioteca').select('*').eq('activo',true).order('categoria').order('nombre').then(({data})=>setMedsBiblio(data||[]))
    supabase.from('alergias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setAlergiasBiblio(data||[]))
    supabase.from('intolerancias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setIntolBiblio(data||[]))
    supabase.from('tests').select('*').order('nombre').then(({data})=>setTestsLib(data||[]))
  }, [])

  async function finalizar() {
    setGuardando(true)
    try {
      let pacienteId = form.paciente_id
      if (!pacienteId) {
        if (!form.nombre || !form.apellidos) { alert('Nombre y apellidos son obligatorios'); setGuardando(false); return }
        const { data: p, error } = await supabase.from('pacientes').insert({ nombre:form.nombre, apellidos:form.apellidos, nombre_clinica:form.nombre_clinica||null, telefono:form.telefono, email:form.email, dni:form.dni, fecha_nacimiento:form.fecha_nacimiento||null, altura_cm:form.altura_cm?parseInt(form.altura_cm):null, peso_kg:form.peso_kg?parseFloat(form.peso_kg):null, tipo_clase:form.tipo_clase_def, como_nos_conocio:form.como_nos_conocio||null, estado:'activo' }).select().single()
        if (error || !p) { alert('Error al crear el paciente'); setGuardando(false); return }
        pacienteId = p.id
      }
      const diasMap: Record<string,number> = { esencial:2, progreso:3, avanzado:4, avanzado_mas1:5 }
      await Promise.all([
        supabase.from('bonos').insert({ paciente_id:pacienteId, tipo:form.bono, dias_semana:diasMap[form.bono]||2, estado_pago:'pendiente', mes:new Date().getMonth()+1, anio:new Date().getFullYear(), fecha_inicio:new Date().toISOString().split('T')[0], activo:true }),
        supabase.from('valoraciones').insert({ paciente_id:pacienteId, fecha:new Date().toISOString().split('T')[0], tipo:'inicial', anamnesis:form.anamnesis, trabajo:form.trabajo, tipo_jornada:form.tipo_jornada, objetivos:[form.objetivo1,form.objetivo2,form.objetivo3].filter(Boolean), deseo:form.deseo, borg:form.borg, estres:form.estres }),
        ...form.molestias.filter(m=>m.zona).map(m=>supabase.from('molestias').insert({ paciente_id:pacienteId, zona:m.zona, tipo:m.tipo, eva:m.eva, observaciones:m.observaciones, activa:true })),
        ...[form.patologias].filter(Boolean).map(p=>supabase.from('patologias').insert({ paciente_id:pacienteId, nombre:p, estado:'activa' })),
        ...form.medicacion.map((m:any)=>supabase.from('medicamentos').insert({ paciente_id:pacienteId, nombre:m.nombre, frecuencia:m.frecuencia||'' })),
        supabase.from('escalas').insert({ paciente_id:pacienteId, fecha:new Date().toISOString().split('T')[0], borg:form.borg, estres:form.estres }),
      ])
      for (const t of testsValoracion) {
        await supabase.from('resultados_tests').insert({
          test_id: t.test_id,
          paciente_id: pacienteId,
          fecha: new Date().toISOString().split('T')[0],
          resultado: t.resultado,
          observaciones: t.observaciones,
          fecha_repeticion: t.fecha_repeticion || null,
          lado: t.lado,
          items_resultado: t.items_resultado,
        })
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
                  <div className="field"><label>Nombre en clínica</label><input className="input" value={form.nombre_clinica||''} onChange={e=>up('nombre_clinica',e.target.value)} placeholder="ej. Manu"/></div>
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
              <div className="card-title">¿Cómo nos conoció?</div>
              <div className="field">
                <select className="input" value={form.como_nos_conocio} onChange={e=>up('como_nos_conocio',e.target.value)}>
                  <option value="">Seleccionar...</option>
                  <option value="recomendacion">Recomendación de un conocido</option>
                  <option value="instagram">Instagram</option>
                  <option value="google">Google</option>
                  <option value="facebook">Facebook</option>
                  <option value="paso_por_aqui">Pasó por aquí</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
            <div className="card">
              <div className="card-title">Consentimiento de datos</div>
              <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,padding:'8px 11px',fontSize:9,color:'var(--gd)',lineHeight:1.6,marginBottom:10}}>
                Autorizo a SIE a tratar mis datos personales y de salud con fines terapéuticos, de acuerdo con el RGPD y la LOPD-GDD. Los datos no serán cedidos a terceros sin consentimiento expreso.
              </div>
              
              {/* FIRMA CANVAS */}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Firma del paciente</div>
                <div style={{position:'relative',border:`2px solid ${firmaCanvas?'var(--g)':'var(--bd)'}`,borderRadius:6,background:'var(--w)',overflow:'hidden'}}>
                  <canvas
                    id="firma-canvas"
                    width={400}
                    height={120}
                    style={{display:'block',width:'100%',height:120,cursor:'crosshair',touchAction:'none'}}
                    onMouseDown={e=>{
                      setDibujando(true)
                      const canvas = e.currentTarget
                      const ctx = canvas.getContext('2d')!
                      const rect = canvas.getBoundingClientRect()
                      const scaleX = canvas.width/rect.width
                      ctx.beginPath()
                      ctx.moveTo((e.clientX-rect.left)*scaleX,(e.clientY-rect.top)*scaleX)
                    }}
                    onMouseMove={e=>{
                      if(!dibujando) return
                      const canvas = e.currentTarget
                      const ctx = canvas.getContext('2d')!
                      const rect = canvas.getBoundingClientRect()
                      const scaleX = canvas.width/rect.width
                      ctx.lineWidth=2;ctx.lineCap='round';ctx.strokeStyle='#262825'
                      ctx.lineTo((e.clientX-rect.left)*scaleX,(e.clientY-rect.top)*scaleX)
                      ctx.stroke()
                    }}
                    onMouseUp={e=>{
                      setDibujando(false)
                      setFirmaCanvas(e.currentTarget.toDataURL())
                    }}
                    onTouchStart={e=>{
                      e.preventDefault()
                      setDibujando(true)
                      const canvas = e.currentTarget
                      const ctx = canvas.getContext('2d')!
                      const rect = canvas.getBoundingClientRect()
                      const scaleX = canvas.width/rect.width
                      const touch = e.touches[0]
                      ctx.beginPath()
                      ctx.moveTo((touch.clientX-rect.left)*scaleX,(touch.clientY-rect.top)*scaleX)
                    }}
                    onTouchMove={e=>{
                      e.preventDefault()
                      if(!dibujando) return
                      const canvas = e.currentTarget
                      const ctx = canvas.getContext('2d')!
                      const rect = canvas.getBoundingClientRect()
                      const scaleX = canvas.width/rect.width
                      const touch = e.touches[0]
                      ctx.lineWidth=2;ctx.lineCap='round';ctx.strokeStyle='#262825'
                      ctx.lineTo((touch.clientX-rect.left)*scaleX,(touch.clientY-rect.top)*scaleX)
                      ctx.stroke()
                    }}
                    onTouchEnd={e=>{
                      setDibujando(false)
                      setFirmaCanvas(e.currentTarget.toDataURL())
                    }}
                  />
                  {!firmaCanvas && <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',fontSize:10,color:'var(--grl)',pointerEvents:'none'}}>Firma aquí con el dedo o ratón</div>}
                </div>
                {firmaCanvas && (
                  <button className="btn btn-t btn-sm" style={{marginTop:5}} onClick={()=>{
                    const canvas = document.getElementById('firma-canvas') as HTMLCanvasElement
                    const ctx = canvas.getContext('2d')!
                    ctx.clearRect(0,0,canvas.width,canvas.height)
                    setFirmaCanvas('')
                  }}>🗑 Borrar firma</button>
                )}
              </div>

              {/* CHECKBOX */}
              <div onClick={()=>setFirmaAceptada(p=>!p)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:6,border:`1.5px solid ${firmaAceptada?'var(--g)':'var(--bd)'}`,background:firmaAceptada?'var(--gl)':'var(--w)',cursor:'pointer'}}>
                <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${firmaAceptada?'var(--g)':'var(--bd)'}`,background:firmaAceptada?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {firmaAceptada&&<span style={{color:'#fff',fontSize:11,fontWeight:700}}>✓</span>}
                </div>
                <span style={{fontSize:10,color:'var(--n)',fontWeight:300}}>He leído y acepto el tratamiento de mis datos personales</span>
              </div>
              {(firmaCanvas||firmaAceptada)&&(
                <div style={{marginTop:6,fontSize:9,color:'var(--gd)',background:'var(--gl)',borderRadius:4,padding:'4px 8px'}}>
                  ✓ Consentimiento registrado · {new Date().toLocaleDateString('es-ES')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PASO 2 */}
      {step===2 && (
        <div>
          {/* ANAMNESIS */}
          <div className="card" style={{marginBottom:8}}>
            <div className="card-title">Anamnesis inicial · motivo de consulta</div>
            <textarea className="input" style={{minHeight:110,fontSize:13,lineHeight:1.6}} placeholder="¿Por qué empieza en SIE? Situación actual, historial, expectativas..." value={form.anamnesis} onChange={e=>up('anamnesis',e.target.value)}/>
            <div className="g2" style={{marginTop:8}}>
              <div className="field"><label>Trabajo / profesión</label><input className="input" value={form.trabajo} onChange={e=>up('trabajo',e.target.value)} placeholder="ej. Administrativo, enfermera..."/></div>
              <div className="field"><label>Tipo de jornada</label>
                <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:4}}>
                  {['Sedentario','De pie','Mixto','Esfuerzo físico','Conductor','Pantallas','Trabajo manual'].map(j=>(
                    <span key={j} onClick={()=>up('tipo_jornada',j)}
                      style={{fontSize:10,padding:'4px 10px',borderRadius:99,border:`1px solid ${form.tipo_jornada===j?'var(--g)':'var(--bd)'}`,background:form.tipo_jornada===j?'var(--g)':'var(--w)',color:form.tipo_jornada===j?'#fff':'var(--gr)',cursor:'pointer'}}>
                      {j}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="g2" style={{marginBottom:8}}>
            {/* OBJETIVOS */}
            <div className="card">
              <div className="card-title">Objetivos del paciente</div>
              <div className="field"><label>Objetivo 1</label><input className="input" value={form.objetivo1} onChange={e=>up('objetivo1',e.target.value)} placeholder="ej. Reducir dolor de espalda"/></div>
              <div className="field"><label>Objetivo 2</label><input className="input" value={form.objetivo2} onChange={e=>up('objetivo2',e.target.value)} placeholder="ej. Ganar fuerza"/></div>
              <div className="field"><label>Objetivo 3</label><input className="input" value={form.objetivo3} onChange={e=>up('objetivo3',e.target.value)} placeholder="ej. Perder peso"/></div>
              <div className="field"><label>Si pudiera concederle un deseo ¿cuál sería?</label><textarea className="input" style={{minHeight:60}} value={form.deseo} onChange={e=>up('deseo',e.target.value)} placeholder="ej. Poder jugar con mis hijos sin dolor..."/></div>
            </div>

            {/* ESCALAS */}
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

          {/* SALUD Y HÁBITOS */}
          <div className="g3">
            {/* MEDICACIÓN */}
            <div className="card">
              <div className="card-title">💊 Medicación actual</div>
              {form.medicacion.length>0&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
                  {form.medicacion.map((m,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:99,background:'var(--gl)',border:'1px solid var(--gm)'}}>
                      <span style={{fontSize:10,color:'var(--n)'}}>{m.nombre}</span>
                      {m.frecuencia&&<span style={{fontSize:9,color:'var(--grl)'}}>· {m.frecuencia}</span>}
                      <button onClick={()=>up('medicacion',form.medicacion.filter((_:any,j:number)=>j!==i))} style={{fontSize:10,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'0 2px'}}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <input className="input" placeholder="🔍 Buscar medicamento..." value={buscarMed} onChange={e=>setBuscarMed(e.target.value)} style={{marginBottom:6,fontSize:11}}/>
              {buscarMed&&(
                <div style={{border:'1px solid var(--bd)',borderRadius:6,maxHeight:140,overflowY:'auto',marginBottom:6}}>
                  {medsBiblio.filter(m=>m.nombre.toLowerCase().includes(buscarMed.toLowerCase())).slice(0,8).map(m=>(
                    <div key={m.id} onClick={()=>{
                      const freq = prompt('Frecuencia (ej. Diario, Puntual, Cada 8h):','Diario')
                      up('medicacion',[...form.medicacion,{nombre:m.nombre,frecuencia:freq||''}])
                      setBuscarMed('')
                    }} style={{padding:'6px 10px',cursor:'pointer',fontSize:10,borderBottom:'1px solid var(--bl)'}}
                      onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'}
                      onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                      {m.nombre} <span style={{fontSize:8,color:'var(--grl)'}}>· {m.categoria}</span>
                    </div>
                  ))}
                  {medsBiblio.filter(m=>m.nombre.toLowerCase().includes(buscarMed.toLowerCase())).length===0&&(
                    <div style={{padding:'6px 10px',fontSize:10,color:'var(--grl)'}}>
                      Sin resultados · <button className="btn btn-t btn-sm" onClick={()=>{setNuevoNombre(buscarMed);setModalNuevoMed(true)}}>+ Añadir "{buscarMed}"</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ALERGIAS */}
            <div className="card">
              <div className="card-title">🌿 Alergias</div>
              {form.alergias.length>0&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
                  {form.alergias.map((a:string,i:number)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:99,background:'var(--redl)',border:'1px solid #F5C8C8'}}>
                      <span style={{fontSize:10,color:'var(--red)'}}>{a}</span>
                      <button onClick={()=>up('alergias',form.alergias.filter((_:any,j:number)=>j!==i))} style={{fontSize:10,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <input className="input" placeholder="🔍 Buscar alergia..." value={buscarAlerg} onChange={e=>setBuscarAlerg(e.target.value)} style={{marginBottom:6,fontSize:11}}/>
              {buscarAlerg&&(
                <div style={{border:'1px solid var(--bd)',borderRadius:6,maxHeight:140,overflowY:'auto',marginBottom:6}}>
                  {alergiasBiblio.filter(a=>a.nombre.toLowerCase().includes(buscarAlerg.toLowerCase())).slice(0,8).map(a=>(
                    <div key={a.id} onClick={()=>{
                      if(!form.alergias.includes(a.nombre)) up('alergias',[...form.alergias,a.nombre])
                      setBuscarAlerg('')
                    }} style={{padding:'6px 10px',cursor:'pointer',fontSize:10,borderBottom:'1px solid var(--bl)'}}
                      onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'}
                      onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                      {a.nombre} <span style={{fontSize:8,color:'var(--grl)'}}>· {a.categoria}</span>
                    </div>
                  ))}
                  {alergiasBiblio.filter(a=>a.nombre.toLowerCase().includes(buscarAlerg.toLowerCase())).length===0&&(
                    <div style={{padding:'6px 10px',fontSize:10,color:'var(--grl)'}}>
                      Sin resultados · <button className="btn btn-t btn-sm" onClick={()=>{setNuevoNombre(buscarAlerg);setModalNuevaAlerg(true)}}>+ Añadir</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* INTOLERANCIAS Y PLANTILLAS */}
            <div className="card">
              <div className="card-title">⚠️ Intolerancias</div>
              {form.intolerancias.length>0&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
                  {form.intolerancias.map((a:string,i:number)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:99,background:'var(--ambl)',border:'1px solid var(--amb)'}}>
                      <span style={{fontSize:10,color:'#7A5800'}}>{a}</span>
                      <button onClick={()=>up('intolerancias',form.intolerancias.filter((_:any,j:number)=>j!==i))} style={{fontSize:10,color:'#7A5800',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <input className="input" placeholder="🔍 Buscar intolerancia..." value={buscarIntol} onChange={e=>setBuscarIntol(e.target.value)} style={{marginBottom:6,fontSize:11}}/>
              {buscarIntol&&(
                <div style={{border:'1px solid var(--bd)',borderRadius:6,maxHeight:120,overflowY:'auto',marginBottom:6}}>
                  {intolBiblio.filter(a=>a.nombre.toLowerCase().includes(buscarIntol.toLowerCase())).slice(0,8).map(a=>(
                    <div key={a.id} onClick={()=>{
                      if(!form.intolerancias.includes(a.nombre)) up('intolerancias',[...form.intolerancias,a.nombre])
                      setBuscarIntol('')
                    }} style={{padding:'6px 10px',cursor:'pointer',fontSize:10,borderBottom:'1px solid var(--bl)'}}
                      onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'}
                      onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                      {a.nombre}
                    </div>
                  ))}
                  {intolBiblio.filter(a=>a.nombre.toLowerCase().includes(buscarIntol.toLowerCase())).length===0&&(
                    <div style={{padding:'6px 10px',fontSize:10,color:'var(--grl)'}}>
                      Sin resultados · <button className="btn btn-t btn-sm" onClick={()=>{setNuevoNombre(buscarIntol);setModalNuevaIntol(true)}}>+ Añadir</button>
                    </div>
                  )}
                </div>
              )}
              <div style={{borderTop:'1px solid var(--bl)',paddingTop:8,marginTop:4}}>
                <div className="field"><label>¿Usa plantillas?</label>
                  <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap'}}>
                    {[['No',false],['Sí',true]].map(([l,v])=>(
                      <span key={String(l)} onClick={()=>up('plantillas',v)} style={{padding:'4px 12px',borderRadius:99,border:`1px solid ${form.plantillas===v?'var(--g)':'var(--bd)'}`,background:form.plantillas===v?'var(--g)':'var(--w)',color:form.plantillas===v?'#fff':'var(--gr)',cursor:'pointer',fontSize:11}}>{l}</span>
                    ))}
                  </div>
                </div>
                {form.plantillas===true&&(
                  <div className="field">
                    <label>Tipo de plantilla</label>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:4}}>
                      {['Rígida','Semirrígida','Blanda','Descarga metatarsal','Propioceptiva','Personalizada'].map(t=>(
                        <span key={t} onClick={()=>up('tipo_plantilla',t)} style={{fontSize:10,padding:'3px 9px',borderRadius:99,border:`1px solid ${form.tipo_plantilla===t?'var(--g)':'var(--bd)'}`,background:form.tipo_plantilla===t?'var(--g)':'var(--w)',color:form.tipo_plantilla===t?'#fff':'var(--gr)',cursor:'pointer'}}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* MODALES AÑADIR A BIBLIOTECA */}
          {modalNuevoMed&&(
            <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalNuevoMed(false)}}>
              <div className="modal">
                <div className="modal-title">Añadir medicamento<button className="modal-close" onClick={()=>setModalNuevoMed(false)}>✕</button></div>
                <div className="field"><label>Nombre *</label><input className="input" value={nuevoNombre} onChange={e=>setNuevoNombre(e.target.value)} autoFocus/></div>
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button className="btn btn-d btn-sm" onClick={()=>setModalNuevoMed(false)}>Cancelar</button>
                  <div style={{flex:1}}/>
                  <button className="btn btn-p" onClick={async()=>{
                    if(!nuevoNombre) return
                    await supabase.from('medicamentos_biblioteca').insert({nombre:nuevoNombre,categoria:'Otros',activo:true})
                    setMedsBiblio(p=>[...p,{id:Date.now(),nombre:nuevoNombre,categoria:'Otros'}])
                    const freq = prompt('Frecuencia:','Diario')
                    up('medicacion',[...form.medicacion,{nombre:nuevoNombre,frecuencia:freq||''}])
                    setModalNuevoMed(false); setNuevoNombre(''); setBuscarMed('')
                  }}>💾 Añadir</button>
                </div>
              </div>
            </div>
          )}
          {modalNuevaAlerg&&(
            <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalNuevaAlerg(false)}}>
              <div className="modal">
                <div className="modal-title">Añadir alergia<button className="modal-close" onClick={()=>setModalNuevaAlerg(false)}>✕</button></div>
                <div className="field"><label>Nombre *</label><input className="input" value={nuevoNombre} onChange={e=>setNuevoNombre(e.target.value)} autoFocus/></div>
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button className="btn btn-d btn-sm" onClick={()=>setModalNuevaAlerg(false)}>Cancelar</button>
                  <div style={{flex:1}}/>
                  <button className="btn btn-p" onClick={async()=>{
                    if(!nuevoNombre) return
                    await supabase.from('alergias_biblioteca').insert({nombre:nuevoNombre,categoria:'Otros',activo:true})
                    setAlergiasBiblio(p=>[...p,{id:Date.now(),nombre:nuevoNombre,categoria:'Otros'}])
                    up('alergias',[...form.alergias,nuevoNombre])
                    setModalNuevaAlerg(false); setNuevoNombre(''); setBuscarAlerg('')
                  }}>💾 Añadir</button>
                </div>
              </div>
            </div>
          )}
          {modalNuevaIntol&&(
            <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalNuevaIntol(false)}}>
              <div className="modal">
                <div className="modal-title">Añadir intolerancia<button className="modal-close" onClick={()=>setModalNuevaIntol(false)}>✕</button></div>
                <div className="field"><label>Nombre *</label><input className="input" value={nuevoNombre} onChange={e=>setNuevoNombre(e.target.value)} autoFocus/></div>
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button className="btn btn-d btn-sm" onClick={()=>setModalNuevaIntol(false)}>Cancelar</button>
                  <div style={{flex:1}}/>
                  <button className="btn btn-p" onClick={async()=>{
                    if(!nuevoNombre) return
                    await supabase.from('intolerancias_biblioteca').insert({nombre:nuevoNombre,categoria:'Otros',activo:true})
                    setIntolBiblio(p=>[...p,{id:Date.now(),nombre:nuevoNombre,categoria:'Otros'}])
                    up('intolerancias',[...form.intolerancias,nuevoNombre])
                    setModalNuevaIntol(false); setNuevoNombre(''); setBuscarIntol('')
                  }}>💾 Añadir</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PASO 3 */}
      {step===3 && (
        <div className="g2">
          <div className="card">
            <div className="card-title">Operaciones / cirugías</div>
            <div style={{fontSize:9,color:'var(--grl)',marginBottom:7}}>Una por línea con el año si se recuerda.</div>
            <textarea className="input" style={{minHeight:100}} value={form.operaciones} onChange={e=>up('operaciones',e.target.value)} placeholder="ej. Apendicectomía 2018&#10;Artroscopia rodilla derecha 2020"/>
          </div>
          <div className="card">
            <div className="card-title">Patologías y alteraciones</div>
            <div style={{fontSize:9,color:'var(--grl)',marginBottom:7}}>Una por línea. Podrás subir informes desde la ficha del paciente.</div>
            <textarea className="input" style={{minHeight:100}} value={form.patologias} onChange={e=>up('patologias',e.target.value)} placeholder="ej. Hernia L4-L5 · activa&#10;Escoliosis leve&#10;Hiperpronación bilateral"/>
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


          {/* TESTS AÑADIDOS */}
          {testsValoracion.map((tv,ti)=>{
            const testLib = testsLib.find(t=>t.id===tv.test_id)
            const isActivo = testActivo===ti
            return (
              <div key={ti} style={{background:tv.resultado==='positivo'?'var(--redl)':tv.resultado==='negativo'?'var(--gl)':'var(--bl)',border:`1px solid ${tv.resultado==='positivo'?'#F5C8C8':tv.resultado==='negativo'?'var(--gm)':'var(--bd)'}`,borderRadius:'var(--rl)',padding:'11px 13px',marginBottom:7}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:isActivo?10:0}}>
                  {testLib?.imagen_url&&<img src={testLib.imagen_url} alt={tv.nombre} style={{width:36,height:36,objectFit:'cover',borderRadius:4,flexShrink:0}}/>}
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{tv.nombre} · <span style={{fontSize:9,color:'var(--grl)'}}>{tv.lado}</span></div>
                    <div style={{fontSize:9,color:tv.resultado==='positivo'?'var(--red)':tv.resultado==='negativo'?'var(--gd)':'var(--grl)',fontWeight:500}}>
                      {tv.resultado==='positivo'?'+ Positivo':tv.resultado==='negativo'?'− Negativo':'Sin resultado'}
                    </div>
                  </div>
                  <button className="btn btn-t btn-sm" onClick={()=>setTestActivo(isActivo?null:ti)}>
                    {isActivo?'▲ Cerrar':'✎ Editar'}
                  </button>
                  <button onClick={()=>setTestsValoracion(prev=>prev.filter((_,i)=>i!==ti))} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 5px'}}>✕</button>
                </div>
                {isActivo && (
                  <div>
                    <div className="g2" style={{marginBottom:8}}>
                      <div className="field"><label>Lado</label>
                        <select className="input" value={tv.lado} onChange={e=>{const tv2=[...testsValoracion];tv2[ti]={...tv2[ti],lado:e.target.value};setTestsValoracion(tv2)}}>
                          <option value="bilateral">Bilateral</option>
                          <option value="derecho">Derecho</option>
                          <option value="izquierdo">Izquierdo</option>
                        </select>
                      </div>
                    </div>
                    {tv.items_resultado.length>0 ? (
                      <div style={{marginBottom:8}}>
                        {tv.items_resultado.map((item,ii)=>(
                          <div key={ii} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 9px',background:item.marcado?'var(--redl)':'var(--w)',borderRadius:5,border:`1px solid ${item.marcado?'#F5C8C8':'var(--bd)'}`,marginBottom:3,transition:'all .15s'}}>
                            <input type="checkbox" checked={item.marcado} onChange={e=>{const tv2=[...testsValoracion];const its=[...tv2[ti].items_resultado];its[ii]={...its[ii],marcado:e.target.checked};tv2[ti]={...tv2[ti],items_resultado:its,resultado:calcularResultadoVal(its,testLib?.logica)};setTestsValoracion(tv2)}} style={{width:16,height:16,accentColor:'var(--red)',cursor:'pointer'}}/>
                            <span style={{flex:1,fontSize:11,color:'var(--n)',fontWeight:item.marcado?400:300}}>{item.nombre}</span>
                            {item.tiene_grados&&item.marcado&&(
                              <div style={{display:'flex',alignItems:'center',gap:4}}>
                                <input type="number" value={item.grados||''} onChange={e=>{const tv2=[...testsValoracion];const its=[...tv2[ti].items_resultado];its[ii]={...its[ii],grados:e.target.value};tv2[ti]={...tv2[ti],items_resultado:its};setTestsValoracion(tv2)}}
                                  style={{width:50,fontSize:11,padding:'2px 4px',border:'1px solid var(--red)',borderRadius:3,background:'var(--redl)',textAlign:'center',fontFamily:'system-ui'}} placeholder="0"/>
                                <span style={{fontSize:10,color:'var(--red)'}}>°</span>
                              </div>
                            )}
                          </div>
                        ))}
                        <div style={{padding:'6px 10px',borderRadius:5,background:tv.resultado==='positivo'?'var(--redl)':'var(--gl)',border:`1px solid ${tv.resultado==='positivo'?'var(--red)':'var(--gm)'}`,fontSize:10,fontWeight:500,color:tv.resultado==='positivo'?'var(--red)':'var(--gd)',marginTop:6}}>
                          {tv.resultado==='positivo'?'+ Resultado: Positivo':'− Resultado: Negativo'} · calculado automáticamente
                        </div>
                      </div>
                    ) : (
                      <div style={{display:'flex',gap:6,marginBottom:8}}>
                        {[['positivo','+ Positivo'],['negativo','− Negativo']].map(([v,l])=>(
                          <div key={v} onClick={()=>{const tv2=[...testsValoracion];tv2[ti]={...tv2[ti],resultado:v};setTestsValoracion(tv2)}}
                            style={{flex:1,padding:'8px',borderRadius:'var(--rl)',border:`2px solid ${tv.resultado===v?(v==='positivo'?'var(--red)':'var(--g)'):'var(--bd)'}`,background:tv.resultado===v?(v==='positivo'?'var(--redl)':'var(--gl)'):'var(--w)',cursor:'pointer',textAlign:'center',transition:'all .15s'}}>
                            <div style={{fontSize:11,fontWeight:500,color:tv.resultado===v?(v==='positivo'?'var(--red)':'var(--gd)'):'var(--grl)'}}>{l}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="field"><label>Observaciones</label>
                      <textarea className="input" value={tv.observaciones} onChange={e=>{const tv2=[...testsValoracion];tv2[ti]={...tv2[ti],observaciones:e.target.value};setTestsValoracion(tv2)}} style={{minHeight:44}} placeholder="Notas sobre este test..."/>
                    </div>
                    <div className="field"><label>Fecha de revisión</label>
                      <input type="date" className="input" value={tv.fecha_repeticion} onChange={e=>{const tv2=[...testsValoracion];tv2[ti]={...tv2[ti],fecha_repeticion:e.target.value};setTestsValoracion(tv2)}} min={new Date().toISOString().split('T')[0]}/>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* AÑADIR TEST */}
          <div style={{background:'var(--bl)',border:'1.5px dashed var(--bm)',borderRadius:'var(--rl)',padding:'11px 13px',marginTop:6}}>
            <div style={{fontSize:10,fontWeight:500,color:'var(--n)',marginBottom:8}}>+ Añadir test de la biblioteca</div>
            <select className="input" onChange={e=>{
              if (!e.target.value) return
              const t = testsLib.find(t=>t.id===e.target.value)
              if (!t) return
              const hoy = new Date(); hoy.setMonth(hoy.getMonth()+(t.frecuencia_meses||3))
              setTestsValoracion(prev=>[...prev,{
                test_id:t.id, nombre:t.nombre, lado:'bilateral',
                items_resultado:(t.items||[]).map((item:any)=>({...item,marcado:false,grados:''})),
                resultado:'sin_realizar', observaciones:'',
                fecha_repeticion:hoy.toISOString().split('T')[0],
                frecuencia_meses:t.frecuencia_meses||3
              }])
              setTestActivo(testsValoracion.length)
              e.target.value=''
            }}>
              <option value="">Seleccionar test...</option>
              {testsLib.filter(t=>{ const ladosUsados=testsValoracion.filter(tv=>tv.test_id===t.id).map(tv=>tv.lado); return !['bilateral','derecho','izquierdo'].every(l=>ladosUsados.includes(l)) }).map(t=>(
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
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
