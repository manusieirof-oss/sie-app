'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import BuscadorBiblioteca from '@/components/BuscadorBiblioteca'
import SelectorEtiquetasCompacto from '@/components/SelectorEtiquetasCompacto'
import { especificosDeObjetivo } from '@/lib/objetivos'
import { bandasDe } from '@/lib/tests'

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
export default function EspecificosEnPestanas({ ids, objetivoId, etiquetas, tests, onChange, onEvaluar, evaluacion }: {
  ids: string[]
  /** Vacío en un objetivo que aún no se ha guardado: entonces no hay nada que colgar. */
  objetivoId?: string
  etiquetas: any[]
  tests: any[]
  onChange: (ids: string[]) => void
  /** Colgar un test a ESTA parte —o al objetivo entero, con null—. Sin esto, no sale el botón. */
  onEvaluar?: (especifico: string | null) => void
  /** Lo que ya tiene colgado, pintado por quien lo guarda. null = el objetivo entero. */
  evaluacion?: (especifico: string | null) => any
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
          /* SIN ESPECÍFICOS el panel no se queda en blanco: lo que se mide es el objetivo
             entero, así que aquí va lo mismo que en una parte, sin la parte. */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--grl)' }}>
                Sin específicos. Pulsa <b>+</b> para añadir en qué se concreta este objetivo.
              </span>
              {onEvaluar && (
                <button type="button" className="btn btn-s btn-sm" style={{ marginLeft: 'auto', flexShrink: 0 }}
                  onClick={() => onEvaluar(null)}>
                  <Ic name="mas" size={11} /> Evaluar
                </button>
              )}
            </div>
            {evaluacion && (
              <div style={{ borderTop: '1px solid var(--bd2)', paddingTop: 9 }}>
                {evaluacion(null)}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {/* Ni el nombre ni "parte 1 de 3": la lengueta de arriba ya dice en cual
                  estas y cuantas hay. Aqui solo lo que se puede hacer. */}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {/* EVALUAR, aquí y no en una lista aparte: se cuelga el test estando
                    dentro de la parte que mide, así no hay que decir de cuál es. */}
                {onEvaluar && (
                  <button type="button" className="btn btn-s btn-sm" onClick={() => onEvaluar(actual)}>
                    <Ic name="mas" size={11} /> Evaluar
                  </button>
                )}
                <button type="button" className="btn btn-d btn-sm" onClick={() => quitar(actual)}>
                  <Ic name="papelera" size={11} /> Quitar
                </button>
              </div>
            </div>

            {/* DE DÓNDE SALE y CON QUÉ SE MIDE son dos cosas distintas, y juntarlas era el
                error: un test puede abrir este objetivo desde un ítem que se llame de otra
                forma —"dolor en la fascia plantar" abriendo "masajear · fascia del pie"— y
                aquí ponía "ningún test", que se lee como que el objetivo no sale de ningún
                sitio. Salir sale; lo que no hay es un ítem con ese nombre del que sacar un
                número. */}
            {/* El rotulo va DENTRO: sin nada que contar no hay nada que rotular. */}
            {/* Aquí salía "De dónde sale": los ítems y bandas de test que abrían este
                objetivo. Ya no abren nada; lo abre y lo cierra lo de "Cómo se evalúa". */}
            {/* CON QUÉ SE COMPRUEBA. Lo de arriba es deducido —un test con un ítem que se
                llama igual—; esto es lo que alguien ha colgado a mano, y es lo que arma
                las evaluaciones. */}
            {evaluacion && (
              <div style={{ borderTop: '1px solid var(--bd2)', marginTop: 11, paddingTop: 9 }}>
                {evaluacion(actual)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

