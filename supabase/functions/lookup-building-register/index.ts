// lookup-building-register
//
// 주소(+선택적으로 호수/동)를 받아 법정동코드를 검색(StanReginCd)한 뒤
// 국토교통부 건축HUB 건축물대장정보 서비스(BldRgstHubService)를 조회한다.
// - 표제부(getBrTitleInfo): 건물 전체 정보 — 주용도/구조/사용승인일, (호수 미지정 시) 연면적
// - 전유부 면적(getBrExposPubuseAreaInfo, hoNm 지정 시): 해당 호실의 실제 전유면적
//   집합건물(오피스텔/상가 등)은 표제부의 연면적이 건물 "전체" 면적이라 호실별
//   면적과 다르므로, hoNm이 주어지면 전유부 면적 조회 결과를 우선 사용한다.
//   동·호수가 일치하지 않으면 세대 면적을 반환하지 않는다.
// BUILDING_REGISTER_API_KEY는 이 함수 안에서만 사용하며 프론트엔드에는 절대
// 노출하지 않는다.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUILDING_REGISTER_API_KEY_RAW = Deno.env.get("BUILDING_REGISTER_API_KEY");
const LEGAL_DONG_CODE_API_KEY_RAW = Deno.env.get("LEGAL_DONG_CODE_API_KEY");

// data.go.kr 마이페이지는 서비스키를 Encoding(이미 %인코딩됨)과 Decoding(원본,
// +  /  = 등 특수문자 포함) 두 버전으로 제공한다. 어느 버전이 시크릿에 등록되어
// 있어도 URL 쿼리스트링에 안전하게 들어가도록, 이미 인코딩된 값이면 그대로 쓰고
// 아니면 encodeURIComponent로 인코딩한다.
function normalizeServiceKey(key: string | undefined): string | undefined {
  if (!key) return key;
  return key.includes("%") ? key : encodeURIComponent(key);
}

const BUILDING_REGISTER_API_KEY = normalizeServiceKey(BUILDING_REGISTER_API_KEY_RAW);
const LEGAL_DONG_CODE_API_KEY = normalizeServiceKey(LEGAL_DONG_CODE_API_KEY_RAW);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

interface ParsedAddress {
  sigunguName: string;
  dongName: string;
  platGbCd: "0" | "1";
  bun: string;
  ji: string;
}

interface Codes {
  sigunguCd: string;
  bjdongCd: string;
}

// 자유 텍스트 주소를 최대한 파싱한다 — 실패하면 null.
// 회사가 파주시 관내에서만 영업하므로 시/군/구가 없으면 "파주시"를 기본값으로 둔다.
function parseAddress(address: string): ParsedAddress | null {
  address = address.replace(/\([^)]*\)/g, "").replace(/（[^）]*）/g, "").split(",")[0].trim();
  const sigunguMatch = address.match(/([가-힣]+시|[가-힣]+군|[가-힣]+구)/);
  const sigunguName = sigunguMatch ? sigunguMatch[1] : "파주시";

  // 법정동 이름은 항상 번지 앞(콤마 이전)에 온다. "와동동 1471-2, 103동 4802호"처럼
  // 콤마 뒤에 건물 동/호수가 오면 "103동"도 "숫자+동" 패턴에 걸려 법정동으로
  // 착각할 수 있어, 콤마 이전 구간에서만 법정동을 찾는다.
  const commaIdx = address.indexOf(",");
  const dongSearchArea = commaIdx === -1 ? address : address.slice(0, commaIdx);
  const dongMatches = [...dongSearchArea.matchAll(/[가-힣]+(?:읍|면|동|리)(?=\s|$)/g)];
  if (dongMatches.length === 0) return null;
  const dongName = dongMatches[dongMatches.length - 1][0];

  const afterDong = address.slice(address.lastIndexOf(dongName) + dongName.length);
  const isMountain = /^\s*산/.test(afterDong);
  const lotMatch = afterDong.match(/(\d+)(?:-(\d+))?/);
  if (!lotMatch) return null;

  return {
    sigunguName,
    dongName,
    platGbCd: isMountain ? "1" : "0",
    bun: lotMatch[1],
    ji: lotMatch[2] || "0",
  };
}

// data.go.kr 게이트웨이가 가끔 일시적으로 500을 던진다(실측 확인 — 연속 2번
// 실패한 사례도 있어 최대 2회까지 재시도한다). 5xx일 때만 짧은 대기 후
// 재시도한다. 4xx는 재시도해도 소용없으므로 바로 반환한다.
async function fetchWithRetry(url: string, init?: RequestInit, retries = 2, delayMs = 400): Promise<Response> {
  let res = await fetch(url, init);
  for (let attempt = 0; attempt < retries && res.status >= 500; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    res = await fetch(url, init);
  }
  return res;
}

// 법정동코드 검색 (행정표준코드관리시스템, StanReginCd) → 5자리 시군구코드 + 5자리 법정동코드
async function lookupDongCode(sigunguName: string, dongName: string): Promise<Codes | null> {
  if (!LEGAL_DONG_CODE_API_KEY) {
    throw new Error("LEGAL_DONG_CODE_API_KEY가 설정되지 않았습니다.");
  }
  const url = `https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList` +
    `?serviceKey=${LEGAL_DONG_CODE_API_KEY}` +
    `&type=json&pageNo=1&numOfRows=20` +
    `&locatadd_nm=${encodeURIComponent(`${sigunguName} ${dongName}`)}`;

  const res = await fetchWithRetry(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; hitop-realty-system/1.0)" },
  });
  if (!res.ok) {
    throw new Error(`법정동코드 검색 실패 (${res.status})`);
  }
  const data = await res.json();

  const rows = data?.StanReginCd?.[1]?.row ?? [];
  const match = rows.find((r: Record<string, unknown>) =>
    typeof r.locatadd_nm === "string" && r.locatadd_nm.includes(dongName) && !r.locatadd_nm.includes("산")
  ) ?? rows[0];
  if (!match?.region_cd) return null;

  const code = String(match.region_cd);
  return { sigunguCd: code.slice(0, 5), bjdongCd: code.slice(5, 10) };
}

function bldRgstHubUrl(op: string, codes: Codes, parsed: ParsedAddress): string {
  return `https://apis.data.go.kr/1613000/BldRgstHubService/${op}` +
    `?ServiceKey=${BUILDING_REGISTER_API_KEY}` +
    `&_type=json` +
    `&sigunguCd=${codes.sigunguCd}` +
    `&bjdongCd=${codes.bjdongCd}` +
    `&platGbCd=${parsed.platGbCd}` +
    `&bun=${parsed.bun.padStart(4, "0")}` +
    `&ji=${parsed.ji.padStart(4, "0")}`;
}


// 지번에 연결된 모든 표제부를 읽고 요청한 동을 선택한다. 첫 행을 임의로 선택하지 않는다.
function normalizedUnit(value: unknown, suffix: string): string {
  let text = String(value || "").replace(/\s+/g, "").replace(/^제/, "").replace(new RegExp(suffix + "$"), "");
  if (/^\d+$/.test(text)) text = String(Number(text));
  return text;
}
function rowDong(row: any): string {
  if (row.dongNm) {
    const suffix = String(row.dongNm).match(/(?:제)?(\d+)\s*동\s*$/);
    return suffix ? normalizedUnit(suffix[1], "동") : normalizedUnit(row.dongNm, "동");
  }
  const match = String(row.bldNm || "").match(/(?:제)?(\d+)\s*동\s*$/);
  return match ? normalizedUnit(match[1], "동") : "";
}
async function readHubRows(op: string, codes: Codes, parsed: ParsedAddress, extra = ""): Promise<any[]> {
  const rows: any[] = [];
  const maxPages = 20;
  for (let page = 1; page <= maxPages; page++) {
    const response = await fetchWithRetry(bldRgstHubUrl(op, codes, parsed) + extra + "&numOfRows=100&pageNo=" + page,
      {signal: AbortSignal.timeout(18000)});
    if (!response.ok) throw new Error("건축물대장 조회 실패 (" + response.status + ")");
    let data: any;
    try { data = await response.json(); } catch { throw new Error("건축물대장 응답이 JSON 형식이 아닙니다."); }
    const header = data?.response?.header;
    if (header?.resultCode && !["00", "0", "000"].includes(String(header.resultCode))) {
      throw new Error("건축물대장 조회 실패: " + (header.resultMsg || header.resultCode));
    }
    const value = data?.response?.body?.items?.item;
    const items = Array.isArray(value) ? value : value ? [value] : [];
    rows.push(...items);
    const total = Number(data?.response?.body?.totalCount || 0);
    if (!items.length || page * 100 >= total) return rows;
    if (page === maxPages) throw new Error("조회 결과가 너무 많아 해당 건물을 정확히 확인할 수 없습니다.");
  }
  return rows;
}
function uniqueRows(rows: any[]): any[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    const key = JSON.stringify(Object.entries(row).filter(([key]) => !["rnum"].includes(key)).sort(([a],[b]) => a.localeCompare(b)));
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
function selectTitle(rows: any[], requestedDong: string): any {
  const dong = normalizedUnit(requestedDong, "동");
  let candidates = uniqueRows(rows);
  if (dong) candidates = candidates.filter(row => rowDong(row) === dong);
  const main = candidates.filter(row => String(row.mainAtchGbCdNm || "").includes("주"));
  if (main.length) candidates = main;
  // 같은 대장 PK의 중복 행만 합친다. 동이 없는 요청도 후보가 하나인 경우에만 선택한다.
  const grouped = new Map<string, any>();
  for (const row of candidates) grouped.set(String(row.mgmBldrgstPk || JSON.stringify(row)), row);
  if (grouped.size !== 1) return null;
  return [...grouped.values()][0];
}
interface UnitAreaInfo {
  exclusiveArea: number;
  commonArea: number | null;
  unitPurpose: string | null;
  unitFloor: string | null;
  unitDong: string;
  unitHo: string;
  structure: string | null;
  buildingName: string | null;
}
function selectUnit(rows: any[], ho: string, dong: string): UnitAreaInfo | null {
  const requestedHo = normalizedUnit(ho, "호"), requestedDong = normalizedUnit(dong, "동");
  let matching = uniqueRows(rows).filter(row => normalizedUnit(row.hoNm, "호") === requestedHo);
  if (requestedDong) matching = matching.filter(row => rowDong(row) === requestedDong);
  const exclusive = matching.filter(row => String(row.exposPubuseGbCd) === "1" && Number(row.area) > 0);
  if (!exclusive.length) return null;
  const groups = new Set(exclusive.map(row => rowDong(row) + "|" + String(row.mgmBldrgstPk || "")));
  if (groups.size !== 1) return null;
  const picked = exclusive[0];
  const numericArea = (row: any) => Number.isFinite(Number(row.area)) && Number(row.area) > 0 ? Number(row.area) : 0;
  const exclusiveArea = exclusive.reduce((sum, row) => sum + numericArea(row), 0);
  const common = matching.filter(row => String(row.exposPubuseGbCd) === "2" &&
    rowDong(row) === rowDong(picked) &&
    (!picked.mgmBldrgstPk || !row.mgmBldrgstPk || row.mgmBldrgstPk === picked.mgmBldrgstPk));
  const commonArea = common.length ? common.reduce((sum, row) => sum + numericArea(row), 0) : null;
  const floor = Number(picked.flrNo);
  const unitFloor = Number.isFinite(floor) && floor !== 0
    ? (String(picked.flrGbCdNm || "").includes("지하") || floor < 0 ? "지하 " : "") + Math.abs(floor) + "층" : null;
  return {exclusiveArea:Math.round(exclusiveArea*10000)/10000,
    commonArea:commonArea == null ? null : Math.round(commonArea*10000)/10000,
    unitPurpose:picked.mainPurpsCdNm || null,unitFloor,unitDong:rowDong(picked),
    unitHo:requestedHo,structure:picked.strctCdNm || null,buildingName:picked.bldNm || null};
}
async function lookupExclusiveArea(codes: Codes, parsed: ParsedAddress, ho: string, dong: string): Promise<UnitAreaInfo | null> {
  const normalizedHo = normalizedUnit(ho, "호");
  // "1302"와 "1302호" 표기를 모두 지원하고 응답에서도 다시 동·호수를 검증한다.
  for (const query of [normalizedHo, normalizedHo + "호"]) {
    const rows = await readHubRows("getBrExposPubuseAreaInfo", codes, parsed, "&hoNm=" + encodeURIComponent(query));
    const selected = selectUnit(rows, normalizedHo, dong);
    if (selected) return selected;
  }
  return null;
}
function numericField(row: any, key: string): number | null {
  const value = row?.[key];
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
function parkingTotal(row: any): number | null {
  const declaredTotal = numericField(row, "totPkngCnt");
  if (declaredTotal != null) return declaredTotal;
  const values = ["indrMechUtcnt","oudrMechUtcnt","indrAutoUtcnt","oudrAutoUtcnt"].map(key => numericField(row,key));
  // 누락된 항목을 0으로 추정하여 단지 전체라고 표시하지 않는다.
  return values.every(value => value != null) ? values.reduce((sum: number,value) => sum + (value || 0),0) : null;
}
function selectRecap(rows: any[], title: any): any {
  const unique = uniqueRows(rows);
  if (unique.length === 1) return unique[0];
  const name = String(title.bldNm || "").replace(/\s+/g,"").replace(/\d+동$/,"");
  const matching = name ? unique.filter(row => String(row.bldNm || "").replace(/\s+/g,"") === name) : [];
  return matching.length === 1 ? matching[0] : null;
}
async function queryBuildingRegister(body: any) {
  const address = String(body.address || "").trim();
  const ho = normalizedUnit(body.hoNm, "호"), dong = normalizedUnit(body.dongNm, "동");
  if (!address || address.length > 500) throw new Error("조회할 지번주소를 입력해주세요.");
  const parsed = parseAddress(address);
  if (!parsed) throw new Error("지번주소에서 동/리와 번지를 확인하지 못했습니다.");
  const codes = await lookupDongCode(parsed.sigunguName, parsed.dongName);
  if (!codes) throw new Error("주소의 법정동코드를 확인하지 못했습니다.");
  const titles = await readHubRows("getBrTitleInfo", codes, parsed);
  if (body.scope === "complex") {
    if (ho || dong) throw new Error("단지 기본정보 조회에는 동·호수를 입력하지 않습니다.");
    const recap = selectRecap(await readHubRows("getBrRecapTitleInfo",codes,parsed),{bldNm:body.buildingName || ""});
    if (!recap) throw new Error("해당 주소의 총괄표제부를 하나로 확인하지 못했습니다. 단지명과 지번주소를 확인해주세요.");
    const buildings = [...new Map(uniqueRows(titles).map(row=>[String(row.mgmBldrgstPk || JSON.stringify(row)),row])).values()];
    const residential = buildings.filter(row=>/아파트|공동주택/.test(String(row.mainPurpsCdNm || "")+String(row.etcPurps || "")));
    const numberedResidential = residential.filter(row=>/^\d+$/.test(rowDong(row)));
    const main = numberedResidential.length ? numberedResidential : residential.length ? residential : buildings.filter(row=>String(row.mainAtchGbCdNm || "").includes("주"));
    const relevant = main.length ? main : buildings;
    const distinct = (key: string) => [...new Set(relevant.map(row=>String(row[key] || "").trim()).filter(Boolean))];
    const above = relevant.map(row=>numericField(row,"grndFlrCnt")).filter(value=>value!=null && value>0) as number[];
    const below = relevant.map(row=>numericField(row,"ugrndFlrCnt")).filter(value=>value!=null) as number[];
    const range = (values: number[]) => Math.min(...values)===Math.max(...values) ? String(values[0]) : Math.min(...values)+"~"+Math.max(...values);
    const floorInfo = above.length ? "지상 "+range(above)+"층"+(below.length && Math.max(...below)>0 ? "/지하 "+Math.max(...below)+"층" : "") : null;
    const structures=distinct("strctCdNm"),dates=distinct("useAprDay"),purposes=distinct("mainPurpsCdNm");
    const sumArea=(key: string)=>{const values=buildings.map(row=>numericField(row,key));return values.length && values.every(value=>value!=null) ? Math.round(values.reduce((sum:number,value)=>sum+(value || 0),0)*10000)/10000 : null;};
    const total=numericField(recap,"totArea") ?? sumArea("totArea");
    const footprint=numericField(recap,"archArea") ?? sumArea("archArea");
    const parking=parkingTotal(recap);
    return {area_m2:total,total_area_m2:total,land_area_m2:numericField(recap,"platArea"),footprint_area_m2:footprint,
      building_name:recap.bldNm || body.buildingName || null,building_scope:"단지 전체",building_match_verified:true,
      parking_count:parking,parking_scope:"단지 전체",parking_warning:parking==null ? "총괄표제부의 주차대수를 확인하지 못했습니다." : null,
      structure:structures.length ? structures.join(" / ") : recap.strctCdNm || null,
      main_purpose:recap.mainPurpsCdNm || purposes.join(" / ") || null,floor_info:floorInfo,
      use_apr_day:dates.length===1 ? dates[0] : recap.useAprDay || null,
      exclusive_area_m2:null,common_area_m2:null,supply_area_m2:null,unit_area_warning:false,
      queried_lot:{sigungu:parsed.sigunguName,dong:parsed.dongName,bun:parsed.bun,ji:parsed.ji},lookup_version:"20261007-exact-building"};
  }
  const title = selectTitle(titles, dong);
  if (!title) throw new Error(dong ? dong + "동의 표제부를 확인하지 못했습니다. 주소와 동을 확인해주세요." : "같은 지번에 여러 건물이 있습니다. 동을 입력해주세요.");
  const unit = ho ? await lookupExclusiveArea(codes, parsed, ho, dong || rowDong(title)) : null;
  if (unit && rowDong(title) && unit.unitDong !== rowDong(title)) throw new Error("표제부와 전유부의 동이 일치하지 않습니다.");
  const apartment = /아파트|공동주택/.test(String(title.mainPurpsCdNm || "") + String(unit?.unitPurpose || "")) || body.apartment === true;
  let recap: any = null, parkingWarning = "";
  if (apartment) {
    try { recap = selectRecap(await readHubRows("getBrRecapTitleInfo",codes,parsed),title); }
    catch { parkingWarning = "단지 전체 주차대수를 확인하지 못했습니다."; }
  }
  const parking = apartment ? parkingTotal(recap) : parkingTotal(title);
  if (apartment && parking == null) parkingWarning = "단지 전체 주차대수를 확인하지 못했습니다.";
  const above = title.grndFlrCnt, below = title.ugrndFlrCnt;
  const floorInfo = above != null && above !== "" ? "지상 " + above + "층" +
    (below != null && Number(below) > 0 ? "/지하 " + below + "층" : "") : null;
  const unitWarning = !!ho && !unit;
  return {
    area_m2:ho ? unit?.exclusiveArea ?? null : numericField(title,"totArea"),
    building_name:title.bldNm || unit?.buildingName || null,
    dong_name:rowDong(title) ? rowDong(title) + "동" : title.dongNm || null,
    unit_dong_name:unit ? unit.unitDong + "동" : null,
    unit_ho_name:unit ? unit.unitHo + "호" : null,
    unit_floor:unit?.unitFloor || null,
    exclusive_area_m2:unit?.exclusiveArea ?? null,
    common_area_m2:unit?.commonArea ?? null,
    supply_area_m2:unit?.commonArea != null ? Math.round((unit.exclusiveArea + unit.commonArea)*10000)/10000 : null,
    total_area_m2:numericField(title,"totArea"),land_area_m2:numericField(title,"platArea"),
    footprint_area_m2:numericField(title,"archArea"),
    parking_count:parking,parking_scope:apartment ? "단지 전체" : "건물 전체",parking_warning:parkingWarning || null,
    unit_purpose:unit?.unitPurpose || null,floor_info:floorInfo,
    main_purpose:title.mainPurpsCdNm || null,structure:unit?.structure || title.strctCdNm || null,
    use_apr_day:title.useAprDay || null,unit_area_warning:unitWarning,
    queried_lot:{sigungu:parsed.sigunguName,dong:parsed.dongName,bun:parsed.bun,ji:parsed.ji},
    building_match_verified:true,lookup_version:"20261007-exact-building",
    detail_note:unitWarning ? "해당 동·호수의 전유부를 확인하지 못했습니다. 세대 면적은 자동입력하지 않습니다." : null
  };
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null,{status:204,headers:CORS_HEADERS});
  if (req.method !== "POST") return jsonResponse({error:"POST 요청만 지원합니다."},405);
  if (!BUILDING_REGISTER_API_KEY) return jsonResponse({error:"건축물대장 API 설정을 확인해주세요."},500);
  try { return jsonResponse(await queryBuildingRegister(await req.json())); }
  catch (error) {
    const message = error instanceof Error ? error.message : "건축물대장 조회에 실패했습니다.";
    console.error("[lookup-building-register] " + message);
    return jsonResponse({error:message},422);
  }
});
