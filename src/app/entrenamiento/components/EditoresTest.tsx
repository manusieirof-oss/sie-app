'use client'
/**
 * LOS EDITORES DE UN TEST, fuera de la pestana.
 *
 * Son los mismos cuatro trozos de formulario en los dos sitios donde se toca un
 * test —crearlo y editarlo— y ahora tambien desde el modal de un objetivo, que
 * necesita poder crear el test que le falta sin irse a la biblioteca. Vivian
 * dentro de TestsTab, que pasaba de las mil lineas, y desde alli no habia forma
 * de usarlos en ningun otro sitio.
 *
 * No cambia nada por dentro: es el mismo codigo, exportado.
 */
import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { UNIDADES, unidadDe, mide, textoRegla, problemasDelTest, alcanceBorradoTest, borrarTest, esSuma, esBaremo, bandasDe, baremosDe, rangoTotal, textoNorma } from '@/lib/tests'
import ExploradorTests from '@/components/ExploradorTests'
import SelectorEtiquetasCompacto from '@/components/SelectorEtiquetasCompacto'
import { ordenAnatomico } from '@/lib/anatomia'
import { categoriaDe, raizDe, zonasDe, casaZona } from '@/lib/etiquetas'
import FiltroZonas from '@/components/FiltroZonas'

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
export function ConfigBarra({ item, onCambia, soloRango = false }: { item: any, onCambia: (campos: any) => void, soloRango?: boolean }) {
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
export function EditorBandas({ bandas, items, onCambia, porRecuento = false, objetivos = [], etiquetas = [] }: { bandas: any, items: any[], onCambia: (b: any[]) => void, porRecuento?: boolean, objetivos?: any[], etiquetas?: any[] }) {
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
export function SelectorZona({ etiquetas = [], seleccionadas = [], onChange }: {
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
export function EditorBaremos({ baremos, items, onCambia }: { baremos: any, items: any[], onCambia: (b: any[]) => void }) {
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
    const mZ = casaZona(etiquetas || [], zonaIdsDe(o), zona)
    return mQ && mZ
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
            <span key={o.id} style={{display:'inline-flex',alignItems:'center',gap:0,borderRadius:99,background:'var(--g)',color:'#fff',overflow:'hidden'}}>
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
                  {puestos.length>0 && !q && !zona ? 'Ya están todos puestos.' : 'Nada que coincida.'}
                </div>
              : resto.map((o:any)=>(
                <div key={o.id} onClick={()=>onToggle(o.id)} title={o.descripcion||''}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'6px 9px',cursor:'pointer',borderBottom:'1px solid var(--bl)'}}
                  onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'}
                  onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                  <span style={{width:8,height:8,borderRadius:2,background:'var(--g)',flexShrink:0}}/>
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
