'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { revisarObjetivos } from '@/lib/metas'

/**
 * Los LOGROS de un objetivo, por paciente.
 *
 * Una meta obligaba a poner un número, así que un objetivo cualitativo no podía tener
 * ninguna: o medías o no te proponías nada. Y lo que se persigue con muchos pacientes no
 * es un número —"que se ponga el calcetín solo", "que suba el escalón sin apoyo"— sino algo
 * concreto que se consigue o no.
 *
 * Van aquí y no en la biblioteca porque son de ESTE paciente: el mismo objetivo se persigue
 * con logros distintos según quién lo tenga delante. Es la misma razón por la que la métrica
 * de un objetivo métrico vive en la biblioteca y su meta vive en la ficha.
 *
 * Y cuentan para cerrar el objetivo, como una vía más: la regla está en `lib/objetivos.ts`
 * —un objetivo está logrado cuando todas sus partes lo están— y aquí solo se escriben.
 *
 * Componente aparte y no dentro de `MetasObjetivo` a propósito: aquel está construido
 * alrededor de movimientos, tests y mediciones, y un logro no tiene nada de eso. Meterlo
 * allí habría sido añadirle ramas vacías a un componente que ya es grande.
 */
export default function LogrosObjetivo({ pacienteId, objetivo, logros, onCambio }: {
  pacienteId: string
  objetivo: any
  /** Las metas de tipo 'logro' de este objetivo. Las trae la ficha ya filtradas. */
  logros: any[]
  onCambio: () => void
}) {
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [abierto, setAbierto] = useState(false)

  async function anadir() {
    const d = texto.trim()
    if (!d) return
    setGuardando(true)
    const { error } = await supabase.from('objetivos_metas').insert({
      paciente_id: pacienteId, objetivo_id: objetivo.id,
      tipo: 'logro', descripcion: d, cumplida: false,
    })
    setGuardando(false)
    if (error) { alert('No se ha podido añadir: ' + error.message); return }
    setTexto(''); setAbierto(false)
    onCambio()
  }

  async function marcar(l: any, cumplida: boolean) {
    setGuardando(true)
    const { error } = await supabase.from('objetivos_metas').update({
      cumplida,
      fecha_cumplida: cumplida ? new Date().toISOString().split('T')[0] : null,
    }).eq('id', l.id)
    if (error) { setGuardando(false); alert('No se ha podido marcar: ' + error.message); return }
    // Marcar un logro puede cerrar el objetivo entero, y eso no puede quedar pendiente de
    // que alguien recargue: se recalcula aquí mismo, en el momento de la decisión.
    await revisarObjetivos(pacienteId)
    setGuardando(false)
    onCambio()
  }

  async function quitar(l: any) {
    if (!confirm(`¿Quitar el logro "${l.descripcion || ''}"?`)) return
    setGuardando(true)
    const { error } = await supabase.from('objetivos_metas').delete().eq('id', l.id)
    if (error) { setGuardando(false); alert('No se ha podido quitar: ' + error.message); return }
    await revisarObjetivos(pacienteId)
    setGuardando(false)
    onCambio()
  }

  const hechos = logros.filter((l: any) => l.cumplida).length

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: logros.length ? 4 : 0 }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--grl)', letterSpacing: .4, textTransform: 'uppercase' }}>
          Logros{logros.length > 0 ? ` · ${hechos} de ${logros.length}` : ''}
        </span>
        <button className="btn btn-t btn-sm" disabled={guardando} onClick={() => setAbierto(v => !v)}>
          <Ic name="mas" size={11} /> {abierto ? 'Cancelar' : 'Añadir'}
        </button>
      </div>

      {abierto && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input className="input" style={{ flex: 1, fontSize: 12 }} value={texto} autoFocus
            placeholder="ej. Se pone el calcetín solo"
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') anadir() }} />
          <button className="btn btn-p btn-sm" disabled={guardando || !texto.trim()} onClick={anadir}>
            <Ic name="guardar" size={12} /> Añadir
          </button>
        </div>
      )}

      {logros.map((l: any) => (
        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
          <input type="checkbox" checked={!!l.cumplida} disabled={guardando}
            onChange={e => marcar(l, e.target.checked)}
            style={{ width: 17, height: 17, accentColor: 'var(--g)', cursor: 'pointer', flexShrink: 0 }} />
          <span style={{
            flex: 1, fontSize: 12, fontWeight: 300,
            color: l.cumplida ? 'var(--gd)' : 'var(--n)',
            textDecoration: l.cumplida ? 'line-through' : 'none',
          }}>
            {l.descripcion || 'Logro sin describir'}
          </span>
          {l.cumplida && l.fecha_cumplida && (
            <span style={{ fontSize: 10, color: 'var(--grl)' }}>
              {new Date(l.fecha_cumplida + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            </span>
          )}
          <button onClick={() => quitar(l)} disabled={guardando} title="Quitar"
            style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      ))}
    </div>
  )
}
