(function(){
  function ensure(){
    let b=document.getElementById('modalBackdrop');
    if(b) return b;
    b=document.createElement('div');
    b.id='modalBackdrop';
    b.className='modalBackdrop';
    b.innerHTML=`
      <div class="modal">
        <div class="modal__head">
          <h3 id="modalTitle"></h3>
          <button class="btn" id="modalClose">Cerrar</button>
        </div>
        <div class="modal__body" id="modalBody"></div>
        <div class="modal__foot" id="modalFoot"></div>
      </div>`;
    document.body.appendChild(b);
    b.querySelector('#modalClose').onclick=close;
    return b;
  }

  function open({title,bodyHTML,footerButtons}){
    const b=ensure();
    b.querySelector('#modalTitle').textContent=title||'';
    b.querySelector('#modalBody').innerHTML=bodyHTML||'';
    const f=b.querySelector('#modalFoot');
    f.innerHTML='';
    (footerButtons||[]).forEach(x=>f.appendChild(x));
    b.classList.add('show');
  }

  function close(){
    const b=document.getElementById('modalBackdrop');
    if(b) b.classList.remove('show');
  }

  window.Modal={open,close};
})();
