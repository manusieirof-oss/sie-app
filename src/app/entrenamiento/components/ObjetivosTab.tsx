'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { ordenAnatomico } from '@/lib/anatomia'
import { categoriaDe, zonasDe, casaZona, SIN_ZONA } from '@/lib/etiquetas'
import FiltroZonas from '@/components/FiltroZonas'
import BuscadorBiblioteca from '@/components/BuscadorBiblioteca'
import SelectorEtiquetasCompacto from '@/components/SelectorEtiquetasCompacto'
import { subirImagenObjetivo } from '@/lib/ejercicios'
import { criteriosBrutos, problemasDeCriterios, type CriterioFase } from '@/lib/fases'
import { especificosDeObjetivo } from '@/lib/objetivos'
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
                  {verTest && c.tipo !== 'logro' && (
                    <select className="input" style={{ width: 168, fontSize: 11, borderColor: distinto ? 'var(--g)' : undefined }} value={c.test_id}
                      onChange={e => set({ test_id: e.target.value, item: '' })}>
                      <option value="">— test —</option>
                      {tests.map((x: any) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                    </select>
                  )}

                  {/* Un criterio sobre el TOTAL no mira ningún ítem, así que el desplegable
                      sobra: enseñarlo apagado invitaría a rellenarlo para nada. */}
                  {/* La condición que se marca a mano no tiene test ni ítem: lo suyo es el
                      texto de lo que hay que conseguir. */}
                  {c.tipo === 'logro' ? (
                    <input className="input" style={{ flex: 1, minWidth: 220, fontSize: 11 }} value={c.descripcion || ''}
                      onChange={e => set({ descripcion: e.target.value })}
                      placeholder="ej. Sube y baja el escalón sin apoyo" />
                  ) : c.tipo !== 'total' ? (
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
                  {c.tipo !== 'logro' && <span style={{ fontSize: 10, color: 'var(--grl)' }}>se cumple si</span>}

                  {/* MEDIDA O CASILLA. No todas las progresiones tienen números: un
                      aprendizaje avanza por observaciones que se cumplen o no, y el ítem de
                      casilla del test es exactamente eso. */}
                  <select className="input" style={{ width: 146, fontSize: 11 }} value={c.tipo || 'medida'}
                    onChange={e => set({ tipo: e.target.value, ...(e.target.value === 'total' ? { item: '' } : {}) })}>
                    <option value="medida">el valor del ítem</option>
                    <option value="marcado">la casilla del ítem</option>
                    <option value="total">la puntuación del test</option>
                    <option value="logro">lo marco yo a mano</option>
                  </select>

                  {c.tipo === 'logro' ? null : (c.tipo || 'medida') === 'marcado' ? (
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

/**
 * Los ESPECÍFICOS en pestañas, como las lengüetas de una carpeta.
 *
 * Salían como una fila de pastillas y con seis o siete —rotación interna, externa, flexión,
 * extensión…— era una lista, no una estructura: no se veía que cada uno es una parte con
 * entidad propia. En pestañas, abres una y estás DENTRO de esa parte.
 *
 * Dentro va lo que hoy se puede decir de una parte sin inventarse nada: QUÉ TEST LA MIDE.
 * Se deduce buscando un ítem del test que se llame igual, que es la misma regla con la que
 * la app resuelve sola la medición al ponerle una meta a un paciente. Y cuando no la mide
 * ninguno, lo dice — que es el aviso que hoy no aparecía en ningún sitio y solo se
 * descubría con el paciente delante, al no poder ponerle la meta.
 *
 * NO CAMBIA NADA POR DEBAJO. Los específicos siguen siendo la misma lista de etiquetas en
 * `objetivos.movimientos`; lo único distinto es cómo se miran.
 */
function EspecificosEnPestanas({ ids, objetivoId, etiquetas, tests, onChange }: {
  ids: string[]
  /** Vacío en un objetivo que aún no se ha guardado: entonces no hay nada que colgar. */
  objetivoId?: string
  etiquetas: any[]
  tests: any[]
  onChange: (ids: string[]) => void
}) {
  const [activa, setActiva] = useState(0)
  const [anadiendo, setAnadiendo] = useState(false)

  const [texto, setTexto] = useState('')

  const norm = (x: string) => (x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

  // Etiquetas del árbol y textos escritos a mano, en la misma lista. Ver `especificosDeObjetivo`.
  const puestosObj = especificosDeObjetivo(etiquetas, ids)
  const puestos = puestosObj.map(e => e.valor)
  const nombreDe = (v: string) => puestosObj.find(e => e.valor === v)?.nombre || v
  const esEtiqueta = (v: string) => !!puestosObj.find(e => e.valor === v)?.etiquetaId

  const i = Math.min(activa, Math.max(0, puestos.length - 1))
  const actual = puestos[i]

  const anadirTexto = () => {
    const t = texto.trim()
    if (!t) return
    if (puestos.some(v => norm(nombreDe(v)) === norm(t))) { setTexto(''); return }
    onChange([...puestos, t])
    setTexto(''); setAnadiendo(false); setActiva(puestos.length)
  }

  /** Los tests que tienen un ítem que se llama como esta parte. Deducido, no guardado. */
  const miden = (id: string) => {
    const n = norm(nombreDe(id))
    if (!n) return [] as any[]
    return (tests || []).flatMap((t: any) => {
      const it = (t.items || []).find((x: any) => norm(x?.nombre) === n)
      return it ? [{ test: t, item: it }] : []
    })
  }

  /**
   * Dónde está colgado este objetivo: qué ítems y qué bandas lo abren, y si además dicen
   * que la parte que abren es ESTA.
   *
   * Es el enlace de verdad —`items[].objetivos` y `bandas[].objetivos`—, no la coincidencia
   * de nombres. El ítem que abre un objetivo puede llamarse de otra forma que el específico.
   */
  const abren = (valor: string) => (tests || []).flatMap((t: any) => {
    const filas: any[] = []
    const mira = (cont: any, donde: string) => {
      if (!((cont?.objetivos || []).includes(objetivoId))) return
      const mov = (cont?.objetivos_mov || {})[objetivoId as string] || null
      filas.push({ test: t, donde, esta: mov === valor, sinMov: !mov })
    }
    ;(t.items || []).forEach((it: any, i: number) => mira(it, `ítem «${it?.nombre || i + 1}»`))
    ;(t.bandas || []).forEach((b: any) => mira(b, `banda «${b?.etiqueta || '?'}»`))
    return filas
  })

  const quitar = (id: string) => { onChange(puestos.filter(x => x !== id)); setActiva(0) }

  return (
    <div>
      {/* Las lengüetas. La activa se pega al panel de abajo quitándose el borde inferior:
          es lo que hace que se lea como una carpeta y no como una fila de botones. */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-end', borderBottom: '1px solid var(--bd)', paddingBottom: 0 }}>
        {puestos.map((id, n) => {
          const on = n === i && !anadiendo
          return (
            <button key={id} type="button" onClick={() => { setActiva(n); setAnadiendo(false) }}
              style={{
                fontFamily: 'inherit', fontSize: 12, padding: '6px 12px', cursor: 'pointer',
                border: '1px solid var(--bd)', borderBottom: on ? '1px solid var(--w)' : '1px solid var(--bd)',
                borderRadius: '7px 7px 0 0', marginBottom: -1,
                background: on ? 'var(--w)' : 'var(--bl)',
                color: on ? 'var(--n)' : 'var(--gr)', fontWeight: on ? 500 : 400,
              }}>
              {nombreDe(id)}
            </button>
          )
        })}
        <button type="button" onClick={() => setAnadiendo(v => !v)}
          title="Añadir o quitar específicos"
          style={{
            fontFamily: 'inherit', fontSize: 12, padding: '6px 12px', cursor: 'pointer',
            border: '1px dashed var(--gm)', borderBottom: anadiendo ? '1px solid var(--w)' : '1px dashed var(--gm)',
            borderRadius: '7px 7px 0 0', marginBottom: -1,
            background: anadiendo ? 'var(--w)' : 'transparent', color: 'var(--g)',
          }}>
          {anadiendo ? 'Cerrar' : '+'}
        </button>
      </div>

      <div style={{ border: '1px solid var(--bd)', borderTop: 'none', borderRadius: '0 0 7px 7px', padding: 12, background: 'var(--w)' }}>
        {anadiendo ? (
          <>
            {/* A MANO, y lo primero: no todo lo que hace falta para lograr un objetivo está
                en el árbol de etiquetas, ni tiene por qué estarlo. */}
            <div style={{ marginBottom: 10 }}>
              <div className="et-mini" style={{ marginBottom: 5 }}>Escribir uno</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="input" style={{ flex: 1, fontSize: 12 }} value={texto}
                  placeholder="ej. Sube y baja del coche sin ayuda"
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); anadirTexto() } }} />
                <button type="button" className="btn btn-p btn-sm" disabled={!texto.trim()} onClick={anadirTexto}>
                  <Ic name="mas" size={11} /> Añadir
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 4 }}>
                Uno escrito a mano se cierra marcándolo: ningún test puede medirlo.
              </div>
            </div>
            <div className="et-mini" style={{ marginBottom: 5 }}>O elegir una etiqueta</div>
            <SelectorEtiquetasCompacto etiquetas={etiquetas}
              seleccionadas={puestos.filter(esEtiqueta)}
              onChange={(sel: string[]) => onChange([...puestos.filter(v => !esEtiqueta(v)), ...sel])} />
          </>
        ) : puestos.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--grl)' }}>
            Sin específicos. Pulsa <b>+</b> para añadir en qué se concreta este objetivo.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: 'var(--n)' }}>{nombreDe(actual)}</span>
              <span style={{ fontSize: 12, color: 'var(--grl)' }}>· parte {i + 1} de {puestos.length}</span>
              <button type="button" className="btn btn-d btn-sm" style={{ marginLeft: 'auto' }}
                onClick={() => quitar(actual)}>
                <Ic name="papelera" size={11} /> Quitar
              </button>
            </div>

            {/* DE DÓNDE SALE y CON QUÉ SE MIDE son dos cosas distintas, y juntarlas era el
                error: un test puede abrir este objetivo desde un ítem que se llame de otra
                forma —"dolor en la fascia plantar" abriendo "masajear · fascia del pie"— y
                aquí ponía "ningún test", que se lee como que el objetivo no sale de ningún
                sitio. Salir sale; lo que no hay es un ítem con ese nombre del que sacar un
                número. */}
            <div className="et-mini" style={{ marginBottom: 5 }}>De dónde sale</div>
            {(() => {
              const a = objetivoId ? abren(actual) : []
              const suyos = a.filter((x: any) => x.esta)
              const generales = a.filter((x: any) => x.sinMov)
              if (!objetivoId) {
                return <div style={{ fontSize: 12, color: 'var(--grl)' }}>Guarda el objetivo para ver qué tests lo abren.</div>
              }
              if (a.length === 0) {
                return (
                  <div style={{ fontSize: 12, color: '#8A6410', lineHeight: 1.5 }}>
                    <Ic name="alerta" size={11} /> Ningún test abre este objetivo. Se cuelga
                    desde el propio test, en su ítem o en su banda.
                  </div>
                )
              }
              return (
                <div style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
                  {suyos.map((x: any, k: number) => (
                    <div key={'s' + k} style={{ fontSize: 12, color: 'var(--gd)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Ic name="check" size={11} />
                      <span style={{ color: 'var(--n)' }}>{x.test.nombre}</span>
                      <span>· {x.donde}</span>
                      <span className="badge badge-g">abre esta parte</span>
                    </div>
                  ))}
                  {generales.map((x: any, k: number) => (
                    <div key={'g' + k} style={{ fontSize: 12, color: 'var(--gr)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Ic name="test" size={11} />
                      <span style={{ color: 'var(--n)' }}>{x.test.nombre}</span>
                      <span>· {x.donde}</span>
                      <span className="badge badge-b">abre el objetivo, sin decir qué parte</span>
                    </div>
                  ))}
                  {suyos.length === 0 && generales.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--gr)' }}>
                      Lo abren {a.length} sitio{a.length > 1 ? 's' : ''}, pero apuntando a otra parte.
                    </div>
                  )}
                </div>
              )
            })()}

            <div className="et-mini" style={{ marginBottom: 5 }}>Con qué se mide</div>
            {!esEtiqueta(actual) ? (
              <div style={{ fontSize: 12, color: 'var(--gr)', lineHeight: 1.5 }}>
                Escrita a mano, así que ningún test puede medirla: se cierra marcándola en la
                ficha del paciente.
              </div>
            ) : (() => {
              const m = miden(actual)
              if (m.length === 0) {
                return (
                  <div style={{ fontSize: 12, color: 'var(--gr)', lineHeight: 1.5 }}>
                    Ningún test tiene un ítem llamado «{nombreDe(actual)}», así que esta parte
                    se cierra marcándola. Para ponerle un número, el ítem que la mide tiene que
                    llamarse igual.
                  </div>
                )
              }
              return (
                <div style={{ display: 'grid', gap: 4 }}>
                  {m.map((x: any) => (
                    <div key={x.test.id} style={{ fontSize: 12, color: 'var(--gr)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Ic name="test" size={11} />
                      <span style={{ color: 'var(--n)' }}>{x.test.nombre}</span>
                      <span>· ítem «{x.item.nombre}»</span>
                      {x.item.unidad && <span className="badge badge-b">{x.item.unidad}</span>}
                    </div>
                  ))}
                </div>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}

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

export default function ObjetivosTab({ objetivos, testsLib, etiquetas = [], cargar }: any) {
  const [zona, setZona] = useState<string>('')
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState<any>({ id:'', nombre:'', descripcion:'', articulacion_id:'', fases:'', criterios_fase:[] as any[], logros_plantilla:[] as string[], etiquetas:[] as string[], movimientos:[] as string[], imagen_url:'', imagen_file:null as File|null })
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

  /** Las etiquetas de zona de un objetivo: su articulación y las que lleve entre las
   *  libres. Sin resolver a raíz — de eso ya se encarga `FiltroZonas` y `casaZona`. */
  const zonaIdsDe = (o: any) => [o?.articulacion_id, ...(o?.etiquetas || [])].filter(Boolean) as string[]

  /**
   * Las etiquetas de articulación que los objetivos usan de verdad.
   *
   * SOLO ARTICULACIONES. Antes entraban también las `etiquetas` libres —que son
   * patologías— y la fila salía con decenas de pastillas donde la mitad no eran zonas.
   */
  const zonasUsadas = useMemo(() => {
    const ids = Array.from(new Set((objetivos || []).flatMap(zonaIdsDe))) as string[]
    return ids.filter(id => {
      const et = etiquetas.find((e: any) => e.id === id)
      return !!et && categoriaDe(etiquetas, et) === 'articulacion'
    })
  }, [objetivos, etiquetas])

  /** Los que no tienen ninguna zona. Sin este cajón no habría forma de dar con ellos. */
  const sinZona = (objetivos || []).filter((o: any) => zonasDe(etiquetas, zonaIdsDe(o)).length === 0).length

  const filtrados = (objetivos || []).filter((o: any) => {
    return casaZona(etiquetas, zonaIdsDe(o), zona)
  })


  function abrirNuevo() {
    setForm({ id:'', nombre:'', descripcion:'', articulacion_id:'', fases:'', criterios_fase:[], logros_plantilla:[], etiquetas:[], movimientos:[], imagen_url:'', imagen_file:null })
    setModal(true)
  }
  function abrirEditar(o: any) {
    setForm({
      id:o.id, nombre:o.nombre||'', descripcion:o.descripcion||'',
      articulacion_id:o.articulacion_id||'', fases:o.fases||'', criterios_fase:o.criterios_fase||[],
      logros_plantilla:o.logros_plantilla||[], etiquetas:o.etiquetas||[],
      movimientos:o.movimientos||[], imagen_url:o.imagen_url||'', imagen_file:null,
    })
    setModal(true)
  }

  async function guardar() {
    if (!form.nombre) { alert('El nombre es obligatorio'); return }
    // Los criterios de fase deciden solos en qué punto está un paciente, así que un
    // criterio a medio escribir no puede guardarse: fallaría callado, dejando a alguien
    // clavado en una fase por un umbral que nadie rellenó.
    if ((parseInt(form.fases) || 0) > 0) {
      const p = problemasDeCriterios({ criterios_fase: form.criterios_fase, fases: parseInt(form.fases) || 0 }, testsLib || [])
      if (p.length > 0) { alert('El objetivo no se ha guardado:\n\n' + p.map(x => '· ' + x).join('\n')); return }
    }
    setGuardando(true)
    const payload: any = {
      nombre: form.nombre, descripcion: form.descripcion,
      // `test_id` ya no se escribe desde aquí: el enlace con los tests vive en el test, en
      // su ítem o en su banda. No se manda a null a propósito — borrar de golpe lo que
      // hubiera configurado de antes sería tirar datos que nadie ha pedido tirar.
      // YA NO HAY FAMILIAS. `tipo` y `metrica` no se escriben: lo que el objetivo es se
      // deduce de lo que tiene —si tiene fases, progresa por fases; si le pones una meta
      // con número, se mide—. Tampoco se ponen a null: la columna se queda con lo que
      // tuviera hasta que se tire, y vaciarla al guardar sería destruir datos de paso.
      //
      // Sin fases: `fases` a null y los criterios vacíos. Eso SÍ hay que limpiarlo, porque
      // un objetivo con criterios y sin fases sería un objetivo que la app intenta juzgar
      // contra fases que no existen.
      fases: (parseInt(form.fases) || null),
      criterios_fase: (parseInt(form.fases) || 0) > 0 ? (form.criterios_fase || []) : [],
      // Se limpian los vacíos, que solo son filas que alguien empezó y no escribió.
      logros_plantilla: (form.logros_plantilla || []).map((x: string) => String(x || '').trim()).filter(Boolean),
      articulacion_id: form.articulacion_id || null,
      etiquetas: form.etiquetas || [],
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
            {(objetivos || []).length} en total
          </span>
        </div>

        <div style={{ marginBottom: 12 }}>
          <FiltroZonas etiquetas={etiquetas} usadas={zonasUsadas}
            valor={zona} onChange={setZona} nSinZona={sinZona} todas="Todas las zonas" />
        </div>

        {filtrados.length === 0 ? (
          <div className="muted">
            {(objetivos || []).length === 0 ? 'Sin objetivos todavía.' : 'Ninguno coincide.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(232px,1fr))', gap: 12 }}>
            {filtrados
              .map((o: any) => {
                const movs = especificosDeObjetivo(etiquetas, o.movimientos).map(e => e.nombre)
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
                        {Number(o.fases) > 0 && <span className="pill pill-soft">{o.fases} fases</span>}
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
                      {/* Los específicos salen en TODOS los objetivos: son sus partes, y da
                          igual cómo se cierre cada una. */}
                      {movs.length > 0 && (
                        <div style={{ marginTop: 5, borderLeft: '2px solid var(--gm)', paddingLeft: 9 }}>
                          {movs.map((m: string) => (
                            <div key={m} style={{ fontSize: 12, color: 'var(--gr)', padding: '1px 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--g)', flexShrink: 0 }} />
                              {m}
                            </div>
                          ))}
                        </div>
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
                tests={testsLib || []}
                onChange={(ids: string[]) => setForm((p: any) => ({ ...p, movimientos: ids }))} />
            </div>

            {/* LAS FASES YA NO DEPENDEN DE NINGUNA FAMILIA: vacío = no tiene fases. */}
            <div className="field"><label>Cuántas fases <span className="subt">· vacío si no va por fases</span></label>
              <input className="input" type="number" min={2} max={8} value={form.fases}
                onChange={e => setForm((p: any) => ({ ...p, fases: e.target.value }))} placeholder="ej. 4" />
            </div>
            {(parseInt(form.fases) || 0) > 0 && (
              /* A ancho completo: con tres o más cajas dentro, en media rejilla no cabe. */
              <div className="field ancho">
                <label>Condiciones de salida <span className="subt">· qué hay que cumplir para pasar a la siguiente</span></label>
                <div style={{ marginTop: 5 }}>
                  <EditorCriteriosFase fases={parseInt(form.fases) || 0} criterios={form.criterios_fase} tests={testsLib || []} etiquetas={etiquetas || []}
                    onCambia={(v: any[]) => setForm((p: any) => ({ ...p, criterios_fase: v }))} />
                </div>
              </div>
            )}

            {/* Solo en fases y cualitativos. Los métricos se describen con su articulación
                y sus movimientos, que además tienen un papel: con ellos la app resuelve
                sola qué test mide cada meta. */}
            {/* Solo PATOLOGÍA. El músculo estaba aquí y no lo leía nadie: no proponía
                objetivos, no movía nada, solo salía como píldora. La zona ya dice dónde
                está el objetivo, así que repetir el músculo era pedir un dato de más. */}
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
