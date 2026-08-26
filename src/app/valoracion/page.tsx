'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { guardarConsentimientos, TipoConsentimiento } from '@/lib/consentimientos'
import { registrarResultadoTest, testsPositivosDe } from '@/lib/tests'
import { anadirALista, leerLista } from '@/lib/listasPaciente'
import { cargarBonosTipos, type BonoTipo } from '@/lib/bonos'
import { TIPOS_CLASE_FALLBACK, parseTiposClase, VIAS_CAPTACION_FALLBACK, parseListaSimple } from '@/lib/tipos'
import { useRouter } from 'next/navigation'
import { Ic } from '@/lib/icons'
import PasoPaciente from './components/PasoPaciente'
import PasoPacienteRevaloracion from './components/PasoPacienteRevaloracion'
import PasoAnamnesis from './components/PasoAnamnesis'
import PasoHistorial from './components/PasoHistorial'
import PasoCompletar from './components/PasoCompletar'
import PasoTests from './components/PasoTests'
import PasoPlan from './components/PasoPlan'
import PasoResumen from './components/PasoResumen'

/**
 * Valoración y revaloración.
 *
 * Son el mismo acto —anamnesis, tests, y lo que salga de ahí mueve objetivos—
 * hecho en dos momentos distintos, así que comparten pasos y comparten el
 * `finalizar` que los guarda. Lo único que cambia es de dónde se parte:
 *
 *  - INICIAL: el paciente puede no existir todavía. Hay que crearlo, firmar los
 *    consentimientos, elegir bono y plan. Se pregunta todo porque no se sabe nada.
 *  - REVALORACIÓN: el paciente ya está, con su historial y sus tests abiertos. Ni
 *    se vuelve a firmar ni se abre otro bono; se pregunta qué ha cambiado.
 *
 * Partirlo en dos páginas habría duplicado el guardado, que es la parte que de
 * verdad importa: la que registra los tests y mueve los objetivos.
 */

type Modo = 'inicial' | 'revaloracion'

const STEPS_POR_MODO: Record<Modo, string[]> = {
  inicial: ['Paciente', 'Anamnesis', 'Historial', 'Tests', 'Plan', 'Resumen'],
  revaloracion: ['Paciente', 'Anamnesis', 'Completar', 'Tests', 'Resumen'],
}

const FORM_VACIO = {
  paciente_id:'',desde_pendiente:false as boolean,nombre:'',apellidos:'',nombre_clinica:'',telefono:'',email:'',dni:'',fecha_nacimiento:'',sexo:'',altura_cm:'',peso_kg:'',como_nos_conocio:'',
  anamnesis:'',trabajo:'',tipo_jornada:'',objetivo1:'',objetivo2:'',objetivo3:'',deseo:'',borg:5,estres:5,
  hace_deporte:false as boolean,deportes:[] as string[],
  plantillas:false as boolean,tipo_plantilla:'' as string,plantilla_izq:'' as string,plantilla_der:'' as string,
  medicacion:[] as any[],operaciones:[] as any[],alergias:[] as string[],intolerancias:[] as string[],
  patologias:[] as any[],molestias:[] as any[],dieta:'sin_restricciones',
  tipo_clase_def:'entrenamiento',bono:'',dias_asistencia:'',franja:'manana',notas_plan:'',
  horario_pref:{modo:'general',franja_general:'manana',franjas_dia:{} as Record<string,string>,alterno:'manana_tarde',hora_exacta:'',notas_horario:''},
}

export default function ValoracionPage() {
  const [modo, setModo] = useState<Modo>('inicial')
  const [step, setStep] = useState(1)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const router = useRouter()
  const [testsLib, setTestsLib] = useState<any[]>([])
  const [etiquetasLib, setEtiquetasLib] = useState<any[]>([])
  const [testsValoracion, setTestsValoracion] = useState<any[]>([])
  const [testActivo, setTestActivo] = useState<number|null>(null)
  const [comoNosConocioOpts, setComoNosConocioOpts] = useState<string[]>(VIAS_CAPTACION_FALLBACK)
  const [tiposJornada, setTiposJornada] = useState<string[]>(['Sentado','Sedentario','De pie','Mixto','Esfuerzo físico','Conductor','Pantallas','Trabajo manual'])
  const [tiposPlantilla, setTiposPlantilla] = useState<string[]>(['Rígida','Semirrígida','Blanda','Descarga metatarsal','Propioceptiva','Personalizada'])
  const [deportesOpts, setDeportesOpts] = useState<string[]>(['Fútbol','Pádel','Tenis','Natación','Ciclismo','Running','CrossFit','Yoga','Pilates','Gimnasio','Golf','Baloncesto','Senderismo','Otro'])
  const [tiposClaseOpts, setTiposClaseOpts] = useState<any[]>(TIPOS_CLASE_FALLBACK)
  /**
   * Los bonos salen de `bonos_tipos` como en el resto de la app (`lib/bonos.ts`).
   *
   * Aquí había una lista escrita a mano —reducido, esencial, progreso, avanzado…— más un
   * intento de leer una clave `ajustes.bonos_lista` que ya no escribe nadie: Ajustes →
   * Bonos guarda en la TABLA. Resultado: la valoración ofrecía bonos que no existían y no
   * ofrecía los que sí, como el individual o el de pareja.
   */
  const [bonosOpts, setBonosOpts] = useState<BonoTipo[]>([])
  const [medsBiblio, setMedsBiblio] = useState<any[]>([])
  const [patsBiblio, setPatsBiblio] = useState<any[]>([])
  const [molsBiblio, setMolsBiblio] = useState<any[]>([])
  const [opsBiblio, setOpsBiblio] = useState<any[]>([])
  const [alergiasBiblio, setAlergiasBiblio] = useState<any[]>([])
  const [intolBiblio, setIntolBiblio] = useState<any[]>([])
  const [firmaAceptada, setFirmaAceptada] = useState(false)
  const [imagenesAceptada, setImagenesAceptada] = useState(false)
  const [clinicaAceptada, setClinicaAceptada] = useState(false)
  const [firmaCanvas, setFirmaCanvas] = useState<string>('')
  // Lo que el paciente ya trae a la revaloración. Se lee al elegirlo y solo se
  // usa para enseñarlo: nada de esto se vuelve a guardar.
  /** Nombre y logo para el membrete del informe. Vienen de Ajustes → Clínica. */
  const [clinica, setClinica] = useState<{nombre?:string,logo?:string}>({})
  const [previo, setPrevio] = useState<any>(null)
  const [cargandoPrevio, setCargandoPrevio] = useState(false)
  /** El paciente recién guardado: a dónde llevan los botones del final. */
  const [guardado, setGuardado] = useState<{id:string,nombre:string}|null>(null)
  const [form, setForm] = useState({...FORM_VACIO})

  const up = (k: string, v: any) => setForm(p=>({...p,[k]:v}))

  const STEPS = STEPS_POR_MODO[modo]
  const esRevaloracion = modo === 'revaloracion'

  useEffect(() => {
    // Se traen TODOS los campos que la valoración puede reescribir. Traer menos era lo que
    // vaciaba la ficha de un pendiente: lo que no se cargaba se guardaba en blanco.
    supabase.from('pacientes').select('id,nombre,apellidos,nombre_clinica,telefono,email,dni,fecha_nacimiento,sexo,altura_cm,peso_kg,tipo_clase,como_nos_conocio,usa_plantillas,plantilla_izq,plantilla_der,pendiente_valoracion').eq('estado','activo').order('nombre').then(({data})=>setPacientes(data||[]))
    supabase.from('medicamentos_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setMedsBiblio(data||[]))
    supabase.from('patologias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setPatsBiblio(data||[]))
    supabase.from('molestias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setMolsBiblio(data||[]))
    supabase.from('operaciones_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setOpsBiblio(data||[]))
    supabase.from('alergias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setAlergiasBiblio(data||[]))
    supabase.from('intolerancias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setIntolBiblio(data||[]))
    supabase.from('deportes_biblioteca').select('nombre').eq('activo',true).order('nombre').then(({data})=>{ if(data&&data.length) setDeportesOpts(data.map((d:any)=>d.nombre)) })
    supabase.from('plantillas_biblioteca').select('nombre').eq('activo',true).order('nombre').then(({data})=>{ if(data&&data.length) setTiposPlantilla(data.map((t:any)=>t.nombre)) })
    supabase.from('tests').select('*').order('nombre').then(({data})=>setTestsLib(data||[]))
    supabase.from('etiquetas').select('*').order('nombre').then(({data})=>setEtiquetasLib(data||[]))
    cargarBonosTipos().then(bs => {
      setBonosOpts(bs)
      // Sin bono por defecto escrito a mano: manda el primero que haya configurado, y si
      // no hay ninguno se queda vacío y el guardado avisa.
      setForm(f => f.bono && bs.some(b => b.id === f.bono) ? f : { ...f, bono: bs[0]?.id || '' })
    })
    supabase.from('ajustes').select('clave,valor').then(({data})=>{
      if(data){
        const map: Record<string,string> = {}
        data.forEach((a:any)=>{map[a.clave]=a.valor||''})
        setComoNosConocioOpts(parseListaSimple(map.como_nos_conocio, VIAS_CAPTACION_FALLBACK))
        if(map.tipos_jornada) setTiposJornada(JSON.parse(map.tipos_jornada))
        setTiposClaseOpts(parseTiposClase(map.tipos_clase))
        setClinica({ nombre: map.clinica_nombre || '', logo: map.clinica_logo || '' })
      }
    })
  }, [])

  /**
   * Cambiar de pestaña vacía lo escrito. Es a propósito: media valoración inicial
   * arrastrada a una revaloración es peor que volver a empezar, porque no se ve.
   */
  function cambiarModo(m: Modo) {
    if (m === modo) return
    const algoEscrito = form.paciente_id || form.nombre || form.anamnesis || testsValoracion.length > 0
    if (algoEscrito && !confirm('Se perderá lo que llevas escrito en esta pestaña. ¿Cambiar?')) return
    setModo(m); setStep(1); setForm({...FORM_VACIO, bono: bonosOpts[0]?.id || ''}); setTestsValoracion([]); setTestActivo(null)
    setPrevio(null); setFirmaCanvas(''); setFirmaAceptada(false); setImagenesAceptada(false); setClinicaAceptada(false)
  }

  function limpiarPaciente() {
    up('paciente_id',''); up('desde_pendiente',false)
    setPrevio(null); setTestsValoracion([]); setTestActivo(null)
  }

  /**
   * Elegir paciente en la revaloración: se trae su historial y sus tests abiertos.
   *
   * Los positivos se cargan EN BLANCO, con la nota de cuándo dieron positivo. Copiar
   * el resultado anterior como si fuera el de hoy sería inventarse una exploración.
   */
  async function elegirParaRevaloracion(p: any) {
    setForm(f=>({...f, paciente_id:p.id, desde_pendiente:false,
      nombre:p.nombre||'', apellidos:p.apellidos||'', nombre_clinica:p.nombre_clinica||'',
      telefono:p.telefono||'', email:p.email||'', dni:p.dni||'', fecha_nacimiento:p.fecha_nacimiento||'', sexo:p.sexo||'',
      altura_cm:p.altura_cm?String(p.altura_cm):'', peso_kg:p.peso_kg?String(p.peso_kg):'',
      plantillas:!!p.usa_plantillas, plantilla_izq:p.plantilla_izq||'', plantilla_der:p.plantilla_der||'',
    }))
    setCargandoPrevio(true)
    setTestsValoracion([]); setTestActivo(null)
    try {
      // Todo sale de las tablas del paciente, no del JSON de su última valoración: lo que
      // vale es lo que hay hoy en su ficha, no lo que se apuntó el día de la valoración.
      const [vals, pats, mols, meds, deps, alerg, intol, opers, positivos] = await Promise.all([
        supabase.from('valoraciones').select('*').eq('paciente_id',p.id).order('fecha',{ascending:false}).limit(1),
        supabase.from('patologias').select('nombre,lado,estado').eq('paciente_id',p.id),
        supabase.from('molestias').select('zona,eva,lado,activa').eq('paciente_id',p.id).eq('activa',true),
        supabase.from('medicamentos').select('nombre,frecuencia').eq('paciente_id',p.id),
        supabase.from('deportes_paciente').select('nombre').eq('paciente_id',p.id),
        leerLista(p.id,'alergias'),
        leerLista(p.id,'intolerancias'),
        leerLista(p.id,'operaciones'),
        testsPositivosDe(p.id),
      ])
      const val = vals.data?.[0] || null

      // Sin la biblioteca de tests no hay nombres que enseñar. Al elegir paciente
      // nada más entrar puede no haber llegado todavía, así que se pide.
      let lib = testsLib
      if (!lib.length) { const { data } = await supabase.from('tests').select('*'); lib = data || []; setTestsLib(lib) }

      const conNombre = positivos.map(r => {
        const t = lib.find((x:any)=>x.id===r.test_id)
        return { ...r, nombre: t?.nombre || 'Test', test: t }
      })
      setPrevio({
        valoracion: val,
        positivos: conNombre,
        patologias: (pats.data||[]).map((x:any)=>x.nombre + (x.lado&&x.lado!=='no_aplica'?` · ${x.lado}`:'') + (x.estado?` · ${x.estado}`:'')),
        molestias: (mols.data||[]).map((x:any)=>`${x.zona}${x.eva==null?'':` · EVA ${x.eva}`}`),
        medicacion: (meds.data||[]).map((x:any)=>x.nombre + (x.frecuencia?` · ${x.frecuencia}`:'')),
        deportes: (deps.data||[]).map((x:any)=>x.nombre),
        alergias: alerg.map((x:any)=>x.nombre),
        intolerancias: intol.map((x:any)=>x.nombre),
        operaciones: opers.map((x:any)=>x.nombre+(x.anio?` · ${x.anio}`:'')+(x.lado?` · ${x.lado}`:'')),
      })

      setTestsValoracion(conNombre.map((r:any) => {
        const t = r.test
        const rev = new Date(); rev.setMonth(rev.getMonth() + (t?.frecuencia_meses || 3))
        return {
          test_id: r.test_id, nombre: r.nombre, logica: t?.logica,
          ladoActivo: r.lado, frecuencia_meses: t?.frecuencia_meses || 3,
          previo: { fecha: r.fecha, lado: r.lado },
          lados: { [r.lado]: {
            items_resultado: (t?.items||[]).map((it:any)=>({...it,marcado:false,valor:''})),
            resultado: 'sin_realizar', observaciones: '',
            fecha_repeticion: rev.toISOString().split('T')[0],
          } },
        }
      }))
    } catch (e) {
      alert('No se pudo cargar el historial del paciente: ' + String(e))
    }
    setCargandoPrevio(false)
  }

  async function finalizar() {
    setGuardando(true)
    try {
      if (esRevaloracion && !form.paciente_id) { alert('Elige el paciente que se revalora'); setGuardando(false); return }
      if (!esRevaloracion && !form.bono) { alert('Elige el bono en el paso de Plan'); setGuardando(false); return }
      let pacienteId = form.paciente_id
      if (!pacienteId) {
        if (!form.nombre || !form.apellidos) { alert('Nombre y apellidos son obligatorios'); setGuardando(false); return }
        const { data: p, error } = await supabase.from('pacientes').insert({ nombre:form.nombre, apellidos:form.apellidos, nombre_clinica:form.nombre_clinica||null, telefono:form.telefono, email:form.email, dni:form.dni, fecha_nacimiento:form.fecha_nacimiento||null, sexo:form.sexo||null, altura_cm:form.altura_cm?parseInt(form.altura_cm):null, peso_kg:form.peso_kg?parseFloat(form.peso_kg):null, tipo_clase:form.tipo_clase_def, como_nos_conocio:form.como_nos_conocio||null, usa_plantillas:!!form.plantillas, plantilla_izq:form.plantillas?(form.plantilla_izq||null):null, plantilla_der:form.plantillas?(form.plantilla_der||null):null, estado:'activo' }).select().single()
        if (error || !p) { alert('Error al crear el paciente'); setGuardando(false); return }
        pacienteId = p.id
      } else if (esRevaloracion) {
        // De la ficha solo se tocan las plantillas, que es lo único que el paso de
        // completar deja cambiar. Lo demás se edita en su ficha.
        //
        // El SEXO es la excepción, y solo cuando estaba vacío: es dato nuevo, los
        // pacientes de antes no lo tienen, y la revaloración es justo el momento en que se
        // vuelve a mirar la ficha entera. Si ya estaba puesto no se pisa.
        const updRe: any = { usa_plantillas:!!form.plantillas, plantilla_izq:form.plantillas?(form.plantilla_izq||null):null, plantilla_der:form.plantillas?(form.plantilla_der||null):null }
        if (form.sexo && !pacientes.find((x:any)=>x.id===pacienteId)?.sexo) updRe.sexo = form.sexo
        await supabase.from('pacientes').update(updRe).eq('id',pacienteId)
      } else {
        const upd: any = { pendiente_valoracion:false }
        // Se reescribe la ficha entera a propósito: es el momento de corregir el nombre que
        // se apuntó abreviado al coger la cita. Depende de que el paso 1 haya cargado TODOS
        // los campos del paciente al elegirlo — si carga menos, lo que falte se guarda vacío.
        if (form.desde_pendiente) Object.assign(upd, { nombre:form.nombre, apellidos:form.apellidos, nombre_clinica:form.nombre_clinica||null, telefono:form.telefono, email:form.email, dni:form.dni, fecha_nacimiento:form.fecha_nacimiento||null, sexo:form.sexo||null, altura_cm:form.altura_cm?parseInt(form.altura_cm):null, peso_kg:form.peso_kg?parseFloat(form.peso_kg):null, tipo_clase:form.tipo_clase_def, como_nos_conocio:form.como_nos_conocio||null, usa_plantillas:!!form.plantillas, plantilla_izq:form.plantillas?(form.plantilla_izq||null):null, plantilla_der:form.plantillas?(form.plantilla_der||null):null })
        const { error: errUpd } = await supabase.from('pacientes').update(upd).eq('id',pacienteId)
        if (errUpd) alert('Aviso: los datos del paciente no se han actualizado (' + errUpd.message + '). El resto de la valoración sí se ha guardado.')
      }
      // Los días por semana son los del bono elegido. Estaban en un mapa fijo aquí
      // dentro, así que un bono nuevo de Ajustes entraba siempre con 2 días.
      const bonoSel = bonosOpts.find(b => b.id === form.bono)
      await Promise.all([
        // El bono es cosa de la valoración inicial. Una revaloración abría uno nuevo
        // en paralelo al que el paciente ya estaba pagando.
        ...(esRevaloracion ? [] : [supabase.from('bonos').insert({ paciente_id:pacienteId, tipo:form.bono, dias_semana:bonoSel?.dias_semana||1, estado_pago:'pendiente', mes:new Date().getMonth()+1, anio:new Date().getFullYear(), fecha_inicio:new Date().toISOString().split('T')[0], activo:true })]),
        supabase.from('valoraciones').insert({ paciente_id:pacienteId, fecha:new Date().toISOString().split('T')[0], tipo:esRevaloracion?'revaloracion':'inicial', anamnesis:form.anamnesis, trabajo:form.trabajo, tipo_jornada:form.tipo_jornada, objetivos:[form.objetivo1,form.objetivo2,form.objetivo3].filter(Boolean), deseo:form.deseo, borg:form.borg, estres:form.estres, estado_general:JSON.stringify({operaciones:form.operaciones,alergias:form.alergias,intolerancias:form.intolerancias,dieta:form.dieta,plantillas:form.plantillas,tipo_plantilla:form.tipo_plantilla,plantilla_izq:form.plantilla_izq,plantilla_der:form.plantilla_der,hace_deporte:form.hace_deporte,deportes:form.deportes,notas_plan:form.notas_plan,dias_asistencia:form.dias_asistencia,franja:form.franja,horario_pref:form.horario_pref}), firma_imagen:firmaCanvas||null, consent_datos:firmaAceptada, consent_imagenes:imagenesAceptada, consent_fecha:(firmaAceptada||imagenesAceptada)?new Date().toISOString():null }),
        // `biblioteca_id` viaja desde el paso de historial. Sin él, lo que queda en la
        // ficha es solo el texto, y relacionar esa molestia con nada más obliga a comparar
        // nombres, que es lo que se separa solo en cuanto alguien teclea una variante.
        ...form.molestias.filter((m:any)=>m.zona).map((m:any)=>supabase.from('molestias').insert({ paciente_id:pacienteId, zona:m.zona, biblioteca_id:m.biblioteca_id||null, tipo:m.tipo, eva:m.eva, lado:m.lado||null, sensacion:m.cuando||null, observaciones:m.observaciones, activa:true })),
        ...form.patologias.map((p:any)=>supabase.from('patologias').insert({ paciente_id:pacienteId, nombre:p.nombre, biblioteca_id:p.biblioteca_id||null, lado:p.lado||null, estado:p.estado, descripcion:p.observaciones||'', informe_url:p.tiene_informe?'pendiente':null })),
        ...form.medicacion.map((m:any)=>supabase.from('medicamentos').insert({ paciente_id:pacienteId, nombre:m.nombre, frecuencia:m.frecuencia||'', observaciones:m.observaciones||'' })),
        // Si no ha contestado a ninguna de las dos no se abre fila: una escala con los
        // dos huecos vacíos no dice nada y ensucia la evolución con un punto muerto.
        ...((form.borg!=null||form.estres!=null) ? [supabase.from('escalas').insert({ paciente_id:pacienteId, fecha:new Date().toISOString().split('T')[0], borg:form.borg, estres:form.estres })] : []),
        ...((form.hace_deporte&&Array.isArray(form.deportes))?form.deportes.map((d:string)=>supabase.from('deportes_paciente').insert({ paciente_id:pacienteId, nombre:d })):[]),
      ])
      // Alergias, intolerancias y operaciones van a SUS TABLAS, no solo al JSON de la
      // valoración. Antes se guardaban únicamente dentro de `estado_general` y por eso una
      // alergia apuntada aquí no aparecía en Salud: quedaba escrita donde nadie mira.
      // `anadirALista` no duplica lo que el paciente ya tenía, así que la revaloración puede
      // pasar por el mismo formulario sin repetirle nada.
      for (const [lista, entradas] of [
        ['alergias', form.alergias],
        ['intolerancias', form.intolerancias],
        ['operaciones', form.operaciones],
      ] as const) {
        if (!entradas || entradas.length === 0) continue
        const r = await anadirALista(pacienteId, lista, entradas as any)
        // Un fallo aquí no puede tumbar el resto: la valoración entera ya está guardada y
        // volver a lanzarla duplicaría todo lo demás. Se avisa y se sigue.
        if (!r.ok) alert(`Aviso: no se pudieron guardar las ${lista} (${r.error}). El resto de la valoración sí se ha guardado.`)
      }

      // Antes la firma y las casillas se quedaban en memoria y se perdían al terminar.
      // En la revaloración no hay nada que firmar: los consentimientos se dieron una vez
      // y siguen vigentes; volver a pedirlos crearía un segundo registro del mismo acto.
      if (!esRevaloracion) {
        const aceptados: TipoConsentimiento[] = [
          ...(firmaAceptada ? ['datos' as const] : []),
          ...(imagenesAceptada ? ['imagenes' as const] : []),
          ...(clinicaAceptada ? ['clinica' as const] : []),
        ]
        // Un consentimiento aceptado sin firma no vale como prueba: mejor avisar
        // que guardarlo en silencio, que es lo que pasaba antes.
        if (aceptados.length > 0 && !firmaCanvas) {
          const seguir = confirm('Has marcado consentimientos pero no hay firma dibujada.\n\nSin firma, el consentimiento no queda acreditado. ¿Guardar de todos modos?')
          if (!seguir) { setGuardando(false); return }
        }
        const rCons = await guardarConsentimientos(pacienteId, {
          aceptados, firmaDataUrl: firmaCanvas || null,
          nombre: `${form.nombre} ${form.apellidos}`.trim(), dni: form.dni || undefined,
        })
        if (!rCons.ok) alert('Aviso: no se pudieron registrar los consentimientos (' + rCons.error + '). El resto de la valoración sí se ha guardado.')
      }

      // Antes esto solo insertaba la fila: un test positivo en la valoración inicial no
      // abría sus objetivos ni dejaba evento, y como la fila sí se guardaba nadie se
      // enteraba. Ahora pasa por la misma función que la ficha.
      for (const t of testsValoracion) {
        const lados = t.lados || {}
        // `k &&`: la clave vacía es "todavía no se ha elegido lado", no un resultado.
        const ladosConDato = Object.keys(lados).filter(k => k && lados[k] && lados[k].resultado && lados[k].resultado !== 'sin_realizar')
        // Un test que se trajo por estar abierto y no se ha llegado a pasar no se
        // registra: 'sin_realizar' no dice nada y ensucia el historial.
        const aGuardar = ladosConDato.length ? ladosConDato : (t.previo ? [] : Object.keys(lados).filter(k => k))
        for (const ladoKey of aGuardar) {
          const d = lados[ladoKey]
          if (!d) continue
          // La fila ENTERA de la biblioteca, no un resumen. Con `{id, nombre, logica}`
          // bastaba mientras el veredicto salía de contar casillas; un test de puntuación
          // necesita además sus BANDAS, y sin ellas se habría guardado un "sin resultado"
          // sin que nada fallara.
          const lib = testsLib.find((x: any) => x.id === t.test_id)
          const r = await registrarResultadoTest(pacienteId, lib || { id: t.test_id, nombre: t.nombre, logica: t.logica }, {
            resultado: d.resultado, items: d.items_resultado || [],
            observaciones: d.observaciones, lado: ladoKey,
            fechaRepeticion: d.fecha_repeticion || null,
            contexto: esRevaloracion ? 'la revaloración' : 'la valoración inicial',
          })
          if (!r.ok) alert(`Aviso: no se pudo guardar el test "${t.nombre || ''}" (${r.error}). El resto de la valoración sí se ha guardado.`)
        }
      }
      await supabase.from('eventos_paciente').insert({ paciente_id:pacienteId, tipo:esRevaloracion?'revaloracion':'valoracion_inicial', titulo:esRevaloracion?'Revaloración':'Valoración inicial', descripcion:form.anamnesis||null, fecha:new Date().toISOString().split('T')[0] })
      // Ya no se salta solo a la ficha. Lo que toca justo después de valorar es ponerle
      // las citas y repartirle las sesiones, y si se encadenan dos valoraciones seguidas
      // hay que poder dejarlo para luego sin perder al paciente: no se marca nada, la
      // lista de pacientes ya avisa de quién se quedó sin citas.
      setGuardado({ id: pacienteId, nombre: `${form.nombre} ${form.apellidos}`.trim() })
      setExito(true)
    } catch(e) { alert('Error al guardar: '+String(e)) }
    setGuardando(false)
  }

  const pct = Math.round((step/STEPS.length)*100)
  const paso = STEPS[step-1]
  // En la revaloración no se avanza sin paciente: los pasos siguientes se apoyan
  // en su historial, y el aviso va aquí y no al guardar.
  const bloqueado = esRevaloracion && step === 1 && !form.paciente_id

  if (exito) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',gap:14,padding:20}}>
      <div style={{color:'var(--g)'}}><Ic name="ok" size={48} strokeWidth={1.5}/></div>
      <div style={{fontSize:17,fontWeight:400,color:'var(--n)'}}>{esRevaloracion?'Revaloración guardada':'Valoración guardada'}</div>
      <div style={{fontSize:13,color:'var(--gr)',textAlign:'center',maxWidth:440,lineHeight:1.6}}>
        {guardado?.nombre ? <><strong style={{fontWeight:500}}>{guardado.nombre}</strong> ya tiene su ficha al día. </> : null}
        Lo que falta es ponerle las citas y repartirle las sesiones.
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:360,marginTop:6}}>
        <button className="btn btn-p" style={{justifyContent:'center',padding:'12px'}}
          onClick={()=>router.push(`/agenda?nuevaCitaPara=${guardado?.id||''}`)}>
          <Ic name="calendario" size={14}/> Ponerle las citas
        </button>
        <button className="btn btn-s" style={{justifyContent:'center',padding:'12px'}}
          onClick={()=>router.push(`/pacientes/${guardado?.id}?tab=entreno`)}>
          <Ic name="entreno" size={14}/> Asignarle las sesiones
        </button>
        <button className="btn btn-t" style={{justifyContent:'center',padding:'10px'}}
          onClick={()=>router.push(`/pacientes/${guardado?.id}`)}>
          Ver su ficha
        </button>
      </div>

      {/* Encadenar valoraciones es lo normal en un día de altas: se sale sin hacer nada
          más y el paciente queda avisado como "Sin citas" en la lista. */}
      <button className="btn btn-t btn-sm" style={{marginTop:4,color:'var(--grl)'}}
        onClick={()=>router.push('/pacientes')}>
        Ahora no · queda marcado como "Sin citas" en la lista
      </button>
    </div>
  )

  return (
    <>
      {/* PESTAÑAS · valoración inicial o revaloración */}
      <div style={{display:'flex',gap:3,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:3,marginBottom:10,width:'fit-content'}}>
        {([['inicial','Valoración','valoracion'],['revaloracion','Revaloración','recuperar']] as const).map(([m,label,icono])=>(
          <button key={m} onClick={()=>cambiarModo(m)}
            style={{fontSize:11,padding:'7px 16px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6,background:modo===m?'var(--w)':'transparent',color:modo===m?'var(--n)':'var(--grl)',fontWeight:modo===m?500:300,boxShadow:modo===m?'0 1px 3px rgba(0,0,0,.08)':'none'}}>
            <Ic name={icono} size={13}/> {label}
          </button>
        ))}
      </div>
      <div style={{fontSize:10,color:'var(--grl)',marginBottom:12,marginTop:-4}}>
        {esRevaloracion
          ? 'Paciente que ya tiene valoración: se anota cómo está ahora y se repasan los tests que siguen abiertos. Ni firma ni bono nuevo.'
          : 'Primera valoración: se crea el paciente si no existe, se firman los consentimientos y se elige bono y plan.'}
      </div>

      {/* BARRA PROGRESO Y NAVEGACIÓN.
          Los botones van AQUÍ y no al final del paso: abajo cambiaban de sitio según lo
          largo que fuera cada pestaña, y con el paciente delante se busca el botón en
          vez de mirarlo. Arriba a la derecha están siempre en el mismo punto. */}
      <div style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'12px 16px',marginBottom:12,display:'flex',alignItems:'center',gap:18}}>
       <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:8}}>
          {STEPS.map((s,i)=>{
            const idx=i+1; const cls=idx<step?'done':idx===step?'active':'pending'
            return (
              <div key={s} style={{display:'flex',alignItems:'center',flex:1}}>
                <div onClick={()=>idx<step&&setStep(idx)} style={{width:24,height:24,borderRadius:'50%',border:`1.5px solid ${cls==='done'?'var(--g)':cls==='active'?'var(--g)':'var(--bd)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:500,color:cls==='done'||cls==='active'?'var(--g)':'var(--grl)',background:cls==='done'?'var(--g)':'var(--w)',cursor:idx<step?'pointer':'default',flexShrink:0}}>
                  {cls==='done'?<span style={{color:'#fff'}}>✓</span>:idx}
                </div>
                {i<STEPS.length-1&&<div style={{flex:1,height:1.5,background:idx<step?'var(--g)':'var(--bd)',margin:'0 3px'}}/>}
              </div>
            )
          })}
        </div>
        <div style={{display:'flex'}}>
          {STEPS.map((s,i)=>(
            <div key={s} style={{flex:1,textAlign:'center',fontSize:8,color:i+1===step?'var(--g)':i+1<step?'var(--g)':'var(--grl)',fontWeight:i+1===step?500:300}}>{s}</div>
          ))}
        </div>
        <div style={{height:3,background:'var(--bm)',borderRadius:2,overflow:'hidden',marginTop:8}}>
          <div style={{height:'100%',borderRadius:2,background:'var(--g)',width:`${pct}%`,transition:'width .3s'}}/>
        </div>
       </div>
       <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
         <button className="btn btn-s" onClick={()=>setStep(s=>Math.max(1,s-1))} style={{visibility:step===1?'hidden':'visible'}}>← Atrás</button>
         {step<STEPS.length
           ? <button className="btn btn-p" onClick={()=>setStep(s=>Math.min(STEPS.length,s+1))} disabled={bloqueado} title={bloqueado?'Elige antes el paciente':undefined}>Continuar →</button>
           : <span style={{fontSize:11,color:'var(--grl)',padding:'0 6px'}}>Último paso</span>}
       </div>
      </div>

      {paso==='Paciente'&&(esRevaloracion
        ? <PasoPacienteRevaloracion form={form} pacientes={pacientes} previo={previo} cargando={cargandoPrevio} onElegir={elegirParaRevaloracion} onLimpiar={limpiarPaciente}/>
        : <PasoPaciente form={form} up={up} pacientes={pacientes} comoNosConocioOpts={comoNosConocioOpts} firmaCanvas={firmaCanvas} setFirmaCanvas={setFirmaCanvas} firmaAceptada={firmaAceptada} setFirmaAceptada={setFirmaAceptada} imagenesAceptada={imagenesAceptada} setImagenesAceptada={setImagenesAceptada} clinicaAceptada={clinicaAceptada} setClinicaAceptada={setClinicaAceptada}/>)}
      {paso==='Anamnesis'&&<PasoAnamnesis form={form} up={up} tiposJornada={tiposJornada} deportesOpts={deportesOpts} tiposPlantilla={tiposPlantilla} modo={modo} previo={previo}/>}
      {paso==='Historial'&&<PasoHistorial form={form} up={up} medsBiblio={medsBiblio} alergiasBiblio={alergiasBiblio} intolBiblio={intolBiblio} opsBiblio={opsBiblio} patsBiblio={patsBiblio} molsBiblio={molsBiblio} setMedsBiblio={setMedsBiblio} setAlergiasBiblio={setAlergiasBiblio} setIntolBiblio={setIntolBiblio} setOpsBiblio={setOpsBiblio} setPatsBiblio={setPatsBiblio} setMolsBiblio={setMolsBiblio}/>}
      {paso==='Completar'&&<PasoCompletar form={form} up={up} deportesOpts={deportesOpts} tiposPlantilla={tiposPlantilla} yaTiene={previo||{}} medsBiblio={medsBiblio} alergiasBiblio={alergiasBiblio} intolBiblio={intolBiblio} opsBiblio={opsBiblio} patsBiblio={patsBiblio} molsBiblio={molsBiblio} setMedsBiblio={setMedsBiblio} setAlergiasBiblio={setAlergiasBiblio} setIntolBiblio={setIntolBiblio} setOpsBiblio={setOpsBiblio} setPatsBiblio={setPatsBiblio} setMolsBiblio={setMolsBiblio}/>}
      {paso==='Tests'&&<PasoTests testsLib={testsLib} etiquetasLib={etiquetasLib} testsValoracion={testsValoracion} setTestsValoracion={setTestsValoracion} testActivo={testActivo} setTestActivo={setTestActivo}
        paciente={{ sexo: form.sexo, fecha_nacimiento: form.fecha_nacimiento }}/>}
      {paso==='Plan'&&<PasoPlan form={form} up={up} tiposClaseOpts={tiposClaseOpts} bonosOpts={bonosOpts}/>}
      {paso==='Resumen'&&<PasoResumen form={form} testsValoracion={testsValoracion} guardando={guardando} finalizar={finalizar} firmaAceptada={firmaAceptada} imagenesAceptada={imagenesAceptada} firmaCanvas={firmaCanvas} tiposClaseOpts={tiposClaseOpts} modo={modo} clinica={clinica}/>}

    </>
  )
}
