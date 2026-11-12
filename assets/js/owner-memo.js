/* 소유주 메모 / 특이사항: 날짜를 고르고 메모를 계속 추가하는 방식 (등록·수정 화면 공통)
 * - 화면: 날짜 선택 + 새 메모 + [추가] 버튼, 아래에 날짜별 목록(수정·삭제)
 * - 저장: item.ownerMemos = [{id, text, date}] 와, 기존 화면·검색·출력이 읽는 item.owner_memo(글자 합본)
 * - 기존에 적어 둔 소유주 메모는 날짜 없는 「기존 메모」로 그대로 보여 준다.
 */
(function () {
  if (window.__ownerMemoReady) return;
  window.__ownerMemoReady = true;
  const states = {};
  const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function injectStyle() {
    if (document.getElementById('ownerMemoStyle')) return;
    const st = document.createElement('style'); st.id = 'ownerMemoStyle';
    st.textContent = [
      '.om-wrap{display:flex;flex-direction:column;gap:8px}',
      '.om-row{display:flex;gap:8px;align-items:flex-start}',
      '.om-row .om-date{flex:0 0 150px;width:150px;min-width:0}',
      '.om-row .om-new{flex:1 1 auto;min-width:0;min-height:44px;height:48px;resize:vertical}',
      '.om-row .om-add{flex:0 0 auto;height:38px;padding:0 14px;font-size:.82rem;white-space:nowrap}',
      '.om-list{display:flex;flex-direction:column;gap:4px}',
      '.om-item{display:flex;gap:8px;align-items:flex-start;padding:6px 8px;border:1px solid rgba(127,149,169,.45);border-radius:8px;font-size:.84rem;line-height:1.45}',
      '.om-item .om-d{flex:0 0 86px;font-weight:700;color:var(--gold,#25675f)}',
      '.om-item .om-t{flex:1 1 auto;min-width:0;white-space:pre-wrap;word-break:break-word}',
      '.om-item .om-b{flex:0 0 auto;display:flex;gap:4px}',
      '.om-item button{border:1px solid rgba(127,149,169,.6);background:transparent;border-radius:6px;padding:1px 8px;font-size:.74rem;cursor:pointer;color:inherit}',
      '.om-item textarea{width:100%;min-height:44px;resize:vertical}',
      '.om-empty{font-size:.78rem;color:var(--text-muted,#68788a)}',
      'html[data-office-theme="ktop"] .om-item .om-d{color:#233f5d}'
    ].join('\n');
    document.head.appendChild(st);
  }
  const sortedAsc = list => list.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  function joined(list) { return sortedAsc(list).map(e => (e.date ? e.date + ' ' : '') + e.text).join('\n'); }
  function sync(prefix) {
    const s = states[prefix]; if (!s) return;
    s.ta.value = joined(s.entries); s.last = s.ta.value;
    s.ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function importExternal(prefix) {
    const s = states[prefix]; if (!s) return;
    if (s.ta.value !== s.last && s.ta.value.trim()) {
      s.entries.push({ id: uid(), text: s.ta.value.trim(), date: '' });
      s.last = null;
    }
  }
  function render(prefix) {
    const s = states[prefix]; if (!s) return;
    const list = s.entries.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    if (!list.length) { s.list.innerHTML = '<div class="om-empty">아직 적은 메모가 없습니다.</div>'; return; }
    s.list.innerHTML = '';
    list.forEach(e => {
      const row = document.createElement('div'); row.className = 'om-item'; row.dataset.id = e.id;
      row.innerHTML = '<div class="om-d">' + (e.date ? esc(e.date) : '기존 메모') + '</div><div class="om-t">' + esc(e.text) + '</div><div class="om-b"><button type="button" data-act="edit">수정</button><button type="button" data-act="del">삭제</button></div>';
      s.list.appendChild(row);
    });
  }
  function commitPending(prefix) {
    const s = states[prefix]; if (!s) return;
    importExternal(prefix);
    const text = s.newTa.value.trim();
    if (text) { s.entries.push({ id: uid(), text, date: s.date.value || today() }); s.newTa.value = ''; s.date.value = today(); }
    render(prefix); sync(prefix);
  }
  function build(prefix) {
    const ta = document.getElementById(prefix + 'owner_memo');
    if (!ta || ta.dataset.omReady) return;
    ta.dataset.omReady = '1';
    injectStyle();
    ta.style.display = 'none';
    const wrap = document.createElement('div'); wrap.className = 'om-wrap';
    wrap.innerHTML = '<div class="om-row"><input type="date" class="om-date" aria-label="메모 날짜" title="달력에서 고르거나 직접 입력" /><textarea class="om-new" rows="2" placeholder="소유주 메모를 적고 [추가]를 누르세요 (날짜는 바꿀 수 있어요)"></textarea><button type="button" class="btn btn-ghost om-add">+ 추가</button></div><div class="om-list"></div>';
    ta.after(wrap);
    const s = states[prefix] = { ta, wrap, entries: [], last: ta.value, date: wrap.querySelector('.om-date'), newTa: wrap.querySelector('.om-new'), list: wrap.querySelector('.om-list') };
    s.date.value = today();
    wrap.querySelector('.om-add').addEventListener('click', () => { commitPending(prefix); s.newTa.focus(); });
    s.list.addEventListener('click', ev => {
      const btn = ev.target.closest('button[data-act]'); if (!btn) return;
      const row = btn.closest('.om-item'); const id = row.dataset.id; const e = s.entries.find(x => x.id === id); if (!e) return;
      if (btn.dataset.act === 'del') {
        if (!confirm('이 메모를 삭제할까요?')) return;
        s.entries = s.entries.filter(x => x.id !== id); render(prefix); sync(prefix);
      } else if (btn.dataset.act === 'edit') {
        const t = row.querySelector('.om-t');
        t.innerHTML = '<textarea>' + esc(e.text) + '</textarea>';
        const bar = row.querySelector('.om-b');
        bar.innerHTML = '<button type="button" data-act="ok">저장</button><button type="button" data-act="cancel">취소</button>';
        t.querySelector('textarea').focus();
      } else if (btn.dataset.act === 'ok') {
        const v = row.querySelector('.om-t textarea').value.trim();
        if (v) e.text = v; else s.entries = s.entries.filter(x => x.id !== id);
        render(prefix); sync(prefix);
      } else if (btn.dataset.act === 'cancel') { render(prefix); }
    });
    render(prefix);
  }
  window.ownerMemoLoad = function (prefix, item) {
    build(prefix);
    const s = states[prefix]; if (!s) return;
    const arr = item && Array.isArray(item.ownerMemos) ? item.ownerMemos : null;
    s.entries = arr ? arr.filter(e => e && String(e.text || '').trim()).map(e => ({ id: e.id || uid(), text: String(e.text), date: e.date || '' })) : [];
    if (!arr && s.ta.value.trim()) s.entries.push({ id: uid(), text: s.ta.value.trim(), date: '' });
    s.newTa.value = ''; s.date.value = today();
    s.last = s.ta.value; render(prefix);
    if (arr) sync(prefix);
  };
  window.ownerMemoGet = function (prefix) {
    const s = states[prefix]; if (!s) return undefined;
    commitPending(prefix);
    return s.entries.map(e => ({ id: e.id, text: e.text, date: e.date || '' }));
  };
  // 저장 버튼을 누르는 순간, 아직 [추가]를 못 누른 새 메모도 함께 넣는다.
  document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('#saveBtn,#editSaveBtn'); if (!b) return;
    Object.keys(states).forEach(p => { if (document.body.contains(states[p].ta)) commitPending(p); });
  }, true);
  function init() { build(''); build('edit_'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
