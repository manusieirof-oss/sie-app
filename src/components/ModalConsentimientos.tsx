'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import FirmaCanvas from './FirmaCanvas'
import { CONSENTIMIENTOS, TipoConsentimiento, guardarConsentimientos } from '@/lib/consentimientos'

// Recoger consentimientos fuera de la valoración. Hace falta para los pacientes
// que ya estaban dados de alta y para volver a recogerlos cuando cambian los textos.
export default function ModalConsentimientos({ pacienteId, nombre, dni, onCerrar, onGuardado }: {
  pacienteId: string
  nombre?: string
  dni?: string
  onCerrar: () => void
  onGuardado?: () => void
}) {
  const [aceptados, setAceptados] = useState<TipoConsentimiento[]>([])
  const [firma, setFirma] = useState('')
  const [leyendo, setLeyendo] = useState<TipoConsentimiento | null>(null)
  const [guardando, setGuardando] = useState(false)

  const alternar = (t: TipoConsentimiento) =>
    setAceptados(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])

  async function guardar() {
    if (aceptados.length === 0) { alert('No has marcado ningún consentimiento.'); return }
    if (!firma) {
      const seguir = confirm('No hay firma dibujada.\n\nSin firma el consentimiento no queda acreditado. ¿Guardar de todos modos?')
      if (!seguir) return
    }
    setGuardando(true)
    const r = await guardarConsentimientos(pacienteId, { aceptados, firmaDataUrl: firma || null, nombre, dni })
    setGuardando(false)
    if (!r.ok) { alert('No se pudo guardar: ' + r.error); return }
    onGuardado?.(); onCerrar()
  }

  if (leyendo) {
    const doc = CONSENTIMIENTOS.find(c => c.tipo === leyendo)!
    return (
      <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setLeyendo(null) }}>
        <div className="modal" style={{ width: 640, maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-title">{doc.titulo}<button className="modal-close" onClick={() => setLeyendo(null)}>✕</button></div>
          <div style={{ flex: 1, overflowY: 'auto', fontSize: 13, color: 'var(--n)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{doc.texto}</div>
          <div style={{ display: 'flex', marginTop: 12 }}>
            <div style={{ flex: 1 }} />
            <button className="btn btn-s btn-sm" onClick={() => setLeyendo(null)}>Volver</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget && !guardando) onCerrar() }}>
      <div className="modal" style={{ width: 520, maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="modal-title">Firmar consentimientos<button className="modal-close" onClick={onCerrar}>✕</button></div>

        <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 14 }}>
          {nombre || 'Paciente'}{dni ? ` · DNI ${dni}` : ''}
        </div>

        {CONSENTIMIENTOS.map(c => {
          const on = aceptados.includes(c.tipo)
          return (
            <div key={c.tipo} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--gr)' }}>{c.titulo}</span>
                <button className="btn btn-t btn-sm" onClick={() => setLeyendo(c.tipo)}><Ic name="informe" size={12} /> Leer</button>
              </div>
              <div onClick={() => alternar(c.tipo)} className="fila-p"
                style={{ borderLeftColor: on ? 'var(--g)' : 'var(--bd)', cursor: 'pointer', background: on ? 'var(--gl)' : 'transparent', borderRadius: '0 6px 6px 0', paddingRight: 10 }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${on ? 'var(--g)' : 'var(--bd)'}`, background: on ? 'var(--g)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {on && <Ic name="check" size={12} style={{ color: '#fff' }} />}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--n)' }}>He leído y acepto</span>
              </div>
            </div>
          )
        })}

        <div className="field" style={{ marginTop: 14 }}>
          <label>Firma del paciente</label>
          <FirmaCanvas valor={firma} onCambio={setFirma} />
        </div>

        <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 10 }}>
          Se registran también los que no marques: dejar constancia de una negativa también es necesario.
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-d btn-sm" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-p" onClick={guardar} disabled={guardando}>
            {guardando ? '…' : <><Ic name="guardar" size={13} /> Guardar</>}
          </button>
        </div>
      </div>
    </div>
  )
}
