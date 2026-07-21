# nunchi 🐾

> a desktop pet that reads the room

Claude Code와 연동되는 데스크톱 펫 오버레이. **사용자의 말투를 눈치채고 표정이 바뀝니다.**

기존 Claude Code 펫들이 Claude의 작업 상태(도구 실행, 대기 등)에만 반응하는 것과 달리,
nunchi는 `UserPromptSubmit` 훅으로 받은 프롬프트의 어조를 분석해서 감정을 표현합니다.

- 화내면 😰 미안해하고, 칭찬하면 🎉 신나고, 지쳐 보이면 🥺 위로합니다
- Claude의 작업 상태(생각중 / 작업중 / 허락 대기 / 휴식)도 함께 표시
- 프롬프트 원문은 어디에도 저장하지 않습니다 — 메모리에서 분류 후 감정 결과만 기록

## 표정

| 트리거 | 표정 |
|--------|------|
| 짜증/화난 말투 (`왜 안 돼??`, `짜증나`) | 미안해하며 덜덜 떨기 |
| 칭찬/기쁨 (`완벽해 고마워!`, `ㅋㅋ 좋네`) | 폴짝폴짝 점프 |
| 지친 말투 (`하... 힘들다 ㅠㅠ`) | 같이 시무룩 + 눈물 |
| 급한 말투 (`빨리!`, `asap`) | 눈 커지고 허둥지둥 |
| Claude가 도구 실행 중 | 집중해서 열일 |
| 권한 확인 대기 | 방방 뛰며 알림 |
| 세션 종료 | Zzz |

## 아키텍처

```
Claude Code hooks ─→ bin/hook.js ─→ ~/.nunchi/state.json ─→ Electron 오버레이
   (UserPromptSubmit,   (말투 분류,      (감정 + 작업 상태만,      (투명·항상 위,
    PreToolUse, Stop…)    상태 기록)       프롬프트 원문 없음)       SVG 표정 렌더)
```

Claude Code CLI와 데스크톱 앱은 `~/.claude/settings.json`의 hooks를 공유하므로 둘 다 동작합니다.

## 설치

```bash
git clone https://github.com/ysksean/nunchi.git
cd nunchi
pnpm install
pnpm hooks:install   # ~/.claude/settings.json에 훅 등록 (백업 자동 생성)
pnpm start           # 펫 실행
```

제거:

```bash
pnpm hooks:uninstall
```

## 사용법

- 펫을 드래그해서 원하는 위치로 이동
- 펫에 마우스를 올리면 나타나는 `×` 버튼으로 종료
- 창이 포커스된 상태에서 숫자키 1~9로 표정 미리보기 (개발용)

## 개발

```bash
pnpm test    # 말투 분류기 테스트
pnpm start   # 로컬 실행
```

말투 분류는 [src/mood.js](src/mood.js)의 키워드 휴리스틱입니다. 네트워크 호출 없이 즉시 동작하며,
패턴을 추가하려면 `PATTERNS`에 정규식을 넣으면 됩니다.

## 로드맵

- [ ] Haiku 기반 감정 분류 옵션 (휴리스틱보다 정확, opt-in)
- [ ] 멀티 세션 표시
- [ ] Tauri 포팅 (바이너리 경량화)
- [ ] 커스텀 펫 스킨

## Credits

"Claude Code hooks → 데스크톱 펫" 컨셉은 [IMMINJU/claude-pet](https://github.com/IMMINJU/claude-pet)이 먼저 선보였습니다.
nunchi는 여기서 영감을 받았으며, **Claude의 작업 상태가 아닌 사용자의 말투에 반응**한다는 점이 다릅니다.
도구별 상태 표시·테마·다국어가 필요하다면 원조 프로젝트를 추천합니다.

## License

MIT
