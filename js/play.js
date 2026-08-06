// 팀(참여자) 화면 — 서버 상태를 그대로 따라갑니다. 참여자는 답만 누릅니다.
(function () {
  "use strict";

  var C = window.QuizCommon;
  var app = document.getElementById("app");
  var offlineBadge = document.getElementById("offline");

  var quiz = null;
  var runList = [];
  var db = null;
  var myTeam = null;
  var state = C.emptyState();
  var answers = {};
  var joined = {};
  var connected = true;
  var ready = false;
  var rejected = false; // 마감 후 답변 시도

  var MARKS = "①②③④⑤";

  function currentQuestion() {
    return runList[state.index] || runList[0];
  }

  function myAnswer(q) {
    return q && answers[q.id] ? answers[q.id][myTeam] : undefined;
  }

  function setTeamInUrl(t) {
    var url = new URL(location.href);
    url.searchParams.set("team", t);
    history.replaceState({}, "", url.toString());
  }

  function chooseTeam(t) {
    myTeam = t;
    setTeamInUrl(t);
    // 처음 들어온 시각만 남깁니다. 다시 들어와도 덮어쓰지 않습니다.
    C.roomRef(db, "joined/" + t).transaction(function (cur) {
      return cur === null || cur === undefined ? C.now() : cur;
    });
    render();
  }

  function submit(idx) {
    var q = currentQuestion();
    if (!q) return;
    if (state.phase !== "quiz" || !state.open) {
      // 마감 후 답변은 받지 않습니다.
      rejected = true;
      render();
      return;
    }
    var ms = state.openedAt ? Math.max(0, C.now() - state.openedAt) : 0;
    rejected = false;
    C.roomRef(db, "answers/" + q.id + "/" + myTeam).set({ choice: idx, ms: ms });
  }

  // ---------- 렌더 ----------

  function render() {
    if (!ready || !quiz) return;
    offlineBadge.classList.toggle("hidden", connected);
    if (myTeam === null) return renderPick();
    if (state.phase === "lobby") return renderWaiting();
    if (state.phase === "final") return renderFinal();
    if (state.phase === "outro") return renderOutro();
    if (state.revealed) return renderReveal();
    return renderQuiz();
  }

  function headHtml(right) {
    return (
      '<div class="phead"><span class="pteam">' +
      C.escapeHtml(C.teamLabel(quiz, myTeam)) +
      '</span><span class="pmeta">' +
      (right || "") +
      "</span></div>"
    );
  }

  function renderPick() {
    var btns = quiz.teams
      .map(function (t) {
        return (
          '<button class="pick-btn" data-team="' +
          t.no +
          '">' +
          C.escapeHtml(t.label) +
          "</button>"
        );
      })
      .join("");
    app.innerHTML =
      '<div class="play"><div class="pick">' +
      '<h1 class="pick-title">우리 테이블 번호를 누르세요</h1>' +
      '<p class="pick-sub">앉아 계신 테이블에 붙은 번호와<br />같은 번호를 골라주세요.</p>' +
      '<div class="pick-grid">' +
      btns +
      "</div></div></div>";
    Array.prototype.forEach.call(app.querySelectorAll(".pick-btn"), function (b) {
      b.addEventListener("click", function () {
        chooseTeam(Number(b.getAttribute("data-team")));
      });
    });
  }

  function renderWaiting() {
    app.innerHTML =
      '<div class="play">' +
      headHtml("") +
      '<div class="pcenter"><h2 class="pcenter-title">곧 시작합니다</h2>' +
      '<p class="pcenter-sub">앞 화면을 봐주세요.</p></div></div>';
  }

  function renderQuiz() {
    var q = currentQuestion();
    var mine = myAnswer(q);
    var opts = q.choices
      .map(function (c, i) {
        var cls = "popt" + (mine && mine.choice === i ? " selected" : "");
        return (
          '<button class="' +
          cls +
          '" data-idx="' +
          i +
          '"><span class="mark">' +
          MARKS.charAt(i) +
          "</span><span>" +
          C.escapeHtml(c) +
          "</span></button>"
        );
      })
      .join("");

    app.innerHTML =
      '<div class="play">' +
      headHtml(q.scored === false ? "연습문제" : "문제 " + q.no + " / " + quiz.questions.length) +
      '<h1 class="pquestion">' +
      C.escapeHtml(q.question) +
      "</h1>" +
      '<div class="popts">' +
      opts +
      "</div>" +
      (rejected
        ? '<div class="pnotice">답변이 마감되었습니다</div>'
        : '<div class="phint">' +
          (mine !== undefined
            ? "제출됐습니다 · 마감 전까지 바꿀 수 있어요"
            : "정답이라고 생각하는 것을 누르세요") +
          "</div>") +
      "</div>";

    Array.prototype.forEach.call(app.querySelectorAll(".popt"), function (b) {
      b.addEventListener("click", function () {
        submit(Number(b.getAttribute("data-idx")));
      });
    });
  }

  function renderReveal() {
    var q = currentQuestion();
    var mine = myAnswer(q);
    var standings = C.computeStandings(quiz, answers, joined);
    var me = standings.filter(function (r) {
      return r.no === myTeam;
    })[0];
    var isCorrect = mine !== undefined && mine.choice === q.answerIndex;

    var opts = q.choices
      .map(function (c, i) {
        var cls = "popt";
        if (i === q.answerIndex) cls += " is-answer";
        else if (mine !== undefined && mine.choice === i) cls += " wrong-pick";
        return (
          '<div class="' +
          cls +
          '"><span class="mark">' +
          MARKS.charAt(i) +
          "</span><span>" +
          C.escapeHtml(c) +
          "</span></div>"
        );
      })
      .join("");

    app.innerHTML =
      '<div class="play">' +
      headHtml(q.scored === false ? "연습문제" : "문제 " + q.no + " / " + quiz.questions.length) +
      '<div><div class="pox ' +
      (mine === undefined ? "none" : isCorrect ? "o" : "x") +
      '">' +
      (mine === undefined ? "–" : isCorrect ? "O" : "X") +
      '</div><div class="pox-label">' +
      (mine === undefined ? "답을 못 냈어요" : isCorrect ? "정답입니다" : "아쉽습니다") +
      "</div></div>" +
      '<div class="popts">' +
      opts +
      "</div>" +
      '<div class="pstat">' +
      '<div class="pstat-box"><div class="pstat-k">맞힌 개수</div><div class="pstat-v">' +
      (me ? me.correctCount : 0) +
      " / " +
      C.scoredCount(quiz) +
      "</div></div>" +
      '<div class="pstat-box"><div class="pstat-k">현재 순위</div><div class="pstat-v">' +
      (me ? me.rank + "위" : "-") +
      "</div></div>" +
      "</div></div>";
  }

  function renderFinal() {
    var standings = C.computeStandings(quiz, answers, joined);
    var me = standings.filter(function (r) {
      return r.no === myTeam;
    })[0];
    var medal = me ? ["🥇", "🥈", "🥉"][me.rank - 1] || "🎖️" : "🎖️";

    app.innerHTML =
      '<div class="play">' +
      headHtml("최종 결과") +
      '<div class="pcenter">' +
      '<div class="pmedal">' +
      medal +
      "</div>" +
      '<div class="prank-big">' +
      (me ? me.rank + "위" : "-") +
      "</div>" +
      '<h2 class="pcenter-title">' +
      (me
        ? C.scoredCount(quiz) + "문항 중 " + me.correctCount + "개"
        : "참여 기록이 없습니다") +
      "</h2>" +
      '<p class="pcenter-sub">' +
      (me ? "전체 " + standings.length + "팀 가운데" : "") +
      "</p>" +
      "</div></div>";
  }

  function renderOutro() {
    var lines = (quiz.outro.lines || [])
      .map(function (l) {
        return "<p class=\"pcenter-sub\">" + C.escapeHtml(l) + "</p>";
      })
      .join("");
    app.innerHTML =
      '<div class="play">' +
      headHtml("") +
      '<div class="pcenter"><h2 class="pcenter-title">' +
      C.escapeHtml(quiz.outro.title) +
      "</h2>" +
      lines +
      "</div></div>";
  }

  // ---------- 부팅 ----------

  function boot() {
    if (!C.checkAccessKey()) {
      C.showFatalError(app, "잘못된 접근입니다. QR을 다시 찍어주세요.");
      return;
    }

    C.loadQuizData()
      .then(function (data) {
        quiz = data;
        runList = C.buildRunList(quiz);
        try {
          db = C.initFirebase();
        } catch (e) {
          C.showFatalError(app, e.message);
          return;
        }

        // 새로고침·화면 꺼짐 후 다시 들어와도 팀 선택이 유지됩니다.
        var t = Number(C.getQueryParam("team"));
        if (
          t >= 1 &&
          quiz.teams.some(function (x) {
            return x.no === t;
          })
        ) {
          myTeam = t;
          C.roomRef(db, "joined/" + t).transaction(function (cur) {
            return cur === null || cur === undefined ? C.now() : cur;
          });
        }

        db.ref(".info/connected").on("value", function (snap) {
          connected = snap.val() === true;
          render();
        });
        C.roomRef(db, "state").on("value", function (snap) {
          var prev = state;
          state = snap.val() || C.emptyState();
          if (prev.index !== state.index || prev.open !== state.open) rejected = false;
          ready = true;
          render();
        });
        C.roomRef(db, "answers").on("value", function (snap) {
          answers = snap.val() || {};
          render();
        });
        C.roomRef(db, "joined").on("value", function (snap) {
          joined = snap.val() || {};
          render();
        });
      })
      .catch(function (err) {
        C.showFatalError(app, err.message);
      });
  }

  boot();
})();
