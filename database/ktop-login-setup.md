# 케이탑 매물관리 로그인

로그인 페이지에서 부동산을 선택합니다. 케이탑은 enefadyhmhfphtochlku 프로젝트를 사용하며 하이탑 프로젝트로 저장 요청을 보내지 않습니다.

## 첫 계정

1. 케이탑 Supabase 프로젝트의 Authentication → Users → Add user → Create new user를 엽니다.
2. ktop2027@gmail.com과 직접 정한 비밀번호를 입력하고 Auto Confirm User를 선택합니다.
3. 매물관리 login.html?office=ktop에서 위 이메일과 비밀번호로 로그인합니다.

프로젝트 대시보드에 로그인하는 Google 계정은 매물관리 Auth 계정과 별개입니다. 허용 이메일은 public.office_members에 보관하며 브라우저에서는 수정할 수 없습니다. 추가 직원 계정은 관리자가 Auth 계정 생성 후 office_members에 등록해야 합니다.

## 비밀번호 재설정

Authentication → URL Configuration에서 Site URL을 https://hitoputube-creator.github.io/haitop-realty-system/login.html?office=ktop 으로 설정하고 Redirect URLs에 https://hitoputube-creator.github.io/haitop-realty-system/reset-password.html?office=ktop 을 등록합니다.

## 현재 범위

케이탑에 비어 있는 매물관리 테이블을 만들고 케이탑 회원 전용 RLS를 적용했습니다. 하이탑의 소유주·연락처·고객·일지 데이터는 복사하지 않았습니다. 평면도·기본자료의 프로젝트 간 공유, 케이탑 별도 업무센터/일지 앱, 매물 첨부파일 업로드는 아직 연결하지 않았습니다.

브라우저 입력 임시저장과 검색 조건은 부동산별로 나눕니다. 외부 하이탑 업무앱 링크는 케이탑 화면에서 차단됩니다.

검증: node scripts/test-office-login.cjs, 변경 스크립트 문법 검사, 실제 DB에서 권한 없는 사용자 쓰기 거부 및 허용 회원 CRUD(롤백), Supabase security advisors.
