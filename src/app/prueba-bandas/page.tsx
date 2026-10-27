'use client'
import { useRef, useState } from 'react'

// PRUEBA: leer las bandas Polar (Verity, H10...) por Bluetooth desde el navegador.
//
// Usa el servicio estándar de frecuencia cardíaca (0x180D), el mismo que leen los
// relojes y las apps de gimnasio: no hace falta nada de Polar. Solo va en Chrome/Edge
// de ordenador o Android (Apple no deja Bluetooth web en Safari ni en iPad).
// Si la prueba sale bien, esto se lleva a la sesión en vivo del taller.

interface Banda { id: string, nombre: string, bpm: number | null, rr: number | null, bateria: number | null, ultima: number, estado: string }

export default function PruebaBandas() {
  const [bandas, setBandas] = useState<Record<string, Banda>>({})
  const [error, setError] = useState('')
  const disp = useRef<Record<string, any>>({})
  const soportado = typeof navigator !== 'undefined' && !!(navigator as any).bluetooth

  const poner = (id: string, cambio: Partial<Banda>) =>
    setBandas(p => ({ ...p, [id]: { ...(p[id] || { id, nombre: '', bpm: null, rr: null, bateria: null, ultima: 0, estado: '' }), ...cambio } }))

  async function conectar() {
    setError('')
    try {
      const d = await (navigator as any).bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }], optionalServices: ['battery_service'] })
      disp.current[d.id] = d
      poner(d.id, { nombre: d.name || 'Banda', estado: 'conectando…' })
      d.addEventListener('gattserverdisconnected', () => poner(d.id, { estado: 'desconectada' }))
      const srv = await d.gatt.connect()
      const hr = await (await srv.getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement')
      hr.addEventListener('characteristicvaluechanged', (e: any) => {
        // Formato estándar: bit 0 = FC en 16 bits; bit 4 = trae intervalos RR (1/1024 s).
        const v: DataView = e.target.value
        const f = v.getUint8(0)
        let i = 1
        const bpm = f & 1 ? v.getUint16(i, true) : v.getUint8(i); i += f & 1 ? 2 : 1
        if (f & 8) i += 2 // energía gastada: no la usamos
        let rr: number | null = null
        if (f & 16 && i + 1 < v.byteLength) rr = Math.round(v.getUint16(i, true) / 1024 * 1000)
        poner(d.id, { bpm, rr, ultima: Date.now(), estado: 'en directo' })
      })
      await hr.startNotifications()
      try {
        const b = await (await srv.getPrimaryService('battery_service')).getCharacteristic('battery_level')
        poner(d.id, { bateria: (await b.readValue()).getUint8(0) })
      } catch { /* sin batería: no pasa nada */ }
    } catch (e: any) {
      if (e?.name !== 'NotFoundError') setError(e?.message || String(e)) // NotFoundError = cerraste la ventana
    }
  }

  const lista = Object.values(bandas)
  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Prueba de bandas Polar</h1>
      <p style={{ color: '#6B6D6A', fontSize: 14, marginTop: 0 }}>
        Enciende la banda (póntela o apriétala con los dedos para que detecte pulso) y pulsa «Conectar banda».
        Puedes conectar varias, una tras otra.
      </p>
      {!soportado && (
        <div style={{ background: '#FDF4F4', color: '#B05A5A', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          Este navegador no tiene Bluetooth web. Ábrelo en <b>Google Chrome</b> en el ordenador.
        </div>
      )}
      <button onClick={conectar} disabled={!soportado}
        style={{ background: '#5A969E', color: '#fff', border: 0, borderRadius: 8, padding: '10px 18px', fontSize: 15, cursor: 'pointer' }}>
        + Conectar banda
      </button>
      {error && <div style={{ color: '#B05A5A', marginTop: 12, fontSize: 14 }}>Error: {error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 20 }}>
        {lista.map(b => {
          const viva = Date.now() - b.ultima < 5000 && b.estado === 'en directo'
          return (
            <div key={b.id} style={{ border: '1px solid #E4E0D6', borderRadius: 12, padding: 14, background: '#fff' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{b.nombre}</div>
              <div style={{ fontSize: 44, fontWeight: 700, color: viva ? '#B05A5A' : '#999', lineHeight: 1.1, margin: '6px 0' }}>
                {b.bpm ?? '—'} <span style={{ fontSize: 15, fontWeight: 400 }}>ppm</span>
              </div>
              <div style={{ fontSize: 12, color: '#6B6D6A' }}>
                {b.estado}{b.bateria != null ? ` · batería ${b.bateria}%` : ''}{b.rr != null ? ` · RR ${b.rr} ms` : ''}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
