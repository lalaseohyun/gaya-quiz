// 진행자 화면 — 큰 버튼 하나(또는 Space)로 처음부터 끝까지 진행합니다.
(function () {
  "use strict";

  var C = window.QuizCommon;
  var stage = document.getElementById("stage");
  var controlbar = document.getElementById("controlbar");
  var offlineBadge = document.getElementById("offline");

  // 배포된 고정 주소. 여기서 열었을 때만 사전 생성한 QR이 유효합니다.
  var PROD_PLAY_URL = "https://lalaseohyun.github.io/gaya-quiz/play/?k=gaya2026";

  var quiz = null;
  var runList = []; // 연습문제 포함 진행 순서
  var db = null;
  var state = C.emptyState();
  var answers = {};
  var joined = {};
  var asked = {};
  var connected = true;
  var menuOpen = false;
  var stageMode = false;
  var ready = false; // 렌더 시작 준비

  function currentQuestion() {
    return runList[state.index] || runList[0];
  }

  function playUrl() {
    var base = location.origin + location.pathname.replace(/host\/?(index\.html)?$/, "play/");
    return base + "?k=" + C.ACCESS_KEY;
  }

  function joinedList() {
    return C.joinedTeams(quiz, joined);
  }

  function answeredTeams(q) {
    if (!q) return [];
    var a = answers[q.id] || {};
    return joinedList().filter(function (no) {
      return a[no] !== undefined;
    });
  }

  // ---------- 진행 동작 ----------

  function openQuestion(i) {
    var q = runList[i];
    if (!q) return;
    var patch = {};
    patch["state/phase"] = "quiz";
    patch["state/index"] = i;
    patch["state/open"] = true;
    patch["state/revealed"] = false;
    patch["state/openedAt"] = firebase.database.ServerValue.TIMESTAMP;
    patch["asked/" + q.id] = true;
    C.roomRef(db).update(patch);
  }

  function revealAnswer() {
    // 공개를 누르는 순간이 곧 마감입니다. 별도의 마감 단계는 없습니다.
    C.roomRef(db, "state").update({ open: false, revealed: true });
  }

  function setPhase(phase) {
    var patch = { phase: phase };
    if (phase === "lobby") {
      patch.open = false;
      patch.revealed = false;
    }
    C.roomRef(db, "state").update(patch);
  }

  function advance() {
    if (state.phase === "lobby") return openQuestion(0);
    if (state.phase === "quiz") {
      if (!state.revealed) return revealAnswer();
      if (state.index < runList.length - 1) return openQuestion(state.index + 1);
      return setPhase("final");
    }
    if (state.phase === "final") return setPhase("outro");
    if (state.phase === "outro") return setPhase("lobby");
  }

  function advanceLabel() {
    if (state.phase === "lobby") return "문제 시작";
    if (state.phase === "quiz") {
      if (!state.revealed) return "정답 공개";
      if (state.index < runList.length - 1) return "다음 문제";
      return "최종 순위";
    }
    if (state.phase === "final") return "마무리";
    return "대기화면으로";
  }

  function resetAll() {
    var pw = window.prompt("관리자 비밀번호를 입력하세요");
    if (pw === null) return;
    if (pw !== C.ADMIN_PASSWORD) {
      window.alert("비밀번호가 올바르지 않습니다.");
      return;
    }
    if (!window.confirm("전체 초기화합니다.\n답변·점수·접속한 팀 목록이 모두 지워집니다.")) return;
    C.roomRef(db).set(C.initialRoomData());
  }

  function toggleFullscreen() {
    // 브라우저가 전체화면을 거부해도 무대 모드 클래스로 부수 UI는 확실히 숨깁니다.
    stageMode = !stageMode;
    document.body.classList.toggle("stage-mode", stageMode);
    try {
      if (stageMode && !document.fullscreenElement) {
        var p = document.documentElement.requestFullscreen();
        if (p && p.catch) p.catch(function () {});
      } else if (!stageMode && document.fullscreenElement) {
        var e = document.exitFullscreen();
        if (e && e.catch) e.catch(function () {});
      }
    } catch (err) {
      /* 무대 모드만으로도 동작합니다 */
    }
    render();
  }

  // ---------- 렌더 ----------

  function render() {
    if (!ready) return;
    renderStage();
    renderControlbar();
    offlineBadge.classList.toggle("hidden", connected);
  }

  function chipCols() {
    var n = quiz.meta.teamCount;
    return n <= 5 ? n : Math.ceil(n / 2);
  }

  function teamStripHtml(mode) {
    var q = currentQuestion();
    var a = (q && answers[q.id]) || {};
    var cells = quiz.teams
      .map(function (t) {
        var isJoined = joined[t.no] !== undefined && joined[t.no] !== null;
        var ans = a[t.no];
        var cls = "chip";
        var mark = "";
        if (mode === "ox" && isJoined) {
          if (ans === undefined) {
            cls += " ox-x";
            mark = "–";
          } else if (ans.choice === q.answerIndex) {
            cls += " ox-o";
            mark = "O";
          } else {
            cls += " ox-x";
            mark = "X";
          }
        } else {
          if (isJoined) cls += " joined";
          if (ans !== undefined) cls += " answered";
        }
        return (
          '<div class="' +
          cls +
          '"><span>' +
          C.escapeHtml(t.label) +
          '</span><span class="chip-mark">' +
          mark +
          "</span></div>"
        );
      })
      .join("");
    return (
      '<div class="team-strip" style="--chip-cols:' + chipCols() + '">' + cells + "</div>"
    );
  }

  function renderStage() {
    if (state.phase === "lobby") return renderLobby();
    if (state.phase === "final") return renderFinal();
    if (state.phase === "outro") return renderOutro();
    if (state.revealed) return renderReveal();
    return renderQuiz();
  }

  function renderLobby() {
    var url = playUrl();
    var qrOk = url === PROD_PLAY_URL;
    var qrHtml = qrOk
      ? '<div class="lobby-qr"><img src="../assets/qr-play.svg" alt="참여 QR 코드" /></div>'
      : '<div class="lobby-qr" style="background:var(--panel);color:var(--muted);font-size:15px;padding:24px;text-align:center;line-height:1.6;">지금 이 주소는 배포 주소가 아니라서<br />QR을 띄우지 않습니다.<br /><br /><b style="color:var(--cream);word-break:break-all;">' +
        C.escapeHtml(url) +
        "</b></div>";

    stage.innerHTML =
      '<div class="lobby">' +
      qrHtml +
      '<div class="lobby-side">' +
      '<div class="lobby-kicker">' +
      C.escapeHtml(quiz.meta.event) +
      "</div>" +
      '<h1 class="lobby-title">' +
      C.escapeHtml(quiz.meta.title) +
      "</h1>" +
      '<p class="lobby-howto">휴대폰으로 QR을 찍고 <b>우리 테이블 번호</b>를 누르세요.<br />팀당 한 대만 있으면 됩니다.</p>' +
      teamStripHtml("join") +
      "</div>" +
      "</div>";
  }

  function renderQuiz() {
    var q = currentQuestion();
    var jl = joinedList();
    var ans = answeredTeams(q);
    var isPractice = q.scored === false;

    var choicesHtml = q.choices
      .map(function (c, i) {
        return (
          '<div class="choice"><div class="choice-mark">' +
          "①②③④⑤".charAt(i) +
          '</div><div class="choice-text">' +
          C.escapeHtml(c) +
          "</div></div>"
        );
      })
      .join("");

    stage.innerHTML =
      '<div class="quiz">' +
      '<div class="qhead"><span class="qbadge">' +
      (isPractice ? "연습문제" : "문제 " + q.no + " / " + quiz.questions.length) +
      "</span></div>" +
      '<h1 class="qtext">' +
      C.escapeHtml(q.question) +
      "</h1>" +
      '<div class="choices">' +
      choicesHtml +
      "</div>" +
      '<div class="submit-line">제출 <b>' +
      ans.length +
      "</b> / " +
      jl.length +
      "팀</div>" +
      teamStripHtml("join") +
      "</div>";
  }

  function renderReveal() {
    var q = currentQuestion();
    var a = answers[q.id] || {};
    var jl = joinedList();

    var counts = q.choices.map(function (_, i) {
      return jl.filter(function (no) {
        return a[no] && a[no].choice === i;
      }).length;
    });

    var leftHtml = q.choices
      .map(function (c, i) {
        return (
          '<div class="rchoice' +
          (i === q.answerIndex ? " is-answer" : "") +
          '"><span class="rchoice-mark">' +
          "①②③④⑤".charAt(i) +
          '</span><span class="rchoice-text">' +
          C.escapeHtml(c) +
          '</span><span class="rchoice-count">' +
          counts[i] +
          "팀</span></div>"
        );
      })
      .join("");

    var sentences = C.splitSentences(q.explanation)
      .map(function (s) {
        return "<p>" + C.escapeHtml(s) + "</p>";
      })
      .join("");

    stage.innerHTML =
      '<div class="reveal">' +
      '<div class="reveal-left">' +
      leftHtml +
      '<div class="reveal-teams">' +
      teamStripHtml("ox") +
      "</div>" +
      "</div>" +
      '<div class="reveal-right">' +
      '<div class="answer-card"><div class="answer-kicker">정답</div><div class="answer-text">' +
      C.escapeHtml(q.answerLabel || q.choices[q.answerIndex]) +
      "</div></div>" +
      '<div class="note-card"><div class="note-highlight">' +
      C.escapeHtml(q.highlight) +
      '</div><div class="note-body" id="note-body">' +
      sentences +
      "</div></div>" +
      "</div>" +
      "</div>";

    // 카드 안에 안 들어가면 글자 크기를 줄여서라도 잘리지 않게 합니다.
    requestAnimationFrame(function () {
      C.fitToBox(document.getElementById("note-body"), 26, 12);
    });
  }

  function renderFinal() {
    var rows = C.computeStandings(quiz, answers, joined);
    if (rows.length === 0) {
      stage.innerHTML =
        '<div class="final"><h1 class="final-title">최종 순위</h1><div class="final-empty">참여한 팀이 없습니다</div></div>';
      return;
    }
    var total = C.scoredCount(quiz);
    var cards = rows
      .map(function (r) {
        return (
          '<div class="rank-card' +
          (r.rank === 1 ? " top" : "") +
          '"><div class="rank-id"><span class="rank-no">' +
          r.rank +
          '위</span><span class="rank-team">' +
          C.escapeHtml(r.label) +
          '</span></div><div class="rank-result"><span class="rank-of">' +
          total +
          '문항 중</span><span class="rank-score">' +
          r.correctCount +
          "<small>개</small></span></div></div>"
        );
      })
      .join("");
    stage.innerHTML =
      '<div class="final"><h1 class="final-title">최종 순위</h1><div class="rank-grid">' +
      cards +
      "</div></div>";
  }

  function renderOutro() {
    var lines = (quiz.outro.lines || [])
      .map(function (l) {
        return '<div class="outro-line">' + C.escapeHtml(l) + "</div>";
      })
      .join("");
    stage.innerHTML =
      '<div class="outro"><h1 class="outro-title">' +
      C.escapeHtml(quiz.outro.title) +
      '</h1><div class="outro-lines">' +
      lines +
      "</div></div>";
  }

  function renderControlbar() {
    var q = currentQuestion();
    var jl = joinedList();
    var ans = answeredTeams(q);
    var allIn =
      state.phase === "quiz" && !state.revealed && jl.length > 0 && ans.length === jl.length;

    var progress =
      state.phase === "quiz"
        ? (q.scored === false ? "연습" : q.no + " / " + quiz.questions.length)
        : state.phase === "lobby"
        ? "대기"
        : state.phase === "final"
        ? "순위"
        : "마무리";

    var options = runList
      .map(function (item, i) {
        return (
          '<option value="' +
          i +
          '"' +
          (i === state.index ? " selected" : "") +
          ">" +
          (item.scored === false ? "연습문제" : item.no + "번") +
          ". " +
          C.escapeHtml(item.question.slice(0, 18)) +
          "</option>"
        );
      })
      .join("");

    controlbar.innerHTML =
      '<div class="badges">' +
      '<span class="badge badge-progress">' +
      progress +
      "</span>" +
      '<span class="badge ' +
      (connected ? "live" : "down") +
      '">' +
      (connected ? "접속 " + jl.length + "팀" : "연결 끊김") +
      "</span>" +
      "</div>" +
      '<div class="spacer"></div>' +
      '<select class="qselect" id="qselect">' +
      options +
      "</select>" +
      '<button class="btn btn-fs" id="btn-fs">' +
      (stageMode ? "무대 모드 끄기" : "전체화면") +
      "</button>" +
      '<div class="more-wrap">' +
      '<button class="btn" id="btn-more">더보기</button>' +
      (menuOpen
        ? '<div class="more-menu" id="more-menu">' +
          '<button id="m-lobby">대기화면으로</button>' +
          '<button id="m-final">최종 순위 보기</button>' +
          '<button id="m-reset">전체 초기화</button>' +
          "</div>"
        : "") +
      "</div>" +
      '<button class="btn-go btn' +
      (allIn ? " ready" : "") +
      '" id="btn-go">' +
      advanceLabel() +
      "</button>";

    document.getElementById("btn-go").addEventListener("click", advance);
    document.getElementById("btn-fs").addEventListener("click", toggleFullscreen);
    document.getElementById("btn-more").addEventListener("click", function (e) {
      e.stopPropagation();
      menuOpen = !menuOpen;
      render();
    });
    if (menuOpen) {
      document.getElementById("m-lobby").addEventListener("click", function () {
        menuOpen = false;
        setPhase("lobby");
      });
      document.getElementById("m-final").addEventListener("click", function () {
        menuOpen = false;
        setPhase("final");
      });
      document.getElementById("m-reset").addEventListener("click", function () {
        menuOpen = false;
        resetAll();
      });
    }

    var sel = document.getElementById("qselect");
    sel.addEventListener("change", function () {
      // 새로고침 시 브라우저가 이전 값을 복원하며 change를 잘못 쏘는 경우가 있어,
      // 현재 인덱스와 같으면 무시합니다.
      var next = Number(sel.value);
      if (next === state.index) return;
      openQuestion(next);
    });
  }

  // ---------- 부팅 ----------

  function boot() {
    if (!C.checkAccessKey()) {
      C.showFatalError(stage, "잘못된 접근입니다. 올바른 주소(?k=...)로 다시 열어주세요.");
      return;
    }

    C.loadQuizData()
      .then(function (data) {
        quiz = data;
        runList = C.buildRunList(quiz);
        try {
          db = C.initFirebase();
        } catch (e) {
          C.showFatalError(stage, e.message);
          return;
        }

        C.roomRef(db, "state").once("value", function (snap) {
          if (!snap.exists()) C.roomRef(db).set(C.initialRoomData());
        });

        db.ref(".info/connected").on("value", function (snap) {
          connected = snap.val() === true;
          render();
        });
        C.roomRef(db, "state").on("value", function (snap) {
          state = snap.val() || C.emptyState();
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
        C.roomRef(db, "asked").on("value", function (snap) {
          asked = snap.val() || {};
          render();
        });

        document.addEventListener("keydown", function (e) {
          if (e.code !== "Space") return;
          var tag = (e.target.tagName || "").toLowerCase();
          if (tag === "select" || tag === "input" || tag === "textarea") return;
          e.preventDefault();
          advance();
        });

        document.addEventListener("click", function () {
          if (menuOpen) {
            menuOpen = false;
            render();
          }
        });

        window.addEventListener("resize", function () {
          if (state.revealed) render();
        });
      })
      .catch(function (err) {
        C.showFatalError(stage, err.message);
      });
  }

  boot();
})();
