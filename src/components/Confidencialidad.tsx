'use client'
import { useEffect, useState } from 'react'
import { Ic } from '@/lib/icons'
import { Clinica, datosClinica, textoConfidencialidad, aceptar, VERSION_CONFIDENCIALIDAD } from '@/lib/confidencialidad'

const fechaLarga = (iso: string) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// Al imprimir solo sale el documento: ni la barra lateral ni los botones.
const CSS_IMPRIMIR = `
@media print {
  body * { visibility: hidden !important; }
  .doc-conf, .doc-conf * { visibility: visible !important; }
  .doc-conf { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; padding: 0 !important; font-size: 11pt; }
  .no-imprimir { display: none !important; }
}`

/** El documento en sí. Con `firma` pone quién y cuándo lo aceptó en SIE. */
export function DocConfidencialidad({ clinica, nombre, firma }: { clinica: Clinica, nombre?: string, firma?: { aceptada: string, version: string } | null }) {
  const apartados = textoConfidencialidad(clinica)
  const linea = { borderBottom: '1px solid var(--n)', minWidth: 180, display: 'inline-block', height: 18 }
  return (
    <div className="doc-conf" style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', boxShadow: '0 2px 12px rgba(38,40,37,.07)', color: 'var(--n)', lineHeight: 1.55, fontSize: 13.5 }}>
      <style>{CSS_IMPRIMIR}</style>
      <div style={{ fontSize: 11, color: 'var(--grl)', letterSpacing: 1, textTransform: 'uppercase' }}>{clinica.nombre}</div>
      <h2 style={{ margin: '4px 0 14px', fontSize: 20 }}>Compromiso de confidencialidad y uso de datos</h2>
      <p style={{ margin: '0 0 14px' }}>
        Yo, <b>{nombre || <span style={linea}/>}</b>, con DNI <span style={linea}/>, como trabajador/a o colaborador/a del centro, declaro que he leído y acepto lo siguiente:
      </p>
      {apartados.map(a => (
        <div key={a.titulo} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.titulo}</div>
          {a.parrafos.length > 1
            ? <ul style={{ margin: 0, paddingLeft: 20 }}>{a.parrafos.map((p, i) => <li key={i} style={{ marginBottom: 4 }}>{p}</li>)}</ul>
            : <p style={{ margin: 0 }}>{a.parrafos[0]}</p>}
        </div>
      ))}
      {firma && (
        <div style={{ marginTop: 16, padding: '10px 12px', background: 'var(--gl)', borderRadius: 8, fontSize: 12, color: 'var(--gd)' }}>
          Aceptado en SIE el {fechaLarga(firma.aceptada)} · versión {firma.version}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, marginTop: 34, fontSize: 12 }}>
        <div>En <span style={linea}/>, a <span style={{ ...linea, minWidth: 120 }}/><div style={{ marginTop: 40, borderTop: '1px solid var(--n)', paddingTop: 4 }}>Firma del trabajador/a</div></div>
        <div><div style={{ height: 18 }}/><div style={{ marginTop: 40, borderTop: '1px solid var(--n)', paddingTop: 4 }}>Por {clinica.nombre}</div></div>
      </div>
    </div>
  )
}

/**
 * LA PUERTA: sale en el primer acceso (y cada vez que cambia la versión del texto).
 * Sin aceptar no se ve nada de SIE: los datos de salud no se enseñan a quien aún no
 * se ha comprometido a guardarlos.
 */
export function PuertaConfidencialidad({ nombre, onAceptado, onSalir }: { nombre: string, onAceptado: () => void, onSalir: () => void }) {
  const [clinica, setClinica] = useState<Clinica | null>(null)
  const [leido, setLeido] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { datosClinica().then(setClinica) }, [])

  const firmar = async () => {
    setEnviando(true); setError('')
    try { await aceptar(nombre); onAceptado() }
    catch (e: any) { setError('No se ha podido guardar: ' + (e?.message || 'error')); setEnviando(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bl)', padding: '28px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="no-imprimir" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--n)' }}>Antes de empezar</div>
          <div style={{ fontSize: 13, color: 'var(--gr)' }}>En SIE hay datos de salud de los pacientes. Léelo con calma y acéptalo para entrar.</div>
        </div>
        {clinica ? <DocConfidencialidad clinica={clinica} nombre={nombre}/> : <div style={{ padding: 30, color: 'var(--grl)' }}>Cargando…</div>}
        <div className="no-imprimir" style={{ position: 'sticky', bottom: 0, background: 'var(--bl)', padding: '14px 0', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--n)', cursor: 'pointer', flex: 1, minWidth: 240 }}>
            <input type="checkbox" checked={leido} onChange={e => setLeido(e.target.checked)} style={{ width: 18, height: 18 }}/>
            He leído el compromiso y lo acepto
          </label>
          <button className="btn btn-s" onClick={onSalir}>Salir</button>
          <button className="btn btn-p" disabled={!leido || enviando || !clinica} onClick={firmar}>
            {enviando ? 'Guardando…' : <><Ic name="firmar" size={14}/> Aceptar y entrar</>}
          </button>
          {error && <div style={{ width: '100%', fontSize: 12, color: 'var(--red)' }}>{error}</div>}
        </div>
        <div className="no-imprimir" style={{ fontSize: 11, color: 'var(--grl)' }}>Versión {VERSION_CONFIDENCIALIDAD}. Si quieres una copia en papel, después la tienes en tu inicial → Confidencialidad.</div>
      </div>
    </div>
  )
}
