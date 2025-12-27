(function(){
  function getParams(){
    const h = location.hash || '';
    const q = h.split('?')[1] || '';
    const p = new URLSearchParams(q);
    return Object.fromEntries(p.entries());
  }

  function ensureYearCounters(db, yearStr){
    if(!db.settings.counters_by_year) db.settings.counters_by_year = {};
    if(!db.settings.counters_by_year[yearStr]){
      db.settings.counters_by_year[yearStr] = { invoice: 1, delivery: 1 };
    }
  }

  function nextInvoiceNumber(db){
    const yearStr = String(new Date().getFullYear());
    ensureYearCounters(db, yearStr);
    const pad = Number(db.settings.numbering.pad || 6);
    const prefix = db.settings.numbering.invoice_prefix || 'F';
    const n = db.settings.counters_by_year[yearStr].invoice || 1;
    db.settings.counters_by_year[yearStr].invoice = n + 1;
    return `${prefix}-${yearStr}-${String(n).padStart(pad,'0')}`;
  }

  function calcTotals(lines, vatPercent){
    const base = lines.reduce((a,l)=> a + (Number(l.qty||0) * Number(l.unit_price||0)), 0);
    const vat = base * (Number(vatPercent||0)/100);
    const total = base + vat;
    return { base, vat, total };
  }

  function render(ctx){
    ctx.setTitle('Facturas');

    const db = ctx.db;
    const params = getParams();
    const wantsNew = params.new === '1';

    const btnNew = document.createElement('button');
    btnNew.className = 'btn btn--primary';
    btnNew.textContent = 'Nueva factura';
    btnNew.onclick = ()=>openForm(ctx, null);

    ctx.setActions([btnNew]);

    const list = db.data.invoices.slice().sort((a,b)=> (b.issued_at||'').localeCompare(a.issued_at||''));

    ctx.appEl.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="field">
            <div class="label">Buscar</div>
            <input class="input" id="q" placeholder="Nº factura, cliente, total, estado..." />
          </div>
        </div>
      </div>

      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Estado cobro</th>
              <th>Método</th>
              <th class="right">Total</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>

      <div class="small" style="margin-top:10px">Marca las facturas como pagadas para mantener control real. Si cobras en efectivo y la caja de hoy está abierta, puedes registrar la entrada automáticamente.</div>
    `;

    const rowsEl = ctx.appEl.querySelector('#rows');
    const qEl = ctx.appEl.querySelector('#q');

    const renderRows = ()=>{
      const q = (qEl.value||'').toLowerCase().trim();
      const filtered = !q ? list : list.filter(inv=>{
        const client = db.data.clients.find(c=>c.id===inv.client_id);
        return [inv.number, inv.issued_at, client?.name, inv.total, inv.payment_status, inv.payment_method].some(v=>String(v||'').toLowerCase().includes(q));
      });

      rowsEl.innerHTML = filtered.map(inv=>{
        const client = db.data.clients.find(c=>c.id===inv.client_id);
        const badge = inv.payment_status==='pagada' ? 'badge--ok' : (inv.payment_status==='parcial' ? 'badge--warn' : 'badge--bad');
        return `
          <tr>
            <td class="mono"><b>${Utils.escapeHtml(inv.number||'')}</b></td>
            <td class="nowrap">${new Date(inv.issued_at).toLocaleString('es-ES')}</td>
            <td>${Utils.escapeHtml(client?.name || inv.client_name || '')}</td>
            <td><span class="badge ${badge}">${Utils.escapeHtml(inv.payment_status||'pendiente')}</span></td>
            <td>${Utils.escapeHtml(inv.payment_method||'—')}</td>
            <td class="right nowrap">${Utils.formatEUR(inv.total, db.settings.locale)}</td>
            <td class="nowrap">
              <button class="btn btn--ghost" data-view="${inv.id}">Ver/Editar</button>
              <button class="btn" data-pay="${inv.id}">Cobro</button>
              <button class="btn" data-print="${inv.id}">Imprimir</button>
              <button class="btn btn--danger" data-del="${inv.id}">Eliminar</button>
            </td>
          </tr>
        `;
      }).join('') || `<tr><td colspan="7" class="small">Sin facturas.</td></tr>`;

      rowsEl.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{
        const id = b.getAttribute('data-view');
        const inv = db.data.invoices.find(x=>x.id===id);
        openForm(ctx, inv);
      });

      rowsEl.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>{
        const id = b.getAttribute('data-pay');
        const inv = db.data.invoices.find(x=>x.id===id);
        if(inv) openPayment(ctx, inv);
      });

      rowsEl.querySelectorAll('[data-print]').forEach(b=>b.onclick=()=>{
        const id = b.getAttribute('data-print');
        const inv = db.data.invoices.find(x=>x.id===id);
        if(inv) printInvoice(db, inv);
      });

      rowsEl.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
        const id = b.getAttribute('data-del');
        const inv = db.data.invoices.find(x=>x.id===id);
        if(!inv) return;
        if(!Utils.confirmDanger('¿Eliminar factura? (no recomendado si ya se ha emitido oficialmente)')) return;
        // si venía de albaranes, desmarcar
        if(inv.related_delivery_ids?.length){
          inv.related_delivery_ids.forEach(did=>{
            const d = db.data.deliveryNotes.find(x=>x.id===did);
            if(d){
              d.status = 'pendiente';
              d.invoice_id = null;
              d.invoice_number = null;
            }
          });
        }
        db.data.invoices = db.data.invoices.filter(x=>x.id!==id);
        ctx.setDB(db);
        Utils.toast('Factura eliminada.');
        render(ctx);
      });
    };

    qEl.addEventListener('input', renderRows);
    renderRows();

    if(wantsNew) openForm(ctx, null);
  }

  function openForm(ctx, invoice){
    const db = ctx.db;
    const isNew = !invoice;
    const vatPercent = Number(db.settings.business.vat_percent || 21);

    const inv = invoice ? JSON.parse(JSON.stringify(invoice)) : {
      id: Utils.uid('fac'),
      number: '',
      issued_at: new Date().toISOString(),
      client_id: '',
      client_name: '',
      lines: [{ desc:'', qty:1, unit_price:0 }],
      base: 0, vat: 0, total: 0,
      notes: '',
      payment_status: 'pendiente',
      payment_method: 'efectivo',
      paid_amount: 0,
      related_delivery_ids: [],
      related_delivery_numbers: []
    };

    if(isNew){
      inv.number = nextInvoiceNumber(db);
      const t = calcTotals(inv.lines, vatPercent);
      inv.base=t.base; inv.vat=t.vat; inv.total=t.total;
    }

    const clients = db.data.clients.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    const clientOptions = ['<option value="">— Selecciona —</option>'].concat(
      clients.map(c=>`<option value="${c.id}" ${c.id===inv.client_id?'selected':''}>${Utils.escapeHtml(c.name)}</option>`)
    ).join('');

    Modal.open({
      title: isNew ? 'Nueva factura' : `Factura ${inv.number}`,
      bodyHTML: `
        <div class="row">
          <div class="col">
            <div class="badge badge--info">Nº factura: <b class="mono">${Utils.escapeHtml(inv.number)}</b></div>
            <div class="small" style="margin-top:6px">Estado: <span class="badge ${inv.payment_status==='pagada'?'badge--ok':(inv.payment_status==='parcial'?'badge--warn':'badge--bad')}">${Utils.escapeHtml(inv.payment_status)}</span></div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Fecha/hora</div>
              <input class="input" value="${new Date(inv.issued_at).toLocaleString('es-ES')}" disabled />
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <div class="field">
              <div class="label">Cliente *</div>
              <select class="select" id="iClient">${clientOptions}</select>
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Método de pago</div>
              <select class="select" id="iPay">
                ${['efectivo','tarjeta','transferencia','bizum'].map(m=>`<option value="${m}" ${m===inv.payment_method?'selected':''}>${m}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        ${inv.related_delivery_numbers?.length ? `<div class="small">Albaranes: <span class="mono">${inv.related_delivery_numbers.map(Utils.escapeHtml).join(', ')}</span></div>` : ''}

        <hr class="sep"/>

        <h3 style="margin:0 0 10px">Líneas</h3>
        <div class="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th class="right">Cantidad</th>
                <th class="right">Precio</th>
                <th class="right">Importe</th>
                <th>Acc.</th>
              </tr>
            </thead>
            <tbody id="lineRows"></tbody>
          </table>
        </div>
        <button class="btn" id="addLine">Añadir línea</button>

        <div class="totals">
          <div class="box">
            <div class="row">
              <div class="col small">Base</div>
              <div class="col right mono" id="tBase">—</div>
            </div>
            <div class="row" style="margin-top:6px">
              <div class="col small">IVA (${vatPercent}%)</div>
              <div class="col right mono" id="tVat">—</div>
            </div>
            <div class="row" style="margin-top:6px">
              <div class="col"><b>Total</b></div>
              <div class="col right mono" id="tTotal"><b>—</b></div>
            </div>
          </div>
        </div>

        <hr class="sep"/>

        <div class="field">
          <div class="label">Notas</div>
          <textarea class="textarea" id="iNotes" placeholder="Observaciones...">${Utils.escapeHtml(inv.notes||'')}</textarea>
        </div>
      `,
      footerButtons: [
        mkBtn('Cancelar','btn', ()=>Modal.close()),
        mkBtn('Imprimir','btn', ()=>printInvoice(db, inv)),
        mkBtn('Guardar','btn btn--primary', ()=>{
          const clientId = document.getElementById('iClient').value;
          if(!clientId){ Utils.toast('Selecciona cliente.'); return; }
          const client = db.data.clients.find(c=>c.id===clientId);
          inv.client_id = clientId;
          inv.client_name = client?.name || '';
          inv.payment_method = document.getElementById('iPay').value;
          inv.notes = document.getElementById('iNotes').value.trim();

          const rows = [...document.querySelectorAll('[data-line]')];
          const lines = rows.map(r=>{
            const idx = Number(r.getAttribute('data-line'));
            return {
              desc: document.getElementById(`ld_${idx}`).value.trim(),
              qty: Utils.parseNumber(document.getElementById(`lq_${idx}`).value),
              unit_price: Utils.parseNumber(document.getElementById(`lp_${idx}`).value)
            };
          }).filter(l=>l.desc && l.qty>0);

          if(lines.length===0){ Utils.toast('Añade al menos una línea con concepto.'); return; }
          inv.lines = lines;
          const t = calcTotals(inv.lines, vatPercent);
          inv.base=t.base; inv.vat=t.vat; inv.total=t.total;

          if(isNew){
            db.data.invoices.push(inv);
          }else{
            const idx = db.data.invoices.findIndex(x=>x.id===inv.id);
            if(idx>=0) db.data.invoices[idx] = inv;
          }
          ctx.setDB(db);
          Modal.close();
          Utils.toast('Factura guardada.');
          render(ctx);
        })
      ]
    });

    function renderLines(){
      const body = document.getElementById('lineRows');
      body.innerHTML = inv.lines.map((l, i)=>{
        const imp = Number(l.qty||0) * Number(l.unit_price||0);
        return `
          <tr data-line="${i}">
            <td><input class="input" id="ld_${i}" value="${Utils.escapeHtml(l.desc||'')}" placeholder="Servicio / concepto"/></td>
            <td class="right"><input class="input right" id="lq_${i}" value="${Utils.formatNumber(l.qty||0,'es-ES',2).replace('.',',')}" /></td>
            <td class="right"><input class="input right" id="lp_${i}" value="${Utils.formatNumber(l.unit_price||0,'es-ES',2).replace('.',',')}" /></td>
            <td class="right nowrap mono" id="li_${i}">${Utils.formatEUR(imp, db.settings.locale)}</td>
            <td class="nowrap"><button class="btn btn--danger" data-rm="${i}">Quitar</button></td>
          </tr>
        `;
      }).join('');
      body.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{
        const idx = Number(b.getAttribute('data-rm'));
        inv.lines.splice(idx,1);
        if(inv.lines.length===0) inv.lines.push({desc:'',qty:1,unit_price:0});
        renderLines(); recalcTotals();
      });
      inv.lines.forEach((_,i)=>{
        ['ld_','lq_','lp_'].forEach(prefix=>{
          const el = document.getElementById(prefix+i);
          if(el) el.addEventListener('input', ()=>{ recalcLine(i); recalcTotals(); });
        });
      });
    }

    function recalcLine(i){
      const qty = Utils.parseNumber(document.getElementById(`lq_${i}`).value);
      const price = Utils.parseNumber(document.getElementById(`lp_${i}`).value);
      const imp = qty * price;
      const el = document.getElementById(`li_${i}`);
      if(el) el.textContent = Utils.formatEUR(imp, db.settings.locale);
    }

    function recalcTotals(){
      const rows = [...document.querySelectorAll('[data-line]')];
      const lines = rows.map(r=>{
        const idx = Number(r.getAttribute('data-line'));
        return {
          desc: document.getElementById(`ld_${idx}`).value.trim(),
          qty: Utils.parseNumber(document.getElementById(`lq_${idx}`).value),
          unit_price: Utils.parseNumber(document.getElementById(`lp_${idx}`).value)
        };
      });
      const t = calcTotals(lines, vatPercent);
      document.getElementById('tBase').textContent = Utils.formatEUR(t.base, db.settings.locale);
      document.getElementById('tVat').textContent = Utils.formatEUR(t.vat, db.settings.locale);
      document.getElementById('tTotal').innerHTML = `<b>${Utils.formatEUR(t.total, db.settings.locale)}</b>`;
      inv.base=t.base; inv.vat=t.vat; inv.total=t.total;
    }

    document.getElementById('addLine').onclick = ()=>{
      inv.lines.push({desc:'',qty:1,unit_price:0});
      renderLines(); recalcTotals();
    };

    renderLines();
    recalcTotals();
  }

  function openPayment(ctx, invoice){
    const db = ctx.db;
    const inv = db.data.invoices.find(x=>x.id===invoice.id);
    if(!inv) return;

    const today = Utils.todayYMD();
    const day = db.data.cashDays.find(d=>d.date===today);
    const cashOpen = !!day?.opened_at && !day?.closed_at;

    Modal.open({
      title:`Cobro — ${inv.number}`,
      bodyHTML: `
        <div class="row">
          <div class="col">
            <div class="badge badge--info">Total: <b>${Utils.formatEUR(inv.total, db.settings.locale)}</b></div>
          </div>
          <div class="col">
            <div class="badge badge--info">Pagado: <b>${Utils.formatEUR(inv.paid_amount||0, db.settings.locale)}</b></div>
          </div>
        </div>

        <hr class="sep"/>

        <div class="row">
          <div class="col">
            <div class="field">
              <div class="label">Estado</div>
              <select class="select" id="pStatus">
                ${['pendiente','parcial','pagada'].map(s=>`<option value="${s}" ${s===inv.payment_status?'selected':''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Método</div>
              <select class="select" id="pMethod">
                ${['efectivo','tarjeta','transferencia','bizum'].map(m=>`<option value="${m}" ${m===inv.payment_method?'selected':''}>${m}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Importe cobrado ahora</div>
              <input class="input" id="pNow" placeholder="0,00" />
            </div>
          </div>
        </div>

        <div class="field">
          <label class="small">
            <input type="checkbox" id="pRegisterCash" ${cashOpen ? '' : 'disabled'} />
            Registrar entrada en caja (solo si es efectivo). ${cashOpen ? '' : '(Caja de hoy no está abierta)'}
          </label>
        </div>

        <div class="small">Consejo: si es “pagada”, el pagado debería ser igual al total.</div>
      `,
      footerButtons: [
        mkBtn('Cancelar','btn', ()=>Modal.close()),
        mkBtn('Guardar','btn btn--primary', ()=>{
          const status = document.getElementById('pStatus').value;
          const method = document.getElementById('pMethod').value;
          const nowAmt = Utils.parseNumber(document.getElementById('pNow').value);
          const registerCash = document.getElementById('pRegisterCash').checked;

          inv.payment_status = status;
          inv.payment_method = method;
          if(nowAmt>0) inv.paid_amount = Number(inv.paid_amount||0) + nowAmt;

          // normalizar si pagada/parcial/pendiente
          if(inv.payment_status==='pagada'){
            inv.paid_amount = inv.total;
          }else if(inv.payment_status==='pendiente'){
            inv.paid_amount = 0;
          }else{
            // parcial: clamp
            inv.paid_amount = Math.min(Math.max(inv.paid_amount, 0), inv.total);
          }

          // registrar caja si procede
          if(registerCash && cashOpen && method==='efectivo' && nowAmt>0){
            day.movements.push({
              id: Utils.uid('cashmov'),
              created_at: new Date().toISOString(),
              direction: 'in',
              amount: nowAmt,
              concept: `Cobro factura ${inv.number}`,
              method: 'efectivo',
              ref: inv.number
            });
          }

          ctx.setDB(db);
          Modal.close();
          Utils.toast('Cobro actualizado.');
          render(ctx);
        })
      ]
    });
  }

  function printInvoice(db, inv){
    const client = db.data.clients.find(c=>c.id===inv.client_id);
    const biz = db.settings.business;
    const vatPercent = Number(db.settings.business.vat_percent || 21);
    Printing.openPrintWindow(`Factura ${inv.number}`, buildPrintHTML({
      kind:'FACTURA', number:inv.number, created_at:inv.issued_at,
      business:biz, client: client || {name:inv.client_name||''},
      lines: inv.lines, base:inv.base, vat:inv.vat, total:inv.total, vatPercent,
      payment_status: inv.payment_status, payment_method: inv.payment_method
    }));
  }

  function buildPrintHTML({kind, number, created_at, business, client, lines, base, vat, total, vatPercent, payment_status, payment_method}){
    const biz = business || {};
    const cl = client || {};
    const linesHtml = (lines||[]).map(l=>{
      const qty = Number(l.qty||0);
      const price = Number(l.unit_price||0);
      const imp = qty*price;
      return `<tr>
        <td>${Utils.escapeHtml(l.desc||'')}</td>
        <td class="right">${Utils.formatNumber(qty,'es-ES',2)}</td>
        <td class="right">${Utils.formatEUR(price,'es-ES')}</td>
        <td class="right">${Utils.formatEUR(imp,'es-ES')}</td>
      </tr>`;
    }).join('');

    return `
      <div class="row">
        <div class="box" style="flex:1">
          <h1>${Utils.escapeHtml(biz.comercial || biz.name || 'ROBER DETAILING CENTER')}</h1>
          <div class="small muted">CIF: ${Utils.escapeHtml(biz.cif||'')}</div>
          ${biz.address ? `<div class="small muted">${Utils.escapeHtml(biz.address)}</div>`:''}
          ${biz.phone ? `<div class="small muted">Tel: ${Utils.escapeHtml(biz.phone)}</div>`:''}
          ${biz.email ? `<div class="small muted">Email: ${Utils.escapeHtml(biz.email)}</div>`:''}
        </div>
        <div class="box" style="width:320px">
          <h2>${kind}</h2>
          <div class="small"><b>Nº:</b> ${Utils.escapeHtml(number)}</div>
          <div class="small"><b>Fecha:</b> ${new Date(created_at).toLocaleString('es-ES')}</div>
          <div class="small"><b>IVA:</b> ${vatPercent}%</div>
          <div class="small"><b>Pago:</b> ${Utils.escapeHtml(payment_status||'pendiente')} · ${Utils.escapeHtml(payment_method||'')}</div>
        </div>
      </div>

      <div class="row" style="margin-top:12px">
        <div class="box" style="flex:1">
          <h2>Cliente</h2>
          <div class="small"><b>${Utils.escapeHtml(cl.name||'')}</b></div>
          ${cl.tax_id ? `<div class="small muted">NIF/CIF: ${Utils.escapeHtml(cl.tax_id)}</div>`:''}
          ${cl.address ? `<div class="small muted">${Utils.escapeHtml(cl.address)}</div>`:''}
          ${cl.phone ? `<div class="small muted">Tel: ${Utils.escapeHtml(cl.phone)}</div>`:''}
          ${cl.email ? `<div class="small muted">Email: ${Utils.escapeHtml(cl.email)}</div>`:''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th class="right">Cant.</th>
            <th class="right">Precio</th>
            <th class="right">Importe</th>
          </tr>
        </thead>
        <tbody>
          ${linesHtml || `<tr><td colspan="4" class="small muted">Sin líneas</td></tr>`}
        </tbody>
      </table>

      <div class="totals">
        <div class="box">
          <div class="row"><div class="small">Base</div><div class="right">${Utils.formatEUR(base,'es-ES')}</div></div>
          <div class="row"><div class="small">IVA</div><div class="right">${Utils.formatEUR(vat,'es-ES')}</div></div>
          <div class="row"><div><b>Total</b></div><div class="right"><b>${Utils.formatEUR(total,'es-ES')}</b></div></div>
        </div>
      </div>

      <div class="small muted" style="margin-top:10px">Documento generado por la app de gestión — ${Utils.escapeHtml(biz.comercial || biz.name || 'RDC')}</div>
    `;
  }

  function mkBtn(text, className, onClick){
    const b = document.createElement('button');
    b.className = className;
    b.textContent = text;
    b.onclick = onClick;
    return b;
  }

  window.ModInvoices = { render };
})();
