import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchBoardNotes,
  createBoardNote,
  updateBoardNote,
  deleteBoardNote,
  reorderBoardNotes,
  fetchDiaryMemoById,
} from '../lib/boardNotes'
import { isSupabaseConfigured } from '../lib/supabase'
import './MemoBoard.css'

// 카테고리: 매물 / 고객 / 기타메모 — DB의 category 컬럼과 1:1 대응
const CATEGORIES = [
  { key: 'listing', label: '매물', icon: '🏠' },
  { key: 'customer', label: '고객', icon: '🙋' },
  { key: 'etc', label: '기타메모', icon: '🗒️' },
]

// 색상 팔레트 — 항목 카드 전체의 파스텔 배경으로 사용
const COLORS = [
  { key: 'yellow', label: '보통', bg: '#f7e7a3', accent: '#9b7614' },
  { key: 'red', label: '급함', bg: '#ffd0c9', accent: '#b64a3c' },
  { key: 'blue', label: '대기중', bg: '#c9e8ff', accent: '#256b99' },
  { key: 'green', label: '완료예정', bg: '#cff1d8', accent: '#347a48' },
  { key: 'pink', label: '참고', bg: '#f8d1ea', accent: '#9d4f7e' },
]
const COLOR_MAP = Object.fromEntries(COLORS.map((c) => [c.key, c]))
const DEFAULT_COLOR = 'yellow'

function GENERIC_ERROR() {
  return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}

function fmtTime(iso) {
  if (!iso) return ''
  const dt = new Date(iso)
  const h = dt.getHours()
  const min = String(dt.getMinutes()).padStart(2, '0')
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${min}`
}

// 원본 업무일지 메모 열람 모달 (읽기 전용 — 체크리스트 항목 내용과는 독립적)
function OriginModal({ diaryId, onClose }) {
  const [memo, setMemo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchDiaryMemoById(diaryId)
      .then((data) => { if (!cancelled) setMemo(data) })
      .catch(() => { if (!cancelled) setErr('원본 메모를 불러오지 못했습니다.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [diaryId])

  return (
    <div className="mb-backdrop" onClick={onClose}>
      <div className="mb-origin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mb-origin-header">
          <span className="mb-origin-title">원본 업무일지 메모</span>
          <button type="button" className="mb-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="mb-origin-body">
          {loading ? (
            <div className="mb-origin-loading">불러오는 중...</div>
          ) : err || !memo ? (
            <div className="mb-origin-loading">{err || '원본 메모를 찾을 수 없습니다. (삭제되었을 수 있어요)'}</div>
          ) : (
            <>
              <div className="mb-origin-meta">
                <span>{fmtDate(memo.date)}</span>
                <span>{fmtTime(memo.created_at)}</span>
                <span>· {memo.writer || '케이탑'}</span>
              </div>
              <div className="mb-origin-content">{memo.content}</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MemoBoard({ onBack }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pickerOpenId, setPickerOpenId] = useState(null)
  const [originViewId, setOriginViewId] = useState(null)
  const [dragId, setDragId] = useState(null)

  const listRefs = useRef({}) // category -> DOM element
  const dragStateRef = useRef(null) // { category, id, pointerId }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await fetchBoardNotes()
        if (!cancelled) setNotes(data)
      } catch (err) {
        if (!cancelled) setError(GENERIC_ERROR())
        console.warn('[MemoBoard] load failed:', err?.message || err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const grouped = useMemo(() => {
    const map = { listing: [], customer: [], etc: [] }
    for (const n of notes) {
      const cat = map[n.category] ? n.category : 'etc'
      map[cat].push(n)
    }
    return map
  }, [notes])

  const activeCount = useMemo(() => notes.filter((n) => !n.checked).length, [notes])

  const addNote = useCallback(async (category) => {
    const tempId = `temp-${Date.now()}`
    const order_index = Date.now()
    const optimistic = { id: tempId, content: '', color: DEFAULT_COLOR, checked: false, category, order_index, diary_id: null }
    setNotes((prev) => [...prev, optimistic])

    try {
      const created = await createBoardNote({ content: '', color: DEFAULT_COLOR, category, order_index })
      if (created) {
        setNotes((prev) => prev.map((n) => (n.id === tempId ? created : n)))
        requestAnimationFrame(() => {
          document.querySelector(`[data-row-id="${created.id}"] input.mb-row-input`)?.focus()
        })
      }
    } catch (err) {
      setError(GENERIC_ERROR())
      setNotes((prev) => prev.filter((n) => n.id !== tempId))
      console.warn('[MemoBoard] create failed:', err?.message || err)
    }
  }, [])

  const patchLocal = useCallback((id, patch) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  }, [])

  const handleContentBlur = useCallback(async (id, value) => {
    try {
      await updateBoardNote(id, { content: value })
    } catch (err) {
      setError(GENERIC_ERROR())
      console.warn('[MemoBoard] content save failed:', err?.message || err)
    }
  }, [])

  const toggleChecked = useCallback(async (id, next) => {
    patchLocal(id, { checked: next })
    try {
      await updateBoardNote(id, { checked: next })
    } catch {
      setError(GENERIC_ERROR())
      patchLocal(id, { checked: !next })
    }
  }, [patchLocal])

  const changeColor = useCallback(async (id, colorKey) => {
    patchLocal(id, { color: colorKey })
    setPickerOpenId(null)
    try {
      await updateBoardNote(id, { color: colorKey })
    } catch (err) {
      setError(GENERIC_ERROR())
      console.warn('[MemoBoard] color save failed:', err?.message || err)
    }
  }, [patchLocal])

  const removeNote = useCallback(async (id) => {
    const prevNotes = notes
    setNotes((prev) => prev.filter((n) => n.id !== id))
    try {
      await deleteBoardNote(id)
    } catch (err) {
      setError(GENERIC_ERROR())
      setNotes(prevNotes)
      console.warn('[MemoBoard] delete failed:', err?.message || err)
    }
  }, [notes])

  // ===== 카테고리 내 순서 변경 (드래그) =====
  const handleDragHandlePointerDown = useCallback((e, note) => {
    e.preventDefault()
    dragStateRef.current = { category: note.category, id: note.id, pointerId: e.pointerId }
    setDragId(note.id)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }, [])

  const handleDragPointerMove = useCallback((e) => {
    const drag = dragStateRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    const listEl = listRefs.current[drag.category]
    if (!listEl) return
    const rows = Array.from(listEl.querySelectorAll('[data-row-id]'))
    if (rows.length === 0) return

    let targetIndex = rows.length - 1
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      if (e.clientY < mid) { targetIndex = i; break }
    }

    setNotes((prev) => {
      const catItems = prev.filter((n) => n.category === drag.category)
      const others = prev.filter((n) => n.category !== drag.category)
      const fromIndex = catItems.findIndex((n) => n.id === drag.id)
      if (fromIndex === -1 || fromIndex === targetIndex) return prev
      const reordered = [...catItems]
      const [moved] = reordered.splice(fromIndex, 1)
      reordered.splice(targetIndex, 0, moved)
      // 카테고리별로 filter해서 그리므로, 다른 카테고리와의 상대 위치는 중요치 않다
      return [...others, ...reordered]
    })
  }, [])

  const handleDragPointerUp = useCallback((e) => {
    const drag = dragStateRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    dragStateRef.current = null
    setDragId(null)

    setNotes((prev) => {
      const catItems = prev.filter((n) => n.category === drag.category)
      const updates = catItems.map((n, idx) => ({ id: n.id, order_index: idx * 1000 }))
      reorderBoardNotes(updates).catch((err) => {
        setError(GENERIC_ERROR())
        console.warn('[MemoBoard] reorder save failed:', err?.message || err)
      })
      const orderMap = Object.fromEntries(updates.map((u) => [u.id, u.order_index]))
      return prev.map((n) => (orderMap[n.id] !== undefined ? { ...n, order_index: orderMap[n.id] } : n))
    })
  }, [])

  return (
    <div className="mb-app">
      <header className="mb-header">
        <div className="mb-brand">
          <div className="mb-brand-mark">🗒️</div>
          <div>
            <div className="mb-brand-title">메모보드</div>
            <div className="mb-brand-sub">매물 · 고객 · 기타메모로 정리된 체크리스트 · 처리할 일 {activeCount}개</div>
          </div>
        </div>
        <div className="mb-header-right">
          <button type="button" className="mb-back-btn" onClick={onBack}>← 업무일지로 돌아가기</button>
        </div>
      </header>

      {!isSupabaseConfigured && (
        <div className="mb-notice">
          <span aria-hidden="true">!</span>
          <div>Supabase 연결 미설정. .env 파일을 확인해주세요. 그 전까지는 메모 저장/조회가 동작하지 않습니다.</div>
        </div>
      )}

      {error && (
        <div className="mb-err">
          <span>{error}</span>
          <button type="button" className="mb-err-close" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="mb-loading">불러오는 중...</div>
      ) : (
        <div className="mb-columns">
          {CATEGORIES.map((cat) => {
            const items = grouped[cat.key]
            const catActive = items.filter((n) => !n.checked).length
            return (
              <section key={cat.key} className="mb-column">
                <div className="mb-column-header">
                  <span className="mb-column-title">{cat.icon} {cat.label}</span>
                  <span className="mb-column-count">{catActive}/{items.length}</span>
                </div>

                <div
                  className="mb-column-list"
                  ref={(el) => { listRefs.current[cat.key] = el }}
                >
                  {items.length === 0 ? (
                    <div className="mb-column-empty">아직 메모가 없습니다.</div>
                  ) : (
                    items.map((note) => {
                      const color = COLOR_MAP[note.color] || COLOR_MAP[DEFAULT_COLOR]
                      return (
                        <div
                          key={note.id}
                          data-row-id={note.id}
                          className={`mb-row${note.checked ? ' is-checked' : ''}${dragId === note.id ? ' is-dragging' : ''}`}
                          style={{ '--row-bg': color.bg, '--row-accent': color.accent }}
                        >
                          <div
                            className="mb-row-handle"
                            title="눌러서 위아래로 순서 이동"
                            onPointerDown={(e) => handleDragHandlePointerDown(e, note)}
                            onPointerMove={handleDragPointerMove}
                            onPointerUp={handleDragPointerUp}
                            onPointerCancel={handleDragPointerUp}
                          >
                            ⠿
                          </div>

                          <button
                            type="button"
                            className="mb-row-check"
                            aria-label={note.checked ? '완료 취소' : '완료 체크'}
                            onClick={() => toggleChecked(note.id, !note.checked)}
                          >
                            {note.checked ? '✓' : ''}
                          </button>

                          <input
                            type="text"
                            className="mb-row-input"
                            defaultValue={note.content}
                            placeholder="메모를 입력하세요..."
                            onBlur={(e) => handleContentBlur(note.id, e.target.value)}
                          />

                          {note.diary_id && (
                            <button
                              type="button"
                              className="mb-row-origin-btn"
                              title="업무일지 원본 메모 보기"
                              onClick={() => setOriginViewId(note.diary_id)}
                            >
                              🔗
                            </button>
                          )}

                          <div className="mb-row-color-wrap">
                            <button
                              type="button"
                              className="mb-row-color-toggle"
                              aria-label="색상 변경"
                              onClick={() => setPickerOpenId(pickerOpenId === note.id ? null : note.id)}
                            >
                              색
                            </button>
                            {pickerOpenId === note.id && (
                              <div className="mb-color-picker mb-color-picker--row">
                                {COLORS.map((c) => (
                                  <button
                                    key={c.key}
                                    type="button"
                                    className="mb-color-dot"
                                    style={{ background: c.bg }}
                                    title={c.label}
                                    onClick={() => changeColor(note.id, c.key)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            className="mb-row-delete"
                            aria-label="메모 삭제"
                            onClick={() => {
                              if (window.confirm('이 메모를 삭제하시겠어요?')) removeNote(note.id)
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>

                <button type="button" className="mb-column-add" onClick={() => addNote(cat.key)}>
                  + 새 메모
                </button>
              </section>
            )
          })}
        </div>
      )}

      {originViewId && (
        <OriginModal diaryId={originViewId} onClose={() => setOriginViewId(null)} />
      )}
    </div>
  )
}
