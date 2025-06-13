# TranscriptCreator

ローカル動画やYouTube動画を文字起こしして、タイムスタンプ付きで日本語に翻訳するアプリケーション

## セットアップ

1. 依存関係をインストール
```bash
npm install
```

2. Gemini APIキーを設定
`.env.example`を`.env`にコピーして、`GEMINI_API_KEY`に実際のAPIキーを設定してください。
```bash
cp .env.example .env
```

Gemini APIキーは以下から取得できます：
https://aistudio.google.com/app/apikey

3. FFmpegをインストール（字幕焼き付け機能に必要）
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Windows
# https://ffmpeg.org/download.html からダウンロードしてPATHに追加
```

4. 開発サーバーを起動
```bash
npm run dev
```

5. ブラウザで http://localhost:3000 を開く

## 機能

- ローカル動画ファイルのアップロード
- YouTube動画URLからの読み込み（現在は未実装）
- Gemini APIを使用した音声文字起こし
- タイムスタンプ付き日本語翻訳
- 簡易動画編集機能（開始・終了時間の選択）
- タイムスタンプをクリックして動画の特定位置にジャンプ
- **字幕焼き付け機能**: 文字起こしした内容を動画に字幕として埋め込み
