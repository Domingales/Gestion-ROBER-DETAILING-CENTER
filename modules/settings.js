(function(){
  function render(ctx){
    ctx.setTitle('Ajustes');

    const db = ctx.db;
    const biz = db.settings.business;

    const btnSave = document.createElement('button');
    btnSave.className = 'btn btn--primary';
    btnSave.textContent = 'Guardar ajustes';
    btnSave.onclick = ()=>{
      biz.comercial = document.getElementById('sCom').value.trim() || biz.comercial;
      biz.cif = document.getElementById('sCif').value.trim() || biz.cif;
      biz.address = document.getElementById('sAddr').value.trim();
      biz.phone = document.getElementById('sPhone').value.trim();
      biz.email = document.getElementById('sEmail').value.trim();
      biz.vat_percent = Number(document.getElementById('sVat').value) || 21;

      db.settings.numbering.invoice_prefix = document.getElementById('sInvPrefix').value.trim() || 'F';
      db.settings.numbering.delivery_prefix = document.getElementById('sDelPrefix').value.trim() || 'A';
      db.settings.numbering.pad = Number(document.getElementById('sPad').value) || 6;

      ctx.setDB(db);
      Utils.toast('Ajustes guardados.');
    };

    const btnReset = document.createElement('button');
    btnReset.className = 'btn btn--danger';
    btnReset.textContent = 'Borrar TODO (reset)';
    btnReset.onclick = ()=>{
      if(!Utils.confirmDanger('Esto borrará todos los datos (clientes, facturas, etc.). ¿Seguro?')) return;
      if(!Utils.confirmDanger('Confirmación final: ¿borrar TODO?')) return;
      DB.reset(DB.defaultDB());
      Utils.toast('App reiniciada.');
      location.hash = '#/dashboard';
      setTimeout(()=>location.reload(), 200);
    };

    ctx.setActions([btnSave, btnReset]);

    ctx.appEl.innerHTML = `
      <div class="badge badge--info">Datos del negocio usados en impresión de facturas/albaranes.</div>

      <hr class="sep"/>

      <div class="row">
        <div class="col">
          <h3 style="margin:0 0 10px">Negocio</h3>
          <div class="field">
            <div class="label">Nombre comercial</div>
            <input class="input" id="sCom" value="${Utils.escapeHtml(biz.comercial||'')}" />
          </div>
          <div class="field">
            <div class="label">CIF</div>
            <input class="input" id="sCif" value="${Utils.escapeHtml(biz.cif||'')}" />
          </div>
          <div class="field">
            <div class="label">Dirección</div>
            <input class="input" id="sAddr" value="${Utils.escapeHtml(biz.address||'')}" />
          </div>
          <div class="row">
            <div class="col">
              <div class="field">
                <div class="label">Teléfono</div>
                <input class="input" id="sPhone" value="${Utils.escapeHtml(biz.phone||'')}" />
              </div>
            </div>
            <div class="col">
              <div class="field">
                <div class="label">Email</div>
                <input class="input" id="sEmail" value="${Utils.escapeHtml(biz.email||'')}" />
              </div>
            </div>
          </div>
          <div class="field">
            <div class="label">IVA (%)</div>
            <input class="input" id="sVat" value="${Utils.escapeHtml(String(biz.vat_percent ?? 21))}" />
          </div>
        </div>

        <div class="col">
          <h3 style="margin:0 0 10px">Numeración</h3>
          <div class="row">
            <div class="col">
              <div class="field">
                <div class="label">Prefijo facturas</div>
                <input class="input" id="sInvPrefix" value="${Utils.escapeHtml(db.settings.numbering.invoice_prefix||'F')}" />
              </div>
            </div>
            <div class="col">
              <div class="field">
                <div class="label">Prefijo albaranes</div>
                <input class="input" id="sDelPrefix" value="${Utils.escapeHtml(db.settings.numbering.delivery_prefix||'A')}" />
              </div>
            </div>
          </div>
          <div class="field">
            <div class="label">Dígitos (relleno con ceros)</div>
            <input class="input" id="sPad" value="${Utils.escapeHtml(String(db.settings.numbering.pad||6))}" />
          </div>

          <hr class="sep"/>

          <div class="small">
            Nota: los contadores se guardan por año. Si quieres reiniciar un año, haz backup primero y luego “reset”.
          </div>
        </div>
      </div>
    `;
  }

  window.ModSettings = { render };
})();
