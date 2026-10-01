# LH 운정3 단독택지 확인본

확인일: 2026-10-01. 공고일: 2026-08-26.

- 주거전용: BN-0007859, 325필지.
- 점포겸용: BN-0007860 중 사업지구 100825(파주운정3), 264필지. 같은 공고의 운정 C20 5필지는 제외.
- 합계 589필지. 공식 블럭번호, 소블럭번호, 필지번호, 지번 및 면적을 공고 첨부 공급목록과 대조.

원문:
- https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?mi=1062&panId=BN-0007859&ccrCnntSysDsCd=01&uppAisTpCd=01
- https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?mi=1062&panId=BN-0007860&ccrCnntSysDsCd=01&uppAisTpCd=01
- https://apply.lh.or.kr/lhapply/land/main.do?mi=1040

`list`는 공고 페이지의 필지 목록, `detail`은 LH 지도에서 조회하는 상세정보 응답 전체를 보관한다. `regulations`는 공고 엑셀의 건폐율·용적률·층수·가구수·토지사용가능시기다. 지도 상세의 0% 표시값을 엑셀 건축조건으로 덮어쓰지 않는다.

`geometry`는 LH 지도 WFS의 EPSG:4326 MultiPolygon이며 상세정보 `featureId`로 연결한 뒤 지번을 다시 검증했다. UI 지도는 경계와 상대 위치를 표시하며 측량용 도면은 아니다. 전체 획지분할도는 공고 첨부 fileid=68242858의 PDF 원본을 `assets/documents/lh-unjeong3-parcel-plan-20260805.pdf`로 보관한다.

이번 확인본은 공고중인 단독택지에 한정한다. 목록에 없는 필지를 계약완료 또는 선착순으로 추정하지 않는다. 실시간 자동 갱신 기능은 없으며 확인일과 원문 링크를 표시한다.

공개 LH 정보만 포함한다. 사무실의 소유주·연락처·건물·메모는 기존 비공개 저장소에 유지하고 이 JSON에 포함하지 않는다. LH 필지와 기존 자료는 `blockId + subblock + parcel`로 연결하며 예전 지번으로 연결하지 않는다. 기존 도면의 위치가 없는 새 등록은 `data.mapPositionUnavailable=true`로 보관해 기존 도면 원점에 잘못 표시되는 것을 막는다.
