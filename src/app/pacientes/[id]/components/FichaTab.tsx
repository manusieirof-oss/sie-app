'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import SesionesBono from '@/components/SesionesBono'
import { iconTipoClase, nombreTipoClase } from '@/lib/tipos'
import Consentimientos from './Consentimientos'
import { guardarVias } from '@/lib/objetivos'
import { ordenAnatomico } from '@/lib/anatomia'
import { hoyISO } from '@/lib/fechas'

const TIPOS_AL: Record<string,string> = {dolor:'Dolor / molestia',lesion:'Lesión',cita_medica:'Cita médica',personal:'Situación personal',duda:'Duda / consulta',otro:'Otro'}
const LBL_PAGO: Record<string,string> = { pagado:'Pagado', pendiente:'Pendiente', impago:'Impago' }
const DOT_PAGO: Record<string,string> = { pagado:'var(--g)', pendiente:'var(--amb)', impago:'var(--red)' }

const fmtDia = (f:string) => new Date(f+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})
const fmtLargo = (f:string) => new Date(f+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})

function haceCuanto(f:string) {
  const meses = Math.floor((Date.now()-new Date(f+'T12:00:00').getTime())/(1000*60*60*24*30.44))
  if (meses < 1) return 'este mes'
  if (meses === 1) return 'hace 1 mes'
  if (meses < 12) return `hace ${meses} meses`
  const a = Math.floor(meses/12)
  return a === 1 ? 'hace 1 año' : `hace ${a} años`
}

export default function FichaTab({ pac, bono, recuperaciones, editando, form, setForm, setModalBono, bonoLabel, mes, anio, alertas, cerrarAlerta, cambiarPago, tiposClase = [], cambiarTipoClase, estadoPago = 'pendiente', onCobrar, bonosSesiones = [], onRenovarSesiones, onRetirarSesiones }: any) {
  const [valoracion, setValoracion] = useState<any>(null)
  const [objetivosTrabajo, setObjetivosTrabajo] = useState<any[]>([])
  /**
   * Las sesiones de este paciente con los objetivos que trabajan.
   *
   * Es la tercera pata de la cadena y la única que no se veía desde aquí: el test abre el
   * objetivo, las sesiones son la estrategia para llegar a él, y el mismo test lo cierra.
   * Sin esto, un objetivo abierto que no trabaja ninguna sesión se veía exactamente igual
   * que uno con tres sesiones detrás.
   */
  const [sesionesPac, setSesionesPac] = useState<any[]>([])
  /** Sus citas con la sesión que tienen asignada. Para saber qué se trabaja de verdad. */
  const [citasPac, setCitasPac] = useState<any[]>([])
  const [menuTipo, setMenuTipo] = useState<any>(null)
  const [menuPago, setMenuPago] = useState<any>(null)
  const [anamnesisAbierta, setAnamnesisAbierta] = useState(false)
  const [guardandoVia, setGuardandoVia] = useState<string|null>(null)
  const [resultadosTests, setResultadosTests] = useState<any[]>([])
  const [testsLib, setTestsLib] = useState<any[]>([])
  const [etiquetasLib, setEtiquetasLib] = useState<any[]>([])
  /** Qué moneda está abierta. Solo una: dos paneles abiertos ya no son una lista. */
  const [objAbierto, setObjAbierto] = useState<string|null>(null)
  const [modalAnadir, setModalAnadir] = useState(false)
  const [catalogo, setCatalogo] = useState<any[]>([])
  const [buscarObj, setBuscarObj] = useState('')
  const [selObj, setSelObj] = useState<string[]>([])
  const [zonaObj, setZonaObj] = useState('')
  const [patologiasPac, setPatologiasPac] = useState<any[]>([])
  /**
   * Objetivo al que hay que abrirle una meta nueva nada más cerrar el modal de "Añadir".
   *
   * Un métrico que el paciente YA tiene no se puede volver a asignar, pero sí se le puede
   * abrir otro movimiento. Antes salía apagado con un "ya lo tiene" y era un callejón:
   * el sitio natural para pedirlo es el mismo botón de Añadir.
   */
  const [pedirMetaEn, setPedirMetaEn] = useState<string|null>(null)

  /**
   * Objetivos que corresponden a las patologías del paciente.
   *
   * El cruce va por etiqueta: las fases y los cualitativos llevan su patología —"Recuperar
   * de trocanteritis" lleva Trocantéritis— y el paciente tiene las suyas por nombre. Se
   * marcan en el selector en vez de filtrar, porque son una sugerencia y no una regla: hay
   * objetivos que se ponen sin patología detrás.
   */
  const porPatologia = (() => {
    const activas = patologiasPac.filter((p:any)=>p.estado!=='resuelta')
    if (activas.length===0) return {} as Record<string,string>
    const norm = (x:string)=>(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
    const idsPorNombre: Record<string,string> = {}
    etiquetasLib.forEach((e:any)=>{ idsPorNombre[norm(e.nombre)] = e.id })
    const mapa: Record<string,string> = {}
    activas.forEach((p:any)=>{
      const id = idsPorNombre[norm(p.nombre)]
      if (!id) return
      catalogo.forEach((o:any)=>{ if ((o.etiquetas||[]).includes(id)) mapa[o.id] = p.nombre })
    })
    return mapa
  })()

  /**
   * Asigna varios objetivos de golpe.
   *
   * De uno en uno obligaba a abrir y cerrar el modal por cada uno, y lo normal es poner
   * tres o cuatro a la vez: al valorar un hombro salen fuerza, movilidad y algún
   * cualitativo del mismo tirón.
   *
   * Nacen SIN vías: se cierran a mano con "Dar por logrado". Ponerle una
   * vía de relleno haría que `estaLogrado` lo diera por cumplido en cuanto alguien la
   * marcara, sin haber medido nada.
   */
  async function anadirObjetivos(lista:any[]) {
    if (lista.length===0) return
    setGuardandoVia('anadir')
    const { error } = await supabase.from('pacientes_objetivos').insert(
      lista.map((o:any)=>({ paciente_id: pac.id, objetivo_id: o.id, origen: 'manual', vias: [] })))
    if (error) { setGuardandoVia(null); alert(error.message); return }
    // Ya no se le copia ninguna parte: un objetivo añadido a mano nace sin nada y se cierra
    // a mano, con "Dar por logrado". Es lo que se decidió al quitar metas y logros.
    setGuardandoVia(null)
    // Un solo evento con el total: abrir cuatro objetivos a la vez es una decisión, no
    // cuatro hitos en la cronología.
    await supabase.from('eventos_paciente').insert({
      paciente_id: pac.id, tipo: 'objetivo',
      titulo: lista.length===1
        ? `Objetivo abierto: ${lista[0].nombre}`
        : `${lista.length} objetivos abiertos`,
      descripcion: lista.length===1 ? 'Añadido desde la ficha' : lista.map((o:any)=>o.nombre).join(', '),
      fecha: hoyISO(),
    })
    setModalAnadir(false); setBuscarObj(''); setSelObj([]); cargarObjetivos()
  }

  function cargarObjetivos() {
    if (!pac?.id) return
    supabase.from('pacientes_objetivos').select('objetivo_id, origen, vias, logrado, fecha_logrado, objetivos(id,nombre,descripcion,movimientos,articulacion_id,imagen_url)').eq('paciente_id', pac.id).then(({data}) => {
      setObjetivosTrabajo((data||[]).map((r:any)=>({...r.objetivos, origen:r.origen, vias:r.vias||[], logrado:r.logrado, fecha_logrado:r.fecha_logrado })).filter((o:any)=>o.id))
    })
    supabase.from('resultados_tests').select('test_id,lado,fecha,items_resultado').eq('paciente_id', pac.id)
      .then(({data}) => setResultadosTests(data||[]))
    // `tipo_lado` hace falta para saber si un test va por lados o entero: es lo que decide
    // qué columnas ofrece el formulario de meta.
    supabase.from('tests').select('id,nombre,items,etiquetas_relacionadas,tipo_lado').order('nombre').then(({data}) => setTestsLib(data||[]))
    supabase.from('etiquetas').select('id,nombre').then(({data}) => setEtiquetasLib(data||[]))
    // `imagen_url`: el catálogo se pinta con monedas en el modal de añadir, igual que la ficha.
    supabase.from('sesiones').select('id,nombre,sesiones_objetivos(objetivo_id)').eq('paciente_id', pac.id)
      .then(({data}) => setSesionesPac(data||[]))
    // Todas sus citas que cuentan como clase, pasadas y futuras. Las canceladas no: una
    // clase que no se dio ni se va a dar no trabaja nada.
    supabase.from('citas').select('id,fecha,estado,sesion_id').eq('paciente_id', pac.id)
      .in('estado', ['programada','realizada']).order('fecha')
      .then(({data}) => setCitasPac(data||[]))
    supabase.from('objetivos').select('id,nombre,descripcion,movimientos,articulacion_id,etiquetas,imagen_url')
      .eq('activo', true).order('nombre').then(({data}) => setCatalogo(data||[]))
    supabase.from('patologias').select('nombre,estado').eq('paciente_id', pac.id)
      .then(({data}) => setPatologiasPac(data||[]))
  }

  useEffect(() => {
    if (pac?.id) {
      supabase.from('valoraciones').select('*').eq('paciente_id', pac.id).order('fecha', {ascending: false}).limit(1).then(({data}) => {
        if (data && data.length > 0) {
          const v = data[0]
          const eg = v.estado_general ? JSON.parse(v.estado_general) : {}
          setValoracion({...v, ...eg})
        }
      })
      cargarObjetivos()
    }
  }, [pac?.id])

  // Cierre manual de una vía. Lo automático (test negativo, ítem del taller) cubre
  // el caso normal, pero hay vías que se resuelven fuera de la app —el paciente ya
  // no tiene dolor, se decide dar por bueno el gesto— y sin esto no había forma de
  // cerrar un objetivo. Se marca la vía, no el objetivo: así el "logrado" sigue
  // saliendo de la misma regla y no hay dos verdades.
  // Objetivos sin ninguna vía: filas anteriores al modelo de vías. Como "logrado"
  // exige que todas las vías estén resueltas y no hay ninguna, jamás podrían cerrarse.
  // Se les crea una vía de cierre manual en vez de tocar `logrado` a mano, para que
  // la regla siga siendo la única que decide y el objetivo se pueda reabrir igual.
  async function cerrarSinVias(o:any) {
    const via = { tipo:'manual', ref:'', etiqueta:'Cierre manual', resuelto:true,
      fecha_resuelto:hoyISO() }
    setGuardandoVia(o.id)
    const r = await guardarVias(pac.id, o.id, [via], { logradoAntes: !!o.logrado, contexto: 'la ficha' })
    setGuardandoVia(null)
    if (!r.ok) { alert('No se pudo guardar: ' + r.error); return }
    cargarObjetivos()
  }

  async function toggleVia(o:any, vi:number) {
    const vias = (Array.isArray(o.vias)?o.vias:[]).map((v:any,i:number)=>
      i===vi ? {...v, resuelto:!v.resuelto, fecha_resuelto:!v.resuelto?hoyISO():null} : v)
    setGuardandoVia(o.id)
    const r = await guardarVias(pac.id, o.id, vias, { logradoAntes: !!o.logrado, contexto: 'la ficha' })
    setGuardandoVia(null)
    if (!r.ok) { alert('No se pudo guardar: ' + r.error); return }
    cargarObjetivos()
  }

  // Los logrados se apartan a un desplegable: el bloque tiene que enseñar en qué se
  // trabaja ahora. El hito no se pierde —queda su evento en el historial— y desde
  // aquí se puede reabrir tocando una vía.
  const objetivosActivos = objetivosTrabajo.filter((o:any)=>!o.logrado)
  const objetivosLogrados = objetivosTrabajo.filter((o:any)=>o.logrado)
    .sort((a:any,b:any)=>(b.fecha_logrado||'').localeCompare(a.fecha_logrado||''))

  /**
   * Los objetivos ESPECÍFICOS que este paciente tiene abiertos dentro del general.
   *
   * Salen de sus VÍAS, no del catálogo: "Movilidad de tobillo" ofrece cuatro movimientos,
   * pero de este paciente solo se trabaja el que su test señaló. Listar los cuatro sería
   * enseñar catálogo donde se espera tratamiento.
   *
   * Antes salían de las metas. Al quitarlas habrían desaparecido de la moneda, y son la
   * mitad de lo que se lee en la rejilla; la vía dice lo mismo y lo dice antes — es el
   * propio test el que apunta qué específico abrió.
   */
  const especificosDe = (o:any): string[] => Array.from(new Set(
    (Array.isArray(o.vias) ? o.vias : [])
      .filter((v:any)=>!v.resuelto && v.mov)
      .map((v:any)=>etiquetasLib.find((e:any)=>e.id===v.mov)?.nombre)
      .filter(Boolean)
  )) as string[]

  /**
   * EN CUÁNTAS CLASES SE TRABAJA CADA OBJETIVO.
   *
   * La ficha ya decía "se trabaja en 3 sesiones", pero eso es tener la sesión guardada, no
   * tenerla puesta en la agenda. Una sesión que persigue un objetivo y nunca se programa no
   * trabaja nada, y esa diferencia no se veía por ninguna parte.
   *
   * Sale de cruzar cita → sesión → objetivos. No se guarda: cambiar la sesión de una cita
   * lo recalcula solo, que es justo lo que un contador guardado no haría.
   */
  const clasesPorObjetivo = (() => {
    const objsDeSesion: Record<string, string[]> = {}
    ;(sesionesPac||[]).forEach((s:any)=>{
      objsDeSesion[s.id] = (s.sesiones_objetivos||[]).map((r:any)=>r.objetivo_id)
    })
    const hoy = hoyISO()
    const cuenta: Record<string, {total:number, porDelante:number}> = {}
    ;(citasPac||[]).forEach((c:any)=>{
      if (!c.sesion_id) return
      for (const oid of (objsDeSesion[c.sesion_id]||[])) {
        const r = cuenta[oid] || (cuenta[oid] = { total:0, porDelante:0 })
        r.total++
        if (c.fecha >= hoy) r.porDelante++
      }
    })
    return cuenta
  })()

  /**
   * ¿Tiene clases sin sesión asignada?
   *
   * Distingue dos problemas que se ven igual: que sus sesiones no persigan un objetivo, o
   * que las clases no tengan sesión puesta. El arreglo es distinto en cada caso, así que
   * el aviso tiene que decir cuál es.
   */
  const citasSinSesion = (citasPac||[]).filter((c:any)=>!c.sesion_id).length

  /** El aro de la moneda: gris si está logrado, si no el color del objetivo. */
  const monedaDe = (o:any, grande=false) => (
    <span className={`obj-moneda${grande?' g':''}`} style={{
      background: o.imagen_url ? 'var(--bl)' : 'var(--gl)',
      borderColor: o.logrado ? 'var(--gm)' : 'var(--g)',
      opacity: o.logrado ? .55 : 1,
    }}>
      {o.imagen_url
        ? <img src={o.imagen_url} alt=""/>
        : <b style={{color:'var(--g)'}}>{(o.nombre||'?').trim().charAt(0).toUpperCase()}</b>}
    </span>
  )

  /**
   * La moneda de la rejilla. Las vías viven dentro y se abren
   * al pulsarla: la ficha enseñaba diez bloques desplegados a la vez y no se veía de un
   * vistazo en qué se está trabajando, que es justo lo que hay que ver al abrirla.
   */
  const pintarMoneda = (o:any) => {
    const esp = especificosDe(o)
    const abierto = objAbierto === o.id
    return (
      <button key={o.id} type="button" className={`obj-mon-b${abierto?' on':''}`}
        title={esp.length ? `${o.nombre} · ${esp.join(' · ')}` : o.nombre}
        onClick={()=>setObjAbierto(abierto ? null : o.id)}>
        {monedaDe(o, true)}
        {/* El general se escribe SIEMPRE. Mientras los objetivos no tengan foto la moneda
            es una letra, así que sin este renglón no hay forma de saber de qué zona es. */}
        <span className="obj-mon-g">{o.nombre}</span>
        {/* Uno por línea. Juntos con puntos se leían como una frase larga y no como lo que
            son: objetivos distintos, cada uno con su propio recorrido. */}
        {esp.map((e:string) => <span key={e} className="obj-mon-n">{e}</span>)}
        {/*
          EN CUÁNTAS CLASES SE TRABAJA. El aviso va en el CERO, no en los que sí se
          trabajan: con ocho objetivos, colorear los buenos obliga a buscar el que no
          tiene color entre siete que sí. Lo que hay que ver de un vistazo es el hueco.
        */}
        {!o.logrado && (() => {
          const c = clasesPorObjetivo[o.id]
          if (!c) return (
            <span className="obj-mon-clases cero" title={citasSinSesion > 0
              ? `Ninguna clase lo trabaja. Tiene ${citasSinSesion} clase${citasSinSesion===1?'':'s'} sin sesión asignada.`
              : 'Ninguna de sus clases trabaja este objetivo.'}>
              sin clases
            </span>
          )
          return (
            <span className="obj-mon-clases"
              title={`${c.total} clase${c.total===1?'':'s'} lo trabajan · ${c.porDelante} por delante`}>
              {c.total} {c.total===1?'clase':'clases'}
              {c.porDelante === 0 && <span className="cero"> · ya pasadas</span>}
            </span>
          )
        })()}
      </button>
    )
  }

  /**
   * De dónde sale el objetivo: agrupado POR TEST, y dentro cada ítem que lo abrió.
   *
   * Un objetivo puede venir de varios tests a la vez —el lunge y la sentadilla profunda
   * abren los dos "Movilidad de tobillo"— y en una tira plana de píldoras eso se leía como
   * una lista de cosas sueltas. Agrupado se ve de un vistazo cuántas puertas quedan
   * abiertas y por dónde.
   *
   * Lo RESUELTO se pliega, no se borra: dejó de estar activo pero explica el histórico, y
   * mezclarlo con lo vigente hace parecer que hay más pendiente del que hay.
   */
  const pintarOrigen = (o:any, vias:any[]) => {
    const grupos: Record<string, {titulo:string, items:{v:any, vi:number}[]}> = {}
    vias.forEach((v:any, vi:number) => {
      // La etiqueta es "Test: Lunge de tobillo · El talón se levanta": lo de antes del
      // primer punto medio es el test, lo de después el ítem.
      const et = String(v.etiqueta || v.tipo || '')
      const corte = et.indexOf(' · ')
      const titulo = corte > 0 ? et.slice(0, corte) : et
      const item = corte > 0 ? et.slice(corte + 3) : ''
      if (!grupos[titulo]) grupos[titulo] = { titulo, items: [] }
      grupos[titulo].items.push({ v: { ...v, _item: item }, vi })
    })

    const pastilla = (x:{v:any,vi:number}) => (
      <button key={x.vi} type="button" disabled={guardandoVia===o.id}
        onClick={()=>toggleVia(o,x.vi)}
        title={x.v.resuelto
          ? `Resuelto${x.v.fecha_resuelto?' el '+fmtLargo(x.v.fecha_resuelto):''} · pulsa para reabrir`
          : 'Pendiente · pulsa para darla por resuelta'}
        className={`pill pill-o pill-b ${x.v.resuelto?'on':''}`}
        style={{textDecoration:x.v.resuelto?'line-through':'none'}}>
        <Ic name={x.v.resuelto ? 'check' : 'buscar'} size={10} style={{verticalAlign:'-1px',marginRight:3}}/>
        {x.v._item || x.v.etiqueta || x.v.tipo}
      </button>
    )

    return (
      <div style={{marginTop:7,display:'grid',gap:5}}>
        {Object.values(grupos).map(g => {
          const activos = g.items.filter(x=>!x.v.resuelto)
          const cerrados = g.items.filter(x=>x.v.resuelto)
          return (
            <div key={g.titulo}>
              <div style={{fontSize:11,color:'var(--grl)',marginBottom:3}}>{g.titulo}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {activos.map(pastilla)}
                {activos.length===0 && cerrados.length>0 && (
                  <span style={{fontSize:12,color:'var(--gd)'}}>Nada pendiente aquí</span>
                )}
              </div>
              {cerrados.length>0 && (
                <details style={{marginTop:4}}>
                  <summary className="det-sum" style={{fontSize:11}}>
                    Ya resueltos · {cerrados.length}
                  </summary>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:4}}>{cerrados.map(pastilla)}</div>
                </details>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const pintarObjetivo = (o:any) => {
    const vias = Array.isArray(o.vias)?o.vias:[]
    const pendientes = vias.filter((v:any)=>!v.resuelto).length
    return (
      <div key={o.id} className="obj-t" style={{borderLeftColor:o.logrado?'var(--gm)':'var(--g)'}}>
        {/* NI MONEDA NI NOMBRES NI DESCRIPCIÓN. Los tres estaban justo encima, en la
            moneda que se acaba de pulsar para llegar aquí: repetirlos empujaba hacia abajo
            lo único que se viene a ver. Solo queda el contador, que sí
            dice algo que la rejilla no dice. */}
        {(o.logrado || vias.length>0) && (
          <div style={{display:'flex',justifyContent:'flex-end'}}>
            {o.logrado
              ? <span style={{fontSize:12,color:'var(--gd)',display:'inline-flex',alignItems:'center',gap:3}}><Ic name="check" size={12}/>Logrado</span>
              : <span style={{fontSize:12,color:'var(--gr)'}}>{pendientes} de {vias.length}</span>}
          </div>
        )}
        {o.logrado && o.fecha_logrado && <div style={{fontSize:12,color:'var(--gd)',marginTop:2}}>el {fmtDia(o.fecha_logrado)}</div>}
        {/* AQUÍ IBAN LAS METAS Y LOS LOGROS, y se han quitado a propósito.
            El objetivo YA ES lo que se mide: lo abre un test y ese mismo test lo cierra.
            Ponerle dentro otra capa de cosas que medir era medir dos veces la misma cosa,
            y obligaba a decidir por cada objetivo si se cerraba con números o con
            casillas — la misma trampa que las familias.
            Lo que sí hay que medir son las SESIONES, que es la estrategia para llegar.
            `MetasObjetivo.tsx`, `LogrosObjetivo.tsx` y todo `lib/metas.ts` siguen en el
            repositorio intactos: no se pintan, no se han borrado. */}
        {/* AQUÍ IBAN LAS FASES: la tira de progreso y el "para salir de la fase N".
            Fuera por lo mismo que las metas y los logros — el objetivo lo abre un test y lo
            cierra ese mismo test, sin capas intermedias. `lib/fases.ts` sigue entero. */}
        {vias.length===0 && !o.logrado && (
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6,flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:'var(--gr)'}}>Sin nada que marcar · no vino de un test ni de un ejercicio</span>
            <button className="btn btn-t btn-sm" disabled={guardandoVia===o.id} onClick={()=>cerrarSinVias(o)}>
              Dar por logrado
            </button>
          </div>
        )}
        {/* Las vías solo se pintan en los objetivos que se CIERRAN con ellas.
            son lo único que lo cierra. */}
        {/* LAS VÍAS SE PINTAN SIEMPRE. Se escondían en los medibles, pero seguían
            contando para cerrarlos: un objetivo podía quedarse abierto por una vía que no
            había forma de ver ni de resolver desde aquí. */}
        {vias.length>0 && pintarOrigen(o, vias)}

        {/* CON QUÉ SE TRABAJA. Justo debajo de de dónde sale: arriba el test y el ítem que
            lo abrió, aquí las sesiones que lo persiguen. Y cuando no hay ninguna se dice,
            porque un objetivo abierto sin sesión detrás es un aviso sin salida — la ficha
            dice qué hay que mejorar y no propone con qué. */}
        {!o.logrado && (() => {
          const suyas = (sesionesPac||[]).filter((s:any)=>
            (s.sesiones_objetivos||[]).some((r:any)=>r.objetivo_id===o.id))
          return (
            <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--bl)'}}>
              <div className="et-mini" style={{marginBottom:5}}>
                Se trabaja en{suyas.length>0?` ${suyas.length} sesi${suyas.length===1?'ón':'ones'}`:''}
              </div>
              {suyas.length===0 ? (
                <div style={{fontSize:12,color:'#8A6410'}}>
                  <Ic name="alerta" size={11}/> Ninguna sesión suya lo trabaja todavía. Se
                  añaden desde Entreno &rarr; Sesiones, con el botón «Objetivos».
                </div>
              ) : (
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {suyas.map((s:any)=>(
                    <span key={s.id} className="badge badge-g" style={{display:'inline-flex',alignItems:'center',gap:4}}>
                      <Ic name="fuerza" size={10}/> {s.nombre}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </div>
    )
  }

  const recPendientes = (recuperaciones||[]).filter((r:any)=>r.estado==='pendiente')
  const recVence = recPendientes.map((r:any)=>r.fecha_limite).filter(Boolean).sort()[0]
  const hayAtencion = (alertas?.length>0) || recPendientes.length>0 || estadoPago==='impago'
  const objPide = valoracion?.objetivos || []
  // El bloque se pinta SIEMPRE, aunque esté vacío. Antes se escondía si no había nada, y
  // desde que se pueden añadir a mano eso dejaba sin salida al paciente sin objetivos, que
  // es justo al que hay que ponérselos. Los estados vacíos ya dicen lo suyo.
  const hayObjetivos = true
  const anamLarga = (valoracion?.anamnesis||'').length > 260
  // La valoración cargada es siempre la más reciente: puede ser la inicial o una revaloración.
  const tipoVal = valoracion?.tipo==='revaloracion' ? 'Revaloración' : 'Valoración inicial'

  return (
    <div className="panel">
      {/* 1. LO QUE REQUIERE ATENCIÓN — no se pinta si el paciente está en orden */}
      {hayAtencion && (
        <div className="atencion">
          <div className="at-h"><Ic name="alerta" size={16}/> Requiere atención</div>
          {(alertas||[]).map((a:any)=>(
            <div key={a.id} className="at-i">
              <div style={{flex:1}}>
                {TIPOS_AL[a.tipo]||a.tipo}
                {a.afecta_sesion && <span style={{color:'var(--red)',fontSize:12,marginLeft:6}}>· afecta sesión</span>}
                {a.descripcion && <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>{a.descripcion}</div>}
              </div>
              <button onClick={()=>cerrarAlerta(a.id)} style={{fontSize:11,color:'var(--gd)',background:'none',border:'1px solid var(--g)',borderRadius:6,padding:'2px 9px',cursor:'pointer',flexShrink:0}}>Cerrar</button>
            </div>
          ))}
          {recPendientes.length>0 && (
            <div className="at-i">
              {recPendientes.length===1 ? '1 clase sin recuperar' : `${recPendientes.length} clases sin recuperar`}
              {recVence && <span style={{color:'var(--gr)',fontSize:12,marginLeft:6}}>· la primera vence el {fmtDia(recVence)}</span>}
            </div>
          )}
          {estadoPago==='impago' && (
            <div className="at-i">Cuota de {mes}/{anio} marcada como impago</div>
          )}
        </div>
      )}

      {/* 2. NOTAS FIJAS — contexto que hay que saber antes de la sesión */}
      {editando ? (
        <div className="card">
          <div className="field" style={{marginBottom:0}}>
            <label><span className="ct-l"><Ic name="pin" size={11}/> Notas</span> <span className="subt">· información del paciente</span></label>
            <textarea className="input" value={form.notas_fijas||''} onChange={e=>setForm((p:any)=>({...p,notas_fijas:e.target.value}))} style={{minHeight:60}} placeholder="ej. Viene en silla de ruedas · Prefiere entrenar de pie"/>
          </div>
        </div>
      ) : pac.notas_fijas ? (
        <div className="nota-fija">
          <span style={{display:'inline-flex',color:'var(--g)',flexShrink:0,marginTop:1}}><Ic name="pin" size={14}/></span>
          {pac.notas_fijas}
        </div>
      ) : null}

      {/* 3. OBJETIVOS — el bloque principal, a ancho completo */}
      {hayObjetivos && (
        <div className="sec">
          <div className="sec-h">
            <span className="ct-l"><Ic name="objetivo" size={13}/> Objetivos</span>
          </div>
          <div className="g2">
            <div>
              <div className="sec-sub">
                Lo que pide
                {valoracion?.fecha && <> · {tipoVal.toLowerCase()} del {fmtLargo(valoracion.fecha)}, {haceCuanto(valoracion.fecha)}</>}
              </div>
              {objPide.length===0 && !valoracion?.deseo && <div className="muted">Sin objetivos recogidos</div>}
              {objPide.map((o:string,i:number)=>(
                <div key={i} style={{fontSize:13,color:'var(--n)',lineHeight:1.9,display:'flex',gap:8}}>
                  <span style={{color:'var(--gr)',flexShrink:0}}>{i+1}.</span>{o}
                </div>
              ))}
              {valoracion?.deseo && (
                <div style={{marginTop:9,padding:'8px 10px',background:'var(--ambl)',fontSize:12,color:'#7A5800',display:'flex',gap:6,alignItems:'flex-start'}}>
                  <span style={{display:'inline-flex',flexShrink:0,marginTop:1}}><Ic name="estrella" size={12}/></span>{valoracion.deseo}
                </div>
              )}
            </div>
            <div>
              <div className="sec-sub" style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{flex:1}}>Lo que prescribimos · de tests y ejercicios</span>
                {/* Hasta ahora solo llegaban solos, cuando un test daba positivo. Los que se
                    deciden mirando una medición casi nunca vienen de ahí. */}
                <button className="btn btn-t btn-sm" onClick={()=>{setSelObj([]);setBuscarObj('');setZonaObj('');setModalAnadir(true)}}>
                  <Ic name="mas" size={12}/> Añadir
                </button>
              </div>
              {objetivosTrabajo.length===0 && <div className="muted">Sin objetivos de trabajo</div>}
              {objetivosActivos.length===0 && objetivosLogrados.length>0 && <div className="muted">Todos los objetivos logrados</div>}
              {objetivosActivos.length>0 && (
                <div className="obj-rej">{objetivosActivos.map(pintarMoneda)}</div>
              )}
              {/* El detalle va DEBAJO de la rejilla, no dentro de la moneda: así ocupa el
                  ancho entero y no descoloca la cuadrícula al abrirse. */}
              {objetivosActivos.filter((o:any)=>o.id===objAbierto).map(pintarObjetivo)}

              {objetivosLogrados.length>0 && (
                <details style={{marginTop:objetivosActivos.length>0?9:0}}>
                  <summary className="det-sum">
                    <Ic name="trofeo" size={12} style={{verticalAlign:'-2px',marginRight:5}}/>
                    Logrados · {objetivosLogrados.length}
                  </summary>
                  <div style={{marginTop:6}}>
                    <div className="obj-rej">{objetivosLogrados.map(pintarMoneda)}</div>
                    {objetivosLogrados.filter((o:any)=>o.id===objAbierto).map(pintarObjetivo)}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AÑADIR OBJETIVO · hasta ahora solo llegaban solos, desde un test o desde el taller */}
      {modalAnadir && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalAnadir(false)}}>
          {/* Es un explorador de la biblioteca entera con filtros: en 420 px las fichas
              salían de una en una y no se podía comparar nada. */}
          <div className="modal" style={{ width: 'min(860px, 94vw)' }}>
            <div className="modal-title">
              Añadir objetivo
              <button className="modal-close" onClick={()=>setModalAnadir(false)}><Ic name="cerrar" size={15}/></button>
            </div>
            <input className="input" autoFocus value={buscarObj} placeholder="Buscar en la biblioteca…"
              onChange={e=>setBuscarObj(e.target.value)} style={{marginBottom:8}}/>

            {/* Los filtros a la vista, no escondidos tras el buscador: con 36 fichas lo
                normal es no saber cómo se llama la que buscas pero sí de qué zona es.
                Solo la zona: las familias ya no existen. */}
            {(() => {
              const zonas = Array.from(new Set(catalogo.map((o:any)=>o.articulacion_id).filter(Boolean)))
                .map((id:any)=>({ id, nombre: etiquetasLib.find((e:any)=>e.id===id)?.nombre || '' }))
                .filter((z:any)=>z.nombre)
                .sort((a:any,b:any)=>ordenAnatomico(a.nombre,b.nombre))
              if (zonas.length===0) return null
              return (
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:10}}>
                  <button className={`chip-sel ${!zonaObj?'on':''}`} onClick={()=>setZonaObj('')}>Todas</button>
                  {zonas.map((z:any)=>(
                    <button key={z.id} className={`chip-sel ${zonaObj===z.id?'on':''}`}
                      onClick={()=>setZonaObj(zonaObj===z.id?'':z.id)}>{z.nombre}</button>
                  ))}
                </div>
              )
            })()}

            <div style={{maxHeight:'46vh',overflowY:'auto',display:'grid',gap:3}}>
              {(() => {
                const q = buscarObj.trim().toLowerCase()
                const yaTiene = new Set(objetivosTrabajo.map((o:any)=>o.id))
                const lista = catalogo.filter((o:any)=>
                  (!q || o.nombre.toLowerCase().includes(q) || (o.descripcion||'').toLowerCase().includes(q)) &&
                  (!zonaObj || o.articulacion_id===zonaObj))
                  // Los de sus patologías arriba: es lo que se busca al abrir esto tras
                  // registrarle una lesión.
                  .sort((a:any,b:any)=>(porPatologia[b.id]?1:0)-(porPatologia[a.id]?1:0))
                if (lista.length===0) return <div className="muted">Ninguno coincide.</div>
                /**
                 * Tarjetas con su moneda, no una lista de renglones.
                 *
                 * Es el mismo catálogo que la biblioteca y en la ficha se veía distinto, así
                 * que costaba reconocer el objetivo que acabas de mirar en Entrenamiento.
                 */
                return (
                  <div className="obj-rej" style={{gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))'}}>
                    {lista.map((o:any)=>{
                      const tiene = yaTiene.has(o.id)
                      const sel = selObj.includes(o.id)
                      return (
                        <button key={o.id} type="button"
                          onClick={()=>{
                            if (!tiene) { setSelObj(s=>sel?s.filter(x=>x!==o.id):[...s,o.id]); return }
                            // Ya asignado: se va a su panel a ponerle otra meta. Ahora vale
                            // para cualquier objetivo, no solo para los que eran "medibles".
                            setModalAnadir(false); setSelObj([]); setBuscarObj('')
                            setObjAbierto(o.id); setPedirMetaEn(o.id)
                          }}
                          className={`obj-mon-b${sel?' on':''}`}
                          title={tiene
                            ? 'Ya lo tiene. Pulsa para añadirle otra meta.'
                            : (o.descripcion||o.nombre)}
                          style={{cursor:'pointer', opacity:tiene?.8:1}}>
                          {monedaDe(o, true)}
                          <span className="obj-mon-g">{o.nombre}</span>
                          <span className="obj-mon-n">
                            {porPatologia[o.id] && <span style={{display:'block',color:'var(--gd)'}}>{porPatologia[o.id]}</span>}
                          </span>
                          {/* Ya asignado: no es un error, es que sus metas se ponen en la ficha. */}
                          {tiene && (
                            <span style={{fontSize:10,color:'var(--gd)'}}>+ otra meta</span>
                          )}
                          {sel && <span style={{fontSize:10,color:'var(--gd)'}}><Ic name="check" size={11}/> Elegido</span>}
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            <div style={{display:'flex',gap:7,alignItems:'center',marginTop:10}}>
              <span style={{flex:1,fontSize:12,color:'var(--gr)',lineHeight:1.5}}>
                {selObj.length===0
                  ? 'Los medibles se abren sin metas: las pones después.'
                  : `${selObj.length} seleccionado${selObj.length>1?'s':''}`}
              </span>
              <button className="btn btn-t btn-sm" onClick={()=>setModalAnadir(false)}>Cancelar</button>
              <button className="btn btn-p" disabled={selObj.length===0||guardandoVia==='anadir'}
                onClick={()=>anadirObjetivos(catalogo.filter((o:any)=>selObj.includes(o.id)))}>
                {guardandoVia==='anadir' ? 'Añadiendo…' : `Añadir${selObj.length>0?' '+selObj.length:''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. BONO Y TIPO DE CLASE — cada cosa en su columna */}
      <div className="g2">
        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="finanzas" size={13}/> Bono y cuota</span></div>
          {bono ? (
            <>
              <div style={{fontSize:14,color:'var(--n)'}}>{bonoLabel[bono.tipo]||bono.tipo}</div>
              <div style={{fontSize:12,color:'var(--gr)',marginTop:2}}>
                Mes {mes}/{anio}
                {bono.descuento_tipo && bono.descuento_valor > 0 && (
                  <> · descuento {bono.descuento_tipo==='porcentaje'?`${bono.descuento_valor}%`:`${bono.descuento_valor}€`}{bono.descuento_motivo?` (${bono.descuento_motivo})`:''}</>
                )}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10,flexWrap:'wrap'}}>
                <button className={`chip-ed ${estadoPago==='impago'?'chip-ed-r':estadoPago==='pendiente'?'chip-ed-a':''}`} title="Cobrar o cambiar el estado"
                  onClick={e=>{const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setMenuPago({ x:r.left, y:r.bottom+4 })}}>
                  {LBL_PAGO[estadoPago]||'—'} <Ic name="abajo" size={12}/>
                </button>
                <button className="btn btn-s btn-sm" onClick={()=>setModalBono(true)}>Cambiar bono</button>
              </div>

            </>
          ) : (
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <span className="muted">{bonosSesiones.length > 0 ? 'Sin cuota mensual' : 'Sin bono activo'}</span>
              <button className="btn btn-s btn-sm" onClick={()=>setModalBono(true)}>+ Asignar bono</button>
            </div>
          )}

          {/* BONOS POR SESIONES. FUERA DEL `if` DE LA CUOTA.
              Estaban dentro, y por eso quien tenía sesiones compradas pero NINGUNA cuota
              mensual —alguien que solo viene a individuales, o que empieza el mes que
              viene— no las veía por ningún lado: la ficha entraba por la rama de "sin
              bono activo" y ese bloque no llegaba a pintarse. El bono estaba guardado y
              la vista lo devolvía; simplemente no había nada que lo dibujara.

              Son cosas independientes: la cuota es lo que se factura cada mes y las
              sesiones son una compra suelta. Que una dependa de la otra para verse era
              atarlas sin motivo.

              Las restantes no salen de ningún contador: se cuentan desde sus citas cada
              vez que se abre la ficha. Cambiar una cita de "vino" a "canceló" devuelve la
              sesión sola. */}
          {bonosSesiones.length > 0 && (
            <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:12}}>
              {bonosSesiones.map((bs:any)=>(
                <SesionesBono key={bs.bono_id} bono={bs} nombre={bonoLabel?.[bs.tipo] || bs.tipo} onRenovar={onRenovarSesiones} onRetirar={onRetirarSesiones}/>
              ))}
            </div>
          )}
        </div>

        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="etiqueta" size={13}/> Tipo de clase</span></div>
          <button className="chip-ed" title="Cambiar el tipo de clase"
            onClick={e=>{const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setMenuTipo({ x:r.left, y:r.bottom+4 })}}>
            <Ic name={iconTipoClase(pac.tipo_clase, tiposClase.find((t:any)=>t.valor===pac.tipo_clase)?.icono)} size={12}/>
            {pac.tipo_clase ? nombreTipoClase(tiposClase, pac.tipo_clase) : 'Sin asignar'}
            <Ic name="abajo" size={12}/>
          </button>
          <div style={{fontSize:12,color:'var(--gr)',marginTop:8,lineHeight:1.5}}>
            Se usa como tipo por defecto al darle cita nueva desde la agenda.
          </div>
        </div>
      </div>

      {/* 5. ANAMNESIS */}
      {valoracion?.anamnesis && (
        <div className="sec">
          <div className="sec-h">
            <span className="ct-l"><Ic name="anamnesis" size={13}/> Anamnesis</span>
            {valoracion.fecha && <span className="sh-r">{tipoVal} del {fmtLargo(valoracion.fecha)} · {haceCuanto(valoracion.fecha)}</span>}
          </div>
          <div style={{fontSize:13,color:'var(--n)',lineHeight:1.7,whiteSpace:'pre-line'}}>
            {anamLarga && !anamnesisAbierta ? valoracion.anamnesis.slice(0,260).trimEnd()+'…' : valoracion.anamnesis}
          </div>
          {anamLarga && (
            <button onClick={()=>setAnamnesisAbierta(v=>!v)} style={{fontSize:12,color:'var(--gd)',background:'none',border:'none',padding:'6px 0 0',cursor:'pointer',fontFamily:'inherit'}}>
              {anamnesisAbierta?'Ver menos':'Ver más'}
            </button>
          )}
          <div style={{fontSize:12,color:'var(--gr)',marginTop:9,display:'flex',gap:18,flexWrap:'wrap'}}>
            {valoracion.trabajo && <span className="ct-l"><Ic name="trabajo" size={12}/> {valoracion.trabajo}{valoracion.tipo_jornada?' · '+valoracion.tipo_jornada:''}</span>}
            {valoracion.hace_deporte && valoracion.deportes?.length>0 && <span className="ct-l"><Ic name="deporte" size={12}/> {valoracion.deportes.join(', ')}</span>}
          </div>
        </div>
      )}

      {/* 6. NOTAS DEL PLAN */}
      {valoracion?.notas_plan && (
        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="nota" size={13}/> Notas del plan</span></div>
          <div style={{fontSize:13,color:'var(--n)',lineHeight:1.7,whiteSpace:'pre-line'}}>{valoracion.notas_plan}</div>
        </div>
      )}

      {/* 7. PREFERENCIAS DE HORARIO */}
      {valoracion && (valoracion.dias_asistencia||valoracion.franja) && (
        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="reloj" size={13}/> Preferencias de horario</span></div>
          {valoracion.dias_asistencia && (
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:7}}>
              {valoracion.dias_asistencia.split(',').filter(Boolean).map((d:string)=><span key={d} className="pill pill-g">{d}</span>)}
            </div>
          )}
          {valoracion.franja && <div style={{fontSize:12,color:'var(--gr)'}}>Franja: {valoracion.franja==='manana'?'Mañanas':valoracion.franja==='tarde'?'Tardes':valoracion.franja==='noche'?'Noches':'Flexible'}</div>}
        </div>
      )}

      <Consentimientos pacienteId={pac.id} nombre={`${pac.nombre} ${pac.apellidos}`.trim()} dni={pac.dni}/>

      {/* MENÚ TIPO DE CLASE */}
      {menuTipo && (
        <>
          <div style={{position:'fixed',inset:0,zIndex:59}} onClick={()=>setMenuTipo(null)}/>
          <div className="menu-flot" style={{left:menuTipo.x,top:menuTipo.y}}>
            {tiposClase.map((t:any)=>(
              <button key={t.valor} className="menu-it" onClick={()=>{setMenuTipo(null);cambiarTipoClase?.(t.valor)}}>
                <Ic name={iconTipoClase(t.valor,t.icono)} size={14}/>{t.nombre}
                {pac.tipo_clase===t.valor && <span style={{marginLeft:'auto',color:'var(--g)',display:'inline-flex'}}><Ic name="check" size={13}/></span>}
              </button>
            ))}
          </div>
        </>
      )}

      {/* MENÚ ESTADO DE PAGO */}
      {menuPago && (
        <>
          <div style={{position:'fixed',inset:0,zIndex:59}} onClick={()=>setMenuPago(null)}/>
          <div className="menu-flot" style={{left:menuPago.x,top:menuPago.y}}>
            {/* "Pagado" no se escribe aquí: cobrar es emitir una factura y eso
                pasa por un solo sitio. Este menú abre el mismo modal de cobro
                que el pilar Cobros y la lista de pacientes. */}
            <button className="menu-it" onClick={()=>{setMenuPago(null); onCobrar?.()}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:DOT_PAGO['pagado'],flexShrink:0}}/>
              Cobrar y facturar…
            </button>
            {['pendiente','impago'].map(v=>(
              <button key={v} className="menu-it" onClick={()=>{setMenuPago(null);cambiarPago(v)}}>
                <span style={{width:7,height:7,borderRadius:'50%',background:DOT_PAGO[v],flexShrink:0}}/>
                {LBL_PAGO[v]}
                {bono?.estado_pago===v && <span style={{marginLeft:'auto',color:'var(--g)',display:'inline-flex'}}><Ic name="check" size={13}/></span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
