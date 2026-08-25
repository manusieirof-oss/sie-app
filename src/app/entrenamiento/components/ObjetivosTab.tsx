'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { ordenAnatomico } from '@/lib/anatomia'
import { categoriaDe, zonasDe } from '@/lib/etiquetas'
import BuscadorBiblioteca from '@/components/BuscadorBiblioteca'
import SelectorEtiquetasCompacto from '@/components/SelectorEtiquetasCompacto'
import { subirImagenObjetivo } from '@/lib/ejercicios'
import { criteriosBrutos, problemasDeCriterios, type CriterioFase } from '@/lib/fases'
import { bandasDe } from '@/lib/tests'

/**
 * La biblioteca de objetivos.
 *
 * TRES FAMILIAS Y SOLO UNA LLEVA NÚMERO. Antes se pintaban todas iguales, así que un
 * objetivo métrico y uno de aprendizaje parecían lo mismo y nadie sabía cuál se podía
 * cerrar solo. Ahora la familia manda en la vista:
 *
 *   metrico      Fuerza o movilidad, con sus movimientos. Lo cierra una medición.
 *   fase         Progresión de una tanda a la siguiente. La avanza el entrenador.
 *   cualitativo  Se cumple o no.
 *
 * LA MÉTRICA NO LLEVA MOVIMIENTO NI LADO: son del paciente, no de la ficha. "Fuerza de
 * hombro" es el espacio; que a este paciente le toque rotación interna derecha al 20% se
 * decide al asignárselo. Es lo que evita las 160 fichas del programa anterior.
 */

/**
 * Los LOGROS HABITUALES de un objetivo: sus partes, escritas una vez.
 *
 * La familia métrica ya tenía específicos —sus movimientos— y las otras dos no tenían nada:
 * un objetivo cualitativo era un título suelto, y las partes que siempre lo componen había
 * que volver a escribirlas en cada paciente.
 *
 * Aquí se escriben una vez y al asignárselo a alguien se COPIAN a su ficha, donde ya son
 * suyas: se quitan, se cambian y se marcan sin tocar la biblioteca. Por eso son texto y no
 * una tabla de sub-objetivos con su propia vida — un sub-objetivo que hubiera que mantener
 * en dos sitios acabaría diciendo cosas distintas en cada uno.
 */
function EditorLogrosPlantilla({ logros, onCambia }: { logros: any, onCambia: (v: string[]) => void }) {
  const lista: string[] = (Array.isArray(logros) ? logros : []).map((x: any) => String(x || ''))
  const set = (i: number, v: string) => { const l = [...lista]; l[i] = v; onCambia(l) }

  return (
    <div>
      {lista.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 5 }}>
          Sin partes escritas. El objetivo se podrá usar igual, pero cada paciente empezará en blanco.
        </div>
      )}
      {lista.map((l, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <input className="input" style={{ flex: 1, fontSize: 12 }} value={l}
            placeholder="ej. Control escapular en empuje"
            onChange={e => set(i, e.target.value)} />
          <button type="button" onClick={() => onCambia(lista.filter((_, j) => j !== i))}
            style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-t btn-sm" onClick={() => onCambia([...lista, ''])}>
        + Añadir parte
      </button>
    </div>
  )
}

/**
 * Elegir un test, buscando.
 *
 * Era un `<select>` con los sesenta y pico tests de la biblioteca, en el orden en que
 * vinieran. Para encontrar "Lunge de tobillo" había que recorrer la lista entera, y la
 * biblioteca solo va a crecer.
 *
 * Busca por nombre, por descripción, por zona y por el nombre de los ÍTEMS, igual que el
 * explorador de la biblioteca: en la camilla se busca por la maniobra —"McMurray"— y esa
 * palabra vive dentro de un ítem, no en el título del test. La zona va debajo, que es lo
 * que distingue dos tests que se llaman parecido.
 */
function SelectorTest({ tests, etiquetas, valor, onElegir, onLimpiar, placeholder = 'Buscar test por nombre, zona o maniobra…' }: {
  tests: any[]
  etiquetas: any[]
  valor: string
  onElegir: (t: any) => void
  onLimpiar: () => void
  placeholder?: string
}) {
  const elegido = valor ? tests.find((t: any) => t.id === valor) : null
  const zonas = (t: any) => zonasDe(etiquetas || [], t?.etiquetas_relacionadas || []).map((z: any) => z.nombre).join(' · ')

  if (elegido) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 'var(--r)', border: '1.5px solid var(--g)', background: 'var(--gl)' }}>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--n)' }}>
          {elegido.nombre}
          {zonas(elegido) && <span style={{ color: 'var(--gr)' }}> · {zonas(elegido)}</span>}
        </span>
        <button type="button" onClick={onLimpiar}
          style={{ fontSize: 11, color: 'var(--gd)', background: 'none', border: 'none', cursor: 'pointer' }}>
          Cambiar
        </button>
      </div>
    )
  }

  return (
    <BuscadorBiblioteca
      items={tests}
      placeholder={placeholder}
      buscarEn={(t: any) => [t.nombre, t.descripcion, zonas(t), ...(t.items || []).map((i: any) => i?.nombre)]}
      subtitulo={(t: any) => zonas(t) || 'Sin zona'}
      onElegir={onElegir}
      max={12}
    />
  )
}

/**
 * Los CRITERIOS DE SALIDA de cada fase.
 *
 * Viven en el objetivo y no en el test a propósito: las fases son del objetivo —"vuelta a
 * correr tras cruzado" tiene las suyas— y el mismo test puede medir criterios de objetivos
 * distintos con umbrales distintos. Ponerlos en el test obligaría a duplicar el test por
 * cada protocolo que lo use.
 *
 * Y por eso el umbral se escribe AQUÍ y no se hereda del ítem: la regla del ítem dice
 * cuándo el test es positivo, que es otra pregunta. Un déficit de extensión de 3° puede
 * ser un hallazgo del test y a la vez suficiente para salir de la fase 2.
 */
function EditorCriteriosFase({ fases, criterios, tests, etiquetas, onCambia }: {
  fases: number
  criterios: any
  tests: any[]
  etiquetas: any[]
  onCambia: (v: any[]) => void
}) {
  // EN BRUTO, sin descartar lo incompleto: un criterio recién añadido nace sin test ni
  // ítem, y leerlo con `criteriosDe` lo tiraba antes de poder rellenarlo — el botón de
  // añadir parecía no hacer nada.
  const defs = criteriosBrutos({ criterios_fase: criterios })
  const deFase = (n: number): CriterioFase[] => (defs.find(d => d.fase === n)?.criterios || []) as CriterioFase[]

  /**
   * EL TEST SE ELIGE UNA VEZ, NO EN CADA FILA.
   *
   * Un objetivo por fases se mide casi siempre con el mismo test, y repetir el desplegable
   * en cada criterio hacía que la pantalla pareciera preguntar algo distinto cada vez
   * cuando la respuesta iba a ser la misma doce veces.
   *
   * No se guarda en el objetivo: sigue siendo cada criterio el que dice de qué test sale,
   * porque un protocolo puede mezclarlos —rango de una prueba, fuerza de otra—. Esto solo
   * decide con cuál nacen los criterios nuevos, y las filas que usen otro lo enseñan.
   */
  const [testBase, setTestBase] = useState<string>(() => {
    const puestos = defs.flatMap(d => d.criterios).map((c: any) => c?.test_id).filter(Boolean)
    return puestos[0] || ''
  })
  const [otroTest, setOtroTest] = useState<Record<string, boolean>>({})

  const escribe = (n: number, lista: CriterioFase[]) => {
    const resto = (Array.isArray(criterios) ? criterios : []).filter((f: any) => Number(f?.fase) !== n)
    onCambia(lista.length > 0 ? [...resto, { fase: n, criterios: lista }] : resto)
  }
  const num = (v: string) => v === '' ? undefined : Number(v)

  if (!fases || fases < 2) {
    return <div style={{ fontSize: 11, color: 'var(--grl)' }}>Pon primero cuántas fases tiene el objetivo.</div>
  }

  return (
    <div>
      <div style={{ marginBottom: 9 }}>
        <div style={{ fontSize: 11, color: 'var(--gr)', marginBottom: 4 }}>Los criterios se miden con</div>
        <SelectorTest tests={tests} etiquetas={etiquetas} valor={testBase}
          onElegir={(t: any) => setTestBase(t.id)} onLimpiar={() => setTestBase('')} />
      </div>

      {/* La ÚLTIMA fase no lleva criterios de salida: de ella no se sale sola. Cerrar el
          objetivo es una decisión del entrenador, no una consecuencia de una medición. */}
      {Array.from({ length: Math.max(0, fases - 1) }).map((_, k) => {
        const n = k + 1
        const lista = deFase(n)
        return (
          <div key={n} style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 7, background: 'var(--bl)', border: '1px solid var(--bd)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--grl)', letterSpacing: .4, textTransform: 'uppercase', marginBottom: 6 }}>
              Para salir de la fase {n}
            </div>

            {lista.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 5 }}>
                Sin criterios: de esta fase se pasa a mano.
              </div>
            )}

            {lista.map((c, i) => {
              const t = tests.find((x: any) => x.id === c.test_id)
              const items = (t?.items || []).filter((it: any) => it?.nombre)
              const item = items.find((it: any) => String(it.nombre).trim().toLowerCase() === String(c.item || '').trim().toLowerCase())
              const unidad = item?.unidad || (item?.tiene_grados ? 'grados' : '')
              const dos = c.regla === 'entre' || c.regla === 'fuera'
              const set = (campos: any) => { const l = [...lista]; l[i] = { ...l[i], ...campos }; escribe(n, l) }
              // El desplegable de test solo sale si esta fila usa otro distinto del común, o
              // si has pedido cambiárselo. Enseñarlo siempre era la repetición que sobraba.
              const clave = `${n}:${i}`
              const distinto = !!c.test_id && c.test_id !== testBase
              const verTest = distinto || !!otroTest[clave]
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                  {verTest && (
                    <select className="input" style={{ width: 168, fontSize: 11, borderColor: distinto ? 'var(--g)' : undefined }} value={c.test_id}
                      onChange={e => set({ test_id: e.target.value, item: '' })}>
                      <option value="">— test —</option>
                      {tests.map((x: any) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                    </select>
                  )}

                  {/* Un criterio sobre el TOTAL no mira ningún ítem, así que el desplegable
                      sobra: enseñarlo apagado invitaría a rellenarlo para nada. */}
                  {c.tipo !== 'total' ? (
                    <select className="input" style={{ width: 168, fontSize: 11 }} value={c.item || ''}
                      onChange={e => set({ item: e.target.value })}>
                      <option value="">— ítem —</option>
                      {items.map((it: any) => <option key={it.nombre} value={it.nombre}>{it.nombre}</option>)}
                      {c.item && !item && <option value={c.item}>{c.item} (ya no existe)</option>}
                    </select>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--gd)', width: 168 }}>
                      {t?.logica === 'baremo' ? 'pruebas fuera de norma' : 'el total del test'}
                    </span>
                  )}

                  {/* "Se cumple si", no "positivo si": aquí se describe cuándo se SUPERA la
                      fase, que es lo contrario de cuándo el test da hallazgo. */}
                  <span style={{ fontSize: 10, color: 'var(--grl)' }}>se cumple si</span>

                  {/* MEDIDA O CASILLA. No todas las progresiones tienen números: un
                      aprendizaje avanza por observaciones que se cumplen o no, y el ítem de
                      casilla del test es exactamente eso. */}
                  <select className="input" style={{ width: 120, fontSize: 11 }} value={c.tipo || 'medida'}
                    onChange={e => set({ tipo: e.target.value, ...(e.target.value === 'total' ? { item: '' } : {}) })}>
                    <option value="medida">el valor del ítem</option>
                    <option value="marcado">la casilla del ítem</option>
                    <option value="total">la puntuación del test</option>
                  </select>

                  {(c.tipo || 'medida') === 'marcado' ? (
                    <select className="input" style={{ width: 132, fontSize: 11 }} value={c.marcado === false ? 'no' : 'si'}
                      onChange={e => set({ marcado: e.target.value === 'si' })}>
                      <option value="si">está marcada</option>
                      <option value="no">está sin marcar</option>
                    </select>
                  ) : (
                    <>
                      <select className="input" style={{ width: 116, fontSize: 11 }} value={c.regla || 'mayor'}
                        onChange={e => set({ regla: e.target.value })}>
                        <option value="mayor">mayor que</option>
                        <option value="menor">menor que</option>
                        <option value="entre">está entre</option>
                        <option value="fuera">está fuera de</option>
                      </select>
                      <input className="input" type="number" style={{ width: 72, fontSize: 11 }} value={c.umbral ?? ''}
                        onChange={e => set({ umbral: num(e.target.value) })} placeholder="valor" />
                      {dos && (
                        <>
                          <span style={{ fontSize: 10, color: 'var(--grl)' }}>y</span>
                          <input className="input" type="number" style={{ width: 72, fontSize: 11 }} value={c.umbral2 ?? ''}
                            onChange={e => set({ umbral2: num(e.target.value) })} placeholder="valor" />
                        </>
                      )}
                      <span style={{ fontSize: 10, color: 'var(--grl)' }}>{unidad}</span>
                    </>
                  )}
                  {!verTest && (
                    <button type="button" onClick={() => setOtroTest(p => ({ ...p, [clave]: true }))}
                      title="Medir este criterio con un test distinto"
                      style={{ fontSize: 10, color: 'var(--gd)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      otro test
                    </button>
                  )}
                  <button type="button" onClick={() => escribe(n, lista.filter((_, j) => j !== i))}
                    style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
              )
            })}

            {/* Sin test elegido no hay ítems que ofrecer, así que el botón espera en vez de
                crear una fila que no se puede rellenar. */}
            <button type="button" className="btn btn-t btn-sm" disabled={!testBase}
              title={testBase ? '' : 'Elige antes el test con el que se miden los criterios'}
              onClick={() => escribe(n, [...lista, { test_id: testBase, item: '', tipo: 'medida', regla: 'mayor', umbral: undefined }])}>
              + Añadir criterio
            </button>

            {lista.length > 1 && (
              <div style={{ fontSize: 10, color: 'var(--gr)', marginTop: 4 }}>
                Hay que cumplirlos <b>todos</b> para salir de la fase.
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const FAMILIAS = [
  { id: 'metrico', nombre: 'Medibles', ayuda: 'Fuerza o movilidad. Los cierra una medición de un test.' },
  { id: 'fase', nombre: 'Por fases', ayuda: 'Progresan de una tanda del programa a la siguiente.' },
  { id: 'cualitativo', nombre: 'Cualitativos', ayuda: 'Se cumplen o no. Aprender algo, corregir un hábito.' },
] as const

/**
 * Valor del filtro de zona para "los que no tienen ninguna". Es una cadena imposible
 * como id de etiqueta, así que no puede chocar con una zona de verdad.
 */
const SIN_ZONA = '__sin_zona'

export default function ObjetivosTab({ objetivos, testsLib, etiquetas = [], cargar }: any) {
  const [familia, setFamilia] = useState<string>('')
  const [zona, setZona] = useState<string>('')
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState<any>({ id:'', nombre:'', descripcion:'', test_id:'', tipo:'cualitativo', metrica:'', articulacion_id:'', fases:'', criterios_fase:[] as any[], logros_plantilla:[] as string[], test_bandas:[] as string[], etiquetas:[] as string[], movimientos:[] as string[], imagen_url:'', imagen_file:null as File|null })
  const [enUso, setEnUso] = useState<Record<string, number>>({})

  // Cuántos pacientes tienen cada objetivo abierto. Es lo que dice si una ficha se usa o
  // sobra, y hasta ahora no se sabía: la biblioteca crecía sin que nadie la podase.
  useEffect(() => {
    supabase.from('pacientes_objetivos').select('objetivo_id,logrado').then(({ data }) => {
      const m: Record<string, number> = {}
      ;(data || []).forEach((p: any) => { if (!p.logrado) m[p.objetivo_id] = (m[p.objetivo_id] || 0) + 1 })
      setEnUso(m)
    })
  }, [objetivos])

  const nombreEt = (id: string) => etiquetas.find((e: any) => e.id === id)?.nombre || ''
  const nombreTest = (id: string) => (testsLib || []).find((t: any) => t.id === id)?.nombre || ''

  /**
   * Las zonas que de verdad se usan, en orden de la cabeza a los pies.
   *
   * SOLO ARTICULACIONES. Antes entraban también las `etiquetas` libres de cada objetivo
   * —que son patologías— para poder filtrar por "Trocanteritis". El resultado era una
   * fila con decenas de pastillas donde la mitad no eran zonas, y encontrar "Rodilla"
   * costaba más que no tener filtro. La categoría se resuelve desde la raíz, así que una
   * subzona cuenta como su articulación.
   */
  const zonas = useMemo(() => {
    const ids = Array.from(new Set([
      ...(objetivos || []).map((o: any) => o.articulacion_id),
      ...(objetivos || []).flatMap((o: any) => o.etiquetas || []),
    ].filter(Boolean))) as string[]
    return ids
      .map(id => ({ id, et: etiquetas.find((e: any) => e.id === id) }))
      .filter(z => z.et && categoriaDe(etiquetas, z.et) === 'articulacion')
      .map(z => ({ id: z.id, nombre: z.et.nombre }))
      .sort((a, b) => ordenAnatomico(a.nombre, b.nombre))
  }, [objetivos, etiquetas])

  /** Los que no tienen zona puesta. Sin este cajón no habría forma de dar con ellos. */
  const sinZona = (objetivos || []).filter((o: any) => !o.articulacion_id).length

  const filtrados = (objetivos || []).filter((o: any) => {
    const matchF = !familia || (o.tipo || 'cualitativo') === familia
    // También vale que la articulación esté entre las etiquetas libres: un objetivo puede
    // llevarla ahí y sigue siendo de esa zona.
    const matchZ = !zona
      || (zona === SIN_ZONA ? !o.articulacion_id
        : o.articulacion_id === zona || (o.etiquetas || []).includes(zona))
    return matchF && matchZ
  })

  const cuentaFamilia = (f: string) => (objetivos || []).filter((o: any) => (o.tipo || 'cualitativo') === f).length
  // Los sembrados con los tests se quedaron sin familia. Conviene verlos para repasarlos.
  const sinFamilia = (objetivos || []).filter((o: any) => !o.tipo).length

  function abrirNuevo() {
    setForm({ id:'', nombre:'', descripcion:'', test_id:'', tipo:'cualitativo', metrica:'', articulacion_id:'', fases:'', criterios_fase:[], logros_plantilla:[], test_bandas:[], etiquetas:[], movimientos:[], imagen_url:'', imagen_file:null })
    setModal(true)
  }
  function abrirEditar(o: any) {
    setForm({
      id:o.id, nombre:o.nombre||'', descripcion:o.descripcion||'',
      test_id:o.test_id||'', tipo:o.tipo||'cualitativo', metrica:o.metrica||'',
      articulacion_id:o.articulacion_id||'', fases:o.fases||'', criterios_fase:o.criterios_fase||[],
      logros_plantilla:o.logros_plantilla||[], test_bandas:o.test_bandas||[], etiquetas:o.etiquetas||[],
      movimientos:o.movimientos||[], imagen_url:o.imagen_url||'', imagen_file:null,
    })
    setModal(true)
  }

  async function guardar() {
    if (!form.nombre) { alert('El nombre es obligatorio'); return }
    // Los criterios de fase deciden solos en qué punto está un paciente, así que un
    // criterio a medio escribir no puede guardarse: fallaría callado, dejando a alguien
    // clavado en una fase por un umbral que nadie rellenó.
    if (form.tipo === 'fase') {
      const p = problemasDeCriterios({ criterios_fase: form.criterios_fase, fases: parseInt(form.fases) || 0 }, testsLib || [])
      if (p.length > 0) { alert('El objetivo no se ha guardado:\n\n' + p.map(x => '· ' + x).join('\n')); return }
    }
    setGuardando(true)
    const payload: any = {
      nombre: form.nombre, descripcion: form.descripcion,
      // `test_id` ya no se escribe desde aquí: el enlace con los tests vive en el test, en
      // su ítem o en su banda. No se manda a null a propósito — borrar de golpe lo que
      // hubiera configurado de antes sería tirar datos que nadie ha pedido tirar.
      tipo: form.tipo,
      // Cada familia guarda lo suyo y limpia lo de las otras: un objetivo que fue métrico
      // y pasa a cualitativo no puede quedarse con la métrica puesta.
      metrica: form.tipo === 'metrico' ? (form.metrica || null) : null,
      fases: form.tipo === 'fase' ? (parseInt(form.fases) || null) : null,
      criterios_fase: form.tipo === 'fase' ? (form.criterios_fase || []) : [],
      // Los logros habituales valen en las tres familias: un objetivo métrico también puede
      // tener una parte que no es un número. Se limpian los vacíos, que solo son filas que
      // alguien empezó y no escribió.
      logros_plantilla: (form.logros_plantilla || []).map((x: string) => String(x || '').trim()).filter(Boolean),
      articulacion_id: form.articulacion_id || null,
      // Solo en fases y cualitativos: los métricos ya se describen con su articulación y
      // sus movimientos, y repetirlo aquí serían dos verdades para lo mismo.
      etiquetas: form.tipo === 'metrico' ? [] : (form.etiquetas || []),
      // Los específicos valen en las tres familias. Estaban limitados a los métricos, y eso
      // dejaba a un cualitativo sin forma de concretarse: "reeducación neuromuscular" no
      // podía decir que la suya es la del pie.
      movimientos: form.movimientos || [],
    }
    // La imagen NO va en el payload: se sube al almacén y lo que se guarda es su URL.
    // Y hace falta el id, que en un objetivo nuevo no existe hasta después de insertarlo.
    let id = form.id
    if (id) {
      const r = await supabase.from('objetivos').update(payload).eq('id', id)
      if (r.error) { setGuardando(false); alert(r.error.message); return }
    } else {
      const r = await supabase.from('objetivos').insert({ ...payload, activo: true }).select('id').single()
      if (r.error || !r.data) { setGuardando(false); alert(r.error?.message || 'No se pudo crear'); return }
      id = r.data.id
    }

    if (form.imagen_file && id) {
      const ri = await subirImagenObjetivo(id, form.imagen_file)
      // Si la imagen falla, el objetivo ya está guardado: se avisa y no se pierde el resto.
      if (!ri.ok) alert('El objetivo se ha guardado, pero la imagen no: ' + ri.error)
      else await supabase.from('objetivos').update({ imagen_url: ri.url }).eq('id', id)
    } else if (form.id && !form.imagen_url) {
      // Se ha quitado la imagen a propósito.
      await supabase.from('objetivos').update({ imagen_url: null }).eq('id', id)
    }

    setGuardando(false)
    setModal(false); cargar()
  }

  async function eliminar(o: any) {
    const n = enUso[o.id] || 0
    if (!confirm(
      `Eliminar "${o.nombre}".\n\n` +
      (n > 0 ? `${n} paciente${n > 1 ? 's lo tienen' : ' lo tiene'} abierto ahora mismo y lo perderá${n > 1 ? 'n' : ''}.\n` : 'No lo tiene nadie abierto.\n') +
      `\nNo se puede deshacer.`)) return
    await supabase.from('objetivos').delete().eq('id', o.id)
    cargar()
  }

  /**
   * La categoría vive SOLO en la etiqueta raíz: sus hijas la heredan y tienen la columna
   * a null. Filtrar por `e.categoria` dejaba fuera todo lo que cuelga de una raíz —que es
   * casi todo— y por eso la lista de movimientos salía sin "Dorsiflexión" y no había
   * manera de editar los específicos de un objetivo.
   */
  const deCategoria = (cat: string) => etiquetas.filter((e: any) => categoriaDe(etiquetas, e) === cat)

  const articulaciones = deCategoria('articulacion')
    .sort((a: any, b: any) => ordenAnatomico(a.nombre, b.nombre))

  return (
    <div className="panel">
      <div className="sec">
        <div className="sec-h">
          <span className="sh-l">
            <span className="ct-l"><Ic name="objetivo" size={13} /> Objetivos</span>
            <button className="btn btn-p btn-sm" onClick={abrirNuevo}>+ Nuevo</button>
          </span>
          <span className="sh-r">
            {(objetivos || []).length} en total{sinFamilia > 0 && <> · {sinFamilia} sin clasificar</>}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {FAMILIAS.map(f => (
            <button key={f.id} className={`chip-sel ${familia === f.id ? 'on' : ''}`} title={f.ayuda}
              onClick={() => setFamilia(familia === f.id ? '' : f.id)}>
              {f.nombre} · {cuentaFamilia(f.id)}
            </button>
          ))}
          {sinFamilia > 0 && (
            <button className={`chip-sel ${familia === 'sin' ? 'on' : ''}`}
              title="Los que sembré con los tests, de antes del modelo nuevo. Conviene repasarlos."
              onClick={() => setFamilia(familia === 'sin' ? '' : 'sin')}>
              Sin clasificar · {sinFamilia}
            </button>
          )}
        </div>

        {/* Por zona, de la cabeza a los pies. Sale de la misma etiqueta con la que se
            filtran ejercicios y tests, así que el vocabulario es uno solo. */}
        {(zonas.length > 0 || sinZona > 0) && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className={`chip-sel ${!zona ? 'on' : ''}`} onClick={() => setZona('')}>Todas las zonas</button>
            {zonas.map(z => (
              <button key={z.id} className={`chip-sel ${zona === z.id ? 'on' : ''}`}
                onClick={() => setZona(zona === z.id ? '' : z.id)}>{z.nombre}</button>
            ))}
            {/* Al final y con su cuenta: es un cajón de repaso, no una zona más. */}
            {sinZona > 0 && (
              <button className={`chip-sel ${zona === SIN_ZONA ? 'on' : ''}`}
                title="Objetivos a los que no les has puesto zona"
                onClick={() => setZona(zona === SIN_ZONA ? '' : SIN_ZONA)}>
                Sin zona · {sinZona}
              </button>
            )}
          </div>
        )}

        {filtrados.length === 0 ? (
          <div className="muted">
            {(objetivos || []).length === 0 ? 'Sin objetivos todavía.' : 'Ninguno coincide.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(232px,1fr))', gap: 12 }}>
            {filtrados
              .filter((o: any) => familia !== 'sin' || !o.tipo)
              .map((o: any) => {
                const tipo = o.tipo || null
                const movs = (o.movimientos || []).map((id: string) => nombreEt(id)).filter(Boolean)
                const n = enUso[o.id] || 0
                return (
                  <div key={o.id} className="obj-card">
                    {/* La imagen manda: es lo primero que se reconoce. Sin ella, la inicial
                        sobre el color del objetivo — veinte huecos grises iguales se leen
                        como que algo ha fallado, y el color ya separa fuerza de movilidad. */}
                    {/* El tinte se hace pegando alfa al hex, así que solo vale si HAY hex:
                        con `var(--g)` saldría `var(--g)14`, que el navegador tira. */}
                    <div className="obj-card-img">
                      {o.imagen_url
                        ? <img src={o.imagen_url} alt="" />
                        : <span style={{ color: 'var(--g)' }}>{(o.nombre || '?').trim().charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="obj-card-b">
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--n)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', lineHeight: 1.3 }}>
                        {o.nombre}
                        {tipo === 'metrico' && o.metrica && <span className="pill pill-o on">{o.metrica === 'fuerza' ? 'Fuerza' : 'Movilidad'}</span>}
                        {tipo === 'fase' && <span className="pill pill-soft">{o.fases || '?'} fases</span>}
                        {!tipo && <span className="pill pill-soft" title="De antes del modelo nuevo">Sin clasificar</span>}
                        {o.articulacion_id && <span style={{ fontSize: 12, color: 'var(--gr)' }}>{nombreEt(o.articulacion_id)}</span>}
                      </div>
                      {o.descripcion && (
                        // Cortada a cuatro líneas: una descripción larga estiraba su
                        // tarjeta y descolocaba toda la fila de la rejilla. Entera se lee
                        // al abrir el objetivo.
                        <div title={o.descripcion} style={{ fontSize: 12, color: 'var(--gr)', lineHeight: 1.5, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.descripcion}</div>
                      )}
                      {/* LOS MOVIMIENTOS SON LOS OBJETIVOS ESPECÍFICOS, y se pintan como
                          tales: colgando del general, uno por línea. Antes iban en una
                          sola línea gris separados por puntos, y no se leían como lo que
                          son —"mejorar la dorsiflexión de tobillo" vive dentro de
                          "Movilidad de tobillo"—, así que parecía que faltaban fichas. */}
                      {tipo === 'metrico' && (
                        movs.length > 0 ? (
                          <div style={{ marginTop: 5, borderLeft: '2px solid var(--gm)', paddingLeft: 9 }}>
                            {movs.map((m: string) => (
                              <div key={m} style={{ fontSize: 12, color: 'var(--gr)', padding: '1px 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--g)', flexShrink: 0 }} />
                                {o.metrica === 'fuerza' ? 'Fuerza' : 'Movilidad'} · {m}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                            Sin movimientos: no se le puede poner una meta a nadie.
                          </div>
                        )
                      )}
                      {(o.etiquetas || []).length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {(o.etiquetas || []).map((id: string) => (
                            <span key={id} className="pill pill-soft">{nombreEt(id)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="obj-card-f">
                      {/* Sin nadie que lo tenga abierto no se escribe nada: un guión suelto
                          no informa de más que el hueco vacío y ensucia el pie de veinte
                          tarjetas. El `flex:1` se queda para empujar los botones a la derecha. */}
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--gd)', whiteSpace: 'nowrap' }}
                        title={n > 0 ? `${n} pacientes lo tienen abierto` : undefined}>
                        {n > 0 ? `${n} abiertos` : ''}
                      </span>
                      <button className="et-b" title="Editar" onClick={() => abrirEditar(o)}><Ic name="editar" size={13} /></button>
                      <button className="et-b et-b-r" title="Borrar" onClick={() => eliminar(o)}><Ic name="papelera" size={13} /></button>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget && !guardando) setModal(false) }}>
          {/* Ancho: aquí se edita imagen, descripción, etiquetas y movimientos. En 420 px
              cada cosa caía en su propia línea y había que hacer scroll para ver si ya
              habías puesto algo. */}
          <div className="modal" style={{ width: 'min(860px, 94vw)' }}>
            <div className="modal-title">
              {form.id ? 'Editar objetivo' : 'Nuevo objetivo'}
              <button className="modal-close" onClick={() => setModal(false)}><Ic name="cerrar" size={15} /></button>
            </div>

            {/*
              CABECERA FIJA: imagen a la izquierda; nombre y descripción a la derecha.

              Es lo que tiene TODO objetivo, se llame como se llame su familia. Antes la
              familia iba arriba del todo y al cambiarla se movía el formulario entero, así
              que perdías de vista lo que ya habías escrito. Ahora arriba no se mueve nada y
              lo que baila queda debajo de la familia, que es donde se ha decidido.
            */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 4 }}>
              {/* UNA IMAGEN PARA EL OBJETIVO ENTERO, no una por movimiento. Los específicos
                  —dorsiflexión, inversión— comparten la del general: son el mismo gesto en
                  direcciones distintas y cuatro ilustraciones casi iguales aclararían poco. */}
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
                <div style={{ fontSize: 11, color: 'var(--grl)', marginTop: 5, lineHeight: 1.4 }}>
                  La comparten todos sus movimientos.
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0, maxWidth: 320 }}>
                <div className="field"><label>Nombre *</label>
                  <input className="input" value={form.nombre} autoFocus disabled={guardando}
                    onChange={e => setForm((p: any) => ({ ...p, nombre: e.target.value }))}
                    placeholder={form.tipo === 'metrico' ? 'ej. Fuerza de hombro' : 'ej. Aprender el puente de glúteo'} />
                  {form.tipo === 'metrico' && (
                    <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 3 }}>
                      Sin movimiento ni lado en el nombre: eso se elige al asignárselo a un paciente.
                    </div>
                  )}
                </div>

                {/* La descripción crece hasta el alto de la foto: al lado de una imagen de
                    260 px, tres renglones dejaban medio hueco en blanco. */}
                <div className="field" style={{ marginBottom: 0 }}><label>Descripción</label>
                  <textarea className="input" value={form.descripcion} disabled={guardando}
                    style={{ minHeight: 150, resize: 'vertical' }}
                    onChange={e => setForm((p: any) => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Qué se busca y cuándo se da por conseguido" />
                </div>
              </div>
            </div>

            {/* LA FAMILIA, y de aquí abajo cambia todo.
                La ZONA va aquí al lado y no arriba: son las dos etiquetas que clasifican el
                objetivo —de qué tipo es y de qué parte del cuerpo—, y son justo los dos
                filtros de la lista. Arriba solo queda lo que lo identifica: foto, nombre y
                descripción. */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap',
              borderTop: '1px solid var(--bd)', paddingTop: 12, marginTop: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 240, marginBottom: 0 }}>
                <label>Familia</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {FAMILIAS.map(f => (
                    <button key={f.id} className={`chip-sel ${form.tipo === f.id ? 'on' : ''}`} title={f.ayuda}
                      onClick={() => setForm((p: any) => ({ ...p, tipo: f.id }))}>{f.nombre}</button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 4 }}>
                  {FAMILIAS.find(f => f.id === form.tipo)?.ayuda}
                </div>
              </div>

              <div className="field" style={{ width: 240, marginBottom: 0 }}><label>Zona</label>
                <select className="input" value={form.articulacion_id} disabled={guardando}
                  onChange={e => setForm((p: any) => ({ ...p, articulacion_id: e.target.value }))}>
                  <option value="">— Sin zona concreta —</option>
                  {articulaciones.map((a: any) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
            </div>

            <div className="obj-form">
            {form.tipo === 'metrico' && (
              <>
                <div className="field"><label>Qué se mide</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[['fuerza', 'Fuerza'], ['movilidad', 'Movilidad']].map(([v, l]) => (
                      <button key={v} className={`chip-sel ${form.metrica === v ? 'on' : ''}`}
                        onClick={() => setForm((p: any) => ({ ...p, metrica: v }))}>{l}</button>
                    ))}
                  </div>
                </div>

              </>
            )}

            {/* LOS ESPECÍFICOS.
                "Movilidad de tobillo" es el general; dorsiflexión, eversión y compañía son
                lo concreto. Van dentro y no como fichas aparte: con 38 movimientos y dos
                métricas serían casi cien objetivos que mantener, y es de donde venimos.

                Salen en las TRES familias. Estaban capados a los métricos y ofreciendo solo
                etiquetas de movimiento, y por eso "Reeducación neuromuscular · pie" no se
                podía escribir: el pie no es un movimiento, pero es igual de específico. */}
            <div className="field ancho">
              <label>Específicos <span className="subt">· en qué se concreta este objetivo</span></label>
              <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 5 }}>
                {form.tipo === 'metrico'
                  ? 'Son las opciones que se ofrecen al ponerle una meta a un paciente, y las que puede fijar un ítem de test. Sin ninguno, el objetivo no se puede medir.'
                  : 'Cada uno se convierte en una parte del objetivo cuando se lo asignas a un paciente, y el objetivo se cierra cuando estén todas.'}
              </div>
              <SelectorEtiquetasCompacto etiquetas={etiquetas}
                seleccionadas={form.movimientos || []}
                onChange={(ids: string[]) => setForm((p: any) => ({ ...p, movimientos: ids }))} />
            </div>

            {form.tipo === 'fase' && (
              <>
                {/* El placeholder era "4" a secas y se leía como un valor puesto: el campo
                    parecía relleno estando vacío, y los criterios no salían porque no
                    sabían cuántas cajas pintar. */}
                <div className="field"><label>Cuántas fases</label>
                  <input className="input" type="number" min={2} max={8} value={form.fases}
                    onChange={e => setForm((p: any) => ({ ...p, fases: e.target.value }))} placeholder="ej. 4" />
                </div>
                {/* A ancho completo: con tres o más cajas dentro, en media rejilla no cabe. */}
                <div className="field ancho">
                  <label>Criterios de salida <span className="subt">· la fase la calculan los tests, no se pone a mano</span></label>
                  <div style={{ marginTop: 5 }}>
                    <EditorCriteriosFase fases={parseInt(form.fases) || 0} criterios={form.criterios_fase} tests={testsLib || []} etiquetas={etiquetas || []}
                      onCambia={(v: any[]) => setForm((p: any) => ({ ...p, criterios_fase: v }))} />
                  </div>
                </div>
              </>
            )}

            {/* Solo en fases y cualitativos. Los métricos se describen con su articulación
                y sus movimientos, que además tienen un papel: con ellos la app resuelve
                sola qué test mide cada meta. */}
            {/* Solo PATOLOGÍA. El músculo estaba aquí y no lo leía nadie: no proponía
                objetivos, no movía nada, solo salía como píldora. La zona ya dice dónde
                está el objetivo, así que repetir el músculo era pedir un dato de más. */}
            {form.tipo !== 'metrico' && (
              <div className="field ancho"><label>Patología</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxHeight: 132, overflowY: 'auto' }}>
                  {deCategoria('patologia')
                    .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre))
                    .map((e: any) => {
                      const sel = (form.etiquetas || []).includes(e.id)
                      return (
                        <button key={e.id} className={`chip-sel ${sel ? 'on' : ''}`}
                          onClick={() => setForm((p: any) => ({
                            ...p, etiquetas: sel
                              ? (p.etiquetas || []).filter((x: string) => x !== e.id)
                              : [...(p.etiquetas || []), e.id],
                          }))}>{e.nombre}</button>
                      )
                    })}
                </div>
                <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 4 }}>
                  Con la patología puesta, a un paciente al que le registres esa patología se le
                  podrán proponer estos objetivos sin buscarlos.
                </div>
              </div>
            )}

            <div className="field ancho">
              <label>Logros habituales <span className="subt">· las partes de este objetivo, se copian al paciente al asignárselo</span></label>
              <div style={{ marginTop: 5 }}>
                <EditorLogrosPlantilla logros={form.logros_plantilla}
                  onCambia={(v: string[]) => setForm((p: any) => ({ ...p, logros_plantilla: v }))} />
              </div>
            </div>

            {/* EL ENLACE CON LOS TESTS SE HACE DESDE EL TEST, Y SOLO DESDE AHÍ.
                Aquí había un "Test que lo abre" que era la segunda forma de decir lo mismo:
                el test podía colgar el objetivo de un ítem o de una banda, y el objetivo
                podía colgarse a sí mismo del test entero. Dos sitios para una decisión
                acaban contradiciéndose, y el que mira uno no ve lo que dice el otro.
                Ahora hay una sola vía: Biblioteca → Tests → el ítem o la banda. */}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-t btn-sm" onClick={() => setModal(false)} disabled={guardando}>Cancelar</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-p" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
