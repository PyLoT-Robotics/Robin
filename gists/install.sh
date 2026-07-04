ROBIN_REPOSITORY_PATH="$(cd "$(dirname "$0")/.." && pwd)"

#install bun
curl -fsSL https://bun.com/install | bash

#install mkcert
sudo apt install mkcert
mkcert -install

# ROS bridge server 存在確認
if ros2 pkg prefix rosbridge_server >/dev/null 2>&1; then
    ROSBRIDGE_OK=true
else
    ROSBRIDGE_OK=false
fi

# ROS bridge server の表示
if [ "$ROSBRIDGE_OK" = true ]; then
    echo "✅ ROS bridge server is installed"
else
    echo "❌ ROS bridge server is not installed"
fi

#setup
sh "${ROBIN_REPOSITORY_PATH}/gists/setup.sh"

#show complete message
echo "🎉 Installation complete"

# Show the URL for the root CA hosted by the Robin server.
echo "🔐 Robin server root CA"
sh "${ROBIN_REPOSITORY_PATH}/gists/transferRootCA.sh"
