(function(){
  const CATS = ['Químicos', 'Agua', 'Luz', 'Alquiler', 'Mantenimiento', 'Herramientas', 'Publicidad', 'Nóminas', 'Impuestos', 'Otros'];

  function getParams(){
    const h = location.hash || '';
    const q = h.split('?')[1] || '';
    const p = new URLSearchParams(q);
    return Object.fromEntries(p.entries());
  }

  function render(ctx){
    ctx.setTitle('Gastos');

    const db = ctx.db;
    const params = getParams();
    const wantsNew = params.new === '1';

    const btnNew = document.createElement('button');
    btnNew.className = 'btn btn--primary';
    btnNew.textContent = 'Nuevo gasto';
    btnNew.onclick = ()=>openForm(ctx, null);

    ctx.setActions([btnNew]);

    const list = db.data.expenses.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));

    ctx.appEl.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="field">
            <div class="label">Buscar</div>
            <input class="input" id="q" placeholder="Proveedor, categoría, concepto..." />
          </div>
        </div>
      </div>

      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Categoría</th>
              <th>Concepto</th>
              <th>Método</th>
              <th class="right">Importe</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
      <div class="small" style="margin-top:10px">Si pagas un gasto en efectivo y la caja de hoy está abierta, puedes registrar la salida en caja.</div>
    `;

    const rowsEl = ctx.appEl.querySelector('#rows');
    const qEl = ctx.appEl.querySelector('#q');

    const renderRows = ()=>{
      const q = (qEl.value||'').toLowerCase().trim();
      const filtered = !q ? list : list.filter(e=>{
        return [e.date,e.vendor,e.category,e.concept,e.method,e.amount].some(v=>String(v||'').toLowerCase().includes(q));
      });

      rowsEl.innerHTML = filtered.map(e=>{
        return `
          <tr>
            <td class="nowrap">${new Date(e.date).toLocaleDateString('es-ES')}</td>
            <td>${Utils.escapeHtml(e.vendor||'')}</td>
            <td>${Utils.escapeHtml(e.category||'')}</td>
            <td>${Utils.escapeHtml(e.concept||'')}</td>
            <td>${Utils.escapeHtml(e.method||'')}</td>
            <td class="right nowrap">${Utils.formatEUR(e.amount, db.settings.locale)}</td>
            <td class="nowrap">
              <button class="btn btn--ghost" data-edit="${e.id}">Ver/Editar</button>
              <button class="btn btn--danger" data-del="${e.id}">Eliminar</button>
            </td>
          </tr>
        `;
      }).join('') || `<tr><td colspan="7" class="small">Sin gastos.</td></tr>`;

      rowsEl.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{
        const id = b.getAttribute('data-edit');
        const e = db.data.expenses.find(x=>x.id===id);
        openForm(ctx, e);
      });
      rowsEl.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
        const id = b.getAttribute('data-del');
        if(!Utils.confirmDanger('¿Eliminar gasto?')) return;
        db.data.expenses = db.data.expenses.filter(x=>x.id!==id);
        ctx.setDB(db);
        Utils.toast('Gasto eliminado.');
        render(ctx);
      });
    };

    qEl.addEventListener('input', renderRows);
    renderRows();

    if(wantsNew) openForm(ctx, null);
  }

  function openForm(ctx, expense){
    const db = ctx.db;
    const isNew = !expense;
    const e = expense ? JSON.parse(JSON.stringify(expense)) : {
      id: Utils.uid('gas'),
      date: new Date().toISOString(),
      vendor: '',
      category: 'Otros',
      concept: '',
      method: 'transferencia',
      amount: 0,
      notes: ''
    };

    const today = Utils.todayYMD();
    const day = db.data.cashDays.find(d=>d.date===today);
    const cashOpen = !!day?.opened_at && !day?.closed_at;

    Modal.open({
      title: isNew ? 'Nuevo gasto' : 'Editar gasto',
      bodyHTML: `
        <div class="row">
          <div class="col">
            <div class="field">
              <div class="label">Fecha</div>
              <input class="input" id="eDate" value="${new Date(e.date).toLocaleString('es-ES')}" disabled />
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Importe *</div>
              <input class="input" id="eAmount" value="${Utils.formatNumber(e.amount,'es-ES',2).replace('.',',')}" />
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <div class="field">
              <div class="label">Proveedor</div>
              <input class="input" id="eVendor" value="${Utils.escapeHtml(e.vendor||'')}" />
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Categoría</div>
              <select class="select" id="eCat">
                ${CATS.map(c=>`<option value="${c}" ${c===e.category?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Método</div>
              <select class="select" id="eMethod">
                ${['efectivo','tarjeta','transferencia','bizum'].map(m=>`<option value="${m}" ${m===e.method?'selected':''}>${m}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="field">
          <div class="label">Concepto *</div>
          <input class="input" id="eConcept" value="${Utils.escapeHtml(e.concept||'')}" />
        </div>

        <div class="field">
          <label class="small">
            <input type="checkbox" id="eRegisterCash" ${cashOpen ? '' : 'disabled'} />
            Registrar salida en caja (solo si es efectivo). ${cashOpen ? '' : '(Caja de hoy no está abierta)'}
          </label>
        </div>

        <div class="field">
          <div class="label">Notas</div>
          <textarea class="textarea" id="eNotes">${Utils.escapeHtml(e.notes||'')}</textarea>
        </div>
      `,
      footerButtons: [
        mkBtn('Cancelar','btn', ()=>Modal.close()),
        mkBtn('Guardar','btn btn--primary', ()=>{
          e.amount = Utils.parseNumber(document.getElementById('eAmount').value);
          e.vendor = document.getElementById('eVendor').value.trim();
          e.category = document.getElementById('eCat').value;
          e.method = document.getElementById('eMethod').value;
          e.concept = document.getElementById('eConcept').value.trim();
          e.notes = document.getElementById('eNotes').value.trim();

          if(e.amount<=0 || !e.concept){
            Utils.toast('Importe (>0) y concepto son obligatorios.');
            return;
          }

          const registerCash = document.getElementById('eRegisterCash').checked;

          if(isNew){
            db.data.expenses.push(e);
          }else{
            const idx = db.data.expenses.findIndex(x=>x.id===e.id);
            if(idx>=0) db.data.expenses[idx] = e;
          }

          if(registerCash && cashOpen && e.method==='efectivo'){
            day.movements.push({
              id: Utils.uid('cashmov'),
              created_at: new Date().toISOString(),
              direction: 'out',
              amount: e.amount,
              concept: `Gasto: ${e.concept}`,
              method: 'efectivo',
              ref: e.id
            });
          }

          ctx.setDB(db);
          Modal.close();
          Utils.toast('Gasto guardado.');
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

  window.ModExpenses = { render };
})();
