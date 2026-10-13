(function(root){
  'use strict';
  const fields=[['층','층'],['전용_평','전용(평)'],['분양_평','분양(평)'],['평당가','평당가(만원)'],['분양금액','분양가(만원)'],['현_매매가격','매매가(만원)'],['보증금','보증금(만원)'],['월차임','월세(만원)'],['분양_VAT','VAT'],['현업종','업종'],['가격표비고','가격표 비고']];
  const normalizeRoom=value=>String(value??'').trim().replace(/[\s호]/g,'');
  function validate(rows){
    if(!rows.length)throw new Error('반영할 호실을 선택하세요.');
    const seen=new Set();
    rows.forEach(row=>{
      const room=normalizeRoom(row.호수);if(!room)throw new Error('호수를 입력하세요.');
      if(seen.has(room))throw new Error(room+'호가 중복되었습니다. 하나만 선택하세요.');seen.add(room);
      fields.forEach(([key])=>{if(!['층','분양_VAT','현업종','가격표비고'].includes(key)&&row[key]!=null&&(!Number.isFinite(row[key])||row[key]<0))throw new Error(room+'호 '+key+' 숫자를 확인하세요.');});
      if(row.전용_평!=null&&row.분양_평!=null&&row.전용_평>row.분양_평)throw new Error(room+'호 전용면적이 분양면적보다 큽니다.');
    });return rows;
  }

  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const revisionDate=f=>f.price_received_date || String(f.created_at||'').slice(0,10) || '날짜 미상';
  function revisions(files){
    const seen=new Set();
    return files.filter(f=>String(f.file_name).startsWith('[가격표] ')).sort((a,b)=>revisionDate(b).localeCompare(revisionDate(a))||String(b.created_at||'').localeCompare(String(a.created_at||''))).filter(f=>{
      const key=f.file_sha256 || ('legacy:'+f.file_name+':'+revisionDate(f));if(seen.has(key))return false;seen.add(key);return true;
    });
  }
  function changedFields(row,old={}){
    return fields.map(([key])=>key).filter(key=>row[key]!=null && String(row[key]).trim()!=='' && String(row[key]).trim()!==String(old[key]??'').trim());
  }
  root.PriceRoomImportCore={normalizeRoom,validate,revisions,changedFields};
  if(typeof document==='undefined')return;
  let dialog,source,rows=[],existing=[],busy=false;
  const el=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  function setup(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.id='priceRoomDialog';dialog.className='price-room-dialog';
    dialog.innerHTML=`<div class="pri-head"><h2>가격표로 호실자료 자동입력</h2><button type="button" id="priClose" aria-label="닫기">닫기</button></div>
      <p id="priSource"></p><p>원본 가격표와 비교한 후 선택한 호실만 반영하세요. 기존 소유주·연락처·메모는 유지합니다.</p>
      <div class="pri-toolbar"><a id="priOriginal" target="_blank" rel="noopener">원본 가격표 보기</a><label id="priPdfRange" hidden>PDF 페이지 <input id="priStart" type="number" min="1" value="1"> ~ <input id="priEnd" type="number" min="1" value="1"> (한 번에 최대 8쪽)</label><button type="button" id="priAnalyze">Gemini로 가격표 읽기</button></div>
      <p id="priMessage" role="status" aria-live="polite"></p><div id="priWarnings"></div>
      <div id="priReview" hidden><div class="pri-toolbar"><label><input type="checkbox" id="priAll"> 전체 선택</label><label><input type="checkbox" id="priOverwrite" checked> 선택한 변경값으로 기존 자료 업데이트</label><span id="priDiffSummary"></span></div>
      <details><summary>반영할 항목 선택</summary><div id="priFields"></div></details><div class="pri-table-wrap"><table><thead><tr><th>선택</th><th>호수</th><th>처리</th>${fields.map(([,label])=>'<th>'+label+'</th>').join('')}<th>확인사항</th></tr></thead><tbody id="priRows"></tbody></table></div>
      <p>금액은 만원, 면적은 평 단위입니다. 강조된 칸은 기존과 다른 값이며, 각 칸의 체크로 반영 항목을 선택합니다. 빈 값은 기존 값을 지우지 않습니다. 공실·임차 상태와 일반 매물 등록은 별도로 지정하세요.</p>
      <button type="button" id="priSave">선택한 호실에 반영</button></div>`;
    document.body.appendChild(dialog);
    const uploadBar=document.createElement('div');uploadBar.className='pri-toolbar';
    uploadBar.innerHTML='<label>받은 날짜 <input type="date" id="priReceived"></label><label>가격표 파일 <input type="file" id="priUpload" accept="image/jpeg,image/png,image/webp,.pdf"></label><button type="button" id="priUploadBtn">가격표 올리기</button>';
    el('priSource').after(uploadBar);el('priUploadBtn').onclick=uploadPriceFile;el('priReceived').value=today();
    const sourceSelect=document.createElement('select');sourceSelect.id='priSourceSelect';sourceSelect.setAttribute('aria-label','등록된 가격표 선택');el('priOriginal').before(sourceSelect);sourceSelect.onchange=()=>open(sourceSelect.value);
    el('priClose').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
    el('priAnalyze').onclick=analyze;el('priSave').onclick=save;
    el('priAll').onchange=()=>dialog.querySelectorAll('[data-selected]').forEach(c=>c.checked=el('priAll').checked);
    el('priFields').innerHTML=fields.map(([key,label])=>'<label><input type="checkbox" data-field="'+key+'" checked>'+label+'</label>').join('');
    const style=document.createElement('style');style.textContent=`.price-room-dialog{background:var(--panel,#112437);color:var(--txt,#f1f5f9);border:1px solid var(--line,#36516b);border-radius:14px;width:min(1450px,94vw);max-height:90vh;padding:24px;box-sizing:border-box}.price-room-dialog::backdrop{background:#0009}.pri-head,.pri-toolbar{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.pri-head{justify-content:space-between}.pri-head h2{margin:0;color:var(--gold,#d8b84a)}.price-room-dialog button{cursor:pointer;padding:9px 14px;border-radius:7px;border:1px solid var(--line,#36516b);background:var(--gold,#d8b84a);color:#071625;font:inherit}.price-room-dialog button:disabled{opacity:.5;cursor:wait}.price-room-dialog p{line-height:1.6;font-size:14px}.price-room-dialog a{color:var(--gold,#d8b84a)}.pri-table-wrap{overflow:auto;max-height:48vh;margin:16px 0}.price-room-dialog table{border-collapse:collapse;min-width:1450px;width:100%;font-size:13px}.price-room-dialog td,.price-room-dialog th{padding:8px;border-bottom:1px solid var(--line,#36516b);text-align:left;white-space:nowrap}.price-room-dialog th{position:sticky;top:0;background:var(--panel,#112437)}.price-room-dialog input:not([type=checkbox]){width:105px;background:var(--bg,#071625);color:inherit;border:1px solid var(--line,#36516b);border-radius:5px;padding:7px;box-sizing:border-box}.price-room-dialog input[data-key=호수]{width:85px}.price-room-dialog input[type=checkbox]{width:18px;height:18px;vertical-align:middle}.pri-toolbar input[type=number]{width:65px}.pri-warning{color:#f5b34f;white-space:normal!important;min-width:150px}#priFields{display:flex;flex-wrap:wrap;gap:12px;padding:12px 0}#priMessage{min-height:24px}html[data-office-theme=ktop] .price-room-dialog{background:#fff;color:#20354d}`;document.head.appendChild(style);
  }
  async function open(id){
    setup();if(busy)return;
    rows=[];el('priReview').hidden=true;el('priWarnings').textContent='';el('priMessage').textContent='가격표 자료를 확인하는 중입니다.';if(!dialog.open)dialog.showModal();
    try{
      const files=await getBuildingFiles(buildingId);
      const floors=await getBuildingFloors(buildingId);
      const choices=revisions(files).map(f=>({...f,choiceId:'file:'+f.id,floor_number:'가격표'}))
        .concat(floors.filter(f=>/가격|price|분양표|임대료/i.test(f.floor_number+' '+f.file_name)).map(f=>({...f,choiceId:'floor:'+f.id})));
      source=id ? choices.find(f=>f.choiceId===id) : choices[0];
      el('priSourceSelect').innerHTML='<option value="">등록한 가격표 선택</option>'+choices.map(f=>'<option value="'+esc(f.choiceId)+'">'+esc(revisionDate(f)+' · '+f.file_name.replace('[가격표] ',''))+'</option>').join('');
      if(source)el('priSourceSelect').value=source.choiceId;
      const name=el('buildingName').textContent.trim();const rec=await getBuildingRecord(name);existing=Array.isArray(rec?.units)?rec.units:[];
      el('priSource').textContent=name+' · '+(source ? source.file_name : '새 가격표를 올려주세요.');
      el('priOriginal').hidden=!source;el('priOriginal').href=source?.cloudinary_url||'#';
      el('priPdfRange').hidden=!source || !isPdf(source.cloudinary_url,source.file_name);
      el('priStart').value='1';el('priEnd').value='1';el('priOverwrite').checked=true;
      el('priMessage').textContent=source?'가격표를 선택하거나 새 파일을 올린 후 가격표 읽기를 누르세요.':'가격표 파일을 선택하고 가격표 올리기를 눌러주세요.';
    }catch(e){el('priMessage').textContent=e.message;source=null;}
  }
  async function uploadPriceFile(){
    if(busy)return;const file=el('priUpload').files[0];
    if(!file){el('priMessage').textContent='가격표 사진이나 PDF 파일을 선택하세요.';return;}
    if(!/\.(pdf|jpe?g|png|webp)$/i.test(file.name)){el('priMessage').textContent='가격표는 사진 또는 PDF로 올려주세요.';return;}
    if(file.size>30*1024*1024){el('priMessage').textContent='가격표는 30MB 이하로 올려주세요.';return;}
    lock(true);
    try{
      el('priMessage').textContent='가격표 원본을 저장하는 중입니다.';
      const received=el('priReceived').value;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(received))throw new Error('가격표를 받은 날짜를 입력하세요.');
      const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
      const hash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
      const registered=await getBuildingFiles(buildingId);
      let prior=registered.find(f=>f.file_sha256===hash);
      if(!prior){
        const legacy=revisions(registered).filter(f=>!f.file_sha256 && f.file_name==='[가격표] '+file.name);
        for(const candidate of legacy){
          const response=await fetch(candidate.cloudinary_url);if(!response.ok)continue;
          const blob=await response.blob();if(blob.size!==file.size)continue;
          const bytes=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
          const legacyHash=Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');
          if(legacyHash===hash){prior=candidate;break;}
        }
      }
      if(prior){lock(false);await open('file:'+prior.id);el('priMessage').textContent='동일한 가격표가 이미 있습니다. 기존 원본을 선택했습니다.';return;}
      const url=await cloudinaryUpload(file,'haitop/files');
      await addBuildingFile({building_id:buildingId,file_name:'[가격표] '+file.name,cloudinary_url:url,drive_link:null,price_received_date:received,file_sha256:hash});
      const files=await getBuildingFiles(buildingId);
      const saved=[...files].reverse().find(f=>f.file_sha256===hash);
      if(!saved)throw new Error('저장된 가격표를 찾지 못했습니다. 다시 열어주세요.');
      el('priUpload').value='';await loadFiles();await refreshPriceFiles();
      lock(false);await open('file:'+saved.id);
      el('priMessage').textContent='가격표가 저장되었습니다. Gemini로 가격표 읽기를 눌러 호실자료를 정리하세요.';
    }catch(e){el('priMessage').textContent='가격표 저장 실패: '+e.message;}finally{lock(false);}
  }
  async function refreshPriceFiles(){
    const box=el('unitPriceFiles');if(!box || box.hidden)return;
    try{
      const files=revisions(await getBuildingFiles(buildingId));
      box.replaceChildren();
      files.forEach((f,index)=>{
        const row=document.createElement('div');row.style.cssText='display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:8px 0';
        const link=document.createElement('a');link.href=f.cloudinary_url;link.target='_blank';link.rel='noopener';link.textContent=(index===0?'최신 · ':'')+revisionDate(f)+' · '+f.file_name.replace('[가격표] ','');link.style.color='var(--gold)';
        const button=document.createElement('button');button.type='button';button.className='btn-unit-ghost';button.textContent='비교·업데이트';button.onclick=()=>open('file:'+f.id);
        row.append(link,button);box.appendChild(row);
      });
    }catch(e){box.textContent='가격표 목록 조회 실패: '+e.message;}
  }
  function lock(value){busy=value;['priAnalyze','priSave','priClose','priSourceSelect','priUploadBtn'].forEach(id=>el(id).disabled=value);dialog.querySelectorAll('input').forEach(input=>input.disabled=value);}
  function encodeCanvas(canvas){return {data:canvas.toDataURL('image/jpeg',.94).split(',')[1]};}
  async function images(){
    const response=await fetch(source.cloudinary_url);if(!response.ok)throw new Error('가격표 원본을 읽지 못했습니다. 자료를 다시 열어주세요.');
    const blob=await response.blob();if(blob.size>30*1024*1024)throw new Error('분석 원본은 30MB 이하로 선택하세요.');
    if(isPdf(source.cloudinary_url,source.file_name)){
      const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
      const pdf=await pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise;
      const start=Number(el('priStart').value),end=Number(el('priEnd').value);
      if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||end>pdf.numPages||end-start>=8){await pdf.destroy();throw new Error('PDF는 총 '+pdf.numPages+'쪽입니다. 분석 범위를 1~8쪽으로 지정하세요.');}
      const result=[];try{for(let n=start;n<=end;n++){
        el('priMessage').textContent='PDF '+n+'쪽을 읽는 중입니다.';const page=await pdf.getPage(n);const base=page.getViewport({scale:1});
        const viewport=page.getViewport({scale:Math.min(3,2400/Math.max(base.width,base.height))});
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'white'}).promise;result.push(encodeCanvas(canvas));canvas.width=canvas.height=0;
      }}finally{await pdf.destroy();}return result;
    }
    const image=await createImageBitmap(blob);try{
      const scale=Math.min(1,2600/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
      const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);return [encodeCanvas(canvas)];
    }finally{image.close();}
  }
  async function analyze(){
    if(busy||!source)return;lock(true);el('priReview').hidden=true;el('priWarnings').textContent='';
    try{
      el('priMessage').textContent='원본 가격표를 준비하는 중입니다.';const content=await images();el('priMessage').textContent='호실별 면적과 가격을 읽는 중입니다. 잠시 기다려주세요.';
      const {data,error}=await hitopAuthClient.functions.invoke('extract-building-price-table',{body:{images:content}});
      if(error){let message=error.message;try{message=(await error.context.json()).error||message;}catch(_){}throw new Error(message);}
      if(!data||!Array.isArray(data.rows))throw new Error('분석 결과를 받지 못했습니다.');
      rows=data.rows;render(data.warnings||[]);el('priMessage').textContent=rows.length?rows.length+'개 호실을 읽었습니다. 원본과 비교하고 숫자를 확인해주세요.':'호실을 읽지 못했습니다. 선명한 원본 가격표를 사용해주세요.';
    }catch(e){el('priMessage').textContent='분석 실패: '+e.message;}finally{lock(false);}
  }
  function render(warnings){
    el('priWarnings').textContent=warnings.map(String).join(' · ');el('priWarnings').className='pri-warning';el('priAll').checked=false;
    const counts=new Map();rows.forEach(r=>{const key=normalizeRoom(r.호수);counts.set(key,(counts.get(key)||0)+1);});
    let fresh=0,updates=0,unchanged=0;
    rows.forEach(row=>{const old=existing.find(u=>normalizeRoom(u.호수)===normalizeRoom(row.호수));if(!old)fresh++;else if(changedFields(row,old).length)updates++;else unchanged++;});
    el('priDiffSummary').textContent='신규 '+fresh+'개 · 변경 '+updates+'개 · 동일 '+unchanged+'개';
    el('priRows').innerHTML=rows.map((row,i)=>{
      const room=normalizeRoom(row.호수),old=existing.find(u=>normalizeRoom(u.호수)===room);const changed=changedFields(row,old);const doubtful=row.review||!room||counts.get(room)>1;
      return '<tr data-row="'+i+'"><td><input type="checkbox" data-selected '+(!doubtful&&(!old||changed.length)?'checked':'')+' aria-label="'+esc(room)+'호 선택"></td><td><input data-key="호수" value="'+esc(room)+'" aria-label="호수"></td><td>'+ (old?(changed.length?'변경 '+changed.length+'개':'동일'):'신규 호실')+'</td>'+fields.map(([key,label])=>'<td'+(changed.includes(key)?' style="background:rgba(216,184,74,.12)"':'')+'><label><input type="checkbox" data-apply="'+key+'" '+(changed.includes(key)?'checked':'')+' aria-label="'+label+' 반영"></label><input data-key="'+key+'" type="'+(['층','분양_VAT','현업종','가격표비고'].includes(key)?'text':'number')+'" '+(!['층','분양_VAT','현업종','가격표비고'].includes(key)?'min="0" step="any"':'')+' value="'+esc(row[key]??'')+'" aria-label="'+label+'">'+(old&&old[key]!=null?'<div>기존: '+esc(old[key])+'</div>':'')+'</td>').join('')+'<td class="pri-warning">'+esc([doubtful?'확인 필요':'',counts.get(room)>1?'중복 호실':'',row.note].filter(Boolean).join(' · '))+'</td></tr>';
    }).join('');el('priReview').hidden=!rows.length;
  }
  function selected(){
    const keys=new Set([...dialog.querySelectorAll('[data-field]:checked')].map(n=>n.dataset.field));
    return [...dialog.querySelectorAll('tr[data-row]')].filter(tr=>tr.querySelector('[data-selected]').checked).map(tr=>{
      const row={호수:normalizeRoom(tr.querySelector('[data-key="호수"]').value)};
      tr.querySelectorAll('[data-key]').forEach(input=>{const key=input.dataset.key;if(key==='호수'||!keys.has(key)||input.value.trim()===''||!tr.querySelector('[data-apply="'+key+'"]').checked)return;row[key]=['층','분양_VAT','현업종','가격표비고'].includes(key)?input.value.trim():Number(input.value);});const old=existing.find(u=>normalizeRoom(u.호수)===row.호수)||{};
      row._expected=Object.fromEntries(Object.keys(row).filter(k=>k!=='호수').map(k=>[k,old[k]??null]));
      return row;
    });
  }
  async function save(){
    if(busy)return;let chosen;try{chosen=validate(selected());}catch(e){el('priMessage').textContent=e.message;return;}
    lock(true);try{
      const {data,error}=await hitopAuthClient.rpc('import_building_price_rows',{p_name:el('buildingName').textContent.trim(),p_rows:chosen,p_source:revisionDate(source)+' / '+source.file_name,p_overwrite:el('priOverwrite').checked});
      if(error)throw new Error(error.message);
      await root._loadBuildingUnits();el('priMessage').textContent='저장 완료: 신규 '+data.added+'개 · 업데이트 '+data.updated+'개 · 유지 '+data.unchanged+'개';
      el('priReview').hidden=true;showToast('가격표 호실자료가 반영되었습니다.');
    }catch(e){el('priMessage').textContent='저장 실패: '+e.message;}finally{lock(false);}
  }
  root.PriceRoomImport={open};
  const uploadButton=el('unitPriceUpload');
  if(uploadButton){
    const commercial=OfficeConfig.id==='hitop' && !apartmentBuildingMode;
    uploadButton.hidden=!commercial;el('unitPriceFiles').hidden=!commercial;
    uploadButton.onclick=()=>open();
    if(commercial)refreshPriceFiles();
  }
  const originalLoad=root._loadBuildingUnits;
  if(originalLoad)root._loadBuildingUnits=async function(){await originalLoad();await refreshPriceFiles();};
})(typeof window==='undefined'?globalThis:window);
