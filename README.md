# unext-mylist-filter

マイリスト画面において「女優・監督」による絞り込み機能を追加する Chrome 拡張機能です。

## 使用方法
1. データ抽出ツール（`mylist-data-extractor` 等）を実行し、`local_data.json` を生成します。
2. 生成された `local_data.json` を本リポジトリのルートフォルダ直下に配置します。
3. Chromeの拡張機能管理画面（`chrome://extensions`）を開き、「パッケージ化されていない拡張機能を読み込む」から本フォルダを選択して読み込みます。

## ファイル構成
* `manifest.json`: 拡張機能の設定ファイル
* `content.js`: マイリスト画面にフィルターUIを挿入・処理するスクリプト
* `local_data.json`: 各動画とタグID・名前の紐付けデータ（※`.gitignore` によりGit管理対象外推奨）