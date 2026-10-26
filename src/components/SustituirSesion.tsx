'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { hoyISO, sumarDias } from '@/lib/fechas'
import { finalizarSesion, siguienteDeSerie, igualQuePlantilla, diasActiva, type ModoFinalizar } from '@/lib/sesionViva'

// ---------------------------------------------------------------------------
// SUSTITUIR UNA SESION. Dos puertas para lo mismo (maqueta-sustituir-sesion):
//   · VeloFinalizar: desde la ficha, un paciente. "¿Que viene despues?"
//   · VeloSustituirTodos: desde la biblioteca, todos los que tienen esa plantilla.
// Por detras las dos llaman a `finalizarSesion` (lib/sesionViva), que pone la nueva en
// el hueco exacto de la vieja: sus citas desde ese dia, su sitio en el ciclo, el candado.
// ---------------------------------------------------------------------------

const fmt = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
const lunesQueViene = () => { const h = hoyISO(); const w = (new Date(h + 'T12:00:00').getDay() + 6) % 7; return sumarDias(h, 7 - w) }
const plural = (n: number, s: string, p = s + 's') => `${n} ${n === 1 ? s : p}`

async function plantillasDisponibles() {
  const { data } = await supabase.from('sesiones').select('*').is('paciente_id', null).order('nombre')
  return (data || []).filter((s: any) => !s.archivada)
}

/** Lista de sesiones para elegir, con buscador y la propuesta arriba. */
function ElegirSesion({ lista, valor, onElegir, propuesta, vacio }: { lista: any[], valor: any, onElegir: (s: any) => void, propuesta?: any, vacio: string }) {
  const [q, setQ] = useState('')
  const nrm = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const vista = useMemo(() => {
    const l = lista.filter(s => !q.trim() || nrm(s.nombre).includes(nrm(q.trim())))
    return propuesta ? [propuesta, ...l.filter(s => s.id !== propuesta.id)] : l
  }, [lista, q, propuesta])
  const nEj = (s: any) => (s.partes || []).reduce((a: number, p: any) => a + (p.ejercicios || []).length, 0)
  return (
    <div className="ss-caja">
      <input className="ss-buscar" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…"/>
      <div style={{ maxHeight: 230, overflowY: 'auto' }}>
        {vista.length === 0 && <div className="ss-nada">{vacio}</div>}
        {vista.slice(0, 60).map(s => {
          const on = valor?.id === s.id
          return (
            <div key={s.id} className={`ss-ses ${on ? 'on' : ''}`} onClick={() => onElegir(s)}>
              <div className="ss-n"><b>{s.nombre}</b><small>{plural((s.partes || []).length, 'parte')} · {plural(nEj(s), 'ejercicio')}</small></div>
              {propuesta?.id === s.id && <span className="ss-prop">Siguiente de la serie</span>}
              <span className="ss-check">{on ? '✓' : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Desde({ valor, onCambio, proxima, textoProxima }: { valor: string, onCambio: (f: string) => void, proxima: string, textoProxima: string }) {
  const lunes = lunesQueViene()
  const otra = valor !== proxima && valor !== lunes
  return (
    <div className="ss-cuando">
      <button className={`ss-pill ${valor === proxima ? 'on' : ''}`} onClick={() => onCambio(proxima)}>{textoProxima}</button>
      {lunes !== proxima && <button className={`ss-pill ${valor === lunes ? 'on' : ''}`} onClick={() => onCambio(lunes)}>Lunes {fmt(lunes).replace(/^\S+\s/, '')}</button>}
      <label className={`ss-pill ${otra ? 'on' : ''}`} style={{ position: 'relative' }}>
        {otra ? fmt(valor) : 'Elegir fecha…'}
        <input type="date" value={valor} min={hoyISO()} onChange={e => e.target.value && onCambio(e.target.value)}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}/>
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DESDE LA FICHA
// ---------------------------------------------------------------------------
export function VeloFinalizar({ sesion, pacienteId, nombrePaciente, onCerrar, onHecho }: {
  sesion: any, pacienteId: string, nombrePaciente?: string, onCerrar: () => void, onHecho: (texto: string) => void
}) {
  const [modo, setModo] = useState<ModoFinalizar>('biblioteca')
  const [plantillas, setPlantillas] = useState<any[]>([])
  const [suyas, setSuyas] = useState<any[]>([])
  const [destino, setDestino] = useState<any>(null)
  const [propuesta, setPropuesta] = useState<any>(null)
  const [citas, setCitas] = useState<any[]>([])
  const [pasadas, setPasadas] = useState(0)
  const [otras, setOtras] = useState<string[]>([])
  const [enCiclo, setEnCiclo] = useState(0)
  const [desde, setDesde] = useState(hoyISO())
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    (async () => {
      const hoy = hoyISO()
      const [pl, sy, fut, pas, fa] = await Promise.all([
        plantillasDisponibles(),
        supabase.from('sesiones').select('*').eq('paciente_id', pacienteId).is('finalizada_en', null).neq('id', sesion.id).order('created_at', { ascending: false }),
        supabase.from('citas').select('id,fecha,hora,sesion_id,sesiones:sesion_id(nombre)').eq('paciente_id', pacienteId).gte('fecha', hoy).eq('estado', 'programada').order('fecha').order('hora'),
        supabase.from('citas').select('id', { count: 'exact', head: true }).eq('sesion_id', sesion.id).lt('fecha', hoy),
        supabase.from('sistema_fase_sesiones').select('sesion_id').eq('sesion_id', sesion.id),
      ])
      setPlantillas(pl); setSuyas(sy.data || [])
      // La propuesta: la siguiente de su serie, por su nombre o el de la plantilla de la que salio.
      const molde = sesion.plantilla_id ? pl.find((p: any) => p.id === sesion.plantilla_id) : null
      const sig = siguienteDeSerie(molde?.nombre || sesion.nombre, pl)
      setPropuesta(sig); setDestino(sig)
      if (!sig) setModo('continuar')
      const f = (fut.data || []) as any[]
      setCitas(f.filter(c => c.sesion_id === sesion.id))
      setOtras(Array.from(new Set(f.filter(c => c.sesion_id && c.sesion_id !== sesion.id).map(c => c.sesiones?.nombre).filter(Boolean))) as string[])
      const prox = f.find(c => c.sesion_id === sesion.id)?.fecha
      if (prox) setDesde(prox)
      setPasadas(pas.count || 0); setEnCiclo((fa.data || []).length)
    })()
  }, [sesion.id, pacienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  const proxima = citas[0]?.fecha || hoyISO()
  const afectadas = citas.filter(c => c.fecha >= desde).length
  const elige = modo === 'biblioteca' || modo === 'suya'
  const nombreNueva = modo === 'continuar' ? 'la nueva' : destino ? `«${destino.nombre}»` : '…'

  async function confirmar() {
    if (elige && !destino) return
    setGuardando(true)
    const r = await finalizarSesion(sesion, pacienteId, modo, nota.trim() || undefined, { destino, desde })
    setGuardando(false)
    if (!r.ok) { alert(r.error); return }
    onHecho(`«${sesion.nombre}» finalizada` + (r.nueva
      ? ` · ${plural(r.nCitas, 'cita')} pasan a ${modo === 'continuar' ? 'una nueva desde ella' : '«' + r.nueva.nombre + '»'}`
      : ` · ${plural(r.nCitas, 'cita')} sin sesión: ponles otra`))
  }

  return (
    <div className="modal-bg" style={{ zIndex: 150 }} onClick={e => { if (e.target === e.currentTarget && !guardando) onCerrar() }}>
      <style>{CSS}</style>
      <div className="ss-velo">
        <div className="ss-cab">
          <div style={{ flex: 1, minWidth: 0 }}><b>Finalizar «{sesion.nombre}»</b>
            <small>{[nombrePaciente, `activa ${diasActiva(sesion)} días`, pasadas ? plural(pasadas, 'clase hecha', 'clases hechas') : ''].filter(Boolean).join(' · ')}</small></div>
          <button className="ss-x" onClick={onCerrar}>✕</button>
        </div>
        <div className="ss-cuerpo">
          <div className="ss-lbl">¿Qué viene después?</div>
          <div className="ss-ops">
            {([['continuar', 'Seguir con una copia', 'Parte de cómo está hoy y sigue creciendo'],
               ['biblioteca', 'Otra de la biblioteca', 'Se le hace su copia'],
               ['suya', 'Otra suya', 'Una que ya tiene en su ficha'],
               ['cerrar', 'Ninguna', 'Sus citas quedan sin sesión']] as const).map(([k, t, d]) => (
              <button key={k} className={`ss-op ${modo === k ? 'on' : ''}`}
                onClick={() => { setModo(k); setDestino(k === 'biblioteca' ? propuesta : null) }}><b>{t}</b><span>{d}</span></button>
            ))}
          </div>
          {modo === 'biblioteca' && <ElegirSesion lista={plantillas} valor={destino} onElegir={setDestino} propuesta={propuesta} vacio="No hay sesiones en la biblioteca con ese nombre"/>}
          {modo === 'suya' && <ElegirSesion lista={suyas} valor={destino} onElegir={setDestino} vacio="No tiene otras sesiones activas"/>}

          {modo !== 'cerrar' || citas.length > 0 ? <>
            <div className="ss-lbl">¿Desde cuándo?</div>
            <Desde valor={desde} onCambio={setDesde} proxima={proxima} textoProxima={citas.length ? `Próxima cita · ${fmt(proxima)}` : 'Desde hoy'}/>
          </> : null}

          <div className="ss-res">
            <div><i>↻</i><span>{modo === 'cerrar'
              ? <><b>{plural(afectadas, 'cita')}</b> se quedan sin sesión.</>
              : <><b>{plural(afectadas, 'cita')}</b> pasan a {nombreNueva} (las que llevaban esta).</>}
              {otras.length > 0 && <> Las de <b>{otras.join(', ')}</b> no se tocan.</>}</span></div>
            {enCiclo > 0 && modo !== 'cerrar' && <div><i>◎</i><span>En su ciclo, {nombreNueva} ocupa el sitio de esta.</span></div>}
            {sesion.fija && modo !== 'cerrar' && <div><i>🔒</i><span>Tenía candado: {nombreNueva} también lo lleva.</span></div>}
            <div><i>✎</i><span>{pasadas ? `Las ${plural(pasadas, 'clase pasada', 'clases pasadas')} siguen diciendo «${sesion.nombre}».` : 'Las citas pasadas no cambian.'}</span></div>
          </div>
          <input className="ss-nota" value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota (opcional): p. ej. objetivo de fuerza logrado"/>
        </div>
        <div className="ss-pie">
          <span className="ss-pnota">Queda en su historial.</span>
          <button className="ss-btn s" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button className="ss-btn p" onClick={confirmar} disabled={guardando || (elige && !destino)}>
            {guardando ? 'Finalizando…' : modo === 'cerrar' ? 'Finalizar' : modo === 'continuar' ? 'Finalizar y seguir con una copia' : destino ? `Finalizar y pasar a ${destino.nombre}` : 'Elige la sesión'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DESDE LA BIBLIOTECA
// ---------------------------------------------------------------------------
export function VeloSustituirTodos({ plantilla, onCerrar, onHecho }: { plantilla: any, onCerrar: () => void, onHecho: (texto: string) => void }) {
  const [plantillas, setPlantillas] = useState<any[]>([])
  const [destino, setDestino] = useState<any>(null)
  const [eligiendo, setEligiendo] = useState(false)
  const [copias, setCopias] = useState<any[] | null>(null)
  const [marcados, setMarcados] = useState<string[]>([])
  const [desdeModo, setDesdeModo] = useState<'proxima' | 'fecha'>('proxima')
  const [fecha, setFecha] = useState(lunesQueViene())
  const [andando, setAndando] = useState<string>('')

  useEffect(() => {
    (async () => {
      const hoy = hoyISO()
      const pl = await plantillasDisponibles()
      setPlantillas(pl.filter((p: any) => p.id !== plantilla.id))
      const sig = siguienteDeSerie(plantilla.nombre, pl)
      setDestino(sig); setEligiendo(!sig)
      // Sus copias: las que recuerdan su molde y, de antes de guardarlo, las del mismo nombre.
      const [a, b] = await Promise.all([
        supabase.from('sesiones').select('*, pacientes:paciente_id(id,nombre,apellidos)').eq('plantilla_id', plantilla.id).not('paciente_id', 'is', null).is('finalizada_en', null),
        supabase.from('sesiones').select('*, pacientes:paciente_id(id,nombre,apellidos)').eq('nombre', plantilla.nombre).not('paciente_id', 'is', null).is('finalizada_en', null),
      ])
      const todas = [...(a.data || []), ...(b.data || [])].filter((s, i, l) => l.findIndex(x => x.id === s.id) === i)
      const ids = todas.map(s => s.id)
      const { data: cs } = ids.length ? await supabase.from('citas').select('sesion_id,fecha').in('sesion_id', ids).gte('fecha', hoy).eq('estado', 'programada').order('fecha') : { data: [] }
      const filas = todas.map(s => {
        const suyas = (cs || []).filter((c: any) => c.sesion_id === s.id)
        return { ...s, nCitas: suyas.length, proxima: suyas[0]?.fecha || null, igual: igualQuePlantilla(s, plantilla) }
      }).sort((x, y) => String(x.pacientes?.nombre).localeCompare(String(y.pacientes?.nombre)))
      setCopias(filas)
      // Marcados de salida los que siguen igual; los que tienen cambios, a decidir.
      setMarcados(filas.filter(f => f.igual).map(f => f.id))
    })()
  }, [plantilla.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const elegidas = (copias || []).filter(c => marcados.includes(c.id))
  const nCitas = elegidas.reduce((a, c) => a + (desdeModo === 'proxima' ? c.nCitas : 0), 0)

  async function sustituir() {
    if (!destino || !elegidas.length) return
    let ok = 0, citas = 0; const mal: string[] = []
    for (const c of elegidas) {
      const quien = `${c.pacientes?.nombre || ''} ${c.pacientes?.apellidos || ''}`.trim()
      setAndando(`${ok + mal.length + 1} de ${elegidas.length} · ${quien}`)
      const r = await finalizarSesion(c, c.paciente_id, 'biblioteca', `Sustituida desde la biblioteca por «${destino.nombre}»`,
        { destino, desde: desdeModo === 'proxima' ? hoyISO() : fecha })
      if (r.ok) { ok++; citas += r.nCitas } else mal.push(`${quien}: ${r.error}`)
    }
    setAndando('')
    if (mal.length) alert('No se pudo en:\n' + mal.join('\n'))
    onHecho(`«${plantilla.nombre}» → «${destino.nombre}» en ${plural(ok, 'paciente')} · ${plural(citas, 'cita')}`)
  }

  return (
    <div className="modal-bg" style={{ zIndex: 150 }} onClick={e => { if (e.target === e.currentTarget && !andando) onCerrar() }}>
      <style>{CSS}</style>
      <div className="ss-velo">
        <div className="ss-cab">
          <div style={{ flex: 1, minWidth: 0 }}><b>Sustituir en sus pacientes</b><small>Biblioteca · la plantilla no cambia</small></div>
          <button className="ss-x" onClick={onCerrar}>✕</button>
        </div>
        <div className="ss-cuerpo">
          <div className="ss-flecha">
            <div className="ss-c"><small>Ahora tienen</small><b>{plantilla.nombre}</b></div><div className="ss-ar">→</div>
            <div className="ss-c" style={{ border: '1.5px solid var(--g)' }}><small>Pasan a</small><b>{destino?.nombre || 'Elige…'}</b> <button className="ss-lnk" onClick={() => setEligiendo(v => !v)}>{eligiendo ? 'listo' : 'cambiar'}</button></div>
          </div>
          {eligiendo && <ElegirSesion lista={plantillas} valor={destino} onElegir={s => { setDestino(s); setEligiendo(false) }} propuesta={siguienteDeSerie(plantilla.nombre, plantillas)} vacio="No hay sesiones con ese nombre"/>}

          <div className="ss-caja">
            {copias === null ? <div className="ss-nada">Buscando sus pacientes…</div> : copias.length === 0 ? <div className="ss-nada">Ningún paciente tiene ahora esta sesión.</div> : <>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <div className="ss-lbl" style={{ margin: 0, flex: 1 }}>{plural(copias.length, 'paciente')} con una copia activa</div>
                <button className="ss-lnk" onClick={() => setMarcados(marcados.length === copias.length ? [] : copias.map(c => c.id))}>{marcados.length === copias.length ? 'Desmarcar todos' : 'Marcar todos'}</button>
              </div>
              {copias.map(c => {
                const on = marcados.includes(c.id)
                const ini = (((c.pacientes?.nombre || '')[0] || '') + ((c.pacientes?.apellidos || '')[0] || '')).toUpperCase()
                return (
                  <div key={c.id} className={`ss-pac ${on ? 'on' : 'off'}`} onClick={() => setMarcados(l => on ? l.filter(x => x !== c.id) : [...l, c.id])}>
                    <span className="ss-check">{on ? '✓' : ''}</span><span className="ss-av">{ini}</span>
                    <div className="ss-n"><b>{c.pacientes?.nombre} {c.pacientes?.apellidos}</b>
                      <small>{c.nCitas ? `${plural(c.nCitas, 'cita')} por delante${c.proxima ? ' · próxima ' + fmt(c.proxima) : ''}` : 'Sin citas por delante'}{c.fija ? ' · 🔒' : ''}</small></div>
                    <span className={`ss-tag ${c.igual ? 'gr' : 'amb'}`}>{c.igual ? 'igual que la plantilla' : 'su copia tiene cambios'}</span>
                  </div>
                )
              })}
            </>}
          </div>

          <div className="ss-lbl">¿Desde cuándo?</div>
          <div className="ss-cuando">
            <button className={`ss-pill ${desdeModo === 'proxima' ? 'on' : ''}`} onClick={() => setDesdeModo('proxima')}>La próxima cita de cada uno</button>
            <label className={`ss-pill ${desdeModo === 'fecha' ? 'on' : ''}`} style={{ position: 'relative' }} onClick={() => setDesdeModo('fecha')}>
              {desdeModo === 'fecha' ? 'Desde el ' + fmt(fecha) : 'Desde una fecha…'}
              <input type="date" value={fecha} min={hoyISO()} onChange={e => { if (e.target.value) { setFecha(e.target.value); setDesdeModo('fecha') } }}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}/>
            </label>
          </div>
          <div className="ss-res">
            <div><i>↻</i><span>A cada uno: se cierra su «{plantilla.nombre}» (con su historia), se le hace <b>su copia</b> de {destino ? `«${destino.nombre}»` : 'la nueva'} y sus citas y su sitio en el ciclo pasan a ella.</span></div>
            {(copias || []).some(c => !marcados.includes(c.id)) && <div><i>✎</i><span>Los desmarcados no se tocan.</span></div>}
          </div>
        </div>
        <div className="ss-pie">
          <span className="ss-pnota">{andando || (desdeModo === 'proxima' ? `${plural(nCitas, 'cita')} en ${plural(elegidas.length, 'paciente')}` : `${plural(elegidas.length, 'paciente')} desde el ${fmt(fecha)}`)}</span>
          <button className="ss-btn s" onClick={onCerrar} disabled={!!andando}>Cancelar</button>
          <button className="ss-btn p" onClick={sustituir} disabled={!!andando || !destino || !elegidas.length}>
            {andando ? 'Sustituyendo…' : `Sustituir en ${plural(elegidas.length, 'paciente')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.ss-velo{width:min(640px,96vw);max-height:94vh;display:flex;flex-direction:column;background:#fff;border-radius:22px;box-shadow:0 18px 50px rgba(38,40,37,.22);overflow:hidden}
.ss-cab{display:flex;align-items:center;gap:12px;padding:16px 20px;box-shadow:0 6px 10px -8px rgba(38,40,37,.18);flex-shrink:0}
.ss-cab b{font-size:17px;font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ss-cab small{color:var(--grl);font-size:12.5px}
.ss-x{width:32px;height:32px;border-radius:99px;border:0;background:var(--bl);cursor:pointer;color:var(--gr);flex-shrink:0}
.ss-cuerpo{padding:16px 20px 10px;background:var(--bl);overflow-y:auto}
.ss-lbl{font-size:12.5px;font-weight:600;color:var(--gr);margin:4px 0 8px}
.ss-ops{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.ss-op{text-align:left;font-family:inherit;border:0;border-radius:14px;background:#fff;padding:12px 14px;cursor:pointer;box-shadow:0 3px 12px rgba(38,40,37,.08);color:var(--n)}
.ss-op b{font-size:14px;font-weight:500;display:block}.ss-op span{font-size:12px;color:var(--grl)}
.ss-op.on{background:var(--g);color:#fff}.ss-op.on span{color:rgba(255,255,255,.85)}
.ss-caja{background:#fff;border-radius:14px;padding:12px 14px;margin-bottom:14px;box-shadow:0 3px 12px rgba(38,40,37,.06)}
.ss-buscar{width:100%;font-family:inherit;font-size:13px;border:1px solid var(--bd);border-radius:99px;padding:7px 12px;margin-bottom:8px;outline:none}
.ss-buscar:focus{border-color:var(--g)}
.ss-ses{display:flex;align-items:center;gap:10px;padding:8px 8px;border-radius:10px;cursor:pointer}
.ss-ses:hover{background:var(--bl)}.ss-ses.on{background:var(--gl)}
.ss-n{flex:1;min-width:0}.ss-n b{font-weight:500;font-size:13.5px;display:block}.ss-n small{color:var(--grl);font-size:12px}
.ss-prop{font-size:10.5px;font-weight:700;color:#fff;background:var(--g);border-radius:99px;padding:2px 8px;white-space:nowrap}
.ss-check{width:20px;height:20px;border-radius:99px;border:1.5px solid var(--bd);display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;flex-shrink:0}
.on .ss-check{background:var(--g);border-color:var(--g)}
.ss-nada{font-size:13px;color:var(--grl);padding:6px 4px}
.ss-cuando{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.ss-pill{font-family:inherit;font-size:13px;border:1px solid var(--bd);background:#fff;border-radius:99px;padding:7px 13px;cursor:pointer;color:var(--gr)}
.ss-pill.on{background:var(--n);border-color:var(--n);color:#fff}
.ss-res{background:#fff;border-radius:14px;padding:12px 14px;margin-bottom:12px;border-left:3px solid var(--g)}
.ss-res div{font-size:13px;line-height:1.6;color:var(--n);display:flex;gap:8px;margin:2px 0}.ss-res i{font-style:normal;color:var(--g);width:16px;flex-shrink:0;text-align:center}
.ss-nota{width:100%;font-family:inherit;font-size:13px;border:1px solid var(--bd2);border-radius:10px;padding:8px 11px;background:#fff;margin-bottom:6px}
.ss-pie{display:flex;align-items:center;gap:10px;padding:14px 20px;background:#fff;border-top:1px solid var(--bd2);flex-shrink:0}
.ss-pnota{flex:1;font-size:12.5px;color:var(--grl);min-width:0}
.ss-btn{font-family:inherit;border:0;border-radius:99px;padding:10px 18px;font-weight:600;cursor:pointer;font-size:13.5px}
.ss-btn:disabled{opacity:.45;cursor:default}
.ss-btn.p{background:var(--n);color:#fff}.ss-btn.s{background:var(--bl);color:var(--gr)}
.ss-flecha{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.ss-c{flex:1;min-width:0;background:#fff;border-radius:14px;padding:10px 12px;box-shadow:0 3px 12px rgba(38,40,37,.06)}
.ss-c small{font-size:11.5px;color:var(--grl);display:block}.ss-c b{font-weight:500}
.ss-ar{color:var(--g);font-size:20px}
.ss-lnk{font-family:inherit;font-size:12.5px;border:0;background:none;color:var(--gd);cursor:pointer;text-decoration:underline}
.ss-pac{display:flex;align-items:center;gap:10px;padding:9px 6px;border-bottom:1px solid var(--bd2);cursor:pointer}
.ss-pac:last-child{border-bottom:0}.ss-pac.off{opacity:.55}
.ss-av{width:32px;height:32px;border-radius:99px;background:var(--gl);color:var(--gd);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ss-tag{font-size:11px;border-radius:99px;padding:2px 8px;white-space:nowrap}
.ss-tag.amb{background:var(--ambl);color:#7A5800}.ss-tag.gr{background:var(--bl);color:var(--gr)}
@media(max-width:560px){.ss-ops{grid-template-columns:1fr}}
`
