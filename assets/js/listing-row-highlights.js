/* Listing-only display metadata. Reuses the office-local unit highlight store. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.ListingRowHighlights = api;
    var start = function () {
      if (root.ListingRowHighlightsController || !root.document.getElementById('listingContainer')) return;
      try {
        root.ListingRowHighlightsController = api.create({
          document: root.document, container: root.document.getElementById('listingContainer'),
          unitHighlights: root.UnitRowHighlights,
          baseUrl: typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : root.SUPABASE_URL,
          getHeaders: function () { return typeof headers !== 'undefined' ? headers : root.headers; },
          fetchWithTimeout: function (url, init) {
            var send = typeof fetchWithTimeout !== 'undefined' ? fetchWithTimeout : root.fetchWithTimeout;
            if (typeof send !== 'function') throw new Error('강조 서버 연결 설정이 없습니다.');
            return send(url, init);
          },
          showToast: typeof showToast === 'function' ? showToast : root.showToast
        });
        root.ListingRowHighlightsController.load();
      } catch (error) { api.report(root.document, root.showToast, '강조 시작 실패: ' + error.message); }
    };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, {once:true});
    else start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var BUILDING_KEY = '__listing_rows_v1__';
  var COLORS = Object.freeze({yellow:'노랑', pink:'분홍', mint:'민트'});
  function listingKey(id, units) {
    if (typeof id !== 'string' || !id.trim()) return null;
    return units.unitKey({dong:'listing', room:id});
  }
  function report(doc, toast, message) {
    if (typeof toast === 'function') { try { toast(message, 4500); return; } catch (_) {} }
    var status = doc.getElementById('listing-highlight-status');
    if (!status) {
      status=doc.createElement('div'); status.id='listing-highlight-status';
      status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
      status.style.cssText='position:fixed;bottom:16px;left:16px;z-index:100001;max-width:calc(100vw - 32px);padding:10px;border:1px solid var(--border-slate,#889);border-radius:7px;background:var(--bg-card,#fff);color:var(--text,#203831);font-size:13px';
      doc.body.appendChild(status);
    }
    status.textContent=message;
  }
  function installStyle(doc) {
    if (doc.getElementById('listing-highlight-style')) return;
    var style=doc.createElement('style'); style.id='listing-highlight-style';
    style.textContent=
      '#listingContainer{--listing-highlight-select-width:44px}'+
      '#listingContainer [data-listing-highlight="yellow"]{--lrh-bg:#fff2bc;--lrh-edge:#b38a00}'+
      '#listingContainer [data-listing-highlight="pink"]{--lrh-bg:#ffe0ec;--lrh-edge:#be437d}'+
      '#listingContainer [data-listing-highlight="mint"]{--lrh-bg:#d4f6e8;--lrh-edge:#168361}'+
      'html body #listingContainer .listing-card[data-listing-highlight],html body #listingContainer .listing-card[data-listing-highlight]:hover,html body #listingContainer .listing-card[data-listing-highlight] > .listing-cell,html body #listingContainer tr[data-listing-highlight] > td,html body #listingContainer tr[data-listing-highlight]:hover > td{background:var(--lrh-bg)!important}'+
      'html body #listingContainer .listing-card[data-listing-highlight],html body #listingContainer tr[data-listing-highlight] > td:first-child{box-shadow:inset 3px 0 var(--lrh-edge)!important}'+
      '#listingContainer .btn-listing-highlight{display:block;box-sizing:border-box;width:34px;min-width:0;max-width:100%;height:auto;min-height:0;margin:4px 0 0;padding:3px 1px;border:1px solid var(--border-slate,#73817e);border-radius:4px;background:var(--bg-card,#fff);color:var(--text,#203831);font:600 11px/1.2 sans-serif;white-space:nowrap;cursor:pointer;letter-spacing:-.5px}'+
      '#listingContainer .btn-listing-highlight:disabled,.listing-highlight-palette button:disabled{opacity:.55;cursor:wait}'+
      '.listing-highlight-palette{position:fixed;z-index:100000;display:flex;flex-wrap:wrap;gap:5px;box-sizing:border-box;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;padding:9px;border:1px solid var(--border-slate,#a2b5ae);border-radius:9px;background:var(--bg-card,var(--card,#fff));color:var(--text,#203831);box-shadow:0 5px 22px #142b2840}'+
      '.listing-highlight-palette button{font:inherit;font-size:13px;padding:7px 9px;border:1px solid var(--border-slate,#9faea8);border-radius:6px;color:var(--text,#203831);background:var(--bg-card,#fff);cursor:pointer}'+
      '.listing-highlight-palette button[data-color="yellow"]{background:#fff2bc;color:#203831}'+
      '.listing-highlight-palette button[data-color="pink"]{background:#ffe0ec;color:#203831}'+
      '.listing-highlight-palette button[data-color="mint"]{background:#d4f6e8;color:#203831}'+
      '.listing-highlight-palette button:focus-visible,#listingContainer .btn-listing-highlight:focus-visible{outline:2px solid var(--gold,#25675f);outline-offset:2px}'+
      'html[data-theme="dark"] #listingContainer [data-listing-highlight="yellow"]{--lrh-bg:#514620}'+
      'html[data-theme="dark"] #listingContainer [data-listing-highlight="pink"]{--lrh-bg:#513343}'+
      'html[data-theme="dark"] #listingContainer [data-listing-highlight="mint"]{--lrh-bg:#234b40}'+
      '@media print{.btn-listing-highlight,.listing-highlight-palette,#listing-highlight-status{display:none!important}}';
    doc.head.appendChild(style);
  }
  function create(options) {
    var doc=options.document, container=options.container, units=options.unitHighlights;
    if (!doc || !container || !units || typeof units.createStore!=='function') throw new Error('매물 강조 모듈 설정이 없습니다.');
    if (!options.baseUrl || typeof options.getHeaders!=='function' || typeof options.fetchWithTimeout!=='function') throw new Error('강조 서버 연결 설정이 없습니다.');
    var store=units.createStore({baseUrl:options.baseUrl,buildingKey:BUILDING_KEY,getHeaders:options.getHeaders,fetchWithTimeout:options.fetchWithTimeout});
    var loading=null, saving=false, palette=null, opener=null, destroyed=false;
    var bound=new Map();
    var Observer=options.MutationObserver || doc.defaultView.MutationObserver;
    var observer=Observer ? new Observer(function () { render(); }) : null;
    function observe() { if (observer && !destroyed) observer.observe(container,{childList:true,subtree:true}); }
    function toast(message) { if (!destroyed) report(doc,options.showToast,message); }
    installStyle(doc);
    function close(restore) {
      if (palette) {palette.remove();palette=null;}
      if (opener) {opener.setAttribute('aria-expanded','false');if (restore && opener.isConnected && !opener.disabled) opener.focus();}
      opener=null;
    }
    function render() {
      if (destroyed) return;
      if (observer) observer.disconnect();
      try {
        bound.forEach(function (handler, button) { if (!container.contains(button)) { button.removeEventListener('click',handler);bound.delete(button); } });
        container.querySelectorAll('input[type="checkbox"][data-sel]').forEach(function (checkbox) {
          var row=checkbox.closest('.listing-card, tr');
          var host=checkbox.closest('.listing-cell-select, td.col-select, td');
          if (!row || !host || !row.contains(host) || !container.contains(row)) return;
          var key=listingKey(checkbox.dataset.sel,units); if (!key) return;
          var color=store.get(key);
          if (color) row.setAttribute('data-listing-highlight',color); else row.removeAttribute('data-listing-highlight');
          var button=host.querySelector('.btn-listing-highlight');
          if (!button) {
            button=doc.createElement('button');button.type='button';button.className='btn-listing-highlight';button.textContent='강조';
            button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
          }
          if (checkbox.nextSibling!==button) host.insertBefore(button,checkbox.nextSibling);
          button.dataset.listingKey=key;
          var name=row.querySelector('.listing-cell-name, .listing-cell-building, .listing-cell-apartment, .table-subtitle, .table-address');
          button.dataset.listingLabel=(name && name.textContent.trim().replace(/\s+/g,' ').slice(0,160)) || checkbox.dataset.sel;
          button.setAttribute('aria-label',button.dataset.listingLabel+' 강조');
          button.title=loading ? '강조 불러오는 중' : store.ready ? '매물 강조 색상 선택' : '강조 조회 재시도';
          button.disabled=!!loading || saving;
          if (!bound.has(button)) {
            var handler=function (event) {
              event.stopPropagation();event.preventDefault();
              return click(button);
            };
            button.addEventListener('click',handler);bound.set(button,handler);
          }
        });
        if (palette) {
          if (!opener || !container.contains(opener) || opener.dataset.listingKey!==palette.dataset.listingKey) close(false);
          else palette.querySelectorAll('button').forEach(function (b) {b.disabled=saving || !!loading;});
        }
      } finally {observe();}
    }
    async function load() {
      if (destroyed) return false;
      if (loading) return loading;
      loading=(async function () {
        try {await store.load();return true;}
        catch (error) {toast('강조 불러오기 실패: '+error.message+' 강조 버튼으로 다시 시도해주세요.');return false;}
        finally {loading=null;render();}
      })();
      render();return loading;
    }
    function position() {
      if (!palette || !opener) return;
      var rect=opener.getBoundingClientRect(),view=doc.defaultView;
      palette.style.left=Math.max(8,Math.min(rect.left,view.innerWidth-palette.offsetWidth-8))+'px';
      palette.style.top=Math.max(8,Math.min(rect.bottom+5,view.innerHeight-palette.offsetHeight-8))+'px';
    }
    function open(button) {
      close(false);opener=button;button.setAttribute('aria-expanded','true');
      var key=button.dataset.listingKey,label=button.dataset.listingLabel;
      palette=doc.createElement('div');palette.className='listing-highlight-palette';palette.dataset.listingKey=key;
      palette.setAttribute('role','dialog');palette.setAttribute('aria-label',label+' 강조 색상');
      Object.keys(COLORS).concat(['none']).forEach(function (color) {
        var choice=doc.createElement('button');choice.type='button';choice.dataset.color=color;choice.textContent=COLORS[color] || '강조 해제';
        choice.setAttribute('aria-label',label+' '+choice.textContent);
        choice.addEventListener('click',async function (event) {
          event.stopPropagation();event.preventDefault();
          if (saving || loading || destroyed) return;
          saving=true;render();
          try {
            await store.save(key,color);saving=false;render();close(true);
            toast(color==='none' ? '강조를 해제했습니다.' : '강조를 저장했습니다.');
          } catch (error) {toast('강조 저장 실패: '+error.message);}
          finally {saving=false;render();}
        });palette.appendChild(choice);
      });
      doc.body.appendChild(palette);position();palette.querySelector('button').focus();
    }
    async function click(button) {
      if (destroyed || saving || loading || button.disabled) return;
      if (opener===button) {close(true);return;}
      if (!store.ready && !await load()) return;
      if (!destroyed && container.contains(button)) open(button);
    }
    function outside(event) {if (palette && !palette.contains(event.target) && !(opener && opener.contains(event.target))) close(false);}
    function keyboard(event) {if (event.key==='Escape' && palette) {event.preventDefault();close(true);}}
    function scroll(event) {if (palette && !palette.contains(event.target)) close(false);}
    doc.addEventListener('pointerdown',outside);doc.addEventListener('keydown',keyboard);
    doc.addEventListener('scroll',scroll,true);doc.defaultView.addEventListener('resize',position);
    render();
    return {load:load,render:render,get ready(){return store.ready;},destroy:function () {
      destroyed=true;if(observer) observer.disconnect();close(false);
      bound.forEach(function (handler,button) {button.removeEventListener('click',handler);button.remove();});bound.clear();
      container.querySelectorAll('[data-listing-highlight]').forEach(function (row) {row.removeAttribute('data-listing-highlight');});
      doc.removeEventListener('pointerdown',outside);doc.removeEventListener('keydown',keyboard);doc.removeEventListener('scroll',scroll,true);doc.defaultView.removeEventListener('resize',position);
    }};
  }
  return Object.freeze({BUILDING_KEY:BUILDING_KEY,listingKey:listingKey,create:create,report:report});
});
