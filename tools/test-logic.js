// 회귀 테스트 — 화면 없이 순위·집계·경계 조건을 검증합니다.
//   node tools/test-logic.js
//
// common.js 를 브라우저 없이 그대로 불러 쓰기 위해, window/fetch/firebase 만 흉내 냅니다.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const quiz = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "gaya-quiz-2026.json"), "utf8"));

// --- common.js 로드 -------------------------------------------------------
const sandbox = {
  window: {},
  location: { search: "?k=gaya2026" },
  URLSearchParams,
  fetch: () => Promise.reject(new Error("not used")),
  firebase: { apps: [{}], initializeApp() {}, database: () => ({ ref: () => ({ on() {} }) }) },
  console
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "common.js"), "utf8"), sandbox);
const C = sandbox.QuizCommon;

// --- 아주 작은 테스트 러너 -------------------------------------------------
let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) {
    pass += 1;
    console.log("  ✓ " + name);
  } else {
    fail += 1;
    console.log("  ✗ " + name + (extra !== undefined ? "  →  " + JSON.stringify(extra) : ""));
  }
}
function group(name) {
  console.log("\n" + name);
}

const Q = quiz.questions;
const correctOf = (i) => Q[i].answerIndex;
const wrongOf = (i) => (Q[i].answerIndex + 1) % 3;

// --- 데이터 무결성 ---------------------------------------------------------
group("데이터");
check("문항 10개", Q.length === 10, Q.length);
check("정답 배열이 SPEC과 일치 (③①③②②①①②③②)",
  Q.map((q) => "①②③"[q.answerIndex]).join("") === "③①③②②①①②③②",
  Q.map((q) => "①②③"[q.answerIndex]).join(""));
check("모든 문항 보기 3개", Q.every((q) => q.choices.length === 3));
check("answerLabel이 정답 보기와 일치",
  Q.every((q) => q.answerLabel.includes(q.choices[q.answerIndex])));
check("총점 1,000점", Q.reduce((s, q) => s + q.points, 0) === 1000);
check("id가 Q1..Q10로 고유", new Set(Q.map((q) => q.id)).size === 10);
check("팀 4개", quiz.teams.length === 4 && quiz.meta.teamCount === 4);
check("연습문제 없음 → 진행 목록 10개", C.buildRunList(quiz).length === 10);

// --- 분모는 "실제로 들어온 팀" -------------------------------------------
group("분모: 접속한 팀만");
{
  const joined = { 2: 1000, 3: 1000 }; // 2팀만 참여
  const answers = { Q1: { 2: { choice: correctOf(0), ms: 500 } } };
  const st = C.computeStandings(quiz, answers, joined);
  check("참여한 2팀만 순위에 오름", st.length === 2, st.map((r) => r.no));
  check("미접속 팀은 제외됨", !st.some((r) => r.no === 1 || r.no === 4));
  check("정답 팀 100점", st.find((r) => r.no === 2).score === 100);
  check("무응답 팀 0점", st.find((r) => r.no === 3).score === 0);
  check("접속 팀 목록 = joinedTeams", JSON.stringify(C.joinedTeams(quiz, joined)) === "[2,3]");
}

// --- 아무도 답 안 해도 진행 가능 -----------------------------------------
group("전원 기권");
{
  const joined = { 1: 1, 2: 1, 3: 1, 4: 1 };
  const st = C.computeStandings(quiz, {}, joined);
  check("4팀 모두 0점", st.every((r) => r.score === 0));
  check("순위는 1~4위로 갈림", JSON.stringify(st.map((r) => r.rank)) === "[1,2,3,4]");
  check("동점이어도 공동 순위 없음", new Set(st.map((r) => r.rank)).size === 4);
}

// --- 동점 타이브레이크 ----------------------------------------------------
group("동점 처리");
{
  const joined = { 1: 1, 2: 1, 3: 1, 4: 1 };
  const answers = {
    Q1: {
      1: { choice: correctOf(0), ms: 9000 },
      2: { choice: correctOf(0), ms: 1200 },
      3: { choice: correctOf(0), ms: 4000 },
      4: { choice: wrongOf(0), ms: 300 }
    }
  };
  const st = C.computeStandings(quiz, answers, joined);
  check("같은 100점이면 빨리 누른 팀이 앞", JSON.stringify(st.slice(0, 3).map((r) => r.no)) === "[2,3,1]",
    st.map((r) => [r.no, r.score, r.ms]));
  check("오답 팀은 맨 뒤", st[3].no === 4);
  check("1~4위 모두 다름", new Set(st.map((r) => r.rank)).size === 4);
  check("오답의 ms는 타이브레이크에 안 들어감", st[3].ms === 0, st[3].ms);
}

// --- 정답을 빨리 눌러도 점수가 낮으면 뒤 --------------------------------
group("점수 우선, ms는 그 다음");
{
  const joined = { 1: 1, 2: 1 };
  const answers = {
    Q1: { 1: { choice: correctOf(0), ms: 8000 }, 2: { choice: correctOf(0), ms: 10 } },
    Q2: { 1: { choice: correctOf(1), ms: 8000 }, 2: { choice: wrongOf(1), ms: 10 } }
  };
  const st = C.computeStandings(quiz, answers, joined);
  check("200점 팀이 100점 팀보다 앞", st[0].no === 1 && st[0].score === 200, st.map((r) => [r.no, r.score]));
}

// --- 만점 ------------------------------------------------------------------
group("만점");
{
  const joined = { 1: 1 };
  const answers = {};
  Q.forEach((q, i) => { answers[q.id] = { 1: { choice: q.answerIndex, ms: 100 * (i + 1) } }; });
  const st = C.computeStandings(quiz, answers, joined);
  check("10문항 전부 맞히면 1,000점", st[0].score === 1000, st[0].score);
  check("정답 수 10", st[0].correctCount === 10);
  check("ms 합계 = 5500", st[0].ms === 5500, st[0].ms);
}

// --- 답 변경 (마지막 값만 반영) -------------------------------------------
group("답 변경");
{
  const joined = { 1: 1 };
  // 화면에서는 set()으로 덮어쓰므로 마지막 값만 남습니다.
  const answers = { Q1: { 1: { choice: correctOf(0), ms: 4000 } } };
  const st = C.computeStandings(quiz, answers, joined);
  check("바꾼 최종 답으로 채점", st[0].score === 100);
}

// --- 순위 조회 -------------------------------------------------------------
group("순위 조회");
{
  const joined = { 1: 1, 2: 1 };
  const answers = { Q1: { 2: { choice: correctOf(0), ms: 100 } } };
  const st = C.computeStandings(quiz, answers, joined);
  check("rankOf가 팀 순위를 정확히 반환", C.rankOf(st, 2) === 1 && C.rankOf(st, 1) === 2);
  check("미접속 팀은 null", C.rankOf(st, 4) === null);
}

// --- 해설 문장 분리 --------------------------------------------------------
group("해설 표시");
{
  const s = C.splitSentences(Q[1].explanation);
  check("문장 단위로 나뉨", s.length >= 2, s.length);
  check("빈 문장 없음", s.every((x) => x.trim().length > 0));
  check("합치면 원문 보존", s.join(" ").replace(/\s+/g, "") === Q[1].explanation.replace(/\s+/g, ""));
}

// --- 초기 상태 -------------------------------------------------------------
group("초기화");
{
  const init = C.initialRoomData();
  check("초기 phase는 lobby", init.state.phase === "lobby");
  check("초기화가 answers를 비움", Object.keys(init.answers).length === 0);
  check("초기화가 joined까지 비움", Object.keys(init.joined).length === 0);
  check("초기화가 asked까지 비움", Object.keys(init.asked).length === 0);
}

console.log("\n" + "=".repeat(46));
console.log("통과 " + pass + " · 실패 " + fail);
console.log("=".repeat(46));
process.exit(fail === 0 ? 0 : 1);
