# 가야면 실시간 퀴즈

가야면 1차 주민워크숍용 실시간 진행형 퀴즈. 진행자가 무대에서 문제를 띄우면 각 테이블이 휴대폰으로 답하고, 정답을 공개하면 팀별 O/X와 누적 순위가 나옵니다.

- 진행자 화면(빔프로젝터): `/host/?k=gaya2026`
- 팀 화면(QR 접속): `/play/?k=gaya2026`
- 문항별 정답률(진행자 참고용): `/results/?k=gaya2026`

빌드 과정이 없는 순수 HTML/CSS/JS입니다. 실시간 동기화는 Firebase Realtime Database가 담당합니다.

## 진행 방법

**큰 버튼 하나(또는 `Space` 키)만 누르면 처음부터 끝까지 갑니다.**

```
대기화면  →  문제 시작  →  정답 공개  →  다음 문제  →  …  →  최종 순위  →  마무리  →  대기화면
```

- **문항을 고르는 순간 곧바로 출제됩니다.** 별도의 출제 버튼도 타이머도 없습니다.
- 팀은 **마감 전까지 답을 몇 번이든 바꿀 수 있습니다.**
- **"정답 공개"를 누르는 그 순간이 마감입니다.** 이후 답변 시도는 거부됩니다.
- 참여한 팀이 전원 답하면 진행 버튼이 깜빡입니다. 다만 **아무도 답하지 않아도 그냥 넘어갈 수 있습니다.**

### 분모는 항상 "실제로 들어온 팀"

4팀 중 2팀만 접속했으면 "제출 1 / 2팀"으로 표시하고 나머지는 기다리지 않습니다. 순위도 접속한 팀만 집계합니다. 접속 판정은 실시간 연결이 아니라 **한 번이라도 들어온 적 있음** 기준이라, 휴대폰 화면이 꺼져도 팀 표시가 다시 어두워지지 않습니다.

### 순위

- 문항당 100점, 10문항 총 1,000점
- 동점이면 **정답을 더 빨리 누른 팀이 앞섭니다**
- **공동 순위 없이 1위부터 끝까지 가릅니다**

## 화면 조작

| 조작 | 위치 |
|---|---|
| 진행 | 오른쪽 아래 큰 노란 버튼, 또는 `Space` |
| 문항 건너뛰기 | 하단 드롭다운 |
| 전체화면(무대 모드) | 하단 "전체화면" |
| 대기화면 전환 · 최종 순위 · 전체 초기화 | 하단 "더보기" |

**전체 초기화**는 답변·점수뿐 아니라 **접속한 팀 목록까지 완전히 지웁니다.** 리허설 후 실전 직전에 쓰세요. 비밀번호는 `2026` 입니다 ([`js/common.js`](js/common.js)의 `ADMIN_PASSWORD`).

전체화면 버튼은 네이티브 Fullscreen API와 별개로 "무대 모드" CSS를 함께 켭니다. 브라우저가 전체화면 요청을 거부해도 부수 UI는 확실히 숨겨집니다.

## 상태 구조 (Realtime Database)

```
rooms/gaya2026/
  state/    phase(lobby|quiz|outro|final), index, open, revealed, openedAt
  answers/  {문항ID}/{팀번호} = { choice, ms }
  joined/   {팀번호} = 처음 접속한 시각
  asked/    {문항ID} = true
```

**점수는 저장하지 않고 `answers`에서 계산합니다.** 중복 채점이 원천적으로 불가능하고, 문항 데이터를 고쳐도 순위가 즉시 다시 맞습니다. `ms`는 문항이 열린 뒤 답하기까지 걸린 시간이며, Firebase의 서버 시각 보정(`.info/serverTimeOffset`)을 적용해 참가자 휴대폰 시계가 틀려도 타이브레이크가 흔들리지 않습니다.

## 컨텐츠 수정

문항·팀·마무리 문구는 전부 [`data/gaya-quiz-2026.json`](data/gaya-quiz-2026.json) 하나에서 관리합니다.

```json
{
  "meta": { "title": "", "event": "", "teamCount": 4, "pointsPerQuestion": 100 },
  "practice": null,
  "questions": [{ "id": "Q1", "no": 1, "scored": true, "points": 100, "sheet": 1,
                  "question": "", "choices": ["","",""], "answerIndex": 0,
                  "answerLabel": "", "highlight": "", "explanation": "", "source": "" }],
  "outro": { "title": "", "lines": [] },
  "teams": [{ "no": 1, "label": "1번" }]
}
```

- `answerIndex`는 **0부터** 셉니다
- `teams[].no`는 내부 식별자라 바꾸면 답변·점수 매핑이 깨집니다. 화면 표시는 `label`만 고치세요
- `highlight`는 정답 공개 시 크게 띄울 한 줄, `explanation`은 그 아래 회색 카드에 문장 단위로 들어갑니다
- `sheet`는 배포자료 몇 번째 장인지. 정답률이 낮은 문항의 장을 결과 화면이 자동으로 짚어줍니다
- `practice`에 문항 하나를 넣으면 연습문제로 맨 앞에 붙고 점수에서 제외됩니다 (현재는 없음)

문항을 고친 뒤에는 회귀 테스트를 돌려 정답 배열·배점·필드 정합성을 확인하세요.

```bash
node tools/test-logic.js
```

## 배포

GitHub Pages 고정 주소를 씁니다. 임시 터널은 쓰지 않습니다 — 주소가 바뀌면 QR이 죽습니다.

`main` 브랜치에 푸시하면 1분 내로 https://lalaseohyun.github.io/gaya-quiz/ 에 반영됩니다.

### QR 재생성

주소가 고정이라 QR은 미리 만들어 [`assets/qr-play.svg`](assets/qr-play.svg)에 커밋해 두었습니다. 주소가 바뀌면 [`tools/make-qr.js`](tools/make-qr.js)의 URL을 고치고 다시 실행하세요.

```bash
npm install --no-save qrcode && node tools/make-qr.js
```

진행자 화면은 **지금 열려 있는 주소와 배포 주소가 다르면 QR을 띄우지 않고** 현재 주소를 글자로 보여줍니다. 잘못된 QR을 참가자에게 내보이는 사고를 막기 위한 장치입니다.

### Firebase

Realtime Database 규칙은 [`firebase-rules.json`](firebase-rules.json)을 쓰고, 설정값은 [`js/firebase-config.js`](js/firebase-config.js)에 있습니다. **규칙에 `now < timestamp` 형태의 만료 조건을 넣지 마세요.** 만료되는 순간 앱이 통째로 멈춥니다.

## 현장 대비

- 마을회관 와이파이가 약할 수 있으니 팀 대표 휴대폰의 **모바일 데이터 접속**을 기본으로 안내하세요
- 앱이 죽어도 진행되도록 **10문항 A4 인쇄본**을 준비하세요
- 행사 전 실제 휴대폰으로 QR을 한 번 찍어 접속을 확인하세요
- 리허설 후 반드시 **전체 초기화**로 점수와 접속 기록을 지우세요

## 폰트

Pretendard를 CDN에서 불러옵니다. SB어그로 / KoPubWorld 파일을 보유하고 있다면 `/fonts`에 넣고 `css/base.css`의 `--font`를 고치세요.
