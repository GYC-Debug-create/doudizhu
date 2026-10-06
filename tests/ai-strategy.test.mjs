import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DoudizhuGame } from '../src/game/rules.js'
import { aiPlay, hintCandidates } from '../src/game/ai.js'
import { cardsFromIds, sortCards } from '../src/game/cards.js'
import { analyze, canBeat, T } from '../src/game/patterns.js'

const SEATS = [
  { id: 'p0', name: '你', isAI: false },
  { id: 'p1', name: 'AI甲', isAI: true },
  { id: 'p2', name: 'AI乙', isAI: true },
]

// id = (rank - 3) * 4 + suit；52/53 为小王/大王
function setHand(g, seat, ids) {
  g.players[seat].cards = sortCards(cardsFromIds(ids))
}

/** 座位 0 当地主，直接进入出牌阶段 */
function landlordGame() {
  const g = new DoudizhuGame(SEATS)
  g.start()
  g.bidCall(0)
  g.robPass(1)
  g.robPass(2)
  g.robPass(0)
  return g
}

test('AI 不会为了压一张小单牌就随手炸弹', () => {
  const g = landlordGame()
  setHand(g, 0, [44, 4, 12, 16, 20, 24, 28, 32, 36]) // 地主 A + 一堆散牌
  setHand(g, 1, [8, 9, 10, 11, 0, 1, 5, 6, 13, 14]) // 5555 炸弹 + 33 44 66（没有比 A 大的单张）
  setHand(g, 2, [40, 41, 42, 2, 3, 7, 15])
  g.play(0, cardsFromIds([44]))
  assert.equal(aiPlay(g, 1), null, '对手牌还多、自己炸完也走不完时应保留炸弹')
})

test('地主报单时，农民会用炸弹顶住', () => {
  const g = landlordGame()
  setHand(g, 0, [44, 4]) // 地主出 A 后只剩 1 张
  setHand(g, 1, [8, 9, 10, 11, 0, 1, 5, 6, 13, 14])
  setHand(g, 2, [40, 41, 42, 2, 3, 7, 15])
  g.play(0, cardsFromIds([44]))
  const move = aiPlay(g, 1)
  assert.ok(move, '应该出牌')
  assert.equal(analyze(move).type, T.BOMB)
})

test('农民不压队友的牌，除非能一把走完', () => {
  const h = landlordGame()
  setHand(h, 0, [4, 12, 20, 28, 36, 40])
  setHand(h, 1, [16, 24, 32])
  setHand(h, 2, [44, 45, 48, 52, 0])
  h.play(0, cardsFromIds([4]))
  h.play(1, cardsFromIds([16]))
  assert.equal(aiPlay(h, 2), null, '队友出的牌应让过')
})

test('领出时对手报单，AI 避免出单张', () => {
  const g = landlordGame()
  setHand(g, 0, [4])
  setHand(g, 1, [0, 1, 20, 36, 40])
  setHand(g, 2, [8, 12, 16, 24, 28, 32])
  // 让农民甲拿到牌权：直接把 current 置空、轮到座位 1
  g.turnSeat = 1
  g.current = null
  const move = aiPlay(g, 1)
  assert.ok(move)
  assert.notEqual(analyze(move).type, T.SOLO, '地主只剩一张时不应领出单张')
})

test('提示候选：首项可出、彼此不重复、全部能压过上家', () => {
  const h = landlordGame()
  setHand(h, 0, [0, 4, 8, 12, 16, 20, 21, 44, 45, 52])
  setHand(h, 1, [24, 25, 30])
  setHand(h, 2, [28, 29, 31])
  h.current = { seat: 2, pattern: analyze(cardsFromIds([16])), cards: cardsFromIds([16]) }
  h.turnSeat = 0
  const list = hintCandidates(h, 0)
  assert.ok(list.length >= 3)
  const keys = new Set(list.map((cards) => cards.map((c) => c.id).sort().join(',')))
  assert.equal(keys.size, list.length, '候选不应重复')
  for (const cards of list) assert.ok(canBeat(h.current.pattern, analyze(cards)), '每个候选都要能压过上家')
})

test('提示候选：领出时包含多种牌型，且无牌可压时返回空', () => {
  const g = landlordGame()
  setHand(g, 0, [0, 1, 4, 8, 12, 16, 20])
  g.turnSeat = 0
  g.current = null
  const leads = hintCandidates(g, 0)
  const types = new Set(leads.map((cards) => analyze(cards).type))
  assert.ok(types.has(T.SOLO) && types.has(T.PAIR) && types.has(T.STRAIGHT))

  g.current = { seat: 1, pattern: analyze(cardsFromIds([52, 53])), cards: cardsFromIds([52, 53]) }
  assert.deepEqual(hintCandidates(g, 0), [])
})
