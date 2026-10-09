'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { modoParte, textoModo, descansoDeParte, transicionDeParte, descansoEfectivo } from '@/lib/sesiones'
import { textoDescanso } from '@/lib/capacidades'
import { alternarItem, itemMarcado } from '@/lib/ejecucion'
import { guardarVias, abrirObjetivo, resolverVia } from '@/lib/objetivos'
import { pacientesDelDia, horasDelDia, horaActual } from '@/lib/taller'
import { rutaDeAsignacion } from '@/lib/asignarCita'
import { MOTIVOS_CAMBIO, nombreMotivo, cambiosDeCitas, registrarCambio, type CambioSesion } from '@/lib/cambioSesion'
import { useRouter } from 'next/navigation'
import { Ic } from '@/lib/icons'
import { hoyISO } from '@/lib/fechas'
import { aplicarAjustes } from '@/lib/ajustesCita'
import { testsPorDia } from '@/lib/evaluaciones'
import { testsPorConfirmar, confirmarAMano } from '@/lib/mantenimiento'
import { registrarResultadoTest } from '@/lib/tests'
import ModalRealizarTest, { ladoVacio } from '@/components/ModalRealizarTest'
import RejillaParte from './RejillaParte'
import ExploradorEjercicios from '@/components/ExploradorEjercicios'
import { traerTodo } from '@/lib/paginar'
import IconosContexto from './IconosContexto'
import HojaLibre from '@/components/HojaLibre'
import { leerHoja, registrosDeHoja, type Hoja } from '@/lib/hoja'

// Ver lib/fechas: por UTC esto daba ayer entre las 00:00 y las 02:00.
const hoy = hoyISO

export default function ModoClase() {
  const [fecha, setFecha] = useState(hoy())
  const [seleccion, setSeleccion] = useState<any[]>([])
  const [activo, setActivo] = useState<string>('')

  /**
   * HOJA LIBRE. Una sesion dibujada no tiene partes: lo que se apunta son sus casillas.
   *
   * La hoja se lee por sesion y no viaja en `seleccion`: al cambiar la sesion de un
   * paciente desde aqui se rehace su fila por otro camino, y asi no hay que acordarse
   * de traerla en los dos. `undefined` = aun no leida; `null` = sesion normal.
   *
   * Lo apuntado se guarda tambien en sessionStorage mientras se escribe: si se recarga
   * la pagina a media clase no se pierde. A la base va al "Guardar y finalizar".
   */
  /**
   * BLOQUES PLEGADOS. Plegar lo ya hecho deja a la vista lo que queda, que es lo que
   * se mira en mitad de la clase. Por paciente y parte: plegar el calentamiento de uno
   * no pliega el de otro. No se guarda: al recargar vuelven abiertos, que es lo seguro.
   */
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set())
  const alternarPlegada = (k: string) => setPlegadas(prev => {
    const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n
  })
  /**
   * EJERCICIOS QUE NO SE HICIERON. Se parte de que la sesion se hace entera: lo que
   * se marca es la excepcion, no cada ejercicio hecho. Por paciente, sesion y dia; va
   * a sessionStorage para que recargar a media clase no lo pierda.
   */
  const [noHechos, setNoHechos] = useState<Record<string, number[]>>({})
  const claveNoHecho = (pid: string, sid: string) => `sie-nohecho:${pid}:${sid}:${fecha}`
  const leerNoHechos = (pid: string, sid: string): number[] => {
    const k = claveNoHecho(pid, sid)
    if (k in noHechos) return noHechos[k]
    try { return JSON.parse(sessionStorage.getItem(k) || '[]') } catch { return [] }
  }
  function ponerNoHechos(pid: string, sid: string, lista: number[]) {
    const k = claveNoHecho(pid, sid)
    try { sessionStorage.setItem(k, JSON.stringify(lista)) } catch {}
    setNoHechos(prev => ({ ...prev, [k]: lista }))
  }
  /**
   * Marcar "no lo hizo" borra lo que hubiera apuntado de ese ejercicio hoy: si no se
   * hizo, sus cifras no pueden llegar a la progresion. Desmarcar no recupera nada.
   */
  async function alternarNoHecho(pid: string, sid: string, ei: number) {
    const lista = leerNoHechos(pid, sid)
    if (lista.includes(ei)) { ponerNoHechos(pid, sid, lista.filter(x => x !== ei)); return }
    ponerNoHechos(pid, sid, [...lista, ei])
    const key = `${pid}_${ei}`
    if (timers.current[key]) { clearTimeout(timers.current[key]); delete timers.current[key]; setPendientes(p=>Math.max(0,p-1)) }
    const ej = seleccion.find(s=>s.paciente.id===pid)?.datos?.[ei]
    if (!ej) return
    let q = supabase.from('registros_ejercicio').delete()
      .eq('paciente_id', pid).eq('sesion_id', sid).eq('finalizado', false)
    q = ej.ejercicio_id ? q.eq('ejercicio_id', ej.ejercicio_id) : q.is('ejercicio_id', null).eq('ejercicio_nombre', ej.nombre)
    q = ej.variante ? q.eq('variante', ej.variante) : q.is('variante', null)
    await q
    setSeleccion(prev => prev.map(s => {
      if (s.paciente.id !== pid) return s
      const datos = [...s.datos]; if (datos[ei]) datos[ei] = { ...datos[ei], guardado: false }
      return { ...s, datos }
    }))
  }
  const [hojas, setHojas] = useState<Record<string, Hoja | null>>({})
  const [hechosHoja, setHechosHoja] = useState<Record<string, Record<string, string>>>({})
  const claveHechos = (pid: string, sid: string) => `sie-hoja-hechos:${pid}:${sid}:${fecha}`
  const timers = useRef<Record<string, any>>({})
  const restaurado = useRef(false)
  // Un `ref` no vuelve a disparar los efectos al cambiar, así que la carga automática
  // necesita saberlo por estado: si no, al terminar la restauración no se enteraba nadie y
  // el taller se quedaba vacío hasta tocar el selector.
  const [listo, setListo] = useState(false)
  const SKEY = 'taller_clase'
  const [objetivosLib, setObjetivosLib] = useState<any[]>([])
  const [objsPorPaciente, setObjsPorPaciente] = useState<Record<string,any[]>>({})
  const [ctxPorPaciente, setCtxPorPaciente] = useState<Record<string,any>>({})
  /**
   * LO QUE HAY QUE MEDIRLE HOY.
   *
   * Sale de la evaluacion de su ciclo: se programa semanas antes desde la ficha y
   * tiene que llegar a la sala solo, igual que la sesion. Si hubiera que acordarse
   * de mirarlo, no serviria de nada haberlo programado.
   */
  const [testsHoy, setTestsHoy] = useState<Record<string, any[]>>({})
  /** Logrados que toca confirmar y no tienen test: se miran y se dicen. */
  const [sinTest, setSinTest] = useState<Record<string, any[]>>({})
  /** El arbol entero, para cruzar zona de molestia con etiqueta de ejercicio. */
  const [etiquetas, setEtiquetas] = useState<any[]>([])
  // CAMBIAR UN EJERCICIO SOLO HOY (material ocupado, la sala no da...). Que ficha y
  // que hueco se esta cambiando; el catalogo se lee la primera vez que hace falta.
  const [sustituyendo, setSustituyendo] = useState<{ pid: string, i: number } | null>(null)
  const [catalogoEj, setCatalogoEj] = useState<any[]>([])
  const [testEnCurso, setTestEnCurso] = useState<any>(null)
  const [guardandoTest, setGuardandoTest] = useState(false)
  const [listaTests, setListaTests] = useState(false)
  const [objsDeSesion, setObjsDeSesion] = useState<Record<string,any[]>>({})

  async function cargarObjsDeSesion(sesionId: string) {
    if (!sesionId) return
    const { data: rel } = await supabase.from('sesiones_objetivos')
      .select('objetivo_id').eq('sesion_id', sesionId)
    const ids = (rel||[]).map((r:any)=>r.objetivo_id).filter(Boolean)
    if (ids.length===0) { setObjsDeSesion(prev => ({ ...prev, [sesionId]: [] })); return }
    const { data: objs } = await supabase.from('objetivos')
      .select('id,nombre,imagen_url').in('id', ids)
    setObjsDeSesion(prev => ({ ...prev, [sesionId]: objs||[] }))
  }
  /**
   * Los cambios de sesión ya registrados en las citas de esta franja, por cita.
   *
   * Se leen al traer la franja, no se guardan en la fila del paciente: el cambio lo pudo
   * hacer otro compañero en otro ordenador hace diez minutos, y esta pantalla se abre
   * veinte veces al día.
   */
  const [cambios, setCambios] = useState<Record<string, CambioSesion>>({})
  /**
   * El panel de "¿por qué cambias la sesión?" mientras está abierto.
   *
   * Guarda a quién, qué tenía puesto y a dónde iba a ir a buscar la nueva, porque el
   * motivo se pide ANTES de salir del taller. Es donde está el paciente delante: en la
   * biblioteca ya no se acuerda uno de por qué venía.
   */
  const [cambiando, setCambiando] = useState<any>(null)
  const [pendientes, setPendientes] = useState(0)
  const [ultimoGuardado, setUltimoGuardado] = useState<Date|null>(null)

  useEffect(() => {
    const antesDeSalir = (e: BeforeUnloadEvent) => {
      if (pendientes > 0) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', antesDeSalir)
    return () => window.removeEventListener('beforeunload', antesDeSalir)
  }, [pendientes])

  async function cargarCtxPaciente(pid: string) {
    const [rm, rp, ra] = await Promise.all([
      supabase.from('molestias').select('*').eq('paciente_id', pid).eq('activa', true),
      supabase.from('patologias').select('*').eq('paciente_id', pid),
      supabase.from('alertas_paciente').select('*').eq('paciente_id', pid).eq('activa', true),
    ])
    setCtxPorPaciente(prev => ({ ...prev, [pid]: { molestias: rm.data||[], patologias: rp.data||[], alertas: ra.data||[] } }))
  }
  async function cargarTestsHoy(pid: string, dia: string) {
    const [porDia, mant] = await Promise.all([testsPorDia(pid), testsPorConfirmar(pid, dia)])
    const deEval = porDia[dia] || []
    /* Y los que confirman lo ya logrado. No cuelgan de un dia: desde que vencen
       salen en cualquier clase que tenga. Si el test ya venia por la evaluacion
       es UNO, no dos: se pasa una vez. Ver `lib/mantenimiento`. */
    const yaEsta = new Set(deEval.map((x: any) => x.test.id))
    const suyos = [...deEval, ...mant.tests.filter((x: any) => yaEsta.has(x.test.id) === false)]
    setSinTest(prev => ({ ...prev, [pid]: mant.sinTest }))
    // Lo ya pasado hoy no vuelve a pedirse: el icono se apaga solo.
    const ids = suyos.map((x:any)=>x.test.id)
    const { data: hechos } = ids.length > 0
      ? await supabase.from('resultados_tests').select('test_id')
          .eq('paciente_id', pid).eq('fecha', dia).in('test_id', ids)
      : { data: [] as any[] }
    const ya = new Set((hechos||[]).map((r:any)=>r.test_id))
    setTestsHoy(prev => ({ ...prev, [pid]: suyos.map((x:any)=>({ ...x, hecho: ya.has(x.test.id) })) }))
  }

  /** Sigue bien: sube un escalon de la escalera de mantenimiento. */
  async function confirmar(pid: string, o: any) {
    await confirmarAMano(pid, o.objetivo_id, o.nombre)
    setSinTest(prev => ({ ...prev, [pid]: (prev[pid]||[]).filter((x:any)=>x.objetivo_id!==o.objetivo_id) }))
  }

  /** Lo ha perdido: se reabre por la regla de siempre, abriendo sus vias. */
  async function perdido(pid: string, o: any) {
    if (confirm(`¿«${o.nombre}» ha dejado de estar logrado?`) === false) return
    const { data } = await supabase.from('pacientes_objetivos').select('vias')
      .eq('paciente_id', pid).eq('objetivo_id', o.objetivo_id).maybeSingle()
    const vias = (Array.isArray(data?.vias) ? data!.vias : [])
      .map((v:any)=>({ ...v, resuelto:false, fecha_resuelto:null }))
    const r = await guardarVias(pid, o.objetivo_id, vias, { logradoAntes: true, contexto: 'el taller' })
    if (!r.ok) { alert('No se pudo guardar: ' + r.error); return }
    setSinTest(prev => ({ ...prev, [pid]: (prev[pid]||[]).filter((x:any)=>x.objetivo_id!==o.objetivo_id) }))
  }

  /** Abrirlo para pasarlo. Mismo formulario que la ficha y la valoracion. */
  function abrirTest(x: any) {
    setListaTests(false)
    const t = x.test
    const lateral = t.tipo_lado === 'lateral'
    const l = lateral ? '' : 'bilateral'
    setTestEnCurso({ pacienteId: activo, items: x.items || [], test: t,
      tv: { ladoActivo: l, frecuencia_meses: t.frecuencia_meses,
            lados: l ? { [l]: ladoVacio(t) } : {} } })
  }

  /**
   * Guardarlo. Toda la logica —fila, evento, objetivos y a que evaluacion pertenece—
   * esta en `lib/tests.ts`, igual que desde la ficha: aqui solo cambia quien lo abre.
   */
  async function guardarTest() {
    if (testEnCurso == null) return
    const { test, tv, pacienteId } = testEnCurso
    const conDato = Object.keys(tv.lados||{}).filter((k:string) =>
      k && tv.lados[k]?.resultado && tv.lados[k].resultado !== 'sin_realizar')
    if (conDato.length === 0) {
      alert(test.tipo_lado === 'lateral'
        ? 'Elige el lado y marca el resultado antes de guardar.'
        : 'Marca el resultado antes de guardar')
      return
    }
    setGuardandoTest(true)
    let logrados = 0
    for (const lado of conDato) {
      const d = tv.lados[lado]
      const r = await registrarResultadoTest(pacienteId, test, {
        resultado: d.resultado, items: d.items_resultado || [],
        observaciones: d.observaciones, lado,
        fechaRepeticion: d.fecha_repeticion || null,
        contexto: 'el taller',
      })
      if (r.ok === false) { alert('No se pudo guardar el resultado: ' + r.error); setGuardandoTest(false); return }
      logrados += r.logrados
    }
    setGuardandoTest(false)
    setTestEnCurso(null)
    await cargarTestsHoy(pacienteId, fecha)
    cargarObjsPaciente(pacienteId)
    if (logrados > 0) alert(`Con esto se ${logrados === 1 ? 'cierra 1 objetivo' : `cierran ${logrados} objetivos`}.`)
  }

  const [sala, setSala] = useState('')
  // A y B por defecto, igual que la agenda: si `clinica_salas` no está puesto en Ajustes,
  // antes se quedaba en lista vacía y el selector de sala no llegaba a pintarse nunca.
  const [salas, setSalas] = useState<string[]>(['A','B'])
  const [hora, setHora] = useState('')
  const [horas, setHoras] = useState<{hora:string,n:number}[]>([])
  // Si las franjas todavía no se han leído, `hora` vale '' y '' significa TODO EL DÍA. Sin
  // esta bandera el taller cargaba la clínica entera en cuanto abría y se corregía un
  // instante después, que es exactamente lo que se veía.
  const [horasListas, setHorasListas] = useState(false)
  const [trayendo, setTrayendo] = useState(false)
  const [avisoAgenda, setAvisoAgenda] = useState('')
  const [eligiendo, setEligiendo] = useState<any>(null)
  const router = useRouter()

  /**
   * Las franjas del día, y la de ahora puesta sola.
   *
   * SE TRABAJA POR FRANJA, NO POR DÍA. Por la clínica pueden pasar 110 personas en un día;
   * traerlas todas de golpe no sirve para nada. Al abrir el taller a las 10:05 lo que hace
   * falta es la gente de las 10:00, sin tocar nada.
   *
   * La hora elegida a mano se respeta mientras siga existiendo en el día: si estás mirando
   * la franja anterior a propósito, cambiar de sala no debe devolverte al presente.
   */
  useEffect(() => {
    let vigente = true
    setHorasListas(false)
    ;(async () => {
      /* MANDA LA HORA, NO LA SALA. Las horas salen del dia ENTERO: filtrarlas
         por sala hacia desaparecer las 07:00 del selector si ese dia solo habia
         gente en la otra, y parecia que el taller no cargaba. */
      const hs = await horasDelDia(fecha)
      if (!vigente) return   // cambió de día mientras se leía: manda lo último
      setHoras(hs)
      setHora(prev => (prev && hs.some(h => h.hora === prev)) ? prev : horaActual(hs))
      setHorasListas(true)
    })()
    return () => { vigente = false }
  }, [fecha])

  // Las salas se leen de Ajustes, igual que en la agenda: si mañana hay una tercera sala,
  // el taller se entera solo.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('ajustes').select('clave,valor').eq('clave','clinica_salas').maybeSingle()
      try { const v = JSON.parse((data as any)?.valor || '[]'); if (Array.isArray(v) && v.length) setSalas(v) } catch {}
    })()
  }, [])

  /**
   * Traer de la agenda los que vienen en esa franja. Se llama sola.
   *
   * NO HAY BOTÓN. Al abrir el taller ya sabemos la fecha, la sala y la franja que está
   * corriendo: pedirle además que pulse "traer" era un paso sin decisión detrás.
   *
   * EN PANTALLA SOLO ESTÁ LA FRANJA ACTUAL. La primera versión acumulaba —cambiabas de
   * hora y los de la anterior seguían ahí— y con 110 personas al día la lista se hacía
   * inútil en dos cambios: solo cambiaba el número del selector.
   *
   * Lo ESCRITO de quien siga en la nueva franja se conserva: no se recarga su ficha, se
   * deja tal cual, porque recargarla borraría series a medio teclear. Y que alguien salga
   * de la lista no pierde nada: el autoguardado ya lo ha escrito.
   *
   * Se lee la selección por REFERENCIA y no del estado. Si `seleccion` fuera dependencia
   * del efecto que llama aquí, cada paciente añadido lo dispararía otra vez y la carga se
   * repetiría en bucle.
   */
  async function traerDeAgenda() {
    setTrayendo(true); setAvisoAgenda('')
    try {
      let delDia = await pacientesDelDia(fecha, sala || undefined, hora || undefined)
      /* La sala es una PREFERENCIA, no un muro: si a esa hora no hay nadie en la
         tuya pero si en otra, se enseñan igual y se dice. Dejar la pantalla vacia
         con gente en la sala de al lado es el error que parecia un fallo. */
      let otraSala = ''
      if (delDia.length === 0 && sala) {
        const todos = await pacientesDelDia(fecha, undefined, hora || undefined)
        if (todos.length > 0) {
          delDia = todos
          otraSala = Array.from(new Set(todos.map((d:any)=>d.sala).filter(Boolean))).join(' y ')
        }
      }
      const previos = seleccionRef.current
      const lista: any[] = []
      for (const d of delDia) {
        const ya = previos.find((s:any) => s.paciente.id === d.pacienteId)
        if (ya) { lista.push(ya); continue }        // lo suyo se queda como esté
        // La sesión de hoy es el plan CON lo ajustado para este día. Lo preparado
        // semanas antes tiene que llegar a la sala solo; si hubiera que acordarse
        // de mirarlo, no serviría de nada haberlo preparado.
        const datos = d.sesion ? await cargarDatosSesion(d.pacienteId, aplicarAjustes(d.sesion, d.ajustes)) : []
        let objetivosSesion: any[] = []
        if (d.sesion?.id) {
          const { data: rel } = await supabase.from('sesiones_objetivos')
            .select('objetivos(id,nombre,imagen_url)').eq('sesion_id', d.sesion.id)
          objetivosSesion = (rel||[]).map((r:any)=>r.objetivos).filter(Boolean)
        }
        lista.push({
          fechaClase: fecha,
          paciente: d.paciente,
          objetivosSesion,
          sesionId: d.sesion?.id || '',
          sesiones: d.disponibles,
          datos, cargado: !!d.sesion, finalizado: false,
          citaId: d.citaId, estado: d.estado, hora: d.hora, sala: d.sala,
          origen: d.origen, sesionVieja: d.sesionVieja,
        })
        cargarObjsPaciente(d.pacienteId)
        cargarCtxPaciente(d.pacienteId)
        cargarTestsHoy(d.pacienteId, fecha)
      }

      const final = lista
      /* LA CLASE QUE SE DEJA SIN GUARDAR SE AVISA. Al cambiar de franja, quien sale de
         pantalla sin finalizar pasa a un aviso con "Guardar ahora": si no se guarda,
         lo apuntado no cuenta como hecho. */
      const dejados = porCerrar(previos.filter((s:any) => !final.includes(s)))
      if (dejados.length > 0) setPendClase(prev => [
        ...prev.filter((x:any) => !dejados.some((d:any) => d.citaId === x.citaId)), ...dejados])
      setSeleccion(final)
      // Quién trae hoy una sesión distinta de la que se le había planificado.
      setCambios(await cambiosDeCitas(delDia.map(d => d.citaId).filter(Boolean)))
      // Si el que estaba abierto ya no está en la franja, no se deja un panel colgado.
      setActivo(a => final.some((x:any) => x.paciente.id === a) ? a : (final[0]?.paciente.id || ''))

      // AQUÍ NO SE CUENTA NADA. El recuento de "a X les falta sesión" se calcula en el
      // render a partir de la lista viva. Antes se congelaba en este texto y, al ponerle
      // la sesión a alguien, seguía diciendo que le faltaba a uno: el aviso hablaba de un
      // momento que ya había pasado. Mismo motivo por el que la versión de una sesión sale
      // de la cadena y no de una columna.
      const donde = (hora ? 'a las ' + hora : 'todo el día') + (sala ? ' · sala ' + sala : '')
      setAvisoAgenda(delDia.length === 0
        ? `Nadie citado ${donde}.`
        : otraSala
          ? `En la sala ${sala} no hay nadie ${hora ? 'a las ' + hora : 'hoy'}. Te enseño los de la sala ${otraSala}.`
          : '')
    } catch (e: any) {
      // Antes esto no existía y el fallo salía como "no hay citas", que es mentira y manda
      // a buscar el problema al sitio equivocado.
      setAvisoAgenda(e?.message || 'No se ha podido leer la agenda')
    } finally { setTrayendo(false) }
  }

  /* CLASES DE DIAS ANTERIORES SIN GUARDAR. El aviso de franja solo vive mientras el
     taller esta abierto; esto mira la base al entrar, asi que sobrevive a cerrar la
     pagina. Solo se guarda lo que se llego a apuntar: lo no tocado de esos dias no
     se reconstruye. */
  const [viejos, setViejos] = useState<any[]>([])
  const [guardandoViejos, setGuardandoViejos] = useState(false)
  async function buscarViejos() {
    const { data } = await supabase.from('registros_ejercicio')
      .select('id,paciente_id,ejercicio_id,fecha, pacientes(nombre,apellidos,nombre_clinica)')
      .eq('finalizado', false).lt('fecha', hoy()).order('fecha')
    setViejos(data || [])
  }
  useEffect(() => { buscarViejos() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  async function guardarViejos() {
    setGuardandoViejos(true)
    for (const r of viejos) await cerrarBorrador(r)
    setGuardandoViejos(false)
    buscarViejos()
  }
  /** No guardarlas: se tiran los borradores de esos dias. */
  async function descartarViejos() {
    if (!confirm('Se borrará lo apuntado en esas clases sin guardar. No se puede deshacer.')) return
    setGuardandoViejos(true)
    await supabase.from('registros_ejercicio').delete().in('id', viejos.map((r:any) => r.id))
    setGuardandoViejos(false)
    buscarViejos()
  }

  // Gente de una franja anterior que se quedo sin guardar al cambiar de franja.
  const [pendClase, setPendClase] = useState<any[]>([])
  const [cerrandoClase, setCerrandoClase] = useState(false)
  const seleccionRef = useRef<any[]>([])
  useEffect(() => { seleccionRef.current = seleccion }, [seleccion])

  // Cargar sola al abrir y cada vez que cambia el día, la sala o la franja.
  //
  // Se esperan las DOS cosas: los filtros recuperados y las franjas del día leídas. Con
  // solo la primera, `hora` seguía vacía y la primera carga se traía el día entero.
  useEffect(() => {
    if (!listo || !horasListas) return
    traerDeAgenda()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, sala, hora, listo, horasListas])

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('objetivos').select('id,nombre').eq('activo',true).order('nombre')
      setObjetivosLib(data||[])
      const { data: ets } = await supabase.from('etiquetas').select('id,nombre,categoria,padre_id')
      setEtiquetas(ets||[])
    })()
  }, [])

  async function cargarObjsPaciente(pid: string) {
    const { data } = await supabase.from('pacientes_objetivos').select('objetivo_id,origen,vias').eq('paciente_id', pid)
    setObjsPorPaciente(prev => ({ ...prev, [pid]: data||[] }))
  }

  async function toggleObjetivo(pid: string, objetivoId: string, ejercicioId?: string, ejercicioNombre?: string) {
    const actuales = objsPorPaciente[pid] || []
    const existe = actuales.find((o:any)=>o.objetivo_id===objetivoId)
    const ref = ejercicioId || ''
    const etiqueta = ejercicioNombre ? ('Ejercicio: ' + ejercicioNombre) : 'Ejecucion'
    if (existe) {
      const vias = Array.isArray(existe.vias) ? existe.vias : []
      const restantes = vias.filter((v:any)=>!(v.tipo==='ejecucion' && v.ref===ref))
      if (restantes.length===0) {
        const { error } = await supabase.from('pacientes_objetivos')
          .delete().eq('paciente_id', pid).eq('objetivo_id', objetivoId)
        if (error) { alert('Error: '+error.message); return }
      } else {
        const r = await guardarVias(pid, objetivoId, restantes, { logradoAntes: !!existe.logrado, contexto: 'la ejecución' })
        if (!r.ok) { alert('Error: '+r.error); return }
      }
    } else {
      const nuevaVia = { tipo:'ejecucion', ref, etiqueta, resuelto:false, fecha_resuelto:null }
      const r = await abrirObjetivo(pid, objetivoId, nuevaVia, 'ejecucion')
      if (!r.ok) { alert('Error: '+r.error); return }
    }
    await cargarObjsPaciente(pid)
  }

  async function resolverViaEjecucionClase(pid: string, objetivoIds: string[], ejercicioId: string, resuelto: boolean) {
    for (const oid of objetivoIds) {
      await resolverVia(pid, oid, 'ejecucion', ejercicioId, resuelto, 'la ejecución')
    }
    cargarObjsPaciente(pid)
  }


  // cargar ejercicios+borrador de una sesion sin depender del estado (para restaurar)
  /** Ejercicio + variante. Para el historial son dos cosas distintas. */
  const claveVar = (id: string, v: any) => `${id}|${String(v || '').trim()}`

  async function abrirSustituir(pid: string, i: number) {
    setSustituyendo({ pid, i })
    if (catalogoEj.length === 0) {
      const r = await traerTodo((d, h) => supabase.from('ejercicios').select('*').order('nombre').order('id').range(d, h))
      setCatalogoEj(r.filas)
    }
  }

  /**
   * Pone otro ejercicio en ese hueco SOLO PARA ESTA CITA.
   *
   * Se guarda como ajuste del dia (`citas.ajustes`), igual que un cambio de peso o de
   * variante: la sesion no se toca, las demas citas siguen con el ejercicio del plan,
   * y si se recarga el taller el cambio sigue ahi. Lo que se apunte se registra con el
   * ejercicio que de verdad se hizo.
   */
  async function sustituir(pid: string, i: number, nuevo: any) {
    const item = seleccion.find((x:any) => x.paciente.id === pid)
    const ej = item?.datos?.[i]
    if (!item || !ej) return
    setSustituyendo(null)
    const sustituto = { ejercicio_id: nuevo.id, nombre: nuevo.nombre, imagen_url: nuevo.imagen_url || null }
    if (item.citaId && ej.pos) {
      const { data: c } = await supabase.from('citas').select('ajustes').eq('id', item.citaId).maybeSingle()
      const aj: any = c?.ajustes && c.ajustes.ejercicios ? c.ajustes : { v: 1, ejercicios: {} }
      const previo = aj.ejercicios[ej.pos] || {}
      aj.ejercicios[ej.pos] = { ...previo, nombre: previo.nombre || ej.sustituye || ej.nombre, sustituto }
      const { error } = await supabase.from('citas').update({ ajustes: aj }).eq('id', item.citaId)
      if (error) { alert('No se ha podido guardar el cambio: ' + error.message); return }
    }
    setSeleccion(prev => prev.map((s:any) => s.paciente.id !== pid ? s : {
      ...s,
      datos: s.datos.map((e:any, k:number) => k !== i ? e : {
        ...e,
        ejercicio_id: nuevo.id, nombre: nuevo.nombre, imagen_url: nuevo.imagen_url || '', variante: '',
        sustituye: e.sustituye || e.nombre,
        tipo_medida: nuevo.tipo_medida || 'peso_reps', items: nuevo.items_ejecucion || [],
        feedbacks: nuevo.feedbacks || [], etiquetas: nuevo.etiquetas || [],
        items_evaluados: {}, ultimo: null, guardado: false, hoy: {},
      }),
    }))
  }

  async function cargarDatosSesion(pid: string, ses: any) {
    if (ses?.id) cargarObjsDeSesion(ses.id)
    const ejs: any[] = []
    ;(ses.partes||[]).forEach((parte:any, pi:number)=>{
      ;(parte.ejercicios||[]).forEach((ej:any, pe:number)=>{
        const esCircuito = parte.modo === 'circuito'
        const n = esCircuito ? (parseInt(parte.vueltas)||parseInt(ej.series)||4) : (parseInt(ej.series)||4)
        ejs.push({
          parte: parte.nombre || '',
          parteObj: parte,
          grupo: ej.grupo || '',
          ejercicio_id: ej.ejercicio_id||null, nombre: ej.nombre,
          imagen_url: ej.imagen_url||'', variante: ej.variante||'',
          // Su hueco en la sesion (parte.ejercicio): es la clave de los ajustes del dia.
          pos: `${pi}.${pe}`, sustituye: ej.sustituye || '',
          /**
           * LO PRESCRITO VIAJA ENTERO A LA SALA.
           *
           * Aqui solo se copiaban peso y reps, asi que la nota del ejercicio, el
           * tiempo, la capacidad, el regimen y el descanso propio se quedaban en la
           * ficha. Prescribias "excentrico, ojo con la rodilla derecha" y en la sala
           * salia el nombre, la foto y unas casillas vacias.
           */
          plan:{
            series:ej.series, peso:ej.peso, reps:ej.reps, tiempo:ej.tiempo,
            capacidad:ej.capacidad, regimen:ej.regimen, descanso:ej.descanso, nota:ej.nota,
          },
          /* LAS CASILLAS EMPIEZAN CON LO PRESCRITO. En la sala se sale de lo
             planificado y se corrige lo que cambie, que es casi nada; con las
             casillas vacias habia que teclear de nuevo lo que ya estaba escrito
             en la ficha. */
          series: Array.from({length:n},()=>({
            peso: ej.peso == null ? '' : String(ej.peso),
            reps: ej.reps == null ? '' : String(ej.reps),
            segundos: ej.tiempo == null ? '' : String(ej.tiempo),
          })),
          comentario:'', ultimo:null, guardado:false,
          // Casillas escritas HOY ('serie.campo'). Lo que viene de la ultima vez o
          // del plan se pinta claro; lo de hoy, oscuro. Ver CasillaSeries.
          hoy: {},
        })
      })
    })
    const ids = ejs.map(e=>e.ejercicio_id).filter(Boolean)
    if (ids.length) {
      const { data: tipos } = await supabase.from('ejercicios').select('id,tipo_medida,items_ejecucion,feedbacks,etiquetas').in('id', ids)
      const tipoMap:Record<string,any>={}
      ;(tipos||[]).forEach((t:any)=>{ tipoMap[t.id]=t })
      ejs.forEach(e=>{
        const t = e.ejercicio_id ? tipoMap[e.ejercicio_id] : null
        e.tipo_medida = t?.tipo_medida || 'peso_reps'
        e.items = t?.items_ejecucion || []
        e.feedbacks = t?.feedbacks || []
        // Para cruzar con la zona de sus molestias. Ver `lib/avisosZona`.
        e.etiquetas = t?.etiquetas || []
        if (!e.items_evaluados) e.items_evaluados = {}
      })
    } else {
      ejs.forEach(e=>{ e.tipo_medida = 'peso_reps'; e.items = []; e.feedbacks = []; e.etiquetas = []; if(!e.items_evaluados) e.items_evaluados = {} })
    }
    if (ids.length) {
      /**
       * UNA VARIANTE ES OTRO EJERCICIO a efectos de progresion.
       *
       * El registro ya guardaba la variante —"sin esto, la progresion de cargas
       * mezclaba unilateral y bilateral"— pero al LEER la ultima vez no se miraba:
       * se cogia el registro mas reciente del ejercicio, fuera de la variante que
       * fuera. Si el lunes hizo press bilateral a 40 y el miercoles toca unilateral,
       * el taller le ponia "ultima vez: 40", que es justo el numero que no debe ver.
       *
       * Sin respaldo a proposito: si no ha hecho nunca ESA variante, lo honesto es
       * decir que no hay registro previo, no ensenarle el de otra cosa.
       */
      const { data: fin } = await supabase.from('registros_ejercicio')
        .select('ejercicio_id,variante,series,fecha,created_at,comentario,items_evaluados')
        .eq('paciente_id', pid).eq('finalizado', true).in('ejercicio_id', ids)
        .order('fecha',{ascending:false}).order('created_at',{ascending:false})
      const ultMap:Record<string,any>={}
      /* LAS DOS ULTIMAS NOTAS, con su fecha. Una sola y sin fecha no decia si
         era de la semana pasada o de marzo, y lo que se escribe en la sala es
         justo lo que hay que leer la proxima vez. */
      const comentMap:Record<string,{fecha:string,texto:string}[]>={}
      ;(fin||[]).forEach((r:any)=>{
        const k=claveVar(r.ejercicio_id,r.variante)
        // Un registro SIN series (hecho, sin cifras) no sirve de "ultima vez": si
        // lo cogiera, la carga de partida volveria a la del plan y se perderia la
        // progresion. Se salta hasta el ultimo que tenga numeros.
        if(!ultMap[k] && Array.isArray(r.series) && r.series.length>0) ultMap[k]=r
        const t = String(r.comentario||'').trim()
        if (t !== '') {
          if (comentMap[k] == null) comentMap[k] = []
          if (comentMap[k].length < 2) comentMap[k].push({ fecha: r.fecha, texto: t })
        }
      })
      const { data: ejec } = await supabase.from('ejecucion_paciente')
        .select('ejercicio_id,items,fecha').eq('paciente_id', pid).in('ejercicio_id', ids)
      const ejecMap:Record<string,any>={}
      ;(ejec||[]).forEach((r:any)=>{ ejecMap[r.ejercicio_id]=r })
      const { data: curso } = await supabase.from('registros_ejercicio')
        .select('ejercicio_id,variante,series,comentario,items_evaluados,regimen')
        .eq('paciente_id', pid).eq('sesion_id', ses.id).eq('finalizado', false).eq('fecha', fecha).in('ejercicio_id', ids)
      // Solo el borrador de ESTE dia. Sin la fecha, uno olvidado de otra clase de la
      // misma sesion aparecia como apuntado hoy.
      const cursoMap:Record<string,any>={}
      ;(curso||[]).forEach((r:any)=>{ cursoMap[claveVar(r.ejercicio_id,r.variante)]=r })
      ejs.forEach(e=>{
        if (e.ejercicio_id){
          const kv = claveVar(e.ejercicio_id, e.variante)
          e.ultimo = ultMap[kv]?.series || null
          e.ultimoComent = ultMap[kv]?.comentario || ''
          e.comentarios = comentMap[kv] || []
          const ejec = ejecMap[e.ejercicio_id]
          e.ultimaEval = ejec?.items || null
          e.ultimaEvalFecha = ejec?.fecha || null
          e.items_evaluados = ejec?.items ? { ...ejec.items } : (e.items_evaluados || {})
          /* MANDA LO ULTIMO QUE HIZO. Lo planificado solo se ve la primera vez,
             cuando no hay de donde partir: de ahi en adelante la carga real es
             la que manda, porque es desde donde se progresa.
             Un hueco vacio de la ultima vez NO borra lo planificado. */
          if (Array.isArray(e.ultimo) && e.ultimo.length>0) {
            const lleno = (x:any) => x != null && String(x) !== ''
            e.series = e.series.map((orig:any, idx:number) => {
              const prev = e.ultimo[idx]
              if (!prev) return orig
              return {
                ...orig,
                peso:     lleno(prev.peso)     ? prev.peso     : orig.peso,
                reps:     lleno(prev.reps)     ? prev.reps     : orig.reps,
                segundos: lleno(prev.segundos) ? prev.segundos : orig.segundos,
              }
            })
            e.precargado = true
            // Si "la ultima vez" es HOY (ya finalizado en esta clase), es de hoy.
            if (ultMap[kv]?.fecha === fecha) {
              const hoy: Record<string, boolean> = {}
              e.ultimo.forEach((x:any, k:number) => ['peso','reps','segundos'].forEach(f => {
                if (x && x[f] != null && String(x[f]) !== '') hoy[`${k}.${f}`] = true
              }))
              e.hoy = hoy
            }
          }
          const c = cursoMap[kv]
          if (c) {
            if (Array.isArray(c.series)) {
              // fusionar: mantener nº de series de la plantilla, rellenar con lo guardado
              const merged = e.series.map((orig:any, idx:number) => c.series[idx] || orig)
              // si el borrador tenia mas series que la plantilla, añadirlas
              for (let k=e.series.length; k<c.series.length; k++) merged.push(c.series[k])
              e.series = merged
              // Lo del borrador es de hoy: se escribio en esta clase antes de recargar.
              const hoy: Record<string, boolean> = {}
              c.series.forEach((x:any, k:number) => ['peso','reps','segundos'].forEach(f => {
                if (x && x[f] != null && String(x[f]) !== '') hoy[`${k}.${f}`] = true
              }))
              e.hoy = hoy
            }
            /* EL COMENTARIO Y EL REGIMEN, AUNQUE NO HAYA SERIES. Colgaban del
               mismo `if` que la fusion de series, asi que una nota escrita en un
               ejercicio sin numeros se perdia al recargar: se habia guardado
               bien y parecia que no. */
            e.comentario = c.comentario||''; e.guardado = true; e.precargado = false
            if (c.regimen) e.regimen = c.regimen
          }
          if (c && c.items_evaluados && typeof c.items_evaluados==='object') e.items_evaluados = c.items_evaluados
        }
      })
    }
    return ejs
  }

  /**
   * Solo se recuerda la SALA. Ni el día ni la franja.
   *
   * La sala es una preferencia —trabajas en la tuya— y no cambia sola. El día y la hora
   * sí: al volver al taller lo que hace falta es lo que está pasando AHORA, no la franja
   * que estabas mirando hace un rato. Recordarlas hacía que entrases por la mañana y te
   * saliera la clase de ayer por la tarde.
   *
   * Antes se guardaba en `sessionStorage` la lista entera de pacientes con su sesión, y al
   * volver se rehacía uno por uno. Ya no hace falta y era una segunda copia de algo que ya
   * está en dos sitios mejores: quién viene lo dice la agenda, y lo tecleado lo devuelve
   * `cargarDatosSesion`, que lee el borrador de `registros_ejercicio`. Recargar la página
   * en mitad de una clase no pierde nada.
   */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SKEY)
      if (raw) {
        const g = JSON.parse(raw)
        if (g.sala) setSala(g.sala)
      }
    } catch {}
    restaurado.current = true
    setListo(true)
  }, [])

  // `listo` y no `restaurado.current`: el ref ya vale true en el mismo ciclo en que se
  // recupera, así que este efecto llegaba a correr con los valores por defecto todavía
  // puestos y machacaba en disco lo que se acababa de leer.
  useEffect(() => {
    if (!listo) return
    try { sessionStorage.setItem(SKEY, JSON.stringify({ sala })) } catch {}
  }, [listo, sala])

  const nombrePac = (p:any) => `${p.nombre} ${p.apellidos||''}`.trim()

  /**
   * NO SE AÑADE NI SE QUITA GENTE AQUÍ.
   *
   * Había un buscador de "añadir paciente", una ✕ en cada ficha y un "limpiar todo". Se
   * han quitado los tres: quién entrena lo decide la AGENDA. Con dos sitios donde apuntar
   * quién viene, el desajuste está garantizado —alguien acaba en el taller sin cita, o con
   * cita y fuera del taller— y no hay forma de saber cuál de los dos tiene razón.
   *
   * Si alguien se pasa sin avisar, se le pone la cita en la agenda y aparece aquí.
   */

  /**
   * AQUÍ NO SE PONE UNA SESIÓN DIRECTAMENTE.
   *
   * Hubo una `elegirSesion` que escribía `citas.sesion_id` desde el taller. Quedó sin usar
   * cuando la elección pasó a hacerse en la ficha o en la biblioteca —un solo mecanismo,
   * ver `lib/asignarCita`—, y se ha retirado ahora porque desde que el cambio de sesión
   * exige motivo, una segunda puerta de escritura es una puerta por la que el motivo se
   * pierde. El único camino es el encargo, y el encargo lo lleva.
   */

  function programarAutosave(pid:string, ei:number, ejData:any, sesionId:string){
    // Si se apunta algo en uno marcado como "no lo hizo", es que si lo hizo.
    const nh = leerNoHechos(pid, sesionId)
    if (nh.includes(ei)) ponerNoHechos(pid, sesionId, nh.filter(x => x !== ei))
    const key = `${pid}_${ei}`
    if (timers.current[key]) clearTimeout(timers.current[key])
    else setPendientes(p=>p+1)
    timers.current[key] = setTimeout(()=>{ delete timers.current[key]; autoguardar(pid, ei, ejData, sesionId) }, 700)
  }

  /**
   * Da por guardado un borrador con SU fecha. Si ese dia ya habia uno finalizado del
   * mismo ejercicio (se corrigio despues de finalizar), manda el borrador, que es lo
   * ultimo que se apunto: el indice uniq_regej_finalizado_dia no admite dos.
   */
  async function cerrarBorrador(r: { id: string, paciente_id: string, ejercicio_id: string | null, fecha: string }) {
    // SI ESE DIA YA ESTA GUARDADO, MANDA LO GUARDADO. La clase se finalizo y el
    // borrador es un resto: no se vuelve a guardar encima, se tira.
    if (r.ejercicio_id) {
      const { data: ya } = await supabase.from('registros_ejercicio').select('id')
        .eq('paciente_id', r.paciente_id).eq('ejercicio_id', r.ejercicio_id).eq('fecha', r.fecha).eq('finalizado', true).limit(1)
      if ((ya || []).length > 0) return supabase.from('registros_ejercicio').delete().eq('id', r.id)
    }
    return supabase.from('registros_ejercicio').update({ finalizado: true }).eq('id', r.id)
  }

  async function autoguardar(pid:string, ei:number, ej:any, sesionId:string){
    const seriesLlenas = ej.series.filter((x:any)=>x.peso!==''||x.reps!==''||(x.segundos!==''&&x.segundos!==undefined))
    const hayComent = (ej.comentario||'').trim()!==''
    const iv = ej.items_evaluados || {}
    const hayItems = Object.values(iv).some((v:any)=>v===true)
    if (ej.precargado && !hayComent && !hayItems) { setPendientes(p=>Math.max(0,p-1)); return }
    if (seriesLlenas.length===0 && !hayComent && !hayItems) { setPendientes(p=>Math.max(0,p-1)); return }
    const fila:any = {
      paciente_id: pid, ejercicio_id: ej.ejercicio_id, ejercicio_nombre: ej.nombre,
      sesion_id: sesionId, series: seriesLlenas, comentario: ej.comentario||null, items_evaluados: iv, finalizado:false,
      fecha,
      // Como se hizo HOY, que puede no ser como estaba prescrito.
      regimen: ej.regimen || ej.plan?.regimen || null,
      // Sin esto, la progresión de cargas mezclaba unilateral y bilateral.
      variante: ej.variante || null,
    }
    let error
    if (ej.ejercicio_id){
      // Con la variante en la clave: el mismo ejercicio puede salir dos veces en
      // la misma sesion —bilateral y unilateral— y sin esto el segundo pisaba al
      // primero, o `maybeSingle` fallaba por encontrar dos.
      let q = supabase.from('registros_ejercicio')
        .select('id,fecha').eq('paciente_id',pid).eq('ejercicio_id',ej.ejercicio_id)
        .eq('sesion_id',sesionId).eq('finalizado',false)
      q = ej.variante ? q.eq('variante', ej.variante) : q.is('variante', null)
      let { data: existe } = await q.maybeSingle()
      // Borrador de OTRO dia que se quedo sin guardar: se cierra con su fecha y se
      // empieza uno nuevo. Si se actualizara, lo de hoy quedaria con la fecha vieja.
      if (existe && existe.fecha && existe.fecha !== fecha) {
        await cerrarBorrador({ id: existe.id, paciente_id: pid, ejercicio_id: ej.ejercicio_id, fecha: existe.fecha })
        existe = null
      }
      if (existe){
        ({ error } = await supabase.from('registros_ejercicio')
          .update({ series:seriesLlenas, comentario:ej.comentario||null, ejercicio_nombre:ej.nombre, items_evaluados:iv, variante:ej.variante||null, regimen: ej.regimen || ej.plan?.regimen || null })
          .eq('id', existe.id))
      } else {
        ({ error } = await supabase.from('registros_ejercicio').insert(fila))
      }
    } else {
      ({ error } = await supabase.from('registros_ejercicio').insert(fila))
    }
    if (error){ console.error('autoguardar clase', error.message); setPendientes(p=>Math.max(0,p-1)); return }
    setPendientes(p=>Math.max(0,p-1))
    setUltimoGuardado(new Date())
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; if(datos[ei]) datos[ei]={...datos[ei],guardado:true}
      return {...s,datos}
    }))
  }

  function mutarSerie(pid:string, ei:number, si:number, campo:string, val:string){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; const series=[...datos[ei].series]
      series[si]={...series[si],[campo]:val}
      datos[ei]={...datos[ei],series,guardado:false,precargado:false,hoy:{...(datos[ei].hoy||{}),[`${si}.${campo}`]:true}}
      programarAutosave(pid,ei,datos[ei],s.sesionId)
      return {...s,datos}
    }))
  }
  function addSerie(pid:string, ei:number){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; datos[ei]={...datos[ei],series:[...datos[ei].series,{peso:'',reps:''}]}
      return {...s,datos}
    }))
  }
  function quitarSerie(pid:string, ei:number, si:number){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; datos[ei]={...datos[ei],series:datos[ei].series.filter((_:any,i:number)=>i!==si),guardado:false}
      programarAutosave(pid,ei,datos[ei],s.sesionId)
      return {...s,datos}
    }))
  }
  /**
   * EL REGIMEN DEL DIA.
   *
   * La capacidad se deduce de las repeticiones, pero el regimen no sale de
   * ningun numero: si hoy lo hace excentrico porque no controla la subida, eso
   * solo lo sabes mirandolo. Se guarda en el registro de hoy y no toca la
   * sesion: manana vuelve a salir lo planificado.
   */
  function setRegimen(pid:string, ei:number, val:string){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; datos[ei]={...datos[ei],regimen:val,guardado:false}
      programarAutosave(pid,ei,datos[ei],s.sesionId)
      return {...s,datos}
    }))
  }

  function setComent(pid:string, ei:number, val:string){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]; datos[ei]={...datos[ei],comentario:val,guardado:false}
      programarAutosave(pid,ei,datos[ei],s.sesionId)
      return {...s,datos}
    }))
  }

  function toggleItem(pid:string, ei:number, ii:number){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]
      // Por TEXTO, no por posición: ver lib/ejecucion.ts.
      const itAct=(datos[ei].items||[])[ii]
      const texto=typeof itAct==='string'?itAct:itAct?.texto
      if(!texto) return prev
      const iv=alternarItem(datos[ei].items_evaluados, texto)
      datos[ei]={...datos[ei],items_evaluados:iv,guardado:false}
      programarAutosave(pid,ei,datos[ei],s.sesionId)
      guardarEjecucion(pid, datos[ei].ejercicio_id, iv)
      const ej = datos[ei]
      const item = (ej.items||[])[ii]
      const cumplido = iv[texto]===true
      if (item && (item.objetivos||[]).length>0 && ej.ejercicio_id) {
        resolverViaEjecucionClase(pid, item.objetivos, ej.ejercicio_id, cumplido)
      }
      return {...s,datos}
    }))
  }

  async function guardarEjecucion(pid:string, ejercicioId:string, items:any){
    if (!ejercicioId) return
    const { error } = await supabase.from('ejecucion_paciente').upsert({
      paciente_id: pid, ejercicio_id: ejercicioId, items,
      fecha: new Date().toISOString().slice(0,10), updated_at: new Date().toISOString(),
    }, { onConflict: 'paciente_id,ejercicio_id' })
    if (error) console.error('guardarEjecucion', error.message)
  }

  function marcarTodosItems(pid:string, ei:number, valor:boolean){
    setSeleccion(prev => prev.map(s=>{
      if (s.paciente.id!==pid) return s
      const datos=[...s.datos]
      const ej = datos[ei]; if(!ej) return s
      const iv:any = {}
      ;(ej.items||[]).forEach((it:any)=>{
        const texto = typeof it==='string' ? it : it?.texto
        if (texto) iv[texto] = valor
      })
      datos[ei]={...ej,items_evaluados:valor?iv:{},guardado:false,precargado:false}
      programarAutosave(pid,ei,datos[ei],s.sesionId)
      guardarEjecucion(pid, ej.ejercicio_id, valor?iv:{})
      return {...s,datos}
    }))
  }

  /**
   * `itemArg` permite cerrar a alguien que ya no esta en pantalla (la clase anterior
   * que quedo sin guardar). `fechaC` es el dia de ESA clase, no el que se esta mirando.
   * Devuelve true si se cerro.
   */
  async function finalizarPaciente(pid:string, itemArg?:any): Promise<boolean>{
    const item = itemArg || seleccion.find(s=>s.paciente.id===pid); if(!item) return false
    const fechaC: string = item.fechaClase || fecha
    // Borradores de otro dia de esta misma sesion: se cierran antes con su fecha, si
    // no chocan con los de hoy (un solo borrador por ejercicio y sesion).
    const { data: otrosDias } = await supabase.from('registros_ejercicio')
      .select('id,paciente_id,ejercicio_id,fecha').eq('paciente_id', pid).eq('sesion_id', item.sesionId)
      .eq('finalizado', false).neq('fecha', fechaC)
    for (const r of (otrosDias || [])) await cerrarBorrador(r)
    // forzar guardado de todo lo lleno
    Object.keys(timers.current).forEach(k=>{ if(k.startsWith(pid+'_')){ clearTimeout(timers.current[k]); delete timers.current[k] } })
    const noHizo = leerNoHechos(pid, item.sesionId)
    for (let i=0;i<item.datos.length;i++){
      if (noHizo.includes(i)) continue
      const ej=item.datos[i]
      const llenas=ej.series.filter((x:any)=>x.peso!==''||x.reps!==''||(x.segundos!==''&&x.segundos!==undefined))
      const hayComent=(ej.comentario||'').trim()!==''
      if (llenas.length>0 || hayComent) await autoguardar(pid,i,ej,item.sesionId)
    }
    /**
     * LO QUE NO SE MARCO COMO "NO LO HIZO", SE HIZO.
     *
     * Antes solo quedaba registro de lo que tenia cifras o comentario: unos burpees o
     * una cuerda, que no se miden, no constaban nunca, y para la dosis de los objetivos
     * era como si no se hubieran hecho. Ahora cada ejercicio hecho deja su registro,
     * sin series si no se apunto ninguna: consta que se hizo, sin inventar cifras.
     */
    const { data: yaHay } = await supabase.from('registros_ejercicio')
      .select('ejercicio_id,ejercicio_nombre,variante')
      .eq('paciente_id', pid).eq('sesion_id', item.sesionId).eq('finalizado', false)
    /**
     * LA CLAVE ES LA DEL INDICE DE LA BASE, NO OTRA.
     *
     * `uniq_regej_borrador` admite un solo borrador por paciente, EJERCICIO y sesion,
     * sin mirar la variante. Aqui se comparaba ademas por variante, y un mismo ejercicio
     * que sale dos veces en la sesion (en dos bloques, o en circuito y suelto) generaba
     * dos filas iguales: "duplicate key value violates unique constraint
     * uniq_regej_borrador" al finalizar, y la clase se quedaba sin cerrar. Paso con tres
     * pacientes el 1 de octubre a las 21:00.
     *
     * Ahora: por ejercicio si lo tiene (como el indice), por nombre si no; y cada clave
     * una sola vez. El registro vacio solo dice "se hizo", asi que con uno basta.
     */
    const claveReg = (id: any, nombre: any) => id ? `id:${id}` : `n:${nombre || ''}`
    const existentes = new Set((yaHay || []).map((r: any) => claveReg(r.ejercicio_id, r.ejercicio_nombre)))
    const vacios: any[] = []
    item.datos.forEach((ej: any, i: number) => {
      if (noHizo.includes(i)) return
      const k = claveReg(ej.ejercicio_id, ej.nombre)
      if (existentes.has(k)) return
      existentes.add(k)
      /* LO QUE SE VE EN GRIS ES LO QUE SE GUARDA. Una sola regla: el gris es lo
         ultimo anotado de ese ejercicio o, si nunca se anoto, lo de la sesion. Si no
         se toca, se hizo eso. Sin nada de base (ni historial ni sesion), consta que se
         hizo sin inventar cifras. */
      const lleno = (x: any) => x != null && String(x).trim() !== ''
      const seriesPlan = (ej.series || []).filter((x: any) => lleno(x?.peso) || lleno(x?.reps) || lleno(x?.segundos))
      vacios.push({
        paciente_id: pid, ejercicio_id: ej.ejercicio_id || null, ejercicio_nombre: ej.nombre,
        sesion_id: item.sesionId, series: seriesPlan,
        // Lo que haya en pantalla, no vacio: al volver a finalizar una clase ya
        // finalizada se borran los registros del dia y se rehacen desde aqui, y con
        // null se perdian la nota y la ejecucion de los ejercicios no retocados.
        comentario: (ej.comentario || '').trim() || null, items_evaluados: ej.items_evaluados || {}, finalizado: false,
        regimen: ej.regimen || ej.plan?.regimen || null, variante: ej.variante || null,
        // El dia de la clase, no el de hoy: si se finaliza al dia siguiente, la base
        // le pondria la fecha de hoy y la clase quedaria partida en dos dias.
        fecha: fechaC,
      })
    })
    if (vacios.length) {
      const { error } = await supabase.from('registros_ejercicio').insert(vacios)
      if (error) { alert('Error al finalizar: ' + error.message); return false }
    }
    // limpiar finalizados previos del dia y marcar
    const ids = item.datos.map((e:any)=>e.ejercicio_id).filter(Boolean)
    if (ids.length){
      await supabase.from('registros_ejercicio').delete()
        .eq('paciente_id',pid).eq('fecha',fechaC).eq('finalizado',true).in('ejercicio_id',ids)
    }
    const { error } = await supabase.from('registros_ejercicio')
      .update({ finalizado:true })
      .eq('paciente_id',pid).eq('sesion_id',item.sesionId).eq('finalizado',false)
    if (error){ alert('Error al finalizar: '+error.message); return false }
    setSeleccion(prev => prev.map(s=>s.paciente.id===pid?{...s,finalizado:true}:s))
    setPendClase(prev => prev.filter((x:any) => !(x.paciente.id===pid && x.citaId===item.citaId)))
    return true
  }

  /** Quien de esta lista se cierra con "Finalizar clase": con sesion, sin cerrar, y que vino. */
  const porCerrar = (lista:any[]) => lista.filter((x:any) => x.sesionId && !x.finalizado && x.estado !== 'falta')

  /**
   * FINALIZAR LA CLASE ENTERA. Ir paciente a paciente se olvidaba; esto cierra a todos
   * los de la franja de una vez, con la misma regla (lo gris se guarda). El boton de
   * cada paciente sigue para quien se va antes.
   */
  async function finalizarClase(lista:any[]) {
    const quienes = porCerrar(lista)
    if (quienes.length === 0) return
    if (!confirm(`Se guardará la clase de ${quienes.length} ${quienes.length===1?'persona':'personas'}: ${quienes.map((x:any)=>nombrePac(x.paciente)).join(', ')}.\n\nLo que no se haya apuntado se guarda tal como sale en gris.`)) return
    setCerrandoClase(true)
    for (const q of quienes) await finalizarPaciente(q.paciente.id, q)
    setCerrandoClase(false)
  }

  const act = seleccion.find(s=>s.paciente.id===activo)
  const hojaAct = act?.sesionId ? hojas[act.sesionId] : null
  useEffect(() => {
    const sid = act?.sesionId, pid = act?.paciente?.id
    if (!sid || !pid) return
    if (!(sid in hojas)) {
      supabase.from('sesiones').select('hoja').eq('id', sid).maybeSingle().then(({ data, error }) => {
        if (error) return
        setHojas(prev => ({ ...prev, [sid]: data?.hoja ? leerHoja(data.hoja) : null }))
      })
    }
    const k = claveHechos(pid, sid)
    if (!(k in hechosHoja)) {
      let guardados: Record<string, string> = {}
      try { guardados = JSON.parse(sessionStorage.getItem(k) || '{}') } catch {}
      setHechosHoja(prev => ({ ...prev, [k]: guardados }))
    }
  }, [act?.sesionId, act?.paciente?.id, fecha]) // eslint-disable-line react-hooks/exhaustive-deps

  function apuntarHoja(pid: string, sid: string, casilla: string, valor: string) {
    const k = claveHechos(pid, sid)
    setHechosHoja(prev => {
      const nuevo = { ...(prev[k] || {}), [casilla]: valor }
      try { sessionStorage.setItem(k, JSON.stringify(nuevo)) } catch {}
      return { ...prev, [k]: nuevo }
    })
  }

  /**
   * Lo apuntado en la hoja pasa a `registros_ejercicio`, ya finalizado. Se borra antes lo
   * de esta sesion y este dia: si se finaliza dos veces (se corrigio una cifra), la
   * segunda sustituye a la primera en vez de duplicar el entrenamiento.
   */
  async function finalizarHoja(pid: string, sid: string, h: Hoja) {
    // Dos pegatinas del mismo ejercicio son UNA fila: `uniq_regej_finalizado_dia` admite
    // un registro finalizado por ejercicio y dia. Se juntan sus series.
    const porEj: Record<string, any> = {}
    const filas: any[] = []
    for (const f of registrosDeHoja(h, hechosHoja[claveHechos(pid, sid)] || {})) {
      if (f.ejercicio_id && porEj[f.ejercicio_id]) {
        porEj[f.ejercicio_id].series = [...porEj[f.ejercicio_id].series, ...f.series]
        porEj[f.ejercicio_id].comentario = [porEj[f.ejercicio_id].comentario, f.comentario].filter(Boolean).join(' · ') || null
        continue
      }
      if (f.ejercicio_id) porEj[f.ejercicio_id] = f
      filas.push(f)
    }
    if (filas.length === 0 && !confirm('No hay nada apuntado en la hoja. ¿Finalizar igual?')) return
    const { error: e1 } = await supabase.from('registros_ejercicio').delete()
      .eq('paciente_id', pid).eq('sesion_id', sid).eq('fecha', fecha)
    if (e1) { alert('Error al finalizar: ' + e1.message); return }
    if (filas.length) {
      const { error } = await supabase.from('registros_ejercicio')
        .insert(filas.map(f => ({ ...f, paciente_id: pid, sesion_id: sid, finalizado: true, items_evaluados: {}, fecha })))
      if (error) { alert('Error al finalizar: ' + error.message); return }
    }
    try { sessionStorage.removeItem(claveHechos(pid, sid)) } catch {}
    setSeleccion(prev => prev.map(s => s.paciente.id === pid ? { ...s, finalizado: true } : s))
  }
  // Derivado de la lista, no guardado: al poner una sesión, el número baja solo.
  const sinSesion = seleccion.filter(s=>!s.sesionId).length
  const progreso = (s:any)=> s.datos.length ? `${s.datos.filter((e:any)=>e.guardado).length}/${s.datos.length}` : ''

  return (
    <>
      {/* CABECERA CLASE */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'9px 13px',flexWrap:'wrap'}}>
        <span style={{fontSize:12,fontWeight:500,color:'var(--n)',display:'inline-flex',alignItems:'center',gap:6}}><Ic name="taller" size={14}/> Taller</span>
        {pendientes>0 ? (
          <span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--ambl)',color:'#7A5800',border:'1px solid var(--amb)',display:'inline-flex',alignItems:'center',gap:4}}>
            <Ic name="reloj" size={9}/> Guardando…
          </span>
        ) : ultimoGuardado ? (
          <span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--gl)',color:'var(--gd)',border:'1px solid var(--g)',display:'inline-flex',alignItems:'center',gap:4}}>
            <Ic name="check" size={9}/> Guardado {ultimoGuardado.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}
          </span>
        ) : null}
        <input type="date" className="input" value={fecha} onChange={e=>setFecha(e.target.value)} style={{maxWidth:150,fontSize:11}}/>
        {salas.length>1 && (
          <select className="input" value={sala} onChange={e=>setSala(e.target.value)} style={{maxWidth:110,fontSize:11}}>
            <option value="">Todas las salas</option>
            {salas.map(x=><option key={x} value={x}>Sala {x}</option>)}
          </select>
        )}
        <select className="input" value={hora} onChange={e=>setHora(e.target.value)} style={{maxWidth:150,fontSize:11}}>
          <option value="">Todo el día</option>
          {horas.map(h=><option key={h.hora} value={h.hora}>{h.hora} · {h.n}</option>)}
        </select>
        <span style={{fontSize:10,color:sinSesion>0?'var(--gd)':'var(--grl)'}}>
          {trayendo ? 'Cargando…' : avisoAgenda || (seleccion.length
            ? `${seleccion.length} ${hora ? 'a las '+hora : 'hoy'}${sala?' · sala '+sala:''}` +
              (sinSesion>0 ? ` · a ${sinSesion} le${sinSesion>1?'s':''} falta sesión` : '')
            : '')}
        </span>
        <div style={{flex:1}}/>
        {porCerrar(seleccion).length > 0 && (
          <button className="btn btn-p btn-sm" disabled={cerrandoClase} onClick={()=>finalizarClase(seleccion)}
            title="Guarda y finaliza a todos los de esta franja">
            {cerrandoClase ? 'Guardando…' : `✓ Finalizar clase · ${porCerrar(seleccion).length}`}
          </button>
        )}
      </div>

      {viejos.length > 0 && (() => {
        const quien = Array.from(new Map(viejos.map((r:any) => {
          const p = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes
          const n = (p?.nombre_clinica || `${p?.nombre||''} ${p?.apellidos||''}`).trim() || 'Paciente'
          const d = new Date(r.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})
          return [r.paciente_id+'|'+r.fecha, `${n} (${d})`]
        })).values())
        return (
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:10,padding:'9px 12px',
            borderRadius:8,background:'var(--ambl)',border:'1px solid var(--amb)',color:'#7A5800',fontSize:12.5}}>
            <Ic name="alerta" size={14}/>
            <span style={{flex:1,minWidth:200,lineHeight:1.5}}>
              <b>Clases de días anteriores sin guardar</b> · {quien.join(', ')}.
              {' '}Si no se guardan, lo apuntado no cuenta como hecho.
            </span>
            <button className="btn btn-s btn-sm" disabled={guardandoViejos} onClick={descartarViejos}>Descartar</button>
            <button className="btn btn-p btn-sm" disabled={guardandoViejos} onClick={guardarViejos}>
              {guardandoViejos ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )
      })()}

      {pendClase.length > 0 && (
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:10,padding:'9px 12px',
          borderRadius:8,background:'var(--ambl)',border:'1px solid var(--amb)',color:'#7A5800',fontSize:12.5}}>
          <Ic name="alerta" size={14}/>
          <span style={{flex:1,minWidth:200,lineHeight:1.5}}>
            <b>Clase anterior sin guardar</b>
            {' · '}{Array.from(new Set(pendClase.map((x:any)=>x.hora).filter(Boolean))).join(', ')}
            {' · '}{pendClase.map((x:any)=>nombrePac(x.paciente)).join(', ')}.
            {' '}Si no se guarda, lo apuntado no cuenta como hecho.
          </span>
          <button className="btn btn-p btn-sm" disabled={cerrandoClase} onClick={()=>finalizarClase(pendClase)}>
            {cerrandoClase ? 'Guardando…' : 'Guardar ahora'}
          </button>
        </div>
      )}

      {/* CHIPS PACIENTES */}
      {seleccion.length>0 && (
        <div style={{position:'sticky',top:0,zIndex:20,display:'flex',gap:6,flexWrap:'wrap',
          marginBottom:12,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',
          padding:'8px 10px',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
          {/* Se queda fija al bajar: con cinco personas en la sala, volver arriba
              para cambiar de paciente es el scroll que mas se repite. */}
          {seleccion.map(s=>{
            const nGuardados = s.datos.filter((e:any)=>e.guardado).length
            const estado = s.finalizado ? 'fin' : (nGuardados>0 ? 'curso' : 'nada')
            const colorEstado = estado==='fin' ? 'var(--g)' : estado==='curso' ? 'var(--amb)' : 'var(--bm)'
            const activoChip = activo===s.paciente.id
            return (
            <div key={s.paciente.id} onClick={()=>setActivo(s.paciente.id)}
              title={estado==='fin'?'Finalizado':estado==='curso'?'En curso, sin finalizar':'Sin empezar'}
              /* EL SELECCIONADO VA EN OSCURO, el guardado en verde claro. Antes los dos
                 iban en el verde de la app (relleno uno, claro el otro) y en la sala se
                 confundian: no se sabia si estabas en ese paciente o si ya estaba hecho. */
              style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:99,cursor:'pointer',
                border:`1.5px solid ${activoChip?'var(--n)':(estado==='fin'?'var(--g)':'var(--bd)')}`,
                background:activoChip?'var(--n)':(estado==='fin'?'var(--gl)':'var(--w)'),
                color:activoChip?'var(--w)':(estado==='fin'?'var(--gd)':'var(--gr)'),
                boxShadow:activoChip?'0 2px 6px rgba(0,0,0,.18)':'none'}}>
              <span style={{width:7,height:7,borderRadius:'50%',flexShrink:0,background:colorEstado,boxShadow:activoChip?'0 0 0 1.5px var(--w)':'none'}}/>
              {s.finalizado&&<span style={{fontSize:9}}>✓</span>}
              {s.hora&&<span style={{fontSize:8,opacity:.75}}>{s.hora}</span>}
              {!s.sesionId&&<span style={{fontSize:8,opacity:.9}} title="Sin sesión">◦</span>}
              <span style={{fontSize:10,textDecoration:s.estado==='falta'?'line-through':'none',opacity:s.estado==='falta'?.55:1}}>{nombrePac(s.paciente)}</span>
              {!s.finalizado&&progreso(s)&&<span style={{fontSize:8,opacity:.8}}>{progreso(s)}</span>}
            </div>
            )
          })}
        </div>
      )}

      {/* CUERPO */}
      {seleccion.length===0 ? (
        <div style={{textAlign:'center',padding:60,color:'var(--grl)',fontSize:11}}>
          No hay nadie citado en esa franja. Cambia la hora o la sala arriba. Si alguien se pasa sin avisar, ponle la cita en la agenda y aparecerá aquí.
        </div>
      ) : !act ? (
        <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>Selecciona un paciente arriba para anotar su trabajo.</div>
      ) : (
        <div className="card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <div style={{minWidth:0,flexShrink:0}}>
              <div style={{fontSize:13,fontWeight:400,color:'var(--n)',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                <span>{nombrePac(act.paciente)}</span>
                {act.hora&&<span style={{fontSize:9,color:'var(--grl)',marginLeft:8}}>cita {act.hora}{act.sala?' · sala '+act.sala:''}</span>}
                {act.finalizado&&<span style={{fontSize:9,color:'var(--g)',marginLeft:8}}>✓ finalizado</span>}
                {/* LO QUE ESTÁ HACIENDO NO ES LO QUE SE LE PLANIFICÓ. Va aquí arriba y no
                    escondido junto al botón: quien entra a mitad de clase tiene que verlo
                    sin preguntar, porque cambia lo que se espera de la sesión. */}
                {/* LO QUE HAY QUE MEDIRLE HOY. Va con el nombre, no escondido: es parte de
                    lo que toca en esta clase, igual que la sesion. */}
                {((testsHoy[act.paciente.id]||[]).length + (sinTest[act.paciente.id]||[]).length)>0 && (()=>{
                  const suyos = testsHoy[act.paciente.id]||[]
                  // Los que se confirman mirandolos cuentan igual: si no salieran
                  // aqui se quedarian escondidos en la ficha justo por no tener test.
                  const otros = sinTest[act.paciente.id]||[]
                  const faltan = suyos.filter((x:any)=>x.hecho===false).length + otros.length
                  return (
                    <span style={{position:'relative'}}>
                      <button className="btn btn-s btn-sm" style={{gap:5,
                        borderColor: faltan>0?'var(--amb)':'var(--gm)',
                        color: faltan>0?'#7A5800':'var(--gd)'}}
                        title={[...suyos.map((x:any)=>x.test.nombre), ...otros.map((o:any)=>o.nombre)].join(', ')}
                        onClick={()=>{ if (suyos.length===1 && otros.length===0 && faltan>0) abrirTest(suyos[0]); else setListaTests(v=>v===false) }}>
                        <Ic name="informe" size={13}/>
                        {faltan>0 ? `${faltan} por comprobar` : 'comprobado'}
                      </button>
                      {/* Absoluto y no `menu-flot`, que es `position:fixed`: con top:100%
                          se iba al fondo de la pantalla y parecia que el boton no hacia nada. */}
                      {listaTests && (
                        <div style={{position:'absolute',top:'calc(100% + 5px)',left:0,zIndex:60,
                          minWidth:250,background:'var(--w)',border:'1px solid var(--bd)',
                          borderRadius:'var(--r)',boxShadow:'var(--sh-md)',padding:4}}>
                          {suyos.map((x:any)=>(
                            <button key={x.test.id} className="menu-it" style={{width:'100%',textAlign:'left'}}
                              onClick={()=>abrirTest(x)}>
                              <span style={{display:'flex',alignItems:'center',gap:7}}>
                                <span style={{color:x.hecho?'var(--gd)':'var(--grl)',width:11}}>{x.hecho?'✓':'·'}</span>
                                <span style={{flex:1,minWidth:0}}>
                                  <span style={{fontSize:12,color:'var(--n)',display:'block'}}>{x.test.nombre}</span>
                                  {/* Si el objetivo cuelga de un item suelto, solo se mide ese. */}
                                  {x.items.length>0 && (
                                    <span style={{fontSize:10.5,color:'var(--gd)',display:'block'}}>{x.items.join(' · ')}</span>
                                  )}
                                  {x.motivo==='mantenimiento' && (
                                    <span style={{fontSize:10,color:'#7A5800',display:'block'}}>
                                      se mantiene · {x.objetivos.join(' · ')}
                                    </span>
                                  )}
                                </span>
                              </span>
                            </button>
                          ))}
                          {otros.length>0 && suyos.length>0 && (
                            <div style={{height:1,background:'var(--bd)',margin:'4px 0'}}/>
                          )}
                          {otros.map((o:any)=>(
                            <div key={o.objetivo_id} style={{padding:'6px 8px'}}>
                              <div style={{fontSize:12,color:'var(--n)'}}>{o.nombre}</div>
                              <div style={{fontSize:10,color:'#7A5800',marginBottom:5}}>
                                se mantiene · sin test, se mira
                              </div>
                              <div style={{display:'flex',gap:6}}>
                                <button className="btn btn-s btn-sm"
                                  onClick={()=>confirmar(act.paciente.id, o)}>Sigue bien</button>
                                <button className="btn btn-s btn-sm"
                                  style={{borderColor:'var(--bd)',color:'var(--gr)'}}
                                  onClick={()=>perdido(act.paciente.id, o)}>Lo ha perdido</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </span>
                  )
                })()}
                {act.citaId && cambios[act.citaId] && (()=>{
                  const c = cambios[act.citaId]
                  return (
                    <span title={`Antes: «${c.sesion_antes_nombre || '—'}»${c.nota ? '\n\n' + c.nota : ''}`}
                      style={{fontSize:9,fontWeight:600,padding:'2px 9px',borderRadius:99,whiteSpace:'nowrap',
                        background:'#EFE7F7',color:'#5B3E86',border:'1px solid #D6C4E8',
                        display:'inline-flex',alignItems:'center',gap:4}}>
                      <Ic name="cambio" size={10}/> Cambiada · {nombreMotivo(c.motivo).toLowerCase()}
                    </span>
                  )
                })()}
              </div>
            </div>
            <div style={{flex:1,display:'flex',justifyContent:'center'}}>
              {/* Las patologias, molestias y alertas de este paciente, y los objetivos
                  de la sesion con su moneda. Ver `IconosContexto`. */}
              <IconosContexto ctx={ctxPorPaciente[act.paciente.id] || {}} sesionId={act.sesionId}/>
            </div>
            {/* UN SOLO BOTÓN. Elegir de dónde, y el taller te lleva a la pantalla que ya
                existe para eso. Al asignar allí, vuelves aquí. */}
            <div style={{position:'relative'}}>
              <button className={act.sesionId ? 'btn btn-s btn-sm' : 'btn btn-p btn-sm'}
                onClick={()=>setEligiendo(eligiendo===act.paciente.id ? null : act.paciente.id)}
                style={{fontSize:11,maxWidth:300}}>
                <Ic name="fuerza" size={12}/> {act.sesionId
                  ? (act.sesiones.find((x:any)=>x.id===act.sesionId)?.nombre || 'Sesión')
                  : 'Asignar sesión'}
              </button>
              {eligiendo===act.paciente.id && (
                <div style={{position:'absolute',top:'100%',right:0,zIndex:30,marginTop:4,minWidth:190,
                  border:'1px solid var(--bd)',borderRadius:8,background:'var(--w)',boxShadow:'0 4px 16px rgba(0,0,0,.12)',overflow:'hidden'}}>
                  {([['ficha','Sus sesiones'],['biblioteca','Biblioteca']] as const).map(([d,l])=>(
                    <div key={d} onClick={()=>{
                      setEligiendo(null)
                      const encargo = {
                        citaId: act.citaId, pacienteId: act.paciente.id,
                        etiqueta: nombrePac(act.paciente) + (act.hora ? ' · ' + act.hora : ''),
                        volver: '/taller',
                      }
                      /**
                       * SI YA TENÍA SESIÓN, PRIMERO EL PORQUÉ.
                       *
                       * Poner una sesión en una cita vacía no hay que justificarlo. Cambiar
                       * la que estaba planificada, sí: eso es una decisión clínica que se
                       * toma con el paciente delante, y era justo lo único que no quedaba
                       * escrito en ningún sitio. Un mes después la cita apuntaba a la sesión
                       * nueva y no había forma de distinguirla de una planificada así.
                       *
                       * Se pregunta aquí y no en la biblioteca porque aquí es donde está el
                       * paciente. Al llegar al catálogo de sesiones uno ya está pensando en
                       * cuál elegir, no en por qué venía.
                       */
                      const puesta = act.sesiones.find((x:any)=>x.id===act.sesionId)
                      if (act.sesionId && act.citaId) {
                        setCambiando({ destino:d, encargo, motivo:'', nota:'',
                          antesId: act.sesionId, antesNombre: puesta?.nombre || '' })
                        return
                      }
                      router.push(rutaDeAsignacion(d as any, encargo))
                    }} style={{padding:'9px 12px',cursor:'pointer',fontSize:11,borderBottom:'1px solid var(--bl)'}}
                      onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'}
                      onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>{l}</div>
                  ))}
                  {/* QUITARLA SIN PONER OTRA. Antes cambiar obligaba a elegir una nueva,
                      asi que para dejar a alguien hoy sin sesion no habia forma: la de la
                      cita seguia saliendo. Pide motivo igual que un cambio. */}
                  {act.sesionId && act.citaId && (
                    <div onClick={()=>{
                      setEligiendo(null)
                      const puesta = act.sesiones.find((x:any)=>x.id===act.sesionId)
                      setCambiando({ destino:'quitar', encargo:{ citaId: act.citaId, pacienteId: act.paciente.id },
                        motivo:'', nota:'', antesId: act.sesionId, antesNombre: puesta?.nombre || '' })
                    }} style={{padding:'9px 12px',cursor:'pointer',fontSize:11,color:'var(--red)'}}
                      onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--redl)'}
                      onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>Quitar, hoy sin sesión</div>
                  )}
                </div>
              )}
            </div>
            {act.sesionId && hojaAct && (
              <button className="btn btn-p btn-sm" onClick={()=>finalizarHoja(act.paciente.id, act.sesionId, hojaAct)}>✓ Guardar y finalizar</button>
            )}
            {act.sesionId && !hojaAct && act.datos.length>0 && (
              <button className="btn btn-p btn-sm" onClick={()=>finalizarPaciente(act.paciente.id)}>✓ Guardar y finalizar</button>
            )}
          </div>

          {act.sesionVieja && act.sesionId && (
            <div style={{fontSize:10,color:'var(--gd)',background:'var(--gl)',border:'1px solid var(--bd)',borderRadius:6,padding:'6px 9px',marginBottom:8}}>
              La sesión de esta cita es de una tanda anterior. Se ejecuta igual —es lo que se planificó para hoy—, pero si ya no toca, elige otra arriba.
            </div>
          )}

          {!act.sesionId ? (
            <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:10}}>Sin sesión para hoy. Dale a <b style={{color:'var(--gr)'}}>Asignar sesión</b> arriba.</div>
          ) : hojaAct ? (
            /* La hoja tal cual se dibujo; solo sus casillas se pueden tocar. */
            <HojaLibre modo="taller" hoja={hojaAct} biblioteca={[]} objetivos={[]}
              hechos={hechosHoja[claveHechos(act.paciente.id, act.sesionId)] || {}}
              onHecho={(c, v)=>apuntarHoja(act.paciente.id, act.sesionId, c, v)}/>
          ) : !(act.sesionId in hojas) ? (
            <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:10}}>Cargando…</div>
          ) : act.datos.length===0 ? (
            <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:10}}>Esta sesión no tiene ejercicios.</div>
          ) : act.datos.map((ej:any,ei:number)=>{
            const partePrev = ei>0 ? (act.datos[ei-1].parte||'') : null
            const mostrarParte = ei===0 || (ej.parte||'') !== partePrev
            /* TODA LA PARTE DE UNA VEZ, de izquierda a derecha. Nacio para el
               circuito -que se anota cruzando- y se lee mejor tambien en lo
               demas: la parte entera de un vistazo, sin fondos ni recuadros, y
               las siguientes debajo. Ver `RejillaParte`. */
            const delaParte = act.datos.map((x:any,i:number)=>({ej:x, ei:i}))
              .filter((o:any)=>(o.ej.parte||'') === (ej.parte||''))
            if (!mostrarParte) return null
            const kPlegada = `${act.paciente.id}|${ei}|${ej.parte||''}`
            const plegada = plegadas.has(kPlegada)
            return (
            <div key={'w'+ei}>
            {(ej.parte||'') !== '' && (
              /* LA CABECERA DE LA PARTE, VISIBLE. En 9px y gris se perdia entre
                 las fotos, y es lo que dice como se trabaja ese bloque. */
              <div role="button" tabIndex={0} aria-expanded={!plegada}
                onClick={()=>alternarPlegada(kPlegada)}
                onKeyDown={e=>{ if (e.key==='Enter'||e.key===' ') { e.preventDefault(); alternarPlegada(kPlegada) } }}
                style={{margin:'20px 0 9px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',
                background:'var(--bl)',borderLeft:'3px solid var(--g)',borderRadius:'0 7px 7px 0',
                padding:'8px 12px',cursor:'pointer',userSelect:'none'}}>
                <span style={{fontSize:13,fontWeight:600,color:'var(--n)',letterSpacing:.2}}>{ej.parte}</span>
                {ej.parteObj && (
                  <span style={{fontSize:12.5,color:'var(--gd)',display:'inline-flex',alignItems:'center',gap:5}}>
                    <Ic name={modoParte(ej.parteObj.modo).icono} size={13}/> {textoModo(ej.parteObj)}
                  </span>
                )}
                {ej.parteObj && descansoDeParte(ej.parteObj) && (
                  <span style={{fontSize:12.5,color:'var(--gr)',display:'inline-flex',alignItems:'center',gap:5}}>
                    <Ic name="pausa" size={13}/> {descansoDeParte(ej.parteObj)!.texto} {descansoDeParte(ej.parteObj)!.cuando}
                  </span>
                )}
                {ej.parteObj && transicionDeParte(ej.parteObj) && (
                  <span style={{fontSize:12.5,color:'var(--gr)',display:'inline-flex',alignItems:'center',gap:5}}>
                    <Ic name="pausa" size={13}/> {transicionDeParte(ej.parteObj)!.texto} {transicionDeParte(ej.parteObj)!.cuando}
                  </span>
                )}
                {/* La flecha a la derecha: toda la cabecera pliega, la flecha solo lo dice. */}
                <span style={{marginLeft:'auto',display:'inline-flex',alignItems:'center',gap:8,fontSize:12,color:'var(--gr)'}}>
                  {plegada && <span>{delaParte.length} ejercicio{delaParte.length!==1?'s':''}</span>}
                  <Ic name="abajo" size={14} style={{transform:plegada?'rotate(-90deg)':'none',transition:'transform .15s'}}/>
                </span>
              </div>
            )}
            {plegada ? (
              /* Plegado se leen los nombres: sirve de recordatorio sin ocupar la pantalla. */
              <div style={{margin:'-3px 0 14px',paddingLeft:17,fontSize:11.5,color:'var(--grl)',lineHeight:1.6}}>
                {delaParte.map((o:any)=>o.ej.nombre).join(' · ')}
              </div>
            ) : <RejillaParte pacienteId={act.paciente.id} ejercicios={delaParte}
              superserie={ej.parteObj?.modo==='superserie'}
              mutarSerie={mutarSerie} setComent={setComent} toggleItem={toggleItem}
              marcarTodosItems={marcarTodosItems} itemMarcado={itemMarcado}
              addSerie={addSerie} quitarSerie={quitarSerie} setRegimen={setRegimen}
              molestias={(ctxPorPaciente[act.paciente.id]?.molestias)||[]}
              patologias={(ctxPorPaciente[act.paciente.id]?.patologias)||[]} etiquetas={etiquetas}
              objetivosLib={objetivosLib} objsPac={objsPorPaciente[act.paciente.id]||[]}
              toggleObjetivo={toggleObjetivo}
              noHechos={leerNoHechos(act.paciente.id, act.sesionId)}
              onNoHecho={(i:number)=>alternarNoHecho(act.paciente.id, act.sesionId, i)}
              onSustituir={(i:number)=>abrirSustituir(act.paciente.id, i)}/>}
            </div>
            )
          })}
        </div>
      )}

      {/* ELEGIR EL EJERCICIO QUE SE HACE HOY EN SU LUGAR */}
      {sustituyendo && (
        <div className="modal-bg" style={{zIndex:150}} onClick={e=>{if(e.target===e.currentTarget)setSustituyendo(null)}}>
          <div className="modal" style={{width:'min(900px, 96vw)',maxHeight:'90vh',overflowY:'auto'}}>
            <div className="modal-title">
              Cambiar «{seleccion.find((x:any)=>x.paciente.id===sustituyendo.pid)?.datos?.[sustituyendo.i]?.nombre}» solo hoy
              <button className="modal-close" onClick={()=>setSustituyendo(null)}>✕</button>
            </div>
            {catalogoEj.length === 0
              ? <div className="muted" style={{padding:20}}>Cargando ejercicios…</div>
              : <ExploradorEjercicios ejercicios={catalogoEj} etiquetas={etiquetas} botonCrear={false}
                  onAbrir={(ej:any)=>sustituir(sustituyendo.pid, sustituyendo.i, ej)}/>}
          </div>
        </div>
      )}

      {/* POR QUÉ SE CAMBIA LA SESIÓN
          Sale antes de ir a elegir la nueva. El motivo viaja en el encargo y lo escribe
          `asignarSesionYVolver`, que es quien toca la cita: si se preguntara al volver,
          bastaría con cerrar la pestaña para que el cambio quedara sin explicación. */}
      {cambiando && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setCambiando(null)}}>
          <div className="modal" style={{width:460}}>
            <div className="modal-title">
              ¿Por qué cambias la sesión?
              <button className="modal-close" onClick={()=>setCambiando(null)}>✕</button>
            </div>
            <div style={{fontSize:11,color:'var(--gr)',marginBottom:14}}>
              Tenía puesta <b style={{fontWeight:600,color:'var(--n)'}}>«{cambiando.antesNombre || 'una sesión'}»</b>.
              Queda anotado en su historial junto con lo que elijas.
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:12}}>
              {MOTIVOS_CAMBIO.map(m=>(
                <button key={m.id} title={m.ayuda}
                  onClick={()=>setCambiando((p:any)=>({...p,motivo:p.motivo===m.id?'':m.id}))}
                  className={`chip-sel ${cambiando.motivo===m.id?'on':''}`}>
                  {m.nombre}
                </button>
              ))}
            </div>
            <div className="field">
              <label>Nota {cambiando.motivo==='otro' ? '*' : '(opcional)'}</label>
              <textarea className="input" value={cambiando.nota} autoFocus
                onChange={e=>setCambiando((p:any)=>({...p,nota:e.target.value}))}
                placeholder="Ej: fue a correr por la mañana y no tiene bien las piernas"
                style={{minHeight:56,fontSize:12}}/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:10,alignItems:'center'}}>
              <button className="btn btn-d btn-sm" onClick={()=>setCambiando(null)}>Cancelar</button>
              <div style={{flex:1}}/>
              {/* Sin motivo no se sale. Si se pudiera saltar, en tres semanas la mitad
                  estarían sin motivo y el registro no valdría para nada. */}
              <button className="btn btn-p btn-sm"
                disabled={!cambiando.motivo || (cambiando.motivo==='otro' && !cambiando.nota.trim())}
                onClick={async ()=>{
                  const c = cambiando
                  setCambiando(null)
                  if (c.destino === 'quitar') {
                    const { error } = await supabase.from('citas').update({ sesion_id: null }).eq('id', c.encargo.citaId)
                    if (error) { alert('No se ha podido quitar la sesión: ' + error.message); return }
                    await registrarCambio({ citaId: c.encargo.citaId, pacienteId: c.encargo.pacienteId, fecha,
                      antesId: c.antesId, antesNombre: c.antesNombre, despuesId: null, despuesNombre: null,
                      motivo: c.motivo, nota: c.nota })
                    setSeleccion(prev => prev.map(s => s.citaId === c.encargo.citaId
                      ? { ...s, sesionId: '', datos: [], cargado: false, objetivosSesion: [] } : s))
                    return
                  }
                  router.push(rutaDeAsignacion(c.destino, {
                    ...c.encargo,
                    antesId: c.antesId, antesNombre: c.antesNombre,
                    motivo: c.motivo, nota: c.nota.trim() || undefined,
                  }))
                }}>
                {cambiando.destino === 'quitar' ? 'Quitar la sesión' : 'Elegir la nueva sesión'}
              </button>
            </div>
            {!cambiando.motivo && (
              <div style={{fontSize:10,color:'var(--grl)',marginTop:7,textAlign:'right'}}>
                Marca un motivo para continuar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* PASAR EL TEST · el mismo formulario que la ficha y la valoracion. Si el
          objetivo cuelga de un item suelto, solo se pinta ese: sacar los otros doce
          invita a rellenarlos por inercia. */}
      {testEnCurso && (
        <ModalRealizarTest
          test={testEnCurso.test} tv={testEnCurso.tv}
          soloItems={testEnCurso.items.length > 0 ? testEnCurso.items : undefined}
          paciente={{ id: act?.paciente?.id, sexo: act?.paciente?.sexo, fecha_nacimiento: act?.paciente?.fecha_nacimiento }}
          onCambiar={(tv:any)=>setTestEnCurso((p:any)=>({...p,tv}))}
          onCerrar={()=>setTestEnCurso(null)}
          pie={<>
            <button className="btn btn-d" onClick={()=>setTestEnCurso(null)} disabled={guardandoTest}>Cancelar</button>
            <button className="btn btn-p" onClick={guardarTest} disabled={guardandoTest}>
              {guardandoTest ? 'Guardando…' : <><Ic name="guardar" size={13}/> Guardar resultado</>}
            </button>
          </>}/>
      )}
    </>
  )
}
