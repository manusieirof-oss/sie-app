'use client'
import { useState, useEffect, useRef } from 'react'
import CuerpoZonas, { type ColorZona } from '@/components/CuerpoZonas'
import { ZONAS_CUERPO, zonasDeTest } from '@/lib/zonasCuerpo'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import Silueta, { MarcaCuerpo } from './Silueta'
import BuscadorBiblioteca from '@/components/BuscadorBiblioteca'
import Sparkline from './Sparkline'
import Documentos from './Documentos'
import { textoMedida } from '@/lib/tests'
import { anadirALista, quitarDeLista, type ListaClinica } from '@/lib/listasPaciente'
import EscalaSlider, { textoEscala } from '@/components/EscalaSlider'
import ModalItemClinico, { type ConfigItemClinico } from '@/components/ModalItemClinico'
import { hoyISO } from '@/lib/fechas'
import SaludRegistrosTest from './SaludRegistrosTest'
import SaludDetalle from './SaludDetalle'
import SaludLista from './SaludLista'
import SaludMapa from './SaludMapa'

export default function SaludTab({ id, pac, deportesPac, molestias, patologias, escalas, medicamentos, alergias, intolerancias, operaciones, tests, cargar, onNuevoTest, abrirTest, testsLib = [] }: any) {
  const [molsBiblio, setMolsBiblio] = useState<any[]>([])
  const [patsBiblio, setPatsBiblio] = useState<any[]>([])
  const [molConfig, setMolConfig] = useState<any>(null)
  const [patConfig, setPatConfig] = useState<any>(null)
  const [medsBiblio, setMedsBiblio] = useState<any[]>([])
  const [medConfig, setMedConfig] = useState<any>(null)
  const [opsBiblio, setOpsBiblio] = useState<any[]>([])
  const [etiquetasLib, setEtiquetasLib] = useState<any[]>([])
  /**
   * Dar de alta algo que no está en el catálogo.
   *
   * Antes cada lista lo resolvía a su manera: unas creaban la entrada pelada y otras ni
   * llegaban a la biblioteca —una alergia nueva se le ponía al paciente y luego no
   * aparecía en el buscador de nadie—. Ahora es el mismo modal de la pestaña Clínico, con
   * su zona, su descripción y sus etiquetas, y `luego` dice qué hacer con lo creado.
   */
  const [altaClinica, setAltaClinica] = useState<{config:ConfigItemClinico,valor:any,luego:(fila:any)=>void}|null>(null)
  const [opConfig, setOpConfig] = useState<any>(null)
  const [algBiblio, setAlgBiblio] = useState<any[]>([])
  const [intolBiblio, setIntolBiblio] = useState<any[]>([])
  const [depBiblio, setDepBiblio] = useState<any[]>([])
  const [plantBiblio, setPlantBiblio] = useState<any[]>([])
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('molestias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setMolsBiblio(data||[]))
    supabase.from('patologias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setPatsBiblio(data||[]))
    supabase.from('medicamentos_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setMedsBiblio(data||[]))
    supabase.from('operaciones_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setOpsBiblio(data||[]))
    supabase.from('etiquetas').select('*').order('nombre').then(({data})=>setEtiquetasLib(data||[]))
    supabase.from('alergias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setAlgBiblio(data||[]))
    supabase.from('intolerancias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setIntolBiblio(data||[]))
    supabase.from('deportes_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setDepBiblio(data||[]))
    supabase.from('plantillas_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setPlantBiblio(data||[]))
  }, [])

  async function toggleMolestia(mid: string, activa: boolean) {
    const { error: eG } = await supabase.from('molestias').update({ activa: !activa }).eq('id', mid)
    if (eG) { alert('No se ha podido cambiar la molestia:\n\n' + eG.message); return }
    // El día en que se quita: la nebulosa deja la huella desde ahí. Aparte, para que si falta la columna lo de activa funcione igual.
    await supabase.from('molestias').update({ resuelta_el: activa ? hoyISO() : null }).eq('id', mid)
    const mol = (molestias||[]).find((m:any)=>m.id===mid)
    const zona = mol?.zona || 'Molestia'
    if (activa) {
      await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'molestia_resuelta', titulo:`Molestia resuelta: ${zona}`, fecha:hoyISO() })
    } else {
      await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'molestia', titulo:`Molestia reactivada: ${zona}`, fecha:hoyISO() })
    }
    cargar()
  }

  async function cambiarEstadoPatologia(pid: string, nombre: string, nuevoEstado: string) {
    const { error: eG } = await supabase.from('patologias').update({ estado:nuevoEstado }).eq('id', pid)
    if (eG) { alert('No se ha podido cambiar la patología:\n\n' + eG.message); return }
    const lbl: Record<string,string> = { activa:'Activa', cronica:'Crónica', resuelta:'Resuelta' }
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:nuevoEstado==='resuelta'?'patologia_resuelta':'patologia', titulo:`Patología ${nombre}: ${lbl[nuevoEstado]||nuevoEstado}`, fecha:hoyISO() })
    cargar()
  }

  async function addDeporte(nombre: string) {
    if (!nombre.trim()) return
    const yaTiene = (deportesPac||[]).length>0
    const { error: eG } = await supabase.from('deportes_paciente').insert({ paciente_id:id, nombre })
    if (eG) { alert('No se ha podido guardar el deporte:\n\n' + eG.message); return }
    if (!yaTiene) await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'deporte', titulo:`Empieza a practicar deporte: ${nombre}`, fecha:hoyISO() })
    else await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'deporte', titulo:`Nuevo deporte: ${nombre}`, fecha:hoyISO() })
    cargar()
  }
  async function delDeporte(did: string, nombre: string) {
    const { error: eG } = await supabase.from('deportes_paciente').delete().eq('id', did)
    if (eG) { alert('No se ha podido quitar el deporte:\n\n' + eG.message); return }
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'deporte', titulo:`Deja el deporte: ${nombre}`, fecha:hoyISO() })
    cargar()
  }

  // Se borra la fila pero queda el evento: la medicación que tomó en su día
  // es historia clínica y no debe evaporarse al quitarla de la ficha.
  async function delMedicamento(mid: string, nombre: string) {
    const { error: eG } = await supabase.from('medicamentos').delete().eq('id', mid)
    if (eG) { alert('No se ha podido quitar el medicamento:\n\n' + eG.message); return }
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'medicamento', titulo:`Deja el medicamento: ${nombre}`, fecha:hoyISO() })
    cargar()
  }

  // Alergias, intolerancias y operaciones van por `lib/listasPaciente`, que es el único
  // sitio que escribe en esas tres tablas. La copia que había aquí no la compartía la
  // valoración, y por eso la valoración acabó guardándolas en un JSON donde nadie mira.
  async function addLista(lista: ListaClinica, entrada: any) {
    const r = await anadirALista(id, lista, [entrada])
    if (!r.ok) { alert('Error: '+r.error); return }
    if (r.anadidas === 0 && r.repetidas.length) { alert(`Ya consta: ${r.repetidas.join(', ')}`); return }
    cargar()
  }
  async function delLista(lista: ListaClinica, rid: string, nombre: string) {
    const r = await quitarDeLista(id, lista, rid, nombre)
    if (!r.ok) { alert('Error: '+r.error); return }
    cargar()
  }

  const addAlergia = (n:string) => addLista('alergias', { nombre:n })
  const delAlergia = (aid:string, n:string) => delLista('alergias', aid, n)
  const addIntolerancia = (n:string) => addLista('intolerancias', { nombre:n })
  const delIntolerancia = (iid:string, n:string) => delLista('intolerancias', iid, n)
  const delOperacion = (oid:string, n:string) => delLista('operaciones', oid, n)

  const [usaPlantillas, setUsaPlantillas] = useState(false)
  const [plantIzq, setPlantIzq] = useState('')
  const [plantDer, setPlantDer] = useState('')
  const [guardandoSalud, setGuardandoSalud] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [detalle, setDetalle] = useState<any>(null)
  const [vista, setVista] = useState<'lista'|'mapa'>('lista')
  // MAPA DE CALOR DE LOS TESTS: zona tocada en el muñeco (filtra la lista).
  const [zonaTest, setZonaTest] = useState<string|null>(null)
  const [escalaConfig, setEscalaConfig] = useState<any>(null)
  const [nDocs, setNDocs] = useState(0)
  /**
   * Qué test tiene abierto el listado de registros. Guarda el test_id y su nombre, no las
   * filas: las filas se sacan de `tests` en el momento, así que al borrar una se refresca
   * sola sin tener que acordarse de actualizar dos sitios.
   */
  const [registrosDe, setRegistrosDe] = useState<{id:string,nombre:string}|null>(null)

  const LBL_TIPO_MOL: Record<string,string> = { molestia:'Molestia', dolor_agudo:'Dolor agudo', dolor_cronico:'Dolor crónico', rigidez:'Rigidez' }
  const LBL_EST_PAT: Record<string,string> = { activa:'Activa', cronica:'Crónica', resuelta:'Resuelta' }
  const cap = (v:string) => v ? v.charAt(0).toUpperCase()+v.slice(1) : ''
  const hoy = () => hoyISO()
  // Valencias opuestas: bienestar bajo es malo, estrés alto es malo.
  const colorBienestar = (v:number) => v>=7 ? 'var(--gd)' : v>=4 ? 'var(--amb)' : 'var(--red)'
  const colorEstres    = (v:number) => v<=3 ? 'var(--gd)' : v<=6 ? 'var(--amb)' : 'var(--red)'

  async function guardarEscala() {
    if (!escalaConfig) return
    setGuardando(true)
    const { error: eG } = await supabase.from('escalas').insert({
      paciente_id:id, fecha:escalaConfig.fecha,
      borg:escalaConfig.borg, estres:escalaConfig.estres,
    })
    if (eG) { setGuardando(false); alert('No se ha podido guardar la escala:\n\n' + eG.message); return }
    await supabase.from('eventos_paciente').insert({
      paciente_id:id, tipo:'escala',
      titulo:`Escalas: bienestar ${textoEscala(escalaConfig.borg)} · estrés ${textoEscala(escalaConfig.estres)}`,
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
    const { error: eG } = await supabase.from('pacientes').update({
      usa_plantillas: usaPlantillas,
      plantilla_izq: usaPlantillas ? (plantIzq || null) : null,
      plantilla_der: usaPlantillas ? (plantDer || null) : null,
    }).eq('id', id)
    if (eG) { setGuardandoSalud(false); alert('No se ha podido guardar las plantillas:\n\n' + eG.message); return }

    const hoy = hoyISO()
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
    const { error: eG } = await supabase.from('medicamentos').insert({ paciente_id:id, nombre:medConfig.nombre, frecuencia:medConfig.frecuencia||'', observaciones:medConfig.observaciones||'' })
    if (eG) { setGuardando(false); alert('No se ha podido guardar el medicamento:\n\n' + eG.message); return }
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'medicamento', titulo:`Medicamento: ${medConfig.nombre}`, descripcion:medConfig.frecuencia?`Frecuencia: ${medConfig.frecuencia}`:null, fecha:hoyISO() })
    setMedConfig(null); setGuardando(false); cargar()
  }

  async function guardarMolestia() {
    if (!molConfig) return
    setGuardando(true)
    // `biblioteca_id` es lo que convierte esta fila en algo relacionable. Sin él, la
    // molestia solo tiene el texto de `zona`, que unas veces viene de la biblioteca y
    // otras se teclea, y no hay forma fiable de saber cuál es cuál.
    // Mismo motivo que en la patología: sin leer el error, un fallo se ve igual que un
    // acierto y el dato desaparece sin que nadie sepa por qué.
    const { error } = await supabase.from('molestias').insert({ paciente_id:id, zona:molConfig.zona, biblioteca_id:molConfig.biblioteca_id||null, tipo:molConfig.tipo, eva:molConfig.eva, lado:molConfig.lado||null, sensacion:molConfig.cuando||null, observaciones:molConfig.observaciones||null, activa:true })
    if (error) { setGuardando(false); alert('No se ha podido guardar la molestia:\n\n' + error.message); return }
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'molestia', titulo:`Molestia: ${molConfig.zona}${molConfig.eva==null?'':` (EVA ${molConfig.eva}/10)`}`, descripcion:molConfig.observaciones||null, fecha:hoyISO() })
    setMolConfig(null); setGuardando(false); cargar()
  }

  /**
   * BORRAR NO ES RESOLVER, y hacían falta las dos.
   *
   * "Resolver" dice que la persona lo superó: es historia clínica y tiene que quedarse.
   * Borrar es para lo que nunca existió —una patología apuntada en la ficha equivocada, un
   * nombre mal elegido— y eso no se arregla marcándolo como resuelto: dejaría en su
   * historial una lesión que no tuvo.
   *
   * Se avisa de que no es lo mismo y se pide confirmación, porque desde la lista los dos
   * botones están a un centímetro.
   */
  async function borrarClinico(tabla: string, fila: any, etiqueta: string) {
    if (!confirm(
      `¿Borrar "${etiqueta}" de su ficha?\n\n` +
      `Esto es para cuando se apuntó POR ERROR: desaparece sin dejar rastro.\n` +
      `Si lo que pasa es que ya lo superó, cierra esto y usa "Resolver", que sí lo conserva en su historial.`)) return
    const { error } = await supabase.from(tabla).delete().eq('id', fila.id)
    if (error) { alert('No se ha podido borrar:\n\n' + error.message); return }
    cargar()
  }

  async function guardarPatologia() {
    if (!patConfig) return
    setGuardando(true)
    // La ZONA se copia de la biblioteca al asignarla. Antes no se guardaba y el mapa
    // corporal tenía que deducirla del nombre —"Condropatía rotuliana" no contiene
    // "rodilla"—, así que media lista caía en "sin localizar".
    // SE LEE EL ERROR. Antes no se miraba, así que una patología que no llegaba a
    // guardarse cerraba el modal como si todo hubiera ido bien y luego no aparecía en la
    // ficha: parecía que la pantalla no se refrescaba, cuando no había nada que refrescar.
    const { error } = await supabase.from('patologias').insert({ paciente_id:id, nombre:patConfig.nombre, zona:patConfig.zona||null, biblioteca_id:patConfig.biblioteca_id||null, lado:patConfig.lado||null, estado:patConfig.estado, descripcion:patConfig.observaciones||'', informe_url:patConfig.tiene_informe?'pendiente':null })
    if (error) { setGuardando(false); alert('No se ha podido guardar la patología:\n\n' + error.message); return }
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'patologia', titulo:`Patología: ${patConfig.nombre}`, descripcion:patConfig.observaciones||null, fecha:hoyISO() })
    setPatConfig(null); setGuardando(false); cargar()
  }


  /**
   * Borrar UN resultado de test.
   *
   * Hace falta sobre todo para limpiar los lados que no existen: hasta hace nada, elegir un
   * test lateral desde el explorador lo abría con lado "bilateral" y se guardaba así, de
   * modo que el mismo test aparece con izquierdo, derecho Y bilateral. Ese tercero no es
   * un resultado, es un error de registro, y no había forma de quitarlo.
   *
   * Los objetivos que abrió NO se tocan: cerrarlos es una decisión clínica y se hace desde
   * la ficha. Borrar la medición no significa que el problema no exista.
   */
  async function borrarResultado(t:any) {
    const fecha = new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES')
    const lado = t.lado && t.lado!=='bilateral' ? ` · ${cap(t.lado)}` : ''
    if (!confirm(`¿Borrar el resultado del ${fecha}${lado}?\n\nSe borra solo esta medición. Los objetivos que abrió siguen abiertos.`)) return
    // Segunda confirmación: esto es historia clínica y no se puede deshacer.
    if (!confirm('Segunda confirmación: se elimina el registro y no se puede recuperar.')) return
    const { error } = await supabase.from('resultados_tests').delete().eq('id', t.id)
    if (error) { alert('No se pudo borrar: ' + error.message); return }
    cargar()
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

  // Molestias y patologías llevadas al cuerpo. La patología guarda su zona desde que se
  // asigna; el `|| p.nombre` es solo para las filas anteriores a ese cambio.
  const marcasCuerpo: MarcaCuerpo[] = [
    ...(molestias||[]).map((m:any)=>({
      id: 'mol_'+m.id, zona: m.zona, lado: m.lado,
      titulo: m.zona, detalle: m.eva==null ? 'Sin EVA' : `EVA ${m.eva}/10`,
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

      <SaludMapa {...{ alergias, deportesPac, escalas, id, intolerancias, marcasCuerpo, medicamentos, molestias, nDocs, nombreTest, operaciones, pac, patologias, setDetalle, testsNegativos, testsPositivos, vista }} />

      <SaludLista {...{ LBL_EST_PAT, LBL_TIPO_MOL, abrirTest, addAlergia, addDeporte, addIntolerancia, alergias, algBiblio, borrarClinico, cambiarEstadoPatologia, cap, colorBienestar, colorEstres, delAlergia, delDeporte, delIntolerancia, delMedicamento, delOperacion, depBiblio, deportesPac, escalas, etiquetasLib, gruposTests, guardado, guardandoSalud, id, intolBiblio, intolerancias, medicamentos, medsBiblio, molActivas, molResueltas, molsBiblio, onNuevoTest, operaciones, opsBiblio, patActivas, patResueltas, patologias, patsBiblio, plantBiblio, plantDer, plantIzq, setAlgBiblio, setAltaClinica, setDetalle, setEscalaConfig, setIntolBiblio, setMedConfig, setMedsBiblio, setMolConfig, setMolsBiblio, setNDocs, setOpConfig, setOpsBiblio, setPatConfig, setPatsBiblio, setPlantDer, setPlantIzq, setRegistrosDe, setUsaPlantillas, setZonaTest, tests, testsLib, tocado, toggleMolestia, usaPlantillas, vista, zonaTest }} />

      {/* MODAL ESCALAS */}
      {escalaConfig && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setEscalaConfig(null)}}>
          <div className="modal">
            <div className="modal-title">Registrar escalas<button className="modal-close" onClick={()=>setEscalaConfig(null)}>✕</button></div>
            <div className="field"><label>Fecha</label>
              <input type="date" className="input" value={escalaConfig.fecha} onChange={e=>setEscalaConfig((p:any)=>({...p,fecha:e.target.value}))}/>
            </div>
            {([['borg','Bienestar','0 = fatal · 10 = estupendo',colorBienestar,'0 Fatal','10 Estupendo'],['estres','Estrés','0 = ninguno · 10 = máximo',colorEstres,'0 Ninguno','10 Máximo']] as const).map(([k,lbl,ayuda,fn,izq,der]:any)=>(
              <EscalaSlider key={k} label={lbl} ayuda={ayuda} izquierda={izq} derecha={der}
                valor={escalaConfig[k]} color={fn(escalaConfig[k] ?? 5)}
                onCambio={v=>setEscalaConfig((p:any)=>({...p,[k]:v}))}/>
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
      <SaludDetalle {...{ LBL_EST_PAT, LBL_TIPO_MOL, abrirTest, cap, cargar, detalle, nombreTest, setDetalle }} />

      {/* MODAL CONFIGURAR MEDICAMENTO */}
      {medConfig&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setMedConfig(null)}}><div className="modal"><div className="modal-title">{medConfig.nombre}<button className="modal-close" onClick={()=>setMedConfig(null)}>✕</button></div><div className="field"><label>Frecuencia</label><input className="input" value={medConfig.frecuencia} onChange={e=>setMedConfig((p:any)=>({...p,frecuencia:e.target.value}))} placeholder="ej. 1 cada 8h, Diario, Solo si dolor..."/></div><div className="field"><label>Observaciones</label><textarea className="input" style={{minHeight:60}} value={medConfig.observaciones} onChange={e=>setMedConfig((p:any)=>({...p,observaciones:e.target.value}))} placeholder="Dosis, pauta, motivo..."/></div><div style={{display:'flex',gap:8,marginTop:8}}><button className="btn btn-d btn-sm" onClick={()=>setMedConfig(null)}>Cancelar</button><div style={{flex:1}}/><button className="btn btn-p" onClick={guardarMedicamento} disabled={guardando}>{guardando?'…':'✓ Añadir'}</button></div></div></div>}

      {altaClinica && (
        <ModalItemClinico
          config={altaClinica.config} valor={altaClinica.valor} etiquetas={etiquetasLib}
          onGuardado={(fila:any)=>{ const f=altaClinica.luego; setAltaClinica(null); f(fila) }}
          onCerrar={()=>setAltaClinica(null)}/>
      )}

      {/* MODAL CONFIGURAR OPERACIÓN */}
      {opConfig&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setOpConfig(null)}}><div className="modal"><div className="modal-title">{opConfig.nombre}<button className="modal-close" onClick={()=>setOpConfig(null)}>✕</button></div><div className="g2"><div className="field"><label>Año</label><input className="input" value={opConfig.anio} onChange={e=>setOpConfig((p:any)=>({...p,anio:e.target.value}))} placeholder="ej. 2019"/></div><div className="field"><label>Lado</label><select className="input" value={opConfig.lado} onChange={e=>setOpConfig((p:any)=>({...p,lado:e.target.value}))}><option value="no_aplica">No aplica</option><option value="izquierdo">Izquierdo</option><option value="derecho">Derecho</option><option value="bilateral">Bilateral</option></select></div></div><div className="field"><label>Observaciones</label><textarea className="input" style={{minHeight:60}} value={opConfig.observaciones} onChange={e=>setOpConfig((p:any)=>({...p,observaciones:e.target.value}))} placeholder="Técnica, secuelas, limitaciones..."/></div><div onClick={()=>setOpConfig((p:any)=>({...p,tiene_informe:!p.tiene_informe}))} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:6,border:`1px solid ${opConfig.tiene_informe?'var(--g)':'var(--bd)'}`,background:opConfig.tiene_informe?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:10}}><div style={{width:16,height:16,borderRadius:3,border:`2px solid ${opConfig.tiene_informe?'var(--g)':'var(--bd)'}`,background:opConfig.tiene_informe?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{opConfig.tiene_informe&&<span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}</div><span style={{fontSize:13,color:'var(--n)',display:'inline-flex',alignItems:'center',gap:5}}><Ic name="informe" size={13}/> Tiene informe</span></div><div style={{display:'flex',gap:8}}><button className="btn btn-d btn-sm" onClick={()=>setOpConfig(null)}>Cancelar</button><div style={{flex:1}}/><button className="btn btn-p" onClick={async()=>{const o=opConfig;setOpConfig(null);await addLista('operaciones',o)}}>✓ Añadir</button></div></div></div>}

      {/* MODAL CONFIGURAR MOLESTIA */}
      {molConfig&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setMolConfig(null)}}><div className="modal"><div className="modal-title">{molConfig.nombre}<button className="modal-close" onClick={()=>setMolConfig(null)}>✕</button></div><div className="g2"><div className="field"><label>Tipo</label><select className="input" value={molConfig.tipo} onChange={e=>setMolConfig((p:any)=>({...p,tipo:e.target.value}))}><option value="molestia">Molestia</option><option value="dolor_agudo">Dolor agudo</option><option value="dolor_cronico">Dolor crónico</option><option value="rigidez">Rigidez</option></select></div><div className="field"><label>Lado</label><select className="input" value={molConfig.lado} onChange={e=>setMolConfig((p:any)=>({...p,lado:e.target.value}))}><option value="bilateral">Bilateral</option><option value="izquierdo">Izquierdo</option><option value="derecho">Derecho</option></select></div></div><EscalaSlider label="EVA · intensidad" valor={molConfig.eva} color="var(--red)" izquierda="0 Nada" derecha="10 Insoportable" onCambio={v=>setMolConfig((p:any)=>({...p,eva:v}))}/><div className="field"><label>¿Cuándo aparece?</label><div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:4}}>{['En reposo','Al moverse','Con carga','Al caminar','Siempre','Al despertar'].map(c=><span key={c} onClick={()=>setMolConfig((p:any)=>({...p,cuando:c}))} style={{fontSize:10,padding:'3px 9px',borderRadius:99,border:`1px solid ${molConfig.cuando===c?'var(--g)':'var(--bd)'}`,background:molConfig.cuando===c?'var(--g)':'var(--w)',color:molConfig.cuando===c?'#fff':'var(--gr)',cursor:'pointer'}}>{c}</span>)}</div></div><div className="field"><label>Observaciones</label><textarea className="input" style={{minHeight:60}} value={molConfig.observaciones} onChange={e=>setMolConfig((p:any)=>({...p,observaciones:e.target.value}))} placeholder="Sensación, qué lo provoca..."/></div><div style={{display:'flex',gap:8,marginTop:8}}><button className="btn btn-d btn-sm" onClick={()=>setMolConfig(null)}>Cancelar</button><div style={{flex:1}}/><button className="btn btn-p" onClick={guardarMolestia} disabled={guardando}>{guardando?'…':'✓ Añadir'}</button></div></div></div>}

      {/* MODAL CONFIGURAR PATOLOGÍA */}
      {patConfig&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setPatConfig(null)}}><div className="modal"><div className="modal-title">{patConfig.nombre}<button className="modal-close" onClick={()=>setPatConfig(null)}>✕</button></div>{patConfig.precauciones&&<div style={{padding:'8px 10px',background:'var(--ambl)',borderRadius:8,border:'1px solid var(--amb)',fontSize:10,color:'#8A6410',marginBottom:10,display:'flex',alignItems:'flex-start',gap:6}}><Ic name="alerta" size={13} style={{marginTop:1}}/> {patConfig.precauciones}</div>}<div className="g2"><div className="field"><label>Lado</label><select className="input" value={patConfig.lado} onChange={e=>setPatConfig((p:any)=>({...p,lado:e.target.value}))}><option value="bilateral">Bilateral</option><option value="izquierdo">Izquierdo</option><option value="derecho">Derecho</option><option value="no_aplica">No aplica</option></select></div><div className="field"><label>Estado</label><select className="input" value={patConfig.estado} onChange={e=>setPatConfig((p:any)=>({...p,estado:e.target.value}))}><option value="activa">Activa</option><option value="cronica">Crónica</option><option value="resuelta">Resuelta</option></select></div></div><div className="field"><label>Observaciones</label><textarea className="input" style={{minHeight:60}} value={patConfig.observaciones} onChange={e=>setPatConfig((p:any)=>({...p,observaciones:e.target.value}))}/></div><div onClick={()=>setPatConfig((p:any)=>({...p,tiene_informe:!p.tiene_informe}))} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,border:`1px solid ${patConfig.tiene_informe?'var(--g)':'var(--bd)'}`,background:patConfig.tiene_informe?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:10}}><div style={{width:16,height:16,borderRadius:3,border:`2px solid ${patConfig.tiene_informe?'var(--g)':'var(--bd)'}`,background:patConfig.tiene_informe?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{patConfig.tiene_informe&&<span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}</div><span style={{fontSize:11,color:'var(--n)',display:'inline-flex',alignItems:'center',gap:5}}><Ic name="informe" size={13}/> Tiene informe médico</span></div><div style={{display:'flex',gap:8}}><button className="btn btn-d btn-sm" onClick={()=>setPatConfig(null)}>Cancelar</button><div style={{flex:1}}/><button className="btn btn-p" onClick={guardarPatologia} disabled={guardando}>{guardando?'…':'✓ Añadir'}</button></div></div></div>}

      {/* REGISTROS DE UN TEST · todas las veces que se pasó, de los dos lados */}
      <SaludRegistrosTest {...{ borrarResultado, cap, registrosDe, setRegistrosDe, tests }} />
    </>
  )
}
