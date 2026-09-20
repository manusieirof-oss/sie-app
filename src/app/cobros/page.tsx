'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Ic } from '@/lib/icons'
import ModalCobro from '@/components/ModalCobro'
import BuscadorPacientes from '@/components/BuscadorPacientes'
import { indicePlanes, precioFinalPlan, precioConDescuento, esVentaPuntual } from '@/lib/bonos'
import { listadoGestoria } from '@/lib/cobros'
import { resumirMes, type EntradaMes } from '@/lib/grupoMes'
import { cargarTarifas } from '@/lib/tarifas'
import { abrirFactura } from '@/lib/factura'
import { rangoDeMes, hoyISO } from '@/lib/fechas'
import Link from 'next/link'
import { contiene } from '@/lib/texto'

// Pilar Cobros. Quién ha pagado el mes y quién no, y desde aquí se cobra.
//
// VIVE FUERA DE FINANZAS A PROPÓSITO, con su propio permiso. Cobrar y ver el
// dinero de la clínica son dos cosas distintas: los empleados cobran a los
// pacientes y emiten facturas, pero no tienen por qué ver gastos, impuestos ni
// la cuenta de resultados. `permisos.cobros` abre esta pantalla;
// `permisos.finanzas` sigue abriendo solo Finanzas.
//
// El estado de pago sale de `v_bonos_pago`, o sea, de si existe un cobro que
// cubra ese bono. NO se lee `bonos.estado_pago`: ese campo queda solo para
// distinguir "pendiente" de "impago", que es un juicio, no un hecho.

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function CobrosPage() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean|null>(null)
  const [cargando, setCargando] = useState(true)
  const [fallos, setFallos] = useState<string[]>([])

  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth()+1)
  const [anio] = useState(hoy.getFullYear())

  const [pacientes, setPacientes] = useState<any[]>([])
  const [bonos, setBonos] = useState<any[]>([])
  const [bonosFuturos, setBonosFuturos] = useState<any[]>([])
  const [pago, setPago] = useState<Record<string, any>>({})
  const [planes, setPlanes] = useState<any[]>([])
  const [facturas, setFacturas] = useState<any[]>([])
  const [descuentos, setDescuentos] = useState<any[]>([])
  // Cuántas clases lleva cada paciente este mes, sacadas de la AGENDA.
  // Es el contraste que descubre a quien viene y no paga.
  const [clasesDe, setClasesDe] = useState<Record<string, number>>({})
  /**
   * LA AGENDA DEL MES, POR PERSONA Y NO POR CITA.
   *
   * Tres numeros que se leen en cadena: quien esta anotado, quien ya ha venido
   * de verdad y quien todavia no ha aparecido pero tiene fecha. VENIR ES
   * `realizada` y nada mas: ocho citas puestas y ninguna marcada no es haber
   * venido, es haberlo previsto.
   *
   * `vino` y `porVenir` no se solapan: quien ya vino no cuenta otra vez por
   * tener mas clases por delante. Asi los dos caben dentro del primero.
   */
  const [agenda, setAgenda] = useState({ anotados: 0, vino: 0, porVenir: 0 })
  /** Los mismos de arriba pero por id, que es lo que hace falta para cruzarlos con los bonos. */
  const [idsMes, setIdsMes] = useState<{ anotados: string[], vino: string[] }>({ anotados: [], vino: [] })
  /**
   * A QUIEN LE HAS COBRADO ALGO ESTE MES, con bono o sin el.
   *
   * Hacia falta porque toda esta pantalla se construye desde `bonos`, y un
   * servicio suelto no crea ninguno. Quien venia a una valoracion y la pagaba
   * se quedaba en "sin cuota" para siempre: factura emitida, y la pantalla
   * diciendo que no tiene nada.
   */
  const [cobradoMes, setCobradoMes] = useState<string[]>([])
  /** Qué le cobraste y por cuánto, para la fila de quien no tiene bono. */
  const [sueltosMes, setSueltosMes] = useState<Record<string, { total: number, conceptos: string[] }>>({})
  const [vinieronSinBono, setVinieronSinBono] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  // Tres vistas en vez de un interruptor. "Ver todos" sacaba también a quien no
  // tiene cuota ni ha venido, y eso es ruido: la lista va de cobrar el mes.
  const [vista, setVista] = useState<'pendientes'|'impagos'|'vinieron'|'todos'|'sincuota'>('pendientes')
  const [cobrando, setCobrando] = useState<any>(null)
  /**
   * COBRAR A QUIEN NO TIENE BONO.
   *
   * Una valoracion suelta, una sesion puntual, algo que se vende una vez: la
   * lista va por bono, asi que esa persona no tiene fila y no habia forma de
   * cobrarle. `ModalCobro` ya funciona sin bono —empieza con las lineas vacias
   * y tienes tus tarifas en "Anadir linea"—, solo faltaba la puerta.
   */
  const [eligiendo, setEligiendo] = useState(false)
  const [aviso, setAviso] = useState<string|null>(null)
  // Última factura emitida, para poder imprimirla sin buscarla.
  const [ultima, setUltima] = useState<string|null>(null)

  useEffect(() => { verificar() }, [])
  useEffect(() => { if (autorizado) cargar() }, [autorizado, mes])

  /**
   * COBRAR NO ES VER EL DINERO DE LA CLÍNICA.
   *
   * Quien tiene `cobros` cobra a los pacientes y emite facturas: para eso necesita ver el
   * importe de CADA paciente, o no sabe qué cobrar. Lo que no tiene por qué ver son los
   * agregados —cuánto hay pendiente en total, el listado completo para la gestoría—, que
   * son la foto económica de la clínica y no hacen falta para su trabajo.
   *
   * Esto es ocultar, no proteger: los datos siguen llegando al navegador. Para una persona
   * de confianza es lo razonable; si algún día tuviera que ser infranqueable, habría que
   * limitarlo con políticas en la base de datos.
   */
  const [veImportes, setVeImportes] = useState(false)
  /**
   * Pacientes que YA NO son clientes pero tienen cuota de este mes.
   *
   * Quien se da de baja empezado el mes conserva su cuota —el mes empezado se cobra— pero
   * Cobros solo cargaba activos y en pausa, así que su fila se caía de la lista al no
   * encontrar al paciente. La deuda seguía en la base y no la veía nadie: no se podía
   * cobrar ni marcar impago, y desaparecía del pendiente sin que nadie lo decidiera.
   *
   * Van aparte de `pacientes` a propósito: esa lista es la de clientes y de ella sale
   * "Sin cuota". Meter aquí a los de baja los acusaría de no tener bono cuando lo que
   * pasa es que ya no son clientes.
   */
  const [exClientes, setExClientes] = useState<any[]>([])

  async function verificar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) { router.push('/login'); return }
    const { data } = await supabase.from('perfiles').select('*').eq('user_id', user.id).maybeSingle()
    // Quien puede ver Finanzas puede cobrar; al revés no.
    setAutorizado(data?.rol === 'admin' || data?.permisos?.cobros === true || data?.permisos?.finanzas === true)
    setVeImportes(data?.rol === 'admin' || data?.permisos?.finanzas === true)
  }

  async function cargar() {
    setCargando(true); setFallos([])
    const [rp, rb, rfut, rpl, rf] = await Promise.all([
      // La dirección viene porque el modal de cobro la necesita: sin ella creería
      // que falta en todo el mundo y sacaría el aviso siempre, que es la forma
      // más rápida de que se deje de leer.
      supabase.from('pacientes')
        .select('id,nombre,apellidos,dni,estado,direccion,codigo_postal,localidad')
        .in('estado',['activo','pausa']).order('nombre'),
      // Solo los bonos vigentes: un paciente al que se le corrigió el bono a
      // mitad de mes tiene la fila vieja desactivada, y contarla sería cobrar dos veces.
      supabase.from('bonos').select('*').eq('mes', mes).eq('anio', anio).eq('activo', true),
      // Quién tiene ya bono de un mes POSTERIOR al que se mira. No entra en la
      // lista de cobros —todavía no hay nada que cobrarle— pero tampoco puede
      // salir como "le falta bono": no está olvidado, está programado.
      supabase.from('bonos').select('paciente_id,mes,anio').eq('activo', true)
        .or(`anio.gt.${anio},and(anio.eq.${anio},mes.gt.${mes})`),
      supabase.from('planes').select('*').eq('activo', true),
      // EL DESEMPATE POR `numero` NO ES COSMETICO. Ordenando solo por fecha, dos
      // facturas del mismo dia vuelven en orden arbitrario y la tarjeta podia
      // enseñar la 0012 cuando la ultima emitida fue la 0014. En una serie que
      // va numerada por ley, enseñar la que no es confunde de verdad.
      //
      // Va SIN filtro de mes a proposito: esto es "la ultima que emiti, para
      // imprimirla sin buscarla", no un dato del mes que estas mirando.
      supabase.from('facturas').select('id,serie,numero,fecha_expedicion,tipo,total,cobro_id')
        .order('fecha_expedicion',{ascending:false}).order('numero',{ascending:false}).limit(30),
    ])
    const errs = ([['pacientes',rp],['bonos',rb],['bonos futuros',rfut],['planes',rpl],['facturas',rf]] as const)
      .filter(([,r]) => r.error).map(([n,r]) => `${n}: ${r.error!.message}`)

    const tar = await cargarTarifas()
    if (tar.error) errs.push(`tarifas: ${tar.error}`)
    setDescuentos(tar.descuentos)

    // ---- CRUCE CON LA AGENDA ----------------------------------------------
    // Quién ha pisado la clínica este mes, tenga cuota o no. Sin esto, alguien
    // sin bono asignado no aparece en ningún sitio: ni en la lista de cobros,
    // ni en pendientes, ni en el total. Viene, entrena y no lo ve nadie.
    // Ver lib/fechas. Con el cálculo viejo, las clases del último día del mes
    // no se contaban: el recuento de "ha venido" se quedaba corto cada mes.
    const { desde: desdeM, hasta: hastaM } = rangoDeMes(anio, mes)
    /**
     * EL `.limit()` DEL CLIENTE NO SUBE EL TECHO DEL SERVIDOR.
     *
     * PostgREST corta TODA respuesta en `max-rows` —1000 en Supabase por
     * defecto— y no avisa de que ha cortado. Pedir `.limit(5000)` no cambia
     * eso: devuelve 1000 y se queda tan ancho. Con 1.468 citas en septiembre
     * se perdían casi 500, y la pantalla decía 141 personas donde había 152.
     *
     * El guardia de antes comparaba contra 5000, así que nunca saltaba: el
     * recuento se quedaba corto en el único sitio donde nadie miraba.
     *
     * Se pide por páginas hasta que una vuelve incompleta. El `.order('id')`
     * no es cosmético: sin un orden estable, dos páginas pueden repetir filas
     * y saltarse otras.
     */
    const PAGINA = 1000
    const TOPE_CITAS = 20000
    const citasMes: any[] = []
    for (let desde = 0; desde < TOPE_CITAS; desde += PAGINA) {
      const r = await supabase.from('citas')
        .select('paciente_id, estado, fecha, pacientes(nombre,apellidos)')
        .gte('fecha', desdeM).lte('fecha', hastaM)
        // 'falta' entra SOLO para el recuento de anotados: quien no se presentó
        // estaba en la agenda igual. No toca `clasesDe`, que se filtra debajo.
        .in('estado', ['realizada','programada','falta'])
        .order('id')
        .range(desde, desde + PAGINA - 1)
      if (r.error) { errs.push(`citas del mes: ${r.error.message}`); break }
      citasMes.push(...(r.data || []))
      if ((r.data?.length || 0) < PAGINA) break
    }
    if (citasMes.length >= TOPE_CITAS) {
      errs.push(`hay más de ${TOPE_CITAS} clases este mes y solo se han leído las primeras: el recuento se queda corto`)
    }

    const cuenta: Record<string, number> = {}
    const nombreDe: Record<string, string> = {}
    const hoy = hoyISO()
    const anotados = new Set<string>(), vino = new Set<string>(), futura = new Set<string>()
    ;citasMes.forEach((c: any) => {
      if (!c.paciente_id) return
      anotados.add(c.paciente_id)
      if (c.estado === 'realizada') vino.add(c.paciente_id)
      if (c.estado === 'programada' && c.fecha >= hoy) futura.add(c.paciente_id)
      // `clasesDe` cuenta lo de siempre: realizadas y programadas, nunca faltas.
      if (c.estado === 'realizada' || c.estado === 'programada') {
        cuenta[c.paciente_id] = (cuenta[c.paciente_id] || 0) + 1
      }
      if (c.pacientes) nombreDe[c.paciente_id] = `${c.pacientes.nombre} ${c.pacientes.apellidos}`
    })
    setClasesDe(cuenta)
    setAgenda({
      anotados: anotados.size,
      vino: vino.size,
      porVenir: Array.from(futura).filter(id => !vino.has(id)).length,
    })
    setIdsMes({ anotados: Array.from(anotados), vino: Array.from(vino) })

    // Cobros del mes, anulados fuera. Con su detalle, porque quien no tiene bono
    // necesita una fila y esa fila tiene que decir QUE le cobraste.
    const rcob = await supabase.from('cobros')
      .select('paciente_id, cobro_lineas(total, concepto)')
      .eq('anulado', false).gte('fecha', desdeM).lte('fecha', hastaM)
    if (rcob.error) errs.push(`cobros del mes: ${rcob.error.message}`)
    const det: Record<string, { total: number, conceptos: string[] }> = {}
    ;(rcob.data || []).forEach((c: any) => {
      if (!c.paciente_id) return
      const d = det[c.paciente_id] || (det[c.paciente_id] = { total: 0, conceptos: [] })
      ;(c.cobro_lineas || []).forEach((l: any) => {
        d.total += Number(l.total) || 0
        if (l.concepto && !d.conceptos.includes(l.concepto)) d.conceptos.push(l.concepto)
      })
    })
    const idsCobro = Object.keys(det)
    setSueltosMes(det)
    setCobradoMes(idsCobro)

    const conBono = new Set((rb.data || []).map((b:any) => b.paciente_id))
    setVinieronSinBono(
      Object.entries(cuenta)
        .filter(([pid]) => !conBono.has(pid))
        .map(([pid, n]) => ({ id: pid, nombre: nombreDe[pid] || 'Paciente', clases: n }))
        .sort((a, b) => b.clases - a.clases)
    )

    const ids = (rb.data || []).map((b:any) => b.id)
    let mapaPago: Record<string, any> = {}
    if (ids.length) {
      const rv = await supabase.from('v_bonos_pago').select('*').in('bono_id', ids)
      if (rv.error) errs.push(`estado de pago: ${rv.error.message}`)
      mapaPago = Object.fromEntries((rv.data || []).map((r:any) => [r.bono_id, r]))
    }

    setFallos(errs)
    // Los que tienen bono del mes y no están en la lista de clientes: se cargan aparte
    // para que su fila no se caiga. Una deuda no se cancela porque alguien deje de venir.
    const idsClientes = new Set((rp.data || []).map((x: any) => x.id))
    const faltan = Array.from(new Set([...(rb.data || []).map((b: any) => b.paciente_id), ...idsCobro]
      .filter((pid: string) => pid && !idsClientes.has(pid))))
    if (faltan.length > 0) {
      const rex = await supabase.from('pacientes')
        .select('id,nombre,apellidos,dni,estado').in('id', faltan)
      if (rex.error) errs.push(`ex clientes: ${rex.error.message}`)
      setExClientes(rex.data || [])
    } else setExClientes([])

    setPacientes(rp.data || []); setBonos(rb.data || []); setPlanes(rpl.data || [])
    setBonosFuturos(rfut.data || [])
    setFacturas(rf.data || []); setPago(mapaPago)
    setCargando(false)
  }

  const idx = useMemo(() => indicePlanes(planes), [planes])

  /**
   * LAS OCHO CASILLAS DEL MES.
   *
   * Aparte de la lista a proposito: la lista va por BONO y la filtra el
   * buscador; esto va por PERSONA y es la foto del mes, que no se mueve.
   */
  const resumen = useMemo(() => {
    const vinoSet = new Set(idsMes.vino)
    const cobrados = new Set(cobradoMes)
    const porPersona = new Map<string, EntradaMes>()
    bonos.forEach((b: any) => {
      if (!b.paciente_id) return
      const pagado = !!pago[b.id]?.pagado
      const nuevo = {
        pagado,
        impago: !pagado && b.estado_pago === 'impago',
        importe: precioConDescuento(precioFinalPlan(idx[b.tipo]), b),
        cobrado: Number(pago[b.id]?.neto_cobrado ?? 0),
      }
      const prev = porPersona.get(b.paciente_id)
      if (!prev || !prev.bono) {
        porPersona.set(b.paciente_id, { pacienteId: b.paciente_id, vino: vinoSet.has(b.paciente_id), bono: nuevo })
      } else {
        // Cuota Y sesiones la misma persona: se suman, y solo esta pagada si lo estan las dos.
        prev.bono = {
          pagado: prev.bono.pagado && nuevo.pagado,
          impago: prev.bono.impago || nuevo.impago,
          importe: prev.bono.importe + nuevo.importe,
          cobrado: prev.bono.cobrado + nuevo.cobrado,
        }
      }
    })
    // Quien esta en la agenda sin bono, y quien no esta en la agenda pero te ha
    // pagado algo: los dos existen y los dos tienen que caer en una casilla.
    const sueltos = Array.from(new Set([...idsMes.anotados, ...cobradoMes]))
    sueltos.forEach(id => {
      if (!porPersona.has(id)) {
        porPersona.set(id, { pacienteId: id, vino: vinoSet.has(id), bono: null, cobroSuelto: cobrados.has(id) })
      }
    })
    return resumirMes(Array.from(porPersona.values()))
  }, [bonos, pago, idx, idsMes, cobradoMes])
  // El índice incluye a los ex clientes: es lo que evita que sus filas se caigan.
  const pacienteDe = useMemo(
    () => Object.fromEntries([...pacientes, ...exClientes].map(p => [p.id, p])),
    [pacientes, exClientes])

  /**
   * UNA FILA POR BONO, no por paciente.
   *
   * Antes esto era un `Object.fromEntries(bonos.map(b => [b.paciente_id, b]))`,
   * que se queda con un solo bono por persona. Con un tipo de bono al mes no se
   * notaba; ahora alguien puede pagar su cuota de septiembre Y comprar ocho
   * sesiones en septiembre, y el segundo bono desaparecía del mapa sin más: no
   * salía en la lista, no se cobraba y no se facturaba. Dinero perdido en
   * silencio, que es la peor forma de perderlo.
   */
  /**
   * Todas las filas del mes, sin filtrar por vista. De aquí salen las tres
   * listas y los tres contadores, para que el número del botón y lo que ves al
   * pulsarlo no puedan discrepar.
   */
  const base = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return bonos
      .map(bono => {
        const p = pacienteDe[bono.paciente_id]
        const pagado = !!pago[bono.id]?.pagado
        const importe = precioConDescuento(precioFinalPlan(idx[bono.tipo]), bono)
        // Impago es un JUICIO sobre algo que sigue sin cobrarse: "vino y no paga".
        // Nunca lo contrario: "pagado" no se escribe a mano, sale del cobro.
        const impago = !pagado && bono?.estado_pago === 'impago'
        // Las clases son del PACIENTE, no del bono, y por eso se cuentan igual
        // en las dos filas: filtrar "han venido" y ordenar por urgencia miran a
        // la persona, y quien tiene un bono de sesiones sin pagar ha venido
        // exactamente igual que quien tiene la cuota sin pagar.
        //
        // Lo que no se puede es IMPRIMIR el número dos veces, que parecería el
        // doble de clases. Eso lo decide `mostrarClases`, que es cosa de la
        // vista y no del filtro. Meterlo en `clases` fue lo que se cargó el
        // filtro "Han venido": los bonos de sesiones nunca aparecían en él.
        const clases = clasesDe[bono.paciente_id] || 0
        /**
         * LO QUE SE COBRO, QUE NO ES LO QUE VALE.
         *
         * Un alta a mitad de mes paga media cuota: 33 de un bono de 66. La fila
         * enseñaba el precio del bono, asi que decia 66 en verde junto a un
         * "Cobrado" y parecia que habias cobrado el mes entero.
         */
        const cobrado = Number(pago[bono.id]?.neto_cobrado ?? 0)
        return { p, bono, pagado, impago, importe, cobrado, clases, mostrarClases: !esVentaPuntual(bono) }
      })
      // UNA FILA POR BONO, Y TAMBIEN POR SERVICIO SUELTO.
      //
      // Un suelto no crea bono a proposito, asi que quien venia a una valoracion
      // y la pagaba no tenia fila en ninguna pestana: contaba en la rejilla de
      // arriba y no aparecia por ningun lado. "Clientes del mes" son los
      // clientes del mes, tengan cuota o hayan consumido algo.
      .concat(cobradoMes
        .filter(pid => !bonos.some((b: any) => b.paciente_id === pid))
        .map(pid => ({
          p: pacienteDe[pid], bono: null as any, pagado: true, impago: false,
          importe: sueltosMes[pid]?.total || 0, cobrado: sueltosMes[pid]?.total || 0,
          clases: clasesDe[pid] || 0, mostrarClases: true,
        })))
      .filter(f => !!f.p)
      .filter(f => !t || contiene(`${f.p.nombre} ${f.p.apellidos}`, t))
      // Los cobrados al final: mientras cobras te interesa lo que falta. Dentro
      // de los pendientes, primero el que más clases lleva sin pagar. Y las dos
      // filas de una misma persona, juntas: separadas parecen un error.
      .sort((a, b) => Number(a.pagado) - Number(b.pagado)
        || b.clases - a.clases
        || `${a.p.nombre} ${a.p.apellidos}`.localeCompare(`${b.p.nombre} ${b.p.apellidos}`))
  }, [bonos, pacienteDe, pago, idx, busca, clasesDe, cobradoMes, sueltosMes])

  /** Qué entra en cada vista. Una sola definición para el contador y la lista. */
  const DE_VISTA: Record<string, (f: any) => boolean> = {
    // Pendiente e impago son cosas distintas y ahora tienen pestaña cada una:
    // pendiente es "aun no ha pagado"; impago es que TU has dicho que no paga.
    pendientes: (f: any) => !f.pagado && !f.impago,
    impagos:    (f: any) => f.impago,
    vinieron:   (f: any) => f.clases > 0,
    todos:      () => true,
  }

  /**
   * CLIENTES SIN NADA QUE COBRAR ESTE MES.
   *
   * El complemento exacto de la lista: esta pantalla se construye desde los
   * BONOS del mes, así que quien no tiene bono no aparece por ningún lado. Eso
   * está bien mientras no le falte a nadie, y deja de estarlo en cuanto se te
   * queda gente sin asignar y no hay forma de saber quién.
   *
   * No es lo mismo que el aviso rojo de arriba: aquel solo pilla a quien tiene
   * citas. Alguien en pausa, de vacaciones y sin citas, no sale ahí y sin
   * embargo se le cobra el mes igual.
   */
  const sinCuota = useMemo(() => {
    const conBono = new Set(bonos.map(b => b.paciente_id))
    // Quien empieza más adelante NO es un olvido. Se marca aparte y va al final
    // de la lista, para que los que de verdad faltan no queden diluidos entre
    // gente que ya está resuelta.
    const empiezaEn = new Map<string, string>()
    bonosFuturos.forEach(b => {
      const clave = `${b.anio}-${String(b.mes).padStart(2,'0')}`
      const previo = empiezaEn.get(b.paciente_id)
      if (!previo || clave < previo) empiezaEn.set(b.paciente_id, clave)
    })
    const t = busca.trim().toLowerCase()
    // Quien ya te ha pagado algo este mes —una valoracion, una sesion suelta—
    // no esta esperando que le asignes nada: se le cobro lo que vino a hacer.
    const cobrados = new Set(cobradoMes)
    return pacientes
      .filter(p => !conBono.has(p.id) && !cobrados.has(p.id))
      .filter(p => !t || contiene(`${p.nombre} ${p.apellidos}`, t))
      .map(p => ({ ...p, empiezaEn: empiezaEn.get(p.id) || null }))
      .sort((a, b) => Number(!!a.empiezaEn) - Number(!!b.empiezaEn))
  }, [pacientes, bonos, bonosFuturos, busca, cobradoMes])

  /** De los de arriba, los que de verdad no tienen nada previsto. */
  const faltanDeVerdad = sinCuota.filter(p => !p.empiezaEn).length

  const cuenta = {
    pendientes: base.filter(DE_VISTA.pendientes).length,
    vinieron:   base.filter(DE_VISTA.vinieron).length,
    todos:      base.length,
    sincuota:   faltanDeVerdad,
  }

  // "Sin cuota" no filtra bonos: pinta pacientes, y se resuelve aparte abajo.
  const filas = useMemo(() => base.filter(DE_VISTA[vista] || DE_VISTA.todos), [base, vista])

  /**
   * QUE CASILLA MIRA CADA PESTANA.
   *
   * La rejilla se ve siempre; lo que cambia es que se apaga lo que no estas
   * mirando. Asi el numero de la pestana no hay que repetirlo en ningun sitio:
   * esta ahi, encendido.
   */
  const RESALTA: Record<string, { col?: string, fila?: string }> = {
    pendientes: { col: 'pendiente' },
    impagos:    { col: 'impago' },
    sincuota:   { col: 'sinCuota' },
    vinieron:   { fila: 'vino' },
  }
  const foco = RESALTA[vista]
  const colViva  = (c: string) => !foco || !foco.col  || foco.col === c
  const filaViva = (f: string) => !foco || !foco.fila || foco.fila === f

  /**
   * Abre el cobro mirando antes si al paciente se le ha cobrado alguna vez.
   * Solo en el primer cobro se le ofrece pagar la fracción de mes que le queda;
   * a partir del mes siguiente la cuota va entera.
   */
  async function abrirCobro(p: any, bono: any) {
    const { count, error } = await supabase.from('cobros')
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', p.id).eq('anulado', false)
    if (error) setAviso(`No se ha podido comprobar si tiene cobros previos: ${error.message}`)
    setCobrando({ p, bono, tieneCobrosPrevios: (count ?? 1) > 0 })
  }

  async function marcarImpago(bono: any, esImpago: boolean) {
    const { error } = await supabase.from('bonos')
      .update({ estado_pago: esImpago ? 'impago' : 'pendiente' }).eq('id', bono.id)
    if (error) { setAviso(`No se ha podido marcar: ${error.message}`); return }
    cargar()
  }

  /**
   * Bonos de este mes cuyo paciente ya no sale en la lista porque se le dio de
   * baja. Tienen cuota generada y puede que sin cobrar, así que desaparecer sin
   * más sería perder dinero de vista: si alguien se da de baja el día 20 y no
   * había pagado el mes, ese cobro sigue existiendo.
   */
  const sinPacienteEnLista = useMemo(
    () => bonos.filter(b => !pacienteDe[b.paciente_id]).length,
    [bonos, pacienteDe])

  const totalPendiente = filas.filter(f=>!f.pagado).reduce((a,f)=>a+f.importe, 0)
  /**
   * PERSONAS distintas, no filas.
   *
   * La lista va por BONO, y alguien puede tener a la vez su cuota mensual y un bono de
   * sesiones: son dos cobros de la misma persona, y las dos filas son correctas. Pero el
   * contador decía "pacientes" contando filas, así que esa persona sumaba dos y el número
   * no cuadraba nunca con la cuenta de cabeza de nadie.
   */
  const nPendientes = filas.filter(f=>!f.pagado).length
  const pacientesPendientes = new Set(filas.filter(f=>!f.pagado).map(f=>f.p?.id)).size
  const nPagados = Object.values(pago).filter((r:any)=>r.pagado).length

  async function exportarGestoria() {
    // El listado de la gestoría se dejaba fuera las facturas del último día.
    const { desde, hasta } = rangoDeMes(anio, mes)
    const r = await listadoGestoria(desde, hasta)
    if (!r.ok) { setAviso(`No se ha podido generar el listado: ${r.error}`); return }
    if (!r.filas.length) { setAviso('No hay facturas emitidas en ese mes.'); return }
    const cols = ['serie','numero','fecha','cliente','nif','servicios','base','iva','retencion','total','forma_pago']
    const csv = [cols.join(';'), ...r.filas.map((f:any) => cols.map(c => String(f[c] ?? '').replace(/;/g,',')).join(';'))].join('\n')
    const url = URL.createObjectURL(new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `facturas-${anio}-${String(mes).padStart(2,'0')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (autorizado === null) return <div style={{fontSize:12,color:'var(--grl)',padding:20}}>Verificando acceso...</div>
  if (!autorizado) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'50vh',gap:10}}>
      <div style={{color:'var(--grl)'}}><Ic name="candado" size={40} strokeWidth={1.5}/></div>
      <div style={{fontSize:14,fontWeight:500,color:'var(--n)'}}>Acceso restringido</div>
    </div>
  )

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <select className="input" style={{width:'auto',padding:'6px 10px'}} value={mes} onChange={e=>setMes(Number(e.target.value))}>
          {MESES.map((m,i)=><option key={m} value={i+1}>{m} {anio}</option>)}
        </select>
        <input className="input" style={{width:200}} placeholder="Buscar paciente..." value={busca} onChange={e=>setBusca(e.target.value)}/>
        <div style={{display:'flex',gap:2,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:3}}>
          {/* Con el número al lado se ve de un vistazo si los tres filtros dan lo
              mismo, que es lo que pasa cuando nadie ha pagado todavía y todos
              tienen clases: entonces no es que el filtro no haga nada, es que
              las tres listas son la misma gente. */}
          {([['todos','Clientes del mes'],['pendientes','Pendientes'],['impagos','Impagos'],['vinieron','Han venido'],['sincuota','Sin cuota']] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setVista(k)}
              style={{fontSize:10,padding:'6px 11px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'system-ui',
                background:vista===k?'var(--w)':'transparent',color:vista===k?'var(--n)':'var(--grl)',
                fontWeight:vista===k?500:400,boxShadow:vista===k?'0 1px 3px rgba(0,0,0,.08)':'none'}}>
              {l}
            </button>
          ))}
        </div>
        <div style={{flex:1}}/>
        <Link href="/cobros/facturas" className="btn btn-s btn-sm" style={{textDecoration:'none'}}>
          <Ic name="informe" size={12}/> Facturas emitidas
        </Link>
        {/* El listado de la gestoría lleva bases, IVA y totales de todo el mes: es la
            contabilidad entera en un CSV. No es una pantalla, es el dato completo. */}
        {veImportes && (
          <button className="btn btn-s btn-sm" onClick={exportarGestoria}>
            <Ic name="descargar" size={12}/> Listado para la gestoría
          </button>
        )}
      </div>

      {fallos.length > 0 && (
        <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:10,color:'var(--red)'}}>
          <Ic name="alerta" size={12} style={{verticalAlign:'-2px',marginRight:4}}/>
          <strong>Faltan datos por leer.</strong> Lo de abajo está incompleto:
          <ul style={{margin:'4px 0 0 16px',padding:0}}>{fallos.map(f=><li key={f}>{f}</li>)}</ul>
        </div>
      )}

      {sinPacienteEnLista > 0 && (
        <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:8,padding:'9px 13px',marginBottom:12,fontSize:10,color:'#7A5800',lineHeight:1.6}}>
          <Ic name="alerta" size={12} style={{verticalAlign:'-2px',marginRight:4}}/>
          {sinPacienteEnLista === 1
            ? <>Hay <strong>1 cuota</strong> de este mes de alguien que ya está de baja, y no sale en la lista.</>
            : <>Hay <strong>{sinPacienteEnLista} cuotas</strong> de este mes de gente que ya está de baja, y no salen en la lista.</>}
          {' '}Si se dieron de baja sin pagar el mes, ese cobro sigue pendiente: búscalos en su ficha.
        </div>
      )}

      {aviso && (
        <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:8,padding:'9px 13px',marginBottom:12,fontSize:10,color:'#7A5800',display:'flex',gap:8,alignItems:'center'}}>
          <Ic name="alerta" size={12}/><span style={{flex:1}}>{aviso}</span>
          {ultima && (
            <button className="btn btn-p btn-sm" onClick={async()=>{
              const r = await abrirFactura(ultima)
              if (!r.ok) setAviso(r.error || 'No se ha podido abrir la factura.')
            }}><Ic name="informe" size={11}/> Ver factura</button>
          )}
          <button className="btn btn-t btn-sm" onClick={()=>{setAviso(null);setUltima(null)}}>Cerrar</button>
        </div>
      )}

      <div style={{display:'flex',alignItems:'flex-start',gap:26,flexWrap:'wrap',
                   marginBottom:16,paddingBottom:14,borderBottom:'1px solid var(--bd)'}}>
        {!cargando && (
        <div style={{flex:1,minWidth:430}}>
          <div style={{display:'grid',gridTemplateColumns:'104px 66px repeat(4,1fr)',gap:'9px 12px',alignItems:'baseline'}}>
            <span/>
            <span style={{fontSize:8,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4}}>Total</span>
            {([['pagado','Pagado','#3E7179'],['pendiente','Pendiente','#D4A24E'],
               ['impago','Impago','#C25B5B'],['sinCuota','Sin cuota','var(--grl)']] as const)
              .map(([k,l]) => (
                <span key={'h'+k} style={{fontSize:8,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,
                                          opacity: colViva(k) ? 1 : .3}}>{l}</span>
              ))}
            {([['vino','Vinieron'],['noVino','No vinieron']] as const).map(([f,lf]) => [
              <span key={'l'+f} style={{fontSize:10,color:'var(--gr)',opacity: filaViva(f) ? 1 : .3}}>{lf}</span>,
              <div key={'t'+f} style={{fontSize:22,fontWeight:600,lineHeight:1.1,color:'var(--n)',
                                       borderRight:'1px solid var(--bd)',paddingRight:12,
                                       opacity: filaViva(f) ? 1 : .3}}>
                {resumen[f].pagado.personas + resumen[f].pendiente.personas
                 + resumen[f].impago.personas + resumen[f].sinCuota.personas}
              </div>,
              ...([['pagado','#3E7179'],['pendiente','#D4A24E'],
                   ['impago','#C25B5B'],['sinCuota','var(--grl)']] as const).map(([c,color]) => {
                const cel = resumen[f][c]
                const viva = colViva(c) && filaViva(f)
                return (
                  <div key={f+c} style={{opacity: viva ? 1 : .3}}>
                    <div style={{fontSize:22,fontWeight:500,lineHeight:1.1,
                                 color: cel.personas ? color : 'var(--grl)'}}>{cel.personas}</div>
                  </div>
                )
              }),
            ])}
          </div>
          <div style={{fontSize:9,color:'var(--grl)',marginTop:10,lineHeight:1.6}}>
            {resumen.personas} personas este mes. Venir es haber dado al menos una clase;
            sin cuota es no tener bono del mes.
          </div>
        </div>
        )}
        <div style={{marginLeft:'auto',display:'flex',alignItems:'stretch',gap:8}}>
        {(
          <button onClick={()=>setEligiendo(true)} title="Cobrar algo suelto a quien no tiene bono"
            style={{width:94,minHeight:94,border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
                    background:'#5A969E',color:'#fff',display:'flex',flexDirection:'column',
                    alignItems:'center',justifyContent:'center',gap:6,padding:8}}>
            <Ic name="dinero" size={20}/>
            <span style={{fontSize:10,fontWeight:500,lineHeight:1.25}}>Cobro suelto</span>
          </button>
        )}
        <div className="card" style={{textAlign:'center',margin:0,minWidth:150}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4}}>Última factura</div>
          <div style={{fontSize:24,fontWeight:300,color:'#5A969E',marginTop:4}}>
            {facturas[0] ? `${facturas[0].serie}/${String(facturas[0].numero).padStart(4,'0')}` : '—'}
          </div>
          {/* Antes decia "30 recientes", que era el `limit` disfrazado de dato. */}
          <div style={{fontSize:9,color:'var(--grl)'}}>
            {facturas[0]
              ? new Date(facturas[0].fecha_expedicion+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})
              : 'ninguna aún'}
          </div>
        </div>
        </div>
      </div>

      {cargando ? (
        <div style={{fontSize:11,color:'var(--grl)',padding:20}}>Cargando...</div>
      ) : vista === 'sincuota' ? (
        sinCuota.length === 0 ? (
          <div style={{fontSize:11,color:'var(--grl)',padding:24,textAlign:'center'}}>
            Todos los clientes tienen bono de {MESES[mes-1].toLowerCase()}.
          </div>
        ) : (
          <>
            <div style={{fontSize:10,color:'#7A5800',background:'var(--ambl)',border:'1px solid var(--amb)',
                         borderRadius:8,padding:'10px 13px',marginBottom:10,lineHeight:1.6}}>
              <strong>{faltanDeVerdad} clientes sin bono de {MESES[mes-1].toLowerCase()}.</strong> No aparecen
              en la lista de cobros porque no hay nada que cobrarles: hay que asignarles el bono desde su ficha.
              {' '}Los que están <strong>en pausa</strong> también cuentan — pausa es que está de vacaciones, y el mes se cobra igual.
              {sinCuota.length > faltanDeVerdad && <>
                {' '}Los {sinCuota.length - faltanDeVerdad} de abajo del todo ya tienen bono para más adelante: esos están resueltos.
              </>}
            </div>
            {sinCuota.map(p => (
              <Link key={p.id} href={`/pacientes/${p.id}`}
                style={{display:'flex',alignItems:'center',gap:10,padding:'9px 13px',borderRadius:8,
                        border:'1px solid var(--bd)',marginBottom:6,background:'var(--w)',textDecoration:'none'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:500,color:'var(--n)'}}>{p.nombre} {p.apellidos}</div>
                  {!p.dni && <div style={{fontSize:9,color:'var(--grl)'}}>sin DNI</div>}
                </div>
                {p.estado==='pausa' && <span style={{fontSize:9,color:'#7A5800',fontWeight:600}}>en pausa</span>}
                {p.empiezaEn && (
                  <span style={{fontSize:9,color:'var(--gd)',fontWeight:600,whiteSpace:'nowrap'}}>
                    empieza en {MESES[Number(p.empiezaEn.split('-')[1])-1].toLowerCase()}
                  </span>
                )}
                {(clasesDe[p.id]||0) > 0 && (
                  <span style={{fontSize:9,color:'var(--red)',fontWeight:600}}>
                    {clasesDe[p.id]} {clasesDe[p.id]===1?'clase':'clases'} este mes
                  </span>
                )}
                {!p.empiezaEn && <span style={{fontSize:10,color:'var(--gd)'}}>Asignar bono →</span>}
              </Link>
            ))}
          </>
        )
      ) : filas.length === 0 ? (
        <div style={{fontSize:11,color:'var(--grl)',padding:24,textAlign:'center'}}>
          {vista==='pendientes' ? 'No queda nadie por cobrar este mes.'
           : vista==='impagos' ? 'No hay nadie marcado como impago este mes.'
           : vista==='vinieron' ? 'Nadie con cuota ha venido todavía este mes.'
           : 'Nadie tiene cuota asignada ni ha consumido nada este mes.'}
        </div>
      ) : filas.map(({ p, bono, pagado, impago, importe, cobrado, clases, mostrarClases }: any) => (
        <div key={bono?.id || p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',borderRadius:8,
                                border:`1px solid ${impago?'var(--red)':'var(--bd)'}`,marginBottom:6,
                                background:pagado?'var(--gl)':impago?'var(--redl)':'var(--w)'}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:500,color:'var(--n)'}}>
              {p.nombre} {p.apellidos}
              {p.estado==='pausa' && <span style={{fontSize:9,color:'#7A5800',marginLeft:6}}>en pausa</span>}
              {/* Se fue empezado el mes. La cuota se le cobra igual —mes empezado, mes
                  cobrado— pero hay que saber que ya no viene: es a quien hay que reclamar
                  por teléfono, no esperar a que aparezca por la puerta. */}
              {(p.estado==='baja' || p.estado==='puede_volver') && (
                <span style={{fontSize:9,color:'var(--red)',marginLeft:6,fontWeight:600}}>
                  {p.estado==='baja' ? 'de baja' : 'ya no viene'}
                </span>
              )}
              {impago && <span style={{fontSize:9,color:'var(--red)',marginLeft:6,fontWeight:600}}>impago</span>}
            </div>
            <div style={{fontSize:9,color:'var(--grl)'}}>
              {/* Sin bono, la fila la trae un cobro suelto: se dice QUÉ se le
                  cobró, que es lo único que explica por qué está aquí. */}
              {bono ? (idx[bono.tipo]?.nombre || bono.tipo)
                    : (sueltosMes[p.id]?.conceptos.join(' · ') || 'Cobro suelto')}
              {/* Sin esto, las dos filas de quien tiene cuota Y sesiones se leen
                  como una duplicada. */}
              {bono && esVentaPuntual(bono) && <span style={{color:'var(--gd)'}}>{' · '}{bono.sesiones_totales} sesiones</span>}
              {!p.dni && ' · sin DNI'}
              {/* Lo que ya ha entrenado sin haber pagado. Cuanto más alto, más urge. */}
              {!pagado && mostrarClases && clases > 0 && (
                <span style={{color:clases>=4?'var(--red)':'#7A5800',fontWeight:600}}>
                  {' · '}{clases} {clases===1?'clase':'clases'} ya
                </span>
              )}
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            {/* Cobrado: lo que entro. Pendiente: lo que toca cobrar. */}
            <div style={{fontSize:13,fontWeight:600,color:pagado?'#3E7179':'var(--n)'}}>
              {(pagado ? cobrado : importe).toFixed(2)} €
            </div>
            {pagado && bono && Math.abs(cobrado - importe) >= 0.01 && (
              <div style={{fontSize:9,color:'var(--grl)'}}>de {importe.toFixed(2)} €</div>
            )}
          </div>
          {pagado ? (
            <span style={{fontSize:10,color:'#3E7179',display:'inline-flex',alignItems:'center',gap:4,minWidth:130,justifyContent:'flex-end'}}>
              <Ic name="check" size={13}/> Cobrado
            </span>
          ) : (
            <div style={{display:'flex',gap:5,minWidth:130,justifyContent:'flex-end'}}>
              {bono && (
                <button className="btn btn-s btn-sm" title={impago?'Volver a pendiente':'Marcar como impago: vino y no ha pagado'}
                  onClick={()=>marcarImpago(bono, !impago)}
                  style={impago?{color:'var(--red)',borderColor:'var(--red)'}:undefined}>
                  {impago ? 'Pendiente' : 'Impago'}
                </button>
              )}
              <button className="btn btn-p btn-sm" onClick={()=>abrirCobro(p, bono)}>Cobrar</button>
            </div>
          )}
        </div>
      ))}

      {/* ELEGIR A QUIEN SE LE COBRA.
          Era un <select> con doscientos nombres seguidos. El resto de la app
          busca con `BuscadorPacientes` —agenda, valoración, bonos— y no hay
          motivo para que aquí se elija de otra forma.

          Entran también los ex clientes: a alguien de baja se le puede cobrar
          una sesión suelta, y era justo el caso que no tenía por dónde. */}
      {eligiendo && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setEligiendo(false)}}>
          <div className="modal" style={{width:460,maxWidth:'94vw'}}>
            <div className="modal-title">
              Cobro suelto
              <button className="modal-close" onClick={()=>setEligiendo(false)}>✕</button>
            </div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:12,lineHeight:1.6}}>
              Para cobrar algo que no es una cuota: una valoración, una sesión individual.
              Eliges a quién y en el cobro añades el servicio.
            </div>
            <BuscadorPacientes
              pacientes={[...pacientes, ...exClientes]}
              valor=""
              autoFocus
              placeholder="Buscar paciente por nombre..."
              etiqueta={(pa:any)=> pa.estado==='pausa' ? 'en pausa'
                                 : (pa.estado==='baja'||pa.estado==='puede_volver') ? 'ya no viene' : null}
              onElegir={(pa:any)=>{ setEligiendo(false); abrirCobro(pa, null) }}
              onLimpiar={()=>{}}/>
          </div>
        </div>
      )}

      {cobrando && (
        <ModalCobro
          paciente={cobrando.p}
          bono={cobrando.bono}
          planes={planes}
          descuentos={descuentos}
          /* Prorrateo solo en el primer cobro del paciente: si nunca se le ha
             cobrado nada, se le ofrece pagar la fracción de mes que le queda. */
          primerCobro={!cobrando.tieneCobrosPrevios}
          onCerrar={()=>setCobrando(null)}
          onEmitida={r=>{
            setAviso(`Factura ${r.serie}/${String(r.numero).padStart(4,'0')} emitida.`)
            setUltima(r.facturaId)
            cargar()
          }}
        />
      )}
    </div>
  )
}
