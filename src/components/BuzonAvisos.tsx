'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// EL BUZÓN DE AVISOS. Para las semanas de prueba: el equipo dice qué falla, qué no
// entiende o qué echa en falta, desde la pantalla donde le pasa. Dirección lo ve en
// /avisos (nuevo → visto → arreglado) y, cuando se arregla, quien avisó lo ve en «Hoy»:
// así sabe que se le ha escuchado y lo vuelve a usar. Tabla: sql/buzon-avisos.sql.
// ---------------------------------------------------------------------------

/** La ventanita de «Avisar de algo». Guarda sola la pantalla y quién lo escribe. */
export function AvisarDeAlgo({ nombre, onCerrar }: { nombre?: string, onCerrar: () => void }) {
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<'' | 'guardando' | 'hecho'>('')
  const [error, setError] = useState('')
  async function enviar() {
    if (!texto.trim()) return
    setEstado('guardando'); setError('')
    const { error } = await supabase.from('avisos').insert({ texto: texto.trim(), autor_nombre: nombre || null,
      pantalla: typeof window !== 'undefined' ? window.location.pathname : null })
    if (error) { setError('No se ha podido enviar: ' + error.message); setEstado(''); return }
    /* TAMBIÉN COMO TAREA DE DIRECCIÓN. El aviso solo se veía entrando en /avisos y nadie
       se enteraba de que había uno. Ahora sale en sus tareas (Hoy y la agenda), una
       para cada persona de dirección; si no se pueden leer, para todo el equipo. */
    try {
      const { data: u } = await supabase.auth.getUser()
      const { data: dir } = await supabase.from('perfiles').select('user_id').eq('rol', 'admin')
      const para = (dir || []).map((x: any) => x.user_id).filter(Boolean)
      const titulo = `Aviso del equipo${nombre ? ' (' + nombre + ')' : ''}: ${texto.trim()}`.slice(0, 300)
      const filas = (para.length ? para : [null]).map((a: string | null) => ({ titulo, asignado_a: a, creada_por: u.user?.id || null, completada: false }))
      await supabase.from('tareas').insert(filas)
    } catch { /* El aviso ya está guardado: la tarea es un extra. */ }
    setEstado('hecho'); setTimeout(onCerrar, 1400)
  }
  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(38,40,37,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--w)', borderRadius: 16, padding: 20, width: 'min(460px, 100%)', boxShadow: '0 20px 50px rgba(0,0,0,.25)' }}>
        {estado === 'hecho' ? <div style={{ textAlign: 'center', padding: '18px 0', fontSize: 15 }}>✓ Enviado. ¡Gracias!</div> : <>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Avisar de algo</div>
          <div style={{ fontSize: 12.5, color: 'var(--gr)', marginBottom: 10 }}>Un fallo, algo que no entiendes o una idea. Lo lee el encargado/a.</div>
          <textarea className="input" autoFocus rows={4} value={texto} onChange={e => setTexto(e.target.value)} style={{ width: '100%', resize: 'vertical' }}
            placeholder="Ej.: en el taller no me deja apuntar los segundos de la plancha"/>
          {error && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 6 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button className="btn btn-t btn-sm" onClick={onCerrar}>Cancelar</button>
            <button className="btn btn-p btn-sm" onClick={enviar} disabled={!texto.trim() || estado === 'guardando'}>{estado === 'guardando' ? 'Enviando…' : 'Enviar'}</button>
          </div>
        </>}
      </div>
    </div>
  )
}

/** En «Hoy»: los avisos tuyos que ya se han arreglado (hasta que pulsas «Entendido»). */
export function MisAvisosArreglados() {
  const [lista, setLista] = useState<any[]>([])
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('avisos').select('*').eq('autor', data.user.id).eq('estado', 'arreglado').eq('leido_autor', false)
        .order('cambiado_at', { ascending: false }).then(({ data }) => setLista(data || []))
    })
  }, [])
  if (!lista.length) return null
  async function entendido(a: any) {
    await supabase.from('avisos').update({ leido_autor: true }).eq('id', a.id)
    setLista(l => l.filter(x => x.id !== a.id))
  }
  return (
    <div style={{ background: 'var(--gl)', border: '1px solid var(--gm)', borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--gd)', marginBottom: 6 }}>✓ Arreglado lo que avisaste</div>
      {lista.map(a => (
        <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '5px 0', fontSize: 13.5 }}>
          <span style={{ flex: 1 }}>«{a.texto}»</span>
          <button className="btn btn-s btn-sm" onClick={() => entendido(a)}>Entendido</button>
        </div>
      ))}
    </div>
  )
}
