import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DoudizhuGame, PHASE } from '../src/game/rules.js'
import { aiBid, aiRob, aiPlay, assessHand, evalHand } from '../src/game/ai.js'
import { cardsFromIds } from '../src/game/cards.js'
import { analyze, canBeat } from '../src/game/patterns.js'

const SEATS = [
  { id: 'p0', name: 'AI甲', isAI: true },
  { id: 'p1', name: 'AI乙', isAI: true },
  { id: 'p2', name: 'AI丙', isAI: true },
]

/** mulberry32 种子随机，保证可复现 */
function seededRng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 跑一整局（含重发），逐手校验 AI 落法合法；返回是否打完 */
function runGame(seed) {
  const g = new DoudizhuGame(SEATS, { randomSeed: seededRng(seed) })
  g.start()

  // 重发上限：避免极端种子下无限重发
  for (let deal = 0; deal < 20; deal++) {
    // ---- 叫/抢地主 ----
    let guard = 0
    while (g.phase === PHASE.BID) {
      if (++guard > 30) throw new Error('叫地主阶段死循环')
      if (g.candidate === null) {
        const seat = g.bidTurn
        if (aiBid(g, seat)) g.bidCall(seat)
        else g.bidPass(seat)
      } else {
        const seat = g.robTurn
        if (g.canRob(seat) && aiRob(g, seat)) g.robCall(seat)
        else g.robPass(seat)
      }
      if (g.overReason === 'no-bid') break
    }
    if (g.overReason === 'no-bid') {
      g.start() // 无人叫 → 重发
      continue
    }

    // ---- 出牌 ----
    guard = 0
    while (g.phase === PHASE.PLAY) {
      if (++guard > 400) throw new Error('出牌阶段死循环')
      const seat = g.turnSeat
      const must = g.mustPlay(seat)
      const cards = aiPlay(g, seat)
      if (cards && cards.length) {
        const p = analyze(cards)
        assert.ok(p, `AI 出牌不成牌型: seat=${seat}`)
        assert.ok(canBeat(g.current && g.current.pattern, p), `AI 出牌压不过台面: seat=${seat}`)
        const handIds = new Set(g.players[seat].cards.map((c) => c.id))
        for (const c of cards) assert.ok(handIds.has(c.id), 'AI 出了不在手牌的牌')
        g.play(seat, cards)
      } else {
        assert.ok(!must, `轮到必须出牌时 AI 却过牌: seat=${seat}`)
        g.pass(seat)
      }
    }

    // ---- 终局校验 ----
    assert.equal(g.overReason, 'finished')
    const winner = g.winnerSeats[0]
    assert.equal(g.players[winner].cards.length, 0, '赢家手牌应为空')
    const total = g.players.reduce((s, p) => s + p.cards.length, 0)
    assert.equal(total, 54 - g.history.filter((h) => !h.pass).reduce((s, h) => s + h.cards.length, 0), '牌数守恒')
    assert.equal(g.settle.reduce((s, x) => s + x.delta, 0), 0, '结算总和应为 0')
    return true
  }
  return false
}

test('evalHand：王/2/炸弹计分', () => {
  const hand = [
    { rank: 17 },
    { rank: 15 },
    { rank: 15 },
    { rank: 8 },
    { rank: 9 },
    { rank: 10 },
    { rank: 11 },
  ]
  assert.equal(evalHand(hand), 6 + 2 + 2)
})

test('牌力评估：组合与控制牌影响叫抢，弱牌不会盲目抢', () => {
  const low = cardsFromIds([0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 1, 5, 9, 13, 17])
  const strong = cardsFromIds([0, 1, 2, 3, 48, 49, 52, 53, 32, 33, 34, 35, 16, 17, 20, 21, 24])
  const weakGame = { players: [{ cards: low }], bidMul: 1 }
  const strongGame = { players: [{ cards: strong }], bidMul: 1 }
  assert.ok(assessHand(strong) > assessHand(low))
  assert.equal(aiBid(weakGame, 0), false)
  assert.equal(aiRob(weakGame, 0), false)
  assert.equal(aiBid(strongGame, 0), true)
  assert.equal(aiRob(strongGame, 0), true)
})

test('AI 模拟：100 局随机对局全部合法终局且结算守恒', () => {
  let finished = 0
  for (let seed = 1; seed <= 100; seed++) {
    if (runGame(seed)) finished++
  }
  // 无人叫会重发；绝大多数局应能打到出牌阶段
  assert.ok(finished >= 80, `完成对局过少: ${finished}/100`)
})

test('AI 模拟：领出必有解（任意非空手牌）', () => {
  // 直接穷举：随机生成手牌，mustPlay 状态下 aiPlay 不得返回 null
  for (let seed = 1; seed <= 200; seed++) {
    const g = new DoudizhuGame(SEATS, { randomSeed: seededRng(seed) })
    g.start()
    g.bidCall(0)
    g.robPass(1)
    g.robPass(2)
    g.robPass(0)
    for (const p of g.players) {
      if (!p.cards.length) continue
      const cards = aiPlay(g, p.seat)
      // 领出场景下任何非空手牌都必须有解
      assert.ok(cards && cards.length > 0, `seat=${p.seat} 领出无解`)
    }
  }
})
