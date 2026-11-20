'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'

// DAR ACCESO A LA APP DE CLIENTES. Genera un enlace para mandarle por WhatsApp; al
// abrirlo entra en su app sin contraseña. El enlace caduca pronto (si no lo abre a
// tiempo, se genera otro). Ver /api/app/invitar.
export default function ModalAppCliente({ pac, onCerrar }: { pac: any, onCerrar: () => void }) {
  const [tiene, setTiene] = useState<null | { ultimo: string | null, pruebas: boolean }>(null)
  const [enlace, setEnlace] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')

  const cargar = () => supabase.from('clientes_app').select('*').eq('paciente_id', pac.id).maybeSingle()
    .then(({ data }) => setTiene(data ? { ultimo: data.ultimo, pruebas: data.pruebas === true } : null))
  useEffect(() => { cargar() }, [pac.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function llamar(accion: 'enlace' | 'quitar') {
    setTrabajando(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/app/invitar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ accion, paciente_id: pac.id }) })
    const j = await r.json().catch(() => ({}))
    setTrabajando(false)
    if (!r.ok) { setError(j.error || 'No se ha podido.'); return }
    if (accion === 'enlace') setEnlace(j.enlace); else setEnlace('')
    cargar()
  }

  const tel = (pac.telefono || '').replace(/\D/g, '')
  const wa = tel ? (tel.length === 9 ? '34' + tel : tel) : ''
  const texto = `Hola ${pac.nombre}, este es tu acceso a la app del centro. Ábrelo en tu móvil (sirve durante un rato): ${enlace}`

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-title">App de {pac.nombre}<button className="modal-close" onClick={onCerrar}>✕</button></div>
        <p style={{ fontSize: 13, color: 'var(--gr)', marginTop: 0 }}>
          {tiene ? <>Ya tiene acceso. {tiene.ultimo ? `Entró por última vez el ${new Date(tiene.ultimo).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}.` : 'Todavía no ha entrado.'}</>
            : 'Aún no tiene acceso. Genera su enlace y mándaselo: al abrirlo entra sin contraseña y se queda dentro.'}
        </p>
        {!enlace && <button className="btn btn-p" disabled={trabajando} onClick={() => llamar('enlace')}>{trabajando ? 'Generando…' : tiene ? 'Generar un enlace nuevo' : 'Generar su enlace'}</button>}
        {enlace && <>
          <input className="input" readOnly value={enlace} onFocus={e => e.currentTarget.select()} style={{ fontSize: 12, marginBottom: 10 }}/>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {wa && <a className="btn btn-p" href={`https://wa.me/${wa}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer"><Ic name="mensaje" size={13}/> Mandar por WhatsApp</a>}
            <button className="btn btn-s" onClick={() => navigator.clipboard?.writeText(texto)}>Copiar mensaje</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--grl)', marginBottom: 0 }}>Caduca en poco tiempo. Si no le funciona, genera otro.</p>
        </>}
        {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
        {/* EN PRUEBAS: ve lo nuevo de la app antes que nadie (para probarlo tú). */}
        {tiene && <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={tiene.pruebas} onChange={async e => {
            const v = e.target.checked
            const { error } = await supabase.from('clientes_app').update({ pruebas: v }).eq('paciente_id', pac.id)
            if (error) { alert('No se ha podido: ' + error.message); return }
            setTiene(t => t && { ...t, pruebas: v })
          }}/>
          <span><b style={{ fontWeight: 600 }}>En pruebas</b><span style={{ display: 'block', fontSize: 12, color: 'var(--gr)' }}>Ve lo nuevo de la app antes que los demás clientes. Para probarlo tú.</span></span>
        </label>}
        {tiene && <div style={{ borderTop: '1px solid var(--bd)', marginTop: 14, paddingTop: 10 }}>
          <button className="btn btn-d btn-sm" disabled={trabajando} onClick={() => { if (confirm(`¿Quitar el acceso a la app de ${pac.nombre}? Su ficha no se toca.`)) llamar('quitar') }}>Quitar el acceso</button>
        </div>}
      </div>
    </div>
  )
}
