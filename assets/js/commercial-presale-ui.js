(function(root){
 'use strict';
 const core=root.CommercialPriceCore;if(!core)return;
 const style=document.createElement('style');
 style.textContent='.presale-switch[hidden],.presale-switch [hidden],.commercial-original[hidden],.commercial-compare-heading[hidden]{display:none!important}.presale-switch{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}.presale-switch button{padding:8px 14px;border:1px solid #65708b;border-radius:8px;background:#ffffff;color:#234c49;font:inherit;cursor:pointer}.presale-switch button.active{background:#25675f;border-color:#779a94;color:#ffffff;font-weight:700}.presale-hidden{display:none!important}.commercial-price-compare{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:12px!important}.commercial-price-compare>.field{min-width:0}.commercial-compare-heading{font-weight:700;padding:10px 12px;border-radius:8px;background:rgba(37,103,95,0.15);border:1px solid rgba(37,103,95,0.5)}.commercial-compare-heading.current{background:rgba(70,130,210,.15);border-color:rgba(70,130,210,.4)}.commercial-price-compare input{width:100%;min-width:0;box-sizing:border-box}';
 style.textContent += ".presale-switch{column-gap:8px;row-gap:10px;align-items:center}.presale-switch>span{display:flex;align-items:center;min-height:40px;margin:0 4px 0 0;font-weight:700;white-space:nowrap}.presale-switch button{display:inline-flex;align-items:center;justify-content:center;min-height:40px;box-sizing:border-box;margin:0;line-height:1.2;white-space:nowrap}.presale-switch>label{display:inline-flex!important;align-items:center!important;justify-content:flex-start;gap:8px;min-height:40px;margin:0 0 0 12px!important;font-size:inherit;line-height:1.2;white-space:nowrap}.presale-switch .commercial-occupancy{display:inline-block!important;flex:0 0 112px;width:112px!important;min-width:112px;height:40px;min-height:40px;box-sizing:border-box;margin:0!important;padding:8px 30px 8px 12px;line-height:1.2;vertical-align:middle}@media(max-width:520px){.presale-switch>label{flex-basis:100%;margin-left:0!important}}";
 style.textContent+='.commercial-price-compare.original-collapsed{grid-template-columns:repeat(3,minmax(0,1fr))!important}.commercial-compare-heading.original-toggle{cursor:pointer;user-select:none}.commercial-compare-heading.original-toggle:hover{filter:brightness(.97)}.commercial-compare-heading.original-toggle:focus-visible{outline:2px solid #25675f;outline-offset:2px}'+
  '#editModal .edit-grid-3.commercial-price-compare.original-collapsed:has(#edit_salePrice){grid-template-columns:repeat(3,minmax(0,1fr))!important}#editModal .edit-grid-3.commercial-price-compare.original-collapsed:has(#edit_salePrice)>.commercial-compare-heading.current{grid-row:1!important;grid-column:1 / -1!important}#editModal .edit-grid-3.commercial-price-compare.original-collapsed:has(#edit_salePrice)>.commercial-compare-heading.original-toggle{grid-row:3!important;grid-column:1 / -1!important}#editModal .edit-grid-3.commercial-price-compare.original-collapsed:has(#edit_salePrice)>.field:has(#edit_salePrice){grid-row:2!important;grid-column:1!important}#editModal .edit-grid-3.commercial-price-compare.original-collapsed:has(#edit_salePrice)>.field:has(#edit_deposit){grid-row:2!important;grid-column:2!important}#editModal .edit-grid-3.commercial-price-compare.original-collapsed:has(#edit_salePrice)>.field:has(#edit_monthlyRent){grid-row:2!important;grid-column:3!important}.price-one-row.commercial-price-compare.original-collapsed:has(#salePrice){grid-template-columns:repeat(3,minmax(0,1fr))!important}.price-one-row.commercial-price-compare.original-collapsed:has(#salePrice)>.commercial-compare-heading.current{grid-row:1!important;grid-column:1 / -1!important}.price-one-row.commercial-price-compare.original-collapsed:has(#salePrice)>.commercial-compare-heading.original-toggle{grid-row:3!important;grid-column:1 / -1!important}.price-one-row.commercial-price-compare.original-collapsed:has(#salePrice)>.field:has(#salePrice){grid-row:2!important;grid-column:1!important}.price-one-row.commercial-price-compare.original-collapsed:has(#salePrice)>.field:has(#deposit){grid-row:2!important;grid-column:2!important}.price-one-row.commercial-price-compare.original-collapsed:has(#salePrice)>.field:has(#monthlyRent){grid-row:2!important;grid-column:3!important}@media(max-width:620px){.commercial-price-compare.original-collapsed{grid-template-columns:1fr!important}.commercial-price-compare.original-collapsed>*{grid-column:1!important;grid-row:auto!important}}';
  document.head.appendChild(style);
 root.CommercialPresaleUI={setup({prefix='',host,item={}}){
  const get=id=>document.getElementById(prefix+id);
  const category=get('category1')||document.getElementById('category1Select');
  if(!host||!category)return null;
  let phase=core.status(item);
  const switcher=document.createElement('div');switcher.className='presale-switch';
  switcher.innerHTML='<span>분양상태</span><button type="button" data-phase="분양중">분양중</button><button type="button" data-phase="분양완료">분양완료</button><label>임대현황 <select class="commercial-occupancy"><option>공실</option><option>임차중</option></select></label>';
  host.before(switcher);
  const occupancy=switcher.querySelector('.commercial-occupancy');
  const headings=['기존 분양조건','현재 조건'].map((title,index)=>{const el=document.createElement('div');el.className='commercial-compare-heading'+(index?' current':'');el.textContent=title;el.style.gridRow='1';el.style.gridColumn=String(index+1);host.appendChild(el);return el;});
   // 기존 분양조건은 선택 입력: 자료가 없으면 접어 두고, 눌러서 펼친 뒤 입력한다.
   let originalOpen=null;
   const originalIds=['presalePrice','originalDeposit','originalMonthlyRent'];
   const hasOriginalData=()=>originalIds.some(id=>{const el=get(id);return el&&String(el.value||'').replace(/[^\d]/g,'')!==''});
   const isOriginalOpen=()=>originalOpen===null?hasOriginalData():originalOpen;
   const toggleHeading=headings[0];
   toggleHeading.setAttribute('role','button');toggleHeading.tabIndex=0;toggleHeading.classList.add('original-toggle');
   const toggleOriginal=()=>{originalOpen=!isOriginalOpen();render();};
   toggleHeading.addEventListener('click',toggleOriginal);
   toggleHeading.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleOriginal();}});
  ['originalDeposit','originalMonthlyRent'].forEach((id,index)=>{const field=document.createElement('div');field.className='field commercial-original';field.hidden=true;field.innerHTML='<label>'+['기존 보증금','기존 월세'][index]+'</label><input id="'+prefix+id+'" type="text" inputmode="numeric" placeholder="자료 없으면 비워두세요"><div class="price-preview" id="'+prefix+id+'_preview"></div>';host.appendChild(field);});
  const positions={presalePrice:[2,1],salePrice:[2,2],originalDeposit:[3,1],deposit:[3,2],originalMonthlyRent:[4,1],monthlyRent:[4,2]};
  function fillOriginal(data){
   const snapshot=data.import_unit_snapshot||{};
   [['originalDeposit','보증금'],['originalMonthlyRent','월차임']].forEach(([id,key])=>{const value=data[id]??(snapshot[key]!=null&&snapshot[key]!==''?Number(snapshot[key])*10000:'');get(id).value=value===''?'':String(value).replace(/,/g,'');});
   occupancy.value=data.occupancy||snapshot.공실여부||'공실';
  }
  const priceStart=prefix?switcher.previousElementSibling:host.closest('section');
  const areaBlocks=prefix
   ? ['area_land','area_exclusive','area_building','commercial_section'].map(id=>get(id)).filter(Boolean)
   : [...document.querySelectorAll('.area-section,.commercial-section')];
  const areaAnchors=areaBlocks.map(block=>{const anchor=document.createComment('original-area-position');block.before(anchor);return anchor;});
  function render(){
   const enabled=category.value==='상가사무실';
   switcher.hidden=!enabled;host.classList.toggle('commercial-price-compare',enabled);
   areaBlocks.forEach((block,index)=>{if(enabled&&priceStart)priceStart.before(block);else areaAnchors[index].after(block);});
   const open=isOriginalOpen();
    headings.forEach(el=>el.hidden=!enabled);
    host.classList.toggle('original-collapsed',enabled&&!open);
    toggleHeading.textContent=(open?'▾ ':'▸ ')+'기존 분양조건'+(open?'':(hasOriginalData()?' (입력된 자료 있음 · 눌러서 펼치기)':' (선택 입력 · 눌러서 펼치기)'));
    toggleHeading.setAttribute('aria-expanded',String(open));
    if(enabled){
     if(open){headings[0].style.gridRow='1';headings[0].style.gridColumn='1';headings[1].style.gridRow='1';headings[1].style.gridColumn='2';}
     else{headings[1].style.gridRow='1';headings[1].style.gridColumn='1 / -1';headings[0].style.gridRow='3';headings[0].style.gridColumn='1 / -1';}
    }
   switcher.querySelectorAll('[data-phase]').forEach(b=>{b.classList.toggle('active',b.dataset.phase===phase);b.setAttribute('aria-pressed',String(b.dataset.phase===phase));});
   const collapsedLayout={salePrice:[2,1],deposit:[2,2],monthlyRent:[2,3]};
    Object.entries(positions).forEach(([id,[row,col]])=>{const field=get(id)?.closest('.field');if(!field)return;field.classList.remove('presale-hidden');const pos=open?[row,col]:collapsedLayout[id];if(enabled&&pos){field.style.gridRow=String(pos[0]);field.style.gridColumn=String(pos[1]);}else{field.style.gridRow='';field.style.gridColumn='';if(enabled&&!open)field.classList.add('presale-hidden');}if(id.startsWith('original'))field.hidden=!enabled||!open;});
   const labels={presalePrice:enabled?'기존 분양가':'분양가',salePrice:enabled?'현재 매매가':'매매가',deposit:enabled?'현재 보증금':'보증금',monthlyRent:enabled?'현재 월세':'월세'};
   Object.entries(labels).forEach(([id,label])=>{const field=get(id)?.closest('.field');if(field)field.querySelector('label').textContent=label;});
   ['publicAddress','managementFee','premium'].forEach(id=>{const field=get(id)?.closest('.field');if(field)field.classList.toggle('presale-hidden',enabled);});
  }
  const formatOriginal=id=>{const input=get(id),preview=get(id+'_preview');const digits=input.value.replace(/[^\d]/g,'');input.value=digits?Number(digits).toLocaleString('ko-KR'):'';if(preview){const n=Number(digits);preview.textContent=digits?new Intl.NumberFormat('ko-KR').format(n)+'원':'';}};
  ['originalDeposit','originalMonthlyRent'].forEach(id=>get(id).addEventListener('input',()=>formatOriginal(id)));
  fillOriginal(item);
  ['originalDeposit','originalMonthlyRent'].forEach(formatOriginal);
  switcher.querySelectorAll('[data-phase]').forEach(b=>b.onclick=()=>{phase=b.dataset.phase;render();});
  category.addEventListener('change',render);render();
  return {get status(){return phase;},get occupancy(){return occupancy.value;},get originalValues(){const clean=id=>get(id).value.replace(/[^\d]/g,'');return {originalDeposit:clean('originalDeposit')||null,originalMonthlyRent:clean('originalMonthlyRent')||null};},set(data){phase=core.status(data);originalOpen=null;fillOriginal(data);['originalDeposit','originalMonthlyRent'].forEach(formatOriginal);render();},render};
 }};
})(window);
