export type Pose2D = {
  x: number
  y: number
  yaw: number
}

export type TfTransformMessage = {
  header?: {
    frame_id?: string
  }
  child_frame_id?: string
  transform?: {
    translation?: {
      x?: number
      y?: number
    }
    rotation?: {
      x?: number
      y?: number
      z?: number
      w?: number
    }
  }
}

export type TfMessage = {
  transforms?: TfTransformMessage[]
}

export type OccupancyGridMessage = {
  header?: {
    frame_id?: string
  }
  info?: {
    width?: number
    height?: number
    resolution?: number
    origin?: {
      position?: {
        x?: number
        y?: number
      }
      orientation?: {
        x?: number
        y?: number
        z?: number
        w?: number
      }
    }
  }
  data?: ArrayLike<number>
}

export type CostmapData = {
  frameId: string
  width: number
  height: number
  resolution: number
  originX: number
  originY: number
  originYaw: number
  data: ArrayLike<number>
}

export type PathMessage = {
  header?: {
    frame_id?: string
  }
  poses?: Array<{
    pose?: {
      position?: {
        x?: number
        y?: number
      }
    }
  }>
}

export type LaserScanData = {
  angleMin: number
  angleIncrement: number
  rangeMin: number
  rangeMax: number
  frameId: string
  ranges: ArrayLike<number>
}

export type GlobalPathData = {
  frameId: string
  points: Array<{ x: number; y: number }>
}

export type MapFrameData = {
  width: number
  height: number
  data: ArrayLike<number>
}

export type ScreenPoint = {
  x: number
  y: number
}

export type PoseCommandMode = 'initial_pose' | 'nav2_goal'

export type PoseInteractionMode = 'none' | PoseCommandMode

export type UseMapRosOptions = {
  onMapSizeChanged?: () => void
}

export type MapGeometry = {
  width: number
  height: number
  resolution: number
  originX: number
  originY: number
  originYaw: number
}

export type ViewportTransform = {
  translateX: number
  translateY: number
  scale: number
  rotationDeg: number
}
