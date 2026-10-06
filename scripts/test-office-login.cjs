const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'..')+'/';
function storage(seed={}){const m=new Map(Object.entries(seed));return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};}
function context(office='hitop',member=true,loginError=false,redirect=''){
 const events={},elements={};const location={href:'https://example.org/app/login.html?office='+office+(redirect?'&redirect='+encodeURIComponent(redirect):''),search:'?office='+office+(redirect?'&redirect='+encodeURIComponent(redirect):''),pathname:'/app/login.html',hash:'',replace(v){this.replaced=v;}};
 function el(id){return elements[id]??= {value:'',disabled:false,style:{},textContent:'',focus(){},addEventListener:(ev,fn)=>events[id+':'+ev]=fn};}
 const calls=[];const auth={getSession:async()=>({data:{session:{access_token:office+'-jwt'}}}),getUser:async()=>({data:{user:{email:'ktop2027@gmail.com'}}}),signInWithPassword:async o=>{calls.push(o);return {error:loginError?new Error():null}},signOut:async()=>{},onAuthStateChange(){},resetPasswordForEmail:async()=>({})};
 const sdk={auth,from:()=>({select:()=>({eq:async()=>({data:member?[{email:'ktop2027@gmail.com'}]:[]})})})};
 const c=vm.createContext({location,URL,URLSearchParams,history:{replaceState(_,__,v){location.href=v;location.search=new URL(v).search}},localStorage:storage({buildings:'["HITOP-only"]'}),sessionStorage:storage(),document:{getElementById:el,addEventListener(){},querySelectorAll(){return []}},window:{supabase:{createClient:(url,key)=>{calls.push({url,key});return sdk}}},console,AbortController,setTimeout,clearTimeout,fetch:async()=>({ok:true})});
 vm.runInContext(fs.readFileSync(root+'assets/js/storage.js','utf8'),c);
 return {c,events,el,location,calls};
}
(async()=>{
 let x=context('ktop');assert.equal(vm.runInContext('SUPABASE_URL',x.c),'https://enefadyhmhfphtochlku.supabase.co');assert.equal(vm.runInContext('OfficeStorage.local.getItem("buildings")',x.c),null);vm.runInContext('OfficeStorage.local.setItem("buildings","KTOP-only")',x.c);assert.equal(x.c.localStorage.getItem('buildings'),'["HITOP-only"]');assert.equal(x.c.localStorage.getItem('ktop:buildings'),'KTOP-only');
 const login=fs.readFileSync(root+'login.html','utf8').match(/<script>\s*([\s\S]*?)<\/script>/)[1];vm.runInContext(login,x.c);assert.equal(x.el('officeSelect').value,'ktop');assert.equal(x.el('loginEmail').value,'ktop2027@gmail.com');assert.equal(x.location.replaced,undefined);x.el('loginPassword').value='test-only';await x.events['loginBtn:click']();assert.equal(new URL(x.location.replaced).pathname,'/app/properties.html');assert.equal(new URL(x.location.replaced).searchParams.get('office'),'ktop');
 x=context('ktop',false);vm.runInContext(login,x.c);x.el('loginPassword').value='test-only';await x.events['loginBtn:click']();assert.equal(x.location.replaced,undefined);assert.match(x.el('loginError').textContent,/권한/);assert.equal(x.el('loginBtn').disabled,false);
 x=context('ktop',true,true);vm.runInContext(login,x.c);x.el('loginPassword').value='test-only';await x.events['loginBtn:click']();assert.match(x.el('loginError').textContent,/실패/);assert.equal(x.el('loginBtn').disabled,false);
 x=context('ktop',true,false,'https://evil.example/');vm.runInContext(login,x.c);x.el('loginPassword').value='test-only';await x.events['loginBtn:click']();assert.equal(new URL(x.location.replaced).origin,'https://example.org');
 x=context('hitop');assert.equal(vm.runInContext('SUPABASE_URL',x.c),'https://xaxbkdnrzsghsabkdvzj.supabase.co');assert.equal(vm.runInContext('OfficeStorage.local.getItem("buildings")',x.c),'["HITOP-only"]');vm.runInContext(login,x.c);x.el('loginEmail').value='existing@example.org';x.el('loginPassword').value='test-only';await x.events['loginBtn:click']();assert.equal(new URL(x.location.replaced).pathname,'/app/index.html');
 x=context('ktop',false);vm.runInContext(fs.readFileSync(root+'assets/js/auth.js','utf8'),x.c);assert.equal(await x.c.window.hitopAuthReady,false);assert.match(x.location.replaced,/office=ktop/);
 x=context('ktop',true);vm.runInContext(fs.readFileSync(root+'assets/js/auth.js','utf8'),x.c);assert.equal(await x.c.window.hitopAuthReady,true);assert.equal(vm.runInContext('headers.Authorization',x.c),'Bearer ktop-jwt');
 console.log('PASS: project routing, isolated drafts, office selector, successful/failed login, membership rejection, redirect restriction, HITOP compatibility and auth request gate');
})().catch(e=>{console.error(e);process.exit(1)});
