'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import Silueta, { MarcaCuerpo } from './Silueta'
import BuscadorBiblioteca from '@/components/BuscadorBiblioteca'
import Sparkline from './Sparkline'
import Documentos from './Documentos'
import { resolverViasDeTest } from '@/lib/objetivos'

export default function SaludTab({ id, pac, deportesPac, molestias, patologias, escalas, medicamentos, alergias, intolerancias, tests, cargar, setModalRegistrarTest, abrirTest }: any) {
  const [molsBiblio, setMolsBiblio] = useState<any[]>([])
  const [patsBiblio, setPatsBiblio] = useState<any[]>([])
  const [molConfig, setMolConfig] = useState<any>(null)
  const [patConfig, setPatConfig] = useState<any>(null)
  const [medsBiblio, setMedsBiblio] = useState<any[]>([])
  const [medConfig, setMedConfig] = useState<any>(null)
  const [algBiblio, setAlgBiblio] = useState<any[]>([])
  const [intolBiblio, setIntolBiblio] = useState<any[]>([])
  const [depBiblio, setDepBiblio] = useState<any[]>([])
  const [plantBiblio, setPlantBiblio] = useState<any[]>([])
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('molestias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setMolsBiblio(data||[]))
    supabase.from('patologias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setPatsBiblio(data||[]))
    supabase.from('medicamentos_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setMedsBiblio(data||[]))
    supabase.from('alergias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setAlgBiblio(data||[]))
    supabase.from('intolerancias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setIntolBiblio(data||[]))
    supabase.from('deportes_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setDepBiblio(data||[]))
    supabase.from('plantillas_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setPlantBiblio(data||[]))
  }, [])

  async function toggleMolestia(mid: string, activa: boolean) {
    await supabase.from('molestias').update({ activa: !activa }).eq('id', mid)
    const mol = (molestias||[]).find((m:any)=>m.id===mid)
    const zona = mol?.zona || 'Molestia'
    if (activa) {
      await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'molestia_resuelta', titulo:`Molestia resuelta: ${zona}`, fecha:new Date().toISOString().split('T')[0] })
    } else {
      await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'molestia', titulo:`Molestia reactivada: ${zona}`, fecha:new Date().toISOString().split('T')[0] })
    }
    cargar()
  }

  async function cambiarEstadoPatologia(pid: string, nombre: string, nuevoEstado: string) {
    await supabase.from('patologias').update({ estado:nuevoEstado }).eq('id', pid)
    const lbl: Record<string,string> = { activa:'Activa', cronica:'Crónica', resuelta:'Resuelta' }
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:nuevoEstado==='resuelta'?'patologia_resuelta':'patologia', titulo:`Patología ${nombre}: ${lbl[nuevoEstado]||nuevoEstado}`, fecha:new Date().toISOString().split('T')[0] })
    cargar()
  }

  async function addDeporte(nombre: string) {
    if (!nombre.trim()) return
    const yaTiene = (deportesPac||[]).length>0
    await supabase.from('deportes_paciente').insert({ paciente_id:id, nombre })
    if (!yaTiene) await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'deporte', titulo:`Empieza a practicar deporte: ${nombre}`, fecha:new Date().toISOString().split('T')[0] })
    else await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'deporte', titulo:`Nuevo deporte: ${nombre}`, fecha:new Date().toISOString().split('T')[0] })
    cargar()
  }
  async function delDeporte(did: string, nombre: string) {
    await supabase.from('deportes_paciente').delete().eq('id', did)
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'deporte', titulo:`Deja el deporte: ${nombre}`, fecha:new Date().toISOString().split('T')[0] })
    cargar()
  }

  // Se borra la fila pero queda el evento: la medicación que tomó en su día
  // es historia clínica y no debe evaporarse al quitarla de la ficha.
  async function delMedicamento(mid: string, nombre: string) {
    await supabase.from('medicamentos').delete().eq('id', mid)
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'medicamento', titulo:`Deja el medicamento: ${nombre}`, fecha:new Date().toISOString().split('T')[0] })
    cargar()
  }

  // Alergias e intolerancias comparten forma: misma función para no duplicar el evento.
  async function addSensibilidad(tabla: string, tipo: string, etiqueta: string, nombre: string) {
    if (!nombre.trim()) return
    const { error } = await supabase.from(tabla).insert({ paciente_id:id, nombre })
    if (error) { alert('Error: '+error.message); return }
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo, titulo:`${etiqueta}: ${nombre}`, fecha:hoy() })
    cargar()
  }
  async function delSensibilidad(tabla: string, tipo: string, etiqueta: string, rid: string, nombre: string) {
    const { error } = await supabase.from(tabla).delete().eq('id', rid)
    if (error) { alert('Error: '+error.message); return }
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo, titulo:`Deja de constar ${etiqueta.toLowerCase()}: ${nombre}`, fecha:hoy() })
    cargar()
  }

  const addAlergia = (n:string) => addSensibilidad('alergias_paciente','alergia','Alergia',n)
  const delAlergia = (aid:string, n:string) => delSensibilidad('alergias_paciente','alergia','Alergia',aid,n)
  const addIntolerancia = (n:string) => addSensibilidad('intolerancias_paciente','intolerancia','Intolerancia',n)
  const delIntolerancia = (iid:string, n:string) => delSensibilidad('intolerancias_paciente','intolerancia','Intolerancia',iid,n)

  const [usaPlantillas, setUsaPlantillas] = useState(false)
  const [plantIzq, setPlantIzq] = useState('')
  const [plantDer, setPlantDer] = useState('')
  const [guardandoSalud, setGuardandoSalud] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [detalle, setDetalle] = useState<any>(null)
  const [vista, setVista] = useState<'lista'|'mapa'>('lista')
  const [escalaConfig, setEscalaConfig] = useState<any>(null)
  const [nDocs, setNDocs] = useState(0)

  const LBL_TIPO_MOL: Record<string,string> = { molestia:'Molestia', dolor_agudo:'Dolor agudo', dolor_cronico:'Dolor crónico', rigidez:'Rigidez' }
  const LBL_EST_PAT: Record<string,string> = { activa:'Activa', cronica:'Crónica', resuelta:'Resuelta' }
  const cap = (v:string) => v ? v.charAt(0).toUpperCase()+v.slice(1) : ''
  const hoy = () => new Date().toISOString().split('T')[0]
  // Valencias opuestas: bienestar bajo es malo, estrés alto es malo.
  const colorBienestar = (v:number) => v>=7 ? 'var(--gd)' : v>=4 ? 'var(--amb)' : 'var(--red)'
  const colorEstres    = (v:number) => v<=3 ? 'var(--gd)' : v<=6 ? 'var(--amb)' : 'var(--red)'

  async function guardarEscala() {
    if (!escalaConfig) return
    setGuardando(true)
    await supabase.from('escalas').insert({
      paciente_id:id, fecha:escalaConfig.fecha,
      borg:escalaConfig.borg, estres:escalaConfig.estres,
    })
    await supabase.from('eventos_paciente').insert({
      paciente_id:id, tipo:'escala',
      titulo:`Escalas: bienestar ${escalaConfig.borg}/10 · estrés ${escalaConfig.estres}/10`,
      fecha:escalaConfig.fecha,
    })
    setEscalaConfig(null); setGuardando(false); cargar()
  }

  useEffect(() => {
    if (pac) {
      setUsaPlantillas(!!pac.usa_plantillas)
      setPlantIzq(pac.plantilla_izq||'')
      setPlantDer(pac.plantilla_der||'')
    }
  }, [pac?.id, pac?.usa_plantillas, pac?.plantilla_izq, pac?.plantilla_der])

  // Guarda solo, como el resto de la pestaña. El antirrebote hace que cambiar
  // los dos pies seguidos cuente como un único cambio y no genere dos eventos.
  const tocado = useRef(false)
  useEffect(() => {
    if (!tocado.current || !pac) return
    const t = setTimeout(() => { persistirPlantillas() }, 700)
    return () => clearTimeout(t)
  }, [usaPlantillas, plantIzq, plantDer])

  async function persistirPlantillas() {
    const antes = !!pac.usa_plantillas
    const izqAntes = pac.plantilla_izq || ''
    const derAntes = pac.plantilla_der || ''
    if (usaPlantillas === antes && plantIzq === izqAntes && plantDer === derAntes) return

    setGuardandoSalud(true)
    await supabase.from('pacientes').update({
      usa_plantillas: usaPlantillas,
      plantilla_izq: usaPlantillas ? (plantIzq || null) : null,
      plantilla_der: usaPlantillas ? (plantDer || null) : null,
    }).eq('id', id)

    const hoy = new Date().toISOString().split('T')[0]
    const detalle = [plantIzq?`Izq: ${plantIzq}`:'', plantDer?`Der: ${plantDer}`:''].filter(Boolean).join(' · ') || null
    if (usaPlantillas && !antes) await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'plantillas', titulo:'Empieza a usar plantillas', descripcion:detalle, fecha:hoy })
    else if (!usaPlantillas && antes) await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'plantillas', titulo:'Deja de usar plantillas', fecha:hoy })
    else if (usaPlantillas && (plantIzq!==izqAntes || plantDer!==derAntes)) await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'plantillas', titulo:'Plantillas actualizadas', descripcion:detalle, fecha:hoy })

    setGuardandoSalud(false)
    setGuardado(true); setTimeout(()=>setGuardado(false), 1800)
    cargar()
  }

  async function guardarMedicamento() {
    if (!medConfig) return
    setGuardando(true)
    await supabase.from('medicamentos').insert({ paciente_id:id, nombre:medConfig.nombre, frecuencia:medConfig.frecuencia||'', observaciones:medConfig.observaciones||'' })
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'medicamento', titulo:`Medicamento: ${medConfig.nombre}`, descripcion:medConfig.frecuencia?`Frecuencia: ${medConfig.frecuencia}`:null, fecha:new Date().toISOString().split('T')[0] })
    setMedConfig(null); setGuardando(false); cargar()
  }

  async function guardarMolestia() {
    if (!molConfig) return
    setGuardando(true)
    await supabase.from('molestias').insert({ paciente_id:id, zona:molConfig.zona, tipo:molConfig.tipo, eva:molConfig.eva, lado:molConfig.lado||null, sensacion:molConfig.cuando||null, observaciones:molConfig.observaciones||null, activa:true })
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'molestia', titulo:`Molestia: ${molConfig.zona} (EVA ${molConfig.eva}/10)`, descripcion:molConfig.observaciones||null, fecha:new Date().toISOString().split('T')[0] })
    setMolConfig(null); setGuardando(false); cargar()
  }

  async function guardarPatologia() {
    if (!patConfig) return
    setGuardando(true)
    await supabase.from('patologias').insert({ paciente_id:id, nombre:patConfig.nombre, lado:patConfig.lado||null, estado:patConfig.estado, descripcion:patConfig.observaciones||'', informe_url:patConfig.tiene_informe?'pendiente':null })
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'patologia', titulo:`Patología: ${patConfig.nombre}`, descripcion:patConfig.observaciones||null, fecha:new Date().toISOString().split('T')[0] })
    setPatConfig(null); setGuardando(false); cargar()
  }

  async function resolverTestNegativo(t:any) {
    // Registro NUEVO con fecha de hoy: así queda cuándo se resolvió y el positivo
    // anterior se conserva en el historial del test. Antes se sobrescribía el viejo.
    await supabase.from('resultados_tests').insert({
      paciente_id: id, test_id: t.test_id, fecha: new Date().toISOString().split('T')[0],
      resultado: 'negativo', lado: t.lado || 'bilateral',
      observaciones: 'Resuelto desde la ficha', items_resultado: [],
    })
    await supabase.from('eventos_paciente').insert({
      paciente_id: id, tipo: 'test',
      titulo: `Test negativo: ${t.tests?.nombre || 'Test'}${t.lado && t.lado !== 'bilateral' ? ' · ' + t.lado : ''}`,
      fecha: new Date().toISOString().split('T')[0],
    })
    // Resolver las vías de este test en todos los objetivos: la del test completo
    // y las de sus ítems, que antes se quedaban colgadas.
    const r = await resolverViasDeTest(id, t.test_id, 'un test')
    cargar()
    if (r.logrados > 0) {
      alert(r.logrados === 1
        ? 'Test resuelto. Un objetivo ha pasado a logrado.'
        : `Test resuelto. ${r.logrados} objetivos han pasado a logrados.`)
    }
  }

  // Agrupación de tests por test+lado. La usan la vista lista y la del mapa.
  // El primero de cada grupo es "el resultado de hoy" y el resto el historial, así
  // que el orden no puede quedar al azar: se ordena aquí y no solo en la consulta.
  const gruposTests: any[][] = (()=>{
    const g: Record<string,any[]> = {}
    ;(tests||[]).forEach((t:any)=>{const k=`${t.test_id}_${t.lado||'bilateral'}`;(g[k]=g[k]||[]).push(t)})
    const reciente = (x:any) => `${x.fecha||''}T${x.created_at||''}`
    Object.values(g).forEach(lista => lista.sort((a:any,b:any)=> reciente(b).localeCompare(reciente(a))))
    return Object.values(g)
  })()
  const testsPositivos = gruposTests.filter(g=>g[0].resultado==='positivo')
  const testsNegativos = gruposTests.filter(g=>g[0].resultado==='negativo')
  const nombreTest = (t:any) => (t.tests?.nombre||'Test') + (t.lado && t.lado!=='bilateral' ? ' · '+cap(t.lado) : '')

  // Molestias y patologías llevadas al cuerpo. Las patologías aún no guardan zona
  // propia (solo la biblioteca la tiene), así que de momento se intenta deducir del nombre.
  const marcasCuerpo: MarcaCuerpo[] = [
    ...(molestias||[]).map((m:any)=>({
      id: 'mol_'+m.id, zona: m.zona, lado: m.lado,
      titulo: m.zona, detalle: `EVA ${m.eva}/10`,
      estado: (m.activa ? 'activo' : 'resuelto') as MarcaCuerpo['estado'],
      origen: 'molestia' as const,
    })),
    ...(patologias||[]).map((p:any)=>({
      id: 'pat_'+p.id, zona: p.zona || p.nombre, lado: p.lado,
      titulo: p.nombre, detalle: LBL_EST_PAT[p.estado]||p.estado,
      estado: (p.estado==='resuelta' ? 'resuelto' : p.estado==='cronica' ? 'cronico' : 'activo') as MarcaCuerpo['estado'],
      origen: 'patologia' as const,
    })),
  ]

  const molActivas = (molestias||[]).filter((m:any)=>m.activa)
  const molResueltas = (molestias||[]).filter((m:any)=>!m.activa)
  const patActivas = (patologias||[]).filter((p:any)=>p.estado!=='resuelta')
  const patResueltas = (patologias||[]).filter((p:any)=>p.estado==='resuelta')

  return (
    <>
      <div className="vista-sw">
        {([['lista','lista','Lista'],['mapa','cuerpo','Mapa corporal']] as const).map(([v,ic,l])=>(
          <button key={v} className={`vista-b ${vista===v?'on':''}`} onClick={()=>setVista(v)}>
            <Ic name={ic} size={14}/> {l}
          </button>
        ))}
      </div>

      {vista==='mapa' && (
        <div className="panel">
          <Silueta
            marcas={marcasCuerpo}
            altura={pac?.altura_cm}
            peso={pac?.peso_kg}
            flancoIzq={
              <div>
                <div className="sec-sub" style={{color:'var(--red)'}}>Tests sin resolver · {testsPositivos.length}</div>
                {testsPositivos.length===0 && <div className="muted">Ninguno</div>}
                {testsPositivos.map(g=>(
                  <div key={g[0].id} className="fila-p test-clic" style={{borderLeftColor:'var(--red)'}} onClick={()=>setDetalle({tipo:'test',datos:g})}>
                    <div style={{flex:1,fontSize:13,color:'var(--n)'}}>{nombreTest(g[0])}</div>
                    <Ic name="abajo" size={13}/>
                  </div>
                ))}
              </div>
            }
            flancoDer={
              <div>
                <div className="sec-sub" style={{color:'var(--gd)'}}>Tests resueltos · {testsNegativos.length}</div>
                {testsNegativos.length===0 && <div className="muted">Ninguno</div>}
                {testsNegativos.map(g=>(
                  <div key={g[0].id} className="fila-p test-clic" style={{borderLeftColor:'var(--gm)'}} onClick={()=>setDetalle({tipo:'test',datos:g})}>
                    <div style={{flex:1,fontSize:13,color:'var(--gr)'}}>{nombreTest(g[0])}</div>
                    <Ic name="abajo" size={13}/>
                  </div>
                ))}
              </div>
            }
            izquierda={[
              { clave:'med',   icono:'medicamento',  label:'Medicación',    color:'#6B7FC4', vacio:'Sin medicación',
                items:(medicamentos||[]).map((m:any)=>m.nombre+(m.frecuencia?` · ${m.frecuencia}`:'')) },
              { clave:'alg',   icono:'alergia',      label:'Alergias',      color:'var(--red)', vacio:'Sin alergias',
                items:(alergias||[]).map((a:any)=>a.nombre) },
              { clave:'intol', icono:'intolerancia', label:'Intolerancias', color:'var(--amb)', vacio:'Sin intolerancias',
                items:(intolerancias||[]).map((i:any)=>i.nombre) },
            ]}
            derecha={[
              { clave:'plant', icono:'plantillas', label:'Plantillas', color:'var(--g)', vacio:'No usa plantillas',
                items: pac?.usa_plantillas
                  ? [pac.plantilla_izq?`Izquierdo: ${pac.plantilla_izq}`:'Izquierdo: sin especificar',
                     pac.plantilla_der?`Derecho: ${pac.plantilla_der}`:'Derecho: sin especificar']
                  : [] },
              { clave:'dep',   icono:'deporte',  label:'Deportes', color:'#6E9457', vacio:'Sin deportes',
                items:(deportesPac||[]).map((d:any)=>d.nombre) },
              { clave:'doc',   icono:'carpeta',  label:'Documentos', color:'#6B6D6A', items:[], n:nDocs,
                contenido:<Documentos pacienteId={id} patologias={patologias} compacto/> },
              { clave:'esc',   icono:'progreso', label:'Escalas',  color:'#C4703F', vacio:'Sin registros',
                items: escalas.length>0
                  ? [`Bienestar ${escalas[0].borg}/10`, `Estrés ${escalas[0].estres}/10`,
                     `el ${new Date(escalas[0].fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long'})}`]
                  : [] },
            ]}
            onAbrir={(ms)=>{
              const m = ms[0]
              if (m.origen==='molestia') {
                const dato = (molestias||[]).find((x:any)=>('mol_'+x.id)===m.id)
                if (dato) setDetalle({tipo:'molestia',datos:dato})
              } else {
                const dato = (patologias||[]).find((x:any)=>('pat_'+x.id)===m.id)
                if (dato) setDetalle({tipo:'patologia',datos:dato})
              }
            }}
          />

        </div>
      )}

      {vista==='lista' && (
      <div className="panel">

        {/* 1. QUÉ LE PASA */}
        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="patologia" size={13}/> Problemas</span></div>
          <div className="g2">
            <div>
              <div className="sec-sub">Molestias y dolores</div>
              <BuscadorBiblioteca items={molsBiblio} placeholder="Buscar para añadir... ej. lumbar, rodilla"
                buscarEn={(m:any)=>[m.nombre,m.zona]} subtitulo={(m:any)=>m.zona} etiquetaNuevo="Añadir"
                onElegir={(m:any)=>setMolConfig({nombre:m.nombre,zona:m.zona||m.nombre,tipo:'molestia',eva:5,lado:'bilateral',cuando:'Al moverse',observaciones:''})}
                onNuevo={(t:string)=>setMolConfig({nombre:t,zona:t,tipo:'molestia',eva:5,lado:'bilateral',cuando:'Al moverse',observaciones:''})}/>
              {molActivas.length===0 && <div className="muted">Sin molestias activas</div>}
              {molActivas.map((m:any)=>(
                <div key={m.id} className="fila-p" style={{borderLeftColor:'var(--red)'}}>
                  <div style={{flex:1,cursor:'pointer'}} onClick={()=>setDetalle({tipo:'molestia',datos:m})}>
                    <div style={{fontSize:13,color:'var(--n)'}}>{m.zona}</div>
                    <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>EVA {m.eva}/10 · {LBL_TIPO_MOL[m.tipo]||m.tipo?.replace('_',' ')}</div>
                  </div>
                  <button className="btn btn-t btn-sm" onClick={()=>toggleMolestia(m.id,m.activa)}>Resolver</button>
                </div>
              ))}
              {molResueltas.length>0 && (
                <details style={{marginTop:8}}>
                  <summary className="det-sum">{molResueltas.length} resuelta{molResueltas.length>1?'s':''}</summary>
                  {molResueltas.map((m:any)=>(
                    <div key={m.id} className="fila-p" style={{borderLeftColor:'var(--gm)'}}>
                      <div style={{flex:1,cursor:'pointer'}} onClick={()=>setDetalle({tipo:'molestia',datos:m})}>
                        <div style={{fontSize:13,color:'var(--gr)'}}>{m.zona}</div>
                      </div>
                      <button className="btn btn-t btn-sm" onClick={()=>toggleMolestia(m.id,m.activa)}>Reactivar</button>
                    </div>
                  ))}
                </details>
              )}
            </div>

            <div>
              <div className="sec-sub">Patologías</div>
              <BuscadorBiblioteca items={patsBiblio} placeholder="Buscar para añadir... ej. tendinitis, hernia"
                buscarEn={(p:any)=>[p.nombre,p.zona,p.sistema]} subtitulo={(p:any)=>[p.zona,p.sistema].filter(Boolean).join(' · ')}
                onElegir={(p:any)=>setPatConfig({nombre:p.nombre,zona:p.zona||null,precauciones:p.precauciones||null,lado:'bilateral',estado:'activa',tiene_informe:false,observaciones:''})}
                onNuevo={(t:string)=>setPatConfig({nombre:t,zona:null,precauciones:null,lado:'bilateral',estado:'activa',tiene_informe:false,observaciones:''})}/>
              {patActivas.length===0 && <div className="muted">Sin patologías activas</div>}
              {patActivas.map((p:any)=>(
                <div key={p.id} className="fila-p" style={{borderLeftColor:p.estado==='cronica'?'var(--amb)':'var(--red)'}}>
                  <div style={{flex:1,cursor:'pointer'}} onClick={()=>setDetalle({tipo:'patologia',datos:p})}>
                    <div style={{fontSize:13,color:'var(--n)'}}>{p.nombre}</div>
                    <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>{(p.lado&&p.lado!=='no_aplica')?cap(p.lado):LBL_EST_PAT[p.estado]}</div>
                  </div>
                  <select value={p.estado} onChange={e=>cambiarEstadoPatologia(p.id,p.nombre,e.target.value)}
                    style={{fontSize:12,padding:'3px 7px',borderRadius:5,border:'1px solid var(--bd)',background:'var(--w)',color:'var(--gr)',cursor:'pointer',fontFamily:'inherit'}}>
                    <option value="activa">Activa</option>
                    <option value="cronica">Crónica</option>
                    <option value="resuelta">Resuelta</option>
                  </select>
                </div>
              ))}
              {patResueltas.length>0 && (
                <details style={{marginTop:8}}>
                  <summary className="det-sum">{patResueltas.length} resuelta{patResueltas.length>1?'s':''}</summary>
                  {patResueltas.map((p:any)=>(
                    <div key={p.id} className="fila-p" style={{borderLeftColor:'var(--gm)'}}>
                      <div style={{flex:1,cursor:'pointer'}} onClick={()=>setDetalle({tipo:'patologia',datos:p})}>
                        <div style={{fontSize:13,color:'var(--gr)'}}>{p.nombre}</div>
                      </div>
                      <button className="btn btn-t btn-sm" onClick={()=>cambiarEstadoPatologia(p.id,p.nombre,'activa')}>Reactivar</button>
                    </div>
                  ))}
                </details>
              )}
            </div>
          </div>
        </div>

        {/* 2. TESTS — a ancho completo, es el bloque con más información */}
        <div className="sec">
          <div className="sec-h">
            <span className="sh-l">
              <span className="ct-l"><Ic name="buscar" size={13}/> Tests funcionales</span>
              <button className="btn btn-s btn-sm" onClick={()=>setModalRegistrarTest(true)}>+ Registrar test</button>
            </span>
          </div>
          {tests.length===0 && <div className="muted">Sin tests registrados</div>}
          {tests.length>0 && (()=>{
            const positivos = testsPositivos
            const negativos = testsNegativos
            const bloque = (grupo:any, positivo:boolean) => {
              const t = grupo[0]; const anteriores = grupo.slice(1)
              // Clave estable por test+lado: si se usa el id del registro actual, al
              // reevaluar cambia la clave, React remonta el bloque y se cierra el historial.
              return (
                <div key={`${t.test_id}_${t.lado||'bilateral'}`} style={{padding:'9px 11px',background:positivo?'var(--redl)':'var(--gl)',borderRadius:8,border:`1px solid ${positivo?'#F5C8C8':'var(--gm)'}`,marginBottom:7}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,color:'var(--n)'}}>{t.tests?.nombre||'Test'}{t.lado&&t.lado!=='bilateral'?' · '+cap(t.lado):''}</div>
                      <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>{new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · {grupo.length} {grupo.length===1?'registro':'registros'}</div>
                    </div>
                    <button className="btn btn-t btn-sm" onClick={()=>abrirTest?.(t.test_id, t.lado||'bilateral')}>Volver a evaluar</button>
                    {positivo && <button className="btn btn-t btn-sm" onClick={()=>resolverTestNegativo(t)}>Pasar a negativo</button>}
                  </div>
                  {(t.items_resultado||[]).filter((i:any)=>i.marcado).map((item:any,ii:number)=>(
                    <div key={ii} style={{fontSize:12,color:'var(--red)',marginTop:4,display:'flex',alignItems:'center',gap:5}}><Ic name="checkbox" size={12}/><span>{item.nombre}{item.grados?' · '+item.grados+'°':''}</span></div>
                  ))}
                  {t.observaciones && <div style={{fontSize:12,color:'var(--gr)',marginTop:5,fontStyle:'italic'}}>{t.observaciones}</div>}
                  {t.fecha_repeticion && <div style={{fontSize:12,color:'#8A6410',marginTop:4,display:'flex',alignItems:'center',gap:5}}><Ic name="alarma" size={12}/> Revisión: {new Date(t.fecha_repeticion+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>}
                  {anteriores.length>0 && (
                    <details style={{marginTop:7}}>
                      <summary className="det-sum">Historial · {anteriores.length} anterior{anteriores.length>1?'es':''}</summary>
                      <div style={{marginTop:5,paddingLeft:9,borderLeft:`2px solid ${positivo?'#F5C8C8':'var(--gm)'}`}}>
                        {anteriores.map((ant:any,ai:number)=>(
                          <div key={ai} style={{marginBottom:5}}>
                            <div style={{fontSize:12,color:'var(--n)'}}>
                              {new Date(ant.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · <span style={{color:ant.resultado==='positivo'?'var(--red)':'var(--gd)'}}>{ant.resultado==='positivo'?'Positivo':'Negativo'}</span>
                            </div>
                            {ant.observaciones && <div style={{fontSize:12,color:'var(--gr)',fontStyle:'italic'}}>{ant.observaciones}</div>}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )
            }
            return (
              <div className="g2">
                <div>
                  <div className="sec-sub" style={{color:'var(--red)'}}>Positivos · {positivos.length}</div>
                  {positivos.length===0 && <div className="muted">Ninguno</div>}
                  {positivos.map(g=>bloque(g,true))}
                </div>
                <div>
                  <div className="sec-sub" style={{color:'var(--gd)'}}>Negativos · {negativos.length}</div>
                  {negativos.length===0 && <div className="muted">Ninguno</div>}
                  {negativos.map(g=>bloque(g,false))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* 3. LO QUE CONDICIONA EL TRATAMIENTO */}
        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="alerta" size={13}/> Precauciones</span></div>
          <div className="g3">
            <div>
              <div className="sec-sub">Medicación</div>
              <BuscadorBiblioteca items={medsBiblio} placeholder="Buscar... ej. ibuprofeno"
                subtitulo={(m:any)=>m.categoria} etiquetaNuevo="Añadir"
                onElegir={(m:any)=>setMedConfig({nombre:m.nombre,frecuencia:'',observaciones:''})}
                onNuevo={(t:string)=>setMedConfig({nombre:t,frecuencia:'',observaciones:''})}/>
              {medicamentos.length===0 && <div className="muted">Sin medicación</div>}
              {medicamentos.map((m:any)=>(
                <div key={m.id} className="fila-p" style={{borderLeftColor:'#6B7FC4'}}>
                  <div style={{flex:1,cursor:'pointer'}} onClick={()=>setDetalle({tipo:'medicamento',datos:m})}>
                    <div style={{fontSize:13,color:'var(--n)'}}>{m.nombre}</div>
                    {m.frecuencia && <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>{m.frecuencia}</div>}
                  </div>
                  <button className="fila-x" title="Quitar" onClick={()=>delMedicamento(m.id,m.nombre)}><Ic name="cerrar" size={13}/></button>
                </div>
              ))}
            </div>
            <div>
              <div className="sec-sub">Alergias</div>
              <BuscadorBiblioteca items={algBiblio} placeholder="Buscar para añadir..." max={8}
                onElegir={(a:any)=>addAlergia(a.nombre)} onNuevo={(t:string)=>addAlergia(t)}/>
              {(alergias||[]).length===0 && <div className="muted">Sin alergias</div>}
              {(alergias||[]).map((a:any)=>(
                <div key={a.id} className="fila-p" style={{borderLeftColor:'var(--red)'}}>
                  <div style={{flex:1,fontSize:13,color:'var(--n)'}}>{a.nombre}</div>
                  <button className="fila-x" title="Quitar" onClick={()=>delAlergia(a.id,a.nombre)}><Ic name="cerrar" size={13}/></button>
                </div>
              ))}
            </div>
            <div>
              <div className="sec-sub">Intolerancias</div>
              <BuscadorBiblioteca items={intolBiblio} placeholder="Buscar para añadir..." max={8}
                onElegir={(a:any)=>addIntolerancia(a.nombre)} onNuevo={(t:string)=>addIntolerancia(t)}/>
              {(intolerancias||[]).length===0 && <div className="muted">Sin intolerancias</div>}
              {(intolerancias||[]).map((it:any)=>(
                <div key={it.id} className="fila-p" style={{borderLeftColor:'var(--amb)'}}>
                  <div style={{flex:1,fontSize:13,color:'var(--n)'}}>{it.nombre}</div>
                  <button className="fila-x" title="Quitar" onClick={()=>delIntolerancia(it.id,it.nombre)}><Ic name="cerrar" size={13}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. CONTEXTO */}
        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="deporte" size={13}/> Contexto</span></div>
          <div className="g2">
            <div>
              <div className="sec-sub">Deportes</div>
              <BuscadorBiblioteca items={depBiblio} placeholder="Buscar para añadir... ej. pádel, natación" max={8}
                onElegir={(d:any)=>addDeporte(d.nombre)} onNuevo={(t:string)=>addDeporte(t)}/>
              {(deportesPac||[]).length===0 && <div className="muted">Sin deportes registrados</div>}
              {(deportesPac||[]).map((d:any)=>(
                <div key={d.id} className="fila-p" style={{borderLeftColor:'var(--g)'}}>
                  <div style={{flex:1,fontSize:13,color:'var(--n)'}}>{d.nombre}</div>
                  <button className="fila-x" title="Quitar" onClick={()=>delDeporte(d.id,d.nombre)}><Ic name="cerrar" size={13}/></button>
                </div>
              ))}
            </div>
            <div>
              <div className="sec-sub" style={{display:'flex',alignItems:'center',gap:8}}>
                Plantillas
                {guardandoSalud && <span style={{fontSize:12,color:'var(--grl)'}}>guardando…</span>}
                {guardado && !guardandoSalud && <span style={{fontSize:12,color:'var(--gd)',display:'inline-flex',alignItems:'center',gap:3}}><Ic name="check" size={12}/> guardado</span>}
              </div>
              <div className="fila-p" style={{borderLeftColor:usaPlantillas?'var(--g)':'var(--bd)'}}>
                <div style={{flex:1,fontSize:13,color:'var(--n)'}}>Usa plantillas</div>
                <button className={`toggle ${usaPlantillas?'on':''}`} aria-label="Usa plantillas"
                  onClick={()=>{tocado.current=true;setUsaPlantillas(!usaPlantillas)}}/>
              </div>
              {usaPlantillas && (
                <div style={{marginTop:8}}>
                  {([['Izquierdo',plantIzq,setPlantIzq],['Derecho',plantDer,setPlantDer]] as const).map(([lbl,val,set]:any)=>(
                    <div key={lbl} style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                      <span style={{fontSize:12,color:'var(--gr)',width:74,flexShrink:0}}>Pie {lbl.toLowerCase()}</span>
                      <select className="input" value={val} onChange={e=>{tocado.current=true;set(e.target.value)}} style={{flex:1}}>
                        <option value="">Sin especificar</option>
                        {plantBiblio.map((t:any)=><option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5. SEGUIMIENTO */}
        <div className="sec">
          <div className="sec-h">
            <span className="sh-l">
              <span className="ct-l"><Ic name="progreso" size={13}/> Bienestar y estrés</span>
              <button className="btn btn-s btn-sm" onClick={()=>setEscalaConfig({borg:5,estres:5,fecha:new Date().toISOString().split('T')[0]})}>+ Registrar</button>
            </span>
          </div>
          {escalas.length===0 ? <div className="muted">Sin registros todavía</div> : (
            <>
              <div className="g2">
                {([
                  ['Bienestar', escalas[0].borg, colorBienestar(escalas[0].borg), escalas.map((e:any)=>e.borg)],
                  ['Estrés',    escalas[0].estres, colorEstres(escalas[0].estres), escalas.map((e:any)=>e.estres)],
                ] as const).map(([lbl,val,col,serie]:any)=>(
                  <div key={lbl} style={{display:'flex',alignItems:'center',gap:14}}>
                    <div>
                      <div className="sec-sub" style={{marginBottom:2}}>{lbl}</div>
                      <div style={{fontSize:26,fontWeight:300,color:col,lineHeight:1.1}}>{val}<span style={{fontSize:14,color:'var(--gr)'}}>/10</span></div>
                    </div>
                    <Sparkline valores={[...serie].reverse()} color={col}/>
                  </div>
                ))}
              </div>
              <div style={{fontSize:12,color:'var(--gr)',marginTop:10}}>
                Último registro el {new Date(escalas[0].fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}
                {escalas.length>1 && <> · se muestran los {escalas.length} más recientes</>}
                <span style={{marginLeft:8}}>La evolución completa está en <b style={{fontWeight:500}}>Resultados</b>.</span>
              </div>
            </>
          )}
        </div>

        <Documentos pacienteId={id} patologias={patologias} onCambio={setNDocs}/>

      </div>
      )}

      {/* MODAL ESCALAS */}
      {escalaConfig && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setEscalaConfig(null)}}>
          <div className="modal">
            <div className="modal-title">Registrar escalas<button className="modal-close" onClick={()=>setEscalaConfig(null)}>✕</button></div>
            <div className="field"><label>Fecha</label>
              <input type="date" className="input" value={escalaConfig.fecha} onChange={e=>setEscalaConfig((p:any)=>({...p,fecha:e.target.value}))}/>
            </div>
            {([['borg','Bienestar','0 = fatal · 10 = estupendo',colorBienestar],['estres','Estrés','0 = ninguno · 10 = máximo',colorEstres]] as const).map(([k,lbl,ayuda,fn]:any)=>(
              <div className="field" key={k}>
                <label style={{display:'flex',justifyContent:'space-between'}}>
                  <span>{lbl}</span>
                  <span style={{fontSize:16,fontWeight:500,color:fn(escalaConfig[k]),textTransform:'none',letterSpacing:0}}>{escalaConfig[k]}/10</span>
                </label>
                <input type="range" min={0} max={10} step={1} value={escalaConfig[k]}
                  onChange={e=>setEscalaConfig((p:any)=>({...p,[k]:parseInt(e.target.value)}))}
                  style={{width:'100%',accentColor:fn(escalaConfig[k])}}/>
                <div style={{fontSize:12,color:'var(--gr)',marginTop:2}}>{ayuda}</div>
              </div>
            ))}
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setEscalaConfig(null)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardarEscala} disabled={guardando}>{guardando?'…':<><Ic name="guardar" size={13}/> Guardar</>}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE */}
      {detalle&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setDetalle(null)}}><div className="modal"><div className="modal-title"><span className="ct-l"><Ic name={detalle.tipo==='molestia'?'molestia':detalle.tipo==='patologia'?'patologia':detalle.tipo==='test'?'buscar':'medicamento'} size={16}/> {detalle.tipo==='molestia'?(detalle.datos.zona||'Molestia'):detalle.tipo==='patologia'?(detalle.datos.nombre||'Patología'):detalle.tipo==='test'?nombreTest(detalle.datos[0]):(detalle.datos.nombre||'Medicamento')}</span><button className="modal-close" onClick={()=>setDetalle(null)}>✕</button></div>
        {detalle.tipo==='test'&&(()=>{
          const t = detalle.datos[0]; const anteriores = detalle.datos.slice(1); const pos = t.resultado==='positivo'
          return (
            <div style={{display:'flex',flexDirection:'column',gap:9}}>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                <span style={{fontSize:12,fontWeight:500,padding:'3px 10px',borderRadius:99,background:pos?'var(--redl)':'var(--gl)',color:pos?'var(--red)':'var(--gd)',border:`1px solid ${pos?'#F5C8C8':'var(--gm)'}`}}>
                  {pos?'Positivo':'Negativo'}
                </span>
                <span style={{fontSize:12,color:'var(--gr)'}}>{new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</span>
              </div>
              {(t.items_resultado||[]).filter((i:any)=>i.marcado).length>0 && (
                <div>
                  <div style={{fontSize:12,color:'var(--gr)',marginBottom:3}}>Ítems marcados</div>
                  {(t.items_resultado||[]).filter((i:any)=>i.marcado).map((it:any,ii:number)=>(
                    <div key={ii} style={{fontSize:13,color:'var(--n)',display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                      <Ic name="checkbox" size={12}/>{it.nombre}{it.grados?` · ${it.grados}°`:''}
                    </div>
                  ))}
                </div>
              )}
              {t.observaciones && <div><div style={{fontSize:12,color:'var(--gr)',marginBottom:2}}>Observaciones</div><div style={{fontSize:13,color:'var(--n)',lineHeight:1.5}}>{t.observaciones}</div></div>}
              {t.fecha_repeticion && <div style={{fontSize:13,color:'#8A6410',display:'flex',alignItems:'center',gap:5}}><Ic name="alarma" size={13}/> Revisión el {new Date(t.fecha_repeticion+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>}
              {anteriores.length>0 && (
                <div>
                  <div style={{fontSize:12,color:'var(--gr)',marginBottom:4}}>Historial · {anteriores.length} anterior{anteriores.length>1?'es':''}</div>
                  {anteriores.map((ant:any,ai:number)=>(
                    <div key={ai} style={{fontSize:13,color:'var(--n)',paddingLeft:9,borderLeft:'2px solid var(--bd)',marginBottom:4}}>
                      {new Date(ant.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · <span style={{color:ant.resultado==='positivo'?'var(--red)':'var(--gd)'}}>{ant.resultado==='positivo'?'Positivo':'Negativo'}</span>
                      {ant.observaciones && <div style={{fontSize:12,color:'var(--gr)',fontStyle:'italic'}}>{ant.observaciones}</div>}
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:'flex',gap:8,marginTop:2}}>
                <button className="btn btn-t btn-sm" onClick={()=>{setDetalle(null);abrirTest?.(t.test_id,t.lado||'bilateral')}}>Volver a evaluar</button>
                {pos && <button className="btn btn-t btn-sm" onClick={()=>{setDetalle(null);resolverTestNegativo(t)}}>Pasar a negativo</button>}
              </div>
            </div>
          )
        })()}
        {detalle.tipo==='molestia'&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:detalle.datos.activa?'var(--redl)':'var(--gl)',color:detalle.datos.activa?'var(--red)':'var(--gd)',border:`1px solid ${detalle.datos.activa?'#F5C8C8':'var(--gm)'}`}}>{detalle.datos.activa?'● Activa':'✓ Resuelta'}</span>
            <span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--bl)',color:'var(--gr)'}}>EVA {detalle.datos.eva}/10</span>
            {detalle.datos.tipo&&<span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--bl)',color:'var(--gr)'}}>{LBL_TIPO_MOL[detalle.datos.tipo]||detalle.datos.tipo}</span>}
            {detalle.datos.lado&&detalle.datos.lado!=='bilateral'&&<span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--bl)',color:'var(--gr)'}}>{cap(detalle.datos.lado)}</span>}
          </div>
          {detalle.datos.sensacion&&<div><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',marginBottom:2}}>Cuándo aparece</div><div style={{fontSize:11,color:'var(--n)'}}>{detalle.datos.sensacion}</div></div>}
          {detalle.datos.observaciones&&<div><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',marginBottom:2}}>Observaciones</div><div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.5,whiteSpace:'pre-line'}}>{detalle.datos.observaciones}</div></div>}
          <div style={{fontSize:10,color:'var(--grl)'}}>Registrada el {new Date(detalle.datos.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>
        </div>}
        {detalle.tipo==='patologia'&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:detalle.datos.estado==='activa'?'var(--redl)':detalle.datos.estado==='cronica'?'var(--ambl)':'var(--gl)',color:detalle.datos.estado==='activa'?'var(--red)':detalle.datos.estado==='cronica'?'#7A5800':'var(--gd)'}}>{LBL_EST_PAT[detalle.datos.estado]||detalle.datos.estado}</span>
            {detalle.datos.lado&&detalle.datos.lado!=='no_aplica'&&<span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--bl)',color:'var(--gr)'}}>{cap(detalle.datos.lado)}</span>}
            {detalle.datos.informe_url&&<span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--bl)',color:'var(--gr)',display:'inline-flex',alignItems:'center',gap:4}}><Ic name="informe" size={11}/> Informe {detalle.datos.informe_url==='pendiente'?'pendiente':'disponible'}</span>}
          </div>
          {detalle.datos.descripcion&&<div><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',marginBottom:2}}>Descripción / observaciones</div><div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.5,whiteSpace:'pre-line'}}>{detalle.datos.descripcion}</div></div>}
          <div style={{fontSize:10,color:'var(--grl)'}}>Registrada el {new Date(detalle.datos.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>
        </div>}
        {detalle.tipo==='medicamento'&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
          {detalle.datos.frecuencia&&<div><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',marginBottom:2}}>Frecuencia</div><div style={{fontSize:11,color:'var(--n)'}}>{detalle.datos.frecuencia}</div></div>}
          {detalle.datos.observaciones&&<div><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',marginBottom:2}}>Observaciones</div><div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.5,whiteSpace:'pre-line'}}>{detalle.datos.observaciones}</div></div>}
          {!detalle.datos.frecuencia&&!detalle.datos.observaciones&&<div className="muted">Sin información adicional registrada.</div>}
          <div style={{fontSize:10,color:'var(--grl)'}}>Registrado el {new Date(detalle.datos.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>
        </div>}
        <div style={{display:'flex',marginTop:12}}><div style={{flex:1}}/><button className="btn btn-d btn-sm" onClick={()=>setDetalle(null)}>Cerrar</button></div>
      </div></div>}

      {/* MODAL CONFIGURAR MEDICAMENTO */}
      {medConfig&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setMedConfig(null)}}><div className="modal"><div className="modal-title">{medConfig.nombre}<button className="modal-close" onClick={()=>setMedConfig(null)}>✕</button></div><div className="field"><label>Frecuencia</label><input className="input" value={medConfig.frecuencia} onChange={e=>setMedConfig((p:any)=>({...p,frecuencia:e.target.value}))} placeholder="ej. 1 cada 8h, Diario, Solo si dolor..."/></div><div className="field"><label>Observaciones</label><textarea className="input" style={{minHeight:60}} value={medConfig.observaciones} onChange={e=>setMedConfig((p:any)=>({...p,observaciones:e.target.value}))} placeholder="Dosis, pauta, motivo..."/></div><div style={{display:'flex',gap:8,marginTop:8}}><button className="btn btn-d btn-sm" onClick={()=>setMedConfig(null)}>Cancelar</button><div style={{flex:1}}/><button className="btn btn-p" onClick={guardarMedicamento} disabled={guardando}>{guardando?'…':'✓ Añadir'}</button></div></div></div>}

      {/* MODAL CONFIGURAR MOLESTIA */}
      {molConfig&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setMolConfig(null)}}><div className="modal"><div className="modal-title">{molConfig.nombre}<button className="modal-close" onClick={()=>setMolConfig(null)}>✕</button></div><div className="g2"><div className="field"><label>Tipo</label><select className="input" value={molConfig.tipo} onChange={e=>setMolConfig((p:any)=>({...p,tipo:e.target.value}))}><option value="molestia">Molestia</option><option value="dolor_agudo">Dolor agudo</option><option value="dolor_cronico">Dolor crónico</option><option value="rigidez">Rigidez</option></select></div><div className="field"><label>Lado</label><select className="input" value={molConfig.lado} onChange={e=>setMolConfig((p:any)=>({...p,lado:e.target.value}))}><option value="bilateral">Bilateral</option><option value="izquierdo">Izquierdo</option><option value="derecho">Derecho</option></select></div></div><div className="field"><label>EVA ({molConfig.eva}/10)</label><input type="range" min={0} max={10} value={molConfig.eva} onChange={e=>setMolConfig((p:any)=>({...p,eva:parseInt(e.target.value)}))} style={{width:'100%',accentColor:'var(--red)'}}/><div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--grl)'}}><span>0</span><span style={{fontWeight:500,color:'var(--red)'}}>{molConfig.eva}</span><span>10</span></div></div><div className="field"><label>¿Cuándo aparece?</label><div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:4}}>{['En reposo','Al moverse','Con carga','Al caminar','Siempre','Al despertar'].map(c=><span key={c} onClick={()=>setMolConfig((p:any)=>({...p,cuando:c}))} style={{fontSize:10,padding:'3px 9px',borderRadius:99,border:`1px solid ${molConfig.cuando===c?'var(--g)':'var(--bd)'}`,background:molConfig.cuando===c?'var(--g)':'var(--w)',color:molConfig.cuando===c?'#fff':'var(--gr)',cursor:'pointer'}}>{c}</span>)}</div></div><div className="field"><label>Observaciones</label><textarea className="input" style={{minHeight:60}} value={molConfig.observaciones} onChange={e=>setMolConfig((p:any)=>({...p,observaciones:e.target.value}))} placeholder="Sensación, qué lo provoca..."/></div><div style={{display:'flex',gap:8,marginTop:8}}><button className="btn btn-d btn-sm" onClick={()=>setMolConfig(null)}>Cancelar</button><div style={{flex:1}}/><button className="btn btn-p" onClick={guardarMolestia} disabled={guardando}>{guardando?'…':'✓ Añadir'}</button></div></div></div>}

      {/* MODAL CONFIGURAR PATOLOGÍA */}
      {patConfig&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setPatConfig(null)}}><div className="modal"><div className="modal-title">{patConfig.nombre}<button className="modal-close" onClick={()=>setPatConfig(null)}>✕</button></div>{patConfig.precauciones&&<div style={{padding:'8px 10px',background:'var(--ambl)',borderRadius:8,border:'1px solid var(--amb)',fontSize:10,color:'#8A6410',marginBottom:10,display:'flex',alignItems:'flex-start',gap:6}}><Ic name="alerta" size={13} style={{marginTop:1}}/> {patConfig.precauciones}</div>}<div className="g2"><div className="field"><label>Lado</label><select className="input" value={patConfig.lado} onChange={e=>setPatConfig((p:any)=>({...p,lado:e.target.value}))}><option value="bilateral">Bilateral</option><option value="izquierdo">Izquierdo</option><option value="derecho">Derecho</option><option value="no_aplica">No aplica</option></select></div><div className="field"><label>Estado</label><select className="input" value={patConfig.estado} onChange={e=>setPatConfig((p:any)=>({...p,estado:e.target.value}))}><option value="activa">Activa</option><option value="cronica">Crónica</option><option value="resuelta">Resuelta</option></select></div></div><div className="field"><label>Observaciones</label><textarea className="input" style={{minHeight:60}} value={patConfig.observaciones} onChange={e=>setPatConfig((p:any)=>({...p,observaciones:e.target.value}))}/></div><div onClick={()=>setPatConfig((p:any)=>({...p,tiene_informe:!p.tiene_informe}))} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,border:`1px solid ${patConfig.tiene_informe?'var(--g)':'var(--bd)'}`,background:patConfig.tiene_informe?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:10}}><div style={{width:16,height:16,borderRadius:3,border:`2px solid ${patConfig.tiene_informe?'var(--g)':'var(--bd)'}`,background:patConfig.tiene_informe?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{patConfig.tiene_informe&&<span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}</div><span style={{fontSize:11,color:'var(--n)',display:'inline-flex',alignItems:'center',gap:5}}><Ic name="informe" size={13}/> Tiene informe médico</span></div><div style={{display:'flex',gap:8}}><button className="btn btn-d btn-sm" onClick={()=>setPatConfig(null)}>Cancelar</button><div style={{flex:1}}/><button className="btn btn-p" onClick={guardarPatologia} disabled={guardando}>{guardando?'…':'✓ Añadir'}</button></div></div></div>}
    </>
  )
}
