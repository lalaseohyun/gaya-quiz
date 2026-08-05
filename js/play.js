// 가야면 실시간 퀴즈 — 팀 화면 로직
(function () {
  "use strict";

  var C = window.QuizCommon;
  var app = document.getElementById("app");

  var quiz = null;
  var db = null;
  var myTeam = null; // 1..4
  var state = null;
  var myScore = 0;
  var myAnswers = {}; // questionNo -> optionIndex (내 팀이 낸 답)
  var submitting = false;

  function questionByNo(no) {
    return quiz.questions.filter(function (q) {
      return q.no === no;
    })[0];
  }

  function teamLabel(t) {
    return (quiz.meta.teamLabels && quiz.meta.teamLabels[t - 1]) || t + "번";
  }

  function setTeamInUrl(t) {
    var url = new URL(window.location.href);
    url.searchParams.set("team", t);
    window.history.replaceState({}, "", url.toString());
  }

  function chooseTeam(t) {
    myTeam = t;
    setTeamInUrl(t);
    attachTeamListeners();
    render();
  }

  function submitAnswer(no, idx) {
    if (submitting) return;
    submitting = true;
    C.roomRef(db, "answers/" + no + "/" + myTeam)
      .transaction(function (cur) {
        if (cur !== null && cur !== undefined) return; // 이미 제출됨 — 중단
        return idx;
      })
      .then(function () {
        submitting = false;
      })
      .catch(function () {
        submitting = false;
      });
  }

  function attachTeamListeners() {
    C.roomRef(db, "answers").on("value", function (snap) {
      var all = snap.val() || {};
      var mine = {};
      Object.keys(all).forEach(function (no) {
        var perTeam = all[no] || {};
        if (Object.prototype.hasOwnProperty.call(perTeam, myTeam)) {
          mine[no] = perTeam[myTeam];
        }
      });
      myAnswers = mine;
      render();
    });
    C.roomRef(db, "scores/" + myTeam).on("value", function (snap) {
      myScore = snap.val() || 0;
      render();
    });
  }

  // ---------- render ----------

  function render() {
    if (!quiz || !state) return;
    if (myTeam === null) return renderTeamSelect();
    if (state.phase === "lobby") return renderWaiting();
    if (state.phase === "ended") return renderEnded();
    return renderQuestion();
  }

  function renderTeamSelect() {
    var meta = quiz.meta;
    var btns = C.teamNumbers(meta.teamCount)
      .map(function (t) {
        return (
          '<button class="team-select-btn" data-team="' + t + '">' + teamLabel(t) + "</button>"
        );
      })
      .join("");
    app.innerHTML =
      '<div class="center-screen">' +
      '<div class="heading" style="font-size:24px;">우리 팀 번호를 선택하세요</div>' +
      '<div class="team-select-grid">' +
      btns +
      "</div>" +
      "</div>";
    Array.prototype.forEach.call(document.querySelectorAll(".team-select-btn"), function (btn) {
      btn.addEventListener("click", function () {
        chooseTeam(Number(btn.getAttribute("data-team")));
      });
    });
  }

  function headerHtml() {
    return (
      '<div class="play-header"><span class="play-team-badge">' +
      teamLabel(myTeam) +
      " 팀</span><span class=\"play-qno\">현재 " +
      (myScore || 0) +
      "점</span></div>"
    );
  }

  function renderWaiting() {
    app.innerHTML =
      '<div class="play-wrap">' +
      headerHtml() +
      '<div class="center-screen" style="flex:1;">' +
      '<div class="heading" style="font-size:26px;">곧 시작합니다</div>' +
      '<div style="color:var(--gray);font-size:16px;">진행자 화면을 확인해주세요</div>' +
      "</div>" +
      "</div>";
  }

  function renderQuestion() {
    var no = state.currentQuestion;
    var q = questionByNo(no);
    var revealed = !!state.revealed;
    var mySelected = myAnswers[no];
    var hasAnswered = mySelected !== undefined;

    var body;
    if (!hasAnswered && !revealed) {
      var optsHtml = q.options
        .map(function (opt, idx) {
          return (
            '<button class="play-option" data-idx="' + idx + '">' + opt + "</button>"
          );
        })
        .join("");
      body =
        '<div class="play-qno">문항 ' +
        no +
        " / " +
        quiz.questions.length +
        "</div>" +
        '<div class="play-question heading">' +
        q.question +
        "</div>" +
        '<div class="play-options">' +
        optsHtml +
        "</div>";
    } else if (!revealed) {
      body =
        '<div class="center-screen" style="flex:1;">' +
        '<div class="play-status">제출됐습니다</div>' +
        '<div class="play-team-badge">' +
        teamLabel(myTeam) +
        "</div>" +
        '<div style="color:var(--gray);font-size:15px;">공개를 기다려주세요</div>' +
        "</div>";
    } else {
      var isCorrect = mySelected === q.answerIndex;
      var resultOpts = q.options
        .map(function (opt, idx) {
          var cls = "play-option";
          if (idx === q.answerIndex) cls += " is-correct";
          else if (idx === mySelected) cls += " is-wrong-selected";
          return '<div class="' + cls + '">' + opt + "</div>";
        })
        .join("");
      body =
        '<div class="play-qno">문항 ' +
        no +
        " / " +
        quiz.questions.length +
        "</div>" +
        '<div class="play-result-badge">' +
        (hasAnswered ? (isCorrect ? "정답입니다" : "아쉽네요") : "미제출") +
        "</div>" +
        '<div class="play-options">' +
        resultOpts +
        "</div>";
    }

    app.innerHTML = '<div class="play-wrap">' + headerHtml() + body + "</div>";

    if (!hasAnswered && !revealed) {
      Array.prototype.forEach.call(document.querySelectorAll(".play-option"), function (btn) {
        btn.addEventListener("click", function () {
          Array.prototype.forEach.call(document.querySelectorAll(".play-option"), function (b) {
            b.disabled = true;
            b.classList.add("selected");
          });
          submitAnswer(no, Number(btn.getAttribute("data-idx")));
        });
      });
    }
  }

  function renderEnded() {
    app.innerHTML =
      '<div class="play-wrap">' +
      headerHtml() +
      '<div class="center-screen" style="flex:1;">' +
      '<div class="heading" style="font-size:26px;">퀴즈가 끝났습니다</div>' +
      '<div style="font-size:20px;">최종 ' +
      (myScore || 0) +
      "점</div>" +
      "</div>" +
      "</div>";
  }

  // ---------- boot ----------

  function boot() {
    if (!C.checkAccessKey()) {
      C.showFatalError(app, "잘못된 접근입니다. 올바른 주소(?k=...)로 다시 열어주세요.");
      return;
    }

    C.loadQuizData()
      .then(function (data) {
        quiz = data;
        try {
          db = C.initFirebase();
        } catch (e) {
          C.showFatalError(app, e.message);
          return;
        }

        var teamFromUrl = Number(C.getQueryParam("team"));
        if (teamFromUrl >= 1 && teamFromUrl <= quiz.meta.teamCount) {
          myTeam = teamFromUrl;
          attachTeamListeners();
        }

        C.roomRef(db, "state").on("value", function (snap) {
          state = snap.val() || { phase: "lobby", currentQuestion: 0, revealed: false };
          render();
        });

        render();
      })
      .catch(function (err) {
        C.showFatalError(app, err.message);
      });
  }

  boot();
})();
