/* 유형별 매물 열: 원본 데이터와 공통 관리 버튼을 그대로 사용한다. */
(function () {
  'use strict';
  const common = [['deal','구분'],['price','가격'],['owner','소유주'],['phone','연락처']];
  const schemas = {
    '': [['type','매물유형'],['name','매물명'],...common],
    '상가사무실': [['building','건물명'],['address','소재지'],['exclusive','전용면적'],...common],
    '토지': [['address','소재지'],['parcel','블럭/필지'],['landArea','토지면적'],['unitPrice','평당가'],...common],
    '주거용': [['village','마을'],['apartment','단지명'],['dong','동·호수'],['supply','분양평형/타입'],...common],
    '공장창고': [['address','소재지'],['landArea','대지면적'],['buildingArea','건축면적'],['totalArea','연면적'],...common],
    '건물빌딩': [['building','건물명'],['address','소재지'],['landArea','대지면적'],['totalArea','연면적'],['floors','층수'],...common]
  };
  const first = (...values) => values.find(v => v !== undefined && v !== null && String(v).trim() !== '') ?? '';
  const num = v => Number(String(v ?? '').replace(/[^0-9.-]/g,'')) || 0;
  const area = (py,m2) => first(py) !== '' ? String(py)+'평' : first(m2) !== '' ? String(m2)+'㎡' : '';
  const isKtopResidential = () => document.documentElement.dataset.officeTheme === 'ktop' && currentMajor === '주거용';
  const shortArea = value => {
    const text=String(value).trim().replace(/,/g,'');
    const match=text.match(/^(-?\d+)(?:\.(\d+))?/);
    return match ? match[1]+(match[2] ? '.'+match[2].slice(0,2) : '') : text;
  };
  const won = v => num(v) ? num(v).toLocaleString('ko-KR')+'원' : '';
  const man = v => num(v) ? num(v).toLocaleString('ko-KR')+'만원' : (String(v ?? '').trim() || '');

  // 분양권·입주예정은 이름이 아니라 유형/별도 안내로 표시한다. 원본 저장값은 변경하지 않는다.
  const apartmentData = item => item.apartmentUnitData || item.import_unit_snapshot || {};
  const isApartment = item => item.type === 'apartment' || !!apartmentData(item).아파트명;
  const isApartmentPresale = item => {
    if (!isApartment(item)) return false;
    const u=apartmentData(item);
    if (u.권리구분) return u.권리구분 === '분양권';
    if (u.매매유형) return u.매매유형 === '분양권전매';
    return /(?:^|[·\s])분양권(?:$|[·\s])/.test(String(item.title || ''));
  };
  const cleanApartmentName = value => String(value || '')
    .replace(/[（(]\s*(?:입주\s*)?\d{4}\s*년\s*\d{1,2}\s*월\s*(?:입주\s*)?예정\s*[)）]/g,'')
    .replace(/\s*·\s*분양권(?:\s*·\s*|\s*$)/g,' ')
    .replace(/\s+/g,' ').trim();
  function apartmentDisplayName(item,fallback) {
    if (!isApartment(item)) return fallback;
    const u=apartmentData(item);
    const complex=cleanApartmentName(u.아파트명 || item.complexName || item.buildingName).replace(/아파트$/,'');
    const dong=String(u.동 || item.apartmentDong || item.dong || '').replace(/동$/,'');
    const room=String(u.호 || item.apartmentHo || item.ho || '').replace(/호$/,'');
    return complex && dong && room ? complex+'\n'+dong+'동 '+room+'호' : cleanApartmentName(fallback);
  }
  function apartmentMoveInText(item) {
    if (!isApartmentPresale(item)) return '';
    const u=apartmentData(item);
    const explicit=String(u.입주예정월 || item.moveInMonth || '').trim();
    const raw=explicit || [u.아파트명,item.complexName,item.buildingName,item.title].filter(Boolean).join(' ');
    const match=raw.match(/(\d{4})\s*(?:년|[-./])\s*(\d{1,2})(?:\s*월)?/);
    if (!match || Number(match[2])<1 || Number(match[2])>12) return '';
    return '입주예정 '+match[1]+'년 '+Number(match[2])+'월';
  }
  const originalListingName=getListingName; // 제목 대신 건물명+호수로 표시하도록 아래에서 재정의
  getListingName=item=>fields(item).name || originalListingName(item);

  function fields(item) {
    const u=item.apartmentUnitData || {};
    const supplyPy=first(item.areaSupplyPy,item.supplyAreaPy,item.saleAreaPy,u.분양평수,u.평형);
    const supplyM2=first(item.areaSupplyM2,item.supplyAreaM2);
    const supplySize=isKtopResidential()
      ? (supplyPy !== '' ? shortArea(supplyPy)+'평' : supplyM2 !== '' ? shortArea(supplyM2)+'㎡' : '')
      : area(supplyPy,supplyM2);
    const landPy=first(item.landAreaPy,item.land_area_py,item.land_py,item.areaPy);
    const landM2=first(item.landAreaM2,item.land_area_sqm,item.areaM2);
    const sale=first(item.salePrice, num(first(item.land_price,item.factory_price,item.biz_price))*10000);
    const address=first(item.roadAddress,item.jibunAddress,item.address,item.publicAddress,item.mapAddress,item.quick_location);
    const rawUnit=String(first(item.privateDetailAddress,item.detailAddress,item.detail_address,item.roomNumber,item.shop_room,item.unitNumber,item.ho)).trim();
    const unitMatch=rawUnit.match(/(?:[A-Za-z]\s*)?\d{1,5}\s*호/i) || rawUnit.match(/^\s*(?:[A-Za-z]-?\s*)?\d{1,5}\s*$/) || String(address).match(/(?:[A-Za-z]\s*)?\d{1,5}\s*호(?=\s|$|[,，])/i);
    const unitText=(/\d{1,5}\s*호/.test(rawUnit) && /[+,，]/.test(rawUnit)) ? rawUnit.replace(/\s+/g,'') : (unitMatch ? unitMatch[0].replace(/\s+/g,'') : '');
    const unit=unitText && /호/.test(unitText) ? unitText : unitText ? unitText+'호' : '';
    const addressBuilding=unit ? ((String(address).match(/,\s*([^,\d][^,]*?)\s*\d{1,5}\s*호(?=\s|$|[,，])/i)||[])[1] || '').trim() : '';
    const addressDisplay=addressBuilding ? String(address).replace(/[,，]\s*[^,，]+$/,'').trim() : String(address).replace(/[,，]?\s*(?:[A-Za-z]\s*)?\d{1,5}\s*호(?=\s*$)/i,'').trim();
    return {
      presaleStatus:window.CommercialPriceCore?.commercial(item)?CommercialPriceCore.status(item):'',
      name:(()=>{
        const complexName=u.아파트명 || item.complexName || item.buildingName || '';
        const village=(complexName.match(/^(.*?마을\s*\d+단지)/)||[])[1]||'';
        const dong=u.동||item.apartmentDong||item.dong||'';
        const room=u.호||item.apartmentHo||item.ho||'';
        // 매물명은 제목이 아니라 항상 건물명 + 호수(없으면 소재지)로 표시한다.
        let bName=String(first(item.buildingName,item.building_name,item.complexName,item.complex_name,item.shop_building,item.biz_building,addressBuilding)).trim();
        // 건물명이 비어 있고 주소가 "105동 2404호"처럼 동·호수뿐인 옛 매물은 제목 앞쪽(건물명 · 동호수)에서 건물명만 가져온다.
        if (!bName && /^\s*(?:\d{1,4}\s*동)?\s*(?:[A-Za-z]-?)?\d{1,5}\s*호\s*$/.test(String(address))) {
          const seg=String(item.title || '').split('·').map(v=>v.trim());
          if (seg.length>1 && !/^(?:상가|오피스텔|기타|토지|사무실|아파트|공장|창고|주택|빌딩|건물)$/.test(seg[0]) && !/\d\s*호$/.test(seg[0])) bName=seg[0];
        }
        let unitFull='';
        for (const cand of [item.privateDetailAddress,item.detailAddress,item.detail_address,item.roomNumber,item.shop_room,item.unitNumber,item.ho,/^\s*\d{1,4}\s*동\s*\d{1,5}\s*호\s*$/.test(String(address)) ? address : '']) {
          const t=String(cand ?? '').trim();
          if (!t) continue;
          const m=t.match(/(?:\d{1,4}\s*동\s*)?(?:[A-Za-z]-?\s*)?\d{1,5}\s*호/i);
          if (m) { unitFull=m[0].replace(/\s*동\s*/,'동 ').replace(/\s+/g,' ').replace(/([A-Za-z]-?)\s+/,'$1'); break; }
          if (/^(?:[A-Za-z]-?\s*)?\d{1,5}$/.test(t)) { unitFull=t.replace(/\s+/g,'')+'호'; break; }
        }
        if (!unitFull) unitFull=unit;
        const place=String(addressDisplay || address || '').trim();
        const fallbackName=bName
          ? (unitFull && !bName.replace(/\s+/g,'').endsWith(unitFull.replace(/\s+/g,'')) ? bName+'\n'+unitFull : bName)
          : (place ? (unitFull && !place.replace(/\s+/g,'').includes(unitFull.replace(/\s+/g,'')) ? place+'\n'+unitFull : place) : String(item.title || '').trim());
        return village && dong && room ? [village,dong+'동 '+room+'호'].join('\n') : apartmentDisplayName(item,fallbackName);
      })(),
      building:first(item.buildingName,item.building_name,item.complexName,item.shop_building,item.biz_building,addressBuilding),
      unit,
      address:addressDisplay,
      floorRoom:[first(item.floor,item.floorInfo,item.shop_floor),first(item.roomNumber,item.shop_room,item.unitNumber,item.ho)].filter(v=>v !== '').join(' / '),
      exclusive:area(first(item.areaExclusivePy,item.exclusiveAreaPy,item.shop_area_py,item.areaPy),first(item.areaExclusiveM2,item.exclusiveAreaM2,item.shop_area_sqm,item.areaM2)),
      maintenance:first(man(item.maintenanceFeeManwon),won(item.maintenanceFee),man(item.shop_maintenance)),
      premium:first(won(item.premium),won(item.keyMoney),man(item.premiumManwon),man(item.shop_premium)),
      parcel:first(item.blockLotLabel,item.parcelNumber,item.land_block,item.blockNumber,item.land_lot),
      landArea:area(landPy,landM2),
      landUse:first(item.landCategory,item.landUse,item.jimok,item.land_jimok),
      zoning:first(item.zoning,item.landUseZone,item.useDistrict,item.land_zoning),
      unitPrice:num(sale) && (num(landPy) || num(landM2)) ? man(Math.round(num(sale)/10000/(num(landPy) || num(landM2)/3.305785))) : '',
      buildingArea:area(first(item.buildingAreaPy,item.factory_buildArea_py),first(item.buildingAreaM2,item.factory_buildArea_sqm)),
      totalArea:area(first(item.totalFloorAreaPy,item.factory_totalArea_py,item.grossFloorAreaPy),first(item.totalFloorAreaM2,item.factory_totalArea_sqm,item.grossFloorAreaM2)),
      height:first(item.ceilingHeight,item.floorHeight,item.height,item.factory_height),
      floors:first(item.totalFloors,item.floorInfo,item.floor),
      supply:[supplySize,first(item.apartmentType,item.unitType,item.areaType,u.타입)].filter(Boolean).join(' / ')
    };
  }
  function columns() {
    const cols=(schemas[currentMajor] || schemas['']).filter(([key])=>key!=='deal');
    if (!cols.some(([key])=>key==='type')) cols.unshift(['type','매물유형']);
    // 주거용은 마을·단지명을 한 칸(마을 윗줄, 단지명 아랫줄)에 합쳐서 보여준다.
    return currentMajor==='주거용' ? cols.filter(([key])=>key!=='village') : cols;
  }
  function shortType(item) {
    if (isApartmentPresale(item)) return '아파트 분양권';
    const parts=String(originalValue(item,'type') || '').split(/\s*\/\s*/);
    return parts[parts.length-1].replace(/\s*[·-]?\s*확인 필요/g,'').trim() || parts[0] || '-';
  }
  const originalValue=listingColumnValue;
  listingColumnValue=function(item,key) {
    if (key==='type') return shortType(item);
    if (key==='apartment' && isApartment(item)) return cleanApartmentName(originalValue(item,key));
    const value=fields(item)[key];
    return value === undefined ? originalValue(item,key) : value;
  };
  Object.values(schemas).flat().forEach(([key,label])=>{
    if (!LISTING_FILTER_COLUMNS[key]) LISTING_FILTER_COLUMNS[key]={label,mode:'values'};
  });
  const originalCard=makeCard;
  const preserved=new Set(['type','deal','village','apartment','dong','room','price','owner','phone']);
  function cell(item,key,label,original) {
    let node=preserved.has(key) ? original.querySelector('.listing-cell-'+key) : null;
    if (!node) {
      node=document.createElement('div');
      node.className='listing-cell listing-cell-'+key;
      node.textContent=String(listingColumnValue(item,key) || '-');
      if (key==='height' && num(node.textContent) && !/[a-z가-힣]/i.test(node.textContent)) node.textContent+='m';
    }
    if (key==='type') {
      const badge=node.querySelector('.lc-type');
      if(badge) badge.textContent=shortType(item);
      const deal=original.querySelector('.listing-cell-deal .lc-deal-badge');
      const rosterBadge=node.querySelector('.lc-roster-badge');
      if(deal || rosterBadge) {
        // 유형·거래구분·명단 배지를 첫 줄에 모으고, 진행상태·확인일은 둘째 줄에 둔다.
        const line=document.createElement('div');line.className='lc-type-deal';
        if(badge) line.appendChild(badge);
        if(deal) line.appendChild(deal);
        if(rosterBadge) line.appendChild(rosterBadge);
        node.prepend(line);
      }
    }
    if (key==='type') {
      const moveIn=apartmentMoveInText(item);
      if (moveIn) {
        const info=document.createElement('small');info.className='lc-move-in';info.textContent=moveIn;node.appendChild(info);
      }
    }
    if (key==='apartment' && isApartment(item)) node.textContent=String(listingColumnValue(item,key) || '-');
    if (key==='dong' && currentMajor==='주거용') {
      const dv=String(listingColumnValue(item,'dong') || '').replace(/동$/,'').trim();
      const rv=String(listingColumnValue(item,'room') || '').replace(/호$/,'').trim();
      const lines=[];
      if (dv && dv!=='-') lines.push([dv+'동','lc-dh-dong']);
      if (rv && rv!=='-') lines.push([rv+'호','lc-dh-ho']);
      node.replaceChildren(...(lines.length ? lines : [['-','']]).map(([text,cls])=>{const line=document.createElement('span');line.className=('lc-dh-line '+cls).trim();line.textContent=text;return line;}));
    }
    if (key==='name') {
      const raw=String(listingColumnValue(item,key) || '-');
      const parts=[];
      raw.split('\n').forEach(text=>{
        const m=text.trim().match(/^(.*?)\s*((?:\d+\s*동\s*)?B?\d+\s*호)\s*$/);
        if (m) { if (m[1]) parts.push([m[1],false]); parts.push([m[2],true]); }
        else parts.push([text,false]);
      });
      if (parts.some(p=>p[1]) || raw.includes('\n')) {
        const no=node.querySelector('.lc-no');
        node.replaceChildren(...parts.map(([text,isUnit])=>{
          const line=document.createElement('span');line.className=isUnit?'lc-name-line lc-unit-line':'lc-name-line';line.textContent=text;return line;
        }));
        if (no) node.appendChild(no);
      }
    }
    if (key==='building') {
      const unit=fields(item).unit;
      if (unit && node.textContent.trim() !== '-') {
        const sub=document.createElement('span');sub.className='lc-building-unit';sub.textContent=unit;
        sub.style.display='block';sub.style.marginTop='4px';sub.style.padding='0';sub.style.border='none';sub.style.background='transparent';sub.style.fontSize='14px';sub.style.fontWeight='800';sub.style.lineHeight='1.35';sub.style.color='#25675f';
        node.appendChild(sub);
      }
    }
    if (key==='owner') {
      const name=String(listingColumnValue(item,key) || '').trim();
      const parts=name.match(/^(.+?)\s*(\([^()]+\))$/);
      if (parts) {
        const main=document.createElement('span');main.className='lc-owner-main';main.textContent=parts[1];
        const sub=document.createElement('span');sub.className='lc-owner-sub';sub.textContent=parts[2];
        node.replaceChildren(main,sub);
      }
    }
    if (key==='apartment' && isKtopResidential()) {
      const name=Array.from(node.childNodes).filter(child=>child.nodeType===Node.TEXT_NODE).map(child=>child.textContent).join('').trim();
      const parts=name.match(/^(.+?)\s*(\([^()]+\))$/);
      if (parts) {
        const no=node.querySelector('.lc-no');
        const main=document.createElement('span');main.className='lc-apartment-main';main.textContent=parts[1];
        const sub=document.createElement('span');sub.className='lc-apartment-sub';sub.textContent=parts[2];
        node.replaceChildren(main,sub,...(no ? [no] : []));
      }
    }
    if (key==='supply' && isKtopResidential()) {
      const [size,...typeParts]=String(listingColumnValue(item,key) || '').split(' / ');
      const sizeLine=document.createElement('span');sizeLine.className='lc-supply-size';sizeLine.textContent=size || '-';
      const typeLine=document.createElement('span');typeLine.className='lc-supply-type';typeLine.textContent=typeParts.join(' / ') || '-';
      node.replaceChildren(sizeLine,typeLine);
    }
    if (key==='price') {
      const price=node.querySelector('.lc-price-text');
      if(price) {
        const rawPrice=price.textContent.trim();
        if (rawPrice && rawPrice !== '-') node.classList.add('has-price');
        let lines=rawPrice.split(/\s*\/\s*(?=월세)|\n/);
        // 전세: 윗줄에 "보증금", 아랫줄에 금액
        if (lines.length===1 && getTransactionType(item)==='전세' && rawPrice !== '-' && !/월세|매매/.test(rawPrice)) {
          const amount=rawPrice.replace(/^(?:보증금|전세)\s*/,'').trim();
          if (amount) lines=['보증금',amount];
        }
        if (lines.length>1) price.classList.add('lc-price-multi');
        price.replaceChildren(...lines.map(text=>{
          const line=document.createElement('span');line.className='lc-price-line';line.textContent=text;return line;
        }));
      }
    }
    if (key==='apartment' && currentMajor==='주거용') {
      // 마을은 윗줄, 단지명은 아랫줄
      const vsrc=original.querySelector('.listing-cell-village');
      const vtext=vsrc ? vsrc.textContent.trim() : '';
      if (vtext && vtext!=='-') {
        const top=document.createElement('span');top.className='lc-village-top';
        top.append(...Array.from(vsrc.childNodes));
        node.prepend(top);
      }
    }
    node.querySelectorAll('.lc-no').forEach(no=>no.remove());
    node.dataset.label=label;
    node.style.gridArea='auto';
    return node;
  }
  makeCard=function(item,options) {
    const card=originalCard(item,options);
    const select=card.querySelector('.listing-cell-select');
    const actions=card.querySelector('.listing-cell-actions');
    const cols=columns();
    const nodes=cols.map(([key,label])=>cell(item,key,label,card));
    if (select) select.style.gridArea='auto';
    if (actions) actions.style.gridArea='auto';
    card.replaceChildren(select,...nodes,actions);
    card.classList.add('typed-property-row');
    const moveInInfo=card.querySelector('.listing-cell-type .lc-move-in');
    const moveInHost=card.querySelector('.listing-cell-apartment,.listing-cell-name,.listing-cell-building,.listing-cell-address');
    if (moveInInfo && moveInHost) { moveInInfo.classList.add('lc-move-in-top'); moveInHost.prepend(moveInInfo); }
    if (isKtopResidential()) card.classList.add('residential-property-row');
    if (item.profitRecommendation || window.CommercialPriceCore?.recommendation(item)) {
      card.classList.add('profit-recommended-row');
      const target=card.querySelector('.listing-cell-building,.listing-cell-name,.listing-cell-address');
      if(target){const badge=document.createElement('small');badge.className='profit-recommended-badge';badge.textContent='수익성 추천';target.appendChild(badge);}
    }
    card.style.setProperty('--typed-columns',template(cols));
    return card;
  };
  function actionsColWidth(table) {
    return 148;
  }
  function template(cols) {
    if (isKtopResidential()) {
      const widths={apartment:'1.6fr',dong:'.75fr',supply:'.65fr',price:'minmax(150px,1.25fr)',owner:'.65fr',phone:'1fr'};
      return 'var(--listing-highlight-select-width,24px) '+cols.map(([key])=>key==='type'?'minmax(140px,.8fr)':`${/^minmax/.test(widths[key] || '') ? widths[key] : 'minmax(0,'+(widths[key] || '.8fr')+')'}`).join(' ')+' 166px';
    }
    return 'var(--listing-highlight-select-width,24px) '+cols.map(([key])=>key==='address'?'minmax(0,1.1fr)':['name','building','apartment'].includes(key)?'minmax(0,1.5fr)':key==='type'?'minmax(118px,.65fr)':key==='price'?'minmax(150px,1.5fr)':key==='phone'?'minmax(100px,.9fr)':key==='owner'?'minmax(0,.75fr)':'minmax(54px,.6fr)').join(' ')+' '+actionsColWidth(false)+'px';
  }
  window.sortDongRoom=function() {
    const first=listingColumnSort.find(s=>s.key==='dong');
    const dir=first && listingColumnSort.length===2 ? -first.direction : 1;
    listingColumnSort=[{key:'dong',direction:dir},{key:'room',direction:dir}];
    currentPage=1; renderList();
  };
  makeListingColumnHeader=function() {
    const h=document.createElement('div');h.className='listing-column-header typed-property-row';
    if (isKtopResidential()) h.classList.add('residential-property-row');
    h.style.setProperty('--typed-columns',template(columns()));
    const sort=(key,label)=>'<button type="button" class="listing-sort-btn" onclick="'+(key==='dong' && currentMajor==='주거용' ? 'sortDongRoom()' : 'sortListingColumn(\''+key+'\')')+'" aria-label="'+label+' 정렬">'+(key==='supply' && isKtopResidential() ? '분양평형<br>타입' : label)+' '+listingSortMark(key)+'</button>';
    const filter=(key,label)=>'<button type="button" class="listing-filter-btn'+(listingColumnFilters[key]?' active':'')+'" onclick="openColumnFilter(\''+key+'\',this,event)" aria-label="'+label+' 필터">▾</button>';
    h.innerHTML='<div>선택</div>'+columns().map(([key,label])=>'<div>'+(key==='apartment' && currentMajor==='주거용' ? '<span class="lc-vh-line">'+sort('village','마을')+filter('village','마을')+'</span><span class="lc-vh-line">'+sort(key,label)+filter(key,label)+'</span>' : sort(key,label)+filter(key,label))+(key==='type'?'<span class="lc-deal-filter">'+sort('deal','구분')+filter('deal','구분')+'</span>':'')+'</div>').join('')+'<div>'+(columnFilterCount()?'<button type="button" class="listing-filter-reset" onclick="clearColumnFilters()">필터 해제</button>':'관리')+'</div>';
    return h;
  };
  renderListView=function(items) {
    _currentListItems=items;
    const cols=columns();
    const wrap=document.createElement('div');wrap.className='typed-list-table-wrap';
    const table=document.createElement('table');table.className='typed-list-table';
    if (isKtopResidential()) table.classList.add('residential-property-table');
    const header=makeListingColumnHeader();
    table.innerHTML='<colgroup><col style="width:var(--listing-highlight-select-width,32px)">'+cols.map(([key])=>'<col'+(key==='type'?' style="width:112px"':key==='price'?' style="width:138px"':key==='phone'?' style="width:172px"':'')+'>').join('')+'<col style="width:'+actionsColWidth(true)+'px"></colgroup><thead><tr><th>선택</th>'+Array.from(header.children).slice(1,-1).map(n=>'<th>'+n.innerHTML+'</th>').join('')+'<th>관리</th></tr></thead><tbody></tbody>';
    const body=table.querySelector('tbody');
    items.forEach(item=>{
      const card=makeCard(item);
      const tr=document.createElement('tr');tr.className=getStatusClass(item)+(item.profitRecommendation || window.CommercialPriceCore?.recommendation(item)?' profit-recommended-row':'');
      tr.addEventListener('click',card.onclick);
      Array.from(card.children).forEach(n=>{const td=document.createElement('td');td.appendChild(n);tr.appendChild(td);});
      body.appendChild(tr);
    });
    wrap.appendChild(table);listingContainer.replaceChildren(wrap);
  };
  const originalFiltered=getFilteredListings;
  getFilteredListings=function() {
    if (viewMode !== 'list' || !columnFilterCount()) return originalFiltered();
    return sortListingsForDisplay(getBaseFilteredListings().filter(item=>matchesColumnFilters(item)));
  };
  const originalRender=renderList;
  renderList=function() {
    const visible=new Set([...columns().map(([key])=>key),'deal','room',...(currentMajor==='주거용'?['village']:[])]);
    Object.keys(listingColumnFilters).forEach(key=>{if(!visible.has(key))delete listingColumnFilters[key];});
    listingColumnSort=listingColumnSort.filter(s=>visible.has(s.key));
    closeColumnFilterPopover();
    originalRender();
  };
  const style=document.createElement('style');
  style.textContent=`
    .properties-page #listingContainer {overflow-x:auto;}
    html body.properties-page .listing-column-header.typed-property-row,
    html body.properties-page .listing-card.typed-property-row {display:grid;grid-template-columns:var(--typed-columns);grid-template-areas:none;min-width:0;width:100%;box-sizing:border-box;gap:6px;}
    .properties-page .typed-property-row .listing-cell {min-width:0;font-size:13px;overflow-wrap:anywhere;}
    .properties-page .typed-property-row .lc-no {display:block;font-size:11px;color:var(--text-muted);}
    .typed-list-table-wrap {overflow:auto;}
    html body.properties-page .listing-card.profit-recommended-row,.typed-list-table .profit-recommended-row td{background:rgba(37,103,95,0.1)!important;}
    .typed-list-table .profit-recommended-row td:first-child{box-shadow:inset 3px 0 rgba(37,103,95,0.08);}
    .profit-recommended-badge{display:block;color:var(--gold);font-size:11px;margin-top:5px;font-weight:700;}
    .typed-list-table {width:100%;min-width:0;table-layout:fixed;border-collapse:collapse;font-size:13px;}
    .typed-list-table th,.typed-list-table td {padding:12px 8px;border-bottom:1px solid var(--border-slate);text-align:left;}
    .typed-list-table th {white-space:nowrap;color:var(--gold);}
    .typed-list-table td .listing-cell::before {display:none!important;}

    .properties-page .lc-name-line {display:block;}
    .properties-page .lc-move-in {display:block;margin-top:5px;font-size:11px;line-height:1.4;color:var(--text-muted);font-weight:400;}
    .properties-page .lc-move-in.lc-move-in-top {margin:0 0 4px;font-size:12px;font-weight:700;color:#b45309;white-space:nowrap;}
    .properties-page .lc-dh-line {display:block;line-height:1.35;white-space:nowrap;}
    html body.properties-page .typed-property-row .listing-cell-dong::after {content:none!important;}
    .properties-page .lc-unit-line {display:block;margin-top:3px;font-size:15px;font-weight:800;line-height:1.35;color:#1d4ed8;}
    html body.properties-page .typed-property-row .listing-cell-dong,html body.properties-page .typed-property-row .listing-cell-room {font-size:14.5px!important;font-weight:800!important;color:#1d4ed8!important;}
    html body.properties-page .typed-property-row .listing-cell-dong .lc-dh-ho {color:#c2410c!important;}
    @media(min-width:801px){
      html[data-office-theme="ktop"] .properties-page .listing-row-card.typed-property-row{min-height:0;padding:5px 10px}
      html[data-office-theme="ktop"] .properties-page .typed-property-row .listing-cell-type{flex-direction:row;flex-wrap:wrap;align-items:center;align-content:center;column-gap:8px;row-gap:2px}
      html[data-office-theme="ktop"] .properties-page .typed-property-row .listing-cell-type .lc-type-deal{flex:0 0 100%}
      html[data-office-theme="ktop"] .properties-page .typed-property-row .listing-cell-type .lc-status{flex:0 0 auto;max-width:none;width:auto}
      html[data-office-theme="ktop"] .properties-page .typed-property-row .listing-cell-type .lc-confirm{display:inline-block;flex:0 0 auto;margin:0;line-height:1.2;white-space:nowrap}
      html[data-office-theme="ktop"] .properties-page .typed-property-row .listing-cell-type{justify-content:flex-start}
      html[data-office-theme="ktop"] .properties-page .listing-row-card .listing-actions{gap:3px 4px}
      html[data-office-theme="ktop"] .properties-page .listing-row-card .lc-actions-main .btn{min-height:24px!important;height:24px!important;padding:0 4px!important;line-height:22px!important;font-size:12px!important}
      html[data-office-theme="ktop"] .properties-page .filter-panel-card{padding:12px 16px!important}
      html[data-office-theme="ktop"] .properties-page .listing-top-row{align-items:center;gap:8px}
      html[data-office-theme="ktop"] .properties-page .kind-tab{height:30px!important;min-height:30px!important;padding:0 12px!important;font-size:12.5px!important;border-radius:6px!important}
      html[data-office-theme="ktop"] .properties-page #kindTabRow{gap:4px}
      html[data-office-theme="ktop"] .properties-page .property-main-return{margin:0!important;gap:6px!important}
      html[data-office-theme="ktop"] .properties-page .property-main-return .btn{height:28px!important;min-height:28px!important;padding:0 10px!important;font-size:12px!important;border-radius:6px!important;width:auto!important}
      html[data-office-theme="ktop"] .properties-page #detailRegisterBtn{height:30px!important;min-height:30px!important;padding:0 14px!important;font-size:12.5px!important;border-radius:6px!important}
      html[data-office-theme="ktop"] .properties-page .toolbar-row{display:flex!important;flex-wrap:wrap;gap:6px 8px;align-items:center;margin:8px 0 0!important}
      html[data-office-theme="ktop"] .properties-page .toolbar-row .search-field{flex:1 1 280px;max-width:520px;min-width:200px}
      html[data-office-theme="ktop"] .properties-page #searchInput,html[data-office-theme="ktop"] .properties-page .toolbar-row .sort-select{height:30px!important;min-height:30px!important;font-size:12.5px!important;border-radius:6px!important;padding:0 10px!important}
      html[data-office-theme="ktop"] .properties-page .toolbar-row .sort-select{width:auto!important;min-width:96px;flex:0 0 auto}
      html[data-office-theme="ktop"] .properties-page #searchBtn,html[data-office-theme="ktop"] .properties-page #staleFilterBtn{height:30px!important;min-height:30px!important;padding:0 12px!important;font-size:12.5px!important;border-radius:6px!important;white-space:nowrap;flex:0 0 auto;width:auto!important}
      html[data-office-theme="ktop"] .properties-page .view-toggle-group{width:auto!important;max-width:none!important;flex:0 0 auto;display:inline-flex!important;height:28px;margin:0!important}
      html[data-office-theme="ktop"] .properties-page .view-toggle-group button{width:60px!important;flex:0 0 60px!important;height:28px!important;min-height:28px!important;padding:0!important;font-size:12px!important}
      html[data-office-theme="ktop"] .properties-page .month-filter-row{padding:6px 0!important;gap:6px!important;min-height:0!important}
      html[data-office-theme="ktop"] .properties-page .month-step-btn,html[data-office-theme="ktop"] .properties-page .month-current-btn,html[data-office-theme="ktop"] .properties-page #registrationMonthFilter{height:28px!important;min-height:28px!important;font-size:12px!important;border-radius:6px!important}
      html[data-office-theme="ktop"] .properties-page .month-step-btn{width:30px!important;min-width:30px!important}
      html[data-office-theme="ktop"] .properties-page .month-current-btn{padding:0 10px!important}
      html[data-office-theme="ktop"] .properties-page #registrationMonthFilter{width:170px!important}
      html[data-office-theme="ktop"] .properties-page .filter-btn{height:26px!important;min-height:26px!important;padding:0 10px!important;font-size:12px!important;border-radius:6px!important}
      html[data-office-theme="ktop"] .properties-page .filter-panel-row{gap:10px!important;padding:6px 0 0!important;min-height:0!important}
      html[data-office-theme="ktop"] .properties-page .filter-divider{margin:0!important}
    }
    .properties-page .lc-type-deal {display:flex;align-items:center;gap:4px;flex-wrap:wrap;}
    .properties-page .typed-property-row .lc-type {font-size:12px;white-space:normal;width:auto;}
    .properties-page .lc-price-line {display:block;line-height:1.5;}
    /* 등록된 매물 제목줄: 파란 막대는 제목 바로 옆에, 제목·전체선택은 왼쪽 정렬 */
    html[data-office-theme='ktop'] :is(.properties-page) .card-title.listing-tools-title::before {content:none!important;display:none!important;}
    html[data-office-theme='ktop'] .properties-page .listing-tools-heading::before {content:"";display:inline-block;flex:0 0 5px;width:5px;height:19px;background:#1767d2;border-radius:4px;margin-right:-2px;}
    .properties-page .listing-tools-heading {justify-content:flex-start;margin-right:auto;}
    /* 카드·목록·노트 보기 전환: 글자 가운데 정렬, 선택 색은 사무실 테마 색으로 */
    .properties-page .view-toggle-group {display:inline-flex;box-sizing:border-box;overflow:hidden;}
    .properties-page .view-toggle-group button {display:flex;align-items:center;justify-content:center;line-height:1;box-sizing:border-box;}
    html[data-office-theme='ktop'] .properties-page .view-toggle-group button[style*="37, 103, 95"] {background:#e3edff!important;color:#1767d2!important;font-weight:800;}
    .properties-page .lc-village-top {display:block;margin-bottom:2px;font-size:12px;font-weight:700;line-height:1.3;color:#1767d2;word-break:keep-all;}
    .properties-page .lc-village-top a,.properties-page .lc-village-top a:visited {color:inherit;}
    .properties-page .lc-vh-line {display:flex;align-items:center;flex-wrap:nowrap;white-space:nowrap;}
    .properties-page .typed-property-row .listing-cell-type .lc-type-deal {display:flex;flex:0 0 100%;align-items:center;gap:4px;flex-wrap:wrap;}
    .properties-page .typed-property-row .lc-roster-badge {display:inline-block;margin:0;white-space:nowrap;}
    .properties-page .typed-property-row .lc-price-text {font-size:13px;white-space:normal;overflow:visible;}
    .properties-page .typed-property-row .listing-cell-phone > span {display:inline-block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;overflow-wrap:normal;word-break:normal;}
    .properties-page .typed-property-row .listing-actions {min-width:0;width:100%;box-sizing:border-box;}
    .properties-page .typed-property-row .listing-actions .btn {padding:5px 4px;}
    .properties-page .lc-deal-filter {display:inline-flex;margin-left:4px;}
    .properties-page .typed-list-table td {overflow-wrap:anywhere;vertical-align:top;}
    .properties-page .typed-list-table .listing-actions {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px;}
    .properties-page .typed-list-table .lc-actions-main,.properties-page .typed-list-table .lc-actions-side {display:contents;}
    .properties-page .typed-list-table .listing-actions .btn,.properties-page .typed-list-table .lc-status-chip {width:100%;min-width:0;box-sizing:border-box;padding:5px 2px;font-size:12px;white-space:nowrap;border-radius:6px;}
    .properties-page .typed-list-table .lc-toggle {grid-column:1/-1;}
    @media(min-width:801px) {
      html body.properties-page .typed-property-row .listing-actions {display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;align-items:start;}
      .properties-page .typed-property-row .lc-actions-main,.properties-page .typed-property-row .lc-actions-side {display:contents!important;}
      .properties-page .typed-property-row .ktop-mobile-more[hidden] {display:none!important;}
      .properties-page .typed-property-row .ktop-mobile-more > summary {display:none;}
      html body.properties-page .typed-property-row .listing-actions .btn {width:100%;min-height:30px;box-sizing:border-box;border-radius:6px;padding:5px 4px;font-size:12px;}
      html body.properties-page .typed-property-row .lc-status-chip {grid-column:1/-1!important;width:100%!important;min-width:0;min-height:30px;box-sizing:border-box;border-radius:6px;padding:5px 18px 5px 8px;font-size:12px;line-height:1.3;text-align:center;}
    }
    @media(min-width:801px) and (max-width:1200px) {
      .properties-page .typed-property-row .listing-sort-btn {font-size:11px;}
    }
    @media(max-width:800px){
      .properties-page .typed-list-table {min-width:800px;}

      html body.properties-page .listing-column-header.typed-property-row {display:none;}
      html body.properties-page .listing-card.typed-property-row {min-width:0;grid-template-columns:var(--listing-highlight-select-width,26px) minmax(0,1fr) minmax(0,1fr);gap:10px;}
      .properties-page .typed-property-row .listing-cell-select {grid-column:1;grid-row:1 / span 12;}
      .properties-page .typed-property-row .listing-cell-actions {grid-column:2 / -1;}
      .properties-page .typed-property-row .listing-cell:not(.listing-cell-select):not(.listing-cell-actions)::before {display:block;content:attr(data-label);font-size:11px;color:var(--text-muted);margin-bottom:3px;}
    }
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .lc-apartment-main,
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .lc-apartment-sub {display:block;line-height:1.3;}
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .lc-apartment-main {font-weight:750;}
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .lc-apartment-sub {color:#234c49;font-weight:650;}
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .listing-cell-supply {display:flex;flex-direction:column;gap:3px;line-height:1.25;}
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .lc-supply-size {font-weight:750;white-space:nowrap;font-variant-numeric:tabular-nums;}
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .lc-supply-type {color:#234c49;white-space:nowrap;}
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .listing-cell-dong,
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .listing-cell-room {font-size:14px;font-weight:750;}
    html body.properties-page .typed-property-row .listing-cell-price.has-price {padding:5px 6px;border-left:3px solid #1767d2;border-radius:5px;background:#eaf2ff;overflow:visible;}
    html body.properties-page .typed-property-row .listing-cell-price.has-price .lc-price-text {font-size:13px;font-weight:800;color:#234c49;line-height:1.4;}
    /* 보증금 / 월세 두 줄 가격: 글자를 줄이고 줄바꿈 없이 윗줄 보증금, 아랫줄 월세 */
    html body.properties-page .typed-property-row .listing-cell-price.has-price .lc-price-text.lc-price-multi {font-size:12.5px;font-weight:700;line-height:1.45;}
    html body.properties-page .typed-property-row .listing-cell-price .lc-price-text.lc-price-multi .lc-price-line {white-space:nowrap;}
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .listing-sort-btn[aria-label='분양평형/타입 정렬'] {line-height:1.2;white-space:normal;}
    @media(min-width:801px) {
      html[data-office-theme='ktop'] body.properties-page .residential-property-row .listing-cell-phone {overflow:visible;}
      html[data-office-theme='ktop'] body.properties-page .residential-property-row .listing-cell-phone > span {font-size:12px;white-space:nowrap;overflow:visible;text-overflow:clip;overflow-wrap:normal;}
      html[data-office-theme='ktop'] body.properties-page .residential-property-row .listing-actions .btn {padding-left:2px;padding-right:2px;}
    }
  `;
  document.head.appendChild(style);
  if (allListings.length) renderList();
})();


