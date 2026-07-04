<img
  alt="Robin Logo"
  src="client/public/OGP.png"/>

# Robin

[PyLoT Robotics](https://pylot.kaijo-physics.club)で制作しているロボットのデバッグ用コントローラーです。

# 構成

- `client/`: Vercel で配信する Vue/Vite クライアントのみ
- `server/`: ROS 2 側で動かす HTTPS Vite サーバー
  - `/rosbridge` → `ws://localhost:9090`
  - `/video_publisher` → `http://localhost:8080`
  - `/rootCA.pem` とサーバー案内ページ

# セットアップ
このREADMEを内包しているフォルダで、
```bash
sh gists/install.sh
```
を実行すればあとは指示に従えばいいです

# 証明書のインストール
スマホから ROS 側の HTTPS サーバーへ接続するには、ローカル CA のインストールが必要です。
```bash
sh gists/transferRootCA.sh
```
で表示された QR コードにアクセスすると、サーバーが配信する `rootCA.pem` をダウンロードできます。

## iPhoneの場合
https://zenn.dev/takumiabe21/articles/645a38c0c18389 の「○iPhoneのSafariからHTTPS接続する。」以降を参考にインストールしてください。

## Androidの場合
また今度書きます、、

# ROS 側を起動する
```bash
#Topicの送受信に必要なRosbrdige_serverの起動
sh src/robin/gists/start_rosbridge.sh

#<このREADMEを内包しているフォルダ>/../.. (すなわち、installやlog, srcを含んでいるフォルダ)で以下のコマンドを実行

#Video Publisherの起動
colcon build
source install/setup.bash
ros2 run robin video_publisher

#Robinサーバーの起動（プロキシ、root CA、案内ページ）
sh src/robin/gists/start_server.sh
```

# クライアントを開く

通常は [https://robin.pylot-robotics.org](https://robin.pylot-robotics.org) を開き、Settings で
ROS 側のローカル IP アドレスを指定します（接続先 port は 5173）。

ローカルでクライアントを開発する場合のみ以下を実行します（port 5174）。

```bash
sh src/robin/gists/start_client.sh
```

# 特定TopicをLeRobot形式で保存する
以下で任意のTopicを購読し、LeRobot形式の最小構成で保存できます。
```bash
source install/setup.bash
ros2 run robin lerobot_recorder --ros-args \
  -p topic_name:=/joint_states \
  -p output_dir:=./lerobot_dataset \
  -p task_name:=teleop \
  -p episode_index:=0
```

設定受信用Topic（既定: `/lerobot_recorder/config`）を変える場合は以下です。

```bash
ros2 run robin lerobot_recorder --ros-args \
  -p control_topic_name:=/my/lerobot/config
```

Topic型が自動検出できない場合は、`message_type` を明示してください。

```bash
ros2 run robin lerobot_recorder --ros-args \
  -p topic_name:=/my_topic \
  -p message_type:=std_msgs/msg/String
```

実行中に、保存対象Topic一覧を `std_msgs/String` で送ると購読対象を切り替えできます。

JSON配列を送る例:

```bash
ros2 topic pub --once /lerobot_recorder/config std_msgs/msg/String \
  "{data: '[\"/joint_states\",\"/imu/data\"]'}"
```

カンマ区切り文字列でも送れます:

```bash
ros2 topic pub --once /lerobot_recorder/config std_msgs/msg/String \
  "{data: '/joint_states,/imu/data'}"
```

保存先を実行中に変える場合は、JSONオブジェクトで `output_dir` を渡します。

```bash
ros2 topic pub --once /lerobot_recorder/config std_msgs/msg/String \
  "{data: '{\"topics\":[\"/joint_states\"],\"output_dir\":\"./lerobot_dataset/session2\"}'}"
```

出力先には以下が生成されます。
- `meta/info.json`
- `meta/tasks.jsonl`
- `meta/episodes.jsonl`
- `data/chunk-000/episode_000000.parquet`
