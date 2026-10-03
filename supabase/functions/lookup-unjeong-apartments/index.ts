// K-apt: source-backed names and TOTAL households, never estimated occupancy.
// KAPT_API_KEY can be set separately; existing data.go.kr key is reused only server-side.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: {...cors, 'Content-Type':'application/json'},
});
const key = Deno.env.get('KAPT_API_KEY') || Deno.env.get('BUILDING_REGISTER_API_KEY');
const checkedOn = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul'}).format(new Date());
const tag = (xml: string, name: string) => {
  const raw = xml.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>'))?.[1] || '';
  return raw.replace(/^<!\[CDATA\[|\]\]>$/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim();
};
async function api(service: string, op: string, params: Record<string, string>) {
  if (!key) throw new Error('공공데이터 인증키 연결이 필요합니다. 단지 목록·기본 정보 서비스 활용신청 후 KAPT_API_KEY를 등록해주세요.');
  let rawKey = key;
  try { rawKey = decodeURIComponent(key); } catch { /* raw decoding key */ }
  const url = new URL('https://apis.data.go.kr/1613000/' + service + '/' + op);
  url.searchParams.set('serviceKey', rawKey);
  url.searchParams.set('_type', 'json');
  for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
  const res = await fetch(url, {signal:AbortSignal.timeout(15000)});
  const body = await res.text();
  if (/SERVICE_ACCESS_DENIED|SERVICE_KEY_IS_NOT_REGISTERED|PERMISSION_DENIED|<returnReasonCode>(20|30)</.test(body) || [401,403].includes(res.status)) {
    throw new Error('공공데이터포털에서 공동주택 단지 목록·기본 정보 서비스의 활용신청 승인을 확인해주세요.');
  }
  if (!res.ok) throw new Error('공공데이터 조회가 지연되고 있습니다. 잠시 후 다시 시도해주세요.');
  if (body.trim().startsWith('<')) {
    const code = tag(body,'resultCode') || tag(body,'returnReasonCode');
    if (code && !['00','0','000'].includes(code)) throw new Error('공공데이터 조회 오류 (' + code + '). 인증키·활용신청 상태를 확인해주세요.');
    const items = Array.from(body.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g), m => {
      const row: Record<string,string> = {};
      for (const field of ['kaptCode','kaptName','kaptAddr','doroJuso','bjdCode','kaptdaCnt','kaptUsedate','useYn']) row[field] = tag(m[1],field);
      return row;
    });
    return {items, total:Number(tag(body,'totalCount') || items.length)};
  }
  let data;
  try { data = JSON.parse(body); } catch { throw new Error('공공데이터 응답을 읽지 못했습니다.'); }
  const header = data?.response?.header || data?.header;
  if (header?.resultCode !== undefined && !['00','0','000'].includes(String(header.resultCode))) throw new Error('공공데이터 조회 오류 (' + header.resultCode + '). 인증키·활용신청 상태를 확인해주세요.');
  const content = data?.response?.body || data?.body || data;
  const value = content?.items?.item ?? content?.items ?? content?.item ?? [];
  const items = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
  return {items, total:Number(content?.totalCount ?? items.length)};
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers:cors});
  if (req.method !== 'POST') return reply({error:'POST 요청이 필요합니다.'},405);
  try {
    const auth = req.headers.get('Authorization') || '';
    const base = Deno.env.get('SUPABASE_URL')!;
    const apiKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const headers = {Authorization:auth, apikey:apiKey, 'Content-Type':'application/json'};
    const user = await fetch(base + '/auth/v1/user', {headers,signal:AbortSignal.timeout(8000)});
    if (!user.ok) return reply({error:'로그인이 필요합니다.'},401);
    const admin = await fetch(base + '/rest/v1/rpc/is_admin', {method:'POST',headers,body:'{}',signal:AbortSignal.timeout(8000)});
    if (!admin.ok || await admin.json() !== true) return reply({error:'관리자 권한이 필요합니다.'},403);
    const input = await req.json();
    if (input.action === 'list') {
      const page = Number(input.page || 1);
      if (!Number.isInteger(page) || page < 1 || page > 10) return reply({error:'페이지를 확인해주세요.'},400);
      const result = await api('AptListService3','getSigunguAptList3',{sigunguCode:'41480',pageNo:String(page),numOfRows:'500'});
      if (!result.items.length && page === 1) throw new Error('파주시 단지 목록이 비어 있습니다. 기존 정보는 유지됩니다.');
      return reply({items:result.items.map((r: Record<string, unknown>) => ({id:String(r.kaptCode || ''),name:String(r.kaptName || ''),bjdCode:String(r.bjdCode || '')})).filter((r: {id:string})=>/^A?\d{6,20}$/.test(r.id)),total:result.total,pageSize:500});
    }
    if (input.action === 'detail') {
      const id = String(input.id || '');
      if (!/^A?\d{6,20}$/.test(id)) return reply({error:'단지코드를 확인해주세요.'},400);
      const result = await api('AptBasisInfoServiceV4','getAphusBassInfoV4',{kaptCode:id});
      const r = result.items.find((r: Record<string, unknown>)=>String(r.kaptCode)===id);
      const households = Number(r?.kaptdaCnt);
      if (!r?.kaptName || !Number.isInteger(households) || households < 1 || households > 100000) throw new Error('이 단지의 아파트명·총 세대수를 확인하지 못했습니다. 기존 정보는 유지됩니다.');
      if (r.useYn === 'N') throw new Error('사용 중인 단지정보가 아닙니다. 기존 정보는 유지됩니다.');
      return reply({apartment:{id, name:String(r.kaptName), households,
        address:String(r.kaptAddr || r.doroJuso || ''), approval_date:String(r.kaptUsedate || ''),
        source_url:'https://www.data.go.kr/data/15058453/openapi.do', checked_on:checkedOn()}});
    }
    return reply({error:'조회 작업을 확인해주세요.'},400);
  } catch (err) {
    const message = err instanceof Error && err.name !== 'TimeoutError' && !/fetch|network/i.test(err.message) ? err.message : '조회 연결이 지연되고 있습니다. 기존 정보를 유지하고 잠시 후 다시 시도해주세요.';
    return reply({error:message},502);
  }
});
