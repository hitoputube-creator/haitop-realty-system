// lookup-building-register
//
// 주소를 받아 법정동코드를 검색(StanReginCd)한 뒤, 국토교통부 건축HUB
// 건축물대장정보 서비스(BldRgstHubService, 표제부)를 조회해
// 연면적/주용도/층수/구조/사용승인일을 반환한다. BUILDING_REGISTER_API_KEY는
// 이 함수 안에서만 사용하며 프론트엔드에는 절대 노출하지 않는다.

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

// 자유 텍스트 주소를 최대한 파싱한다 — 실패하면 null.
// 회사가 파주시 관내에서만 영업하므로 시/군/구가 없으면 "파주시"를 기본값으로 둔다.
function parseAddress(address: string): ParsedAddress | null {
  const sigunguMatch = address.match(/([가-힣]+시|[가-힣]+군|[가-힣]+구)/);
  const sigunguName = sigunguMatch ? sigunguMatch[1] : "파주시";

  const dongMatches = [...address.matchAll(/[가-힣0-9]+(?:읍|면|동|리)/g)];
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

// 법정동코드 검색 (행정표준코드관리시스템, StanReginCd) → 5자리 시군구코드 + 5자리 법정동코드
async function lookupDongCode(sigunguName: string, dongName: string): Promise<{ sigunguCd: string; bjdongCd: string } | null> {
  if (!LEGAL_DONG_CODE_API_KEY) {
    throw new Error("LEGAL_DONG_CODE_API_KEY가 설정되지 않았습니다.");
  }
  const url = `https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList` +
    `?serviceKey=${LEGAL_DONG_CODE_API_KEY}` +
    `&type=json&pageNo=1&numOfRows=20` +
    `&locatadd_nm=${encodeURIComponent(`${sigunguName} ${dongName}`)}`;

  const res = await fetch(url, {
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

// 건축HUB 건축물대장정보 서비스 — 표제부(연면적/주용도/층수/구조/사용승인일)
async function lookupBuildingRegister(parsed: ParsedAddress) {
  const codes = await lookupDongCode(parsed.sigunguName, parsed.dongName);
  if (!codes) throw new Error(`"${parsed.sigunguName} ${parsed.dongName}"에 대한 법정동코드를 찾지 못했습니다.`);

  const url = `https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo` +
    `?ServiceKey=${BUILDING_REGISTER_API_KEY}` +
    `&_type=json` +
    `&sigunguCd=${codes.sigunguCd}` +
    `&bjdongCd=${codes.bjdongCd}` +
    `&platGbCd=${parsed.platGbCd}` +
    `&bun=${parsed.bun.padStart(4, "0")}` +
    `&ji=${parsed.ji.padStart(4, "0")}` +
    `&numOfRows=5`;

  const res = await fetch(url);
  const rawText = await res.text();

  if (!res.ok) {
    console.error(`[lookup-building-register] HTTP ${res.status} ${res.statusText}`);
    throw new Error(`건축물대장 조회 실패 (${res.status} ${res.statusText})`);
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch (parseErr) {
    console.error(`[lookup-building-register] 응답이 JSON이 아님: ${String(parseErr)}`);
    throw new Error("건축물대장 응답 파싱 실패 (JSON 형식이 아닙니다)");
  }

  const header = data?.response?.header;
  if (header && header.resultCode && header.resultCode !== "00") {
    console.error(`[lookup-building-register] resultCode=${header.resultCode} resultMsg=${header.resultMsg}`);
    throw new Error(`건축물대장 조회 실패: resultCode=${header.resultCode} resultMsg=${header.resultMsg || "(메시지 없음)"}`);
  }

  const items = data?.response?.body?.items?.item;
  const item = Array.isArray(items) ? items[0] : items;
  return { raw: data, item: item ?? null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST 요청만 지원합니다." }, 405);
  }
  if (!BUILDING_REGISTER_API_KEY) {
    return jsonResponse({ error: "BUILDING_REGISTER_API_KEY가 설정되지 않았습니다." }, 500);
  }

  let body: { address?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "요청 본문이 유효한 JSON이 아닙니다." }, 400);
  }

  const address = (body.address || "").trim();
  if (!address) {
    return jsonResponse({ error: "조회할 주소(address)가 없습니다." }, 400);
  }

  const parsed = parseAddress(address);
  if (!parsed) {
    return jsonResponse({ error: `주소("${address}")에서 지번을 인식하지 못했습니다. 동/리와 번지를 포함해 입력해주세요.` }, 400);
  }

  let raw: unknown;
  let item: Record<string, unknown> | null;
  try {
    const result = await lookupBuildingRegister(parsed);
    raw = result.raw;
    item = result.item;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[lookup-building-register] ${message}`);
    return jsonResponse({ error: message }, 502);
  }

  if (!item) {
    return jsonResponse({ error: "해당 주소의 건축물대장 정보를 찾을 수 없습니다." }, 404);
  }

  const totArea = Number(item.totArea);
  const areaM2 = Number.isFinite(totArea) && totArea > 0 ? totArea : null;

  const grndFlrCnt = item.grndFlrCnt ? String(item.grndFlrCnt) : null;
  const ugrndFlrCnt = item.ugrndFlrCnt ? String(item.ugrndFlrCnt) : null;
  const floorInfo = grndFlrCnt
    ? (ugrndFlrCnt && ugrndFlrCnt !== "0" ? `지상 ${grndFlrCnt}층/지하 ${ugrndFlrCnt}층` : `지상 ${grndFlrCnt}층`)
    : null;

  const detailParts = [
    item.mainPurpsCdNm ? `주용도: ${item.mainPurpsCdNm}` : null,
    floorInfo ? `층수: ${floorInfo}` : null,
    item.strctCdNm ? `구조: ${item.strctCdNm}` : null,
    item.useAprDay ? `사용승인일: ${item.useAprDay}` : null,
  ].filter(Boolean);

  return jsonResponse({
    area_m2: areaM2,
    floor_info: floorInfo,
    main_purpose: item.mainPurpsCdNm || null,
    structure: item.strctCdNm || null,
    use_apr_day: item.useAprDay || null,
    detail_note: detailParts.length ? `[건축물대장 조회 결과]\n${detailParts.join("\n")}` : null,
    raw,
  });
});
