import asyncio
import json
import logging
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, VideoStreamTrack
from aiohttp import web
import aiohttp_cors
import cv2
from av import VideoFrame
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

class OpenCVCameraStreamTrack(VideoStreamTrack):
    def __init__(self):
        super().__init__()
        self.last_sent_sequence = -1

    async def recv(self):
        global frame_sequence

        # Send a frame only when ROS has delivered a newer image.
        while True:
            with frame_lock:
                has_new_frame = frame_sequence != self.last_sent_sequence
                if has_new_frame:
                    local_frame = frame.copy()
                    self.last_sent_sequence = frame_sequence
                    break
            await asyncio.sleep(0.01)

        pts, time_base = await self.next_timestamp()

        video_frame = VideoFrame.from_ndarray(local_frame, format="rgb24")
        video_frame.pts = pts
        video_frame.time_base = time_base

        return video_frame


async def offer(request):
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    pc = RTCPeerConnection(configuration=RTCConfiguration(iceServers=[]))
    pcs.add(pc)

    pc.addTrack(OpenCVCameraStreamTrack())

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
from rclpy.qos import qos_profile_sensor_data
from sensor_msgs.msg import Image
from std_msgs.msg import String
import rclpy
from cv_bridge import CvBridge

class Client(Node):
    def __init__(self):
        super().__init__("client")

        self.current_image_topic = IMAGE_SUBSCRIBE_TOPIC_NAME
        self.image_subscriber = self.create_subscription(
            Image,
            self.current_image_topic,
            self.update_latest_frame,
            qos_profile_sensor_data,
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
            qos_profile_sensor_data,
        )

        self.current_image_topic = new_topic
        IMAGE_SUBSCRIBE_TOPIC_NAME = new_topic
        self.logger.info(
            f"Switched image subscribe topic: {old_topic} -> {self.current_image_topic}"
        )

    def update_latest_frame(self, msg):
        global frame, frame_sequence

        with frame_lock:
            frame = self.bridge.imgmsg_to_cv2(msg, desired_encoding="rgb8")
            frame_sequence += 1

def main(args=None):
    rclpy.init(args=args)

    client = Client()
    rclpy.spin(client)

    client.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
