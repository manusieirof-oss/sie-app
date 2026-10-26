'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/paginar'

// ---------------------------------------------------------------------------
// FOTOS DE PACIENTES A PRIVADO. Pagina de un solo uso.
//
// Las caras subidas antes del cambio estan en el bucket 'fotos', que es PUBLICO
// (ahi viven las imagenes de ejercicios y tests): con el enlace las ve cualquiera.
// Aqui cada una se copia al bucket privado 'pacientes-fotos', la ficha pasa a
// guardar la ruta (se ve con URL firmada que caduca) y la copia publica se BORRA.
//
// Orden seguro, paciente a paciente: copiar → apuntar la ficha → borrar la publica.
// Si algo falla en un paciente, ese se queda como estaba y se sigue con el resto.
// Se puede abrir varias veces: lo ya pasado no se toca. Al final se barren las caras
// publicas que quedaran sueltas (pacientes que ya tenian la foto nueva).
// ---------------------------------------------------------------------------

const PRIVADO = 'pacientes-fotos', PUBLICO = 'fotos'
const rutaPublica = (url: string) => {
  const m = String(url).match(/\/object\/public\/fotos\/([^?]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export default function FotosPrivadas() {
  const [pend, setPend] = useState<any[] | null>(null)
  const [todos, setTodos] = useState<any[]>([])
  const [log, setLog] = useState<string[]>([])
  const [hecho, setHecho] = useState({ ok: 0, mal: 0, borradas: 0, sinBorrar: 0 })
  const [andando, setAndando] = useState(false)
  const [fin, setFin] = useState(false)

  async function cargar() {
    const r = await traerTodo<any>((d, h) => supabase.from('pacientes').select('id,nombre,apellidos,foto_url').order('id').range(d, h))
    setTodos(r.filas)
    setPend(r.filas.filter((p: any) => String(p.foto_url || '').includes('/object/public/fotos/')))
  }
  useEffect(() => { cargar() }, [])

  const apunta = (t: string) => setLog(l => [t, ...l].slice(0, 300))

  async function pasar() {
    if (!pend) return
    setAndando(true)
    const h = { ok: 0, mal: 0, borradas: 0, sinBorrar: 0 }
    // Los que fallan siguen apuntando a la publica: su copia NO se barre.
    const fallidos = new Set<string>()
    for (const p of pend) {
      const quien = `${p.nombre || ''} ${p.apellidos || ''}`.trim()
      const origen = rutaPublica(p.foto_url)
      if (!origen) { h.mal++; fallidos.add(p.id); apunta(`✕ ${quien}: enlace raro, no se toca`); continue }
      const { data: blob, error: e1 } = await supabase.storage.from(PUBLICO).download(origen)
      if (e1 || !blob) { h.mal++; fallidos.add(p.id); apunta(`✕ ${quien}: no se pudo leer (${e1?.message || 'vacía'})`); continue }
      const destino = `${p.id}/foto.jpg`
      const { error: e2 } = await supabase.storage.from(PRIVADO).upload(destino, blob, { contentType: blob.type || 'image/jpeg', upsert: true })
      if (e2) { h.mal++; fallidos.add(p.id); apunta(`✕ ${quien}: no se pudo copiar a privado (${e2.message})`); continue }
      const { error: e3 } = await supabase.from('pacientes').update({ foto_url: destino }).eq('id', p.id)
      if (e3) { h.mal++; fallidos.add(p.id); apunta(`✕ ${quien}: copiada pero la ficha no se actualizó (${e3.message})`); continue }
      h.ok++
      const { data: rm, error: e4 } = await supabase.storage.from(PUBLICO).remove([origen])
      if (e4 || !rm?.length) { h.sinBorrar++; apunta(`⚠ ${quien}: pasada a privado, pero la copia pública NO se ha borrado${e4 ? ' (' + e4.message + ')' : ''}`) }
      else { h.borradas++; apunta(`✓ ${quien}`) }
      setHecho({ ...h })
    }
    // Barrido: caras publicas sueltas de cualquier paciente (las que ya tenian la nueva).
    const ids = todos.filter(p => !fallidos.has(p.id) && !String(p.foto_url || '').startsWith('http')).map(p => `${p.id}/foto.jpg`)
    for (let i = 0; i < ids.length; i += 100) {
      const { data: rm } = await supabase.storage.from(PUBLICO).remove(ids.slice(i, i + 100))
      if (rm?.length) { h.borradas += rm.length; apunta(`✓ ${rm.length} copia${rm.length === 1 ? '' : 's'} pública${rm.length === 1 ? '' : 's'} suelta${rm.length === 1 ? '' : 's'} borrada${rm.length === 1 ? '' : 's'}`) }
    }
    setHecho({ ...h })
    setAndando(false); setFin(true)
    cargar()
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Fotos de pacientes a privado</h1>
      <p style={{ color: 'var(--gr)', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        Las caras subidas antes del cambio están en una carpeta pública: con el enlace las ve cualquiera.
        Esto las pasa a la carpeta privada (solo se ven dentro de SIE, con enlaces que caducan) y borra la copia pública.
      </p>
      <div className="card">
        {pend === null ? 'Mirando…' : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15 }}><b>{pend.length}</b> foto{pend.length === 1 ? '' : 's'} en la carpeta pública</div>
            <span style={{ flex: 1 }}/>
            <button className="btn btn-p" disabled={andando || (pend.length === 0 && fin)} onClick={pasar}>
              {andando ? `Pasando… ${hecho.ok + hecho.mal} de ${pend.length}` : pend.length ? `Pasar ${pend.length} a privado` : 'Barrer copias sueltas'}
            </button>
          </div>
        )}
        {(andando || fin) && (
          <div style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.7 }}>
            ✓ {hecho.ok} pasadas a privado · {hecho.borradas} copias públicas borradas
            {hecho.mal > 0 && <span style={{ color: 'var(--red)' }}> · ✕ {hecho.mal} con error (siguen como estaban)</span>}
            {hecho.sinBorrar > 0 && <span style={{ color: '#8A6410' }}> · ⚠ {hecho.sinBorrar} sin borrar la pública</span>}
          </div>
        )}
      </div>
      {log.length > 0 && (
        <div className="card" style={{ fontSize: 12.5, lineHeight: 1.7, maxHeight: 360, overflow: 'auto', fontFamily: 'ui-monospace,monospace' }}>
          {log.map((t, i) => <div key={i} style={{ color: t.startsWith('✕') ? 'var(--red)' : t.startsWith('⚠') ? '#8A6410' : 'var(--n)' }}>{t}</div>)}
        </div>
      )}
    </div>
  )
}
