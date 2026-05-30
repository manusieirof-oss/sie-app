'use client'

export default function ModalNotaDia({ fechaDisplay, nuevaNota, setNuevaNota, onGuardar, onCerrar }: {
  fechaDisplay: string
  nuevaNota: string
  setNuevaNota: (v: string) => void
  onGuardar: () => void
  onCerrar: () => void
}) {
  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
      <div className="modal" style={{width:380}}>
        <div className="modal-title">
          📝 Nueva nota del día
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>
        <div style={{fontSize:10,color:'var(--grl)',marginBottom:12,fontWeight:300}}>{fechaDisplay}</div>
        <div className="field">
          <label>Nota</label>
          <textarea className="input" value={nuevaNota} onChange={e=>setNuevaNota(e.target.value)}
            placeholder="ej. Traer bandas elásticas azules, llamar a Carmen para confirmar..."
            style={{minHeight:80}} autoFocus/>
        </div>
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-d btn-sm" onClick={onCerrar}>Cancelar</button>
          <div style={{flex:1}}/>
          <button className="btn btn-p" onClick={onGuardar} disabled={!nuevaNota.trim()}>💾 Guardar nota</button>
        </div>
      </div>
    </div>
  )
}
