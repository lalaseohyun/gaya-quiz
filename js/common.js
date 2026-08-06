// 가야면 실시간 퀴즈 — 공통 로직
//
// 상태 모델 (Firebase Realtime Database)
//   rooms/gaya2026/
//     state/    phase(lobby|quiz|outro|final), index, open, revealed, openedAt
//     answers/  {문항ID}/{팀번호} = { choice, ms }
//     joined/   {팀번호} = 처음 접속한 시각 (한 번이라도 들어온 팀)
//     asked/    {문항ID} = true (한 번이라도 출제된 문항)
//
// 점수는 저장하지 않고 answers에서 계산합니다. 중복 채점이 원천적으로 불가능하고,
// 문항 데이터를 고쳐도 순위가 즉시 다시 맞습니다.
(function (global) {
  "use strict";

  var ROOM_ID = "gaya2026";
  var ACCESS_KEY = "gaya2026";
  var DATA_PATH = "../data/gaya-quiz-2026.json";

  var serverOffset = 0; // 서버 시각 - 기기 시각 (기기 시계가 틀려도 ms 집계가 흔들리지 않게)

  function getQueryParam(name) {
    return new URLSearchParams(global.location.search).get(name);
  }

  function checkAccessKey() {
    return getQueryParam("k") === ACCESS_KEY;
  }

  function loadQuizData() {
    // GitHub Pages가 max-age=600을 붙이기 때문에 그냥 두면 문항을 고친 뒤 최대 10분간
    // 옛 데이터가 뜰 수 있습니다. 진행자와 팀이 서로 다른 문항을 보는 사고를 막기 위해
    // 항상 서버에 재검증합니다 (내용이 그대로면 304라 비용은 거의 없습니다).
    return fetch(DATA_PATH, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error("퀴즈 데이터를 불러오지 못했습니다 (" + res.status + ")");
      return res.json();
    });
  }

  // practice가 있으면 맨 앞에 붙인 전체 진행 목록. index는 이 배열 기준입니다.
  function buildRunList(quiz) {
    var list = [];
    if (quiz.practice) list.push(quiz.practice);
    return list.concat(quiz.questions);
  }

  function initFirebase() {
    if (!global.FIREBASE_CONFIG || global.FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
      throw new Error("js/firebase-config.js 에 Firebase 프로젝트 설정을 채워주세요.");
    }
    if (!firebase.apps.length) firebase.initializeApp(global.FIREBASE_CONFIG);
    var db = firebase.database();
    db.ref(".info/serverTimeOffset").on("value", function (snap) {
      serverOffset = snap.val() || 0;
    });
    return db;
  }

  function now() {
    return Date.now() + serverOffset;
  }

  function roomRef(db, path) {
    var base = "rooms/" + ROOM_ID;
    return db.ref(path ? base + "/" + path : base);
  }

  function emptyState() {
    return { phase: "lobby", index: 0, open: false, revealed: false, openedAt: 0 };
  }

  function initialRoomData() {
    return { state: emptyState(), answers: {}, joined: {}, asked: {} };
  }

  // 점수에 반영되는 문항 수 (연습문제 제외)
  function scoredCount(quiz) {
    return quiz.questions.filter(function (q) {
      return q.scored !== false;
    }).length;
  }

  function teamLabel(quiz, no) {
    var t = quiz.teams.filter(function (x) {
      return x.no === Number(no);
    })[0];
    return t ? t.label : no + "번";
  }

  function joinedTeams(quiz, joined) {
    // 한 번이라도 들어온 팀만. 순위·제출률의 분모는 항상 이것입니다.
    return quiz.teams
      .filter(function (t) {
        return joined && joined[t.no] !== undefined && joined[t.no] !== null;
      })
      .map(function (t) {
        return t.no;
      });
  }

  // 본문제(scored)만 집계. 동점이면 정답을 빨리 누른 팀이 앞서고,
  // 공동 순위 없이 1등부터 끝까지 가릅니다.
  function computeStandings(quiz, answers, joined) {
    var scored = quiz.questions.filter(function (q) {
      return q.scored !== false;
    });
    var rows = joinedTeams(quiz, joined).map(function (no) {
      var score = 0;
      var correctMs = 0;
      var correctCount = 0;
      scored.forEach(function (q) {
        var a = answers && answers[q.id] && answers[q.id][no];
        if (a && a.choice === q.answerIndex) {
          score += q.points || 100;
          correctMs += typeof a.ms === "number" ? a.ms : 0;
          correctCount += 1;
        }
      });
      return {
        no: no,
        label: teamLabel(quiz, no),
        score: score,
        correctCount: correctCount,
        ms: correctMs
      };
    });
    rows.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (a.ms !== b.ms) return a.ms - b.ms; // 빨리 맞힌 팀이 앞
      return a.no - b.no; // 그래도 같으면 팀 번호순 (결정적 정렬)
    });
    rows.forEach(function (r, i) {
      r.rank = i + 1; // 공동 순위 없음
    });
    return rows;
  }

  function rankOf(standings, teamNo) {
    var hit = standings.filter(function (r) {
      return r.no === Number(teamNo);
    })[0];
    return hit ? hit.rank : null;
  }

  function showFatalError(container, message) {
    container.innerHTML =
      '<div class="fatal"><div class="fatal-msg">' + escapeHtml(message) + "</div></div>";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // 해설 안의 **강조**를 굵게. HTML을 먼저 이스케이프하므로 태그 주입은 되지 않습니다.
  // 마침표는 ** 밖에 두세요 ("…아닙니다**." ○ / "…아닙니다.**" ✗) — 문장 분리가 어긋납니다.
  function inlineBold(text) {
    return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  // 해설을 문장 단위로 끊습니다. 카드 안에서 한 줄씩 읽히도록.
  function splitSentences(text) {
    if (!text) return [];
    return String(text)
      .split(/(?<=[.!?])\s+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  // 카드 안에 안 들어가면 글자 크기를 줄여서라도 잘리지 않게 합니다.
  function fitToBox(el, maxPx, minPx) {
    if (!el) return;
    var size = maxPx;
    el.style.fontSize = size + "px";
    var guard = 0;
    while (el.scrollHeight > el.clientHeight + 1 && size > minPx && guard < 80) {
      size -= 1;
      el.style.fontSize = size + "px";
      guard += 1;
    }
  }

  global.QuizCommon = {
    ROOM_ID: ROOM_ID,
    ACCESS_KEY: ACCESS_KEY,
    getQueryParam: getQueryParam,
    checkAccessKey: checkAccessKey,
    loadQuizData: loadQuizData,
    buildRunList: buildRunList,
    scoredCount: scoredCount,
    initFirebase: initFirebase,
    now: now,
    roomRef: roomRef,
    emptyState: emptyState,
    initialRoomData: initialRoomData,
    teamLabel: teamLabel,
    joinedTeams: joinedTeams,
    computeStandings: computeStandings,
    rankOf: rankOf,
    showFatalError: showFatalError,
    escapeHtml: escapeHtml,
    inlineBold: inlineBold,
    splitSentences: splitSentences,
    fitToBox: fitToBox
  };
})(window);
