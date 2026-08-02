"""Launch all processes required by the Robin server."""

import os
from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess, IncludeLaunchDescription
from launch.launch_description_sources import AnyLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def _default_server_directory():
    """Find server/ in both source and conventional colcon workspace layouts."""
    configured_directory = os.environ.get('ROBIN_SERVER_DIR')
    if configured_directory:
        return configured_directory

    launch_file = Path(__file__).resolve()
    source_candidate = launch_file.parent.parent / 'server'
    if source_candidate.is_dir():
        return str(source_candidate)

    package_share = Path(get_package_share_directory('robin'))
    workspace_root = package_share.parents[3]
    workspace_candidate = workspace_root / 'src' / 'robin' / 'server'
    if workspace_candidate.is_dir():
        return str(workspace_candidate)

    # Keep the resulting launch error explicit: ExecuteProcess reports the
    # missing working directory and users can set server_directory manually.
    return str(source_candidate)


def generate_launch_description():
    server_directory = LaunchConfiguration('server_directory')
    rosbridge_launch = Path(
        get_package_share_directory('rosbridge_server')
    ) / 'launch' / 'rosbridge_websocket_launch.xml'

    return LaunchDescription([
        DeclareLaunchArgument(
            'server_directory',
            default_value=_default_server_directory(),
            description=(
                'Path to Robin server/ (may also be set with ROBIN_SERVER_DIR)'
            ),
        ),
        Node(
            package='robin',
            executable='video_publisher',
            name='video_publisher',
            output='screen',
        ),
        IncludeLaunchDescription(
            AnyLaunchDescriptionSource(str(rosbridge_launch)),
        ),
        ExecuteProcess(
            cmd=['bun', 'run', 'dev'],
            cwd=server_directory,
            output='screen',
        ),
    ])
