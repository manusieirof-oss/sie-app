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

/** Orden fijo de los lados. Si bailan de sitio, comparar de un vistazo deja de funcionar. */
const ORDEN_LADO: Record<string, number> = { izquierdo: 0, derecho: 1, bilateral: 2 }

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

  /**
   * LOS LADOS DEL FORMULARIO. No hay casilla que marcar ni selector: las columnas son los
   * lados que se han medido de esta medición, y punto.
   *
   * Si se abre desde un lado concreto —el ámbar de "medido, sin meta"— solo sale ese.
   */
  const destinos = useMemo(() => {
    /**
     * O BILATERAL, O IZQUIERDO Y DERECHO. Nunca los tres.
     *
     * Salían las tres columnas porque en los resultados hay mediciones guardadas como
     * "bilateral" —las de cuando el test no obligaba a elegir lado— conviviendo con las
     * buenas. Son el mismo tobillo contado dos veces, y poner meta a las tres deja al
     * objetivo esperando a una que nadie va a volver a medir.
     *
     * Manda la ficha del test: si es lateral, bilateral no existe y al revés. Si la ficha
     * no lo dice, gana lo lateral, que es lo más específico.
     */
    const esLateral = testSel?.tipo_lado
      ? testSel.tipo_lado === 'lateral'
      : ladosConDato.some(x => x.lado === 'izquierdo' || x.lado === 'derecho')

    const base = ladosConDato
      .filter(x => esLateral ? x.lado !== 'bilateral' : x.lado === 'bilateral')
      .map(x => ({ lado: x.lado, medido: x.valor }))
      .sort((a, b) => (ORDEN_LADO[a.lado] ?? 9) - (ORDEN_LADO[b.lado] ?? 9))
    return f.soloLado ? base.filter(d => d.lado === f.soloLado) : base
  }, [ladosConDato, f.soloLado, testSel])

  /** A qué número hay que llegar en ese lado. Es lo que luego evalúa `estadoDeMeta`. */
  const objetivoDe = (d: any): number | null => {
    const val = f.valor?.[d.lado]
    if (val !== '' && val != null) return Number(val)
    const p = f.partida?.[d.lado]
    const base = (p !== '' && p != null) ? Number(p) : d.medido
    const pct = f.pct?.[d.lado]
    if (!base || pct === '' || pct == null) return null
    return Math.round(base * (1 + Number(pct) / 100) * 10) / 10
  }

  /**
   * El punto de partida se rellena con lo medido de CADA lado, y el % con el 20 por
   * defecto. Se deja de tocar en cuanto el usuario escribe algo.
   */
  const claveDestinos = destinos.map(d => `${d.lado}:${d.medido}`).join('|')
  useEffect(() => {
    if (f.partidaTocada) return
    const partida: any = {}, pct: any = {}
    for (const d of destinos) {
      partida[d.lado] = d.medido != null ? String(d.medido) : ''
      pct[d.lado] = '20'
    }
    setF((p: any) => ({ ...p, partida, pct, valor: {} }))
  }, [claveDestinos, f.partidaTocada])

  /**
   * Si el test se pasó en los dos lados, se ofrecen las dos metas de una vez.
   *
   * Ya no hay casilla de "los dos lados" ni selector: el formulario enseña UNA COLUMNA
   * POR LADO MEDIDO, así que poner los dos es lo que pasa por defecto y no hay nada que
   * marcar. Tampoco se pregunta el movimiento: lo fija la medición, y cambiarlo dejaría la
   * meta evaluándose contra números de otro gesto.
   */

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
      // `soloLado` limita el formulario a una columna. Se usa al entrar desde el lado en
      // ámbar: ahí se quiere ese lado y no tocar el que ya tiene meta.
      soloLado: pre?.lado || '',
      lado: pre?.lado || o?.lado || 'bilateral',
      tipo: 'mejorar',
      test_id: pre?.test_id || (conTest ? o!.test_id : ''),
      item_indice: pre?.item_indice != null ? String(pre.item_indice) : (conTest ? String(o!.item_indice) : ''),
      item_par_indice: '',
      manual: false, desdeTest: conTest,
      // Los valores por lado los rellena el efecto en cuanto se sepan las columnas.
      partida: {}, pct: {}, valor: {}, partidaTocada: false,
    })
    setModal(true)
  }

  async function guardar() {
    if (!f.test_id || f.item_indice === '') { alert('Elige el test y el ítem que la miden'); return }
    if (f.tipo === 'igualar_par' && f.item_par_indice === '') { alert('Elige el ítem del movimiento contrario'); return }
    setGuardando(true)

    // UNA FILA POR COLUMNA DEL FORMULARIO, cada una con SU partida y SU meta. Un tobillo a
    // 3 cm y el otro a 10 no comparten ni de dónde salen ni adónde van, y compartir el
    // porcentaje daba por mejorado lo que no había cambiado.
    const filas = destinos.map((d: any) => {
      const p = f.partida?.[d.lado]
      const partida = (p !== '' && p != null) ? Number(p) : (d.medido ?? null)
      const val = f.valor?.[d.lado]
      const pct = f.pct?.[d.lado]
      return {
        paciente_id: pacienteId,
        objetivo_id: objetivo.id,
        movimiento_id: f.movimiento_id || null,
        lado: d.lado,
        tipo: f.tipo,
        unidad: unidad || null,
        valor_inicial: partida,
        meta_pct: f.tipo === 'mejorar' && (val === '' || val == null) && pct !== '' && pct != null ? Number(pct) : null,
        meta_valor: f.tipo === 'mejorar' && val !== '' && val != null ? Number(val) : null,
        test_id: f.test_id,
        item_indice: Number(f.item_indice),
        item_par_indice: f.tipo === 'igualar_par' && f.item_par_indice !== '' ? Number(f.item_par_indice) : null,
      }
    })
    if (filas.length === 0) { setGuardando(false); alert('No hay ningún lado medido al que ponerle meta'); return }

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
        // Igual que en el formulario: manda la ficha del test, y si no lo dice, lo lateral.
        const tLado = tests.find((x: any) => x.id === b.test_id)?.tipo_lado
        const lateral = tLado
          ? tLado === 'lateral'
          : b.metas.some((m: any) => m.lado === 'izquierdo' || m.lado === 'derecho')
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
                {/* Al mismo peso que el check y la papelera: es una acción más de la fila,
                    no la principal, y como botón grande se comía la medición. */}
                <button className="et-b" style={{ flexShrink: 0 }} title="Cambiar la meta de esta medición"
                  onClick={() => abrir({ movimiento_id: g.clave !== 'sin' ? g.clave : '', test_id: b.test_id, item_indice: b.item_indice })}>
                  <Ic name="editar" size={13} />
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
          {/* Más ancho: con una columna por lado, el modal estrecho partía cada campo en
              dos líneas y no se podían comparar los dos lados de un vistazo. */}
          <div className="modal" style={{ maxWidth: 620, width: '100%' }}>
            <div className="modal-title">
              {/* El movimiento va en el título. Antes iba en un bloque aparte debajo, con
                  su texto y su botón, que es lo que sobraba. */}
              Meta de {objetivo.nombre}
              {nombreEt(f.movimiento_id) && <span style={{ color: 'var(--gr)' }}> · {nombreEt(f.movimiento_id)}</span>}
              <button className="modal-close" onClick={() => setModal(false)}><Ic name="cerrar" size={15} /></button>
            </div>

            {/*
              QUÉ SE BUSCA. Lo primero porque cambia todo lo de abajo: en las dos de
              "igualar" no hay número que poner, lo pone la comparación.
            */}
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

            {/*
              UNA COLUMNA POR LADO, con su punto de partida y su meta debajo.

              El punto de partida y la meta son datos DEL LADO, no del objetivo: un tobillo
              a 3 cm y el otro a 10 no comparten ni de dónde salen ni adónde van. Estaban
              en un solo par de campos y obligaban a poner el mismo porcentaje a los dos.

              Si solo se midió un lado, sale una columna. No hay nada que elegir ni casilla
              que marcar: las columnas son los lados que existen.
            */}
            {f.tipo === 'mejorar' ? (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, destinos.length)},1fr)`, gap: 10 }}>
                {destinos.map((d: any) => (
                  <div key={d.lado} style={{ border: '1px solid var(--bd)', borderRadius: 'var(--r)', padding: '9px 11px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .4, textTransform: 'uppercase', color: 'var(--gr)', marginBottom: 7 }}>
                      {d.lado}
                    </div>

                    <label style={{ fontSize: 11, color: 'var(--grl)' }}>Punto de partida{unidad ? ` (${unidad})` : ''}</label>
                    <input className="input" type="number" style={{ marginTop: 2 }}
                      value={f.partida?.[d.lado] ?? ''}
                      placeholder={d.medido != null ? String(d.medido) : 'Sin medir'}
                      onChange={e => setF((p: any) => ({ ...p, partida: { ...(p.partida || {}), [d.lado]: e.target.value } }))} />

                    <label style={{ fontSize: 11, color: 'var(--grl)', display: 'block', marginTop: 8 }}>Meta</label>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 2 }}>
                      <input className="input" type="number" style={{ width: 62 }}
                        value={f.pct?.[d.lado] ?? ''}
                        onChange={e => setF((p: any) => ({
                          ...p,
                          pct: { ...(p.pct || {}), [d.lado]: e.target.value },
                          valor: { ...(p.valor || {}), [d.lado]: '' },
                        }))} />
                      <span style={{ fontSize: 12, color: 'var(--gr)' }}>%</span>
                      <span style={{ fontSize: 12, color: 'var(--grl)' }}>o</span>
                      <input className="input" type="number" style={{ width: 62 }} placeholder="valor"
                        value={f.valor?.[d.lado] ?? ''}
                        onChange={e => setF((p: any) => ({
                          ...p,
                          valor: { ...(p.valor || {}), [d.lado]: e.target.value },
                          pct: { ...(p.pct || {}), [d.lado]: '' },
                        }))} />
                      <span style={{ fontSize: 12, color: 'var(--gr)' }}>{unidad}</span>
                    </div>

                    {/* A dónde llega, en el número que se va a comparar. Un "+20%" no dice
                        nada hasta que lo ves en centímetros. */}
                    <div style={{ fontSize: 12, color: 'var(--gd)', marginTop: 5, minHeight: 16 }}>
                      {objetivoDe(d) != null
                        ? <>Llegar a <b>{objetivoDe(d)}{unidad ? ' ' + unidad : ''}</b></>
                        : <span style={{ color: 'var(--grl)' }}>Falta el punto de partida</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="fila-p" style={{ borderLeftColor: 'var(--bd)' }}>
                <span style={{ fontSize: 13, color: 'var(--gr)' }}>
                  Compara las dos mediciones y se da por cumplida cuando la diferencia baja del 10%. No hace falta decir cuál es la más débil: eso lo dicen los números.
                </span>
              </div>
            )}

            {destinos.length === 0 && (
              <div style={{ fontSize: 12, color: '#8A6410', marginTop: 6 }}>
                Todavía no hay ninguna medición de este ítem, así que no hay de dónde partir.
                Pasa el test y vuelve.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-t btn-sm" onClick={() => setModal(false)} disabled={guardando}>Cancelar</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-p" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : (destinos.length > 1 ? `Guardar las ${destinos.length} metas` : 'Guardar la meta')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
