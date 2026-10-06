import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DoudizhuGame, GAME_MODES, PHASE } from '../src/game/rules.js'
import { GuandanGame, GD_PHASE, createDoubleDeck } from '../src/game/guandan/rules.js'
import {
  analyzeGuandan,
  canBeatGuandan,
  guandanCardValue,
  GT as GD_T,
} from '../src/game/guandan/patterns.js'
import { aiGuandanPlay, aiGuandanHint } from '../src/game/guandan/ai.js'
import { cardsFromIds, makeCard, sortCards } from '../src/game/cards.js'
import { countRanks, T } from '../src/game/patterns.js'

const SEATS = [
  { id: 'p0', name: '玩家' },
  { id: 'p1', name: 'AI甲', isAI: true },
  { id: 'p2', name: 'AI乙', isAI: true },
]

const GD_SEATS = [
  { id: 'p0', name: '玩家' },
  { id: 'p1', name: 'AI左', isAI: true },
  { id: 'p2', name: '队友', isAI: true },
  { id: 'p3', name: 'AI右', isAI: true },
]

function newGame(opts = {}) {
  const g = new DoudizhuGame(SEATS, opts)
  g.start()
  return g
}

/** 构造一手确定的手牌（覆盖随机发牌），ids 为 id 数组，共 count 张 */
function setHand(g, seat, ids) {
  g.players[seat].cards = sortCards(cardsFromIds(ids))
}

function newGuandan(opts = {}) {
  const g = new GuandanGame(GD_SEATS, opts)
  g.start()
  return g
}

test('掼蛋发牌：双副牌 108 张、四家各 27 张', () => {
  const g = newGuandan({ randomSeed: () => 0.29 })
  const all = [...g.players.flatMap((player) => player.cards)]
  assert.equal(createDoubleDeck().length, 108)
  assert.equal(all.length, 108)
  assert.equal(new Set(all.map((card) => card.id)).size, 108)
  assert.deepEqual(g.players.map((player) => player.cards.length), [27, 27, 27, 27])
  const firstSeat = g.players.find((player) => player.cards.some((card) => card.rank === 3 && card.suit === 0)).seat
  assert.equal(g.turnSeat, firstSeat)
  const snapshot = g.snapshot(0)
  assert.ok(Array.isArray(snapshot.players[0].cards))
  assert.equal(snapshot.players[1].cards, null)
  assert.equal(snapshot.bottom, undefined)
  assert.equal(snapshot.phase, GD_PHASE.PLAY)
})

test('掼蛋牌型：红桃级牌百搭、炸弹和同花顺比较', () => {
  const deck = createDoubleDeck()
  const wild = deck.find((card) => card.rank === 15 && card.suit === 0)
  const three = deck.find((card) => card.rank === 3 && card.suit === 1)
  const bomb3 = deck.filter((card) => card.rank === 3).slice(0, 4)
  const bomb4 = deck.filter((card) => card.rank === 4).slice(0, 4)
  const bomb4All = deck.filter((card) => card.rank === 4).concat(deck.filter((card) => card.rank === 15 && card.suit === 0))
  const straightFlush = deck.filter((card) => card.copy === 0 && card.suit === 1 && card.rank >= 3 && card.rank <= 7)
  const wildStraightFlush = [...straightFlush.slice(0, 4), wild]
  const a2345 = [14, 15, 3, 4, 5].map((rank, index) => deck.find((card) => card.rank === rank && card.copy === 0 && card.suit === (index % 4)))
  assert.equal(analyzeGuandan([three, wild], 15).type, GD_T.PAIR)
  assert.equal(analyzeGuandan(bomb3, 15).type, GD_T.BOMB)
  assert.equal(analyzeGuandan(bomb4All, 15).bombSize, 10)
  assert.equal(analyzeGuandan(straightFlush, 15).type, GD_T.STRAIGHT_FLUSH)
  assert.equal(analyzeGuandan(wildStraightFlush, 15).type, GD_T.STRAIGHT_FLUSH)
  assert.equal(analyzeGuandan(a2345, 15).type, GD_T.STRAIGHT)
  const bomb5 = deck.filter((card) => card.rank === 5).slice(0, 5)
  const bomb6 = deck.filter((card) => card.rank === 6).slice(0, 6)
  const bomb7 = deck.filter((card) => card.rank === 7).slice(0, 7)
  const bomb8 = deck.filter((card) => card.rank === 8).slice(0, 8)
  const fourKings = deck.filter((card) => card.rank === 16 || card.rank === 17)
  const plane = [3, 4, 5].flatMap((rank) => deck.filter((card) => card.rank === rank).slice(0, 3))
  const planeHigh = [4, 5, 6].flatMap((rank) => deck.filter((card) => card.rank === rank).slice(0, 3))
  const rocket = fourKings
  const p4 = analyzeGuandan(bomb3, 15)
  const p5 = analyzeGuandan(bomb5, 15)
  const p6 = analyzeGuandan(bomb6, 15)
  const p7 = analyzeGuandan(bomb7, 15)
  const p8 = analyzeGuandan(bomb8, 15)
  const pPlane = analyzeGuandan(plane, 15)
  const pPlaneHigh = analyzeGuandan(planeHigh, 15)
  const pFlush = analyzeGuandan(straightFlush, 15)
  const pRocket = analyzeGuandan(rocket, 15)
  assert.equal(canBeatGuandan(p4, p5), true)
  assert.equal(canBeatGuandan(p5, pFlush), true)
  assert.equal(canBeatGuandan(pFlush, p6), true)
  assert.equal(canBeatGuandan(p6, pRocket), true)
  assert.equal(canBeatGuandan(pRocket, p6), false)
  assert.equal(analyzeGuandan(bomb6, 15).bombSize, 6)
  assert.equal(analyzeGuandan(bomb7, 15).bombSize, 7)
  assert.equal(analyzeGuandan(bomb8, 15).bombSize, 8)
  assert.equal(analyzeGuandan(rocket, 15).type, GD_T.ROCKET)
  assert.equal(pPlane.type, GD_T.PLANE)
  assert.equal(pPlane.length, 3)
  assert.equal(canBeatGuandan(p6, p7), true)
  assert.equal(canBeatGuandan(p7, p8), true)
  assert.equal(canBeatGuandan(pPlane, pPlaneHigh), true)
  assert.equal(canBeatGuandan(p8, pRocket), true)
  assert.equal(analyzeGuandan([3, 4, 5, 6].flatMap((rank) => deck.filter((card) => card.rank === rank).slice(0, 2)), 15), null)
  assert.equal(analyzeGuandan([3, 4, 6].flatMap((rank) => deck.filter((card) => card.rank === rank).slice(0, 3)), 15), null)
  assert.ok(guandanCardValue(3, 3) > guandanCardValue(14, 3))
  assert.ok(guandanCardValue(15, 3) < guandanCardValue(14, 3))
})

test('掼蛋提示：特殊牌型会自动整手组成，跟牌优先找合法组合', () => {
  const deck = createDoubleDeck()
  const cases = [
    {
      name: '六炸',
      cards: deck.filter((card) => card.rank === 6).slice(0, 6),
      type: GD_T.BOMB,
    },
    {
      name: '同花顺',
      cards: deck.filter((card) => card.copy === 0 && card.suit === 1 && card.rank >= 3 && card.rank <= 7),
      type: GD_T.STRAIGHT_FLUSH,
    },
    {
      name: '飞机',
      cards: [3, 4, 5].flatMap((rank) => deck.filter((card) => card.rank === rank).slice(0, 3)),
      type: GD_T.PLANE,
    },
    {
      name: '三带二',
      cards: [...deck.filter((card) => card.rank === 8).slice(0, 3), ...deck.filter((card) => card.rank === 9).slice(0, 2)],
      type: GD_T.TRIPLE_PAIR,
    },
    {
      name: '钢板',
      cards: [10, 11].flatMap((rank) => deck.filter((card) => card.rank === rank).slice(0, 3)),
      type: GD_T.STEEL,
    },
    {
      name: '三连对',
      cards: [10, 11, 12].flatMap((rank) => deck.filter((card) => card.rank === rank).slice(0, 2)),
      type: GD_T.STRAIGHT_PAIR,
    },
  ]

  for (const item of cases) {
    const g = newGuandan()
    g.players[0].cards = item.cards
    g.current = null
    g.turnSeat = 0
    const suggested = aiGuandanPlay(g, 0)
    assert.ok(suggested && suggested.length === item.cards.length, `${item.name} 提示没有整手组成`)
    assert.equal(analyzeGuandan(suggested, g.level).type, item.type, `${item.name} 提示牌型错误`)
  }

  const seeded = newGuandan()
  seeded.players[0].cards = cases[2].cards.concat(deck.filter((card) => card.rank === 9).slice(0, 3))
  seeded.current = null
  seeded.turnSeat = 0
  const seededSuggestion = aiGuandanHint(seeded, 0, [cases[2].cards[0].id])
  assert.equal(seededSuggestion.length, 9)
  assert.equal(analyzeGuandan(seededSuggestion, 15).type, GD_T.PLANE)

  const bombSeed = newGuandan()
  const bombCards = deck.filter((card) => card.rank === 8).slice(0, 8)
  bombSeed.players[0].cards = bombCards.concat(deck.filter((card) => card.rank === 9).slice(0, 2))
  bombSeed.current = null
  bombSeed.turnSeat = 0
  const bombSuggestion = aiGuandanHint(bombSeed, 0, [bombCards[0].id])
  assert.equal(bombSuggestion.length, 8)
  assert.equal(analyzeGuandan(bombSuggestion, 15).bombSize, 8)

  const follow = newGuandan()
  follow.players[0].cards = deck.filter((card) => card.rank === 8).slice(0, 7)
  follow.current = {
    seat: 1,
    pattern: analyzeGuandan(deck.filter((card) => card.rank === 6).slice(0, 6), 15),
    cards: [],
  }
  follow.turnSeat = 0
  const response = aiGuandanPlay(follow, 0)
  assert.equal(analyzeGuandan(response, 15).type, GD_T.BOMB)
  assert.equal(analyzeGuandan(response, 15).bombSize, 7)
})

test('掼蛋 AI：完整轮转可结束并保持结算守恒', () => {
  const g = newGuandan({ randomSeed: () => 0.47 })
  let steps = 0
  while (g.phase === GD_PHASE.PLAY && steps < 3000) {
    const seat = g.turnSeat
    const cards = aiGuandanPlay(g, seat)
    if (cards && cards.length) g.play(seat, cards)
    else if (g.mustPlay(seat)) g.play(seat, [g.players[seat].cards[0]])
    else g.pass(seat)
    steps++
  }
  assert.equal(g.phase, GD_PHASE.OVER)
  assert.ok(g.finishOrder.length === 2 || g.finishOrder.length === 4)
  assert.equal(g.settle.reduce((sum, row) => sum + row.delta, 0), 0)
})

test('掼蛋双下：同队前两名出完立即结束，且不再等待另外两家', () => {
  const g = newGuandan()
  const deck = createDoubleDeck()
  const hands = [3, 4, 5, 6].map((rank) => [deck.find((card) => card.rank === rank && card.suit === 1)])
  g.players.forEach((player, seat) => {
    player.cards = hands[seat]
    player.finished = false
  })
  g.phase = GD_PHASE.PLAY
  g.turnSeat = 0
  g.current = null
  g.play(0, hands[0])
  g.pass(1)
  g.play(2, hands[2])
  assert.equal(g.phase, GD_PHASE.OVER)
  assert.deepEqual(g.finishOrder, [0, 2])
  assert.equal(g.roundResult.outcome, 'double')
})

test('掼蛋借风：上游出完后其他人全过，由上游对家领出', () => {
  const g = newGuandan()
  const deck = createDoubleDeck()
  const cards = [3, 4, 5, 6].map((rank) => deck.find((card) => card.rank === rank && card.suit === 1))
  g.players.forEach((player, seat) => {
    player.cards = [cards[seat]]
    player.finished = false
  })
  g.phase = GD_PHASE.PLAY
  g.turnSeat = 0
  g.current = null
  g.play(0, [cards[0]])
  g.pass(1)
  g.pass(2)
  g.pass(3)
  assert.equal(g.current, null)
  assert.equal(g.turnSeat, 2)
})

test('掼蛋下一副：普通胜利执行单贡，贡最大牌且还牌不超过10', () => {
  const g = newGuandan({ randomSeed: () => 0.23 })
  g.finishOrder = [0, 1, 2, 3]
  g.players.forEach((player) => { player.finished = true })
  g.finishRound()
  assert.equal(g.roundResult.outcome, 'single')
  const oldLevel = g.level
  const result = g.startNextHand()
  assert.equal(result.handNumber, 2)
  assert.equal(g.level, 4)
  assert.equal(g.lastTribute.type, 'single')
  assert.equal(g.lastTribute.skipped, false)
  assert.equal(g.players.reduce((sum, player) => sum + player.cards.length, 0), 108)
  assert.equal(g.players.every((player) => player.cards.length === 27), true)
  assert.equal(oldLevel, 15)
  const gift = g.lastTribute.gifts[0]
  assert.ok(gift.card)
  assert.ok(gift.returnCard)
  assert.ok(gift.returnCard.rank === 15 || gift.returnCard.rank <= 10)
})


test('掼蛋升级：双下升三级并按升级倍数结算豆值', () => {
  const g = newGuandan()
  g.recordFinish(0)
  g.recordFinish(2)
  g.recordFinish(1)
  g.recordFinish(3)
  g.finishRound()
  assert.equal(g.roundResult.winnerTeam, 0)
  assert.equal(g.roundResult.outcome, 'double')
  assert.equal(g.roundResult.levelGain, 3)
  assert.equal(g.teamLevels[0], 5)
  assert.equal(g.settle.find((row) => row.seat === 0).delta, 300)
  assert.equal(g.settle.reduce((sum, row) => sum + row.delta, 0), 0)
})

test('掼蛋过A：A级头游方搭档不是末游时结束整局', () => {
  const g = newGuandan({ level: 14 })
  g.recordFinish(0)
  g.recordFinish(1)
  g.recordFinish(2)
  g.recordFinish(3)
  g.finishRound()
  assert.equal(g.roundResult.previousLevel, 14)
  assert.equal(g.roundResult.matchWinnerTeam, 0)
  assert.equal(g.roundResult.nextLevel, 14)
})

test('构造：非 3 人直接抛错', () => {
  assert.throws(() => new DoudizhuGame([{}, {}]), /3 个座位/)
})

test('start：发牌数量正确、牌对象带 rank、无重复', () => {
  const g = newGame()
  assert.equal(g.phase, PHASE.BID)
  assert.equal(g.snapshot(0).mode, GAME_MODES.NORMAL)
  assert.equal(g.bottom.length, 3)
  const all = [...g.bottom, ...g.players.flatMap((p) => p.cards)]
  assert.equal(all.length, 54)
  assert.equal(new Set(all.map((c) => c.id)).size, 54)
  for (const p of g.players) {
    assert.equal(p.cards.length, 17)
    for (const c of p.cards) assert.equal(typeof c.rank, 'number', '手牌必须是带 rank 的牌对象')
  }
  // 手牌已排序（大在前）
  const hand = g.players[0].cards
  for (let i = 1; i < hand.length; i++) assert.ok(hand[i - 1].rank >= hand[i].rank)
})

test('snapshot：只有观察者本人能看到自己的手牌，地主未定前底牌不下发', () => {
  const g = newGame()
  const s0 = g.snapshot(0)
  assert.ok(Array.isArray(s0.players[0].cards))
  assert.equal(s0.players[1].cards, null)
  assert.equal(s0.bottom, null)
})

test('超级多炸弹模式：54 张牌、每家保底两组炸弹', () => {
  const g = newGame({ mode: GAME_MODES.SUPER_BOMB, randomSeed: () => 0.37 })
  const all = [...g.bottom, ...g.players.flatMap((p) => p.cards)]
  assert.equal(g.snapshot(0).mode, GAME_MODES.SUPER_BOMB)
  assert.equal(all.length, 54)
  assert.equal(new Set(all.map((c) => c.id)).size, 54)
  for (const player of g.players) {
    const bombCount = [...countRanks(player.cards).values()].filter((count) => count >= 4).length
    assert.ok(bombCount >= 2, `${player.name} 应至少拥有两组炸弹`)
    assert.equal(player.cards.length, 17)
  }
})

test('叫地主：轮流不叫、有人叫后由首次叫地主者最后表态', () => {
  const g = newGame()
  g.bidPass(0)
  assert.equal(g.bidTurn, 1)
  g.bidPass(1)
  g.bidCall(2)
  assert.equal(g.candidate, 2)
  assert.equal(g.callSeat, 2)
  assert.equal(g.robTurn, 0)
  // 两家先表态，首次叫地主者拥有最后一次不抢并立即落定
  g.robPass(0)
  assert.equal(g.phase, PHASE.BID)
  assert.equal(g.robTurn, 1)
  g.robPass(1)
  assert.equal(g.phase, PHASE.BID)
  assert.equal(g.robTurn, 2)
  g.robPass(2)
  assert.equal(g.phase, PHASE.PLAY)
  assert.equal(g.landlordSeat, 2)
  assert.equal(g.bidMul, 1)
})

test('三家都不叫 → 本局作废', () => {
  const g = newGame()
  g.bidPass(0)
  g.bidPass(1)
  g.bidPass(2)
  assert.equal(g.phase, PHASE.OVER)
  assert.equal(g.overReason, 'no-bid')
})

test('抢地主：首次叫地主者最后抢或不抢，最后动作后立即结束', () => {
  const g = newGame()
  g.bidCall(0) // 首次叫地主者 0，robTurn=1
  g.robCall(1) // 抢 → 候选 1，robTurn=2
  assert.equal(g.candidate, 1)
  assert.equal(g.bidMul, 2)
  g.robPass(2) // robTurn=0，仍等待首次叫地主者最后表态
  assert.equal(g.phase, PHASE.BID)
  assert.equal(g.robTurn, 0)
  g.robCall(0) // 最后一手反抢，立即落定
  assert.equal(g.phase, PHASE.PLAY)
  assert.equal(g.candidate, 0)
  assert.equal(g.landlordSeat, 0)
  assert.equal(g.bidMul, 4)
})

test('抢地主回到首次叫地主者时，必须由其最后表态', () => {
  const g = newGame()
  g.bidCall(0)
  g.robCall(1) // 候选 1，robTurn=2
  g.robPass(2) // robTurn=0
  assert.equal(g.phase, PHASE.BID)
  g.robPass(0) // 首次叫地主者不抢，立即结束
  assert.equal(g.phase, PHASE.PLAY)
  assert.equal(g.landlordSeat, 1)
})

test('每家限抢一次：抢过后不能再次抢，首次叫地主者最后收口', () => {
  const g = newGame()
  g.bidCall(0) // 首次叫地主者 0，robTurn=1
  assert.equal(g.canRob(1), true)
  g.robCall(1)
  assert.equal(g.canRob(2), true)
  g.robPass(2) // robTurn=0
  assert.equal(g.canRob(1), false, 'seat1 已抢过，不能再次抢')
  g.robPass(0) // 最后一手不抢，地主为 seat1
  assert.equal(g.phase, PHASE.PLAY)
  assert.equal(g.landlordSeat, 1)

  const g2 = newGame()
  g2.bidCall(0)
  g2.robCall(1)
  g2.robPass(2)
  g2.robCall(0) // 首次叫地主者最后反抢，立即结束
  assert.equal(g2.phase, PHASE.PLAY)
  assert.equal(g2.landlordSeat, 0)
})

test('finishBid：地主拿 20 张含底牌', () => {
  const g = newGame()
  const bottomIds = g.bottom.map((c) => c.id)
  g.bidCall(0)
  g.robPass(1)
  g.robPass(2)
  g.robPass(0)
  assert.equal(g.players[0].cards.length, 20)
  for (const id of bottomIds) assert.ok(g.players[0].cards.some((c) => c.id === id))
  assert.equal(g.turnSeat, 0)
  assert.equal(g.snapshot(0).bottom.length, 3)
})

test('出牌：轮次、手牌校验、牌型校验、压牌校验', () => {
  const g = newGame()
  setHand(g, 0, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) // 3x4 + 4x4 + 2x2(5,5)
  g.bidCall(0)
  g.robPass(1)
  g.robPass(2)
  g.robPass(0)

  assert.throws(() => g.play(1, [makeCard(0)]), /轮不到/) // 没轮到
  assert.throws(() => g.play(0, [{ id: 999 }]), /不在手牌/) // 牌不在手里
  assert.throws(() => g.play(0, [makeCard(0), makeCard(4)]), /不成牌型/) // 两张散牌

  g.play(0, [makeCard(0)]) // 3 单张
  assert.equal(g.turnSeat, 1)
  assert.equal(g.current.pattern.type, T.SOLO)

  setHand(g, 1, [12, 13, 40, 41]) // 6 一对 + K 一对 → 连对 66KK
  assert.throws(() => g.play(1, [makeCard(0)]), /不在手牌/) // 覆盖后确保不在手牌
  assert.throws(() => g.play(1, cardsFromIds([12, 13])), /压不过/) // 对6 压不过 单3（类型不同）
})

test('出牌：两家连续过牌后，最后出牌者开新一轮', () => {
  const g = newGame()
  setHand(g, 0, [0, 1, 2, 3]) // 4张3 → 炸弹也可
  setHand(g, 1, [8, 9])
  setHand(g, 2, [12, 13])
  g.bidCall(0)
  g.robPass(1)
  g.robPass(2)
  g.robPass(0)

  g.play(0, [makeCard(0)]) // 3
  g.pass(1)
  g.pass(2)
  assert.equal(g.current, null)
  assert.equal(g.turnSeat, 0)
  assert.equal(g.mustPlay(0), true)
  // 必须出牌
  assert.throws(() => g.pass(0), /必须出牌/)
})

test('炸弹：倍数翻倍、王炸压一切、轮空后新轮次与终局结算', () => {
  const g = newGame()
  setHand(g, 0, [0, 1, 2, 3, 44]) // 地主：3333 炸弹 + ♠A
  setHand(g, 1, [52, 53, 20]) // 王炸 + ♥8
  setHand(g, 2, [4, 8, 12, 16, 20, 24]) // 45678 顺子 + 9
  g.bidCall(0)
  g.robPass(1)
  g.robPass(2)
  g.robPass(0)

  g.play(0, cardsFromIds([0, 1, 2, 3])) // 炸弹
  assert.equal(g.bombMul, 2)
  g.play(1, cardsFromIds([52, 53])) // 王炸压炸弹
  assert.equal(g.bombMul, 4)
  assert.throws(() => g.play(2, cardsFromIds([4, 8, 12, 16, 20])), /压不过/) // 顺子压不过王炸
  g.pass(2)
  g.pass(0) // 地主也压不过王炸
  // 两家过 → 王炸者开新一轮
  assert.equal(g.current, null)
  assert.equal(g.turnSeat, 1)
  g.play(1, cardsFromIds([20])) // 出完最后一张 → 农民赢
  assert.equal(g.phase, PHASE.OVER)
  assert.deepEqual(g.winnerSeats, [1])
  // 地主只出了首手炸弹 → 反春 ×2
  assert.equal(g.spring, 'anti-spring')
  // baseBet 100 × bidMul 1 × bombMul 4 × springMul 2 = 800；农民赢 → 地主 -1600，各农民 +800
  assert.equal(g.settle.find((s) => s.seat === 0).delta, -1600)
  assert.equal(g.settle.find((s) => s.seat === 1).delta, 800)
  assert.equal(g.settle.reduce((s, x) => s + x.delta, 0), 0)
})

test('结算：地主赢收双倍，农民赢各收一份，总和为 0', () => {
  // 场景 A：地主赢
  const a = newGame({ baseBet: 100 })
  a.players[0].isLandlord = true
  a.winnerSeats = [0]
  a.settle = a.calcSettle()
  assert.equal(a.settle.find((s) => s.seat === 0).delta, 200)
  assert.equal(a.settle.find((s) => s.seat === 1).delta, -100)
  assert.equal(a.settle.reduce((s, x) => s + x.delta, 0), 0)

  // 场景 B：农民赢（回归测试：曾出现符号反转 bug）
  const b = newGame({ baseBet: 100 })
  b.players[0].isLandlord = true
  b.players[1].isLandlord = false
  b.players[2].isLandlord = false
  b.winnerSeats = [1]
  b.settle = b.calcSettle()
  assert.equal(b.settle.find((s) => s.seat === 1).delta, 100, '赢的农民应 +100')
  assert.equal(b.settle.find((s) => s.seat === 2).delta, 100, '另一农民应 +100')
  assert.equal(b.settle.find((s) => s.seat === 0).delta, -200, '地主应 -200')
  assert.equal(b.settle.reduce((s, x) => s + x.delta, 0), 0)
})

test('整局：打到没牌自动结算（农民先出完）', () => {
  const g = newGame()
  g.bidCall(0)
  g.robPass(1)
  g.robPass(2)
  g.robPass(0)
  // 叫完地主后覆盖手牌（含底牌已并入地主手牌）
  setHand(g, 0, [0, 1, 2, 3]) // 地主：3333 炸弹
  setHand(g, 1, [16, 17]) // 7 一对
  setHand(g, 2, [8, 9, 40])
  // 地主 4张3 一把炸出去 → 手牌空 → 结束
  g.play(0, cardsFromIds([0, 1, 2, 3]))
  assert.equal(g.phase, PHASE.OVER)
  assert.equal(g.overReason, 'finished')
  assert.deepEqual(g.winnerSeats, [0])
  assert.equal(g.settle.length, 3)
  assert.equal(g.settle.reduce((s, x) => s + x.delta, 0), 0)
  const overSnapshot = g.snapshot(0)
  assert.ok(overSnapshot.players[1].cards && overSnapshot.players[1].cards.length > 0, '结算阶段应可展示敌方剩余手牌')
})

test('重开：同一实例 start() 后倍数与状态归零', () => {
  const g = newGame()
  g.bidCall(0)
  g.robCall(1)
  g.robPass(2)
  g.robPass(0)
  assert.equal(g.bidMul, 2)
  g.start()
  assert.equal(g.phase, PHASE.BID)
  assert.equal(g.bidMul, 1)
  assert.equal(g.bombMul, 1)
  assert.equal(g.landlordSeat, null)
  assert.equal(g.history.length, 0)
  assert.equal(g.players[0].cards.length, 17)
})

test('春天：地主一口气出完、农民一张未出 → ×2', () => {
  const g = newGame()
  g.bidCall(0)
  g.robPass(1)
  g.robPass(2)
  g.robPass(0)
  setHand(g, 0, [0, 1, 2, 3])
  setHand(g, 1, [16, 17])
  setHand(g, 2, [8, 9, 40])
  g.play(0, cardsFromIds([0, 1, 2, 3]))
  assert.equal(g.spring, 'spring')
  assert.equal(g.springMul, 2)
  // 100 × 叫1 × 炸2 × 春2 = 400；地主 +800
  assert.equal(g.settle.find((s) => s.seat === 0).delta, 800)
  assert.equal(g.snapshot(0).spring, 'spring')
})

test('春天：农民出过牌则不算春天；重开后春天倍数归零', () => {
  const g = newGame()
  g.bidCall(0)
  g.robPass(1)
  g.robPass(2)
  g.robPass(0)
  setHand(g, 0, [0, 4, 44])
  setHand(g, 1, [8, 40])
  setHand(g, 2, [12, 36])
  g.play(0, cardsFromIds([0]))
  g.play(1, cardsFromIds([8]))
  g.pass(2)
  g.play(0, cardsFromIds([44]))
  g.pass(1)
  g.pass(2)
  g.play(0, cardsFromIds([4]))
  assert.equal(g.phase, PHASE.OVER)
  assert.equal(g.spring, null)
  assert.equal(g.springMul, 1)
  g.start()
  assert.equal(g.springMul, 1)
  assert.equal(g.spring, null)
})
