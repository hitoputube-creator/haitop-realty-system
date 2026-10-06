import { useMemo, useState } from 'react'
import { WeeklyMemoDetail } from './WeeklyDiary'
import { PhotoGalleryModal } from './DiaryPhotos'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function formatMemoDate(dateKey) {
  if (!dateKey) return ''
  const date = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateKey
  return `${date.getMonth() + 1}.${date.getDate()}(${WEEKDAY_LABELS[date.getDay()]})`
}

export default function MonthlyDiary({
  calendar,
  monthLabel,
  memos,
  loading,
  photoMap,
  fileMap,
  onUpdateMemo,
  onAddPhotos,
  onAddFiles,
}) {
  const [selectedMemoId, setSelectedMemoId] = useState(null)
  const [gallery, setGallery] = useState(null)
  const selectedMemo = useMemo(
    () => (selectedMemoId ? memos.find((memo) => memo.id === selectedMemoId) : null),
    [memos, selectedMemoId]
  )

  return (
    <section className="wd-month-layout" aria-label="Monthly diary overview">
      <div className="wd-month-calendar">{calendar}</div>
      <div className="wd-panel wd-month-memos">
        <header className="wd-month-memos-header">
          <div>
            <div className="wd-panel-title">월간 전체 메모</div>
            <div className="wd-panel-sub">{monthLabel} &middot; 전체 {memos.length}건</div>
          </div>
        </header>
        {loading ? (
          <div className="wd-loading">불러오는 중...</div>
        ) : memos.length === 0 ? (
          <div className="wd-week-empty">이번 달 메모가 없습니다.</div>
        ) : (
          <div className="wd-month-memo-list">
            {memos.map((memo) => (
              <button
                key={memo.id}
                type="button"
                className="wd-month-memo-card"
                onClick={() => setSelectedMemoId(memo.id)}
              >
                {memo.status === 'important' && <span className="wd-card-important-badge">★ 중요</span>}
                <span className="wd-month-memo-date">{formatMemoDate(memo.date)}</span>
                <span className="wd-month-memo-title">{memo.title || memo.customer_name || '업무 메모'}</span>
                <span className="wd-month-memo-name">{memo.customer_name || '이름 미입력'}</span>
                {memo.customer_phone && <span className="wd-month-memo-phone">{memo.customer_phone}</span>}
                <span className="wd-month-memo-content">{memo.content || '내용 없음'}</span>
                <span className="wd-month-memo-meta">
                  {memo.writer || ''}
                  {memo.sticker ? ` · ${memo.sticker}` : ''}
                  {memo.link_key ? ` · ${memo.link_key}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {selectedMemo && (
        <WeeklyMemoDetail
          memo={selectedMemo}
          photos={photoMap?.[selectedMemo.id] || []}
          files={fileMap?.[selectedMemo.id] || []}
          onOpenPhotos={(photos, index) => setGallery({ photos, index })}
          onClose={() => setSelectedMemoId(null)}
          onSave={onUpdateMemo}
          onAddPhotos={onAddPhotos}
          onAddFiles={onAddFiles}
        />
      )}
      {gallery && (
        <PhotoGalleryModal
          photos={gallery.photos}
          startIndex={gallery.index}
          onClose={() => setGallery(null)}
        />
      )}
    </section>
  )
}
