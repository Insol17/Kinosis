(function(){
  'use strict';
  let toastTimer=null;
  let resolver=null;
  function toast(message){
    const el=document.getElementById('toast'); if(!el)return;
    el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>el.classList.remove('show'),2200);
  }
  function showDialog(id){ const d=document.getElementById(id); if(d&&!d.open)d.showModal(); }
  function closeDialog(id){ const d=document.getElementById(id); if(d?.open)d.close(); }
  function resolve(value){ if(resolver){const r=resolver;resolver=null;r(value);} closeDialog('utilityDialog'); }
  function ask(opts={}){
    const d=document.getElementById('utilityDialog');
    document.getElementById('utilityEyebrow').textContent=opts.eyebrow||'KINOSIS';
    document.getElementById('utilityTitle').textContent=opts.title||'확인';
    document.getElementById('utilityMessage').textContent=opts.message||'';
    const inputWrap=document.getElementById('utilityInputWrap');
    const input=document.getElementById('utilityInput');
    const selectWrap=document.getElementById('utilitySelectWrap');
    const select=document.getElementById('utilitySelect');
    inputWrap.hidden=!opts.input; selectWrap.hidden=!opts.select;
    if(opts.input){document.getElementById('utilityInputLabel').textContent=opts.input.label||'입력';input.value=opts.input.value||'';input.placeholder=opts.input.placeholder||'';}
    if(opts.select){document.getElementById('utilitySelectLabel').textContent=opts.select.label||'선택';select.innerHTML=(opts.select.options||[]).map(o=>`<option value="${String(o.value).replace(/"/g,'&quot;')}">${String(o.label)}</option>`).join('');select.value=opts.select.value||select.value;}
    const confirm=document.getElementById('utilityConfirm');
    confirm.textContent=opts.confirmText||'확인'; confirm.classList.toggle('danger-button',!!opts.danger);
    showDialog('utilityDialog');
    setTimeout(()=>{if(opts.input)input.focus();else if(opts.select)select.focus();else confirm.focus();},50);
    return new Promise(r=>{resolver=r;});
  }
  document.getElementById('utilityForm')?.addEventListener('submit',e=>{
    e.preventDefault(); const inputWrap=document.getElementById('utilityInputWrap'); const selectWrap=document.getElementById('utilitySelectWrap');
    resolve({confirmed:true,input:inputWrap.hidden?null:document.getElementById('utilityInput').value,select:selectWrap.hidden?null:document.getElementById('utilitySelect').value});
  });
  document.addEventListener('click',e=>{ if(e.target.closest('[data-utility-cancel]'))resolve({confirmed:false,input:null,select:null}); });
  document.getElementById('utilityDialog')?.addEventListener('cancel',e=>{e.preventDefault();resolve({confirmed:false,input:null,select:null});});
  window.KINOSIS_UI=Object.freeze({toast,showDialog,closeDialog,ask});
})();
