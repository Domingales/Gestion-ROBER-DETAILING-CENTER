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

  function nextNumber(db, kind){
    const yearStr = String(new Date().getFullYear());
    ensureYearCounters(db, yearStr);
    const pad = Number(db.settings.numbering.pad || 6);
    const prefix = kind === 'delivery' ? (db.settings.numbering.delivery_prefix || 'A') : (db.settings.numbering.invoice_prefix || 'F');
    const counterKey = (kind === 'delivery') ? 'delivery' : 'invoice';
    const n = db.settings.counters_by_year[yearStr][counterKey] || 1;
    db.settings.counters_by_year[yearStr][counterKey] = n + 1;
    return `${prefix}-${yearStr}-${String(n).padStart(pad,'0')}`;
  }

  function calcTotals(lines, vatPercent){
    const base = lines.reduce((a,l)=> a + (Number(l.qty||0) * Number(l.unit_price||0)), 0);
    const vat = base * (Number(vatPercent||0)/100);
    const total = base + vat;
    return { base, vat, total };
  }

  function render(ctx){
    ctx.setTitle('Albaranes');

    const db = ctx.db;
    const params = getParams();
    const wantsNew = params.new === '1';

    const btnNew = document.createElement('button');
    btnNew.className = 'btn btn--primary';
    btnNew.textContent = 'Nuevo albarán';
    btnNew.onclick = ()=>openForm(ctx, null);

    ctx.setActions([btnNew]);

    const list = db.data.deliveryNotes.slice().sort((a,b)=> (b.created_at||'').localeCompare(a.created_at||''));
    ctx.appEl.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="field">
            <div class="label">Buscar</div>
            <input class="input" id="q" placeholder="Nº albarán, cliente, total..." />
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
              <th>Estado</th>
              <th class="right">Total</th>
              <th>Factura</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>

      <div class="small" style="margin-top:10px">Sugerencia: crea albaranes rápidos y genera la factura desde aquí cuando toque.</div>
    `;

    const rowsEl = ctx.appEl.querySelector('#rows');
    const qEl = ctx.appEl.querySelector('#q');

    const renderRows = ()=>{
      const q = (qEl.value||'').toLowerCase().trim();
      const filtered = !q ? list : list.filter(d=>{
        const client = db.data.clients.find(c=>c.id===d.client_id);
        return [d.number, d.created_at, client?.name, d.total, d.status, d.invoice_number].some(v=>String(v||'').toLowerCase().includes(q));
      });

      rowsEl.innerHTML = filtered.map(d=>{
        const client = db.data.clients.find(c=>c.id===d.client_id);
        const statusBadge = d.status==='facturado' ? 'badge--info' : 'badge--ok';
        return `
          <tr>
            <td class="mono"><b>${Utils.escapeHtml(d.number||'')}</b></td>
            <td class="nowrap">${new Date(d.created_at).toLocaleString('es-ES')}</td>
            <td>${Utils.escapeHtml(client?.name || d.client_name || '')}</td>
            <td><span class="badge ${statusBadge}">${Utils.escapeHtml(d.status||'pendiente')}</span></td>
            <td class="right nowrap">${Utils.formatEUR(d.total, db.settings.locale)}</td>
            <td class="mono">${Utils.escapeHtml(d.invoice_number||'—')}</td>
            <td class="nowrap">
              <button class="btn btn--ghost" data-view="${d.id}">Ver/Editar</button>
              <button class="btn" data-invoice="${d.id}" ${d.status==='facturado'?'disabled':''}>Generar factura</button>
              <button class="btn btn--danger" data-del="${d.id}">Eliminar</button>
            </td>
          </tr>
        `;
      }).join('') || `<tr><td colspan="7" class="small">Sin albaranes.</td></tr>`;

      rowsEl.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{
        const id = b.getAttribute('data-view');
        const doc = db.data.deliveryNotes.find(x=>x.id===id);
        openForm(ctx, doc);
      });

      rowsEl.querySelectorAll('[data-invoice]').forEach(b=>b.onclick=()=>{
        const id = b.getAttribute('data-invoice');
        const doc = db.data.deliveryNotes.find(x=>x.id===id);
        if(!doc || doc.status==='facturado') return;
        generateInvoiceFromDelivery(ctx, doc);
      });

      rowsEl.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
        const id = b.getAttribute('data-del');
        const doc = db.data.deliveryNotes.find(x=>x.id===id);
        if(!doc) return;
        if(doc.status==='facturado'){
          alert('Este albarán ya está facturado. Si necesitas corregir, edita la factura correspondiente.');
          return;
        }
        if(!Utils.confirmDanger('¿Eliminar albarán?')) return;
        db.data.deliveryNotes = db.data.deliveryNotes.filter(x=>x.id!==id);
        ctx.setDB(db);
        Utils.toast('Albarán eliminado.');
        render(ctx);
      });
    };

    qEl.addEventListener('input', renderRows);
    renderRows();

    if(wantsNew) openForm(ctx, null);
  }

  function openForm(ctx, doc){
    const db = ctx.db;
    const isNew = !doc;
    const vatPercent = Number(db.settings.business.vat_percent || 21);

    const d = doc ? JSON.parse(JSON.stringify(doc)) : {
      id: Utils.uid('alb'),
      number: '',
      created_at: new Date().toISOString(),
      client_id: '',
      client_name: '',
      status: 'pendiente',
      lines: [{ desc:'', qty:1, unit_price:0 }],
      base: 0, vat: 0, total: 0,
      notes: '',
      invoice_id: null,
      invoice_number: null,
      payment_method: 'efectivo'
    };

    if(isNew){
      d.number = nextNumber(db, 'delivery');
      const t = calcTotals(d.lines, vatPercent);
      d.base=t.base; d.vat=t.vat; d.total=t.total;
    }

    const clients = db.data.clients.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    const clientOptions = ['<option value="">— Selecciona —</option>'].concat(
      clients.map(c=>`<option value="${c.id}" ${c.id===d.client_id?'selected':''}>${Utils.escapeHtml(c.name)}</option>`)
    ).join('');

    Modal.open({
      title: isNew ? 'Nuevo albarán' : `Albarán ${d.number}`,
      bodyHTML: `
        <div class="row">
          <div class="col">
            <div class="badge badge--info">Nº albarán: <b class="mono">${Utils.escapeHtml(d.number)}</b></div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Fecha/hora</div>
              <input class="input" id="dDate" value="${new Date(d.created_at).toLocaleString('es-ES')}" disabled />
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <div class="field">
              <div class="label">Cliente *</div>
              <select class="select" id="dClient">${clientOptions}</select>
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Método de pago (informativo)</div>
              <select class="select" id="dPay">
                ${['efectivo','tarjeta','transferencia','bizum'].map(m=>`<option value="${m}" ${m===d.payment_method?'selected':''}>${m}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

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
          <textarea class="textarea" id="dNotes" placeholder="Observaciones...">${Utils.escapeHtml(d.notes||'')}</textarea>
        </div>

        ${d.status==='facturado' ? `<div class="badge badge--info">Facturado en: <span class="mono">${Utils.escapeHtml(d.invoice_number||'')}</span></div>` : ``}
      `,
      footerButtons: [
        mkBtn('Cancelar','btn', ()=>Modal.close()),
        mkBtn('Imprimir','btn', ()=>{
          const db2 = DB.load();
          const client = db2.data.clients.find(c=>c.id===d.client_id);
          const biz = db2.settings.business;
          Printing.openPrintWindow(`Albarán ${d.number}`, buildPrintHTML({
            kind:'ALBARÁN', number:d.number, created_at:d.created_at,
            business:biz, client: client || {name:d.client_name||''},
            lines: d.lines, base:d.base, vat:d.vat, total:d.total, vatPercent
          }));
        }),
        mkBtn('Guardar','btn btn--primary', ()=>{
          // recoger UI
          const clientId = document.getElementById('dClient').value;
          if(!clientId){ Utils.toast('Selecciona cliente.'); return; }
          const client = db.data.clients.find(c=>c.id===clientId);
          d.client_id = clientId;
          d.client_name = client?.name || '';
          d.payment_method = document.getElementById('dPay').value;
          d.notes = document.getElementById('dNotes').value.trim();

          // guardar lines desde tabla
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
          d.lines = lines;
          const t = calcTotals(d.lines, vatPercent);
          d.base=t.base; d.vat=t.vat; d.total=t.total;

          // persistencia
          if(isNew){
            db.data.deliveryNotes.push(d);
          }else{
            const idx = db.data.deliveryNotes.findIndex(x=>x.id===d.id);
            if(idx>=0) db.data.deliveryNotes[idx] = d;
          }
          ctx.setDB(db);
          Modal.close();
          Utils.toast('Albarán guardado.');
          render(ctx);
        })
      ]
    });

    function renderLines(){
      const body = document.getElementById('lineRows');
      body.innerHTML = d.lines.map((l, i)=>{
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
        d.lines.splice(idx,1);
        if(d.lines.length===0) d.lines.push({desc:'',qty:1,unit_price:0});
        renderLines(); recalcTotals();
      });

      // listeners recalc
      d.lines.forEach((_,i)=>{
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
      // construir líneas actuales
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
      d.base=t.base; d.vat=t.vat; d.total=t.total;
    }

    document.getElementById('addLine').onclick = ()=>{
      d.lines.push({desc:'',qty:1,unit_price:0});
      renderLines(); recalcTotals();
    };

    renderLines();
    recalcTotals();
  }

  function generateInvoiceFromDelivery(ctx, delivery){
    const db = ctx.db;
    const vatPercent = Number(db.settings.business.vat_percent || 21);
    const inv = {
      id: Utils.uid('fac'),
      number: '',
      issued_at: new Date().toISOString(),
      client_id: delivery.client_id,
      client_name: delivery.client_name,
      lines: JSON.parse(JSON.stringify(delivery.lines||[])),
      base: 0, vat: 0, total: 0,
      notes: (delivery.notes||''),
      payment_status: 'pendiente',
      payment_method: delivery.payment_method || 'efectivo',
      paid_amount: 0,
      related_delivery_ids: [delivery.id],
      related_delivery_numbers: [delivery.number]
    };
    inv.number = nextNumber(db, 'invoice');
    const t = calcTotals(inv.lines, vatPercent);
    inv.base=t.base; inv.vat=t.vat; inv.total=t.total;

    db.data.invoices.push(inv);

    // marcar albarán como facturado
    delivery.status = 'facturado';
    delivery.invoice_id = inv.id;
    delivery.invoice_number = inv.number;

    const idx = db.data.deliveryNotes.findIndex(x=>x.id===delivery.id);
    if(idx>=0) db.data.deliveryNotes[idx] = delivery;

    ctx.setDB(db);
    Utils.toast(`Factura ${inv.number} generada.`);
    Modal.close?.();
    location.hash = '#/invoices';
  }

  function buildPrintHTML({kind, number, created_at, business, client, lines, base, vat, total, vatPercent}){
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

  window.ModDeliveryNotes = { render };
})();
