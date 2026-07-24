# nunchi 스킨 만들기

nunchi 스킨은 **몸통 SVG 하나**입니다. 표정 10종, 볼따구 물리, 크기 조절, 애니메이션은
nunchi 코어가 알아서 얹어주므로 제작자는 캐릭터의 몸만 그리면 됩니다.

## 파일 형식

`~/.nunchi/skins/<이름>.json`:

```json
{
  "name": "tofu",
  "author": "your-handle",
  "bodySvg": "<rect x=\"18\" y=\"30\" width=\"104\" height=\"100\" rx=\"16\" fill=\"#FFF8E7\"/>",
  "palette": { "cheek": "#FFC9C9", "faceInk": "#3A3226" }
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `name` | ✅ | 영문/숫자/하이픈 1~31자. 파일명과 메뉴에 쓰입니다 |
| `bodySvg` | ✅ | 몸통 도형. 아래 좌표계와 화이트리스트를 따릅니다 |
| `author` | | 표시용 제작자 이름 (최대 60자) |
| `palette.cheek` | | 볼터치 색 (기본 `#F6C2BC`) |
| `palette.faceInk` | | 눈·입 선 색 (기본 `#2d2418`) |

## 좌표계

viewBox는 `0 0 140 150`입니다. 얼굴 레이어가 아래 위치를 차지하니 **비워두세요**:

```
     ┌─────────────────┐  0
     │                 │
     │   ●        ●    │  눈    y≈64~72,  x≈48 / 92
     │ (볼)      (볼)  │  볼    y≈82,     x≈34 / 106
     │      ‿          │  입    y≈84~95,  x≈56~84
     │                 │
     └─────────────────┘  150
       x=0           140
```

몸통은 보통 `x 12~128`, `y 24~140` 안에 그립니다. 그 바깥(`y < 24`)은 귀·안테나·머리 장식용으로 자유롭게 쓰세요.

## 허용되는 SVG

스킨은 신뢰할 수 없는 입력이므로, nunchi는 화이트리스트에 있는 것만 통과시키고 나머지는 **조용히 버립니다**.

**허용 요소**: `g` `path` `circle` `ellipse` `rect` `line` `polygon` `polyline`
(전체 `<svg>` 파일을 붙여넣어도 됩니다 — 껍데기는 자동으로 벗겨집니다)

**허용 속성**: `d` `cx` `cy` `r` `rx` `ry` `x` `y` `x1` `y1` `x2` `y2` `width` `height` `points`
`transform` `fill` `stroke` `stroke-width` `stroke-linecap` `stroke-linejoin` `stroke-dasharray`
`opacity` `fill-opacity` `stroke-opacity` `fill-rule`

**제거되는 것**: `<script>` `<style>` `<foreignObject>` `<image>` `<use>` `<text>`, 모든 `on*` 이벤트 속성,
`style` 속성, `url(...)` · `javascript:` · `data:` 값, 그 외 모르는 요소는 하위 내용까지 통째로 삭제됩니다.

> 애니메이션은 넣지 마세요. 숨쉬기·점프·떨림은 코어가 CSS로 처리하며, 스킨은 정적인 도형이면 충분합니다.

크기 제한: 64KB, 노드 500개.

## 설치와 확인

```bash
# 직접 만든 파일
cp my-skin.json ~/.nunchi/skins/

# 레지스트리에서
pnpm skin add <이름>

# 목록 확인 / 삭제
pnpm skin list
pnpm skin remove <이름>
```

펫을 **우클릭**하면 스킨 목록이 뜹니다. 실행 중에 파일을 고쳤다면 우클릭 → **스킨 새로고침**.

## 공유하기

[nunchi-skins](https://github.com/ysksean/nunchi-skins) 저장소에 `skins/<이름>.json`으로 PR을 보내면
`pnpm skin add <이름>` 한 줄로 누구나 설치할 수 있습니다.

예제는 [examples/skins](../examples/skins)를 참고하세요.
