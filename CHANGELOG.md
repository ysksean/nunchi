# Changelog

nunchi의 모든 주요 변경사항을 기록합니다. [SemVer](https://semver.org/lang/ko/)를 따릅니다.

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
