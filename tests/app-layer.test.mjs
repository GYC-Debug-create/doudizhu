import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBus } from '../src/ui/event-bus.js'
import { createTurnScheduler } from '../src/ui/turn-scheduler.js'
import { playCue, bidCue, settleCue, createFeedback } from '../src/ui/feedback.js'
import { LINES, MOODS, allClips, pickLine } from '../src/ui/voice-lines.js'
import { existsSync } from 'node:fs'
import { normalizeProfile, recordResult, applyRelief, settleBeans, emptyStats, RELIEF_AMOUNT } from '../src/ui/profile.js'
import { computeStage } from '../src/ui/viewport.js'
import { keyIntent } from '../src/ui/keyboard.js'
import * as view from '../src/ui/doudizhu-view.js'
import { createDoudizhuController } from '../src/ui/game-controllers.js'
import { analyze, T } from '../src/game/patterns.js'
import { cardsFromIds } from '../src/game/cards.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------- event-bus ----------

test('事件总线：订阅、退订、多订阅者', () => {
  const bus = createBus()
  const got = []
  const off = bus.on('x', (p) => got.push(['a', p]))
  bus.on('x', (p) => got.push(['b', p]))
  bus.emit('x', 1)
  off()
  bus.emit('x', 2)
  bus.emit('y', 3)
  assert.deepEqual(got, [['a', 1], ['b', 1], ['b', 2]])
})

// ---------- turn-scheduler ----------

test('节奏调度：思考时间与声音都结束后才行动', async () => {
  const steps = []
  let audioDone = false
  const s = createTurnScheduler({
    currentSeat: () => 1,
    step: (seat) => steps.push({ seat, audioDone }),
    pacing: () => ({ delay: 5, gap: 5 }),
    waitAudio: () => sleep(40).then(() => {
      audioDone = true
    }),
  })
  s.schedule()
  await sleep(20)
  assert.equal(steps.length, 0, '声音没播完不能行动')
  await sleep(50)
  assert.deepEqual(steps, [{ seat: 1, audioDone: true }])
})

test('节奏调度：重新调度/取消会作废旧的等待，换人也不会误行动', async () => {
  const steps = []
  let seat = 1
  const s = createTurnScheduler({
    currentSeat: () => seat,
    step: (x) => steps.push(x),
    pacing: () => ({ delay: 10, gap: 0 }),
  })
  s.schedule()
  s.schedule() // 第二次调度作废第一次
  await sleep(30)
  assert.deepEqual(steps, [1], '只行动一次')

  s.schedule()
  s.cancel()
  await sleep(30)
  assert.deepEqual(steps, [1], '取消后不行动')

  s.schedule()
  seat = 2 // 等待期间轮次变了
  await sleep(30)
  assert.deepEqual(steps, [1], '轮次变化后旧调度放弃')
})

test('节奏调度：被阻塞（底牌翻开中）或无 AI 座位时不调度', async () => {
  const steps = []
  const s = createTurnScheduler({ currentSeat: () => null, step: (x) => steps.push(x), pacing: () => ({ delay: 1, gap: 0 }) })
  s.schedule()
  const b = createTurnScheduler({ currentSeat: () => 1, step: (x) => steps.push(x), pacing: () => ({ delay: 1, gap: 0 }), isBlocked: () => true })
  b.schedule()
  await sleep(15)
  assert.deepEqual(steps, [])
})

// ---------- feedback ----------

test('反馈映射：牌型对应台词，炸弹/王炸带特效与倍数，过牌区分“让队友”', () => {
  const never = () => 0.99 // 不触发随机嘲讽
  const bomb = playCue('doudizhu', { seat: 1, pattern: analyze(cardsFromIds([0, 1, 2, 3])) }, { random: never })
  assert.deepEqual([bomb.sfx, bomb.line, bomb.fx.kind, bomb.fx.showMul], ['bomb', 'bomb', 'bomb', true])

  const pair = playCue('doudizhu', { seat: 1, pattern: analyze(cardsFromIds([40, 41])) }, { random: never })
  assert.deepEqual([pair.sfx, pair.line, pair.fx], ['play', 'pair-13', null])

  assert.equal(playCue('doudizhu', { seat: 2, pass: true }, { mate: false }).line, 'pass')
  assert.equal(playCue('doudizhu', { seat: 2, pass: true }, { mate: true }).line, 'pass-mate')
  assert.equal(playCue('guandan', { seat: 1, pattern: { type: 'ROCKET', rank: 17 } }).fx.text, '四王')
  assert.equal(bidCue('rob-call').line, 'rob-call')
})

test('反馈映射：跟牌压对手时偶尔嘲讽，领出和压队友时不会', () => {
  const always = () => 0
  const single = { seat: 1, pattern: analyze(cardsFromIds([44])) }
  assert.equal(playCue('doudizhu', single, { lead: false, mate: false, random: always }).line, 'beat')
  assert.equal(playCue('doudizhu', single, { lead: true, random: always }).line, 'solo-14')
  const rocket = { seat: 1, pattern: analyze(cardsFromIds([52, 53])) }
  assert.equal(playCue('doudizhu', rocket, { lead: false, random: always }).line, 'rocket', '王炸永远喊王炸')
})

test('台词表：反馈会用到的台词都有，且每条台词都已生成音频文件', () => {
  const keys = new Set(['pass', 'pass-mate', 'beat', 'bid-call', 'bid-pass', 'rob-call', 'rob-pass', 'alarm-1', 'alarm-2',
    'win', 'lose', 'hurry', 'spring', 'anti-spring', 'triple-solo', 'triple-pair', 'straight', 'straight-pair', 'plane',
    'bomb', 'rocket', 'gd-triple-pair', 'gd-straight-pair', 'gd-steel', 'gd-straight-flush', 'gd-rocket'])
  for (let r = 3; r <= 17; r++) keys.add(`solo-${r}`)
  for (let r = 3; r <= 15; r++) keys.add(`pair-${r}`).add(`triple-${r}`)
  for (const key of keys) assert.ok(LINES[key] && LINES[key].length, `缺台词 ${key}`)
  for (const v of Object.values(LINES).flat()) assert.ok(MOODS[v.mood], `未知情绪 ${v.mood}`)
  const missing = allClips().filter((c) => !existsSync(new URL(`../src/static/${c.path}`, import.meta.url)))
  assert.deepEqual(missing.map((c) => c.path), [], '有台词没生成音频：运行 npm run voice')
  assert.equal(pickLine('pass', () => 0.999).index, LINES.pass.length - 1)
})

test('反馈：报单/报双每家每档只提醒一次，且排队在出牌播报之后', () => {
  const calls = []
  const fb = createFeedback({
    sfx: (n) => calls.push(['sfx', n]),
    speak: (seat, key, opts) => calls.push(['speak', seat, key, !!(opts && opts.queue)]),
    waitAudio: () => Promise.resolve(),
    showFx: () => {},
  })
  const snap = { phase: 'play', players: [{ seat: 0, cardCount: 1 }, { seat: 1, cardCount: 2 }, { seat: 2, cardCount: 5 }] }
  fb.alarms(snap)
  fb.alarms(snap)
  assert.deepEqual(calls, [['sfx', 'alarm'], ['speak', 1, 'alarm-2', true]], '自己不报、重复不报')
  fb.reset()
  fb.alarms(snap)
  assert.equal(calls.length, 4, '新一局重新提醒')
})

test('反馈：结算由输赢另一方的 AI 发声，新开一局后作废', async () => {
  const calls = []
  const fb = createFeedback({ sfx: (n) => calls.push(n), speak: (seat, key) => calls.push(`${seat}:${key}`), waitAudio: () => Promise.resolve(), showFx: () => {} })
  const iWin = [{ seat: 0, delta: 200 }, { seat: 1, delta: -100 }, { seat: 2, delta: -100 }]
  fb.settle({ settle: iWin })
  fb.reset()
  await sleep(260)
  assert.deepEqual(calls, [])
  fb.settle({ settle: iWin })
  await sleep(260)
  assert.deepEqual(calls, ['win', '1:lose'], '你赢了：输家 AI 叹气')

  const iLose = [{ seat: 0, delta: -200 }, { seat: 1, delta: 100 }, { seat: 2, delta: 100 }]
  assert.deepEqual(settleCue({ settle: iLose }), { sfx: 'lose', seat: 1, line: 'win', won: false })
  assert.equal(settleCue({ settle: iWin, spring: 'spring' }).line, 'spring')
})

test('反馈：轮到你拖太久，AI 会催；轮次一变就取消', () => {
  const calls = []
  const timers = []
  const fb = createFeedback({
    sfx: () => {},
    speak: (seat, key) => calls.push(`${seat}:${key}`),
    waitAudio: () => new Promise(() => {}),
    showFx: () => {},
    random: () => 0,
    setTimer: (fn, ms) => timers.push({ fn, ms, live: true }) - 1,
    clearTimer: (id) => {
      timers[id].live = false
    },
  })
  const players = [{ seat: 0 }, { seat: 1 }, { seat: 2 }]
  fb.turn({ phase: 'play', turnSeat: 0, seq: 5, players })
  assert.equal(timers.length, 1)
  fb.turn({ phase: 'play', turnSeat: 1, seq: 6, players })
  assert.equal(timers[0].live, false, '轮次变化后取消催促')
  fb.turn({ phase: 'play', turnSeat: 0, seq: 7, players })
  timers[1].fn()
  assert.deepEqual(calls, ['1:hurry'])
})

// ---------- profile ----------

test('档案：坏数据回退默认，合法字段保留', () => {
  const p = normalizeProfile({ mode: 'hack', beans: '-5', speed: 'warp', soundOn: false, stats: { games: 3, wins: 'x' } }, { modes: ['normal'] })
  assert.equal(p.mode, null)
  assert.equal(p.beans, 0)
  assert.equal(p.speed, 'normal')
  assert.equal(p.soundOn, false)
  assert.deepEqual(p.stats, { games: 3, wins: 0, streak: 0, best: 0, maxWin: 0 })
  assert.equal(normalizeProfile(null).beans, 1000)
})

test('档案：战绩连胜、救济豆、余额不为负', () => {
  let st = emptyStats()
  st = recordResult(st, 200)
  st = recordResult(st, 400)
  st = recordResult(st, -100)
  assert.deepEqual(st, { games: 3, wins: 2, streak: 0, best: 2, maxWin: 400 })
  assert.deepEqual(applyRelief(100), { beans: 100 + RELIEF_AMOUNT, granted: RELIEF_AMOUNT })
  assert.deepEqual(applyRelief(500), { beans: 500, granted: 0 })
  assert.deepEqual(settleBeans(300, -800), { beans: 0, delta: -300 })
})

// ---------- viewport / keyboard ----------

test('缩放：大屏放大、矮屏缩小、手机不变', () => {
  assert.deepEqual(computeStage(390, 844), { zoom: 1, width: 1180 })
  const big = computeStage(1920, 989)
  assert.ok(big.zoom > 1.2 && big.zoom < 1.3)
  assert.ok(big.width > 1180, '宽屏横向撑开')
  assert.ok(computeStage(1366, 680).zoom < 1)
})

test('快捷键：按轮次映射意图', () => {
  const none = { bidTurn: false, robTurn: false, robPassOnly: false, playTurn: false, canFollow: true, hasSelection: false }
  assert.equal(keyIntent('Enter', { ...none, bidTurn: true }), 'bid')
  assert.equal(keyIntent('p', { ...none, robTurn: true }), 'rob-pass')
  assert.equal(keyIntent(' ', { ...none, playTurn: true }), 'hint')
  assert.equal(keyIntent(' ', { ...none, playTurn: true, hasSelection: true }), 'play')
  assert.equal(keyIntent(' ', { ...none, playTurn: true, canFollow: false }), 'pass')
  assert.equal(keyIntent('Escape', { ...none, playTurn: true }), 'clear')
  assert.equal(keyIntent(' ', none), null)
})

// ---------- doudizhu-view ----------

test('牌桌视图：选牌判定与记牌器', () => {
  const snap = {
    phase: 'play',
    turnSeat: 0,
    current: { seat: 1, pattern: analyze(cardsFromIds([40])), cards: cardsFromIds([40]) },
    history: [{ seat: 1, cards: cardsFromIds([40]), pattern: analyze(cardsFromIds([40])) }],
    players: [],
  }
  const turn = view.deriveTurn(snap)
  assert.equal(turn.playTurn, true)
  assert.equal(turn.mustLead, false)
  const weak = view.judgeSelection(snap, turn, { pattern: analyze(cardsFromIds([4])), count: 1 })
  assert.equal(weak.canPlay.allowed, false)
  assert.equal(weak.kind, 'warn')
  const strong = view.judgeSelection(snap, turn, { pattern: analyze(cardsFromIds([44])), count: 1 })
  assert.equal(strong.canPlay.allowed, true)
  assert.equal(view.judgeSelection(snap, turn, { pattern: null, count: 2 }).kind, 'error')

  const cells = view.counterCells(snap, cardsFromIds([41, 52]))
  const k = cells.find((c) => c.rank === 13)
  assert.equal(k.left, 2, 'K：自己一张 + 已出一张')
  assert.equal(cells.find((c) => c.rank === 16).left, 0)
  assert.equal(cells.find((c) => c.rank === 3).hot, true)
})

// ---------- controller 事件流 ----------

test('控制器：整局事件流（每局只结算一次）', () => {
  const events = []
  const seats = [0, 1, 2].map((i) => ({ id: `p${i}`, name: `p${i}`, isAI: true }))
  const ctrl = createDoudizhuController({ seats, emit: (type, payload) => events.push({ type, ...payload }) })
  ctrl.start({ mode: 'normal' })
  assert.deepEqual(events.map((e) => e.type), ['snap', 'refreshed'])
  for (let guard = 0; guard < 500; guard++) {
    const seat = ctrl.currentAISeat()
    if (seat === null) break
    ctrl.aiStep(seat)
  }
  const types = events.map((e) => e.type)
  assert.ok(events.every((e) => e.game === 'doudizhu'))
  if (types.includes('no-bid')) return
  assert.ok(types.includes('bid') && types.includes('bottom') && types.includes('play') && types.includes('finish'))
  assert.equal(types.filter((t) => t === 'settle').length, 1)
  assert.ok(!types.includes('error'))
})

test('控制器：托管让座位 0 交给 AI，提示在同一手内循环', () => {
  const seats = [{ id: 'me', name: '你', isAI: false }, { id: 'a', name: 'a', isAI: true }, { id: 'b', name: 'b', isAI: true }]
  const ctrl = createDoudizhuController({ seats, emit: () => {} })
  ctrl.start({ mode: 'normal' })
  assert.equal(ctrl.currentAISeat(), null, '座位 0 先叫，等真人')
  ctrl.setAutoPlay(true)
  assert.equal(ctrl.currentAISeat(), 0)
  ctrl.setAutoPlay(false)

  ctrl.bid(0)
  for (let guard = 0; guard < 20 && ctrl.currentAISeat() !== null; guard++) ctrl.aiStep(ctrl.currentAISeat())
  // 座位 0 叫了地主且其他人都不抢时，轮到座位 0 领出；有人抢则流程不同，此时跳过提示断言
  const first = ctrl.hint(0)
  if (!first) return
  const seen = [first.map((c) => c.id).join(',')]
  for (let i = 0; i < 300; i++) {
    const key = ctrl.hint(0).map((c) => c.id).join(',')
    if (key === seen[0]) break
    seen.push(key)
  }
  assert.ok(seen.length > 1, '连续提示应给出不同候选')
  assert.equal(new Set(seen).size, seen.length, '一轮循环内不重复')
})
