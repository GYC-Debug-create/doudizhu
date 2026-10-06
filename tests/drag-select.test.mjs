import test from 'node:test'
import assert from 'node:assert/strict'
import { createDragController } from '../src/ui/drag-select.js'

/** 4 张牌横向排列：中心 x = 50/150/250/350，纵向 100-160。 */
const RECTS = [0, 1, 2, 3].map((i) => ({
  left: i * 100,
  right: i * 100 + 100,
  top: 100,
  bottom: 160,
}))
const CARDS = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
const point = (x, y) => ({ type: 'mousedown', button: 0, clientX: x, clientY: y })
const touch = (x, y) => ({ type: 'touchstart', touches: [{ clientX: x, clientY: y }] })

function makeController({ selected = [], interactive = true } = {}) {
  const state = { selection: [...selected], setCalls: 0 }
  const drag = createDragController({
    getCards: () => CARDS,
    getSelection: () => state.selection,
    setSelection: (ids) => {
      state.setCalls += 1
      state.selection = ids
    },
    clearHints: () => {
      state.hintsCleared = (state.hintsCleared || 0) + 1
    },
    isInteractive: () => interactive,
    cacheRects: () => RECTS,
    selector: '.hand-card',
  })
  return { drag, state }
}

test('滑选：从第 1 张拖到第 3 张，区间加入已选', () => {
  const { drag, state } = makeController()
  drag.start(point(50, 130), 0)
  drag.move(point(250, 130))
  drag.end(point(250, 130))
  assert.deepEqual(state.selection, ['a', 'b', 'c'])
})

test('滑选：已选状态下起点牌触发 remove 模式，拖过区间被移除', () => {
  const { drag, state } = makeController({ selected: ['a', 'b', 'c'] })
  drag.start(point(50, 130), 0)
  assert.equal(drag.shouldIgnoreTap(), false)
  drag.move(point(250, 130))
  drag.end(point(250, 130))
  assert.deepEqual(state.selection, [])
})

test('拖拽结束后的首次 tap 被吞掉，且只吞一次', () => {
  const { drag } = makeController()
  drag.start(point(50, 130), 0)
  drag.move(point(150, 130))
  drag.end(point(150, 130))
  assert.equal(drag.shouldIgnoreTap(), true)
  assert.equal(drag.shouldIgnoreTap(), false)
})

test('位移不足 8px 不算拖拽，tap 不被吞', () => {
  const { drag, state } = makeController()
  drag.start(point(50, 130), 0)
  drag.move(point(54, 130))
  drag.end(point(54, 130))
  assert.deepEqual(state.selection, [])
  assert.equal(drag.shouldIgnoreTap(), false)
})

test('未轮到本家时拒绝滑选', () => {
  const { drag, state } = makeController({ interactive: false })
  drag.start(point(50, 130), 0)
  drag.move(point(250, 130))
  drag.end(point(250, 130))
  assert.deepEqual(state.selection, [])
})

test('纵向越界的点不命中任何牌，选区保持不变', () => {
  const { drag, state } = makeController({ selected: ['a'] })
  drag.start(point(50, 130), 0)
  drag.move(point(250, 400))
  drag.end(point(250, 400))
  assert.deepEqual(state.selection, ['a'])
})

test('touch 事件与鼠标事件走同一命中逻辑', () => {
  const { drag, state } = makeController()
  drag.start(touch(250, 130), 2)
  drag.move({ type: 'touchmove', touches: [{ clientX: 350, clientY: 130 }] })
  drag.end({ type: 'touchend', changedTouches: [{ clientX: 350, clientY: 130 }] })
  assert.deepEqual(state.selection, ['c', 'd'])
})

test('起始即标记滑选状态，end 后复位', () => {
  const { drag } = makeController()
  drag.start(point(50, 130), 0)
  assert.equal(drag.selecting, true)
  drag.end(point(50, 130))
  assert.equal(drag.selecting, false)
})
