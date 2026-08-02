export type ThreeQuaternionLike = {
  setFromEuler: (euler: unknown) => ThreeQuaternionLike
  setFromAxisAngle: (axis: unknown, angle: number) => ThreeQuaternionLike
  multiply: (quaternion: ThreeQuaternionLike) => ThreeQuaternionLike
  clone: () => ThreeQuaternionLike
  invert: () => ThreeQuaternionLike
}

export type ThreeCameraLike = {
  aspect: number
  position: { set: (x: number, y: number, z: number) => void }
  up: { set: (x: number, y: number, z: number) => void }
  lookAt: (x: number, y: number, z: number) => void
  updateProjectionMatrix: () => void
}

export type ThreeRendererLike = {
  domElement: HTMLCanvasElement
  setPixelRatio: (ratio: number) => void
  setSize: (width: number, height: number) => void
  render: (scene: unknown, camera: unknown) => void
  dispose: () => void
}

export type ThreeSceneLike = {
  background: unknown
  add: (object: unknown) => void
}
