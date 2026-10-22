'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { hoyISO } from '@/lib/fechas'

// ---------------------------------------------------------------------------
// CAMBIAR DE SALA, en la ficha. Todas sus citas desde un día en adelante pasan a otra
// sala (mismo día y hora). Antes de cambiar se mira la plaza de la sala nueva en cada
// cita: si alguna está llena, se avisa y se puede cambiar igualmente o saltarla.
// Las canceladas no se tocan.
// ---------------------------------------------------------------------------

type Cita = { id: string, fecha: string, hora: string, sala: string }

export default function CambiarSala({ pacienteId, onCambiadas }: { pacienteId: string, onCambiadas?: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [salas, setSalas] = useState<string[]>(['A', 'B'])
  const [max, setMax] = useState(6)
  const [desde, setDesde] = useState(hoyISO())
  const [sala, setSala] = useState('')
  const [citas, setCitas] = useState<Cita[] | null>(null)
  const [llenas, setLlenas] = useState<Set<string> | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState('')

  useEffect(() => {
    if (!abierto) return
    supabase.from('ajustes').select('clave,valor').in('clave', ['clinica_salas', 'clinica_max_personas_sala']).then(({ data }) => {
      const m = Object.fromEntries((data || []).map((x: any) => [x.clave, x.valor]))
      try { const s = JSON.parse(m.clinica_salas || ''); if (Array.isArray(s) && s.length) setSalas(s) } catch { /* A y B */ }
      setMax(parseInt(m.clinica_max_personas_sala || '6') || 6)
    })
  }, [abierto])

  // Sus citas desde ese día
  useEffect(() => {
    if (!abierto) return
    setCitas(null)
    supabase.from('citas').select('id,fecha,hora,sala').eq('paciente_id', pacienteId).gte('fecha', desde).neq('estado', 'cancelada')
      .order('fecha').order('hora').then(({ data }) => setCitas(data || []))
  }, [abierto, desde, pacienteId])

  // Plaza de la sala nueva en cada una de esas citas (sin contarle a él)
  const aCambiar = (citas || []).filter(c => c.sala !== sala)
  useEffect(() => {
    if (!sala || !citas) { setLlenas(null); return }
    let vivo = true
    setLlenas(null)
    ;(async () => {
      const fechas = Array.from(new Set(aCambiar.map(c => c.fecha)))
      const cuenta: Record<string, number> = {}
      for (let i = 0; i < fechas.length; i += 200) {
        const { data } = await supabase.from('citas').select('fecha,hora,paciente_id').in('fecha', fechas.slice(i, i + 200))
          .eq('sala', sala).neq('estado', 'cancelada').neq('paciente_id', pacienteId)
        ;(data || []).forEach((c: any) => { const k = c.fecha + '|' + String(c.hora).slice(0, 5); cuenta[k] = (cuenta[k] || 0) + 1 })
      }
      if (vivo) setLlenas(new Set(aCambiar.filter(c => (cuenta[c.fecha + '|' + String(c.hora).slice(0, 5)] || 0) >= max).map(c => c.id)))
    })()
    return () => { vivo = false }
  }, [sala, citas, max]) // eslint-disable-line react-hooks/exhaustive-deps

  async function cambiar(saltarLlenas: boolean) {
    const ids = aCambiar.filter(c => !(saltarLlenas && llenas?.has(c.id))).map(c => c.id)
    if (!ids.length) return
    setGuardando(true)
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from('citas').update({ sala }).in('id', ids.slice(i, i + 200))
      if (error) { setHecho('No se pudieron cambiar: ' + error.message); setGuardando(false); return }
    }
    setGuardando(false)
    setHecho(`${ids.length} cita${ids.length > 1 ? 's' : ''} pasada${ids.length > 1 ? 's' : ''} a la Sala ${sala}.`)
    setCitas(c => (c || []).map(x => (ids.includes(x.id) ? { ...x, sala } : x)))
    onCambiadas?.()
  }

  const porSala: Record<string, number> = {}
  ;(citas || []).forEach(c => { porSala[c.sala || '—'] = (porSala[c.sala || '—'] || 0) + 1 })
  const fmt = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  const nLlenas = llenas?.size || 0

  if (!abierto) return (
    <div style={{ margin: '-8px 0 18px' }}>
      <button className="btn btn-t btn-sm" onClick={() => { setAbierto(true); setHecho('') }}><Ic name="calendario" size={13}/> Cambiar de sala sus citas</button>
    </div>
  )
  return (
    <div style={{ margin: '-8px 0 18px', background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 10px 28px rgba(38,40,37,.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13.5 }}>Cambiar de sala</b>
        <span style={{ fontSize: 12, color: 'var(--gr)' }}>desde</span>
        <input type="date" className="hf-sel" value={desde} onChange={e => { setDesde(e.target.value); setHecho('') }}
          style={{ fontFamily: 'inherit', fontSize: 13, color: 'var(--gd)', background: 'transparent', border: 'none', borderBottom: '1.5px solid var(--gm)' }}/>
        <span style={{ fontSize: 12, color: 'var(--gr)' }}>en adelante, a la</span>
        <select value={sala} onChange={e => { setSala(e.target.value); setHecho('') }}
          style={{ fontFamily: 'inherit', fontSize: 13, color: 'var(--gd)', background: 'transparent', border: 'none', borderBottom: '1.5px solid var(--gm)', cursor: 'pointer' }}>
          <option value="">elige sala…</option>
          {salas.map(s => <option key={s} value={s}>Sala {s}</option>)}
        </select>
        <span style={{ flex: 1 }}/>
        <button className="btn btn-t btn-sm" onClick={() => setAbierto(false)}>Cerrar</button>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--gr)', marginTop: 10, lineHeight: 1.5 }}>
        {citas === null ? 'Mirando sus citas…'
          : !citas.length ? 'No tiene citas desde ese día.'
          : <>Tiene <b style={{ color: 'var(--n)' }}>{citas.length}</b> cita{citas.length > 1 ? 's' : ''} desde el {fmt(citas[0].fecha)} · ahora {Object.entries(porSala).map(([s, n]) => `${n} en Sala ${s}`).join(', ')}.
            {sala && <> Se cambian <b style={{ color: 'var(--n)' }}>{aCambiar.length}</b> a la Sala {sala}.</>}</>}
      </div>

      {sala && llenas && nLlenas > 0 && (
        <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: '#FFF4D6', fontSize: 12.5 }}>
          La Sala {sala} está llena en {nLlenas}: {aCambiar.filter(c => llenas.has(c.id)).slice(0, 6).map(c => `${fmt(c.fecha)} ${String(c.hora).slice(0, 5)}`).join(' · ')}{nLlenas > 6 ? '…' : ''}
        </div>
      )}
      {hecho && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--gd)' }}>{hecho}</div>}

      {sala && aCambiar.length > 0 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          {nLlenas > 0 && <button className="btn btn-s btn-sm" disabled={guardando || !llenas} onClick={() => cambiar(true)}>Cambiar y saltar las llenas ({aCambiar.length - nLlenas})</button>}
          <button className="btn btn-p btn-sm" disabled={guardando || !llenas} onClick={() => cambiar(false)}>
            {guardando ? 'Cambiando…' : !llenas ? 'Mirando plaza…' : `Cambiar ${aCambiar.length} a la Sala ${sala}`}
          </button>
        </div>
      )}
    </div>
  )
}
