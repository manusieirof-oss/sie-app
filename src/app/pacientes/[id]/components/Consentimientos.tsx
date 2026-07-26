'use client'
import { useEffect, useState } from 'react'
import { Ic } from '@/lib/icons'
import {
  Consentimiento, CONSENTIMIENTOS, consentimientosVigentes, tituloConsentimiento, urlFirma, abrirDocumentoFirmado,
} from '@/lib/consentimientos'
import { VERSION_TEXTOS } from '@/lib/textosLegales'

export default function Consentimientos({ pacienteId }: { pacienteId: string }) {
  const [items, setItems] = useState<Consentimiento[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    consentimientosVigentes(pacienteId).then(r => {
      if (!vivo) return
      setItems(r.consentimientos); setCargando(false)
    })
    return () => { vivo = false }
  }, [pacienteId])

  async function verFirma(ruta: string) {
    const url = await urlFirma(ruta)
    if (!url) { alert('No se pudo abrir la firma.'); return }
    window.open(url, '_blank', 'noopener')
  }

  async function verDocumento(c: Consentimiento) {
    const r = await abrirDocumentoFirmado(c)
    if (!r.ok) alert(r.error)
  }

  if (cargando) return null

  // Sin ninguno registrado: se avisa, porque es lo que hay que corregir.
  if (items.length === 0) {
    return (
      <div className="sec">
        <div className="sec-h"><span className="ct-l"><Ic name="firmar" size={13}/> Consentimientos</span></div>
        <div style={{ background: 'var(--ambl)', borderLeft: '3px solid var(--amb)', padding: '10px 13px', fontSize: 13, color: '#7A5800' }}>
          Sin consentimientos registrados. Se recogen al hacer la valoración.
        </div>
      </div>
    )
  }

  const firma = items.find(i => i.firma_ruta)?.firma_ruta || null
  const desfasados = items.some(i => i.version_texto !== VERSION_TEXTOS)

  return (
    <div className="sec">
      <div className="sec-h">
        <span className="ct-l"><Ic name="firmar" size={13}/> Consentimientos</span>
        {firma && <button className="btn btn-s btn-sm" onClick={() => verFirma(firma)}>Ver firma</button>}
      </div>

      {CONSENTIMIENTOS.map(def => {
        const c = items.find(i => i.tipo === def.tipo)
        const ok = c?.aceptado
        return (
          <div key={def.tipo} className="fila-p" style={{ borderLeftColor: ok ? 'var(--g)' : c ? 'var(--red)' : 'var(--bd)' }}>
            <span style={{ display: 'inline-flex', color: ok ? 'var(--gd)' : c ? 'var(--red)' : 'var(--grl)', flexShrink: 0 }}>
              <Ic name={ok ? 'check' : c ? 'cerrar' : 'punto'} size={14} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--n)' }}>{tituloConsentimiento(def.tipo)}</div>
              <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 1 }}>
                {!c ? 'Sin registrar'
                  : `${ok ? 'Aceptado' : 'No aceptado'} el ${new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} · texto ${c.version_texto}`}
              </div>
            </div>
            {c?.texto && (
              <button className="btn btn-t btn-sm" onClick={() => verDocumento(c)}>Ver documento</button>
            )}
          </div>
        )
      })}

      {desfasados && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#7A5800', background: 'var(--ambl)', padding: '8px 11px' }}>
          Alguno se firmó con una versión anterior de los textos (la actual es {VERSION_TEXTOS}). Conviene volver a recogerlo en la próxima revaloración.
        </div>
      )}
    </div>
  )
}
