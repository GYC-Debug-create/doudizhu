/**
 * 手牌滑选状态机 —— 斗地主 / 掼蛋两套手牌区共用。
 *
 * 覆盖原有页面里两份完全平行的实现（dragSelecting* / guandanSelecting*）：
 *  - 点选：tap 由外部调用 toggle()，拖拽结束后的 260ms 内 tap 被吞掉防误触
 *  - 滑选：start 后位移超过 8px 进入拖选，按矩形命中把区间内牌加入/移出
 *  - 命中：优先 H5 document rect 缓存，小程序端走 uni.createSelectorQuery
 *
 * 纯 JS 工厂，无 Vue 依赖；rect 缓存与选择写回都通过回调注入，可在 Node 单测。
 */
const DRAG_THRESHOLD = 8
const TAP_GRACE = 260
const EDGE_PAD = 24
// rect 缓存刷新的最小指针位移：拖选时不必每个 move 都全量查询（小程序端查询是异步回调，rAF 节流无效）
const RECT_CACHE_STEP = 16

function touchPoint(event) {
  if (event && (event.clientX !== undefined || event.pageX !== undefined)) {
    return { x: Number(event.clientX ?? event.pageX ?? 0), y: Number(event.clientY ?? event.pageY ?? 0) }
  }
  const touch = event && event.touches && event.touches.length
    ? event.touches[0]
    : event && event.changedTouches && event.changedTouches.length
      ? event.changedTouches[0]
      : null
  if (touch) {
    return { x: Number(touch.clientX ?? touch.pageX ?? 0), y: Number(touch.clientY ?? touch.pageY ?? 0) }
  }
  if (event && event.detail && (event.detail.x !== undefined || event.detail.y !== undefined)) {
    return { x: Number(event.detail.x || 0), y: Number(event.detail.y || 0) }
  }
  return null
}

export function createDragController(options) {
  const {
    getCards,        // () => 当前手牌数组（渲染顺序）
    getSelection,    // () => 已选 id 数组
    setSelection,    // (ids: string[]) => void
    clearHints,      // () => void  开始新的滑选时清掉提示高亮
    isInteractive,   // () => boolean  未轮到本家时拒绝滑选
    cacheRects,      // (selector: string) => void  把元素 rect 刷进内部缓存
    selector,        // 手牌元素选择器，例如 '.hand-card'
  } = options

  const state = {
    selecting: false,
    dragMoved: false,
    startIndex: null,
    lastIndex: null,
    startX: 0,
    startY: 0,
    mode: 'add',
    baseIds: [],
    rects: [],
    cacheAnchor: null,
    ignoreNextTap: false,
    tapTimer: null,
  }

  function cardIndexAt(x, y) {
    const rects = state.rects
    if (!rects.length) return -1
    const top = Math.min(...rects.map((rect) => rect.top)) - EDGE_PAD
    const bottom = Math.max(...rects.map((rect) => rect.bottom)) + EDGE_PAD
    if (y < top || y > bottom) return -1
    let nearest = 0
    let distance = Number.POSITIVE_INFINITY
    rects.forEach((rect, index) => {
      const center = (rect.left + rect.right) / 2
      const nextDistance = Math.abs(x - center)
      if (nextDistance < distance) {
        distance = nextDistance
        nearest = index
      }
    })
    return nearest
  }

  function applyRange(index) {
    if (!state.selecting || index < 0 || index === state.lastIndex) return
    const cards = getCards()
    const start = Math.min(state.startIndex, index)
    const end = Math.max(state.startIndex, index)
    const selected = new Set(state.baseIds)
    for (let cursor = start; cursor <= end; cursor++) {
      const card = cards[cursor]
      if (!card) continue
      if (state.mode === 'remove') selected.delete(card.id)
      else selected.add(card.id)
    }
    setSelection(cards.filter((card) => selected.has(card.id)).map((card) => card.id))
    state.lastIndex = index
  }

  function refreshRects(point, { force = false } = {}) {
    if (!force && state.cacheAnchor && point) {
      const drift = Math.hypot(point.x - state.cacheAnchor.x, point.y - state.cacheAnchor.y)
      if (drift < RECT_CACHE_STEP) return
    }
    if (typeof cacheRects === 'function') state.rects = cacheRects(selector) || []
    state.cacheAnchor = point ? { x: point.x, y: point.y } : null
  }

  return {
    touchPoint,
    refreshRects,
    get selecting() {
      return state.selecting
    },

    start(event, index) {
      if (event && event.type === 'mousedown' && event.button !== 0) return
      if (!isInteractive()) return
      const point = touchPoint(event)
      if (!point) return
      const card = getCards()[index]
      if (typeof clearHints === 'function') clearHints()
      state.selecting = true
      state.dragMoved = false
      state.startIndex = index
      state.lastIndex = index
      state.startX = point.x
      state.startY = point.y
      state.mode = card && getSelection().includes(card.id) ? 'remove' : 'add'
      state.baseIds = getSelection().slice()
      refreshRects(point, { force: true })
    },

    move(event) {
      if (!state.selecting) return
      const point = touchPoint(event)
      if (!point) return
      const distance = Math.hypot(point.x - state.startX, point.y - state.startY)
      if (distance < DRAG_THRESHOLD) return
      state.dragMoved = true
      refreshRects(point)
      applyRange(cardIndexAt(point.x, point.y))
    },

    end(event) {
      if (!state.selecting) return
      if (state.dragMoved) {
        const point = touchPoint(event)
        if (point) {
          refreshRects(point, { force: true })
          applyRange(cardIndexAt(point.x, point.y))
        }
        state.ignoreNextTap = true
        if (state.tapTimer) clearTimeout(state.tapTimer)
        state.tapTimer = setTimeout(() => {
          state.ignoreNextTap = false
          state.tapTimer = null
        }, TAP_GRACE)
      }
      state.selecting = false
      state.startIndex = null
      state.lastIndex = null
    },

    shouldIgnoreTap() {
      if (!state.ignoreNextTap) return false
      state.ignoreNextTap = false
      return true
    },

    reset() {
      if (state.tapTimer) clearTimeout(state.tapTimer)
      state.selecting = false
      state.dragMoved = false
      state.startIndex = null
      state.lastIndex = null
      state.baseIds = []
      state.rects = []
      state.cacheAnchor = null
      state.ignoreNextTap = false
      state.tapTimer = null
    },
  }
}

/** H5 端 rect 缓存实现（document 命中），小程序端由组件另行注入。 */
export function cacheRectsFromDocument(selector) {
  if (typeof document === 'undefined' || !document.querySelectorAll) return []
  return Array.from(document.querySelectorAll(selector)).map((element) => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
  })
}

/** 小程序端 rect 缓存实现（uni 原生查询），回调式结果同步进内部缓存。 */
export function cacheRectsFromUni(selector) {
  if (typeof uni === 'undefined' || !uni.createSelectorQuery) return []
  let result = []
  uni.createSelectorQuery().selectAll(selector).boundingClientRect((rects) => {
    result = rects || []
  }).exec()
  return result
}
