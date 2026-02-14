(function(){
  const KEY = 'nm_cookie_consent_v1';

  function getState(){
    try{ return JSON.parse(localStorage.getItem(KEY) || 'null'); }catch(e){ return null; }
  }
  function setState(state){
    localStorage.setItem(KEY, JSON.stringify({ ...state, ts: Date.now() }));
  }

  function hasConsent(){
    return !!getState();
  }

  function ensureStyles(){
    if(document.getElementById('nm-cookie-style')) return;
    const s = document.createElement('style');
    s.id = 'nm-cookie-style';
    s.textContent = `
      .nm-cookie{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:980px;margin:0 auto;}
      .nm-cookie .card{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
      .nm-cookie .txt{min-width:260px;flex:1}
      .nm-cookie .actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:flex-end}
      .nm-cookie .btn2{display:inline-flex;align-items:center;justify-content:center;padding:12px 16px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,.9);color:var(--text);cursor:pointer;font-weight:700}
      .nm-cookie .btn2:hover{border-color:rgba(47,125,50,.35)}
      .nm-cookie a{white-space:nowrap}
    `;
    document.head.appendChild(s);
  }

  function banner(){
    ensureStyles();
    const wrap = document.createElement('div');
    wrap.className = 'nm-cookie';
    wrap.innerHTML = `
      <div class="card">
        <div class="txt">
          <strong>Cookie</strong>
          <p class="p" style="margin:6px 0 0">Usiamo cookie tecnici necessari al funzionamento e, se acconsenti, cookie di misurazione per migliorare l’esperienza. Puoi cambiare idea in qualsiasi momento.</p>
          <p class="small" style="margin:8px 0 0">
            <a href="/pages/privacy/">Privacy Policy</a> ·
            <a href="/pages/cookie-policy/">Cookie Policy</a>
          </p>
        </div>
        <div class="actions">
          <button class="btn2" data-act="reject">Rifiuta</button>
          <button class="btn2" data-act="prefs">Impostazioni</button>
          <button class="btn" data-act="accept">Accetta</button>
        </div>
      </div>
    `;

    function close(){ wrap.remove(); }

    wrap.addEventListener('click', (e)=>{
      const b = e.target.closest('button');
      if(!b) return;
      const act = b.getAttribute('data-act');
      if(act === 'accept'){
        setState({ necessary:true, analytics:true, marketing:false });
        close();
      }
      if(act === 'reject'){
        setState({ necessary:true, analytics:false, marketing:false });
        close();
      }
      if(act === 'prefs'){
        openPrefs();
      }
    });

    document.body.appendChild(wrap);
  }

  function openPrefs(){
    ensureStyles();
    const existing = document.getElementById('nm-cookie-prefs');
    if(existing) existing.remove();

    const state = getState() || { necessary:true, analytics:false, marketing:false };
    const wrap = document.createElement('div');
    wrap.id = 'nm-cookie-prefs';
    wrap.className = 'nm-cookie';
    wrap.innerHTML = `
      <div class="card">
        <div class="txt">
          <strong>Preferenze cookie</strong>
          <p class="p" style="margin:6px 0 0">I cookie necessari sono sempre attivi. Puoi abilitare/disabilitare quelli di misurazione.</p>
          <div style="margin-top:10px;display:grid;gap:10px">
            <label class="small"><input type="checkbox" checked disabled /> Necessari</label>
            <label class="small"><input id="nm-ck-analytics" type="checkbox" ${state.analytics ? 'checked' : ''} /> Misurazione (analytics)</label>
          </div>
          <p class="small" style="margin:10px 0 0">
            <a href="/pages/privacy/">Privacy Policy</a> ·
            <a href="/pages/cookie-policy/">Cookie Policy</a>
          </p>
        </div>
        <div class="actions">
          <button class="btn2" data-act="close">Annulla</button>
          <button class="btn" data-act="save">Salva</button>
        </div>
      </div>
    `;

    wrap.addEventListener('click', (e)=>{
      const b = e.target.closest('button');
      if(!b) return;
      const act = b.getAttribute('data-act');
      if(act === 'close') wrap.remove();
      if(act === 'save'){
        const analytics = !!wrap.querySelector('#nm-ck-analytics')?.checked;
        setState({ necessary:true, analytics, marketing:false });
        wrap.remove();
      }
    });

    document.body.appendChild(wrap);
  }

  function attachFooterLink(){
    // Optional: footer link can call window.NM_openCookiePrefs()
    window.NM_openCookiePrefs = openPrefs;
  }

  function main(){
    attachFooterLink();
    if(!hasConsent()) banner();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
