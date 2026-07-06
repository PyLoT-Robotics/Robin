# Robin server

ロボット上で動作する HTTPS サーバーです。ルート CA の配布と状態表示に加え、ブラウザから ROS と WebRTC へ安全に接続するためのリバースプロキシを提供します。

通常は単独起動せず、リポジトリ直下の `./setup.sh` と `ros2 launch robin robin.launch.py` を使用します。全体の起動手順は [ルート README](../README.md) を参照してください。

## 提供する経路

| 経路 | 転送先・内容 |
| --- | --- |
| `/` | ロボット IP、接続状態、証明書導入手順を表示 |
| `/rosbridge` | `ws://localhost:9090` へ WebSocket 転送 |
| `/video_publisher` | `http://localhost:8080` へ HTTP 転送 |
| `/rootCA.pem` | mkcert のルート CA |
| `/api/root-ca-qr` | ルート CA URL の QR コード |
| `/api/status` | ロボットの IP 一覧と証明書の状態を JSON で返す |

サーバー自身は HTTPS の `0.0.0.0:5173` で待ち受けます。外部公開を前提としたサーバーではなく、ロボットと操作端末が同じ信頼できる LAN にいる構成を想定しています。

## 初回セットアップ

リポジトリ直下から実行してください。

```bash
source /opt/ros/<distro>/setup.bash
./setup.sh
```

セットアップは `server/` の依存導入、証明書生成、本番ビルドを行い、Bun とサーバーディレクトリの絶対パスを `~/.config/robin/runtime.conf` に保存します。

## 単独での開発起動

```bash
cd server
bun install --frozen-lockfile
bun run create_certificate
bun run dev
```

`bun run create_certificate` は現在の LAN IP、`localhost`、`127.0.0.1`、`::1` を含む証明書を `certs/` に作り、mkcert の `rootCA.pem` を `public/` にコピーします。事前に mkcert のインストールと `mkcert -install` が必要です。

このサーバーだけを起動しても ROS と映像には接続できません。別ターミナルで rosbridge と映像配信ノードを起動してください。

```bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml port:=9090 address:=127.0.0.1
ros2 run robin video_publisher
```

## コマンド

| コマンド | 内容 |
| --- | --- |
| `bun run dev` | QR コードを表示し、HTTPS 開発サーバーを `0.0.0.0:5173` で起動 |
| `bun run build` | ランディングページを `dist/` にビルド |
| `bun run preview` | `dist/` を HTTPS の `0.0.0.0:5173` で配信 |
| `bun run typecheck` | server の TypeScript 型確認 |
| `bun run create_certificate` | LAN IP 用の証明書とルート CA を生成 |
| `bun run show_root_ca` | ルート CA の URL と QR コードを表示 |
| `bun run transfer_root_ca` | 一度ダウンロードされるまで一時 HTTP 配信 |

## 環境変数

| 変数 | 既定値 | 用途 |
| --- | --- | --- |
| `ROBIN_SERVER_HOST` | 自動検出した LAN IPv4 | 表示・証明書生成に使うロボット IP の上書き |
| `ROSBRIDGE_URL` | `ws://localhost:9090` | rosbridge の転送先 |
| `VIDEO_PUBLISHER_URL` | `http://localhost:8080` | WebRTC シグナリングの転送先 |
| `TLS_CERT_PATH` | `server/certs/dev-cert.pem` | HTTPS 証明書ファイル |
| `TLS_KEY_PATH` | `server/certs/dev-key.pem` | HTTPS 秘密鍵ファイル |
| `ROOT_CA_PATH` | `server/public/rootCA.pem` | 一時 CA 配信で使うファイル |
| `ROOT_CA_PORT` | `5174` | 一時 CA 配信の HTTP ポート |

## 状態確認

自己署名証明書をまだ信頼していない端末では、確認時だけ `curl -k` が必要です。

```bash
curl -k https://127.0.0.1:5173/api/status
```

`status: "ok"`、`primaryIp`、`addresses`、`rootCAAvailable` が返ればサーバー部分は起動しています。
