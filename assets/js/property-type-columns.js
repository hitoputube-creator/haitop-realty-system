/* 유형별 매물 열: 원본 데이터와 공통 관리 버튼을 그대로 사용한다. */
(function () {
  'use strict';
  const common = [['deal','구분'],['price','가격'],['owner','소유주'],['phone','연락처']];
  const schemas = {
    '': [['type','매물유형'],['name','매물명'],...common],
    '상가사무실': [['presaleStatus','분양상태'],['building','건물명'],['address','소재지'],['floorRoom','층/호실'],['exclusive','전용면적'],['maintenance','관리비'],['premium','권리금'],...common],
    '토지': [['address','소재지'],['parcel','블럭/필지'],['landArea','토지면적'],['landUse','지목'],['zoning','용도지역'],['unitPrice','평당가'],...common],
    '주거용': [['village','마을'],['apartment','단지명'],['dong','동'],['room','호수'],['supply','분양평형/타입'],...common],
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
    return {
      presaleStatus:window.CommercialPriceCore?.commercial(item)?CommercialPriceCore.status(item):'',
      name:(()=>{
        const complexName=u.아파트명 || item.complexName || item.buildingName || '';
        const village=(complexName.match(/^(.*?마을\s*\d+단지)/)||[])[1]||'';
        const dong=u.동||item.apartmentDong||item.dong||'';
        const room=u.호||item.apartmentHo||item.ho||'';
        return village && dong && room ? [village,dong+'동 '+room+'호'].join('\n') : first(item.title,getBuildingName(item) === '-' ? '' : getBuildingName(item),item.address);
      })(),
      building:first(item.buildingName,item.building_name,item.complexName,item.shop_building,item.biz_building),
      address:first(item.roadAddress,item.jibunAddress,item.address,item.publicAddress,item.mapAddress,item.quick_location),
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
    return cols;
  }
  function shortType(item) {
    const parts=String(originalValue(item,'type') || '').split(/\s*\/\s*/);
    return parts[parts.length-1].replace(/\s*[·-]?\s*확인 필요/g,'').trim() || parts[0] || '-';
  }
  const originalValue=listingColumnValue;
  listingColumnValue=function(item,key) {
    if (key==='type') return shortType(item);
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
      if (key==='name' || key==='building' || key==='address') {
        const no=document.createElement('span');no.className='lc-no';no.textContent='No. '+getListingNumber(item);node.appendChild(no);
      }
    }
    if (key==='type') {
      const badge=node.querySelector('.lc-type');
      if(badge) badge.textContent=shortType(item);
      const deal=original.querySelector('.listing-cell-deal .lc-deal-badge');
      if(deal) {
        const line=document.createElement('div');line.className='lc-type-deal';
        if(badge) line.appendChild(badge);
        line.appendChild(deal);node.prepend(line);
      }
    }
    if (key==='name') {
      const raw=String(listingColumnValue(item,key) || '-');
      if (raw.includes('\n')) {
        const no=node.querySelector('.lc-no');
        node.replaceChildren(...raw.split('\n').map(text=>{
          const line=document.createElement('span');line.className='lc-name-line';line.textContent=text;return line;
        }));
        if (no) node.appendChild(no);
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
        if (isKtopResidential() && price.textContent.trim() !== '-') node.classList.add('has-price');
        const lines=price.textContent.split(/\s*\/\s*(?=월세)/);
        price.replaceChildren(...lines.map(text=>{
          const line=document.createElement('span');line.className='lc-price-line';line.textContent=text;return line;
        }));
      }
    }
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
    return table ? 78 : 148;
  }
  function template(cols) {
    if (isKtopResidential()) {
      const widths={type:'.78fr',village:'.78fr',apartment:'1.16fr',dong:'.64fr',room:'.64fr',supply:'.82fr',price:'1.14fr',owner:'.72fr',phone:'1.18fr'};
      return '24px '+cols.map(([key])=>`minmax(0,${widths[key] || '.8fr'})`).join(' ')+' 166px';
    }
    return '24px '+cols.map(([key])=>['address','name','building','apartment'].includes(key)?'minmax(0,1.5fr)':key==='price'?'minmax(0,1.1fr)':key==='phone'?'minmax(0,1fr)':'minmax(0,.8fr)').join(' ')+' '+actionsColWidth(false)+'px';
  }
  makeListingColumnHeader=function() {
    const h=document.createElement('div');h.className='listing-column-header typed-property-row';
    if (isKtopResidential()) h.classList.add('residential-property-row');
    h.style.setProperty('--typed-columns',template(columns()));
    const sort=(key,label)=>'<button type="button" class="listing-sort-btn" onclick="sortListingColumn(\''+key+'\')" aria-label="'+label+' 정렬">'+(key==='supply' && isKtopResidential() ? '분양평형<br>타입' : label)+' '+listingSortMark(key)+'</button>';
    const filter=(key,label)=>'<button type="button" class="listing-filter-btn'+(listingColumnFilters[key]?' active':'')+'" onclick="openColumnFilter(\''+key+'\',this,event)" aria-label="'+label+' 필터">▾</button>';
    h.innerHTML='<div>선택</div>'+columns().map(([key,label])=>'<div>'+sort(key,label)+filter(key,label)+(key==='type'?'<span class="lc-deal-filter">'+sort('deal','구분')+filter('deal','구분')+'</span>':'')+'</div>').join('')+'<div>'+(columnFilterCount()?'<button type="button" class="listing-filter-reset" onclick="clearColumnFilters()">필터 해제</button>':'관리')+'</div>';
    return h;
  };
  renderListView=function(items) {
    _currentListItems=items;
    const cols=columns();
    const wrap=document.createElement('div');wrap.className='typed-list-table-wrap';
    const table=document.createElement('table');table.className='typed-list-table';
    if (isKtopResidential()) table.classList.add('residential-property-table');
    const header=makeListingColumnHeader();
    table.innerHTML='<colgroup><col style="width:32px">'+cols.map(([key])=>'<col'+(key==='type'?' style="width:112px"':key==='price'?' style="width:138px"':key==='phone'?' style="width:150px"':'')+'>').join('')+'<col style="width:'+actionsColWidth(true)+'px"></colgroup><thead><tr><th>선택</th>'+Array.from(header.children).slice(1,-1).map(n=>'<th>'+n.innerHTML+'</th>').join('')+'<th>관리</th></tr></thead><tbody></tbody>';
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
    const visible=new Set([...columns().map(([key])=>key),'deal']);
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
    html body.properties-page .listing-card.profit-recommended-row,.typed-list-table .profit-recommended-row td{background:rgba(212,175,55,.10)!important;}
    .typed-list-table .profit-recommended-row td:first-child{box-shadow:inset 3px 0 #d4af37;}
    .profit-recommended-badge{display:block;color:var(--gold);font-size:11px;margin-top:5px;font-weight:700;}
    .typed-list-table {width:100%;min-width:0;table-layout:fixed;border-collapse:collapse;font-size:13px;}
    .typed-list-table th,.typed-list-table td {padding:12px 8px;border-bottom:1px solid var(--border-slate);text-align:left;}
    .typed-list-table th {white-space:nowrap;color:var(--gold);}
    .typed-list-table td .listing-cell::before {display:none!important;}

    .properties-page .lc-name-line {display:block;}
    .properties-page .lc-type-deal {display:flex;align-items:center;gap:4px;flex-wrap:wrap;}
    .properties-page .typed-property-row .lc-type {font-size:12px;white-space:normal;width:auto;}
    .properties-page .lc-price-line {display:block;line-height:1.5;}
    .properties-page .typed-property-row .lc-price-text {font-size:13px;white-space:normal;overflow:visible;}
    .properties-page .typed-property-row .listing-cell-phone > span {white-space:nowrap;overflow:visible;overflow-wrap:normal;word-break:normal;}
    .properties-page .typed-property-row .listing-actions {min-width:0;width:100%;box-sizing:border-box;}
    .properties-page .typed-property-row .listing-actions .btn {padding:5px 4px;}
    .properties-page .lc-deal-filter {display:inline-flex;margin-left:4px;}
    .properties-page .typed-list-table td {overflow-wrap:anywhere;vertical-align:top;}
    .properties-page .typed-list-table .listing-actions {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px;}
    .properties-page .typed-list-table .lc-actions-main,.properties-page .typed-list-table .lc-actions-side {display:contents;}
    .properties-page .typed-list-table .listing-actions .btn,.properties-page .typed-list-table .lc-status-chip {width:100%;min-width:0;box-sizing:border-box;padding:3px 2px;font-size:11px;}
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
      html body.properties-page .listing-card.typed-property-row {min-width:0;grid-template-columns:26px minmax(0,1fr) minmax(0,1fr);gap:10px;}
      .properties-page .typed-property-row .listing-cell-select {grid-column:1;grid-row:1 / span 12;}
      .properties-page .typed-property-row .listing-cell-actions {grid-column:2 / -1;}
      .properties-page .typed-property-row .listing-cell:not(.listing-cell-select):not(.listing-cell-actions)::before {display:block;content:attr(data-label);font-size:11px;color:var(--text-muted);margin-bottom:3px;}
    }
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .lc-apartment-main,
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .lc-apartment-sub {display:block;line-height:1.3;}
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .lc-apartment-main {font-weight:750;}
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .lc-apartment-sub {color:#4c6582;font-weight:650;}
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .listing-cell-supply {display:flex;flex-direction:column;gap:3px;line-height:1.25;}
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .lc-supply-size {font-weight:750;white-space:nowrap;font-variant-numeric:tabular-nums;}
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .lc-supply-type {color:#526b88;white-space:nowrap;}
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .listing-cell-dong,
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .listing-cell-room {font-size:14px;font-weight:750;}
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .listing-cell-price.has-price {padding:5px 6px;border-left:3px solid #1767d2;border-radius:5px;background:#eaf2ff;overflow:visible;}
    html[data-office-theme='ktop'] body.properties-page .residential-property-row .listing-cell-price.has-price .lc-price-text {font-size:14px;font-weight:800;color:#1459b2;line-height:1.4;}
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


