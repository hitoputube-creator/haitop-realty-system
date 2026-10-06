import { useEffect, useRef, useState } from 'react'
import {
  FILE_ACCEPT,
  MAX_DIARY_FILES,
  formatPhotoSize,
  validateDiaryFiles,
  downloadAttachment,
  getAttachmentViewUrl,
} from '../lib/attachments'

function getExtension(name = '') {
  const parts = String(name).split('.')
  if (parts.length < 2) return 'FILE'
  return parts.pop().toUpperCase().slice(0, 5)
}

export function DiaryFileUploader({ files, onChange, disabled, busy, compact = false }) {
  const inputRef = useRef(null)
  const [errors, setErrors] = useState([])

  function addFiles(fileList) {
    const next = [...files, ...Array.from(fileList || [])]
    const { validFiles, errors: validationErrors } = validateDiaryFiles(next)
    setErrors(validationErrors)
    onChange(validFiles)
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeFile(index) {
    setErrors([])
    onChange(files.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <div className={`wd-file-uploader${compact ? ' wd-file-uploader--compact' : ''}`}>
      <div className="wd-file-uploader-row">
        <label className="wd-file-add-btn">
          <span aria-hidden="true">파일</span>
          <span>파일 추가</span>
          <input
            ref={inputRef}
            type="file"
            accept={FILE_ACCEPT}
            multiple
            disabled={disabled || busy}
            onChange={(event) => addFiles(event.target.files)}
          />
        </label>
        <span className="wd-file-help">
          PDF·한글·워드·엑셀·PPT·텍스트·압축파일, 최대 {MAX_DIARY_FILES}개
        </span>
      </div>

      {errors.length > 0 && (
        <div className="wd-photo-error" role="alert">
          {errors.map((error) => <div key={error}>{error}</div>)}
        </div>
      )}

      {files.length > 0 && (
        <div className="wd-file-preview-list">
          {files.map((file, index) => (
            <div className="wd-file-preview" key={`${file.name}-${file.lastModified}-${index}`}>
              <span className="wd-file-icon" aria-hidden="true">{getExtension(file.name)}</span>
              <div className="wd-file-meta">
                <strong title={file.name}>{file.name}</strong>
                <span>{formatPhotoSize(file.size)}</span>
              </div>
              <button type="button" onClick={() => removeFile(index)} disabled={disabled || busy}>
                제거
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 첨부파일 1개 — 비공개 버킷이므로 클릭할 때마다 새 signed URL을 받아 fetch+blob으로 저장한다.
// cross-origin <a download>는 브라우저가 무시할 수 있어 쓰지 않는다.
function FileDownloadItem({ file, onDelete }) {
  const [viewUrl, setViewUrl] = useState('')
  const [viewLoading, setViewLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const fileKey = file?.id || file?.storage_path || file?.original_name || ''
  const isAudio = String(file?.mime_type || '').startsWith('audio/') ||
    /\.(m4a|mp3|wav|amr|3gp|aac|ogg)$/i.test(file?.original_name || '')

  useEffect(() => {
    let alive = true

    async function prepareViewUrl() {
      setViewLoading(true)
      setViewUrl('')
      setError('')
      try {
        const url = await getAttachmentViewUrl(file, { expiresIn: 600, forceRefresh: true })
        if (alive) setViewUrl(url)
      } catch (err) {
        if (alive) setError(err.message || String(err))
      } finally {
        if (alive) setViewLoading(false)
      }
    }

    prepareViewUrl()
    return () => {
      alive = false
    }
  }, [fileKey, file])

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    setError('')
    try {
      await downloadAttachment(file)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setDownloading(false)
    }
  }

  async function handleDelete() {
    if (!onDelete || deleting) return
    setDeleting(true)
    setError('')
    try {
      await onDelete(file)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="wd-file-item-wrap">
      <div className="wd-file-item" title={file.original_name || '첨부 파일'}>
        <span className="wd-file-icon" aria-hidden="true">{getExtension(file.original_name)}</span>
        <span className="wd-file-meta">
          <strong>{file.original_name || '첨부 파일'}</strong>
          <span>{formatPhotoSize(file.file_size)}</span>
        </span>
        <span className="wd-file-actions">
          <a
            className="wd-file-action-btn"
            href={viewUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={viewLoading || !viewUrl}
            onClick={(event) => {
              if (viewLoading || !viewUrl) event.preventDefault()
            }}
          >
            {viewLoading ? '준비 중...' : '보기'}
          </a>
          <button
            type="button"
            className="wd-file-action-btn"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? '다운로드 중...' : '다운로드'}
          </button>
          {onDelete && (
            <button
              type="button"
              className="wd-file-action-btn wd-file-action-btn--danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '삭제 중...' : '삭제'}
            </button>
          )}
        </span>
      </div>
      {isAudio && viewUrl && (
        <audio
          className="wd-call-audio-player"
          controls
          preload="metadata"
          src={viewUrl}
          aria-label={`${file.original_name || '통화 녹음'} 재생`}
        >
          브라우저가 오디오 재생을 지원하지 않습니다.
        </audio>
      )}
      {error && <div className="wd-file-item-error" role="alert">{error}</div>}
    </div>
  )
}

export function DiaryFileList({ files, onDelete }) {
  if (!files?.length) return null

  return (
    <div className="wd-file-list" aria-label="첨부 파일">
      {files.map((file) => (
        <FileDownloadItem key={file.id || file.storage_path} file={file} onDelete={onDelete} />
      ))}
    </div>
  )
}
