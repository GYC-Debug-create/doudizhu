import test from 'node:test'
import assert from 'node:assert/strict'
import { DoudizhuGame, PHASE } from '../src/game/rules.js'
import { GuandanGame, GD_PHASE } from '../src/game/guandan/rules.js'

const DZ_SEATS = [{ id: 'a' }, { id: 'b', isAI: true }, { id: 'c', isAI: true }]
const GD_SEATS = [
  { id: 'a' },
  { id: 'b', isAI: true, team: 1 },
  { id: 'c', isAI: true, team: 0 },
  { id: 'd', isAI: true, team: 1 },
]

/** 叫地主并完成抢地主流程，让 0 号成为地主并可出牌 */
function settleBid(g) {
  g.bidCall(0)
  for (const seat of [1, 2]) {
    if (g.canRob(seat)) g.robPass(seat)
  }
  g.robCall(0) // 首叫者最后表态：不抢直接落定
}

test('斗地主：actions 记录叫/抢/出全流程，seq 单调递增，snapshot 下发', () => {
  const g = new DoudizhuGame(DZ_SEATS)
  g.start()
  settleBid(g)
  assert.equal(g.phase, PHASE.PLAY)
  assert.equal(g.landlordSeat, 0)

  const hand = g.players[0].cards
  g.play(0, [hand[hand.length - 1]])

  const snap = g.snapshot(0)
  const types = snap.actions.map((a) => a.type)
  assert.deepEqual(types, ['bid-call', 'rob-pass', 'rob-pass', 'rob-call', 'play'])
  assert.deepEqual(
    snap.actions.map((a) => a.seq),
    [1, 2, 3, 4, 5]
  )
  const playAction = snap.actions[snap.actions.length - 1]
  assert.equal(playAction.seat, 0)
  assert.equal(playAction.cards, 1)
  assert.equal(snap.seq, 5)
})

test('斗地主：连续不叫进入作废时 bid-pass 全部入账', () => {
  const g = new DoudizhuGame(DZ_SEATS)
  g.start()
  g.bidPass(0)
  g.bidPass(1)
  g.bidPass(2)
  assert.equal(g.phase, PHASE.OVER)
  assert.equal(g.overReason, 'no-bid')
  const types = g.snapshot(0).actions.map((a) => a.type)
  assert.deepEqual(types, ['bid-pass', 'bid-pass', 'bid-pass'])
})

test('斗地主：过牌也计入 actions，history 保持只存出牌', () => {
  const g = new DoudizhuGame(DZ_SEATS)
  g.start()
  settleBid(g)
  g.play(0, [g.players[0].cards[g.players[0].cards.length - 1]])
  g.pass(1)
  g.pass(2)
  const snap = g.snapshot(0)
  const types = snap.actions.map((a) => a.type)
  assert.deepEqual(types.slice(-2), ['pass', 'pass'])
  // 过牌进 history（带 pass 标记），但 actions 里同样有记录 —— 两本账并行
  assert.equal(snap.history.filter((h) => h.pass).length, 2)
})

test('掼蛋：play/pass 入账且 snapshot 下发 seq/actions', () => {
  const g = new GuandanGame(GD_SEATS)
  g.start()
  const lead = g.turnSeat
  const hand = g.players[lead].cards
  g.play(lead, [hand[hand.length - 1]])

  const next = g.turnSeat
  g.pass(next)

  const snap = g.snapshot(0)
  assert.equal(snap.seq, 2)
  assert.deepEqual(
    snap.actions.map((a) => a.type),
    ['play', 'pass']
  )
  assert.equal(snap.actions[0].seat, lead)
  assert.equal(snap.actions[1].seat, next)
  assert.equal(g.phase, GD_PHASE.PLAY)
})
