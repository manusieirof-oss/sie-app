'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { SEMILLA } from '@/lib/semillaEjercicios'
import { subirImagenEjercicio, subirImagenVariante } from '@/lib/ejercicios'

/**
 * Alta en bloque del catálogo inicial de ejercicios.
 *
 * Va como página de la app y no como script de Node por una razón concreta: en
 * `.env.local` solo está la clave anónima, así que un script externo chocaría con las
 * políticas RLS. Aquí se ejecuta con tu sesión ya iniciada, y de paso reutiliza la
 * compresión de imágenes del navegador, que en Node no existe.
 *
 * Es idempotente: si un ejercicio ya está por nombre, lo salta. Se puede relanzar.
 */

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/**
 * REGLA DE TODOS LOS SEMBRADORES: no se pisa nada que ya tenga contenido.
 *
 * Un sembrador está para dar de alta lo que falta, no para deshacer lo que se haya hecho
 * después a mano. Si un campo ya tiene valor, se respeta; si está vacío, se rellena.
 */
const vacio = (v: any) => v == null || v === '' || (Array.isArray(v) && v.length === 0)
function soloHuecos(campos: any, actual: any, nuncaTocar: string[] = []) {
  const salida: any = {}
  for (const [k, v] of Object.entries(campos)) {
    if (nuncaTocar.includes(k)) continue
    if (vacio((actual || {})[k])) salida[k] = v
  }
  return salida
}

/** Sin la marca de plural, para que "Isquiotibiales" encuentre a "Isquiotibial". */
const raizNom = (s: string) => norm(s).replace(/(es|s)$/, '')

type Linea = { texto: string, estado: 'ok' | 'aviso' | 'error' | 'info' }
/** Etiqueta de la semilla que no existe, y en qué ejercicios se iba a usar. */
type Huerfana = { nombre: string, ejercicios: string[] }

export default function SembrarPage() {
  const [ficheros, setFicheros] = useState<File[]>([])
  const [log, setLog] = useState<Linea[]>([])
  const [corriendo, setCorriendo] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [huerfanas, setHuerfanas] = useState<Huerfana[] | null>(null)

  const anota = (texto: string, estado: Linea['estado'] = 'info') =>
    setLog(l => [...l, { texto, estado }])

  /**
   * Comprobación PREVIA de las etiquetas, al abrir la página.
   *
   * Antes esto solo se sabía después de sembrar, en una línea al final del registro que
   * era muy fácil pasar por alto: así se crearon ocho ejercicios de isquios sin la
   * etiqueta de isquios, porque la semilla la escribía en plural. El aviso tiene que
   * estar donde se toma la decisión, no en el recibo.
   */
  useEffect(() => { comprobar() }, [])

  async function comprobar() {
    const { data } = await supabase.from('etiquetas').select('nombre,categoria')
    const claves = new Set<string>()
    ;(data || []).forEach((e: any) => {
      claves.add(norm(e.nombre)); claves.add(raizNom(e.nombre))
      // También con la categoría delante, que es como la semilla desambigua los nombres
      // repetidos. Sin esto, este aviso marcaba como huérfanas las sesenta etiquetas
      // escritas como `agarre:Supino` —que sí existen— y avisaba de todo, que es igual
      // que no avisar de nada.
      claves.add(e.categoria + ':' + norm(e.nombre))
      claves.add(e.categoria + ':' + raizNom(e.nombre))
    })

    const clave = (n: string) => {
      if (!n.includes(':')) return [norm(n), raizNom(n)]
      const [cat, ...resto] = n.split(':')
      const x = resto.join(':').trim()
      return [cat.trim() + ':' + norm(x), cat.trim() + ':' + raizNom(x)]
    }

    const faltan: Record<string, string[]> = {}
    SEMILLA.forEach(s => s.etiquetas.forEach(nombre => {
      if (clave(nombre).some(k => claves.has(k))) return
      ;(faltan[nombre] ||= []).push(s.nombre)
    }))
    setHuerfanas(Object.entries(faltan).map(([nombre, ejercicios]) => ({ nombre, ejercicios })))
  }

  async function sembrar() {
    setCorriendo(true); setLog([]); setHecho(false)

    const porNombre: Record<string, File> = {}
    ficheros.forEach(f => { porNombre[f.name] = f })

    // Las etiquetas se buscan por nombre: el árbol de cada instalación es distinto.
    //
    // La búsqueda tolera el singular y el plural. La semilla decía "Isquiotibiales" y
    // "Mancuernas" y en la biblioteca están en singular, así que no las encontraba y las
    // omitía en silencio: ejercicios de isquios que se creaban sin la etiqueta de
    // isquios. Es un fallo que se repetiría con cada bloque nuevo, así que se arregla
    // aquí y no renombrando la semilla una vez.
    const { data: etiquetas } = await supabase.from('etiquetas').select('id,nombre,categoria')

    // Hay nombres repetidos en categorías distintas: "Rodilla" está en Apoyo y en
    // Articulación, "Dorsal" es vértebra y también músculo. La semilla solo dice el
    // nombre, así que sin un desempate la etiqueta que acabe puesta depende del orden
    // en que vuelvan las filas: un remo quedaría etiquetado con una vértebra.
    const PRIORIDAD = ['musculo', 'articulacion', 'movimiento', 'material', 'posicion', 'apoyo', 'agarre']
    const rango = (c: string) => { const i = PRIORIDAD.indexOf(c); return i < 0 ? 99 : i }

    const mejor: Record<string, { id: string, r: number }> = {}
    const poner = (clave: string, e: any) => {
      const r = rango(e.categoria)
      if (!mejor[clave] || r < mejor[clave].r) mejor[clave] = { id: e.id, r }
    }
    ;(etiquetas || []).forEach((e: any) => {
      poner(norm(e.nombre), e)
      // La forma sin plural va con rango peor, para que nunca gane a una exacta.
      if (raizNom(e.nombre) !== norm(e.nombre)) poner(raizNom(e.nombre) + '~', e)
    })
    /**
     * Índice aparte con la categoría delante: `agarre:supino`.
     *
     * Hay nombres que existen en varias categorías —Prono y Supino son posición Y agarre,
     * Mano y Rodilla son articulación Y apoyo— y la prioridad de arriba siempre resuelve a
     * la misma. Así "Supino" nunca podía significar el agarre. Con el prefijo se dice cuál
     * se quiere; sin él, todo sigue funcionando igual que antes.
     */
    const porCategoria: Record<string, string> = {}
    ;(etiquetas || []).forEach((e: any) => {
      porCategoria[e.categoria + ':' + norm(e.nombre)] = e.id
      porCategoria[e.categoria + ':' + raizNom(e.nombre)] ||= e.id
    })

    const buscarEt = (nombre: string) => {
      if (nombre.includes(':')) {
        const [cat, ...resto] = nombre.split(':')
        const n = resto.join(':').trim()
        return porCategoria[cat.trim() + ':' + norm(n)] || porCategoria[cat.trim() + ':' + raizNom(n)]
      }
      return mejor[norm(nombre)]?.id || mejor[raizNom(nombre) + '~']?.id || mejor[raizNom(nombre)]?.id
    }

    const { data: existentes } = await supabase.from('ejercicios')
      .select('id,nombre,descripcion,etiquetas,tipo_medida,items_ejecucion,feedbacks')
    const yaEstan = new Set((existentes || []).map((e: any) => norm(e.nombre)))

    let creados = 0, saltados = 0, sinImagen = 0, varianteImg = 0
    const sinImagenNombres: string[] = []
    const etiquetasNoEncontradas = new Set<string>()

    for (const s of SEMILLA) {
      const ids: string[] = []
      s.etiquetas.forEach(nombre => {
        const id = buscarEt(nombre)
        if (id) { if (!ids.includes(id)) ids.push(id) } else etiquetasNoEncontradas.add(nombre)
      })

      const campos = {
        nombre: s.nombre,
        descripcion: s.descripcion,
        etiquetas: ids,
        tipo_medida: s.tipo_medida,
        // El editor guarda los ítems como {texto}, no como cadenas sueltas.
        items_ejecucion: s.items_ejecucion.map(texto => ({ texto, objetivos: [] })),
        feedbacks: s.feedbacks.map(texto => ({ texto })),
      }

      // Si ya está, solo se rellenan sus HUECOS. Lo que tenga contenido —porque lo
      // escribiste tú o porque ya lo puso la semilla— se respeta.
      const existente = (existentes || []).find((e: any) => norm(e.nombre) === norm(s.nombre))
      let id: string

      if (existente) {
        const cambios = soloHuecos(campos, existente, ['nombre', 'etiquetas'])

        /**
         * LAS ETIQUETAS SE SUMAN, no se saltan ni se pisan.
         *
         * `soloHuecos` se saltaba el campo entero porque los ejercicios ya tenían
         * etiquetas, así que ninguna etiqueta nueva de la semilla llegaba nunca a un
         * ejercicio ya creado: categorías enteras —plano, eje, agarre— se quedaron a cero.
         *
         * Sustituirlas tampoco vale: borraría las que hayas puesto tú a mano, que es la
         * regla que no se rompe. Así que se hace la UNIÓN: se conservan todas las suyas y
         * se añaden las que falten.
         */
        const yaTiene: string[] = Array.isArray(existente.etiquetas) ? existente.etiquetas : []
        const faltan = ids.filter(id => !yaTiene.includes(id))
        if (faltan.length) cambios.etiquetas = [...yaTiene, ...faltan]
        if (Object.keys(cambios).length > 0) {
          const { error } = await supabase.from('ejercicios').update(cambios).eq('id', existente.id)
          if (error) { anota(`${s.nombre} — error al actualizar: ${error.message}`, 'error'); continue }
        }
        id = existente.id; saltados++
      } else {
        const { data, error } = await supabase.from('ejercicios')
          .insert({ ...campos, video_url: '', imagen_url: '', variantes: s.variantes || [] }).select().single()
        if (error || !data) { anota(`${s.nombre} — error: ${error?.message}`, 'error'); continue }
        id = data.id; creados++
      }

      /**
       * LA IMAGEN DEL EJERCICIO ES OPCIONAL, Y NO CORTA EL RESTO.
       *
       * Aquí había un `continue`: si el fichero del ejercicio no estaba en la selección,
       * se saltaba al siguiente. Con una tanda de imágenes de VARIANTES eso significaba
       * saltarse los 126 y no poner ni una sola, y el resumen decía "126 actualizados"
       * sin mencionarlo. Se seguía cuadrando y no había forma de ver que faltaba algo.
       *
       * La imagen que ya tuviera el ejercicio NO se toca cuando no se da fichero.
       */
      let conImagen = false
      const file = porNombre[s.archivo]
      if (!file) {
        // No se anota línea por línea: si siembras un bloque de la carpeta, los otros
        // veinte llenarían el registro y taparían lo que sí ha pasado.
        sinImagen++; sinImagenNombres.push(s.nombre)
      } else {
        const r = await subirImagenEjercicio(id, file)
        if (!r.ok) { anota(`${s.nombre} — imagen falló: ${r.error}`, 'aviso'); sinImagen++ }
        else { await supabase.from('ejercicios').update({ imagen_url: r.url }).eq('id', id); conImagen = true }
      }

      // Imágenes de VARIANTE.
      //
      // Se emparejan por NOMBRE de variante contra las que el ejercicio tiene ahora en
      // la base, no por posición: si las reordenaste desde la ficha, por índice le
      // pondríamos la foto a otra. Y solo se toca la variante que trae archivo en la
      // semilla; las demás se quedan como estén.
      const conFoto = (s.variantes || []).filter(v => v.archivo && porNombre[v.archivo])
      if (conFoto.length > 0 || existente) {
        const { data: actual } = await supabase.from('ejercicios').select('variantes').eq('id', id).single()
        const lista: any[] = Array.isArray(actual?.variantes) ? actual!.variantes : []
        let tocadas = 0

        // Variantes NUEVAS de la semilla que el ejercicio todavía no tiene. Se añaden
        // al final; las que ya están no se tocan ni se reordenan. Es la única forma de
        // que la semilla pueda crecer sin pisar lo que hayas escrito tú en la ficha.
        for (const v of (s.variantes || [])) {
          if (lista.some((x: any) => norm(x?.nombre) === norm(v.nombre))) continue
          lista.push({ nombre: v.nombre, descripcion: v.descripcion })
          tocadas++
        }
        for (const v of conFoto) {
          const i = lista.findIndex((x: any) => norm(x?.nombre) === norm(v.nombre))
          if (i < 0) continue
          const rv = await subirImagenVariante(id, i, porNombre[v.archivo!])
          if (!rv.ok) { anota(`${s.nombre} · ${v.nombre} — imagen falló: ${rv.error}`, 'aviso'); continue }
          lista[i] = { ...lista[i], imagen_url: rv.url }; tocadas++
        }
        if (tocadas > 0) await supabase.from('ejercicios').update({ variantes: lista }).eq('id', id)
        varianteImg += tocadas
      }

      anota(`${s.nombre} — ${existente ? 'actualizado' : 'creado'}`
        + (conImagen ? ' con imagen' : '')
        + ` y ${ids.length} etiqueta${ids.length === 1 ? '' : 's'}`
        + (conFoto.length > 0 ? `, ${conFoto.length} de variante` : ''), 'ok')
    }

    if (etiquetasNoEncontradas.size > 0) {
      anota(`Etiquetas que no existen en tu biblioteca y se han omitido: ${Array.from(etiquetasNoEncontradas).join(', ')}`, 'aviso')
    }
    if (sinImagen > 0) {
      // Con una tanda de variantes, esto son los 126 ejercicios y la lista entera tapa el
      // resto del registro. Se dicen los primeros y cuántos quedan.
      const muestra = sinImagenNombres.slice(0, 8).join(', ')
      const resto = sinImagenNombres.length - 8
      anota(`${sinImagen} sin imagen en esta selección, conservan la que ya tuvieran`
        + (sinImagen === SEMILLA.length ? ' (normal si estás sembrando solo imágenes de variantes)' : '')
        + `: ${muestra}${resto > 0 ? ` y ${resto} más` : ''}`, 'info')
    }
    anota(`Resumen: ${creados} creados, ${saltados} actualizados`
      + (varianteImg > 0 ? `, ${varianteImg} imagen(es) de variante` : '') + '.', 'info')

    setCorriendo(false); setHecho(true)
  }

  /**
   * El contador miraba SOLO la imagen del ejercicio, así que al sembrar una tanda de
   * imágenes de VARIANTES decía "0 de 126 emparejan" —cierto pero alarmante— y parecía
   * que no iba a entrar nada. Ahora cuenta las dos cosas por separado.
   */
  const encontradas = SEMILLA.filter(s => ficheros.some(f => f.name === s.archivo)).length
  const varConImagen = SEMILLA.flatMap(s => s.variantes || []).filter(v => v.archivo)
  const varEncontradas = varConImagen.filter(v => ficheros.some(f => f.name === v.archivo)).length

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 0' }}>
      <div className="panel">
        <div className="sec">
          <div className="sec-h">
            <span className="sh-l"><span className="ct-l"><Ic name="biblioteca" size={13} /> Sembrar biblioteca</span></span>
            <span className="sh-r">{SEMILLA.length} ejercicios</span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--gr)', lineHeight: 1.6, marginBottom: 14 }}>
            {/* Este texto decía que las variantes solo se ponen al crear, y hace tiempo
                que no es verdad: se fusionan por nombre. Una explicación desactualizada en
                la propia pantalla es peor que no tenerla, porque se cree. */}
            Da de alta el catálogo con sus descripciones, criterios de ejecución, feedbacks
            y etiquetas. Selecciona las imágenes de la carpeta que toque —se emparejan por
            nombre de archivo— y puedes relanzarlo las veces que haga falta:
            <b> nada de lo que ya tenga contenido se pisa</b>. Los ejercicios que ya existan
            se actualizan en vez de duplicarse, las etiquetas <b>se suman</b> a las que ya
            tuvieran, y las variantes se fusionan <b>por nombre</b>: las nuevas se añaden al
            final y las que ya estén conservan lo que hayas escrito tú. El vídeo no se toca
            nunca. Un ejercicio del que no des imagen se queda con la suya.
          </p>

          {huerfanas !== null && (
            huerfanas.length === 0 ? (
              <div className="fila-p" style={{ borderLeftColor: 'var(--g)', marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: 'var(--n)' }}>
                  Todas las etiquetas de la semilla existen en tu biblioteca.
                </span>
              </div>
            ) : (
              <div className="fila-p" style={{ borderLeftColor: 'var(--amb)', marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--n)', marginBottom: 6 }}>
                  <b>{huerfanas.length} etiqueta{huerfanas.length === 1 ? '' : 's'} de la semilla no {huerfanas.length === 1 ? 'existe' : 'existen'}</b> en tu
                  biblioteca. Los ejercicios se crearán sin {huerfanas.length === 1 ? 'ella' : 'ellas'}. Créalas
                  antes en Biblioteca → Etiquetas, o cámbiales aquí el nombre si el que uso no es el tuyo.
                </div>
                {huerfanas.map(h => (
                  <div key={h.nombre} style={{ fontSize: 12, color: 'var(--gr)', lineHeight: 1.6 }}>
                    <b style={{ color: 'var(--n)' }}>{h.nombre}</b> — {h.ejercicios.join(', ')}
                  </div>
                ))}
              </div>
            )
          )}

          <label className="btn btn-s" style={{ cursor: 'pointer' }}>
            <Ic name="imagen" size={13} /> Seleccionar las imágenes
            <input type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => setFicheros(Array.from(e.target.files || []))} />
          </label>

          {ficheros.length > 0 && (
            <div style={{ fontSize: 13, color: (encontradas + varEncontradas) > 0 ? 'var(--gd)' : '#7A5800', marginTop: 10 }}>
              {ficheros.length} archivo{ficheros.length === 1 ? '' : 's'} seleccionado{ficheros.length === 1 ? '' : 's'} ·
              {' '}{encontradas} de {SEMILLA.length} ejercicios
              {varConImagen.length > 0 && <> · {varEncontradas} de {varConImagen.length} variantes</>}
              {encontradas < SEMILLA.length && '. Los que no emparejen se crearán sin imagen.'}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <button className="btn btn-p" onClick={sembrar} disabled={corriendo}>
              {corriendo ? 'Sembrando…' : <><Ic name="guardar" size={13} /> Crear los ejercicios</>}
            </button>
          </div>
        </div>

        {log.length > 0 && (
          <div className="sec">
            <div className="sec-h"><span className="sh-l"><span className="ct-l">Resultado</span></span></div>
            {log.map((l, i) => (
              <div key={i} className="fila-p" style={{
                borderLeftColor: l.estado === 'ok' ? 'var(--g)' : l.estado === 'error' ? 'var(--red)' : l.estado === 'aviso' ? 'var(--amb)' : 'var(--bd)',
                marginBottom: 4,
              }}>
                <span style={{ fontSize: 13, color: 'var(--n)' }}>{l.texto}</span>
              </div>
            ))}
            {hecho && (
              <a href="/entrenamiento" className="btn btn-s btn-sm" style={{ marginTop: 10 }}>
                Ir a la biblioteca
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
