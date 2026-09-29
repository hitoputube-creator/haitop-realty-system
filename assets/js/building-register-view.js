// 건물 상세와 층별 현황에서 같은 건축물대장 정보 조회 화면을 사용한다.
// 조회 결과는 참고용으로만 표시하며 호실의 저장 값은 바꾸지 않는다.
(function () {
  let dialog;

  function ensureDialog() {
    if (dialog) return dialog;
    const style = document.createElement('style');
    style.textContent = `
      .br-overlay { position:fixed; inset:0; z-index:10000; display:none; align-items:center;
        justify-content:center; padding:18px; background:rgba(0,0,0,.78); }
      .br-overlay.open { display:flex; }
      .br-box { width:min(100%,570px); max-height:90vh; overflow:auto; padding:22px;
        border:1px solid rgba(216,184,74,.48); border-radius:16px; background:#10213b;
        color:#f8f3e6; box-shadow:0 20px 60px rgba(0,0,0,.55); }
      .br-box h2 { margin:0 0 8px; font-size:1.15rem; }
      .br-box p { color:#b9c5d8; font-size:.83rem; line-height:1.5; }
      .br-box label { display:block; margin:12px 0 5px; font-size:.82rem; }
      .br-box input { width:100%; box-sizing:border-box; border:1px solid #4b5c77;
        border-radius:7px; background:#0a1830; color:#fff; padding:10px; font:inherit; }
      .br-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
      .br-actions button { border:1px solid #8b7432; border-radius:7px; padding:9px 13px;
        background:#192c47; color:#fff; cursor:pointer; }
      .br-actions .br-fetch { background:#9a781b; font-weight:700; }
      .br-actions button:disabled { opacity:.5; cursor:wait; }
      .br-error { color:#ff9d9d !important; }
      .br-result { margin-top:16px; border-top:1px solid #41516a; padding-top:12px; }
      .br-result dl { display:grid; grid-template-columns:110px 1fr; gap:9px; margin:0; font-size:.9rem; }
      .br-result dt { color:#b9c5d8; }
      .br-result dd { margin:0; overflow-wrap:anywhere; }
    `;
    document.head.appendChild(style);
    dialog = document.createElement('div');
    dialog.className = 'br-overlay';
    dialog.innerHTML = `<div class="br-box" role="dialog" aria-modal="true" aria-labelledby="brTitle">
      <h2 id="brTitle">건축물대장정보 확인</h2>
      <p>주소와 호수를 확인한 뒤 조회하세요. 조회 결과는 호실 정보에 자동 저장되지 않습니다.</p>
      <label for="brAddress">건물 지번주소</label><input id="brAddress" autocomplete="off" placeholder="예: 경기도 파주시 와동동 1456-3">
      <label for="brRoom">호수</label><input id="brRoom" autocomplete="off" placeholder="예: 101">
      <p class="br-error" id="brError" role="alert"></p>
      <div class="br-result" id="brResult" hidden><dl id="brDetails"></dl><p id="brWarning"></p></div>
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
        const info = await lookupBuildingRegister(address, { hoNm: room, dongNm: dong ? dong[1] : '' });
        const fields = [
          ['호수', room + '호'],
          [info.unit_area_warning ? '건물 전체 면적' : '호실 전유면적',
            info.area_m2 != null ? `${Number(info.area_m2).toLocaleString('ko-KR')}㎡` : '조회되지 않음'],
          ['건물 주용도', info.main_purpose || '—'],
          ['건물 구조', info.structure || '—'],
          ['층수', info.floor_info || '—'],
          ['사용승인일', info.use_apr_day || '—']
        ];
        const details = dialog.querySelector('#brDetails');
        details.replaceChildren();
        fields.forEach(([label, value]) => {
          const dt = document.createElement('dt');
          const dd = document.createElement('dd');
          dt.textContent = label;
          dd.textContent = value;
          details.append(dt, dd);
        });
        dialog.querySelector('#brWarning').textContent = info.unit_area_warning
          ? '이 호실의 전유면적을 확인하지 못했습니다. 위 면적은 건물 전체 면적이므로 호실 면적으로 사용하지 마세요.'
          : '공공데이터 조회 정보입니다. 원본 대장과 대조해 주세요.';
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

  window.openBuildingRegisterInfo = function (address, room) {
    const box = ensureDialog();
    box.querySelector('#brAddress').value = address || '';
    box.querySelector('#brRoom').value = room || '';
    box.querySelector('#brError').textContent = '';
    box.querySelector('#brResult').hidden = true;
    box.classList.add('open');
    document.body.style.overflow = 'hidden';
    box.querySelector('#brAddress').focus();
  };
})();
