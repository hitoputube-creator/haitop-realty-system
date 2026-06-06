/**
 * upload-buildings.js
 *
 * 엑셀(건물별 소유주명단.xlsx)을 읽어 Supabase buildings 테이블에
 * 건물별 호실 데이터를 한 번에 업로드합니다.
 *
 * ▶ 실행 방법 (scripts 폴더 안에서)
 *   node upload-buildings.js "D:/작업화일/.../파일명.xlsx"
 *
 * ▶ 패키지 설치 (최초 1회)
 *   npm install
 *
 * ▶ 저장 필드 구조 (한글 키)
 *   { 호수, 공실여부, 현업종, 소유주, 연락처,
 *     보증금, 월차임, 현_매매가격, 현_보증금, 현_월세,
 *     수익률, 비고, 전용_평, 분양_평, 평당가, 분양금액 }
 */

"use strict";

const SUPABASE_URL = "https://xaxbkdnrzsghsabkdvzj.supabase.co";
const SUPABASE_KEY = "sb_publishable_gqNFRMHb6yYKvqFnQurPKQ_7gGhURVd";

// ── 시트명 → 앱 건물명 매핑 ──────────────────────
// 여기에 없는 시트명은 시트명 그대로 사용
const NAME_MAP = {
  "아름터":  "아름터워",
  "현해":    "현해프라자",
  "트윈1":   "트윈타워 1차",
  "트윈2":   "트윈타워 2차",
  "홍원":    "홍원빌딩",
};

// ── 엑셀 컬럼 인덱스 (0-based)
const COL = {
  건물명:      0,   // A
  호수:        1,   // B
  전용평:      2,   // C
  분양평:      3,   // D
  평당가:      4,   // E
  분양금액:    5,   // F
  보증금:      6,   // G
  월차임:      7,   // H
  현업종:      8,   // I
  공실여부:    9,   // J
  현매매가격: 10,   // K
  현보증금:   11,   // L
  현월세:     12,   // M
  소유주:     13,   // N
  연락처:     14,   // O
  비고:       15,   // P
  추천매물:   16,   // Q
  수익률:     17,   // R
};

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('\n❌ 엑셀 파일 경로를 인자로 넘겨주세요.');
    console.error('   예: node upload-buildings.js "D:/작업화일/.../파일명.xlsx"\n');
    process.exit(1);
  }

  let XLSX;
  try { XLSX = require("xlsx"); }
  catch {
    console.error("\n❌ xlsx 패키지가 없습니다. npm install 을 먼저 실행하세요.\n");
    process.exit(1);
  }

  let fetchFn = globalThis.fetch;
  if (!fetchFn) {
    try { fetchFn = (...a) => import("node-fetch").then(m => m.default(...a)); }
    catch { fetchFn = null; }
  }
  if (!fetchFn) {
    console.error("\n❌ Node.js 18 이상 또는 npm install node-fetch 가 필요합니다.\n");
    process.exit(1);
  }

  console.log(`\n📂 엑셀 파일 읽는 중...\n   ${filePath}\n`);

  let workbook;
  try { workbook = XLSX.readFile(filePath, { cellDates: true }); }
  catch (e) { console.error("❌ 파일을 열 수 없습니다:", e.message); process.exit(1); }

  const sheetNames = workbook.SheetNames;
  console.log(`✅ 시트 ${sheetNames.length}개 발견`);
  console.log(`   ${sheetNames.join(" | ")}\n`);
  console.log("─".repeat(55));

  const reqHeaders = {
    "Content-Type":  "application/json",
    "apikey":        SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Prefer":        "resolution=merge-duplicates,return=minimal",
  };

  let totalBuildings = 0;
  let totalUnits     = 0;
  const errors       = [];

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows  = XLSX.utils.sheet_to_json(sheet, {
      header: 1, defval: "", blankrows: false,
    });

    const units = [];

    for (const row of rows) {
      const roomCell = row[COL.호수];
      // 호수가 숫자형이 아니면 헤더/합계행 → 건너뜀
      if (typeof roomCell !== "number" && !isPositiveNum(roomCell)) continue;

      // 공실여부 결정
      const vacantRaw = String(row[COL.공실여부] || "").trim();
      const hasBiz    = String(row[COL.현업종]   || "").trim() !== "";
      let 공실여부;
      if (vacantRaw)   공실여부 = "공실";
      else if (hasBiz) 공실여부 = "임차중";
      else             공실여부 = "공실";

      const 수익률raw = String(row[COL.수익률] || "").trim().replace(/%$/, "");

      units.push({
        호수:        String(roomCell).trim(),
        공실여부,
        현업종:      String(row[COL.현업종]  || "").trim()  || null,
        소유주:      String(row[COL.소유주]  || "").trim()  || null,
        연락처:      String(row[COL.연락처]  || "").trim()  || null,
        보증금:      toNum(row[COL.보증금])   || null,
        월차임:      toNum(row[COL.월차임])   || null,
        현_매매가격: toNum(row[COL.현매매가격]) || null,
        현_보증금:   toNum(row[COL.현보증금])  || null,
        현_월세:     toNum(row[COL.현월세])    || null,
        수익률:      수익률raw || null,
        비고:        String(row[COL.비고]     || "").trim() || null,
        전용_평:     toNum(row[COL.전용평])   || null,
        분양_평:     toNum(row[COL.분양평])   || null,
        평당가:      toNum(row[COL.평당가])   || null,
        분양금액:    toNum(row[COL.분양금액]) || null,
        updated_at:  new Date().toISOString(),
      });
    }

    if (!units.length) {
      console.log(`⚠️  [${sheetName}] 유효한 호실 없음 → 건너뜀`);
      continue;
    }

    try {
      // 시트명을 앱 건물명으로 변환 (매핑 없으면 시트명 그대로)
      const appName = NAME_MAP[sheetName.trim()] || sheetName.trim();

      const res = await fetchFn(`${SUPABASE_URL}/rest/v1/buildings?on_conflict=local_id`, {
        method:  "POST",
        headers: reqHeaders,
        body:    JSON.stringify({ local_id: appName, name: appName, units }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} → ${await res.text()}`);

      const mapped = appName !== sheetName.trim() ? ` → [${appName}]` : "";
      console.log(`✅ [${sheetName}]${mapped} 저장 완료  (${units.length}개 호실)`);
      totalBuildings++;
      totalUnits += units.length;
    } catch (e) {
      console.error(`❌ [${sheetName}] 저장 실패: ${e.message}`);
      errors.push({ sheetName, error: e.message });
    }
  }

  console.log("\n" + "═".repeat(55));
  console.log("📊 업로드 결과 요약");
  console.log("═".repeat(55));
  console.log(`  총 시트 수    : ${sheetNames.length} 개`);
  console.log(`  저장 완료     : ${totalBuildings} 개 건물  /  ${totalUnits} 개 호실`);
  if (errors.length) {
    console.log(`  저장 실패     : ${errors.length} 개`);
    errors.forEach(e => console.log(`    ✗ [${e.sheetName}] ${e.error}`));
  } else {
    console.log(`  오류          : 없음 ✨`);
  }
  console.log("═".repeat(55) + "\n");
}

function toNum(val) {
  if (val === "" || val == null) return 0;
  const n = Number(String(val).replace(/,/g, "").trim());
  return isFinite(n) ? n : 0;
}

function isPositiveNum(val) {
  if (val === "" || val == null) return false;
  const n = Number(String(val).trim());
  return isFinite(n) && n > 0;
}

main().catch(e => {
  console.error("\n❌ 예상치 못한 오류:", e.message);
  process.exit(1);
});
