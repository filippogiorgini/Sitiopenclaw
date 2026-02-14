(function(){
  // Minimal client-side tracking for Naturalma MVP.
  // Sends events to Supabase Edge Function track-event.

  const CID_KEY = 'nm_cid_v1';

  function getCid(){
    let cid = localStorage.getItem(CID_KEY);
    if(!cid){
      cid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(16).slice(2));
      localStorage.setItem(CID_KEY, cid);
    }
    return cid;
  }

  function endpoint(){
    return window.NATURALMA_TRACK_ENDPOINT || '';
  }

  async function send(event_type, meta){
    const ep = endpoint();
    if(!ep) return;
    try{
      await fetch(ep, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event_type,
          page_path: location.pathname,
          referrer: document.referrer || null,
          mini_guide_slug: window.NATURALMA_MINI_GUIDE_SLUG || null,
          cid: getCid(),
          meta: meta || {}
        })
      });
    } catch(e){
      // swallow
    }
  }

  window.NM_track = send;
  window.NM_getCid = getCid;

  // Auto page view
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>send('page_view', {}));
  } else {
    send('page_view', {});
  }
})();
