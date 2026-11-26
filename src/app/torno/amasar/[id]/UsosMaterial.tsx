'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { partesMedida, idMedida, type Carga } from '@/lib/medida'

// ---------------------------------------------------------------------------
// CÓMO SE HA HECHO EN LA SALA (sql/material-dia.sql). Si en el taller este ejercicio
// se hace a menudo con otra carga o con otro material (el jalón en polea con goma), se
// dice aquí, y a partir de 5 veces se propone crear la variante: una copia con los
// datos de este, dentro de su familia, con esa carga. Solo le faltará la imagen.
// ---------------------------------------------------------------------------

const UMBRAL = 5
const NOMBRE: Record<string, string> = { kg: 'con peso', banda: 'con goma', corporal: 'sin carga' }

export default function UsosMaterial({ ejercicioId, ir }: { ejercicioId: string, ir: (url: string) => void }) {
  const [usos, setUsos] = useState<{ carga: string | null, material: string | null, n: number }[]>([])
  const [creando, setCreando] = useState(false)
  useEffect(() => {
    if (!ejercicioId) return
    supabase.from('registros_ejercicio').select('carga,material').eq('ejercicio_id', ejercicioId).eq('finalizado', true)
      .or('carga.not.is.null,material.not.is.null').limit(2000)
      .then(({ data, error }) => {
        if (error) return
        const m: Record<string, { carga: string | null, material: string | null, n: number }> = {}
        ;(data || []).forEach((r: any) => { const k = (r.carga || '') + '|' + (r.material || '').trim().toLowerCase(); (m[k] ||= { carga: r.carga, material: (r.material || '').trim() || null, n: 0 }).n++ })
        setUsos(Object.values(m).sort((a, b) => b.n - a.n))
      })
  }, [ejercicioId])
  if (!usos.length) return null

  async function crearVariante(u: { carga: string | null, material: string | null }) {
    const { data: orig, error } = await supabase.from('ejercicios').select('*').eq('id', ejercicioId).maybeSingle()
    if (error || !orig) { alert('No se ha podido leer el ejercicio.'); return }
    const sufijo = u.material ? `con ${u.material.toLowerCase()}` : NOMBRE[u.carga || ''] || 'variante'
    const nombre = prompt('Nombre de la variante nueva:', `${orig.nombre} ${sufijo}`)
    if (!nombre?.trim()) return
    setCreando(true)
    const copia: any = { ...orig }
    ;['id', 'created_at', 'updated_at', 'imagen_url', 'animacion', 'videos', 'video_url', 'portada_id'].forEach(k => { if (k in copia) delete copia[k] })
    copia.nombre = nombre.trim()
    if (u.carga) copia.tipo_medida = idMedida(u.carga as Carga, partesMedida(orig.tipo_medida).volumen)
    const { data: nuevo, error: e2 } = await supabase.from('ejercicios').insert(copia).select('id').single()
    setCreando(false)
    if (e2 || !nuevo) { alert('No se ha podido crear: ' + (e2?.message || '')); return }
    ir(`/torno/amasar/${nuevo.id}`)
  }

  return (
    <div style={{ maxWidth: 720, margin: '10px auto 0', background: 'var(--ambl)', border: '1px solid #E7D29A', borderRadius: 14, padding: '9px 14px', fontSize: 13, color: '#6B5214' }}>
      <b style={{ color: '#4E3C0E' }}>En la sala se ha hecho también: </b>
      {usos.slice(0, 4).map((u, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 10 }}>
          {[u.carga ? NOMBRE[u.carga] : '', u.material].filter(Boolean).join(' · ')} ({u.n} {u.n === 1 ? 'vez' : 'veces'})
          {u.n >= UMBRAL && <button className="btn btn-s btn-sm" disabled={creando} onClick={() => crearVariante(u)}>Crear variante</button>}
        </span>
      ))}
    </div>
  )
}
