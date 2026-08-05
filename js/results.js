// 가야면 실시간 퀴즈 — 결과 화면 (공개 뷰, 언제든 접속 가능)
(function () {
  "use strict";

  var C = window.QuizCommon;
  var app = document.getElementById("app");

  var quiz = null;
  var state = null;
  var scores = {};
  var answers = {};

  function teamLabel(t) {
    return (quiz.meta.teamLabels && quiz.meta.teamLabels[t - 1]) || t + "번";
  }

  function render() {
    if (!quiz || !state) return;
    var meta = quiz.meta;
    var scoredMap = state.scoredQuestions || {};

    var ranked = C.teamNumbers(meta.teamCount)
      .map(function (t) {
        return { team: t, label: teamLabel(t), score: scores[t] || 0 };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });

    var rankHtml = ranked
      .map(function (r, i) {
        return (
          '<div class="rank-item' +
          (i === 0 ? " rank-1" : "") +
          '"><span><span class="rank-number">' +
          (i + 1) +
          "위</span>" +
          r.label +
          "</span><span>" +
          r.score +
          "점</span></div>"
        );
      })
      .join("");

    var revealedQuestions = quiz.questions.filter(function (q) {
      return !!scoredMap[q.no];
    });

    var rowsHtml =
      revealedQuestions.length === 0
        ? '<tr><td colspan="3" style="color:var(--gray);">아직 공개된 문항이 없습니다</td></tr>'
        : revealedQuestions
            .map(function (q) {
              var qa = answers[q.no] || {};
              var correct = C.teamNumbers(meta.teamCount).filter(function (t) {
                return qa[t] === q.answerIndex;
              }).length;
              return (
                "<tr><td>" +
                q.no +
                "번</td><td>" +
                correct +
                " / " +
                meta.teamCount +
                "</td><td>" +
                q.sheet +
                "장</td></tr>"
              );
            })
            .join("");

    var statusLine =
      state.phase === "ended"
        ? "퀴즈 종료 · 최종 결과"
        : "진행 중 · 문항 " + (state.currentQuestion || 0) + " / " + quiz.questions.length;

    app.innerHTML =
      '<div class="results-wrap">' +
      '<div class="heading" style="font-size:30px;">' +
      meta.title +
      "</div>" +
      '<div style="color:var(--gray);font-size:16px;">' +
      statusLine +
      "</div>" +
      '<div class="rank-list">' +
      rankHtml +
      "</div>" +
      '<table class="sheet-table"><thead><tr><th>문항</th><th>정답 팀 수</th><th>관련 자료</th></tr></thead><tbody>' +
      rowsHtml +
      "</tbody></table>" +
      "</div>";
  }

  function boot() {
    if (!C.checkAccessKey()) {
      C.showFatalError(app, "잘못된 접근입니다. 올바른 주소(?k=...)로 다시 열어주세요.");
      return;
    }

    C.loadQuizData()
      .then(function (data) {
        quiz = data;
        var db;
        try {
          db = C.initFirebase();
        } catch (e) {
          C.showFatalError(app, e.message);
          return;
        }

        C.roomRef(db, "state").on("value", function (snap) {
          state = snap.val() || { phase: "lobby", currentQuestion: 0, scoredQuestions: {} };
          render();
        });
        C.roomRef(db, "scores").on("value", function (snap) {
          scores = snap.val() || {};
          render();
        });
        C.roomRef(db, "answers").on("value", function (snap) {
          answers = snap.val() || {};
          render();
        });
      })
      .catch(function (err) {
        C.showFatalError(app, err.message);
      });
  }

  boot();
})();
