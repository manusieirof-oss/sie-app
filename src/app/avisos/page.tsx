'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// AVISOS DEL EQUIPO (dirección). Lo que el equipo ha avisado desde «Avisar de algo»,
// lo nuevo primero. Cada uno pasa de nuevo → visto → arreglado con un toque; al
// marcarlo arreglado, quien avisó lo ve en su «Hoy». Ver components/BuzonAvisos.
// ---------------------------------------------------------------------------

const ESTADOS = [
  { k: 'nuevo', t: 'Nuevos', color: 'var(--amb)' },
  { k: 'visto', t: 'Vistos', color: 'var(--g)' },
  { k: 'arreglado', t: 'Arreglados', color: 'var(--grl)' },
] as const

export default function AvisosPage() {
  const [avisos, setAvisos] = useState<any[] | null>(null)
  const [ver, setVer] = useState<'nuevo' | 'visto' | 'arreglado'>('nuevo')
  const [error, setError] = useState('')
  async function cargar() {
    const { data, error } = await supabase.from('avisos').select('*').order('created_at', { ascending: false })
    if (error) setError('No se pueden leer los avisos: ' + error.message + ' (¿falta ejecutar sql/buzon-avisos.sql?)')
    setAvisos(data || [])
  }
  useEffect(() => { cargar() }, [])
  async function poner(a: any, estado: string) {
    await supabase.from('avisos').update({ estado, cambiado_at: new Date().toISOString(), leido_autor: false }).eq('id', a.id)
    cargar()
  }
  const lista = (avisos || []).filter(a => a.estado === ver)
  const fecha = (f: string) => new Date(f).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '6px 0 40px' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Avisos del equipo</h2>
      <div style={{ fontSize: 13, color: 'var(--gr)', marginBottom: 14 }}>Lo que avisan desde «Avisar de algo» del menú. Al marcar uno arreglado, quien lo avisó lo ve en su «Hoy».</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {ESTADOS.map(e => {
          const n = (avisos || []).filter(a => a.estado === e.k).length
          return <button key={e.k} className={`chip-sel ${ver === e.k ? 'on' : ''}`} onClick={() => setVer(e.k)}>{e.t} · {n}</button>
        })}
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
      {avisos && lista.length === 0 && <div style={{ color: 'var(--gr)', fontSize: 14, padding: '30px 0', textAlign: 'center' }}>Nada aquí.</div>}
      {lista.map(a => (
        <div key={a.id} style={{ background: 'var(--w)', border: '1px solid var(--bd)', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: 14.5, color: 'var(--n)', whiteSpace: 'pre-wrap', marginBottom: 6 }}>{a.texto}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--grl)' }}>
            <span>{a.autor_nombre || 'Alguien'} · {fecha(a.created_at)}</span>
            {a.pantalla && <a href={a.pantalla} style={{ color: 'var(--gd)' }}>en {a.pantalla}</a>}
            <span style={{ flex: 1 }}/>
            {a.estado === 'nuevo' && <button className="btn btn-s btn-sm" onClick={() => poner(a, 'visto')}>Visto</button>}
            {a.estado !== 'arreglado' && <button className="btn btn-p btn-sm" onClick={() => poner(a, 'arreglado')}>✓ Arreglado</button>}
            {a.estado === 'arreglado' && <button className="btn btn-t btn-sm" onClick={() => poner(a, 'visto')}>Reabrir</button>}
          </div>
        </div>
      ))}
    </div>
  )
}
