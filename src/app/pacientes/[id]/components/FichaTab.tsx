'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import SesionesBono from '@/components/SesionesBono'
import { iconTipoClase, nombreTipoClase } from '@/lib/tipos'
import Consentimientos from './Consentimientos'
import { guardarVias, retratoDe } from '@/lib/objetivos'
import { VIAS, viasDe, marcarVia, quitarVia, type ViaOrigen } from '@/lib/viasObjetivo'
import { conteoPorObjetivo } from '@/lib/objetivosTests'
import { sistemasDePaciente } from '@/lib/sistemas'
import { soloVigentes } from '@/lib/linaje'
import ModalObjetivo from '@/app/entrenamiento/components/ModalObjetivo'
import ModalEditarSesion from '@/app/entrenamiento/components/ModalEditarSesion'
import { ordenAnatomico } from '@/lib/anatomia'
import { hoyISO } from '@/lib/fechas'
import SelectorObjetivos from '@/app/entrenamiento/components/SelectorObjetivos'

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

/**
 * EL MES DE LA CUOTA SALE DE LA CUOTA.
 *
 * `mes` y `anio` que llegan por props son el mes de HOY, y se usaban para
 * rotular el bono: a quien tenia ya la cuota de octubre, la ficha le ponia
 * "Mes 9/2026". El dato estaba bien guardado; mentia la etiqueta.
 */
const mesDeBono = (b: any) => b?.mes && b?.anio ? `${b.mes}/${b.anio}` : '—'
const empiezaDespues = (b: any) => {
  if (!b?.mes || !b?.anio) return false
  const h = new Date()
  return b.anio > h.getFullYear() || (b.anio === h.getFullYear() && b.mes > h.getMonth() + 1)
}
const nombreMes = (b: any) =>
  new Date(b.anio, b.mes - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

export default function FichaTab({ pac, bono, recuperaciones, editando, form, setForm, setModalBono, bonoLabel, mes, anio, alertas, cerrarAlerta, cambiarPago, tiposClase = [], cambiarTipoClase, estadoPago = 'pendiente', onCobrar, bonosSesiones = [], onRenovarSesiones, onRetirarSesiones, abrirTest, irA }: any) {
  const router = useRouter()
  const [valoracion, setValoracion] = useState<any>(null)
  const [objetivosTrabajo, setObjetivosTrabajo] = useState<any[]>([])
  const [viaAnadir, setViaAnadir] = useState<ViaOrigen>('plan')
  const [filtroVia, setFiltroVia] = useState<string>('')
  /**
   * Los objetivos que cubre su CICLO, aunque todavía no estén enganchados a ninguna
   * cita. Estar en la programación es las dos cosas: que una clase suya lo trabaje,
   * o que lo persiga el sistema que lleva puesto.
   */
  const [objsDeSistema, setObjsDeSistema] = useState<string[]>([])
  const [verSesion, setVerSesion] = useState<any>(null)
  /**
   * Lo que hay EN LA BIBLIOTECA para un objetivo: sesiones molde y ciclos que lo
   * trabajan. Cuando el paciente no tiene nada suyo, decir "no hay nada" era falso:
   * casi siempre está hecho y solo falta traérselo.
   */
  const [biblioObj, setBiblioObj] = useState<{sesiones:any[], sistemas:any[]}|null>(null)
  const [ejerciciosLib, setEjerciciosLib] = useState<any[]>([])
  // El objetivo cuya ficha de biblioteca se esta editando desde aqui, para ponerle
  // con que se mide sin salir del paciente.
  const [editandoObjetivo, setEditandoObjetivo] = useState<any>(null)

  /**
   * Ver la sesión de una cita sin salir de la ficha.
   *
   * Se abre el mismo editor de siempre —dos pantallas para mirar una sesión acabarían
   * enseñando cosas distintas—, y sus ejercicios se piden solo cuando hace falta: son
   * cientos y no se usan al abrir la ficha.
   */
  /** Se pide una sola vez, y solo cuando se abre un panel: no hace falta para la ficha. */
  async function cargarBiblioObj() {
    if (biblioObj != null) return
    const [ses, sis] = await Promise.all([
      // Enteras: para traérsela hay que copiarla, no solo nombrarla.
      supabase.from('sesiones').select('*, sesiones_objetivos(objetivo_id)')
        .is('paciente_id', null).order('nombre'),
      supabase.from('sistemas')
        .select('id,nombre,sistema_fases(sistema_fase_sesiones(sesiones(sesiones_objetivos(objetivo_id))))')
        .is('paciente_id', null).order('nombre'),
    ])
    setBiblioObj({
      sesiones: (ses.data||[]).map((x:any)=>({
        ...x, objetivos:(x.sesiones_objetivos||[]).map((r:any)=>r.objetivo_id),
      })),
      sistemas: (sis.data||[]).map((x:any)=>{
        const ids:string[] = []
        ;(x.sistema_fases||[]).forEach((f:any)=>(f.sistema_fase_sesiones||[]).forEach((y:any)=>{
          const se = Array.isArray(y.sesiones) ? y.sesiones[0] : y.sesiones
          ;(se?.sesiones_objetivos||[]).forEach((r:any)=>{ if (ids.includes(r.objetivo_id)===false) ids.push(r.objetivo_id) })
        }))
        return { id:x.id, nombre:x.nombre, objetivos:ids }
      }),
    })
  }

  async function verLaSesion(sesionId: string) {
    const ses = (sesionesPac||[]).find((x:any)=>x.id===sesionId)
    if (ses == null) return
    if (ejerciciosLib.length === 0) {
      const { data } = await supabase.from('ejercicios').select('*').order('nombre')
      setEjerciciosLib(data||[])
    }
    setVerSesion(ses)
  }

  /**
   * Sin NADA con lo que comprobarlo. No se puede cerrar nunca.
   *
   * Son dos relaciones y valen las dos: los tests que lo EVALÚAN —`objetivos_tests`,
   * lo que se engancha desde la biblioteca— y los que ya lo ABRIERON, porque ese
   * mismo test es el que lo cierra al volver a pasarlo. Mirando solo la primera, un
   * objetivo abierto por el ítem de un test salía como que no había forma de medirlo
   * teniendo su test delante.
   */
  const sinMedida = (o:any) => {
    if (o.logrado) return false
    const e = evalua[o.id]
    if (((e?.tests || 0) + (e?.cuestionarios || 0)) > 0) return false
    return (Array.isArray(o.vias) ? o.vias : [])
      .some((v:any)=>v?.tipo === 'test' || v?.tipo === 'test_item') === false
  }
  // La frase de la valoracion que se esta convirtiendo en objetivo, si viene de ahi.
  const [pideTexto, setPideTexto] = useState<string|null>(null)
  // Con que se comprueba cada objetivo. Sin nada, no se puede cerrar nunca.
  const [evalua, setEvalua] = useState<Record<string, any>>({})
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
  /** Texto en curso mientras se edita la anamnesis. `null` = no se está editando. */
  const [anamEdit, setAnamEdit] = useState<string|null>(null)
  const [guardandoAnam, setGuardandoAnam] = useState(false)
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
  // Que especificos de cada objetivo se le trabajan a ESTE paciente. "Movilidad de
  // rodilla" en la biblioteca tiene flexion, extension y rotacion; a este le tocas
  // la flexion, y cada uno se resuelve por su cuenta.
  const [espSel, setEspSel] = useState<Record<string, string[]>>({})
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
  async function anadirObjetivos(lista:any[], movs:Record<string,string[]> = espSel, via: ViaOrigen = 'plan', texto: string|null = null) {
    if (lista.length===0) return
    setGuardandoVia('anadir')
    const { error } = await supabase.from('pacientes_objetivos').insert(
      lista.map((o:any)=>{
        // Una via por especifico elegido. No es una via de relleno: cada una es una
        // parte de verdad que hay que resolver, y el objetivo no esta logrado hasta
        // que lo esten todas. Sin especificos elegidos nace sin vias, como hasta ahora.
        const ids = movs[o.id] || []
        const vias = ids.map((mid:string)=>({
          tipo: 'movimiento', ref: mid, mov: mid,
          etiqueta: etiquetasLib.find((e:any)=>e.id===mid)?.nombre || '',
          resuelto: false,
        }))
        // Y con el retrato del objetivo congelado: ver `retratoDe`.
        // Puesto a mano desde la ficha: lo ponemos nosotros. Si ademas lo pide el
        // paciente se marca en su moneda, que las vias se acumulan.
        return { paciente_id: pac.id, objetivo_id: o.id, origen: 'manual', vias,
          vias_origen: [via], pide_texto: texto, ...retratoDe(o) }
      }))
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
    setModalAnadir(false); setBuscarObj(''); setSelObj([]); setEspSel({}); cargarObjetivos()
  }

  /**
   * COMPLETAR LA ANAMNESIS DESPUÉS DE LA VALORACIÓN.
   *
   * Se escribía en la valoración y ahí se quedaba: si el paciente te contó su caso por
   * teléfono, o lo tenías apuntado fuera, no había forma de meterlo. Y si la valoración se
   * hizo con la anamnesis vacía, el bloque ni siquiera aparecía, así que tampoco había por
   * dónde entrar.
   *
   * Se guarda sobre la valoración más reciente, que es la que la ficha enseña, y se deja
   * un evento en el historial. Es historia clínica: que se pueda completar está bien, que
   * se pueda cambiar sin que quede rastro, no.
   */
  async function guardarAnamnesis() {
    if (anamEdit == null || !valoracion?.id) return
    setGuardandoAnam(true)
    const { error } = await supabase.from('valoraciones')
      .update({ anamnesis: anamEdit }).eq('id', valoracion.id)
    if (error) { setGuardandoAnam(false); alert('No se ha podido guardar:\n\n' + error.message); return }
    await supabase.from('eventos_paciente').insert({
      paciente_id: pac.id, tipo: 'valoracion',
      titulo: (valoracion.anamnesis || '').trim() ? 'Anamnesis completada' : 'Anamnesis añadida',
      descripcion: `Sobre la ${tipoVal.toLowerCase()} del ${valoracion.fecha}.`,
      fecha: hoyISO(),
    })
    setValoracion((v:any)=>({ ...v, anamnesis: anamEdit }))
    setAnamEdit(null); setGuardandoAnam(false)
  }

  function cargarObjetivos() {
    if (!pac?.id) return
    // El nombre, la descripcion y los especificos salen de la COPIA del paciente, no de la
    // biblioteca: ver `retratoDe`. De la biblioteca solo se trae lo que no cambia el pasado
    // —la zona y la foto— y si esta archivado, que es lo unico que hay que decir de ella.
    supabase.from('pacientes_objetivos')
      .select('objetivo_id, origen, vias_origen, pide_texto, vias, logrado, fecha_logrado, nombre, descripcion, movimientos, objetivos(id,nombre,descripcion,movimientos,articulacion_id,imagen_url,archivado_el)')
      .eq('paciente_id', pac.id).then(({data}) => {
      setObjetivosTrabajo((data||[]).map((r:any)=>({
        ...r.objetivos,
        nombre: r.nombre || r.objetivos?.nombre,
        descripcion: r.descripcion ?? r.objetivos?.descripcion,
        movimientos: Array.isArray(r.movimientos) ? r.movimientos : (r.objetivos?.movimientos || []),
        archivado: r.objetivos?.archivado_el != null,
        origen:r.origen, vias:r.vias||[], logrado:r.logrado, fecha_logrado:r.fecha_logrado,
        vias_origen:r.vias_origen||[], pide_texto:r.pide_texto||null,
      })).filter((o:any)=>o.id))
    })
    supabase.from('resultados_tests').select('test_id,lado,fecha,items_resultado').eq('paciente_id', pac.id)
      .then(({data}) => setResultadosTests(data||[]))
    // `tipo_lado` hace falta para saber si un test va por lados o entero: es lo que decide
    // qué columnas ofrece el formulario de meta.
    supabase.from('tests').select('*').order('nombre').then(({data}) => setTestsLib(data||[]))
    // Enteras: el modal del objetivo necesita la categoria para la zona y la patologia.
    supabase.from('etiquetas').select('*').then(({data}) => setEtiquetasLib(data||[]))
    // `imagen_url`: el catálogo se pinta con monedas en el modal de añadir, igual que la ficha.
    supabase.from('sesiones').select('*, sesiones_objetivos(objetivo_id)').eq('paciente_id', pac.id)
      .then(({data}) => setSesionesPac(data||[]))
    // Todas sus citas que cuentan como clase, pasadas y futuras. Las canceladas no: una
    // clase que no se dio ni se va a dar no trabaja nada.
    supabase.from('citas').select('id,fecha,hora,sala,estado,sesion_id').eq('paciente_id', pac.id)
      .in('estado', ['programada','realizada']).order('fecha')
      .then(({data}) => setCitasPac(data||[]))
    supabase.from('objetivos').select('id,nombre,descripcion,movimientos,articulacion_id,etiquetas,imagen_url')
      .eq('activo', true).is('archivado_el', null).order('nombre').then(({data}) => setCatalogo(data||[]))
    supabase.from('patologias').select('nombre,estado').eq('paciente_id', pac.id)
      .then(({data}) => setPatologiasPac(data||[]))
    conteoPorObjetivo().then(setEvalua)
    sistemasDePaciente(pac.id).then((asigs:any[])=>{
      const ids: string[] = []
      asigs.forEach((a:any)=>(a.sistema?.fases||[]).forEach((f:any)=>
        (f.objetivos||[]).forEach((oid:string)=>{ if (ids.includes(oid)===false) ids.push(oid) })))
      setObjsDeSistema(ids)
    })
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
  /**
   * LA MONEDA DICE DOS COSAS A LA VEZ.
   *
   *   - EL COLOR es la via por la que entro: morado lo que pide, verde lo que dice un
   *     test, ambar lo que ponemos nosotros. Con varias manda la primera, y las demas
   *     se leen en las chapas de debajo.
   *   - LLENA O VACIA es si esta en la planificacion. Hueca —fondo blanco— significa
   *     que ninguna de sus clases lo trabaja: esta escrito pero no se esta haciendo, y
   *     eso es lo que hay que ver de un vistazo al abrir la ficha.
   */
  const monedaDe = (o:any, grande=false) => {
    const v = VIAS.find(x => viasDe(o).includes(x.valor)) || VIAS[2]
    // Está en la programación si alguna clase POR DELANTE lo trabaja —lo que ya pasó
    // no es plan— o si lo persigue el ciclo que lleva puesto.
    const enPlan = (clasesPorObjetivo[o.id]?.porDelante || 0) > 0 || objsDeSistema.includes(o.id)

    /* PROGRAMADO = ESFERA DE VERDAD.
       Un disco plano de color no se distinguía de la moneda de siempre. Con el
       degradado radial, el brillo arriba a la izquierda y la sombra propia abajo,
       la esfera se lee como un volumen y el aro vacío se lee como un hueco: la
       diferencia se ve desde el otro lado de la fila, que es de lo que se trata. */
    const esfera = {
      background: `radial-gradient(circle at 33% 28%, #fff 0%, ${v.claro} 20%, ${v.color} 58%, ${v.oscuro} 100%)`,
      // Sin borde: una esfera no tiene contorno, tiene volumen. El degradado y la
      // sombra ya la separan del fondo.
      borderWidth: 0,
      boxShadow: `inset -3px -5px 9px ${v.oscuro}55, 0 3px 7px rgba(38,40,37,.28)`,
    }
    const hueco = {
      background: 'var(--w)',
      borderColor: v.color,
      borderWidth: grande ? 1.5 : 1,
      boxShadow: 'none',
    }
    return (
      <span className={`obj-moneda${grande?' g':''}`} style={{
        ...(enPlan ? esfera : hueco),
        ...(o.imagen_url ? { background: 'var(--bl)' } : {}),
        opacity: o.logrado ? .55 : 1,
      }}>
        {o.imagen_url
          ? <img src={o.imagen_url} alt=""/>
          : <b style={{ color: enPlan ? '#fff' : v.color,
              textShadow: enPlan ? `0 1px 2px ${v.oscuro}` : 'none' }}>
              {(o.nombre||'?').trim().charAt(0).toUpperCase()}
            </b>}
      </span>
    )
  }

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
        onClick={()=>{ setObjAbierto(abierto ? null : o.id); if (abierto === false) cargarBiblioObj() }}>
        {/* LA CHAPA DE "NO SE PUEDE MEDIR" va encima de la moneda, que es lo que se
            mira. Al pulsarla se abre la ficha del objetivo con su apartado de con qué
            se comprueba, y desde ahí se le engancha un test —o se crea el que falte—
            sin salir del paciente. */}
        <span style={{position:'relative',display:'inline-flex'}}>
          {monedaDe(o, true)}
          {sinMedida(o) && (
            <span role="button" tabIndex={-1}
              title="Sin forma de medirlo: engánchale un test"
              onClick={(e:any)=>{ e.stopPropagation(); setEditandoObjetivo(catalogo.find((x:any)=>x.id===o.id) || o) }}
              style={{position:'absolute',right:-3,bottom:-1,width:22,height:22,borderRadius:'50%',
                background:'var(--amb)',color:'#fff',border:'2px solid var(--w)',cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',
                boxShadow:'0 1px 4px rgba(38,40,37,.25)'}}>
              <Ic name="alerta" size={11}/>
            </span>
          )}
        </span>
        {/* El general se escribe SIEMPRE. Mientras los objetivos no tengan foto la moneda
            es una letra, así que sin este renglón no hay forma de saber de qué zona es. */}
        <span className="obj-mon-g">{o.nombre}</span>
        {/* Uno por línea. Juntos con puntos se leían como una frase larga y no como lo que
            son: objetivos distintos, cada uno con su propio recorrido. */}
        {esp.map((e:string) => <span key={e} className="obj-mon-n">{e}</span>)}
        {/* DE DONDE SALE, en la propia moneda: en una fila compartida hay que poder
            leerlo sin abrir nada. Ver `viasObjetivo`. */}
        {viasDe(o).length > 0 && (
          <span style={{display:'flex',gap:3,flexWrap:'wrap',justifyContent:'center',marginTop:1}}>
            {viasDe(o).map((v:any)=>{
              const d = VIAS.find(x=>x.valor===v)!
              return (
                <span key={v} style={{fontSize:9,padding:'1px 6px',borderRadius:99,
                  background:d.fondo,color:d.color,border:`1px solid ${d.color}`,opacity:o.logrado?.55:1}}>
                  {d.corto}
                </span>
              )
            })}
          </span>
        )}
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

    /**
     * CADA VÍA, UNA FICHA CON LA FOTO DEL TEST.
     *
     * Eran píldoras de texto y con tres o cuatro no se distinguía una de otra: un test
     * se reconoce por la foto de la posición antes que por su nombre, igual que en la
     * biblioteca y en la evaluación. Debajo, el ítem concreto que falta.
     */
    const pastilla = (x:{v:any,vi:number}) => {
      /* SI VIENE DE UN TEST, SE PASA EL TEST.
         Pulsarla la daba por resuelta al instante y el objetivo desaparecía de la
         lista: un clic de más y no había forma de ver qué acababas de cerrar. Lo que
         cierra un objetivo medido es volver a medirlo, así que esto abre el test en
         el lado que abrió la vía. Las que no vienen de un test —ejecución, manual—
         sí se marcan a mano, porque no hay nada que volver a pasar. */
      const testId = (x.v.tipo === 'test' || x.v.tipo === 'test_item') && typeof x.v.ref === 'string'
        ? String(x.v.ref).split(':')[0].split('|')[0] : ''
      const puedeAbrir = testId !== '' && typeof abrirTest === 'function'
      const t = (testsLib||[]).find((y:any)=>y.id===testId)
      const hecho = !!x.v.resuelto
      return (
        <button key={x.vi} type="button" disabled={guardandoVia===o.id}
          onClick={()=>{ if (puedeAbrir) abrirTest(testId, x.v.lado || 'bilateral'); else toggleVia(o,x.vi) }}
          title={puedeAbrir
            ? (hecho
                ? `Resuelto${x.v.fecha_resuelto?' el '+fmtLargo(x.v.fecha_resuelto):''} · pulsa para volver a pasar el test`
                : 'Pendiente · pulsa para pasar el test')
            : (hecho
                ? `Resuelto${x.v.fecha_resuelto?' el '+fmtLargo(x.v.fecha_resuelto):''} · pulsa para reabrir`
                : 'Pendiente · pulsa para darla por resuelta')}
          style={{display:'flex',gap:8,alignItems:'center',textAlign:'left',cursor:'pointer',
            fontFamily:'inherit',padding:'5px 11px 5px 5px',borderRadius:9,
            background: hecho ? 'var(--gl)' : 'var(--w)',
            border:`1px solid ${hecho ? 'var(--gm)' : 'var(--bd)'}`,
            opacity: hecho ? .7 : 1}}>
          {t?.imagen_url
            ? <img src={t.imagen_url} alt="" style={{width:46,height:38,objectFit:'cover',borderRadius:6,
                background:'var(--bm)',flexShrink:0,display:'block'}}/>
            : <span style={{width:46,height:38,borderRadius:6,background:'var(--bm)',color:'var(--grl)',
                flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Ic name={x.v.tipo==='ejecucion'?'fuerza':'test'} size={16}/>
              </span>}
          <span style={{minWidth:0}}>
            <span style={{display:'block',fontSize:12,color:'var(--n)',lineHeight:1.3,
              textDecoration: hecho ? 'line-through' : 'none'}}>
              {t?.nombre || String(x.v.etiqueta || x.v.tipo || '').split(' · ')[0]}
            </span>
            {/* El ítem concreto que falta: es lo único que se mira de ese test. */}
            {x.v._item && (
              <span style={{display:'block',fontSize:11,color: hecho ? 'var(--grl)' : 'var(--gd)',lineHeight:1.3}}>
                {x.v._item}
              </span>
            )}
            {x.v.lado && x.v.lado !== 'bilateral' && (
              <span style={{display:'block',fontSize:10,color:'var(--grl)',lineHeight:1.3}}>{x.v.lado}</span>
            )}
          </span>
        </button>
      )
    }

    return (
      <div style={{marginTop:7,display:'grid',gap:5}}>
        {Object.values(grupos).map(g => {
          const activos = g.items.filter(x=>!x.v.resuelto)
          const cerrados = g.items.filter(x=>x.v.resuelto)
          return (
            <div key={g.titulo}>
              <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
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
                  <div style={{display:'flex',flexWrap:'wrap',gap:7,marginTop:4}}>{cerrados.map(pastilla)}</div>
                </details>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  /**
   * TODO LO DEL OBJETIVO, EN UN PANEL.
   *
   * Estaba desplegado debajo de la rejilla y empujaba la ficha entera hacia abajo: al
   * abrir uno se perdía de vista la fila desde la que se había pulsado. Y lo que hay
   * que saber de un objetivo —con qué se mide, de dónde salió, qué sesiones lo
   * trabajan y en qué clases se trabajó— no cabe en una tira.
   */
  const pintarObjetivo = (o:any) => {
    const vias = Array.isArray(o.vias)?o.vias:[]
    const pendientes = vias.filter((v:any)=>!v.resuelto).length
    const suyas = viasDe(o)
    return (
      <div key={o.id} className="modal-bg" onClick={e=>{ if (e.target===e.currentTarget) setObjAbierto(null) }}>
      <div className="modal" style={{width:'min(720px, 94vw)', maxHeight:'88vh', overflowY:'auto'}}>
        <div className="modal-title" style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{flexShrink:0}}>{monedaDe(o)}</span>
          <span style={{flex:1,minWidth:0}}>
            {o.nombre}
            {especificosDe(o).length>0 && (
              <div style={{fontSize:12,color:'var(--gr)',fontWeight:400,marginTop:2}}>
                {especificosDe(o).join(' · ')}
              </div>
            )}
          </span>
          <button className="modal-close" onClick={()=>setObjAbierto(null)}><Ic name="cerrar" size={15}/></button>
        </div>
        {/* DE DONDE SALE. Tres vias y puede tener varias: que el paciente lo pida y
            que ademas un test lo mida corto es mas fuerte que cualquiera de las dos
            por separado, asi que se acumulan en vez de pisarse. Ver `viasObjetivo`. */}
        <div className="et-mini" style={{marginBottom:4}}>¿De dónde sale?</div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center',marginBottom:6}}>
          {VIAS.map(v=>{
            const on = suyas.includes(v.valor)
            // La del test no se pone a mano: la pone el test al dar positivo.
            const fijo = v.valor === 'test'
            if (fijo && !on) return null
            return (
              <button key={v.valor} type="button" title={fijo ? v.ayuda : (on ? 'Quitar · ' + v.ayuda : 'Marcar · ' + v.ayuda)}
                disabled={fijo}
                onClick={async ()=>{
                  const r:any = on
                    ? await quitarVia(pac.id, o.id, v.valor)
                    : await marcarVia(pac.id, o.id, v.valor)
                  if (r.ok === false) { alert(r.error); return }
                  cargarObjetivos()
                }}
                style={{fontSize:10,padding:'2px 9px',borderRadius:99,cursor:fijo?'default':'pointer',
                  fontFamily:'inherit',
                  background:on?v.fondo:'transparent', color:on?v.color:'var(--grl)',
                  border:`1px solid ${on?v.color:'var(--bd)'}`}}>
                {v.nombre}
              </button>
            )
          })}
          {o.pide_texto && (
            <span style={{fontSize:10.5,color:'var(--gr)',fontStyle:'italic'}}>«{o.pide_texto}»</span>
          )}
        </div>
        {/* SIN FORMA DE MEDIRLO no se cierra nunca, ni entra en ninguna evaluacion.
            Se dice aqui, con el paciente delante, y no solo en la biblioteca. */}
        {(() => {
          // La MISMA regla que la chapa de la moneda: cuenta lo enganchado desde la
          // biblioteca y también el test que ya lo abrió, porque ese lo cierra.
          if (sinMedida(o) === false) return null
          return (
            <div style={{fontSize:11,color:'#7A5800',background:'var(--ambl)',border:'1px solid var(--amb)',
              borderRadius:6,padding:'6px 9px',marginBottom:7,lineHeight:1.5}}>
              <Ic name="alerta" size={11}/> Sin forma de medirlo: no entra en ninguna
              evaluación y no puede cerrar una fase.
              <button className="btn btn-s btn-sm" style={{marginLeft:8}}
                onClick={()=>setEditandoObjetivo(catalogo.find((x:any)=>x.id===o.id) || o)}>
                Engancharle un test
              </button>
            </div>
          )
        })()}
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
        {/* ARCHIVADO EN LA BIBLIOTECA. Lo suyo se queda tal cual —por eso se archiva en
            vez de borrarse—, pero hay que poder explicar por que no aparece al buscarlo
            para ponerselo a otro. */}
        {o.archivado && (
          <div style={{fontSize:12,color:'var(--gr)',marginTop:4,display:'flex',alignItems:'center',gap:5}}>
            <Ic name="caja" size={11}/> Archivado en la biblioteca · lo suyo se mantiene
          </div>
        )}
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

        {/* SUS CLASES, CON LA SESIÓN ENGANCHADA.
            Estaban en dos listas —las sesiones por un lado, las fechas por otro— y
            había que cruzarlas de cabeza. Lo que se quiere saber es cuándo se trabaja
            esto y con qué, así que va junto: la cita y su sesión en la misma línea. Lo
            ya dado, tachado. Al pulsar se abre la sesión. */}
        {(() => {
          const suyas = soloVigentes(sesionesPac||[]).filter((x:any)=>
            (x.sesiones_objetivos||[]).some((r:any)=>r.objetivo_id===o.id))
          const idsSes = (sesionesPac||[])
            .filter((x:any)=>(x.sesiones_objetivos||[]).some((r:any)=>r.objetivo_id===o.id))
            .map((x:any)=>x.id)
          const hoy = hoyISO()
          const citas = (citasPac||[])
            .filter((c:any)=>c.sesion_id && idsSes.includes(c.sesion_id))
            .sort((a:any,b:any)=>String(a.fecha).localeCompare(String(b.fecha)))
          const nombreSes = (id:string) => (sesionesPac||[]).find((x:any)=>x.id===id)?.nombre || 'Sesión'

          return (
            <div style={{marginTop:10,paddingTop:9,borderTop:'1px solid var(--bl)'}}>
              <div className="et-mini" style={{marginBottom:5}}>
                {citas.length===0 ? 'Clases' : `${citas.length} clase${citas.length===1?'':'s'} lo trabajan`}
              </div>

              {suyas.length===0 ? (() => {
                /* NADA SUYO, PERO EN LA BIBLIOTECA SÍ HAY.
                   No se traen desde aquí: se va a la biblioteca con este objetivo ya
                   filtrado y se eligen viéndolas como se ven allí, con su foto y sus
                   ejercicios. Traerlas a ciegas desde un panel era decidir sin mirar. */
                const sesB = (biblioObj?.sesiones||[]).filter((x:any)=>x.objetivos.includes(o.id))
                const sisB = (biblioObj?.sistemas||[]).filter((x:any)=>x.objetivos.includes(o.id))
                const n = sesB.length + sisB.length
                return (
                  <div style={{display:'flex',alignItems:'center',gap:9,flexWrap:'wrap',
                    background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:7,
                    padding:'8px 11px',fontSize:12,color:'#7A5800'}}>
                    <span style={{flex:1,minWidth:200}}>
                      Ninguna sesión suya lo trabaja todavía.
                      {n>0 && ' En la biblioteca hay:'}
                    </span>
                    {sesB.length>0 && (
                      <button className="btn btn-s btn-sm" style={{whiteSpace:'nowrap'}}
                        onClick={()=>router.push(`/entrenamiento?tab=sesiones&objetivo=${o.id}`)}>
                        {sesB.length} {sesB.length===1?'sesión':'sesiones'}
                      </button>
                    )}
                    {sisB.length>0 && (
                      <button className="btn btn-s btn-sm" style={{whiteSpace:'nowrap'}}
                        onClick={()=>router.push(`/entrenamiento?tab=sistemas&objetivo=${o.id}`)}>
                        {sisB.length} {sisB.length===1?'ciclo':'ciclos'}
                      </button>
                    )}
                    {n===0 && (
                      <button className="btn btn-s btn-sm" style={{whiteSpace:'nowrap'}}
                        onClick={()=>router.push(`/entrenamiento?tab=sesiones&objetivo=${o.id}`)}>
                        Ir a la biblioteca
                      </button>
                    )}
                  </div>
                )
              })() : citas.length===0 ? (
                /* HAY SESIONES PERO NINGUNA CITA LAS LLEVA.
                   Decirlo en una frase dejaba el trabajo a medias: lo que hace falta es
                   ver cuáles son y poder ponerlas. Es el caso más común mientras se monta
                   el plan, así que se trata como un estado, no como un error. */
                <>
                  <div style={{display:'flex',alignItems:'center',gap:9,flexWrap:'wrap',
                    background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:7,
                    padding:'8px 11px',fontSize:12,color:'#7A5800',marginBottom:9}}>
                    <span style={{flex:1,minWidth:220}}>
                      {(() => {
                        const n = new Set(suyas.map((x:any)=>x.nombre)).size
                        return n===1 ? 'Lo trabaja 1 sesión suya' : `Lo trabajan ${n} sesiones suyas`
                      })()}, pero ninguna está puesta en una cita.
                    </span>
                    <button className="btn btn-s btn-sm" style={{whiteSpace:'nowrap'}}
                      onClick={()=>{ setObjAbierto(null); irA?.('entreno') }}>
                      Ponerlas en sus citas
                    </button>
                  </div>
                  {/* Por NOMBRE: seis copias suyas de la misma sesión son una línea, no
                      seis idénticas que no dicen nada nueva. */}
                  <div style={{display:'grid',gap:4}}>
                    {Array.from(new Set(suyas.map((x:any)=>x.nombre))).map((nom:any)=>{
                      const cuantas = suyas.filter((x:any)=>x.nombre===nom)
                      return (
                        <button key={nom} type="button" title="Ver la sesión"
                          onClick={()=>verLaSesion(cuantas[0].id)}
                          style={{display:'flex',alignItems:'center',gap:8,width:'100%',textAlign:'left',
                            fontFamily:'inherit',cursor:'pointer',padding:'7px 11px',borderRadius:7,
                            border:'1px solid var(--bd)',background:'var(--w)'}}>
                          <span style={{color:'var(--gd)',flexShrink:0,display:'inline-flex'}}><Ic name="valoracion" size={12}/></span>
                          <span style={{flex:1,minWidth:0,fontSize:12.5}}>
                            {nom}
                            {cuantas.length>1 && <span style={{color:'var(--grl)'}}> · {cuantas.length} copias</span>}
                          </span>
                          <span style={{fontSize:10.5,color:'var(--grl)',flexShrink:0}}>sin citas</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div style={{display:'grid',gap:3}}>
                  {/* La cita arriba y su sesión debajo, como en la planificación: es la
                      misma información y leerla de dos formas distintas cuesta. */}
                  {citas.map((c:any)=>{
                    const dada = c.fecha < hoy
                    const tachado: any = dada ? { textDecoration:'line-through' } : {}
                    return (
                      <button key={c.id} type="button"
                        title={dada ? 'Ya dada · pulsa para ver la sesión' : 'Por delante · pulsa para ver la sesión'}
                        onClick={()=>verLaSesion(c.sesion_id)}
                        style={{display:'block',width:'100%',textAlign:'left',fontFamily:'inherit',
                          cursor:'pointer',padding:'6px 10px',borderRadius:7,
                          borderLeft:`3px solid ${dada?'var(--bd)':'var(--g)'}`,
                          borderTop:'1px solid var(--bd)',borderRight:'1px solid var(--bd)',
                          borderBottom:'1px solid var(--bd)',
                          background:dada?'var(--bl)':'var(--w)'}}>
                        <span style={{display:'block',fontSize:13,color:dada?'var(--grl)':'var(--n)',...tachado}}>
                          {new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})}
                          {c.hora ? ` · ${String(c.hora).slice(0,5)}` : ''}
                          {c.sala ? ` · Sala ${c.sala}` : ''}
                        </span>
                        <span style={{display:'flex',alignItems:'center',gap:4,marginTop:1,
                          fontSize:12,color:dada?'var(--grl)':'var(--gd)',...tachado}}>
                          <Ic name="valoracion" size={12}/> {nombreSes(c.sesion_id)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}
      </div>
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
            <div className="at-i">Cuota de {mesDeBono(bono)} marcada como impago</div>
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

      {/* 3. OBJETIVOS — el bloque principal, a ancho completo.

          UNA SOLA FILA, y no dos columnas.

          Estaban partidos en "lo que pide" y "lo que prescribimos", y eso los trataba
          como dos cosas. No lo son: es la misma lista, lo único distinto es POR QUÉ VÍA
          entró cada uno —lo pide él, lo dice un test, lo ponemos nosotros—, y un mismo
          objetivo puede tener varias. Partirlos obligaba a mirar dos sitios para saber
          adónde va este paciente, y no dejaba ver que lo que pide y lo que necesita a
          veces es exactamente lo mismo.

          Dentro van ordenados por vía, que es el orden en que se explican. */}
      {hayObjetivos && (() => {
        const ordenVia = (o:any) => {
          const vs = viasDe(o)
          const i = VIAS.findIndex(v => vs.includes(v.valor))
          return i < 0 ? VIAS.length : i
        }
        const porVia = (lista:any[]) => [...lista].sort((a:any,b:any)=>
          ordenVia(a)-ordenVia(b) || String(a.nombre||'').localeCompare(String(b.nombre||'')))

        const visibles = porVia(filtroVia
          ? objetivosActivos.filter((o:any)=>viasDe(o).includes(filtroVia as ViaOrigen))
          : objetivosActivos)
        // Lo que escribió en la valoración y todavía no es un objetivo de verdad.
        const pendientesPide = (filtroVia === '' || filtroVia === 'pide')
          ? objPide.filter((t:string)=>objetivosTrabajo.some((x:any)=>x.pide_texto===t) === false)
          : []

        return (
        <div className="sec">
          <div className="sec-h">
            <span className="ct-l"><Ic name="objetivo" size={13}/> Objetivos</span>
            <span className="sh-r" style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
              {VIAS.map(v=>{
                const n = objetivosActivos.filter((o:any)=>viasDe(o).includes(v.valor)).length
                  + (v.valor==='pide' ? objPide.filter((t:string)=>objetivosTrabajo.some((x:any)=>x.pide_texto===t)===false).length : 0)
                return (
                  <button key={v.valor} type="button" title={v.ayuda}
                    onClick={()=>setFiltroVia(f=>f===v.valor?'':v.valor)}
                    style={{fontSize:10,padding:'2px 9px',borderRadius:99,cursor:'pointer',fontFamily:'inherit',
                      opacity:n===0?.45:1,
                      background:filtroVia===v.valor?v.fondo:'transparent',
                      color:filtroVia===v.valor?v.color:'var(--gr)',
                      border:`1px solid ${filtroVia===v.valor?v.color:'var(--bd)'}`}}>
                    {v.nombre} · {n}
                  </button>
                )
              })}
              <button className="btn btn-t btn-sm"
                onClick={()=>{setSelObj([]);setBuscarObj('');setZonaObj('');setPideTexto(null);setViaAnadir('plan');setModalAnadir(true)}}>
                <Ic name="mas" size={12}/> Añadir
              </button>
            </span>
          </div>

          {valoracion?.fecha && (
            <div className="sec-sub" style={{marginBottom:6}}>
              Lo que pide sale de la {tipoVal.toLowerCase()} del {fmtLargo(valoracion.fecha)}, {haceCuanto(valoracion.fecha)}
            </div>
          )}

          {objetivosTrabajo.length===0 && pendientesPide.length===0 && (
            <div className="muted">Sin objetivos todavía</div>
          )}
          {objetivosTrabajo.length>0 && visibles.length===0 && pendientesPide.length===0 && (
            <div className="muted">
              {objetivosActivos.length===0 ? 'Todos los objetivos logrados' : 'Ninguno por esa vía'}
            </div>
          )}

          {(visibles.length>0 || pendientesPide.length>0) && (
            <div className="obj-rej">
              {visibles.map(pintarMoneda)}
              {/* Los deseos que aún no son objetivo, en la misma fila y al final: son lo
                  que queda por convertir, no una categoría aparte. */}
              {pendientesPide.map((t:string,i:number)=>(
                <div key={'p'+i} className="obj-mon-b" title={t + ' · hazlo objetivo para poder medirlo'}
                  onClick={()=>{ setPideTexto(t); setViaAnadir('pide'); setSelObj([]); setBuscarObj(''); setModalAnadir(true) }}>
                  <span className="obj-moneda g pide"><b>{(t||'?').trim().charAt(0).toUpperCase()}</b></span>
                  <span className="obj-mon-g">{t}</span>
                  <span style={{fontSize:10,color:'#7B4E86'}}>+ hacerlo objetivo</span>
                </div>
              ))}
            </div>
          )}


          {objetivosLogrados.length>0 && (
            <details style={{marginTop:9}}>
              <summary className="det-sum">
                <Ic name="trofeo" size={12} style={{verticalAlign:'-2px',marginRight:5}}/>
                Logrados · {objetivosLogrados.length}
              </summary>
              <div style={{marginTop:6}}>
                <div className="obj-rej">{porVia(objetivosLogrados).map(pintarMoneda)}</div>
              </div>
            </details>
          )}

          {valoracion?.deseo && (
            <div style={{marginTop:9,padding:'8px 10px',background:'var(--ambl)',fontSize:12,color:'#7A5800',display:'flex',gap:6,alignItems:'flex-start'}}>
              <span style={{display:'inline-flex',flexShrink:0,marginTop:1}}><Ic name="estrella" size={12}/></span>{valoracion.deseo}
            </div>
          )}
        </div>
        )
      })()}

      {/* EL PANEL DEL OBJETIVO. Encima y no debajo de la rejilla: abriendo uno se
          perdía de vista la fila desde la que se había pulsado. */}
      {objetivosTrabajo.filter((o:any)=>o.id===objAbierto).map(pintarObjetivo)}

      {verSesion && (
        <ModalEditarSesion sesion={verSesion} ejercicios={ejerciciosLib} etiquetas={etiquetasLib}
          onCerrar={()=>setVerSesion(null)} onGuardado={()=>{ setVerSesion(null); cargarObjetivos() }}/>
      )}

      {/* LA FICHA DEL OBJETIVO, desde el paciente. Es el mismo modal de la biblioteca:
          dos formularios para lo mismo acabarían diciendo cosas distintas. */}
      {editandoObjetivo && (
        <ModalObjetivo objetivo={editandoObjetivo} tests={testsLib} etiquetas={etiquetasLib}
          onCerrar={()=>setEditandoObjetivo(null)}
          onGuardado={()=>{ conteoPorObjetivo().then(setEvalua); cargarObjetivos() }}/>
      )}

      {/* AÑADIR OBJETIVO · hasta ahora solo llegaban solos, desde un test o desde el taller */}
      {modalAnadir && (
        <SelectorObjetivos
          objetivos={catalogo}
          etiquetas={etiquetasLib}
          titulo={pideTexto ? `«${pideTexto}» · elige el objetivo` : 'Añadir objetivos'}
          puestos={objetivosTrabajo.map((o:any)=>o.id)}
          marcaDe={(o:any)=>porPatologia[o.id] || null}
          onExistente={(o:any)=>{
            setModalAnadir(false); setSelObj([]); setBuscarObj('')
            setObjAbierto(o.id); setPedirMetaEn(o.id)
          }}
          onCerrar={()=>{ setModalAnadir(false); setSelObj([]); setEspSel({}); setPideTexto(null) }}
          onElegir={(ids:string[], movs:Record<string,string[]>)=>{
            setEspSel(movs)
            anadirObjetivos(catalogo.filter((o:any)=>ids.includes(o.id)), movs, viaAnadir, pideTexto)
          }}
          /* DE DONDE SALE lo que estas anadiendo. Se pregunta aqui y no despues
             porque en este momento lo sabes: o te lo ha pedido el, o lo pones tu. */
          extra={
            <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
              <span className="et-mini">De dónde sale</span>
              {/* Si viene de una frase suya, la via no se elige: la pide el. */}
              {pideTexto ? <span className="pill pill-o on">Lo pide</span>
                : VIAS.filter(v=>v.valor!=='test').map(v=>(
                <button key={v.valor} type="button" title={v.ayuda}
                  className={`pill ${viaAnadir===v.valor?'pill-o on':'pill-soft'}`}
                  style={{border:'none',cursor:'pointer'}}
                  onClick={()=>setViaAnadir(v.valor)}>{v.nombre}</button>
              ))}
            </div>
          }/>
      )}

      {/* 4. BONO Y TIPO DE CLASE — cada cosa en su columna */}
      <div className="g2">
        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="finanzas" size={13}/> Bono y cuota</span></div>
          {bono ? (
            <>
              <div style={{fontSize:14,color:'var(--n)'}}>{bonoLabel[bono.tipo]||bono.tipo}</div>
              <div style={{fontSize:12,color:'var(--gr)',marginTop:2}}>
                Mes {mesDeBono(bono)}
                {/* Que no esta pagado se entiende distinto si el mes no ha llegado. */}
                {empiezaDespues(bono) && (
                  <span style={{color:'var(--gd)'}}> · empieza en {nombreMes(bono)}</span>
                )}
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

      {/* 5. ANAMNESIS · se pinta aunque esté vacía, para poder añadirla */}
      {valoracion?.id && (
        <div className="sec">
          <div className="sec-h">
            <span className="sh-l">
              <span className="ct-l"><Ic name="anamnesis" size={13}/> Anamnesis</span>
              {anamEdit == null && (
                <button className="btn btn-t btn-sm" onClick={()=>setAnamEdit(valoracion.anamnesis||'')}>
                  <Ic name="editar" size={11}/> {valoracion.anamnesis ? 'Completar' : 'Añadir'}
                </button>
              )}
            </span>
            {valoracion.fecha && <span className="sh-r">{tipoVal} del {fmtLargo(valoracion.fecha)} · {haceCuanto(valoracion.fecha)}</span>}
          </div>

          {anamEdit != null ? (
            <>
              <textarea className="input" style={{minHeight:170,fontSize:13,lineHeight:1.7}}
                value={anamEdit} onChange={e=>setAnamEdit(e.target.value)} autoFocus
                placeholder="Lo que te contó: motivo de consulta, historia, expectativas..."/>
              <div style={{display:'flex',gap:8,marginTop:8,alignItems:'center'}}>
                <span style={{flex:1,fontSize:12,color:'var(--gr)'}}>
                  Se guarda sobre la {tipoVal.toLowerCase()} del {valoracion.fecha} y queda anotado en su historial.
                </span>
                <button className="btn btn-t btn-sm" onClick={()=>setAnamEdit(null)} disabled={guardandoAnam}>Cancelar</button>
                <button className="btn btn-p btn-sm" onClick={guardarAnamnesis} disabled={guardandoAnam}>
                  {guardandoAnam?'Guardando…':'Guardar'}
                </button>
              </div>
            </>
          ) : !valoracion.anamnesis ? (
            <div className="muted">Sin anamnesis recogida.</div>
          ) : (
          <div style={{fontSize:13,color:'var(--n)',lineHeight:1.7,whiteSpace:'pre-line'}}>
            {anamLarga && !anamnesisAbierta ? valoracion.anamnesis.slice(0,260).trimEnd()+'…' : valoracion.anamnesis}
          </div>
          )}
          {anamEdit == null && anamLarga && (
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
