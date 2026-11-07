/* 건물 개요: "수정"을 누르면 아래에 수정창이 따로 열리지 않고, 위의 표 칸이 바로 입력칸으로 바뀐다.
 * 기존 수정창의 입력칸(ov_*)과 저장 기능(saveOverview)을 그대로 쓰고, 입력칸만 표 안으로 옮겨 놓는다. */
(function () {
  if (!/building-overview/.test(location.pathname) || window.__overviewInlineEdit) return;
  window.__overviewInlineEdit = true;
  var $ = function (id) { return document.getElementById(id); };
  var OWN = (typeof OfficeConfig !== 'undefined' && OfficeConfig.id === 'ktop') ? '케이탑' : '하이탑';
  var inline = false, moved = [];

  var st = document.createElement('style');
  st.textContent = '.info-table-value.inline-edit{padding:6px 10px;gap:6px;flex-wrap:wrap}'
    + '.info-table-value.inline-edit input,.info-table-value.inline-edit select{flex:1 1 140px;min-width:0;width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid #8fbab4;border-radius:8px;background:#fff!important;color:#1e3a3b!important;font:inherit;font-weight:500}'
    + '.info-table-value.inline-edit input:focus,.info-table-value.inline-edit select:focus{outline:2px solid #25675f;outline-offset:0}';
  document.head.appendChild(st);

  function idsForLabel(text) {
    text = String(text || '').trim();
    if (text === '새주소(도로명주소)') text = '주소';
    if (text === '지번주소(구주소)') text = '지번주소';
    var f = (typeof editableOverviewFields === 'function' ? editableOverviewFields() : []).filter(function (x) { return x[0] === text; })[0];
    if (f) return [f[1]];
    if (text === OWN + ' 분양담당자' && $('ov_sales_agent_name')) return ['ov_sales_agent_name', 'ov_sales_agent_phone'];
    return null;
  }

  function enter() {
    if (typeof buildingData !== 'undefined' && buildingData && buildingData._office === 'ktop') {
      showToast('케이탑 공유 자료입니다. 케이탑 화면에서 수정해 주세요.', 3500); return;
    }
    populateForm(buildingData ? buildingData.memo || '' : '');
    moved = [];
    document.querySelectorAll('#infoTable .info-table-label').forEach(function (label) {
      var ids = idsForLabel(label.textContent); if (!ids) return;
      var cell = label.nextElementSibling; if (!cell) return;
      cell.innerHTML = ''; cell.classList.remove('empty'); cell.classList.add('inline-edit');
      ids.forEach(function (id) {
        var el = $(id); if (!el) return;
        moved.push({ el: el, parent: el.parentNode, next: el.nextSibling });
        el.addEventListener('keydown', onKey);
        cell.appendChild(el);
      });
    });
    $('editFormCard').style.display = 'none';
    $('editToggleBtn').textContent = '✕ 수정 취소';
    $('registerFillBtn').disabled = true;
    if (!$('inlineSaveBtn')) {
      var b = document.createElement('button'); b.className = 'btn primary'; b.id = 'inlineSaveBtn'; b.textContent = '💾 저장';
      b.onclick = function () { saveOverview(); };
      $('editToggleBtn').parentNode.insertBefore(b, $('editToggleBtn'));
    }
    inline = true;
    var first = document.querySelector('#infoTable .inline-edit input'); if (first) first.focus();
  }
  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); saveOverview(); }
    else if (e.key === 'Escape') { e.preventDefault(); window.toggleEditMode(); }
  }
  function leave() {
    moved.slice().reverse().forEach(function (m) { m.el.removeEventListener('keydown', onKey); m.parent.insertBefore(m.el, m.next); });
    moved = [];
    var b = $('inlineSaveBtn'); if (b) b.remove();
    $('editFormCard').style.display = 'none';
    $('editToggleBtn').textContent = '✏️ 수정';
    $('registerFillBtn').disabled = false;
    inline = false;
    renderReadOnlyViews();
  }
  window.toggleEditMode = function () { if (inline) leave(); else enter(); };
  // 주소에 edit=1 이 붙어 열린 경우: 이미 열린 아래쪽 수정창을 표 안으로 옮긴다
  if ($('editFormCard') && $('editFormCard').style.display !== 'none' && document.querySelector('#infoTable .info-table-label')) { $('editFormCard').style.display = 'none'; enter(); }
})();
