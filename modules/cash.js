(function(){
  function render(ctx){
    ctx.setTitle('Caja diaria');

    const db = ctx.db;
    const today = Utils.todayYMD();
    let day = db.data.cashDays.find(d=>d.date===today);

    if(!day){
      day = {
        date: today,
        opened_at: null,
        closed_at: null,
        opening_cash: 0,
        closing_cash_counted: 0,
        notes: '',
        movements: [] // {id, created_at, direction(in/out), amount, concept, method, ref}
      };
      db.data.cashDays.push(day);
      ctx.setDB(db);
    }

    const isOpen = !!day.opened_at && !day.closed_at;

    const totalIn = day.movements.filter(m=>m.direction==='in').reduce((a,m)=>a+Number(m.amount||0),0);
    const totalOut = day.movements.filter(m=>m.direction==='out').reduce((a,m)=>a+Number(m.amount||0),0);
    const theoretical = Number(day.opening_cash||0) + totalIn - totalOut;
    const counted = Number(day.closing_cash_counted||0);
    const diff = counted - theoretical;

    const btnOpen = document.createElement('button');
    btnOpen.className = 'btn btn--primary';
    btnOpen.textContent = isOpen ? 'Caja abierta' : 'Abrir caja';
    btnOpen.disabled = isOpen;
    btnOpen.onclick = ()=>openCash(ctx, day);

    const btnMove = document.createElement('button');
    btnMove.className = 'btn';
    btnMove.textContent = 'Movimiento manual';
    btnMove.disabled = !isOpen;
    btnMove.onclick = ()=>openMove(ctx, day);

    const btnClose = document.createElement('button');
    btnClose.className = 'btn btn--danger';
    btnClose.textContent = 'Cerrar caja';
    btnClose.disabled = !isOpen;
    btnClose.onclick = ()=>closeCash(ctx, day);

    ctx.setActions([btnOpen, btnMove, btnClose]);

    ctx.appEl.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="badge ${isOpen ? 'badge--ok' : 'badge--bad'}">
            Estado: <b>${isOpen ? 'ABIERTA' : 'CERRADA'}</b>
          </div>
          <div class="small" style="margin-top:8px">
            La caja registra solamente efectivo. Los cobros por tarjeta/transferencia/bizum quedan en facturas, pero no entran en caja.
          </div>
        </div>
        <div class="col">
          <div class="badge badge--info">
            Día: <b class="mono">${today}</b>
          </div>
          <div class="small" style="margin-top:8px">
            Apertura: ${day.opened_at ? new Date(day.opened_at).toLocaleString('es-ES') : '—'} ·
            Cierre: ${day.closed_at ? new Date(day.closed_at).toLocaleString('es-ES') : '—'}
          </div>
        </div>
      </div>

      <hr class="sep"/>

      <div class="row">
        <div class="col">
          <div class="kpi">
            <div class="kpi__label">Efectivo inicial</div>
            <div class="kpi__value">${Utils.formatEUR(day.opening_cash, db.settings.locale)}</div>
            <div class="kpi__sub">Apertura</div>
          </div>
        </div>
        <div class="col">
          <div class="kpi">
            <div class="kpi__label">Entradas (efectivo)</div>
            <div class="kpi__value">${Utils.formatEUR(totalIn, db.settings.locale)}</div>
            <div class="kpi__sub">Movimientos “in”</div>
          </div>
        </div>
        <div class="col">
          <div class="kpi">
            <div class="kpi__label">Salidas (efectivo)</div>
            <div class="kpi__value">${Utils.formatEUR(totalOut, db.settings.locale)}</div>
            <div class="kpi__sub">Movimientos “out”</div>
          </div>
        </div>
        <div class="col">
          <div class="kpi">
            <div class="kpi__label">Teórico</div>
            <div class="kpi__value">${Utils.formatEUR(theoretical, db.settings.locale)}</div>
            <div class="kpi__sub">Inicial + entradas − salidas</div>
          </div>
        </div>
      </div>

      <hr class="sep"/>

      <div class="row">
        <div class="col">
          <div class="kpi">
            <div class="kpi__label">Contado</div>
            <div class="kpi__value">${Utils.formatEUR(counted, db.settings.locale)}</div>
            <div class="kpi__sub">Al cierre</div>
          </div>
        </div>
        <div class="col">
          <div class="kpi">
            <div class="kpi__label">Descuadre</div>
            <div class="kpi__value">${Utils.formatEUR(diff, db.settings.locale)}</div>
            <div class="kpi__sub">${diff===0 ? 'Cuadra' : (diff>0 ? 'Sobra' : 'Falta')}</div>
          </div>
        </div>
        <div class="col">
          <div class="field">
            <div class="label">Notas del día</div>
            <textarea class="textarea" id="cashNotes" placeholder="Anotaciones...">${Utils.escapeHtml(day.notes||'')}</textarea>
          </div>
          <button class="btn" id="saveNotes">Guardar notas</button>
        </div>
      </div>

      <hr class="sep"/>

      <h3 style="margin:0 0 10px">Movimientos (efectivo)</h3>
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Fecha/hora</th>
              <th>Tipo</th>
              <th>Concepto</th>
              <th>Método</th>
              <th>Ref</th>
              <th class="right">Importe</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    `;

    const rowsEl = ctx.appEl.querySelector('#rows');
    const list = (day.movements||[]).slice().sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));

    rowsEl.innerHTML = list.map(m=>{
      const badge = m.direction==='in' ? 'badge--ok' : 'badge--warn';
      const typeTxt = m.direction==='in' ? 'Entrada' : 'Salida';
      return `
        <tr>
          <td class="nowrap">${new Date(m.created_at).toLocaleString('es-ES')}</td>
          <td><span class="badge ${badge}">${typeTxt}</span></td>
          <td>${Utils.escapeHtml(m.concept||'')}</td>
          <td>${Utils.escapeHtml(m.method||'efectivo')}</td>
          <td class="mono">${Utils.escapeHtml(m.ref||'')}</td>
          <td class="right nowrap">${Utils.formatEUR(m.amount, db.settings.locale)}</td>
          <td class="nowrap">
            <button class="btn btn--danger" data-del="${m.id}">Eliminar</button>
          </td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="7" class="small">Sin movimientos.</td></tr>`;

    rowsEl.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
      const id = b.getAttribute('data-del');
      if(!Utils.confirmDanger('¿Eliminar movimiento de caja?')) return;
      day.movements = day.movements.filter(x=>x.id!==id);
      ctx.setDB(db);
      Utils.toast('Movimiento eliminado.');
      render(ctx);
    });

    ctx.appEl.querySelector('#saveNotes').onclick = ()=>{
      day.notes = ctx.appEl.querySelector('#cashNotes').value.trim();
      ctx.setDB(db);
      Utils.toast('Notas guardadas.');
    };
  }

  function openCash(ctx, day){
    const db = ctx.db;
    Modal.open({
      title: 'Abrir caja',
      bodyHTML: `
        <div class="small">Introduce el efectivo inicial (cambio) con el que empieza el día.</div>
        <div class="field" style="margin-top:10px">
          <div class="label">Efectivo inicial</div>
          <input class="input" id="openAmt" placeholder="0,00" />
        </div>
      `,
      footerButtons: [
        mkBtn('Cancelar','btn', ()=>Modal.close()),
        mkBtn('Abrir','btn btn--primary', ()=>{
          const amt = Utils.parseNumber(document.getElementById('openAmt').value);
          day.opening_cash = amt;
          day.opened_at = new Date().toISOString();
          day.closed_at = null;
          day.closing_cash_counted = 0;
          ctx.setDB(db);
          Modal.close();
          Utils.toast('Caja abierta.');
          render(ctx);
        })
      ]
    });
  }

  function openMove(ctx, day){
    const db = ctx.db;
    Modal.open({
      title:'Movimiento manual',
      bodyHTML: `
        <div class="row">
          <div class="col">
            <div class="field">
              <div class="label">Tipo</div>
              <select class="select" id="mDir">
                <option value="in">Entrada</option>
                <option value="out">Salida</option>
              </select>
            </div>
          </div>
          <div class="col">
            <div class="field">
              <div class="label">Importe *</div>
              <input class="input" id="mAmt" placeholder="0,00" />
            </div>
          </div>
        </div>
        <div class="field">
          <div class="label">Concepto *</div>
          <input class="input" id="mConcept" placeholder="Cambio, compra urgente, etc." />
        </div>
        <div class="small">Método: efectivo (la caja es para efectivo).</div>
      `,
      footerButtons: [
        mkBtn('Cancelar','btn', ()=>Modal.close()),
        mkBtn('Guardar','btn btn--primary', ()=>{
          const dir = document.getElementById('mDir').value;
          const amt = Utils.parseNumber(document.getElementById('mAmt').value);
          const concept = document.getElementById('mConcept').value.trim();
          if(amt<=0 || !concept){
            Utils.toast('Importe (>0) y concepto son obligatorios.');
            return;
          }
          day.movements.push({
            id: Utils.uid('cashmov'),
            created_at: new Date().toISOString(),
            direction: dir,
            amount: amt,
            concept,
            method: 'efectivo',
            ref: ''
          });
          ctx.setDB(db);
          Modal.close();
          Utils.toast('Movimiento guardado.');
          render(ctx);
        })
      ]
    });
  }

  function closeCash(ctx, day){
    const db = ctx.db;
    Modal.open({
      title:'Cerrar caja',
      bodyHTML: `
        <div class="small">Cuenta el efectivo real y escribe el total. La app calculará el descuadre.</div>
        <div class="field" style="margin-top:10px">
          <div class="label">Efectivo contado</div>
          <input class="input" id="closeAmt" placeholder="0,00" />
        </div>
        <div class="field">
          <div class="label">Notas (opcional)</div>
          <textarea class="textarea" id="closeNotes" placeholder="Incidencias...">${Utils.escapeHtml(day.notes||'')}</textarea>
        </div>
      `,
      footerButtons: [
        mkBtn('Cancelar','btn', ()=>Modal.close()),
        mkBtn('Cerrar','btn btn--danger', ()=>{
          const amt = Utils.parseNumber(document.getElementById('closeAmt').value);
          day.closing_cash_counted = amt;
          day.notes = document.getElementById('closeNotes').value.trim();
          day.closed_at = new Date().toISOString();
          ctx.setDB(db);
          Modal.close();
          Utils.toast('Caja cerrada.');
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

  window.ModCash = { render };
})();
