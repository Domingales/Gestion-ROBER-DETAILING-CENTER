(function(){
  function render(ctx){
    ctx.setTitle('Clientes');

    const db = ctx.db;

    const btnNew = document.createElement('button');
    btnNew.className = 'btn btn--primary';
    btnNew.textContent = 'Nuevo cliente';
    btnNew.onclick = ()=>openForm(ctx, null);

    ctx.setActions([btnNew]);

    const list = db.data.clients.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''));

    ctx.appEl.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="field">
            <div class="label">Buscar</div>
            <input class="input" id="q" placeholder="Nombre, NIF/CIF, teléfono..." />
          </div>
        </div>
      </div>

      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>NIF/CIF</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th>Dirección</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    `;

    const rowsEl = ctx.appEl.querySelector('#rows');
    const qEl = ctx.appEl.querySelector('#q');

    const renderRows = ()=>{
      const q = (qEl.value||'').toLowerCase().trim();
      const filtered = !q ? list : list.filter(c=>{
        return [c.name,c.tax_id,c.phone,c.email,c.address].some(v=>String(v||'').toLowerCase().includes(q));
      });

      rowsEl.innerHTML = filtered.map(c=>`
        <tr>
          <td><b>${Utils.escapeHtml(c.name||'')}</b></td>
          <td class="mono">${Utils.escapeHtml(c.tax_id||'')}</td>
          <td>${Utils.escapeHtml(c.phone||'')}</td>
          <td>${Utils.escapeHtml(c.email||'')}</td>
          <td>${Utils.escapeHtml(c.address||'')}</td>
          <td class="nowrap">
            <button class="btn btn--ghost" data-edit="${c.id}">Ver/Editar</button>
            <button class="btn btn--danger" data-del="${c.id}">Eliminar</button>
          </td>
        </tr>
      `).join('') || `<tr><td colspan="6" class="small">Sin clientes.</td></tr>`;

      rowsEl.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{
        const id = b.getAttribute('data-edit');
        const c = db.data.clients.find(x=>x.id===id);
        openForm(ctx, c);
      });

      rowsEl.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
        const id = b.getAttribute('data-del');
        const used = db.data.invoices.some(i=>i.client_id===id) || db.data.deliveryNotes.some(d=>d.client_id===id);
        if(used){
          alert('Este cliente ya está usado en facturas/albaranes. No se recomienda eliminarlo. Puedes editarlo y dejarlo como “inactivo” en notas.');
          return;
        }
        if(!Utils.confirmDanger('¿Eliminar cliente?')) return;
        db.data.clients = db.data.clients.filter(x=>x.id!==id);
        ctx.setDB(db);
        Utils.toast('Cliente eliminado.');
        render(ctx);
      });
    };

    qEl.addEventListener('input', renderRows);
    renderRows();
  }

  function openForm(ctx, client){
    const db = ctx.db;
    const isNew = !client;

    const c = client ? JSON.parse(JSON.stringify(client)) : {
      id: Utils.uid('cli'),
      created_at: new Date().toISOString(),
      name: '',
      tax_id: '',
      phone: '',
      email: '',
      address: '',
      notes: ''
    };

    Modal.open({
      title: isNew ? 'Nuevo cliente' : 'Editar cliente',
      bodyHTML: `
        <div class="row">
          <div class="col">
            <div class="field">
              <div class="label">Nombre *</div>
              <input class="input" id="cName" value="${Utils.escapeHtml(c.name||'')}" />
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">NIF/CIF</div>
              <input class="input" id="cTax" value="${Utils.escapeHtml(c.tax_id||'')}" />
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <div class="field">
              <div class="label">Teléfono</div>
              <input class="input" id="cPhone" value="${Utils.escapeHtml(c.phone||'')}" />
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Email</div>
              <input class="input" id="cEmail" value="${Utils.escapeHtml(c.email||'')}" />
            </div>
          </div>
        </div>

        <div class="field">
          <div class="label">Dirección</div>
          <textarea class="textarea" id="cAddr">${Utils.escapeHtml(c.address||'')}</textarea>
        </div>

        <div class="field">
          <div class="label">Notas</div>
          <textarea class="textarea" id="cNotes">${Utils.escapeHtml(c.notes||'')}</textarea>
        </div>
      `,
      footerButtons: [
        mkBtn('Cancelar','btn', ()=>Modal.close()),
        mkBtn('Guardar','btn btn--primary', ()=>{
          c.name = document.getElementById('cName').value.trim();
          if(!c.name){ Utils.toast('El nombre es obligatorio.'); return; }
          c.tax_id = document.getElementById('cTax').value.trim();
          c.phone = document.getElementById('cPhone').value.trim();
          c.email = document.getElementById('cEmail').value.trim();
          c.address = document.getElementById('cAddr').value.trim();
          c.notes = document.getElementById('cNotes').value.trim();

          if(isNew){
            db.data.clients.push(c);
          }else{
            const idx = db.data.clients.findIndex(x=>x.id===c.id);
            if(idx>=0) db.data.clients[idx] = c;
          }

          ctx.setDB(db);
          Modal.close();
          Utils.toast('Cliente guardado.');
          render(ctx);
        })
      ]
    });
  }

  function mkBtn(text, className, onClick){
    const b = document.createElement('button');
    b.className = className;
    b.textContent = text;
    b.onclick = onClick;
    return b;
  }

  window.ModClients = { render };
})();
