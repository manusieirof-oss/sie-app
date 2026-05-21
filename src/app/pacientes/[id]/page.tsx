'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'

function EntrenoTab({ pacienteId, sesiones, supabase, onRefresh }: { pacienteId: string, sesiones: any[], supabase: any, onRefresh: () => void }) {
  const [citas, setCitas] = useState<any[]>([])
  const [sesionesDisp, setSesionesDisp] = useState<any[]>([])
  const [seleccionadas, setSeleccionadas] = useState<string[]>([])
  const [sesionAsignar, setSesionAsignar] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [filtro, setFiltro] = useState<'todas'|'sin_sesion'|'con_sesion'>('todas')

  useEffect(() => { cargarCitas() }, [])

  async function cargarCitas() {
    const hoy = new Date().toISOString().split('T')[0]
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from('citas').select('*, sesiones:sesion_id(id,nombre)').eq('paciente_id', pacienteId).gte('fecha', hoy).neq('estado','cancelada').order('fecha').order('hora'),
      supabase.from('sesiones').select('id,nombre,descripcion').eq('paciente_id', pacienteId).order('created_at', {ascending:false}),
    ])
    setCitas(c||[])
    setSesionesDisp(s||[])
  }

  async function asignarEnBloque() {
    if (!sesionAsignar || seleccionadas.length===0) { alert('Selecciona citas y una sesión'); return }
    setGuardando(true)
    for (const citaId of seleccionadas) {
      await supabase.from('citas').update({ sesion_id: sesionAsignar }).eq('id', citaId)
    }
    setSeleccionadas([])
    setSesionAsignar('')
    setGuardando(false)
    cargarCitas()
    onRefresh()
  }

  function toggleCita(id: string) {
    setSeleccionadas(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id])
  }

  function seleccionarTodas() {
    const citasFiltradas = getCitasFiltradas()
    if (seleccionadas.length === citasFiltradas.length) setSeleccionadas([])
    else setSeleccionadas(citasFiltradas.map(c=>c.id))
  }

  function getCitasFiltradas() {
    if (filtro==='sin_sesion') return citas.filter(c=>!c.sesiones)
    if (filtro==='con_sesion') return citas.filter(c=>c.sesiones)
    return citas
  }

  const citasFiltradas = getCitasFiltradas()
  const sinSesion = citas.filter(c=>!c.sesiones).length
  const conSesion = citas.filter(c=>c.sesiones).length

  return (
    <div>
      <div className="info-pill" style={{marginBottom:10}}>
        {citas.length} citas futuras · <span style={{color:'var(--red)',fontWeight:500}}>{sinSesion} sin sesión</span> · <span style={{color:'var(--g)',fontWeight:500}}>{conSesion} con sesión</span>
      </div>

      {/* ASIGNAR EN BLOQUE */}
      {seleccionadas.length>0 && (
        <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:'var(--rl)',padding:'10px 13px',marginBottom:10,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <span style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{seleccionadas.length} citas seleccionadas</span>
          <select className="input" style={{flex:1,minWidth:200}} value={sesionAsignar} onChange={e=>setSesionAsignar(e.target.value)}>
            <option value="">Seleccionar sesión...</option>
            {sesionesDisp.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <button className="btn btn-p btn-sm" onClick={asignarEnBloque} disabled={guardando}>
            {guardando?'⏳ Asignando...':'✓ Asignar a todas'}
          </button>
          <button className="btn btn-d btn-sm" onClick={()=>setSeleccionadas([])}>✕ Cancelar</button>
        </div>
      )}

      {/* FILTROS */}
      <div style={{display:'flex',gap:5,marginBottom:8,alignItems:'center'}}>
        {[['todas','Todas'],['sin_sesion','Sin sesión'],['con_sesion','Con sesión']].map(([k,l])=>(
          <span key={k} onClick={()=>setFiltro(k as any)} style={{fontSize:9,padding:'3px 9px',borderRadius:99,border:'1px solid var(--bd)',cursor:'pointer',background:filtro===k?'var(--g)':'var(--w)',color:filtro===k?'#fff':'var(--gr)'}}>{l}</span>
        ))}
        <div style={{flex:1}}/>
        <button className="btn btn-t btn-sm" onClick={seleccionarTodas}>
          {seleccionadas.length===citasFiltradas.length&&citasFiltradas.length>0?'Deseleccionar todas':'Seleccionar todas'}
        </button>
      </div>

      {/* LISTA DE CITAS */}
      <div style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden'}}>
        {citasFiltradas.length===0 && <div style={{padding:20,textAlign:'center',fontSize:11,color:'var(--grl)'}}>Sin citas futuras</div>}
        {citasFiltradas.map((c,i)=>{
          const sel = seleccionadas.includes(c.id)
          const tieneSesion = !!c.sesiones
          const fecha = new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})
          return (
            <div key={c.id} onClick={()=>toggleCita(c.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:i<citasFiltradas.length-1?'1px solid var(--bl)':'none',cursor:'pointer',background:sel?'var(--gl)':'var(--w)',transition:'background .1s'}}
              onMouseOver={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='rgba(90,150,158,.04)'}}
              onMouseOut={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='var(--w)'}}>
              <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${sel?'var(--g)':'var(--bd)'}`,background:sel?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s'}}>
                {sel&&<span style={{fontSize:10,color:'#fff',fontWeight:700}}>✓</span>}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{fecha} · {c.hora?.slice(0,5)} · Sala {c.sala}</div>
                {tieneSesion ? (
                  <div style={{fontSize:9,color:'var(--g)',marginTop:1,fontWeight:400}}>📋 {c.sesiones.nombre}</div>
                ) : (
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1,fontWeight:300}}>Sin sesión asignada</div>
                )}
              </div>
              <div style={{width:8,height:8,borderRadius:'50%',background:tieneSesion?'var(--g)':'var(--bm)',flexShrink:0}}/>
            </div>
          )
        })}
      </div>

      {sesionesDisp.length===0 && (
        <div style={{marginTop:10,padding:'10px 13px',background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:'var(--rl)',fontSize:10,color:'#7A5800'}}>
          Este paciente no tiene sesiones creadas. Ve a 🏋 Entrenamiento para crear la primera.
        </div>
      )}
    </div>
  )
}

export default function FichaPacientePage() {
  const { id } = useParams()
  const router = useRouter()
  const [tab, setTab] = useState('ficha')
  const [pac, setPac] = useState<any>(null)
  const [bono, setBono] = useState<any>(null)
  const [molestias, setMolestias] = useState<any[]>([])
  const [patologias, setPatologias] = useState<any[]>([])
  const [medicamentos, setMedicamentos] = useState<any[]>([])
  const [escalas, setEscalas] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [testsDisp, setTestsDisp] = useState<any[]>([])
  const [citas, setCitas] = useState<any[]>([])
  const [sesiones, setSesiones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<any>({})
  const [modalBono, setModalBono] = useState(false)
  const [modalPausa, setModalPausa] = useState(false)
  const [nuevoBono, setNuevoBono] = useState({ tipo:'esencial', estado_pago:'pendiente' })
  const [pausa, setPausa] = useState({ desde: new Date().toISOString().split('T')[0], hasta: '' })
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [modalRegistrarTest, setModalRegistrarTest] = useState(false)
  const [testSeleccionado, setTestSeleccionado] = useState('')
  const [resultadoTest, setResultadoTest] = useState('positivo')
  const [obsTest, setObsTest] = useState('')
  const [fechaRevTest, setFechaRevTest] = useState('')
  const [itemsTest, setItemsTest] = useState<{nombre:string,tiene_grados:boolean,marcado:boolean,grados:string}[]>([])
  const [ladoTest, setLadoTest] = useState('bilateral')
  const [testSeleccionadoObj, setTestSeleccionadoObj] = useState<any>(null)
  const [procesando, setProcesando] = useState(false)

  const mes = new Date().getMonth()+1
  const anio = new Date().getFullYear()

  useEffect(() => { if(id) cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const [{ data: p },{ data: b },{ data: m },{ data: pat },{ data: med },{ data: esc },{ data: c },{ data: s }] = await Promise.all([
      supabase.from('pacientes').select('*').eq('id',id).single(),
      supabase.from('bonos').select('*').eq('paciente_id',id).eq('activo',true).order('created_at',{ascending:false}).limit(1).maybeSingle(),
      supabase.from('molestias').select('*').eq('paciente_id',id).order('created_at',{ascending:false}),
      supabase.from('patologias').select('*').eq('paciente_id',id).order('created_at',{ascending:false}),
      supabase.from('medicamentos').select('*').eq('paciente_id',id),
      supabase.from('escalas').select('*').eq('paciente_id',id).order('fecha',{ascending:false}).limit(5),
      supabase.from('resultados_tests').select('*, tests(nombre,descripcion)').eq('paciente_id',id).order('fecha',{ascending:false}),
      supabase.from('citas').select('*').eq('paciente_id',id).gte('fecha',new Date().toISOString().split('T')[0]).order('fecha').limit(10),
      supabase.from('sesiones').select('*').eq('paciente_id',id).order('created_at',{ascending:false}).limit(5),
    ])
    const [{ data: t }, { data: td }] = await Promise.all([
      supabase.from('resultados_tests').select('*, tests(nombre,descripcion)').eq('paciente_id',id).order('fecha',{ascending:false}),
      supabase.from('tests').select('*').order('nombre'),
    ])
    setPac(p); setBono(b); setMolestias(m||[]); setPatologias(pat||[])
    setMedicamentos(med||[]); setEscalas(esc||[]); setCitas(c||[]); setSesiones(s||[])
    setTests(t||[]); setTestsDisp(td||[])
    setForm(p||{})
    setLoading(false)
  }

  async function guardarEdicion() {
    await supabase.from('pacientes').update({
      nombre:form.nombre, apellidos:form.apellidos, telefono:form.telefono,
      email:form.email, dni:form.dni, altura_cm:form.altura_cm,
      peso_kg:form.peso_kg, tipo_clase:form.tipo_clase, notas:form.notas
    }).eq('id',id)
    setEditando(false); cargar()
  }

  function seleccionarTest(testId: string) {
    setTestSeleccionado(testId)
    const t = testsDisp.find((t:any)=>t.id===testId)
    setTestSeleccionadoObj(t||null)
    if (t && t.items && t.items.length>0) {
      setItemsTest(t.items.map((item:any)=>({...item,marcado:false,grados:''})))
    } else {
      setItemsTest([])
    }
    // Calcular fecha de revisión automáticamente
    if (t && t.frecuencia_meses) {
      const hoy = new Date()
      hoy.setMonth(hoy.getMonth() + t.frecuencia_meses)
      setFechaRevTest(hoy.toISOString().split('T')[0])
    } else {
      setFechaRevTest('')
    }
  }

  function calcularResultado(): string {
    if (itemsTest.length===0) return resultadoTest
    const marcados = itemsTest.filter(i=>i.marcado).length
    if (testSeleccionadoObj?.logica==='todos') {
      return marcados===itemsTest.length?'positivo':'negativo'
    }
    return marcados>0?'positivo':'negativo'
  }

  async function registrarTest() {
    if (!testSeleccionado) { alert('Selecciona un test'); return }
    const resultado = itemsTest.length>0 ? calcularResultado() : resultadoTest
    await supabase.from('resultados_tests').insert({
      paciente_id: id,
      test_id: testSeleccionado,
      fecha: new Date().toISOString().split('T')[0],
      resultado,
      observaciones: obsTest,
      fecha_repeticion: fechaRevTest || null,
      lado: ladoTest,
      items_resultado: itemsTest.map(i=>({nombre:i.nombre,marcado:i.marcado,grados:i.grados,tiene_grados:i.tiene_grados})),
    })
    setModalRegistrarTest(false)
    setTestSeleccionado(''); setResultadoTest('positivo'); setObsTest(''); setFechaRevTest('')
    setItemsTest([]); setLadoTest('bilateral'); setTestSeleccionadoObj(null)
    cargar()
  }

  async function registrarTestAntiguo() {
    if (!testSeleccionado) { alert('Selecciona un test'); return }
    await supabase.from('resultados_tests').insert({
      paciente_id: id,
      test_id: testSeleccionado,
      fecha: new Date().toISOString().split('T')[0],
      resultado: resultadoTest,
      observaciones: obsTest,
      fecha_repeticion: fechaRevTest || null,
    })
    setModalRegistrarTest(false)
    setTestSeleccionado(''); setResultadoTest('positivo'); setObsTest(''); setFechaRevTest('')
    cargar()
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoFoto(true)
    const ext = file.name.split('.').pop()
    const path = `${id}/foto.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(path, file, { upsert: true })
    if (error) { alert('Error al subir foto: ' + error.message); setSubiendoFoto(false); return }
    const { data: { publicUrl } } = supabase.storage.from('fotos').getPublicUrl(path)
    await supabase.from('pacientes').update({ foto_url: publicUrl }).eq('id', id)
    setSubiendoFoto(false)
    cargar()
  }

  async function darDeBaja() {
    if (!confirm(`¿Dar de baja a ${pac.nombre} ${pac.apellidos}?\n\nSus datos se conservan pero se eliminarán TODAS sus citas futuras automáticamente.`)) return
    setProcesando(true)
    const hoy = new Date().toISOString().split('T')[0]
    await supabase.from('citas').delete().eq('paciente_id',id).gte('fecha',hoy).eq('estado','programada')
    await supabase.from('pacientes').update({ estado:'baja' }).eq('id',id)
    setProcesando(false)
    alert('✓ Paciente dado de baja. Sus citas futuras han sido eliminadas.')
    router.push('/pacientes')
  }

  async function aplicarPausa() {
    if (!pausa.hasta) { alert('Indica la fecha de vuelta'); return }
    if (pausa.hasta <= pausa.desde) { alert('La fecha de vuelta debe ser posterior a la de inicio'); return }
    setProcesando(true)
    const { data: citasPausa } = await supabase.from('citas').select('id').eq('paciente_id',id).gte('fecha',pausa.desde).lte('fecha',pausa.hasta).eq('estado','programada')
    if (citasPausa && citasPausa.length > 0) {
      await supabase.from('citas').update({ estado:'cancelada' }).eq('paciente_id',id).gte('fecha',pausa.desde).lte('fecha',pausa.hasta).eq('estado','programada')
    }
    await supabase.from('pacientes').update({ estado:'pausa', notas:(pac.notas||'')+`\n[PAUSA: ${pausa.desde} → ${pausa.hasta}]` }).eq('id',id)
    setProcesando(false)
    setModalPausa(false)
    alert(`✓ Pausa aplicada. ${citasPausa?.length||0} citas canceladas del ${pausa.desde} al ${pausa.hasta}.\nEl paciente se reactivará automáticamente al volver.`)
    cargar()
  }

  async function reactivar() {
    if (!confirm(`¿Reactivar a ${pac.nombre} ${pac.apellidos}?`)) return
    await supabase.from('pacientes').update({ estado:'activo' }).eq('id',id)
    alert('✓ Paciente reactivado. Recuerda crear sus nuevas citas en la agenda.')
    cargar()
  }

  async function eliminarPaciente() {
    if (!confirm(`¿Eliminar DEFINITIVAMENTE a ${pac.nombre} ${pac.apellidos}?\n\nEsta acción NO se puede deshacer. Se borrarán todos sus datos, citas y sesiones.`)) return
    if (!confirm('Segunda confirmación: ¿estás completamente seguro?')) return
    setProcesando(true)
    await supabase.from('pacientes').delete().eq('id',id)
    router.push('/pacientes')
  }

  async function toggleMolestia(molId: string, activa: boolean) {
    await supabase.from('molestias').update({ activa:!activa }).eq('id',molId); cargar()
  }

  async function crearBono() {
    if (bono) await supabase.from('bonos').update({ activo:false }).eq('id',bono.id)
    const diasMap: Record<string,number> = { esencial:2, progreso:3, avanzado:4, avanzado_mas1:5 }
    await supabase.from('bonos').insert({ paciente_id:id, tipo:nuevoBono.tipo, dias_semana:diasMap[nuevoBono.tipo], estado_pago:nuevoBono.estado_pago, mes, anio, fecha_inicio:new Date().toISOString().split('T')[0], activo:true })
    setModalBono(false); cargar()
  }

  async function cambiarPago(estado: string) {
    if (!bono) return
    await supabase.from('bonos').update({ estado_pago:estado }).eq('id',bono.id); cargar()
  }

  const edad = pac?.fecha_nacimiento ? Math.floor((Date.now()-new Date(pac.fecha_nacimiento).getTime())/(1000*60*60*24*365.25)) : null
  const iniciales = pac ? `${pac.nombre?.[0]||''}${pac.apellidos?.[0]||''}`.toUpperCase() : ''
  const bonoLabel: Record<string,string> = { esencial:'Esencial · 2d/sem', progreso:'Progreso · 3d/sem', avanzado:'Avanzado · 4d/sem', avanzado_mas1:'Avanzado +1 · 5d/sem' }
  const pagoBadge: Record<string,string> = { pagado:'badge-g', pendiente:'badge-pen', impago:'badge-imp' }
  const pagoLabel: Record<string,string> = { pagado:'✓ Pagado', pendiente:'⏳ Pendiente', impago:'⚠ Impago' }
  const estadoColor: Record<string,string> = { activo:'var(--g)', baja:'var(--red)', pausa:'var(--amb)' }
  const estadoLabel: Record<string,string> = { activo:'● Activo', baja:'○ Baja', pausa:'⏸ Pausa' }

  if (loading) return <div className="loading">Cargando ficha...</div>
  if (!pac) return <div className="loading">Paciente no encontrado</div>

  return (
    <>
      {/* CABECERA */}
      <div className="pat-header">
        <div style={{position:'relative',flexShrink:0}}>
          {pac.foto_url ? (
            <img src={pac.foto_url} alt={pac.nombre} style={{width:46,height:46,borderRadius:'50%',objectFit:'cover',border:'1.5px solid var(--g)'}}/>
          ) : (
            <div className="pat-avatar">{iniciales}</div>
          )}
          <label style={{position:'absolute',bottom:-4,right:-4,width:20,height:20,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'2px solid var(--n)'}}>
            {subiendoFoto?'⏳':'📷'}
            <input type="file" accept="image/*" onChange={subirFoto} style={{display:'none'}}/>
          </label>
        </div>

        <div style={{flex:1}}>
          {editando ? (
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <input className="input" value={form.nombre||''} onChange={e=>setForm((p:any)=>({...p,nombre:e.target.value}))} style={{flex:1,minWidth:120,background:'rgba(255,255,255,.1)',color:'#fff',borderColor:'var(--gm)'}} placeholder="Nombre"/>
              <input className="input" value={form.apellidos||''} onChange={e=>setForm((p:any)=>({...p,apellidos:e.target.value}))} style={{flex:1,minWidth:120,background:'rgba(255,255,255,.1)',color:'#fff',borderColor:'var(--gm)'}} placeholder="Apellidos"/>
            </div>
          ) : (
            <div className="pat-name">{pac.nombre} {pac.apellidos}</div>
          )}
          <div className="pat-meta">{edad?`${edad} años · `:''}{pac.altura_cm?`${pac.altura_cm} cm · `:''}{pac.peso_kg?`${pac.peso_kg} kg`:''}</div>
          <div style={{display:'flex',gap:5,marginTop:5,flexWrap:'wrap'}}>
            <span style={{fontSize:8,fontWeight:500,padding:'2px 8px',borderRadius:99,background:'rgba(255,255,255,.1)',color:estadoColor[pac.estado]||'var(--g)'}}>
              {estadoLabel[pac.estado]||'● Activo'}
            </span>
            {bono && <span className="badge badge-b">{bonoLabel[bono.tipo]||bono.tipo}</span>}
            {bono && <span className={`badge ${pagoBadge[bono.estado_pago]||'badge-b'}`}>{pagoLabel[bono.estado_pago]}</span>}
          </div>
        </div>

        <div style={{display:'flex',gap:5,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end'}}>
          <button className="btn btn-s btn-sm" onClick={()=>router.push('/pacientes')}>← Listado</button>
          {editando ? (
            <>
              <button className="btn btn-d btn-sm" onClick={()=>setEditando(false)}>Cancelar</button>
              <button className="btn btn-p btn-sm" onClick={guardarEdicion}>💾 Guardar</button>
            </>
          ) : (
            <button className="btn btn-p btn-sm" onClick={()=>setEditando(true)}>✎ Editar</button>
          )}
          {pac.estado==='activo' && <>
            <button className="btn btn-t btn-sm" onClick={()=>setModalPausa(true)}>⏸ Pausa</button>
            <button className="btn btn-d btn-sm" onClick={darDeBaja} disabled={procesando}>○ Dar de baja</button>
          </>}
          {(pac.estado==='baja'||pac.estado==='pausa') && (
            <button className="btn btn-p btn-sm" onClick={reactivar} disabled={procesando}>▶ Reactivar</button>
          )}
          <button className="btn btn-d btn-sm" onClick={eliminarPaciente} disabled={procesando} style={{background:'var(--red)',color:'#fff',borderColor:'var(--red)'}}>
            {procesando?'⏳':'🗑 Eliminar'}
          </button>
        </div>
      </div>

      {/* AVISO BAJA/PAUSA */}
      {pac.estado!=='activo' && (
        <div style={{background:pac.estado==='baja'?'var(--redl)':'var(--ambl)',border:`1px solid ${pac.estado==='baja'?'var(--red)':'var(--amb)'}`,borderRadius:'var(--rl)',padding:'10px 14px',marginBottom:10,display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:16}}>{pac.estado==='baja'?'○':'⏸'}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:500,color:pac.estado==='baja'?'var(--red)':'#7A5800'}}>
              {pac.estado==='baja'?'Paciente dado de baja':'Paciente en pausa temporal'}
            </div>
            <div style={{fontSize:10,color:pac.estado==='baja'?'var(--red)':'#7A5800',fontWeight:300}}>
              {pac.estado==='baja'?'Sus citas futuras fueron eliminadas. Pulsa Reactivar si vuelve.':'Sus citas del periodo de pausa fueron canceladas.'}
            </div>
          </div>
          <button className="btn btn-p btn-sm" onClick={reactivar}>▶ Reactivar</button>
        </div>
      )}

      {/* TABS */}
      <div className="tabs">
        {[['ficha','📋 Ficha'],['salud','❤️ Salud'],['entreno','🏋 Entrenamiento']].map(([k,l])=>(
          <button key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {/* TAB FICHA */}
      {tab==='ficha' && (
        <div className="g2">
          <div>
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
                    </select>
                  </div>
                  <div className="field" style={{gridColumn:'1/-1'}}><label>Notas internas</label><textarea className="input" value={form.notas||''} onChange={e=>setForm((p:any)=>({...p,notas:e.target.value}))} style={{minHeight:60}}/></div>
                </div>
              ) : (
                <div>
                  {[['DNI',pac.dni],['Teléfono',pac.telefono],['Email',pac.email],['Tipo clase',pac.tipo_clase]].map(([l,v])=>v?(
                    <div key={l} style={{display:'flex',gap:8,marginBottom:5,fontSize:11}}>
                      <span style={{color:'var(--grl)',minWidth:70,fontWeight:300}}>{l}</span>
                      <span style={{fontWeight:400}}>{v}</span>
                    </div>
                  ):null)}
                  {pac.notas && <div style={{marginTop:8,padding:'7px 9px',background:'var(--bl)',borderRadius:5,fontSize:10,color:'var(--n)',fontWeight:300,whiteSpace:'pre-line'}}>{pac.notas}</div>}
                </div>
              )}
            </div>
            <div className="card">
              <div className="card-title">Próximas citas</div>
              {citas.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin citas programadas</div>}
              {citas.map(c=>(
                <div key={c.id} className="ri">
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})} · {c.hora?.slice(0,5)}</div>
                    <div style={{fontSize:9,color:'var(--grl)'}}>Sala {c.sala} · {c.tipo}</div>
                  </div>
                  <span className={`badge ${c.estado==='realizada'?'badge-g':'badge-b'}`}>{c.estado}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="card">
              <div className="card-title">Bono activo <button className="btn btn-s btn-sm" onClick={()=>setModalBono(true)}>{bono?'Cambiar':'+ Asignar'}</button></div>
              {bono ? (
                <div style={{background:'var(--bl)',border:'1px solid var(--bm)',borderRadius:7,padding:'9px 11px'}}>
                  <div style={{fontSize:12,fontWeight:400,color:'var(--n)',marginBottom:2}}>{bonoLabel[bono.tipo]||bono.tipo}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginBottom:8}}>Mes {mes}/{anio}</div>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                    {['pagado','pendiente','impago'].map(estado=>(
                      <button key={estado} className={`btn btn-sm ${bono.estado_pago===estado?'btn-p':'btn-s'}`} onClick={()=>cambiarPago(estado)}>
                        {pagoLabel[estado]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{fontSize:10,color:'var(--grl)',padding:'8px 0'}}>Sin bono asignado este mes</div>
              )}
            </div>
            <div className="card">
              <div className="card-title">Últimas sesiones</div>
              {sesiones.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin sesiones registradas</div>}
              {sesiones.map(s=>(
                <div key={s.id} className="ri">
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{s.nombre}</div>
                    <div style={{fontSize:9,color:'var(--grl)'}}>{s.duracion_min} min · {s.estado}</div>
                  </div>
                  <span className={`badge ${s.estado==='realizada'?'badge-g':s.estado==='lista'?'badge-pen':'badge-b'}`}>{s.estado}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB SALUD */}
      {tab==='salud' && (
        <div className="g2">
          <div>
            <div className="card">
              <div className="card-title">Molestias y dolores <button className="btn btn-s btn-sm" onClick={async()=>{const zona=prompt('Zona / localización:');if(!zona)return;const eva=prompt('Intensidad EVA (0-10):');await supabase.from('molestias').insert({paciente_id:id,zona,tipo:'molestia',eva:parseInt(eva||'5'),activa:true});cargar()}}>+ Añadir</button></div>
              {molestias.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin molestias registradas</div>}
              {molestias.map(m=>(
                <div key={m.id} style={{borderRadius:7,padding:'8px 10px',marginBottom:5,border:'1px solid',borderColor:m.activa?'#F5C8C8':'var(--gm)',backgroundColor:m.activa?'var(--redl)':'var(--gl)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{m.zona}</div>
                      <div style={{fontSize:9,color:'var(--grl)'}}>EVA {m.eva}/10 · {m.tipo?.replace('_',' ')}</div>
                    </div>
                    <span style={{fontSize:8,fontWeight:500,padding:'2px 7px',borderRadius:99,background:m.activa?'var(--redl)':'var(--gl)',color:m.activa?'var(--red)':'var(--gd)'}}>
                      {m.activa?'● Activa':'✓ Resuelta'}
                    </span>
                    <button className="toggle" style={{background:m.activa?'var(--red)':'var(--g)'}} onClick={()=>toggleMolestia(m.id,m.activa)}/>
                  </div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-title">Patologías <button className="btn btn-s btn-sm" onClick={async()=>{const nombre=prompt('Nombre de la patología:');if(!nombre)return;await supabase.from('patologias').insert({paciente_id:id,nombre,estado:'activa'});cargar()}}>+ Añadir</button></div>
              {patologias.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin patologías registradas</div>}
              {patologias.map(p=>(
                <div key={p.id} className="ri">
                  <div style={{width:7,height:7,borderRadius:'50%',background:p.estado==='activa'?'var(--red)':p.estado==='cronica'?'var(--amb)':'var(--g)',flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{p.nombre}</div>
                    <div style={{fontSize:9,color:'var(--grl)'}}>{p.estado}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="card">
              <div className="card-title">Escalas Borg y estrés <button className="btn btn-s btn-sm" onClick={async()=>{const borg=prompt('Borg · bienestar (0-10):');const estres=prompt('Estrés (0-10):');if(!borg||!estres)return;await supabase.from('escalas').insert({paciente_id:id,fecha:new Date().toISOString().split('T')[0],borg:parseInt(borg),estres:parseInt(estres)});cargar()}}>+ Hoy</button></div>
              {escalas.map(e=>(
                <div key={e.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <span style={{fontSize:9,color:'var(--grl)',width:50,fontWeight:300}}>{new Date(e.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</span>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                      <span style={{fontSize:9,color:'var(--grl)',width:44}}>Borg</span>
                      <div style={{flex:1,height:4,background:'var(--bm)',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',borderRadius:2,background:'var(--g)',width:`${(e.borg/10)*100}%`}}/></div>
                      <span style={{fontSize:9,fontWeight:500,width:24,textAlign:'right'}}>{e.borg}/10</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{fontSize:9,color:'var(--grl)',width:44}}>Estrés</span>
                      <div style={{flex:1,height:4,background:'var(--bm)',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',borderRadius:2,background:e.estres>6?'var(--red)':'var(--amb)',width:`${(e.estres/10)*100}%`}}/></div>
                      <span style={{fontSize:9,fontWeight:500,width:24,textAlign:'right'}}>{e.estres}/10</span>
                    </div>
                  </div>
                </div>
              ))}
              {escalas.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin escalas registradas</div>}
            </div>
            <div className="card">
              <div className="card-title">Medicamentos <button className="btn btn-s btn-sm" onClick={async()=>{const nombre=prompt('Medicamento:');if(!nombre)return;const freq=prompt('Frecuencia:');await supabase.from('medicamentos').insert({paciente_id:id,nombre,frecuencia:freq||''});cargar()}}>+ Añadir</button></div>
              {medicamentos.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin medicamentos registrados</div>}
              {medicamentos.map(m=>(
                <div key={m.id} className="ri">
                  <div style={{width:7,height:7,borderRadius:'50%',background:'var(--g)',flexShrink:0}}/>
                  <div><div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{m.nombre}</div><div style={{fontSize:9,color:'var(--grl)'}}>{m.frecuencia}</div></div>
                </div>
              ))}
            </div>
            <div className="card" style={{gridColumn:'1/-1'}}>
              <div className="card-title">
                Tests funcionales
                <button className="btn btn-s btn-sm" onClick={()=>setModalRegistrarTest(true)}>+ Registrar test</button>
              </div>
              {tests.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin tests registrados</div>}
              {tests.length>0 && (
                <div className="g2">
                  <div>
                    <div style={{fontSize:9,fontWeight:600,color:'var(--red)',letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>● Positivos / Activos</div>
                    {tests.filter(t=>t.resultado==='positivo').length===0 && <div style={{fontSize:9,color:'var(--grl)',marginBottom:8}}>Sin tests positivos</div>}
                    {tests.filter(t=>t.resultado==='positivo').map(t=>(
                      <div key={t.id} style={{padding:'7px 10px',background:'var(--redl)',borderRadius:6,border:'1px solid #F5C8C8',marginBottom:4}}>
                        <div style={{display:'flex',alignItems:'center',gap:7}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{t.tests?.nombre||'Test'}{t.lado&&t.lado!=='bilateral'?' · '+t.lado.charAt(0).toUpperCase()+t.lado.slice(1):''}</div>
                            <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}</div>
                          </div>
                          <span style={{fontSize:8,fontWeight:500,padding:'2px 7px',borderRadius:99,background:'var(--redl)',color:'var(--red)',border:'1px solid var(--red)'}}>+ Positivo</span>
                          <button onClick={async()=>{await supabase.from('resultados_tests').update({resultado:'negativo'}).eq('id',t.id);cargar()}} style={{fontSize:8,padding:'2px 6px',borderRadius:3,border:'1px solid var(--g)',background:'var(--gl)',color:'var(--gd)',cursor:'pointer',fontFamily:'system-ui'}}>→ Negativo</button>
                        </div>
                        {(t.items_resultado||[]).filter((i:any)=>i.marcado).map((item:any,ii:number)=>(
                          <div key={ii} style={{fontSize:9,color:'var(--red)',marginTop:3,display:'flex',alignItems:'center',gap:5}}>
                            <span>☑</span>
                            <span>{item.nombre}{item.grados?' · '+item.grados+'°':''}</span>
                          </div>
                        ))}
                        {t.observaciones&&<div style={{fontSize:9,color:'var(--gr)',marginTop:4,fontStyle:'italic'}}>{t.observaciones}</div>}
                        {t.fecha_repeticion&&<div style={{fontSize:9,color:'var(--amb)',marginTop:2}}>⏰ Revisión: {new Date(t.fecha_repeticion+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>✓ Negativos / Resueltos</div>
                    {tests.filter(t=>t.resultado==='negativo').length===0 && <div style={{fontSize:9,color:'var(--grl)',marginBottom:8}}>Sin tests negativos</div>}
                    {tests.filter(t=>t.resultado==='negativo').map(t=>(
                      <div key={t.id} style={{padding:'7px 10px',background:'var(--gl)',borderRadius:6,border:'1px solid var(--gm)',marginBottom:4}}>
                        <div style={{display:'flex',alignItems:'center',gap:7}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{t.tests?.nombre||'Test'}{t.lado&&t.lado!=='bilateral'?' · '+t.lado.charAt(0).toUpperCase()+t.lado.slice(1):''}</div>
                            <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}</div>
                          </div>
                          <span style={{fontSize:8,fontWeight:500,padding:'2px 7px',borderRadius:99,background:'var(--gl)',color:'var(--gd)',border:'1px solid var(--gm)'}}>− Negativo</span>
                        </div>
                        {t.observaciones&&<div style={{fontSize:9,color:'var(--gr)',marginTop:3,fontStyle:'italic'}}>{t.observaciones}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB ENTRENAMIENTO */}
      {tab==='entreno' && (
        <EntrenoTab pacienteId={String(id)} sesiones={sesiones} supabase={supabase} onRefresh={cargar}/>
      )}

      {/* MODAL REGISTRAR TEST */}
      {modalRegistrarTest && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalRegistrarTest(false)}}>
          <div className="modal" style={{width:460}}>
            <div className="modal-title">Registrar test<button className="modal-close" onClick={()=>setModalRegistrarTest(false)}>✕</button></div>
            <div className="g2">
              <div className="field"><label>Test *</label>
                <select className="input" value={testSeleccionado} onChange={e=>seleccionarTest(e.target.value)}>
                  <option value="">Seleccionar test...</option>
                  {testsDisp.map((t:any)=><option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="field"><label>Lado</label>
                <select className="input" value={ladoTest} onChange={e=>setLadoTest(e.target.value)}>
                  <option value="bilateral">Bilateral</option>
                  <option value="derecho">Derecho</option>
                  <option value="izquierdo">Izquierdo</option>
                </select>
              </div>
            </div>

            {/* IMAGEN Y VIDEO DEL TEST */}
            {testSeleccionadoObj && (testSeleccionadoObj.imagen_url||testSeleccionadoObj.descripcion) && (
              <div style={{background:'var(--bl)',borderRadius:7,padding:'9px 11px',marginBottom:10,display:'flex',gap:10,alignItems:'flex-start'}}>
                {testSeleccionadoObj.imagen_url&&<img src={testSeleccionadoObj.imagen_url} alt={testSeleccionadoObj.nombre} style={{width:60,height:60,objectFit:'cover',borderRadius:5,flexShrink:0}}/>}
                <div style={{flex:1}}>
                  {testSeleccionadoObj.descripcion&&<div style={{fontSize:10,color:'var(--gr)',fontWeight:300,lineHeight:1.4}}>{testSeleccionadoObj.descripcion}</div>}
                  {testSeleccionadoObj.video_url&&<a href={testSeleccionadoObj.video_url} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:'var(--g)',display:'block',marginTop:4}}>🎥 Ver vídeo del test ↗</a>}
                </div>
              </div>
            )}

            {/* ÍTEMS CON CHECKBOXES */}
            {itemsTest.length>0 ? (
              <div className="field">
                <label>Ítems de evaluación
                  <span style={{fontSize:9,fontWeight:300,color:'var(--grl)',marginLeft:6,textTransform:'none',letterSpacing:0}}>
                    {testSeleccionadoObj?.logica==='todos'?'Todos marcados = Positivo':'Cualquier ítem marcado = Positivo'}
                  </span>
                </label>
                {itemsTest.map((item,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:item.marcado?'var(--redl)':'var(--bl)',borderRadius:6,border:`1px solid ${item.marcado?'#F5C8C8':'var(--bd)'}`,marginBottom:4,transition:'all .15s'}}>
                    <input type="checkbox" checked={item.marcado} onChange={e=>{const its=[...itemsTest];its[i]={...its[i],marcado:e.target.checked};setItemsTest(its)}} style={{width:16,height:16,accentColor:'var(--red)',flexShrink:0,cursor:'pointer'}}/>
                    <span style={{flex:1,fontSize:11,fontWeight:item.marcado?400:300,color:'var(--n)'}}>{item.nombre}</span>
                    {item.tiene_grados && item.marcado && (
                      <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                        <input type="number" value={item.grados} onChange={e=>{const its=[...itemsTest];its[i]={...its[i],grados:e.target.value};setItemsTest(its)}}
                          style={{width:52,fontSize:11,padding:'2px 5px',border:'1px solid var(--red)',borderRadius:4,background:'var(--redl)',color:'var(--red)',textAlign:'center',fontFamily:'system-ui'}}
                          placeholder="0"/>
                        <span style={{fontSize:10,color:'var(--red)',fontWeight:500}}>°</span>
                      </div>
                    )}
                  </div>
                ))}
                {/* RESULTADO CALCULADO */}
                <div style={{marginTop:8,padding:'7px 11px',borderRadius:6,background:calcularResultado()==='positivo'?'var(--redl)':'var(--gl)',border:`1px solid ${calcularResultado()==='positivo'?'var(--red)':'var(--gm)'}`,display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:11,fontWeight:500,color:calcularResultado()==='positivo'?'var(--red)':'var(--gd)'}}>
                    {calcularResultado()==='positivo'?'+ Resultado: Positivo':'− Resultado: Negativo'}
                  </span>
                  <span style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>calculado automáticamente</span>
                </div>
              </div>
            ) : testSeleccionado ? (
              <div className="field"><label>Resultado</label>
                <div style={{display:'flex',gap:8,marginTop:4}}>
                  {[['positivo','+ Positivo','var(--red)','var(--redl)'],['negativo','− Negativo','var(--g)','var(--gl)']].map(([v,l,c,bg])=>(
                    <div key={v} onClick={()=>setResultadoTest(v)} style={{flex:1,padding:'10px',borderRadius:'var(--rl)',border:`2px solid ${resultadoTest===v?c:'var(--bd)'}`,background:resultadoTest===v?bg:'var(--w)',cursor:'pointer',textAlign:'center',transition:'all .15s'}}>
                      <div style={{fontSize:12,fontWeight:500,color:resultadoTest===v?c:'var(--grl)'}}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="field"><label>Observaciones libres</label>
              <textarea className="input" value={obsTest} onChange={e=>setObsTest(e.target.value)} placeholder="Notas adicionales sobre el resultado..." style={{minHeight:50}}/>
            </div>
            <div className="field">
              <label style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span>Fecha de revisión</span>
                {testSeleccionadoObj?.frecuencia_meses && <span style={{fontSize:9,color:'var(--g)',fontWeight:300}}>Predeterminada: {testSeleccionadoObj.frecuencia_meses} meses</span>}
              </label>
              <input type="date" className="input" value={fechaRevTest} onChange={e=>setFechaRevTest(e.target.value)} min={new Date().toISOString().split('T')[0]}/>
              {fechaRevTest && <div style={{fontSize:9,color:'var(--grl)',marginTop:3,fontWeight:300}}>
                Revisión el {new Date(fechaRevTest+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
              </div>}
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalRegistrarTest(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={registrarTest}>💾 Guardar resultado</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BONO */}
      {modalBono && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalBono(false)}}>
          <div className="modal">
            <div className="modal-title">Asignar bono<button className="modal-close" onClick={()=>setModalBono(false)}>✕</button></div>
            <div className="field"><label>Tipo de bono</label>
              <select className="input" value={nuevoBono.tipo} onChange={e=>setNuevoBono(p=>({...p,tipo:e.target.value}))}>
                <option value="esencial">Esencial · 2 días/semana</option>
                <option value="progreso">Progreso · 3 días/semana</option>
                <option value="avanzado">Avanzado · 4 días/semana</option>
                <option value="avanzado_mas1">Avanzado +1 · 5 días/semana</option>
              </select>
            </div>
            <div className="field"><label>Estado de pago</label>
              <select className="input" value={nuevoBono.estado_pago} onChange={e=>setNuevoBono(p=>({...p,estado_pago:e.target.value}))}>
                <option value="pendiente">⏳ Pendiente</option>
                <option value="pagado">✓ Pagado</option>
                <option value="impago">⚠ Impago</option>
              </select>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalBono(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearBono}>✓ Asignar bono</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PAUSA */}
      {modalPausa && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalPausa(false)}}>
          <div className="modal">
            <div className="modal-title">⏸ Pausa temporal<button className="modal-close" onClick={()=>setModalPausa(false)}>✕</button></div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:14,fontWeight:300}}>
              Las citas del periodo seleccionado se cancelarán automáticamente. El paciente podrá reactivarse cuando vuelva.
            </div>
            <div className="g2">
              <div className="field"><label>Desde</label><input type="date" className="input" value={pausa.desde} onChange={e=>setPausa(p=>({...p,desde:e.target.value}))}/></div>
              <div className="field"><label>Hasta (fecha de vuelta)</label><input type="date" className="input" value={pausa.hasta} onChange={e=>setPausa(p=>({...p,hasta:e.target.value}))}/></div>
            </div>
            <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:6,padding:'8px 11px',fontSize:10,color:'#7A5800',marginBottom:12}}>
              ⚠ Se cancelarán todas las citas programadas entre esas fechas. Para reactivar al paciente entra en su ficha y pulsa ▶ Reactivar.
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-s btn-sm" onClick={()=>setModalPausa(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={aplicarPausa} disabled={procesando}>
                {procesando?'⏳ Aplicando...':'⏸ Aplicar pausa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
