import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyze, canBeat, T } from '../src/game/patterns.js'

// 构造牌：只关心 rank
const r = (rank) => ({ rank })
const R = (n, rank) => Array.from({ length: n }, () => r(rank))

test('单张/对子/三张', () => {
  assert.deepEqual(analyze([r(7)]), { type: T.SOLO, rank: 7, length: 1 })
  assert.deepEqual(analyze(R(2, 9)), { type: T.PAIR, rank: 9, length: 1 })
  assert.deepEqual(analyze(R(3, 3)), { type: T.TRIPLE, rank: 3, length: 1 })
})

test('三带一/三带二', () => {
  assert.deepEqual(analyze([...R(3, 8), r(13)]), { type: T.TRIPLE_SOLO, rank: 8, length: 1 })
  assert.deepEqual(analyze([...R(3, 8), ...R(2, 13)]), { type: T.TRIPLE_PAIR, rank: 8, length: 1 })
})

test('顺子', () => {
  assert.deepEqual(analyze([3, 4, 5, 6, 7].map(r)), { type: T.STRAIGHT, rank: 3, length: 5 })
  assert.deepEqual(analyze([10, 11, 12, 13, 14].map(r)), { type: T.STRAIGHT, rank: 10, length: 5 }) // 10-J-Q-K-A
  assert.equal(analyze([3, 4, 5, 6].map(r)), null) // 不够 5 张
  assert.equal(analyze([12, 13, 14, 15, 16].map(r)), null) // 含 2 和王
  assert.equal(analyze([3, 4, 5, 6, 8].map(r)), null) // 不连续
  assert.equal(analyze([3, 3, 4, 5, 6].map(r)), null) // 有对子
})

test('连对', () => {
  assert.deepEqual(analyze([...R(2, 5), ...R(2, 6), ...R(2, 7)]), { type: T.STRAIGHT_PAIR, rank: 5, length: 3 })
  assert.equal(analyze([...R(2, 5), ...R(2, 6)]), null) // 2 对不够
  assert.equal(analyze([...R(2, 14), ...R(2, 15), ...R(2, 16)]), null) // 含 2 和王
})

test('飞机', () => {
  assert.deepEqual(analyze([...R(3, 3), ...R(3, 4)]), { type: T.PLANE, rank: 3, length: 2 })
  assert.deepEqual(analyze([...R(3, 3), ...R(3, 4), r(8), r(10)]), { type: T.PLANE_SOLO, rank: 3, length: 2 })
  assert.deepEqual(analyze([...R(3, 3), ...R(3, 4), ...R(2, 8), ...R(2, 10)]), { type: T.PLANE_PAIR, rank: 3, length: 2 })
  assert.equal(analyze([...R(3, 3), ...R(3, 4), r(8)]), null) // 7 张不成型
  assert.deepEqual(analyze([...R(3, 13), ...R(3, 14)]), { type: T.PLANE, rank: 13, length: 2 }) // K-A
  assert.equal(analyze([...R(3, 14), ...R(3, 15)]), null) // A-2 含 2 非法
})

test('炸弹与王炸', () => {
  assert.deepEqual(analyze(R(4, 12)), { type: T.BOMB, rank: 12, length: 1 })
  assert.deepEqual(analyze([r(16), r(17)]), { type: T.ROCKET, rank: 17, length: 1 })
  assert.equal(analyze([...R(3, 12), r(9), r(10)]), null) // 三张12+两散张，不成型
})

test('非法组合', () => {
  assert.equal(analyze([r(3), r(5)]), null) // 不同 rank 两张
  assert.equal(analyze([r(3), r(5), r(9)]), null)
})

test('canBeat 比较', () => {
  const solo7 = { type: T.SOLO, rank: 7, length: 1 }
  const solo8 = { type: T.SOLO, rank: 8, length: 1 }
  const pair7 = { type: T.PAIR, rank: 7, length: 1 }
  assert.equal(canBeat(null, solo7), true)
  assert.equal(canBeat(solo7, solo8), true)
  assert.equal(canBeat(solo8, solo7), false)
  assert.equal(canBeat(solo7, pair7), false) // 类型不同

  const bomb7 = { type: T.BOMB, rank: 7, length: 1 }
  const bomb9 = { type: T.BOMB, rank: 9, length: 1 }
  assert.equal(canBeat(solo8, bomb7), true) // 炸弹压单
  assert.equal(canBeat(bomb7, bomb9), true)
  assert.equal(canBeat(bomb9, bomb7), false)

  const rocket = { type: T.ROCKET, rank: 17, length: 1 }
  assert.equal(canBeat(bomb9, rocket), true) // 王炸压炸弹
  assert.equal(canBeat(rocket, bomb9), false)

  const stra5 = { type: T.STRAIGHT, rank: 3, length: 5 }
  const stra5b = { type: T.STRAIGHT, rank: 6, length: 5 }
  const stra6 = { type: T.STRAIGHT, rank: 3, length: 6 }
  assert.equal(canBeat(stra5, stra5b), true)
  assert.equal(canBeat(stra5b, stra5), false)
  assert.equal(canBeat(stra5, stra6), false) // 长度不同

  const tso = { type: T.TRIPLE_SOLO, rank: 5, length: 1 }
  const tso2 = { type: T.TRIPLE_SOLO, rank: 9, length: 1 }
  assert.equal(canBeat(tso, tso2), true)
  assert.equal(canBeat(tso, { type: T.TRIPLE, rank: 9, length: 1 }), false)
})
