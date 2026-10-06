/**
 * 极简事件总线：控制器只管 emit，展示/音效/节奏/档案各自订阅，互不知道对方存在。
 */
export function createBus() {
  const handlers = new Map()
  return {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set())
      handlers.get(type).add(fn)
      return () => handlers.get(type).delete(fn)
    },
    emit(type, payload) {
      const set = handlers.get(type)
      if (!set) return
      for (const fn of [...set]) fn(payload)
    },
    clear() {
      handlers.clear()
    },
  }
}
