'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { cargarBonosTipos, quitarBono, BonoTipo } from '@/lib/bonos'
import FichaTab from './components/FichaTab'
import TimelineTab from './components/TimelineTab'
import SaludTab from './components/SaludTab'
import ResultadosTab from './components/ResultadosTab'
import EntrenoTab from './components/EntrenoTab'
import { Ic } from '@/lib/icons'
import { nombreTipoClase, cargarTiposClase, TIPOS_CLASE_FALLBACK } from '@/lib/tipos'
import { abrirAlerta, cerrarAlerta as cerrarAlertaLib } from '@/lib/alertas'
import { subirFotoPaciente, urlFotoPaciente } from '@/lib/fotos'
import { registrarResultadoTest, textoMedida } from '@/lib/tests'
import ExploradorTests from '@/components/ExploradorTests'
import ModalCobro from '@/components/ModalCobro'
import { cargarTarifas } from '@/lib/tarifas'
import { bonosDe, renovarBonoSesiones, type BonoSesiones } from '@/lib/bonoSesiones'
import ModalRealizarTest, { ladoVacio } from '@/components/ModalRealizarTest'
import { asistencia } from '@/lib/resultados'
import { leerLista } from '@/lib/listasPaciente'
import ModalAlertasCita from '@/app/agenda/components/ModalAlertasCita'
import ModalBono from '../components/ModalBono'
import { useParams, useRouter } from 'next/navigation'


export default function FichaPacientePage() {
  const { id } = useParams()
  const router = useRouter()
  const [tab, setTab] = useState('ficha')
  // Llegar con la pestaña puesta: `/pacientes/<id>?tab=entreno`, que es a donde manda
  // la valoración al terminar para repartir las sesiones.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t) setTab(t)
  }, [])
  const [pac, setPac] = useState<any>(null)
  const [bono, setBono] = useState<any>(null)
  // Cobro abierto desde el chip de la cuota o desde "Renovar y cobrar". Guarda
  // QUÉ bono se está cobrando, no un simple sí/no: desde esta pantalla se puede
  // cobrar la cuota mensual o un bono de sesiones recién renovado, y el modal
  // tiene que recibir el que toca.
  const [cobrando, setCobrando] = useState<any>(null)
  const [cobrado, setCobrado] = useState(false)
  const [planes, setPlanes] = useState<any[]>([])
  const [servicios, setServicios] = useState<any[]>([])
  const [descuentos, setDescuentos] = useState<any[]>([])
  // Bonos de sesiones con su consumo ya contado desde las citas.
  const [bonosSesiones, setBonosSesiones] = useState<BonoSesiones[]>([])
  const [molestias, setMolestias] = useState<any[]>([])
  const [patologias, setPatologias] = useState<any[]>([])
  const [medicamentos, setMedicamentos] = useState<any[]>([])
  const [alergias, setAlergias] = useState<any[]>([])
  const [intolerancias, setIntolerancias] = useState<any[]>([])
  const [operaciones, setOperaciones] = useState<any[]>([])
  const [deportesPac, setDeportesPac] = useState<any[]>([])
  const [escalas, setEscalas] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [recuperaciones, setRecuperaciones] = useState<any[]>([])
  const [registrosEj, setRegistrosEj] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])
  const [modalAlertas, setModalAlertas] = useState(false)
  const [testsDisp, setTestsDisp] = useState<any[]>([])
  const [citas, setCitas] = useState<any[]>([])
  const [sesiones, setSesiones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<any>({})
  const [modalBono, setModalBono] = useState(false)
  const [modalPausa, setModalPausa] = useState(false)
  const [bonosOpts, setBonosOpts] = useState<BonoTipo[]>([])
  const [pausa, setPausa] = useState({ desde: new Date().toISOString().split('T')[0], hasta: '' })
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  // Pasar un test es la misma pantalla que en la valoración (`ModalRealizarTest`) y
  // elegirlo el mismo explorador (`ExploradorTests`). Aquí había un formulario propio de
  // 95 líneas con un desplegable de 49 tests: la cuarta copia, y la peor de ver.
  const [eligiendoTest, setEligiendoTest] = useState(false)
  const [testEnCurso, setTestEnCurso] = useState<{test:any,tv:any}|null>(null)
  const [etiquetasLib, setEtiquetasLib] = useState<any[]>([])
  const [procesando, setProcesando] = useState(false)
  const [menuAcc, setMenuAcc] = useState<any>(null)
  const [tiposClase, setTiposClase] = useState<any[]>(TIPOS_CLASE_FALLBACK)
  // El bucket es privado: la URL se firma al vuelo y no se guarda en base.
  const [fotoUrl, setFotoUrl] = useState<string|null>(null)

  const resultadosRef = useRef<HTMLDivElement>(null)
  const primeraCarga = useRef(true)

  function generarPDF() {
    if (!pac) return
    // Las cifras salen de lib/resultados: eran la tercera copia del mismo cálculo,
    // después de la vista de análisis y la del paciente.
    const { realizadas, faltas, canceladas, recuperadas, base: total, pct } = asistencia(citas, recuperaciones)
    const fecha = new Date().toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})

    // DONUT SVG
    const radio = 15.9
    const circunferencia = 2 * Math.PI * radio
    const dashR = total>0 ? (realizadas/total)*100 : 0
    const dashF = total>0 ? (faltas/total)*100 : 0
    const donutSVG = `<svg viewBox="0 0 36 36" width="120" height="120" style="transform:rotate(-90deg)">
      <circle cx="18" cy="18" r="${radio}" fill="none" stroke="#EBF4F5" stroke-width="3"/>
      <circle cx="18" cy="18" r="${radio}" fill="none" stroke="#5A969E" stroke-width="3"
        stroke-dasharray="${dashR} ${100-dashR}" stroke-linecap="round"/>
      ${faltas>0?`<circle cx="18" cy="18" r="${radio}" fill="none" stroke="#B05A5A" stroke-width="3"
        stroke-dasharray="${dashF} ${100-dashF}" stroke-dashoffset="${-dashR}" stroke-linecap="round"/>`:''}
    </svg>`

    // BARRAS POR MES
    const mesesMap: Record<string,{r:number,f:number}> = {}
    citas.forEach((c:any)=>{
      const m = c.fecha?.slice(0,7); if(!m) return
      if(!mesesMap[m]) mesesMap[m]={r:0,f:0}
      if(c.estado==='realizada') mesesMap[m].r++
      if(c.estado==='falta') mesesMap[m].f++
    })
    const meses = Object.entries(mesesMap).sort(([a],[b])=>a.localeCompare(b)).slice(-6)
    const maxM = Math.max(...meses.map(([,v])=>v.r+v.f),1)
    const barWidth = 40
    const barGap = 10
    const svgW = meses.length*(barWidth+barGap)
    const barrasSVG = meses.length>0 ? `<svg width="${svgW}" height="100" viewBox="0 0 ${svgW} 100">
      ${meses.map(([mes,datos],i)=>{
        const x = i*(barWidth+barGap)
        const hR = Math.round((datos.r/maxM)*70)
        const hF = Math.round((datos.f/maxM)*70)
        const [,m] = mes.split('-')
        const nm = new Date(2024,parseInt(m)-1,1).toLocaleDateString('es-ES',{month:'short'})
        return `<rect x="${x+5}" y="${90-hR}" width="${barWidth-10}" height="${hR}" fill="#5A969E" rx="2"/>
        ${datos.f>0?`<rect x="${x+5}" y="${90-hR-hF}" width="${barWidth-10}" height="${hF}" fill="#B05A5A" rx="2" opacity="0.7"/>`:''}
        <text x="${x+barWidth/2}" y="98" text-anchor="middle" font-size="8" fill="#888">${nm}</text>
        <text x="${x+barWidth/2}" y="${85-hR-hF-2}" text-anchor="middle" font-size="7" fill="#444">${datos.r+datos.f>0?Math.round((datos.r/(datos.r+datos.f))*100)+'%':''}</text>`
      }).join('')}
    </svg>` : '<p style="color:#888;font-size:11px">Sin datos de meses</p>'

    const html = `<html><head><meta charset="utf-8"><style>
      body{font-family:Arial,sans-serif;color:#262825;padding:30px;max-width:700px;margin:0 auto}
      h1{font-size:22px;font-weight:300;margin-bottom:4px}
      h2{font-size:11px;font-weight:700;color:#5A969E;margin:24px 0 10px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #EBF4F5;padding-bottom:6px}
      .meta{font-size:11px;color:#888;margin-bottom:24px}
      .row{display:flex;gap:20px;align-items:center;margin-bottom:16px}
      .donut-wrap{position:relative;width:120px;height:120px;flex-shrink:0}
      .donut-label{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}
      .donut-pct{font-size:20px;font-weight:300;color:#262825}
      .donut-sub{font-size:8px;color:#888}
      .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;flex:1}
      .card{background:#f5f3ef;border-radius:6px;padding:10px;text-align:center}
      .val{font-size:22px;font-weight:300}
      .lbl{font-size:8px;color:#888;margin-top:2px}
      .test{padding:8px 12px;background:#f5f3ef;border-radius:5px;margin-bottom:5px}
      .tn{font-size:12px;font-weight:500;margin-bottom:3px}
      .td{font-size:10px;color:#666}
      .pos{color:#B05A5A;font-weight:600} .neg{color:#5A969E;font-weight:600}
      .legend{display:flex;gap:16px;margin-top:8px}
      .leg-item{display:flex;align-items:center;gap:4px;font-size:9px;color:#888}
      .leg-dot{width:8px;height:8px;border-radius:50%}
      .footer{margin-top:30px;font-size:9px;color:#bbb;border-top:1px solid #eee;padding-top:10px;text-align:center}
      @media print{body{padding:15px}}
    </style></head><body>
    <h1>${pac.nombre} ${pac.apellidos}${pac.nombre_clinica?' ('+pac.nombre_clinica+')':''}</h1>
    <div class="meta">
      ${pac.fecha_nacimiento?Math.floor((Date.now()-new Date(pac.fecha_nacimiento).getTime())/(1000*60*60*24*365.25))+' años · ':''}
      ${pac.tipo_clase||''} · Informe generado el ${fecha}
    </div>

    <h2>Asistencia global</h2>
    <div class="row">
      <div class="donut-wrap">
        ${donutSVG}
        <div class="donut-label"><div class="donut-pct">${pct}%</div><div class="donut-sub">asistencia</div></div>
      </div>
      <div class="grid4">
        <div class="card"><div class="val" style="color:#5A969E">${realizadas}</div><div class="lbl">Realizadas</div></div>
        <div class="card"><div class="val" style="color:#B05A5A">${faltas}</div><div class="lbl">Faltas</div></div>
        <div class="card"><div class="val" style="color:#888">${canceladas}</div><div class="lbl">Canceladas</div></div>
        <div class="card"><div class="val" style="color:#C9A84C">${recuperadas}</div><div class="lbl">Recuperadas</div></div>
      </div>
    </div>

    <h2>Asistencia por mes</h2>
    ${barrasSVG}
    <div class="legend">
      <div class="leg-item"><div class="leg-dot" style="background:#5A969E"></div>Realizadas</div>
      <div class="leg-item"><div class="leg-dot" style="background:#B05A5A;opacity:.7"></div>Faltas</div>
    </div>

    ${pac.peso_kg||pac.altura_cm ? `<h2>Datos físicos</h2>
    <div class="grid4" style="max-width:300px">
      ${pac.peso_kg?`<div class="card"><div class="val">${pac.peso_kg}</div><div class="lbl">Peso (kg)</div></div>`:''}
      ${pac.altura_cm?`<div class="card"><div class="val">${pac.altura_cm}</div><div class="lbl">Altura (cm)</div></div>`:''}
    </div>` : ''}

    ${tests.length>0 ? `<h2>Tests funcionales</h2>
    ${tests.map((t:any)=>`<div class="test">
      <div class="tn">${t.tests?.nombre||'Test'}${t.lado&&t.lado!=='bilateral'?' · <span style="font-weight:300;color:#888">'+t.lado+'</span>':''}</div>
      <div class="td">
        <span class="${t.resultado==='positivo'?'pos':'neg'}">${t.resultado==='positivo'?'+ Positivo':'− Negativo'}</span>
        &nbsp;·&nbsp;${new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}
        ${(t.items_resultado||[]).filter((i:any)=>i.marcado).map((i:any)=>
          `<br>☑ ${i.nombre}${textoMedida(i)?' · <strong>'+textoMedida(i)+'</strong>':''}`
        ).join('')}
      </div>
    </div>`).join('')}` : ''}

    ${escalas.length>0 ? `<h2>Últimas escalas</h2>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <tr style="background:#f5f3ef"><th style="padding:6px 10px;text-align:left">Fecha</th><th style="padding:6px 10px">Borg</th><th style="padding:6px 10px">Estrés</th></tr>
      ${[...escalas].slice(0,5).map((e:any)=>`<tr style="border-bottom:1px solid #f0ede8">
        <td style="padding:5px 10px">${new Date(e.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}</td>
        <td style="padding:5px 10px;text-align:center">${e.borg==null?'—':e.borg+'/10'}</td>
        <td style="padding:5px 10px;text-align:center">${e.estres==null?'—':e.estres+'/10'}</td>
      </tr>`).join('')}
    </table>` : ''}

    <div class="footer">SIE · Gestión Clínica · ${fecha}</div>
    </body></html>`

    const ventana = window.open('', '_blank')
    if (ventana) {
      ventana.document.write(html)
      ventana.document.close()
      setTimeout(()=>ventana.print(), 500)
    }
  }

  const mes = new Date().getMonth()+1
  const anio = new Date().getFullYear()

  useEffect(() => { if(id) { primeraCarga.current = true; cargar() } }, [id])
  useEffect(() => { let vivo = true
    urlFotoPaciente(pac?.foto_url).then(u => { if (vivo) setFotoUrl(u) })
    return () => { vivo = false }
  }, [pac?.foto_url])
  useEffect(() => {
    cargarBonosTipos().then(data => {
      setBonosOpts(data)
    })
  }, [])

  // Solo se muestra el "Cargando ficha…" la primera vez. En los refrescos posteriores
  // la pantalla no se desmonta, así que no se pierde el scroll ni parpadea todo.
  /**
   * Renovar un bono agotado: crea el nuevo y abre el cobro encima, en un clic.
   *
   * Son dos pasos y tienen que ir en este orden. La factura sale de un cobro, y
   * un cobro necesita un bono al que engancharse: no se puede facturar algo que
   * todavía no existe. Si la creación falla, no se abre nada y se dice por qué.
   */
  async function renovarSesiones(bs: BonoSesiones) {
    const r = await renovarBonoSesiones(bs)
    if (!r.ok) { alert(`No se ha podido renovar el bono: ${r.error}`); return }
    await cargar()
    setCobrando(r.bono)
  }

  /**
   * Retirar un bono de sesiones asignado por error.
   *
   * Va por `quitarBono`, la misma que usa la cuota mensual: comprueba en `cobro_lineas`
   * que no esté facturado, lo borra y deja el apunte en el historial. Un bono que
   * desaparece sin rastro es indistinguible de uno que nunca se asignó.
   */
  async function retirarSesiones(bs: BonoSesiones) {
    const r = await quitarBono({ id: bs.bono_id, paciente_id: id as string, tipo: bs.tipo })
    if (!r.ok) { alert(r.error); return }
    await cargar()
  }

  /**
   * De las cuotas vigentes de un paciente, la que manda: la de ESTE mes si la
   * tiene, y si no la más próxima de las que vengan.
   *
   * Antes se cogía sin más la última creada. Con la cuota de septiembre dejada
   * lista en agosto, eso significaba que la ficha enseñaba —y ofrecía cobrar—
   * la de septiembre mientras la de agosto seguía sin pagar. Se cobraría el mes
   * equivocado sin que nada lo indicara.
   *
   * Los bonos de sesiones no son la cuota: se ven aparte, en sus tarjetas.
   */
  function cuotaVigente(lista: any[]) {
    const hoy = new Date()
    const m = hoy.getMonth()+1, a = hoy.getFullYear()
    const cuotas = (lista||[])
      .filter((b:any) => b.sesiones_totales == null)
      .sort((x:any,y:any) => (x.anio - y.anio) || (x.mes - y.mes))
    return cuotas.find((b:any) => b.mes === m && b.anio === a) || cuotas[0] || null
  }

  async function cargar() {
    if (primeraCarga.current) setLoading(true)
    const [{ data: p },{ data: b },{ data: m },{ data: pat },{ data: med },{ data: esc },{ data: c },{ data: s }] = await Promise.all([
      supabase.from('pacientes').select('*').eq('id',id).single(),
      // Todas sus cuotas vigentes, no solo la última creada. Cuál es "la suya"
      // lo decide `cuotaVigente` de abajo, con la misma regla que la lista de
      // pacientes: si las dos pantallas eligen distinto, la ficha te enseña una
      // cuota y la lista otra para la misma persona.
      supabase.from('bonos').select('*').eq('paciente_id',id).eq('activo',true).order('created_at',{ascending:false}),
      supabase.from('molestias').select('*').eq('paciente_id',id).order('created_at',{ascending:false}),
      supabase.from('patologias').select('*').eq('paciente_id',id).order('created_at',{ascending:false}),
      supabase.from('medicamentos').select('*').eq('paciente_id',id),
      supabase.from('escalas').select('*').eq('paciente_id',id).order('fecha',{ascending:false}).limit(12),
      supabase.from('citas').select('id,fecha,hora,sala,tipo,estado,sesion_id,notas').eq('paciente_id',id).order('fecha',{ascending:false}).limit(50),
      supabase.from('sesiones').select('*').eq('paciente_id',id).order('created_at',{ascending:false}).limit(5),
    ])
    const [{ data: t }, { data: td }, { data: alg }, { data: intol }, { data: dep }, oper] = await Promise.all([
      // fecha es un DATE: dos tests del mismo día empatan y Postgres los devuelve
      // en orden arbitrario. Sin created_at, "el resultado actual" salía a suertes.
      supabase.from('resultados_tests').select('*, tests(nombre,descripcion)').eq('paciente_id',id)
        .order('fecha',{ascending:false}).order('created_at',{ascending:false}),
      supabase.from('tests').select('*').order('nombre'),
      supabase.from('alergias_paciente').select('*').eq('paciente_id',id).order('created_at',{ascending:false}),
      supabase.from('intolerancias_paciente').select('*').eq('paciente_id',id).order('created_at',{ascending:false}),
      supabase.from('deportes_paciente').select('*').eq('paciente_id',id).order('created_at',{ascending:false}),
      // Por `leerLista` y no por consulta directa: la tabla es nueva y hasta que no se
      // ejecute su SQL devuelve lista vacía en vez de tumbar la carga de la ficha entera.
      leerLista(id as string,'operaciones'),
    ])
    setAlergias(alg||[]); setIntolerancias(intol||[]); setDeportesPac(dep||[]); setOperaciones(oper||[])
    const cuota = cuotaVigente(b||[])
    setPac(p); setBono(cuota); setMolestias(m||[]); setPatologias(pat||[])

    // Estado de pago DERIVADO del cobro, no de `bonos.estado_pago`. Se pregunta
    // por la cuota que se está enseñando, no por cualquiera de las suyas.
    if (cuota?.id) {
      const { data: vp } = await supabase.from('v_bonos_pago').select('pagado').eq('bono_id', cuota.id).maybeSingle()
      setCobrado(!!vp?.pagado)
    } else setCobrado(false)

    // Catálogos para el modal de cobro.
    const { data: pl } = await supabase.from('planes').select('*').eq('activo', true)
    setPlanes(pl || [])
    const tar = await cargarTarifas()
    setServicios(tar.servicios); setDescuentos(tar.descuentos)

    const bs = await bonosDe(id as string)
    if (!bs.ok) console.error('No se han podido leer los bonos de sesiones:', bs.error)
    setBonosSesiones(bs.bonos)
    setMedicamentos(med||[]); setEscalas(esc||[]); setCitas(c||[]); setSesiones(s||[])
    setTests(t||[]); setTestsDisp(td||[])
    // Las etiquetas son las que dan el filtro por zona del explorador de tests.
    const { data: et } = await supabase.from('etiquetas').select('*')
    setEtiquetasLib(et||[])
    const { data: rec } = await supabase.from('recuperaciones').select('id,estado,fecha_falta,fecha_limite,cita_recuperacion_id').eq('paciente_id',id).order('fecha_falta',{ascending:false})
    setRecuperaciones(rec||[])
    // Lo anotado en el taller: alimenta la progresión de cargas y de ejecución.
    const { data: regsEj } = await supabase.from('registros_ejercicio')
      .select('fecha,ejercicio_id,ejercicio_nombre,series,items_evaluados,variante').eq('paciente_id',id)
    setRegistrosEj(regsEj||[])
    const { data: al } = await supabase.from('alertas_paciente').select('*').eq('paciente_id',id).eq('activa',true).order('created_at',{ascending:false})
    setAlertas(al||[])
    // Los tipos de clase mandan desde Ajustes: aquí nunca se listan a mano.
    setTiposClase(await cargarTiposClase())
    setForm(p||{})
    if (primeraCarga.current) { setLoading(false); primeraCarga.current = false }
  }

  // El tipo de clase NO se guarda aquí: tiene su propio control en la ficha (cambiarTipoClase).
  async function guardarEdicion() {
    await supabase.from('pacientes').update({
      nombre:form.nombre, apellidos:form.apellidos, nombre_clinica:form.nombre_clinica||null, telefono:form.telefono,
      email:form.email, dni:form.dni, altura_cm:form.altura_cm,
      peso_kg:form.peso_kg, notas_fijas:form.notas_fijas
    }).eq('id',id)
    setEditando(false); cargar()
  }

  // Cambio directo del tipo de clase desde la ficha (sin entrar en modo edición).
  // No toca las citas ya programadas: solo condiciona las nuevas.
  async function cambiarTipoClase(valor: string) {
    if (!pac || valor === pac.tipo_clase) return
    const anterior = pac.tipo_clase
    await supabase.from('pacientes').update({ tipo_clase: valor }).eq('id', id)
    await registrarEvento('cambio_tipo_clase', `Cambio de clase: ${nombreTipoClase(tiposClase, anterior)} → ${nombreTipoClase(tiposClase, valor)}`, null)
    cargar()
  }

  /**
   * Reevaluar un test concreto, desde Salud o desde el detalle de un resultado.
   * Se abre ya en el lado que se venía mirando: es el que se va a repetir.
   */
  function abrirTest(testId: string, lado: string) {
    const test = testsDisp.find((t:any)=>t.id===testId)
    if (!test) { alert('Ese test ya no está en la biblioteca'); return }
    const l = lado || (test.tipo_lado==='lateral' ? 'izquierdo' : 'bilateral')
    setTestEnCurso({ test, tv: { ladoActivo:l, frecuencia_meses:test.frecuencia_meses, lados:{ [l]: ladoVacio(test) } } })
  }

  /**
   * Guardar lo pasado. Toda la lógica —fila, evento y objetivos— está en `lib/tests.ts`,
   * que es lo que usan también la valoración y Salud.
   *
   * Se guardan TODOS los lados con resultado, no solo el que está a la vista: el modal
   * deja pasar izquierdo y derecho de una vez, y perder uno de los dos por no haber
   * vuelto a su pestaña sería un dato que se pierde en silencio.
   */
  async function registrarTest() {
    if (!testEnCurso) return
    const { test, tv } = testEnCurso
    const conDato = Object.keys(tv.lados||{}).filter(k => tv.lados[k]?.resultado && tv.lados[k].resultado!=='sin_realizar')
    if (conDato.length===0) { alert('Marca el resultado antes de guardar'); return }
    setProcesando(true)
    let logrados = 0
    for (const lado of conDato) {
      const d = tv.lados[lado]
      const r = await registrarResultadoTest(String(id), test, {
        resultado: d.resultado, items: d.items_resultado || [],
        observaciones: d.observaciones, lado,
        fechaRepeticion: d.fecha_repeticion || null,
        contexto: 'la ficha',
      })
      if (!r.ok) { alert('No se pudo guardar el resultado: ' + r.error); setProcesando(false); return }
      logrados += r.logrados
    }
    setProcesando(false)
    setTestEnCurso(null)
    cargar()
    // Que un test cierre objetivos es la consecuencia que más interesa y antes pasaba
    // en silencio: solo se veía entrando en la pestaña de objetivos.
    if (logrados > 0) {
      alert(logrados === 1
        ? 'Resultado guardado. Un objetivo ha pasado a logrado.'
        : `Resultado guardado. ${logrados} objetivos han pasado a logrados.`)
    }
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setSubiendoFoto(true)
    const r = await subirFotoPaciente(String(id), file)
    setSubiendoFoto(false)
    if (!r.ok) { alert('Error al subir la foto: ' + r.error); return }
    setPac((prev:any)=>prev?{...prev, foto_url:r.ruta}:prev)
  }

  async function darDeBaja() {
    if (!confirm(`¿Dar de baja a ${pac.nombre} ${pac.apellidos}?\n\nSus datos se conservan pero se eliminarán TODAS sus citas futuras automáticamente.`)) return
    setProcesando(true)
    const hoy = new Date().toISOString().split('T')[0]
    await supabase.from('citas').delete().eq('paciente_id',id).gte('fecha',hoy).eq('estado','programada')
    await supabase.from('pacientes').update({ estado:'baja' }).eq('id',id)
    await registrarEvento('baja', 'Baja del servicio', 'Sus citas futuras programadas fueron eliminadas.')
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
    await supabase.from('pacientes').update({ estado:'pausa', pausa_desde:pausa.desde, pausa_hasta:pausa.hasta }).eq('id',id)
    await registrarEvento('pausa', `Pausa del ${pausa.desde} al ${pausa.hasta}`, `${citasPausa?.length||0} citas canceladas en ese periodo.`)
    setProcesando(false)
    setModalPausa(false)
    alert(`✓ Pausa aplicada. ${citasPausa?.length||0} citas canceladas del ${pausa.desde} al ${pausa.hasta}.\nEl paciente se reactivará automáticamente al volver.`)
    cargar()
  }

  async function reactivar() {
    if (!confirm(`¿Reactivar a ${pac.nombre} ${pac.apellidos}?`)) return
    await supabase.from('pacientes').update({ estado:'activo', pausa_desde:null, pausa_hasta:null }).eq('id',id)
    await registrarEvento('reactivacion', 'Reactivación del servicio', null)
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

  async function registrarEvento(tipo:string, titulo:string, descripcion:string|null=null, pacId:any=id) {
    await supabase.from('eventos_paciente').insert({ paciente_id:pacId, tipo, titulo, descripcion, fecha:new Date().toISOString().split('T')[0] })
  }

  async function recargarAlertas() {
    const { data: al } = await supabase.from('alertas_paciente').select('*').eq('paciente_id',id).eq('activa',true).order('created_at',{ascending:false})
    setAlertas(al||[])
  }

  async function crearAlerta(pacienteId:string, tipo:string, afectaSesion:boolean, descripcion:string) {
    const r = await abrirAlerta(pacienteId, tipo, afectaSesion, descripcion)
    if (!r.ok) { alert('Error al crear la alerta: '+r.error); return }
    recargarAlertas()
  }

  async function cerrarAlerta(alertaId:string) {
    const alerta = alertas.find(a=>a.id===alertaId)
    if (!alerta) return
    const r = await cerrarAlertaLib(alerta)
    if (!r.ok) { alert('Error al cerrar la alerta: '+r.error); return }
    recargarAlertas()
  }

  async function toggleMolestia(molId: string, activa: boolean) {
    await supabase.from('molestias').update({ activa:!activa }).eq('id',molId); cargar()
  }


  const LBL_BONO: Record<string,string> = Object.fromEntries(bonosOpts.map(b=>[b.id,b.nombre]))
  const LBL_PAGO: Record<string,string> = { pagado:'Pagado', pendiente:'Pendiente', impago:'Impago' }

  async function cambiarPago(estado: string) {
    if (!bono) return
    await supabase.from('bonos').update({ estado_pago:estado }).eq('id',bono.id)
    await registrarEvento('pago_bono', `Cuota marcada como: ${LBL_PAGO[estado]||estado}`, `Bono ${LBL_BONO[bono.tipo]||bono.tipo}`)
    cargar()
  }

  const edad = pac?.fecha_nacimiento ? Math.floor((Date.now()-new Date(pac.fecha_nacimiento).getTime())/(1000*60*60*24*365.25)) : null
  const iniciales = pac ? `${pac.nombre?.[0]||''}${pac.apellidos?.[0]||''}`.toUpperCase() : ''
  const bonoLabel: Record<string,string> = Object.fromEntries(bonosOpts.map(b=>[b.id, b.dias_semana>1?`${b.nombre} · ${b.dias_semana}d/sem`:b.nombre]))
  const pagoBadge: Record<string,string> = { pagado:'badge-g', pendiente:'badge-pen', impago:'badge-imp' }
  const pagoLabel: Record<string,string> = { pagado:'✓ Pagado', pendiente:'Pendiente', impago:'Impago' }
  const estadoColor: Record<string,string> = { activo:'var(--gm)', baja:'#E8A8A8', pausa:'#E6CE8A' }
  const estadoBg: Record<string,string> = { activo:'rgba(90,150,158,.22)', baja:'rgba(176,90,90,.22)', pausa:'rgba(201,168,76,.22)' }
  const estadoDot: Record<string,string> = { activo:'var(--g)', baja:'var(--red)', pausa:'var(--amb)' }
  const estadoLabel: Record<string,string> = { activo:'Activo', baja:'Baja', pausa:'Pausa' }
  const inputOscuro = { background:'rgba(255,255,255,.1)', color:'#fff', borderColor:'var(--gm)' }
  const contacto: [string,string][] = ([
    ['telefono', pac?.telefono], ['mail', pac?.email], ['dni', pac?.dni],
  ] as [string,any][]).filter(([,v])=>!!v)
  const metaPac: string[] = [
    edad ? `${edad} años` : '',
    pac?.altura_cm ? `${pac.altura_cm} cm` : '',
    pac?.peso_kg ? `${pac.peso_kg} kg` : '',
  ].filter(Boolean)

  if (loading) return <div className="loading">Cargando ficha...</div>
  if (!pac) return <div className="loading">Paciente no encontrado</div>

  return (
    <>
      <button className="pat-volver" onClick={()=>router.push('/pacientes')}>
        <Ic name="atras" size={13}/> Pacientes
      </button>

      {/* CABECERA */}
      <div className="pat-header">
        <div style={{position:'relative',flexShrink:0}}>
          {fotoUrl ? (
            <img src={fotoUrl} alt={pac.nombre} style={{width:84,height:84,borderRadius:'50%',objectFit:'cover',border:'1.5px solid var(--g)'}}/>
          ) : (
            <div className="pat-avatar">{iniciales}</div>
          )}
          <label style={{position:'absolute',bottom:-4,right:-4,width:20,height:20,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'2px solid var(--n)'}}>
            {subiendoFoto?'…':<Ic name="camara" size={12}/>}
            <input type="file" accept="image/*" onChange={subirFoto} style={{display:'none'}}/>
          </label>
        </div>

        <div style={{flex:editando?1:'0 1 auto',minWidth:0}}>
          {editando ? (
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
              {[['nombre','Nombre'],['apellidos','Apellidos'],['nombre_clinica','Nombre en clínica'],['dni','DNI'],['telefono','Teléfono'],['email','Email'],['altura_cm','Altura (cm)'],['peso_kg','Peso (kg)']].map(([k,l])=>(
                <input key={k} className="input" value={form[k]||''} onChange={e=>setForm((p:any)=>({...p,[k]:e.target.value}))} style={inputOscuro} placeholder={l}/>
              ))}
            </div>
          ) : (
            <div className="pat-id">
              <span className="pat-name">{pac.nombre} {pac.apellidos}</span>
              {pac.nombre_clinica&&<span className="pat-alias">“{pac.nombre_clinica}”</span>}
            </div>
          )}
          <div className="pat-meta">
            {metaPac.map((v,i)=><span key={i}>{i>0&&<span className="pat-sep">·</span>}{v}</span>)}
          </div>
          <div className="pat-tags">
            <span className="pat-tag" style={{background:estadoBg[pac.estado]||'rgba(90,150,158,.22)',color:estadoColor[pac.estado]||'var(--gm)'}}>
              <span className="pat-dot" style={{background:estadoDot[pac.estado]||'var(--g)'}}/>
              {estadoLabel[pac.estado]||'Activo'}
            </span>
          </div>
        </div>

        {!editando && contacto.length>0 && (
          <div className="pat-contacto">
            {contacto.map(([ic,v]:any)=>(
              <div key={ic} className="pat-ci"><span><Ic name={ic} size={14}/></span>{v}</div>
            ))}
          </div>
        )}

        <div style={{flex:1}}/>

        <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
          {editando ? (
            <>
              <button className="btn btn-d btn-sm" onClick={()=>{setForm(pac);setEditando(false)}}>Cancelar</button>
              <button className="btn btn-p btn-sm" onClick={guardarEdicion}><Ic name="guardar" size={12}/> Guardar</button>
            </>
          ) : (
            <>
              <button className="btn btn-p btn-sm" onClick={()=>setEditando(true)}><Ic name="editar" size={12}/> Editar</button>
              <button className="btn-ico" title="Más acciones" aria-label="Más acciones"
                onClick={e=>{const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setMenuAcc({ x:r.right-160, y:r.bottom+5 })}}>
                <Ic name="acciones" size={17}/>
              </button>
            </>
          )}
        </div>
      </div>

      {/* MENU DE ACCIONES */}
      {menuAcc && (
        <>
          <div style={{position:'fixed',inset:0,zIndex:59}} onClick={()=>setMenuAcc(null)}/>
          <div className="menu-flot" style={{left:menuAcc.x,top:menuAcc.y,minWidth:160}}>
            <button className="menu-it" onClick={()=>{setMenuAcc(null);setModalAlertas(true)}}><Ic name="alerta" size={14}/> Añadir alerta</button>
            <div style={{height:1,background:'var(--bd)',margin:'4px 0'}}/>
            {pac.estado==='activo' && <>
              <button className="menu-it" onClick={()=>{setMenuAcc(null);setModalPausa(true)}}><Ic name="pausa" size={14}/> Pausa temporal</button>
              <button className="menu-it" onClick={()=>{setMenuAcc(null);darDeBaja()}} disabled={procesando}><Ic name="altabaja" size={14}/> Dar de baja</button>
            </>}
            {(pac.estado==='baja'||pac.estado==='pausa') && (
              <button className="menu-it" onClick={()=>{setMenuAcc(null);reactivar()}} disabled={procesando}><Ic name="play" size={14}/> Reactivar</button>
            )}
            <div style={{height:1,background:'var(--bd)',margin:'4px 0'}}/>
            <button className="menu-it" style={{color:'var(--red)'}} onClick={()=>{setMenuAcc(null);eliminarPaciente()}} disabled={procesando}>
              <Ic name="papelera" size={14}/> Eliminar paciente
            </button>
          </div>
        </>
      )}

      {/* AVISO BAJA/PAUSA */}
      {pac.estado!=='activo' && (
        <div style={{background:pac.estado==='baja'?'var(--redl)':'var(--ambl)',border:`1px solid ${pac.estado==='baja'?'var(--red)':'var(--amb)'}`,borderRadius:'var(--rl)',padding:'10px 14px',marginBottom:10,display:'flex',alignItems:'center',gap:10}}>
          <span style={{display:'inline-flex',color:pac.estado==='baja'?'var(--red)':'var(--amb)'}}><Ic name={pac.estado==='baja'?'altabaja':'pausa'} size={17}/></span>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:500,color:pac.estado==='baja'?'var(--red)':'#7A5800'}}>
              {pac.estado==='baja'?'Paciente dado de baja':'Paciente en pausa temporal'}
            </div>
            <div style={{fontSize:10,color:pac.estado==='baja'?'var(--red)':'#7A5800',fontWeight:300}}>
              {pac.estado==='baja'?'Sus citas futuras fueron eliminadas. Pulsa Reactivar si vuelve.':(pac.pausa_desde&&pac.pausa_hasta?`En pausa del ${new Date(pac.pausa_desde+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})} al ${new Date(pac.pausa_hasta+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}. Sus citas de ese periodo fueron canceladas.`:'Sus citas del periodo de pausa fueron canceladas.')}
            </div>
          </div>
          <button className="btn btn-p btn-sm" onClick={reactivar}>▶ Reactivar</button>
        </div>
      )}

      {/* TABS */}
      <div className="tabs">
        {[['ficha','ficha','Ficha'],['timeline','historial','Historial'],['salud','salud','Salud'],['entreno','entreno','Entrenamiento'],['resultados','resultados','Resultados']].map(([k,ic,l])=>(
          <button key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}><span className="ct-l"><Ic name={ic} size={14}/> {l}</span></button>
        ))}
      </div>

      {/* TAB FICHA */}
      {tab==='ficha' && (
        <FichaTab
          pac={pac}
          bono={bono}
          estadoPago={cobrado ? 'pagado' : (bono?.estado_pago === 'impago' ? 'impago' : 'pendiente')}
          bonosSesiones={bonosSesiones}
          onRenovarSesiones={renovarSesiones}
          onRetirarSesiones={retirarSesiones}
          onCobrar={()=>setCobrando(bono)}
          recuperaciones={recuperaciones}
          editando={editando}
          form={form}
          setForm={setForm}
          setModalBono={setModalBono}
          bonoLabel={bonoLabel}
          mes={mes}
          anio={anio}
          alertas={alertas}
          cerrarAlerta={cerrarAlerta} cambiarPago={cambiarPago}
          tiposClase={tiposClase} cambiarTipoClase={cambiarTipoClase}
        />
      )}

      {tab==='timeline' && (
        <TimelineTab pacienteId={String(id)}/>
      )}

      {tab==='salud' && (
        <SaludTab id={id} pac={pac} deportesPac={deportesPac} molestias={molestias} patologias={patologias} escalas={escalas} medicamentos={medicamentos} alergias={alergias} intolerancias={intolerancias} operaciones={operaciones} tests={tests} cargar={cargar} onNuevoTest={()=>setEligiendoTest(true)} abrirTest={abrirTest}/>
      )}

      {/* TAB ENTRENAMIENTO */}
      {tab==='entreno' && (
        <EntrenoTab pacienteId={String(id)} nombrePaciente={pac?.nombre||''} sesiones={sesiones} onRefresh={cargar}/>
      )}

      {tab==='resultados' && (
        <ResultadosTab citas={citas} escalas={escalas} tests={tests} recuperaciones={recuperaciones} pac={pac} molestias={molestias} patologias={patologias} deportesPac={deportesPac} registros={registrosEj} generarPDF={generarPDF}/>
      )}

      {/* MODAL REGISTRAR TEST */}
      {/* ELEGIR TEST · el mismo explorador que la biblioteca y la valoración */}
      {eligiendoTest && (
        <div style={{position:'fixed',inset:0,zIndex:200,background:'var(--w)',display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 18px',borderBottom:'1px solid var(--bd)',flexShrink:0}}>
            <div style={{fontSize:15,fontWeight:500,color:'var(--n)'}}>Qué test se le pasa</div>
            <button className="modal-close" onClick={()=>setEligiendoTest(false)}><Ic name="cerrar" size={18}/></button>
          </div>
          <div style={{flex:1,minHeight:0,overflowY:'auto',padding:'14px 18px'}}>
            <ExploradorTests tests={testsDisp} etiquetas={etiquetasLib} autoFocus
              onAbrir={(t:any)=>{ setEligiendoTest(false); abrirTest(t.id,'bilateral') }}/>
          </div>
        </div>
      )}

      {/* PASARLO · la misma pantalla que en la valoración. Aquí se guarda en el momento;
          allí se acumula hasta el final. Lo único que cambia es esta botonera. */}
      {testEnCurso && (
        <ModalRealizarTest
          test={testEnCurso.test} tv={testEnCurso.tv}
          onCambiar={(tv:any)=>setTestEnCurso((p:any)=>({...p,tv}))}
          onCerrar={()=>setTestEnCurso(null)}
          pie={<>
            <button className="btn btn-d" onClick={()=>setTestEnCurso(null)} disabled={procesando}>Cancelar</button>
            <button className="btn btn-p" onClick={registrarTest} disabled={procesando}>
              {procesando ? 'Guardando…' : <><Ic name="guardar" size={13}/> Guardar resultado</>}
            </button>
          </>}/>
      )}


      {/* MODAL BONO */}
      {modalAlertas && (
        <ModalAlertasCita
          verAlertasCita={{paciente_id:pac.id, pacientes:{nombre:pac.nombre, apellidos:pac.apellidos}}}
          alertasPaciente={alertas}
          crearAlerta={crearAlerta}
          cerrarAlerta={cerrarAlerta}
          onCerrar={()=>setModalAlertas(false)}
        />
      )}

      {modalBono && (
        <ModalBono
          pacienteId={id as string}
          bonoActual={bono}
          bonosOpts={bonosOpts}
          onCerrar={()=>setModalBono(false)}
          onGuardado={cargar}
        />
      )}

      {cobrando && pac && (
        <ModalCobro
          paciente={pac}
          bono={cobrando}
          planes={planes}
          servicios={servicios}
          descuentos={descuentos}
          onCerrar={()=>setCobrando(null)}
          onEmitida={r=>{ setCobrando(null); alert(`Factura ${r.serie}/${String(r.numero).padStart(4,'0')} emitida.`); cargar() }}
        />
      )}

      {/* MODAL PAUSA */}
      {modalPausa && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalPausa(false)}}>
          <div className="modal">
            <div className="modal-title"><span className="ct-l"><Ic name="pausa" size={16}/> Pausa temporal</span><button className="modal-close" onClick={()=>setModalPausa(false)}>✕</button></div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:14,fontWeight:300}}>
              Las citas del periodo seleccionado se cancelarán automáticamente. El paciente podrá reactivarse cuando vuelva.
            </div>
            <div className="g2">
              <div className="field"><label>Desde</label><input type="date" className="input" value={pausa.desde} onChange={e=>setPausa(p=>({...p,desde:e.target.value}))}/></div>
              <div className="field"><label>Hasta (fecha de vuelta)</label><input type="date" className="input" value={pausa.hasta} onChange={e=>setPausa(p=>({...p,hasta:e.target.value}))}/></div>
            </div>
            <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:6,padding:'8px 11px',fontSize:10,color:'#7A5800',marginBottom:12}}>
              Se cancelarán todas las citas programadas entre esas fechas. Para reactivar al paciente entra en su ficha y pulsa Reactivar.
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-s btn-sm" onClick={()=>setModalPausa(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={aplicarPausa} disabled={procesando}>
                {procesando?'Aplicando…':'Aplicar pausa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
