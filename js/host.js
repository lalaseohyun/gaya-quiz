// 가야면 실시간 퀴즈 — 진행자 화면 로직
(function () {
  "use strict";

  var C = window.QuizCommon;
  var app = document.getElementById("app");

  var quiz = null; // { meta, questions }
  var db = null;
  var state = null; // { phase, currentQuestion, revealed, scoredQuestions }
  var scores = {}; // { "1": 100, ... }
  var answers = {}; // { "1": { "1": 2, "2": 0 }, ... }  questionNo -> teamNo -> optionIndex

  function initialRoomData(meta) {
    var s = {};
    C.teamNumbers(meta.teamCount).forEach(function (t) {
      s[t] = 0;
    });
    return {
      state: { phase: "lobby", currentQuestion: 0, revealed: false, scoredQuestions: {} },
      scores: s,
      answers: {}
    };
  }

  function questionByNo(no) {
    return quiz.questions.filter(function (q) {
      return q.no === no;
    })[0];
  }

  function answeredCount(no) {
    var a = answers[no] || {};
    return Object.keys(a).length;
  }

  // ---------- actions ----------

  function startQuiz() {
    C.roomRef(db, "state").update({ phase: "question", currentQuestion: 1, revealed: false });
  }

  function revealAnswer() {
    var no = state.currentQuestion;
    var q = questionByNo(no);
    var already = state.scoredQuestions && state.scoredQuestions[no];

    function finish() {
      C.roomRef(db, "state").update({ revealed: true });
    }

    if (already) {
      finish();
      return;
    }

    var teamAnswers = answers[no] || {};
    var correctTeams = C.teamNumbers(quiz.meta.teamCount).filter(function (t) {
      return teamAnswers[t] === q.answerIndex;
    });

    var pending = correctTeams.length;
    if (pending === 0) {
      C.roomRef(db, "state")
        .child("scoredQuestions")
        .child(String(no))
        .set(true)
        .then(finish);
      return;
    }

    correctTeams.forEach(function (t) {
      C.roomRef(db, "scores")
        .child(String(t))
        .transaction(function (cur) {
          return (cur || 0) + q.points;
        })
        .then(function () {
          pending -= 1;
          if (pending === 0) {
            C.roomRef(db, "state").child("scoredQuestions").child(String(no)).set(true);
            finish();
          }
        });
    });
  }

  function nextQuestion() {
    var total = quiz.questions.length;
    if (state.currentQuestion >= total) {
      C.roomRef(db, "state").update({ phase: "ended", revealed: false });
    } else {
      C.roomRef(db, "state").update({
        phase: "question",
        currentQuestion: state.currentQuestion + 1,
        revealed: false
      });
    }
  }

  function resetAll() {
    var pw = window.prompt("관리자 비밀번호를 입력하세요");
    if (pw === null) return;
    if (pw !== C.ADMIN_PASSWORD) {
      window.alert("비밀번호가 올바르지 않습니다.");
      return;
    }
    if (!window.confirm("정말 처음부터 다시 시작할까요? 모든 점수와 응답이 사라집니다.")) return;
    C.roomRef(db).set(initialRoomData(quiz.meta));
  }

  // ---------- render ----------

  function render() {
    if (!quiz || !state) return;
    var meta = quiz.meta;
    if (state.phase === "lobby") return renderLobby(meta);
    if (state.phase === "question") return renderQuestion(meta);
    if (state.phase === "ended") return renderResults(meta);
    return renderQuestion(meta); // revealed also renders via renderQuestion
  }

  function scoreBarHtml(meta) {
    var items = C.teamNumbers(meta.teamCount)
      .map(function (t) {
        var label = (meta.teamLabels && meta.teamLabels[t - 1]) || t + "번";
        return (
          '<div class="host-score-item"><span>' +
          label +
          '</span><span class="val">' +
          (scores[t] || 0) +
          "점</span></div>"
        );
      })
      .join("");
    return '<div class="host-scorebar">' + items + "</div>";
  }

  function renderLobby(meta) {
    app.innerHTML =
      '<div class="host-wrap">' +
      '<div class="center-screen" style="flex:1;">' +
      '<div class="host-lobby-title heading">' + meta.title + "</div>" +
      '<div class="host-lobby-sub">' + meta.subtitle + "</div>" +
      '<button id="btn-start" class="btn-primary" style="margin-top:32px;padding:22px 48px;font-size:26px;font-weight:700;">퀴즈 시작</button>' +
      "</div>" +
      '<div class="host-controls"><button id="btn-reset" class="btn-danger">관리자 초기화</button></div>' +
      "</div>";
    document.getElementById("btn-start").addEventListener("click", startQuiz);
    document.getElementById("btn-reset").addEventListener("click", resetAll);
  }

  function renderQuestion(meta) {
    var no = state.currentQuestion;
    var q = questionByNo(no);
    var total = quiz.questions.length;
    var left = meta.teamCount - answeredCount(no);
    var revealed = !!state.revealed;

    var optionsHtml = q.options
      .map(function (opt, idx) {
        var cls = "host-option";
        if (revealed) cls += idx === q.answerIndex ? " is-correct" : " is-wrong";
        return '<div class="' + cls + '">' + opt + "</div>";
      })
      .join("");

    var teamAnswers = answers[no] || {};
    var teamResultsHtml = C.teamNumbers(meta.teamCount)
      .map(function (t) {
        var label = (meta.teamLabels && meta.teamLabels[t - 1]) || t + "번";
        var hasAnswer = Object.prototype.hasOwnProperty.call(teamAnswers, t);
        var cls = "host-team-result";
        var text = label;
        if (!hasAnswer) {
          cls += " no-answer";
          text += " · 무응답";
        } else if (teamAnswers[t] === q.answerIndex) {
          cls += " correct";
          text += " · 정답";
        } else {
          cls += " wrong";
          text += " · 오답";
        }
        return '<div class="' + cls + '">' + text + "</div>";
      })
      .join("");

    var bottomControls = revealed
      ? '<button id="btn-next" class="btn-primary">' +
        (no >= total ? "결과 보기" : "다음 문항") +
        "</button>"
      : '<button id="btn-reveal" class="btn-primary">정답 공개</button>';

    var midHtml = revealed
      ? '<div class="host-highlight-panel">' +
        '<div class="host-highlight-text"><span class="highlight-band">' +
        q.highlight +
        "</span></div>" +
        '<div class="host-team-grid">' +
        teamResultsHtml +
        "</div>" +
        "</div>"
      : '<div class="host-question heading">' +
        q.question +
        "</div>" +
        '<div class="host-options">' +
        optionsHtml +
        "</div>";

    app.innerHTML =
      '<div class="host-wrap">' +
      '<div class="host-top">' +
      '<span class="host-qno">문항 ' +
      no +
      " / " +
      total +
      "</span>" +
      '<span class="host-teams-left">' +
      (revealed ? "공개됨" : "미제출 " + left + "팀") +
      "</span>" +
      "</div>" +
      midHtml +
      scoreBarHtml(meta) +
      '<div class="host-controls">' +
      bottomControls +
      '<button id="btn-reset" class="btn-danger">관리자 초기화</button>' +
      "</div>" +
      "</div>";

    if (revealed) {
      document.getElementById("btn-next").addEventListener("click", nextQuestion);
    } else {
      document.getElementById("btn-reveal").addEventListener("click", revealAnswer);
    }
    document.getElementById("btn-reset").addEventListener("click", resetAll);
  }

  function renderResults(meta) {
    var ranked = C.teamNumbers(meta.teamCount)
      .map(function (t) {
        return { team: t, label: (meta.teamLabels && meta.teamLabels[t - 1]) || t + "번", score: scores[t] || 0 };
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

    var rows = quiz.questions
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

    app.innerHTML =
      '<div class="results-wrap">' +
      '<div class="heading" style="font-size:34px;">최종 결과</div>' +
      '<div class="rank-list">' +
      rankHtml +
      "</div>" +
      '<table class="sheet-table"><thead><tr><th>문항</th><th>정답 팀 수</th><th>관련 자료</th></tr></thead><tbody>' +
      rows +
      "</tbody></table>" +
      '<div class="host-controls"><button id="btn-reset" class="btn-danger">관리자 초기화</button></div>' +
      "</div>";
    document.getElementById("btn-reset").addEventListener("click", resetAll);
  }

  // ---------- boot ----------

  function boot() {
    if (!C.checkAccessKey()) {
      C.showFatalError(app, "잘못된 접근입니다. 올바른 주소(?k=...)로 다시 열어주세요.");
      return;
    }

    Promise.all([C.loadQuizData()])
      .then(function (results) {
        quiz = results[0];
        try {
          db = C.initFirebase();
        } catch (e) {
          C.showFatalError(app, e.message);
          return;
        }

        C.roomRef(db, "state").once("value", function (snap) {
          if (!snap.exists()) {
            C.roomRef(db).set(initialRoomData(quiz.meta));
          }
        });

        C.roomRef(db, "state").on("value", function (snap) {
          state = snap.val() || { phase: "lobby", currentQuestion: 0, revealed: false, scoredQuestions: {} };
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
