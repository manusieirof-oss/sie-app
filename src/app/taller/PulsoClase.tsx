'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { publicarPulso, PulsoVivo } from '@/lib/pulsoVivo'
import { VeloPulso } from '@/components/ChipPulso'
import { fcMaxDe, zonaDe, colorZona, ZONAS, TEXTO_FORMULA, nuevoAcumulado, sumarSegundo, trimpDe, mediaDe, mmss, Acumulado } from '@/lib/pulso'

// PULSÓMETROS EN LA CLASE.
//
// Las bandas Polar (Verity, H10…) se leen directamente por Bluetooth desde el
// navegador, con el servicio estándar de frecuencia cardíaca: sin app de Polar, sin
// cuentas, sin exportar. Solo funciona en Chrome/Edge de ORDENADOR (Apple no deja
// Bluetooth web en Safari ni en iPad), así que las bandas las lleva un solo equipo.
//
// Cada banda se registra una vez con su número (Banda 1, 2…). En la clase se elige
// qué banda lleva cada paciente y SIE recuerda la última que usó. Mientras la banda
// manda pulso se acumula: tiempo en cada zona, media, máxima y la carga (TRIMP). Se
// guarda cada 30 s en fc_sesiones, así que si se cierra la página no se pierde.

const SEG_GUARDAR = 30
const claveSS = (fecha: string) => `sie-pulso-${fecha}`

interface Dispositivo { nombre: string, bpm: number | null, t: number, bateria: number | null, estado: 'conectando' | 'directo' | 'perdida' }

export default function PulsoClase({ seleccion, fecha }: { seleccion: any[], fecha: string }) {
  const soportado = typeof navigator !== 'undefined' && !!(navigator as any).bluetooth
  const [abierto, setAbierto] = useState(false)
  const [bandas, setBandas] = useState<{ nombre_ble: string, numero: number }[]>([])
  const [extra, setExtra] = useState<Record<string, { fc_max: number | null, banda_ultima: string | null }>>({})
  const [error, setError] = useState('')
  const [, setTic] = useState(0)
  const devs = useRef<Record<string, Dispositivo>>({})
  const objs = useRef<Record<string, any>>({})          // BluetoothDevice por nombre, para reconectar
  const asig = useRef<Record<string, string>>({})        // paciente → nombre de la banda
  const acc = useRef<Record<string, Acumulado>>({})      // paciente → lo acumulado en esta clase
  const ultimoGuardado = useRef(0)
  const repintar = () => setTic(t => t + 1)

  /* ── EN DIRECTO PARA LAS TABLETS ─────────────────────────────────────────────
     El iPad no puede leer las bandas (Apple no deja Bluetooth web). El ordenador que
     las tiene conectadas manda cada 2 s el pulso de cada paciente por un canal de
     Supabase (sin tocar la base) y las tablets lo pintan igual, solo para mirar. */
  const remoto = useRef<Record<string, { bpm: number, banda: string, bateria: number | null, seg: number, zonas: number[], max: number, media: number | null, muestras?: [number, number][], t: number }>>({})
  const canal = useRef<any>(null)
  useEffect(() => {
    const ch = supabase.channel('pulso-clase', { config: { broadcast: { self: false } } })
    ch.on('broadcast', { event: 'pulso' }, ({ payload }: any) => {
      const ahora = Date.now()
      Object.entries(payload?.p || {}).forEach(([pid, v]: any) => { remoto.current[pid] = { ...v, t: ahora } })
    }).subscribe()
    canal.current = ch
    return () => { supabase.removeChannel(ch) }
  }, [])

  const pacientes = seleccion.map(s => s.paciente).filter(Boolean)
  const pids = pacientes.map(p => p.id).join(',')
  const citaDe = (pid: string) => selRef.current.find(s => s.paciente?.id === pid)?.citaId || null

  // ---- Datos: bandas registradas y, de cada paciente, FC máx. medida y última banda ----
  useEffect(() => {
    supabase.from('bandas').select('nombre_ble,numero').order('numero').then(({ data }) => setBandas(data || []))
  }, [])
  useEffect(() => {
    if (!pids) return
    supabase.from('pacientes').select('id,fc_max,banda_ultima').in('id', pids.split(',')).then(({ data }) => {
      const m: any = {}; (data || []).forEach((p: any) => { m[p.id] = { fc_max: p.fc_max, banda_ultima: p.banda_ultima } }); setExtra(m)
    })
  }, [pids])

  // ---- Si se recarga a media clase, se recupera lo acumulado (las bandas hay que reconectarlas) ----
  useEffect(() => {
    try {
      const g = JSON.parse(sessionStorage.getItem(claveSS(fecha)) || 'null')
      // Otro día = otra clase: lo acumulado no se arrastra.
      acc.current = g?.acc || {}; if (g?.asig) asig.current = g.asig; repintar()
    } catch { /* nada guardado */ }
  }, [fecha])

  // El reloj y el guardado viven fuera del render: leen siempre lo último por aquí.
  const pacRef = useRef<any[]>([]); pacRef.current = pacientes
  const extraRef = useRef(extra); extraRef.current = extra
  const fechaRef = useRef(fecha); fechaRef.current = fecha
  const selRef = useRef(seleccion); selRef.current = seleccion
  const fcMax = (p: any) => fcMaxDe({ fc_max: extraRef.current[p.id]?.fc_max, fecha_nacimiento: p.fecha_nacimiento })
  const numeroDe = (nombre: string) => bandas.find(b => b.nombre_ble === nombre)?.numero
  const etiqueta = (nombre: string) => numeroDe(nombre) ? `Banda ${numeroDe(nombre)}` : nombre
  const etiquetaRef = useRef(etiqueta); etiquetaRef.current = etiqueta

  const verRef = useRef<(p: any) => any>(() => ({ vivo: false }))
  /** Lo que se ve de un paciente: de la banda de ESTE equipo o, si no, lo que manda el ordenador. */
  function ver(p: any) {
    const n = asig.current[p.id], d = n ? devs.current[n] : null
    if (d && Date.now() - d.t < 4000) {
      const a = acc.current[p.id]
      return { vivo: true, remoto: false, bpm: d.bpm!, bateria: d.bateria, banda: etiqueta(n!), seg: a?.segundos || 0, zonas: a?.zonas || [], max: a?.max || 0, media: a ? mediaDe(a) : null, muestras: a?.muestras || [], aviso: '' }
    }
    const r = remoto.current[p.id]
    if (r && Date.now() - r.t < 6000) return { vivo: true, remoto: true, ...r, aviso: '' }
    const a = acc.current[p.id]
    return { vivo: false, remoto: false, bpm: null, bateria: d?.bateria ?? null, banda: n ? etiqueta(n) : '', seg: a?.segundos || 0, zonas: a?.zonas || [], max: a?.max || 0, media: a ? mediaDe(a) : null,
      aviso: d ? (d.estado === 'perdida' ? 'reconectando…' : 'sin pulso') : '' }
  }
  verRef.current = ver


  // ---- Cada latido que llega: se suma el tiempo real desde el anterior a quien lleva la banda ----
  function latido(nombre: string, bpm: number, ahora: number, antes: number) {
    const pid = Object.keys(asig.current).find(k => asig.current[k] === nombre)
    if (!pid) return
    const p = pacRef.current.find(x => x.id === pid); if (!p) return
    // Más de 5 s sin dato = la banda estuvo caída: ese hueco no se cuenta.
    const dt = antes && ahora - antes < 5000 ? (ahora - antes) / 1000 : 1
    acc.current[pid] = sumarSegundo(acc.current[pid] || nuevoAcumulado(nombre), bpm, fcMax(p).fc, dt)
  }

  /* PANTALLA ENCENDIDA mientras haya bandas: si el portátil bloquea la pantalla o entra
     en reposo, Bluetooth se corta. El navegador lo suelta solo al cambiar de pestaña, así
     que se vuelve a pedir al volver. */
  const bloqueo = useRef<any>(null)
  async function mantenerPantalla() {
    try { if ('wakeLock' in navigator && !bloqueo.current) { bloqueo.current = await (navigator as any).wakeLock.request('screen'); bloqueo.current.addEventListener('release', () => { bloqueo.current = null }) } } catch { /* no soportado */ }
  }
  useEffect(() => {
    const vuelve = () => { if (document.visibilityState === 'visible' && Object.keys(objs.current).length) mantenerPantalla() }
    document.addEventListener('visibilitychange', vuelve)
    return () => { document.removeEventListener('visibilitychange', vuelve); bloqueo.current?.release?.() }
  }, [])

  // ---- El reloj de la página solo guarda, reenvía y repinta: ya no cuenta tiempo ----
  useEffect(() => {
    const id = setInterval(() => {
      const ahora = Date.now()
      const hay = pacRef.current.some(p => { const d = devs.current[asig.current[p.id]]; return d && ahora - d.t < 4000 })
      if (hay && ahora - ultimoGuardado.current > SEG_GUARDAR * 1000) { ultimoGuardado.current = ahora; guardar() }
      if (hay && Math.floor(ahora / 1000) % 2 === 0) emitir()
      // Para la columna de cada paciente (Todos) y su cabecera (Uno a uno).
      const vivo: Record<string, PulsoVivo> = {}
      for (const p of pacRef.current) {
        const v = verRef.current(p); if (!v.vivo || v.bpm == null) continue
        const fc = fcMax(p).fc, z = zonaDe(v.bpm, fc)
        vivo[p.id] = { bpm: v.bpm, zona: z, pct: fc ? Math.round(v.bpm / fc * 100) : null, color: colorZona(z), banda: v.banda,
          nombre: p.nombre_clinica || `${p.nombre || ''} ${p.apellidos || ''}`.trim(), fcMax: fc, fcMedida: fcMax(p).medida,
          seg: v.seg, zonas: v.zonas, media: v.media, max: v.max, bateria: v.bateria ?? null, muestras: v.muestras || [] }
      }
      publicarPulso(vivo)
      repintar()
    }, 1000)
    // Al salir de la pantalla se guarda lo que haya, sin esperar a los 30 s.
    const alSalir = () => { guardar() }
    window.addEventListener('pagehide', alSalir)
    return () => { clearInterval(id); window.removeEventListener('pagehide', alSalir); guardar() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function emitir() {
    const p: Record<string, any> = {}
    for (const x of pacRef.current) {
      const n = asig.current[x.id], d = n ? devs.current[n] : null
      if (!d || d.bpm == null || Date.now() - d.t > 4000) continue
      const a = acc.current[x.id]
      p[x.id] = { bpm: d.bpm, banda: etiquetaRef.current(n!), bateria: d.bateria, seg: a?.segundos || 0, zonas: a?.zonas || [], max: a?.max || 0, media: a ? mediaDe(a) : null, muestras: (a?.muestras || []).slice(-180) }
    }
    if (Object.keys(p).length) canal.current?.send({ type: 'broadcast', event: 'pulso', payload: { p } })
  }

  async function guardar() {
    const fecha = fechaRef.current
    try { sessionStorage.setItem(claveSS(fecha), JSON.stringify({ acc: acc.current, asig: asig.current })) } catch { /* sin espacio */ }
    const filas = pacRef.current.filter(p => acc.current[p.id]?.segundos > 0).map(p => {
      const a = acc.current[p.id], f = fcMax(p)
      return {
        id: a.id, paciente_id: p.id, cita_id: citaDe(p.id), fecha, inicio: a.inicio, fin: a.fin, banda: a.banda,
        fc_max_ref: f.fc, formula: f.medida ? 'medida' : 'tanaka',
        fc_media: mediaDe(a), fc_max: a.max || null, fc_min: a.min || null, segundos: Math.round(a.segundos),
        zonas: a.zonas.map(z => Math.round(z)), trimp: trimpDe(a.zonas), muestras: a.muestras, actualizado: new Date().toISOString(),
      }
    })
    if (!filas.length) return
    const { error } = await supabase.from('fc_sesiones').upsert(filas, { onConflict: 'id' })
    if (error) setError('No se ha podido guardar la FC: ' + error.message)
  }

  // ---- Conectar una banda (Chrome pide elegirla en su ventana) ----
  async function conectar(paraPid?: string) {
    setError('')
    try {
      const d = await (navigator as any).bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }], optionalServices: ['battery_service'] })
      const nombre: string = d.name || d.id
      objs.current[nombre] = d
      d.addEventListener('gattserverdisconnected', () => { devs.current[nombre] = { ...devs.current[nombre], estado: 'perdida' }; repintar(); reintentar(nombre) })
      await enganchar(nombre)
      // Primera vez que se ve esta banda: se le da el siguiente número.
      if (!bandas.some(b => b.nombre_ble === nombre)) {
        const numero = Math.max(0, ...bandas.map(b => b.numero)) + 1
        await supabase.from('bandas').insert({ nombre_ble: nombre, numero })
        setBandas(p => [...p, { nombre_ble: nombre, numero }])
      }
      if (paraPid) asignar(paraPid, nombre)
    } catch (e: any) {
      if (e?.name !== 'NotFoundError') setError(e?.message || String(e)) // NotFoundError = se cerró la ventana
    }
  }
  async function enganchar(nombre: string) {
    const d = objs.current[nombre]
    devs.current[nombre] = { nombre, bpm: null, t: 0, bateria: devs.current[nombre]?.bateria ?? null, estado: 'conectando' }; repintar()
    const srv = await d.gatt.connect()
    const hr = await (await srv.getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement')
    hr.addEventListener('characteristicvaluechanged', (e: any) => {
      const v: DataView = e.target.value
      const bpm = v.getUint8(0) & 1 ? v.getUint16(1, true) : v.getUint8(1)
      // 0 = la banda no detecta pulso (mal puesta): no cuenta como dato.
      const ahora = Date.now(), antes = devs.current[nombre].t
      devs.current[nombre] = { ...devs.current[nombre], bpm: bpm || null, t: bpm ? ahora : antes, estado: 'directo' }
      if (bpm) latido(nombre, bpm, ahora, antes)
    })
    await hr.startNotifications()
    mantenerPantalla()
    try {
      const b = await (await srv.getPrimaryService('battery_service')).getCharacteristic('battery_level')
      devs.current[nombre].bateria = (await b.readValue()).getUint8(0)
    } catch { /* sin batería */ }
    repintar()
  }
  // Una banda que se aleja o se queda sin pulso se cae: se reintenta sola unas veces.
  async function reintentar(nombre: string, vez = 0) {
    if (vez > 10 || !objs.current[nombre]) return
    await new Promise(r => setTimeout(r, 3000))
    try { await enganchar(nombre) } catch { reintentar(nombre, vez + 1) }
  }

  function asignar(pid: string, nombre: string) {
    // Una banda la lleva una sola persona: si la tenía otro, se le quita.
    for (const k of Object.keys(asig.current)) if (asig.current[k] === nombre) delete asig.current[k]
    if (nombre) asig.current[pid] = nombre; else delete asig.current[pid]
    if (nombre) {
      if (acc.current[pid]) acc.current[pid].banda = nombre
      supabase.from('pacientes').update({ banda_ultima: nombre }).eq('id', pid).then(() => {})
      setExtra(p => ({ ...p, [pid]: { ...(p[pid] || { fc_max: null }), banda_ultima: nombre } }))
    }
    repintar()
  }
  async function ponerFcMax(pid: string, actual: number | null) {
    const v = prompt('FC máxima medida (ppm). Déjalo vacío para volver a la fórmula de Tanaka.', actual ? String(actual) : '')
    if (v === null) return
    const n = parseInt(v) || null
    await supabase.from('pacientes').update({ fc_max: n }).eq('id', pid)
    setExtra(p => ({ ...p, [pid]: { ...(p[pid] || { banda_ultima: null }), fc_max: n } }))
  }

  const conectadas = Object.values(devs.current).filter(d => d.estado !== 'perdida')
  const nVivos = pacientes.filter(p => ver(p).vivo).length
  if (!pacientes.length) return null

  return (
    <div style={{ margin: '0 0 12px', border: '1px solid var(--bd)', borderRadius: 12, background: '#fff' }}>
      <VeloPulso/>
      <button onClick={() => setAbierto(a => !a)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ color: '#B05A5A' }}>❤</span>
        <b style={{ fontSize: 13.5 }}>Pulsómetros</b>
        <span style={{ fontSize: 12, color: 'var(--gr)' }}>
          {nVivos ? `${nVivos} en directo` : conectadas.length ? `${conectadas.length} banda${conectadas.length === 1 ? '' : 's'} conectada${conectadas.length === 1 ? '' : 's'}` : 'sin bandas'}
        </span>
        {/* Cerrado se sigue viendo el pulso de cada uno en pequeño. */}
        {!abierto && (
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 6 }}>
            {pacientes.map(p => {
              const v = ver(p); if (!v.vivo) return null
              const z = zonaDe(v.bpm, fcMax(p).fc)
              return <span key={p.id} style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 99, background: colorZona(z), color: z >= 2 ? '#fff' : 'var(--n)' }}>{(p.nombre_clinica || p.nombre || '').split(' ')[0]} {v.bpm}</span>
            })}
          </span>
        )}
        <span style={{ flex: 1 }}/>
        <span style={{ fontSize: 12, color: 'var(--gr)' }}>{abierto ? 'Ocultar' : 'Abrir'}</span>
      </button>

      {abierto && (
        <div style={{ padding: '0 14px 14px' }}>
          {(
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                {soportado
                  ? <button className="btn btn-p btn-sm" onClick={() => conectar()}>+ Conectar banda</button>
                  : <span style={{ fontSize: 12, background: 'var(--ambl)', color: '#7A5800', padding: '5px 10px', borderRadius: 8 }}>
                      Aquí solo se ven: las bandas se conectan desde <b>Chrome en el ordenador</b> (Apple no deja Bluetooth en iPad/Safari).
                    </span>}
                <span style={{ fontSize: 11.5, color: 'var(--gr)', flex: 1, minWidth: 240 }}>{TEXTO_FORMULA}</span>
              </div>
              {error && <div style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 8 }}>{error}</div>}
              {/* BANDAS SIN DUEÑO: se conectan y luego se dice quién la lleva. Solo salen
                  tarjetas de quien lleva banda: muchos días no todos hacen la parte aeróbica. */}
              {soportado && Object.values(devs.current).filter(d => !Object.values(asig.current).includes(d.nombre)).map(d => {
                const suyo = pacientes.find(p => extra[p.id]?.banda_ultima === d.nombre && !asig.current[p.id])
                return (
                  <div key={d.nombre} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '7px 10px', marginBottom: 6, borderRadius: 8, background: 'var(--ambl)' }}>
                    <b style={{ fontSize: 13 }}>{etiqueta(d.nombre)}</b>
                    <span style={{ fontSize: 12, color: 'var(--gr)' }}>{d.bpm ? `${d.bpm} ppm · ` : ''}¿quién la lleva?</span>
                    {suyo && <button className="btn btn-p btn-sm" onClick={() => asignar(suyo.id, d.nombre)}>{(suyo.nombre_clinica || suyo.nombre || '').split(' ')[0]} (la llevó la última vez)</button>}
                    <select className="input" value="" onChange={e => e.target.value && asignar(e.target.value, d.nombre)} style={{ fontSize: 12, padding: '2px 6px', width: 'auto', height: 28 }}>
                      <option value="">Elegir paciente…</option>
                      {pacientes.filter(p => !asig.current[p.id]).map(p => <option key={p.id} value={p.id}>{p.nombre_clinica || `${p.nombre || ''} ${p.apellidos || ''}`.trim()}</option>)}
                    </select>
                  </div>
                )
              })}
              {!pacientes.some(p => asig.current[p.id] || ver(p).vivo) && (
                <div style={{ fontSize: 12.5, color: 'var(--gr)', marginBottom: 6 }}>Nadie lleva banda todavía. {soportado ? 'Conecta una y elige quién la lleva.' : ''}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
                {pacientes.filter(p => asig.current[p.id] || ver(p).vivo).map(p => {
                  const n = asig.current[p.id], v = ver(p), vivo = v.vivo
                  const f = fcMax(p), z = vivo ? zonaDe(v.bpm, f.fc) : 0
                  const ultima = extra[p.id]?.banda_ultima
                  const sugerida = !n && ultima && devs.current[ultima] && !Object.values(asig.current).includes(ultima) ? ultima : null
                  return (
                    <div key={p.id} style={{ border: `2px solid ${vivo ? colorZona(z) : 'var(--bd)'}`, borderRadius: 10, padding: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <b style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre_clinica || `${p.nombre || ''} ${p.apellidos || ''}`.trim()}</b>
                        {!soportado ? <span style={{ fontSize: 11.5, color: 'var(--gr)' }}>{v.banda}</span> : <select className="input" value={n || ''} onChange={e => e.target.value === '+' ? conectar(p.id) : asignar(p.id, e.target.value)}
                          style={{ fontSize: 11.5, padding: '2px 6px', width: 'auto', height: 26 }}>
                          <option value="">Sin banda</option>
                          {Object.values(devs.current).map(x => <option key={x.nombre} value={x.nombre}>{etiqueta(x.nombre)}{Object.entries(asig.current).some(([k, v]) => v === x.nombre && k !== p.id) ? ' (en uso)' : ''}</option>)}
                          <option value="+">+ Conectar otra…</option>
                        </select>}
                      </div>
                      {soportado && sugerida && (
                        <button className="btn btn-sm" style={{ marginTop: 6, fontSize: 11.5 }} onClick={() => asignar(p.id, sugerida)}>Usar {etiqueta(sugerida)} (la de la última vez)</button>
                      )}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                        <span style={{ fontSize: 34, fontWeight: 700, color: vivo ? colorZona(z) : '#bbb', lineHeight: 1 }}>{vivo ? v.bpm : '—'}</span>
                        <span style={{ fontSize: 12, color: 'var(--gr)' }}>ppm{vivo && f.fc ? ` · ${Math.round(v.bpm! / f.fc * 100)}%` : ''}{vivo && z ? ` · Z${z}` : ''}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--gr)', marginTop: 2 }}>
                        <button onClick={() => ponerFcMax(p.id, extra[p.id]?.fc_max ?? null)} title="Cambiar la FC máxima"
                          style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--gd)', fontSize: 11, textDecoration: 'underline dotted' }}>
                          FC máx. {f.fc ?? '?'}{f.medida ? ' (medida)' : ' (Tanaka)'}
                        </button>
                        {v.bateria != null ? ` · batería ${v.bateria}%` : ''}
                        {v.aviso ? ` · ${v.aviso}` : ''}
                      </div>
                      {v.seg > 0 && (
                        <>
                          {/* Tiempo en zonas: una barra con el reparto de la clase hasta ahora. */}
                          <div style={{ display: 'flex', height: 7, borderRadius: 4, overflow: 'hidden', marginTop: 8, background: 'var(--bl)' }}>
                            {v.zonas.map((s, i) => s > 0 && <div key={i} title={`Z${i}: ${mmss(s)}`} style={{ width: `${s / v.seg * 100}%`, background: colorZona(i) }}/>)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--gr)', marginTop: 4 }}>
                            {mmss(v.seg)} · media {v.media} · máx {v.max} · carga {trimpDe(v.zonas)}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, fontSize: 11, color: 'var(--gr)' }}>
                {ZONAS.map(Z => <span key={Z.z}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: Z.color, marginRight: 4 }}/>Z{Z.z} {Z.desde}%+</span>)}
                <span>· carga = minutos en cada zona × nº de zona (TRIMP)</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
