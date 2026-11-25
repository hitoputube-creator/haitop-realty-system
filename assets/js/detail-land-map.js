/* 택지 매물 상세: 주소의 "운정3지구 C?블록 소블럭-필지"를 읽어 블럭 도면에 해당 필지를 표시한다. (skill: hitop-realty-design) */
(function(){
  'use strict';
  const RE=/운정\s*3\s*지구\s*C\s*(\d+)\s*블[럭록]\s*(\d+)\s*-\s*(\d+)/;
  let cacheKey='',cacheEl=null,loading=null,timer=null;
  function current(){try{return typeof _currentItem!=='undefined'?_currentItem:null;}catch(e){return null;}}
  function target(item){
    if(!item)return null;
    const text=[item.address,item.mapAddress,item.title,item.publicAddress].filter(Boolean).join(' ');
    const m=text.match(RE);if(!m)return null;
    return {block:'third-C'+m[1],name:'C'+m[1],sub:m[2],parcel:m[3]};
  }
  async function ready(){try{if(window.hitopAuthReady)await window.hitopAuthReady;}catch(e){}}
  async function withRetry(fn){for(let i=0;i<5;i++){try{await ready();const r=await fn();if(r)return r;}catch(e){}await new Promise(r=>setTimeout(r,1200*(i+1)));}return null;}
  async function token(){const {data}=await hitopAuthClient.auth.getSession();if(!data.session)throw Error('로그인이 필요합니다.');return data.session.access_token;}
  async function load(t){
    const h={apikey:SUPABASE_KEY,Authorization:'Bearer '+await token()};
    const q='?block_id=eq.'+encodeURIComponent(t.block);
    const [src,row]=await Promise.all([
      fetchWithTimeout(SUPABASE_URL+'/rest/v1/land_block_sources'+q+'&select=diagram_svg,source_data',{headers:h,cache:'no-store'},30000).then(r=>r.ok?r.json():[]),
      fetchWithTimeout(SUPABASE_URL+'/rest/v1/land_parcels'+q+'&subblock=eq.'+encodeURIComponent(t.sub)+'&parcel=eq.'+encodeURIComponent(t.parcel)+'&select=x,y,data',{headers:h,cache:'no-store'},30000).then(r=>r.ok?r.json():[])
    ]);
    const s=src[0];if(!s||!s.diagram_svg)return null;
    const base=(s.source_data?.parcels||[]).find(p=>String(p.subblock)===t.sub&&String(p.parcel)===t.parcel)||{};
    const saved=row[0]||{};
    const x=saved.x??base.x,y=saved.y??base.y;
    const okPos=Number.isFinite(Number(x))&&Number.isFinite(Number(y))&&!(saved.data&&saved.data.mapPositionUnavailable);
    return {svg:s.diagram_svg,w:Number(s.source_data?.width)||0,h:Number(s.source_data?.height)||0,x:Number(x),y:Number(y),okPos,address:(saved.data&&saved.data.address)||''};
  }
  function build(t,d){
    const sec=document.createElement('section');sec.className='detail-section land-parcel-map-section';sec.id='landParcelMapSection';
    const title=document.createElement('div');title.className='detail-section-title';title.textContent='택지 위치 · '+t.name+'-'+t.sub+'-'+t.parcel;
    const link=document.createElement('a');link.className='detail-title-extra lpm-open';link.target='_blank';link.rel='noopener';link.textContent='위치도에서 크게 보기 ↗';
    const office=(typeof OfficeConfig!=='undefined'&&OfficeConfig.id)||'hitop';
    link.href='land-location.html?'+new URLSearchParams({office,view:'all',block:t.block,subblock:t.sub,parcel:t.parcel});
    title.append(link);
    const body=document.createElement('div');body.className='lpm-body';
    if(!d){body.textContent='이 블럭의 도면 자료를 불러오지 못했습니다.';sec.append(title,body);return sec;}
    const stage=document.createElement('div');stage.className='lpm-stage';
    const img=document.createElement('img');img.alt=t.name+' 블럭 도면';img.src=URL.createObjectURL(new Blob([d.svg],{type:'image/svg+xml'}));
    stage.append(img);
    if(d.okPos){
      const pin=document.createElement('div');pin.className='lpm-pin';pin.style.left=d.x+'%';pin.style.top=d.y+'%';
      const label=document.createElement('span');label.textContent='매물위치 · '+t.name+'-'+t.sub+'-'+t.parcel;pin.append(label);stage.append(pin);
    }
    const note=document.createElement('p');note.className='lpm-note';
    note.textContent=d.okPos?('붉은 표시가 해당 필지입니다.'+(d.address?' · 지번 '+d.address:'')):'이 필지는 도면 위치가 아직 등록되지 않았습니다.';
    body.append(stage,note);sec.append(title,body);return sec;
  }
  async function place(){
    const area=document.getElementById('detailArea');if(!area)return;
    const t=target(current());
    const old=document.getElementById('landParcelMapSection');
    if(!t){if(old)old.remove();return;}
    const key=t.block+'/'+t.sub+'/'+t.parcel;
    if(key!==cacheKey){cacheKey=key;cacheEl=null;loading=withRetry(()=>load(t)).then(d=>{cacheEl=build(t,d);if(!d)cacheKey='';});}
    await loading;if(key!==cacheKey)return;
    if(document.getElementById('landParcelMapSection')===cacheEl)return;
    const anchor=area.querySelector('.listing-info-section');if(!anchor)return;
    anchor.after(cacheEl);
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(place,80);}
  function start(){const area=document.getElementById('detailArea');if(!area){setTimeout(start,300);return;}new MutationObserver(schedule).observe(area,{childList:true});schedule();}
  const css=document.createElement('style');
  css.textContent='.land-parcel-map-section .detail-section-title{display:flex;align-items:center;gap:8px}.land-parcel-map-section .lpm-open{margin-left:auto;font-size:12px;font-weight:700;text-decoration:none;color:var(--rp-accent,#25675f);border:1px solid #cbd5e1;border-radius:6px;padding:4px 10px;background:#fff}html[data-office-theme="ktop"] .land-parcel-map-section .lpm-open{color:#1767d2}.lpm-body{padding:10px 4px 2px}.lpm-stage{position:relative;width:min(100%,560px);margin:0 auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#fff}.lpm-stage img{display:block;width:100%;height:auto}.lpm-pin{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border:3px solid #dc2626;border-radius:50%;background:rgba(255,255,255,.65);box-shadow:0 0 0 3px rgba(220,38,38,.18)}.lpm-pin:after{content:"";position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#dc2626}.lpm-pin span{position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);white-space:nowrap;background:#fff;border:1.5px solid #dc2626;color:#b91c1c;font-size:12px;font-weight:800;padding:3px 9px;border-radius:6px}.lpm-note{margin:8px 0 0;text-align:center;font-size:12px;color:#64748b}';
  document.head.append(css);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
