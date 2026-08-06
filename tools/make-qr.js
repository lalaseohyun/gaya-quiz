// 참여 QR 생성. 배포 주소가 고정이라 미리 만들어 커밋합니다.
// 주소가 바뀌면 PLAY_URL 을 고치고 `node tools/make-qr.js` 를 다시 실행하세요.
//
//   npm install --no-save qrcode
//   node tools/make-qr.js
//
// QR은 하나입니다. 참가자가 찍으면 팀 번호를 고르고 대기 화면으로 들어가며,
// 진행자가 문제를 시작하면 자동으로 따라옵니다.
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const PLAY_URL = "https://lalaseohyun.github.io/gaya-quiz/play/?k=gaya2026";
const OUT = path.join(__dirname, "..", "assets", "qr-play.svg");

QRCode.toString(
  PLAY_URL,
  { type: "svg", errorCorrectionLevel: "H", margin: 1, width: 640 },
  (err, svg) => {
    if (err) throw err;
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, svg, "utf8");
    console.log("생성:", OUT);
    console.log("주소:", PLAY_URL);
  }
);
