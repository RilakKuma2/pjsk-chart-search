# 설치 방법

git nvm 설치

```
git clone https://github.com/RilakKuma2/pjsk-chart-search.git
cd pjsk-chart-search

# 최신 LTS 버전 설치
nvm install --lts

# 설치된 LTS 버전을 현재 세션에서 사용하도록 설정
nvm use --lts
```

앞으로 새로운 터미널을 열 때마다 이 버전을 기본으로 사용하도록 설정
```
nvm alias default @현재 lts 버전@
```

```
npm install

npm run build

npm install -g pm2 serve

# 프론트엔드 서버 실행 (3000번 포트)
pm2 start serve -n pjsk-charts-frontend -- -s dist -l 3000

# API 서버 실행 (4000번 포트)
pm2 start server.cjs -n pjsk-charts-api

pm2 save
pm2 startup
```


# 채보 데이터
```
  {
    "id": "001",
    "title_ko": "텔 유어 월드",
    "title_jp": "Tell Your World",
    "unit_code": "VS",
    "release_date": "2020/09/30",
    "bpm": 150,
    "levels": {
      "easy": 5,
      "normal": 10,
      "hard": 16,
      "expert": 22,
      "master": 26,
      "append": 25
    },
    "length": "2:03",
    "mv_type": "3D",
    "composer": "kz",
    "composer_jp": "kz",
    "classification": "기존곡"
  },
```
위 양식 /public/data/songs.json 수정

/var/www/html/cover : jpg 앨범커버
/var/www/html/svg : svg 채보파일 (참조 : https://pypi.org/project/pjsekai.scores/ )
