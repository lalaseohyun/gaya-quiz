# 가야면 실시간 퀴즈

가야면 1차 주민워크숍용 실시간 퀴즈 웹앱. 진행자 화면과 팀 화면이 분리되어 있고, Firebase Realtime Database로 실시간 동기화합니다.

- 진행자 화면: `/host/?k=gaya2026`
- 팀 화면: `/play/?k=gaya2026`
- 결과 화면(공개): `/results/?k=gaya2026`

빌드 과정이 없는 순수 정적 사이트입니다 (HTML/CSS/JS + Firebase compat SDK를 CDN에서 로드).

## 1. Firebase 프로젝트 준비

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 새 프로젝트를 만듭니다.
2. 왼쪽 메뉴 **빌드 > Realtime Database**로 들어가 데이터베이스를 생성합니다. (Firestore가 아니라 **Realtime Database**입니다.)
   - 위치는 아시아 리전(예: `asia-southeast1`) 권장.
   - 시작 모드는 아무거나 선택해도 되며, 아래 3번에서 규칙을 덮어씁니다.
3. **Realtime Database > 규칙** 탭에 이 저장소의 [`firebase-rules.json`](firebase-rules.json) 내용을 붙여넣고 게시합니다.
   - `now < timestamp` 같은 만료 규칙은 절대 넣지 마세요. 만료되면 앱이 통째로 멈춥니다.
4. **프로젝트 설정 > 일반 > 내 앱**에서 웹 앱(`</>`)을 추가하고, 나오는 `firebaseConfig` 값을 복사합니다.
5. [`js/firebase-config.js`](js/firebase-config.js) 파일을 열어 `window.FIREBASE_CONFIG` 값을 방금 복사한 값으로 채웁니다. `databaseURL`을 꼭 포함해야 합니다.

## 2. 로컬 확인

정적 파일 서버로 아무 폴더에서나 열면 됩니다. 예:

```bash
npx serve .
```

브라우저에서 `http://localhost:3000/host/?k=gaya2026` 과 `http://localhost:3000/play/?k=gaya2026` 을 각각 열어 확인합니다.

## 3. GitHub Pages 배포

1. 이 폴더를 GitHub 저장소로 푸시합니다 (예: `lalaseohyun/gaya-quiz`).
2. 저장소 **Settings > Pages**에서 Source를 `Deploy from a branch`, 브랜치를 `main` / `(root)`로 설정합니다.
3. 배포되면 주소는 `https://lalaseohyun.github.io/gaya-quiz/` 형태이며, 아래 경로들이 실제 서비스 URL이 됩니다.
   - `https://lalaseohyun.github.io/gaya-quiz/host/?k=gaya2026`
   - `https://lalaseohyun.github.io/gaya-quiz/play/?k=gaya2026`
   - `https://lalaseohyun.github.io/gaya-quiz/results/?k=gaya2026`
4. `js/firebase-config.js`에 실제 값을 채운 뒤 커밋/푸시해야 실시간 동기화가 동작합니다.

`.nojekyll` 파일이 포함되어 있어 GitHub Pages의 Jekyll 처리로 인한 문제를 방지합니다.

## 4. 진행 방법

1. 진행자가 `/host` 화면을 빔프로젝터에 띄우고 **퀴즈 시작**을 누릅니다.
2. 팀은 `/play` 화면에서 자기 팀 번호(1~4)를 선택합니다. 새로고침해도 팀 선택은 URL의 `team` 파라미터로 유지됩니다 — QR로 다시 들어와도 `team` 값이 있으면 선택 화면이 다시 뜨지 않습니다.
3. 문항이 뜨면 팀은 보기 3개 중 하나를 눌러 제출합니다. **팀당 1회만 제출**되며 제출 후 버튼은 잠깁니다.
4. 진행자가 **정답 공개**를 누르면 `highlight`와 팀별 정오가 뜨고, 정답을 맞힌 팀에게 자동으로 점수가 더해집니다.
5. 진행자가 말로 해설한 뒤 **다음 문항**을 누릅니다. 10문항이 끝나면 자동으로 결과 화면(순위 + 문항별 정답률)이 나옵니다.
6. **관리자 초기화** 버튼은 리허설 후 점수를 리셋할 때 씁니다. 비밀번호는 [`js/common.js`](js/common.js)의 `ADMIN_PASSWORD` 값입니다 (기본값 `gaya2026admin` — 행사 전 반드시 바꾸는 것을 권장합니다).

## 5. 데이터 구조 (Realtime Database)

```
rooms/gaya2026/
  state/     phase(lobby|question|ended), currentQuestion, revealed, scoredQuestions
  answers/   {questionNo}/{teamNo} = optionIndex
  scores/    {teamNo} = 누적점수
```

문항 데이터는 [`data/gaya-quiz-2026.json`](data/gaya-quiz-2026.json)에서 관리합니다. 문항을 고치더라도 `no`, `options`, `answerIndex`, `highlight`, `points`, `sheet` 구조만 지키면 앱 코드는 그대로 동작합니다.

## 6. 오프라인/현장 대비

- 마을회관 와이파이가 약할 수 있으므로 팀 대표 휴대폰의 모바일 데이터 접속을 기본 안내로 준비하세요.
- 앱이 죽는 상황에 대비해 10문항을 A4로 인쇄한 종이 백업을 준비하세요 (`data/gaya-quiz-2026.json`의 `question`/`options`/`highlight`로 인쇄본을 만들 수 있습니다).

## 7. 폰트

기본은 Pretendard(웹폰트 없이 시스템 폰트로 폴백)입니다. SB어그로 / KoPubWorld 폰트 파일을 보유하고 있다면 `/fonts` 폴더에 넣고 [`css/style.css`](css/style.css) 상단의 `@font-face` 주석을 해제하세요.
