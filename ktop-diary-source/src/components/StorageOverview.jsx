import DiaryLogoutButton from './DiaryLogoutButton'
import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import './WorkDiary.css'
export default function StorageOverview({onBack}) {
 const [data,setData]=useState(null),[error,setError]=useState('')
 useEffect(()=>{let active=true;supabase.rpc('ktop_diary_storage_usage').then(({data,error})=>{if(!active)return;if(error)setError('저장현황을 불러오지 못했습니다.');else setData(data)});return()=>{active=false}},[])
 return <div className="wd-app"><header className="wd-header"><div className="wd-brand"><div className="wd-brand-mark">KT</div><h1>케이탑 저장공간</h1></div><button className="wd-btn-workcenter" onClick={onBack}>업무일지로</button><DiaryLogoutButton /></header><main style={{padding:24}}>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p>불러오는 중…</p>}{data&&<><p>첨부파일 {data.attachments}개 · {(data.bytes/1024/1024).toFixed(2)} MB</p><p>업무일지 {data.diaries}건 · 고객 {data.customers}명 · 개인일지 {data.private_notes}건 · 메모보드 {data.board_notes}개</p></>}</main></div>
}
