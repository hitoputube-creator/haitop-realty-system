import { useEffect, useRef, useState } from 'react'
import { searchListings } from '../lib/listings'
import { searchContacts, resolveOrCreateContact } from '../lib/contacts'
import { checkExistingCustomerByPhone, resolveOrCreateCustomer } from '../lib/customers'
import { RELATION_TYPES } from '../lib/relationTypes'
import './RelationControls.css'

// customers.property_category에는 DB CHECK 제약(customers_property_category_check)이 있어
// 이 5개 값만 허용된다 - 임의로 값을 늘리면 등록이 항상 실패한다.
const PROPERTY_CATEGORY_OPTIONS = ['공장창고', '상가사무실', '토지', '주거용', '기타']

// customers.customer_role CHECK 제약(customers_customer_role_check)은 '매수/임차/매도/임대/기타'만
// 허용한다 - 업무일지 관계구분(매수인/임차인)과 글자 수가 다르므로 저장 직전에 변환한다.
const CUSTOMER_ROLE_DB_VALUE = { 매수인: '매수', 임차인: '임차' }

export function RelationTypeSelect({ value, onChange, disabled }) {
  return (
    <select
      className="rc-select"
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      aria-label="관계구분"
    >
      <option value="">관계구분</option>
      {RELATION_TYPES.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  )
}

function usePopoverOutsideClick(open, setOpen) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open, setOpen])
  return ref
}

/* 매도인/임대인 - 기존 매물 검색 후 연결. 새 매물 등록은 저장된 메모의 기존
   "🏠 매물보내기" 버튼(register.html 핸드오프)을 그대로 쓴다 - 여기서는 새로 안 만든다. */
export function ListingLinkControl({ listingId, listingLabel, onLink, onUnlink, disabled }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef(null)
  const wrapRef = usePopoverOutsideClick(open, setOpen)

  function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    clearTimeout(timerRef.current)
    if (!q.trim()) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      setError('')
      try {
        setResults(await searchListings(q))
      } catch (err) {
        setError(err.message || String(err))
      } finally {
        setSearching(false)
      }
    }, 280)
  }

  if (listingId) {
    return (
      <span className="rc-linked-chip">
        🏠 {listingLabel || listingId}
        <button type="button" onClick={onUnlink} disabled={disabled} aria-label="매물 연결 해제">✕</button>
      </span>
    )
  }

  return (
    <div className="rc-popover-wrap" ref={wrapRef}>
      <button type="button" className="rc-link-btn" onClick={() => setOpen((v) => !v)} disabled={disabled}>
        🏠 기존 매물 연결
      </button>
      {open && (
        <div className="rc-popover">
          <input
            className="rc-popover-input"
            placeholder="주소·제목 검색"
            value={query}
            onChange={handleChange}
            autoFocus
          />
          {searching && <div className="rc-popover-empty">검색 중...</div>}
          {!searching && query.trim() && results.length === 0 && (
            <div className="rc-popover-empty">검색 결과가 없습니다. 저장 후 &quot;🏠 매물보내기&quot;로 새로 등록하면 자동 연결됩니다.</div>
          )}
          <div className="rc-popover-list">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                className="rc-popover-item"
                onClick={() => { onLink(r.id, r.title || r.display_address || r.address || r.id); setOpen(false) }}
              >
                {r.title || '(제목 없음)'}
                <small>{r.display_address || r.address || ''}</small>
              </button>
            ))}
          </div>
          {error && <div className="rc-error">{error}</div>}
        </div>
      )}
    </div>
  )
}

/* 분양직원/타부동산/업체/기타 - 검색 또는 즉시 생성(간단한 인라인 폼). */
export function ContactLinkControl({ category, contactId, contactLabel, onLink, onUnlink, disabled }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', phone: '', memo: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef(null)
  const wrapRef = usePopoverOutsideClick(open, setOpen)

  function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    clearTimeout(timerRef.current)
    if (!q.trim()) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      setError('')
      try {
        setResults(await searchContacts(q))
      } catch (err) {
        setError(err.message || String(err))
      } finally {
        setSearching(false)
      }
    }, 280)
  }

  async function handleCreate() {
    if (!form.name.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      const created = await resolveOrCreateContact({ ...form, category })
      if (created) {
        onLink(created.id, created.company ? `${created.name} (${created.company})` : created.name)
        setOpen(false)
        setForm({ name: '', company: '', phone: '', memo: '' })
      }
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  if (contactId) {
    return (
      <span className="rc-linked-chip">
        📇 {contactLabel || '연락처 연결됨'}
        <button type="button" onClick={onUnlink} disabled={disabled} aria-label="연락처 연결 해제">✕</button>
      </span>
    )
  }

  return (
    <div className="rc-popover-wrap" ref={wrapRef}>
      <button type="button" className="rc-link-btn" onClick={() => setOpen((v) => !v)} disabled={disabled}>
        📇 연락처 검색/등록
      </button>
      {open && (
        <div className="rc-popover">
          <div className="rc-popover-tabs">
            <button type="button" className={`rc-popover-tab ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>검색</button>
            <button type="button" className={`rc-popover-tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>새로 등록</button>
          </div>
          {tab === 'search' ? (
            <>
              <input className="rc-popover-input" placeholder="이름·회사·연락처 검색" value={query} onChange={handleChange} autoFocus />
              {searching && <div className="rc-popover-empty">검색 중...</div>}
              {!searching && query.trim() && results.length === 0 && (
                <div className="rc-popover-empty">검색 결과가 없습니다. &quot;새로 등록&quot; 탭을 이용하세요.</div>
              )}
              <div className="rc-popover-list">
                {results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="rc-popover-item"
                    onClick={() => { onLink(c.id, c.company ? `${c.name} (${c.company})` : c.name); setOpen(false) }}
                  >
                    {c.name}
                    <small>{[c.category, c.company, c.phone].filter(Boolean).join(' · ')}</small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="rc-popover-create">
              <input className="rc-popover-input" placeholder="이름" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
              <input className="rc-popover-input" placeholder="회사/소속" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
              <input className="rc-popover-input" placeholder="연락처" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <input className="rc-popover-input" placeholder="메모(선택)" value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} />
              <div className="rc-popover-actions">
                <button type="button" className="rc-popover-btn" onClick={() => setOpen(false)} disabled={saving}>취소</button>
                <button type="button" className="rc-popover-btn primary" onClick={handleCreate} disabled={saving || !form.name.trim()}>
                  {saving ? '저장 중...' : '등록 · 연결'}
                </button>
              </div>
            </div>
          )}
          {error && <div className="rc-error">{error}</div>}
        </div>
      )}
    </div>
  )
}

/* 매수인/임차인 - "기존 고객·메모 불러오기"(이미 있는 검색 버튼)는 그대로 두고,
   여기서는 관계구분/찾는 매물유형/예산/관심지역까지 받는 "새 고객 등록"만 담당한다.
   같은 연락처의 고객이 이미 있으면 조용히 새로 만들지 않고 연결 여부를 먼저 물어본다. */
export function NewCustomerRelationControl({ relationType, defaultName = '', defaultPhone = '', defaultMemo = '', writer, onCreated, disabled }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: defaultName, phone: defaultPhone, propertyCategory: '', desiredRegion: '', desiredPrice: '', memo: defaultMemo })
  const [dupeMatch, setDupeMatch] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const wrapRef = usePopoverOutsideClick(open, setOpen)

  function openPopover() {
    setForm({ name: defaultName, phone: defaultPhone, propertyCategory: '', desiredRegion: '', desiredPrice: '', memo: defaultMemo })
    setDupeMatch(null)
    setError('')
    setOpen(true)
  }

  async function handleSubmit() {
    if (!form.name.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      if (!dupeMatch && form.phone.trim()) {
        const existing = await checkExistingCustomerByPhone(form.phone)
        if (existing) {
          setDupeMatch(existing)
          setSaving(false)
          return
        }
      }
      const customer = await resolveOrCreateCustomer({
        name: dupeMatch ? dupeMatch.name : form.name,
        phone: dupeMatch ? dupeMatch.phone : form.phone,
        manager: writer,
        extra: {
          customerRole: CUSTOMER_ROLE_DB_VALUE[relationType] || null,
          propertyCategory: form.propertyCategory,
          desiredRegion: form.desiredRegion,
          desiredPrice: form.desiredPrice,
          memo: form.memo,
        },
      })
      if (customer) {
        onCreated(customer)
        setOpen(false)
        setDupeMatch(null)
      }
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rc-popover-wrap" ref={wrapRef}>
      <button type="button" className="rc-link-btn" onClick={() => (open ? setOpen(false) : openPopover())} disabled={disabled}>
        👤 새 고객 등록
      </button>
      {open && (
        <div className="rc-popover" style={{ width: 300 }}>
          {dupeMatch ? (
            <div className="rc-popover-confirm">
              이미 등록된 고객입니다: <strong>{dupeMatch.name}</strong>{dupeMatch.phone ? ` (${dupeMatch.phone})` : ''}<br />
              이 고객과 연결할까요?
              <div className="rc-popover-actions">
                <button type="button" className="rc-popover-btn" onClick={() => setDupeMatch(null)} disabled={saving}>다시 입력</button>
                <button type="button" className="rc-popover-btn primary" onClick={handleSubmit} disabled={saving}>
                  {saving ? '연결 중...' : '이 고객과 연결'}
                </button>
              </div>
            </div>
          ) : (
            <div className="rc-popover-create">
              <input className="rc-popover-input" placeholder="이름" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
              <input className="rc-popover-input" placeholder="연락처" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <select className="rc-popover-input" value={form.propertyCategory} onChange={(e) => setForm((f) => ({ ...f, propertyCategory: e.target.value }))}>
                <option value="">찾는 매물유형(선택)</option>
                {PROPERTY_CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input className="rc-popover-input" placeholder="예산(선택)" value={form.desiredPrice} onChange={(e) => setForm((f) => ({ ...f, desiredPrice: e.target.value }))} />
              <input className="rc-popover-input" placeholder="관심지역(선택)" value={form.desiredRegion} onChange={(e) => setForm((f) => ({ ...f, desiredRegion: e.target.value }))} />
              <input className="rc-popover-input" placeholder="메모(선택)" value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} />
              <div className="rc-popover-actions">
                <button type="button" className="rc-popover-btn" onClick={() => setOpen(false)} disabled={saving}>취소</button>
                <button type="button" className="rc-popover-btn primary" onClick={handleSubmit} disabled={saving || !form.name.trim()}>
                  {saving ? '저장 중...' : '등록 · 연결'}
                </button>
              </div>
            </div>
          )}
          {error && <div className="rc-error">{error}</div>}
        </div>
      )}
    </div>
  )
}
