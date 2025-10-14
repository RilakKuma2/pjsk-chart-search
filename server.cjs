const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4000; // API 서버는 4000번 포트를 사용합니다.

// CORS 설정: 모든 출처에서의 요청을 허용합니다.
app.use(cors());

// '/api/songs' 경로로 요청이 오면 이 함수를 실행합니다.
app.get('/api/songs', (req, res) => {
  // 현재 폴더(__dirname)를 기준으로 'public/data/songs.json' 파일의 절대 경로를 찾습니다.
  const jsonFilePath = path.join(__dirname, 'public', 'data', 'songs.json');

  // 위 경로의 파일을 읽습니다.
  fs.readFile(jsonFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error("songs.json 파일을 읽는 중 오류 발생:", err);
      // 오류가 나면 500 에러와 함께 메시지를 보냅니다.
      return res.status(500).json({ error: '데이터를 읽는데 실패했습니다.' });
    }
    // 성공하면, 읽어온 텍스트(data)를 JSON 형태로 변환하여 응답으로 보냅니다.
    res.json(JSON.parse(data));
  });
});

// 4000번 포트에서 서버를 실행합니다.
app.listen(PORT, () => {
  console.log(`API 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
