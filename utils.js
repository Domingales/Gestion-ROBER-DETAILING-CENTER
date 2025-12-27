(function(){
  function uid(p='id'){
    return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }

  function todayYMD(){
    const d=new Date();
    return d.toISOString().slice(0,10);
  }

  function parseNumber(v){
    if(typeof v==='number') return v;
    return Number(String(v||'').replace('.','').replace(',','.'))||0;
  }

  function formatEUR(n,loc='es-ES'){
    return Number(n||0).toLocaleString(loc,{style:'currency',currency:'EUR'});
  }

  function formatNumber(n,loc='es-ES',d=2){
    return Number(n||0).toLocaleString(loc,{minimumFractionDigits:d,maximumFractionDigits:d});
  }

  function escapeHtml(s){
    return String(s||'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function toast(msg){
    const t=document.getElementById('toast');
    t.textContent=msg;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),2000);
  }

  function confirmDanger(msg){ return confirm(msg); }

  function openFilePicker(input){
    input.value='';
    input.click();
  }

  window.Utils={
    uid,todayYMD,parseNumber,formatEUR,formatNumber,
    escapeHtml,toast,confirmDanger,openFilePicker
  };
})();
