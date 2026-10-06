# 케이탑 업무일지

접속: `https://hitoputube-creator.github.io/haitop-realty-system/ktop-diary/`

매물관리 메인의 `케이탑 업무일지`, 공통 메뉴의 `업무일지`, 고객별 `일지` 버튼에서 접근합니다. 기존 케이탑 매물관리 로그인 세션을 같은 프로젝트의 SDK에서 확인하며 활성 `office_members` 회원만 화면을 표시합니다. 로그아웃 또는 비회원은 로그인 안내만 표시합니다.

하이탑 원본 업무일지 소스를 별도 복제하여 오늘/주간/월간 보기, 상담 및 일반 메모, 고객·매물·기타 연락처 연결, 계약·잔금·약속·일정, 검색/태그/상태/작성자 필터, 메모보드, 개인일지, 사진/파일 첨부·다운로드·묶음 내려받기 기능을 유지합니다. 작성자 기본 표기는 케이탑입니다. 하이탑 직원명과 하이탑 저장공간·업무센터 링크는 케이탑 화면으로 대체했습니다.

데이터는 케이탑 프로젝트 `enefadyhmhfphtochlku`의 `work_diary`, `customers`, `listings`, `other_contacts`, `private_notes`, `work_board_notes`, `crm_attachments`만 사용합니다. 하이탑 일지/고객 데이터는 복제하지 않습니다. 화면 상태와 임시저장도 `ktop-diary:` 접두사로 분리합니다.

첨부파일은 케이탑 `crm-attachments` 비공개 버킷에 보관하며 로그인 회원에게만 업로드/조회/수정/삭제 권한을 부여합니다. 파일 다운로드는 인증 또는 짧은 만료시간의 서명 URL을 사용합니다. 저장공간 버튼은 케이탑 파일/일지/고객/개인일지/메모보드 저장현황을 표시합니다.

구글캘린더는 하이탑의 기존 방식과 동일한 캘린더 열기 기능입니다. 계정 선택을 `ktop2027@gmail.com`으로 지정합니다. 해당 구글 계정에 로그인해야 하며, Google Calendar API 자동 동기화/OAuth 연결은 포함하지 않습니다. Supabase에 저장한 일정은 업무일지 달력에서 관리합니다.

빌드: `cd ktop-diary-source && npm ci && npm run build`. 결과는 `ktop-diary/`에 생성되며 GitHub Pages에서 서비스합니다. 기존 하이탑 Vercel 업무일지는 변경하지 않았습니다.

검증: `node scripts/test-ktop-diary.cjs`, 기존 사무소 로그인/공유자료 테스트, 업무일지 필드/일정/MIME 검증 스크립트, 실제 DB에서 회원 CRUD 및 비회원 차단 검증(트랜잭션 롤백).
