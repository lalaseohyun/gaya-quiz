// 참여 QR 생성. 배포 주소가 고정이라 사전에 한 번 만들어 커밋합니다.
// 주소가 바뀌면 URL 상수를 고치고 `node tools/make-qr.js` 를 다시 실행하세요.
//
//   npm install --no-save qrcode
//   node tools/make-qr.js
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
