import os
from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import (
    DeclareLaunchArgument,
    EmitEvent,
    ExecuteProcess,
    IncludeLaunchDescription,
    LogInfo,
    OpaqueFunction,
    RegisterEventHandler,
)
from launch.event_handlers import OnProcessExit
from launch.events import Shutdown
from launch.launch_description_sources import AnyLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def _read_runtime_config(config_file):
    values = {}
    path = Path(config_file).expanduser()
    if not path.is_file():
        return values

    for line in path.read_text(encoding='utf-8').splitlines():
        key, separator, value = line.partition('=')
        if separator and key:
            values[key.strip()] = value.strip()
    return values


def _shutdown_when_process_exits(process, label):
    return RegisterEventHandler(
        OnProcessExit(
            target_action=process,
            on_exit=[
                LogInfo(msg=f'{label} stopped; shutting down Robin.'),
                EmitEvent(event=Shutdown(reason=f'{label} stopped')),
            ],
        )
    )


def _create_runtime_actions(context):
    config_file = LaunchConfiguration('runtime_config').perform(context)
    config = _read_runtime_config(config_file)

    server_dir = LaunchConfiguration('server_dir').perform(context).strip()
    bun_path = LaunchConfiguration('bun_path').perform(context).strip()
    if not server_dir:
        server_dir = config.get('server_dir', '')
    if not bun_path:
        bun_path = config.get('bun_path', '')

    if not server_dir or not bun_path:
        raise RuntimeError(
            'Robin server configuration is missing. Run ./setup.sh from the Robin repository, '
            'or pass server_dir:=... and bun_path:=... to ros2 launch.'
        )

    server_path = Path(server_dir).expanduser().resolve()
    bun_executable = Path(bun_path).expanduser().resolve()
    required_files = [
        server_path / 'package.json',
        server_path / 'dist' / 'index.html',
        server_path / 'dist' / 'rootCA.pem',
        server_path / 'certs' / 'dev-cert.pem',
        server_path / 'certs' / 'dev-key.pem',
        server_path / 'node_modules' / 'vite' / 'package.json',
    ]
    missing_files = [str(path) for path in required_files if not path.is_file()]

    if not bun_executable.is_file() or not os.access(bun_executable, os.X_OK):
        raise RuntimeError(
            f'Configured Bun executable is not runnable: {bun_executable}. Rerun ./setup.sh.'
        )
    if missing_files:
        raise RuntimeError(
            'Robin server setup is incomplete. Rerun ./setup.sh. Missing: '
            + ', '.join(missing_files)
        )

    rosbridge_launch_path = Path(
        get_package_share_directory('rosbridge_server')
    ) / 'launch' / 'rosbridge_websocket_launch.xml'

    rosbridge = IncludeLaunchDescription(
        AnyLaunchDescriptionSource(str(rosbridge_launch_path)),
        launch_arguments={
            'port': '9090',
            'address': '127.0.0.1',
        }.items(),
    )
    video_publisher = Node(
        package='robin',
        executable='video_publisher',
        name='video_publisher',
        output='screen',
    )
    web_server = ExecuteProcess(
        cmd=[str(bun_executable), 'run', 'preview'],
        cwd=str(server_path),
        output='screen',
    )

    return [
        rosbridge,
        video_publisher,
        web_server,
        _shutdown_when_process_exits(video_publisher, 'Robin video publisher'),
        _shutdown_when_process_exits(web_server, 'Robin HTTPS server'),
    ]


def generate_launch_description():
    default_config = str(
        Path(os.environ.get('XDG_CONFIG_HOME', Path.home() / '.config'))
        / 'robin'
        / 'runtime.conf'
    )

    return LaunchDescription([
        DeclareLaunchArgument(
            'runtime_config',
            default_value=default_config,
            description='Path to the runtime configuration written by Robin setup.',
        ),
        DeclareLaunchArgument(
            'server_dir',
            default_value=os.environ.get('ROBIN_SERVER_DIR', ''),
            description='Override the Robin server directory.',
        ),
        DeclareLaunchArgument(
            'bun_path',
            default_value=os.environ.get('BUN_EXECUTABLE', ''),
            description='Override the Bun executable path.',
        ),
        OpaqueFunction(function=_create_runtime_actions),
    ])
