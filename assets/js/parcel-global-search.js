(function(){
  'use strict';
  const $=id=>document.getElementById(id),core=window.HitopParcelSearch;
  let cache=null,pending=null,epoch=0,searchRun=0,timer=null,filtered=[],shown=0,everSearched=false;
  const blockMap=new Map(window.HitopLandLocation.blocks.map(b=>[b.id,b]));
  function active(){return $('allParcelSearchInput').value.trim();}
  async function session(){const {data,error}=await hitopAuthClient.auth.getSession();if(error||!data.session)throw Error('로그인 후 필지자료를 검색해주세요.');return data.session.access_token;}
  async function readPages(table,select,token){
    const all=[];for(let offset=0;offset<50000;offset+=500){
      const response=await fetchWithTimeout(SUPABASE_URL+'/rest/v1/'+table+'?select='+select+'&order='+ (table==='land_block_sources'?'block_id':'id')+'.asc&limit=500&offset='+offset,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+token},cache:'no-store'},30000);
      if(!response.ok)throw Error('자료 조회 실패');const page=await response.json();if(!Array.isArray(page))throw Error('자료 응답 확인 실패');all.push(...page);if(page.length<500)return all;
    }throw Error('검색할 자료가 너무 많습니다.');
  }
  async function loadIndex(){
    const token=await session();if(cache?.token===token)return cache;
    if(pending?.token===token)return pending.promise;
    const run=epoch;
    const promise=(async()=>{
      const results=await Promise.allSettled([
        readPages('land_parcels','id,block_id,subblock,parcel,x,y,data',token),
        readPages('land_block_sources','block_id,source_data',token),
        readPages('land_parcel_notes','block_id,subblock,parcel,body',token)
      ]);
      if(run!==epoch)throw Error('자료가 변경되었습니다. 다시 검색해주세요.');
      const saved=results[0].status==='fulfilled'?results[0].value:[],sources=[];
      if(results[1].status==='fulfilled')results[1].value.forEach(b=>(b.source_data?.parcels||[]).forEach(r=>sources.push({...r,block_id:b.block_id,data:{...r.data}})));
      const noteText=new Map(),noteKeys=new Set();
      if(results[2].status==='fulfilled')results[2].value.forEach(n=>{const k=core.key(n);noteKeys.add(k);noteText.set(k,(noteText.get(k)||'')+' '+(n.body||''));});
      const errors=results.map((r,i)=>r.status==='rejected'?['관리자료','원본 필지목록','메모자료','C18 필지목록'][i]:null).filter(Boolean);
      const index={token,rows:core.merge(saved,sources),noteText,noteKeys,recordsLoaded:results[0].status==='fulfilled',sourcesLoaded:results[1].status==='fulfilled',notesLoaded:results[2].status==='fulfilled',errors};
      // Recheck the active session before retaining private search data.
      if(run!==epoch||await session()!==token)throw Error('로그인 상태가 변경되었습니다. 다시 검색해주세요.');
      cache=index;return index;
    })().finally(()=>{if(pending?.promise===promise)pending=null;});
    pending={token,promise};return promise;
  }
  function dataState(row,index){return window.HitopParcelDataStatus.state(row,{recordsLoaded:index.recordsLoaded,sourcesLoaded:index.sourcesLoaded});}
  function appendResults(){
    const part=filtered.slice(shown,shown+50);shown+=part.length;
    part.forEach(({row,block,state})=>{
      const button=document.createElement('button');button.type='button';button.className='parcel-search-result';
      const title=document.createElement('strong');title.textContent=(block?.district?block.district+' · ':'')+core.label(row,block);
      const info=document.createElement('span');
      const addr=String(row.data?.address||'').trim(),tail=' · '+window.HitopParcelDataStatus.labels[state]+(Number(row.data?.area)>0?' · '+Number(row.data.area).toLocaleString('ko-KR')+'㎡':'')+(block?.drawing?'':' · 상세 도면 미등록');
      const showInfo=road=>{info.textContent=(addr?window.HitopRoadAddress?.format(addr,road)||addr:'지번주소 미등록')+tail;};
      showInfo(window.HitopRoadAddress?.peek(addr));
      if(addr&&window.HitopRoadAddress&&window.HitopRoadAddress.peek(addr)===undefined)window.HitopRoadAddress.lookup(addr).then(road=>{if(road)showInfo(road);});
      button.append(title,info);
      button.addEventListener('click',()=>{if(!window.HitopLandLocation.openParcel(row.block_id,row.subblock,row.parcel))$('allParcelSearchStatus').textContent='이 블럭은 상세 도면이 아직 연결되지 않았습니다.';});
      $('allParcelSearchResults').append(button);
    });$('allParcelSearchMore').hidden=shown>=filtered.length;
  }
  async function search(force=false){
    const run=++searchRun;
    if(!active()){filtered=[];shown=0;$('allParcelSearchResults').replaceChildren();$('allParcelSearchMore').hidden=true;$('allParcelSearchStatus').textContent='검색어를 입력하세요.';return;}
    everSearched=true;$('allParcelSearchStatus').textContent='전체 필지 검색자료를 불러오는 중입니다.';$('allParcelSearchResults').replaceChildren();$('allParcelSearchMore').hidden=true;
    try{
      const index=await loadIndex();if(run!==searchRun)return;
      const q=$('allParcelSearchInput').value;
      filtered=index.rows.map(row=>({row,block:blockMap.get(row.block_id),state:dataState(row,index)})).filter(({row,block,state})=>core.matches(row,block,q,index.noteText.get(core.key(row)))).sort((a,b)=>core.label(a.row,a.block).localeCompare(core.label(b.row,b.block),'ko',{numeric:true}));
      shown=0;appendResults();$('allParcelSearchStatus').textContent='검색 결과 '+filtered.length+'필지 · 등록된 필지목록과 관리자료 기준'+(index.errors.length?' · '+index.errors.join('·')+'를 불러오지 못해 일부 자료만 검색했습니다.':filtered.length?'':' · 검색어에 맞는 필지가 없습니다.');
    }catch(error){if(run===searchRun)$('allParcelSearchStatus').textContent=error.message;}
  }
  $('allParcelSearchForm').addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);search(true);});
  $('allParcelSearchInput').addEventListener('input',()=>{clearTimeout(timer);++searchRun;timer=setTimeout(()=>search(),250);});
  $('allParcelSearchMore').addEventListener('click',appendResults);
  window.addEventListener('parcel-search-invalidate',()=>{epoch++;cache=null;pending=null;});
  window.addEventListener('parcel-search-overview',()=>{if(everSearched)search(true);});
  hitopAuthClient.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){epoch++;searchRun++;clearTimeout(timer);cache=null;pending=null;filtered=[];shown=0;$('allParcelSearchResults').replaceChildren();$('allParcelSearchMore').hidden=true;$('allParcelSearchInput').value='';$('allParcelSearchStatus').textContent='로그인 후 필지자료를 검색해주세요.';}});
})();

