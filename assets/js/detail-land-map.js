/* 택지 매물 상세: "운정3지구 C?블록 소블럭-필지" 매물이면 '서류 한눈에 보기'의 평면도 칸을 블럭 위치도로 바꾼다. (skill: hitop-realty-design) */
(function(){
  'use strict';
  const RE=/운정\s*3\s*지구\s*C\s*(\d+)\s*블[럭록]\s*(\d+)\s*-\s*(\d+)/;
  let key='',data=null,loading=null,timer=null;
  function current(){try{return typeof _currentItem!=='undefined'?_currentItem:null;}catch(e){return null;}}
  function target(item){
    if(!item)return null;
    const m=[item.address,item.mapAddress,item.title,item.publicAddress].filter(Boolean).join(' ').match(RE);
    return m?{block:'third-C'+m[1],name:'C'+m[1],sub:m[2],parcel:m[3]}:null;
  }
  async function ready(){try{if(window.hitopAuthReady)await window.hitopAuthReady;}catch(e){}}
  async function token(){const {data}=await hitopAuthClient.auth.getSession();if(!data.session)throw Error('로그인이 필요합니다.');return data.session.access_token;}
  async function load(t){
    const h={apikey:SUPABASE_KEY,Authorization:'Bearer '+await token()};
    const q='?block_id=eq.'+encodeURIComponent(t.block);
    const [src,row]=await Promise.all([
      fetchWithTimeout(SUPABASE_URL+'/rest/v1/land_block_sources'+q+'&select=diagram_svg,source_data',{headers:h,cache:'no-store'},30000).then(r=>r.ok?r.json():[]),
      fetchWithTimeout(SUPABASE_URL+'/rest/v1/land_parcels'+q+'&subblock=eq.'+encodeURIComponent(t.sub)+'&parcel=eq.'+encodeURIComponent(t.parcel)+'&select=x,y,data',{headers:h,cache:'no-store'},30000).then(r=>r.ok?r.json():[])
    ]);
    const s=src[0];if(!s||!s.diagram_svg)return null;
    const base=((s.source_data&&s.source_data.parcels)||[]).find(p=>String(p.subblock)===t.sub&&String(p.parcel)===t.parcel)||{};
    const saved=row[0]||{};const x=saved.x!=null?saved.x:base.x,y=saved.y!=null?saved.y:base.y;
    const ok=Number.isFinite(Number(x))&&Number.isFinite(Number(y))&&!(saved.data&&saved.data.mapPositionUnavailable);
    return {url:URL.createObjectURL(new Blob([s.diagram_svg],{type:'image/svg+xml'})),x:Number(x),y:Number(y),ok};
  }
  async function loadRetry(t){for(let i=0;i<5;i++){try{await ready();const d=await load(t);if(d)return d;}catch(e){}await new Promise(r=>setTimeout(r,1200*(i+1)));}return null;}
  function fill(card,t,d){
    const label=t.name+'-'+t.sub+'-'+t.parcel;
    card.dataset.landMap='1';card.replaceChildren();
    const h=document.createElement('h4');h.textContent='📍 위치도 ';const sm=document.createElement('small');sm.textContent='LH 블럭 도면';h.append(sm);card.append(h);
    if(!d){const e=document.createElement('div');e.className='lo-empty';e.textContent='블럭 도면을 불러오는 중이거나 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.';card.append(e);}
    else{
      const stage=document.createElement('div');stage.className='lpm-stage';
      const img=document.createElement('img');img.alt=t.name+' 블럭 위치도';img.src=d.url;stage.append(img);
      if(d.ok){const pin=document.createElement('div');pin.className='lpm-pin';pin.style.left=d.x+'%';pin.style.top=d.y+'%';const sp=document.createElement('span');sp.textContent=label;pin.append(sp);stage.append(pin);}
      const note=document.createElement('p');note.className='lpm-note';note.textContent=d.ok?'붉은 표시가 '+label+' 필지예요.':'이 필지는 도면 위치가 아직 등록되지 않았어요.';
      card.append(stage,note);
    }
    const row=document.createElement('div');row.className='lo-row';
    const a=document.createElement('a');a.className='lpm-open';a.target='_blank';a.rel='noopener';a.textContent='🔍 위치도에서 크게 보기';
    const office=(typeof OfficeConfig!=='undefined'&&OfficeConfig.id)||'hitop';
    a.href='land-location.html?'+new URLSearchParams({office,view:'all',block:t.block,subblock:t.sub,parcel:t.parcel});
    row.append(a);card.append(row);
  }
  async function apply(){
    const old=document.getElementById('landParcelMapSection');if(old)old.remove();
    const t=target(current());if(!t)return;
    const k=t.block+'/'+t.sub+'/'+t.parcel;
    if(k!==key){key=k;data=null;loading=loadRetry(t).then(d=>{data=d;if(!d)key='';});}
    const card=document.querySelector('#listingOverviewArea .lo-card[data-card="floor"]');
    if(card&&!card.dataset.landMap)fill(card,t,data);
    await loading;
    const c2=document.querySelector('#listingOverviewArea .lo-card[data-card="floor"]');
    if(c2&&(!c2.dataset.landMap||(data&&!c2.querySelector('.lpm-stage'))))fill(c2,t,data);
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(apply,80);}
  function start(){new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();}
  const css=document.createElement('style');
  css.textContent='.lo-card[data-land-map] .lpm-stage{position:relative;width:100%;margin:6px 0 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fff}.lpm-stage img{display:block;width:100%;height:auto}.lpm-pin{position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border:3px solid #dc2626;border-radius:50%;background:rgba(255,255,255,.65)}.lpm-pin:after{content:"";position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:#dc2626}.lpm-pin span{position:absolute;left:50%;bottom:calc(100% + 5px);transform:translateX(-50%);white-space:nowrap;background:#fff;border:1.5px solid #dc2626;color:#b91c1c;font-size:11px;font-weight:800;padding:1px 6px;border-radius:5px}.lpm-note{margin:6px 0 0;font-size:12px;color:#64748b}.lo-card[data-land-map] .lpm-open{display:inline-flex;align-items:center;height:30px;padding:0 12px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;font-size:12.5px;font-weight:700;color:#475569;text-decoration:none}';
  document.head.append(css);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
