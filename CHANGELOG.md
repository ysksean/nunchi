# Changelog

nunchi의 모든 주요 변경사항을 기록합니다. [SemVer](https://semver.org/lang/ko/)를 따릅니다.

## [0.4.1] - 2026-07-25

### Fixed
- idle CPU/GPU 폭식 수정: 무한 CSS 애니메이션이 투명·항상-위 창을 프레임마다 리페인트시켜
  가만히 있어도 렌더러 ~12% + GPU ~8% CPU를 상시 사용하던 문제. 6초간 활동이 없으면
  애니메이션을 완전히 멈춰(펫이 '쉼') idle 사용량을 ~0%로 낮추고, 상태 변화·마우스 접근 시
  다시 깨어남. `prefers-reduced-motion`도 존중

## [0.4.0] - 2026-07-25

### Added
- 에러 당황 표정: 도구 실행이 실패하면 😨 "앗, 뭔가 잘못됐어요" (PostToolUse 응답의 실패 감지)
- 장시간 작업 반응: 도구 작업이 3분을 넘기면 땀 흘리며 "아직 하는 중이에요..."
- 쓰다듬기: 펫 위에서 커서를 좌우로 문지르면 하트가 뿅뿅 + 흐뭇한 표정 (드래그·찌르기와 구분)

### Changed
- 훅 이벤트→상태 로직을 순수 함수 `nextState`로 분리해 단위 테스트 추가

## [0.3.1] - 2026-07-24

### Changed
- cat · slime · hamster 스킨 전면 재디자인. 둥근 실루엣, 두툼한 귀, 작은 발 등
  귀여움 요소를 살리고 각 캐릭터의 개성을 분리 (고양이 = 말린 꼬리, 햄스터 = 볼주머니,
  슬라임 = 납작한 물방울 + 하이라이트·기포)

## [0.3.0] - 2026-07-24

### Added
- 스킨 시스템: 캐릭터를 JSON 한 파일로 교체. 빌트인 4종 (ghost / cat / slime / hamster)
- 펫 우클릭 → 스킨 선택, 스킨 폴더 열기, 새로고침 메뉴
- 스킨 CLI: `pnpm skin list` / `add <이름·https URL>` / `remove <이름>`
- 커뮤니티 레지스트리 연동 (`pnpm skin add <이름>` → nunchi-skins 저장소)
- 제작 가이드 [docs/SKINS.md](docs/SKINS.md) + 예제 [examples/skins](examples/skins)

### Security
- 엄격한 SVG 새니타이저: 화이트리스트 요소·속성만 통과시키고 나머지는 재직렬화 과정에서 삭제.
  `<script>`, `on*` 핸들러, `<foreignObject>`, 외부 참조(`url()`·`image`·`use`), `javascript:`/`data:` 값 차단.
  스킨 설치 시 제거된 항목을 사용자에게 경고로 표시

## [0.2.0] - 2026-07-23

### Added
- 펫 크기 조절: 펫 위에서 마우스 휠 스크롤로 60%~200% 확대/축소, 조절 중 퍼센트 말풍선 표시, 재시작 후에도 유지
- 데모 GIF + 재현 가능한 녹화 스크립트 (`pnpm demo:record`)

## [0.1.0] - 2026-07-22

첫 공개 릴리스. 🐾

### Added
- 말투 반응 데스크톱 펫: `UserPromptSubmit` 훅으로 사용자 어조 분석 (angry/urgent/sad/happy)
- 모찌 유령 캐릭터 — 크림색 물결 치맛자락, 둥실둥실 부유 idle
- 터치 인터랙션: 콕 찌르면 찌부 → 젤리 반동 + 볼따구 출렁, 드래그로 창 이동
- 작업 완료 알림: 도구 작업 턴이 끝나면 ✨만세 + "다 됐어요!" 12초
- Claude 작업 상태 표정: 생각중 / 열일중 / 권한 대기 / 휴식
- 훅 설치·제거 스크립트 (`pnpm hooks:install` / `hooks:uninstall`), settings.json 자동 백업
- 프라이버시: 프롬프트 원문은 저장하지 않고 메모리에서 분류 후 감정 결과만 기록

### Fixed
- SVG `className` 대입이 무시되어 상태 애니메이션이 전혀 재생되지 않던 문제
- 일반 브라우저에서 `<svg id="pet">`이 `window.pet`을 가려 스크립트가 죽던 문제
