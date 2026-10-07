const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'assets/js/storage.js'),'utf8');
(async()=>{
for(const office of ['hitop','ktop']){
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{_value:'',get value(){return this._value;},set value(v){this._value=String(v);},querySelectorAll:()=>[],options:[],querySelector:()=>({replaceChildren(){},appendChild(){}})});return nodes.get(id);};
 const store={getItem:()=>null,setItem(){},removeItem(){}};
 const c=vm.createContext({URL,URLSearchParams,location:{search:'?office='+office,href:'https://example.com/register.html?office='+office},history:{replaceState(){}},sessionStorage:store,localStorage:store,document:{getElementById:get,addEventListener(){},createElement:()=>({}),head:{appendChild(){}}},console,crypto:require('node:crypto').webcrypto});
 vm.runInContext(source,c);
 const input={'아파트명':'운정아이파크포레스트','동':'101동','호수':'1302호','권리구분':'분양권','입주예정월':'2028-12','분양가':'60000','프리미엄':'-1500','납부금':'12000','잔금':'48000','분양_m2':'112.3','전용_m2':'84.95','매매가':'58500','거래구분':'매매'};
 for(const [k,v] of Object.entries(input))get('apt_'+k).value=v;
 const fields=vm.runInContext('collectApartmentListingFields("")',c);assert.equal(fields.apartmentUnitData.프리미엄,-1500);assert.equal(fields.salePrice,'585000000');assert.equal(fields.dong,'101');assert.equal(fields.ho,'1302');
 c.item={...fields,type:'apartment',category1:'주거용',category2:'아파트',status:'광고중',mapCoordinates:{lat:37.71,lng:126.74}};
 c.payload=vm.runInContext('buildListingPayload(item)',c);
 const saved=vm.runInContext('normalizeListingRow({...payload,id:"test"})',c);c.saved=saved;
 assert.equal(saved.mapCoordinates.lat,37.71);assert.equal(saved.apartmentUnitData.입주예정월,'2028-12');
 get('apartmentListingForm')._renderPresale=()=>{};
 vm.runInContext('fillApartmentListingForm("",saved)',c);
 assert.equal(get('apt_권리구분').value,'분양권');assert.equal(get('apt_프리미엄').value,'-1500');assert.equal(get('apt_잔금').value,'48000');
 await assert.rejects(vm.runInContext('lookupApartmentAutofill(saved)',c),/분양자료/);
 get('apt_분양가').value='-1';assert.throws(()=>vm.runInContext('collectApartmentListingFields("",saved)',c),/0 이상/);get('apt_분양가').value='60000';
 get('apt_권리구분').value='일반 아파트';assert.equal(vm.runInContext('collectApartmentListingFields("",saved).title',c),'운정아이파크포레스트 · 101동 1302호');
}
const map=fs.readFileSync(path.join(root,'assets/js/shop-kakao.js'),'utf8'),c=vm.createContext({URLSearchParams,OfficeConfig:{urlFor:x=>x},ADDRESS_PATTERN:/야당동\s*\d+/});
vm.runInContext(map.slice(map.indexOf('  function apartmentNameKey'),map.indexOf('  async function loadBuildings'))+map.slice(map.indexOf('  function addressKey'),map.indexOf('  function pinContent')),c);
// A new-build listing without a reference resource still creates its map item with saved coordinates.
c.listing={id:'new',type:'apartment',status:'광고중',complexName:'운정아이파크포레스트',jibunAddress:'파주시 야당동 123',mapCoordinates:{lat:37.71,lng:126.74},apartmentUnitData:{권리구분:'분양권'}};
const mapped=vm.runInContext('mergeResidentialListings([], [listing])',c);assert.equal(mapped.length,1);assert.equal(mapped[0].listed,1);assert.equal(mapped[0].registrationCoordinates[1],126.74);
c.listing.status='거래완료';assert.equal(vm.runInContext('mergeResidentialListings([], [listing]).length',c),0);
c.listing.status='광고중';c.listing.jibunAddress='';assert.equal(vm.runInContext('mergeResidentialListings([], [listing])[0].registrationCoordinates[0]',c),37.71);
function element(tag){return {tag,children:[],style:{},value:'',listeners:{},setAttribute(){},addEventListener(k,f){this.listeners[k]=f;},append(...xs){this.children.push(...xs);},appendChild(x){this.children.push(x);}};}
Object.assign(c,{residential:true,editing:false,listingMenuVersion:0,items:[],infoWindow:{close(){}},map:{},location:{href:''},setTimeout:()=>1,clearTimeout(){},document:{createElement:element},closeListingMenu(){c.listingMenuVersion++;}});
c.kakao={maps:{event:{preventMap(){}},CustomOverlay:function(options){c.root=options.content;this.setMap=()=>{};},services:{Status:{OK:'OK'},SortBy:{DISTANCE:'DISTANCE'},Places:function(){this.keywordSearch=()=>{};}}}};
c.geocoder={coord2Address(){}};c.position={getLat:()=>37.71,getLng:()=>126.74};
await vm.runInContext('openListingMenu(position)',c);
const add=c.root.children.find(x=>x.tag==='button');assert.ok(add,'Registration button must exist while geocoder has not answered');add.listeners.click();
assert.ok(c.location.href.includes('mapLat=37.71'));assert.ok(c.location.href.includes('mapApartment=1'));
console.log('Presale persistence, both offices, blank-address map pins, and immediate registration with pending lookup passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
