export type Point2 = { x: number; y: number }

export type Vector3 = { x: number; y: number; z: number }

export type Quaternion = { x: number; y: number; z: number; w: number }

export type CameraIntrinsics = {
  fx: number
  fy: number
  cx: number
  cy: number
}

export type StagCameraPose = {
  /** Camera position in marker coordinates, in metres. */
  position: Vector3
  /** Camera orientation in marker coordinates. */
  orientation: Quaternion
  /** XYZ intrinsic angles in radians. */
  euler: { roll: number; pitch: number; yaw: number }
  /** Unit vector pointing out through the phone camera, in marker coordinates. */
  viewingDirection: Vector3
}

export type StagDetection = {
  id: number
  /** Canonical marker corners: top-left, top-right, bottom-right, bottom-left. */
  corners: [Point2, Point2, Point2, Point2]
  hammingDistance: number
  pose?: StagCameraPose
}

export type DetectOptions = {
  markerSizeMeters?: number
  intrinsics?: CameraIntrinsics
  horizontalFovDegrees?: number
  maxHammingDistance?: number
  minimumMarkerPixels?: number
}

