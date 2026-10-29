'use client'
import { apuntarHistorial, resumenCambios } from '@/lib/sesionViva'
import { useConfigTrabajo, nombresEjecucion, nombresCapacidad, sugerenciaCapacidad } from '@/lib/usarTrabajo'
import { ejecucionPorTiempo, segundosDeEjecucion } from '@/lib/trabajo'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { capacidadPorReps, textoDescanso } from '@/lib/capacidades'
import { MODOS_PARTE, TIPOS_TIEMPO, modoParte, registrarSesion, LADOS, itemDeEjercicio } from '@/lib/sesiones'
import ExploradorEjercicios from '@/components/ExploradorEjercicios'
import MonedaObjetivo from '@/components/MonedaObjetivo'
import { similaresA, crearEjercicioRapido } from '@/lib/ejercicios'
import { categoriaDe } from '@/lib/etiquetas'
import { contraindicacionesDe, motivoDe, type Contraindicacion } from '@/lib/contraindicaciones'
import { contiene } from '@/lib/texto'
import { aplicarAjustes, calcularAjustes, sinAjustes } from '@/lib/ajustesCita'
import SelectorObjetivos from './SelectorObjetivos'
import HojaLibre from '@/components/HojaLibre'
import { traerTodo } from '@/lib/paginar'
import { leerHoja, hojaVacia, objetivosDeHoja, type Hoja } from '@/lib/hoja'
import { objetivosDeEjercicio, cruceObjetivo } from '@/lib/ejercicioObjetivos'
import { camposSerie, ajustesMedida, COLOR_BANDA, partesMedida, idMedida } from '@/lib/medida'

/**
 * Opción para dejar el ejercicio sin variante, es decir, en su forma estándar. Es un
 * texto y no un valor aparte porque `ChipMenu` trabaja con nombres; al elegirla se
 * guarda cadena vacía, que es lo que el registro entiende por "sin variante".
 */
const SIN_VARIANTE = 'Sin variante'

/**
 * Valor que se lee como etiqueta y se cambia al pulsarlo. Un `select` gris pesa lo
 * mismo esté relleno o vacío; aquí el dato se ve de un vistazo y el caret dice que
 * se puede tocar. Es el patrón `.chip-ed` que ya usa la ficha del paciente.
 */
/**
 * ELEGIR VARIANTE VIÉNDOLA.
 *
 * Era un desplegable de texto, y una variante no se distingue por el nombre: entre
 * "en tándem" y "unipodal" lo que decide es la foto y la frase de cómo se ejecuta.
 * Con solo el nombre había que acordarse de memoria de qué era cada una.
 *
 * Fuera del componente grande a propósito: definido dentro, React lo trataría como
 * un componente nuevo en cada pulsación y el panel se cerraría solo.
 */
function SelectorVariante({ variantes, valor, imagenBase, onElegir }: {
  variantes: any[]
  valor: string
  imagenBase?: string
  onElegir: (v: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const actual = variantes.find((v: any) => String(v?.nombre || '').trim() === valor)
  const fila = (nombre: string, desc?: string, img?: string, elegida?: boolean) => (
    <div key={nombre || '—'} onClick={() => { onElegir(nombre); setAbierto(false) }}
      style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '7px 9px', cursor: 'pointer',
               borderBottom: '1px solid var(--bl)', background: elegida ? 'var(--gl)' : 'transparent' }}
      onMouseOver={e => (e.currentTarget as HTMLElement).style.background = 'var(--bl)'}
      onMouseOut={e => (e.currentTarget as HTMLElement).style.background = elegida ? 'var(--gl)' : 'transparent'}>
      {img
        ? <img src={img} alt={nombre} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 5, flexShrink: 0, background: 'var(--bm)' }} />
        : <div style={{ width: 40, height: 40, borderRadius: 5, flexShrink: 0, background: 'var(--bm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grl)' }}><Ic name="fuerza" size={16} /></div>}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--n)' }}>{nombre || 'Sin variante'}</div>
        {desc && <div style={{ fontSize: 10, color: 'var(--gr)', lineHeight: 1.4 }}>{desc}</div>}
      </div>
      {elegida && <span style={{ marginLeft: 'auto', color: 'var(--g)', display: 'inline-flex' }}><Ic name="check" size={13} /></span>}
    </div>
  )
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className={`chip-ed ${valor ? '' : 'chip-ed-v'}`} onClick={() => setAbierto(v => !v)}
        title={actual?.descripcion || 'Cómo se ejecuta hoy. Las variantes las define el ejercicio en la biblioteca'}>
        {valor || 'Variante'} <Ic name="abajo" size={11} />
      </button>
      {abierto && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 39 }} />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 40, width: 270,
                        maxHeight: 280, overflowY: 'auto', background: 'var(--w)', border: '1px solid var(--bd)',
                        borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.12)' }}>
            {fila('', 'El ejercicio en su forma estándar', imagenBase, !valor)}
            {variantes.map((v: any) => {
              const n = String(v?.nombre || '').trim()
              return fila(n, v?.descripcion, v?.imagen_url || imagenBase, valor === n)
            })}
            {/* Una variante que la biblioteca ya no ofrece pero la sesión guarda: se
                enseña igual, o se quedaría escrita sin que nadie la vea. */}
            {valor && !variantes.some((v: any) => String(v?.nombre || '').trim() === valor) &&
              fila(valor, 'Ya no está en la biblioteca', imagenBase, true)}
          </div>
        </>
      )}
    </div>
  )
}

function ChipMenu({ valor, opciones, onElegir, clase = '', vacio = '—', titulo }: {
  valor?: string
  opciones: string[]
  onElegir: (v: string) => void
  clase?: string
  vacio?: string
  titulo?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function fuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto])

  return (
    <div style={{ position: 'relative' }} ref={caja}>
      <button type="button" title={titulo} onClick={() => setAbierto(v => !v)}
        className={`chip-ed ${valor ? clase : 'chip-ed-n'}`} style={{ maxWidth: '100%' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{valor || vacio}</span>
        <Ic name="abajo" size={10} />
      </button>
      {abierto && (
        <div className="menu-flot" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4 }}>
          {opciones.map(o => (
            <button key={o} type="button" className="menu-it"
              onClick={() => { onElegir(o); setAbierto(false) }}>
              {valor === o && <Ic name="check" size={12} />}
              <span style={{ marginLeft: valor === o ? 0 : 20 }}>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ModalEditarSesion({ sesion, ejercicios, etiquetas = [], onGuardado, onCerrar, pacientes, cita, paraPaciente }: {
  sesion: any
  ejercicios: any[]
  etiquetas?: any[]
  /** Recibe el id de la sesion guardada, para quien necesite engancharla a algo. */
  onGuardado: (sesionId?: string) => void
  onCerrar: () => void
  pacientes?: any[]
  /**
   * Para quién se está creando, SIN hacerla suya: solo resalta sus objetivos al
   * elegirlos. Al crear una sesión desde "¿Qué sesión les pongo?" de un paciente,
   * la sesión nacía sin paciente y el selector no marcaba los de su ficha.
   */
  paraPaciente?: string
  /**
   * MISMA PANTALLA, DISTINTO DESTINO.
   *
   * Con `cita`, lo que guardes NO va a la sesión: va a esa cita, como desviación
   * de un día. La sesión es el plan y la comparten todas sus citas —editarla
   * haría que las ya hechas dijeran que se hizo algo que no se hizo.
   *
   * Se reutiliza el editor entero a propósito: un mini-editor aparte seria otra
   * pantalla que mantener y que acabaria divergiendo de esta.
   */
  cita?: { id: string, fecha?: string, ajustes?: any } | null
}) {
  const modoCita = !!cita?.id
  const [pacienteSel, setPacienteSel] = useState(sesion.paciente_id || '')

  /**
   * Lo que este paciente tiene desaconsejado por sus tests positivos.
   *
   * Se carga con el paciente y no con la sesión: una plantilla sin paciente no tiene
   * contraindicaciones que mirar, y al asignarla a alguien es cuando aparecen.
   */
  const [contra, setContra] = useState<Record<string, Contraindicacion>>({})
  useEffect(() => {
    if (!pacienteSel) { setContra({}); return }
    contraindicacionesDe(pacienteSel).then(setContra)
  }, [pacienteSel])
  const [busquedaPacModal, setBusquedaPacModal] = useState('')
  // Las bandas del centro (Ajustes), para prescribir con cuál.
  const [bandas, setBandas] = useState<string[]>([])
  useEffect(() => { ajustesMedida().then(a => setBandas(a.bandas)) }, [])
  const [formSesion, setFormSesion] = useState({
    nombre: sesion.nombre || '',
    descripcion: sesion.descripcion || '',
    // En modo cita se arranca del plan CON lo que ya estuviera ajustado ese día:
    // si no, cada vez que abrieras verias el plan y borrarias el ajuste al guardar.
    partes: (cita?.id ? aplicarAjustes(sesion, cita.ajustes) : sesion).partes || [],
    // CANDADO: no corre con las citas (lib/correrSesiones). Las copias lo heredan.
    fija: !!sesion.fija,
    // Si en esta sesión se trabaja con pulsómetro: el taller lo avisa al llegar.
    pulsometro: !!sesion.pulsometro,
  })
  const [parteActiva, setParteActiva] = useState(0)
  // Fila con la lista entera de objetivos abierta, y filas con la nota abierta.
  const [objsAbiertos, setObjsAbiertos] = useState<number | null>(null)
  const [notasAbiertas, setNotasAbiertas] = useState<Set<number>>(new Set())
  // Lo que habia al abrir, para saber si al cerrar se pierde algo. La hoja y los
  // objetivos llegan despues (se leen de la base), asi que se marcan aparte al tocarlos.
  const alAbrir = useRef(JSON.stringify(formSesion))
  const tocadoAparte = useRef(false)
  function cerrarSinGuardar() {
    const sucio = tocadoAparte.current || JSON.stringify(formSesion) !== alAbrir.current
    if (sucio && !confirm('Hay cambios sin guardar en esta sesión. ¿Salir y perderlos?')) return
    onCerrar()
  }
  // Arrastrar para reordenar las partes. Con el arrastre nativo del navegador:
  // meter una libreria de drag-and-drop para mover cuatro chips no se sostiene.
  const [arrastra, setArrastra] = useState<number|null>(null)
  const [sobre, setSobre] = useState<number|null>(null)
  // Y lo mismo para los ejercicios dentro de la parte abierta. Van aparte de los
  // de arriba: arrastrando una parte no se puede soltar sobre un ejercicio.
  const [arrEj, setArrEj] = useState<number|null>(null)
  const [sobreEj, setSobreEj] = useState<number|null>(null)
  const [abrirBib, setAbrirBib] = useState(false)
  /** Cambiando este ejercicio (índice en la parte) por otro: la biblioteca abre con sus parecidos. */
  const [cambiarEj, setCambiarEj] = useState<number | null>(null)
  const [selBib, setSelBib] = useState<string[]>([])
  /**
   * Ejercicios creados a las prisas SIN salir de aquí. Ya existen en la biblioteca
   * —son filas de verdad— pero el catálogo llegó por props y no se ha vuelto a leer,
   * así que se añaden a mano para que se vean en la rejilla al momento.
   */
  const [nuevosEj, setNuevosEj] = useState<any[]>([])
  const [ultimoCreado, setUltimoCreado] = useState('')
  /**
   * LA BIBLIOTECA SE LEE AL ABRIR, NO SE FIA DE LA QUE LLEGA POR PROPS.
   *
   * Quien abre este modal le pasa el catalogo que cargo EL una vez. Desde un ciclo se
   * creaban ejercicios en la primera sesion, se abria la segunda... y no estaban: el
   * ciclo seguia pasando el catalogo de antes. Los ejercicios si existian, pero esta
   * pantalla no los veia. Mientras llega la lectura se usa el de props.
   */
  const [frescos, setFrescos] = useState<any[] | null>(null)
  const cfgTrabajo = useConfigTrabajo()
  useEffect(() => {
    traerTodo((d, h) => supabase.from('ejercicios').select('*').order('nombre').order('id').range(d, h))
      .then(r => { if (!r.error) setFrescos(r.filas) })
  }, [])
  const base = frescos ?? (ejercicios || [])
  const catalogo = [...base, ...nuevosEj.filter(n => !base.some((e: any) => e.id === n.id))]
  const [guardando, setGuardando] = useState(false)
  const [objetivosDisp, setObjetivosDisp] = useState<any[]>([])
  const [objetivosSel, setObjetivosSel] = useState<string[]>([])
  // Que especifico de cada objetivo trabaja esta sesion. "Movilidad de rodilla"
  // no es lo mismo si la sesion va a la flexion que si va a todo.
  const [movsSel, setMovsSel] = useState<Record<string, string[]>>({})
  const [eligiendoObj, setEligiendoObj] = useState(false)
  const [buscarObj, setBuscarObj] = useState('')
  const [abrirObj, setAbrirObj] = useState(false)
  const [verObj, setVerObj] = useState(false)

  /**
   * HOJA LIBRE: la sesion dibujada en vez de rellenada. null = sesion de formulario.
   *
   * Se lee aqui y no se fia de `sesion.hoja`: varias pantallas abren este modal con un
   * select de columnas sueltas que no la trae, y entonces una hoja llegaria como null,
   * se abriria como formulario y al guardar se borraria el dibujo. Por eso, hasta que
   * no se ha leido (`hojaLeida`), al guardar no se toca la columna.
   */
  const [hoja, setHoja] = useState<Hoja | null>(null)
  const [hojaLeida, setHojaLeida] = useState(!sesion.id)
  const [objsPaciente, setObjsPaciente] = useState<{ id: string, nombre: string }[]>([])
  useEffect(() => {
    if (!sesion.id) return
    supabase.from('sesiones').select('hoja').eq('id', sesion.id).maybeSingle().then(({ data, error }) => {
      if (error) return
      setHoja(data?.hoja ? leerHoja(data.hoja) : null)
      setHojaLeida(true)
    })
  }, [sesion.id])
  // Las pegatinas de objetivo ofrecen los objetivos ABIERTOS del paciente: poner en la
  // hoja uno que no tiene no contaria para nada. Sin paciente (plantilla), el catalogo.
  useEffect(() => {
    const pid = sesion.paciente_id || pacienteSel
    if (!pid) { setObjsPaciente(objetivosDisp.filter((o:any)=>o.archivado_el == null).map((o:any)=>({ id:o.id, nombre:o.nombre }))); return }
    supabase.from('pacientes_objetivos').select('objetivo_id, logrado, nombre, objetivos(id,nombre)').eq('paciente_id', pid)
      .then(({ data }) => setObjsPaciente((data||[]).filter((r:any)=>!r.logrado && r.objetivo_id)
        .map((r:any)=>({ id:r.objetivo_id, nombre:r.objetivos?.nombre || r.nombre || 'Objetivo' }))))
  }, [sesion.paciente_id, pacienteSel, objetivosDisp])
  // Sus objetivos abiertos, solo para resaltarlos en el selector (ver `paraPaciente`).
  const [objsDestacar, setObjsDestacar] = useState<string[]>([])
  useEffect(() => {
    const pid = sesion.paciente_id || pacienteSel || paraPaciente
    if (!pid) { setObjsDestacar([]); return }
    supabase.from('pacientes_objetivos').select('objetivo_id, logrado').eq('paciente_id', pid)
      .then(({ data }) => setObjsDestacar((data||[]).filter((r:any)=>!r.logrado && r.objetivo_id).map((r:any)=>r.objetivo_id)))
  }, [sesion.paciente_id, pacienteSel, paraPaciente])
  const refObj = useRef<HTMLDivElement>(null)

  useEffect(() => {
    (async () => {
      const { data: objs } = await supabase.from('objetivos').select('*').eq('activo',true).order('nombre')
      setObjetivosDisp(objs||[])
      if (sesion.id) {
        const { data: rel } = await supabase.from('sesiones_objetivos').select('objetivo_id,movimientos').eq('sesion_id', sesion.id)
        setObjetivosSel((rel||[]).map((r:any)=>r.objetivo_id))
        setMovsSel(Object.fromEntries((rel||[]).map((r:any)=>[r.objetivo_id, r.movimientos||[]])))
      }
    })()
  }, [sesion.id])

  // El buscador de objetivos se cierra al pinchar fuera o con Escape. Obligar a volver
  // al botón para cerrarlo dejaba el panel tapando la pantalla.
  useEffect(() => {
    if (!abrirObj) return
    function fuera(e: MouseEvent) {
      if (refObj.current && !refObj.current.contains(e.target as Node)) { setAbrirObj(false); setBuscarObj('') }
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') { setAbrirObj(false); setBuscarObj('') }
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abrirObj])

  const parte = formSesion.partes[parteActiva]

  /**
   * Cómo se mide el ejercicio: por repeticiones, por tiempo o las dos.
   * Lo dice la biblioteca. Las sesiones antiguas no lo guardaban, así que se busca
   * por `ejercicio_id`; si tampoco aparece, se enseñan ambos campos y no se oculta
   * nada que pudiera estar ya relleno.
   */
  function medida(ej: any): string[] {
    const bib = catalogo.find((e:any)=>e.id===ej?.ejercicio_id)
    const base = ej?.tipo_medida || bib?.tipo_medida || 'peso_reps'
    // Los campos de carga × volumen (lib/medida). Isométrico se prescribe en segundos
    // aunque el ejercicio vaya por repeticiones. Igual que en el taller.
    // Por tiempo también los estiramientos (estático, FNP…): ver `ejecucionPorTiempo`.
    return camposSerie(base, { isometrico: ejecucionPorTiempo(cfgTrabajo, ej?.regimen) })
  }

  /**
   * Variantes que se pueden elegir para este ejercicio.
   *
   * Manda la BIBLIOTECA, no la copia que la sesión guardó en `variantes_disp` el día
   * que se añadió el ejercicio: si luego se añade una variante nueva al ejercicio,
   * aparece también en las sesiones ya montadas. La copia solo se usa como respaldo
   * cuando el ejercicio ya no está en la biblioteca —borrado o renombrado—, para no
   * dejar en blanco un desplegable que sí tenía opciones.
   */
  function variantesDe(ej: any): any[] {
    const bib = catalogo.find((e:any)=>e.id===ej?.ejercicio_id)
    const lista = Array.isArray(bib?.variantes) ? bib.variantes
      : Array.isArray(ej?.variantes_disp) ? ej.variantes_disp
      : []
    return lista.filter((v:any)=>(v?.nombre||'').trim()!=='')
  }

  // Ejercicios que comparten etiqueta con el último añadido a esta parte. Es la
  // pregunta real al montar una sesión: "¿qué más tengo para esto?".
  const ultimo = (parte?.ejercicios||[]).slice(-1)[0]
  const similares = (() => {
    if (!ultimo?.ejercicio_id) return []
    const base = catalogo.find((e:any)=>e.id===ultimo.ejercicio_id)
    if (!base) return []
    const yaPuestos = new Set((parte?.ejercicios||[]).map((x:any)=>x.ejercicio_id))
    // Por músculo y patrón, no por material: ver lib/ejercicios.ts.
    return similaresA(catalogo, base, 6, etiquetas).filter((e:any)=>!yaPuestos.has(e.id))
  })()

  function editarParte(cambios: any) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      partes[parteActiva] = { ...partes[parteActiva], ...cambios }
      return { ...prev, partes }
    })
  }

  // QUÉ OBJETIVO TRABAJA CADA EJERCICIO. Ver `lib/ejercicioObjetivos`.
  const objsSesion = objetivosSel.map(id => objetivosDisp.find((o: any) => o.id === id)).filter(Boolean)
  const etiquetasDeEj = (ej: any) => (catalogo.find((e: any) => e.id === ej?.ejercicio_id)?.etiquetas) || []
  // CRUCE ESTRICTO (lib/ejercicioObjetivos): mueve lo que pide el objetivo y admite lo que busca.
  const libDeEj = (ej: any) => catalogo.find((e: any) => e.id === ej?.ejercicio_id)
  const estrictoDe = (ej: any) => { const l = libDeEj(ej); return l && etiquetas.length ? { ej: l, etiquetas } : undefined }
  const objsDeEj = (ej: any) => objetivosDeEjercicio(ej, etiquetasDeEj(ej), objsSesion, movsSel, estrictoDe(ej))
  /** 'sugerido': cumple una de las dos comprobaciones; se ofrece para confirmar. */
  const sugeridoDe = (ej: any, o: any) => { const l = libDeEj(ej); return !!l && etiquetas.length > 0 && cruceObjetivo(l, o, etiquetas, movsSel[o.id]) === 'sugerido' }

  function editarEjercicio(ei: number, cambios: any) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      const p = partes[parteActiva]
      let ejercicios = [...(p.ejercicios||[])]
      ejercicios[ei] = { ...ejercicios[ei], ...cambios }

      // En SUPERSERIE las series son del grupo, no del ejercicio: los del mismo grupo
      // se hacen seguidos, así que uno no puede llevar tres vueltas y su pareja cuatro
      // —a partir de la tercera ya no habría con quién emparejarlo—. Al cambiar las
      // series de uno, se ponen las mismas en todo su grupo.
      if (p.modo === 'superserie' && cambios.series !== undefined) {
        const g = ejercicios[ei].grupo || 'A'
        ejercicios = ejercicios.map(x => (x.grupo || 'A') === g ? { ...x, series: cambios.series } : x)
      }
      // Y al mover un ejercicio de grupo, hereda las series del grupo al que entra.
      if (p.modo === 'superserie' && cambios.grupo !== undefined) {
        const hermano = ejercicios.find((x, i) => i !== ei && (x.grupo || 'A') === cambios.grupo)
        if (hermano?.series) ejercicios[ei] = { ...ejercicios[ei], series: hermano.series }
      }

      partes[parteActiva] = { ...p, ejercicios }
      return { ...prev, partes }
    })
  }

  /* SUPERSERIES DE 2, 3 o 4: con `tam_grupo` en la parte, las letras van solas por orden
     (A A B B…). Al añadir, quitar o mover, se recolocan. Sin él, cada letra a mano. */
  const letraGrupo = (i: number, tam: number) => String.fromCharCode(65 + Math.floor(i / Math.max(1, tam)))
  const conLetras = (p: any, ejercicios: any[]) => p?.modo === 'superserie' && p?.tam_grupo
    ? ejercicios.map((x: any, i: number) => ({ ...x, grupo: letraGrupo(i, Number(p.tam_grupo)) })) : ejercicios

  function addEjercicio(ej: any) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      // tipo_medida se copia de la biblioteca: dice si el ejercicio va por
      // repeticiones o por tiempo, y así no se piden los dos a la vez.
      // Sin variante por defecto: el ejercicio a secas YA es su forma estándar. Antes
      // entraba siempre como "Bilateral", que era mentira en la mitad del catálogo
      // —un press Pallof o una marcha no son bilaterales— y además dejaba escrito en el
      // registro el nombre de una variante que puede no existir en ese ejercicio.
      const configEj = itemDeEjercicio(ej)
      const pa = partes[parteActiva]
      partes[parteActiva] = { ...pa, ejercicios: conLetras(pa, [...(pa.ejercicios||[]), configEj]) }
      return { ...prev, partes }
    })
  }

  /**
   * Crear aquí mismo un ejercicio que no está en la biblioteca, y meterlo en la parte.
   *
   * Se añade DIRECTAMENTE en vez de dejarlo marcado para el botón "Añadir": ese botón
   * busca por id en el catálogo que llegó por props, donde el recién creado todavía no
   * está, así que se lo habría saltado sin decir nada.
   *
   * Lo que queda por rellenar —etiquetas, foto, descripción, ejecución— se ve luego en
   * Biblioteca → "Por completar". Aquí no se pregunta: estás montando la sesión.
   */
  async function crearYAnadir(nombre: string, tipoMedida: string) {
    const r = await crearEjercicioRapido(nombre, tipoMedida)
    if (!r.ok) { alert('No se pudo crear: ' + r.error); return }
    setNuevosEj(p => [...p, r.ejercicio])
    addEjercicio(r.ejercicio)
    setUltimoCreado(r.ejercicio.nombre)
  }

  /**
   * CAMBIAR DE SITIO UNA PARTE.
   *
   * El orden de las partes ES el orden del entrenamiento —calentamiento, bloque,
   * accesorios—, así que colocarlas mal obligaba a borrar y rehacer.
   *
   * `parteActiva` es un índice, no una referencia: si no se ajusta, mover una
   * parte deja abierta OTRA sin avisar, y sigues escribiendo en la equivocada.
   */
  function moverParte(desde: number, hasta: number) {
    if (desde === hasta) return
    setFormSesion(prev => {
      const partes = [...prev.partes]
      const [x] = partes.splice(desde, 1)
      partes.splice(hasta, 0, x)
      return { ...prev, partes }
    })
    setParteActiva(prev => {
      if (prev === desde) return hasta
      if (desde < prev && hasta >= prev) return prev - 1
      if (desde > prev && hasta <= prev) return prev + 1
      return prev
    })
  }

  /**
   * CAMBIAR DE SITIO UN EJERCICIO dentro de su parte.
   *
   * El orden es el que se sigue en la sala, así que colocarlo mal obligaba a
   * quitarlo y volver a añadirlo —perdiendo series, peso y reps ya escritos.
   *
   * El tirador va en una manilla y no en la fila entera: con `draggable` en la
   * fila, seleccionar un número dentro de un input se convierte en un arrastre.
   */
  /**
   * CAMBIAR UN EJERCICIO POR OTRO, en su sitio y con lo prescrito (series, reps, tiempo,
   * descanso, cómo se hace, grupo). Lo de la biblioteca (foto, medida, variantes) es del nuevo.
   */
  function reemplazarEjercicio(ei: number, nuevo: any) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      const pa = partes[parteActiva]
      const ejercicios = [...(pa.ejercicios || [])]
      const viejo = ejercicios[ei]
      if (!viejo) return prev
      ejercicios[ei] = { ...itemDeEjercicio(nuevo, viejo), peso: viejo.peso || '', nota: viejo.nota || '' }
      partes[parteActiva] = { ...pa, ejercicios }
      return { ...prev, partes }
    })
  }

  function moverEjercicio(desde: number, hasta: number) {
    if (desde === hasta) return
    setFormSesion(prev => {
      const partes = [...prev.partes]
      const ejercicios = [...(partes[parteActiva]?.ejercicios || [])]
      const [x] = ejercicios.splice(desde, 1)
      ejercicios.splice(hasta, 0, x)
      partes[parteActiva] = { ...partes[parteActiva], ejercicios: conLetras(partes[parteActiva], ejercicios) }
      return { ...prev, partes }
    })
  }

  function quitarEjercicio(parteIdx: number, ejIdx: number) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      partes[parteIdx] = { ...partes[parteIdx], ejercicios: conLetras(partes[parteIdx], partes[parteIdx].ejercicios.filter((_:any, i:number) => i !== ejIdx)) }
      return { ...prev, partes }
    })
  }

  async function guardarSesion() {
    // MODO CITA: se guarda la diferencia contra el plan, no el plan.
    if (modoCita) {
      setGuardando(true)
      const ajustes = calcularAjustes(sesion, { partes: formSesion.partes }, cita?.ajustes)
      // Sin cambios se escribe null y no un objeto vacio: asi "no tiene ajustes"
      // es una sola cosa en la base y no dos que hay que acordarse de mirar.
      const { error } = await supabase.from('citas')
        .update({ ajustes: sinAjustes(ajustes) ? null : ajustes }).eq('id', cita!.id)
      setGuardando(false)
      if (error) { alert('No se ha podido guardar el cambio de ese día: ' + error.message); return }
      onGuardado()
      onCerrar()
      return
    }
    if (!formSesion.nombre) { alert('El nombre es obligatorio'); return }
    const esNueva = !sesion.id
    const pid = sesion.paciente_id || pacienteSel || null
    setGuardando(true)
    let sesionId = sesion.id
    // Se guarda lo que se ve: lo marcado a mano y, si no se tocó, lo sugerido. Así el
    // taller y la ficha leen el vínculo tal cual, sin recalcular etiquetas.
    const partesConObj = (formSesion.partes || []).map((p: any) => ({
      ...p, ejercicios: (p.ejercicios || []).map((ej: any) => ({ ...ej, objetivos: objsDeEj(ej) })),
    }))
    const campos: any = {
      nombre: formSesion.nombre, descripcion: formSesion.descripcion,
      partes: partesConObj,
    }
    // Solo se manda si cambia: sin la columna (falta el SQL) el resto se guarda igual.
    if (formSesion.fija !== !!sesion.fija) campos.fija = formSesion.fija
    if (formSesion.pulsometro !== !!sesion.pulsometro) campos.pulsometro = formSesion.pulsometro
    if (hojaLeida) campos.hoja = hoja
    // Los objetivos pegados en la hoja cuentan igual que los elegidos arriba: si no,
    // habria que marcarlos dos veces, y el dia que no coincidieran no sabriamos cual vale.
    const objsFinal = Array.from(new Set([...objetivosSel, ...(hoja ? objetivosDeHoja(hoja) : [])]))
    if (esNueva) {
      const { data, error } = await supabase.from('sesiones')
        .insert({ ...campos, paciente_id:pid, estado:'lista' })
        .select('id').single()
      if (error || !data) { alert('Error al crear la sesión'); setGuardando(false); return }
      sesionId = data.id
      // Crear desde aquí dejaba la sesión sin evento, mientras que crearla desde la
      // ficha sí lo registraba: el historial dependía de por dónde hubieras entrado.
      if (pid) await registrarSesion(pid, `Sesión creada: ${formSesion.nombre}`)
      // Sesion viva: su primer hito, con la foto de como nace.
      if (pid) await apuntarHistorial(sesionId!, pid, 'inicio', 'Creada en el editor', 'Editor de sesión', campos.partes)
    } else {
      let { error } = await supabase.from('sesiones').update(campos).eq('id', sesionId)
      if (error && /fija/.test(error.message)) {
        alert('El candado no se ha guardado: falta añadir la columna en Supabase (sesiones.fija). El resto sí.')
        delete campos.fija; ({ error } = await supabase.from('sesiones').update(campos).eq('id', sesionId))
      }
      if (error && /pulsometro/.test(error.message)) {
        alert('Lo del pulsómetro no se ha guardado: falta añadir la columna en Supabase (sesiones.pulsometro). El resto sí.')
        delete campos.pulsometro; ({ error } = await supabase.from('sesiones').update(campos).eq('id', sesionId))
      }
      if (error) { alert('No se pudo guardar la sesión: '+error.message); setGuardando(false); return }
      // Candado en una PLANTILLA: se pasa a las copias que ya tienen los pacientes
      // (programar a un grupo), para no tener que ir ficha por ficha.
      if ('fija' in campos && !sesion.paciente_id)
        await supabase.from('sesiones').update({ fija: campos.fija }).eq('plantilla_id', sesionId)
      // SESION VIVA: si es de un paciente, el cambio se apunta en su historial con la foto
      // de como queda. Las plantillas de la biblioteca no llevan historial: no crecen.
      if (sesion.paciente_id) {
        const cambios = resumenCambios(sesion.partes || [], campos.partes || [])
        if (cambios.length) await apuntarHistorial(sesionId!, sesion.paciente_id, 'cambio', cambios.join(' · '), 'Editor de sesión', campos.partes)
      }
    }

    // Objetivos: se calcula la diferencia en vez de borrar todo y reinsertar. Si el
    // insert fallaba después del delete, la sesión se quedaba sin ningún objetivo y
    // nadie se enteraba. Ahora un fallo deja lo que ya había.
    const { data: actuales } = await supabase.from('sesiones_objetivos')
      .select('objetivo_id').eq('sesion_id', sesionId)
    const previos: string[] = (actuales||[]).map((r:any)=>r.objetivo_id)
    const aAnadir = objsFinal.filter(id=>!previos.includes(id))
    const aQuitar = previos.filter(id=>!objsFinal.includes(id))

    if (aAnadir.length>0) {
      const { error } = await supabase.from('sesiones_objetivos')
        .insert(aAnadir.map(oid=>({ sesion_id:sesionId, objetivo_id:oid, movimientos: movsSel[oid]||[] })))
      if (error) { alert('La sesión se guardó, pero sus objetivos no: '+error.message); setGuardando(false); onGuardado(); onCerrar(); return }
    }
    // Los que ya estaban pueden haber cambiado de especificos.
    for (const oid of objsFinal.filter(x=>previos.includes(x))) {
      await supabase.from('sesiones_objetivos').update({ movimientos: movsSel[oid]||[] })
        .eq('sesion_id', sesionId).eq('objetivo_id', oid)
    }

    if (aQuitar.length>0) {
      await supabase.from('sesiones_objetivos').delete().eq('sesion_id', sesionId).in('objetivo_id', aQuitar)
    }

    setGuardando(false)
    onGuardado(sesionId)
    onCerrar()
  }

  // Se cargan TODOS para poder pintar el nombre de uno archivado que ya estuviera puesto;
  // lo que no se ofrece es ponerlo de nuevo.
  const selectorObjetivos = eligiendoObj ? (
    <SelectorObjetivos objetivos={objetivosDisp.filter((o:any)=>o.archivado_el == null)} ya={objetivosSel} etiquetas={etiquetas}
      destacados={objsDestacar}
      titulo="Objetivos que cubre la sesión"
      onCerrar={()=>setEligiendoObj(false)}
      onElegir={(ids:string[], movs:Record<string,string[]>)=>{
        tocadoAparte.current = true
        setObjetivosSel(prev=>[...prev, ...ids])
        setMovsSel(prev=>({...prev, ...movs}))
      }}/>
  ) : null

  return (
    /* PINCHAR FUERA YA NO CIERRA. Montando una sesion se pincha fuera sin querer y se
       perdia todo lo hecho. Solo se sale con la X, que avisa si hay cambios sin guardar. */
    <div className="modal-bg">
      {/* Alto fijo, no "lo que ocupe el contenido". Con una sesión vacía el modal se
          encogía a cuatro dedos y la biblioteca, que se abre dentro, salía del mismo
          tamaño: no cabían ni dos filas de ejercicios. Además evita que el modal pegue
          saltos según vas añadiendo. */}
      <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'94vw',maxWidth:1320,height:'min(90vh, 920px)',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,.15)'}}>
        {/* CABECERA */}
        <div style={{padding:'14px 18px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10}}>
          <div style={{flex:1}}>
            {/* QUE SE SEPA ANTES DE TOCAR NADA a dónde va lo que cambies. Es la
                misma pantalla que edita la sesión, y sin decirlo daría miedo —o
                peor, confianza equivocada. */}
            {modoCita && (
              <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,
                           padding:'7px 11px',marginBottom:8,fontSize:11,color:'var(--gd)',lineHeight:1.6}}>
                Cambios <strong>solo para el {cita?.fecha
                  ? new Date(cita.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})
                  : 'día de esta cita'}</strong>. La sesión no se toca: sigue igual para las demás citas.
              </div>
            )}
            {!sesion.id && !sesion.paciente_id && pacientes && (
              <div style={{position:'relative',marginBottom:6}}>
                {pacienteSel ? (() => {
                  const p = pacientes.find((x:any)=>x.id===pacienteSel)
                  return (
                    <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 9px',border:'1px solid var(--bd)',borderRadius:6,background:'var(--bl)',fontSize:13}}>
                      <span style={{flex:1,color:'var(--n)'}}>{p?.nombre} {p?.apellidos}{p?.nombre_clinica?<span style={{color:'var(--gr)',fontSize:12}}> · {p.nombre_clinica}</span>:null}</span>
                      <button title="Quitar el paciente" onClick={()=>{setPacienteSel('');setBusquedaPacModal('')}} style={{color:'var(--gr)',background:'none',border:'none',cursor:'pointer',display:'inline-flex'}}><Ic name="cerrar" size={13}/></button>
                    </div>
                  )
                })() : (
                  <>
                    <input className="input" value={busquedaPacModal} onChange={e=>setBusquedaPacModal(e.target.value)} placeholder="Paciente (opcional · vacío = plantilla)" style={{width:'100%'}}/>
                    {busquedaPacModal && (
                      <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:30,marginTop:4,border:'1px solid var(--bd)',borderRadius:6,maxHeight:200,overflowY:'auto',background:'var(--w)',boxShadow:'0 4px 16px rgba(0,0,0,.1)'}}>
                        {pacientes.filter((p:any)=>contiene(`${p.nombre} ${p.apellidos} ${p.nombre_clinica||''}`, busquedaPacModal)).slice(0,20).map((p:any)=>(
                          <div key={p.id} onClick={()=>{setPacienteSel(p.id);setBusquedaPacModal('')}} style={{padding:'7px 10px',cursor:'pointer',fontSize:13,borderBottom:'1px solid var(--bl)'}} onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                            {p.nombre} {p.apellidos}{p.nombre_clinica?<span style={{color:'var(--gr)',fontSize:12}}> · {p.nombre_clinica}</span>:null}
                          </div>
                        ))}
                        {pacientes.filter((p:any)=>contiene(`${p.nombre} ${p.apellidos} ${p.nombre_clinica||''}`, busquedaPacModal)).length===0 && (
                          <div style={{padding:'7px 10px',fontSize:12,color:'var(--gr)'}}>Sin resultados</div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {/* El nombre es de la sesión, no del día: en modo cita se lee y no se toca. */}
            <input className="input" value={formSesion.nombre} readOnly={modoCita} onChange={e=>setFormSesion(p=>({...p,nombre:e.target.value}))} placeholder="Nombre de la sesión *" style={{fontSize:14,fontWeight:400,border:'none',background:'transparent',padding:'0',outline:'none',width:'100%',cursor:modoCita?'default':undefined,color:modoCita?'var(--gr)':undefined}} autoFocus={!modoCita}/>
            <input className="input" value={formSesion.descripcion} onChange={e=>setFormSesion(p=>({...p,descripcion:e.target.value}))} placeholder="Descripción / motivo (opcional)" style={{fontSize:13,color:'var(--gr)',border:'none',background:'transparent',padding:'0',outline:'none',width:'100%',marginTop:3}}/>
          </div>
          {/* BOTONERA EN ICONOS, como el taller: candado, pulsómetro y formulario u hoja
              libre en botones redondos. El nombre de cada uno, al pasar el dedo. */}
          {(()=>{
            const redondo = (on:boolean, color='var(--n)'): React.CSSProperties => ({ width:36, height:36, borderRadius:'50%', border:0, flexShrink:0, cursor:'pointer',
              display:'grid', placeItems:'center', background:on?color:'#E8E7E1', color:on?'#fff':'var(--gr)' })
            return <>
              {/* CANDADO: se queda en su cita aunque las demás corran (faltas, extras). */}
              {!modoCita && (
                <button type="button" onClick={()=>setFormSesion(p=>({...p,fija:!p.fija}))} style={redondo(!!formSesion.fija)}
                  title={formSesion.fija ? 'Fija en su cita: no corre con las demás. Pulsa para quitar el candado' : 'Corre con las citas. Pulsa para fijarla en su cita (candado)'}>
                  <Ic name="candado" size={16}/>
                </button>
              )}
              {/* PULSÓMETRO: el taller avisa de ponérselo. */}
              {!modoCita && (
                <button type="button" onClick={()=>setFormSesion(p=>({...p,pulsometro:!p.pulsometro}))} style={redondo(!!formSesion.pulsometro, '#B05A5A')}
                  title={formSesion.pulsometro ? 'Con pulsómetro. Pulsa para quitarlo' : 'Sin pulsómetro. Pulsa para marcar que se usa'}>
                  <Ic name="corazon" size={16}/>
                </button>
              )}
              {!modoCita && hojaLeida && (
                <div style={{display:'inline-flex',background:'#E8E7E1',borderRadius:99,padding:3,flexShrink:0}}>
                  {([['Formulario',false,'lista'],['Hoja libre',true,'editar']] as const).map(([n,libre,ic])=>{
                    const on = (hoja!==null)===libre
                    return <button key={n} type="button" aria-pressed={on} title={n}
                      onClick={()=>{
                        if (on) return
                        if (!libre && hoja && (hoja.trazos.length||hoja.pegs.length)
                          && !confirm('Al guardar como formulario se pierde el dibujo de la hoja. ¿Seguir?')) return
                        setHoja(libre ? hojaVacia() : null)
                      }}
                      style={{width:34,height:30,border:0,borderRadius:99,cursor:'pointer',display:'grid',placeItems:'center',
                        background:on?'#fff':'transparent',color:on?'var(--n)':'var(--gr)',boxShadow:on?'0 1px 4px rgba(0,0,0,.08)':'none'}}>
                      <Ic name={ic} size={15}/>
                    </button>
                  })}
                </div>
              )}
            </>
          })()}
          <button className="btn btn-p" onClick={guardarSesion} disabled={guardando}>{guardando?'Guardando…':<><Ic name="guardar" size={13}/> Guardar</>}</button>
          <button className="modal-close" onClick={cerrarSinGuardar} aria-label="Cerrar"><Ic name="cerrar" size={14}/></button>
        </div>

        {/* OBJETIVOS */}
        <div style={{padding:'10px 18px 8px',borderBottom:'1px solid var(--bd)',background:'var(--w)'}}>
          {objetivosDisp.length>0&&(
            <div style={{display:'flex',alignItems:'flex-start',gap:9,flexWrap:'wrap'}}>
              {/* Plegado por defecto: los objetivos se eligen una vez y luego solo
                  estorban mientras montas los ejercicios, que es el trabajo real. */}
              <span title="Objetivos que cubre la sesión" style={{display:'inline-flex',color:'var(--gd)',paddingTop:7}}><Ic name="objetivo" size={15}/></span>
              {/* SIEMPRE A LA VISTA: cada objetivo con su «−» para quitarlo y un «+» para añadir. */}
              {(
              <div style={{display:'flex',gap:6,flexWrap:'wrap',flex:1,minWidth:200,alignItems:'flex-start'}}>
                {/* En MONEDAS, igual que en la ficha del paciente y en las sesiones: un
                    objetivo se reconoce por su foto, y dibujarlo distinto en cada pantalla
                    obliga a reconocerlo otra vez en cada una. */}
                {objetivosSel.map(id=>{
                  const o = objetivosDisp.find((x:any)=>x.id===id)
                  if (!o) return null
                  return (
                    <span key={id} title={(movsSel[id]||[]).length ? `${o.nombre} · ${(movsSel[id]||[]).map((m:string)=>etiquetas.find((x:any)=>x.id===m)?.nombre||m).join(' · ')}` : o.nombre}
                      style={{position:'relative',display:'inline-flex',flexDirection:'column',alignItems:'center',gap:3,width:76}}>
                      <MonedaObjetivo objetivo={o}/>
                      <span className="obj-mon-g">{o.nombre}</span>
                      {/* El «−» encima de la esfera, pequeño: quitar no tiene que gritar. */}
                      <button type="button" title="Quitar este objetivo"
                        onClick={()=>{ tocadoAparte.current = true; setObjetivosSel(prev=>prev.filter(x=>x!==id)) }}
                        style={{position:'absolute',top:-4,right:8,width:18,height:18,borderRadius:'50%',border:'1px solid var(--bd)',background:'#fff',
                          color:'var(--gr)',cursor:'pointer',fontSize:13,lineHeight:1,display:'grid',placeItems:'center',padding:0}}>−</button>
                    </span>
                  )
                })}
                {/* LOS DEL PACIENTE, A MANO. Sus objetivos abiertos que aún no están en la
                    sesión salen apagados detrás: tocar uno lo mete. Así, al crear una sesión,
                    no hay que ir a buscarlos: se eligen de los suyos. */}
                {objsDestacar.filter(id=>!objetivosSel.includes(id)).map(id=>{
                  const o = objetivosDisp.find((x:any)=>x.id===id)
                  if (!o) return null
                  return (
                    <button key={'p'+id} type="button" title={`${o.nombre} · objetivo del paciente: pulsa para añadirlo a la sesión`}
                      onClick={()=>{ tocadoAparte.current = true; setObjetivosSel(prev=>prev.includes(id)?prev:[...prev,id]) }}
                      style={{display:'inline-flex',flexDirection:'column',alignItems:'center',gap:3,width:76,background:'none',border:'none',padding:0,cursor:'pointer',opacity:.4}}>
                      <MonedaObjetivo objetivo={o}/>
                      <span className="obj-mon-g">{o.nombre}</span>
                    </button>
                  )
                })}
                <span style={{display:'inline-flex',flexDirection:'column',alignItems:'center',gap:3,width:76}}>
                  <button type="button" title="Añadir objetivo" onClick={()=>setEligiendoObj(true)}
                    style={{width:42,height:42,borderRadius:'50%',border:'1.5px dashed var(--gm)',background:'#fff',color:'var(--gd)',cursor:'pointer',fontSize:20,lineHeight:1,display:'grid',placeItems:'center'}}>+</button>
                  <span className="obj-mon-g">Añadir</span>
                </span>
              </div>
              )}
            </div>
          )}
        </div>

        <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden',position:'relative'}}>
          {hoja && (
            <div style={{overflowY:'auto',padding:14,flex:1}}>
              <HojaLibre modo="preparar" hoja={hoja} onCambio={h=>{ tocadoAparte.current = true; setHoja(h) }} objetivos={objsPaciente}
                biblioteca={catalogo.map((e:any)=>({ id:e.id, nombre:e.nombre }))}/>
            </div>
          )}
          {/* IZQUIERDA — PARTES. Con hoja libre se esconde pero no se desmonta: si se
              vuelve al formulario, lo que hubiera sigue ahi. */}
          <div style={{overflowY:'auto',padding:14,flex:1,display:hoja?'none':undefined}}>
            <div style={{display:'flex',gap:4,marginBottom:10,flexWrap:'wrap',alignItems:'center'}}>
              {formSesion.partes.map((p:any,i:number)=>{
                const activa = parteActiva===i
                const destino = sobre===i && arrastra!==null && arrastra!==i
                /* EL NOMBRE SE CAMBIA EN LA PROPIA PÍLDORA. En la elegida se escribe
                   directamente; antes se repetía abajo en la franja y quitaba sitio. */
                if (activa) return (
                  <span key={i} className="chip-obj on"
                    style={{borderColor:'var(--g)',background:'var(--g)',color:'#fff',display:'inline-flex',alignItems:'center',gap:4,cursor:'text'}}
                    title="Escribe para cambiar el nombre de la parte">
                    <input value={p.nombre||''} onChange={e=>editarParte({nombre:e.target.value})} placeholder="Nombre"
                      onFocus={e=>e.currentTarget.select()}
                      size={Math.max(6, (p.nombre||'').length)}
                      style={{border:0,background:'transparent',color:'#fff',font:'inherit',padding:0,outline:'none',minWidth:0}}/>
                    <span style={{opacity:.7}}>({(p.ejercicios||[]).length})</span>
                  </span>
                )
                return (
                  <button key={i} onClick={()=>setParteActiva(i)}
                    draggable
                    title="Arrastra para cambiar el orden de las partes"
                    onDragStart={()=>setArrastra(i)}
                    onDragEnd={()=>{setArrastra(null);setSobre(null)}}
                    onDragOver={e=>{e.preventDefault(); if(sobre!==i) setSobre(i)}}
                    onDragLeave={()=>{ if(sobre===i) setSobre(null) }}
                    onDrop={e=>{e.preventDefault(); if(arrastra!==null) moverParte(arrastra,i); setArrastra(null); setSobre(null)}}
                    className={`chip-obj ${activa?'on':''}`}
                    style={{
                      ...(activa?{borderColor:'var(--g)',background:'var(--g)',color:'#fff'}:{}),
                      cursor: arrastra!==null ? 'grabbing' : 'grab',
                      opacity: arrastra===i ? .4 : 1,
                      boxShadow: destino ? 'inset 3px 0 0 var(--gd)' : undefined,
                    }}>
                    {p.nombre} <span style={{opacity:.7}}>({(p.ejercicios||[]).length})</span>
                  </button>
                )
              })}
              <button onClick={()=>{setFormSesion(p=>({...p,partes:[...p.partes,{nombre:`Parte ${p.partes.length+1}`,ejercicios:[]}]}));setParteActiva(formSesion.partes.length)}}
                className="chip-obj" style={{borderStyle:'dashed'}}>
                + Parte
              </button>
            </div>

            {/* NOMBRE Y RECORRIDO DE LA PARTE, en una sola línea. Antes eran tres filas
                —pestañas, nombre y una caja con el modo— y se comían el alto que
                necesitan los ejercicios, que es donde de verdad se trabaja.
                El modo vive en la parte y no en la sesión porque un entrenamiento normal
                mezcla: calentamiento suelto, bloque principal en circuito, accesorios
                sueltos otra vez. */}
            {formSesion.partes.length>0 && (
              <div className="parte-bar">
                <ChipMenu valor={modoParte(parte?.modo).nombre}
                  opciones={MODOS_PARTE.map(m=>m.nombre)}
                  titulo={modoParte(parte?.modo).ayuda}
                  onElegir={n=>{
                    const m = MODOS_PARTE.find(x=>x.nombre===n)
                    if (m) editarParte({modo:m.id})
                  }}/>

                {parte?.modo==='circuito' && (
                  <label className="par-in" title="Cuántas veces se recorre el bloque entero">
                    <input type="number" min={1} value={parte?.vueltas||''} placeholder="—"
                      onChange={e=>editarParte({vueltas:e.target.value})}/>
                    <span>vueltas</span>
                  </label>
                )}


                {parte?.modo==='tiempo' && (
                  <>
                    <ChipMenu valor={(TIPOS_TIEMPO.find(t=>t.id===(parte?.tipo_tiempo||'emom'))||TIPOS_TIEMPO[0]).nombre}
                      opciones={TIPOS_TIEMPO.map(t=>t.nombre)} clase="chip-ed-a"
                      titulo="Qué manda el reloj"
                      onElegir={n=>{
                        const t = TIPOS_TIEMPO.find(x=>x.nombre===n)
                        if (t) editarParte({tipo_tiempo:t.id})
                      }}/>
                    <label className="par-in" title="Duración total del bloque">
                      <input type="number" min={1} value={parte?.minutos||''} placeholder="—"
                        onChange={e=>editarParte({minutos:e.target.value})}/>
                      <span>min</span>
                    </label>
                    {parte?.tipo_tiempo==='intervalos' && (
                      <label className="par-in" title="Segundos de trabajo y de descanso, por ejemplo 40/20">
                        <input value={parte?.intervalo||''} placeholder="40/20" style={{width:52}}
                          onChange={e=>editarParte({intervalo:e.target.value})}/>
                        <span>trab./desc.</span>
                      </label>
                    )}
                  </>
                )}

                {/* LAS PAUSAS, CON SU NOMBRE DELANTE. En superserie y circuito hay dos y no se
                    sabía cuál era cuál: primero la de pasar de un ejercicio al siguiente,
                    luego la de acabar la vuelta. Vacío = sin pausa. */}
                {(parte?.modo==='circuito'||parte?.modo==='superserie') && (
                  <label className="par-in" title="Lo que se descansa al cambiar de ejercicio dentro de la vuelta. Déjalo vacío si se encadenan sin parar.">
                    <span style={{display:'inline-flex',alignItems:'center',gap:3,color:'var(--gr)',marginRight:4}}><Ic name="pausa" size={11}/> Entre ejercicios</span>
                    <input type="number" min={0} step={5} value={parte?.transicion||''} placeholder="0"
                      onChange={e=>editarParte({transicion:e.target.value})}/>
                    <span>s</span>
                  </label>
                )}
                {parte?.modo!=='tiempo' && (
                  <label className="par-in" title="En circuito y superserie es el descanso del recorrido. Con los ejercicios sueltos es el descanso general: vale para todos salvo los que traigan el suyo.">
                    <span style={{display:'inline-flex',alignItems:'center',gap:3,color:'var(--gr)',marginRight:4}}><Ic name="pausa" size={11}/> {parte?.modo==='circuito' ? 'Entre vueltas'
                      : parte?.modo==='superserie' ? 'Al acabar cada vuelta' : 'Entre series'}</span>
                    <input type="number" min={0} step={5} value={parte?.descanso||''} placeholder="0"
                      onChange={e=>editarParte({descanso:e.target.value})}/>
                    <span>s</span>
                  </label>
                )}

                {/* SUPERSERIES: de cuántos en cuántos van. Elegido, las letras se ponen solas. */}
                {parte?.modo==='superserie' && (
                  <span className="par-in" title="Cuántos ejercicios forman cada grupo. Con un número, las letras (A, B…) se ponen solas por orden; «a mano», las eliges tú.">
                    <span style={{color:'var(--gr)',marginRight:4}}>Grupos de</span>
                    {([2,3,4,0] as const).map(n=>{
                      const on = n===0 ? !parte?.tam_grupo : Number(parte?.tam_grupo)===n
                      return <button key={n} type="button" onClick={()=>{
                        setFormSesion(prev=>{
                          const partes=[...prev.partes]; const pa={ ...partes[parteActiva], tam_grupo: n||null }
                          partes[parteActiva]={ ...pa, ejercicios: conLetras(pa, pa.ejercicios||[]) }
                          return { ...prev, partes }
                        })
                      }} style={{border:`1px solid ${on?'var(--gd)':'var(--bd)'}`,background:on?'var(--gl)':'var(--w)',color:on?'var(--gd)':'var(--gr)',
                        borderRadius:99,padding:'2px 9px',fontSize:12,cursor:'pointer',fontFamily:'inherit',marginRight:3,fontWeight:on?600:400}}>{n===0?'a mano':n}</button>
                    })}
                  </span>
                )}

                <div style={{flex:1}}/>
                {formSesion.partes.length>1&&(
                  <button title="Eliminar esta parte" className="ic-acc peligro"
                    onClick={()=>{setFormSesion(prev=>({...prev,partes:prev.partes.filter((_:any,i:number)=>i!==parteActiva)}));setParteActiva(Math.max(0,parteActiva-1))}}>
                    <Ic name="papelera" size={14}/>
                  </button>
                )}
              </div>
            )}

            {(formSesion.partes[parteActiva]?.ejercicios||[]).length===0?(
              <div style={{textAlign:'center',padding:30,color:'var(--gr)',fontSize:13,border:'1.5px dashed var(--bm)',borderRadius:'var(--rl)'}}>
                Sin ejercicios todavía
              </div>
            ):(
              <div className="tabla-ej">
                <div className="ej-cab">
                  <span>Ejercicio</span>
                  <span>Cómo se hace</span>
                  <span className="c">Series</span>
                  <span className="c" title="Repeticiones, segundos o metros: la unidad se elige al lado del número">Cantidad</span>
                  <span className="c">Peso</span>
                  <span className="c">Descanso</span>
                  <span/>
                </div>

                {/* PARA TODOS, ALINEADO CON LAS COLUMNAS. Una fila más, encima de los
                    ejercicios: lo que se pone aquí se pone en todos, cada casilla encima de
                    la suya. Sin rótulos: ya los dice la cabecera. Si no coinciden, «varias». */}
                {(parte?.ejercicios||[]).length>1 && (()=>{
                  const ejs = parte?.ejercicios || []
                  const comun = (f:(x:any)=>string) => { const v = Array.from(new Set<string>(ejs.map(f))); return v.length===1 ? v[0] : null }
                  const todos = (cambio:(x:any)=>any) => setFormSesion(prev=>{
                    const partes=[...prev.partes]; const pa=partes[parteActiva]
                    partes[parteActiva]={ ...pa, ejercicios:(pa.ejercicios||[]).map((x:any)=>({ ...x, ...cambio(x) })) }
                    return { ...prev, partes }
                  })
                  const unidad = (x:any) => { const m = medida(x); return m.includes('segundos') ? 'segundos' : m.includes('metros') ? 'metros' : 'reps' }
                  const uComun = comun(unidad)
                  const campoDe = (u:string) => u==='segundos' ? 'tiempo' : u==='metros' ? 'metros' : 'reps'
                  const cant = uComun ? comun((x:any)=>String(x[campoDe(uComun)]||'')) : null
                  const seriesC = comun((x:any)=>String(x.series||''))
                  const pesoC = comun((x:any)=>String(x.peso||''))
                  const descC = comun((x:any)=>String(x.descanso||''))
                  const recorrido = parte?.modo==='circuito' || parte?.modo==='superserie'
                  return (
                    <div className="ej-row" style={{background:'var(--w)',borderBottom:'1px dashed var(--gm)',padding:'8px 0',margin:'0 0 4px'}}
                      title="Para todos los ejercicios de la parte">
                      <div className="ej-nom" style={{paddingLeft:10,color:'var(--gd)',fontSize:12,display:'flex',alignItems:'center',gap:6}}>
                        <Ic name="lista" size={14}/> <span style={{color:'var(--grl)'}}>{ejs.length}</span>
                      </div>
                      <div className="celda apilada">
                        <ChipMenu valor={comun((x:any)=>x.regimen||'Concéntrico') ?? 'varias'} opciones={nombresEjecucion(cfgTrabajo)}
                          titulo="Cómo se hace, para todos"
                          onElegir={v=>todos((x:any)=>{
                            const seg = ejecucionPorTiempo(cfgTrabajo, v) && !x.tiempo ? segundosDeEjecucion(cfgTrabajo, v) : ''
                            return { regimen:v, ...(seg ? { tiempo: seg } : {}) }
                          })}/>
                        <ChipMenu valor={comun((x:any)=>x.lado||'Bilateral') ?? 'varias'} opciones={[...LADOS]} clase="chip-ed-l"
                          titulo="Lado, para todos" onElegir={v=>todos(()=>({ lado:v }))}/>
                        <ChipMenu valor={comun((x:any)=>x.capacidad||'') || undefined} opciones={nombresCapacidad(cfgTrabajo)}
                          clase="chip-ed-a" vacio={comun((x:any)=>x.capacidad||'')===null ? 'varias' : 'Capacidad'} titulo="Capacidad, para todos"
                          onElegir={cap=>todos((x:any)=>{
                            const sug=sugerenciaCapacidad(cfgTrabajo, cap, medida(x).includes('segundos'))
                            return { capacidad:cap, ...(sug.reps?{reps:sug.reps}:{}), ...(sug.tiempo?{tiempo:sug.tiempo}:{}) }
                          })}/>
                      </div>
                      <div className="celda">
                        {parte?.modo==='circuito'
                          ? <span className="c" style={{color:'var(--gr)',fontSize:12}}>{parte?.vueltas || '—'}</span>
                          : <input type="number" className="c" min={1} value={seriesC ?? ''} placeholder={seriesC===null?'var.':'—'} title="Series, para todos"
                              onChange={e=>{ const v=e.target.value; todos(()=>({ series:v })) }}/>}
                      </div>
                      <div className="celda cant">
                        <input type="number" className="c" min={0} value={cant ?? ''} placeholder={uComun ? (cant===null?'var.':'—') : '—'} disabled={!uComun}
                          title="Cantidad, para todos" onChange={e=>{ const v=e.target.value; const c=campoDe(uComun!); todos(()=>({ [c]:v })) }}/>
                        <select value={uComun || ''} title="Unidad, para todos"
                          onChange={e=>{ const v=e.target.value as any; if (!v) return
                            todos((x:any)=>{ const bib=catalogo.find((c:any)=>c.id===x.ejercicio_id); return { tipo_medida: idMedida(partesMedida(x.tipo_medida||bib?.tipo_medida||'peso_reps').carga, v) } }) }}>
                          {!uComun && <option value="">var.</option>}
                          <option value="reps">reps</option><option value="segundos">seg</option><option value="metros">m</option>
                        </select>
                      </div>
                      <div className="celda">
                        <input type="number" className="c" min={0} value={pesoC ?? ''} placeholder={pesoC===null?'var.':'kg'} title="Peso, para todos (los que van con kilos)"
                          onChange={e=>{ const v=e.target.value; todos((x:any)=>medida(x).includes('peso') ? { peso:v } : {}) }}/>
                      </div>
                      <div className="celda">
                        {recorrido
                          ? <span className="c" style={{color:'var(--gr)',fontSize:12}} title="En circuito y superserie manda el descanso de la parte">{parte?.descanso || '—'}</span>
                          : <input type="number" className="c" min={0} step={5} value={descC ?? ''} placeholder={descC===null?'var.':'s'} title="Descanso, para todos"
                              onChange={e=>{ const v=e.target.value; todos(()=>({ descanso:v, descanso_manual:true })) }}/>}
                      </div>
                      <div/>
                    </div>
                  )
                })()}

                {(formSesion.partes[parteActiva]?.ejercicios||[]).map((ej:any,ei:number)=>{
                  const med = medida(ej)
                  const destinoEj = sobreEj===ei && arrEj!==null && arrEj!==ei
                  return (
                  <div key={ei} className="ej-row"
                    onDragOver={e=>{ if(arrEj===null) return; e.preventDefault(); if(sobreEj!==ei) setSobreEj(ei) }}
                    onDragLeave={()=>{ if(sobreEj===ei) setSobreEj(null) }}
                    onDrop={e=>{ if(arrEj===null) return; e.preventDefault(); moverEjercicio(arrEj,ei); setArrEj(null); setSobreEj(null) }}
                    style={{opacity: arrEj===ei ? .4 : 1,
                            boxShadow: destinoEj ? 'inset 3px 0 0 var(--gd)' : undefined}}>
                    <div className="ej-nom">
                      {/* La manilla es lo único arrastrable: con la fila entera
                          `draggable`, seleccionar un número en un input se vuelve
                          un arrastre y no se puede ni corregir un peso. */}
                      <span draggable title="Arrastra para cambiar el orden"
                        onDragStart={()=>setArrEj(ei)}
                        onDragEnd={()=>{setArrEj(null);setSobreEj(null)}}
                        onMouseOver={e=>(e.currentTarget as HTMLElement).style.color='var(--g)'}
                        onMouseOut={e=>(e.currentTarget as HTMLElement).style.color='var(--grl)'}
                        style={{cursor:arrEj!==null?'grabbing':'grab',color:'var(--grl)',fontSize:17,
                                lineHeight:1,flexShrink:0,userSelect:'none',padding:'2px 3px'}}>⠿</span>
                      {parte?.modo==='superserie' && (
                        <select value={ej.grupo||'A'} disabled={!!parte?.tam_grupo} onChange={e=>editarEjercicio(ei,{grupo:e.target.value})}
                          style={{width:44,textAlign:'center',fontWeight:600,color:'var(--gd)',flexShrink:0}}
                          title="Los ejercicios del mismo grupo se hacen seguidos">
                          {['A','B','C','D','E'].map(g=><option key={g} value={g}>{g}</option>)}
                        </select>
                      )}
                      {ej.imagen_url
                        ? <img src={ej.imagen_url} alt={ej.nombre} className="ej-img"/>
                        : <div className="ej-img ej-img-no"><Ic name="fuerza" size={26}/></div>}
                      {/* Nombre y variante centrados contra la foto, y el nombre parte
                          en varias líneas antes que estrujar la columna de datos. */}
                      <div style={{minWidth:0}}>
                        <div className="ej-txt">{ej.nombre}</div>
                        {/* AVISA, NO IMPIDE. Hay motivos para prescribirlo igual —carga
                            baja, rango parcial— y un bloqueo duro se esquiva fuera de la
                            app, que es peor porque entonces no queda registrado. */}
                        {(() => {
                          const bib = catalogo.find((e:any)=>e.id===ej.ejercicio_id)
                          const m = bib ? motivoDe(bib, contra, etiquetas) : null
                          if (!m) return null
                          return (
                            <div className="ej-sub">
                              <span style={{fontSize:12,color:'#8A6410',background:'var(--ambl)',borderRadius:99,padding:'1px 8px',display:'inline-flex',alignItems:'center',gap:4}}
                                title={`Desaconsejado por ${m.test}, positivo el ${m.fecha}${m.otros>0?`. Y por ${m.otros} etiqueta${m.otros>1?'s':''} más`:''}`}>
                                <Ic name="alerta" size={10}/> Desaconsejado · {m.texto}
                              </span>
                            </div>
                          )
                        })()}
                        {/* La variante SÍ la decide la sesión. El ejercicio a secas es su
                            forma estándar y la biblioteca solo dice qué variantes existen;
                            cuál toca hoy —unilateral, alterno, unipodal— es prescripción, y
                            se elige aquí. Por eso es `.chip-ed` y no `.badge`, que en este
                            sistema significa "esto no se toca".

                            Si el ejercicio no tiene ninguna variante en la biblioteca no se
                            pinta nada: un desplegable con una sola opción vacía no informa,
                            solo ocupa. La única excepción es que la sesión ya tenga escrita
                            una variante que la biblioteca ya no ofrece —se quitó después de
                            montar la sesión—: entonces se enseña igual, y se puede quitar.
                            Esconderla la dejaría guardándose sin que nadie la vea. */}
                        {/* LOS OBJETIVOS DE ESTE EJERCICIO. Todos los de la sesión en
                            pequeño: en color los que trabaja, apagados los que no. Pulsar
                            cambia. Sale sugerido por etiquetas; tocarlo lo deja a mano. */}
                        {/* COMPACTO: solo los que trabaja, en pequeno, y "editar" abre la lista
                            entera. Antes salian todos los de la sesion en cada fila, grandes, y
                            cada ejercicio ocupaba tres lineas solo de objetivos. */}
                        {objsSesion.length > 0 && objsAbiertos !== ei && (() => {
                          const suyos = objsSesion.filter((o:any)=>objsDeEj(ej).includes(o.id))
                          return (
                            <div className="ej-sub" style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                              {suyos.map((o:any)=>(
                                <span key={o.id} title={o.nombre} className="obj-mini">
                                  <MonedaObjetivo objetivo={o} tam="mini" titulo=""/>
                                  <span>{o.nombre}</span>
                                </span>
                              ))}
                              {suyos.length===0 && <span style={{fontSize:11,color:'var(--grl)'}}>Sin objetivo</span>}
                              {/* Los que cumplen solo una comprobacion: se avisan, no se enganchan solos. */}
                              {!modoCita && (()=>{ const n = objsSesion.filter((o:any)=>!suyos.includes(o.id) && sugeridoDe(ej,o)).length
                                return n>0 ? <button type="button" className="obj-ed" style={{color:'#7A5800'}} onClick={()=>setObjsAbiertos(ei)} title="Cumplen solo una de las dos comprobaciones: confírmalos">+{n} sugerido{n>1?'s':''}</button> : null })()}
                              {!modoCita && <button type="button" className="obj-ed" onClick={()=>setObjsAbiertos(ei)} title="Elegir qué objetivos trabaja">editar</button>}
                            </div>
                          )
                        })()}
                        {objsSesion.length > 0 && objsAbiertos === ei && (() => {
                          const suyos = objsDeEj(ej)
                          return (
                            <div className="ej-sub" style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                              {objsSesion.map((o:any)=>{
                                const on = suyos.includes(o.id)
                                const sug = !on && sugeridoDe(ej, o)
                                return (
                                  <button key={o.id} type="button" disabled={modoCita}
                                    title={`${o.nombre} · ${on ? 'lo trabaja' : sug ? 'sugerido: cumple solo una de las dos comprobaciones (qué mueve / para qué sirve)' : 'no lo trabaja'}${modoCita ? '' : ' · pulsa para cambiar'}${on && !ej.objetivos_manual ? ' (por anatomía y lo que admite)' : ''}`}
                                    onClick={()=>editarEjercicio(ei,{ objetivos_manual:true,
                                      objetivos: on ? suyos.filter((x:string)=>x!==o.id) : [...suyos, o.id] })}
                                    // CON NOMBRE: solo la esfera no decía cuál era —sin foto todas son
                                    // la misma bola verde con una inicial—. Encendido = lo trabaja.
                                    style={{display:'inline-flex',alignItems:'center',gap:5,maxWidth:190,
                                      padding:'2px 9px 2px 2px',borderRadius:99,fontFamily:'inherit',fontSize:11,
                                      cursor:modoCita?'default':'pointer',transition:'all .12s',
                                      border:on?'1px solid var(--gm)':sug?'1px dashed var(--amb)':'1px dashed var(--bd)',
                                      background:on?'var(--gl)':sug?'var(--ambl)':'transparent',
                                      color:on?'var(--gd)':sug?'#7A5800':'var(--grl)'}}>
                                    <span style={{lineHeight:0,opacity:on?1:.3,filter:on?'none':'grayscale(1)',flexShrink:0}}>
                                      <MonedaObjetivo objetivo={o} tam="mini" titulo=""/>
                                    </span>
                                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.nombre}</span>
                                  </button>
                                )
                              })}
                              <button type="button" className="obj-ed" onClick={()=>setObjsAbiertos(null)}>listo</button>
                            </div>
                          )
                        })()}
                        {(() => {
                          const vars = variantesDe(ej)
                          if (vars.length === 0 && !ej.variante) return null
                          return (
                            <div className="ej-sub">
                              <SelectorVariante variantes={vars} valor={ej.variante||''}
                                imagenBase={ej.imagen_url}
                                onElegir={v=>editarEjercicio(ei,{variante:v})}/>
                            </div>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Régimen y capacidad juntos: los dos dicen cómo se trabaja,
                        no cuánto. Van antes de los números por eso mismo. */}
                    <div className="celda apilada" data-l="Cómo se hace">
                      <ChipMenu valor={ej.regimen||'Concéntrico'} opciones={nombresEjecucion(cfgTrabajo)}
                        titulo="Cómo trabaja el músculo: concéntrico al acortarse, excéntrico al frenar, isométrico sin moverse"
                        onElegir={v=>{
                          // Pasar a una ejecución por tiempo (estiramiento, isométrico) pone
                          // los segundos de partida si no había (estiramientos, 60 s).
                          const seg = ejecucionPorTiempo(cfgTrabajo, v) && !ej.tiempo ? segundosDeEjecucion(cfgTrabajo, v) : ''
                          editarEjercicio(ei,{regimen:v, ...(seg ? { tiempo: seg } : {})})
                        }}/>
                      {/* LATERALIDAD, como la ejecucion: se prescribe aqui y el taller la ensena.
                          No iba en el editor y solo se podia poner desde el mapa de calor. */}
                      <ChipMenu valor={ej.lado||'Bilateral'} opciones={[...LADOS]} clase="chip-ed-l"
                        titulo="Bilateral, a un lado (unilateral) o alternando lados"
                        onElegir={v=>editarEjercicio(ei,{lado:v})}/>
                      <ChipMenu valor={ej.capacidad} opciones={nombresCapacidad(cfgTrabajo)}
                        clase="chip-ed-a" vacio="Capacidad" titulo="Capacidad que se entrena"
                        onElegir={cap=>{
                          // Lo sugerido sale de Ajustes › Entrenador, como en el mapa de calor.
                          const sug=sugerenciaCapacidad(cfgTrabajo, cap, med.includes('segundos'))
                          const rep=sug.reps, desc=sug.descanso
                          // El descanso sugerido se recalcula mientras no lo hayas
                          // tocado tú. Antes solo miraba si estaba vacío, así que en
                          // cuanto se autocompletaba una vez ya no volvía a cambiar.
                          //
                          // Y NO se autocompleta si la parte tiene descanso general:
                          // rellenar aquí un número dejaba el general sin efecto para
                          // siempre y sin que se notara, que es justo lo que pasaba.
                          const ponDesc = desc && !ej.descanso_manual && !parte?.descanso
                          editarEjercicio(ei,{capacidad:cap,...(rep?{reps:rep}:{}),...(sug.tiempo?{tiempo:sug.tiempo}:{}),...(ponDesc?{descanso:desc}:{})})
                        }}/>
                    </div>

                    {/* En CIRCUITO no hay series por ejercicio: las vueltas de la parte
                        son las series de todos. Tenerlo editable invitaba a poner un 3
                        aquí y un 1 allá dentro del mismo circuito, que no significa
                        nada: o das la vuelta entera o no la das. */}
                    {parte?.modo === 'circuito' ? (
                      <div className="celda" data-l="Series">
                        <span className="c" style={{color:'var(--gr)',fontSize:12}} title="En circuito manda el número de vueltas de la parte">
                          {parte?.vueltas || '—'}
                        </span>
                      </div>
                    ) : (
                      <div className="celda" data-l="Series">
                        <input type="number" className="c" value={ej.series||''} placeholder="3"
                          title={parte?.modo==='superserie'
                            ? 'Series del grupo: cambiarlas aquí las cambia en todo el grupo'
                            : 'Cuántas veces se repite el ejercicio'}
                          onChange={e=>editarEjercicio(ei,{series:e.target.value})}/>
                      </div>
                    )}

                    {/* Una sola columna: repeticiones o duración, según cómo se mida
                        el ejercicio en la biblioteca. Nunca las dos. */}
                    <div className="celda cant" data-l={med.includes('segundos')?'Duración · s':med.includes('metros')?'Distancia · m':'Repeticiones'}>
                      {med.includes('segundos')
                        ? <input type="number" className="c" value={ej.tiempo||''} placeholder="seg"
                            title="Lo que dura cada serie, en segundos"
                            onChange={e=>editarEjercicio(ei,{tiempo:e.target.value})}/>
                        : med.includes('metros')
                        ? <input type="number" className="c" value={ej.metros||''} placeholder="m"
                            title="Metros en cada serie"
                            onChange={e=>editarEjercicio(ei,{metros:e.target.value})}/>
                        : <input type="number" className="c" value={ej.reps||''} placeholder="10"
                            title="Repeticiones en cada serie"
                            onChange={e=>{
                              const val=e.target.value
                              const cap=capacidadPorReps(val)
                              editarEjercicio(ei,{reps:val,...(cap?{capacidad:cap}:{})})
                            }}/>}
                      {/* LA UNIDAD, pegada al número y cambiable: reps, seg o m. */}
                      {(()=>{
                        const bib = catalogo.find((x:any)=>x.id===ej.ejercicio_id)
                        const { carga } = partesMedida(ej.tipo_medida || bib?.tipo_medida || 'peso_reps')
                        const actual = med.includes('segundos') ? 'segundos' : med.includes('metros') ? 'metros' : 'reps'
                        return (
                          <select value={actual} title="Por repeticiones, por tiempo o por distancia"
                            onChange={e=>editarEjercicio(ei,{tipo_medida: idMedida(carga, e.target.value as any)})}>
                            <option value="reps">reps</option><option value="segundos">seg</option><option value="metros">m</option>
                          </select>
                        )
                      })()}
                    </div>

                    <div className="celda" data-l={med.includes('banda')?'Banda':'Peso · kg'}>
                      {med.includes('peso')
                        ? <input type="number" className="c" value={ej.peso||''} placeholder="kg"
                            title="Carga en kilos"
                            onChange={e=>editarEjercicio(ei,{peso:e.target.value})}/>
                        : med.includes('banda')
                        ? <select className="c" value={ej.banda||''} title="Con qué banda"
                            style={{borderLeft:`4px solid ${COLOR_BANDA[ej.banda]||'var(--bd)'}`}}
                            onChange={e=>editarEjercicio(ei,{banda:e.target.value})}>
                            <option value="">—</option>
                            {bandas.map(b=><option key={b} value={b}>{b}</option>)}
                          </select>
                        : <span className="vacio" title="Peso corporal: no lleva carga">—</span>}
                    </div>

                    {/* El descanso propio del ejercicio solo manda cuando los ejercicios
                        van sueltos. En circuito y en superserie el que cuenta es el de
                        la parte —entre vueltas o tras cada vuelta del grupo—, y tener
                        aquí otro número editable era invitar a escribir dos descansos
                        que se contradicen. */}
                    {(parte?.modo==='circuito'||parte?.modo==='superserie') ? (
                      <div className="celda" data-l="Descanso · s">
                        <span className="c" style={{color:'var(--gr)',fontSize:12}}
                          title={parte?.modo==='circuito' ? 'En circuito manda el descanso entre vueltas de la parte' : 'En superserie manda el descanso tras cada vuelta del grupo'}>
                          {parte?.descanso || '—'}
                        </span>
                      </div>
                    ) : (
                      <div className="celda" data-l="Descanso · s">
                        {/* Vacío = hereda el general de la parte, que se ve como
                            marca de agua. Escribir aquí lo pisa solo para este
                            ejercicio: el peso muerto puede pedir tres minutos donde
                            el resto lleva minuto y medio. */}
                        <input type="number" step={5} className="c" value={ej.descanso||''}
                          placeholder={parte?.descanso ? String(parte.descanso) : '+'}
                          style={!ej.descanso&&parte?.descanso ? {color:'var(--grl)'} : undefined}
                          title={parte?.descanso
                            ? `Vacío hereda el general de la parte: ${parte.descanso} s. Escribe aquí solo si este ejercicio necesita otro, y bórralo para volver al general.`
                            : 'Descanso entre series, en segundos'}
                          onChange={e=>editarEjercicio(ei,{descanso:e.target.value,descanso_manual:true})}/>
                        {/* Marca de que ese número es suyo y no el heredado: sin ella
                            no se distingue un 90 propio de un 90 que viene de la parte. */}
                        {ej.descanso&&parte?.descanso&&String(ej.descanso)!==String(parte.descanso)&&(
                          <span title="Descanso propio de este ejercicio" style={{fontSize:9,color:'var(--g)',marginLeft:2}}>•</span>
                        )}
                      </div>
                    )}

                    {/* CAMBIAR POR UNO PARECIDO: abre la biblioteca con los que trabajan lo mismo
                        (músculo y patrón): un ejercicio de abducción propone otros de abducción. */}
                    {/* Las dos acciones en UNA celda: sueltas, la segunda caía a otra fila. */}
                    <div className="acc">
                      <button title="Cambiar por uno parecido" className="ic-acc"
                        onClick={()=>{ setSelBib([]); setCambiarEj(ei); setAbrirBib(true) }}><Ic name="cambio" size={15}/></button>
                      <button title="Quitar el ejercicio" className="ic-acc peligro"
                        onClick={()=>quitarEjercicio(parteActiva,ei)}><Ic name="papelera" size={15}/></button>
                    </div>

                    {/* La nota, entera y debajo de todo. Metida entre los campos se
                        quedaba en un hueco estrecho donde no cabía nada. */}
                    {/* PLEGADA SI ESTA VACIA. Una linea de nota vacia en cada ejercicio doblaba
                        la altura de la lista. Con texto se ve siempre. */}
                    {(ej.nota || notasAbiertas.has(ei)) ? (
                      <div className="ej-nota">
                        <span>Nota</span>
                        <input value={ej.nota||''} autoFocus={!ej.nota} onChange={e=>editarEjercicio(ei,{nota:e.target.value})}
                          placeholder="Lo que haya que recordar de este ejercicio"/>
                      </div>
                    ) : (
                      <div className="ej-nota">
                        <button type="button" className="obj-ed" onClick={()=>setNotasAbiertas(p=>new Set(p).add(ei))}>+ Nota</button>
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            )}

            {/* La biblioteca se abre a ráfagas: metes cuatro ejercicios y luego pasas
                el rato ajustando series. Como panel fijo se comía un tercio del ancho
                todo el tiempo para algo que usas veinte segundos. */}
            {formSesion.partes.length>0 && (
              <button className="btn btn-s" style={{marginTop:12,width:'100%',justifyContent:'center'}}
                onClick={()=>{setSelBib([]);setAbrirBib(true)}}>
                <Ic name="mas" size={13}/> Añadir ejercicios desde la biblioteca
              </button>
            )}
          </div>

          {abrirBib && (
            <div className="capa-bib">
              <div className="capa-bib-h">
                <span style={{fontSize:14,color:'var(--n)',flex:1}}>
                  Biblioteca
                  <span style={{fontSize:13,color:'var(--gr)'}}>{cambiarEj!==null
                    ? <> · cambiar «{(parte?.ejercicios||[])[cambiarEj]?.nombre}» por…</>
                    : <> · añadir a {parte?.nombre || 'la parte'}</>}</span>
                </span>
                {cambiarEj===null && <button className="btn btn-p" disabled={selBib.length===0}
                  style={selBib.length===0?{opacity:.5,cursor:'default'}:undefined}
                  onClick={()=>{
                    // De golpe y en el orden en que se marcaron, no el del catálogo.
                    selBib.forEach(id=>{
                      const e = catalogo.find((x:any)=>x.id===id)
                      if (e) addEjercicio(e)
                    })
                    setSelBib([]); setAbrirBib(false)
                  }}>
                  <Ic name="check" size={13}/> Añadir{selBib.length>0?` ${selBib.length}`:''}
                </button>}
                <button className="modal-close" aria-label="Cerrar biblioteca"
                  onClick={()=>{setSelBib([]);setAbrirBib(false);setCambiarEj(null)}}><Ic name="cerrar" size={16}/></button>
              </div>
              <div className="capa-bib-c">
                {/* El creado se añade solo a la parte, y la capa sigue abierta para
                    seguir eligiendo. Sin este aviso parecería que no ha pasado nada:
                    la tabla de la sesión está detrás y no se ve. */}
                {ultimoCreado && (
                  <div style={{marginBottom:10,padding:'7px 11px',borderRadius:'var(--r)',background:'var(--gl)',color:'var(--gd)',fontSize:12,display:'flex',alignItems:'center',gap:6}}>
                    <Ic name="ok" size={12}/>
                    &laquo;{ultimoCreado}&raquo; creado y a&ntilde;adido a {parte?.nombre || 'la parte'}.
                    Te falta rellenarlo en Biblioteca &rarr; Por completar.
                  </div>
                )}
                <ExploradorEjercicios
                  ejercicios={catalogo}
                  etiquetas={etiquetas}
                  seleccion={selBib}
                  onAlternar={(e:any)=>{
                    // Cambiando uno: se elige y se cambia, sin marcar varios.
                    if (cambiarEj!==null) { reemplazarEjercicio(cambiarEj, e); setCambiarEj(null); setAbrirBib(false); return }
                    setSelBib(prev=>prev.includes(e.id)?prev.filter(x=>x!==e.id):[...prev,e.id])
                  }}
                  sugeridos={cambiarEj!==null ? (()=>{
                    const actual = (parte?.ejercicios||[])[cambiarEj]
                    const base = catalogo.find((x:any)=>x.id===actual?.ejercicio_id)
                    if (!base) return undefined
                    /* «IGUALES»: los que hacen el MISMO MOVIMIENTO (sus etiquetas de
                       movimiento, p. ej. abducción de cadera), variantes de su familia
                       incluidas. Antes salían los parecidos por músculo, que eran muchos y
                       no siempre el mismo gesto. Si no tiene movimiento etiquetado, los parecidos. */
                    const movs = (base.etiquetas||[]).filter((id:string)=>{ const et=etiquetas.find((x:any)=>x.id===id); return et && categoriaDe(etiquetas, et)==='movimiento' })
                    const iguales = movs.length ? catalogo
                      .filter((x:any)=>x.id!==base.id && movs.every((m:string)=>(x.etiquetas||[]).includes(m)))
                      .map((x:any)=>({ x, n:(x.etiquetas||[]).filter((id:string)=>(base.etiquetas||[]).includes(id)).length }))
                      .sort((a:any,b:any)=>b.n-a.n).slice(0,24).map((o:any)=>o.x) : []
                    return iguales.length
                      ? { titulo:`Hacen el mismo movimiento que ${actual.nombre}`, items: iguales }
                      : { titulo:`Parecidos a ${actual.nombre}`, items: similaresA(catalogo, base, 10, etiquetas).filter((x:any)=>x.id!==base.id) }
                  })() : ultimo ? { titulo:`Parecidos a ${ultimo.nombre}`, items:similares } : undefined}
                  soloSugeridos={cambiarEj!==null}
                  objetivos={objsSesion}
                  idsObjetivosDe={objsSesion.length ? (e:any)=>objsDeEj({ ejercicio_id: e.id, nombre: e.nombre }) : undefined}
                  objetivosDe={objsSesion.length ? (e:any)=>objsDeEj({ ejercicio_id: e.id, nombre: e.nombre })
                    .map((id:string)=>(objsSesion.find((o:any)=>o.id===id) as any)?.nombre).filter(Boolean) : undefined}
                  onCrear={crearYAnadir}
                />
              </div>
            </div>
          )}

        </div>
      </div>
    {selectorObjetivos}
    </div>
  )
}
