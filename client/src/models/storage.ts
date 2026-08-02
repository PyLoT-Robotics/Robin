export type LocalStorageKey =
  | 'CameraTopic'
  | 'LogTopic'
  | 'WebRTCVideoPriority'
  | 'RobinServerURL'

export type LocalStorageState = Record<LocalStorageKey, string>
