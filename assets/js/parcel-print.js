(function(root){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const won=value=>value==null||value===''?'':Number.isFinite(Number(value))?Math.round(Number(value)).toLocaleString('ko-KR')+'원':'';
  const area=value=>Number(value)>0?Number(value).toLocaleString('ko-KR',{maximumFractionDigits:2})+'㎡ / '+(Number(value)/3.305785).toLocaleString('ko-KR',{maximumFractionDigits:2})+'평':'';
  function render(model){
    const internal=model.mode==='internal';
    const officeId=typeof OfficeConfig!=='undefined'?OfficeConfig.id:'';const phone={hitop:'031-949-8969',ktop:'031-943-8000'}[officeId]||'';const company=({hitop:{name:'하이탑부동산공인중개사사무소',phone:'031-949-8969',rep:'주현희',fax:'031-944-1108',addr:'경기도 파주시 책향기로 830, 1층',reg:'41480-2016-00026',biz:'305-48-62183',email:'newpajucity@naver.com'},ktop:{name:'케이탑부동산',phone:'031-943-8000',rep:'주세진',fax:'031-943-8050',addr:'경기 파주시 양지로 112 단지내상가 108',reg:'41480-2024-00005',biz:'527-75-00406',email:'k-top1@naver.com'}})[officeId]||{name:officeCompanyName,phone};
    const pyeong=v=>Number(v)>0?Number(v)/3.305785:null;
    const fmt=(n,d=2)=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:d});
    const perPy=v=>Number(v)>0&&pyeong(model.area)?won(Number(v)/pyeong(model.area)):'';
    const day=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t)).replace(/\s/g,'').replace(/\.$/,''):'';};
    const row=(label,value,strong)=>value===null||value===undefined||value===''?'':'<tr><th>'+escape(label)+'</th><td'+(strong?' class="strong"':'')+'>'+escape(value)+'</td></tr>';
    const section=(title,body,cls)=>body?'<section class="'+(cls||'')+'"><h2>'+escape(title)+'</h2><table>'+body+'</table></section>':'';
    const b=model.building||{};
    const buildingLabel=b.exists?'건물 있음':b.confirmedVacant?'건물 없음':'확인 자료 없음';
    const kpi=(label,value,sub)=>'<div class="kpi"><div class="k-label">'+escape(label)+'</div><div class="k-value">'+escape(value||'미입력')+'</div>'+(sub?'<div class="k-sub">'+escape(sub)+'</div>':'')+'</div>';
    const areaText=Number(model.area)>0?fmt(model.area)+'㎡':'';
    const kpis='<div class="kpis">'+kpi('토지면적',areaText,Number(model.area)>0?fmt(pyeong(model.area))+'평':'')
      +kpi('공급금액',won(model.prices?.supplyPrice),perPy(model.prices?.supplyPrice)?'평당 '+perPy(model.prices?.supplyPrice):'')
      +(model.prices?.salePrice?kpi(b.exists?'토지+건물 매매금액':'매매금액',won(model.prices.salePrice),perPy(model.prices.salePrice)?'평당 '+perPy(model.prices.salePrice):''):kpi('낙찰가격',won(model.prices?.auctionPrice)||'자료 없음',perPy(model.prices?.auctionPrice)?'평당 '+perPy(model.prices?.auctionPrice):''))
      +kpi('건물',buildingLabel,b.exists?[b.floors,b.purpose].filter(Boolean).join(' · '):'')+'</div>';
    const items=[];
    const add=(label,value,strong)=>{if(value!==null&&value!==undefined&&value!=='')items.push([label,value,strong]);};
    add('필지번호',model.title,true);add('지구',model.district);add('블럭',model.blockName);
    add('소재지 · 지번',model.address||'미입력',true);
    add('택지 유형',model.landType);add('허용가구수',model.households?model.households+'가구 이하':'');add('공급 상태',model.unsold?'미분양 (공급 전)':'');
    add('도로명주소',b.road?(/(?:시|군)\s/.test(b.road)?b.road:'파주시 '+b.road):'');add('소유 구분',model.ownership);
    add('토지면적',area(model.area));
    for(const [key,label] of [['supplyPrice','공급금액'],['auctionPrice','낙찰가격'],['salePrice',b.exists?'토지+건물 매매금액':'매매금액']]){
      const v=model.prices?.[key];if(!won(v))continue;
      add(label,won(v),key==='salePrice'||key==='supplyPrice');add({supplyPrice:'공급 평당가',auctionPrice:'낙찰 평당가',salePrice:'매매 평당가'}[key],perPy(v));
    }
    add('건물 유무',buildingLabel,true);
    if(b.exists){add('건물명',b.name);add('주용도',b.purpose);add('층수',b.floors);add('구조',b.structure);add('사용승인일',b.approval);add('건축면적',area(b.footprint));add('연면적',area(b.totalArea));add('보증금 합계',won(b.deposit));add('월세 합계',won(b.rent));}
    const cond=(model.sourceText||'').split('\n').map(s=>s.trim()).filter(Boolean).slice(1);
    cond.forEach(line=>add('LH 공급 조건',line));
    let privateContent='';
    if(internal)privateContent=section('내부 관리자료',row('소유주',model.owner||'미입력')+row('연락처',model.contact||'미입력')+(model.includeMemo?row('비고',model.note):''),'wide');
    else if(model.includeMemo&&model.note)privateContent=section('메모',row('비고',model.note),'wide');
    if(model.includeMemo||model.includePhotos){
      privateContent+='<section class="records wide"><h2>날짜별 기록</h2>';
      for(const note of model.notes||[]){
        if(!(model.includeMemo&&note.body)&&!(model.includePhotos&&note.photos?.length))continue;
        const d=note.note_date||day(note.created_at);
        privateContent+='<article><h3>'+escape(d)+'</h3>'+(model.includeMemo&&note.body?'<p class="memo">'+escape(note.body)+'</p>':'');
        if(model.includePhotos&&note.photos?.length)privateContent+='<div class="photos">'+note.photos.map(photo=>'<figure>'+(/^https?:\/\//.test(photo.printUrl||'')?'<img src="'+escape(photo.printUrl)+'" alt="'+escape(photo.name||'필지 사진')+'">':'<p>사진을 불러오지 못했습니다.</p>')+'<figcaption>'+escape(photo.name||'필지 사진')+'</figcaption></figure>').join('')+'</div>';
        privateContent+='</article>';
      }
      if(!model.notes?.length)privateContent+='<p>저장된 메모·사진 기록이 없습니다.</p>';
      privateContent+='</section>';
    }
    let location='';
    if(model.includeLocation){
      const map=model.map;
      location='<section class="map-section"><h2>택지 위치 · '+escape(model.title)+'</h2>';
      if(map&&/^(https?:|blob:)/.test(map.src||'')){
        const vb=map.viewBox||{x:0,y:0,width:100,height:100};
        const positioned=map.x!=null&&map.y!=null&&map.x!==''&&map.y!==''&&Number.isFinite(Number(map.x))&&Number.isFinite(Number(map.y))&&Number(map.x)>=0&&Number(map.x)<=100&&Number(map.y)>=0&&Number(map.y)<=100;
        const x=vb.x+Number(map.x)/100*vb.width,y=vb.y+Number(map.y)/100*vb.height,r=vb.width*.014;
        let marker=map.path?'<path d="'+escape(map.path)+'" fill="#dc262655" stroke="#dc2626" stroke-width="2" vector-effect="non-scaling-stroke"/>':'';
        if(positioned){
          const labelWidth=vb.width*.28,labelHeight=vb.width*.052,pad=vb.width*.008;
          const labelX=Math.max(vb.x+pad,Math.min(vb.x+vb.width-labelWidth-pad,x-labelWidth/2));
          const above=y-vb.y>labelHeight+r*2;
          const labelY=Math.max(vb.y+pad,Math.min(vb.y+vb.height-labelHeight-pad,above?y-r*2-labelHeight:y+r*2));
          marker+='<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="#fff" fill-opacity=".65" stroke="#dc2626" stroke-width="2.5" vector-effect="non-scaling-stroke"/><circle cx="'+x+'" cy="'+y+'" r="'+r*.35+'" fill="#dc2626"/>';
          marker+='<line x1="'+x+'" y1="'+y+'" x2="'+(labelX+labelWidth/2)+'" y2="'+(above?labelY+labelHeight:labelY)+'" stroke="#dc2626" stroke-width="1.5" vector-effect="non-scaling-stroke"/>';
          marker+='<rect class="property-location-label" x="'+labelX+'" y="'+labelY+'" width="'+labelWidth+'" height="'+labelHeight+'" rx="'+pad+'" fill="#fff" stroke="#dc2626" stroke-width="1.5" vector-effect="non-scaling-stroke"/><text x="'+(labelX+labelWidth/2)+'" y="'+(labelY+labelHeight/2)+'" text-anchor="middle" dominant-baseline="central" fill="#b91c1c" font-size="'+vb.width*.018+'" font-weight="700">매물위치 · '+escape(model.title)+'</text>';
        }
        const width=Math.min(118,126*(Number(map.width)||100)/(Number(map.height)||100));
        location+='<div class="location-map" style="position:relative;width:'+width+'mm;max-width:100%;margin:auto"><img style="display:block;width:100%;height:auto" src="'+escape(map.src)+'" alt="'+escape(model.title)+' 택지 위치도"><svg style="position:absolute;inset:0;width:100%;height:100%" viewBox="'+[vb.x,vb.y,vb.width,vb.height].join(' ')+'" preserveAspectRatio="none">'+marker+'</svg></div><p class="source">'+(positioned?'매물위치: '+escape(model.title)+' · 빨간색 테두리와 위치 표시는 해당 필지입니다.':'필지의 정확한 표시 위치는 아직 등록되지 않았습니다.')+'</p>';
      }else location+='<p>연결된 택지 도면이 없습니다.</p>';
      location+='</section>';
    }
    const today=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replace(/\s/g,'').replace(/\.$/,'');
    const accent=officeId==='ktop'?'#1767d2':'#25675f',soft=officeId==='ktop'?'#f5f8fe':'#f4f9f8';
    const subtitle=[model.district,model.blockName].filter(Boolean).join(' · ');
    const mapWidth=Math.min(176,193*(Number(model.map?.width)||1170)/(Number(model.map?.height)||1350));
    const css=`@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;color:#202b2e;font:10pt/1.45 'Malgun Gothic',Arial,sans-serif;font-variant-numeric:tabular-nums}.sheet{display:grid;grid-template-columns:minmax(0,1fr) ${mapWidth}mm;gap:7mm;min-height:193mm}.sheet.only{grid-template-columns:1fr}.info{min-width:0;display:flex;flex-direction:column}header{padding:1mm 0 3.5mm;border-top:1.2mm solid ${accent}}.eyebrow,.date{font-size:8pt;color:#526568}.headrow{display:flex;justify-content:space-between;align-items:center;margin-top:2mm}.eyebrow{color:${accent};font-weight:700;letter-spacing:.12em}h1{display:inline-block;font-size:19pt;line-height:1.1;letter-spacing:-.01em;margin:2.2mm 0 1.4mm;padding:1.5mm 4.2mm 1.7mm;background:${accent};color:#fff;border-radius:1.6mm;font-weight:800;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sub{font-weight:600;font-size:10.5pt}.kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2mm;margin:0 0 4mm}.kpi{border:1px solid #d1dcda;border-radius:1.2mm;background:${soft};padding:2.1mm 3mm;min-height:16mm}.k-label{font-size:8.5pt;color:${accent};font-weight:600}.k-value{font-size:14pt;font-weight:700;line-height:1.25;letter-spacing:-.035em}.k-sub{color:#526568;font-size:8.5pt}.data,table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:1.45mm 0;border-bottom:.2mm solid #dce3e1;word-break:keep-all;overflow-wrap:anywhere}th{color:#58686b;width:26mm;font-weight:500}td{font-weight:600}.data{border-top:.3mm solid #899b98}footer{margin-top:auto;padding:3mm 0 .5mm;border-top:.5mm solid ${accent};display:flex;align-items:baseline;justify-content:space-between;gap:2mm}footer b{font-size:13pt}footer strong{font:700 15pt Arial;color:${accent}}.spacer{min-height:4mm;flex:1}.map-section{margin:0;position:relative;align-self:start}.map-section h2,.map-section .source{display:none}.location-map{width:100%!important;margin:0!important;outline:1px solid #c6cfcc;outline-offset:-1px}.extra h2{font-size:11pt}.memo{white-space:pre-wrap}.photos{display:flex;flex-wrap:wrap;gap:2mm}figure{margin:0}figure img{max-width:28mm;max-height:20mm}.legend{margin:2.5mm 0 0;color:#566569;font-size:8.5pt}.legend i{display:inline-block;width:2.5mm;height:2.5mm;border:1.5px solid #bd2e31;border-radius:50%;margin-right:1.5mm}.extra article{break-inside:avoid}footer.contact{--ink:${accent};--wash:${soft}}footer.contact{position:relative;isolation:isolate;overflow:hidden;display:block;margin:0;padding:3.8mm 5mm 4mm;border:0;border-left:1.15mm solid var(--ink);background:var(--wash);color:#18312e}footer.contact .mark{position:absolute;right:-3mm;top:-7mm;width:39mm;height:40mm;z-index:-1;color:var(--ink);opacity:.17}footer.contact .office{display:block;color:var(--ink);font-size:15pt;line-height:1.2;letter-spacing:-.055em}footer.contact .contactline{margin-top:1.7mm;display:flex;align-items:baseline;gap:2.8mm}footer.contact small{color:#536360;font-size:9pt}footer.contact strong{font:700 18pt/1 Arial,sans-serif;letter-spacing:-.035em;color:#20302e;white-space:nowrap}footer.contact2{display:block;padding:0;margin-top:auto;border:1.5px solid ${accent};border-radius:3mm;overflow:hidden;break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}footer.contact2 .c2-head{display:flex;justify-content:space-between;align-items:center;gap:3mm;padding:2.6mm 4.5mm;background:${accent};color:#fff}footer.contact2 .c2-head b{font-size:12pt;letter-spacing:-.02em}footer.contact2 .c2-head strong{font:inherit;font-size:13pt;font-weight:800;color:#fff;white-space:nowrap}footer.contact2 .c2-grid{display:grid;grid-template-columns:1fr 1fr}footer.contact2 .c2-grid div{display:grid;grid-template-columns:17mm 1fr;align-items:center;padding:1.5mm 4.5mm;border-top:.2mm solid #dbe3e1;font-size:8.5pt}footer.contact2 .c2-grid div:nth-child(-n+2){border-top:0}footer.contact2 .c2-grid div:not(.full):nth-child(odd){border-right:.2mm solid #dbe3e1}footer.contact2 .c2-grid div.full{grid-column:1/-1;background:${soft}}footer.contact2 .c2-grid span{color:${accent};font-weight:800}footer.contact2 .c2-grid em{font-style:normal;font-weight:600;color:#23332f;overflow-wrap:anywhere}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
    const repeated=new Set(['필지번호','지구','블럭','토지면적','건물 유무','공급금액','공급 평당가',...(model.prices?.salePrice?[b.exists?'토지+건물 매매금액':'매매금액','매매 평당가']:['낙찰가격','낙찰 평당가'])]);
    const details=items.filter(item=>!repeated.has(item[0])).map(item=>row(...item)).join('');
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>'+escape(model.title)+' 필지 안내</title><style>'+css+'</style></head><body><main class="sheet'+(location?'':' only')+'"><div class="info"><header><div class="headrow"><span class="eyebrow">'+(internal?'내부 관리자료':'택지 안내서')+'</span><span class="date">'+escape(today)+'</span></div><h1>'+escape(model.title)+'</h1><div class="sub">'+escape(subtitle)+'</div></header>'+kpis+'<table class="data">'+details+'</table>'+(privateContent?'<div class="extra">'+privateContent+'</div>':'')+(location&&model.map?.x!=null&&model.map?.y!=null?'<p class="legend"><i></i>도면의 붉은 표시가 해당 필지입니다.</p>':'')+'<div class="spacer"></div><footer class="contact2"><div class="c2-head"><b>'+escape(company.name)+'</b><strong>T. '+escape(company.phone)+'</strong></div><div class="c2-grid">'+[['대표',company.rep],['팩스',company.fax],['주소',company.addr,1],['등록번호',company.reg],['사업자번호',company.biz],['이메일',company.email,1]].filter(x=>x[1]).map(x=>'<div'+(x[2]?' class="full"':'')+'><span>'+x[0]+'</span><em>'+escape(x[1])+'</em></div>').join('')+'</div></footer></div>'+location+'</main></body></html>';
  }
  let frame=null;
  function print(model){
    if(frame)frame.remove();
    return new Promise((resolve,reject)=>{
      const target=root.document.createElement('iframe');frame=target;
      target.title='필지 인쇄 자료';target.style.cssText='position:fixed;left:-10000px;top:0;width:281mm;height:194mm;border:0';
      target.onload=async()=>{
        try{
          const doc=target.contentDocument,win=target.contentWindow;
          const images=[...doc.images];
          const loaded=await Promise.allSettled(images.map(img=>img.decode()));
          loaded.forEach((result,index)=>{if(result.status==='rejected'){const text=doc.createElement('p');text.textContent=images[index].alt+' · 이미지를 불러오지 못했습니다.';images[index].replaceWith(text);}});
          if(doc.fonts)await doc.fonts.ready;
          // 고정된 인쇄 폭에서 실측한 뒤, 내용이 길 때만 축소합니다.
          doc.body.style.width='281mm';
          const pageHeight=193.5*96/25.4,contentHeight=doc.body.scrollHeight;
          if(contentHeight>pageHeight)doc.body.style.zoom=String(Math.floor(pageHeight/contentHeight*1000)/1000);
          win.addEventListener('afterprint',()=>{target.remove();if(frame===target)frame=null;},{once:true});
          win.focus();win.print();resolve();
        }catch(error){target.remove();if(frame===target)frame=null;reject(error);}
      };
      target.srcdoc=render(model);root.document.body.append(target);
    });
  }
  root.HitopParcelPrint={render,print};
})(typeof window==='undefined'?globalThis:window);
