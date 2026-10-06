/**
 * 斗地主对局引擎（状态机）
 *
 * 家庭规则：
 *  - 叫地主：按座位轮流"叫/不叫"，第一个叫的人成为候选地主
 *  - 抢地主：首次叫地主者固定为最后表态者，其他座位依次抢/不抢；最后一手完成后立即落定
 *  - 没人叫地主 → 本局作废重发
 *  - 出牌阶段每出一个炸弹/王炸倍数 ×2
 *  - 春天（农民一张没出）/ 反春（地主只出了首手）再 ×2
 *  - 结算：baseBet × bidMul × bombMul × springMul
 *
 * 纯 JS，无平台依赖；联机时服务端与客户端跑同一套引擎。
 */
import { createDeck, shuffle, sortCards, draw, makeCard } from './cards.js'
import { analyze, canBeat, T } from './patterns.js'
import { GAME_MODES } from './modes.js'

export const PHASE = {
  BID: 'bid', // 叫地主（可选抢）
  PLAY: 'play',
  OVER: 'over',
}

// 模式枚举统一定义在 modes.js（页面与两套引擎共享），此处转发保持旧导入路径兼容
export { GAME_MODES }

function dealSuperBomb(deck, random) {
  const ranks = shuffle(Array.from({ length: 13 }, (_, i) => i + 3), random).slice(0, 6)
  const reserved = new Set()
  const bombGroups = []

  for (const rank of ranks) {
    const group = deck.filter((card) => card.rank === rank).slice(0, 4)
    group.forEach((card) => reserved.add(card.id))
    bombGroups.push(group)
  }

  const rest = shuffle(deck.filter((card) => !reserved.has(card.id)), random)
  const bottom = sortCards(draw(rest, 3))
  const hands = [[], [], []]

  for (let seat = 0; seat < 3; seat++) {
    hands[seat].push(...bombGroups[seat * 2], ...bombGroups[seat * 2 + 1])
    hands[seat].push(...draw(rest, 9))
    hands[seat] = sortCards(hands[seat])
  }

  return { bottom, hands }
}

export class DoudizhuGame {
  /**
   * @param {Array<{id:string, name:string, isAI?:boolean, avatar?:string}>} seats 恰好 3 人
   * @param {{baseBet?:number, randomSeed?:()=>number, mode?:string}} options
   */
  constructor(seats, options = {}) {
    if (seats.length !== 3) throw new Error('斗地主需要 3 个座位')
    this.players = seats.map((p, i) => ({
      ...p,
      seat: i,
      cards: [],
      isLandlord: false,
      finished: false,
    }))
    this.baseBet = options.baseBet ?? 100
    this.random = options.randomSeed ?? Math.random
    this.mode = options.mode === GAME_MODES.SUPER_BOMB ? GAME_MODES.SUPER_BOMB : GAME_MODES.NORMAL

    this.phase = PHASE.BID
    this.bottom = []
    this.landlordSeat = null
    this.bidMul = 1
    this.bombMul = 1
    this.springMul = 1
    this.spring = null // 'spring' | 'anti-spring' | null

    // 叫地主阶段
    this.bidTurn = 0 // 当前轮到的 seat
    this.bidRounds = 0 // 叫牌轮数（最多 3 轮 call 机会）
    this.candidate = null // 当前候选地主 seat
    this.callSeat = null // 首次叫地主者；该座位获得最后一次抢/不抢机会
    this.robTurn = null // 抢地主阶段轮到谁
    this.robbedBy = new Set() // 已表态抢地主的座位（每家最多一次）

    // 出牌阶段
    this.turnSeat = 0
    this.current = null // { seat, pattern, cards } 当前台面上的最大牌
    this.passStreak = 0 // 连续过牌人数

    this.history = [] // 出牌记录 {seat, cards, pattern, type}
    this.winnerSeats = []
    this.settle = null // 结算 [{seat, delta, isLandlord}]
    this.overReason = null
  }

  // ---------- 发牌 ----------

  start() {
    const deck = shuffle(createDeck(), this.random)
    if (this.mode === GAME_MODES.SUPER_BOMB) {
      const dealt = dealSuperBomb(deck, this.random)
      this.bottom = dealt.bottom
      for (let i = 0; i < 3; i++) this.players[i].cards = dealt.hands[i]
    } else {
      this.bottom = sortCards(draw(deck, 3))
      for (let i = 0; i < 3; i++) {
        this.players[i].cards = sortCards(draw(deck, 17))
      }
    }
    this.players.forEach((player) => {
      player.isLandlord = false
      player.finished = false
    })
    // 重置倍数与对局状态，支持同实例重开
    this.bidMul = 1
    this.bombMul = 1
    this.springMul = 1
    this.spring = null
    this.landlordSeat = null
    this.candidate = null
    this.callSeat = null
    this.robTurn = null
    this.robbedBy = new Set()
    this.bidTurn = 0
    this.bidRounds = 0
    this.turnSeat = 0
    this.current = null
    this.passStreak = 0
    this.history = []
    this.seq = 0
    this.actions = []
    this.winnerSeats = []
    this.settle = null
    this.overReason = null
    this.phase = PHASE.BID
    return this.snapshot()
  }

  // ---------- 对局事件日志 ----------
  // actions 是完整对局叙事（叫/抢/出/过全部入账），history 只存出牌细节；
  // seq 每个动作自增一次，UI 用它做廉价 diff，联机回放也以此为准。

  _record(type, seat, extra) {
    this.seq += 1
    this.actions.push({ seq: this.seq, type, seat, ...extra })
  }

  // ---------- 叫地主 ----------

  /** 当前是否轮到此座位叫地主 */
  isBidTurn(seat) {
    return this.phase === PHASE.BID && this.bidTurn === seat
  }

  /** 叫地主：第一个叫者成为候选，进入抢地主流程 */
  bidCall(seat) {
    if (!this.isBidTurn(seat)) throw new Error('还轮不到你叫地主')
    this.candidate = seat
    this.callSeat = seat
    this.players[seat].isLandlord = true
    this._record('bid-call', seat)
    this.enterRob()
  }

  /** 不叫 */
  bidPass(seat) {
    if (!this.isBidTurn(seat)) throw new Error('还轮不到你')
    this._record('bid-pass', seat)
    this.bidRounds++
    if (this.bidRounds >= 3) {
      // 三家都不叫 → 作废
      this.phase = PHASE.OVER
      this.overReason = 'no-bid'
      return
    }
    this.bidTurn = (this.bidTurn + 1) % 3
  }

  enterRob() {
    this.robTurn = (this.callSeat + 1) % 3
    this.robbedBy = new Set()
  }

  isRobTurn(seat) {
    return this.phase === PHASE.BID && this.candidate !== null && this.robTurn === seat
  }

  /** 该座位当前是否还能抢（每家最多抢一次） */
  canRob(seat) {
    return this.isRobTurn(seat) && !this.robbedBy.has(seat)
  }

  /** 抢地主：其他座位依次表态，首次叫地主者最后表态；最后一手完成后立即定地主 */
  robCall(seat) {
    if (!this.isRobTurn(seat)) throw new Error('轮不到你抢')
    if (this.robbedBy.has(seat)) throw new Error('你已经抢过地主了')
    this.robbedBy.add(seat)
    this.candidate = seat
    this.bidMul *= 2
    this._record('rob-call', seat)
    if (seat === this.callSeat) {
      this.finishBid()
      return
    }
    this.robTurn = (seat + 1) % 3
  }

  robPass(seat) {
    if (!this.isRobTurn(seat)) throw new Error('轮不到你')
    this._record('rob-pass', seat)
    if (seat === this.callSeat) {
      this.finishBid()
      return
    }
    this.robTurn = (seat + 1) % 3
  }

  finishBid() {
    const seat = this.candidate
    this.landlordSeat = seat
    for (let i = 0; i < 3; i++) this.players[i].isLandlord = i === seat
    this.players[seat].cards = sortCards([...this.players[seat].cards, ...this.bottom])
    this.robTurn = null
    this.phase = PHASE.PLAY
    this.turnSeat = seat
    this.current = null
    this.passStreak = 0
  }

  // ---------- 出牌 ----------

  isPlayTurn(seat) {
    return this.phase === PHASE.PLAY && this.turnSeat === seat
  }

  /** 当前必须出牌（新一轮），不能过 */
  mustPlay(seat) {
    return this.isPlayTurn(seat) && (this.current === null || this.current.seat === seat)
  }

  /** 出牌；cards 为 [{id}] 数组 */
  play(seat, cards) {
    if (!this.isPlayTurn(seat)) throw new Error('还轮不到你出牌')
    const hand = this.players[seat].cards
    const ids = cards.map((c) => c.id)
    // 校验牌在手牌中
    for (const id of ids) {
      if (!hand.some((c) => c.id === id)) throw new Error('牌不在手牌里')
    }
    const pattern = analyze(cards)
    if (!pattern) throw new Error('不成牌型')
    if (!canBeat(this.current?.pattern, pattern)) throw new Error('压不过上家')

    // 从手牌移除
    for (const id of ids) {
      const idx = hand.findIndex((c) => c.id === id)
      hand.splice(idx, 1)
    }
    this.current = { seat, pattern, cards }
    this.passStreak = 0
    if (pattern.type === T.BOMB || pattern.type === T.ROCKET) this.bombMul *= 2
    this.history.push({ seat, cards, pattern })
    this._record('play', seat, { cards: cards.length })
    this.turnSeat = (seat + 1) % 3

    if (hand.length === 0) {
      this.finishPlay(seat)
    }
  }

  pass(seat) {
    if (!this.isPlayTurn(seat)) throw new Error('还轮不到你')
    if (this.mustPlay(seat)) throw new Error('必须出牌')
    this.passStreak++
    this.history.push({ seat, pass: true })
    this._record('pass', seat)
    this.turnSeat = (seat + 1) % 3
    // 两家都过 → 上家新一轮自由出牌
    if (this.passStreak >= 2) {
      this.current = null
      this.passStreak = 0
      // 新一轮由刚才出牌者开始
      const lastPlay = [...this.history].reverse().find((h) => h.pattern)
      if (lastPlay) this.turnSeat = lastPlay.seat
    }
  }

  finishPlay(winSeat) {
    this.phase = PHASE.OVER
    this.overReason = 'finished'
    this.winnerSeats = [winSeat]
    this.spring = this.detectSpring(winSeat)
    this.springMul = this.spring ? 2 : 1
    this.settle = this.calcSettle()
  }

  /** 春天：地主赢且农民一手未出；反春：农民赢且地主只出过首手 */
  detectSpring(winSeat) {
    const plays = this.history.filter((h) => h.pattern)
    const landlordPlays = plays.filter((h) => h.seat === this.landlordSeat).length
    const farmerPlays = plays.length - landlordPlays
    if (this.players[winSeat].isLandlord) return farmerPlays === 0 ? 'spring' : null
    return landlordPlays <= 1 ? 'anti-spring' : null
  }

  calcSettle() {
    const winSeat = this.winnerSeats[0]
    const landlordWins = this.players[winSeat].isLandlord
    const mul = this.baseBet * this.bidMul * this.bombMul * (this.springMul || 1)
    // 地主赢：收两家各 mul；地主输：赔两家各 mul（合计守恒为 0）
    return this.players.map((p) => {
      if (p.isLandlord) {
        return { seat: p.seat, delta: landlordWins ? 2 * mul : -2 * mul, isLandlord: true }
      }
      return { seat: p.seat, delta: landlordWins ? -mul : mul, isLandlord: false }
    })
  }

  /** 序列化给 UI / 联机传输 */
  snapshot(observerSeat = -1) {
    return {
      phase: this.phase,
      mode: this.mode,
      bottom: this.landlordSeat === null ? null : this.bottom, // 地主未定前不下发底牌
      landlordSeat: this.landlordSeat,
      bidMul: this.bidMul,
      bombMul: this.bombMul,
      springMul: this.springMul,
      spring: this.spring,
      bidTurn: this.bidTurn,
      bidRounds: this.bidRounds,
      candidate: this.candidate,
      callSeat: this.callSeat,
      robTurn: this.robTurn,
      robbedBy: [...this.robbedBy],
      turnSeat: this.turnSeat,
      current: this.current && { seat: this.current.seat, pattern: this.current.pattern, cards: this.current.cards },
      passStreak: this.passStreak,
      players: this.players.map((p) => ({
        id: p.id,
        seat: p.seat,
        name: p.name,
        isAI: p.isAI,
        avatar: p.avatar,
        isLandlord: p.isLandlord,
        cardCount: p.cards.length,
        cards: observerSeat === p.seat || (this.phase === PHASE.OVER && this.overReason === 'finished') ? p.cards : null,
      })),
      history: this.history.map((h) =>
        h.pass ? { seat: h.seat, pass: true } : { seat: h.seat, pattern: h.pattern, cards: h.cards }
      ),
      seq: this.seq,
      actions: this.actions.map((a) => ({ ...a })),
      overReason: this.overReason,
      winnerSeats: this.winnerSeats,
      settle: this.settle,
      baseBet: this.baseBet,
    }
  }
}
