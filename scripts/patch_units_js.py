import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('building-detail.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 호실 현황 로직 IIFE 블록 찾기
start_line = None
end_line = None
for i, line in enumerate(lines):
    if '호실 현황 로직' in line:
        start_line = i - 1
    if start_line and i > start_line and '})();' in line and end_line is None:
        end_line = i
        break

print(f"JS block: 라인 {start_line}~{end_line}")

NEW_JS = """/* ======================================================
   호실 현황 로직
   - window._loadBuildingUnits 로 init() 완료 후 안전하게 호출
   - 건물명(#buildingName DOM) -> local_id 로 Supabase 조회
====================================================== */
(function () {
  "use strict";

  const $ = id => document.getElementById(id);

  let units       = [];
  let editIdx     = -1;
  let filterFloor = "전체";
  let bName       = "";

  function fmt(n) {
    const v = Number(n);
    return (v && isFinite(v)) ? v.toLocaleString("ko-KR") : "-";
  }

  // 호수 -> 층 번호 문자열: 101->1, 201->2, 1001->10, B101->B1
  function floorOf(room) {
    const s = String(room || "").trim();
    const bm = s.match(/^[Bb](\\d)/);
    if (bm) return "B" + bm[1];
    const nm = s.match(/^(\\d+)/);
    if (nm) {
      const n = parseInt(nm[1], 10);
      if (n >= 1000) return String(Math.floor(n / 100));
      if (n >= 100)  return String(Math.floor(n / 100));
      return String(n);
    }
    return "기타";
  }

  function floorLabel(f) {
    if (f === "전체") return "전체";
    return f + "층";
  }

  // 건물명 읽기 (DOM 갱신 대기)
  async function getBuildingName() {
    let name = ($("buildingName") || {}).textContent || "";
    if (!name || name === "건물 상세") {
      for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 500));
        name = ($("buildingName") || {}).textContent || "";
        if (name && name !== "건물 상세") break;
      }
    }
    return name;
  }

  // 초기 로드 (init() 완료 후 호출)
  async function loadUnits() {
    bName = await getBuildingName();
    if (!bName) {
      console.warn("[호실현황] 건물명 없음 - 건너뜀");
      return;
    }
    console.log("[호실현황] 건물명:", bName);
    try {
      const rec = await getBuildingRecord(bName);
      units = Array.isArray(rec && rec.units) ? rec.units : [];
      console.log("[호실현황] 호실 수:", units.length);
    } catch(e) {
      if (typeof showToast === "function") showToast("호실 로드 실패: " + e.message);
      console.error("[호실현황] 로드 실패:", e);
      units = [];
    }
    renderAll();
  }

  // init() 완료 후 외부에서 호출
  window._loadBuildingUnits = loadUnits;

  function renderAll() {
    renderSummary();
    renderFloorTabs();
    renderTable();
  }

  function renderSummary() {
    const occ  = units.filter(u => u.공실여부 === "임차중").length;
    const vac  = units.filter(u => u.공실여부 === "공실").length;
    const sale = units.filter(u => u.공실여부 === "매매가능").length;
    const rev  = units.reduce((s, u) => s + (Number(u.월차임) || 0), 0);
    $("sumOccupied").textContent = occ;
    $("sumVacant").textContent   = vac;
    $("sumForSale").textContent  = sale;
    $("sumRevenue").textContent  = rev ? rev.toLocaleString("ko-KR") : "-";
  }

  function renderFloorTabs() {
    const seen = {};
    const floors = [];
    units.forEach(u => {
      const f = floorOf(u.호수);
      if (f && !seen[f]) { seen[f] = true; floors.push(f); }
    });
    floors.sort((a, b) => {
      if (a.startsWith("B") && !b.startsWith("B")) return -1;
      if (!a.startsWith("B") && b.startsWith("B")) return 1;
      return parseInt(a.replace("B","")) - parseInt(b.replace("B",""));
    });

    const tabs = ["전체"].concat(floors);
    $("unitFloorTabs").innerHTML = tabs.map(f =>
      `<button class="ftab${f === filterFloor ? " active" : ""}" data-floor="${f}">${floorLabel(f)}</button>`
    ).join("");

    $("unitFloorTabs").querySelectorAll(".ftab").forEach(btn => {
      btn.addEventListener("click", () => {
        filterFloor = btn.dataset.floor;
        renderAll();
      });
    });
  }

  function renderTable() {
    const filtered = filterFloor === "전체"
      ? units
      : units.filter(u => floorOf(u.호수) === filterFloor);

    const tbody = $("unitsTbody");
    const empty = $("unitsEmpty");

    if (!filtered.length) {
      tbody.innerHTML = "";
      empty.style.display = "";
      return;
    }
    empty.style.display = "none";

    tbody.innerHTML = filtered.map(u => {
      const ri     = units.indexOf(u);
      const status = u.공실여부 || "공실";
      const bc     = status === "임차중" ? "임차중" : status === "공실" ? "공실" : "매매가능";
      return `<tr>
        <td><strong>${u.호수 || "-"}</strong></td>
        <td>${u.현업종 || "-"}</td>
        <td>${u.소유주 || "-"}</td>
        <td>${u.연락처 || "-"}</td>
        <td style="text-align:right">${u.보증금 ? fmt(u.보증금) : "-"}</td>
        <td style="text-align:right">${u.월차임 ? fmt(u.월차임) : "-"}</td>
        <td><span class="sbadge ${bc}">${status}</span></td>
        <td><button class="btn-unit-edit" data-ri="${ri}">수정</button></td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll(".btn-unit-edit[data-ri]").forEach(btn => {
      btn.addEventListener("click", () => openModal(Number(btn.dataset.ri)));
    });
  }

  function openModal(idx) {
    editIdx = idx;
    const isNew = idx < 0;
    $("umTitle").textContent    = isNew ? "호실 추가" : "호실 수정";
    $("umDelete").style.display = isNew ? "none" : "";
    const u = isNew ? {} : units[idx];

    // 분양 당시
    $("u_호수").value     = u.호수      || "";
    $("u_현업종").value   = u.현업종    || "";
    $("u_전용_평").value  = u.전용_평   || "";
    $("u_분양_평").value  = u.분양_평   || "";
    $("u_평당가").value   = u.평당가    || "";
    $("u_분양금액").value = u.분양금액  || "";
    $("u_보증금").value   = u.보증금    || "";
    $("u_월차임").value   = u.월차임    || "";

    // 현재 현황
    $("u_공실여부").value   = u.공실여부    || "임차중";
    $("u_현매매가격").value = u.현_매매가격 || "";
    $("u_현보증금").value   = u.현_보증금   || "";
    $("u_현월세").value     = u.현_월세     || "";
    $("u_소유주").value     = u.소유주      || "";
    $("u_연락처").value     = u.연락처      || "";
    $("u_수익률").value     = u.수익률      || "";
    $("u_추천매물").value   = u.추천매물    || "";
    $("u_비고").value       = u.비고        || "";

    $("unitModal").classList.add("open");
    $("u_호수").focus();
  }

  function closeModal() {
    $("unitModal").classList.remove("open");
    editIdx = -1;
  }

  async function saveUnit() {
    const 호수 = $("u_호수").value.trim();
    if (!호수) { if (typeof showToast === "function") showToast("호수를 입력하세요."); return; }

    const unit = {
      호수,
      공실여부:    $("u_공실여부").value,
      현업종:      $("u_현업종").value.trim()    || null,
      소유주:      $("u_소유주").value.trim()    || null,
      연락처:      $("u_연락처").value.trim()    || null,
      보증금:      Number($("u_보증금").value)   || null,
      월차임:      Number($("u_월차임").value)   || null,
      전용_평:     parseFloat($("u_전용_평").value)  || null,
      분양_평:     parseFloat($("u_분양_평").value)  || null,
      평당가:      Number($("u_평당가").value)   || null,
      분양금액:    Number($("u_분양금액").value) || null,
      현_매매가격: Number($("u_현매매가격").value) || null,
      현_보증금:   Number($("u_현보증금").value)   || null,
      현_월세:     Number($("u_현월세").value)     || null,
      수익률:      $("u_수익률").value.trim()    || null,
      추천매물:    $("u_추천매물").value.trim()  || null,
      비고:        $("u_비고").value.trim()      || null,
      updated_at:  new Date().toISOString()
    };

    const next = [...units];
    if (editIdx < 0) next.push(unit); else next[editIdx] = unit;

    $("umSave").disabled = true;
    $("umSave").textContent = "저장 중...";
    try {
      await saveBuildingUnits(bName, bName, next);
      units = next;
      closeModal();
      renderAll();
      if (typeof showToast === "function")
        showToast(editIdx < 0 ? "호실이 추가되었습니다." : "수정 완료되었습니다.");
    } catch(e) {
      if (typeof showToast === "function") showToast("저장 실패: " + e.message);
      console.error("[호실현황] 저장 실패:", e);
    } finally {
      $("umSave").disabled = false;
      $("umSave").textContent = "저장";
    }
  }

  async function deleteUnit() {
    if (editIdx < 0) return;
    const u = units[editIdx];
    if (!confirm(`'${u.호수}' 호실을 삭제하시겠습니까?`)) return;
    const next = units.filter((_, i) => i !== editIdx);
    $("umDelete").disabled = true;
    try {
      await saveBuildingUnits(bName, bName, next);
      units = next;
      closeModal();
      renderAll();
      if (typeof showToast === "function") showToast("삭제 완료되었습니다.");
    } catch(e) {
      if (typeof showToast === "function") showToast("삭제 실패: " + e.message);
    } finally { $("umDelete").disabled = false; }
  }

  $("btnAddUnit").addEventListener("click", () => openModal(-1));
  $("umSave").addEventListener("click", saveUnit);
  $("umDelete").addEventListener("click", deleteUnit);
  $("umCancel").addEventListener("click", closeModal);
  $("umClose").addEventListener("click", closeModal);
  $("unitModal").addEventListener("click", e => { if (e.target === $("unitModal")) closeModal(); });

  // fallback: init() 2초 후에도 미로드 시 재시도
  setTimeout(() => {
    if (units.length === 0 && bName === "") {
      console.log("[호실현황] fallback 재시도");
      loadUnits();
    }
  }, 2000);

})();"""

new_lines = lines[:start_line] + [NEW_JS + '\n'] + lines[end_line + 1:]

with open('building-detail.html', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"JS 교체 완료. 총 줄 수: {len(new_lines)}")
