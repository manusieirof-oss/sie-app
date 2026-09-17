'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { hoyISO } from '@/lib/fechas'
import { CADENCIAS, fechasDeSerie, mediaDeConcepto, crearSerie,
         MODOS_ESTIMACION, modoPorDefecto, ultimoImporteDe,
         CATEGORIAS_GASTO, ayudaDeCategoria } from '@/lib/gastos'

/**
 * El trimestre de una fecha, SOLO si ya pasó. null si es del trimestre en curso.
 *
 * Sirve para avisar al corregir: mientras el trimestre está abierto, cambiar un
 * gasto no tiene consecuencias. En cuanto se ha presentado, sí las tiene.
 */
function trimestrePasado(fecha?: string | null): string | null {
  if (!fecha) return null
  const [a, m] = fecha.split('-').map(Number)
  if (!a || !m) return null
  const t = Math.floor((m - 1) / 3) + 1
  const hoy = new Date()
  const tHoy = Math.floor(hoy.getMonth() / 3) + 1
  const pasado = a < hoy.getFullYear() || (a === hoy.getFullYear() && t < tHoy)
  return pasado ? `${t}T ${a}` : null
}


/**
 * APUNTAR O CORREGIR UN GASTO.
 *
 * Se lleva su propio formulario y su propia cuenta: la pestaña solo dice a qué
 * gasto abrirlo. Vivía dentro de GastosTab, que con esto y los otros dos
 * modales pasaba de mil líneas y era donde salían los fallos.
 */
export default function ModalGasto({ editando, onCerrar, onHecho }: {
  editando: any
  onCerrar: () => void
  onHecho: () => void
}) {
  const [form, setForm] = useState({ concepto:'', importe:'', metodo:'total', repetir:false, cadencia:'mensual', modoEst:'media', iva_pct:'21', irpf_pct:'0', irpf_modelo:'111', exento:'', clase:'', ss_empresa:'', irpf_retenido:'', capital:'', tipo:'variable', categoria:'', fecha:hoyISO(), tiene_factura:false, notas:'' })
  const [media, setMedia] = useState<{ base: number, n: number }|null>(null)
  const [ultimo, setUltimo] = useState<number|null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string|null>(null)

  const ivaPct = parseFloat(form.iva_pct) || 0
  const irpfPct = parseFloat(form.irpf_pct) || 0
  const importe = parseFloat(form.importe) || 0

  /**
   * En un préstamo lo que escribes son los INTERESES del recibo, que es
   * directamente el gasto: no hay que deshacer ningún IVA porque los
   * servicios financieros están exentos.
   */
  const base = form.clase === 'prestamo' ? importe
    : form.metodo === 'base' ? importe
    : ivaPct > 0 ? importe / (1 + ivaPct/100)
    : importe
  /**
   * LA PARTE DE LA FACTURA QUE NO LLEVA IVA.
   *
   * Hay recibos mixtos: en el del agua, el consumo lleva IVA y el canon y las
   * tasas municipales no. Metiéndolo todo con el mismo tipo te deduces IVA de
   * unos importes que nunca lo llevaron.
   *
   * Es gasto deducible igual —suma a la base y al total— pero no genera IVA
   * soportado. Por eso el IVA se calcula solo sobre la parte gravada.
   */
  const exento = Math.max(parseFloat(form.exento) || 0, 0)

  /**
   * UNA NÓMINA NO ES UNA FACTURA.
   *
   * El gasto de la empresa son DOS cosas: el salario bruto y la Seguridad
   * Social a cargo de la empresa. Ninguna lleva IVA.
   *
   * El IRPF retenido NO es un gasto aparte: ya está dentro del bruto. Es dinero
   * del trabajador que tú ingresas a Hacienda por él, y por eso va al 111 pero
   * no suma al coste.
   *
   * Los números se copian de lo que pasa la gestoría. Calcular aquí tramos de
   * IRPF o bases de cotización daría cifras que no cuadran con lo presentado.
   */
  const esNomina = form.clase === 'nomina'
  const ssEmpresa = Math.max(parseFloat(form.ss_empresa) || 0, 0)
  const irpfRetenido = Math.max(parseFloat(form.irpf_retenido) || 0, 0)

  /**
   * DE UNA CUOTA DE PRÉSTAMO SOLO SON GASTO LOS INTERESES.
   *
   * Amortizar capital no es un gasto: es devolver dinero que te prestaron. Si
   * se apuntara la cuota entera, el beneficio del 130 saldría más bajo de lo
   * real y estarías declarando mal.
   *
   * Y no llevan IVA: los servicios financieros están exentos, así que no hay
   * nada que deducir en el 303.
   *
   * El capital se pide igualmente —y se guarda— para poder cuadrar el recibo
   * con el banco, pero no suma al gasto. Con tipo variable el reparto cambia en
   * cada revisión, por eso se teclea de cada recibo en vez de calcularlo.
   */
  const esPrestamo = form.clase === 'prestamo'
  const capital = Math.max(parseFloat(form.capital) || 0, 0)
  const ivaImporte = base * (ivaPct/100)
  const irpfImporte = base * (irpfPct/100)
  /** Lo que sale de la cuenta: base + IVA − retención. Es lo que pagas de verdad. */
  const total = esNomina
    ? base + ssEmpresa
    : esPrestamo ? base
    : base + exento + ivaImporte - irpfImporte

  /** Las fechas que se van a crear, para poder decirlo ANTES de crearlas. */
  const fechasSerie = form.repetir ? fechasDeSerie(form.fecha, form.cadencia) : [form.fecha]

  /**
   * La base que llevarán los meses que aún no han llegado.
   *
   * Manda la media de los reales anteriores. Si no hay histórico se repite lo
   * que estás tecleando: no hay nada mejor, y fingir una media a partir de un
   * solo dato sería inventar precisión.
   */
  const baseEstimada = form.modoEst === 'fijo'
    ? (ultimo ?? base)
    : (media?.base ?? base)


  /** Se busca la media al salir del campo, no en cada tecla. */
  async function buscarMedia() {
    if (!form.concepto.trim()) { setMedia(null); setUltimo(null); return }
    const [rm, ru] = await Promise.all([
      mediaDeConcepto(form.concepto),
      ultimoImporteDe(form.concepto),
    ])
    setMedia(rm.media != null ? { base: rm.media, n: rm.n } : null)
    setUltimo(ru.base)
  }


  /**
   * Abrir el formulario con un gasto ya guardado dentro.
   *
   * Se rellena con la BASE, no con el total: la base es lo que está guardado y
   * es exacta. Reconstruir el total para volver a dividirlo entre 1+IVA daría
   * céntimos de diferencia cada vez que abrieras la ficha sin tocar nada.
   */
  function abrirEditar(g: any) {
    setError(null)
    /**
     * LOS GASTOS VIEJOS NO TIENEN BASE.
     *
     * `base_imponible` se empezó a guardar después, así que todo lo que se
     * cargó antes la tiene a null. Al abrirlos para editar el campo salía
     * VACÍO, y el formulario exige importe: dabas a guardar y no pasaba nada.
     *
     * Y como el aviso se pintaba detrás del modal, el botón parecía roto.
     *
     * Con base guardada se rellena esa, que es exacta. Sin ella se rellena el
     * total y se cambia la pregunta a "el total pagado", que es de donde viene
     * ese número. No se inventa una base dividiendo: con retención saldría mal.
     */
    const tieneBase = g.base_imponible != null && Number(g.base_imponible) > 0
    /**
     * LA PARTE EXENTA SE GUARDA DENTRO DE `base_imponible`.
     *
     * Es lo correcto para los impuestos: la base del 130 es todo el gasto
     * deducible, lleve IVA o no. Pero el formulario tiene DOS campos, y si al
     * abrir se rellena el importe con la base entera y además el campo de
     * exento con su parte, esa parte cuenta dos veces. Al guardar se volvía a
     * sumar, y el gasto crecía en cada edición.
     *
     * Aquí se deshace la suma: al campo del importe va solo la parte gravada.
     */
    const exentoG = Number(g.importe_exento || 0)
    const baseGravadaG = tieneBase ? Number(g.base_imponible) - exentoG : 0
    setForm({
      concepto: g.concepto || '',
      importe: String(tieneBase ? Math.round(baseGravadaG*100)/100 : (g.importe ?? '')),
      metodo: tieneBase ? 'base' : 'total',
      repetir: false,
      cadencia: 'mensual',
      modoEst: 'media',
      iva_pct: String(g.iva_pct ?? 0),
      irpf_pct: String(g.irpf_pct ?? 0),
      irpf_modelo: g.irpf_modelo || '111',
      exento: g.importe_exento ? String(g.importe_exento) : '',
      clase: g.clase || '',
      ss_empresa: g.ss_empresa ? String(g.ss_empresa) : '',
      irpf_retenido: g.irpf_retenido ? String(g.irpf_retenido) : '',
      capital: g.capital_amortizado ? String(g.capital_amortizado) : '',
      tipo: g.tipo || 'variable',
      categoria: g.categoria || '',
      fecha: g.fecha,
      tiene_factura: !!g.tiene_factura,
      notas: g.notas || '',
    })
  }



  async function crear() {
    if (!form.concepto) { setError('Falta el concepto.'); return }
    if (!form.importe) { setError('Falta el importe. Escribe el número que pone la factura.'); return }
    setGuardando(true)
    setError(null)

    const plantilla = {
      concepto: form.concepto,
      base: Math.round(base*100)/100,
      exento: Math.round(exento*100)/100,
      // Sin esto, marcar "se repite" creaba doce facturas con IVA a partir de
      // una nómina o un recibo del banco.
      clase: form.clase || null,
      ssEmpresa: esNomina ? ssEmpresa : 0,
      irpfRetenido: esNomina ? irpfRetenido : 0,
      capital: esPrestamo ? capital : 0,
      iva_pct: ivaPct,
      irpf_pct: irpfPct,
      irpf_modelo: form.irpf_modelo,
      tipo: form.tipo,
      categoria: form.categoria || null,
      notas: form.notas || null,
    }

    /**
     * LA FILA TAL Y COMO VA A LA BASE DE DATOS.
     *
     * `plantilla.base` es un campo de trabajo, no una columna: la columna se
     * llama `base_imponible`. Haciendo `...plantilla` se le colaba una clave
     * `base` que no existe, y PostgREST rechazaba la operación entera con
     * "Could not find the 'base' column of 'gastos'".
     *
     * Se construye aquí, una sola vez, con los nombres de las columnas de
     * verdad. Un objeto que sirve para calcular y otro para guardar, y no se
     * mezclan: mientras fueran el mismo, cualquier campo auxiliar que se añada
     * mañana vuelve a romper el guardado.
     */
    const fila = {
      concepto: plantilla.concepto,
      /**
       * EN UNA NÓMINA, LA BASE ES EL SALARIO BRUTO.
       *
       * La Seguridad Social de empresa va aparte porque es otro concepto —lo
       * pagas tú, no sale del sueldo—, pero suma igual al gasto deducible: el
       * `importe` es la suma de los dos, que es tu coste real.
       *
       * Sin IVA: una nómina no lo lleva. Y el irpf_pct se deja a 0 porque la
       * retención de una nómina es un IMPORTE, no un porcentaje redondo: va en
       * `irpf_retenido` y de ahí al 111.
       */
      clase: form.clase || null,
      ss_empresa: esNomina ? Math.round(ssEmpresa*100)/100 : 0,
      capital_amortizado: esPrestamo ? Math.round(capital*100)/100 : 0,
      irpf_retenido: esNomina ? Math.round(irpfRetenido*100)/100 : 0,
      base_imponible: esNomina
        ? Math.round(plantilla.base*100)/100
        : Math.round((plantilla.base + exento)*100)/100,
      importe_exento: esNomina ? 0 : Math.round(exento*100)/100,
      importe: total,
      iva_pct: esNomina ? 0 : plantilla.iva_pct,
      irpf_pct: esNomina ? 0 : plantilla.irpf_pct,
      irpf_modelo: esNomina ? '111' : (irpfPct > 0 ? form.irpf_modelo : null),
      tipo: plantilla.tipo,
      categoria: plantilla.categoria,
      notas: plantilla.notas,
      fecha: form.fecha,
      tiene_factura: form.tiene_factura,
    }

    if (editando) {
      // Corregir un apunte. NO se toca `estimado`: si estaba confirmado sigue
      // confirmado, y si es una previsión sigue siéndolo. Confirmar es decir
      // "ha llegado el papel", y eso se hace en su sitio, no de refilón al
      // arreglar una errata.
      /**
       * EL `.select()` NO ES DECORACIÓN, ES EL AVISO.
       *
       * Sin él, un UPDATE que no toca ninguna fila devuelve exactamente lo mismo
       * que uno que fue bien: sin error y sin datos. Es lo que pasa cuando la
       * política RLS de la tabla no permite actualizar — la fila no se bloquea
       * con un mensaje, es que para el UPDATE deja de existir.
       *
       * Resultado: el modal se cerraba tan contento y el gasto seguía igual. Un
       * fallo que se presenta como un éxito es peor que un fallo.
       */
      const { data: filas, error: errUpd } = await supabase.from('gastos')
        .update(fila).eq('id', editando.id).select('id')
      setGuardando(false)
      if (errUpd) { setError(`No se ha podido guardar el cambio: ${errUpd.message}`); return }
      if (!filas || filas.length === 0) {
        setError('El cambio no se ha guardado: la base de datos no ha modificado ninguna fila.')
        return
      }
    } else if (form.repetir) {
      // La serie entera. El primero es real —la factura que tienes delante— y
      // el resto quedan como estimados hasta que llegue cada papel.
      const r = await crearSerie({ plantilla, desde: form.fecha, cadencia: form.cadencia, baseEstimada })
      setGuardando(false)
      if (!r.ok) { setError(`No se ha podido crear la serie: ${r.error}`); return }
    } else {
      // Mismo fallo que arriba: aquí también se colaba `base`. Un gasto suelto
      // con IVA distinto del que llevaba el formulario no se llegaba a guardar.
      const { error: errIns } = await supabase.from('gastos')
        .insert({ ...fila, estimado: false })
      setGuardando(false)
      // Cerrar el modal sin mirar el error daba un gasto "guardado" que no existía.
      if (errIns) { setError(`No se ha podido guardar el gasto: ${errIns.message}`); return }
    }

    setForm(p => ({ ...p, concepto:'', importe:'', repetir:false, categoria:'', tiene_factura:false, notas:'' }))
    setMedia(null)
    onCerrar()
    onHecho()
  }

  /**
   * Abrir la confirmación. Se cuenta ANTES cuántas previsiones quedan, para
   * poder ofrecer lo de propagar el precio en la misma pantalla en vez de
   * soltarlo en un segundo cuadro cuando ya has guardado.
   */

  // Al abrir: con gasto, se rellena; sin él, formulario limpio.
  useEffect(() => {
    setError(null)
    if (editando) abrirEditar(editando)
    else setForm(p => ({ ...p, concepto:'', importe:'', metodo:'total', repetir:false, exento:'',
                        clase:'', ss_empresa:'', irpf_retenido:'', capital:'',
                        categoria:'', fecha:hoyISO(), tiene_factura:false, notas:'' }))
    setMedia(null); setUltimo(null)
  }, [editando])

  return (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
          <div className="modal">
            <div className="modal-title">
              {editando ? 'Corregir gasto' : 'Nuevo gasto'}
              <button className="modal-close" onClick={()=>onCerrar()}>✕</button>
            </div>

            {/* SI EL TRIMESTRE YA ESTÁ PRESENTADO, ESTO NO LO CORRIGE.
                La app pasará a decir el número bueno, pero el 303 que entregaste
                sigue diciendo el viejo. Eso se arregla en Hacienda, no aquí, y
                más vale saberlo antes de dar a guardar que en la próxima
                declaración. */}
            {editando && trimestrePasado(editando.fecha) && (
              <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:6,
                           padding:'8px 11px',marginBottom:10,fontSize:9.5,color:'#7A5800',lineHeight:1.6}}>
                <Ic name="alerta" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>
                Este gasto es del <strong>{trimestrePasado(editando.fecha)}</strong>. Si ya presentaste
                ese trimestre, cambiarlo aquí corrige lo que ve la app pero no lo que entregaste:
                eso se arregla con una complementaria o en la siguiente declaración. Coméntalo con la gestoría.
              </div>
            )}
            {/* El aviso de error vivía SOLO al principio de la página, o sea
                detrás del modal. Si guardar fallaba, el mensaje se pintaba donde
                no se veía y desde aquí parecía que no había pasado nada. */}
            {error && (
              <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,
                           padding:'8px 12px',marginBottom:10,fontSize:10,color:'var(--red)',lineHeight:1.55}}>
                <Ic name="alerta" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>{error}
              </div>
            )}

            {/* QUÉ CLASE DE GASTO ES. Una nómina no se parece a una factura:
                no lleva IVA, el coste son dos importes y la retención es un
                número del papel, no un porcentaje. */}
            <div className="field" style={{display: editando ? 'none' : undefined}}>
              <label>¿Qué estás apuntando?</label>
              <div style={{display:'flex',gap:6}}>
                {[['','Una factura'],['nomina','Una nómina'],['prestamo','Un préstamo']].map(([v,l])=>(
                  <button key={v} type="button" onClick={()=>setForm(p=>({...p,clase:v,metodo:v==='nomina'?'base':p.metodo}))}
                    style={{flex:1,padding:'7px 6px',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:10,
                            border:`1.5px solid ${form.clase===v?'var(--g)':'var(--bd)'}`,
                            background:form.clase===v?'var(--g)':'var(--w)',
                            color:form.clase===v?'#fff':'var(--gr)'}}>{l}</button>
                ))}
              </div>
            </div>

            <div className="field"><label>Concepto *</label><input className="input" value={form.concepto} onChange={e=>setForm(p=>({...p,concepto:e.target.value}))} placeholder="ej. Alquiler local" autoFocus onBlur={buscarMedia}/></div>
            <div className="g2">
              <div className="field">
                <label>{esNomina ? 'Salario bruto (€) *' : esPrestamo ? 'Intereses del recibo (€) *' : form.metodo === 'base' ? 'Base imponible (€) *' : 'Total pagado (€) *'}</label>
                <input className="input" type="number" value={form.importe} onChange={e=>setForm(p=>({...p,importe:e.target.value}))} placeholder="0.00"/>
              </div>
              {/* SIGUE HACIENDO FALTA, PERO NO ES LO MISMO QUE LO DE ABAJO.
                  En esta pantalla la palabra "fijo" aparecía en tres sitios
                  distintos queriendo decir tres cosas:
                    · "Se repite durante el año" → cada cuánto llega la factura.
                    · "Siempre el mismo importe" → si el importe cambia o no.
                    · esto                       → si lo pagas venga gente o no.
                  Solo la tercera da sentido al dato de "gastos fijos al mes",
                  que es lo que te cuesta abrir la puerta y por tanto cuántas
                  cuotas necesitas para no perder dinero. Así que se queda, pero
                  preguntando lo que de verdad pregunta. */}
              {/* LA PREGUNTA SIGUE SIENDO "¿LO PAGAS VENGA O NO VENGA GENTE?".
                  Eso es lo que decide el punto de equilibrio: el suelo que hay
                  que cubrir cada mes.

                  Pero como enunciado se quedaba corto: una obra no se paga
                  todos los meses y tampoco depende de cuánta gente venga, así
                  que ninguna de las dos respuestas encajaba. El criterio no
                  cambia —lo puntual va con lo variable, porque no es suelo—,
                  solo se dice de forma que tenga respuesta siempre. */}
              <div className="field"><label>Tipo de gasto</label>
                <select className="input" value={form.tipo}
                  onChange={e=>setForm(p=>({...p, tipo:e.target.value, modoEst:modoPorDefecto(e.target.value)}))}>
                  <option value="variable">Variable o puntual</option>
                  <option value="fijo">Fijo · lo pago aunque no venga nadie</option>
                </select>
                <div style={{fontSize:9,color:'var(--grl)',marginTop:3,lineHeight:1.5}}>
                  {form.tipo === 'fijo'
                    ? 'Alquiler, gestoría, nóminas, seguro, préstamo. Suma en «gastos fijos al mes», el suelo que tienes que cubrir cada mes.'
                    : 'Material, publicidad, una obra, una reparación. No cuenta como suelo: o sube y baja con lo que trabajes, o pasa una sola vez.'}
                </div>
              </div>
            </div>
            {/* QUÉ NÚMERO ESTÁS COPIANDO. Con retención el total no es base+IVA
                —lleva el IRPF restado— así que no se puede deducir la base a
                partir de él. Se pregunta en vez de adivinar. */}
            {esPrestamo && (
              <>
                <div className="field">
                  <label>Capital amortizado en este recibo (€)</label>
                  <input className="input" type="number" value={form.capital}
                    onChange={e=>setForm(p=>({...p,capital:e.target.value}))} placeholder="0.00"/>
                </div>
                <div style={{fontSize:9,color:'var(--grl)',marginBottom:10,lineHeight:1.55}}>
                  De la cuota, solo los <strong>intereses</strong> son gasto deducible: amortizar
                  capital es devolver lo prestado, no un gasto. El capital se guarda para cuadrar
                  el recibo con el banco, pero no cuenta. Los intereses <strong>no llevan IVA</strong>.
                </div>
              </>
            )}

            {esNomina && (
              <>
                <div className="g2">
                  <div className="field">
                    <label>Seguridad Social a cargo de la empresa (€)</label>
                    <input className="input" type="number" value={form.ss_empresa}
                      onChange={e=>setForm(p=>({...p,ss_empresa:e.target.value}))} placeholder="0.00"/>
                  </div>
                  <div className="field">
                    <label>IRPF retenido al trabajador (€)</label>
                    <input className="input" type="number" value={form.irpf_retenido}
                      onChange={e=>setForm(p=>({...p,irpf_retenido:e.target.value}))} placeholder="0.00"/>
                  </div>
                </div>
                <div style={{fontSize:9,color:'var(--grl)',marginBottom:10,lineHeight:1.55}}>
                  Copia los tres números de lo que te pasa la gestoría. El <strong>bruto</strong> y la
                  <strong> Seguridad Social de empresa</strong> son tu gasto; el <strong>IRPF retenido</strong> no
                  lo es —ya está dentro del bruto— pero es lo que se ingresa en el <strong>modelo 111</strong>.
                  Una nómina no lleva IVA.
                </div>
              </>
            )}

            <div className="field" style={{display: (esNomina||esPrestamo) ? 'none' : undefined}}>
              <label>¿Qué importe vas a escribir?</label>
              <div style={{display:'flex',gap:6}}>
                {[['total','El total pagado'],['base','La base imponible']].map(([v,l])=>(
                  <button key={v} type="button" onClick={()=>setForm(p=>({...p,metodo:v}))}
                    style={{flex:1,padding:'7px 6px',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:10,
                            border:`1.5px solid ${form.metodo===v?'var(--g)':'var(--bd)'}`,
                            background:form.metodo===v?'var(--g)':'var(--w)',
                            color:form.metodo===v?'#fff':'var(--gr)'}}>{l}</button>
                ))}
              </div>
              {irpfPct > 0 && form.metodo === 'total' && (
                <div style={{fontSize:9,color:'var(--amb)',marginTop:5,lineHeight:1.5,display:'flex',gap:4}}>
                  <Ic name="alerta" size={11}/>
                  <span>Con retención, el total ya lleva el IRPF restado y la base no se puede
                  calcular desde él. Pon <strong>la base imponible</strong>, que en tu factura
                  es el importe de la renta.</span>
                </div>
              )}
            </div>

            <div className="g2" style={{display: (esNomina||esPrestamo) ? 'none' : undefined}}>
              <div className="field"><label>IVA (%)</label>
                <select className="input" value={form.iva_pct} onChange={e=>setForm(p=>({...p,iva_pct:e.target.value}))}>
                  <option value="21">21%</option>
                  <option value="10">10%</option>
                  <option value="4">4%</option>
                  <option value="0">Sin IVA (0%)</option>
                </select>
              </div>
              <div className="field"><label>IRPF (%)</label><input className="input" type="number" value={form.irpf_pct} onChange={e=>setForm(p=>({...p,irpf_pct:e.target.value}))} placeholder="0"/></div>
            </div>
            {/* Recibos mixtos: el agua lleva IVA en el consumo y no en el canon
                ni en las tasas. Aquí va lo segundo. */}
            <div className="field" style={{display: (esNomina||esPrestamo) ? 'none' : undefined}}>
              <label>Parte sin IVA (€) <span style={{color:'var(--grl)',fontWeight:400}}>· opcional</span></label>
              <input className="input" type="number" value={form.exento}
                onChange={e=>setForm(p=>({...p,exento:e.target.value}))} placeholder="0.00"/>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:3,lineHeight:1.5}}>
                Para facturas mixtas, como el agua: canon y tasas municipales no llevan IVA.
                Se deduce como gasto igual, pero no genera IVA soportado.
              </div>
            </div>
            {irpfPct > 0 && (
              <div className="field"><label>¿Qué retención es? (modelo)</label>
                <select className="input" value={form.irpf_modelo} onChange={e=>setForm(p=>({...p,irpf_modelo:e.target.value}))}>
                  <option value="111">111 · Profesional / trabajador</option>
                  <option value="115">115 · Alquiler del local</option>
                </select>
              </div>
            )}

            {/* El desglose completo, con el mismo orden y los mismos signos que
                la factura, para poder compararlo línea a línea antes de guardar.
                El TOTAL estaba antes en la etiqueta del campo, así que al meter
                la base no había forma de comprobar que salía lo que pone abajo
                del papel. */}
            {/* REPETIR DURANTE EL AÑO
                El primero es real; los siguientes quedan como ESTIMADOS y no
                cuentan para el 303 ni el 115 hasta que confirmes cada factura.
                Ver lib/gastos: deducir IVA de un papel que no existe no es un
                número feo, es una declaración mal hecha. */}
            {/* Solo al crear. Editando, "se repite" no querría decir nada: la
                serie ya existe y las otras filas son gastos con vida propia.
                Marcarlo aquí generaría doce duplicados. */}
            <div className="field" style={{display: editando ? 'none' : undefined}}>
              <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
                <input type="checkbox" checked={form.repetir}
                  onChange={e=>setForm(p=>({...p,repetir:e.target.checked}))}/>
                Se repite durante el año
              </label>
              {form.repetir && (
                <>
                  <select className="input" style={{marginTop:6}} value={form.cadencia}
                    onChange={e=>setForm(p=>({...p,cadencia:e.target.value}))}>
                    {CADENCIAS.map(c=><option key={c.id} value={c.id}>{c.nombre} · {c.ayuda}</option>)}
                  </select>
                  {/* FIJO O VARIABLE. Para la gestoría, la media es un número
                      que no aparece en ninguna factura: si son 90 € y suben a
                      100, promediar da 92,50 €. Lo que vale ahí es el último
                      precio conocido. */}
                  <div style={{display:'flex',gap:6,marginTop:6}}>
                    {MODOS_ESTIMACION.map(m=>(
                      <button key={m.id} type="button" onClick={()=>setForm(p=>({...p,modoEst:m.id}))}
                        style={{flex:1,padding:'7px 6px',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:10,
                                border:`1.5px solid ${form.modoEst===m.id?'var(--g)':'var(--bd)'}`,
                                background:form.modoEst===m.id?'var(--g)':'var(--w)',
                                color:form.modoEst===m.id?'#fff':'var(--gr)'}}>{m.nombre}</button>
                    ))}
                  </div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:4}}>
                    {MODOS_ESTIMACION.find(m=>m.id===form.modoEst)?.ayuda}
                  </div>

                  <div style={{fontSize:9,color:'var(--gd)',marginTop:6,lineHeight:1.6,
                               background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,padding:'8px 10px'}}>
                    Se crearán <strong>{fechasSerie.length}</strong> gastos hasta diciembre, el día{' '}
                    <strong>{form.fecha.split('-')[2]}</strong> de cada periodo.
                    {' '}El primero queda como <strong>real</strong> y los otros {fechasSerie.length-1} como
                    {' '}<strong>estimados</strong>, que no cuentan para los impuestos hasta que confirmes su factura.
                    {form.modoEst === 'fijo'
                      ? (ultimo != null
                          ? <> Los estimados llevarán <strong>{ultimo.toFixed(2)} €</strong> de base,
                              que es el último importe real de este concepto.</>
                          : <> Los estimados repetirán los <strong>{base.toFixed(2)} €</strong> que has puesto.
                              Cuando confirmes uno con otro importe, te ofrecerá aplicarlo al resto.</>)
                      : (media
                          ? <> Los estimados llevarán <strong>{media.base.toFixed(2)} €</strong> de base,
                              la media de los {media.n} anteriores de este concepto.</>
                          : <> No hay histórico de este concepto, así que los estimados repetirán
                              los <strong>{base.toFixed(2)} €</strong> que has puesto.</>)}
                  </div>
                </>
              )}
            </div>

            {base > 0 && (
              <div style={{padding:'9px 12px',background:'var(--bl)',borderRadius:6,marginBottom:10,fontSize:10}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                  <span style={{color:'var(--grl)'}}>{esNomina ? 'Salario bruto' : esPrestamo ? 'Intereses (gasto deducible)' : 'Base imponible'}</span>
                  <span style={{fontWeight:500}}>{base.toFixed(2)} €</span>
                </div>
                {/* En una nómina el coste son dos importes. La retención se
                    enseña aparte porque NO suma: ya está dentro del bruto. */}
                {esNomina && ssEmpresa > 0 && (
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>+ Seguridad Social empresa</span>
                    <span style={{fontWeight:500}}>{ssEmpresa.toFixed(2)} €</span>
                  </div>
                )}
                {exento > 0 && (
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>+ Parte sin IVA</span>
                    <span style={{fontWeight:500}}>{exento.toFixed(2)} €</span>
                  </div>
                )}
                {!esNomina && !esPrestamo && ivaPct > 0 && (
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>+ IVA {ivaPct}% <span style={{fontSize:9}}>(sobre {base.toFixed(2)} €)</span></span>
                    <span style={{fontWeight:500}}>{ivaImporte.toFixed(2)} €</span>
                  </div>
                )}
                {!esNomina && !esPrestamo && irpfPct > 0 && (
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>− IRPF {irpfPct}%</span>
                    <span style={{fontWeight:500,color:'var(--red)'}}>−{irpfImporte.toFixed(2)} €</span>
                  </div>
                )}
                <div style={{display:'flex',justifyContent:'space-between',paddingTop:4,marginTop:2,borderTop:'1px solid var(--bd)'}}>
                  <span style={{fontWeight:600,color:'var(--n)'}}>{esNomina ? 'Coste total empresa' : esPrestamo ? 'Gasto deducible' : 'Total pagado'}</span>
                  <span style={{fontWeight:600,color:'var(--n)'}}>{total.toFixed(2)} €</span>
                </div>
                {esPrestamo && capital > 0 && (
                  <>
                    <div style={{display:'flex',justifyContent:'space-between',paddingTop:4,marginTop:2,borderTop:'1px dashed var(--bd)'}}>
                      <span style={{color:'var(--grl)'}}>+ Capital amortizado <span style={{fontSize:9}}>(no es gasto)</span></span>
                      <span style={{fontWeight:500,color:'var(--grl)'}}>{capital.toFixed(2)} €</span>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}>
                      <span style={{color:'var(--grl)'}}>Cuota pagada al banco</span>
                      <span style={{fontWeight:500,color:'var(--grl)'}}>{(base + capital).toFixed(2)} €</span>
                    </div>
                  </>
                )}
                {esNomina && irpfRetenido > 0 && (
                  <div style={{display:'flex',justifyContent:'space-between',paddingTop:4,marginTop:2,borderTop:'1px dashed var(--bd)'}}>
                    <span style={{color:'var(--grl)'}}>IRPF retenido <span style={{fontSize:9}}>(al 111, no es gasto)</span></span>
                    <span style={{fontWeight:500,color:'var(--grl)'}}>{irpfRetenido.toFixed(2)} €</span>
                  </div>
                )}
              </div>
            )}

            <div className="g2">
              {/* Lista cerrada. Era texto libre y "Suministros", "suministros"
                  y "Luz" eran tres categorías distintas para el ordenador: el
                  desglose se rompía solo en tres meses sin que nadie hiciera
                  nada mal. Ver CATEGORIAS_GASTO en lib/gastos. */}
              <div className="field"><label>Categoría</label>
                <select className="input" value={form.categoria}
                  onChange={e=>setForm(p=>({...p,categoria:e.target.value}))}>
                  <option value="">Sin categoría</option>
                  {CATEGORIAS_GASTO.map(c=><option key={c.id} value={c.id}>{c.id}</option>)}
                </select>
              </div>
              <div className="field"><label>Fecha</label><input className="input" type="date" value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))}/></div>
            </div>
            {ayudaDeCategoria(form.categoria) && (
              <div style={{fontSize:9,color:'var(--grl)',marginTop:-4,marginBottom:10,lineHeight:1.5}}>
                {ayudaDeCategoria(form.categoria)}
              </div>
            )}
            <div onClick={()=>setForm(p=>({...p,tiene_factura:!p.tiene_factura}))} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:6,border:`1px solid ${form.tiene_factura?'var(--g)':'var(--bd)'}`,background:form.tiene_factura?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:10}}>
              <div style={{width:16,height:16,borderRadius:3,border:`2px solid ${form.tiene_factura?'var(--g)':'var(--bd)'}`,background:form.tiene_factura?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {form.tiene_factura && <span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}
              </div>
              <span style={{fontSize:10,color:'var(--n)',display:'inline-flex',alignItems:'center',gap:5}}><Ic name="informe" size={12}/> Tiene factura</span>
            </div>
            <div className="field"><label>Notas</label><textarea className="input" value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} style={{minHeight:50}}/></div>
            {editando?.serie_id && (
              <div style={{fontSize:9,color:'var(--grl)',lineHeight:1.55,marginBottom:8}}>
                Esto cambia <strong>solo este mes</strong>. Los demás de la serie se quedan como están;
                para subir el precio de los que quedan, hazlo al confirmar uno.
              </div>
            )}
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>onCerrar()}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crear} disabled={guardando}>{guardando?'…':<><Ic name="guardar" size={13}/> {editando?'Guardar cambios':'Guardar'}</>}</button>
            </div>
          </div>
        </div>
  )
}
