'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/paginar'
import { nombreCorto } from '@/lib/ejercicios'
import { Ic } from '@/lib/icons'
import ImagenEjercicio from './ImagenEjercicio'
import MonedaObjetivo from './MonedaObjetivo'
import VeloFiltros, { PastillasFiltro } from './VeloFiltros'
import { CATEGORIAS_ETIQUETA, conDescendientes, categoriaDe, nivelDe, agrupaPorRaiz } from '@/lib/etiquetas'
import { TIPOS_MEDIDA, problemasDeEjercicio, nombreMedida } from '@/lib/ejercicios'
import { contiene, normalizar } from '@/lib/texto'
import { rareza, trozosCapacidad } from '@/lib/cromo'
import { anatomiaDe } from './TrabajoEjercicio'

// Explorador del catálogo de ejercicios: buscador, filtro por etiquetas y rejilla de
// tarjetas con foto. Es LA MISMA vista que el Pilar Entrenamiento → Biblioteca; lo que
// cambia es qué pasa al pulsar una tarjeta. Igual que hicimos con DetalleSesion: una
// vista, distintas acciones.
//
//   Biblioteca  -> `onAbrir`, para ver y editar el ejercicio.
//   Sesión      -> `seleccion` + `onAlternar`, para marcar varios y añadirlos de golpe.
//
// Lo usan los dos: la Biblioteca y el editor de sesión. Antes eran dos copias de la
// misma rejilla y ya habían empezado a divergir en qué campos buscaban.

/** Cómo se lee cada hueco en la pastilla de la tarjeta, cuando solo falta uno. */
const FALTA: Record<string, string> = {
  etiquetas: 'etiquetar',
  imagen: 'la foto',
  descripcion: 'la descripción',
  ejecucion: 'la ejecución',
}

// Al crear rápido desde aquí, solo las cuatro de siempre; el resto se afina en Amasar.
const RAPIDAS = ['peso_reps', 'reps', 'tiempo', 'banda_reps']

export default function ExploradorEjercicios({
  ejercicios, etiquetas = [], seleccion, onAlternar, onAbrir, sugeridos, acciones, onCrear, botonCrear = true, objetivosDe, soloSugeridos = false, objetivos = [], idsObjetivosDe, paneles = false, soloSimilares = false, resumenFijo, intensidades, antesDelBuscador,
}: {
  /** Algo en la misma línea, antes del buscador de ejercicios (el de clientes en la Biblioteca). */
  antesDelBuscador?: React.ReactNode
  /** Intensidad de cada ejercicio, ya calculada de sus series (lente Intensidad). */
  intensidades?: Record<string, { nombre: string, n: number, color: string }[]> | null
  /**
   * Uso ya calculado (el de un cliente en la Biblioteca). Si se pasa, los paneles Uso y
   * Objetivos enseñan esto en vez de los datos de toda la clínica.
   */
  resumenFijo?: Record<string, any> | null
  /**
   * Solo los similares, sin pestaña «Cualquiera» y buscando solo entre ellos (nivel 2 en el
   * taller): cambiar o añadir por cualquiera parecía rehacer la sesión.
   */
  soloSimilares?: boolean
  /**
   * Biblioteca: lo de debajo de la foto en tres paneles, uno para todas las tarjetas
   * (botones encima de la rejilla): qué trabaja, objetivos que suele trabajar y uso.
   */
  paneles?: boolean
  /**
   * Montando la sesión de un paciente: qué objetivos de la sesión trabaja cada ejercicio
   * (nombres). La tarjeta lo dice y se puede ver solo lo que sirve para ellos.
   */
  objetivosDe?: (e: any) => string[]
  /** Solo los sugeridos, salvo que se busque o filtre (cambiar un ejercicio por uno igual). */
  soloSugeridos?: boolean
  /** Los objetivos de la sesión, en esferas arriba: tocar una deja los que la trabajan. */
  objetivos?: any[]
  /** Ids de los objetivos de la sesión que trabaja cada ejercicio. */
  idsObjetivosDe?: (e: any) => string[]
  ejercicios: any[]
  etiquetas?: any[]
  /** Ids marcados. Si se pasa, las tarjetas se comportan como casillas. */
  seleccion?: string[]
  onAlternar?: (ej: any) => void
  onAbrir?: (ej: any) => void
  /** Bloque destacado antes del catálogo, p. ej. "Parecidos a Sentadilla". */
  sugeridos?: { titulo: string, items: any[] }
  /** Botones de la barra superior, a la derecha del contador. */
  acciones?: React.ReactNode
  /**
   * Crear un ejercicio que no está en el catálogo, con lo mínimo. Si no se pasa, la
   * tira de crear no aparece: hay pantallas donde esto no tiene sentido.
   */
  onCrear?: (nombre: string, tipoMedida: string) => Promise<void> | void
  /** false donde ya hay un alta completa propia, como la Biblioteca. */
  botonCrear?: boolean
}) {
  /* LA LENTE (Biblioteca). Un solo botón que va pasando de modo, en vez de una fila de
     botones: cada toque cambia SOLO lo de debajo de la foto, igual en todas las tarjetas,
     para comparar de un vistazo. Se recuerda en este aparato. Los datos salen de la vista
     `ejercicio_resumen` (sql/ejercicio-resumen.sql), o del cliente elegido. */
  type Panel = 'normal' | 'cromo' | 'capacidad' | 'uso' | 'objetivos'
  const LENTES: { k: Panel, t: string, ic: string }[] = [
    { k: 'normal', t: 'Normal', ic: 'biblioteca' }, { k: 'cromo', t: 'Cromo', ic: 'estrella' },
    { k: 'capacidad', t: 'Intensidad', ic: 'porcentaje' }, { k: 'uso', t: 'Uso', ic: 'stats' }, { k: 'objetivos', t: 'Objetivos', ic: 'objetivo' },
  ]
  const [panel, setPanelE] = useState<Panel>('normal')
  useEffect(() => { if (!paneles) return; try { const v = localStorage.getItem('bib_lente') as Panel; if (LENTES.some(l => l.k === v)) setPanelE(v) } catch {} }, [paneles]) // eslint-disable-line react-hooks/exhaustive-deps
  const setPanel = (v: Panel) => { setPanelE(v); try { localStorage.setItem('bib_lente', v) } catch {} }
  const lente = LENTES.find(l => l.k === panel) || LENTES[0]
  const siguienteLente = () => setPanel(LENTES[(LENTES.indexOf(lente) + 1) % LENTES.length].k)
  const [resumenClinica, setResumen] = useState<Record<string, any> | null>(null)
  const resumen = resumenFijo || resumenClinica
  const [faltaVista, setFaltaVista] = useState(false)
  // Al elegir un cliente se pasa a Uso: es lo que se quiere ver de él (cuánto lo ha hecho).
  useEffect(() => { if (paneles && resumenFijo) setPanelE('uso') }, [paneles, !!resumenFijo]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // El de la clínica hace falta también con un cliente elegido: el color del cromo es de la clínica.
    if (!paneles || panel === 'normal' || resumenClinica) return
    traerTodo((d, h) => supabase.from('ejercicio_resumen').select('*').range(d, h)).then(({ filas, error }) => {
      if (error) { setFaltaVista(true); return }
      setResumen(Object.fromEntries(filas.map((f: any) => [f.ejercicio_id, f])))
    })
  }, [paneles, panel, resumenClinica])
  const fechaCorta = (f?: string) => f ? new Date(String(f).length === 10 ? f + 'T12:00:00' : f).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' }) : ''

  const [buscar, setBuscar] = useState('')
  const [filtroEt, setFiltroEt] = useState<string[]>([])
  /**
   * LOS FILTROS POR ETIQUETA, PLEGADOS. Desplegados ocupaban media pantalla encima de
   * la rejilla y, montando sesiones, se busca por nombre casi siempre: eran mucha
   * informacion que solo estorbaba. Siguen a un clic, y el boton dice cuantos hay puestos.
   */
  const [verFiltros, setVerFiltros] = useState(false)
  /** Categorías con las subetiquetas a la vista. Se recuerda por categoría, no global. */
  const [desplegadas, setDesplegadas] = useState<string[]>([])
  /** Ver solo los que tienen huecos. Ver `problemasDeEjercicio` en lib/ejercicios. */
  const [soloPendientes, setSoloPendientes] = useState(false)
  /** Solo los que trabajan algún objetivo de la sesión (si se pasa `objetivosDe`). */
  const [soloObjetivos, setSoloObjetivos] = useState(false)
  /**
   * Objetivos de la sesión marcados: solo los ejercicios que los trabajan TODOS a la vez.
   * Antes era uno solo; con dos se ven los ejercicios que sirven para los dos, que son
   * los que más rinden en una sesión.
   */
  const [objFiltro, setObjFiltro] = useState<string[]>([])
  const cumple = (e: any, ids: string[]) => ids.every(id => (objsPorEj[e.id] || []).includes(id))
  /* Qué objetivos trabaja cada ejercicio, calculado UNA vez por catálogo y objetivos:
     el cruce es caro y la rejilla se repinta a cada letra del buscador. */
  const claveObjs = objetivos.map((o: any) => o.id).join(',')
  const objsPorEj = useMemo(() => {
    const m: Record<string, string[]> = {}
    if (idsObjetivosDe) ejercicios.forEach(e => { m[e.id] = idsObjetivosDe(e) })
    return m
  }, [ejercicios, claveObjs, !!idsObjetivosDe]) // eslint-disable-line react-hooks/exhaustive-deps
  /* LOS NOMBRES SALEN DEL MAPA, no de recalcular. Cada tarjeta y el filtro llamaban al
     cruce otra vez en cada repintado: con objetivos en la sesión, elegir iba a tirones. */
  const nombresObjs = (e: any): string[] => idsObjetivosDe
    ? (objsPorEj[e.id] || []).map(id => (objetivos.find((o: any) => o.id === id) as any)?.nombre).filter(Boolean)
    : objetivosDe ? objetivosDe(e) : []
  /** El bloque de «no se llaman así pero lo trabajan», plegado salvo que se pida. */
  const [verOtros, setVerOtros] = useState(false)
  /** Cambiando un ejercicio: ver solo los similares o toda la biblioteca. */
  const [verTodo, setVerTodo] = useState(false)
  const soloSug = soloSugeridos && (soloSimilares || !verTodo) && !!sugeridos && sugeridos.items.length > 0
  const idsSimilares = soloSimilares ? new Set((sugeridos?.items || []).map((e: any) => e.id)) : null
  const [creando, setCreando] = useState(false)
  /**
   * FAMILIAS. Una variante es un ejercicio completo con `portada_id` apuntando a su
   * portada. Sin buscar ni filtrar se ven solo las portadas (y los sueltos), con "N
   * variantes": así no salen 25 curls seguidos. Tocar esa marca despliega la familia.
   * Buscando o filtrando sale todo lo que casa, variantes incluidas: ahí ya sabes qué
   * quieres y esconderlas sería no encontrarlas.
   */
  const [familiasAbiertas, setFamiliasAbiertas] = useState<string[]>([])
  const hijosDe = (() => {
    const ids = new Set(ejercicios.map(e => e.id))
    const m: Record<string, any[]> = {}
    ejercicios.forEach(e => { if (e.portada_id && ids.has(e.portada_id)) (m[e.portada_id] = m[e.portada_id] || []).push(e) })
    return m
  })()
  /** Es variante de una portada que está en la lista. Si la portada no está, va como suelto. */
  const esHijo = (e: any) => !!e.portada_id && ejercicios.some(x => x.id === e.portada_id)

  // Solo las etiquetas que algún ejercicio tiene de verdad —o que son madre de una
  // usada— y agrupadas por categoría. Ofrecer el árbol entero llenaría la barra de
  // filtros que no devuelven nada.
  const grupos = (() => {
    const enUso = new Set<string>()
    ejercicios.forEach(e => (e.etiquetas || []).forEach((id: string) => enUso.add(id)))
    // Una madre se muestra si alguna de sus hijas está en uso: si no, "Cuádriceps"
    // desaparecería y solo verías "Recto femoral" suelto, sin su columna.
    const visibles = etiquetas.filter((et: any) =>
      conDescendientes(etiquetas, et.id).some(id => enUso.has(id)))

    const porCat: Record<string, any[]> = {}
    visibles.forEach((et: any) => {
      const cat = categoriaDe(etiquetas, et)
      ;(porCat[cat] = porCat[cat] || []).push(et)
    })

    // Dentro de cada categoría: cada raíz seguida de su descendencia, para que las
    // hijas salgan pegadas a su madre y no ordenadas alfabéticamente entre extrañas.
    return CATEGORIAS_ETIQUETA
      .filter(c => (porCat[c.key] || []).length > 0)
      .map(c => {
        const lista = porCat[c.key]
        const ordenada: any[] = []
        lista.filter((e: any) => nivelDe(etiquetas, e) === 0).forEach((raiz: any) => {
          conDescendientes(etiquetas, raiz.id).forEach(id => {
            const et = lista.find((x: any) => x.id === id)
            if (et && !ordenada.includes(et)) ordenada.push(et)
          })
        })
        lista.forEach((et: any) => { if (!ordenada.includes(et)) ordenada.push(et) })
        return { key: c.key, label: c.label, etiquetas: ordenada }
      })
  })()

  /**
   * La variante que casa con lo buscado, si la hay.
   *
   * Buscar "en tándem" tiene que encontrar "Marcha" —que es donde vive esa variante—,
   * pero enseñar la tarjeta con la foto de la marcha de talones sería engañoso: el
   * paciente vería un ejercicio distinto del que se le prescribió. Así que la tarjeta
   * pasa a mostrar la variante que casó, con su nombre y su imagen si la tiene.
   *
   * Solo aplica a la BÚSQUEDA por texto. Filtrar por etiqueta no sirve para esto: las
   * etiquetas son del ejercicio entero, no de cada variante, así que no hay forma de
   * saber cuál de ellas hizo casar el filtro.
   */
  function varianteQueCasa(e: any): any {
    const q = buscar.trim()
    if (!q) return null
    // Si el nombre del ejercicio ya casa, manda él: buscar "marcha" enseña la marcha.
    if (contiene(e.nombre, q)) return null
    return (e.variantes || []).find((v: any) => contiene(v?.nombre, q)) || null
  }

  /* BUSCAR TAMBIÉN POR SUS ETIQUETAS. Buscar «gemelo» tiene que traer lo etiquetado
     como gemelo aunque no lo diga el nombre. Y si casa una portada, entra su familia
     entera: sus variantes son el mismo ejercicio con otra forma. */
  const nombreEt: Record<string, string> = {}
  etiquetas.forEach((et: any) => { nombreEt[et.id] = et.nombre || '' })
  // El NOMBRE manda: lo que se llama así (o una variante suya). La descripción y las
  // etiquetas solo sirven para el bloque de «también lo trabajan», que va plegado.
  const casaNombre = (e: any) => contiene(e.nombre, buscar)
      || (e.variantes || []).some((v: any) => contiene(v?.nombre, buscar))
  const casaEtiqueta = (e: any) => contiene(e.descripcion, buscar)
      || (e.etiquetas || []).some((id: string) => contiene(nombreEt[id], buscar))
  const casaTexto = (e: any) => casaNombre(e) || casaEtiqueta(e)
  const portadasQueCasan = new Set(buscar ? ejercicios.filter(e => !e.portada_id && casaTexto(e)).map(e => e.id) : [])
  const filtrados = ejercicios.filter(e => {
    if (idsSimilares && !idsSimilares.has(e.id)) return false
    const coincide = !buscar || casaTexto(e) || (!!e.portada_id && portadasQueCasan.has(e.portada_id))
    // Varias etiquetas se acumulan: piden los que las tengan TODAS. Y cada una vale
    // por su rama entera, así que filtrar por "Cuádriceps" trae lo etiquetado solo
    // como "Recto femoral" — si no, habría que acordarse del nivel exacto.
    const etiquetado = filtroEt.length === 0 || filtroEt.every(id => {
      const rama = conDescendientes(etiquetas, id)
      return (e.etiquetas || []).some((x: string) => rama.includes(x))
    })
    return coincide && etiquetado && (!soloPendientes || problemasDeEjercicio(e).length > 0)
      && (!soloObjetivos || !objetivosDe || nombresObjs(e).length > 0)
      && cumple(e, objFiltro)
  })

  const nPendientes = ejercicios.filter(e => problemasDeEjercicio(e).length > 0).length

  /**
   * Ofrecer crear lo buscado solo cuando NO existe ya con ese nombre exacto.
   *
   * Se ofrece aunque haya resultados parecidos: buscando "press Pallof de rodillas"
   * aparece "press Pallof", que no es el mismo ejercicio. Lo que no se puede es ofrecer
   * crear algo que ya está, porque duplicarlo parte en dos la progresión del paciente.
   */
  /**
   * SIN ACENTOS TAMBIEN CUENTA COMO DUPLICADO.
   *
   * Comparando tal cual, escribir "flexion de cadera" no encontraba "Flexión de
   * cadera" y la app ofrecia crearla: dos ejercicios iguales, y la progresion
   * del paciente partida en dos. Es el fallo que mas caro sale aqui.
   */
  const existeYa = (n: string) => ejercicios.some(e => normalizar(e.nombre).trim() === normalizar(n).trim())

  /**
   * CREAR NO PUEDE DEPENDER DE BUSCAR ALGO QUE NO EXISTE.
   *
   * Solo se ofrecia al escribir en el buscador tres letras sin resultado exacto,
   * asi que quien no lo descubria por accidente no sabia que se podia. Ahora hay
   * un boton siempre visible, y la franja sigue apareciendo sola al buscar algo
   * que no esta, que es donde surge la necesidad.
   */
  const [abiertoCrear, setAbiertoCrear] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const aCrear = abiertoCrear ? nombreNuevo.trim() : buscar.trim()
  const ofreceCrear = !!onCrear && !abiertoCrear && aCrear.length >= 3 && !existeYa(aCrear)
  const mostrarCrear = !!onCrear && (ofreceCrear || abiertoCrear)
  const duplicado = abiertoCrear && aCrear.length >= 3 && existeYa(aCrear)
  const puedeCrear = aCrear.length >= 3 && !duplicado

  const hayFiltro = !!buscar || filtroEt.length > 0 || soloPendientes || soloObjetivos || objFiltro.length > 0
  const nombrePortada = (e: any) => ejercicios.find(x => x.id === e.portada_id)?.nombre || ''
  const nombreCortoDe = (e: any) => nombreCorto(e.nombre, nombrePortada(e))
  /** Lo que se pinta en la rejilla: con filtro, todo lo que casa; sin él, portadas y su familia si está abierta. */
  const visibles = hayFiltro ? filtrados : filtrados.filter(e => !esHijo(e)).flatMap(e =>
    familiasAbiertas.includes(e.id) ? [e, ...(hijosDe[e.id] || [])] : [e])
  const marcado = (e: any) => !!seleccion?.includes(e.id)
  /* PRIMERO LO QUE SE LLAMA ASÍ. Buscando «glúteo» salían mezclados los que lo dicen en
     el nombre y los que solo lo trabajan (por su etiqueta), y no se entendía por qué
     estaban. Ahora van en dos bloques, con un rótulo que dice el motivo del segundo. */
  const porNombre = (e: any) => casaNombre(e) || (!!e.portada_id && ejercicios.some(x => x.id === e.portada_id && casaNombre(x)))
  const visiblesNombre = buscar ? visibles.filter(porNombre) : visibles
  const visiblesEtiqueta = buscar ? visibles.filter(e => !porNombre(e)) : []

  /* LAS VARIANTES, JUNTAS Y TEÑIDAS. Una familia desplegada (o, buscando, dos o más de
     la misma familia) va seguida, la portada primero, y sus tarjetas llevan fondo verde
     claro y una raya arriba. Sin caja a lo ancho: la franja separaba y empujaba hacia
     abajo al resto, y despistaba más (lo dijo Manu). */
  function pintar(lista: any[], pre = '') {
    const fam = (e: any) => esHijo(e) ? e.portada_id : e.id
    const cuenta: Record<string, number> = {}
    lista.forEach(e => { const k = fam(e); cuenta[k] = (cuenta[k] || 0) + 1 })
    const hechos = new Set<string>()
    const out: any[] = []
    lista.forEach(e => {
      const k = fam(e)
      if (cuenta[k] < 2) { out.push(<Fragment key={pre + e.id}>{Tarjeta({ e })}</Fragment>); return }
      if (hechos.has(k)) return
      hechos.add(k)
      const miembros = lista.filter(x => fam(x) === k).sort((a, b) => (esHijo(a) ? 1 : 0) - (esHijo(b) ? 1 : 0))
      miembros.forEach(x => out.push(<Fragment key={pre + x.id}>{Tarjeta({ e: x, fam: true })}</Fragment>))
    })
    return out
  }

  /* SE LLAMA COMO FUNCIÓN, NO COMO <Tarjeta/>. Definida aquí dentro, como componente
     React la veía nueva en cada repintado y desmontaba y volvía a montar todas las
     tarjetas: en el taller (que se repinta a menudo) las fotos parpadeaban sin parar. */
  function Tarjeta({ e, fam = false }: { e: any, fam?: boolean }) {
    const sel = marcado(e)
    // Se agrupan bajo su raíz, así que las tres que caben son tres MADRES y no tres
    // etiquetas sueltas: antes una tarjeta podía enseñar "Cuádriceps, Vasto Medial,
    // Rodilla" y gastar dos huecos en decir lo mismo.
    const grupos = agrupaPorRaiz(etiquetas, e.etiquetas || [])
    const vc = varianteQueCasa(e)
    const img = (vc?.imagen_url) || e.imagen_url
    return (
      <div className={`tarj-ej ${sel ? 'on' : ''} ${fam ? 'tarj-fam' : ''}`}
        // Lente Cromo: la tarjeta entera se pinta del color de su cromo, como el cromo grande.
        style={paneles && panel === 'cromo' ? (() => { const rz = rareza(resumenClinica?.[e.id]?.veces || 0)
          return { borderColor: rz.color, borderWidth: 3, background: rz.claro } })() : undefined}
        onClick={() => (onAlternar ? onAlternar(e) : onAbrir?.(e))}>
        <div className="tarj-img">
          {/* LA MISMA IMAGEN QUE EN EL RESTO DE LA APP (ImagenEjercicio): foto, o la postura
              con su material, o los músculos. Aquí se pintaba aún la figura de músculos
              antigua, así que un ejercicio se veía distinto en la biblioteca que en el
              taller o el torno y parecía otro. */}
          <ImagenEjercicio src={img} ejercicioId={vc?.id || e.id} etiquetasEj={e.etiquetas || []}
            relleno radio={0} fondo="var(--bl)" icono={30} alt={vc ? `${e.nombre} · ${vc.nombre}` : e.nombre}/>
          {seleccion && sel && <span className="marca"><Ic name="check" size={13} /></span>}
        </div>
        {/* LAS VARIANTES, EN FRANJA bajo la foto (Biblioteca): como chapa pequeña no se veían.
            Toda la anchura de la tarjeta, se toca para desplegar la familia aquí mismo. */}
        {paneles && (hijosDe[e.id] || []).length > 0 && !hayFiltro && (() => { const ab = familiasAbiertas.includes(e.id)
          return <button type="button" onClick={ev => { ev.stopPropagation(); setFamiliasAbiertas(l => ab ? l.filter(x => x !== e.id) : [...l, e.id]) }}
            style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: ab ? 'var(--g)' : 'var(--gl)', color: ab ? '#fff' : 'var(--gd)', fontSize: 12, fontWeight: 600, padding: '6px 8px', letterSpacing: .2 }}>
            <Ic name="plantillas" size={13}/> {hijosDe[e.id].length} {hijosDe[e.id].length === 1 ? 'variante' : 'variantes'} {ab ? '▴' : '▾'}
          </button> })()}
        <div style={{ padding: '8px 10px' }}>
          {/* Cuando lo que casó fue una variante, ella manda en el título y el nombre
              del ejercicio queda debajo, en pequeño: hay que saber de dónde sale. */}
          {/* LA FAMILIA, ENCIMA. En una variante su familia va arriba en pequeño y el
              título es solo lo que la distingue ("Agarre ancho"), sin repetir
              "Curl con barra ·" en cada tarjeta. */}
          {esHijo(e) && <div style={{ fontSize: 10.5, color: 'var(--g)', letterSpacing: .2, marginBottom: 1 }}>{nombrePortada(e)}</div>}
          <div style={{ fontSize: 13, color: 'var(--n)', lineHeight: 1.3 }}>{vc ? vc.nombre : esHijo(e) ? nombreCortoDe(e) : e.nombre}</div>
          {vc && <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 1 }}>{e.nombre}</div>}
          {/* PARA QUÉ OBJETIVO DE SU SESIÓN SIRVE. Sin esto, al elegir no se sabía si el
              ejercicio trabajaba lo que se le marcó al paciente. */}
          {objetivosDe && (() => {
            const os = nombresObjs(e)
            if (os.length === 0) return null
            return <div title={os.join(' · ')} style={{ fontSize: 11, color: '#fff', background: 'var(--gd)', borderRadius: 99, padding: '1px 8px',
              display: 'inline-block', marginTop: 4, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ◎ {os[0]}{os.length > 1 ? ` +${os.length - 1}` : ''}</div>
          })()}
          {paneles && panel !== 'normal' && (() => {
            const rs = resumen?.[e.id]
            const tx: React.CSSProperties = { fontSize: 12, color: 'var(--gr)', marginTop: 3, lineHeight: 1.4 }
            if (faltaVista && !resumenFijo) return <div style={tx}>Falta ejecutar sql/ejercicio-resumen.sql</div>
            if (!resumen) return <div style={tx}>Cargando…</div>
            if (panel === 'cromo') {
              const v = resumenClinica?.[e.id]?.veces || 0, rz = rareza(v)
              return <div style={{ ...tx, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: rz.color, color: '#fff', borderRadius: 99, padding: '1px 8px', fontSize: 10.5, letterSpacing: .4, textTransform: 'uppercase' }}>{rz.t}</span>
                {v > 0 && <span><b style={{ color: 'var(--n)', fontSize: 14 }}>{v}</b> {v === 1 ? 'vez' : 'veces'}</span>}
              </div>
            }
            if (panel === 'capacidad') {
              const caps: any[] = intensidades ? (intensidades[e.id] || []) : (rs?.capacidades || [])
              if (!caps.length) return null // sin datos, nada: un texto aquí solo estorba
              const tr = trozosCapacidad(caps), R = 15, L = 2 * Math.PI * R
              return <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <svg viewBox="0 0 40 40" width="40" height="40" style={{ flexShrink: 0 }}>
                  <circle cx="20" cy="20" r={R} fill="none" stroke="var(--bl)" strokeWidth="6"/>
                  {tr.map(t => <circle key={t.nombre} cx="20" cy="20" r={R} fill="none" stroke={t.color} strokeWidth="6"
                    strokeDasharray={`${Math.max(0, t.parte * L - 1)} ${L}`} strokeDashoffset={-t.ini * L} transform="rotate(-90 20 20)"/>)}
                </svg>
                <div style={{ minWidth: 0, lineHeight: 1.25 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--n)' }}>{tr[0].pct}%</div>
                  <div style={{ fontSize: 12, color: 'var(--gr)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr[0].nombre}</div>
                </div>
              </div>
            }
            /* USO EN CIFRAS, como en el cromo: número grande y etiqueta pequeña, sin frases.
               Con un cliente elegido no hay "pacientes" (es uno): solo lo suyo. */
            if (panel === 'uso') {
              if (!rs || (!rs.veces && !rs.sesiones)) return null
              const celdas: [string | number, string][] = [[rs.veces, 'Veces'], ...(resumenFijo ? [] : [[rs.pacientes, 'Pac.'] as [number, string]]),
                [rs.sesiones, 'Ses.'], [rs.ultima ? fechaCorta(rs.ultima).replace(/ \d+$/, '') : '—', 'Última']]
              return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${celdas.length}, 1fr)`, gap: 2, marginTop: 6, textAlign: 'center' }}>
                {celdas.map(([n, t]) => <div key={t}>
                  <div style={{ fontSize: typeof n === 'number' ? 16 : 12.5, fontWeight: 600, color: 'var(--n)', lineHeight: '20px', whiteSpace: 'nowrap' }}>{n}</div>
                  <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--grl)' }}>{t}</div>
                </div>)}
              </div>
            }
            const objs: any[] = rs?.objetivos || []
            // Todos, sin "+N": tocar el +N abría el cromo y allí no estaban los filtrados.
            return objs.length === 0 ? null : (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                {objs.map((o: any) => (
                  <span key={o.nombre} className="badge badge-g" title={`${o.nombre} · en ${o.n} ${o.n === 1 ? 'sesión' : 'sesiones'}`}>◎ {o.nombre}</span>))}
              </div>)
          })()}
          {(!paneles || panel === 'normal') && <>
          {/* Cómo se mide decide qué campos pedirá la sesión: conviene saberlo antes. */}
          <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 2 }}>
            {nombreMedida(e.tipo_medida)}
          </div>
          </>}
          {/* QUE TIENE VARIANTES SE SABE AQUI. Antes solo se veía si por casualidad
              buscabas el nombre de una: al montar la sesión elegías el ejercicio a
              secas sin saber que había una unilateral esperando. */}
          {/* LA FAMILIA: se despliega aquí mismo, sin abrir el ejercicio. */}
          {!paneles && (hijosDe[e.id] || []).length > 0 && !hayFiltro && (
            <button type="button" className={`chip-sel ${familiasAbiertas.includes(e.id) ? 'on' : ''}`}
              style={{ marginTop: 5, fontSize: 11, padding: '2px 9px' }}
              onClick={ev => { ev.stopPropagation(); setFamiliasAbiertas(l => l.includes(e.id) ? l.filter(x => x !== e.id) : [...l, e.id]) }}>
              {hijosDe[e.id].length} {hijosDe[e.id].length === 1 ? 'variante' : 'variantes'} {familiasAbiertas.includes(e.id) ? '▴' : '▾'}
            </button>
          )}
          {!vc && !paneles && (e.variantes || []).length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--g)', marginTop: 3 }}
              title={(e.variantes || []).map((v: any) => v?.nombre).filter(Boolean).join(' · ')}>
              {e.variantes.length} {e.variantes.length === 1 ? 'variante' : 'variantes'}
            </div>
          )}
          {(!paneles || panel === 'normal') && <>
          {/* Lo que le falta se ve AQUÍ y no solo en la lista de pendientes: es al
              montar la sesión cuando te topas con el ejercicio a medias, y es el
              momento en el que puedes decidir completarlo o usar otro. */}
          {(() => {
            // En la Biblioteca no: completar ejercicios es cosa del torno.
            const faltan = paneles ? [] : problemasDeEjercicio(e)
            if (faltan.length === 0) return null
            return (
              <div style={{ marginTop: 5 }}>
                <span className="badge badge-pen" title={faltan.map(f => f.texto).join('\n')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Ic name="alerta" size={9} /> Falta{faltan.length > 1 ? `n ${faltan.length} cosas` : ` ${FALTA[faltan[0].campo]}`}
                </span>
              </div>
            )
          })()}
          {/* BIBLIOTECA, VISTA NORMAL: la musculatura clave, la marcada ★ principal en su
              anatomía (lo que activa el ejercicio). Sin números ni grupos: se lee de un
              vistazo. Si aún no tiene anatomía, sus grupos musculares sin más. */}
          {paneles && (() => {
            /* QUÉ TRABAJA, entero (sin cortar con «…»): los músculos ★ principales y lo
               que hacen, agrupado por movimiento: «↻ Flexión · dorsal, lumbar». */
            const an = anatomiaDe(e)
            const nom = (id: string | null) => etiquetas.find(x => x.id === id)?.nombre || ''
            const mus = an.mus.filter(m => m.p).map(m => nom(m.u)).filter(Boolean)
            const accs = an.acc.some(x => x.p) ? an.acc.filter(x => x.p) : an.acc
            const porMov: Record<string, string[]> = {}
            accs.forEach(x => { const m = x.m ? nom(x.m) : 'Trabaja'; const a = nom(x.a); if (a && !(porMov[m] ||= []).includes(a)) porMov[m].push(a) })
            const acc = Object.entries(porMov).map(([m, as]) => `${m} · ${as.join(', ').toLowerCase()}`)
            if (!mus.length && !acc.length) {
              const g = grupos.slice(0, 3).map(x => x.raiz.nombre)
              return g.length ? <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 4 }}>{g.join(' · ')}</div> : null
            }
            return <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>
              {mus.length > 0 && <div style={{ color: 'var(--n)' }}><span style={{ color: '#d9a21b' }}>★</span> {mus.join(', ')}</div>}
              {acc.map(t => <div key={t} style={{ color: 'var(--gd)' }}>↻ {t}</div>)}
            </div>
          })()}
          {!paneles && grupos.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
              {grupos.slice(0, 3).map(g => {
                // La madre se marca también cuando quien casa con el filtro es una hija:
                // si filtras por "Vasto Medial", la tarjeta sigue diciendo "Cuádriceps"
                // pero resaltado, y así se entiende por qué ha entrado en el resultado.
                const marcada = filtroEt.includes(g.raiz.id) || g.hijas.some((h: any) => filtroEt.includes(h.id))
                const detalle = g.hijas.map((h: any) => h.nombre).join(' · ')
                return (
                  <span key={g.raiz.id} className="badge badge-g" title={detalle || undefined}
                    style={marcada ? { background: 'var(--g)', color: '#fff' } : undefined}>
                    {g.raiz.nombre}{g.hijas.length > 0 && <span style={{ opacity: .7, marginLeft: 4 }}>{g.hijas.length}</span>}
                  </span>
                )
              })}
              {grupos.length > 3 && <span style={{ fontSize: 11, color: 'var(--gr)' }}>+{grupos.length - 3}</span>}
            </div>
          )}
          </>}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* LOS OBJETIVOS DE LA SESIÓN, EN ESFERAS: tocar una deja solo los ejercicios que
          la trabajan; tocar otra más, los que trabajan las dos. Tocarla otra vez la quita. */}
      {objetivos.length > 0 && idsObjetivosDe && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 10 }}>
          {objetivos.map((o: any) => {
            const on = objFiltro.includes(o.id)
            // El número dice cuántos quedarían con esta esfera junto a las ya marcadas:
            // así se ve antes de tocarla si la combinación deja ejercicios o ninguno.
            const conEsta = on ? objFiltro : [...objFiltro, o.id]
            const n = ejercicios.filter(e => cumple(e, conEsta)).length
            return (
              <button key={o.id} type="button" onClick={() => setObjFiltro(p => on ? p.filter(x => x !== o.id) : [...p, o.id])}
                title={`${o.nombre} · ${n} ejercicio${n === 1 ? '' : 's'}${objFiltro.length && !on ? ' si la añades' : ''}`}
                style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 76, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  opacity: objFiltro.length && !on ? .4 : 1 }}>
                <span style={{ borderRadius: '50%', boxShadow: on ? '0 0 0 3px var(--gd)' : 'none' }}><MonedaObjetivo objetivo={o}/></span>
                <span className="obj-mon-g" style={on ? { color: 'var(--gd)', fontWeight: 600 } : undefined}>{o.nombre}</span>
                <span style={{ fontSize: 9.5, color: 'var(--grl)' }}>{n}</span>
              </button>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        {antesDelBuscador && <div style={{ flex: 1, minWidth: 190 }}>{antesDelBuscador}</div>}
        <input className="input" placeholder="Buscar ejercicio…" value={buscar}
          onChange={e => setBuscar(e.target.value)} style={{ flex: 1, minWidth: 190 }} />
        <span style={{ fontSize: 12, color: 'var(--gr)', whiteSpace: 'nowrap' }}>
          {(() => { const n = buscar ? visiblesNombre.length : hayFiltro ? filtrados.length : filtrados.filter(e => !esHijo(e)).length
            return `${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}` })()}
        </span>
        {paneles && (
          // Un toque, siguiente modo. Con su nombre al lado para saber en cuál estás.
          <button type="button" data-guia="bib-lente" className="chip-sel on" onClick={siguienteLente} title="Cambiar lo que se ve en las tarjetas"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Ic name={lente.ic} size={13}/> {lente.t}
            <span style={{ display: 'inline-flex', gap: 2, marginLeft: 2 }}>{LENTES.map(l => <i key={l.k} style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', opacity: l.k === panel ? 1 : .3 }}/>)}</span>
          </button>
        )}
        {grupos.length > 0 && (
          <button type="button" className={`chip-sel ${verFiltros || filtroEt.length > 0 ? 'on' : ''}`}
            onClick={() => setVerFiltros(true)} aria-expanded={verFiltros}>
            Filtros{filtroEt.length > 0 ? ` · ${filtroEt.length}` : ''}
          </button>
        )}
        {objetivosDe && !(objetivos.length > 0 && idsObjetivosDe) && (
          <button type="button" className={`chip-sel ${soloObjetivos ? 'on' : ''}`} onClick={() => setSoloObjetivos(v => !v)}
            title="Solo los ejercicios que trabajan algún objetivo de esta sesión">
            ◎ Para sus objetivos
          </button>
        )}
        <MiniCuerpo etiquetas={etiquetas} valor={filtroEt} onChange={setFiltroEt}/>
        {nPendientes > 0 && !paneles && (
          <button type="button" className={`chip-sel ${soloPendientes ? 'on' : ''}`}
            onClick={() => setSoloPendientes(v => !v)}
            title="Los que se crearon a medias o les falta algo por rellenar">
            Por completar · {nPendientes}
          </button>
        )}
        {onCrear && botonCrear && !abiertoCrear && (
          <button type="button" className="btn btn-s btn-sm"
            onClick={()=>{ setNombreNuevo(buscar.trim()); setAbiertoCrear(true) }}
            title="Crear un ejercicio que no está en la biblioteca">
            + Crear ejercicio
          </button>
        )}
        {acciones}
      </div>

      {/* CREAR LO QUE NO ESTÁ. Aparece donde surge la necesidad —buscando algo que no
          existe— y pide lo mínimo: el nombre ya está escrito, y cómo se mide, que no se
          puede adivinar porque decide si la sesión pide kilos o segundos. Lo demás se
          rellena luego desde "Por completar". */}
      {mostrarCrear && (
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10,
          padding: '8px 11px', borderRadius: 'var(--r)', background: 'var(--bl)', border: '1px dashed var(--gm)' }}>
          {abiertoCrear ? (
            <input className="input" autoFocus value={nombreNuevo} placeholder="Nombre del ejercicio"
              onChange={e => setNombreNuevo(e.target.value)} style={{ flex: 1, minWidth: 180, maxWidth: 320 }} />
          ) : (
            <span style={{ fontSize: 12, color: 'var(--gr)' }}>
              Crear &laquo;<b style={{ color: 'var(--n)' }}>{aCrear}</b>&raquo; y a&ntilde;adirlo.
            </span>
          )}
          <span style={{ fontSize: 12, color: 'var(--gr)' }}>&iquest;C&oacute;mo se mide?</span>
          {TIPOS_MEDIDA.filter(m => RAPIDAS.includes(m.id)).map(m => (
            <button key={m.id} type="button" className="chip-sel" title={m.ayuda} disabled={creando || !puedeCrear}
              style={!puedeCrear ? { opacity: .45, cursor: 'not-allowed' } : undefined}
              onClick={async () => {
                setCreando(true)
                try { await onCrear!(aCrear, m.id) } finally { setCreando(false) }
                setBuscar(''); setNombreNuevo(''); setAbiertoCrear(false)
              }}>
              {m.nombre}
            </button>
          ))}
          {creando && <span style={{ fontSize: 12, color: 'var(--gr)' }}>Creando…</span>}
          {duplicado && <span style={{ fontSize: 12, color: 'var(--red)' }}>Ya existe uno con ese nombre.</span>}
          {abiertoCrear && !creando && (
            <button type="button" onClick={()=>{ setAbiertoCrear(false); setNombreNuevo('') }}
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--grl)', fontSize:13, marginLeft:'auto' }}>✕</button>
          )}
        </div>
      )}

      {/* FILTROS EN UN VELO: fuera solo quedan las marcadas, que se quitan con un toque. */}
      <PastillasFiltro etiquetas={etiquetas} valor={filtroEt} onChange={setFiltroEt} onAbrir={() => setVerFiltros(true)}/>
      {grupos.length > 0 && verFiltros && (
        <VeloFiltros grupos={grupos} etiquetas={etiquetas} ejercicios={ejercicios} valor={filtroEt} onChange={setFiltroEt}
          nResultado={filtrados.length} onCerrar={() => setVerFiltros(false)}/>
      )}

      {/* Los sugeridos se esconden en cuanto buscas o filtras: ahí ya sabes qué quieres. */}
      {/* CAMBIAR POR UNO SIMILAR O POR CUALQUIERA: dos pestañas. */}
      {soloSugeridos && !soloSimilares && sugeridos && sugeridos.items.length > 0 && (
        <div style={{ display: 'inline-flex', background: '#E8E7E1', borderRadius: 99, padding: 3, marginBottom: 10 }}>
          {([[false, `Similares · ${sugeridos.items.length}`], [true, 'Cualquiera']] as const).map(([v, l]) => (
            <button key={String(v)} type="button" onClick={() => setVerTodo(v)}
              style={{ border: 0, borderRadius: 99, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                background: verTodo === v ? '#fff' : 'transparent', color: verTodo === v ? 'var(--n)' : 'var(--gr)',
                boxShadow: verTodo === v ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }}>{l}</button>
          ))}
        </div>
      )}
      {sugeridos && sugeridos.items.length > 0 && !hayFiltro && !(soloSugeridos && verTodo) && (
        <div style={{ marginBottom: 16 }}>
          <div className="et-mini" style={{ marginBottom: 7, color: 'var(--gd)' }}>{sugeridos.titulo}</div>
          <div className="rej-ej">
            {sugeridos.items.map(e => <Fragment key={'s' + e.id}>{Tarjeta({ e })}</Fragment>)}
          </div>
        </div>
      )}

      {filtrados.length === 0
        ? <div className="muted">{ejercicios.length === 0 ? 'No hay ejercicios en la biblioteca.'
            : soloPendientes && !buscar && filtroEt.length === 0 ? 'No queda ningún ejercicio por completar.'
            : 'Ningún ejercicio coincide.'}</div>
        : soloSug && !hayFiltro
        ? null
        : <>
          {visiblesNombre.length > 0 && <div className="rej-ej">{pintar(visiblesNombre)}</div>}
          {visiblesNombre.length === 0 && visiblesEtiqueta.length > 0 && !verOtros && (
            <div className="muted" style={{ fontSize: 12 }}>Ninguno se llama «{buscar.trim()}».</div>
          )}
          {visiblesEtiqueta.length > 0 && <>
            {/* PLEGADO: buscando «flexión» se quiere lo que se llama flexión. Lo que solo
                lo trabaja (por etiqueta o porque lo dice su descripción) está a un toque. */}
            <button type="button" className="chip-sel" style={{ margin: '14px 0 8px' }} onClick={() => setVerOtros(v => !v)}>
              {verOtros ? '▴ Ocultar' : '▾ Ver'} {visiblesEtiqueta.length} que no se llaman así pero trabajan «{buscar.trim()}»
            </button>
            {verOtros && <div className="rej-ej">{pintar(visiblesEtiqueta, 'o')}</div>}
          </>}
        </>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MINI MUÑECO: filtrar por zona del cuerpo con un toque, sin abrir el velo de filtros.
// Cada punto es una etiqueta de articulación de la biblioteca (hombro, rodilla…);
// solo salen los puntos cuya etiqueta existe. Tocar otra vez la quita.
// ---------------------------------------------------------------------------
const ZONAS: { claves: string[], nombre: string, puntos: [number, number][] }[] = [
  { claves: ['cervical', 'cuello'], nombre: 'Cervical', puntos: [[30, 21]] },
  { claves: ['hombro'], nombre: 'Hombro', puntos: [[19, 27], [41, 27]] },
  { claves: ['dorsal', 'torac'], nombre: 'Dorsal', puntos: [[30, 35]] },
  { claves: ['codo'], nombre: 'Codo', puntos: [[14, 45], [46, 45]] },
  { claves: ['lumbar'], nombre: 'Lumbar', puntos: [[30, 50]] },
  { claves: ['muñeca', 'muneca', 'mano'], nombre: 'Muñeca', puntos: [[11, 60], [49, 60]] },
  { claves: ['cadera', 'pelvis'], nombre: 'Cadera', puntos: [[24, 61], [36, 61]] },
  { claves: ['rodilla'], nombre: 'Rodilla', puntos: [[25, 86], [35, 86]] },
  { claves: ['tobillo', 'pie'], nombre: 'Tobillo', puntos: [[25, 110], [35, 110]] },
]

function MiniCuerpo({ etiquetas, valor, onChange }: { etiquetas: any[], valor: string[], onChange: (v: string[]) => void }) {
  const [abierto, setAbierto] = useState(false)
  // De cada zona, la etiqueta de articulación más general que la nombre (la raíz si la hay).
  const raices = etiquetas.filter((et: any) => categoriaDe(etiquetas, et) === 'articulacion')
    .sort((a: any, b: any) => nivelDe(etiquetas, a) - nivelDe(etiquetas, b))
  const zonas = ZONAS.map(z => ({ ...z, et: raices.find((et: any) => z.claves.some(k => normalizar(et.nombre || '').includes(normalizar(k)))) }))
    .filter(z => z.et)
  if (zonas.length === 0) return null
  const activas = zonas.filter(z => valor.includes(z.et.id))
  const alternar = (id: string) => onChange(valor.includes(id) ? valor.filter(x => x !== id) : [...valor, id])
  return (
    <span style={{ position: 'relative' }}>
      <button type="button" className={`chip-sel ${activas.length ? 'on' : ''}`} onClick={() => setAbierto(v => !v)}
        title="Filtrar por zona del cuerpo">
        <svg width="12" height="16" viewBox="0 0 60 120" style={{ verticalAlign: '-3px', marginRight: 4 }} fill="currentColor"><circle cx="30" cy="10" r="8"/><path d="M18 22h24l6 34-6 2-4-22v34l4 48h-8l-4-40-4 40h-8l4-48V36l-4 22-6-2z"/></svg>
        {activas.length ? activas.map(z => z.nombre).join(' · ') : 'Zona'}
      </button>
      {abierto && <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setAbierto(false)}/>
        {/* Anclado por la derecha: está al final de la barra y por la izquierda se salía de la pantalla. */}
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 51, background: '#fff', borderRadius: 14,
          boxShadow: '0 8px 24px rgba(0,0,0,.14)', padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          <svg width="96" height="192" viewBox="0 0 60 120">
            <circle cx="30" cy="10" r="8" fill="#BFDCDF"/>
            <path d="M18 22h24l6 34-6 2-4-22v34l4 48h-8l-4-40-4 40h-8l4-48V36l-4 22-6-2z" fill="#BFDCDF"/>
            {zonas.map(z => z.puntos.map(([x, y], i) => {
              const on = valor.includes(z.et.id)
              return <circle key={z.nombre + i} cx={x} cy={y} r={4.2} onClick={() => alternar(z.et.id)}
                fill={on ? 'var(--gd)' : '#fff'} stroke="var(--gd)" strokeWidth={1.4} style={{ cursor: 'pointer' }}>
                <title>{z.et.nombre}</title></circle>
            }))}
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {zonas.map(z => (
              <button key={z.nombre} type="button" className={`chip-sel ${valor.includes(z.et.id) ? 'on' : ''}`}
                style={{ fontSize: 11.5, padding: '2px 9px', textAlign: 'left' }} onClick={() => alternar(z.et.id)}>{z.et.nombre}</button>
            ))}
          </div>
        </div>
      </>}
    </span>
  )
}
