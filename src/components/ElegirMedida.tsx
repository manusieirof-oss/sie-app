'use client'
import { CARGAS, VOLUMENES, partesMedida, idMedida, type Carga, type Volumen } from '@/lib/medida'

/**
 * COMO SE MIDE UN EJERCICIO: con que carga y que se cuenta (lib/medida), en tarjetas.
 * El mismo en el torno y en el taller ("Arreglar ejercicios"), para que se lea igual.
 * `tipo` vacio = sin elegir (en el torno, al editar varios a la vez).
 */
export default function ElegirMedida({ tipo, onCambio }: { tipo?: string | null, onCambio: (t: string) => void }) {
  const hay = !!tipo
  const p = partesMedida(tipo)
  const elegir = (carga: Carga, volumen: Volumen) => onCambio(idMedida(carga, volumen))
  const tarjeta = (on: boolean, t: string, a: string, fn: () => void) => (
    <button key={t} type="button" onClick={fn}
      style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
        background: on ? 'var(--g)' : '#fff', color: on ? '#fff' : 'var(--n)', boxShadow: '0 3px 12px rgba(38,40,37,.10)' }}>
      <div style={{ fontSize: 14 }}>{t}</div>
      <div style={{ fontSize: 11.5, opacity: .8, marginTop: 2 }}>{a}</div>
    </button>
  )
  return (<>
    <div className="et-mini" style={{ marginBottom: 7 }}>Con qué carga</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
      {CARGAS.map(c => tarjeta(hay && p.carga === c.id, c.nombre, c.ayuda, () => elegir(c.id, hay ? p.volumen : 'reps')))}
    </div>
    <div className="et-mini" style={{ marginBottom: 7 }}>Qué se cuenta</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {VOLUMENES.map(v => tarjeta(hay && p.volumen === v.id, v.nombre, v.ayuda, () => elegir(hay ? p.carga : 'kg', v.id)))}
    </div>
  </>)
}
