// 가야면 실시간 퀴즈 — 공통 로직 (host.js / play.js / results.js 에서 공용으로 사용)
(function (global) {
  "use strict";

  var ROOM_ID = "gaya2026";
  var ACCESS_KEY = "gaya2026";
  var ADMIN_PASSWORD = "gaya2026admin";
  var DATA_PATH = "../data/gaya-quiz-2026.json";

  function getQueryParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function checkAccessKey() {
    return getQueryParam("k") === ACCESS_KEY;
  }

  function loadQuizData() {
    return fetch(DATA_PATH).then(function (res) {
      if (!res.ok) throw new Error("퀴즈 데이터를 불러오지 못했습니다 (" + res.status + ")");
      return res.json();
    });
  }

  function initFirebase() {
    if (!global.FIREBASE_CONFIG || global.FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
      throw new Error("js/firebase-config.js 에 Firebase 프로젝트 설정을 채워주세요.");
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(global.FIREBASE_CONFIG);
    }
    return firebase.database();
  }

  function roomRef(db, path) {
    var base = "rooms/" + ROOM_ID;
    return db.ref(path ? base + "/" + path : base);
  }

  function teamNumbers(teamCount) {
    var arr = [];
    for (var i = 1; i <= teamCount; i++) arr.push(i);
    return arr;
  }

  function showFatalError(container, message) {
    container.innerHTML =
      '<div class="center-screen"><div class="err-box heading" style="font-size:28px;">' +
      message +
      "</div></div>";
  }

  global.QuizCommon = {
    ROOM_ID: ROOM_ID,
    ACCESS_KEY: ACCESS_KEY,
    ADMIN_PASSWORD: ADMIN_PASSWORD,
    getQueryParam: getQueryParam,
    checkAccessKey: checkAccessKey,
    loadQuizData: loadQuizData,
    initFirebase: initFirebase,
    roomRef: roomRef,
    teamNumbers: teamNumbers,
    showFatalError: showFatalError
  };
})(window);
