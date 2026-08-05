// 문항별 정답률 — 진행자가 배포자료의 어느 장을 더 짚을지 판단하는 자료입니다.
(function () {
  "use strict";

  var C = window.QuizCommon;
  var app = document.getElementById("app");

  var quiz = null;
  var state = C.emptyState();
  var answers = {};
  var joined = {};
  var asked = {};
  var ready = false;

  function render() {
    if (!ready || !quiz) return;

    var jl = C.joinedTeams(quiz, joined);
    var standings = C.computeStandings(quiz, answers, joined);

    var rankHtml =
      standings.length === 0
        ? '<div class="rempty">아직 참여한 팀이 없습니다</div>'
        : '<div class="rrank">' +
          standings
            .map(function (r) {
              return (
                '<div class="rrank-item' +
                (r.rank === 1 ? " top" : "") +
                '"><span><span class="rrank-no">' +
                r.rank +
                "위</span>" +
                C.escapeHtml(r.label) +
                "</span><span>" +
                r.correctCount +
                " / " +
                C.scoredCount(quiz) +
                "개</span></div>"
              );
            })
            .join("") +
          "</div>";

    var askedQs = quiz.questions.filter(function (q) {
      return asked[q.id];
    });

    var rows =
      askedQs.length === 0
        ? '<tr><td colspan="4" class="rempty">아직 출제된 문항이 없습니다</td></tr>'
        : askedQs
            .map(function (q) {
              var a = answers[q.id] || {};
              var correct = jl.filter(function (no) {
                return a[no] && a[no].choice === q.answerIndex;
              }).length;
              var pct = jl.length ? Math.round((correct / jl.length) * 100) : 0;
              var low = jl.length > 0 && pct <= 50;
              return (
                '<tr class="' +
                (low ? "rlow" : "") +
                '"><td class="num">' +
                q.no +
                "번</td><td>" +
                C.escapeHtml(q.question.slice(0, 22)) +
                '</td><td class="num">' +
                correct +
                " / " +
                jl.length +
                '</td><td><div class="rbar"><span style="width:' +
                pct +
                '%"></span></div></td><td class="num">' +
                q.sheet +
                "장</td></tr>"
              );
            })
            .join("");

    var weak = askedQs
      .filter(function (q) {
        var a = answers[q.id] || {};
        var correct = jl.filter(function (no) {
          return a[no] && a[no].choice === q.answerIndex;
        }).length;
        return jl.length > 0 && correct / jl.length <= 0.5;
      })
      .map(function (q) {
        return q.sheet;
      });
    var weakSheets = weak
      .filter(function (v, i, arr) {
        return arr.indexOf(v) === i;
      })
      .sort(function (a, b) {
        return a - b;
      });

    app.innerHTML =
      '<div class="rwrap">' +
      '<div class="rhead"><div class="rkicker">' +
      C.escapeHtml(quiz.meta.event) +
      '</div><h1 class="rtitle">문항별 정답률</h1><div class="rsub">참여 ' +
      jl.length +
      "팀 · " +
      (state.phase === "final" || state.phase === "outro" ? "퀴즈 종료" : "진행 중") +
      "</div></div>" +
      '<div><div class="rsection-title">순위</div>' +
      rankHtml +
      "</div>" +
      '<div><div class="rsection-title">문항별</div>' +
      '<table class="rtable"><thead><tr><th>문항</th><th>내용</th><th>정답</th><th>정답률</th><th>자료</th></tr></thead><tbody>' +
      rows +
      "</tbody></table></div>" +
      (weakSheets.length
        ? '<div class="rhint">절반 이하가 맞힌 문항이 있습니다. 배포자료 <b>' +
          weakSheets
            .map(function (s) {
              return s + "장";
            })
            .join(", ") +
          "</b>을 더 짚어주세요.</div>"
        : "") +
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
        C.roomRef(db, "state").on("value", function (s) {
          state = s.val() || C.emptyState();
          ready = true;
          render();
        });
        C.roomRef(db, "answers").on("value", function (s) {
          answers = s.val() || {};
          render();
        });
        C.roomRef(db, "joined").on("value", function (s) {
          joined = s.val() || {};
          render();
        });
        C.roomRef(db, "asked").on("value", function (s) {
          asked = s.val() || {};
          render();
        });
      })
      .catch(function (err) {
        C.showFatalError(app, err.message);
      });
  }

  boot();
})();
