import { computed, ref } from 'vue'

import {
  readInitialStorageState,
  readLocalStorage,
  writeLocalStorage,
} from '@/infra/storage/localStorageRepository'
import type { LocalStorageKey } from '@/models/storage'

const storageState = ref(readInitialStorageState())

export function getLocalStorageItem(key: LocalStorageKey) {
  return readLocalStorage(key)
}

export function useLocalStorage(key: LocalStorageKey) {
  return computed({
    get: () => storageState.value[key],
    set: (value: string) => {
      storageState.value[key] = value
      writeLocalStorage(key, value)
    },
  })
}
