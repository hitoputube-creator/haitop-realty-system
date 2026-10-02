(function(root){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const won=value=>value==null||value===''?'':Number.isFinite(Number(value))?Math.round(Number(value)).toLocaleString('ko-KR')+'원':'';
  const area=value=>Number(value)>0?Number(value).toLocaleString('ko-KR',{maximumFractionDigits:2})+'㎡ / '+(Number(value)/3.305785).toLocaleString('ko-KR',{maximumFractionDigits:2})+'평':'';
  function render(model){
    const internal=model.mode==='internal';
    const row=(label,value)=>value===null||value===undefined||value===''?'':'<tr><th>'+escape(label)+'</th><td>'+escape(value)+'</td></tr>';
    const section=(title,body)=>'<section><h2>'+escape(title)+'</h2><table>'+body+'</table></section>';
    const basic=row('필지번호',model.title)+row('소재지·지번',model.address||'미입력')+row('택지 유형',model.landType)+row('토지면적',area(model.area));
    let prices='';
    for(const [key,label] of [['supplyPrice','공급금액'],['auctionPrice','낙찰가격'],['salePrice',model.building?.exists?'토지+건물 매매금액':'매매금액']]){
      const value=model.prices?.[key],formatted=won(value);
      if(formatted)prices+=row(label,formatted+(Number(model.area)>0?' · 평당 '+won(Number(value)/(Number(model.area)/3.305785)):''));
    }
    const b=model.building||{};
    const building=row('건물 유무',b.exists?'건물 있음':b.confirmedVacant?'건물 없음':'확인 자료 없음')+(b.exists?row('건물명',b.name)+row('주용도',b.purpose)+row('지상·지하 층수',b.floors)+row('구조',b.structure)+row('사용승인일',b.approval)+row('건축면적',area(b.footprint))+row('연면적',area(b.totalArea))+row('보증금 합계',won(b.deposit))+row('월세 합계',won(b.rent)):'');
    let privateContent='';
    if(internal)privateContent=section('내부 관리자료',row('소유주',model.owner||'미입력')+row('연락처',model.contact||'미입력')+(model.includeMemo?row('비고',model.note):''));
    else if(model.includeMemo&&model.note)privateContent=section('메모',row('비고',model.note));
    if(model.includeMemo||model.includePhotos){
      privateContent+='<section class="records"><h2>날짜별 기록</h2>';
      for(const note of model.notes||[]){
        if(!(model.includeMemo&&note.body)&&!(model.includePhotos&&note.photos?.length))continue;
        const day=note.note_date||new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(note.created_at));
        privateContent+='<article><h3>'+escape(day)+'</h3>'+(model.includeMemo&&note.body?'<p class="memo">'+escape(note.body)+'</p>':'');
        if(model.includePhotos&&note.photos?.length)privateContent+='<div class="photos">'+note.photos.map(photo=>'<figure>'+(/^https?:\/\//.test(photo.printUrl||'')?'<img src="'+escape(photo.printUrl)+'" alt="'+escape(photo.name||'필지 사진')+'">':'<p>사진을 불러오지 못했습니다.</p>')+'<figcaption>'+escape(photo.name||'필지 사진')+'</figcaption></figure>').join('')+'</div>';
        privateContent+='</article>';
      }
      if(!model.notes?.length)privateContent+='<p>저장된 메모·사진 기록이 없습니다.</p>';
      privateContent+='</section>';
    }
    let location='';
    if(model.includeLocation){
      const map=model.map;
      location='<section><h2>택지 위치 · '+escape(model.title)+'</h2>';
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
        const width=Math.min(165,100*(Number(map.width)||100)/(Number(map.height)||100));
        location+='<div class="location-map" style="position:relative;width:'+width+'mm;max-width:100%;margin:auto"><img style="display:block;width:100%;height:auto" src="'+escape(map.src)+'" alt="'+escape(model.title)+' 택지 위치도"><svg style="position:absolute;inset:0;width:100%;height:100%" viewBox="'+[vb.x,vb.y,vb.width,vb.height].join(' ')+'" preserveAspectRatio="none">'+marker+'</svg></div><p class="source">'+(positioned?'매물위치: '+escape(model.title)+' · 빨간색 테두리와 위치 표시는 해당 필지입니다.':'필지의 정확한 표시 위치는 아직 등록되지 않았습니다.')+'</p>';
      }else location+='<p>연결된 택지 도면이 없습니다.</p>';
      location+='</section>';
    }
    const today=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>'+escape(model.title)+' '+(internal?'내부 관리자료':'고객 브리핑')+'</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#142233;background:#fff;font-family:"Malgun Gothic",Arial,sans-serif;font-size:10pt;line-height:1.5}header{border-bottom:2px solid #142233;padding-bottom:12px;margin-bottom:18px}.brand{font-size:12pt;font-weight:700;color:#715b21}.heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px}h1{font-size:25pt;line-height:1.2;margin:10px 0}header p{margin:4px 0;font-size:9pt;color:#536172}.tag{border:1px solid #536172;border-radius:4px;padding:3px 8px;font-size:10pt;white-space:nowrap}h2{font-size:12pt;margin:14px 0 6px;padding:4px 0;border-bottom:1px solid #adb5bd}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border-bottom:1px solid #dce1e7;padding:7px 9px;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}th{width:32%;font-weight:500;background:#f1f3f5}tr{break-inside:avoid}h2,h3{break-after:avoid}h3{font-size:10pt;margin:12px 0 4px}.memo{white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0 10px}.photos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}figure{margin:0;break-inside:avoid}figure img{width:100%;height:45mm;object-fit:contain;border:1px solid #dce1e7}figcaption{font-size:8pt;color:#536172;overflow-wrap:anywhere}.source,footer{font-size:8pt;color:#536172;white-space:pre-wrap;overflow-wrap:anywhere}.source{margin-top:16px;padding:10px;border:1px solid #dce1e7}footer{margin-top:20px;border-top:1px solid #adb5bd;padding-top:8px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><header><div class="brand">하이탑부동산</div><div class="heading"><h1>'+escape(model.title)+'</h1><span class="tag">'+(internal?'내부용':'고객 브리핑용')+'</span></div><p>필지별 자료 · 작성일 '+escape(today)+'</p></header>'+section('필지 기본정보',basic)+(prices?section('금액 정보',prices):'')+section('건물 정보',building)+(model.sourceText?'<p class="source">참고 공급자료\n'+escape(model.sourceText)+'</p>':'')+privateContent+location+'<footer>'+(internal?'내부 업무자료 · 소유주·연락처 포함':'하이탑부동산 · 고객 브리핑 자료')+'</footer></body></html>';
  }
  let frame=null;
  function print(model){
    if(frame)frame.remove();
    return new Promise((resolve,reject)=>{
      const target=root.document.createElement('iframe');frame=target;
      target.title='필지 인쇄 자료';target.style.cssText='position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0';
      target.onload=async()=>{
        try{
          const doc=target.contentDocument,win=target.contentWindow;
          const images=[...doc.images];
          const loaded=await Promise.allSettled(images.map(img=>img.decode()));
          loaded.forEach((result,index)=>{if(result.status==='rejected'){const text=doc.createElement('p');text.textContent=images[index].alt+' · 이미지를 불러오지 못했습니다.';images[index].replaceWith(text);}});
          if(doc.fonts)await doc.fonts.ready;
          win.addEventListener('afterprint',()=>{target.remove();if(frame===target)frame=null;},{once:true});
          win.focus();win.print();resolve();
        }catch(error){target.remove();if(frame===target)frame=null;reject(error);}
      };
      target.srcdoc=render(model);root.document.body.append(target);
    });
  }
  root.HitopParcelPrint={render,print};
})(typeof window==='undefined'?globalThis:window);
