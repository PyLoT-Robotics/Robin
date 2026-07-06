# Robin client

Vue、Vite、roslib で実装されたブラウザ用の操作画面です。ロボット上の `server/` とは別に配信し、ユーザーが Settings で指定したロボットの IP へ接続します。

通常運用を含むプロジェクト全体の手順は [ルート README](../README.md) を参照してください。

## 開発起動

```bash
cd client
bun install --frozen-lockfile
bun run dev
```

開発サーバーは `http://localhost:5174` で起動します。画面を開いたら Settings の **Robin Server Local IP** に、起動済みの Robin サーバーの IP を入力してください。

初期接続先を環境変数で指定することもできます。

```bash
VITE_ROBIN_SERVER_URL=https://192.168.0.10:5173 bun run dev
```

画面で保存した値はブラウザの Local Storage に入り、環境変数より優先されます。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `bun run dev` | Vite 開発サーバーを `0.0.0.0:5174` で起動 |
| `bun run build` | TypeScript の型確認後、`dist/` に本番ビルド |
| `bun run preview` | 本番ビルドを `0.0.0.0:4174` で確認 |
| `bun run generate-pwa-assets` | PWA アイコンを再生成 |

## 接続の仕組み

Settings に `192.168.0.10` を保存した場合、クライアントは次の URL を使用します。

| 用途 | URL |
| --- | --- |
| ROS | `wss://192.168.0.10:5173/rosbridge` |
| WebRTC シグナリング | `https://192.168.0.10:5173/video_publisher/offer` |
| 証明書・状態確認 | `https://192.168.0.10:5173` |

ROS 接続は切断後に 1 秒から最大 15 秒までの指数バックオフで再接続します。映像は Video Priority の変更時に再ネゴシエーションされます。

## 画面と依存する ROS 機能

- **Live video**: Settings で選んだ `sensor_msgs/msg/Image` トピックを WebRTC で表示
- **Log**: 選んだトピックの型を rosapi で取得し、受信メッセージを表示
- **Map**: map、scan、TF、costmap、global path を表示し、初期姿勢と Nav2 ゴールを送信
- **Controller**: `/joy` へ 30 Hz で入力を送信。横画面で使用可能
- **Arm controller**: `/luna_arm_custom_ik_pose_commander/target_delta` へ操作量を送信
- **Settings**: Camera Topic、Log Topic、映像品質、Robin サーバー IP を保存

## 本番ビルド

```bash
cd client
bun install --frozen-lockfile
bun run build
bun run preview
```

Vercel 用の設定はリポジトリ直下の `vercel.json` にあり、`client/dist` を公開します。

## 接続できない場合

1. `https://<ロボットIP>:5173` をブラウザで直接開けるか確認します。
2. その端末に Robin のルート CA がインストールされ、信頼されているか確認します。
3. Settings の IP にプロトコルやパスではなく、ロボットの LAN IP が保存されているか確認します。
4. サーバー側で rosbridge と `video_publisher` が起動しているか確認します。
