'use client'
import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { UNIDADES, unidadDe, mide, textoRegla, problemasDelTest, alcanceBorradoTest, borrarTest, esSuma, esBaremo, bandasDe, baremosDe, rangoTotal, textoNorma } from '@/lib/tests'
import ExploradorTests from '@/components/ExploradorTests'
import SelectorEtiquetasCompacto from '@/components/SelectorEtiquetasCompacto'
import { ordenAnatomico } from '@/lib/anatomia'
import { categoriaDe, raizDe, zonasDe, casaZona } from '@/lib/etiquetas'
import FiltroZonas from '@/components/FiltroZonas'

const CATEGORIAS = [
  { key: 'musculo', label: 'Músculo' },
  { key: 'articulacion', label: 'Articulación' },
  { key: 'movimiento', label: 'Movimiento' },
  { key: 'posicion', label: 'Posición' },
  { key: 'material', label: 'Material' },
  { key: 'apoyo', label: 'Apoyo' },
  { key: 'agarre', label: 'Agarre' },
  { key: 'patologia', label: 'Patología' },
  { key: 'plano_eje', label: 'Plano y eje' },
]

/**
 * La BARRA de un ítem medido: de dónde a dónde va y qué valor es un hallazgo.
 *
 * Sin esto, un ítem con unidad se rellenaba marcando una casilla y escribiendo el número
 * al lado, o sea que el veredicto lo ponías tú cada vez. Con la regla puesta, el positivo
 * lo decide el propio valor y siempre igual.
 *
 * Va en un componente y no copiado en los dos formularios —crear y editar— porque son el
 * mismo formulario dos veces y ya se nota: el de editar arrastra diferencias del de crear.
 */
function ConfigBarra({ item, onCambia, soloRango = false }: { item: any, onCambia: (campos: any) => void, soloRango?: boolean }) {
  if (!mide(item)) return null
  const u = unidadDe(item).simbolo.trim()
  const dosUmbrales = item.regla === 'entre' || item.regla === 'fuera'
  const num = (v: string) => v === '' ? undefined : Number(v)

  /* En un test de puntuación el ítem no decide nada por su cuenta: solo aporta su número
     al total. Enseñar aquí "Positivo si es..." invitaría a poner una regla que después se
     ignora, que es la clase de campo que hace desconfiar de toda la pantalla. */
  if (soloRango) {
    return (
      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--bd)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--grl)' }}>Puntúa de</span>
        <input className="input" type="number" style={{ width: 66, fontSize: 11 }} value={item.min ?? ''}
          onChange={e => onCambia({ min: num(e.target.value) })} placeholder="mín" />
        <span style={{ fontSize: 10, color: 'var(--grl)' }}>a</span>
        <input className="input" type="number" style={{ width: 66, fontSize: 11 }} value={item.max ?? ''}
          onChange={e => onCambia({ max: num(e.target.value) })} placeholder="máx" />
        <span style={{ fontSize: 10, color: 'var(--grl)' }}>{u}</span>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--bd)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--grl)' }}>Positivo si es</span>
        <select className="input" style={{ width: 128, fontSize: 11 }} value={item.regla || ''}
          onChange={e => onCambia({ regla: e.target.value || undefined })}>
          <option value="">— sin barra —</option>
          <option value="menor">menor que</option>
          <option value="mayor">mayor que</option>
          <option value="entre">está entre</option>
          <option value="fuera">está fuera de</option>
        </select>
        {item.regla && (
          <>
            <input className="input" type="number" style={{ width: 74, fontSize: 11 }} value={item.umbral ?? ''}
              onChange={e => onCambia({ umbral: num(e.target.value) })} placeholder="valor" />
            {dosUmbrales && (
              <>
                <span style={{ fontSize: 10, color: 'var(--grl)' }}>y</span>
                <input className="input" type="number" style={{ width: 74, fontSize: 11 }} value={item.umbral2 ?? ''}
                  onChange={e => onCambia({ umbral2: num(e.target.value) })} placeholder="valor" />
              </>
            )}
            <span style={{ fontSize: 10, color: 'var(--grl)' }}>{u}</span>
            <span style={{ fontSize: 10, color: 'var(--grl)', marginLeft: 8 }}>Barra de</span>
            {/* El mínimo admite negativos: hay medidas que los tienen. */}
            <input className="input" type="number" style={{ width: 66, fontSize: 11 }} value={item.min ?? ''}
              onChange={e => onCambia({ min: num(e.target.value) })} placeholder="mín" />
            <span style={{ fontSize: 10, color: 'var(--grl)' }}>a</span>
            <input className="input" type="number" style={{ width: 66, fontSize: 11 }} value={item.max ?? ''}
              onChange={e => onCambia({ max: num(e.target.value) })} placeholder="máx" />
          </>
        )}
      </div>
      {item.regla && (
        <div style={{ fontSize: 10, color: 'var(--gd)', marginTop: 4 }}>
          {textoRegla(item) || 'Rellena el valor para ver la regla'}
        </div>
      )}
    </div>
  )
}

/**
 * Las BANDAS de un test de puntuación: en qué se convierte el total.
 *
 * Un FPI-6 que suma 9 no es "positivo" a secas, es un pie pronado, y esa palabra es la que
 * se lee luego en el historial. Cada banda dice además si caer ahí cuenta como hallazgo,
 * que es lo que se traduce al positivo/negativo con el que trabaja el resto de la app: sin
 * eso habría que decidirlo a mano en cada resultado, y se decidiría distinto cada vez.
 *
 * Se leen por TECHO, no por orden de escritura: el total cae en la primera banda cuyo
 * techo alcanza. Así se pueden añadir en cualquier orden sin que cambie el significado.
 */
function EditorBandas({ bandas, items, onCambia, porRecuento = false, objetivos = [], etiquetas = [] }: { bandas: any, items: any[], onCambia: (b: any[]) => void, porRecuento?: boolean, objetivos?: any[], etiquetas?: any[] }) {
  const lista: any[] = Array.isArray(bandas) ? bandas : []
  // En un baremo el número que cae en la banda no es la suma de los ítems: es cuántos de
  // ellos quedan por debajo de su norma, o sea de 0 a todos.
  const rango = porRecuento ? { min: 0, max: (items || []).length } : rangoTotal(items)
  const queEs = porRecuento ? 'Pruebas por debajo de la norma' : 'El total'
  const ordenadas = bandasDe({ bandas: lista })
  const set = (i: number, campos: any) => { const b = [...lista]; b[i] = { ...b[i], ...campos }; onCambia(b) }

  return (
    <div className="field">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ margin: 0 }}>{porRecuento ? 'Bandas del recuento' : 'Bandas del total'}</label>
        <span style={{ fontSize: 10, color: 'var(--grl)' }}>
          {rango ? `${queEs} va de ${rango.min} a ${rango.max}` : 'Pon mín y máx en los ítems para saber el rango'}
        </span>
      </div>

      {lista.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 6 }}>
          Sin bandas el número es un dato suelto: el test no podría dar ni positivo ni negativo.
        </div>
      )}

      {lista.map((b: any, i: number) => (
        <div key={i} style={{ marginBottom: 5, background: 'var(--bl)', borderRadius: 5, padding: '6px 8px', border: '1px solid var(--bd)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 10, color: 'var(--grl)', whiteSpace: 'nowrap' }}>Hasta</span>
          <input className="input" type="number" style={{ width: 74, fontSize: 11 }} value={b?.hasta ?? ''}
            onChange={e => set(i, { hasta: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="techo" />
          <input className="input" style={{ flex: 1, fontSize: 11 }} value={b?.etiqueta || ''}
            onChange={e => set(i, { etiqueta: e.target.value })} placeholder="ej. Normal" />
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: b?.hallazgo ? 'var(--red)' : 'var(--grl)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={!!b?.hallazgo} onChange={e => set(i, { hallazgo: e.target.checked })}
              style={{ width: 15, height: 15, accentColor: 'var(--red)', cursor: 'pointer' }} />
            Hallazgo
          </label>
          <button onClick={() => onCambia(lista.filter((_, j) => j !== i))}
            style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>

          {/* LOS OBJETIVOS SE CUELGAN DE LA BANDA.
              Es lo que el ítem es en un test de casillas: el sitio concreto que dice qué
              trabajo abre este resultado. Un FPI-6 positivo no dice qué hacer —supinado y
              pronado piden lo contrario—; la banda sí. Y una misma banda puede abrir varios,
              cada uno con su específico. */}
          {b?.hallazgo && (
            <PildorasObjetivos seleccionados={b.objetivos || []} objetivos={objetivos} etiquetas={etiquetas}
              movimientos={b.objetivos_mov || {}}
              onMovimiento={(oid: string, mid: string) => {
                const mapa = { ...(b.objetivos_mov || {}) }
                if (mid) mapa[oid] = mid; else delete mapa[oid]
                set(i, { objetivos_mov: mapa })
              }}
              onToggle={(oid: string) => {
                const act = b.objetivos || []
                set(i, { objetivos: act.includes(oid) ? act.filter((x: string) => x !== oid) : [...act, oid] })
              }} />
          )}
        </div>
      ))}

      <button className="btn btn-t btn-sm" onClick={() => onCambia([...lista, { hasta: undefined, etiqueta: '', hallazgo: false, objetivos: [], objetivos_mov: {} }])}>
        + Añadir banda
      </button>

      {/* Cómo queda leído de verdad, ordenado por techo. Escribir "hasta 5" debajo de
          "hasta 9" no cambia nada, y verlo evita tener que fiarse de eso. */}
      {ordenadas.length > 0 && (
        <div style={{ marginTop: 7, fontSize: 10, color: 'var(--gr)', lineHeight: 1.7 }}>
          {ordenadas.map((b, i) => {
            const desde = i === 0 ? (rango ? rango.min : '−∞') : ordenadas[i - 1].hasta + 1
            return (
              <div key={i}>
                <span style={{ color: b.hallazgo ? 'var(--red)' : 'var(--gd)' }}>
                  {desde} a {b.hasta}
                </span>
                {' · '}{b.etiqueta || <span style={{ color: 'var(--grl)' }}>sin nombre</span>}
                {' · '}{b.hallazgo ? '+ positivo' : '− negativo'}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * La ZONA del test: la articulación por la que se encuentra en la biblioteca.
 *
 * Antes esto era un selector de etiquetas completo, con las nueve categorías. El problema
 * no era que sobrara sitio: era que de todo lo que se pusiera ahí, LO ÚNICO que leía
 * alguien eran las de articulación. Un test etiquetado con "supraespinoso" o "decúbito
 * supino" guardaba ese dato y no lo miraba nadie, ni el filtro, ni el buscador, ni las
 * metas. Un campo que parece que clasifica y no clasifica hace desconfiar de la pantalla
 * entera.
 *
 * Las etiquetas que ya estuvieran puestas y no sean de articulación NO se borran: este
 * campo no las gestiona, pero tirarlas al guardar sería destruir datos que quien guarda ni
 * siquiera está viendo. Se avisa de que están y se ofrece quitarlas a mano.
 */
function SelectorZona({ etiquetas = [], seleccionadas = [], onChange }: {
  etiquetas: any[]
  seleccionadas: string[]
  onChange: (ids: string[]) => void
}) {
  const puestas = seleccionadas || []
  const esArticulacion = (id: string) => {
    const et = etiquetas.find((e: any) => e.id === id)
    return !!et && categoriaDe(etiquetas, et) === 'articulacion'
  }
  const ajenas = puestas.filter(id => !esArticulacion(id))
  const articulares = puestas.filter(esArticulacion)
  const zonasPuestas = zonasDe(etiquetas, articulares)

  const raices = etiquetas
    .filter((e: any) => !e.padre_id && categoriaDe(etiquetas, e) === 'articulacion')
    .sort((a: any, b: any) => ordenAnatomico(a.nombre, b.nombre))

  /**
   * Se alterna por RAÍZ, pero se respeta el nivel al que se etiquetó.
   *
   * Si el test estaba puesto en una subzona, quitar la zona se lleva esa subetiqueta, y
   * dejarla puesta no la sustituye por la raíz: reescribir a la raíz perdería el detalle
   * sin que nadie lo hubiera pedido.
   */
  const alternar = (raizId: string) => {
    const suyas = articulares.filter(id => {
      const et = etiquetas.find((e: any) => e.id === id)
      return raizDe(etiquetas, et)?.id === raizId
    })
    const nuevas = suyas.length > 0
      ? articulares.filter(id => !suyas.includes(id))
      : [...articulares, raizId]
    onChange([...ajenas, ...nuevas])
  }

  const nombreEt = (id: string) => etiquetas.find((e: any) => e.id === id)?.nombre || id

  return (
    <div>
      {raices.length === 0
        ? <div style={{ fontSize: 11, color: 'var(--grl)' }}>No hay etiquetas de articulación en la biblioteca.</div>
        : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {raices.map((z: any) => {
              const on = zonasPuestas.some((p: any) => p.id === z.id)
              return (
                <button key={z.id} type="button" className={`chip-sel ${on ? 'on' : ''}`} onClick={() => alternar(z.id)}>
                  {z.nombre}
                </button>
              )
            })}
          </div>
        )}

      {/* Las subzonas concretas, cuando el test está etiquetado por debajo de la raíz. Se
          enseñan para que se vea por qué está encendida una zona que no se pulsó. */}
      {articulares.some(id => !raices.some((r: any) => r.id === id)) && (
        <div style={{ fontSize: 10, color: 'var(--gr)', marginTop: 5 }}>
          Etiquetado en: {articulares.filter(id => !raices.some((r: any) => r.id === id)).map(nombreEt).join(', ')}
        </div>
      )}

      {ajenas.length > 0 && (
        <div style={{ marginTop: 6, padding: '7px 9px', borderRadius: 6, background: 'var(--ambl)', border: '1px solid #E0C068' }}>
          <div style={{ fontSize: 10, color: '#8A6410', lineHeight: 1.5 }}>
            Este test arrastra {ajenas.length} etiqueta{ajenas.length === 1 ? '' : 's'} que no son de articulación
            ({ajenas.map(nombreEt).join(', ')}). No las lee nadie: no filtran, no buscan y no abren nada.
          </div>
          <button type="button" className="btn btn-t btn-sm" style={{ marginTop: 4 }}
            onClick={() => onChange(articulares)}>
            Quitarlas
          </button>
        </div>
      )}
    </div>
  )
}

const SEXOS_BAREMO = [['', 'Cualquiera'], ['hombre', 'Hombre'], ['mujer', 'Mujer']] as const

/**
 * Los BAREMOS de un test: contra qué se compara cada ítem.
 *
 * Una condición por fila —ítem, sexo, tramo de edad y el intervalo que se considera
 * normal—. El sexo y la edad no se piden al pasar el test: ya están en la ficha del
 * paciente, y volver a preguntarlos con él delante sería repetir un trabajo hecho y abrir
 * la puerta a que un día se conteste distinto.
 *
 * El intervalo tiene mínimo y máximo POR SEPARADO, y los dos son opcionales: hay pruebas
 * donde más es mejor —repeticiones en 30 segundos, normal a partir de 14— y otras donde
 * menos lo es —levantarse y andar 2,4 m, normal hasta 5,6 segundos—. Obligar a rellenar
 * los dos haría inventarse el extremo que no existe.
 *
 * Se empareja por NOMBRE del ítem y no por su posición, para que reordenarlos no mueva la
 * tabla debajo. El precio es que renombrar un ítem deja su baremo huérfano, y por eso la
 * validación lo mira.
 */
function EditorBaremos({ baremos, items, onCambia }: { baremos: any, items: any[], onCambia: (b: any[]) => void }) {
  const lista: any[] = Array.isArray(baremos) ? baremos : []
  const nombres = (items || []).map((it: any, i: number) => String(it?.nombre || '').trim() || `ítem ${i + 1}`)
  const num = (v: string) => v === '' ? undefined : Number(v)
  const set = (i: number, campos: any) => { const b = [...lista]; b[i] = { ...b[i], ...campos }; onCambia(b) }

  return (
    <div className="field">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ margin: 0 }}>Baremos · contra qué se compara cada ítem</label>
        <span style={{ fontSize: 10, color: 'var(--grl)' }}>{lista.length} condicion{lista.length === 1 ? '' : 'es'}</span>
      </div>

      {nombres.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 6 }}>Añade primero los ítems: cada condición se cuelga de uno.</div>
      )}

      {lista.map((b: any, i: number) => {
        const huerfana = b?.item && !nombres.includes(String(b.item))
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 5, background: huerfana ? 'var(--ambl)' : 'var(--bl)', borderRadius: 5, padding: '6px 8px', border: `1px solid ${huerfana ? '#E0C068' : 'var(--bd)'}` }}>
            <select className="input" style={{ width: 170, fontSize: 11 }} value={b?.item || ''}
              onChange={e => set(i, { item: e.target.value })}>
              <option value="">— ítem —</option>
              {nombres.map(n => <option key={n} value={n}>{n}</option>)}
              {huerfana && <option value={b.item}>{b.item} (ya no existe)</option>}
            </select>

            <select className="input" style={{ width: 104, fontSize: 11 }} value={b?.sexo || ''}
              onChange={e => set(i, { sexo: e.target.value || undefined })}>
              {SEXOS_BAREMO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            <span style={{ fontSize: 10, color: 'var(--grl)' }}>Edad</span>
            <input className="input" type="number" style={{ width: 58, fontSize: 11 }} value={b?.edad_min ?? ''}
              onChange={e => set(i, { edad_min: num(e.target.value) })} placeholder="desde" />
            <span style={{ fontSize: 10, color: 'var(--grl)' }}>a</span>
            <input className="input" type="number" style={{ width: 58, fontSize: 11 }} value={b?.edad_max ?? ''}
              onChange={e => set(i, { edad_max: num(e.target.value) })} placeholder="hasta" />

            <span style={{ fontSize: 10, color: 'var(--gd)', marginLeft: 6 }}>Normal de</span>
            <input className="input" type="number" style={{ width: 70, fontSize: 11 }} value={b?.min ?? ''}
              onChange={e => set(i, { min: num(e.target.value) })} placeholder="mín" />
            <span style={{ fontSize: 10, color: 'var(--gd)' }}>a</span>
            <input className="input" type="number" style={{ width: 70, fontSize: 11 }} value={b?.max ?? ''}
              onChange={e => set(i, { max: num(e.target.value) })} placeholder="máx" />

            {/* DUPLICAR. Una tabla normativa son la misma prueba repetida por tramos de
                edad: sin esto hay que volver a elegir ítem y sexo ochenta veces. */}
            <button onClick={() => { const b2 = [...lista]; b2.splice(i + 1, 0, { ...lista[i] }); onCambia(b2) }}
              title="Duplicar esta condición"
              style={{ fontSize: 10, color: 'var(--gd)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Duplicar
            </button>
            <button onClick={() => onCambia(lista.filter((_, j) => j !== i))}
              style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        )
      })}

      <button className="btn btn-t btn-sm" disabled={nombres.length === 0}
        onClick={() => onCambia([...lista, { item: nombres[0] || '', sexo: '', edad_min: undefined, edad_max: undefined, min: undefined, max: undefined }])}>
        + Añadir condición
      </button>

      {/* COBERTURA. Un ítem sin ninguna condición no se puede interpretar, y con veinte
          filas por medio eso no se ve mirando la lista. */}
      {nombres.length > 0 && (
        <div style={{ marginTop: 7, fontSize: 10, color: 'var(--gr)', lineHeight: 1.7 }}>
          {nombres.map(n => {
            const cuantas = lista.filter((b: any) => String(b?.item || '') === n).length
            return (
              <div key={n} style={{ color: cuantas === 0 ? 'var(--red)' : 'var(--gr)' }}>
                {n} · {cuantas === 0 ? 'sin baremo' : `${cuantas} condicion${cuantas === 1 ? '' : 'es'}`}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const FAMILIAS_OBJ = [
  { id: 'metrico', nombre: 'Medibles' },
  { id: 'fase', nombre: 'Por fases' },
  { id: 'cualitativo', nombre: 'Cualitativos' },
] as const

/**
 * Los objetivos que abre un ítem.
 *
 * Antes se pintaban LOS 22 debajo de cada ítem. Con cuatro ítems eran ochenta y ocho
 * píldoras de 8 px, y para saber cuáles estaban puestas había que leerlas todas buscando
 * las de color.
 *
 * Ahora se ven solo los puestos, y el buscador se abre con los mismos tres filtros que la
 * biblioteca de objetivos —familia, zona y texto—. Es a propósito: si allí se busca así,
 * aquí buscar de otra manera obliga a aprender dos sistemas para lo mismo.
 *
 * NO se sale del formulario. Llevarte a la pestaña de objetivos habría sido más cómodo de
 * programar, pero el test que estás editando vive solo en pantalla hasta que guardas: irse
 * a otro sitio se lleva por delante el nombre, la descripción y los ítems escritos.
 */
function PildorasObjetivos({ seleccionados, objetivos, etiquetas = [], onToggle, movimientos = {}, onMovimiento }: any) {
  const [abierto, setAbierto] = useState(false)
  const [busca, setBusca] = useState('')
  const [familia, setFamilia] = useState('')
  const [zona, setZona] = useState('')

  const sel = seleccionados || []
  const nombreEt = (id: string) => (etiquetas || []).find((e: any) => e.id === id)?.nombre || ''

  /** Las zonas que de verdad se usan, de la cabeza a los pies. Igual que en la biblioteca. */
  /** Las etiquetas de zona de un objetivo, sin resolver a raíz: `FiltroZonas` y
   *  `casaZona` se encargan de agrupar y de emparejar. */
  const zonaIdsDe = (o: any) => [o?.articulacion_id, ...(o?.etiquetas || [])].filter(Boolean) as string[]

  const zonasUsadas = useMemo(() => {
    const ids = Array.from(new Set((objetivos || []).flatMap(zonaIdsDe))) as string[]
    return ids.filter(id => zonasDe(etiquetas || [], [id]).length > 0)
  }, [objetivos, etiquetas])

  // Un objetivo etiquetado solo con una patología no tiene articulación y desaparecería en
  // cuanto se filtre. Su propio chip, igual que en los tests.
  const sinZona = (objetivos || []).filter((o: any) => zonasDe(etiquetas || [], zonaIdsDe(o)).length === 0)

  if (!objetivos || objetivos.length===0) return null

  const puestos = objetivos.filter((o:any)=>sel.includes(o.id))
  const q = busca.toLowerCase().trim()
  const resto = objetivos.filter((o:any)=>{
    if (sel.includes(o.id)) return false
    // El texto SÍ busca en las etiquetas: "Trocantéritis" tiene que encontrar el objetivo
    // que la lleva como patología, aunque esa palabra ya no sea un chip de zona.
    const nombresEt = (o.etiquetas||[]).map((id:string)=>nombreEt(id).toLowerCase()).join(' ')
    const mQ = !q || (o.nombre||'').toLowerCase().includes(q) || (o.descripcion||'').toLowerCase().includes(q) || nombresEt.includes(q)
    const mF = !familia || (o.tipo||'cualitativo') === familia
    const mZ = casaZona(etiquetas || [], zonaIdsDe(o), zona)
    return mQ && mF && mZ
  })

  return (
    <div style={{marginTop:5,marginLeft:2}}>
      <div style={{display:'flex',flexWrap:'wrap',gap:4,alignItems:'center'}}>
        <span style={{fontSize:9,color:'var(--grl)'}}>Abre:</span>
        {puestos.length===0 && <span style={{fontSize:9,color:'var(--grl)'}}>ningún objetivo</span>}
        {puestos.map((o:any)=>{
          /* EL MOVIMIENTO SE FIJA AQUÍ, no en la ficha del paciente.
             El test ya sabe qué mide —el lunge mide dorsiflexión, siempre—, así que
             preguntarlo otra vez con el paciente delante es repetir un trabajo que se
             puede hacer una vez en la biblioteca. Si se deja sin elegir, se comporta como
             antes y el movimiento se decide al asignar la meta. */
          /* Los específicos ya no son solo movimientos ni solo de los métricos: un
             cualitativo puede tener "Pie". La condición miraba `o.tipo==='metrico'` y por
             eso el desplegable no salía en el resto de familias. */
          const movs = (o.movimientos||[]).map((id:string)=>({ id, nombre: nombreEt(id) })).filter((m:any)=>m.nombre)
          const elegido = movimientos?.[o.id] || ''
          return (
            <span key={o.id} style={{display:'inline-flex',alignItems:'center',gap:0,borderRadius:99,background:o.color||'var(--g)',color:'#fff',overflow:'hidden'}}>
              <span style={{fontSize:9,padding:'2px 4px 2px 8px'}}>{o.nombre}</span>
              {(movs.length>0&&onMovimiento) && (
                <select value={elegido} onChange={e=>onMovimiento(o.id, e.target.value)}
                  title="Específico del objetivo al que se refiere este ítem"
                  style={{fontSize:9,border:'none',background:'rgba(255,255,255,.22)',color:'#fff',padding:'2px 4px',cursor:'pointer',fontFamily:'inherit',maxWidth:130}}>
                  <option value="" style={{color:'var(--n)'}}>— sin concretar —</option>
                  {movs.map((m:any)=><option key={m.id} value={m.id} style={{color:'var(--n)'}}>{m.nombre}</option>)}
                </select>
              )}
              <span onClick={()=>onToggle(o.id)} title="Quitar"
                style={{fontSize:10,padding:'2px 8px 2px 5px',cursor:'pointer',opacity:.75}}>✕</span>
            </span>
          )
        })}
        <button onClick={()=>setAbierto(v=>!v)}
          style={{fontSize:9,padding:'2px 8px',borderRadius:99,cursor:'pointer',border:'1px dashed var(--bd)',background:'var(--w)',color:'var(--g)',fontFamily:'inherit'}}>
          {abierto ? 'Cerrar' : '+ Objetivo'}
        </button>
      </div>

      {abierto && (
        <div style={{marginTop:5,border:'1px solid var(--bd)',borderRadius:6,overflow:'hidden'}}>
          {/* FILTROS Y RESULTADOS TIENEN QUE DISTINGUIRSE.
              Iban los dos como píldoras del mismo tamaño, uno debajo del otro, y no había
              forma de saber qué era un filtro y qué un objetivo que ibas a añadir. Ahora
              los filtros van sobre fondo gris y con su rótulo; los resultados, en lista
              blanca debajo. */}
          <div style={{background:'var(--bl)',padding:'7px 8px',borderBottom:'1px solid var(--bd)'}}>
            <input className="input" value={busca} onChange={e=>setBusca(e.target.value)}
              placeholder="Buscar objetivo..." style={{fontSize:11,marginBottom:6}}/>

            <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',marginBottom:5}}>
              <span style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',width:42}}>Familia</span>
              {FAMILIAS_OBJ.map(f=>(
                <span key={f.id} onClick={()=>setFamilia(familia===f.id?'':f.id)}
                  style={{fontSize:9,padding:'2px 9px',borderRadius:99,cursor:'pointer',
                    border:`1.5px solid ${familia===f.id?'var(--g)':'var(--bd)'}`,
                    background:familia===f.id?'var(--g)':'var(--w)',color:familia===f.id?'#fff':'var(--gr)'}}>
                  {f.nombre}
                </span>
              ))}
            </div>

            {/* La misma fila de zonas que las dos bibliotecas, en pequeño. */}
            <div style={{display:'flex',alignItems:'flex-start',gap:5,flexWrap:'wrap'}}>
              <span style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',width:42,paddingTop:3}}>Zona</span>
              <div style={{flex:1,minWidth:0}}>
                <FiltroZonas compacto etiquetas={etiquetas||[]} usadas={zonasUsadas}
                  valor={zona} onChange={setZona} nSinZona={sinZona.length} />
              </div>
            </div>
          </div>

          {/* LISTA VERTICAL, no píldoras sueltas. Los nombres son largos y al envolverse
              cortaban la última fila por la mitad, sin que se viera que había más abajo.
              Una fila por objetivo se lee y se desplaza sin sorpresas. */}
          <div style={{maxHeight:190,overflowY:'auto',background:'var(--w)'}}>
            {resto.length===0
              ? <div style={{fontSize:10,color:'var(--grl)',padding:'10px 9px'}}>
                  {puestos.length>0 && !q && !familia && !zona ? 'Ya están todos puestos.' : 'Nada que coincida.'}
                </div>
              : resto.map((o:any)=>(
                <div key={o.id} onClick={()=>onToggle(o.id)} title={o.descripcion||''}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'6px 9px',cursor:'pointer',borderBottom:'1px solid var(--bl)'}}
                  onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'}
                  onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                  <span style={{width:8,height:8,borderRadius:2,background:o.color||'var(--g)',flexShrink:0}}/>
                  <span style={{fontSize:11,color:'var(--n)',flex:1}}>{o.nombre}</span>
                  <Ic name="mas" size={11}/>
                </div>
              ))}
          </div>

          {resto.length>6 && (
            <div style={{fontSize:9,color:'var(--grl)',padding:'4px 9px',borderTop:'1px solid var(--bl)',background:'var(--bl)'}}>
              {resto.length} objetivos · desplaza para ver el resto
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TestsTab({ testsLib, etiquetas, objetivos, setTestsLib, SelectorColumnas }: any) {
  const [modalTest, setModalTest] = useState(false)
  const [testDetalle, setTestDetalle] = useState<any>(null)
  const [modalEditarTest, setModalEditarTest] = useState(false)
  const [testEditando, setTestEditando] = useState<any>(null)
  const [subiendoImgTest, setSubiendoImgTest] = useState(false)
  const [nuevoTest, setNuevoTest] = useState({ nombre:'', descripcion:'', frecuencia_meses:3, video_url:'', imagen_url:'', imagen_file:null as File|null, items:[] as any[], logica:'cualquiera', bandas:[] as any[], baremos:[] as any[], etiquetas_relacionadas:[] as string[], etiquetas_bloquea:[] as string[], tipo_lado:'bilateral' })

  /**
   * Todo lo de abajo miraba el resultado de Supabase de reojo o directamente no lo miraba:
   * se cerraba el modal, se recargaba la lista y parecía que había ido bien. Un test que
   * no se guarda tiene que decir que no se ha guardado, y el modal tiene que seguir
   * abierto con lo escrito dentro.
   */
  async function recargarTests() {
    const { data, error } = await supabase.from('tests').select('*').order('nombre')
    if (error) { alert('El test se ha guardado, pero la lista no se ha podido recargar: ' + error.message); return }
    setTestsLib(data || [])
  }

  /** Sube la imagen y devuelve su URL pública, o el motivo por el que no ha podido. */
  async function subirImagenTest(testId: string, file: File): Promise<{ url: string } | { error: string }> {
    const ext = file.name.split('.').pop()
    const path = `tests/${testId}/foto.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(path, file, { upsert: true })
    if (error) return { error: error.message }
    const { data: { publicUrl } } = supabase.storage.from('fotos').getPublicUrl(path)
    return { url: publicUrl }
  }

  /** Las reglas están en `lib/tests.ts`; aquí solo se enseñan. true = no se guarda. */
  function bloqueadoPorProblemas(test: any): boolean {
    const p = problemasDelTest(test)
    if (p.length === 0) return false
    alert('El test no se ha guardado:\n\n' + p.map(x => '· ' + x).join('\n'))
    return true
  }

  async function crearTest() {
    if (bloqueadoPorProblemas(nuevoTest)) return
    setSubiendoImgTest(true)
    const { data: t, error } = await supabase.from('tests').insert({ nombre:nuevoTest.nombre, descripcion:nuevoTest.descripcion, frecuencia_meses:nuevoTest.frecuencia_meses, video_url:nuevoTest.video_url, items:nuevoTest.items, logica:nuevoTest.logica, bandas:(esSuma(nuevoTest)||esBaremo(nuevoTest))?(nuevoTest.bandas||[]):[], baremos:esBaremo(nuevoTest)?(nuevoTest.baremos||[]):[], etiquetas_relacionadas:nuevoTest.etiquetas_relacionadas||[], etiquetas_bloquea:nuevoTest.etiquetas_bloquea||[], tipo_lado:nuevoTest.tipo_lado, imagen_url:'' }).select().single()
    if (error || !t) {
      setSubiendoImgTest(false)
      alert('No se ha podido crear el test: ' + (error?.message || 'la base de datos no ha devuelto la fila creada.'))
      return
    }
    // La imagen falla aparte y no invalida el test: se avisa, pero después de cerrar, para
    // que no parezca que no se ha guardado nada.
    let avisoImagen = ''
    if (nuevoTest.imagen_file) {
      const r = await subirImagenTest(t.id, nuevoTest.imagen_file)
      if ('error' in r) avisoImagen = r.error
      else {
        const { error: errUrl } = await supabase.from('tests').update({ imagen_url: r.url }).eq('id', t.id)
        if (errUrl) avisoImagen = errUrl.message
      }
    }
    setSubiendoImgTest(false)
    setModalTest(false)
    setNuevoTest({ nombre:'', descripcion:'', frecuencia_meses:3, video_url:'', imagen_url:'', imagen_file:null, items:[], logica:'cualquiera', bandas:[], baremos:[], etiquetas_relacionadas:[], etiquetas_bloquea:[], tipo_lado:'bilateral' })
    await recargarTests()
    if (avisoImagen) alert('El test se ha creado, pero la imagen no se ha subido: ' + avisoImagen + '\n\nVuelve a subirla desde Editar.')
  }

  async function guardarEditTest() {
    if (!testEditando) return
    if (bloqueadoPorProblemas(testEditando)) return
    setSubiendoImgTest(true)
    let imagenUrl = testEditando.imagen_url || ''
    let avisoImagen = ''
    if (testEditando.imagen_file) {
      const r = await subirImagenTest(testEditando.id, testEditando.imagen_file)
      if ('error' in r) avisoImagen = r.error
      // El sufijo con la hora es para saltarse la caché del navegador: la ruta del fichero
      // es siempre la misma y sin esto se sigue viendo la imagen anterior.
      else imagenUrl = r.url + '?t=' + Date.now()
    }
    const { error } = await supabase.from('tests').update({ nombre:testEditando.nombre, descripcion:testEditando.descripcion, video_url:testEditando.video_url, frecuencia_meses:testEditando.frecuencia_meses, logica:testEditando.logica, items:testEditando.items||[], bandas:(esSuma(testEditando)||esBaremo(testEditando))?(testEditando.bandas||[]):[], baremos:esBaremo(testEditando)?(testEditando.baremos||[]):[], etiquetas_relacionadas:testEditando.etiquetas_relacionadas||[], etiquetas_bloquea:testEditando.etiquetas_bloquea||[], tipo_lado:testEditando.tipo_lado||'bilateral', imagen_url:imagenUrl }).eq('id', testEditando.id)
    setSubiendoImgTest(false)
    if (error) { alert('No se han guardado los cambios: ' + error.message); return }
    setModalEditarTest(false); setTestEditando(null)
    await recargarTests()
    if (avisoImagen) alert('Los cambios se han guardado, pero la imagen no se ha subido: ' + avisoImagen)
  }

  /**
   * El borrado vive en `lib/tests.ts`, que es quien sabe qué cuelga de un test. Aquí solo
   * se pregunta —diciendo exactamente qué se lleva por delante— y se enseña el resultado.
   */
  async function eliminarTest(t: any) {
    const a = await alcanceBorradoTest(t.id)
    const lineas = [
      `Vas a eliminar «${t.nombre}» de la biblioteca.`, '',
      `· ${a.resultados} resultado${a.resultados === 1 ? '' : 's'} de paciente se borran con él.`,
      `· ${a.pacientes} paciente${a.pacientes === 1 ? ' tiene' : 's tienen'} objetivos abiertos por este test: esas vías se quitan.`,
    ]
    if (a.objetivos.length > 0) lineas.push(`· Se quedan sin test los objetivos: ${a.objetivos.join(', ')}.`)
    lineas.push('', 'No se puede deshacer. ¿Seguir?')
    if (!confirm(lineas.join('\n'))) return

    const r = await borrarTest(t.id)
    if (!r.ok) { alert('No se ha eliminado: ' + r.error); return }
    setTestDetalle(null)
    await recargarTests()
    alert(`Eliminado «${t.nombre}».\n${r.resultados} resultado${r.resultados === 1 ? '' : 's'} y ${r.viasQuitadas} vía${r.viasQuitadas === 1 ? '' : 's'} de objetivo.`)
  }

  // El buscador, el filtro por zona y la rejilla los pone `ExploradorTests`, que es el
  // mismo que usa la valoración. Estaban escritos aquí y la valoración tenía su propia
  // versión, peor; es el caso de `ExploradorEjercicios` otra vez.

  return (
    <>
      <ExploradorTests
        tests={testsLib} etiquetas={etiquetas} onAbrir={(t:any)=>setTestDetalle(t)}
        acciones={<button className="btn btn-p btn-sm" onClick={()=>setModalTest(true)}>+ Nuevo test</button>}/>

      {testDetalle&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setTestDetalle(null)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'94vw',maxWidth:820,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1,fontSize:14,fontWeight:400,color:'var(--n)'}}>{testDetalle.nombre}</div>
              <button className="btn btn-s btn-sm" onClick={()=>{setTestEditando({...testDetalle});setModalEditarTest(true);setTestDetalle(null)}}><Ic name="editar" size={12}/> Editar</button>
              {/* La ficha NO se cierra al pulsar: se cerraba antes de que respondiera el
                  borrado, así que un borrado fallido se veía igual que uno correcto. */}
              <button className="btn btn-d btn-sm" onClick={()=>eliminarTest(testDetalle)}><Ic name="papelera" size={12}/></button>
              <button onClick={()=>setTestDetalle(null)} style={{width:26,height:26,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontSize:13,color:'var(--gr)'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
                <div>
                  {testDetalle.imagen_url?<img src={testDetalle.imagen_url} alt={testDetalle.nombre} style={{width:'100%',height:240,objectFit:'contain',background:'var(--bm)',borderRadius:8,border:'1px solid var(--bd)'}}/>:<div style={{width:'100%',height:240,background:'var(--bm)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--grl)'}}><Ic name="test" size={48}/></div>}
                </div>
                <div>
                  {testDetalle.descripcion&&<div style={{marginBottom:12}}><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Descripción</div><div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.6}}>{testDetalle.descripcion}</div></div>}
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12}}>
                    <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>Revisión cada {testDetalle.frecuencia_meses} meses</span>
                    <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{testDetalle.tipo_lado==='lateral'?'Izq / Der':'Bilateral'}</span>
                    {testDetalle.video_url&&<a href={testDetalle.video_url} target="_blank" rel="noopener noreferrer" style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--gl)',color:'var(--gd)',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:3}}><Ic name="play" size={10}/> Vídeo</a>}
                  </div>
                  {/* LO QUE HACE CADA ÍTEM, SIN ENTRAR A EDITAR.
                      Aquí solo salía el nombre del ítem, así que para saber con qué regla
                      decide o qué objetivo abre había que abrir el formulario de edición
                      —con el riesgo de tocar algo— y cerrarlo sin guardar. Revisar la
                      biblioteca es justo lo que se hace desde esta ficha. */}
                  {(testDetalle.items||[]).length>0&&(
                    <div>
                      <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Ítems · {esSuma(testDetalle)?'Suma · manda el total':esBaremo(testDetalle)?'Baremo · cada ítem contra su norma':testDetalle.logica==='todos'?'Todos = positivo':'Cualquiera = positivo'}</div>
                      {(testDetalle.items||[]).map((item:any,i:number)=>{
                        const regla = textoRegla(item)
                        const objs = (item.objetivos||[]).map((id:string)=>(objetivos||[]).find((o:any)=>o.id===id)).filter(Boolean)
                        return (
                          <div key={i} style={{padding:'5px 0',borderTop:i===0?'none':'1px solid var(--bl)'}}>
                            <div style={{fontSize:11,color:'var(--n)',fontWeight:300}}>
                              {esSuma(testDetalle)||esBaremo(testDetalle)?'▤':regla?'▭':'☐'} {item.nombre}{unidadDe(item).simbolo?` · mide ${unidadDe(item).nombre.toLowerCase()}`:''}
                            </div>
                            {esBaremo(testDetalle)
                              ? (()=>{
                                  const suyas = baremosDe(testDetalle).filter((b:any)=>String(b.item||'').trim().toLowerCase()===String(item.nombre||'').trim().toLowerCase())
                                  return <div style={{fontSize:10,color:suyas.length?'var(--gd)':'var(--red)',marginTop:2}}>
                                    {suyas.length===0?'Sin baremo: este ítem no se puede interpretar':`${suyas.length} condicion${suyas.length===1?'':'es'} de baremo`}
                                  </div>
                                })()
                              : esSuma(testDetalle)
                              ? <div style={{fontSize:10,color:'var(--gd)',marginTop:2}}>Puntúa de {item.min ?? '?'} a {item.max ?? '?'}</div>
                              : regla&&(
                                <div style={{fontSize:10,color:'var(--gd)',marginTop:2}}>
                                  {regla} · barra {item.min ?? '?'} a {item.max ?? '?'}
                                </div>
                              )}
                            {/* En un test de puntuación los ítems no abren objetivos: lo
                                hace el test entero. Enseñar aquí un "Abre: ninguno" haría
                                pensar que falta engancharlos ítem a ítem. */}
                            {!esSuma(testDetalle) && !esBaremo(testDetalle) && (
                              <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:3,alignItems:'center'}}>
                                <span style={{fontSize:9,color:'var(--grl)'}}>Abre:</span>
                                {objs.length===0
                                  ? <span style={{fontSize:9,color:'var(--grl)'}}>ningún objetivo</span>
                                  : objs.map((o:any)=>{
                                      const movId=(item.objetivos_mov||{})[o.id]
                                      const mov=movId?((etiquetas||[]).find((e:any)=>e.id===movId)?.nombre||''):''
                                      return (
                                        <span key={o.id} style={{fontSize:9,padding:'1px 8px',borderRadius:99,background:o.color||'var(--g)',color:'#fff'}}>
                                          {o.nombre}{mov?` · ${mov}`:''}
                                        </span>
                                      )
                                    })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {esBaremo(testDetalle)&&baremosDe(testDetalle).length>0&&(
                    <div style={{marginTop:12}}>
                      <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>
                        Baremos · {baremosDe(testDetalle).length} condiciones
                      </div>
                      <div style={{maxHeight:180,overflowY:'auto'}}>
                        {baremosDe(testDetalle).map((b:any,i:number)=>{
                          const item = (testDetalle.items||[]).find((it:any)=>String(it.nombre||'').trim().toLowerCase()===String(b.item||'').trim().toLowerCase())
                          const edad = b.edad_min!=null&&b.edad_max!=null ? `${b.edad_min}-${b.edad_max} años`
                            : b.edad_min!=null ? `${b.edad_min}+ años`
                            : b.edad_max!=null ? `hasta ${b.edad_max} años` : 'cualquier edad'
                          return (
                            <div key={i} style={{fontSize:10,color:'var(--n)',fontWeight:300,padding:'1px 0'}}>
                              {b.item} · {b.sexo||'cualquier sexo'} · {edad} · {textoNorma(b, item)||'sin norma'}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {(esSuma(testDetalle)||esBaremo(testDetalle))&&(()=>{
                    const bandas = bandasDe(testDetalle)
                    const porRecuento = esBaremo(testDetalle)
                    const rango = porRecuento ? { min:0, max:(testDetalle.items||[]).length } : rangoTotal(testDetalle.items||[])
                    return (
                      <div style={{marginTop:12}}>
                        <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>
                          {porRecuento?'Bandas del recuento':'Bandas del total'}{rango?` · de ${rango.min} a ${rango.max}`:''}
                        </div>
                        {bandas.length===0
                          ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin bandas: este test no puede dar resultado.</div>
                          : bandas.map((b,i)=>{
                              const desde = i===0 ? (rango?rango.min:'−∞') : bandas[i-1].hasta+1
                              /* Qué abre cada banda. En un test de puntuación es donde
                                 cuelga el trabajo, igual que el ítem en uno de casillas, y
                                 sin enseñarlo aquí había que entrar a editar para saberlo. */
                              const objs = (b.objetivos||[]).map((id:string)=>(objetivos||[]).find((o:any)=>o.id===id)).filter(Boolean)
                              return (
                                <div key={i} style={{padding:'2px 0'}}>
                                  <div style={{fontSize:11,color:'var(--n)',fontWeight:300,display:'flex',alignItems:'center',gap:6}}>
                                    <span style={{width:9,height:9,borderRadius:2,background:b.hallazgo?'var(--red)':'var(--g)',flexShrink:0}}/>
                                    <span style={{color:'var(--grl)',minWidth:64}}>{desde} a {b.hasta}</span>
                                    <span>{b.etiqueta||'sin nombre'}</span>
                                  </div>
                                  {b.hallazgo && (
                                    <div style={{display:'flex',flexWrap:'wrap',gap:3,margin:'2px 0 0 15px',alignItems:'center'}}>
                                      <span style={{fontSize:9,color:'var(--grl)'}}>Abre:</span>
                                      {objs.length===0
                                        ? <span style={{fontSize:9,color:'var(--red)'}}>ningún objetivo</span>
                                        : objs.map((o:any)=>{
                                            const movId=(b.objetivos_mov||{})[o.id]
                                            const mov=movId?((etiquetas||[]).find((e:any)=>e.id===movId)?.nombre||''):''
                                            return (
                                              <span key={o.id} style={{fontSize:9,padding:'1px 8px',borderRadius:99,background:o.color||'var(--g)',color:'#fff'}}>
                                                {o.nombre}{mov?` · ${mov}`:''}
                                              </span>
                                            )
                                          })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                      </div>
                    )
                  })()}
                  {/* Los mismos problemas que impiden guardar, en los tests que ya están
                      guardados: la biblioteca se ha ido montando a mano y hay ítems de
                      antes de que existiera la validación. */}
                  {(()=>{
                    const probs = problemasDelTest(testDetalle)
                    if (probs.length===0) return null
                    return (
                      <div style={{marginTop:12,padding:'8px 10px',borderRadius:7,background:'var(--ambl)',border:'1px solid #E0C068'}}>
                        <div style={{fontSize:9,fontWeight:600,color:'#8A6410',letterSpacing:.4,textTransform:'uppercase',marginBottom:4,display:'flex',alignItems:'center',gap:5}}>
                          <Ic name="alerta" size={11}/> Este test está incompleto
                        </div>
                        {probs.map((p,i)=><div key={i} style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.5}}>· {p}</div>)}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalTest&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalTest(false)}}>
          <div className="modal" style={{width:'94vw',maxWidth:900,maxHeight:'90vh'}}>
            <div className="modal-title">Nuevo test<button className="modal-close" onClick={()=>setModalTest(false)}>✕</button></div>
            {/* CABECERA: LA IMAGEN MANDA.
                Un test se reconoce por la foto de la posición, no por su nombre: "Lunge de
                tobillo · con alza bajo el talón" no dice cómo se coloca al paciente. Antes
                la imagen era un cuadrado de 80 px perdido a mitad del formulario, debajo de
                cuatro campos de texto. Ahora abre el modal, y los LADOS van justo debajo
                porque son parte del montaje: dónde se pone el paciente y de qué lado. */}
            <div style={{display:'grid',gridTemplateColumns:'240px 1fr',gap:14,marginBottom:14,alignItems:'start'}}>
              <div>
                <div style={{position:'relative',width:'100%',aspectRatio:1,background:'var(--bm)',borderRadius:8,border:'1px solid var(--bd)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {nuevoTest.imagen_url
                    ? <img src={nuevoTest.imagen_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                    : <span style={{color:'var(--grl)'}}><Ic name="test" size={40}/></span>}
                  {nuevoTest.imagen_url&&(
                    <button onClick={()=>setNuevoTest(p=>({...p,imagen_url:'',imagen_file:null}))}
                      style={{position:'absolute',top:6,right:6,width:22,height:22,borderRadius:'50%',background:'var(--red)',color:'#fff',border:'none',cursor:'pointer',fontSize:11}}>✕</button>
                  )}
                </div>
                <label style={{cursor:'pointer',display:'block',marginTop:6}}>
                  <div className="btn btn-s btn-sm" style={{width:'100%',justifyContent:'center'}}><Ic name="camara" size={12}/> Subir imagen</div>
                  <input type="file" accept="image/*" style={{display:'none'}}
                    onChange={e=>{const f=e.target.files?.[0];if(f)setNuevoTest(p=>({...p,imagen_file:f,imagen_url:URL.createObjectURL(f)}))}}/>
                </label>
                <div style={{marginTop:10}}>
                  <label style={{fontSize:10,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase'}}>¿Tiene lados?</label>
                  <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:5}}>
                    {([['bilateral','Bilateral / único'],['lateral','Izquierdo / Derecho']] as const).map(([v,l])=>(
                      <div key={v} onClick={()=>setNuevoTest(p=>({...p,tipo_lado:v}))}
                        style={{padding:'8px',borderRadius:6,border:`1.5px solid ${nuevoTest.tipo_lado===v?'var(--g)':'var(--bd)'}`,background:nuevoTest.tipo_lado===v?'var(--gl)':'var(--w)',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:nuevoTest.tipo_lado===v?500:300,color:nuevoTest.tipo_lado===v?'var(--gd)':'var(--grl)'}}>{l}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div className="field"><label>Nombre *</label><input className="input" value={nuevoTest.nombre} onChange={e=>setNuevoTest(p=>({...p,nombre:e.target.value}))} autoFocus/></div>
                <div className="field"><label>Descripción</label><textarea className="input" value={nuevoTest.descripcion} onChange={e=>setNuevoTest(p=>({...p,descripcion:e.target.value}))} style={{minHeight:200,lineHeight:1.6}}/></div>
              </div>
            </div>
            <div className="g2">
              <div className="field"><label>Enlace vídeo</label><input className="input" value={nuevoTest.video_url} onChange={e=>setNuevoTest(p=>({...p,video_url:e.target.value}))}/></div>
              <div className="field"><label>Frecuencia revisión</label>
                <select className="input" value={nuevoTest.frecuencia_meses} onChange={e=>setNuevoTest(p=>({...p,frecuencia_meses:parseInt(e.target.value)}))}>
                  {[1,2,3,6,12].map(m=><option key={m} value={m}>{m} {m===1?'mes':'meses'}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <label style={{margin:0}}>Ítems</label>
                {/* CÓMO SE RESUELVE EL TEST. 'suma' no es una lógica más: es otro tipo de
                    test —el veredicto sale del total y no de los ítems— y por eso cambia
                    lo que se pide debajo. La regla está en `lib/tests.ts`. */}
                <select style={{fontSize:9,padding:'2px 6px',border:'1px solid var(--bd)',borderRadius:3,background:'var(--bl)',fontFamily:'system-ui'}} value={nuevoTest.logica} onChange={e=>setNuevoTest(p=>({...p,logica:e.target.value}))}>
                  <option value="cualquiera">Cualquier ítem = positivo</option>
                  <option value="todos">Todos los ítems = positivo</option>
                  <option value="suma">Puntuación · manda el total</option>
                  <option value="baremo">Baremo · cada ítem contra su norma</option>
                </select>
              </div>
              {esSuma(nuevoTest) && (
                <div style={{fontSize:11,color:'var(--gr)',marginBottom:7,lineHeight:1.5}}>
                  Cada ítem aporta su puntuación y el total cae en una banda. Los objetivos no
                  cuelgan de los ítems —un ítem suelto no significa nada— sino del test entero:
                  se enganchan desde la biblioteca de objetivos.
                </div>
              )}
              {esBaremo(nuevoTest) && (
                <div style={{fontSize:11,color:'var(--gr)',marginBottom:7,lineHeight:1.5}}>
                  Cada ítem se compara con su norma según el sexo y la edad del paciente, que ya
                  están en su ficha. Lo que cae en una banda es CUÁNTOS ítems quedan por debajo,
                  no la suma: sumar segundos con repeticiones no daría un número con sentido.
                </div>
              )}
              {nuevoTest.items.map((item:any,i:number)=>(
                <div key={i} style={{marginBottom:5,background:'var(--bl)',borderRadius:5,padding:'6px 8px',border:'1px solid var(--bd)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:7}}>
                    <input className="input" value={item.nombre} onChange={e=>{const its=[...nuevoTest.items];its[i]={...its[i],nombre:e.target.value};setNuevoTest(p=>({...p,items:its}))}} placeholder="ej. La rodilla no llega a 90°" style={{flex:1,fontSize:11}}/>
                    {/* La unidad va por ítem: un mismo test tiene ítems cualitativos y
                        medidos, y partirlo en dos por eso sería partir lo que en la
                        camilla es un solo test. */}
                    <select className="input" value={unidadDe(item).id} style={{width:118,fontSize:11,flexShrink:0}}
                      onChange={e=>{const its=[...nuevoTest.items] as any[];its[i]={...its[i],unidad:e.target.value};setNuevoTest(p=>({...p,items:its}))}}>
                      {UNIDADES.map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </select>
                    <button onClick={()=>setNuevoTest(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                  </div>
                  {/* En baremo el ítem no lleva ni regla ni rango propios: el umbral lo
                      pone la tabla de normas, que depende del paciente. */}
                  {!esBaremo(nuevoTest) && <ConfigBarra item={item} soloRango={esSuma(nuevoTest)} onCambia={(campos:any)=>{
                    const its=[...nuevoTest.items] as any[]; its[i]={...its[i],...campos}
                    setNuevoTest(p=>({...p,items:its}))
                  }}/>}
                  {!esSuma(nuevoTest) && !esBaremo(nuevoTest) && <PildorasObjetivos seleccionados={item.objetivos||[]} objetivos={objetivos} etiquetas={etiquetas}
                    movimientos={item.objetivos_mov||{}}
                    onMovimiento={(oid:string,mid:string)=>{
                      const its=[...nuevoTest.items] as any[]
                      const mapa={...(its[i].objetivos_mov||{})}
                      if (mid) mapa[oid]=mid; else delete mapa[oid]
                      its[i]={...its[i], objetivos_mov: mapa}
                      setNuevoTest(p=>({...p,items:its}))
                    }}
                    onToggle={(oid:string)=>{
                    const its=[...nuevoTest.items] as any[]
                    const act = its[i].objetivos||[]
                    its[i]={...its[i], objetivos: act.includes(oid)?act.filter((x:string)=>x!==oid):[...act,oid]}
                    setNuevoTest(p=>({...p,items:its}))
                  }}/>}
                </div>
              ))}
              {/* Un ítem de test de puntuación nace ya midiendo puntos: es lo único que
                  puede ser, y dejarlo en "sin medida" solo daba un aviso de validación. */}
              <button className="btn btn-t btn-sm" onClick={()=>setNuevoTest(p=>({...p,items:[...p.items,{nombre:'',unidad:esSuma(p)?'puntos':''}]}))}>+ Añadir ítem</button>
            </div>
            {esBaremo(nuevoTest) && (
              <EditorBaremos baremos={nuevoTest.baremos} items={nuevoTest.items}
                onCambia={(b:any[])=>setNuevoTest(p=>({...p,baremos:b}))}/>
            )}
            {(esSuma(nuevoTest)||esBaremo(nuevoTest)) && (
              <EditorBandas bandas={nuevoTest.bandas} items={nuevoTest.items} porRecuento={esBaremo(nuevoTest)}
                objetivos={objetivos} etiquetas={etiquetas}
                onCambia={(b:any[])=>setNuevoTest(p=>({...p,bandas:b}))}/>
            )}
            <div className="field">
              <label>Zona <span className="subt">· por dónde se encuentra en la biblioteca</span></label>
              <div style={{marginTop:5}}><SelectorZona etiquetas={etiquetas} seleccionadas={nuevoTest.etiquetas_relacionadas||[]} onChange={(ids:string[])=>setNuevoTest(p=>({...p,etiquetas_relacionadas:ids}))}/></div>
            </div>
            {/* Lo que este test DESACONSEJA si sale positivo. Avisa al montar la sesión;
                no impide nada, porque hay motivos para prescribirlo igual —carga baja,
                rango parcial— y un bloqueo duro se acaba esquivando fuera de la app.
                Un negativo posterior lo levanta solo. */}
            <div className="field">
              <label>Si sale positivo, desaconseja</label>
              <div style={{marginTop:5}}><SelectorEtiquetasCompacto etiquetas={etiquetas} seleccionadas={nuevoTest.etiquetas_bloquea||[]} onChange={(ids:string[])=>setNuevoTest(p=>({...p,etiquetas_bloquea:ids}))}/></div>
              <div style={{fontSize:12,color:'var(--gr)',marginTop:4}}>
                Los ejercicios con estas etiquetas saldrán avisados en el editor de sesión de
                quien dé positivo. Alcanza también a sus subetiquetas.
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalTest(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearTest} disabled={subiendoImgTest}>{subiendoImgTest?'…':<><Ic name="guardar" size={13}/> Guardar</>}</button>
            </div>
          </div>
        </div>
      )}

      {modalEditarTest&&testEditando&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalEditarTest(false)}}>
          <div className="modal" style={{width:'94vw',maxWidth:900,maxHeight:'90vh'}}>
            <div className="modal-title">Editar test<button className="modal-close" onClick={()=>setModalEditarTest(false)}>✕</button></div>
            {/* Misma cabecera que el de crear: imagen grande, nombre y descripción al
                lado, lados debajo. Ver el porqué en el modal de arriba. */}
            <div style={{display:'grid',gridTemplateColumns:'240px 1fr',gap:14,marginBottom:14,alignItems:'start'}}>
              <div>
                <div style={{position:'relative',width:'100%',aspectRatio:1,background:'var(--bm)',borderRadius:8,border:'1px solid var(--bd)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {testEditando.imagen_url
                    ? <img src={testEditando.imagen_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                    : <span style={{color:'var(--grl)'}}><Ic name="test" size={40}/></span>}
                  {testEditando.imagen_url&&(
                    <button onClick={()=>setTestEditando((p:any)=>({...p,imagen_url:'',imagen_file:null}))}
                      style={{position:'absolute',top:6,right:6,width:22,height:22,borderRadius:'50%',background:'var(--red)',color:'#fff',border:'none',cursor:'pointer',fontSize:11}}>✕</button>
                  )}
                </div>
                <label style={{cursor:'pointer',display:'block',marginTop:6}}>
                  <div className="btn btn-s btn-sm" style={{width:'100%',justifyContent:'center'}}><Ic name="camara" size={12}/> Cambiar imagen</div>
                  <input type="file" accept="image/*" style={{display:'none'}}
                    onChange={e=>{const f=e.target.files?.[0];if(f)setTestEditando((p:any)=>({...p,imagen_file:f,imagen_url:URL.createObjectURL(f)}))}}/>
                </label>
                <div style={{marginTop:10}}>
                  <label style={{fontSize:10,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase'}}>¿Tiene lados?</label>
                  <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:5}}>
                    {([['bilateral','Bilateral / único'],['lateral','Izquierdo / Derecho']] as const).map(([v,l])=>{
                      const act=(testEditando.tipo_lado||'bilateral')===v
                      return (
                        <div key={v} onClick={()=>setTestEditando((p:any)=>({...p,tipo_lado:v}))}
                          style={{padding:'8px',borderRadius:6,border:`1.5px solid ${act?'var(--g)':'var(--bd)'}`,background:act?'var(--gl)':'var(--w)',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:act?500:300,color:act?'var(--gd)':'var(--grl)'}}>{l}</div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div>
                <div className="field"><label>Nombre *</label><input className="input" value={testEditando.nombre||''} onChange={e=>setTestEditando((p:any)=>({...p,nombre:e.target.value}))}/></div>
                <div className="field"><label>Descripción</label><textarea className="input" value={testEditando.descripcion||''} onChange={e=>setTestEditando((p:any)=>({...p,descripcion:e.target.value}))} style={{minHeight:200,lineHeight:1.6}}/></div>
              </div>
            </div>
            <div className="field"><label>Enlace vídeo</label><input className="input" value={testEditando.video_url||''} onChange={e=>setTestEditando((p:any)=>({...p,video_url:e.target.value}))}/></div>
            <div className="g2">
              <div className="field"><label>Revisión (meses)</label><input className="input" type="number" value={testEditando.frecuencia_meses||3} onChange={e=>setTestEditando((p:any)=>({...p,frecuencia_meses:parseInt(e.target.value)||3}))}/></div>
              <div className="field"><label>Se resuelve por</label>
                <select className="input" value={testEditando.logica||'cualquiera'} onChange={e=>setTestEditando((p:any)=>({...p,logica:e.target.value}))}>
                  <option value="cualquiera">Positivo si algún ítem está marcado</option>
                  <option value="todos">Positivo si todos los ítems están marcados</option>
                  <option value="suma">Puntuación · manda el total</option>
                  <option value="baremo">Baremo · cada ítem contra su norma</option>
                </select>
              </div>
            </div>
            <div className="field">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <label style={{margin:0}}>Ítems</label>
              </div>
              {esSuma(testEditando) && (
                <div style={{fontSize:11,color:'var(--gr)',marginBottom:7,lineHeight:1.5}}>
                  Cada ítem aporta su puntuación y el total cae en una banda. Los objetivos no
                  cuelgan de los ítems —un ítem suelto no significa nada— sino del test entero:
                  se enganchan desde la biblioteca de objetivos.
                </div>
              )}
              {esBaremo(testEditando) && (
                <div style={{fontSize:11,color:'var(--gr)',marginBottom:7,lineHeight:1.5}}>
                  Cada ítem se compara con su norma según el sexo y la edad del paciente, que ya
                  están en su ficha. Lo que cae en una banda es CUÁNTOS ítems quedan por debajo,
                  no la suma.
                </div>
              )}
              {(testEditando.items||[]).map((item:any,i:number)=>(
                <div key={i} style={{marginBottom:5,background:'var(--bl)',borderRadius:5,padding:'6px 8px',border:'1px solid var(--bd)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:7}}>
                    <input className="input" value={item.nombre} onChange={e=>{const its=[...(testEditando.items||[])];its[i]={...its[i],nombre:e.target.value};setTestEditando((p:any)=>({...p,items:its}))}} placeholder="ej. La rodilla no llega a 90°" style={{flex:1,fontSize:11}}/>
                    <select className="input" value={unidadDe(item).id} style={{width:118,fontSize:11,flexShrink:0}}
                      onChange={e=>{const its=[...(testEditando.items||[])] as any[];its[i]={...its[i],unidad:e.target.value};setTestEditando((p:any)=>({...p,items:its}))}}>
                      {UNIDADES.map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </select>
                    <button onClick={()=>setTestEditando((p:any)=>({...p,items:(p.items||[]).filter((_:any,j:number)=>j!==i)}))} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                  </div>
                  {!esBaremo(testEditando) && <ConfigBarra item={item} soloRango={esSuma(testEditando)} onCambia={(campos:any)=>{
                    const its=[...(testEditando.items||[])] as any[]; its[i]={...its[i],...campos}
                    setTestEditando((p:any)=>({...p,items:its}))
                  }}/>}
                  {!esSuma(testEditando) && !esBaremo(testEditando) && <PildorasObjetivos seleccionados={item.objetivos||[]} objetivos={objetivos} etiquetas={etiquetas}
                    movimientos={item.objetivos_mov||{}}
                    onMovimiento={(oid:string,mid:string)=>{
                      const its=[...(testEditando.items||[])] as any[]
                      const mapa={...(its[i].objetivos_mov||{})}
                      if (mid) mapa[oid]=mid; else delete mapa[oid]
                      its[i]={...its[i], objetivos_mov: mapa}
                      setTestEditando((p:any)=>({...p,items:its}))
                    }}
                    onToggle={(oid:string)=>{
                    const its=[...(testEditando.items||[])] as any[]
                    const act = its[i].objetivos||[]
                    its[i]={...its[i], objetivos: act.includes(oid)?act.filter((x:string)=>x!==oid):[...act,oid]}
                    setTestEditando((p:any)=>({...p,items:its}))
                  }}/>}
                </div>
              ))}
              <button className="btn btn-t btn-sm" onClick={()=>setTestEditando((p:any)=>({...p,items:[...(p.items||[]),{nombre:'',unidad:esSuma(p)?'puntos':''}]}))}>+ Añadir ítem</button>
            </div>
            {esBaremo(testEditando) && (
              <EditorBaremos baremos={testEditando.baremos} items={testEditando.items||[]}
                onCambia={(b:any[])=>setTestEditando((p:any)=>({...p,baremos:b}))}/>
            )}
            {(esSuma(testEditando)||esBaremo(testEditando)) && (
              <EditorBandas bandas={testEditando.bandas} items={testEditando.items||[]} porRecuento={esBaremo(testEditando)}
                objetivos={objetivos} etiquetas={etiquetas}
                onCambia={(b:any[])=>setTestEditando((p:any)=>({...p,bandas:b}))}/>
            )}
            <div className="field">
              <label>Zona <span className="subt">· por dónde se encuentra en la biblioteca</span></label>
              <div style={{marginTop:5}}><SelectorZona etiquetas={etiquetas} seleccionadas={testEditando.etiquetas_relacionadas||[]} onChange={(ids:string[])=>setTestEditando((p:any)=>({...p,etiquetas_relacionadas:ids}))}/></div>
            </div>
            {/* Lo que este test DESACONSEJA si sale positivo. Avisa al montar la sesión;
                no impide nada, porque hay motivos para prescribirlo igual —carga baja,
                rango parcial— y un bloqueo duro se acaba esquivando fuera de la app.
                Un negativo posterior lo levanta solo. */}
            <div className="field">
              <label>Si sale positivo, desaconseja</label>
              <div style={{marginTop:5}}><SelectorEtiquetasCompacto etiquetas={etiquetas} seleccionadas={testEditando.etiquetas_bloquea||[]} onChange={(ids:string[])=>setTestEditando((p:any)=>({...p,etiquetas_bloquea:ids}))}/></div>
              <div style={{fontSize:12,color:'var(--gr)',marginTop:4}}>
                Los ejercicios con estas etiquetas saldrán avisados en el editor de sesión de
                quien dé positivo. Alcanza también a sus subetiquetas.
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEditarTest(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardarEditTest} disabled={subiendoImgTest}>{subiendoImgTest?'…':<><Ic name="guardar" size={13}/> Guardar</>}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
