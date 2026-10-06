import { useMemo } from 'react'
import { toDateKey } from '../lib/dateKeys'
import { getActualScheduleTypeFlags } from '../lib/scheduleTypes'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function Calendar({
  viewYear,
  viewMonth, // 0~11
  selectedDate, // Date
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onJumpToday,
  notedDateKeys = {},
  filterWriter = 'all',
  variant = 'large',
  showSelected = true,
}) {
  const todayKey = toDateKey(new Date())
  const selectedKey = showSelected && selectedDate ? toDateKey(selectedDate) : null

  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    const startWeekday = firstOfMonth.getDay() // 0 = Sunday
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    const result = []

    // 이전 달 끝부분
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, daysInPrevMonth - i)
      result.push({ date: d, otherMonth: true })
    }

    // 이번 달
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ date: new Date(viewYear, viewMonth, d), otherMonth: false })
    }

    // 다음 달 시작 부분 (6주 = 42칸 채우기)
    const remaining = 42 - result.length
    for (let d = 1; d <= remaining; d++) {
      result.push({
        date: new Date(viewYear, viewMonth + 1, d),
        otherMonth: true,
      })
    }

    return result
  }, [viewYear, viewMonth])

  return (
    <section className={`wd-panel wd-calendar wd-calendar--${variant}`} aria-label="달력">
      <header className="wd-cal-nav">
        <div>
          <span className="wd-cal-month">{viewMonth + 1}월</span>
          <span className="wd-cal-month-year">{viewYear}</span>
          <button
            type="button"
            className="wd-cal-today-btn"
            onClick={onJumpToday}
            aria-label="오늘로 이동"
          >
            오늘
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            className="wd-cal-nav-btn"
            onClick={onPrevMonth}
            aria-label="이전 달"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            className="wd-cal-nav-btn"
            onClick={onNextMonth}
            aria-label="다음 달"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </header>

      <div className="wd-cal-grid">
        <div className="wd-cal-weekdays">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`wd-cal-weekday ${i === 0 ? 'sun' : ''} ${i === 6 ? 'sat' : ''}`}
            >
              {w}
            </div>
          ))}
        </div>

        <div className="wd-cal-days" role="grid">
          {cells.map(({ date, otherMonth }, idx) => {
            const key = toDateKey(date)
            const isToday = key === todayKey
            const isSelected = showSelected && key === selectedKey
            const entries = notedDateKeys[key] || []

            // 작성자 필터 적용
            const filtered = filterWriter === 'all'
              ? entries
              : entries.filter((e) => e.writer === filterWriter)
            const hasNote = filtered.length > 0
            const hasContractSchedule = filtered.some((entry) => getActualScheduleTypeFlags(entry).contract)
            const hasBalanceSchedule = filtered.some((entry) => getActualScheduleTypeFlags(entry).balance)
            const weekday = date.getDay()

            const cls = [
              'wd-cal-day',
              hasContractSchedule && 'has-contract-schedule',
              hasBalanceSchedule && 'has-balance-schedule',
              otherMonth && 'other-month',
              isToday && 'today',
              isSelected && 'selected',
              weekday === 0 && 'sun',
              weekday === 6 && 'sat',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <button
                type="button"
                key={`${key}-${idx}`}
                className={cls}
                onClick={() => onSelectDate(date)}
                aria-label={`${date.getMonth() + 1}\uC6D4 ${date.getDate()}\uC77C`}
                aria-pressed={Boolean(isSelected)}
              >
                <span className="wd-cal-day-num-wrap">
                  <span className="wd-cal-day-num">{date.getDate()}</span>
                </span>

                {hasNote && (
                  <div className="wd-cal-month-info" aria-hidden="true">
                    <span className="wd-cal-month-count">메{filtered.length}</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="wd-cal-legend" aria-label="달력 표시 범례">
        <span className="wd-cal-legend-item">
          <span className="wd-cal-legend-box contract" aria-hidden="true" />
          금색 테두리: 계약
        </span>
        <span className="wd-cal-legend-item">
          <span className="wd-cal-legend-box balance" aria-hidden="true" />
          빨간 테두리: 잔금
        </span>
      </div>
    </section>
  )
}
