/* Unit row highlights: office-local metadata only. Never writes unit/financial records. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.UnitRowHighlights = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var COLORS = Object.freeze({yellow:'노랑',pink:'분홍',mint:'민트'});
  function scalar(value) {
    if (value == null) return '';
    if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) return null;
    var text = String(value).trim();
    return /[\u0000-\u001f\u007f]/.test(text) || text.length > 300 ? null : text;
  }
  function unitKey(parts) {
    if (!parts || typeof parts !== 'object') return null;
    var dong = scalar(parts.dong), room = scalar(parts.room);
    if (dong === null || !room || /^(?:-|미입력|undefined|null)$/.test(room)) return null;
    var key=JSON.stringify([dong,room]);
    return key.length <= 500 ? key : null;
  }
  function validKey(key) {
    try { var p=JSON.parse(key); return Array.isArray(p) && p.length===2 && typeof p[0]==='string' && typeof p[1]==='string' && unitKey({dong:p[0],room:p[1]})===key; } catch (_) { return false; }
  }
  function normalizeColor(color) {
    if (color == null || color === 'none' || color === '') return null;
    if (!Object.prototype.hasOwnProperty.call(COLORS,color)) throw new Error('지원하지 않는 강조 색상입니다.');
    return color;
  }
  function createStore(options) {
    var building=scalar(options.buildingKey);
    if (!building) throw new Error('건물 ID가 없어 강조를 저장할 수 없습니다.');
    var endpoint=String(options.baseUrl).replace(/[/]$/,'')+'/rest/v1/unit_row_highlights';
    var values=new Map(), ready=false;
    function url(key, extra) {
      var query=new URLSearchParams({building_key:'eq.'+building,select:'building_key,unit_key,color'});
      if (key) query.set('unit_key','eq.'+key);
      Object.keys(extra||{}).forEach(function (k) { query.set(k,extra[k]); });
      return endpoint+'?'+query.toString();
    }
    async function request(target,method,body,prefer) {
      var headers=Object.assign({},options.getHeaders());
      if (prefer) headers.Prefer=prefer;
      headers['Content-Type']='application/json';
      var init={method:method,headers:headers};
      if (body) init.body=JSON.stringify(body);
      var response=await options.fetchWithTimeout(target,init);
      if (!response.ok) throw new Error('강조 서버 요청 실패 ('+response.status+')');
      return response;
    }
    function checkedRow(row) {
      if (!row || row.building_key!==building || !validKey(row.unit_key) || !Object.prototype.hasOwnProperty.call(COLORS,row.color)) throw new Error('강조 서버 응답을 확인할 수 없습니다.');
      return row;
    }
    return {
      get ready() { return ready; },
      get: function (key) { return values.get(key)||null; },
      load: async function () {
        var next=new Map(), offset=0;
        while (true) {
          var rows=await (await request(url(null,{order:'unit_key.asc',limit:'1000',offset:String(offset)}),'GET')).json();
          if (!Array.isArray(rows)) throw new Error('강조 조회 응답이 올바르지 않습니다.');
          rows.forEach(function (row) { checkedRow(row); next.set(row.unit_key,row.color); });
          if (rows.length<1000) break;
          offset+=rows.length;
        }
        values=next; ready=true;
      },
      save: async function (key,color) {
        if (!ready) throw new Error('강조 조회 후 다시 시도해주세요.');
        if (!validKey(key)) throw new Error('동·호수 정보가 올바르지 않습니다.');
        color=normalizeColor(color);
        if (color) {
          var record={building_key:building,unit_key:key,color:color,updated_at:new Date().toISOString()};
          var rows=await (await request(endpoint+'?on_conflict=building_key,unit_key','POST',record,'resolution=merge-duplicates,return=representation')).json();
          if (!Array.isArray(rows) || rows.length!==1) throw new Error('강조 저장 결과를 확인할 수 없습니다.');
          checkedRow(rows[0]);
          if (rows[0].unit_key!==key || rows[0].color!==color) throw new Error('강조 저장 결과가 일치하지 않습니다.');
          values.set(key,color);
        } else {
          await request(url(key),'DELETE');
          var remaining=await (await request(url(key),'GET')).json();
          if (!Array.isArray(remaining) || remaining.length) throw new Error('강조 해제 결과를 확인할 수 없습니다.');
          values.delete(key);
        }
        return color;
      }
    };
  }
  function create(options) {
    var doc=options.document, body=options.tbody, store=createStore(options), loading=null, saving=false, palette=null, opener=null;
    function toast(message) { options.showToast(message,4500); }
    if (!doc.getElementById('unit-row-highlight-style')) {
      var style=doc.createElement('style'); style.id='unit-row-highlight-style';
      style.textContent=
        '.units-tbl tr[data-unit-highlight="yellow"]{--urh-bg:rgba(250,204,21,.18);--urh-edge:#b38a00}'+
        '.units-tbl tr[data-unit-highlight="pink"]{--urh-bg:rgba(244,114,182,.16);--urh-edge:#be437d}'+
        '.units-tbl tr[data-unit-highlight="mint"]{--urh-bg:rgba(52,211,153,.17);--urh-edge:#168361}'+
        '.units-tbl tr[data-unit-highlight] > td,.units-tbl tr[data-unit-highlight]:hover > td{background:var(--urh-bg)!important}'+
        '.units-tbl tr[data-unit-highlight] > td:first-child{box-shadow:inset 4px 0 var(--urh-edge)!important}'+
        '.btn-unit-highlight{font:inherit;font-size:12px;border:1px solid var(--border,#73817e);background:transparent;color:var(--text,inherit);border-radius:5px;padding:4px 7px;cursor:pointer}'+
        '.btn-unit-highlight:disabled{opacity:.55;cursor:wait}'+
        '.unit-highlight-palette{position:fixed;z-index:100000;display:flex;gap:5px;flex-wrap:wrap;max-width:300px;padding:9px;border:1px solid #a2b5ae;border-radius:9px;background:var(--bg-card,var(--card,#fff));color:var(--text,#203831);box-shadow:0 5px 22px #142b282b}'+
        '.unit-highlight-palette button{padding:7px 9px;border:1px solid #9faea8;border-radius:6px;color:#203831;background:#fff;cursor:pointer}'+
        '.unit-highlight-palette button[data-color="yellow"]{background:#fff2bc}'+
        '.unit-highlight-palette button[data-color="pink"]{background:#ffe0ec}'+
        '.unit-highlight-palette button[data-color="mint"]{background:#d4f6e8}'+
        '.unit-highlight-palette button:focus-visible,.btn-unit-highlight:focus-visible{outline:2px solid #25675f;outline-offset:2px}'+
        '.unit-highlight-palette button:disabled{opacity:.55;cursor:wait}'+
        '@media print{.btn-unit-highlight,.unit-highlight-palette{display:none!important}}';
      doc.head.appendChild(style);
    }
    function close(restoreFocus) {
      if (palette) { palette.remove(); palette=null; }
      if (opener) { opener.setAttribute('aria-expanded','false'); if (restoreFocus && opener.isConnected) opener.focus(); }
      opener=null;
    }
    function render() {
      body.querySelectorAll('.unit-select-row[data-ri]').forEach(function (checkbox) {
        var index=Number(checkbox.dataset.ri), units=options.getUnits();
        var unit=/^\d+$/.test(checkbox.dataset.ri) && Number.isSafeInteger(index) ? units[index] : null;
        var row=checkbox.closest('tr'); if (!row) return;
        var parts=unit ? options.getParts(unit) : null, key=unitKey(parts);
        var color=key && store.get(key);
        if (color) row.setAttribute('data-unit-highlight',color); else row.removeAttribute('data-unit-highlight');
        var button=row.querySelector('.btn-unit-highlight');
        if (!key) { if (button) button.remove(); return; }
        if (!button) {
          var actions=row.querySelector('.tbl-actions'); if (!actions) return;
          button=doc.createElement('button');button.type='button';button.className='btn-unit-highlight';button.textContent='강조';
          button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false'); actions.appendChild(button);
        }
        button.dataset.unitKey=key;
        button.dataset.roomLabel=(scalar(parts.dong) ? scalar(parts.dong)+'동 ' : '')+scalar(parts.room)+'호';
        button.setAttribute('aria-label',button.dataset.roomLabel+' 강조');
        button.title=store.ready ? '호실 강조 색상 선택' : loading ? '강조 불러오는 중' : '강조 조회 재시도';
        button.disabled=saving || !!loading;
      });
      if (palette) palette.querySelectorAll('button').forEach(function (b) { b.disabled=saving; });
    }
    async function load() {
      if (store.ready) { render(); return true; }
      if (loading) return loading;
      loading=(async function () {
        try { await store.load(); return true; }
        catch (error) { toast('강조 불러오기 실패: '+error.message+' 강조 버튼으로 다시 시도해주세요.'); return false; }
        finally { loading=null; render(); }
      })();
      render(); return loading;
    }
    function open(button) {
      close(false); opener=button;button.setAttribute('aria-expanded','true');
      var key=button.dataset.unitKey, label=button.dataset.roomLabel;
      palette=doc.createElement('div');palette.className='unit-highlight-palette';palette.setAttribute('role','dialog');palette.setAttribute('aria-label',label+' 강조 색상');
      Object.keys(COLORS).concat(['none']).forEach(function (color) {
        var choice=doc.createElement('button');choice.type='button';choice.dataset.color=color;choice.textContent=COLORS[color]||'강조 해제';choice.setAttribute('aria-label',label+' '+choice.textContent);
        choice.addEventListener('click',async function () {
          if (saving) return; saving=true;render();
          try { await store.save(key,color);toast(color==='none' ? '강조를 해제했습니다.' : '강조를 저장했습니다.');saving=false;render();close(true); }
          catch (error) { toast('강조 저장 실패: '+error.message); }
          finally { saving=false;render(); }
        });palette.appendChild(choice);
      });
      doc.body.appendChild(palette);
      var rect=button.getBoundingClientRect(), view=doc.defaultView;
      palette.style.left=Math.max(8,Math.min(rect.right-palette.offsetWidth,view.innerWidth-palette.offsetWidth-8))+'px';
      palette.style.top=Math.max(8,Math.min(rect.bottom+5,view.innerHeight-palette.offsetHeight-8))+'px';
      palette.querySelector('button').focus();
    }
    async function click(event) {
      var button=event.target.closest('.btn-unit-highlight'); if (!button || !body.contains(button) || saving) return;
      if (opener===button) {close(true);return;}
      if (!store.ready && !await load()) return;
      if (button.isConnected) open(button);
    }
    function outside(event) { if (palette && !palette.contains(event.target) && !(opener && opener.contains(event.target))) close(false); }
    function keyboard(event) { if (event.key==='Escape' && palette) {event.preventDefault();close(true);} }
    body.addEventListener('click',click);doc.addEventListener('pointerdown',outside);doc.addEventListener('keydown',keyboard);
    return {render:render,load:load,destroy:function () {close(false);body.removeEventListener('click',click);doc.removeEventListener('pointerdown',outside);doc.removeEventListener('keydown',keyboard);}};
  }
  return Object.freeze({unitKey:unitKey,validKey:validKey,normalizeColor:normalizeColor,createStore:createStore,create:create});
});
