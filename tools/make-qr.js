// 참여 QR 생성. 배포 주소가 고정이라 미리 만들어 커밋합니다.
// 주소가 바뀌면 BASE 를 고치고 `node tools/make-qr.js` 를 다시 실행하세요.
//
//   npm install --no-save qrcode
//   node tools/make-qr.js
//
// 만들어지는 것
//   assets/qr-play.svg    공용 (접속 후 팀을 직접 고름) — 진행자 대기화면에 표시
//   assets/qr-team-N.svg  팀별 (해당 팀으로 바로 입장) — 테이블마다 인쇄해 두는 용도
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const BASE = "https://lalaseohyun.github.io/gaya-quiz/play/?k=gaya2026";
const OUT_DIR = path.join(__dirname, "..", "assets");
const quiz = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "gaya-quiz-2026.json"), "utf8")
);

const opts = { type: "svg", errorCorrectionLevel: "H", margin: 1, width: 640 };

function write(name, url) {
  return QRCode.toString(url, opts).then((svg) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, name), svg, "utf8");
    console.log(name.padEnd(18), url);
  });
}

const jobs = [write("qr-play.svg", BASE)].concat(
  quiz.teams.map((t) => write("qr-team-" + t.no + ".svg", BASE + "&team=" + t.no))
);

Promise.all(jobs).then(() => console.log("\n완료 — " + (jobs.length) + "개"));
