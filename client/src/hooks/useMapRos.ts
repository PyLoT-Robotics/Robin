import { createAction, createTopic } from '@/infra/ros/rosClient'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { quaternionToYaw, yawToQuaternion } from '@/models/map/math'
import { normalizeFrameId, resolveTransform, setTransform } from '@/models/map/transformGraph'
import type { Action, Topic } from '@/models/ros'
import { ros } from './useRosConnection'
import type {
  CostmapData,
  GlobalPathData,
  LaserScanData,
  MapFrameData,
  OccupancyGridMessage,
  PathMessage,
  Pose2D,
  PoseCommandMode,
  TfMessage,
  UseMapRosOptions,
} from '@/models/map/types'

const mapTopic = '/map'
const scanTopic = '/scan'
const tfTopic = '/tf'
const tfStaticTopic = '/tf_static'
const initialPoseTopic = '/initialpose'
const nav2GoalDefaultActionServer = '/navigate_to_pose'
const nav2GoalDefaultActionType = 'nav2_msgs/action/NavigateToPose'
const globalCostmapTopics = ['/move_base/global_costmap/costmap', '/global_costmap/costmap']
const localCostmapTopics = ['/move_base/local_costmap/costmap', '/local_costmap/costmap']
const globalPathTopics = [
  '/plan',
  '/global_plan',
  '/move_base/NavfnROS/plan',
  '/move_base/GlobalPlanner/plan',
]
const robotBaseFrameCandidates = ['base_link', 'base_footprint', 'base_chassis', 'base_stabilized']

function toSafeDimension(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  const normalized = Math.floor(value)
  return normalized > 0 ? normalized : null
}

function parseActionTypeFromFeedbackType(feedbackType: string) {
  const suffix = '_FeedbackMessage'
  if (!feedbackType.endsWith(suffix)) {
    return null
  }
  return feedbackType.slice(0, -suffix.length)
}

export function useMapRos(options: UseMapRosOptions = {}) {
  const currentMapFrame = ref<MapFrameData | null>(null)
  const latestScan = ref<LaserScanData | null>(null)
  const latestGlobalCostmap = ref<CostmapData | null>(null)
  const latestLocalCostmap = ref<CostmapData | null>(null)
  const latestGlobalPath = ref<GlobalPathData | null>(null)

  const tfTransforms = new Map<string, Pose2D>()
  const tfVersion = ref(0)

  const mapWidth = ref(0)
  const mapHeight = ref(0)
  const mapResolution = ref(0.05)
  const mapOriginX = ref(0)
  const mapOriginY = ref(0)
  const mapOriginYaw = ref(0)
  const mapFrameId = ref('map')

  let mapSubscriber: Topic | null = null
  let scanSubscriber: Topic | null = null
  let tfSubscriber: Topic | null = null
  let tfStaticSubscriber: Topic | null = null
  let globalCostmapSubscriber: Topic | null = null
  let localCostmapSubscriber: Topic | null = null
  let globalPathSubscriber: Topic | null = null
  let initialPosePublisher: Topic | null = null
  let nav2Action: Action | null = null
  let nav2ResolvedActionServer = nav2GoalDefaultActionServer
  let nav2ResolvedActionType = nav2GoalDefaultActionType

  const robotPoseInMap = computed(() => {
    void tfVersion.value
    for (const frameId of robotBaseFrameCandidates) {
      const pose = resolveTransform(tfTransforms, mapFrameId.value, frameId)
      if (pose) {
        return pose
      }
    }
    return null
  })

  function resolveTopicType(topicName: string) {
    return new Promise<string>((resolve) => {
      ros.getTopicType(topicName, (topicType) => {
        resolve(topicType && topicType.length > 0 ? topicType : 'std_msgs/String')
      })
    })
  }

  function resolveExistingTopicType(topicName: string) {
    return new Promise<string | null>((resolve) => {
      ros.getTopicType(topicName, (topicType) => {
        if (topicType && topicType.length > 0) {
          resolve(topicType)
          return
        }
        resolve(null)
      })
    })
  }

  function updateTfTransforms(message: unknown) {
    const msg = message as TfMessage
    if (!msg.transforms || !Array.isArray(msg.transforms)) {
      return
    }

    for (const transform of msg.transforms) {
      const translation = transform.transform?.translation
      const x = typeof translation?.x === 'number' ? translation.x : 0
      const y = typeof translation?.y === 'number' ? translation.y : 0
      const yaw = quaternionToYaw(transform.transform?.rotation)
      setTransform(tfTransforms, transform.header?.frame_id, transform.child_frame_id, {
        x,
        y,
        yaw,
      })
    }
    tfVersion.value += 1
  }

  function ensureInitialPosePublisher() {
    if (initialPosePublisher) {
      return initialPosePublisher
    }

    initialPosePublisher = createTopic(
      ros,
      initialPoseTopic,
      'geometry_msgs/PoseWithCovarianceStamped',
    )
    return initialPosePublisher
  }

  function publishInitialPose(position: { x: number; y: number }, yaw: number) {
    const publisher = ensureInitialPosePublisher()
    const quaternion = yawToQuaternion(yaw)
    const covariance = Array(36).fill(0)
    covariance[0] = 0.25
    covariance[7] = 0.25
    covariance[35] = 0.06853891945200942

    publisher.publish({
      header: {
        frame_id: mapFrameId.value,
      },
      pose: {
        pose: {
          position: {
            x: position.x,
            y: position.y,
            z: 0,
          },
          orientation: quaternion,
        },
        covariance,
      },
    })
  }

  function ensureNav2ActionClient() {
    if (nav2Action) {
      return nav2Action
    }

    nav2Action = createAction(ros, nav2ResolvedActionServer, nav2ResolvedActionType)
    return nav2Action
  }

  async function resolveNav2ActionConfig() {
    const candidateNames = [nav2GoalDefaultActionServer, '/bt_navigator/navigate_to_pose']

    for (const actionName of candidateNames) {
      const feedbackType = await resolveExistingTopicType(`${actionName}/_action/feedback`)
      if (!feedbackType) {
        continue
      }

      const resolvedType = parseActionTypeFromFeedbackType(feedbackType)
      if (!resolvedType) {
        continue
      }

      nav2ResolvedActionServer = actionName
      nav2ResolvedActionType = resolvedType
      nav2Action = null
      console.info('Resolved Nav2 action endpoint:', {
        action: nav2ResolvedActionServer,
        actionType: nav2ResolvedActionType,
      })
      return
    }

    nav2ResolvedActionServer = nav2GoalDefaultActionServer
    nav2ResolvedActionType = nav2GoalDefaultActionType
  }

  function sendNav2Goal(position: { x: number; y: number }, yaw: number) {
    const quaternion = yawToQuaternion(yaw)

    const goalPayload = {
      pose: {
        header: {
          frame_id: mapFrameId.value,
        },
        pose: {
          position: {
            x: position.x,
            y: position.y,
            z: 0,
          },
          orientation: quaternion,
        },
      },
      behavior_tree: '',
    }

    const fallbackTypes = Array.from(
      new Set([
        nav2ResolvedActionType,
        'nav2_msgs/action/NavigateToPose',
        'nav2_msgs/NavigateToPose',
      ]),
    )

    const sendWithType = (attempt: number) => {
      const actionType = fallbackTypes[attempt]
      if (!actionType) {
        console.error('Nav2 goal failed: no compatible action type found', {
          action: nav2ResolvedActionServer,
          attemptedTypes: fallbackTypes,
          goal: goalPayload,
        })
        return
      }

      nav2ResolvedActionType = actionType
      nav2Action = null
      const action = ensureNav2ActionClient()

      action.sendGoal(
        goalPayload,
        (result) => {
          console.info('Nav2 goal finished', result)
        },
        (feedback) => {
          console.debug('Nav2 goal feedback', feedback)
        },
        (error) => {
          console.error('Nav2 goal attempt failed', {
            error,
            action: nav2ResolvedActionServer,
            actionType,
            goal: goalPayload,
          })
          sendWithType(attempt + 1)
        },
      )

      console.info('Nav2 goal sent', {
        action: nav2ResolvedActionServer,
        actionType,
        goal: goalPayload,
      })
    }

    sendWithType(0)
  }

  function sendPoseCommand(mode: PoseCommandMode, position: { x: number; y: number }, yaw: number) {
    if (mode === 'initial_pose') {
      publishInitialPose(position, yaw)
      return
    }
    sendNav2Goal(position, yaw)
  }

  function parseCostmapMessage(message: unknown) {
    const msg = message as OccupancyGridMessage
    const width = toSafeDimension(msg.info?.width)
    const height = toSafeDimension(msg.info?.height)
    const resolution = msg.info?.resolution

    if (
      !width ||
      !height ||
      typeof resolution !== 'number' ||
      !Number.isFinite(resolution) ||
      resolution <= 0 ||
      !msg.data
    ) {
      return null
    }

    const originX = msg.info?.origin?.position?.x
    const originY = msg.info?.origin?.position?.y
    return {
      frameId: normalizeFrameId(msg.header?.frame_id) || mapFrameId.value,
      width,
      height,
      resolution,
      originX: typeof originX === 'number' && Number.isFinite(originX) ? originX : 0,
      originY: typeof originY === 'number' && Number.isFinite(originY) ? originY : 0,
      originYaw: quaternionToYaw(msg.info?.origin?.orientation),
      data: msg.data,
    } as CostmapData
  }

  function parsePathMessage(message: unknown) {
    const msg = message as PathMessage
    if (!Array.isArray(msg.poses)) {
      return null
    }

    const points: Array<{ x: number; y: number }> = []
    for (const poseStamped of msg.poses) {
      const x = poseStamped?.pose?.position?.x
      const y = poseStamped?.pose?.position?.y
      if (
        typeof x !== 'number' ||
        !Number.isFinite(x) ||
        typeof y !== 'number' ||
        !Number.isFinite(y)
      ) {
        continue
      }
      points.push({ x, y })
    }

    return {
      frameId: normalizeFrameId(msg.header?.frame_id) || mapFrameId.value,
      points,
    }
  }

  async function subscribeFirstAvailableTopic(
    topics: string[],
    onMessage: (message: unknown) => void,
  ) {
    for (const topicName of topics) {
      const topicType = await resolveExistingTopicType(topicName)
      if (!topicType) {
        continue
      }

      const topic = createTopic(ros, topicName, topicType)
      topic.subscribe(onMessage)
      return topic
    }

    return null
  }

  onMounted(async () => {
    try {
      const topicType = await resolveTopicType(mapTopic)
      mapSubscriber = createTopic(ros, mapTopic, topicType)

      mapSubscriber.subscribe((message) => {
        const msg = message as {
          header?: {
            frame_id?: string
          }
          width?: number
          height?: number
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

        const width = toSafeDimension(msg.width ?? msg.info?.width)
        const height = toSafeDimension(msg.height ?? msg.info?.height)
        const resolution = msg.info?.resolution
        if (typeof resolution === 'number' && Number.isFinite(resolution) && resolution > 0) {
          mapResolution.value = resolution
        }
        const frameId = normalizeFrameId(msg.header?.frame_id)
        if (frameId) {
          mapFrameId.value = frameId
        }
        const originX = msg.info?.origin?.position?.x
        const originY = msg.info?.origin?.position?.y
        if (typeof originX === 'number' && Number.isFinite(originX)) {
          mapOriginX.value = originX
        }
        if (typeof originY === 'number' && Number.isFinite(originY)) {
          mapOriginY.value = originY
        }
        mapOriginYaw.value = quaternionToYaw(msg.info?.origin?.orientation)
        if (!width || !height || !msg.data) {
          return
        }

        const mapSizeChanged = width !== mapWidth.value || height !== mapHeight.value
        mapWidth.value = width
        mapHeight.value = height
        currentMapFrame.value = { width, height, data: msg.data }
        if (mapSizeChanged) {
          options.onMapSizeChanged?.()
        }
      })

      try {
        const scanTopicType = await resolveTopicType(scanTopic)
        scanSubscriber = createTopic(ros, scanTopic, scanTopicType)
        scanSubscriber.subscribe((message) => {
          const msg = message as {
            header?: {
              frame_id?: string
            }
            angle_min?: number
            angle_increment?: number
            range_min?: number
            range_max?: number
            ranges?: ArrayLike<number>
          }

          if (
            typeof msg.angle_min !== 'number' ||
            typeof msg.angle_increment !== 'number' ||
            typeof msg.range_min !== 'number' ||
            typeof msg.range_max !== 'number' ||
            !msg.ranges
          ) {
            return
          }

          latestScan.value = {
            angleMin: msg.angle_min,
            angleIncrement: msg.angle_increment,
            rangeMin: msg.range_min,
            rangeMax: msg.range_max,
            frameId: normalizeFrameId(msg.header?.frame_id) || 'base_scan',
            ranges: msg.ranges,
          }
        })
      } catch (scanError) {
        console.warn('Failed to subscribe /scan topic:', scanError)
      }

      try {
        globalCostmapSubscriber = await subscribeFirstAvailableTopic(
          globalCostmapTopics,
          (message) => {
            const parsed = parseCostmapMessage(message)
            if (!parsed) {
              return
            }
            latestGlobalCostmap.value = parsed
          },
        )
        if (!globalCostmapSubscriber) {
          console.warn('Global costmap topic was not found.')
        }
      } catch (globalCostmapError) {
        console.warn('Failed to subscribe global costmap topic:', globalCostmapError)
      }

      try {
        localCostmapSubscriber = await subscribeFirstAvailableTopic(
          localCostmapTopics,
          (message) => {
            const parsed = parseCostmapMessage(message)
            if (!parsed) {
              return
            }
            latestLocalCostmap.value = parsed
          },
        )
        if (!localCostmapSubscriber) {
          console.warn('Local costmap topic was not found.')
        }
      } catch (localCostmapError) {
        console.warn('Failed to subscribe local costmap topic:', localCostmapError)
      }

      try {
        globalPathSubscriber = await subscribeFirstAvailableTopic(globalPathTopics, (message) => {
          const parsed = parsePathMessage(message)
          if (!parsed) {
            return
          }
          latestGlobalPath.value = parsed
        })
        if (!globalPathSubscriber) {
          console.warn('Global planner path topic was not found.')
        }
      } catch (globalPathError) {
        console.warn('Failed to subscribe global planner path topic:', globalPathError)
      }

      try {
        const tfTopicType = await resolveTopicType(tfTopic)
        tfSubscriber = createTopic(ros, tfTopic, tfTopicType)
        tfSubscriber.subscribe(updateTfTransforms)
      } catch (tfError) {
        console.warn('Failed to subscribe /tf topic:', tfError)
      }

      try {
        const tfStaticTopicType = await resolveTopicType(tfStaticTopic)
        tfStaticSubscriber = createTopic(ros, tfStaticTopic, tfStaticTopicType)
        tfStaticSubscriber.subscribe(updateTfTransforms)
      } catch (tfStaticError) {
        console.warn('Failed to subscribe /tf_static topic:', tfStaticError)
      }

      try {
        await resolveNav2ActionConfig()
      } catch (nav2ResolveError) {
        console.warn('Failed to resolve Nav2 action endpoint, using defaults.', nav2ResolveError)
      }
    } catch (error) {
      throw new Error(`Failed to subscribe: ${String(error)}`)
    }
  })

  onBeforeUnmount(() => {
    mapSubscriber?.unsubscribe()
    mapSubscriber = null
    scanSubscriber?.unsubscribe()
    scanSubscriber = null
    globalCostmapSubscriber?.unsubscribe()
    globalCostmapSubscriber = null
    localCostmapSubscriber?.unsubscribe()
    localCostmapSubscriber = null
    globalPathSubscriber?.unsubscribe()
    globalPathSubscriber = null
    tfSubscriber?.unsubscribe()
    tfSubscriber = null
    tfStaticSubscriber?.unsubscribe()
    tfStaticSubscriber = null

    currentMapFrame.value = null
    latestScan.value = null
    latestGlobalCostmap.value = null
    latestLocalCostmap.value = null
    latestGlobalPath.value = null
    tfTransforms.clear()
  })

  return {
    currentMapFrame,
    latestScan,
    latestGlobalCostmap,
    latestLocalCostmap,
    latestGlobalPath,
    tfTransforms,
    tfVersion,
    mapWidth,
    mapHeight,
    mapResolution,
    mapOriginX,
    mapOriginY,
    mapOriginYaw,
    mapFrameId,
    robotPoseInMap,
    sendPoseCommand,
  }
}
