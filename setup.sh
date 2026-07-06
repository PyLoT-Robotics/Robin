#!/usr/bin/env bash

set -Eeuo pipefail

REPOSITORY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_PATH="${REPOSITORY_PATH}/server"
CONFIG_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/robin"
CONFIG_FILE="${CONFIG_DIR}/runtime.conf"
PREVIEW_PID=""

confirm() {
    local prompt="$1"
    local reply
    read -r -p "${prompt} [y/N] " reply
    [[ "${reply}" =~ ^[Yy]$ ]]
}

cleanup() {
    if [[ -n "${PREVIEW_PID}" ]] && kill -0 "${PREVIEW_PID}" 2>/dev/null; then
        kill "${PREVIEW_PID}" 2>/dev/null || true
        wait "${PREVIEW_PID}" 2>/dev/null || true
    fi
}

fail() {
    echo "Error: $*" >&2
    exit 1
}

install_apt_packages() {
    local description="$1"
    shift
    if ! confirm "${description}"; then
        echo "Install them later with: sudo apt-get install $*" >&2
        return 1
    fi
    sudo apt-get update
    sudo apt-get install -y "$@"
}

trap cleanup EXIT
trap 'exit 130' INT TERM

[[ -r /etc/os-release ]] || fail "Ubuntu is required."
# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || fail "Ubuntu is required (detected ${PRETTY_NAME:-unknown OS})."

command -v ros2 >/dev/null 2>&1 || fail "ROS 2 is not available. Source /opt/ros/<distro>/setup.bash and rerun ./setup.sh."
[[ -n "${ROS_DISTRO:-}" ]] || fail "ROS 2 is not sourced. Source /opt/ros/<distro>/setup.bash and rerun ./setup.sh."

if ! command -v curl >/dev/null 2>&1; then
    install_apt_packages "curl is required. Install it now?" curl || exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
    if ! confirm "Bun is not installed. Install Bun now?"; then
        fail "Bun is required. Install it from https://bun.sh and rerun ./setup.sh."
    fi
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="${BUN_INSTALL:-${HOME}/.bun}"
    export PATH="${BUN_INSTALL}/bin:${PATH}"
fi

command -v bun >/dev/null 2>&1 || fail "Bun installation completed but bun is not on PATH. Add \$HOME/.bun/bin to PATH and rerun."
BUN_PATH="$(command -v bun)"

if ! command -v mkcert >/dev/null 2>&1; then
    install_apt_packages "mkcert is required for the local HTTPS certificate. Install it now?" mkcert libnss3-tools || exit 1
fi
mkcert -install

if ! ros2 pkg prefix rosbridge_server >/dev/null 2>&1; then
    ROSBRIDGE_PACKAGE="ros-${ROS_DISTRO//_/-}-rosbridge-server"
    install_apt_packages "rosbridge_server is missing. Install ${ROSBRIDGE_PACKAGE} now?" "${ROSBRIDGE_PACKAGE}" || exit 1
fi

if command -v rosdep >/dev/null 2>&1 && ! rosdep check "${REPOSITORY_PATH}" >/dev/null 2>&1; then
    if confirm "Some Robin runtime dependencies are missing. Run rosdep install now?"; then
        rosdep install --from-paths "${REPOSITORY_PATH}" --ignore-src -r -y
    else
        echo "Install them later with:" >&2
        echo "  rosdep install --from-paths '${REPOSITORY_PATH}' --ignore-src -r -y" >&2
        exit 1
    fi
fi

echo "Installing Robin server dependencies..."
cd "${SERVER_PATH}"
"${BUN_PATH}" install --frozen-lockfile

echo "Creating the HTTPS certificate..."
"${BUN_PATH}" run create_certificate

echo "Building the Robin server landing page..."
"${BUN_PATH}" run build

mkdir -p "${CONFIG_DIR}"
{
    printf 'server_dir=%s\n' "${SERVER_PATH}"
    printf 'bun_path=%s\n' "${BUN_PATH}"
} > "${CONFIG_FILE}"
chmod 600 "${CONFIG_FILE}"

echo "Starting a temporary Robin server for root CA installation..."
"${BUN_PATH}" run preview &
PREVIEW_PID=$!

SERVER_READY=false
for _ in {1..40}; do
    if ! kill -0 "${PREVIEW_PID}" 2>/dev/null; then
        wait "${PREVIEW_PID}" || true
        fail "The Robin preview server stopped. Port 5173 may already be in use; review the error above."
    fi
    if curl -kfsS "https://127.0.0.1:5173/api/status" >/dev/null 2>&1; then
        SERVER_READY=true
        break
    fi
    sleep 0.25
done

[[ "${SERVER_READY}" == true ]] || fail "The Robin preview server did not become ready on port 5173."

echo
echo "Open the URL or scan the QR code shown above, then install and fully trust the root CA."
while true; do
    if ! kill -0 "${PREVIEW_PID}" 2>/dev/null; then
        wait "${PREVIEW_PID}" || true
        fail "The Robin preview server stopped before setup completed."
    fi
    if confirm "Has the root CA been transferred and installed?"; then
        break
    fi
    echo "The server is still running. Complete the certificate steps, then confirm again."
done

echo
echo "Robin server setup is complete."
echo "Next, build and source your ROS workspace, then run:"
echo "  ros2 launch robin robin.launch.py"
