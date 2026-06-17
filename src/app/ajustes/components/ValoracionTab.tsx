'use client'

export default function ValoracionTab({ ajustes, set, comoNosConocio, setComoNosConocio, tiposClase, setTiposClase, tiposJornada, setTiposJornada, tiposPlantilla, setTiposPlantilla, deportesLista, setDeportesLista, nuevoComoNos, setNuevoComoNos, nuevoJornada, setNuevoJornada, nuevoPlantilla, setNuevoPlantilla, nuevoDeporte, setNuevoDeporte }: any) {
  return (
    <div>
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title">🔍 ¿Cómo nos conoció?</div>
        <div style={{fontSize:10,color:'var(--grl)',marginBottom:10}}>Opciones que aparecen en el paso 1 de la valoración</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
          {comoNosConocio.map((op:string,i:number)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:99,background:'var(--bl)',border:'1px solid var(--bd)'}}>
              <span style={{fontSize:10,color:'var(--n)'}}>{op}</span>
              <button onClick={()=>setComoNosConocio((p:string[])=>p.filter((_,j)=>j!==i))} style={{fontSize:9,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:6}}>
          <input className="input" value={nuevoComoNos} onChange={e=>setNuevoComoNos(e.target.value)} placeholder="Nueva opción..." style={{flex:1,fontSize:11}}
            onKeyDown={e=>{if(e.key==='Enter'&&nuevoComoNos){setComoNosConocio((p:string[])=>[...p,nuevoComoNos]);setNuevoComoNos('')}}}/>
          <button className="btn btn-p btn-sm" onClick={()=>{if(nuevoComoNos){setComoNosConocio((p:string[])=>[...p,nuevoComoNos]);setNuevoComoNos('')}}}>+ Añadir</button>
        </div>
      </div>

      <div className="card" style={{marginBottom:12}}>
        <div className="card-title">🏋 Tipos de clase</div>
        <div style={{fontSize:10,color:'var(--grl)',marginBottom:10}}>Opciones de clase/entreno. El color y la duración se usan en la agenda.</div>
        <div style={{marginBottom:10}}>
          {tiposClase.map((tc:any,i:number)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,background:'var(--bl)',border:'1px solid var(--bd)',marginBottom:5}}>
              <input type="color" value={tc.color||'#5A969E'} onChange={e=>setTiposClase((p:any[])=>p.map((x,j)=>j===i?{...x,color:e.target.value}:x))} style={{width:24,height:24,border:'none',borderRadius:6,cursor:'pointer',background:'none',flexShrink:0}} title="Color en la agenda"/>
              <span style={{fontSize:14}}>{tc.icono}</span>
              <input className="input" value={tc.nombre} onChange={e=>setTiposClase((p:any[])=>p.map((x,j)=>j===i?{...x,nombre:e.target.value}:x))} style={{flex:1,fontSize:11,padding:'4px 8px'}}/>
              <label style={{fontSize:9,color:'var(--grl)',display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                <input className="input" type="number" value={tc.duracion||50} onChange={e=>setTiposClase((p:any[])=>p.map((x,j)=>j===i?{...x,duracion:parseInt(e.target.value)||0}:x))} style={{width:50,fontSize:9,padding:'2px 5px'}}/>min
              </label>
              <button onClick={()=>setTiposClase((p:any[])=>p.filter((_,j)=>j!==i))} style={{fontSize:9,color:'var(--red)',background:'none',border:'none',cursor:'pointer',flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <input className="input" placeholder="Icono" style={{width:60,fontSize:11}} id="nuevo-tipo-icono"/>
          <input className="input" placeholder="Nombre ej. Mayores" style={{flex:1,fontSize:11}} id="nuevo-tipo-nombre"/>
          <button className="btn btn-p btn-sm" onClick={()=>{
            const ic=(document.getElementById('nuevo-tipo-icono') as HTMLInputElement).value
            const nm=(document.getElementById('nuevo-tipo-nombre') as HTMLInputElement).value
            if(nm){setTiposClase((p:any[])=>[...p,{valor:nm.toLowerCase().replace(/\s/g,'_'),icono:ic||'📌',nombre:nm,color:'#5A969E',duracion:50}]);(document.getElementById('nuevo-tipo-icono') as HTMLInputElement).value='';(document.getElementById('nuevo-tipo-nombre') as HTMLInputElement).value=''}
          }}>+ Añadir</button>
        </div>
      </div>

      <div className="card" style={{marginBottom:12}}>
        <div className="card-title">🏃 Tipos de jornada laboral</div>
        <div style={{fontSize:10,color:'var(--grl)',marginBottom:10}}>Opciones del selector de tipo de jornada en la valoración</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
          {tiposJornada.map((op:string,i:number)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:99,background:'var(--bl)',border:'1px solid var(--bd)'}}>
              <span style={{fontSize:10,color:'var(--n)'}}>{op}</span>
              <button onClick={()=>setTiposJornada((p:string[])=>p.filter((_,j)=>j!==i))} style={{fontSize:9,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:6}}>
          <input className="input" value={nuevoJornada} onChange={e=>setNuevoJornada(e.target.value)} placeholder="Nueva opción..." style={{flex:1,fontSize:11}}
            onKeyDown={e=>{if(e.key==='Enter'&&nuevoJornada){setTiposJornada((p:string[])=>[...p,nuevoJornada]);setNuevoJornada('')}}}/>
          <button className="btn btn-p btn-sm" onClick={()=>{if(nuevoJornada){setTiposJornada((p:string[])=>[...p,nuevoJornada]);setNuevoJornada('')}}}>+ Añadir</button>
        </div>
      </div>

      <div className="card" style={{marginBottom:12}}>
        <div className="card-title">🦶 Tipos de plantilla</div>
        <div style={{fontSize:10,color:'var(--grl)',marginBottom:10}}>Opciones del selector de tipo de plantilla</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
          {tiposPlantilla.map((op:string,i:number)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:99,background:'var(--bl)',border:'1px solid var(--bd)'}}>
              <span style={{fontSize:10,color:'var(--n)'}}>{op}</span>
              <button onClick={()=>setTiposPlantilla((p:string[])=>p.filter((_,j)=>j!==i))} style={{fontSize:9,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:6}}>
          <input className="input" value={nuevoPlantilla} onChange={e=>setNuevoPlantilla(e.target.value)} placeholder="Nueva opción..." style={{flex:1,fontSize:11}}
            onKeyDown={e=>{if(e.key==='Enter'&&nuevoPlantilla){setTiposPlantilla((p:string[])=>[...p,nuevoPlantilla]);setNuevoPlantilla('')}}}/>
          <button className="btn btn-p btn-sm" onClick={()=>{if(nuevoPlantilla){setTiposPlantilla((p:string[])=>[...p,nuevoPlantilla]);setNuevoPlantilla('')}}}>+ Añadir</button>
        </div>
      </div>

      <div className="card" style={{marginBottom:12}}>
        <div className="card-title">🏃 Deportes</div>
        <div style={{fontSize:10,color:'var(--grl)',marginBottom:10}}>Lista de deportes disponibles en la valoración</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
          {deportesLista.map((op:string,i:number)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:99,background:'var(--bl)',border:'1px solid var(--bd)'}}>
              <span style={{fontSize:10,color:'var(--n)'}}>{op}</span>
              <button onClick={()=>setDeportesLista((p:string[])=>p.filter((_,j)=>j!==i))} style={{fontSize:9,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:6}}>
          <input className="input" value={nuevoDeporte} onChange={e=>setNuevoDeporte(e.target.value)} placeholder="Nuevo deporte..." style={{flex:1,fontSize:11}}
            onKeyDown={e=>{if(e.key==='Enter'&&nuevoDeporte){setDeportesLista((p:string[])=>[...p,nuevoDeporte]);setNuevoDeporte('')}}}/>
          <button className="btn btn-p btn-sm" onClick={()=>{if(nuevoDeporte){setDeportesLista((p:string[])=>[...p,nuevoDeporte]);setNuevoDeporte('')}}}>+ Añadir</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">✍️ Consentimiento y firma</div>
        <div style={{fontSize:10,color:'var(--grl)',marginBottom:10}}>Configura cómo se recoge el consentimiento en la valoración</div>
        {(['firma_canvas','firma_checkbox'] as const).map((clave)=>(
          <div key={clave} onClick={()=>set(clave,ajustes[clave]==='true'?'false':'true')}
            style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:6,border:`1px solid ${ajustes[clave]==='true'?'var(--g)':'var(--bd)'}`,background:ajustes[clave]==='true'?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:6}}>
            <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${ajustes[clave]==='true'?'var(--g)':'var(--bd)'}`,background:ajustes[clave]==='true'?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              {ajustes[clave]==='true'&&<span style={{color:'#fff',fontSize:11,fontWeight:700}}>✓</span>}
            </div>
            <span style={{fontSize:11,color:'var(--n)'}}>{clave==='firma_canvas'?'Firma con el dedo / ratón (canvas)':'Checkbox de aceptación'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
