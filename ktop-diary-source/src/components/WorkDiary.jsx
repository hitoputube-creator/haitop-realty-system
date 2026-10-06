import DiaryLogoutButton from './DiaryLogoutButton'
import { formatPhone, consultationTags } from '../lib/callDiary'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import Calendar from './Calendar'
import DiaryList, { extractTags, STICKER_META as STICKER_META_REF } from './DiaryList'
import SearchBar from './SearchBar'
import UpcomingSchedules from './UpcomingSchedules'
import SelectedScheduleMemos, { AllSchedulesModal } from './SelectedScheduleMemos'
import { DiaryPhotoStrip, PhotoGalleryModal } from './DiaryPhotos'
import { listDiaryPhotosForIds, uploadDiaryPhotos, listDiaryFilesForIds, uploadDiaryFiles, deleteDiaryAttachment } from '../lib/attachments'
import { resolveOrCreateCustomer } from '../lib/customers'
import { buildCustomerMemoPayload } from '../lib/workDiaryPayload'
import AddCustomerMemoModal from './AddCustomerMemoModal'
import CustomerTimelineModal from './CustomerTimelineModal'
import WeeklyDiary from './WeeklyDiary'
import MonthlyDiary from './MonthlyDiary'
import { readLocalJSON, patchLocalJSON } from '../lib/uiState'
import { createBoardNote } from '../lib/boardNotes'
import { toDateKey } from '../lib/dateKeys'
import { countActualScheduleTypes, isScheduleOnDate } from '../lib/scheduleTypes'
import './WorkDiary.css'

const TABLE = 'work_diary'
const DAILY_SCHEDULE_KEY = '__daily_schedule__'
const UI_STATE_KEY = 'wd_ui_state_v1'
function formatTwoDigitDay(day) {
  return String(day).padStart(2, '0')
}

export default function WorkDiary({ onOpenDiary, onOpenStorageAdmin, onOpenMemoBoard }) {
  const today = useMemo(() => new Date(), [])
  // 홈 진입 때 날짜/탭은 항상 오늘로 시작하고, 필터처럼 날짜와 무관한 값만 복원한다.
  const initialUi = useMemo(() => readLocalJSON(UI_STATE_KEY) || {}, [])

  const [selectedDate, setSelectedDate] = useState(today)
  const [viewYear, setViewYear] = useState(() => today.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => today.getMonth())
  const [mainView, setMainView] = useState('today')

  const [memos, setMemos] = useState([])
  const [dailyScheduleNotes, setDailyScheduleNotes] = useState([])
  const [loading, setLoading] = useState(false)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [error, setError] = useState(null)

  /* ===== 전체 일정 보기 ===== */
  const [allScheduleNotes, setAllScheduleNotes] = useState([])
  const [allSchedulesLoading, setAllSchedulesLoading] = useState(false)
  const [allSchedulesOpen, setAllSchedulesOpen] = useState(false)

  const [notedDateKeys, setNotedDateKeys] = useState({})

  const [searchQuery, setSearchQuery] = useState(() => initialUi.searchQuery ?? '')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [highlightMemoId, setHighlightMemoId] = useState(null)

  const searchMode = searchQuery.trim().length > 0
  const [filterWriter, setFilterWriter] = useState(() => initialUi.filterWriter ?? 'all')
  const [weekAnchor, setWeekAnchor] = useState(today)
  const [weekMemos, setWeekMemos] = useState([])
  const [weekLoading, setWeekLoading] = useState(false)
  const [monthMemos, setMonthMemos] = useState([])
  const [monthLoading, setMonthLoading] = useState(false)

  /* ===== 연결고리 ===== */
  const [allLinkKeys, setAllLinkKeys] = useState([])
  const [linkKeyFilter, setLinkKeyFilter] = useState(null)
  const [linkMemos, setLinkMemos] = useState([])
  const [linkMemosLoading, setLinkMemosLoading] = useState(false)

  /* ===== 포스트잇 고정 상태 ===== */
  const [stickyData, setStickyData] = useState([])   // [{sticky, memo}]
  const [photoMap, setPhotoMap] = useState({})
  const [fileMap, setFileMap] = useState({})
  const [photoGallery, setPhotoGallery] = useState(null)
  const [upcomingRefreshKey, setUpcomingRefreshKey] = useState(0)

  /* ===== 고객별 메모 타임라인 ===== */
  const [addMemoTarget, setAddMemoTarget] = useState(null) // { customer: {id,name,phone}, defaultDate }
  // haitop-realty-system 고객페이지의 "업무일지" 버튼에서 ?customerId=로 들어오면
  // 해당 고객의 타임라인을 바로 연다(한 번만 - URL은 히스토리에서 지운다).
  const [timelineCustomerId, setTimelineCustomerId] = useState(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return params.get('customerId') || null
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!new URLSearchParams(window.location.search).get('customerId')) return
    const url = new URL(window.location.href)
    url.searchParams.delete('customerId')
    window.history.replaceState({}, '', url.toString())
  }, [])
  const [timelineReloadKey, setTimelineReloadKey] = useState(0)
  const [diaryListResetToken, setDiaryListResetToken] = useState(0)
  const [composerDirty, setComposerDirty] = useState(false)
  const handleComposerDirtyChange = useCallback((dirty) => {
    setComposerDirty(Boolean(dirty))
  }, [])

  // 현재 고정된 diary_id Set — MemoCard 버튼 상태 판단용
  const pinnedDiaryIds = useMemo(
    () => new Set(stickyData.map((d) => d.sticky.diary_id)),
    [stickyData]
  )

  /* ===== 화면 상태(날짜/필터/검색어) 저장 ===== */
  useEffect(() => {
    patchLocalJSON(UI_STATE_KEY, {
      filterWriter,
      searchQuery,
    })
  }, [filterWriter, searchQuery])

  /* ===== 스크롤 위치 저장/복원 =====
   * scroll 이벤트는 버블링되지 않으므로 capture 단계에서 document에 붙여
   * 페이지 전체 스크롤(window)과 메모 목록(.wd-list) 내부 스크롤을 함께 잡는다.
   * requestAnimationFrame은 탭이 백그라운드거나 화면이 그려지지 않는 상태에서는
   * 아예 실행되지 않을 수 있으므로, setTimeout 기반으로 저장 빈도만 가볍게 제한한다. */
  const scrollSaveTimerRef = useRef(null)
  useEffect(() => {
    function handleScroll(e) {
      if (scrollSaveTimerRef.current) return
      scrollSaveTimerRef.current = setTimeout(() => {
        scrollSaveTimerRef.current = null
        const target = e.target
        if (target === document) {
          patchLocalJSON(UI_STATE_KEY, { scrollY: window.scrollY })
        } else if (target?.classList?.contains?.('wd-list')) {
          patchLocalJSON(UI_STATE_KEY, { listScrollTop: target.scrollTop })
        }
      }, 150)
    }
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener('scroll', handleScroll, true)
      clearTimeout(scrollSaveTimerRef.current)
    }
  }, [])

  const restoreScrollAndFilters = useCallback(() => {
    const saved = readLocalJSON(UI_STATE_KEY)
    if (!saved) return
    // bfcache 복원 등으로 pageshow가 발생했을 때도 날짜와 무관한 상태만 다시 맞춘다.
    // 값이 이미 같으면 이전 state를 그대로 반환해 불필요한 재렌더/재조회를 막는다.
    if (saved.filterWriter) {
      setFilterWriter((prev) => (prev === saved.filterWriter ? prev : saved.filterWriter))
    }
    if (typeof saved.searchQuery === 'string') {
      setSearchQuery((prev) => (prev === saved.searchQuery ? prev : saved.searchQuery))
    }
    if (typeof saved.scrollY === 'number') window.scrollTo(0, saved.scrollY)
    if (typeof saved.listScrollTop === 'number') {
      const listEl = document.querySelector('.wd-list')
      if (listEl) listEl.scrollTop = saved.listScrollTop
    }
  }, [])

  const resetHomeDateToToday = useCallback(() => {
    const t = new Date()
    const todayKey = toDateKey(t)
    setSelectedDate((prev) => (toDateKey(prev) === todayKey ? prev : t))
    setViewYear((prev) => (prev === t.getFullYear() ? prev : t.getFullYear()))
    setViewMonth((prev) => (prev === t.getMonth() ? prev : t.getMonth()))
    setMainView((prev) => (prev === 'today' ? prev : 'today'))
  }, [])

  const restoredOnceRef = useRef(false)
  useEffect(() => {
    // 마운트 직후 한 번, 그리고 목록 로딩이 끝나 실제 스크롤 높이가 자리잡은 뒤 한 번 더 복원한다.
    const t = setTimeout(restoreScrollAndFilters, 60)
    function handlePageShow() {
      resetHomeDateToToday()
      restoreScrollAndFilters()
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => {
      clearTimeout(t)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [restoreScrollAndFilters, resetHomeDateToToday])

  useEffect(() => {
    if (loading || searchLoading || restoredOnceRef.current) return
    restoredOnceRef.current = true
    const t = setTimeout(restoreScrollAndFilters, 30)
    return () => clearTimeout(t)
  }, [loading, searchLoading, restoreScrollAndFilters])

  /* ===== 선택 날짜의 메모 로드 ===== */
  const loadPhotosForRows = useCallback(async (rows) => {
    const ids = (rows || []).map((row) => row.id).filter(Boolean)
    if (!isSupabaseConfigured || ids.length === 0) return
    try {
      const nextMap = await listDiaryPhotosForIds(ids)
      setPhotoMap((prev) => ({ ...prev, ...nextMap }))
    } catch (err) {
      console.warn('[DiaryPhotos] load failed:', err.message || err)
    }
  }, [])

  const handleAddPhotosToMemo = useCallback(async (memoId, photoFiles = [], uploadedBy = '') => {
    if (!memoId || photoFiles.length === 0) return []
    const uploadedPhotos = await uploadDiaryPhotos({
      files: photoFiles,
      workDiaryId: memoId,
      uploadedBy,
    })
    setPhotoMap((prev) => ({
      ...prev,
      [memoId]: [...(prev[memoId] || []), ...uploadedPhotos],
    }))
    return uploadedPhotos
  }, [])

  const loadFilesForRows = useCallback(async (rows) => {
    const ids = (rows || []).map((row) => row.id).filter(Boolean)
    if (!isSupabaseConfigured || ids.length === 0) return
    try {
      const nextMap = await listDiaryFilesForIds(ids)
      setFileMap((prev) => ({ ...prev, ...nextMap }))
    } catch (err) {
      console.warn('[DiaryFiles] load failed:', err.message || err)
    }
  }, [])

  const handleAddFilesToMemo = useCallback(async (memoId, files = [], uploadedBy = '') => {
    if (!memoId || files.length === 0) return []
    const uploadedFiles = await uploadDiaryFiles({
      files,
      workDiaryId: memoId,
      uploadedBy,
    })
    setFileMap((prev) => ({
      ...prev,
      [memoId]: [...(prev[memoId] || []), ...uploadedFiles],
    }))
    return uploadedFiles
  }, [])

  const handleDeleteAttachment = useCallback(async (attachment) => {
    if (!attachment?.id) return false
    const label = String(attachment.mime_type || '').startsWith('image/') ? '사진' : '파일'
    if (!window.confirm(`이 첨부 ${label}을 삭제할까요?`)) return false

    const memoId = attachment.work_diary_id
    const isPhoto = String(attachment.mime_type || '').startsWith('image/')
    try {
      await deleteDiaryAttachment(attachment)
      if (memoId) {
        if (isPhoto) {
          setPhotoMap((prev) => ({
            ...prev,
            [memoId]: (prev[memoId] || []).filter((item) => item.id !== attachment.id),
          }))
        } else {
          setFileMap((prev) => ({
            ...prev,
            [memoId]: (prev[memoId] || []).filter((item) => item.id !== attachment.id),
          }))
        }
      }
      return true
    } catch (err) {
      setError(`첨부 ${label} 삭제 실패: ${err.message || err}`)
      return false
    }
  }, [])

  const loadMemosForSelected = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setMemos([])
      setDailyScheduleNotes([])
      return
    }
    setLoading(true)
    setScheduleLoading(true)
    setError(null)
    setScheduleError('')
    try {
      const dateStr = toDateKey(selectedDate)
      const { data, error: e } = await supabase
        .from(TABLE)
        .select('*')
        .or(`date.eq.${dateStr},schedule_date.eq.${dateStr}`)
        .order('created_at', { ascending: true })
      if (e) throw e
      const rows = data || []
      const scheduleRows = rows.filter((row) => row.link_key === DAILY_SCHEDULE_KEY)
      const diaryRows = rows.filter((row) => row.link_key !== DAILY_SCHEDULE_KEY)
      setMemos(diaryRows)
      setDailyScheduleNotes(scheduleRows)
      loadPhotosForRows(diaryRows)
      loadFilesForRows(diaryRows)
    } catch (err) {
      setError(`메모를 불러오지 못했습니다: ${err.message || err}`)
      setMemos([])
      setDailyScheduleNotes([])
    } finally {
      setLoading(false)
      setScheduleLoading(false)
    }
  }, [selectedDate, loadPhotosForRows, loadFilesForRows])

  useEffect(() => {
    loadMemosForSelected()
  }, [loadMemosForSelected])

  /* ===== 표시 중인 달의 메모 있는 날짜 마킹 ===== */
  const loadMonthDots = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setNotedDateKeys({})
      return
    }
    try {
      const start = new Date(viewYear, viewMonth, 1)
      const end = new Date(viewYear, viewMonth + 1, 0)
      const startStr = toDateKey(start)
      const endStr = toDateKey(end)
      const { data, error: e } = await supabase
        .from(TABLE)
        .select('date, writer, sticker, link_key, schedule_date, title, content')
        .or(`and(date.gte.${startStr},date.lte.${endStr}),and(schedule_date.gte.${startStr},schedule_date.lte.${endStr})`)
      if (e) throw e

      // { [dateKey]: [{ writer, sticker, title, content }] }
      // schedule_date가 date와 다르면(스티커를 다른 날짜로 옮긴 경우), 작성일에는
      // 스티커 없이(sticker: null) 표시하고 일정일 쪽에 스티커를 표시한다.
      const dotsMap = {}
      if (data) {
        data.forEach((r) => {
          const writer = r.writer || '케이탑'
          if (r.link_key === DAILY_SCHEDULE_KEY) {
            if (r.date >= startStr && r.date <= endStr) {
              if (!dotsMap[r.date]) dotsMap[r.date] = []
              dotsMap[r.date].push({ ...r, writer })
            }
            return
          }

          const moved = Boolean(r.schedule_date) && r.schedule_date !== r.date
          if (r.date >= startStr && r.date <= endStr) {
            if (!dotsMap[r.date]) dotsMap[r.date] = []
            dotsMap[r.date].push(moved ? { writer, sticker: null } : { ...r, writer })
          }
          if (moved && r.schedule_date >= startStr && r.schedule_date <= endStr) {
            if (!dotsMap[r.schedule_date]) dotsMap[r.schedule_date] = []
            dotsMap[r.schedule_date].push({ ...r, writer })
          }
        })
      }
      setNotedDateKeys(dotsMap)
    } catch (err) {
      // 도트는 실패해도 무시 (UI 차단 X)
      // eslint-disable-next-line no-console
      console.warn('[WorkDiary] month dots load failed:', err)
    }
  }, [viewYear, viewMonth])

  useEffect(() => {
    loadMonthDots()
  }, [loadMonthDots])

  const weekDays = useMemo(() => {
    const start = new Date(weekAnchor)
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }, [weekAnchor])

  useEffect(() => {
    if (mainView !== 'week' || !isSupabaseConfigured) return undefined
    let cancelled = false
    setWeekLoading(true)
    ;(async () => {
      try {
        const { data, error: weekError } = await supabase
          .from(TABLE)
          .select('*')
          .gte('date', toDateKey(weekDays[0]))
          .lte('date', toDateKey(weekDays[6]))
          .order('date', { ascending: true })
          .order('created_at', { ascending: true })
        if (weekError) throw weekError
        if (!cancelled) {
          const rows = (data || []).filter((row) => row.link_key !== DAILY_SCHEDULE_KEY)
          setWeekMemos(rows)
          loadPhotosForRows(rows)
          loadFilesForRows(rows)
        }
      } catch (weekError) {
        if (!cancelled) setError(`\uC8FC\uAC04 \uBA54\uBAA8 \uC870\uD68C \uC2E4\uD328: ${weekError.message || weekError}`)
      } finally {
        if (!cancelled) setWeekLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [mainView, weekDays, upcomingRefreshKey, loadPhotosForRows, loadFilesForRows])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setMonthMemos([])
      setMonthLoading(false)
      return undefined
    }
    if (mainView !== 'month') return undefined

    let cancelled = false
    setMonthLoading(true)
    ;(async () => {
      try {
        const start = new Date(viewYear, viewMonth, 1)
        const end = new Date(viewYear, viewMonth + 1, 0)
        const { data, error: monthError } = await supabase
          .from(TABLE)
          .select('*')
          .gte('date', toDateKey(start))
          .lte('date', toDateKey(end))
          .order('date', { ascending: true })
          .order('created_at', { ascending: true })
        if (monthError) throw monthError
        if (!cancelled) {
          const rows = (data || []).filter((row) => row.link_key !== DAILY_SCHEDULE_KEY)
          setMonthMemos(rows)
          loadPhotosForRows(rows)
          loadFilesForRows(rows)
        }
      } catch (monthError) {
        if (!cancelled) {
          setError(`\uC6D4\uAC04 \uBA54\uBAA8 \uC870\uD68C \uC2E4\uD328: ${monthError.message || monthError}`)
          setMonthMemos([])
        }
      } finally {
        if (!cancelled) setMonthLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [mainView, viewYear, viewMonth, upcomingRefreshKey, loadPhotosForRows, loadFilesForRows])

  /* ===== 사용 중인 연결고리 목록 로드 ===== */
  const loadAllLinkKeys = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      const { data, error: e } = await supabase
        .from(TABLE)
        .select('link_key')
        .neq('link_key', '')
      if (e) throw e
      const unique = Array.from(new Set((data || []).map((r) => r.link_key).filter(Boolean)))
        .filter((key) => key !== DAILY_SCHEDULE_KEY)
        .sort()
      setAllLinkKeys(unique)
    } catch {
      // 실패해도 무시
    }
  }, [])

  useEffect(() => {
    loadAllLinkKeys()
  }, [loadAllLinkKeys])

  /* ===== 연결 메모 조회 ===== */
  const loadLinkMemos = useCallback(async (key) => {
    if (!isSupabaseConfigured || !key) return
    setLinkMemosLoading(true)
    try {
      const { data, error: e } = await supabase
        .from(TABLE)
        .select('*')
        .eq('link_key', key)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true })
      if (e) throw e
      const rows = data || []
      setLinkMemos(rows)
      loadPhotosForRows(rows)
      loadFilesForRows(rows)
    } catch (err) {
      setError(`연결 메모 조회 실패: ${err.message || err}`)
      setLinkMemos([])
    } finally {
      setLinkMemosLoading(false)
    }
  }, [loadPhotosForRows, loadFilesForRows])

  function handleLinkKeyClick(key) {
    setLinkKeyFilter(key)
    loadLinkMemos(key)
  }

  /* ===== 포스트잇 로드 ===== */
  const loadStickyNotes = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      const { data: stickies, error: e1 } = await supabase
        .from('work_sticky_notes')
        .select('*')
        .order('created_at', { ascending: false })
      if (e1) throw e1

      if (!stickies || stickies.length === 0) {
        setStickyData([])
        return
      }

      const ids = stickies.map((s) => s.diary_id)
      const { data: diaryMemos, error: e2 } = await supabase
        .from(TABLE)
        .select('*')
        .in('id', ids)
      if (e2) throw e2

      const memoMap = {}
      ;(diaryMemos || []).forEach((m) => { memoMap[m.id] = m })
      setStickyData(stickies.map((s) => ({ sticky: s, memo: memoMap[s.diary_id] || null })))
    } catch (err) {
      console.warn('[StickyNotes] load failed:', err.message || err)
    }
  }, [])

  useEffect(() => { loadStickyNotes() }, [loadStickyNotes])

  /* 메모를 메모보드(매물/고객/기타메모 체크리스트)에 항목으로 추가 */
  const handleAddToBoard = useCallback(async (memo) => {
    if (!isSupabaseConfigured) return
    const rawTitle = (memo?.title || '').trim()
    const firstLine = (memo?.content || '').split('\n')[0].trim()
    const fallback = firstLine.length > 28 ? firstLine.slice(0, 28) + '…' : firstLine
    const title = rawTitle || fallback || '(제목 없음)'
    const category = memo?.listing_id ? 'listing' : (memo?.customer_id ? 'customer' : 'etc')
    try {
      await createBoardNote({
        content: title,
        color: 'yellow',
        category,
        diary_id: memo?.id || null,
      })
      // 추가 후 바로 메모보드로 이동해서 결과를 보여준다
      onOpenMemoBoard?.()
    } catch (err) {
      setError(`메모보드 추가 실패: ${err.message || err}`)
      throw err
    }
  }, [onOpenMemoBoard])

  /* ===== 날짜 네비게이션 (LinkKeySearchBox 검색 결과 클릭 시) ===== */
  const handleNavigate = useCallback((dateStr, memoId) => {
    if (!dateStr) return
    const d = new Date(dateStr + 'T00:00:00')
    if (isNaN(d.getTime())) return
    setSearchQuery('')         // 메인 검색 초기화
    setMainView('today')
    handleSelectDate(d)        // 해당 날짜로 이동
    setHighlightMemoId(memoId || null)
    // 3초 후 하이라이트 해제
    if (memoId) setTimeout(() => setHighlightMemoId(null), 3000)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ===== 검색 ===== */
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) {
      setSearchResults([])
      return
    }
    if (!isSupabaseConfigured) {
      setSearchResults([])
      return
    }

    let cancelled = false
    setSearchLoading(true)
    ;(async () => {
      try {
        const isTagSearch = q.startsWith('#')
        const tagTerm = isTagSearch ? q.slice(1) : q
        // 공백·언더바를 제거한 정규화 쿼리 (헤이 부동산 → 헤이부동산)
        const normQ = q.replace(/[\s_]+/g, '')

        let orParts
        if (isTagSearch) {
          orParts = [`tags.cs.{${tagTerm}}`]
        } else {
          orParts = [
            `title.ilike.%${q}%`,
            `customer_name.ilike.%${q}%`,
            `customer_phone.ilike.%${q}%`,
            `content.ilike.%${q}%`,
            `tags.cs.{${tagTerm}}`,
            `link_key.ilike.%${q}%`,
            `writer.ilike.%${q}%`,
          ]
          // 정규화 쿼리가 원본과 다를 때 추가 검색
          if (normQ && normQ !== q) {
            orParts.push(
              `title.ilike.%${normQ}%`,
              `customer_name.ilike.%${normQ}%`,
              `customer_phone.ilike.%${normQ}%`,
              `content.ilike.%${normQ}%`,
              `link_key.ilike.%${normQ}%`
            )
          }
        }

        const { data, error: e } = await supabase
          .from(TABLE)
          .select('*')
          .or(orParts.join(','))
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(200)
        if (e) throw e
        if (!cancelled) {
          const rows = data || []
          const diaryRows = rows.filter((row) => row.link_key !== DAILY_SCHEDULE_KEY)
          setSearchResults(diaryRows)
          loadPhotosForRows(diaryRows)
          loadFilesForRows(diaryRows)
        }
      } catch (err) {
        if (!cancelled) {
          setError(`검색 실패: ${err.message || err}`)
          setSearchResults([])
        }
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [searchQuery, loadPhotosForRows, loadFilesForRows])

  /* ===== CRUD 핸들러 ===== */
  const handleCreate = useCallback(
    async (content, writer = '케이탑', sticker = null, linkKey = '', name = '', phone = '', title = '', pickedCustomerId = null, scheduleDate = null, relationOpts = {}) => {
      const { relationType = null, listingId = null, contactId = null } = relationOpts || {}
      if (!isSupabaseConfigured) {
        setError('Supabase 연결이 설정되지 않았습니다. .env에 VITE_SUPABASE_URL 및 VITE_SUPABASE_ANON_KEY를 추가해주세요.')
        return
      }
      try {
        const tags = extractTags(content)
        const dateStr = toDateKey(selectedDate)

        // "기존 고객·메모 불러오기"로 이미 고른 customer_id가 있으면 그대로 사용해
        // 같은 고객으로 정확히 연결한다. 없을 때만 이름/연락처로 찾거나 새로 만든다.
        // (실패해도 메모 저장 자체는 막지 않는다)
        let customerId = pickedCustomerId || null
        if (!customerId && (name.trim() || phone.trim())) {
          try {
            const customer = await resolveOrCreateCustomer({ name, phone, manager: writer })
            customerId = customer?.id || null
          } catch (custErr) {
            console.warn('[WorkDiary] customer resolve failed:', custErr.message || custErr)
          }
        }

        const { data, error: e } = await supabase
          .from(TABLE)
          .insert({
            content,
            tags,
            status: 'normal',
            date: dateStr,
            writer,
            sticker: sticker || null,
            schedule_date: sticker ? (scheduleDate || dateStr) : null,
            link_key: linkKey || '',
            customer_name: name || null,
            customer_phone: formatPhone(phone) || null,
            title: title || null,
            customer_id: customerId,
            relation_type: relationType,
            listing_id: listingId,
            contact_id: contactId,
          })
          .select()
          .single()
        if (e) throw e
        setMemos((prev) => [...prev, data])
        setNotedDateKeys((prev) => {
          const next = { ...prev }
          if (!next[dateStr]) next[dateStr] = []
          next[dateStr] = [...next[dateStr], { writer, sticker: sticker || null }]
          return next
        })
        // 새 연결고리가 있으면 목록 갱신
        if (linkKey) {
          setAllLinkKeys((prev) =>
            prev.includes(linkKey) ? prev : [...prev, linkKey].sort()
          )
        }
        loadMonthDots()
        setError(null)
        setUpcomingRefreshKey((key) => key + 1)
        return data
      } catch (err) {
        setError(`저장 실패: ${err.message || err}`)
        throw err
      }
    },
    [selectedDate, loadMonthDots]
  )

  const handleCreateDailySchedule = useCallback(async ({ writer = '케이탑', content, sticker = null }) => {
    const text = (content || '').trim()
    if (!isSupabaseConfigured || !text) return

    setScheduleSaving(true)
    setScheduleError('')
    try {
      const dateStr = toDateKey(selectedDate)
      const { data, error: e } = await supabase
        .from(TABLE)
        .insert({
          content: text,
          tags: [],
          status: 'normal',
          date: dateStr,
          writer,
          sticker: sticker || null,
          link_key: DAILY_SCHEDULE_KEY,
          schedule_date: null,
          customer_name: null,
          customer_phone: null,
          title: null,
        })
        .select()
        .single()
      if (e) throw e
      setDailyScheduleNotes((prev) => [...prev, data])
      setAllScheduleNotes((prev) => [data, ...prev])
      loadMonthDots()
      setUpcomingRefreshKey((key) => key + 1)
    } catch (err) {
      setScheduleError(`일정 메모 저장 실패: ${err.message || err}`)
      throw err
    } finally {
      setScheduleSaving(false)
    }
  }, [selectedDate, loadMonthDots])

  const handleUpdateDailySchedule = useCallback(async (id, { writer = '케이탑', content, sticker }) => {
    const text = (content || '').trim()
    if (!isSupabaseConfigured || !id || !text) return

    const patch = { writer, content: text }
    if (sticker !== undefined) patch.sticker = sticker || null
    const prevDaily = dailyScheduleNotes
    const prevAll = allScheduleNotes
    const applyPatch = (items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch, updated_at: new Date().toISOString() } : item))
    setDailyScheduleNotes(applyPatch)
    setAllScheduleNotes(applyPatch)
    setScheduleSaving(true)
    setScheduleError('')
    try {
      const { error: e } = await supabase
        .from(TABLE)
        .update(patch)
        .eq('id', id)
        .eq('link_key', DAILY_SCHEDULE_KEY)
      if (e) throw e
      loadMonthDots()
      setUpcomingRefreshKey((key) => key + 1)
    } catch (err) {
      setDailyScheduleNotes(prevDaily)
      setAllScheduleNotes(prevAll)
      setScheduleError(`일정 메모 수정 실패: ${err.message || err}`)
      throw err
    } finally {
      setScheduleSaving(false)
    }
  }, [dailyScheduleNotes, allScheduleNotes, loadMonthDots])

  const handleDeleteDailySchedule = useCallback(async (id) => {
    if (!isSupabaseConfigured || !id) return

    const prevDaily = dailyScheduleNotes
    const prevAll = allScheduleNotes
    setDailyScheduleNotes((items) => items.filter((item) => item.id !== id))
    setAllScheduleNotes((items) => items.filter((item) => item.id !== id))
    setScheduleError('')
    try {
      const { error: e } = await supabase
        .from(TABLE)
        .delete()
        .eq('id', id)
        .eq('link_key', DAILY_SCHEDULE_KEY)
      if (e) throw e
      loadMonthDots()
      setUpcomingRefreshKey((key) => key + 1)
    } catch (err) {
      setDailyScheduleNotes(prevDaily)
      setAllScheduleNotes(prevAll)
      setScheduleError(`일정 메모 삭제 실패: ${err.message || err}`)
    }
  }, [dailyScheduleNotes, allScheduleNotes, loadMonthDots])

  /* ===== 전체 일정 조회/열기 ===== */
  const loadAllScheduleNotes = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setAllScheduleNotes([])
      return
    }
    setAllSchedulesLoading(true)
    setScheduleError('')
    try {
      const { data, error: e } = await supabase
        .from(TABLE)
        .select('*')
        .eq('link_key', DAILY_SCHEDULE_KEY)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      if (e) throw e
      setAllScheduleNotes(data || [])
    } catch (err) {
      setScheduleError(`전체 일정 조회 실패: ${err.message || err}`)
    } finally {
      setAllSchedulesLoading(false)
    }
  }, [])

  const handleOpenAllSchedules = useCallback(() => {
    setAllSchedulesOpen(true)
    loadAllScheduleNotes()
  }, [loadAllScheduleNotes])

  const filteredMemos = useMemo(() => {
    const raw = searchMode ? searchResults : memos
    if (filterWriter === 'all') return raw
    return raw.filter((m) => (m.writer || '케이탑') === filterWriter)
  }, [searchMode, searchResults, memos, filterWriter])

  const filteredDailyScheduleNotes = useMemo(() => {
    if (filterWriter === 'all') return dailyScheduleNotes
    return dailyScheduleNotes.filter((note) => (note.writer || '케이탑') === filterWriter)
  }, [dailyScheduleNotes, filterWriter])

  const monthStartKey = useMemo(() => toDateKey(new Date(viewYear, viewMonth, 1)), [viewYear, viewMonth])
  const monthEndKey = useMemo(() => toDateKey(new Date(viewYear, viewMonth + 1, 0)), [viewYear, viewMonth])
  const visibleMonthMemos = useMemo(() => {
    const raw = searchMode ? searchResults : monthMemos
    return raw.filter((memo) => {
      const memoDate = memo.date || ''
      if (memo.link_key === DAILY_SCHEDULE_KEY) return false
      if (memoDate < monthStartKey || memoDate > monthEndKey) return false
      if (filterWriter !== 'all' && (memo.writer || '케이탑') !== filterWriter) return false
      return true
    })
  }, [searchMode, searchResults, monthMemos, monthStartKey, monthEndKey, filterWriter])

  const sortDiaryRows = useCallback((rows) => {
    return [...rows].sort((a, b) => {
      const dateCmp = String(a.date || '').localeCompare(String(b.date || ''))
      if (dateCmp !== 0) return dateCmp
      return String(a.created_at || '').localeCompare(String(b.created_at || ''))
    })
  }, [])

  const selectedWeekdayLabel = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][selectedDate.getDay()]
  const selectedMonthLabel = `${selectedDate.getMonth() + 1}월`
  const selectedDayLabel = formatTwoDigitDay(selectedDate.getDate())
  const selectedDateKey = toDateKey(selectedDate)
  const selectedScheduleCounts = useMemo(() => {
    const typedDiarySchedules = filteredMemos.filter((memo) => isScheduleOnDate(memo, selectedDateKey))
    return countActualScheduleTypes([...typedDiarySchedules, ...filteredDailyScheduleNotes])
  }, [filteredMemos, filteredDailyScheduleNotes, selectedDateKey])
  const handleChangeStatus = useCallback(async (id, nextStatus) => {
    if (!isSupabaseConfigured) return
    // 낙관적 업데이트
    setMemos((prev) => prev.map((m) => (m.id === id ? { ...m, status: nextStatus } : m)))
    setSearchResults((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: nextStatus } : m))
    )
    setMonthMemos((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: nextStatus } : m))
    )
    try {
      const { error: e } = await supabase
        .from(TABLE)
        .update({ status: nextStatus })
        .eq('id', id)
      if (e) throw e
    } catch (err) {
      setError(`상태 변경 실패: ${err.message || err}`)
      // 실패 시 원본 다시 로드
      loadMemosForSelected()
    }
  }, [loadMemosForSelected])

  const handleDelete = useCallback(
    async (id) => {
      if (!isSupabaseConfigured) return
      const prevList = memos
      const prevSearch = searchResults
      const prevMonth = monthMemos
      setMemos((prev) => prev.filter((m) => m.id !== id))
      setSearchResults((prev) => prev.filter((m) => m.id !== id))
      setMonthMemos((prev) => prev.filter((m) => m.id !== id))
      setPhotoMap((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setFileMap((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      try {
        const { error: e } = await supabase.from(TABLE).delete().eq('id', id)
        if (e) throw e
        // 해당 날짜에 메모가 더 이상 없으면 도트 제거
        loadMonthDots()
        setUpcomingRefreshKey((key) => key + 1)
      } catch (err) {
        setError(`삭제 실패: ${err.message || err}`)
        setMemos(prevList)
        setSearchResults(prevSearch)
        setMonthMemos(prevMonth)
      }
    },
    [memos, searchResults, monthMemos, loadMonthDots]
  )

  const handleUpdateLinkKey = useCallback(async (id, linkKey) => {
    if (!isSupabaseConfigured) return
    const normalized = (linkKey || '').trim()
    // 낙관적 업데이트
    setMemos((prev) => prev.map((m) => (m.id === id ? { ...m, link_key: normalized } : m)))
    setSearchResults((prev) => prev.map((m) => (m.id === id ? { ...m, link_key: normalized } : m)))
    setMonthMemos((prev) => prev.map((m) => (m.id === id ? { ...m, link_key: normalized } : m)))
    try {
      const { error: e } = await supabase
        .from(TABLE)
        .update({ link_key: normalized })
        .eq('id', id)
      if (e) throw e
      // 새 연결태그가 생겼으면 목록 갱신
      if (normalized) {
        setAllLinkKeys((prev) =>
          prev.includes(normalized) ? prev : [...prev, normalized].sort()
        )
      }
    } catch (err) {
      setError(`연결태그 저장 실패: ${err.message || err}`)
      loadMemosForSelected()
    }
  }, [loadMemosForSelected])

  const handleUpdateContent = useCallback(async (id, content, meta = {}) => {
    if (!isSupabaseConfigured) return false
    let source = memos.find((m) => m.id === id) || searchResults.find((m) => m.id === id) || weekMemos.find((m) => m.id === id) || monthMemos.find((m) => m.id === id)
    if (!source) {
      const { data, error: readError } = await supabase.from(TABLE).select('title,tags').eq('id', id).maybeSingle()
      if (readError || !data) {
        setError('원래 상담 기록을 확인하지 못했습니다. 잠시 후 다시 수정해주세요.')
        return false
      }
      source = data
    }
    const tags = consultationTags(source, extractTags(content))
    let patch = { content, tags, ...meta }
    if ('customer_phone' in patch) patch.customer_phone = formatPhone(patch.customer_phone) || null

    // 아직 customer_id가 없는데 이름/연락처가 입력되면 고객을 찾거나 새로 만들어 연결
    if (!('customer_id' in meta)) {
      const existing = memos.find((m) => m.id === id) || searchResults.find((m) => m.id === id)
      const alreadyLinked = existing?.customer_id
      const nextName = 'customer_name' in meta ? meta.customer_name : existing?.customer_name
      const nextPhone = 'customer_phone' in meta ? meta.customer_phone : existing?.customer_phone
      if (!alreadyLinked && (nextName || nextPhone)) {
        try {
          const customer = await resolveOrCreateCustomer({ name: nextName, phone: nextPhone, manager: existing?.writer })
          if (customer?.id) patch = { ...patch, customer_id: customer.id }
        } catch (custErr) {
          console.warn('[WorkDiary] customer resolve failed:', custErr.message || custErr)
        }
      }
    }

    setMemos((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    )
    setWeekMemos((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    )
    setMonthMemos((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    )
    setSearchResults((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    )
    try {
      const { error: e } = await supabase
        .from(TABLE)
        .update(patch)
        .eq('id', id)
      if (e) throw e
      if (typeof patch.link_key === 'string' && patch.link_key.trim()) {
        const normalized = patch.link_key.trim()
        setAllLinkKeys((prev) =>
          prev.includes(normalized) ? prev : [...prev, normalized].sort()
        )
      }
      loadMonthDots()
      setUpcomingRefreshKey((key) => key + 1)
      // 작성일이나 일정일이 바뀌면 선택된 날짜 목록에 그대로 남아있으면 안 되므로 다시 불러온다.
      if ('date' in meta || 'schedule_date' in meta) loadMemosForSelected()
      return true
    } catch (err) {
      setError(`수정 실패: ${err.message || err}`)
      loadMemosForSelected()
      return false
    }
  }, [loadMemosForSelected, loadMonthDots, memos, searchResults, weekMemos, monthMemos])

  /* ===== 고객별 메모 타임라인 ===== */

  // 카드에 customer_id가 없으면 고객을 찾거나 새로 만들어 그 자리에서 연결한다.
  // 반환값은 오직 customer_id뿐 — title/customer_name/phone은 절대 이 함수가 정하지 않는다.
  // (검색/생성용 이름이 필요하면 호출부에서 customerLookupName을 따로 만들어 넘긴다)
  const ensureCustomerLinked = useCallback(async (memo) => {
    if (memo.customer_id) {
      return { id: memo.customer_id }
    }
    // customers 조회/생성에는 customer_name과 phone만 사용한다. title은 고객명으로 쓰지 않는다.
    const customerLookupName = (memo.customer_name || '').trim()
    if (!customerLookupName && !memo.customer_phone) return null

    const customer = await resolveOrCreateCustomer({
      name: customerLookupName,
      phone: memo.customer_phone,
      manager: memo.writer,
    })
    if (!customer?.id) return null

    setMemos((prev) => prev.map((m) => (m.id === memo.id ? { ...m, customer_id: customer.id } : m)))
    setSearchResults((prev) => prev.map((m) => (m.id === memo.id ? { ...m, customer_id: customer.id } : m)))
    try {
      const { error: e } = await supabase.from(TABLE).update({ customer_id: customer.id }).eq('id', memo.id)
      if (e) throw e
    } catch (err) {
      console.warn('[WorkDiary] customer_id backfill failed:', err.message || err)
    }
    return { id: customer.id }
  }, [])

  // 기존 카드에서 "메모 추가" — 새 메모의 title/customer_name/phone은 원본 카드 그대로 복사한다.
  const handleOpenAddMemoForMemo = useCallback(async (memo) => {
    try {
      const linked = await ensureCustomerLinked(memo)
      setAddMemoTarget({
        customerId: linked?.id || null,
        sourceDiaryId: memo.id,
        sourceTitle: memo.title || '',
        sourceCustomerName: memo.customer_name || '',
        sourcePhone: memo.customer_phone || '',
        defaultDate: memo.date || toDateKey(selectedDate),
      })
    } catch (err) {
      setError(`고객 연결 실패: ${err.message || err}`)
    }
  }, [ensureCustomerLinked, selectedDate])

  const handleOpenTimelineForMemo = useCallback(async (memo) => {
    try {
      const linked = await ensureCustomerLinked(memo)
      if (!linked) {
        setError('고객 이름 또는 연락처가 없어 전체 메모를 볼 수 없습니다.')
        return
      }
      setTimelineCustomerId(linked.id)
    } catch (err) {
      setError(`고객 연결 실패: ${err.message || err}`)
    }
  }, [ensureCustomerLinked])

  // 고객에게 특정 날짜로 메모를 저장 — 같은 레코드가 선택 날짜의 업무일지 목록과
  // 고객 타임라인 양쪽에서 동시에 보이도록 work_diary에 customer_id + date로 저장
  const handleCreateForCustomer = useCallback(async ({ customerId, sourceDiaryId, title, customerName, phone, date, content, writer }) => {
    if (!isSupabaseConfigured) throw new Error('Supabase 연결이 설정되지 않았습니다.')
    if (!date) throw new Error('기록 날짜를 선택해주세요.')

    const payload = buildCustomerMemoPayload(
      {},
      { customerId, sourceDiaryId, title, customerName, phone, date, content, writer },
      customerId ? { id: customerId } : null
    )
    const insertPayload = {
      content: payload.content,
      tags: extractTags(payload.content || ''),
      status: 'normal',
      date: payload.date,
      writer: payload.author,
      sticker: null,
      link_key: '',
      title: payload.title,
      customer_name: payload.customer_name,
      customer_phone: payload.customer_phone,
      customer_id: payload.customer_id,
      source_diary_id: payload.source_diary_id,
    }
    // created_at/updated_at은 지정하지 않고 DB 기본값(now())을 그대로 사용한다

    const { data, error: e } = await supabase.from(TABLE).insert(insertPayload).select().single()
    if (e) throw e

    if (date === toDateKey(selectedDate)) {
      setMemos((prev) => [...prev, data])
      loadPhotosForRows([data])
      loadFilesForRows([data])
    }
    const weekStartKey = weekDays[0] ? toDateKey(weekDays[0]) : ''
    const weekEndKey = weekDays[6] ? toDateKey(weekDays[6]) : ''
    if (date >= weekStartKey && date <= weekEndKey) {
      setWeekMemos((prev) => sortDiaryRows([...prev, data]))
    }
    if (date >= monthStartKey && date <= monthEndKey) {
      setMonthMemos((prev) => sortDiaryRows([...prev, data]))
    }
    setNotedDateKeys((prev) => {
      const next = { ...prev }
      if (!next[date]) next[date] = []
      next[date] = [...next[date], { writer, sticker: null }]
      return next
    })
    setUpcomingRefreshKey((key) => key + 1)
    setTimelineReloadKey((key) => key + 1)
    return data
  }, [selectedDate, weekDays, monthStartKey, monthEndKey, sortDiaryRows, loadPhotosForRows, loadFilesForRows])

  // 고객 타임라인 모달에서 메모를 수정할 때 — 날짜가 바뀔 수 있으므로 오늘 목록/도트도 재동기화
  const handleTimelineUpdateMemo = useCallback(async (id, patch) => {
    await handleUpdateContent(id, patch.content, { date: patch.date })
    loadMemosForSelected()
    loadMonthDots()
  }, [handleUpdateContent, loadMemosForSelected, loadMonthDots])

  /* ===== 달력 네비게이션 ===== */
  function handlePrevMonth() {
    const d = new Date(viewYear, viewMonth - 1, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }
  function handleNextMonth() {
    const d = new Date(viewYear, viewMonth + 1, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }
  function handleJumpToday() {
    if (composerDirty) {
      const shouldReturn = window.confirm('작성 중인 메모가 있습니다. 저장하지 않고 오늘 목록으로 돌아갈까요?')
      if (!shouldReturn) return
    }
    const t = new Date()
    setViewYear(t.getFullYear())
    setViewMonth(t.getMonth())
    setSelectedDate(t)
    setSearchQuery('')
    setMainView('today')
    setHighlightMemoId(null)
    setComposerDirty(false)
    setDiaryListResetToken((token) => token + 1)
    setTimeout(() => {
      document.querySelector('.wd-diary')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }
  function handleSelectDate(d) {
    setSearchQuery('')
    setSelectedDate(d)
    if (d.getMonth() !== viewMonth || d.getFullYear() !== viewYear) {
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }

  function handleSelectMonthDate(d) {
    if (d.getMonth() !== viewMonth || d.getFullYear() !== viewYear) {
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }

  function openDateInToday(d, memoId = null) {
    handleSelectDate(d)
    setMainView('today')
    setHighlightMemoId(memoId)
    if (memoId) setTimeout(() => setHighlightMemoId(null), 3000)
    setTimeout(() => document.querySelector('.wd-diary')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  function moveWeek(offset) {
    if (offset === 0) {
      setWeekAnchor(new Date())
      return
    }
    setWeekAnchor((current) => {
      const next = new Date(current)
      next.setDate(next.getDate() + offset * 7)
      return next
    })
  }

  /* ===== 연결 메모 패널 ===== */
  const LinkPanel = linkKeyFilter ? (
    <div className="wd-link-modal" role="dialog" aria-modal="true" aria-label="연결 메모 보기">
      <div className="wd-link-panel">
        <div className="wd-link-panel-header">
          <div>
            <div className="wd-link-panel-title">연결태그 메모: {linkKeyFilter}</div>
            <div className="wd-link-panel-sub">{linkMemos.length}건 · 날짜순</div>
          </div>
          <button
            type="button"
            className="wd-link-panel-close"
            onClick={() => { setLinkKeyFilter(null); setLinkMemos([]) }}
          >
            닫기
          </button>
        </div>
        <div className="wd-link-panel-body">
          {linkMemosLoading ? (
            <div className="wd-loading">불러오는 중...</div>
          ) : linkMemos.length === 0 ? (
            <div className="wd-empty">
              <div className="wd-empty-icon" aria-hidden="true">🔗</div>
              <div className="wd-empty-title">연결된 메모가 없습니다</div>
            </div>
          ) : (
            linkMemos.map((m) => (
              <div key={m.id} className="wd-link-memo-item">
                <div className="wd-link-memo-date">{m.date}</div>
                <div className="wd-link-memo-content">{m.content}</div>
                <DiaryPhotoStrip
                  photos={photoMap[m.id] || []}
                  onOpen={(photos, index) => setPhotoGallery({ photos, index })}
                />
                {m.sticker && (
                  <span
                    className="wd-sticker-badge"
                    style={{ background: (STICKER_META_REF[m.sticker] || {}).color || '#888', marginTop: 4 }}
                  >
                    {m.sticker}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className="wd-app">
      <header className="wd-header">
        <div className="wd-brand">
          <div className="wd-brand-mark">KT</div>
          <div>
            <div className="wd-brand-title">케이탑 업무일지</div>
            <div className="wd-brand-sub">Work Diary</div>
          </div>
        </div>
        <SearchBar value={searchQuery} onChange={setSearchQuery} loading={searchLoading} />
        <button
          type="button"
          className="wd-btn-workcenter"
          onClick={() => onOpenMemoBoard?.()}
        >
          🗒️ 메모보드
        </button>
        <button
          type="button"
          className="wd-btn-workcenter"
          onClick={() => onOpenStorageAdmin?.()}
        >
          💾 저장공간 관리
        </button>
        <a
          href="../property-main.html?office=ktop"
          target="_blank"
          rel="noopener noreferrer"
          className="wd-btn-workcenter"
        >
          🏢 케이탑 매물관리
        </a>
        <a
          href="https://calendar.google.com/calendar/r?authuser=ktop2027%40gmail.com"
          target="_blank"
          rel="noopener noreferrer"
          className="wd-btn-workcenter wd-btn-google-calendar"
        >
          케이탑 구글캘린더
        </a>
      <DiaryLogoutButton /></header>
      {!isSupabaseConfigured && (
        <div className="wd-notice">
          <span aria-hidden="true">!</span>
          <div>
            <strong>Supabase 연결 미설정.</strong> 프로젝트 루트에 <code>.env</code> 파일을 만들고
            <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>를 설정한 뒤
            개발 서버를 재시작해주세요. 그 전까지는 메모 저장/조회가 동작하지 않습니다.
          </div>
        </div>
      )}

      <div className="wd-toolbar">
        <div className="wd-view-tabs segmented-control" role="tablist" aria-label="업무일지 화면 전환">
          <button
            type="button"
            role="tab"
            aria-selected={mainView === 'today'}
            className={`wd-view-tab segment ${mainView === 'today' ? 'is-active' : ''}`}
            onClick={handleJumpToday}
          >
            오늘
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainView === 'week'}
            className={`wd-view-tab segment ${mainView === 'week' ? 'is-active' : ''}`}
            onClick={() => setMainView('week')}
          >
            주간
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainView === 'month'}
            className={`wd-view-tab segment ${mainView === 'month' ? 'is-active' : ''}`}
            onClick={() => setMainView('month')}
          >
            월간
          </button>
        </div>

        <div className="wd-filter-tabs">
          <div className="wd-filter-author-group segmented-control" role="tablist" aria-label="작성자 필터">
            <button
              type="button"
              className={`wd-filter-tab segment ${filterWriter === 'all' ? 'is-active' : ''}`}
              onClick={() => setFilterWriter('all')}
            >
              전체
            </button>
            <button
              type="button"
              className={`wd-filter-tab segment ${filterWriter === '케이탑' ? 'is-active' : ''}`}
              onClick={() => setFilterWriter('케이탑')}
            >
              케이탑
            </button>
          </div>

          <div className="wd-filter-diary-group segmented-control" aria-label="개인일지 바로가기">
            <button
              type="button"
              className="wd-btn-personal-diary segment"
              onClick={() => onOpenDiary?.('케이탑')}
            >
              📓 케이탑 개인일지
            </button>
          </div>
        </div>
      </div>

      {mainView === 'week' ? (
        <main className="wd-main wd-main--week">
          <WeeklyDiary
            days={weekDays}
            memos={searchMode ? searchResults : weekMemos}
            loading={searchMode ? searchLoading : weekLoading}
            filterWriter={filterWriter}
            photoMap={photoMap}
            fileMap={fileMap}
            pinnedDiaryIds={pinnedDiaryIds}
            onPrevWeek={() => moveWeek(-1)}
            onThisWeek={() => moveWeek(0)}
            onNextWeek={() => moveWeek(1)}
            onUpdateMemo={handleUpdateContent}
            onAddPhotos={handleAddPhotosToMemo}
            onAddFiles={handleAddFilesToMemo}
            onOpenAddMemoForMemo={handleOpenAddMemoForMemo}
          />
        </main>
      ) : mainView === 'month' ? (
        <main className="wd-main wd-main--month">
          <MonthlyDiary
            calendar={<Calendar variant="month" viewYear={viewYear} viewMonth={viewMonth} selectedDate={selectedDate} showSelected={false} notedDateKeys={notedDateKeys} filterWriter={filterWriter} onSelectDate={handleSelectMonthDate} onPrevMonth={handlePrevMonth} onNextMonth={handleNextMonth} onJumpToday={handleJumpToday} />}
            monthLabel={`${viewYear}년 ${viewMonth + 1}월`}
            memos={visibleMonthMemos}
            loading={searchMode ? searchLoading : monthLoading}
            photoMap={photoMap}
            fileMap={fileMap}
            onUpdateMemo={handleUpdateContent}
            onAddPhotos={handleAddPhotosToMemo}
            onAddFiles={handleAddFilesToMemo}
          />
        </main>
      ) : (
        <main className="wd-main">
        <div className="wd-left-col">
          <div className="wd-left-top">
            <Calendar
              viewYear={viewYear}
              viewMonth={viewMonth}
              selectedDate={selectedDate}
              notedDateKeys={notedDateKeys}
              filterWriter={filterWriter}
              onSelectDate={handleSelectDate}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onJumpToday={handleJumpToday}
            />
            <section className="wd-panel wd-date-card" aria-label="선택 날짜 요약">
              <div className="wd-date-weekday">{selectedWeekdayLabel}</div>
              <div className="wd-date-number">{selectedDayLabel}</div>
              <div className="wd-date-stats" aria-label={`${selectedMonthLabel} ${selectedDayLabel}일 메모 통계`}>
                <div className="wd-date-stat">
                  <span>메모</span>
                  <strong>{filteredMemos.length}</strong>
                </div>
                <div className="wd-date-stat wd-date-stat--contract">
                  <span>계약</span>
                  <strong>{selectedScheduleCounts.contract}</strong>
                </div>
                <div className="wd-date-stat wd-date-stat--balance">
                  <span>잔금</span>
                  <strong>{selectedScheduleCounts.balance}</strong>
                </div>
              </div>
            </section>
          </div>
          <SelectedScheduleMemos
            key={`${toDateKey(selectedDate)}-${filterWriter}`}
            selectedDate={selectedDate}
            notes={filteredDailyScheduleNotes}
            loading={scheduleLoading}
            saving={scheduleSaving}
            error={scheduleError}
            onCreate={handleCreateDailySchedule}
            onUpdate={handleUpdateDailySchedule}
            onDelete={handleDeleteDailySchedule}
            onOpenAll={handleOpenAllSchedules}
            defaultWriter={filterWriter !== 'all' ? filterWriter : '케이탑'}
          />
          <UpcomingSchedules
            filterWriter={filterWriter}
            refreshKey={upcomingRefreshKey}
            onNavigate={handleNavigate}
          />
        </div>

        <DiaryList
          onNewMemo={() => openDateInToday(selectedDate)}
          selectedDate={selectedDate}
          memos={filteredMemos}
          loading={searchMode ? searchLoading : loading}
          error={error}
          searchMode={searchMode}
          onCreate={async (content, writer, sticker, linkKey, photoFiles = [], name = '', phone = '', title = '', diaryFiles = [], customerId = null, scheduleDate = null, relationOpts = {}) => {
            const createdMemo = await handleCreate(content, writer, sticker, linkKey, name, phone, title, customerId, scheduleDate, relationOpts)
            if (!createdMemo) return
            if (photoFiles.length > 0) {
              try {
                await handleAddPhotosToMemo(createdMemo.id, photoFiles, writer)
              } catch (photoErr) {
                setError(`메모는 저장됐지만 사진 업로드에 실패했습니다: ${photoErr.message || photoErr}`)
              }
            }
            if (diaryFiles.length > 0) {
              try {
                await handleAddFilesToMemo(createdMemo.id, diaryFiles, writer)
              } catch (fileErr) {
                setError(`메모는 저장됐지만 파일 업로드에 실패했습니다: ${fileErr.message || fileErr}`)
              }
            }
          }}
          onAddPhotos={handleAddPhotosToMemo}
          onAddFiles={handleAddFilesToMemo}
          onDeleteAttachment={handleDeleteAttachment}
          onChangeStatus={handleChangeStatus}
          onDelete={handleDelete}
          onUpdateContent={handleUpdateContent}
          onUpdateLinkKey={handleUpdateLinkKey}
          onOpenAddMemoForMemo={handleOpenAddMemoForMemo}
          onOpenTimelineForMemo={handleOpenTimelineForMemo}
          onOpenTimelineForCustomer={(customerId) => setTimelineCustomerId(customerId)}
          composerDisabled={!isSupabaseConfigured}
          allLinkKeys={allLinkKeys}
          onLinkKeyClick={handleLinkKeyClick}
          onAddToBoard={handleAddToBoard}
          onNavigate={handleNavigate}
          highlightMemoId={highlightMemoId}
          searchQuery={searchQuery}
          photoMap={photoMap}
          fileMap={fileMap}
          resetToken={diaryListResetToken}
          onComposerDirtyChange={handleComposerDirtyChange}
        />
      </main>
      )}
      {LinkPanel}
      {allSchedulesOpen && (
        <AllSchedulesModal
          notes={allScheduleNotes}
          loading={allSchedulesLoading}
          saving={scheduleSaving}
          error={scheduleError}
          onUpdate={handleUpdateDailySchedule}
          onDelete={handleDeleteDailySchedule}
          onClose={() => setAllSchedulesOpen(false)}
        />
      )}
      {photoGallery && (
        <PhotoGalleryModal
          photos={photoGallery.photos}
          startIndex={photoGallery.index}
          onClose={() => setPhotoGallery(null)}
        />
      )}

      {timelineCustomerId && (
        <CustomerTimelineModal
          customerId={timelineCustomerId}
          reloadSignal={timelineReloadKey}
          onClose={() => setTimelineCustomerId(null)}
          onNavigate={(dateStr, memoId) => {
            setTimelineCustomerId(null)
            handleNavigate(dateStr, memoId)
          }}
          onAddMemoRequested={(customer) =>
            setAddMemoTarget({
              customerId: customer.id,
              sourceDiaryId: null,
              sourceTitle: '',
              sourceCustomerName: customer.name || '',
              sourcePhone: customer.phone || '',
              defaultDate: toDateKey(selectedDate),
            })
          }
          onUpdateMemo={handleTimelineUpdateMemo}
          onDeleteMemo={handleDelete}
        />
      )}

      {addMemoTarget && (
        <AddCustomerMemoModal
          customerId={addMemoTarget.customerId}
          sourceDiaryId={addMemoTarget.sourceDiaryId}
          sourceTitle={addMemoTarget.sourceTitle}
          sourceCustomerName={addMemoTarget.sourceCustomerName}
          sourcePhone={addMemoTarget.sourcePhone}
          defaultDate={addMemoTarget.defaultDate}
          defaultWriter={filterWriter !== 'all' ? filterWriter : '케이탑'}
          onClose={() => setAddMemoTarget(null)}
          onSave={handleCreateForCustomer}
        />
      )}
    </div>
  )
}
