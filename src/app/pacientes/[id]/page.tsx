'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { cargarBonosTipos, quitarBono, BonoTipo, cuotaVigenteDe } from '@/lib/bonos'
import FichaTab from './components/FichaTab'
import TimelineTab from './components/TimelineTab'
import SaludTab from './components/SaludTab'
import ResultadosTab from './components/ResultadosTab'
import EntrenoTab from './components/EntrenoTab'
import { Ic } from '@/lib/icons'
import { nombreTipoClase, cargarTiposClase, TIPOS_CLASE_FALLBACK } from '@/lib/tipos'
import { abrirAlerta, cerrarAlerta as cerrarAlertaLib } from '@/lib/alertas'
import { subirFotoPaciente, urlFotoPaciente } from '@/lib/fotos'
import { registrarResultadoTest, textoMedida, esSuma } from '@/lib/tests'
import ExploradorTests from '@/components/ExploradorTests'
import ModalCobro from '@/components/ModalCobro'
import { cargarTarifas } from '@/lib/tarifas'
import { bonosDe, renovarBonoSesiones, type BonoSesiones } from '@/lib/bonoSesiones'
import { programarEstado, anularProgramacion, estadoDe as situacionDe, ESTADOS_PACIENTE, textoDesde } from '@/lib/estadosPaciente'
import ModalRealizarTest, { ladoVacio } from '@/components/ModalRealizarTest'
import { asistencia } from '@/lib/resultados'
import { leerLista } from '@/lib/listasPaciente'
import ModalAlertasCita from '@/app/agenda/components/ModalAlertasCita'
import ModalBono from '../components/ModalBono'
import { borrarPaciente, siguePaciente } from '@/lib/borrarPaciente'
import { cerrarCuotasFuturas } from '@/lib/estadosPaciente'
import { useParams, useRouter } from 'next/navigation'
import { hoyISO } from '@/lib/fechas'


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
  // Baja o "puede volver" con fecha futura. Ver lib/estadosPaciente.ts.
  const [modalSalida, setModalSalida] = useState(false)
  const [salida, setSalida] = useState({ estado:'baja', desde:'', motivo:'' })

  /**
   * Qué se le puede programar según dónde esté ahora.
   *
   * A quien está dentro se le programa la salida; a quien está fuera, la
   * vuelta. Ofrecer las dos siempre dejaría programar una baja a alguien que ya
   * está de baja, que no significa nada.
   */
  const opcionesSalida = pac?.estado === 'activo' || pac?.estado === 'pausa'
    ? [['puede_volver','Puede volver','reloj'],['baja','Dar de baja','altabaja']]
    : [['activo','Reincorporar','play']]
  const [bonosOpts, setBonosOpts] = useState<BonoTipo[]>([])
  const [pausa, setPausa] = useState({ desde: hoyISO(), hasta: '' })
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
  async function cargar() {
    if (primeraCarga.current) setLoading(true)
    const [{ data: p },{ data: b },{ data: m },{ data: pat },{ data: med },{ data: esc },{ data: c },{ data: s }] = await Promise.all([
      supabase.from('pacientes').select('*').eq('id',id).single(),
      // Todos sus bonos activos, no solo el último creado. Cuál es "el suyo" lo decide
      // `cuotaVigenteDe` en lib/bonos, que es la MISMA función que usa la lista de
      // pacientes. Antes la regla estaba escrita en las dos pantallas y, aunque decían lo
      // mismo, cada una leía datos distintos: la ficha enseñaba una cuota y la lista otra.
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
    const cuota = cuotaVigenteDe(b||[])
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
  //
  // `fecha_nacimiento` y `sexo` SÍ se guardan aquí. La fecha se editaba en la valoración y
  // en ningún sitio más: si entraba mal, la ficha la enseñaba mal para siempre. Y los dos
  // son ahora lo que decide con qué norma se compara un test de baremo, así que tienen que
  // poder corregirse donde se mira al paciente.
  async function guardarEdicion() {
    const { error } = await supabase.from('pacientes').update({
      nombre:form.nombre, apellidos:form.apellidos, nombre_clinica:form.nombre_clinica||null, telefono:form.telefono,
      email:form.email, dni:form.dni, altura_cm:form.altura_cm,
      peso_kg:form.peso_kg, notas_fijas:form.notas_fijas,
      fecha_nacimiento:form.fecha_nacimiento||null, sexo:form.sexo||null,
    }).eq('id',id)
    // Se cerraba el modo edición y se recargaba pasara lo que pasara, así que un guardado
    // rechazado se veía igual que uno correcto: los campos volvían a su valor anterior y
    // parecía que no habías escrito nada.
    if (error) { alert('No se han guardado los cambios: ' + error.message); return }
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
    /**
     * EL LADO TIENE QUE PERTENECER AL TEST. Aquí es donde se colaban los 'bilateral'.
     *
     * El explorador llama siempre con 'bilateral', y como es un valor con contenido pasaba
     * de largo: en un test lateral dejaba `ladoActivo:'bilateral'`, ninguna pestaña se
     * encendía y al guardar se escribía una fila con lado 'bilateral' para un test que solo
     * tiene izquierdo y derecho. De ahí salen los tests que aparecen con los tres.
     *
     * Al REPETIR se abre en el lado que se venía mirando. Al pasarlo de cero en un test
     * lateral no se elige por ti: se entra sin lado y hay que decirlo.
     */
    const lateral = test.tipo_lado === 'lateral'
    const valido = lateral ? (lado==='izquierdo' || lado==='derecho') : (lado==='bilateral')
    const l = valido ? lado : (lateral ? '' : 'bilateral')
    setTestEnCurso({ test, tv: { ladoActivo:l, frecuencia_meses:test.frecuencia_meses,
      lados: l ? { [l]: ladoVacio(test) } : {} } })
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
    // Sin lado no se guarda. La clave vacía llegaba a la base como un resultado más y
    // salía en el historial un test "hecho" que no se había medido en ningún sitio.
    const conDato = Object.keys(tv.lados||{}).filter(k => k && tv.lados[k]?.resultado && tv.lados[k].resultado!=='sin_realizar')
    if (conDato.length===0) {
      alert(test.tipo_lado==='lateral'
        ? 'Elige el lado y marca el resultado antes de guardar.'
        : 'Marca el resultado antes de guardar')
      return
    }
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
      // Positivo que no abre NINGÚN objetivo: el test ha detectado algo y en la ficha no
      // va a aparecer nada. Casi siempre es que el objetivo cuelga de otro ítem —una
      // casilla que nadie marcó— en vez del que ha dado positivo. Antes esto pasaba en
      // silencio y parecía que la app se había tragado el resultado.
      if (r.resultado === 'positivo' && r.abiertos === 0) {
        // En un test de puntuación el objetivo no cuelga de ningún ítem: cuelga del test
        // entero, y se engancha desde la ficha del objetivo. Mandar ahí a buscar "el ítem
        // que ha dado positivo" sería mandar a buscar algo que no existe.
        alert(esSuma(test)
          ? `El test ha salido POSITIVO en ${lado} (${r.banda || 'sin banda'}) pero no tiene ningún objetivo enganchado, así que no va a aparecer nada en la ficha.\n\nEngánchalo en Biblioteca → Objetivos: el objetivo apunta al test «${test.nombre}» entero.`
          : `El test ha salido POSITIVO en ${lado} pero no tiene ningún objetivo enganchado, así que no va a aparecer nada en la ficha.\n\nEngánchalo en Biblioteca → Tests → ${test.nombre}: en el ÍTEM que ha dado positivo, no en otro.`)
      }
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
    const hoy = hoyISO()
    const { error: errCitas } = await supabase.from('citas').delete().eq('paciente_id',id).gte('fecha',hoy).eq('estado','programada')
    if (errCitas) { setProcesando(false); alert('No se han podido eliminar sus citas futuras: ' + errCitas.message); return }
    /**
     * Las fechas de pausa se limpian al dar de baja.
     *
     * Un paciente puede irse de baja ESTANDO EN PAUSA, y si se le deja el `pausa_hasta`
     * puesto queda una fecha de vuelta apuntando a alguien que ya no está: el día que
     * llegue, cualquier proceso que mire esas fechas tiene motivo para tocarlo. La baja es
     * un estado nuevo, no una pausa con otro nombre.
     */
    const { error } = await supabase.from('pacientes')
      .update({ estado:'baja', estado_desde:hoy, pausa_desde:null, pausa_hasta:null }).eq('id',id)
    if (error) { setProcesando(false); alert('No se ha podido dar de baja: ' + error.message); return }

    /**
     * Y SUS CUOTAS FUTURAS. La baja borraba las citas pero dejaba el bono activo, así que
     * seguía saliendo con bono en la lista y contando como pendiente en Finanzas.
     *
     * La del mes en curso se respeta a propósito: si el mes ha empezado y no avisó, ese
     * mes se cobra entero, y si no lo paga queda como impago. Eso es información, no un
     * error que haya que limpiar.
     */
    const rc = await cerrarCuotasFuturas(String(id))
    if (!rc.ok) alert('El paciente está de baja, pero sus cuotas futuras no se han podido cerrar: ' + rc.error)

    await registrarEvento('baja', pac.estado === 'pausa' ? 'Baja del servicio, estando en pausa' : 'Baja del servicio',
      `Sus citas futuras programadas fueron eliminadas.${rc.ok && rc.cerradas > 0 ? ` Se cerraron ${rc.cerradas} cuota${rc.cerradas>1?'s':''} de meses posteriores.` : ''}`)
    setProcesando(false)
    alert('✓ Paciente dado de baja. Sus citas futuras han sido eliminadas.'
      + (rc.ok && rc.cerradas > 0 ? `\n\nTambién se han cerrado ${rc.cerradas} cuota${rc.cerradas>1?'s':''} de meses posteriores. La del mes en curso se mantiene.` : ''))
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
    await supabase.from('pacientes').update({ estado:'pausa', estado_desde:pausa.desde, pausa_desde:pausa.desde, pausa_hasta:pausa.hasta }).eq('id',id)
    await registrarEvento('pausa', `Pausa del ${pausa.desde} al ${pausa.hasta}`, `${citasPausa?.length||0} citas canceladas en ese periodo.`)
    setProcesando(false)
    setModalPausa(false)
    alert(`✓ Pausa aplicada. ${citasPausa?.length||0} citas canceladas del ${pausa.desde} al ${pausa.hasta}.\nEl paciente se reactivará automáticamente al volver.`)
    cargar()
  }

  /**
   * "Puede volver": lo dejó sin fecha, pero dijo que volvería.
   *
   * No es una pausa y no es una baja. La pausa cobra el mes —es alguien de
   * vacaciones que conserva su plaza— y la baja borra sus citas futuras y lo
   * saca de todas las listas. Aquí no se le cobra nada y no cuenta como
   * cliente, pero sigue estando a la vista con los meses que lleva sin venir.
   *
   * Sus citas futuras se cancelan, no se borran: si vuelve la semana que viene,
   * el historial cuenta lo que pasó de verdad. Y se limpian las fechas de pausa
   * por lo mismo que en la baja: una fecha de vuelta apuntando a alguien que no
   * la tiene haría que la reactivación automática se lo llevara por delante.
   */
  async function marcarPuedeVolver() {
    if (!confirm(`¿Marcar a ${pac.nombre} ${pac.apellidos} como "puede volver"?\n\nDeja de contar como cliente y no se le cobra el mes. Sus citas programadas se cancelan, pero sigue apareciendo en su lista de seguimiento.`)) return
    setProcesando(true)
    const hoy = hoyISO()
    const { error: errCitas } = await supabase.from('citas')
      .update({ estado:'cancelada' }).eq('paciente_id',id).gte('fecha',hoy).eq('estado','programada')
    if (errCitas) { setProcesando(false); alert('No se han podido cancelar sus citas futuras: ' + errCitas.message); return }
    const { error } = await supabase.from('pacientes')
      .update({ estado:'puede_volver', estado_desde:hoy, pausa_desde:null, pausa_hasta:null }).eq('id',id)
    if (error) { setProcesando(false); alert('No se ha podido cambiar el estado: ' + error.message); return }

    /**
     * Y SUS CUOTAS DE MESES POSTERIORES, igual que en la baja.
     *
     * Deja de ser cliente, así que una cuota dejada preparada para octubre es un cobro de
     * un servicio que no va a recibir. Sin esto seguía activa: salía con bono en la lista y
     * contaba como pendiente en Finanzas.
     *
     * La del mes en curso no se toca aquí, igual que en la baja.
     */
    const rc = await cerrarCuotasFuturas(String(id))
    if (!rc.ok) alert('El estado se ha cambiado, pero sus cuotas futuras no se han podido cerrar: ' + rc.error)

    await registrarEvento('pausa', 'Marcado como "puede volver"',
      `Sin fecha de vuelta. Sus citas programadas se han cancelado.${rc.ok && rc.cerradas > 0 ? ` Se cerraron ${rc.cerradas} cuota${rc.cerradas>1?'s':''} de meses posteriores.` : ''}`)
    setProcesando(false)
    cargar()
  }

  async function guardarSalida() {
    if (!salida.desde) { alert('Indica desde qué día'); return }
    setProcesando(true)
    const r = await programarEstado(String(id), salida.estado, salida.desde, salida.motivo)
    setProcesando(false)
    if (!r.ok) { alert('No se ha podido programar: ' + r.error); return }
    setModalSalida(false)
    setSalida({ estado:'baja', desde:'', motivo:'' })
    cargar()
  }

  async function quitarSalida() {
    if (!confirm('¿Quitar el cambio de estado programado? El paciente sigue como está.')) return
    setProcesando(true)
    const r = await anularProgramacion(String(id))
    setProcesando(false)
    if (!r.ok) { alert('No se ha podido anular: ' + r.error); return }
    cargar()
  }

  async function reactivar() {
    if (!confirm(`¿Reactivar a ${pac.nombre} ${pac.apellidos}?`)) return
    await supabase.from('pacientes').update({ estado:'activo', estado_desde:hoyISO(), pausa_desde:null, pausa_hasta:null }).eq('id',id)
    await registrarEvento('reactivacion', 'Reactivación del servicio', null)
    alert('✓ Paciente reactivado. Recuerda crear sus nuevas citas en la agenda.')
    cargar()
  }

  async function eliminarPaciente() {
    if (!confirm(`¿Eliminar DEFINITIVAMENTE a ${pac.nombre} ${pac.apellidos}?\n\nEsta acción NO se puede deshacer. Se borrarán todos sus datos, citas y sesiones.`)) return
    if (!confirm('Segunda confirmación: ¿estás completamente seguro?')) return
    setProcesando(true)
    const r = await borrarPaciente(String(id))
    if (!r.ok) {
      setProcesando(false)
      alert(`No se ha podido borrar a ${pac.nombre}.\n\n${r.error}${r.tabla ? `\n\n(al borrar sus ${r.tabla})` : ''}`)
      return
    }
    // El delete de Supabase devuelve ok aunque no haya borrado ninguna fila —una política
    // RLS que no deja, por ejemplo—, así que se comprueba antes de decir que está hecho.
    // Sin esto volvíamos a la lista tan tranquilos y el paciente seguía ahí.
    if (await siguePaciente(String(id))) {
      setProcesando(false)
      alert(`${pac.nombre} sigue en la base de datos.\n\nEl borrado no ha dado error pero tampoco ha borrado nada: lo normal es que sea un permiso.`)
      return
    }
    router.push('/pacientes')
  }

  async function registrarEvento(tipo:string, titulo:string, descripcion:string|null=null, pacId:any=id) {
    await supabase.from('eventos_paciente').insert({ paciente_id:pacId, tipo, titulo, descripcion, fecha:hoyISO() })
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
  // Cuatro mapas, y ninguno conocía 'puede_volver': la cabecera caía al valor por
  // defecto y ponía "Activo" a alguien que lo había dejado. Un estado nuevo tiene
  // que fallar de forma visible, no fingir el más inocuo de todos.
  // Su última clase DADA, de las citas que ya están cargadas. Es lo que
  // convierte "puede volver" en algo accionable: tres meses sin aparecer es una
  // llamada pendiente, tres semanas es normal.
  const ultimaClase = (citas||[])
    .filter((c:any)=>c.estado==='realizada')
    .map((c:any)=>c.fecha)
    .sort()
    .pop() || null

  const estadoColor: Record<string,string> = { activo:'var(--gm)', baja:'#E8A8A8', pausa:'#E6CE8A', puede_volver:'#C9C4BC' }
  const estadoBg: Record<string,string> = { activo:'rgba(90,150,158,.22)', baja:'rgba(176,90,90,.22)', pausa:'rgba(201,168,76,.22)', puede_volver:'rgba(255,255,255,.14)' }
  const estadoDot: Record<string,string> = { activo:'var(--g)', baja:'var(--red)', pausa:'var(--amb)', puede_volver:'var(--grl)' }
  const estadoLabel: Record<string,string> = Object.fromEntries(ESTADOS_PACIENTE.map(e => [e.id, e.nombre]))
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
              {/* Fecha de nacimiento y sexo van fuera del mapa porque no son cajas de
                  texto. Los dos son lo que decide con qué norma se compara un test de
                  baremo, y hasta ahora la fecha no se podía ni corregir desde aquí. */}
              <input className="input" type="date" value={(form.fecha_nacimiento||'').slice(0,10)}
                onChange={e=>setForm((p:any)=>({...p,fecha_nacimiento:e.target.value}))}
                style={inputOscuro} title="Fecha de nacimiento"/>
              <select className="input" value={form.sexo||''} onChange={e=>setForm((p:any)=>({...p,sexo:e.target.value}))}
                style={inputOscuro} title="Sexo · se usa para los baremos de los tests">
                <option value="">Sexo · sin indicar</option>
                <option value="hombre">Hombre</option>
                <option value="mujer">Mujer</option>
              </select>
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
              {estadoLabel[pac.estado] || pac.estado}
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
            {pac.estado==='activo' && (
              <button className="menu-it" onClick={()=>{setMenuAcc(null);setModalPausa(true)}}><Ic name="pausa" size={14}/> Pausa temporal</button>
            )}
            {/* Dar de baja también DESDE LA PAUSA. Estaba atado a `activo`, así que a quien
                estaba en pausa había que reactivarlo primero para poder darlo de baja: dos
                pasos y un estado intermedio falso en el historial, cuando lo que ha pasado
                es que no vuelve. */}
            {/* "Puede volver" va ANTES de "Dar de baja" a propósito: es la
                opción que se busca cuando alguien lo deja diciendo que volverá,
                y si la baja está primero se pulsa la baja. */}
            {(pac.estado==='activo'||pac.estado==='pausa') && (
              <button className="menu-it" onClick={()=>{setMenuAcc(null);marcarPuedeVolver()}} disabled={procesando}><Ic name="reloj" size={14}/> Puede volver</button>
            )}
            {/* Programar la salida. Es lo que se necesita cuando alguien avisa a
                mitad de mes: sigue viniendo y pagando hasta la fecha. */}
            {!pac.estado_programado && (
              <button className="menu-it" disabled={procesando}
                onClick={()=>{
                  setMenuAcc(null)
                  setSalida({ estado: (pac.estado==='activo'||pac.estado==='pausa') ? 'puede_volver' : 'activo', desde:'', motivo:'' })
                  setModalSalida(true)
                }}>
                <Ic name="calendario" size={14}/> {(pac.estado==='activo'||pac.estado==='pausa') ? 'Programar baja…' : 'Programar vuelta…'}
              </button>
            )}
            {(pac.estado==='activo'||pac.estado==='pausa'||pac.estado==='puede_volver') && (
              <button className="menu-it" onClick={()=>{setMenuAcc(null);darDeBaja()}} disabled={procesando}><Ic name="altabaja" size={14}/> Dar de baja</button>
            )}
            {(pac.estado==='baja'||pac.estado==='pausa'||pac.estado==='puede_volver') && (
              <button className="menu-it" onClick={()=>{setMenuAcc(null);reactivar()}} disabled={procesando}><Ic name="play" size={14}/> Reactivar</button>
            )}
            <div style={{height:1,background:'var(--bd)',margin:'4px 0'}}/>
            <button className="menu-it" style={{color:'var(--red)'}} onClick={()=>{setMenuAcc(null);eliminarPaciente()}} disabled={procesando}>
              <Ic name="papelera" size={14}/> Eliminar paciente
            </button>
          </div>
        </>
      )}

      {/* EN QUÉ SITUACIÓN ESTÁ
          Cada estado con SU color y SU icono. Antes esto era un ternario
          "¿es baja? rojo : ámbar", así que "puede volver" salía idéntico a una
          pausa —mismo ámbar, mismo icono de pausa— y solo se distinguían por el
          texto. Dos situaciones que se cobran de forma distinta no pueden
          parecer la misma de un vistazo.

          Lo que de verdad las separa es la fecha de vuelta: la pausa la tiene y
          se reactiva sola; esta no, y por eso hay que llamar a alguien. */}
      {pac.estado!=='activo' && (() => {
        const S = {
          baja:         { bg:'var(--redl)', bd:'var(--red)', tx:'var(--red)', ic:'altabaja',
                          titulo:'Paciente dado de baja' },
          puede_volver: { bg:'var(--bl)',   bd:'var(--bd)',  tx:'var(--gr)',  ic:'reloj',
                          titulo:'Lo dejó, pero puede volver' },
          pausa:        { bg:'var(--ambl)', bd:'var(--amb)', tx:'#7A5800',    ic:'pausa',
                          titulo:'Paciente en pausa temporal' },
        }[pac.estado as 'baja'|'puede_volver'|'pausa'] || {
          bg:'var(--bl)', bd:'var(--bd)', tx:'var(--gr)', ic:'alerta', titulo:pac.estado
        }
        return (
          <div style={{background:S.bg,border:`1px solid ${S.bd}`,borderRadius:'var(--rl)',padding:'10px 14px',marginBottom:10,display:'flex',alignItems:'center',gap:10}}>
            <span style={{display:'inline-flex',color:S.tx}}><Ic name={S.ic} size={17}/></span>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:500,color:S.tx}}>{S.titulo}</div>
              <div style={{fontSize:10,color:S.tx,fontWeight:300,lineHeight:1.5}}>
                {pac.estado==='baja'
                  ? 'Sus citas futuras fueron eliminadas. Pulsa Reactivar si vuelve.'
                  : pac.estado==='puede_volver'
                  ? <><strong>Sin fecha de vuelta.</strong> No se le cobra el mes ni cuenta como cliente.
                      {' '}Última clase {textoDesde(ultimaClase)}. Pulsa Reactivar cuando vuelva, o programa la vuelta si ya sabéis el día.</>
                  : pac.pausa_desde && pac.pausa_hasta
                  ? `Vuelve el ${new Date(pac.pausa_hasta+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long'})}, y se reactiva solo ese día. Se le cobra el mes igual. Sus citas del periodo fueron canceladas.`
                  : 'Sus citas del periodo de pausa fueron canceladas. Se le cobra el mes igual.'}
              </div>
            </div>
            <button className="btn btn-p btn-sm" onClick={reactivar}>▶ Reactivar</button>
          </div>
        )
      })()}

      {/* SALIDA PROGRAMADA
          Se avisa aquí arriba y no escondido en un menú: mientras esté puesto,
          todo lo demás de la ficha dice que es un cliente normal, y lo es —hasta
          esa fecha—. Pero quien abra la ficha tiene que saber que se va. */}
      {pac.estado_programado && pac.estado_programado_desde && (
        <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:'var(--rl)',padding:'10px 14px',marginBottom:10,display:'flex',alignItems:'center',gap:10}}>
          <span style={{display:'inline-flex',color:'var(--amb)'}}><Ic name="calendario" size={17}/></span>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:500,color:'#7A5800'}}>
              {pac.estado_programado==='baja' ? 'Baja programada desde el'
               : pac.estado_programado==='activo' ? 'Vuelve el'
               : 'Lo deja a partir del'}{' '}
              {new Date(pac.estado_programado_desde+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long'})}
            </div>
            <div style={{fontSize:10,color:'#7A5800',fontWeight:300,lineHeight:1.5}}>
              {pac.estado_programado==='activo'
                ? <>Hasta entonces no cuenta como cliente ni se le cobra. Ese día vuelve a estar activo
                    solo; acuérdate de asignarle el bono y de ponerle citas.</>
                : <>Su última clase es el día anterior. Hasta entonces sigue viniendo y se le
                    cobra el mes normalmente; de esa fecha en adelante se le cancelan las citas.</>}
              {pac.estado_programado_motivo && <> · {pac.estado_programado_motivo}</>}
            </div>
          </div>
          <button className="btn btn-s btn-sm" onClick={quitarSalida} disabled={procesando}>Anular</button>
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
          paciente={{ sexo: pac.sexo, fecha_nacimiento: pac.fecha_nacimiento }}
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

      {/* PROGRAMAR LA SALIDA
          Alguien avisa el día 10 de que lo deja a fin de mes. Hasta ahora había
          que elegir entre marcarlo ya —y perder sus quince clases pendientes de
          la agenda— o acordarse el día 30. */}
      {modalSalida && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalSalida(false)}}>
          <div className="modal" style={{maxWidth:430}}>
            <div className="modal-title">
              <span className="ct-l"><Ic name="calendario" size={16}/> {salida.estado==='activo' ? 'Programar vuelta' : 'Programar salida'}</span>
              <button className="modal-close" onClick={()=>setModalSalida(false)}>✕</button>
            </div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:14,lineHeight:1.6}}>
              {salida.estado==='activo'
                ? <>Hasta ese día <strong>no cambia nada</strong>: no cuenta como cliente ni se le
                    cobra. Esa fecha vuelve a estar activo solo, sin tocarle ninguna cita.
                    El bono se le asigna aparte, con su propia fecha de inicio.</>
                : <>Hasta ese día, <strong>no cambia nada</strong>: sigue en la agenda, se le
                    cobra el mes y aparece en las listas. A partir de esa fecha se aplica
                    solo y se le cancelan las citas.</>}
            </div>

            <div className="field">
              <label>{salida.estado==='activo' ? '¿Qué se programa?' : '¿Qué pasa con esta persona?'}</label>
              {/* Mismas palabras y mismos iconos que el menú de los tres puntos.
                  Si allí pone "Puede volver" y aquí "Lo deja, pero puede volver",
                  parecen dos cosas distintas y hay que pararse a comprobar que no
                  lo son. Y en el mismo orden, por lo mismo. */}
              <div style={{display:'flex',gap:6}}>
                {opcionesSalida.map(([v,l,ic])=>(
                  <button key={v} type="button" onClick={()=>setSalida(p=>({...p,estado:v}))}
                    style={{flex:1,padding:'8px 6px',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:10,
                            display:'flex',alignItems:'center',justifyContent:'center',gap:5,
                            border:`1.5px solid ${salida.estado===v?'var(--g)':'var(--bd)'}`,
                            background:salida.estado===v?'var(--g)':'var(--w)',
                            color:salida.estado===v?'#fff':'var(--gr)'}}>
                    <Ic name={ic} size={13}/> {l}
                  </button>
                ))}
              </div>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:4,lineHeight:1.5}}>
                {situacionDe(salida.estado).ayuda}
              </div>
            </div>

            <div className="field">
              <label>{salida.estado==='activo' ? 'Primer día que vuelve *' : 'Primer día que ya no viene *'}</label>
              <input type="date" className="input" value={salida.desde}
                min={hoyISO()}
                onChange={e=>setSalida(p=>({...p,desde:e.target.value}))}/>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:4}}>
                {salida.estado==='activo'
                  ? 'Ese día amanece activo. Acuérdate de asignarle el bono y de ponerle citas.'
                  : 'Su última clase es el día ANTERIOR a este. Si lo deja a final de agosto, pon el 1 de septiembre. Las citas de ese día en adelante se cancelan.'}
              </div>
            </div>

            <div className="field">
              <label>Motivo (opcional)</label>
              <input className="input" placeholder={salida.estado==='activo' ? 'ej. vuelve tras la lesión' : 'ej. se muda, lesión, precio'}
                value={salida.motivo} onChange={e=>setSalida(p=>({...p,motivo:e.target.value}))}/>
            </div>

            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalSalida(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardarSalida} disabled={procesando||!salida.desde}>
                {procesando?'…':'✓ Programar'}
              </button>
            </div>
          </div>
        </div>
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
