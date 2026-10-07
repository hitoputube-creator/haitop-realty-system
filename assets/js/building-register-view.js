// 건물 상세와 층별 현황에서 같은 건축물대장 정보 조회 화면을 사용한다.
// 조회 결과는 참고용으로만 표시하며 호실의 저장 값은 바꾸지 않는다.
(function () {
  let dialog;
  let lookupContext = {};

  function ensureDialog() {
    if (dialog) return dialog;
    const style = document.createElement('style');
    style.textContent = `
      .br-overlay { position:fixed; inset:0; z-index:10000; display:none; align-items:center;
        justify-content:center; padding:12px; background:rgba(0,0,0,.78); }
      .br-overlay.open { display:flex; }
      .br-box { width:min(100%,940px); box-sizing:border-box; max-height:calc(100vh - 24px); overflow:auto; padding:16px 20px;
        border:1px solid rgba(216,184,74,.48); border-radius:16px; background:#10213b;
        color:#f8f3e6; box-shadow:0 20px 60px rgba(0,0,0,.55); }
      .br-box h2 { margin:0 0 4px; font-size:1.1rem; }
      .br-box p { margin:4px 0 8px; color:#b9c5d8; font-size:.8rem; line-height:1.4; }
      .br-inputs { display:grid; grid-template-columns:minmax(0,2fr) minmax(80px,.6fr) minmax(100px,1fr); gap:12px; }
      .br-box label { display:block; margin:0 0 4px; font-size:.78rem; }
      .br-box input { width:100%; box-sizing:border-box; border:1px solid #4b5c77;
        border-radius:7px; background:#0a1830; color:#fff; padding:7px 9px; font:inherit; }
      .br-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:8px; }
      .br-actions button { border:1px solid #8b7432; border-radius:7px; padding:7px 12px;
        background:#192c47; color:#fff; cursor:pointer; }
      .br-actions .br-fetch { background:#9a781b; font-weight:700; }
      .br-actions button:disabled { opacity:.5; cursor:wait; }
      .br-error { color:#ff9d9d !important; }
      .br-result { margin-top:10px; border-top:1px solid #41516a; padding-top:5px; }
      .br-result table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:.83rem; }
      .br-result tr { border-bottom:1px solid #32445d; }
      .br-result tr:nth-child(even) { background:rgba(255,255,255,.025); }
      .br-result th, .br-result td { padding:6px 8px; text-align:left; vertical-align:top; overflow-wrap:anywhere; }
      .br-result th { width:16%; color:#b9c5d8; font-weight:500; }
      .br-result td { width:34%; color:#f8f3e6; font-weight:650; }
      .br-result td:nth-child(2) { border-right:1px solid #32445d; }
      .br-result #brWarning { margin:7px 2px 0; font-size:.75rem; }
      @media(max-width:700px) {
        .br-inputs { grid-template-columns:1fr; gap:8px; }
        .br-result tr { display:grid; grid-template-columns:minmax(95px,38%) minmax(0,1fr); }
        .br-result th, .br-result td { width:auto; padding:6px; }
        .br-result td:nth-child(2) { border-right:0; border-bottom:1px solid #32445d; }
      }
    `;
    document.head.appendChild(style);
    dialog = document.createElement('div');
    dialog.className = 'br-overlay';
    dialog.innerHTML = `<div class="br-box" role="dialog" aria-modal="true" aria-labelledby="brTitle">
      <h2 id="brTitle">건축물대장정보 확인</h2>
      <p>주소와 호수를 확인한 뒤 조회하세요. 조회 결과는 호실 정보에 자동 저장되지 않습니다.</p>
      <div class="br-inputs"><div><label for="brAddress">건물 지번주소</label><input id="brAddress" autocomplete="off" placeholder="예: 경기도 파주시 와동동 1456-3"></div>
      <div><label for="brDong">동</label><input id="brDong" autocomplete="off" placeholder="예: 1101"></div>
      <div><label for="brRoom">호수</label><input id="brRoom" autocomplete="off" placeholder="예: 101"></div></div>
      <p class="br-error" id="brError" role="alert"></p>
      <div class="br-result" id="brResult" hidden><table id="brDetails" aria-label="건축물대장 조회 결과"><tbody></tbody></table><p id="brWarning"></p></div>
      <div class="br-actions"><button type="button" class="br-close">닫기</button>
        <button type="button" class="br-fetch">정보 조회</button></div>
    </div>`;
    document.body.appendChild(dialog);
    const close = () => { dialog.classList.remove('open'); document.body.style.overflow = ''; };
    dialog.querySelector('.br-close').addEventListener('click', close);
    dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && dialog.classList.contains('open')) close();
    });
    dialog.querySelector('.br-fetch').addEventListener('click', async () => {
      const address = dialog.querySelector('#brAddress').value.trim();
      const room = dialog.querySelector('#brRoom').value.trim().replace(/\s*호$/, '');
      const selectedDong = dialog.querySelector('#brDong').value.trim().replace(/\s*동$/, '');
      const error = dialog.querySelector('#brError');
      const resultBox = dialog.querySelector('#brResult');
      error.textContent = '';
      resultBox.hidden = true;
      if (!address || !room) { error.textContent = '지번주소와 호수를 입력해 주세요.'; return; }
      const btn = dialog.querySelector('.br-fetch');
      btn.disabled = true;
      btn.textContent = '조회 중...';
      try {
        const dong = address.match(/(?:^|\s)(\d+)\s*동(?:\s|,|$)/);
        const requestedDong = selectedDong || (dong ? dong[1] : '');
        const info = await lookupBuildingRegister(address, { hoNm: room, dongNm: requestedDong, apartment: lookupContext.apartment === true });
        if (!info.building_match_verified) throw new Error('해당 건물의 일치 여부를 확인하지 못했습니다. 다시 조회해주세요.');
        const area = value => {
          if (value == null || value === '') return '조회되지 않음';
          const squareMeters = Number(value);
          if (!Number.isFinite(squareMeters)) return '조회되지 않음';
          return `${squareMeters.toLocaleString('ko-KR')}㎡ (${(squareMeters / 3.305785).toLocaleString('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}평)`;
        };
        const date = value => /^\d{8}$/.test(String(value || ''))
          ? `${String(value).slice(0,4)}.${String(value).slice(4,6)}.${String(value).slice(6)}` : (value || '조회되지 않음');
        const fields = [
          ['건물명', info.building_name || lookupContext.buildingName || '조회되지 않음'],
          ['동명', info.unit_dong_name || info.dong_name || '조회되지 않음'],
          ['호수', room + '호'],
          ['해당 층', info.unit_floor || '조회되지 않음'],
          ['지상·지하 층수', info.floor_info || '조회되지 않음'],
          ['대지면적', area(info.land_area_m2)],
          ['건축면적', area(info.footprint_area_m2)],
          ['연면적', area(info.total_area_m2)],
          ['호실 전유면적', info.unit_area_warning ? '조회되지 않음' : area(info.exclusive_area_m2)],
          ['호실 공용면적', area(info.common_area_m2)],
          ['전유+공용 합계', area(info.supply_area_m2)],
          [info.parking_scope === '단지 전체' ? '단지 전체 주차대수' : '건물 전체 주차대수', info.parking_count == null ? '미확인' : `${Number(info.parking_count).toLocaleString('ko-KR')}대`],
          ['사용승인일', date(info.use_apr_day)],
          ['건물 주용도', info.main_purpose || '조회되지 않음'],
          ['건물 구조', info.structure || '조회되지 않음']
        ];
        const details = dialog.querySelector('#brDetails tbody');
        details.replaceChildren();
        for (let index = 0; index < fields.length; index += 2) {
          const row = document.createElement('tr');
          for (const [label, value] of fields.slice(index, index + 2)) {
            const heading = document.createElement('th');
            heading.scope = 'row';
            heading.textContent = label;
            const cell = document.createElement('td');
            cell.textContent = value;
            row.append(heading, cell);
          }
          details.appendChild(row);
        }
        dialog.querySelector('#brWarning').textContent = (info.unit_area_warning
          ? '이 호실의 전유·공용면적을 확인하지 못했습니다. 연면적은 건물 전체 면적이므로 호실 면적으로 사용하지 마세요. 원본 대장과 대조해 주세요.'
          : '전유+공용 합계는 대장에 조회된 면적의 합산값이며 분양 공급면적과 다를 수 있습니다.') + (info.parking_warning ? ' ' + info.parking_warning : '');
        resultBox.hidden = false;
      } catch (e) {
        error.textContent = e.message || '건축물대장정보 조회에 실패했습니다.';
      } finally {
        btn.disabled = false;
        btn.textContent = '정보 조회';
      }
    });
    return dialog;
  }

  window.openBuildingRegisterInfo = function (address, room, dong = '', context = {}) {
    lookupContext = context;
    const box = ensureDialog();
    box.querySelector('#brDong').value = String(dong || '').replace(/\s*동$/, '').trim();
    box.querySelector('#brAddress').value = address || '';
    box.querySelector('#brRoom').value = String(room || '').replace(/^.*?동\s*/, '').replace(/\s*호$/, '').trim();
    box.querySelector('#brError').textContent = '';
    box.querySelector('#brResult').hidden = true;
    box.classList.add('open');
    document.body.style.overflow = 'hidden';
    box.querySelector('#brAddress').focus();
  };
})();
