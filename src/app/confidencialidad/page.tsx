'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { Clinica, Firma, datosClinica } from '@/lib/confidencialidad'
import { DocConfidencialidad } from '@/components/Confidencialidad'

// EL COMPROMISO PARA IMPRIMIR. Cada uno ve el suyo; dirección puede abrir el de
// cualquiera desde Ajustes → Equipo (?u=<user_id>) para imprimirlo y que lo firme a
// mano. Sale con su nombre y la fecha en que lo aceptó en SIE.
export default function ConfidencialidadPage() {
  const [clinica, setClinica] = useState<Clinica | null>(null)
  const [nombre, setNombre] = useState('')
  const [firma, setFirma] = useState<Firma | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = new URLSearchParams(window.location.search).get('u') || user?.id
      if (!uid) return
      const [c, { data: p }, { data: f }] = await Promise.all([
        datosClinica(),
        supabase.from('perfiles').select('nombre').eq('user_id', uid).maybeSingle(),
        supabase.from('confidencialidad_firmas').select('*').eq('user_id', uid).order('aceptada', { ascending: false }).limit(1),
      ])
      setClinica(c); setNombre(p?.nombre || ''); setFirma((f?.[0] as Firma) || null)
    })()
  }, [])

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '8px 0 40px' }}>
      <div className="no-imprimir" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>Confidencialidad</div>
          <div style={{ fontSize: 13, color: 'var(--gr)' }}>{firma ? 'Aceptado en SIE. Imprímelo si quieres la copia firmada a mano.' : 'Todavía no está aceptado en SIE.'}</div>
        </div>
        <button className="btn btn-p" onClick={() => window.print()} disabled={!clinica}><Ic name="descargar" size={14}/> Imprimir o guardar PDF</button>
      </div>
      {clinica ? <DocConfidencialidad clinica={clinica} nombre={nombre} firma={firma}/> : <div style={{ padding: 30, color: 'var(--grl)' }}>Cargando…</div>}
    </div>
  )
}
