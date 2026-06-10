'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import PasoPaciente from './components/PasoPaciente'
import PasoAnamnesis from './components/PasoAnamnesis'
import PasoHistorial from './components/PasoHistorial'
import PasoTests from './components/PasoTests'
import PasoPlan from './components/PasoPlan'
import PasoResumen from './components/PasoResumen'

const STEPS = ['Paciente','Anamnesis','Historial','Tests','Plan','Resumen']

export default function ValoracionPage() {
  const [step, setStep] = useState(1)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const router = useRouter()
  const [testsLib, setTestsLib] = useState<any[]>([])
  const [testsValoracion, setTestsValoracion] = useState<any[]>([])
  const [testActivo, setTestActivo] = useState<number|null>(null)
  const [comoNosConocioOpts, setComoNosConocioOpts] = useState<string[]>(['Recomendación de un conocido','Instagram','Google','Facebook','Pasó por aquí','Otro'])
  const [tiposJornada, setTiposJornada] = useState<string[]>(['Sentado','Sedentario','De pie','Mixto','Esfuerzo físico','Conductor','Pantallas','Trabajo manual'])
  const [tiposPlantilla, setTiposPlantilla] = useState<string[]>(['Rígida','Semirrígida','Blanda','Descarga metatarsal','Propioceptiva','Personalizada'])
  const [deportesOpts, setDeportesOpts] = useState<string[]>(['Fútbol','Pádel','Tenis','Natación','Ciclismo','Running','CrossFit','Yoga','Pilates','Gimnasio','Golf','Baloncesto','Senderismo','Otro'])
  const [medsBiblio, setMedsBiblio] = useState<any[]>([])
  const [patsBiblio, setPatsBiblio] = useState<any[]>([])
  const [molsBiblio, setMolsBiblio] = useState<any[]>([])
  const [opsBiblio, setOpsBiblio] = useState<any[]>([])
  const [alergiasBiblio, setAlergiasBiblio] = useState<any[]>([])
  const [intolBiblio, setIntolBiblio] = useState<any[]>([])
  const [firmaAceptada, setFirmaAceptada] = useState(false)
  const [imagenesAceptada, setImagenesAceptada] = useState(false)
  const [firmaCanvas, setFirmaCanvas] = useState<string>('')
  const [dibujando, setDibujando] = useState(false)
  const [form, setForm] = useState({
    paciente_id:'',nombre:'',apellidos:'',nombre_clinica:'',telefono:'',email:'',dni:'',fecha_nacimiento:'',altura_cm:'',peso_kg:'',como_nos_conocio:'',
    anamnesis:'',trabajo:'',tipo_jornada:'',objetivo1:'',objetivo2:'',objetivo3:'',deseo:'',borg:5,estres:5,
    hace_deporte:false as boolean,deportes:[] as string[],
    plantillas:false as boolean,tipo_plantilla:'' as string,
    medicacion:[] as any[],operaciones:[] as any[],alergias:[] as string[],intolerancias:[] as string[],
    patologias:[] as any[],molestias:[] as any[],dieta:'sin_restricciones',
    tipo_clase_def:'entrenamiento',bono:'reducido',dias_asistencia:'',franja:'manana',notas_plan:'',
  })

  const up = (k: string, v: any) => setForm(p=>({...p,[k]:v}))

  useEffect(() => {
    supabase.from('pacientes').select('id,nombre,apellidos').eq('estado','activo').order('nombre').then(({data})=>setPacientes(data||[]))
    supabase.from('medicamentos_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setMedsBiblio(data||[]))
    supabase.from('patologias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setPatsBiblio(data||[]))
    supabase.from('molestias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setMolsBiblio(data||[]))
    supabase.from('operaciones_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setOpsBiblio(data||[]))
    supabase.from('alergias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setAlergiasBiblio(data||[]))
    supabase.from('intolerancias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setIntolBiblio(data||[]))
    supabase.from('tests').select('*').order('nombre').then(({data})=>setTestsLib(data||[]))
    supabase.from('ajustes').select('clave,valor').then(({data})=>{
      if(data){
        const map: Record<string,string> = {}
        data.forEach((a:any)=>{map[a.clave]=a.valor||''})
        if(map.como_nos_conocio) setComoNosConocioOpts(JSON.parse(map.como_nos_conocio))
        if(map.tipos_jornada) setTiposJornada(JSON.parse(map.tipos_jornada))
        if(map.tipos_plantilla) setTiposPlantilla(JSON.parse(map.tipos_plantilla))
        if(map.deportes_lista) setDeportesOpts(JSON.parse(map.deportes_lista))
      }
    })
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
      const diasMap: Record<string,number> = { reducido:2, esencial:3, progreso:4, avanzado:5, individual:1, bono4:1 }
      await Promise.all([
        supabase.from('bonos').insert({ paciente_id:pacienteId, tipo:form.bono, dias_semana:diasMap[form.bono]||2, estado_pago:'pendiente', mes:new Date().getMonth()+1, anio:new Date().getFullYear(), fecha_inicio:new Date().toISOString().split('T')[0], activo:true }),
        supabase.from('valoraciones').insert({ paciente_id:pacienteId, fecha:new Date().toISOString().split('T')[0], tipo:'inicial', anamnesis:form.anamnesis, trabajo:form.trabajo, tipo_jornada:form.tipo_jornada, objetivos:[form.objetivo1,form.objetivo2,form.objetivo3].filter(Boolean), deseo:form.deseo, borg:form.borg, estres:form.estres, estado_general:JSON.stringify({operaciones:form.operaciones,alergias:form.alergias,intolerancias:form.intolerancias,dieta:form.dieta,plantillas:form.plantillas,tipo_plantilla:form.tipo_plantilla,hace_deporte:form.hace_deporte,deportes:form.deportes,notas_plan:form.notas_plan}), firma_imagen:firmaCanvas||null, consent_datos:firmaAceptada, consent_imagenes:imagenesAceptada, consent_fecha:(firmaAceptada||imagenesAceptada)?new Date().toISOString():null }),
        ...form.molestias.filter((m:any)=>m.zona).map((m:any)=>supabase.from('molestias').insert({ paciente_id:pacienteId, zona:m.zona, tipo:m.tipo, eva:m.eva, observaciones:m.observaciones, activa:true })),
        ...form.patologias.map((p:any)=>supabase.from('patologias').insert({ paciente_id:pacienteId, nombre:p.nombre, estado:p.estado, descripcion:p.observaciones||'' })),
        ...form.medicacion.map((m:any)=>supabase.from('medicamentos').insert({ paciente_id:pacienteId, nombre:m.nombre, frecuencia:m.frecuencia||'' })),
        supabase.from('escalas').insert({ paciente_id:pacienteId, fecha:new Date().toISOString().split('T')[0], borg:form.borg, estres:form.estres }),
      ])
      for (const t of testsValoracion) {
        const lados = t.lados || {}
        const ladosConDato = Object.keys(lados).filter(k => lados[k] && lados[k].resultado && lados[k].resultado !== 'sin_realizar')
        const aGuardar = ladosConDato.length ? ladosConDato : Object.keys(lados)
        for (const ladoKey of aGuardar) {
          const d = lados[ladoKey]
          if (!d) continue
          await supabase.from('resultados_tests').insert({ test_id:t.test_id, paciente_id:pacienteId, fecha:new Date().toISOString().split('T')[0], resultado:d.resultado, observaciones:d.observaciones, fecha_repeticion:d.fecha_repeticion||null, lado:ladoKey, items_resultado:d.items_resultado })
        }
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
      {/* BARRA PROGRESO */}
      <div style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'12px 16px',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:8}}>
          {STEPS.map((s,i)=>{
            const idx=i+1; const cls=idx<step?'done':idx===step?'active':'pending'
            return (
              <div key={s} style={{display:'flex',alignItems:'center',flex:1}}>
                <div onClick={()=>idx<step&&setStep(idx)} style={{width:24,height:24,borderRadius:'50%',border:`1.5px solid ${cls==='done'?'var(--g)':cls==='active'?'var(--g)':'var(--bd)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:500,color:cls==='done'||cls==='active'?'var(--g)':'var(--grl)',background:cls==='done'?'var(--g)':'var(--w)',cursor:idx<step?'pointer':'default',flexShrink:0}}>
                  {cls==='done'?<span style={{color:'#fff'}}>✓</span>:idx}
                </div>
                {i<STEPS.length-1&&<div style={{flex:1,height:1.5,background:idx<step?'var(--g)':'var(--bd)',margin:'0 3px'}}/>}
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

      {step===1&&<PasoPaciente form={form} up={up} pacientes={pacientes} comoNosConocioOpts={comoNosConocioOpts} firmaCanvas={firmaCanvas} setFirmaCanvas={setFirmaCanvas} firmaAceptada={firmaAceptada} setFirmaAceptada={setFirmaAceptada} imagenesAceptada={imagenesAceptada} setImagenesAceptada={setImagenesAceptada} dibujando={dibujando} setDibujando={setDibujando}/>}
      {step===2&&<PasoAnamnesis form={form} up={up} tiposJornada={tiposJornada} deportesOpts={deportesOpts} tiposPlantilla={tiposPlantilla}/>}
      {step===3&&<PasoHistorial form={form} up={up} medsBiblio={medsBiblio} alergiasBiblio={alergiasBiblio} intolBiblio={intolBiblio} opsBiblio={opsBiblio} patsBiblio={patsBiblio} molsBiblio={molsBiblio} setMedsBiblio={setMedsBiblio} setAlergiasBiblio={setAlergiasBiblio} setIntolBiblio={setIntolBiblio} setOpsBiblio={setOpsBiblio} setPatsBiblio={setPatsBiblio} setMolsBiblio={setMolsBiblio}/>}
      {step===4&&<PasoTests testsLib={testsLib} testsValoracion={testsValoracion} setTestsValoracion={setTestsValoracion} testActivo={testActivo} setTestActivo={setTestActivo}/>}
      {step===5&&<PasoPlan form={form} up={up}/>}
      {step===6&&<PasoResumen form={form} testsValoracion={testsValoracion} guardando={guardando} finalizar={finalizar}/>}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12,paddingTop:12,borderTop:'1px solid var(--bd)'}}>
        <button className="btn btn-s" onClick={()=>setStep(s=>Math.max(1,s-1))} style={{visibility:step===1?'hidden':'visible'}}>← Atrás</button>
        <span style={{fontSize:10,color:'var(--grl)'}}>Paso {step} de {STEPS.length} · {STEPS[step-1]}</span>
        {step<STEPS.length?<button className="btn btn-p" onClick={()=>setStep(s=>Math.min(STEPS.length,s+1))}>Continuar →</button>:<div/>}
      </div>
    </>
  )
}
