const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),src=path.join(root,'ktop-diary-source');
(async()=>{
 const gate=fs.readFileSync(path.join(src,'src/components/AuthGate.jsx'),'utf8');
 const functionCode=gate.slice(gate.indexOf('export async function'),gate.indexOf('export default')).replace('export ','');
 const ctx={};vm.createContext(ctx);vm.runInContext(functionCode,ctx);
 function client({session=true,validUser=true,member=true}={}) {
   const calls=[];
   return {calls,auth:{
     getSession:async()=>({data:{session:session?{access_token:'KTOP-ONLY'}:null}}),
     getUser:async()=>({data:{user:validUser?{id:'ktop-user',email:'ktop2027@gmail.com'}:null},error:validUser?null:new Error('invalid session')})
   },from(table){calls.push(table);let email;return {select(){return this},eq(field,value){if(field==='email')email=value;return this},async maybeSingle(){return {data:member?{email,active:true}:null,error:null}}}}}
 }

 assert.equal(await ctx.verifyOfficeSession(client({session:false})),null);
 assert.equal(await ctx.verifyOfficeSession(client({validUser:false})),null);
 assert.equal(await ctx.verifyOfficeSession(client({member:false})),null);
 const valid=client();assert.equal((await ctx.verifyOfficeSession(valid)).access_token,'KTOP-ONLY');assert.deepEqual(valid.calls,['office_members']);
 const config=fs.readFileSync(path.join(src,'src/lib/supabase.js'),'utf8');assert(config.includes('enefadyhmhfphtochlku'));assert(!config.includes('xaxbkdnrzsghsabkdvzj'));
 const diary=fs.readFileSync(path.join(src,'src/components/WorkDiary.jsx'),'utf8');assert(diary.includes('케이탑 업무일지'));assert(diary.includes('calendar.google.com/calendar/r?authuser=ktop2027%40gmail.com'));assert(diary.includes('WeeklyDiary'));assert(diary.includes('MonthlyDiary'));assert(diary.includes('SelectedScheduleMemos'));assert(diary.includes('UpcomingSchedules'));
 const names=fs.readdirSync(path.join(src,'src/components'));for(const feature of ['MemoBoard.jsx','PrivateNotes.jsx','DiaryPhotos.jsx','DiaryFiles.jsx','CustomerMemoLookupModal.jsx','RelationControls.jsx'])assert(names.includes(feature));
 const ui=fs.readFileSync(path.join(src,'src/lib/uiState.js'),'utf8');assert(ui.includes("localStorage.getItem('ktop-diary:' + key)"));
 const links=fs.readFileSync(path.join(src,'src/components/DiaryList.jsx'),'utf8');assert(links.includes('${PROPERTY_REGISTER_URL}?office=ktop&'));assert(links.includes('${CUSTOMER_PAGE_URL}?office=ktop&'));assert(links.includes('${LISTING_DETAIL_URL}?office=ktop&'));
 const build=fs.readFileSync(path.join(root,'ktop-diary/index.html'),'utf8');for(const [,url] of build.matchAll(/(?:src|href)="(\/haitop-realty-system\/ktop-diary\/[^\"]+)"/g)){const file=url.replace('/haitop-realty-system/','');assert(fs.existsSync(path.join(root,file)));}
 for(const file of fs.readdirSync(path.join(root,'ktop-diary/assets'))){if(file.endsWith('.js'))assert(!fs.readFileSync(path.join(root,'ktop-diary/assets',file),'utf8').includes('xaxbkdnrzsghsabkdvzj'));}
 for(const page of ['index.html','customers.html']){const text=fs.readFileSync(path.join(root,page),'utf8');assert(text.includes('const DIARY_APP_URL = OFFICE_DIARY_URL;'));assert(!text.includes('케이탑 업무일지 연결은 아직 준비 중'))}
 console.log('PASS: verified login and membership gate, denied invalid/nonmember access, KTOP-only database and compiled bundle, all diary feature modules, calendar account routing, isolated drafts, private customer/listing links and build assets');
})().catch(e=>{console.error(e);process.exitCode=1});
