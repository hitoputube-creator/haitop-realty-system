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
    await landscape(item,t,label,s,base,saved,d,img.src,ok?x:null,ok?y:null);
  }
  function loadScript(src){return new Promise((res,rej)=>{if(window.HitopParcelPrint)return res();const sc=document.createElement('script');sc.src=src;sc.onload=res;sc.onerror=rej;document.head.append(sc);});}
  /* 택지 자료실 필지 인쇄와 같은 A4 가로 양식으로 보여 주고 출력한다 */
  async function landscape(item,t,label,s,base,saved,d,src,x,y){
    await loadScript('assets/js/parcel-print.js?v=20261125-landscape-contact1');
    if(!window.HitopParcelPrint)return;
    const num=v=>v===null||v===undefined||v===''?null:Number(v);
    const src0=base.source||{};
    const supply=num(d.supplyPrice)!=null?num(d.supplyPrice)*10000:(src0.supplyPriceWon||(base.data&&num(base.data.supplyPrice)!=null?num(base.data.supplyPrice)*10000:null));
    const lt=d.landType||(base.data&&base.data.landType);
    const no=Number(t.name.slice(1));
    const model={mode:'customer',includeLocation:true,includeMemo:false,includePhotos:false,
      title:label,district:'운정3지구 택지',blockName:t.name+' 블럭'+([3,4].includes(no)?' (이주자택지)':''),subblock:t.sub,parcel:t.parcel,
      address:d.address||'',landType:{single:'주거전용',shop:'상가점포'}[lt]||'',households:d.households||src0.households||'',unsold:false,
      area:d.area||(base.data&&base.data.area)||item.areaM2||'',
      prices:{supplyPrice:supply,auctionPrice:num(d.auctionPrice)!=null?num(d.auctionPrice)*10000:null,salePrice:num(item.salePrice)||(num(d.salePrice)!=null?num(d.salePrice)*10000:null)},
      building:{exists:d.building==='building',confirmedVacant:d.building==='vacant',road:d.buildingRoadAddress||'',name:d.buildingName||'',purpose:d.buildingPurpose||'',floors:d.buildingFloors||'',structure:d.buildingStructure||'',approval:d.buildingApproval||'',footprint:d.buildingFootprint||'',totalArea:d.buildingTotalArea||''},
      sourceText:src0.coverage!=null?('원본\n건폐율 '+src0.coverage+'% 이하 · 용적률 '+src0.floorRatio+'% 이하 · '+src0.floors+'층 이하'+(src0.households?' · '+src0.households+'가구 이하':'')):'',
      map:{src,width:Number(s.source_data&&s.source_data.width)||1170,height:Number(s.source_data&&s.source_data.height)||1350,x,y}};
    const page=document.getElementById('property-page');if(!page||document.getElementById('plm-landscape'))return;
    const box=document.createElement('div');box.id='plm-landscape';
    const bar=document.createElement('div');bar.className='plm-bar';
    const info=document.createElement('span');info.textContent='택지 매물은 택지 자료실 필지 인쇄와 같은 A4 가로 양식으로 출력돼요.';
    const toggle=document.createElement('button');toggle.type='button';toggle.textContent='세로 제안서로 보기';
    bar.append(info,toggle);
    const frame=document.createElement('iframe');frame.title=label+' 택지 안내서 미리보기';frame.srcdoc=window.HitopParcelPrint.render(model).replace('<body>','<body style="padding:8mm;box-sizing:border-box;width:297mm">');
    box.append(bar,frame);page.before(box);page.style.display='none';
    let land=true;
    toggle.onclick=()=>{land=!land;frame.style.display=land?'':'none';page.style.display=land?'none':'';toggle.textContent=land?'세로 제안서로 보기':'가로 안내서로 보기';};
    document.querySelectorAll('button[onclick="window.print()"]').forEach(b=>{b.removeAttribute('onclick');b.addEventListener('click',()=>{if(land)window.HitopParcelPrint.print(model);else window.print();});});
  }
  function waitFor(fn){return new Promise(res=>{let n=0;const t=setInterval(()=>{if(fn()||++n>60){clearInterval(t);res();}},150);});}
  const css=document.createElement('style');
  css.textContent='#plm-landscape{max-width:297mm;margin:24px auto 12px}#plm-landscape .plm-bar{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:12.5px;color:#475569}#plm-landscape .plm-bar button{margin-left:auto;height:30px;padding:0 12px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;font:inherit;font-weight:700;color:#475569;cursor:pointer}#plm-landscape iframe{display:block;width:297mm;height:210mm;border:1px solid #dbe3ec;border-radius:8px;background:#fff;box-shadow:0 3px 14px rgba(15,23,42,.08)}@media print{#plm-landscape{display:none!important}}#plm-area{margin:14px 0 6px;break-inside:avoid}.plm-stage{position:relative;width:fit-content;max-width:100%;margin:0 auto;border:1px solid #dbe3ec;border-radius:8px;overflow:hidden;background:#fff}.plm-stage img{display:block;height:105mm;width:auto;max-width:100%}.plm-pin{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border:3px solid #dc2626;border-radius:50%;background:rgba(255,255,255,.65);-webkit-print-color-adjust:exact;print-color-adjust:exact}.plm-pin:after{content:"";position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#dc2626}.plm-pin span{position:absolute;left:50%;bottom:calc(100% + 7px);transform:translateX(-50%);white-space:nowrap;background:#fff;border:1.5px solid #dc2626;color:#b91c1c;font-size:11px;font-weight:800;padding:2px 8px;border-radius:5px}.plm-note{margin:6px 0 0;text-align:center;font-size:11px;color:#64748b}';
  document.head.append(css);
  run().catch(()=>{});
})();
