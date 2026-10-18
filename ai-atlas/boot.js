/* Independent startup watchdog: a missing app script must not leave an endless spinner. */
(function(){
  function failed(message){
    const text=document.getElementById('statusText'),status=document.getElementById('status'),retry=document.getElementById('retry');
    if(!text||!status||!retry)return;
    status.dataset.state='error';text.textContent=message;retry.hidden=false;
    retry.onclick=function(){window.location.reload();};
  }
  window.addEventListener('error',function(e){
    if(e.target&&e.target.tagName==='SCRIPT')failed('The application script could not be loaded. Retry loading.');
    else if(e.error)failed('The application could not start. Retry loading.');
  },true);
  setTimeout(function(){const s=document.getElementById('status');if(s&&s.dataset.state==='loading')failed('Loading took too long. Retry loading.');},15000);
})();
