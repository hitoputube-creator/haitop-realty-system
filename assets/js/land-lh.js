/* Official LH snapshots are separate from private office records. */
(function () {
  'use strict';
  let snapshot = null, pending = null;
  const $ = id => document.getElementById(id);
  const fieldNames = {bzdtNm:'사업지구명',bzdtSs:'진행상태',panSs:'공고상태',lctAraNm:'소재지',lno:'지번',jibun:'확정지번',iqyTlno:'LH 문의처',lnctCdNm:'지목',ar:'면적(㎡)',stlSplPpCdNm:'공급용도',stlPpAraCdNm:'용도지역',bukRt:'용적률(지도 표시값)',btlrRt:'건폐율(지도 표시값)',conCcwDt:'공사준공일',loldSplCmcmDt:'공급개시일',splOtstDt:'공급게시일',lndUsPsbDt:'토지사용가능일',splXpcAmt:'공급예정금액(원)',panDt:'공고게시일',clsgDt:'공고마감일',arExaDt:'면적확정일',arExaXpcDt:'면적확정예정일',cfmtLnoYn:'확정지번 여부',rtnLndYn:'토지리턴제 여부',trdMdtLndYn:'중개알선 대상 여부',stlPrStgyDsCdNm:'공급전략 구분',lgdnDtlAdr:'LH 등록 상세주소',panId:'공고번호',featureId:'지도 필지 식별번호',bzdtCd:'사업지구 코드',loldNo:'LH 필지 식별번호',lgdnCd:'법정동 코드',aisInfSn:'공급정보 식별번호',ccrCnntSysDsCd:'연계시스템 구분',panType:'공고유형 코드',aisTpCd:'공급유형 코드',uppAisTpCd:'상위공급유형 코드',btnYn:'신청버튼 표시 여부',cnpNm:'시도',aisTpCdNm:'자료 유형'};
  const node = (tag, text, className) => { const el=document.createElement(tag); if(text!=null)el.textContent=text; if(className)el.className=className; return el; };
  const value = v => v==null||v===''?'미기재':typeof v==='number'?v.toLocaleString('ko-KR'):String(v);
  const date = v => /^\d{8}$/.test(String(v))?String(v).replace(/(\d{4})(\d{2})(\d{2})/,'$1.$2.$3'):value(v);
  function list(blockId) { return snapshot?.records.filter(r=>r.blockId===blockId)||[]; }
  function find(blockId, row) { return list(blockId).find(r=>r.subblock===String(row.subblock)&&r.parcel===String(row.parcel))||null; }
  async function load() {
    if(!pending)pending=fetch('assets/data/lh-unjeong-detached.json?v=20261001-1').then(r=>{if(!r.ok)throw Error('LH 자료를 불러오지 못했습니다.');return r.json();}).then(data=>snapshot=data).catch(e=>{pending=null;throw e;});
    return pending;
  }
  function renderDetail(blockId,row) {
    const box=$('parcelLhDetail');box.replaceChildren();const record=find(blockId,row);
    box.append(node('h4','LH 공식정보'));
    if(!record){box.append(node('p','이번 LH 공고 목록에서 연결되지 않은 필지입니다. 공급상태는 미확인입니다.'));return;}
    const info=record.detail?.srchLadDetailInfo?.find(d=>String(d.loldNo)===String(record.list.loldNo))||{};
    box.append(node('p','자료 확인 '+record.checkedAt+' · 공고 '+record.noticeDate,'source-note'));
    const grid=node('dl',null,'lh-info-grid');
    const entries=[['공식 필지번호',record.officialNumber],['현재 소재지·지번',(info.lctAraNm||record.list.lgdnDtlAdr)+' '+record.list.lno],['LH 공급상태',record.supplyStatus+' · '+(info.bzdtSs||record.list.btnNm)],['면적',value(record.list.ar)+'㎡ / '+(record.list.ar/3.305785).toFixed(2)+'평'],['공급용도',record.list.lndUsDsCdNm],['공급예정금액',value(record.list.splXpcAmt)+'원'],['용도지역',value(info.stlPpAraCdNm)],['공고 건폐율·용적률',record.regulations.coverage+'% / '+record.regulations.floorRatio+'%'],['최고층수·허용가구수',record.regulations.floors+'층 / '+record.regulations.households+'가구'],['토지사용가능시기(공고)',record.regulations.landAvailable],['신청일시',date(record.list.acpStDttm?.slice(0,8))+' '+record.list.acpStDttm?.slice(8,10)+':'+record.list.acpStDttm?.slice(10,12)+' ~ '+date(record.list.acpEdDttm?.slice(0,8))+' '+record.list.acpEdDttm?.slice(8,10)+':'+record.list.acpEdDttm?.slice(10,12)],['LH 문의처',value(info.iqyTlno)]];
    for(const [label,v]of entries)grid.append(node('dt',label),node('dd',v));box.append(grid);
    const link=node('a','LH 공고·첨부자료 열기','btn');link.href=record.noticeUrl;link.target='_blank';link.rel='noopener noreferrer';box.append(link);
    const details=node('details');details.append(node('summary','LH 상세정보 전체 항목'));
    const all=node('dl',null,'lh-info-grid');
    for(const [key,v]of Object.entries(info))all.append(node('dt',fieldNames[key]||key),node('dd',/Dt$/.test(key)?date(v):value(v)));
    if(!Object.keys(info).length)all.append(node('dd','지도 상세정보 수집 결과가 없습니다. 공고 원문에서 확인해주세요.'));
    details.append(all);box.append(details);
    const raw=node('details');raw.append(node('summary','LH 공고 필지 전체 항목'));const rawGrid=node('dl',null,'lh-info-grid');for(const [key,v]of Object.entries(record.list))rawGrid.append(node('dt',fieldNames[key]||key),node('dd',value(v)));raw.append(rawGrid);box.append(raw);
    box.append(node('p','공고의 건축조건과 LH 지도 표시값은 출처를 구분해 보관합니다.','source-note'));
  }
  function renderMap(records,choose,panel) {
    const mapped=records.filter(r=>r.geometry);
    const links=node('p');
    for(const [label,href] of [['LH 전체 획지분할도','assets/documents/lh-unjeong3-parcel-plan-20260805.pdf'],['LH 토지 지도','https://apply.lh.or.kr/lhapply/land/main.do?mi=1040']]){
      const link=node('a',label,'btn');link.href=href;link.target='_blank';link.rel='noopener noreferrer';links.append(link,' ');
    }
    panel.append(links);
    if(!mapped.length)return;
    const namespace='http://www.w3.org/2000/svg',svg=document.createElementNS(namespace,'svg');
    const points=mapped.flatMap(r=>r.geometry.coordinates.flat(2));
    const project=p=>[p[0]*Math.cos(37.75*Math.PI/180),-p[1]];
    const xy=points.map(project),xs=xy.map(p=>p[0]),ys=xy.map(p=>p[1]);
    const left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left,height=Math.max(...ys)-top;
    const pad=Math.max(width,height)*.04,home=[left-pad,top-pad,width+2*pad,height+2*pad];let view=home.slice();
    const update=()=>svg.setAttribute('viewBox',view.join(' '));update();
    svg.setAttribute('role','group');svg.setAttribute('aria-label','LH 공식 경계로 표시한 공고중 필지 지도');
    svg.classList.add('lh-official-map');
    for(const record of mapped){
      const path=document.createElementNS(namespace,'path');
      path.setAttribute('d',record.geometry.coordinates.map(polygon=>polygon.map(ring=>'M'+ring.map(p=>project(p).join(',')).join('L')+'Z').join('')).join(''));
      path.dataset.subblock=record.subblock;path.dataset.parcel=record.parcel;path.setAttribute('fill-rule','evenodd');path.setAttribute('tabindex','0');path.setAttribute('role','button');path.setAttribute('aria-label',record.officialNumber+' LH 공고중');
      const title=document.createElementNS(namespace,'title');title.textContent=record.officialNumber+' · '+record.list.ar+'㎡';path.append(title);
      path.addEventListener('click',()=>choose(record));path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(record);}});svg.append(path);
    }
    const tools=node('div',null,'lh-map-tools');
    for(const [label,scale]of [['＋ 확대',.65],['－ 축소',1/.65],['전체 보기',0]]){
      const button=node('button',label,'btn');button.type='button';button.addEventListener('click',()=>{if(!scale)view=home.slice();else{const w=view[2]*scale,h=view[3]*scale;view=[view[0]+(view[2]-w)/2,view[1]+(view[3]-h)/2,w,h];}update();});tools.append(button);
    }
    let drag=null;
    svg.addEventListener('pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY,view:view.slice()};});
    svg.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)<6)return;const rect=svg.getBoundingClientRect(),unit=Math.max(drag.view[2]/rect.width,drag.view[3]/rect.height);view=[drag.view[0]-dx*unit,drag.view[1]-dy*unit,drag.view[2],drag.view[3]];update();if(!svg.hasPointerCapture(e.pointerId))svg.setPointerCapture(e.pointerId);});
    const stop=()=>{drag=null;};svg.addEventListener('pointerup',stop);svg.addEventListener('pointercancel',stop);
    panel.append(node('p','LH 공고 지도 · 주황색은 공고중 필지입니다. 확대 후 드래그로 이동할 수 있습니다. 계약완료·선착순 상태는 이번 수집 범위에 포함되지 않습니다.','source-note'),tools,svg);
  }
  function renderList(blockId, choose) {
    const panel=$('lhParcelSection');panel.replaceChildren();panel.hidden=false;
    const records=list(blockId).sort((a,b)=>a.officialNumber.localeCompare(b.officialNumber,'ko',{numeric:true}));
    panel.append(node('h3','LH 단독택지 공고 목록'),node('p','2026-10-01 확인 · 공식 번호로 연결 '+records.length+'필지. 목록에 없는 필지는 공급상태 미확인입니다.','source-note'));
    if(!records.length)return;
    renderMap(records,choose,panel);
    const scroll=node('div',null,'parcel-table-scroll'),table=node('table',null,'parcel-source-table'),head=node('thead'),tr=node('tr');
    for(const label of ['필지','현재 소재지·지번','면적 ㎡ / 평','공급예정금액','상태'])tr.append(node('th',label));head.append(tr);table.append(head);
    const body=node('tbody');
    for(const record of records){
      const row=node('tr'),cell=node('td'),button=node('button',record.officialNumber,'btn');button.type='button';button.addEventListener('click',()=>choose(record));cell.append(button);row.append(cell,node('td',record.list.lgdnDtlAdr+' '+record.list.lno),node('td',value(record.list.ar)+'㎡ / '+(record.list.ar/3.305785).toFixed(2)+'평'),node('td',value(record.list.splXpcAmt)+'원'),node('td',record.supplyStatus));body.append(row);
    }
    table.append(body);scroll.append(table);panel.append(scroll);
  }
  function setMapViews(blockId,rows,views) {
    for(const path of document.querySelectorAll('.lh-official-map path')) {
      const record=rows.find(r=>String(r.subblock)===path.dataset.subblock&&String(r.parcel)===path.dataset.parcel);
      path.classList.toggle('lh-has-building',!!(views.building&&record?.data?.building==='building'));
      path.classList.toggle('lh-has-contact',!!(views.contact&&String(record?.data?.contact||'').replace(/\D/g,'').length>=7));
    }
  }
  window.HitopLandLh={load,list,find,renderDetail,renderList,setMapViews};
})();
