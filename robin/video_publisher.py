import asyncio
from fractions import Fraction
import json
import logging
from aiortc import (
    RTCConfiguration,
    RTCPeerConnection,
    RTCRtpSender,
    RTCSessionDescription,
    VideoStreamTrack,
)
from aiohttp import web
import aiohttp_cors
import cv2
from av import VideoFrame
from aiortc.codecs.vpx import Vp8Encoder
import numpy as np
import time
import threading

IMAGE_SUBSCRIBE_TOPIC_NAME = "/camera/camera/color/image_raw"
VIDEO_PUBLISHER_SUBSCRIBE_TOPIC_NAME = "/robin/video_publisher_subscribe_topic"

def runServer(on_shutdown, offer):
    async def start_server():
        app = web.Application()
        app.on_shutdown.append(on_shutdown)
        app.router.add_post("/offer", offer)

        cors = aiohttp_cors.setup(
            app,
            defaults={
                "*": aiohttp_cors.ResourceOptions(
                    allow_credentials=True,
                    expose_headers="*",
                    allow_headers="*",
                    allow_methods="*"
                )
            }
        )
        for route in list(app.router.routes()):
            cors.add(route)

        runner = web.AppRunner(app)
        await runner.setup()

        site = web.TCPSite(runner, host="0.0.0.0", port=8080)
        await site.start()

        print("Server started at http://0.0.0.0:8080")
        # keep it running
        while True:
            await asyncio.sleep(3600)

    def thread_target():
        asyncio.run(start_server())

    threading.Thread(target=thread_target, daemon=True).start()


logging.basicConfig(level=logging.INFO)
pcs = set()

width = 640
height = 480
frame = np.zeros((height, width, 3), np.uint8) #初期の画像
frame_lock = threading.Lock()
frame_sequence = 0

VIDEO_CLOCK_RATE = 90000
VIDEO_TIME_BASE = Fraction(1, VIDEO_CLOCK_RATE)
LOW_LATENCY_PRIORITY_MAX = 25
LOW_LATENCY_SCALE = 0.25
LOW_LATENCY_FPS = 15
LOW_LATENCY_BITRATE = 60000


def video_profile(video_priority):
    """Return output scale, frame rate, and bitrate for a priority value."""
    priority_ratio = video_priority / 100.0
    regular_scale = 0.375 + (0.625 * priority_ratio)
    regular_fps = 10 + (20 * priority_ratio)
    regular_bitrate = 120000 * (12.5 ** priority_ratio)

    if video_priority > LOW_LATENCY_PRIORITY_MAX:
        return regular_scale, regular_fps, round(regular_bitrate)

    # The latency preset uses fewer pixels and bits than the original linear
    # profile, while a higher frame rate shortens the wait for the next fresh
    # frame. Blend back to the original profile at priority 25.
    blend = video_priority / LOW_LATENCY_PRIORITY_MAX
    boundary_ratio = LOW_LATENCY_PRIORITY_MAX / 100.0
    boundary_scale = 0.375 + (0.625 * boundary_ratio)
    boundary_fps = 10 + (20 * boundary_ratio)
    boundary_bitrate = 120000 * (12.5 ** boundary_ratio)
    output_scale = LOW_LATENCY_SCALE + ((boundary_scale - LOW_LATENCY_SCALE) * blend)
    target_fps = LOW_LATENCY_FPS + ((boundary_fps - LOW_LATENCY_FPS) * blend)
    max_bitrate = LOW_LATENCY_BITRATE * ((boundary_bitrate / LOW_LATENCY_BITRATE) ** blend)
    return output_scale, target_fps, round(max_bitrate)


class CappedVp8Encoder(Vp8Encoder):
    """VP8 encoder whose REMB updates cannot exceed the latency budget."""

    def __init__(self, max_bitrate):
        self.max_bitrate = max_bitrate
        super().__init__()
        self.target_bitrate = max_bitrate

    @property
    def target_bitrate(self):
        return self._Vp8Encoder__target_bitrate

    @target_bitrate.setter
    def target_bitrate(self, bitrate):
        # aiortc normally clamps VP8 to 250 kbps. libvpx supports lower rates,
        # which are necessary to avoid bufferbloat on severely loaded links.
        self._Vp8Encoder__target_bitrate = max(50000, min(bitrate, self.max_bitrate))


class OpenCVCameraStreamTrack(VideoStreamTrack):
    def __init__(self, output_scale, target_fps):
        super().__init__()
        self.last_sent_sequence = -1
        self.output_scale = output_scale
        self.target_fps = target_fps
        self.frame_interval = 1 / self.target_fps
        self.started_at = None
        self.next_frame_at = None

    async def next_frame_timestamp(self):
        now = time.monotonic()
        if self.next_frame_at is None:
            self.started_at = now
            self.next_frame_at = now
        else:
            self.next_frame_at += self.frame_interval
            if self.next_frame_at < now - self.frame_interval:
                self.next_frame_at = now
            await asyncio.sleep(max(0, self.next_frame_at - now))

        # RTP time follows wall time. If congestion stalls one send, jump over
        # the missed interval instead of making the browser play media time
        # which is already in the past.
        timestamp = round((time.monotonic() - self.started_at) * VIDEO_CLOCK_RATE)
        return timestamp, VIDEO_TIME_BASE

    async def recv(self):
        global frame_sequence

        # Pace first, then snapshot the newest frame to avoid sending a frame
        # which aged while waiting for its RTP send slot.
        pts, time_base = await self.next_frame_timestamp()

        # Send a frame only when ROS has delivered a newer image.
        while True:
            with frame_lock:
                has_new_frame = frame_sequence != self.last_sent_sequence
                if has_new_frame:
                    local_frame = frame.copy()
                    self.last_sent_sequence = frame_sequence
                    break
            await asyncio.sleep(0.001)

        if self.output_scale < 1.0:
            output_width = max(2, int(local_frame.shape[1] * self.output_scale) // 2 * 2)
            output_height = max(2, int(local_frame.shape[0] * self.output_scale) // 2 * 2)
            local_frame = cv2.resize(
                local_frame,
                (output_width, output_height),
                interpolation=cv2.INTER_AREA,
            )

        video_frame = VideoFrame.from_ndarray(local_frame, format="rgb24")
        video_frame.pts = pts
        video_frame.time_base = time_base

        return video_frame


async def offer(request):
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])
    try:
        video_priority = min(100, max(0, int(params.get("videoPriority", 0))))
    except (TypeError, ValueError):
        video_priority = 0

    pc = RTCPeerConnection(configuration=RTCConfiguration(iceServers=[]))
    pcs.add(pc)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        if pc.connectionState in ("failed", "closed"):
            await pc.close()
            pcs.discard(pc)

    output_scale, target_fps, max_bitrate = video_profile(video_priority)
    sender = pc.addTrack(OpenCVCameraStreamTrack(output_scale, target_fps))
    # aiortc has no public sender bitrate API. Installing its standard VP8
    # encoder before negotiation avoids the default 1 Mbps startup burst, and
    # this subclass also caps later REMB updates from the receiver.
    sender._RTCRtpSender__encoder = CappedVp8Encoder(max_bitrate)
    if video_priority <= 25:
        async def drop_stale_retransmission(_sequence_number):
            return None

        sender._retransmit = drop_stale_retransmission
    transceiver = next(item for item in pc.getTransceivers() if item.sender is sender)
    vp8_codecs = [
        codec
        for codec in RTCRtpSender.getCapabilities("video").codecs
        if codec.mimeType.lower() == "video/vp8"
    ]
    if vp8_codecs:
        # aiortc configures VP8 for realtime encoding with no frame lookahead.
        transceiver.setCodecPreferences(vp8_codecs)

    logging.info(
        "WebRTC profile: priority=%d, bitrate=%d kbps, fps=%.0f, scale=%.3f",
        video_priority,
        max_bitrate // 1000,
        target_fps,
        output_scale,
    )

    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.Response(
        content_type="application/json",
        text=json.dumps(
            {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
        ),
    )


async def on_shutdown(app):
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()

###

from rclpy.node import Node
from rclpy.qos import (
    DurabilityPolicy,
    HistoryPolicy,
    QoSProfile,
    ReliabilityPolicy,
)
from sensor_msgs.msg import Image
from std_msgs.msg import String
import rclpy
from cv_bridge import CvBridge

class Client(Node):
    def __init__(self):
        super().__init__("client")

        self.current_image_topic = IMAGE_SUBSCRIBE_TOPIC_NAME
        self.image_qos = QoSProfile(
            history=HistoryPolicy.KEEP_LAST,
            depth=1,
            reliability=ReliabilityPolicy.BEST_EFFORT,
            durability=DurabilityPolicy.VOLATILE,
        )
        self.image_subscriber = self.create_subscription(
            Image,
            self.current_image_topic,
            self.update_latest_frame,
            self.image_qos,
        )
        self.topic_subscriber = self.create_subscription(
            String,
            VIDEO_PUBLISHER_SUBSCRIBE_TOPIC_NAME,
            self.update_image_subscribe_topic,
            10,
        )

        self.bridge = CvBridge()
        self.logger = logging.getLogger("Client")

        self.logger.info("Video Publisher Node Initialized")
        self.logger.info(f"Initial image subscribe topic: {self.current_image_topic}")
        threading.Thread(target=runServer, args=(on_shutdown, offer), daemon=True).start()

    def update_image_subscribe_topic(self, msg):
        global IMAGE_SUBSCRIBE_TOPIC_NAME

        new_topic = msg.data.strip()
        if not new_topic:
            self.logger.warning("Received empty topic name. Ignore update.")
            return

        if new_topic == self.current_image_topic:
            return

        old_topic = self.current_image_topic
        self.destroy_subscription(self.image_subscriber)
        self.image_subscriber = self.create_subscription(
            Image,
            new_topic,
            self.update_latest_frame,
            self.image_qos,
        )

        self.current_image_topic = new_topic
        IMAGE_SUBSCRIBE_TOPIC_NAME = new_topic
        self.logger.info(
            f"Switched image subscribe topic: {old_topic} -> {self.current_image_topic}"
        )

    def update_latest_frame(self, msg):
        global frame, frame_sequence

        latest_frame = self.bridge.imgmsg_to_cv2(msg, desired_encoding="rgb8")
        with frame_lock:
            frame = latest_frame
            frame_sequence += 1

def main(args=None):
    rclpy.init(args=args)

    client = Client()
    rclpy.spin(client)

    client.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
