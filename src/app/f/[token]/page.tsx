'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { htmlFactura } from '@/lib/factura'

// ---------------------------------------------------------------------------
// LA FACTURA QUE SE MANDA POR WHATSAPP (sql/facturas-enlace.sql).
//
// Pública: se abre con el enlace secreto, sin entrar en SIE, y solo enseña esa factura.
// Se pinta igual que al imprimirla desde SIE (htmlFactura), con un botón para
// descargarla en PDF o imprimirla. Caducado o mal copiado, se dice.
// ---------------------------------------------------------------------------

export default function FacturaPublica({ params }: { params: { token: string } }) {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState('')
  const marco = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    supabase.rpc('factura_por_enlace', { p_token: params.token }).then(({ data, error }) => {
      if (error || !data) { setError('Este enlace no es válido o ha caducado. Pide que te lo vuelvan a mandar.'); return }
      const d: any = data
      setHtml(htmlFactura({ factura: d.factura, lineas: d.lineas || [], cobro: d.cobro || null, logo: d.logo || null,
        nombreComercial: d.nombreComercial || null, rectificada: d.rectificada || null }))
    })
  }, [params.token])

  if (error) return <div style={{ fontFamily: 'system-ui, sans-serif', padding: 32, textAlign: 'center', color: '#444' }}>{error}</div>
  if (!html) return <div style={{ fontFamily: 'system-ui, sans-serif', padding: 32, textAlign: 'center', color: '#888' }}>Abriendo la factura…</div>
  return (
    <div style={{ minHeight: '100vh', background: '#EEEBE3', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 10px 30px', fontFamily: 'system-ui, sans-serif' }}>
      <button type="button" onClick={() => { marco.current?.contentWindow?.focus(); marco.current?.contentWindow?.print() }}
        style={{ marginBottom: 12, padding: '10px 18px', borderRadius: 10, border: 0, background: '#3E7179', color: '#fff', fontSize: 15, cursor: 'pointer' }}>
        Descargar en PDF o imprimir</button>
      <iframe ref={marco} srcDoc={html} title="Factura"
        style={{ width: 'min(820px, 100%)', height: 'calc(100vh - 90px)', minHeight: 600, border: 0, background: '#fff', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,.12)' }}/>
    </div>
  )
}
