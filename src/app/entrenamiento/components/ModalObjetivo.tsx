'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { ordenAnatomico } from '@/lib/anatomia'
import { categoriaDe } from '@/lib/etiquetas'
import BuscadorBiblioteca from '@/components/BuscadorBiblioteca'
import SelectorEtiquetasCompacto from '@/components/SelectorEtiquetasCompacto'
import { subirImagenObjetivo } from '@/lib/ejercicios'
import { especificosDeObjetivo } from '@/lib/objetivos'
import EspecificosEnPestanas from './EspecificosObjetivo'
import SelectorEvaluadores from './SelectorEvaluadores'
import { testsDeObjetivo, fijarTestsDeObjetivo, cargarEvaluadores, type Evaluador } from '@/lib/objetivosTests'

// ---------------------------------------------------------------------------
// CREAR Y EDITAR UN OBJETIVO
//
// Vivia dentro de ObjetivosTab, que pasaba de las mil lineas. Se saca aqui por
// dos razones: para que la pestana quepa en la cabeza de uno, y porque hace
// falta crear un objetivo sin salir de donde estas montando un sistema —y dos
// formularios para lo mismo acabarian diciendo cosas distintas.
// ---------------------------------------------------------------------------

/**
 * Las patologías de un objetivo, plegadas.
 *
 * Cerrado se ve solo lo que hay puesto; abierto, un buscador. Enseñar el catálogo entero
 * en pastillas ocupaba más que todo lo demás del formulario junto para un campo que se
 * rellena una vez y no se vuelve a mirar.
 */
function PatologiasObjetivo({ todas, puestas, onChange }: {
  todas: any[]
  puestas: string[]
  onChange: (ids: string[]) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [busca, setBusca] = useState('')

  const nombre = (id: string) => todas.find((e: any) => e.id === id)?.nombre || 'etiqueta'
  const quitar = (id: string) => onChange(puestas.filter(x => x !== id))
  const anadir = (id: string) => onChange([...puestas, id])

  const t = busca.trim().toLowerCase()
  const opciones = todas
    .filter((e: any) => !puestas.includes(e.id))
    .filter((e: any) => !t || String(e.nombre).toLowerCase().includes(t))
    .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre))
    .slice(0, 40)

  return (
    <>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Patología <span className="subt">· opcional, para proponerlo solo</span></span>
        <button type="button" className="btn btn-t btn-sm" style={{ marginLeft: 'auto' }}
          onClick={() => setAbierto(v => !v)}>
          <Ic name={abierto ? 'arriba' : 'abajo'} size={11} /> {abierto ? 'Cerrar' : (puestas.length > 0 ? 'Cambiar' : 'Añadir')}
        </button>
      </label>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 22, alignItems: 'center' }}>
        {puestas.length === 0
          ? <span style={{ fontSize: 12, color: 'var(--grl)' }}>Ninguna</span>
          : puestas.map(id => (
            <span key={id} onClick={() => quitar(id)} title="Quitar"
              style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, background: 'var(--g)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {nombre(id)} <span style={{ opacity: .7 }}>✕</span>
            </span>
          ))}
      </div>

      {abierto && (
        <div style={{ marginTop: 6 }}>
          <input className="input" value={busca} autoFocus onChange={e => setBusca(e.target.value)}
            placeholder="Buscar patología…" style={{ fontSize: 12, marginBottom: 5 }} />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxHeight: 118, overflowY: 'auto' }}>
            {opciones.length === 0
              ? <span style={{ fontSize: 12, color: 'var(--grl)' }}>Nada que coincida.</span>
              : opciones.map((e: any) => (
                <button key={e.id} type="button" className="chip-sel" onClick={() => anadir(e.id)}>
                  <Ic name="mas" size={9} /> {e.nombre}
                </button>
              ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 5 }}>
            Con la patología puesta, a un paciente al que le registres esa patología se le
            proponen estos objetivos arriba del todo, sin buscarlos.
          </div>
        </div>
      )}
    </>
  )
}


export default function ModalObjetivo({ objetivo, tests = [], etiquetas = [], onCerrar, onGuardado }: {
  /** null para uno nuevo. */
  objetivo?: any | null
  tests?: any[]
  etiquetas?: any[]
  onCerrar: () => void
  /** Recibe el id del objetivo guardado, para quien necesite engancharlo a algo. */
  onGuardado: (id?: string) => void
}) {
  const [guardando, setGuardando] = useState(false)
  // Con que se evalua este objetivo. Se carga aparte porque vive en su tabla.
  const [evaluadores, setEvaluadores] = useState<Evaluador[]>([])
  const [catalogo, setCatalogo] = useState<any[]>([])
  // Que se esta midiendo al abrir el selector: `null` el objetivo entero,
  // un texto el especifico. `undefined` = cerrado.
  const [eligiendo, setEligiendo] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    cargarEvaluadores().then(setCatalogo)
    if (objetivo?.id) testsDeObjetivo(objetivo.id).then(setEvaluadores)
  }, [objetivo?.id])
  const [form, setForm] = useState<any>({
    id: objetivo?.id || '', nombre: objetivo?.nombre || '', descripcion: objetivo?.descripcion || '',
    articulacion_id: objetivo?.articulacion_id || '',
    logros_plantilla: objetivo?.logros_plantilla || [], etiquetas: objetivo?.etiquetas || [],
    movimientos: objetivo?.movimientos || [], imagen_url: objetivo?.imagen_url || '',
    imagen_file: null as File | null,
  })

  /**
   * La categoria vive SOLO en la etiqueta raiz: sus hijas la heredan y tienen la columna
   * a null. Filtrar por `e.categoria` dejaba fuera todo lo que cuelga de una raiz.
   */
  const deCategoria = (cat: string) => etiquetas.filter((e: any) => categoriaDe(etiquetas, e) === cat)
  const articulaciones = deCategoria('articulacion')
    .sort((a: any, b: any) => ordenAnatomico(a.nombre, b.nombre))

  async function guardar() {
    if (form.nombre === '') { alert('El nombre es obligatorio'); return }
    setGuardando(true)
    const payload: any = {
      nombre: form.nombre, descripcion: form.descripcion,
      articulacion_id: form.articulacion_id || null,
      etiquetas: form.etiquetas || [],
      movimientos: form.movimientos || [],
    }
    // La imagen NO va en el payload: se sube al almacen y lo que se guarda es su URL.
    // Y hace falta el id, que en un objetivo nuevo no existe hasta despues de insertarlo.
    let id = form.id
    if (id) {
      const r = await supabase.from('objetivos').update(payload).eq('id', id)
      if (r.error) { setGuardando(false); alert(r.error.message); return }
    } else {
      const r = await supabase.from('objetivos').insert({ ...payload, activo: true }).select('id').single()
      if (r.error || r.data == null) { setGuardando(false); alert(r.error?.message || 'No se pudo crear'); return }
      id = r.data.id
    }

    if (form.imagen_file && id) {
      const ri = await subirImagenObjetivo(id, form.imagen_file)
      // Si la imagen falla, el objetivo ya esta guardado: se avisa y no se pierde el resto.
      if (ri.ok === false) alert('El objetivo se ha guardado, pero la imagen no: ' + ri.error)
      else await supabase.from('objetivos').update({ imagen_url: ri.url }).eq('id', id)
    } else if (form.id && form.imagen_url === '') {
      // Se ha quitado la imagen a proposito.
      await supabase.from('objetivos').update({ imagen_url: null }).eq('id', id)
    }

    if (id) {
      const vivos = (form.movimientos || []) as string[]
      const limpios = evaluadores.filter(e => e.movimiento == null || vivos.includes(e.movimiento))
      const re = await fijarTestsDeObjetivo(id, limpios)
      // Fallaba en silencio: el objetivo se guardaba y sus tests no, y no habia
      // forma de saberlo salvo volver a abrirlo y ver que estaba vacio.
      if (re.ok === false) {
        setGuardando(false)
        alert('El objetivo se guardó, pero sus tests no: ' + re.error)
        onGuardado(id); onCerrar(); return
      }
    }

    setGuardando(false)
    onGuardado(id)
    onCerrar()
  }

  /**
   * Lo que hay colgado a una parte —o al objetivo entero, si `mov` es null—.
   * Se pinta aqui y se presta al panel del especifico: quien lo guarda es este
   * modal, asi que el editor de pestanas no tiene por que saber de tests.
   */
  const filasEvaluadores = (mov: string | null) => {
    const suyos = evaluadores.map((e, k) => ({ e, k })).filter(({ e }) => (e.movimiento || null) === mov)
    if (suyos.length === 0) {
      return <div style={{ fontSize: 12, color: 'var(--grl)' }}>Sin nada con lo que comprobarlo.</div>
    }
    return (
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {suyos.map(({ e, k }) => {
          const t = catalogo.find((x: any) => x.id === e.test_id)
          const items = Array.isArray(t?.items) ? t.items : []
          const cambiar = (campos: any) =>
            setEvaluadores(p => p.map((y, m) => m === k ? { ...y, ...campos } : y))
          return (
            <div key={k} style={{ width: 134, position: 'relative' }}>
              <div style={{ width: 134, height: 90, borderRadius: 8, border: '1px solid var(--bd)',
                background: 'var(--bm)', overflow: 'hidden', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: 'var(--grl)' }}>
                {t?.imagen_url
                  ? <img src={t.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <Ic name={t?.tipo === 'cuestionario' ? 'nota' : 'test'} size={26} />}
              </div>
              <button className="btn btn-t btn-sm" title="Quitar"
                onClick={() => setEvaluadores(p => p.filter((_, m) => m !== k))}
                style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, padding: 0,
                  borderRadius: '50%', background: 'var(--w)', justifyContent: 'center' }}>
                <Ic name="cerrar" size={11}/>
              </button>
              {/* La segunda linea ES el selector: puesto a "todo el test" dice el nombre
                  del test, y en cuanto eliges un item dice el del item. Por nombre y no
                  por posicion: reordenar los items cambiaria en silencio que se mide. */}
              {/* El nombre del test SIEMPRE y entero: es lo que se reconoce. El item va
                  debajo, en su propia linea, porque es una precision del test, no otro
                  test. Por nombre y no por posicion: reordenar los items cambiaria en
                  silencio que se mide. */}
              <div style={{ marginTop: 5, fontSize: 12, lineHeight: 1.3, textAlign: 'center',
                color: t?.archivado_el ? 'var(--gr)' : 'var(--n)', overflowWrap: 'anywhere' }}>
                {t?.nombre || '—'}
              </div>
              {/* ARCHIVADO: se queda, porque es con lo que se ha estado midiendo, pero
                  ya no se le puede pasar a nadie — y por eso el objetivo vuelve a
                  contar como "por completar" hasta que se le ponga otro. */}
              {t?.archivado_el != null && (
                <div style={{ marginTop: 2, fontSize: 10.5, textAlign: 'center', color: '#7A5800' }}>
                  archivado
                </div>
              )}
              {items.length > 0 && (
                <select value={e.item || ''} onChange={ev => cambiar({ item: ev.target.value || null })}
                  title="Todo el test o solo un ítem"
                  style={{ width: '100%', marginTop: 2, fontFamily: 'inherit', fontSize: 11,
                    lineHeight: 1.3, border: 'none', background: 'transparent',
                    color: e.item ? 'var(--gd)' : 'var(--grl)',
                    textAlign: 'center', cursor: 'pointer', padding: 0 }}>
                  <option value="">Todo el test</option>
                  {items.map((it: any, ii: number) => {
                    const nom = typeof it === 'string' ? it : it?.nombre
                    return nom ? <option key={ii} value={nom}>{nom}</option> : null
                  })}
                </select>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget && !guardando) onCerrar() }}>
          {/* Ancho: aquí se edita imagen, descripción, etiquetas y movimientos. En 420 px
              cada cosa caía en su propia línea y había que hacer scroll para ver si ya
              habías puesto algo. */}
          <div className="modal" style={{ width: 'min(860px, 94vw)' }}>
            <div className="modal-title">
              {form.id ? 'Editar objetivo' : 'Nuevo objetivo'}
              <button className="modal-close" onClick={() => onCerrar()}><Ic name="cerrar" size={15} /></button>
            </div>

            {/*
              CABECERA FIJA: imagen a la izquierda; a la derecha, a todo el ancho que queda,
              nombre, descripción y zona.

              Es lo que tiene TODO objetivo, se llame como se llame su familia. Nada de esto
              se mueve al cambiar de familia: lo que baila queda debajo, que es justo lo que
              hay que mirar después de decidirla. Antes la familia iba arriba del todo y al
              cambiarla se movía el formulario entero, así que perdías de vista lo escrito.
            */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 4 }}>
              {/* UNA IMAGEN PARA EL OBJETIVO ENTERO, no una por específico: dorsiflexión e
                  inversión son el mismo gesto en direcciones distintas y cuatro ilustraciones
                  casi iguales aclararían poco.
                  Debajo había una nota que lo decía —"la comparten todos sus movimientos"— y
                  se quitó: no hay ningún sitio donde se pueda subir una foto por específico,
                  así que respondía una pregunta que nadie se hace, y encima llamaba
                  "movimientos" a lo que en la pantalla se llama "específicos". */}
              <div style={{ flexShrink: 0, width: 260 }}>
                <div style={{ position: 'relative', width: 260, height: 260, background: 'var(--bm)', borderRadius: 10, border: '1px solid var(--bd)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {form.imagen_url
                    ? <img src={form.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <span style={{ color: 'var(--grl)' }}><Ic name="objetivo" size={56} /></span>}
                  {form.imagen_url && (
                    <button onClick={() => setForm((p: any) => ({ ...p, imagen_url: '', imagen_file: null }))}
                      style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: '50%', background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11 }}>✕</button>
                  )}
                </div>
                <label style={{ cursor: 'pointer', display: 'block', marginTop: 6 }}>
                  <div className="btn btn-s btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                    <Ic name="camara" size={12} /> {form.imagen_url ? 'Cambiar' : 'Subir'}
                  </div>
                  <input type="file" accept="image/*" style={{ display: 'none' }} disabled={guardando}
                    onChange={e => { const f = e.target.files?.[0]; if (f) setForm((p: any) => ({ ...p, imagen_file: f, imagen_url: URL.createObjectURL(f) })) }} />
                </label>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="field"><label>Nombre *</label>
                  <input className="input" value={form.nombre} autoFocus disabled={guardando}
                    onChange={e => setForm((p: any) => ({ ...p, nombre: e.target.value }))}
                    placeholder="ej. Movilidad de tobillo, Aprender el puente de glúteo" />
                  <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 3 }}>
                    Empieza por un verbo, y sin lado: el lado se elige al asignárselo a un paciente.
                  </div>
                </div>

                <div className="field"><label>Descripción</label>
                  <textarea className="input" value={form.descripcion} disabled={guardando}
                    style={{ minHeight: 76, resize: 'vertical' }}
                    onChange={e => setForm((p: any) => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Qué se busca y cuándo se da por conseguido" />
                </div>

                {/* La zona se queda arriba, con lo que identifica al objetivo: es de dónde
                    es, no cómo se comporta. La familia va debajo porque de ella depende
                    todo lo que viene después. */}
                <div className="field" style={{ marginBottom: 0, maxWidth: 260 }}><label>Zona</label>
                  <select className="input" value={form.articulacion_id} disabled={guardando}
                    onChange={e => setForm((p: any) => ({ ...p, articulacion_id: e.target.value }))}>
                    <option value="">— Sin zona concreta —</option>
                    {articulaciones.map((a: any) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* AQUÍ IBA LA FAMILIA, y ya no está.
                Obligaba a decidir de antemano cómo se iba a cerrar el objetivo, y esa
                decisión se toma después: al ponerle una meta con número o al marcar una
                condición. Peor aún, cerraba puertas — un objetivo marcado "cualitativo" no
                admitía un número—. Ahora el objetivo es lo que tiene: si le pones fases,
                progresa por fases; si le pones una meta, se mide. */}
            <div className="obj-form" style={{ borderTop: '1px solid var(--bd)', paddingTop: 12, marginTop: 12 }}>
            {/* LOS ESPECÍFICOS.
                "Movilidad de tobillo" es el general; dorsiflexión, eversión y compañía son
                lo concreto. Van dentro y no como fichas aparte: con 38 movimientos y dos
                métricas serían casi cien objetivos que mantener, y es de donde venimos.

                Cada uno es una PARTE que hace falta: "que me financien" y "que me alquilen
                el local" para montar el negocio. Si no aparecen en la ficha, nada garantiza
                que no se salte ninguna. */}
            <div className="field ancho">
              <label>Objetivo específico</label>
              <EspecificosEnPestanas
                ids={form.movimientos || []}
                objetivoId={form.id}
                etiquetas={etiquetas}
                tests={tests || []}
                onChange={(ids: string[]) => {
                  setForm((p: any) => ({ ...p, movimientos: ids }))
                  // Y CON EL ESPECIFICO SE VAN SUS TESTS. Si no, la fila se queda
                  // apuntando a algo que ya no existe: invisible en pantalla pero
                  // contando en la tarjeta y entrando en las evaluaciones.
                  setEvaluadores(prev => prev.filter(e => e.movimiento == null || ids.includes(e.movimiento)))
                }}
                onEvaluar={(mov: string | null) => setEligiendo(mov)}
                evaluacion={(mov: string | null) => filasEvaluadores(mov)} />
            </div>

            {/* AQUÍ IBAN LAS FASES y sus condiciones de salida, y se han quitado por lo
                mismo que las metas y los logros: el objetivo ES lo que se mide, lo abre un
                test y lo cierra ese mismo test. Una progresión por fases dentro era otra
                capa de medición encima de la medición.
                `EditorCriteriosFase` sigue en este fichero y `lib/fases.ts` entero en el
                repositorio; las columnas `fases` y `criterios_fase` siguen en la base, sin
                escribirse. */}

            {/* PATOLOGÍA, PLEGADA.
                Es el campo que menos se toca y salía como un muro de treinta pastillas que
                se llevaba media pantalla. Ahora se ve lo que hay puesto —que es lo único que
                se viene a comprobar— y el resto se busca. Mismo criterio que el selector de
                específicos.

                No se quita, aunque casi no se use: la ficha del paciente cruza estas
                etiquetas con sus patologías activas para subir arriba los objetivos que le
                tocan al abrir "Añadir". Sin este campo eso se degradaría solo, porque
                ningún objetivo nuevo volvería a entrar en la sugerencia. */}
            <div className="field ancho">
              <PatologiasObjetivo
                todas={deCategoria('patologia')}
                puestas={form.etiquetas || []}
                onChange={(ids: string[]) => setForm((p: any) => ({ ...p, etiquetas: ids }))} />
            </div>

            {/* CON QUE SE EVALUA. Es otra relacion distinta de "que test lo abre":
                aquella es diagnostico y vive en el item del test; esta dice con que
                se mira si ya esta conseguido, y es la que arma las evaluaciones. */}
            {/* CON QUE SE COMPRUEBA, COLGADO DE LO QUE MIDE.
                Antes era una lista suelta con un desplegable para decir de que
                parte respondia cada test. Puesto dentro de cada especifico sobra
                el desplegable: donde esta ya lo dice. */}
            <div style={{ borderTop:'1px solid var(--bd)', marginTop:14, paddingTop:12 }}>
              {/* El rotulo solo tiene sentido si debajo va la caja del objetivo entero;
                  sin especificos lo unico que queda aqui es el aviso, que se explica solo. */}
              {(form.movimientos || []).length > 0 && (
                <label style={{ fontSize:10, fontWeight:500, color:'var(--gr)',
                  letterSpacing:'.5px', textTransform:'uppercase' }}>Cómo se comprueba</label>
              )}

              {evaluadores.length === 0 && (
                <div style={{ fontSize:11, color:'#7A5800', background:'var(--ambl)',
                  border:'1px solid var(--amb)', borderRadius:6, padding:'7px 10px',
                  lineHeight:1.5, margin:'7px 0' }}>
                  Sin forma de medirlo. Se guarda igual, pero queda <b>por completar</b>:
                  no entra en ninguna evaluación y no puede cerrar una fase.
                </div>
              )}

              {/* Solo EL OBJETIVO ENTERO, y solo si hay especificos: sin ellos esto
                  mismo ya sale dentro del panel de arriba. Lo de cada parte se edita
                  dentro de su pestana, al lado del boton de quitarla. */}
              {(form.movimientos || []).length > 0 && (
              <div style={{ border: '1px solid var(--bd)', borderRadius: 7, padding: '9px 11px', marginTop: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--gr)' }}>El objetivo entero</span>
                  <button className="btn btn-s btn-sm" onClick={() => setEligiendo(null)}>
                    + Añadir
                  </button>
                </div>
                {filasEvaluadores(null)}
              </div>
              )}
            </div>

            {eligiendo !== undefined && (
              <SelectorEvaluadores etiquetas={etiquetas} onCerrar={() => setEligiendo(undefined)}
                ya={evaluadores.filter(e => (e.movimiento || null) === eligiendo && e.item == null).map(e => e.test_id)}
                onElegir={(ids: string[]) => setEvaluadores(p =>
                  [...p, ...ids.map(id => ({ test_id: id, item: null, movimiento: eligiendo ?? null }))])}/>
            )}

            {/* AQUÍ IBAN LOS "LOGROS HABITUALES". Se han quitado con las metas y los
                logros del paciente: el objetivo es lo que se mide, y no lleva dentro otra
                lista de cosas que medir. `EditorLogrosPlantilla` sigue en este fichero y la
                columna `logros_plantilla` sigue en la base, sin escribirse. */}

            {/* EL ENLACE CON LOS TESTS SE HACE DESDE EL TEST, Y SOLO DESDE AHÍ.
                Aquí había un "Test que lo abre" que era la segunda forma de decir lo mismo:
                el test podía colgar el objetivo de un ítem o de una banda, y el objetivo
                podía colgarse a sí mismo del test entero. Dos sitios para una decisión
                acaban contradiciéndose, y el que mira uno no ve lo que dice el otro.
                Ahora hay una sola vía: Biblioteca → Tests → el ítem o la banda. */}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-t btn-sm" onClick={() => onCerrar()} disabled={guardando}>Cancelar</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-p" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
  )
}
