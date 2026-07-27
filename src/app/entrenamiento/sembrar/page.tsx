'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { SEMILLA } from '@/lib/semillaEjercicios'
import { subirImagenEjercicio } from '@/lib/ejercicios'

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

type Linea = { texto: string, estado: 'ok' | 'aviso' | 'error' | 'info' }

export default function SembrarPage() {
  const [ficheros, setFicheros] = useState<File[]>([])
  const [log, setLog] = useState<Linea[]>([])
  const [corriendo, setCorriendo] = useState(false)
  const [hecho, setHecho] = useState(false)

  const anota = (texto: string, estado: Linea['estado'] = 'info') =>
    setLog(l => [...l, { texto, estado }])

  async function sembrar() {
    setCorriendo(true); setLog([]); setHecho(false)

    const porNombre: Record<string, File> = {}
    ficheros.forEach(f => { porNombre[f.name] = f })

    // Las etiquetas se buscan por nombre: el árbol de cada instalación es distinto.
    const { data: etiquetas } = await supabase.from('etiquetas').select('id,nombre')
    const mapaEt: Record<string, string> = {}
    ;(etiquetas || []).forEach((e: any) => { mapaEt[norm(e.nombre)] = e.id })

    const { data: existentes } = await supabase.from('ejercicios').select('id,nombre')
    const yaEstan = new Set((existentes || []).map((e: any) => norm(e.nombre)))

    let creados = 0, saltados = 0, sinImagen = 0
    const etiquetasNoEncontradas = new Set<string>()

    for (const s of SEMILLA) {
      const ids: string[] = []
      s.etiquetas.forEach(nombre => {
        const id = mapaEt[norm(nombre)]
        if (id) ids.push(id); else etiquetasNoEncontradas.add(nombre)
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

      // Si ya está, se ACTUALIZA en vez de saltarse. Así corregir la semilla y volver
      // a lanzar arregla lo ya creado, en lugar de obligar a borrarlo a mano.
      // No se tocan `variantes` ni `video_url`: eso lo pones tú desde la ficha y la
      // semilla no tiene por qué pisarlo.
      const existente = (existentes || []).find((e: any) => norm(e.nombre) === norm(s.nombre))
      let id: string

      if (existente) {
        const { error } = await supabase.from('ejercicios').update(campos).eq('id', existente.id)
        if (error) { anota(`${s.nombre} — error al actualizar: ${error.message}`, 'error'); continue }
        id = existente.id; saltados++
      } else {
        const { data, error } = await supabase.from('ejercicios')
          .insert({ ...campos, video_url: '', imagen_url: '', variantes: s.variantes || [] }).select().single()
        if (error || !data) { anota(`${s.nombre} — error: ${error?.message}`, 'error'); continue }
        id = data.id; creados++
      }

      const file = porNombre[s.archivo]
      if (!file) {
        anota(`${s.nombre} — ${existente ? 'actualizado' : 'creado'}, pero falta la imagen "${s.archivo}"`, 'aviso')
        sinImagen++; continue
      }

      const r = await subirImagenEjercicio(id, file)
      if (!r.ok) { anota(`${s.nombre} — imagen falló: ${r.error}`, 'aviso'); sinImagen++; continue }

      await supabase.from('ejercicios').update({ imagen_url: r.url }).eq('id', id)
      anota(`${s.nombre} — ${existente ? 'actualizado' : 'creado'} con imagen y ${ids.length} etiqueta${ids.length === 1 ? '' : 's'}`, 'ok')
    }

    if (etiquetasNoEncontradas.size > 0) {
      anota(`Etiquetas que no existen en tu biblioteca y se han omitido: ${Array.from(etiquetasNoEncontradas).join(', ')}`, 'aviso')
    }
    anota(`Resumen: ${creados} creados, ${saltados} actualizados, ${sinImagen} sin imagen.`, 'info')

    setCorriendo(false); setHecho(true)
  }

  const encontradas = SEMILLA.filter(s => ficheros.some(f => f.name === s.archivo)).length

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 0' }}>
      <div className="panel">
        <div className="sec">
          <div className="sec-h">
            <span className="sh-l"><span className="ct-l"><Ic name="biblioteca" size={13} /> Sembrar biblioteca</span></span>
            <span className="sh-r">{SEMILLA.length} ejercicios</span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--gr)', lineHeight: 1.6, marginBottom: 14 }}>
            Da de alta el catálogo inicial con sus descripciones, criterios de ejecución,
            feedbacks y etiquetas. Selecciona las imágenes de la carpeta <code>elegidas</code>:
            se emparejan por nombre de archivo. Si un ejercicio ya existe se actualiza en
            vez de duplicarse, así que puedes relanzarlo tras corregir la semilla. Las
            variantes solo se ponen al crear: si el ejercicio ya existe, no se tocan ni
            ellas ni el vídeo que hayas puesto tú.
          </p>

          <label className="btn btn-s" style={{ cursor: 'pointer' }}>
            <Ic name="imagen" size={13} /> Seleccionar las imágenes
            <input type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => setFicheros(Array.from(e.target.files || []))} />
          </label>

          {ficheros.length > 0 && (
            <div style={{ fontSize: 13, color: encontradas === SEMILLA.length ? 'var(--gd)' : '#7A5800', marginTop: 10 }}>
              {ficheros.length} archivo{ficheros.length === 1 ? '' : 's'} seleccionado{ficheros.length === 1 ? '' : 's'} ·
              {' '}{encontradas} de {SEMILLA.length} emparejan por nombre
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
