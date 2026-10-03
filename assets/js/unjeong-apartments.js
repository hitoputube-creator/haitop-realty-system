(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const core = window.HitopApartmentCore;
  if (!$('mapApartmentUpdate') || !core || !window.HitopUnjeongMap) return;
  const client = hitopAuthClient;
  const clone = rows => JSON.parse(JSON.stringify(rows));
  const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
  let saved = [], draft = [], candidates = [], version = 0, ready = false, busy = false, editor = null, placing = false;
  let lookupController = null;
  let channel;
  try { channel = new BroadcastChannel('hitop.unjeong.apartments'); } catch (_) { /* focus refresh remains available */ }
  const dialog = document.createElement('dialog');
  dialog.id = 'mapApartmentDialog';
  dialog.className = 'map-apartment-dialog';
  dialog.setAttribute('aria-labelledby','aptDialogTitle');
  dialog.innerHTML = `
    <div class="apt-dialog-head"><h2 id="aptDialogTitle">지도 업데이트</h2><button type="button" id="aptClose" aria-label="닫기">닫기 ×</button></div>
    <p class="apt-help">아파트명·총 세대수를 확인한 뒤 저장하면 택지·상가 지도에 함께 반영됩니다. 총 세대수는 실제 입주 세대수와 다릅니다.</p>
    <div class="apt-actions"><button type="button" id="aptFetch">최신 단지정보 조회</button><button type="button" id="aptAdd">직접 추가·수정</button><button type="button" id="aptStop" hidden>조회 중단</button></div>
    <p id="aptMessage" class="apt-message" role="status" aria-live="polite"></p>
    <div class="apt-table-wrap"><table class="apt-table"><thead><tr><th>지도에 표시할 아파트</th><th>총 세대수</th><th>상태</th><th>정보 확인일</th><th>변경</th></tr></thead><tbody id="aptRows"></tbody></table></div>
    <form id="aptEdit" class="apt-edit-form" hidden>
      <div class="apt-edit-grid">
        <label>아파트명<input id="aptName" required maxlength="150"></label>
        <label>총 세대수<input id="aptHouseholds" type="number" min="1" max="100000" step="1" required></label>
        <label>상태<select id="aptStatus"><option>확인 필요</option><option>입주완료</option><option>공사중</option><option>입주예정</option></select></label>
        <label>정보 확인일<input id="aptChecked" type="date" required></label>
        <label class="wide">주소<input id="aptAddress" maxlength="300"></label>
        <label class="wide">확인한 출처 링크<input id="aptSource" type="url" placeholder="https://" required maxlength="2000"></label>
      </div>
      <p class="apt-help">공공정보만으로 입주 상태를 확정하지 않습니다. 입주완료·공사중·입주예정은 확인 후 선택해주세요.</p>
      <div class="apt-actions"><button type="submit" class="apt-primary">변경 내용에 추가</button><button type="button" id="aptEditCancel">편집 취소</button></div>
    </form>
    <section class="apt-candidates" id="aptCandidates" hidden><h3>새로 확인한 단지 · 위치를 지정해 지도에 추가</h3><input type="search" id="aptSearch" placeholder="아파트명·주소 검색" aria-label="조회한 아파트 검색"><div id="aptCandidateList" class="apt-candidate-list"></div></section>
    <div class="apt-actions apt-footer"><span id="aptChangeCount"></span><button type="button" id="aptSave" class="apt-primary" disabled>변경 내용 저장 · 두 지도에 반영</button></div>`;
  document.body.appendChild(dialog);
  const layer = document.createElementNS('http://www.w3.org/2000/svg','svg');
  layer.classList.add('apt-map-layer');
  layer.setAttribute('aria-hidden','true');

  function message(text, error) {
    $('aptMessage').textContent = text;
    $('aptMessage').classList.toggle('error',!!error);
  }
  function setBusy(value) {
    busy = value;
    ['aptFetch','aptAdd','aptSave','aptClose'].forEach(id => $(id).disabled = value || (id !== 'aptClose' && !ready));
    dialog.setAttribute('aria-busy',String(value));
    $('aptRows').inert = value;
    $('aptCandidateList').inert = value;
    $('aptEdit').inert = value;
  }
  function updateDate() {
    const latest = saved.map(r=>r.checked_on).filter(Boolean).sort().pop();
    $('mapApartmentDate').textContent = latest ? '정보 확인일: ' + latest.replace(/-/g,'.') + ' · ' + saved.length + '개 단지' : '아파트 정보 확인 전';
  }
  function renderMap(rows) {
    const width = window.HitopUnjeongMap.width, height = window.HitopUnjeongMap.height;
    layer.setAttribute('viewBox','0 0 ' + width + ' ' + height);
    layer.replaceChildren();
    rows.filter(r=>Number.isFinite(r.x) && Number.isFinite(r.y)).forEach(r=>{
      const x = r.x * width, y = r.y * height;
      const ns = 'http://www.w3.org/2000/svg';
      const group = document.createElementNS(ns,'g');
      const box = document.createElementNS(ns,'rect');
      box.setAttribute('x',x-73); box.setAttribute('y',y-24);
      box.setAttribute('width','146'); box.setAttribute('height','48'); box.setAttribute('rx','4');
      box.setAttribute('fill','#fff'); box.setAttribute('stroke','#0f766e'); box.setAttribute('stroke-width','1');
      group.appendChild(box);
      [r.name, r.households.toLocaleString('ko-KR') + '세대 · ' + r.status].forEach((value,i)=>{
        const text = document.createElementNS(ns,'text');
        text.setAttribute('x',x);text.setAttribute('y',y+(i ? 13:-5));
        text.setAttribute('text-anchor','middle');text.setAttribute('fill',i?'#475569':'#0f172a');
        text.setAttribute('font-size',i?'10':'11');text.setAttribute('font-family','Pretendard, sans-serif');
        text.setAttribute('font-weight',i?'400':'700');
        if (value.length > 13) {text.setAttribute('textLength','132');text.setAttribute('lengthAdjust','spacingAndGlyphs');}
        text.textContent=value;group.appendChild(text);
      });
      layer.appendChild(group);
    });
  }
  async function readState() {
    const session = await client.auth.getSession();
    if (session.error || !session.data.session) throw new Error('로그인 후 다시 시도해주세요.');
    const result = await client.from('unjeong_map_state').select('apartments,version').eq('id',true).maybeSingle();
    if (result.error) throw new Error('저장된 지도정보를 불러오지 못했습니다. 다시 열어주세요.');
    saved = result.data?.apartments || [];
    version = result.data?.version || 0;
    ready = true;
    updateDate(); renderMap(saved);
  }
  function textCell(row, value, note) {
    const cell = document.createElement('td');cell.textContent=value;
    if (note) {const small=document.createElement('small');small.textContent=note;cell.appendChild(small);}
    row.appendChild(cell);return cell;
  }
  function button(label, action) {
    const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',action);return b;
  }
  function renderRows() {
    $('aptRows').replaceChildren();
    const changes = new Set(core.changes(saved,draft).map(r=>r.id));
    const before = new Map(saved.map(r=>[r.id,r]));
    draft.forEach(r=>{
      const row=document.createElement('tr');
      if(changes.has(r.id)) row.className='changed';
      const old=before.get(r.id);
      textCell(row,r.name,old && old.name !== r.name ? '이전: ' + old.name:r.address);
      textCell(row,r.households.toLocaleString('ko-KR') + '세대',old && old.households!==r.households?'이전: '+old.households.toLocaleString('ko-KR')+'세대':'');
      textCell(row,r.status);textCell(row,r.checked_on);
      const actions=textCell(row,'');
      actions.append(button('수정',()=>edit(r)),button(Number.isFinite(r.x)?'위치 수정':'위치 지정',()=>place(r.id)),button('표시 제외',()=>{
        draft=draft.filter(a=>a.id!==r.id);renderRows();renderCandidates();
      }));
      $('aptRows').appendChild(row);
    });
    if (!draft.length) {const row=document.createElement('tr');const cell=textCell(row,'아직 지도에 추가한 아파트가 없습니다. 조회한 단지를 추가하거나 직접 입력해주세요.');cell.colSpan=5;$('aptRows').appendChild(row);}
    const removed=saved.filter(r=>!draft.some(a=>a.id===r.id)).length;
    $('aptChangeCount').textContent = changes.size + '개 단지 변경' + (removed ? ' · ' + removed + '개 표시 제외':'') + ' · 저장 전 미리보기';
    $('aptSave').disabled = busy || !ready || !!editor;
  }
  function renderCandidates() {
    const q=$('aptSearch').value.trim().toLowerCase();
    const used=new Set(draft.map(r=>r.id));
    const list=candidates.filter(r=>!used.has(r.id) && (!q || (r.name+' '+r.address).toLowerCase().includes(q)));
    $('aptCandidates').hidden=!candidates.length;
    $('aptCandidateList').replaceChildren();
    list.forEach(r=>{
      const row=document.createElement('div');row.className='apt-candidate-row';
      const label=document.createElement('div');label.textContent=r.name+' · '+r.households.toLocaleString('ko-KR')+'세대';
      const note=document.createElement('small');note.textContent=r.address;label.appendChild(note);
      row.append(label,button('지도에 추가',()=>edit({...r,status:'확인 필요',x:null,y:null})));$('aptCandidateList').appendChild(row);
    });
    if (!list.length) $('aptCandidateList').textContent='추가할 단지가 없거나 검색 결과가 없습니다.';
  }
  function edit(row) {
    editor=row?{...row}:{id:'manual:'+crypto.randomUUID(),x:null,y:null,status:'확인 필요',checked_on:today()};
    $('aptEdit').hidden=false;
    $('aptName').value=editor.name||'';$('aptHouseholds').value=editor.households||'';
    $('aptStatus').value=editor.status;$('aptChecked').value=editor.checked_on;$('aptChecked').max=today();
    $('aptAddress').value=editor.address||'';$('aptSource').value=editor.source_url||'';
    $('aptSave').disabled=true;$('aptName').focus();
  }
  function cancelEdit() {editor=null;$('aptEdit').hidden=true;renderRows();}
  $('aptEdit').addEventListener('submit',event=>{
    event.preventDefault();
    const next={...editor,name:$('aptName').value.trim(),households:Number($('aptHouseholds').value),status:$('aptStatus').value,
      checked_on:$('aptChecked').value,address:$('aptAddress').value.trim(),source_url:$('aptSource').value.trim()};
    try {core.validate([{...next,x:next.x??0,y:next.y??0}]);} catch(err) {message(err.message,true);return;}
    const index=draft.findIndex(r=>r.id===next.id);
    if(index<0) draft.push(next);else draft[index]=next;
    cancelEdit();renderCandidates();
    message('변경 내용을 추가했습니다. 저장하면 두 지도에 반영됩니다.');
    if(!Number.isFinite(next.x)) place(next.id);
  });
  function place(id) {
    if(busy) return;
    const r=draft.find(r=>r.id===id);if(!r) return;
    if($('blockDetail') && !$('blockDetail').hidden) {message('전체 위치도로 돌아온 뒤 위치를 지정해주세요.',true);return;}
    placing=true;dialog.close();
    const banner=document.createElement('div');banner.className='apt-location-banner';
    const text=document.createElement('span');text.textContent=r.name+': 원래 아파트 글씨 중앙을 눌러주세요. 새 표시가 기존 글씨 위에 놓입니다.';
    const cover=document.createElement('div');cover.className='apt-location-cover';
    const finish=()=>{cover.remove();banner.remove();placing=false;dialog.showModal();renderRows();};
    banner.append(text,button('취소',finish));document.body.appendChild(banner);
    ['pointerdown','pointermove','pointerup'].forEach(type=>cover.addEventListener(type,event=>event.stopPropagation()));
    cover.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      const rect=$('mapImage').getBoundingClientRect();
      r.x=Math.max(.036,Math.min(.964,(event.clientX-rect.left)/rect.width));
      r.y=Math.max(.02,Math.min(.98,(event.clientY-rect.top)/rect.height));
      renderMap(draft);finish();message('위치를 지정했습니다. 저장하면 두 지도에 반영됩니다.');
    });
    $('mapStage').appendChild(cover);$('mapStage').scrollIntoView({block:'nearest'});
  }
  async function invoke(body) {
    const session=await client.auth.getSession();
    if(!session.data.session) throw new Error('로그인 후 다시 시도해주세요.');
    const response=await fetch(SUPABASE_URL+'/functions/v1/lookup-unjeong-apartments',{
      method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+session.data.session.access_token,'Content-Type':'application/json'},
      body:JSON.stringify(body),signal:lookupController ? AbortSignal.any([AbortSignal.timeout(30000),lookupController.signal]) : AbortSignal.timeout(30000)});
    const data=await response.json();
    if(!response.ok || data.error) throw new Error(data.error || '단지정보를 불러오지 못했습니다.');
    return data;
  }
  async function fetchLatest() {
    if(busy || !ready) return;
    if(editor) {message('편집 중인 내용을 추가하거나 취소한 뒤 조회해주세요.',true);return;}
    lookupController=new AbortController();$('aptStop').hidden=false;
    setBusy(true);message('파주시 최신 단지 목록을 확인하고 있습니다…');
    try {
      const first=await invoke({action:'list',page:1});
      let listed=first.items;
      for(let page=2;page<=Math.ceil(first.total/first.pageSize);page++) listed=listed.concat((await invoke({action:'list',page})).items);
      const unique=[...new Map(listed.map(r=>[r.id,r])).values()];
      let cursor=0,done=0,failed=0;const found=[];
      async function worker() {
        while(cursor<unique.length && !lookupController.signal.aborted) {
          const item=unique[cursor++];
          try {
            const result=await invoke({action:'detail',id:item.id});
            const r=result.apartment;
            // Only the Unjeong map area; always preserve already placed codes.
            if(/와동동|목동동|동패동|야당동|다율동|당하동|문발동|산남동|서패동/.test(r.address) || /운정/.test(r.name) || draft.some(old=>old.id===r.id)) found.push(r);
          } catch(err) {
            if(/활용신청|인증키|로그인/.test(err.message)) throw err;
            failed++;
          }
          done++;message('단지정보 확인 중… '+done+' / '+unique.length+'개');
        }
      }
      // Wait for all workers even on error, so late responses cannot mutate a new edit.
      const results=await Promise.allSettled(Array.from({length:3},()=>worker()));
      if(lookupController.signal.aborted) throw new Error('조회를 중단했습니다. 기존 정보는 유지됩니다.');
      const fatal=results.find(r=>r.status==='rejected');
      if(fatal) throw fatal.reason;
      if(!found.length) throw new Error('운정 지역의 최신 단지정보를 확인하지 못했습니다. 기존 정보는 유지됩니다.');
      candidates=found.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
      draft=core.merge(draft,candidates);renderRows();renderCandidates();
      message('운정 지역 '+found.length+'개 단지 확인. 변경 내용을 검토하고 저장해주세요.'+(failed?' '+failed+'개 조회 실패: 해당 단지의 기존 정보는 유지됩니다.':''));
    } catch(err) {message((err.name==='TimeoutError'?'조회가 지연되고 있습니다. 잠시 후 다시 시도해주세요.':err.message)+'\n공공정보 조회가 안 되는 동안에도 확인한 출처로 직접 추가·수정할 수 있습니다.',true);}
    finally {lookupController=null;$('aptStop').hidden=true;setBusy(false);renderRows();}
  }
  async function open() {
    if(busy || placing) return;
    dialog.showModal();setBusy(true);ready=false;message('저장된 지도정보를 불러오는 중…');
    try {await readState();draft=clone(saved);candidates=[];cancelEdit();renderCandidates();message('최신 단지정보를 확인합니다.');}
    catch(err) {message(err.message,true);}
    finally {setBusy(false);}
    if(ready) await fetchLatest();
  }
  function close() {
    if(busy) return;
    cancelEdit();dialog.close();renderMap(saved);
  }
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  $('aptClose').addEventListener('click',close);
  $('aptAdd').addEventListener('click',()=>edit());$('aptEditCancel').addEventListener('click',cancelEdit);
  $('aptFetch').addEventListener('click',fetchLatest);$('aptSearch').addEventListener('input',renderCandidates);
  $('aptStop').addEventListener('click',()=>{lookupController?.abort();message('조회를 중단하는 중…');});
  $('mapApartmentUpdate').addEventListener('click',open);
  $('aptSave').addEventListener('click',async()=>{
    if(busy || !ready || editor) return;
    try {core.validate(draft);} catch(err) {message(err.message,true);return;}
    setBusy(true);message('두 지도의 공통 정보를 저장하고 있습니다…');
    try {
      const result=await client.rpc('save_unjeong_map',{p_expected_version:version,p_apartments:draft});
      if(result.error) throw new Error(result.error.message || '저장하지 못했습니다.');
      const state=Array.isArray(result.data)?result.data[0]:result.data;
      if(!state) throw new Error('저장 결과를 확인하지 못했습니다. 닫고 다시 열어주세요.');
      saved=clone(state.apartments);draft=clone(saved);version=state.version;updateDate();renderMap(saved);renderRows();
      channel?.postMessage('saved');message('저장했습니다. 택지·상가 지도에 같은 정보가 적용됩니다.');
    } catch(err) {message(err.message,true);}
    finally {setBusy(false);renderRows();}
  });
  async function refresh() {
    if(dialog.open || busy || placing) return;
    try {await readState();} catch(err) {$('mapApartmentDate').textContent='아파트 정보 연결을 확인해주세요.';console.warn(err.message);}
  }
  channel?.addEventListener('message',refresh);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) refresh();});
  window.HitopUnjeongMap.ready.then(()=>{$('unjeongMapOverlay').appendChild(layer);refresh();});
})();
