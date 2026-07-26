'use client'
import { useEffect, useRef, useState } from 'react'
import { Ic } from '@/lib/icons'
import {
  DocumentoPaciente, TIPOS_DOCUMENTO, listarDocumentos, subirDocumento,
  borrarDocumento, urlFirmada, tamanoLegible, esImagen, esPdf,
} from '@/lib/documentos'

const ICONO: Record<string, string> = {
  informe: 'informe', imagen: 'imagen', consentimiento: 'firmar', otro: 'carpeta',
}

export default function Documentos({ pacienteId, patologias = [], compacto = false, onCambio }: {
  pacienteId: string
  patologias?: any[]
  /** true en la vista Mapa: solo lista, sin formulario. */
  compacto?: boolean
  onCambio?: (n: number) => void
}) {
  const [docs, setDocs] = useState<DocumentoPaciente[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { cargar() }, [pacienteId])

  async function cargar() {
    setCargando(true)
    const r = await listarDocumentos(pacienteId)
    setDocs(r.documentos)
    onCambio?.(r.documentos.length)
    setCargando(false)
  }

  function elegirFichero(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setConfig({ file: f, nombre: f.name.replace(/\.[^.]+$/, ''), tipo: 'informe', patologiaId: '', notas: '' })
  }

  async function confirmarSubida() {
    if (!config) return
    setSubiendo(true)
    const r = await subirDocumento(pacienteId, config.file, {
      nombre: config.nombre, tipo: config.tipo,
      patologiaId: config.patologiaId || null, notas: config.notas || null,
    })
    setSubiendo(false)
    if (!r.ok) { alert('No se pudo subir: ' + r.error); return }
    setConfig(null); cargar()
  }

  async function abrir(doc: DocumentoPaciente) {
    const url = await urlFirmada(doc.ruta)
    if (!url) { alert('No se pudo generar el enlace. Comprueba los permisos del bucket.'); return }
    window.open(url, '_blank', 'noopener')
  }

  async function borrar(doc: DocumentoPaciente) {
    if (!confirm(`¿Eliminar "${doc.nombre}"?\n\nSe borra también el archivo y no se puede deshacer.`)) return
    const r = await borrarDocumento(doc)
    if (!r.ok) { alert('No se pudo eliminar: ' + r.error); return }
    cargar()
  }

  const nombrePatologia = (pid: string | null) =>
    pid ? (patologias.find((p: any) => p.id === pid)?.nombre || null) : null

  const lista = (
    <>
      {cargando && <div className="muted">Cargando…</div>}
      {!cargando && docs.length === 0 && <div className="muted">Sin documentos</div>}
      {docs.map(d => {
        const pat = nombrePatologia(d.patologia_id)
        return (
          <div key={d.id} className="fila-p" style={{ borderLeftColor: 'var(--g)' }}>
            <span style={{ display: 'inline-flex', color: 'var(--gd)', flexShrink: 0 }}>
              <Ic name={esPdf(d.mime) ? 'informe' : esImagen(d.mime) ? 'imagen' : (ICONO[d.tipo] || 'carpeta')} size={15} />
            </span>
            <div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={() => abrir(d)}>
              <div style={{ fontSize: 13, color: 'var(--n)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</div>
              <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 1 }}>
                {new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                {d.tamano_bytes ? ` · ${tamanoLegible(d.tamano_bytes)}` : ''}
                {pat ? ` · ${pat}` : ''}
              </div>
            </div>
            {!compacto && (
              <button className="fila-x" title="Eliminar" onClick={() => borrar(d)}><Ic name="cerrar" size={13} /></button>
            )}
          </div>
        )
      })}
    </>
  )

  if (compacto) return <div>{lista}</div>

  return (
    <div className="sec">
      <div className="sec-h">
        <span className="sh-l">
          <span className="ct-l"><Ic name="carpeta" size={13} /> Documentos</span>
          <button className="btn btn-s btn-sm" onClick={() => inputRef.current?.click()} disabled={subiendo}>
            {subiendo ? 'Subiendo…' : '+ Subir documento'}
          </button>
        </span>
      </div>

      <input ref={inputRef} type="file" accept="image/*,application/pdf" onChange={elegirFichero} style={{ display: 'none' }} />
      {lista}

      {config && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setConfig(null) }}>
          <div className="modal">
            <div className="modal-title">Subir documento<button className="modal-close" onClick={() => setConfig(null)}>✕</button></div>

            <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 12 }}>
              {config.file.name} · {tamanoLegible(config.file.size)}
              {config.file.type.startsWith('image/') && ' · se reducirá antes de subirla'}
            </div>

            <div className="field"><label>Nombre</label>
              <input className="input" value={config.nombre} onChange={e => setConfig((p: any) => ({ ...p, nombre: e.target.value }))} placeholder="ej. Resonancia lumbar" />
            </div>
            <div className="g2">
              <div className="field"><label>Tipo</label>
                <select className="input" value={config.tipo} onChange={e => setConfig((p: any) => ({ ...p, tipo: e.target.value }))}>
                  {TIPOS_DOCUMENTO.map(t => <option key={t.valor} value={t.valor}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="field"><label>Relacionado con</label>
                <select className="input" value={config.patologiaId} onChange={e => setConfig((p: any) => ({ ...p, patologiaId: e.target.value }))}>
                  <option value="">Nada en concreto</option>
                  {patologias.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>Notas</label>
              <input className="input" value={config.notas} onChange={e => setConfig((p: any) => ({ ...p, notas: e.target.value }))} placeholder="opcional" />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-d btn-sm" onClick={() => setConfig(null)}>Cancelar</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-p" onClick={confirmarSubida} disabled={subiendo}>
                {subiendo ? '…' : <><Ic name="guardar" size={13} /> Subir</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
