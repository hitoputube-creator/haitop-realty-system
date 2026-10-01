(function () {
  'use strict';
  const $=id=>document.getElementById(id), bucket='land-parcel-photos', pageSize=50;
  let context=null, epoch=0, notes=[], files=[], editing=null, removed=new Set(), busy=false, offset=0, hasMore=false;
  const date=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
  const time=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false});
  function message(text){$('parcelNoteStatus').textContent=text;}
  function same(target){return context===target;}
  function identity(c){return [c.block_id,c.subblock,c.parcel].join('/');}
  function filter(c){return '?block_id=eq.'+encodeURIComponent(c.block_id)+'&subblock=eq.'+encodeURIComponent(c.subblock)+'&parcel=eq.'+encodeURIComponent(c.parcel);}
  async function api(query,options={}){
    const {data,error}=await hitopAuthClient.auth.getSession();
    if(error||!data.session)throw Error('로그인 상태를 확인해주세요.');
    const res=await fetchWithTimeout(SUPABASE_URL+'/rest/v1/land_parcel_notes'+query,{
      ...options,headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json',Prefer:'return=representation'}
    },30000);
    if(!res.ok)throw Error('메모를 저장하거나 불러오지 못했습니다. 다시 시도해주세요.');
    return res.status===204?[]:res.json();
  }
  function storage(){return hitopAuthClient.storage.from(bucket);}
  function controls(){
    ['parcelNoteSave','parcelNotePhotos','parcelNoteCamera','parcelNoteText','parcelNoteCancel','parcelNotesMore'].forEach(id=>$(id).disabled=busy);
    $('parcelNoteSave').textContent=busy?'저장 중…':editing?'메모 수정 저장':'추가 메모 저장';
    $('parcelNoteCancel').hidden=!editing;
  }
  function reset(){files=[];editing=null;removed=new Set();$('parcelNoteText').value='';$('parcelNotePhotos').value='';$('parcelNoteCamera').value='';renderFiles();controls();}
  function renderFiles(){
    const container=$('parcelNoteFiles');container.replaceChildren();
    const add=(name,action)=>{const item=document.createElement('span');item.className='parcel-note-file';const text=document.createElement('span');text.textContent=name;const button=document.createElement('button');button.type='button';button.textContent='×';button.setAttribute('aria-label',name+' 첨부 제외');button.disabled=busy;button.onclick=action;item.append(text,button);container.append(item);};
    (editing?.photos||[]).filter(photo=>!removed.has(photo.path)).forEach(photo=>add(photo.name||'등록 사진',()=>{removed.add(photo.path);renderFiles();}));
    files.forEach((file,index)=>add(file.name,()=>{files.splice(index,1);renderFiles();}));
  }
  function addFiles(event){
    const added=Array.from(event.target.files||[]);event.target.value='';
    const count=(editing?.photos||[]).filter(photo=>!removed.has(photo.path)).length+files.length;
    if(count+added.length>10){message('메모 한 건에 사진은 최대 10장까지 등록할 수 있습니다.');return;}
    if(added.some(file=>!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)||file.size>10485760)){message('사진은 JPG·PNG·WEBP·GIF 형식, 한 장당 10MB 이하로 선택해주세요.');return;}
    files.push(...added);renderFiles();message('');
  }
  const signedUrls=new Map();
  async function signed(photo){
    const cached=signedUrls.get(photo.path);
    if(cached&&cached.until>Date.now())return cached.url;
    const {data,error}=await storage().createSignedUrl(photo.path,3600);
    if(error||!data?.signedUrl)throw Error('사진을 불러오지 못했습니다.');
    signedUrls.set(photo.path,{url:data.signedUrl,until:Date.now()+3300000});
    return data.signedUrl;
  }
  async function viewPhoto(photo){
    try{
      const target=context,url=await signed(photo);if(!same(target))return;
      $('parcelPhotoImage').src=url;$('parcelPhotoImage').alt=photo.name||'필지 사진';
      $('parcelPhotoViewer').showModal();
    }catch(error){message(error.message);}
  }
  function render(){
    const list=$('parcelNotesList');list.replaceChildren();let previous='';
    const run=epoch;
    for(const note of notes){
      const created=new Date(note.created_at),day=date.format(created);
      if(day!==previous){const heading=document.createElement('h5');heading.textContent=day;list.append(heading);previous=day;}
      const article=document.createElement('article');article.className='parcel-note-entry';
      const meta=document.createElement('div');meta.className='parcel-note-meta';
      const stamp=document.createElement('span');stamp.textContent=time.format(created)+(note.updated_at!==note.created_at?' · 수정 '+date.format(new Date(note.updated_at))+' '+time.format(new Date(note.updated_at)):'');
      const actions=document.createElement('div');
      for(const [label,action]of [['수정',()=>edit(note)],['삭제',()=>deleteNote(note)]]){
        const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=label;button.disabled=busy;button.onclick=action;actions.append(button);
      }
      meta.append(stamp,actions);article.append(meta);
      if(note.body){const body=document.createElement('p');body.className='parcel-note-body';body.textContent=note.body;article.append(body);}
      const gallery=document.createElement('div');gallery.className='parcel-note-gallery';
      for(const photo of note.photos||[]){
        const button=document.createElement('button');button.type='button';button.className='parcel-note-photo';button.setAttribute('aria-label',(photo.name||'필지 사진')+' 확대');button.textContent='사진 불러오는 중';button.onclick=()=>viewPhoto(photo);gallery.append(button);
        signed(photo).then(url=>{if(run!==epoch)return;const img=document.createElement('img');img.src=url;img.alt=photo.name||'필지 사진';img.loading='lazy';img.onerror=()=>{button.textContent='사진 다시 열기';};button.replaceChildren(img);}).catch(()=>{if(run===epoch)button.textContent='사진 다시 열기';});
      }
      article.append(gallery);list.append(article);
    }
    $('parcelNotesEmpty').hidden=notes.length>0;
    $('parcelNotesMore').hidden=!hasMore;
  }
  async function load(target,more=false){
    const run=epoch;message('기록을 불러오는 중입니다.');$('parcelNotesMore').disabled=true;
    try{
      const records=await api(filter(target)+'&order=created_at.desc,id.desc&limit='+pageSize+'&offset='+(more?offset:0));
      if(run!==epoch||!same(target))return;
      notes=more?[...notes,...records]:records;offset=notes.length;hasMore=records.length===pageSize;render();message('');
    }catch(error){if(run===epoch)message(error.message);}
    finally{if(run===epoch)$('parcelNotesMore').disabled=busy;}
  }
  function edit(note){
    if(busy)return;reset();editing=note;$('parcelNoteText').value=note.body;renderFiles();controls();message('기록 내용을 수정한 뒤 저장해주세요.');$('parcelNoteText').focus();
  }
  async function cleanup(paths){if(!paths.length)return;const {error}=await storage().remove(paths);return error;}
  async function deleteNote(note){
    if(busy||!confirm('이 메모와 첨부 사진을 삭제할까요?'))return;
    const target=context;busy=true;controls();render();message('삭제 중입니다.');
    try{
      const result=await api('?id=eq.'+note.id+'&updated_at=eq.'+encodeURIComponent(note.updated_at),{method:'DELETE'});
      if(!result.length)throw Error('다른 기기에서 변경된 기록입니다. 다시 열어 확인해주세요.');
      const error=await cleanup((note.photos||[]).map(photo=>photo.path));
      if(!same(target))return;
      notes=notes.filter(item=>item.id!==note.id);offset=notes.length;if(editing?.id===note.id)reset();render();message(error?'메모를 삭제했습니다. 사진 파일 정리는 다시 확인해주세요.':'메모와 사진을 삭제했습니다.');
    }catch(error){if(same(target))message(error.message);}
    finally{busy=false;controls();if(same(target))render();}
  }
  async function save(){
    if(busy||!context)return;
    if(!context.subblock||!context.parcel||$('parcelSubblock').value.trim()!==context.subblock||$('parcelNumber').value.trim()!==context.parcel){message('필지번호를 확인하고 세부자료를 먼저 저장해주세요.');return;}
    const target=context,original=editing,body=$('parcelNoteText').value.trim(),picked=files.slice(),keep=(original?.photos||[]).filter(photo=>!removed.has(photo.path)),id=original?.id||crypto.randomUUID();
    if(!body&&!picked.length&&!keep.length){message('메모 내용이나 사진을 추가해주세요.');return;}
    const uploaded=[];let confirmed=false,submitted=false;
    busy=true;controls();renderFiles();render();message('메모와 사진을 저장 중입니다.');
    try{
      for(const file of picked){
        const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[file.type];
        const path=id+'/'+crypto.randomUUID()+'.'+extension;
        const {error}=await storage().upload(path,file,{contentType:file.type,upsert:false});
        if(error)throw Error('사진 업로드에 실패했습니다. 다시 시도해주세요.');
        uploaded.push({path,name:file.name});
      }
      const payload={body,photos:[...keep,...uploaded],...(original?{updated_at:new Date().toISOString()}:{id,block_id:target.block_id,subblock:target.subblock,parcel:target.parcel})};
      submitted=true;
      const result=await api(original?'?id=eq.'+id+'&updated_at=eq.'+encodeURIComponent(original.updated_at):'',{method:original?'PATCH':'POST',body:JSON.stringify(payload)});
      if(!result.length)throw Error('다른 기기에서 변경된 기록입니다. 다시 열어 확인해주세요.');
      confirmed=true;
      await cleanup((original?.photos||[]).filter(photo=>!keep.some(item=>item.path===photo.path)).map(photo=>photo.path));
      if(same(target)){reset();await load(target);message('메모와 사진을 저장했습니다.');}
    }catch(error){
      // A timed-out request may already have committed. Do not delete photos still referenced by a saved note.
      if(!confirmed){
        let safe=!submitted;
        if(submitted){
          try{
            const result=await api('?id=eq.'+id);const saved=result[0];
            confirmed=!!saved&&saved.body===body&&uploaded.every(photo=>(saved.photos||[]).some(item=>item.path===photo.path));
            safe=!saved||uploaded.every(photo=>!(saved.photos||[]).some(item=>item.path===photo.path));
          }catch(_){safe=false;}
        }
        if(safe)await cleanup(uploaded.map(photo=>photo.path));
      }
      if(same(target)){
        if(confirmed){reset();await load(target);message('메모와 사진을 저장했습니다.');}
        else message(error.message+' 입력 내용과 선택한 사진은 유지했습니다.');
      }
    }finally{busy=false;controls();renderFiles();if(same(target))render();}
  }
  $('parcelNotePhotos').addEventListener('change',addFiles);
  $('parcelNoteCamera').addEventListener('change',addFiles);
  $('parcelNoteSave').addEventListener('click',save);
  $('parcelNoteCancel').addEventListener('click',()=>{if(!busy){reset();message('');}});
  $('parcelNotesMore').addEventListener('click',()=>{if(!busy&&context)load(context,true);});
  $('parcelPhotoClose').addEventListener('click',()=>$('parcelPhotoViewer').close());
  $('parcelPhotoViewer').addEventListener('close',()=>{$('parcelPhotoImage').removeAttribute('src');});
  window.HitopParcelNotes={
    get busy(){return busy;},
    open(c){if(context&&identity(context)===identity(c))return;context=c;epoch++;notes=[];offset=0;hasMore=false;reset();render();load(c);},
    close(){context=null;epoch++;if($('parcelPhotoViewer').open)$('parcelPhotoViewer').close();}
  };
})();
