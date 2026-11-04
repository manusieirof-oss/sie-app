'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/paginar'
import { subirImagenEjercicio } from '@/lib/ejercicios'

// ---------------------------------------------------------------------------
// COMPLETAR FOTOS DE LA BIBLIOTECA desde una carpeta (la del Drive de ejercicios).
//
// En el Drive cada vídeo tiene su foto con el nombre del ejercicio ("Cuerdas.JPG").
// Aquí se elige la carpeta entera (con sus subcarpetas), se casan las fotos con los
// ejercicios por el nombre y se suben solo a los que NO tienen foto. Una foto ya
// puesta no se cambia nunca desde aquí: eso se hace a mano en la ficha.
//
// Antes de subir se enseña la lista y se puede desmarcar lo que no cuadre.
// ---------------------------------------------------------------------------

/** Nombre comparable: sin tildes, sin "(1)", sin extensión ni espacios de más. */
const clave = (s: string) => String(s || '')
  .replace(/\.[a-z0-9]+$/i, '').replace(/\.[a-z]$/i, '')
  .replace(/\(\d+\)/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[·\-_/+]/g, ' ').replace(/\s+/g, ' ').trim()

type Par = { file: File, ruta: string, ej: any | null, tiene: boolean, ok: boolean }

export default function CompletarFotos() {
  const [ejs, setEjs] = useState<any[]>([])
  const [pares, setPares] = useState<Par[]>([])
  const [log, setLog] = useState<string[]>([])
  const [andando, setAndando] = useState(false)

  useEffect(() => {
    traerTodo<any>((d, h) => supabase.from('ejercicios').select('id,nombre,imagen_url').order('id').range(d, h))
      .then(r => setEjs(r.filas))
  }, [])
  const porClave = useMemo(() => new Map(ejs.map(e => [clave(e.nombre), e])), [ejs])

  function elegir(lista: FileList | null) {
    const fotos = Array.from(lista || []).filter(f => /\.(jpe?g|png)$/i.test(f.name))
    // Las IMG_0890 y las de nombre raro no dicen de qué ejercicio son: fuera.
    const ps: Par[] = fotos.filter(f => !/^IMG_\d+/i.test(f.name) && !/^[0-9A-F-]{36}\./i.test(f.name)).map(f => {
      const ej = porClave.get(clave(f.name)) || null
      const tiene = !!(ej && String(ej.imagen_url || '').trim())
      return { file: f, ruta: (f as any).webkitRelativePath || f.name, ej, tiene, ok: !!ej && !tiene }
    })
    // Si dos fotos van al mismo ejercicio ("x.JPG" y "x (1).JPG"), solo la primera.
    const vistos = new Set<string>()
    ps.forEach(p => { if (p.ej && p.ok) { if (vistos.has(p.ej.id)) p.ok = false; else vistos.add(p.ej.id) } })
    setPares(ps.sort((a, b) => Number(!!b.ej) - Number(!!a.ej) || a.ruta.localeCompare(b.ruta)))
    setLog([])
  }

  async function subir() {
    setAndando(true)
    const sube = pares.filter(p => p.ok && p.ej)
    for (const p of sube) {
      const r = await subirImagenEjercicio(p.ej.id, p.file)
      if (!r.ok) { setLog(l => [...l, `✗ ${p.ej.nombre}: ${r.error}`]); continue }
      // Solo si sigue sin foto: si alguien la puso mientras tanto, se respeta.
      const { data, error } = await supabase.from('ejercicios').update({ imagen_url: r.url })
        .eq('id', p.ej.id).or('imagen_url.is.null,imagen_url.eq.').select('id')
      setLog(l => [...l, error ? `✗ ${p.ej.nombre}: ${error.message}` : data?.length ? `✓ ${p.ej.nombre}` : `· ${p.ej.nombre}: ya tenía foto, no se toca`])
    }
    setAndando(false)
    const r = await traerTodo<any>((d, h) => supabase.from('ejercicios').select('id,nombre,imagen_url').order('id').range(d, h))
    setEjs(r.filas)
  }

  const nSube = pares.filter(p => p.ok).length
  const sinEj = pares.filter(p => !p.ej)
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 18 }}>
      <Link href="/entrenamiento" style={{ fontSize: 12, color: 'var(--gd)' }}>← Biblioteca</Link>
      <h2 style={{ fontWeight: 400, margin: '10px 0 4px' }}>Completar fotos de ejercicios</h2>
      <div style={{ fontSize: 12, color: 'var(--gr)', lineHeight: 1.5, marginBottom: 14 }}>
        Elige la carpeta de ejercicios del Drive (vale con subcarpetas). Las fotos que se llamen como un ejercicio
        <b> sin foto</b> se le ponen. Las fotos ya puestas no se cambian. {ejs.length ? `${ejs.filter(e => !String(e.imagen_url || '').trim()).length} ejercicios sin foto.` : 'Cargando la biblioteca…'}
      </div>
      <input type="file" multiple disabled={!ejs.length || andando} onChange={e => elegir(e.target.files)}
        {...({ webkitdirectory: '', directory: '' } as any)}/>

      {pares.length > 0 && (<>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 8px' }}>
          <b style={{ fontWeight: 500 }}>{nSube} foto{nSube === 1 ? '' : 's'} para subir</b>
          <button className="btn btn-p btn-sm" disabled={!nSube || andando} onClick={subir}>{andando ? 'Subiendo…' : 'Subir las marcadas'}</button>
        </div>
        {pares.filter(p => p.ej).map((p, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0', borderTop: '1px solid var(--bd2)', opacity: p.tiene ? .5 : 1 }}>
            <input type="checkbox" checked={p.ok} disabled={p.tiene || andando}
              onChange={e => setPares(ps => ps.map(x => x === p ? { ...x, ok: e.target.checked } : x))}/>
            <span style={{ flex: 1 }}>{p.ej.nombre}</span>
            <span style={{ color: 'var(--grl)', fontSize: 10.5 }}>{p.tiene ? 'ya tiene foto' : p.ruta}</span>
          </label>
        ))}
        {sinEj.length > 0 && (
          <details style={{ marginTop: 14, fontSize: 12 }}>
            <summary>{sinEj.length} foto{sinEj.length === 1 ? '' : 's'} sin ejercicio con ese nombre</summary>
            {sinEj.map((p, i) => <div key={i} style={{ color: 'var(--grl)', padding: '2px 0' }}>{p.ruta}</div>)}
          </details>
        )}
      </>)}
      {log.length > 0 && <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.6 }}>{log.map((l, i) => <div key={i}>{l}</div>)}</div>}
    </div>
  )
}
