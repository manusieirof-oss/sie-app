'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/paginar'
import { comprimirImagen, MAX_FOTO_PACIENTE } from '@/lib/imagen'
import { olvidarFoto } from '@/lib/fotos'

// ---------------------------------------------------------------------------
// FOTOS DE PACIENTES, LIGERAS. Pagina de un solo uso.
//
// Al pasar las caras a la carpeta privada se copio el fichero ORIGINAL del movil, sin
// reducir: unos 4 MB cada una, cuando una cara de 600 px pesa unas 60 KB. Como salen en
// la agenda, el taller y la lista de pacientes, cada pantalla descargaba decenas de
// megas, y eso fue casi todo el trafico de Supabase (97 GB en dos semanas).
//
// Aqui cada foto que pesa de mas se descarga, se reduce como las que se suben ahora y
// se vuelve a guardar en su mismo sitio. Si una falla, se queda como estaba. Se puede
// abrir varias veces: las que ya son ligeras no se tocan.
// ---------------------------------------------------------------------------

const BUCKET = 'pacientes-fotos'
const PESA_DE_MAS = 250 * 1024

export default function FotosLigeras() {
  const [pacs, setPacs] = useState<any[] | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [hecho, setHecho] = useState({ vistas: 0, reducidas: 0, yaBien: 0, mal: 0, antes: 0, despues: 0 })
  const [andando, setAndando] = useState(false)
  const [fin, setFin] = useState(false)

  useEffect(() => {
    traerTodo<any>((d, h) => supabase.from('pacientes').select('id,nombre,apellidos,foto_url').not('foto_url', 'is', null).order('id').range(d, h))
      .then(r => setPacs(r.filas.filter((p: any) => p.foto_url && !String(p.foto_url).startsWith('http'))))
  }, [])

  const apunta = (t: string) => setLog(l => [t, ...l].slice(0, 400))
  const mb = (b: number) => (b / 1048576).toFixed(1) + ' MB'

  async function reducir() {
    if (!pacs) return
    setAndando(true)
    const h = { vistas: 0, reducidas: 0, yaBien: 0, mal: 0, antes: 0, despues: 0 }
    for (const p of pacs) {
      const quien = `${p.nombre || ''} ${p.apellidos || ''}`.trim()
      const ruta: string = p.foto_url
      h.vistas++
      const { data: blob, error: e1 } = await supabase.storage.from(BUCKET).download(ruta)
      if (e1 || !blob) { h.mal++; apunta(`✕ ${quien}: no se pudo leer (${e1?.message || 'vacía'})`); setHecho({ ...h }); continue }
      if (blob.size <= PESA_DE_MAS) { h.yaBien++; setHecho({ ...h }); continue }
      let ligera: File
      try { ligera = await comprimirImagen(new File([blob], 'foto.jpg', { type: blob.type || 'image/jpeg' }), MAX_FOTO_PACIENTE) }
      catch { h.mal++; apunta(`✕ ${quien}: no se pudo reducir, se queda como estaba`); setHecho({ ...h }); continue }
      // Por si acaso: si no ha quedado mas pequena, no se toca.
      if (ligera.size >= blob.size) { h.yaBien++; setHecho({ ...h }); continue }
      const { error: e2 } = await supabase.storage.from(BUCKET).upload(ruta, ligera, { contentType: 'image/jpeg', upsert: true, cacheControl: '86400' })
      if (e2) { h.mal++; apunta(`✕ ${quien}: no se pudo guardar la reducida, se queda como estaba (${e2.message})`); setHecho({ ...h }); continue }
      olvidarFoto(ruta)
      h.reducidas++; h.antes += blob.size; h.despues += ligera.size
      apunta(`✓ ${quien}: ${mb(blob.size)} → ${Math.round(ligera.size / 1024)} KB`)
      setHecho({ ...h })
    }
    setAndando(false); setFin(true)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Fotos de pacientes, ligeras</h1>
      <p style={{ color: 'var(--gr)', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        Muchas caras están guardadas con el tamaño original del móvil (unos 4 MB). Esto las reduce al tamaño
        con el que se suben ahora, sin cambiar de sitio ni de paciente. No cierres la pantalla hasta que termine.
      </p>
      <div className="card">
        {pacs === null ? 'Mirando…' : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15 }}><b>{pacs.length}</b> paciente{pacs.length === 1 ? '' : 's'} con foto</div>
            <span style={{ flex: 1 }}/>
            <button className="btn btn-p" disabled={andando || pacs.length === 0} onClick={reducir}>
              {andando ? `Revisando… ${hecho.vistas} de ${pacs.length}` : fin ? 'Repasar otra vez' : 'Reducir las que pesan de más'}
            </button>
          </div>
        )}
        {(andando || fin) && (
          <div style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.7 }}>
            ✓ {hecho.reducidas} reducidas{hecho.reducidas > 0 && <> ({mb(hecho.antes)} → {mb(hecho.despues)})</>} · {hecho.yaBien} ya estaban bien
            {hecho.mal > 0 && <span style={{ color: 'var(--red)' }}> · ✕ {hecho.mal} con error (siguen como estaban)</span>}
          </div>
        )}
      </div>
      {log.length > 0 && (
        <div className="card" style={{ fontSize: 12.5, lineHeight: 1.7, maxHeight: 360, overflow: 'auto', fontFamily: 'ui-monospace,monospace' }}>
          {log.map((t, i) => <div key={i} style={{ color: t.startsWith('✕') ? 'var(--red)' : 'var(--n)' }}>{t}</div>)}
        </div>
      )}
    </div>
  )
}
