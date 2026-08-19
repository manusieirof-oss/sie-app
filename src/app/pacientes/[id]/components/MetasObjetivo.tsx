'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { unidadDe, valorDe } from '@/lib/tests'
import { estadoDeMeta, cerrarMetaAMano, revisarMetas, revisarObjetivos, TIPOS_META, antagonistaDe, type Meta } from '@/lib/metas'

/**
 * Las metas medibles de un objetivo, dentro de la ficha del paciente.
 *
 * El objetivo dice QUÉ se trabaja —"Fuerza de hombro"— y la meta dice cuánto y de dónde
 * sale el número. Sin esto el objetivo no se puede cerrar y se queda abierto para siempre,
 * que es lo que pasaba antes.
 *
 * TODA META NACE ATADA A UN ÍTEM DE TEST. No se puede crear una meta sin decir qué
 * medición la evalúa: una meta que nadie mide es una intención con un número al lado, y
 * volveríamos a decidir a ojo. Por eso el selector de test es obligatorio y solo ofrece
 * ítems que tengan unidad.
 */

export default function MetasObjetivo({ pacienteId, objetivo, metas, resultados, tests, etiquetas, onCambio }: {
  pacienteId: string
  objetivo: any
  metas: Meta[]
  resultados: any[]
  tests: any[]
  etiquetas: any[]
  onCambio: () => void
}) {
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [f, setF] = useState<any>({ movimiento_id: '', lado: 'bilateral', tipo: 'mejorar', test_id: '', item_indice: '', item_par_indice: '', valor_inicial: '', meta_pct: '20', meta_valor: '', manual: false, desdeTest: false })

  const nombreEt = (id: string) => etiquetas.find((e: any) => e.id === id)?.nombre || ''
  const movimientos = (objetivo.movimientos || []).map((id: string) => ({ id, nombre: nombreEt(id) })).filter((m: any) => m.nombre)

  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

  /**
   * Qué test e ítem miden este movimiento, resuelto solo.
   *
   * Desde que los tests de medición espejan a los espacios métricos —"Fuerza de hombro"
   * tiene su "Hombro · fuerza" con los mismos movimientos como ítems— no hay nada que
   * elegir: el objetivo dice la zona y la métrica, el movimiento dice el ítem.
   *
   * Preguntarlo era pedirle al usuario que resolviera a mano una correspondencia que la
   * app conoce, y en una lista que además ofrecía tests de otras zonas.
   */
  const sugerida = useMemo(() => {
    const mov = f.movimiento_id ? nombreEt(f.movimiento_id) : ''
    if (!mov) return null
    const deLaZona = tests.filter((t: any) => (t.etiquetas_relacionadas || []).includes(objetivo.articulacion_id))
    const conMetrica = deLaZona.filter((t: any) => norm(t.nombre).includes(norm(objetivo.metrica || '')))
    for (const t of (conMetrica.length ? conMetrica : deLaZona)) {
      const i = (t.items || []).findIndex((it: any) => norm(it.nombre) === norm(mov))
      if (i >= 0) return { test_id: t.id, item_indice: i, nombre: t.nombre, item: t.items[i] }
    }
    return null
  }, [f.movimiento_id, tests, objetivo, etiquetas])

  /**
   * De dónde sale el objetivo: la vía que abrió el test.
   *
   * El test que abrió el objetivo ya dijo QUÉ movimiento mide y sobre QUÉ lado se midió.
   * Preguntarlo otra vez aquí era rehacer a mano un trabajo ya hecho en la biblioteca, y
   * era además donde se colaba el error clásico: poner la meta sobre el lado sano.
   *
   * Se cogen solo las vías ABIERTAS: una vía resuelta describe algo que ya se cerró, y
   * proponerla como punto de partida de una meta nueva sería mirar al pasado.
   */
  const origen = useMemo(() => {
    const vias = Array.isArray(objetivo.vias) ? objetivo.vias : []
    // Valen los DOS caminos. Un objetivo puede colgar del test entero (`tipo: 'test'`) o
    // de un ítem suyo (`tipo: 'test_item'`). Mirar solo el segundo dejaba fuera el caso
    // más frecuente —una ficha que mide una sola cosa— y ahí la meta nacía sin lado.
    const abiertas = vias.filter((v: any) => !v.resuelto && (v.tipo === 'test_item' || v.tipo === 'test'))
    // De más informativa a menos: la que concreta el movimiento, la que al menos dice qué
    // ítem, y por último la del test entero, que ya solo aporta el lado.
    const conItemRef = (x: any) => x.tipo === 'test_item' && String(x.ref || '').includes(':')
    const v = abiertas.find((x: any) => x.mov && (objetivo.movimientos || []).includes(x.mov))
      || abiertas.find(conItemRef)
      || abiertas[0]
    if (!v) return null
    const conItem = conItemRef(v)
    const [testId, idx] = String(v.ref).split(':')
    return {
      test_id: conItem ? testId : '', item_indice: conItem ? idx : '', conItem,
      mov: v.mov || '', lado: v.lado || '', etiqueta: v.etiqueta || '',
    }
  }, [objetivo])

  // La sugerencia se aplica sola al cambiar de movimiento, salvo que se haya pedido
  // elegir a mano o que la medición venga ya puesta por el test que abrió el objetivo:
  // ahí manda el test de verdad, no una correspondencia deducida por el nombre.
  useEffect(() => {
    if (f.manual || f.desdeTest || !sugerida) return
    setF((p: any) => ({ ...p, test_id: sugerida.test_id, item_indice: String(sugerida.item_indice) }))
  }, [sugerida, f.manual, f.desdeTest])

  const testSel = tests.find((t: any) => t.id === f.test_id)
  /** Solo los ítems que se miden: una casilla de sí/no no puede cerrar un "+20%". */
  const itemsMedibles = ((testSel?.items || []) as any[])
    .map((it, i) => ({ ...it, i }))
    .filter(it => unidadDe(it).id !== '')

  const itemElegido = f.item_indice !== '' ? itemsMedibles.find(it => it.i === Number(f.item_indice)) : null
  const unidad = itemElegido ? unidadDe(itemElegido).id : ''

  /**
   * El ítem que abrió el objetivo puede no ser el que lo mide.
   *
   * En el lunge, lo que abre "Movilidad de tobillo" es la casilla «el talón se levanta
   * antes de tocar», que no tiene número. El número está en otro ítem del MISMO test: la
   * distancia a la pared. Sin esto la meta apuntaba a una casilla, el punto de partida
   * salía «sin medición previa» aunque el test estuviera hecho, y encima la pantalla
   * enseñaba un test distinto del que se iba a guardar.
   *
   * Se busca dentro del test que abrió el objetivo, no en otro: ese test es el que se
   * pasó, y su medida es la que existe.
   */
  useEffect(() => {
    if (!f.desdeTest || !testSel) return
    if (itemsMedibles.some(it => it.i === Number(f.item_indice))) return
    const alt = itemsMedibles[0]
    // Si el test entero no mide nada, se suelta y manda la correspondencia deducida.
    setF((p: any) => ({ ...p, item_indice: alt ? String(alt.i) : '', desdeTest: !!alt }))
  }, [f.desdeTest, f.test_id, f.item_indice, itemsMedibles.length])

  /**
   * Qué medición se enseña ya resuelta. Si el objetivo lo abrió un test, ese test es la
   * medición: no hay nada que deducir ni que preguntar.
   */
  const medicion = f.desdeTest && testSel && itemElegido
    ? { nombre: testSel.nombre, item: itemElegido }
    : (sugerida ? { nombre: sugerida.nombre, item: sugerida.item } : null)

  /**
   * Lo último medido en ese ítem, LADO A LADO.
   *
   * Un test lateral se guarda como una fila por lado, así que aquí puede haber dos
   * números distintos y son dos historias distintas: un tobillo a 8 cm y el otro a 12 no
   * se resumen en un solo punto de partida.
   */
  const ladosConDato = useMemo(() => {
    if (!f.test_id || f.item_indice === '') return [] as { lado: string, valor: number }[]
    const porLado: Record<string, { fecha: string, valor: number }> = {}
    for (const r of resultados) {
      if (r.test_id !== f.test_id) continue
      const it = (r.items_resultado || [])[Number(f.item_indice)]
      const v = it ? parseFloat(valorDe(it)) : NaN
      if (!Number.isFinite(v)) continue
      const lado = r.lado || 'bilateral'
      const fecha = String(r.fecha || '')
      // De cada lado vale la medición más reciente, no la primera que aparezca.
      if (!porLado[lado] || fecha > porLado[lado].fecha) porLado[lado] = { fecha, valor: v }
    }
    return Object.entries(porLado).map(([lado, x]) => ({ lado, valor: x.valor }))
  }, [f.test_id, f.item_indice, resultados])

  /** Lo medido en el lado elegido, que es el punto de partida de esta meta. */
  const ultimoValor = ladosConDato.find(x => x.lado === f.lado)?.valor ?? null

  /**
   * Si el test se pasó en los dos lados, se ofrecen las dos metas de una vez.
   *
   * Poner una y acordarse de volver a por la otra es justo lo que no pasa: queda medio
   * paciente con meta y medio sin ella, y el objetivo no puede cerrarse nunca porque le
   * falta un lado. En "igualar lados" no aplica: esa meta ya compara los dos.
   */
  const lateralesConDato = ladosConDato.filter(x => x.lado === 'izquierdo' || x.lado === 'derecho')
  const puedeAmbos = lateralesConDato.length === 2 && f.tipo !== 'igualar_lados'
  const creandoAmbos = puedeAmbos && f.ambos

  /**
   * El MOVIMIENTO y el LADO no se fijan igual, aunque los diga el mismo test.
   *
   * El movimiento es una propiedad de la MEDICIÓN: el ítem mide dorsiflexión y solo
   * dorsiflexión. Cambiarlo a flexión plantar dejaría la meta evaluándose contra números
   * de otro gesto, así que no es una opción sino una incoherencia. En cuanto el test lo
   * dice, NO SE PUEDE TOCAR: ni cambiando la medición. Si hace falta otro movimiento, se
   * arregla en la biblioteca —qué mide ese ítem— y no aquí paciente a paciente.
   *
   * El lado es otra cosa: la misma medida existe en los dos, y querer la meta en el otro
   * lado —o en los dos— es una decisión clínica legítima. Ese sí se deja cambiar.
   *
   * Se exige además que el test lo dijera DE VERDAD: si el movimiento lo elegimos nosotros
   * por ser el primero de la lista, eso no es una decisión del test y hay que preguntarla.
   * Dar por fijado un dato adivinado es peor que pedirlo.
   */
  const movLoDijoElTest = !!origen?.mov && movimientos.some((m: any) => m.id === origen.mov)
  const movFijado = movLoDijoElTest
  const ladoFijado = !!origen?.lado && !f.abrirEleccion

  /**
   * El punto de partida se rellena con lo medido, no se deja en blanco.
   *
   * Antes iba vacío con el número puesto de gris detrás. Funcionaba —al guardar se cogía
   * ese— pero un hueco vacío se lee como "aquí no hay dato" y obligaba a teclear a mano un
   * número que ya estaba en pantalla. Se deja de tocar en cuanto lo cambias tú.
   */
  useEffect(() => {
    if (f.partidaTocada) return
    setF((p: any) => ({ ...p, valor_inicial: ultimoValor != null ? String(ultimoValor) : '' }))
  }, [ultimoValor, f.partidaTocada])

  /** El ítem del movimiento contrario, propuesto solo. Flexión busca extensión. */
  const parSugerido = useMemo(() => {
    if (f.tipo !== 'igualar_par' || !f.movimiento_id) return null
    const contrario = antagonistaDe(nombreEt(f.movimiento_id))
    if (!contrario) return null
    const n = contrario.toLowerCase()
    const it = itemsMedibles.find(x => (x.nombre || '').toLowerCase().includes(n))
    return it ? { indice: it.i, nombre: it.nombre, contrario } : { indice: null, nombre: null, contrario }
  }, [f.tipo, f.movimiento_id, itemsMedibles, etiquetas])

  /**
   * La meta nace con todo lo que el test ya sabía: movimiento, lado, test e ítem.
   *
   * Lo único que queda por decidir es CUÁNTO se quiere mejorar, que es lo único que no
   * puede saber nadie más que quien trata al paciente. Todo lo demás se puede cambiar
   * igual, pero viene puesto.
   */
  /**
   * @param pre Bloque desde el que se abre. Al pulsar "Cambiar meta" en una medición
   *   concreta, el formulario tiene que llegar con ESA medición, no con la que dedujo el
   *   origen: si no, el botón del segundo ítem editaba el primero.
   */
  function abrir(pre?: { movimiento_id?: string, test_id?: string, item_indice?: any, lado?: string }) {
    const o = origen
    const movValido = pre?.movimiento_id
      || (o?.mov && movimientos.some((m: any) => m.id === o.mov) ? o.mov : '')
    const conTest = pre?.test_id ? true : !!o?.conItem
    setF({
      movimiento_id: movValido || movimientos[0]?.id || '',
      lado: pre?.lado || o?.lado || 'bilateral',
      tipo: 'mejorar',
      test_id: pre?.test_id || (conTest ? o!.test_id : ''),
      item_indice: pre?.item_indice != null ? String(pre.item_indice) : (conTest ? String(o!.item_indice) : ''),
      item_par_indice: '', valor_inicial: '', meta_pct: '20', meta_valor: '',
      manual: false, desdeTest: conTest,
      // Las dos de golpe por defecto cuando hay dos lados medidos: es lo que se quiere
      // casi siempre y desmarcarlo es un clic.
      ambos: true, partidaTocada: false, abrirEleccion: false,
    })
    setModal(true)
  }

  async function guardar() {
    if (!f.test_id || f.item_indice === '') { alert('Elige el test y el ítem que la miden'); return }
    if (f.tipo === 'igualar_par' && f.item_par_indice === '') { alert('Elige el ítem del movimiento contrario'); return }
    setGuardando(true)

    // Un lado o los dos. Cuando son los dos, CADA META ARRANCA DE SU PROPIA MEDICIÓN: un
    // solo número tecleado no puede ser el punto de partida de dos lados que miden
    // distinto, y usarlo para ambos daría por mejorado lo que no ha cambiado.
    const destinos = creandoAmbos
      ? lateralesConDato.map(x => ({ lado: x.lado, partida: x.valor }))
      : [{ lado: f.lado, partida: f.valor_inicial !== '' ? Number(f.valor_inicial) : (ultimoValor ?? null) }]

    const filas = destinos.map(d => ({
      paciente_id: pacienteId,
      objetivo_id: objetivo.id,
      movimiento_id: f.movimiento_id || null,
      lado: d.lado,
      tipo: f.tipo,
      unidad: unidad || null,
      valor_inicial: d.partida,
      meta_pct: f.tipo === 'mejorar' && f.meta_valor === '' && f.meta_pct !== '' ? Number(f.meta_pct) : null,
      meta_valor: f.tipo === 'mejorar' && f.meta_valor !== '' ? Number(f.meta_valor) : null,
      test_id: f.test_id,
      item_indice: Number(f.item_indice),
      item_par_indice: f.tipo === 'igualar_par' && f.item_par_indice !== '' ? Number(f.item_par_indice) : null,
    }))

    /**
     * Una sola meta por objetivo + movimiento + lado.
     *
     * Guardar insertaba siempre, así que volver a poner la meta del izquierdo dejaba dos
     * filas del izquierdo conviviendo: la vieja —a veces cerrada a mano, que ya no se
     * evalúa— y la nueva. En pantalla salían las dos y parecía un fallo de pintado, pero
     * el problema estaba en la base: dos verdades para el mismo lado del mismo gesto.
     *
     * Si ya existe, se REESCRIBE. Es lo que se espera al pulsar "Cambiar meta", y de paso
     * limpia la marca de cerrada a mano: si estás poniéndole objetivo nuevo, es que ya no
     * la das por buena.
     */
    let error: any = null
    for (const fila of filas) {
      const ya = (metas as any[]).find(m =>
        m.objetivo_id === fila.objetivo_id &&
        (m.movimiento_id || null) === (fila.movimiento_id || null) &&
        m.lado === fila.lado)
      const r = ya
        ? await supabase.from('objetivos_metas')
            .update({ ...fila, cumplida: false, cerrada_a_mano: false, fecha_cumplida: null })
            .eq('id', ya.id)
        : await supabase.from('objetivos_metas').insert(fila)
      if (r.error) { error = r.error; break }
    }
    setGuardando(false)
    if (error) { alert(error.message); return }
    // `revisarMetas` y no `revisarObjetivos`: la meta acaba de nacer con la marca de
    // cumplida a false, así que hay que EVALUARLA contra las mediciones. Si se crea sobre
    // un valor que ya la cumple, tiene que cerrarse ahora y no esperar al siguiente test.
    await revisarMetas(pacienteId)
    setModal(false); onCambio()
  }

  const LADOS = [['bilateral', 'Bilateral'], ['izquierdo', 'Izquierdo'], ['derecho', 'Derecho']] as const

  /** ¿Hay metas de más de un movimiento? Decide si la fila necesita repetirlo. */
  const variosMov = new Set(metas.map((m: any) => m.movimiento_id).filter(Boolean)).size > 1

  /**
   * Las metas agrupadas POR MOVIMIENTO, con sus lados dentro.
   *
   * Izquierdo y derecho del mismo gesto son dos filas en la base pero UNA sola cosa en la
   * cabeza de quien trata: lo que se mira es la diferencia entre ellos. En filas separadas
   * había que compararlos de memoria y se perdía justo el dato importante.
   *
   * El orden de los lados es fijo —izquierdo, derecho, bilateral— y no el de creación: si
   * bailan de sitio entre un objetivo y otro, comparar de un vistazo deja de funcionar.
   */
  const ORDEN_LADO: Record<string, number> = { izquierdo: 0, derecho: 1, bilateral: 2 }
  const gruposPorMovimiento = useMemo(() => {
    const mapa: Record<string, any> = {}
    for (const m of metas as any[]) {
      const clave = m.movimiento_id || 'sin'
      if (!mapa[clave]) mapa[clave] = { clave, nombre: m.movimiento_id ? nombreEt(m.movimiento_id) : 'Meta', metas: [] }
      mapa[clave].metas.push(m)
    }
    return Object.values(mapa).map((g: any) => {
      g.todasCumplidas = g.metas.every((m: any) => estadoDeMeta(m, resultados).cumplida || m.cumplida)

      /**
       * Dentro del movimiento, un BLOQUE por medición: test + ítem.
       *
       * Izquierdo y derecho van juntos porque son la misma medida en los dos lados, y lo
       * que interesa es la diferencia. Pero dos ítems distintos —el lunge en bipedestación
       * y el lunge con alza— NO son comparables entre sí, y ponerlos en la misma fila
       * hacía leer como pareja lo que son dos mediciones separadas. Esos van uno debajo
       * del otro.
       */
      const bloques: Record<string, any> = {}
      for (const m of g.metas as any[]) {
        const clave = `${m.test_id}:${m.item_indice}`
        if (!bloques[clave]) {
          const t = tests.find((x: any) => x.id === m.test_id)
          const it = (t?.items || [])[Number(m.item_indice)]
          bloques[clave] = {
            clave, test_id: m.test_id, item_indice: m.item_indice,
            titulo: [t?.nombre, it?.nombre].filter(Boolean).join(' · '),
            metas: [],
          }
        }
        bloques[clave].metas.push(m)
      }

      g.bloques = Object.values(bloques).map((b: any) => {
        b.metas.sort((x: any, y: any) => (ORDEN_LADO[x.lado] ?? 9) - (ORDEN_LADO[y.lado] ?? 9))
        /**
         * Lados MEDIDOS de ESTE ítem que todavía no tienen meta.
         *
         * Solo se proponen lados de la misma familia que los que ya hay: si las metas son
         * de izquierdo y derecho, un resultado guardado como "bilateral" es basura de un
         * registro mal hecho, y ofrecerlo como lado que falta invita a repetir el error.
         */
        const conMeta = new Set(b.metas.map((m: any) => m.lado))
        const lateral = b.metas.some((m: any) => m.lado === 'izquierdo' || m.lado === 'derecho')
        const medidos = new Set<string>()
        for (const r of resultados) {
          if (r.test_id !== b.test_id) continue
          const it = (r.items_resultado || [])[Number(b.item_indice)]
          const v = it ? parseFloat(valorDe(it)) : NaN
          if (!Number.isFinite(v)) continue
          const l = r.lado || 'bilateral'
          if (lateral && l === 'bilateral') continue
          medidos.add(l)
        }
        b.sinMeta = Array.from(medidos).filter(l => !conMeta.has(l))
          .sort((x, y) => (ORDEN_LADO[x] ?? 9) - (ORDEN_LADO[y] ?? 9))
        b.todasCumplidas = b.metas.every((m: any) => estadoDeMeta(m, resultados).cumplida || m.cumplida)
        return b
      })
      return g
    })
  }, [metas, resultados, etiquetas, tests])

  /** Borrar el movimiento entero: las metas de los dos lados se van juntas. */
  async function borrarGrupo(g: any) {
    const n = g.metas.length
    if (!confirm(n > 1 ? `¿Quitar las ${n} metas de ${g.nombre}?` : '¿Quitar esta meta?')) return
    for (const m of g.metas) await supabase.from('objetivos_metas').delete().eq('id', m.id)
    // Quitar la única meta abierta puede dejar el objetivo cumplido, o quitar la última
    // de todas puede dejarlo sin nada que lo cierre. Las dos hay que recalcularlas.
    await revisarObjetivos(pacienteId)
    onCambio()
  }

  return (
    <div style={{ marginTop: 7 }}>
      {metas.length > 0 && (
        <div style={{ display: 'grid', gap: 6, marginBottom: 7 }}>
          {gruposPorMovimiento.map(g => (
            <div key={g.clave} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 9px', background: 'var(--bl)', borderRadius: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {variosMov && (
                  <div style={{ fontSize: 12, color: 'var(--n)', marginBottom: 3 }}>{g.nombre}</div>
                )}
                {/* Un bloque por medición, APILADOS. Dentro, los dos lados en horizontal:
                    esos sí son comparables entre sí, los ítems distintos no. */}
                {g.bloques.map((b: any, bi: number) => (
                <div key={b.clave} style={{ marginTop: bi > 0 ? 8 : 0, paddingTop: bi > 0 ? 8 : 0, borderTop: bi > 0 ? '1px solid var(--bd)' : 'none', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                {/* De qué medición sale este bloque: el test y el ítem exactos. Sustituye a
                    las píldoras de abajo, que decían lo mismo peor y sin decir de cuál. */}
                {b.titulo && <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 3 }}>{b.titulo}</div>}
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {b.metas.map((m: any) => {
                    const e = estadoDeMeta(m, resultados)
                    const cumplida = e.cumplida || m.cumplida
                    const pct = e.progreso != null ? Math.round(e.progreso * 100) : null
                    return (
                      <div key={m.id} style={{ minWidth: 118 }}>
                        {/* El lado, legible. En gris claro y a 11 px no se veía, y es lo
                            primero que hay que distinguir de un vistazo. */}
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .4, textTransform: 'uppercase', color: 'var(--gr)' }}>{m.lado}</div>
                        <div style={{ fontSize: 12, color: cumplida ? 'var(--gd)' : 'var(--n)' }}>{e.texto}</div>
                        {/* La barra llevaba el porcentaje al lado desde nunca: se veía una
                            barra a medias sin decir de qué. */}
                        {pct != null && !cumplida && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                            <span style={{ flex: 1, height: 5, background: 'var(--bm)', borderRadius: 3, overflow: 'hidden' }}>
                              <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--g)' }} />
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--gr)' }}>{pct}%</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {/* Lados medidos que se quedaron sin meta. Se pulsan y se crean. */}
                  {b.sinMeta.map((l: string) => (
                    <button key={l} type="button"
                      onClick={() => abrir({ movimiento_id: g.clave !== 'sin' ? g.clave : '', test_id: b.test_id, item_indice: b.item_indice, lado: l })}
                      title="Se midió este lado pero no tiene meta. Pulsa para ponérsela."
                      style={{ minWidth: 118, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .4, textTransform: 'uppercase', color: 'var(--grl)' }}>{l}</div>
                      <div style={{ fontSize: 12, color: '#8A6410' }}>Medido, sin meta</div>
                    </button>
                  ))}
                </div>
                </div>
                {/* Los botones van EN CADA BLOQUE, no en el movimiento. Arriba editaban
                    siempre la primera medición: con dos ítems, el botón del segundo tocaba
                    el del primero. Actúan sobre los dos lados de SU medición. */}
                <button className="btn btn-t btn-sm" style={{ flexShrink: 0 }}
                  onClick={() => abrir({ movimiento_id: g.clave !== 'sin' ? g.clave : '', test_id: b.test_id, item_indice: b.item_indice })}>
                  Cambiar meta
                </button>
                <button className="et-b" style={{ flexShrink: 0 }}
                  title={b.todasCumplidas ? 'Reabrir esta medición' : 'Dar por corregida esta medición'}
                  onClick={async () => {
                    for (const m of b.metas) await cerrarMetaAMano(m.id, !b.todasCumplidas)
                    await revisarObjetivos(pacienteId)
                    onCambio()
                  }}>
                  <Ic name={b.todasCumplidas ? 'check' : 'checkbox'} size={13} />
                </button>
                <button className="et-b et-b-r" style={{ flexShrink: 0 }}
                  title={b.metas.length > 1 ? 'Quitar las metas de los dos lados' : 'Quitar la meta'}
                  onClick={() => borrarGrupo({ ...b, nombre: g.nombre })}>
                  <Ic name="papelera" size={12} />
                </button>
                </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}


      {/* Solo cuando no hay ninguna. Con metas puestas, lo que falta se añade desde su
          sitio —el lado en ámbar, o "Cambiar meta"— y un botón suelto abajo solo servía
          para crear metas sueltas sin saber de qué medición salían. */}
      {metas.length === 0 && (
        <button className="btn btn-t btn-sm" onClick={() => abrir()}>
          <Ic name="mas" size={12} /> Añadir meta
        </button>
      )}

      {modal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget && !guardando) setModal(false) }}>
          <div className="modal">
            <div className="modal-title">
              Meta de {objetivo.nombre}
              <button className="modal-close" onClick={() => setModal(false)}><Ic name="cerrar" size={15} /></button>
            </div>

            {/*
              LO QUE EL TEST YA DECIDIÓ NO SE PREGUNTA.

              El ítem abrió ESTE objetivo, para ESTE movimiento y sobre ESTE lado. Volver a
              preguntarlo aquí no es dar opciones: es invitar a contestar distinto de lo que
              se midió, y entonces la meta queda evaluándose contra un número que no es el
              suyo. Se enseña lo decidido y, si de verdad hay que cambiarlo, se abre.
            */}
            {(movFijado || ladoFijado) && (
              <div className="fila-p" style={{ borderLeftColor: 'var(--g)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 13, color: 'var(--n)' }}>
                    {movFijado ? nombreEt(f.movimiento_id) : objetivo.nombre}
                    {ladoFijado && f.tipo !== 'igualar_lados' && (creandoAmbos
                      ? <span style={{ color: 'var(--gd)' }}> · los dos lados</span>
                      : <span style={{ color: 'var(--gr)' }}> · {f.lado}</span>)}
                  </b>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--gr)', marginTop: 2 }}>
                    Lo dijo {origen!.etiqueta}
                    {movFijado && <> · el movimiento lo fija la medición</>}
                  </span>
                </span>
                {/* Solo el lado. El movimiento se cambia soltando la medición, abajo. */}
                {ladoFijado && f.tipo !== 'igualar_lados' && (
                  <button className="btn btn-t btn-sm" style={{ flexShrink: 0 }}
                    onClick={() => setF((p: any) => ({ ...p, abrirEleccion: true }))}>
                    Cambiar lado
                  </button>
                )}
              </div>
            )}

            {!movFijado && movimientos.length > 0 && (
              <div className="field"><label>Movimiento</label>
                {/* Cambiar de movimiento a mano deshace lo que puso el test: el ítem que
                    medía la dorsiflexión no mide la flexión plantar. A partir de ahí manda
                    la correspondencia deducida, que es la que sí sigue al movimiento. */}
                <select className="input" value={f.movimiento_id}
                  onChange={e => setF((p: any) => ({
                    ...p, movimiento_id: e.target.value,
                    desdeTest: p.desdeTest && e.target.value === origen?.mov,
                  }))}>
                  {movimientos.map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
                {/* Que este selector aparezca no es normal: significa que el ítem del test
                    no tiene dicho qué movimiento mide. Se dice UNA vez en la biblioteca y
                    deja de preguntarse en todos los pacientes; callarlo aquí haría que se
                    siguiera contestando a mano para siempre. */}
                {origen && (
                  <div style={{ fontSize: 12, color: '#8A6410', marginTop: 4 }}>
                    {origen.etiqueta} no dice qué movimiento mide, por eso hay que elegirlo.
                    Ponlo en Biblioteca → Tests, en ese ítem, y deja de preguntarse aquí.
                  </div>
                )}
              </div>
            )}

            {/* En "igualar lados" el lado no significa nada: la comparación es simétrica,
                mide la diferencia entre los dos. Pedir un dato que no cambia el resultado
                hace pensar que sí lo cambia. */}
            {!ladoFijado && f.tipo !== 'igualar_lados' && (
              <div className="field">
                <label>Lado{origen?.lado === f.lado && <span style={{ fontWeight: 400, color: 'var(--gd)' }}> · el que se midió</span>}</label>
                <div style={{ display: 'flex', gap: 4, opacity: creandoAmbos ? .45 : 1, pointerEvents: creandoAmbos ? 'none' : 'auto' }}>
                  {LADOS.map(([v, l]) => (
                    <button key={v} className={`chip-sel ${f.lado === v ? 'on' : ''}`}
                      onClick={() => setF((p: any) => ({ ...p, lado: v }))}>{l}</button>
                  ))}
                </div>
              </div>
            )}

            {/* El test se pasó en los dos lados: se ofrecen las dos metas de una vez. Va
                fuera del selector de lado porque también aplica cuando ese selector está
                escondido, que es el caso normal. */}
            {puedeAmbos && f.tipo !== 'igualar_lados' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9, fontSize: 12, color: 'var(--gr)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!f.ambos}
                  onChange={e => setF((p: any) => ({ ...p, ambos: e.target.checked }))} />
                Poner la meta en los <b>dos lados</b>, cada uno desde su medición
              </label>
            )}

            <div className="field"><label>Qué se busca</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {TIPOS_META.map(t => (
                  <button key={t.id} className={`chip-sel ${f.tipo === t.id ? 'on' : ''}`} title={t.ayuda}
                    onClick={() => setF((p: any) => ({ ...p, tipo: t.id }))}>{t.nombre}</button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 4 }}>
                {TIPOS_META.find(t => t.id === f.tipo)?.ayuda}
              </div>
            </div>

            {/* Obligatorio: una meta que nadie mide es una intención con un número.
                Pero ya no se pregunta si la app puede resolverlo sola. */}
            <div className="field"><label>Se mide con</label>
              {medicion && !f.manual ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--gl)', borderRadius: 'var(--r)' }}>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--n)' }}>
                    {medicion.nombre} <span style={{ color: 'var(--gr)' }}>›</span> {medicion.item.nombre}
                    <span style={{ color: 'var(--gr)' }}> · {unidadDe(medicion.item).nombre.toLowerCase()}</span>
                  </span>
                  {/* Sin "Cambiar" cuando la medición viene del test que abrió el objetivo:
                      ese test es el que se pasó y el que tiene los números. Cambiarlo sería
                      poner la meta sobre algo que a este paciente nadie le ha medido.
                      Solo se ofrece cuando la medición es una deducción nuestra. */}
                  {!f.desdeTest && (
                    <button className="btn btn-t btn-sm" onClick={() => setF((p: any) => ({ ...p, manual: true }))}>
                      Cambiar
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {!medicion && f.movimiento_id && (
                    <div style={{ fontSize: 12, color: '#8A6410', marginBottom: 5 }}>
                      No hay ningún test de esta zona con un ítem que mida ese movimiento. Elígelo a mano
                      o crea la medición en Biblioteca → Tests.
                    </div>
                  )}
                  <select className="input" value={f.test_id}
                    onChange={e => setF((p: any) => ({ ...p, test_id: e.target.value, item_indice: '', item_par_indice: '' }))}>
                    <option value="">— Elige el test —</option>
                    {tests.filter((t: any) => (t.items || []).some((i: any) => unidadDe(i).id !== ''))
                      // Los de la zona del objetivo primero: ofrecer "Cadera · fuerza" para
                      // un hombro es ruido que además invita a equivocarse.
                      .sort((a: any, b: any) => {
                        const za = (a.etiquetas_relacionadas || []).includes(objetivo.articulacion_id) ? 0 : 1
                        const zb = (b.etiquetas_relacionadas || []).includes(objetivo.articulacion_id) ? 0 : 1
                        return za - zb || a.nombre.localeCompare(b.nombre)
                      })
                      .map((t: any) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                  {f.test_id && (
                    <select className="input" style={{ marginTop: 5 }} value={f.item_indice}
                      onChange={e => setF((p: any) => ({ ...p, item_indice: e.target.value }))}>
                      <option value="">— Qué ítem —</option>
                      {itemsMedibles.map(it => (
                        <option key={it.i} value={it.i}>{it.nombre} ({unidadDe(it).nombre.toLowerCase()})</option>
                      ))}
                    </select>
                  )}
                  {f.test_id && itemsMedibles.length === 0 && (
                    <div style={{ fontSize: 12, color: '#8A6410', marginTop: 4 }}>
                      Este test no tiene ningún ítem con unidad, así que no puede medir una meta.
                    </div>
                  )}
                </>
              )}
            </div>

            {f.tipo === 'igualar_par' && f.test_id && (
              <div className="field"><label>Ítem del movimiento contrario *</label>
                <select className="input" value={f.item_par_indice}
                  onChange={e => setF((p: any) => ({ ...p, item_par_indice: e.target.value }))}>
                  <option value="">— Elige —</option>
                  {itemsMedibles.filter(it => String(it.i) !== String(f.item_indice))
                    .map(it => <option key={it.i} value={it.i}>{it.nombre}</option>)}
                </select>
                {parSugerido && (
                  <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 4 }}>
                    El contrario de este movimiento es <b>{parSugerido.contrario}</b>
                    {parSugerido.nombre
                      ? <>. Parece que es «{parSugerido.nombre}».</>
                      : <>, pero no encuentro un ítem que lo mida en este test.</>}
                  </div>
                )}
              </div>
            )}

            {f.tipo === 'mejorar' && (
              <>
                <div className="field"><label>Punto de partida{unidad ? ` (${unidad})` : ''}</label>
                  {creandoAmbos ? (
                    // Con dos metas no hay UN punto de partida que teclear: cada lado
                    // arranca del suyo. Se enseñan los dos para que se vea de dónde sale.
                    <div style={{ display: 'flex', gap: 6 }}>
                      {lateralesConDato.map(x => (
                        <div key={x.lado} style={{ flex: 1, padding: '7px 10px', background: 'var(--gl)', borderRadius: 'var(--r)', fontSize: 13 }}>
                          <span style={{ color: 'var(--gr)', textTransform: 'capitalize' }}>{x.lado}</span>
                          <b style={{ marginLeft: 6 }}>{x.valor}{unidad ? ' ' + unidad : ''}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <input className="input" type="number" value={f.valor_inicial}
                      onChange={e => setF((p: any) => ({ ...p, valor_inicial: e.target.value, partidaTocada: true }))}
                      placeholder={ultimoValor != null ? String(ultimoValor) : 'Sin medición previa'} />
                  )}
                  <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 3 }}>
                    {creandoAmbos
                      ? <>Lo medido en cada lado. Si quieres cambiar alguno a mano, quita «los dos lados» y ponlos por separado.</>
                      : ultimoValor != null
                        ? <>Puesto lo último medido. Cámbialo si el punto de partida bueno es otro.</>
                        : 'Todavía no hay medición de este ítem. Sin punto de partida, un porcentaje no se puede calcular y la meta quedará esperando a la primera.'}
                  </div>
                </div>
                <div className="field"><label>Meta</label>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                    <input className="input" type="number" value={f.meta_pct} style={{ width: 90 }}
                      onChange={e => setF((p: any) => ({ ...p, meta_pct: e.target.value, meta_valor: '' }))} />
                    <span style={{ fontSize: 13, color: 'var(--gr)' }}>% de mejora</span>
                    <span style={{ fontSize: 13, color: 'var(--grl)' }}>o</span>
                    <input className="input" type="number" value={f.meta_valor} style={{ width: 90 }}
                      placeholder="valor" onChange={e => setF((p: any) => ({ ...p, meta_valor: e.target.value, meta_pct: '' }))} />
                    <span style={{ fontSize: 13, color: 'var(--gr)' }}>{unidad}</span>
                  </div>
                </div>
              </>
            )}

            {f.tipo !== 'mejorar' && (
              <div className="fila-p" style={{ borderLeftColor: 'var(--bd)' }}>
                <span style={{ fontSize: 13, color: 'var(--gr)' }}>
                  Compara las dos mediciones y se da por cumplida cuando la diferencia baja del 10%. No hace falta decir cuál es la más débil: eso lo dicen los números.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-t btn-sm" onClick={() => setModal(false)} disabled={guardando}>Cancelar</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-p" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : (creandoAmbos ? 'Añadir las dos metas' : 'Añadir meta')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
