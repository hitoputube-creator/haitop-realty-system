import {tables,sanitize} from './sanitize.mjs';
const ktopUrl='https://enefadyhmhfphtochlku.supabase.co';
const ktopKey='sb_publishable__8Ru0l0wfQo8e5Ljq1ZQ7Q_LYtCAP-p';
const cors={'Access-Control-Allow-Origin':'https://hitoputube-creator.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, OPTIONS','Vary':'Origin','Content-Type':'application/json','Cache-Control':'no-store'};
export async function handle(req) {
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='GET')return reply({error:'Read only'},405);
 const table=new URL(req.url).searchParams.get('table');
 if(!tables.includes(table))return reply({error:'Unsupported reference type'},400);
 const token=req.headers.get('Authorization');
 if(!/^Bearer [\w.-]+$/.test(token||''))return reply({error:'Login required'},401);
 try {
  // KTOP JWT is validated by its issuing Auth server, never merely decoded.
  const authHeaders={apikey:ktopKey,Authorization:token};
  const auth=await fetch(ktopUrl+'/auth/v1/user',{headers:authHeaders,signal:AbortSignal.timeout(10000)});
  if(!auth.ok)return reply({error:'Invalid session'},401);
  const user=await auth.json();
  if(!user.id||!user.email||!user.email_confirmed_at)return reply({error:'Verified account required'},403);
  const membership=await fetch(ktopUrl+'/rest/v1/office_members?email=eq.'+encodeURIComponent(user.email.toLowerCase())+'&active=eq.true&select=email,active',{headers:authHeaders,signal:AbortSignal.timeout(10000)});
  if(!membership.ok)return reply({error:'Office access denied'},403);
  const members=await membership.json();
  if(!members.some(m=>m.email===user.email.toLowerCase()&&m.active===true))return reply({error:'Office access denied'},403);
  const sourceUrl=Deno.env.get('SUPABASE_URL');const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const rows=[];
  for(let offset=0;offset<10000;offset+=1000){
   const res=await fetch(sourceUrl+'/rest/v1/'+table+'?select=*&order='+ (table==='land_block_sources'?'block_id':'id')+'.asc&limit=1000&offset='+offset,{headers:{apikey:secret,Authorization:'Bearer '+secret},signal:AbortSignal.timeout(15000)});
   if(!res.ok)throw new Error('Source unavailable');
   const page=await res.json();rows.push(...page.map(row=>sanitize(table,row)).filter(Boolean));if(page.length<1000)return reply(rows);
  }
  return reply({error:'Reference result exceeds supported size'},503);
 }catch(_){return reply({error:'Shared reference temporarily unavailable'},503);}
}
Deno.serve(handle);
