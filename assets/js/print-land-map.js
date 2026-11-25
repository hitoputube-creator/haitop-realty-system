/* 매물 제안서(택지): "운정3지구 C?블록 소블럭-필지" 매물이면 블럭 도면에 위치를 표시하고 실제 지번을 표에 넣는다. (skill: hitop-realty-design) */
(function(){
  'use strict';
  const RE=/운정\s*3\s*지구\s*C\s*(\d+)\s*블[럭록]\s*(\d+)\s*-\s*(\d+)/;
  const id=new URLSearchParams(location.search).get('id');
  async function token(){const {data}=await hitopAuthClient.auth.getSession();if(!data.session)throw Error('login');return data.session.access_token;}
  async function run(){
    if(!id||typeof getListingById!=='function')return;
    const item=await getListingById(id);if(!item)return;
    const m=[item.address,item.mapAddress,item.title,item.publicAddress].filter(Boolean).join(' ').match(RE);if(!m)return;
    const t={block:'third-C'+m[1],name:'C'+m[1],sub:m[2],parcel:m[3]};const label=t.name+'-'+t.sub+'-'+t.parcel;
    const h={apikey:SUPABASE_KEY,Authorization:'Bearer '+await token()};const q='?block_id=eq.'+t.block;
    const [src,row]=await Promise.all([
      fetchWithTimeout(SUPABASE_URL+'/rest/v1/land_block_sources'+q+'&select=diagram_svg,source_data',{headers:h,cache:'no-store'},30000).then(r=>r.ok?r.json():[]),
      fetchWithTimeout(SUPABASE_URL+'/rest/v1/land_parcels'+q+'&subblock=eq.'+t.sub+'&parcel=eq.'+t.parcel+'&select=x,y,data',{headers:h,cache:'no-store'},30000).then(r=>r.ok?r.json():[])
    ]);
    const s=src[0];const base=s?((s.source_data&&s.source_data.parcels)||[]).find(p=>String(p.subblock)===t.sub&&String(p.parcel)===t.parcel)||{}:{};
    const saved=row[0]||{};const d=saved.data||{};
    const jibun=String(d.address||'').trim();
    await waitFor(()=>document.getElementById('info-tbody')&&document.getElementById('info-tbody').children.length);
    const tb=document.getElementById('info-tbody');
    if(jibun&&!document.getElementById('plm-jibun')){
      const tr=document.createElement('tr');tr.id='plm-jibun';
      const th=document.createElement('th');th.textContent='필지 · 지번';const td=document.createElement('td');td.colSpan=3;td.textContent=label+' · 파주시 '+jibun+(d.landType==='shop'?' · 점포겸용 단독주택용지':d.landType==='single'?' · 주거전용 단독주택용지':'');
      tr.append(th,td);const first=tb.querySelector('tr');if(first)first.after(tr);else tb.append(tr);
    }
    if(!s||!s.diagram_svg)return;
    const x=saved.x!=null?saved.x:base.x,y=saved.y!=null?saved.y:base.y;
    const ok=Number.isFinite(Number(x))&&Number.isFinite(Number(y))&&!d.mapPositionUnavailable;
    const photo=document.getElementById('photo-area');if(!photo||document.getElementById('plm-area'))return;
    const wrap=document.createElement('div');wrap.id='plm-area';
    const title=document.createElement('div');title.className='section-title';title.innerHTML='<span>📍</span> 택지 위치 · ';title.append(label);
    const stage=document.createElement('div');stage.className='plm-stage';
    const img=document.createElement('img');img.alt=label+' 택지 위치도';img.src=URL.createObjectURL(new Blob([s.diagram_svg],{type:'image/svg+xml'}));stage.append(img);
    if(ok){const pin=document.createElement('div');pin.className='plm-pin';pin.style.left=x+'%';pin.style.top=y+'%';const sp=document.createElement('span');sp.textContent='매물위치 · '+label;pin.append(sp);stage.append(pin);}
    const note=document.createElement('p');note.className='plm-note';note.textContent=ok?'붉은 표시가 해당 필지입니다.':'도면 위치가 아직 등록되지 않은 필지입니다.';
    wrap.append(title,stage,note);photo.before(wrap);
  }
  function waitFor(fn){return new Promise(res=>{let n=0;const t=setInterval(()=>{if(fn()||++n>60){clearInterval(t);res();}},150);});}
  const css=document.createElement('style');
  css.textContent='#plm-area{margin:14px 0 6px;break-inside:avoid}.plm-stage{position:relative;width:fit-content;max-width:100%;margin:0 auto;border:1px solid #dbe3ec;border-radius:8px;overflow:hidden;background:#fff}.plm-stage img{display:block;height:105mm;width:auto;max-width:100%}.plm-pin{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border:3px solid #dc2626;border-radius:50%;background:rgba(255,255,255,.65);-webkit-print-color-adjust:exact;print-color-adjust:exact}.plm-pin:after{content:"";position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#dc2626}.plm-pin span{position:absolute;left:50%;bottom:calc(100% + 7px);transform:translateX(-50%);white-space:nowrap;background:#fff;border:1.5px solid #dc2626;color:#b91c1c;font-size:11px;font-weight:800;padding:2px 8px;border-radius:5px}.plm-note{margin:6px 0 0;text-align:center;font-size:11px;color:#64748b}';
  document.head.append(css);
  run().catch(()=>{});
})();
