(function(root){
 'use strict';
 const core=root.CommercialPriceCore;if(!core)return;
 const style=document.createElement('style');
 style.textContent='.presale-switch[hidden],.presale-switch [hidden],.commercial-original[hidden],.commercial-compare-heading[hidden]{display:none!important}.presale-switch{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}.presale-switch button{padding:8px 14px;border:1px solid #65708b;border-radius:8px;background:#15223b;color:#e5eaf4;font:inherit;cursor:pointer}.presale-switch button.active{background:#80651f;border-color:#d4af37;color:#fff3c2}.presale-hidden{display:none!important}.commercial-price-compare{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:12px!important}.commercial-price-compare>.field{min-width:0}.commercial-compare-heading{font-weight:700;padding:10px 12px;border-radius:8px;background:rgba(212,175,55,.15);border:1px solid rgba(212,175,55,.35)}.commercial-compare-heading.current{background:rgba(70,130,210,.15);border-color:rgba(70,130,210,.4)}.commercial-price-compare input{width:100%;min-width:0;box-sizing:border-box}';
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
   headings.forEach(el=>el.hidden=!enabled);
   switcher.querySelectorAll('[data-phase]').forEach(b=>{b.classList.toggle('active',b.dataset.phase===phase);b.setAttribute('aria-pressed',String(b.dataset.phase===phase));});
   Object.entries(positions).forEach(([id,[row,col]])=>{const field=get(id)?.closest('.field');if(!field)return;field.classList.remove('presale-hidden');field.style.gridRow=enabled?String(row):'';field.style.gridColumn=enabled?String(col):'';if(id.startsWith('original'))field.hidden=!enabled;});
   const labels={presalePrice:enabled?'기존 분양가':'분양가',salePrice:enabled?'현재 매매가':'매매가',deposit:enabled?'현재 보증금':'보증금',monthlyRent:enabled?'현재 월세':'월세'};
   Object.entries(labels).forEach(([id,label])=>{const field=get(id)?.closest('.field');if(field)field.querySelector('label').textContent=label;});
   ['publicAddress','title','managementFee','premium'].forEach(id=>{const field=get(id)?.closest('.field');if(field)field.classList.toggle('presale-hidden',enabled);});
  }
  const formatOriginal=id=>{const input=get(id),preview=get(id+'_preview');const digits=input.value.replace(/[^\d]/g,'');input.value=digits?Number(digits).toLocaleString('ko-KR'):'';if(preview){const n=Number(digits);preview.textContent=digits?new Intl.NumberFormat('ko-KR').format(n)+'원':'';}};
  ['originalDeposit','originalMonthlyRent'].forEach(id=>get(id).addEventListener('input',()=>formatOriginal(id)));
  fillOriginal(item);
  ['originalDeposit','originalMonthlyRent'].forEach(formatOriginal);
  switcher.querySelectorAll('[data-phase]').forEach(b=>b.onclick=()=>{phase=b.dataset.phase;render();});
  category.addEventListener('change',render);render();
  return {get status(){return phase;},get occupancy(){return occupancy.value;},get originalValues(){const clean=id=>get(id).value.replace(/[^\d]/g,'');return {originalDeposit:clean('originalDeposit')||null,originalMonthlyRent:clean('originalMonthlyRent')||null};},set(data){phase=core.status(data);fillOriginal(data);['originalDeposit','originalMonthlyRent'].forEach(formatOriginal);render();},render};
 }};
})(window);