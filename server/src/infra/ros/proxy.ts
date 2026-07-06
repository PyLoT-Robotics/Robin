export function createRosProxy() {
  return {
    '/rosbridge': {
      target: process.env.ROSBRIDGE_URL ?? 'ws://localhost:9090',
      ws: true,
      changeOrigin: true,
      rewrite: (requestPath: string) => requestPath.replace(/^\/rosbridge/, ''),
    },
    '/video_publisher': {
      target: process.env.VIDEO_PUBLISHER_URL ?? 'http://localhost:8080',
      changeOrigin: true,
      rewrite: (requestPath: string) => requestPath.replace(/^\/video_publisher/, ''),
    },
  }
}
