import { createDeck, draw, shuffle } from '../cards.js'
import {
  analyzeGuandan,
  canBeatGuandan,
  guandanCardValue,
  isGuandanWild,
  normalizeGuandanLevel,
  sortGuandanCards,
} from './patterns.js'

export const GD_PHASE = {
  PLAY: 'play',
  OVER: 'over',
}

export const GD_TEAMS = [0, 1, 0, 1]
export const GD_LEVELS = [15, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

export function createDoubleDeck() {
  return [0, 1].flatMap((copy) => createDeck().map((card) => ({ ...card, id: `${copy}-${card.id}`, copy })))
}

export function nextGuandanLevel(level, gain) {
  const normalizedLevel = normalizeGuandanLevel(level)
  const index = GD_LEVELS.indexOf(normalizedLevel)
  if (index < 0) return normalizedLevel
  return GD_LEVELS[Math.min(GD_LEVELS.length - 1, index + gain)]
}

function isFirstLeadCard(card) {
  return card.rank === 3 && card.suit === 0
}

function isBigJoker(card) {
  return card.rank === 17
}

function removeCard(player, card) {
  const index = player.cards.findIndex((item) => item.id === card.id)
  if (index < 0) throw new Error('进贡牌不在手牌里')
  player.cards.splice(index, 1)
}

function compareCardsDesc(a, b, level) {
  return guandanCardValue(b, level) - guandanCardValue(a, level) || String(a.id).localeCompare(String(b.id))
}

function maxTributeCard(player, level) {
  const normalCards = player.cards.filter((card) => !isGuandanWild(card, level))
  const cards = normalCards.length ? normalCards : player.cards
  return cards.slice().sort((a, b) => compareCardsDesc(a, b, level))[0]
}

function canReturnCard(card, level) {
  if (!card || isGuandanWild(card, level)) return false
  // 打10时，10是级牌，不作为还牌；其它级牌仍按原牌点计入2至10。
  if (level === 10 && card.rank === 10) return false
  const point = card.rank === 15 ? 2 : card.rank
  return point >= 2 && point <= 10
}

function returnCard(player, level) {
  const eligible = player.cards.filter((card) => canReturnCard(card, level))
  const candidates = eligible.length
    ? eligible
    : player.cards.filter((card) => !isGuandanWild(card, level))
  return candidates.slice().sort((a, b) => guandanCardValue(a, level) - guandanCardValue(b, level))[0] || player.cards[0]
}

export class GuandanGame {
  /**
   * @param {Array<{id:string,name:string,isAI?:boolean,team?:number}>} seats 恰好 4 人
   * @param {{baseBet?:number, randomSeed?:()=>number, level?:number}} options
   */
  constructor(seats, options = {}) {
    if (!Array.isArray(seats) || seats.length !== 4) throw new Error('掼蛋需要 4 个座位')
    this.players = seats.map((player, seat) => ({
      ...player,
      seat,
      team: GD_TEAMS[seat],
      cards: [],
      finished: false,
    }))
    this.baseBet = options.baseBet ?? 100
    this.random = options.randomSeed ?? Math.random
    this.startLevel = normalizeGuandanLevel(options.level ?? 15)
    this.level = this.startLevel
    this.teamLevels = [this.level, this.level]

    this.phase = GD_PHASE.PLAY
    this.handNumber = 0
    this.firstSeat = null
    this.turnSeat = 0
    this.current = null
    this.passStreak = 0
    this.history = []
    this.seq = 0
    this.actions = []
    this.finishOrder = []
    this.roundResult = null
    this.lastRoundResult = null
    this.lastTribute = null
    this.settle = null
  }

  dealHand() {
    const deck = shuffle(createDoubleDeck(), this.random)
    for (let seat = 0; seat < 4; seat++) {
      this.players[seat].cards = sortGuandanCards(draw(deck, 27), this.level)
      this.players[seat].finished = false
    }
  }

  resetHandState() {
    this.phase = GD_PHASE.PLAY
    this.current = null
    this.passStreak = 0
    this.history = []
    this.seq = 0
    this.actions = []
    this.finishOrder = []
    this.roundResult = null
    this.settle = null
  }

  // ---------- 对局事件日志 ----------
  // 与斗地主引擎同构：actions 记完整叙事（出/过/进贡抗贡），history 只存出牌细节；
  // seq 每动作自增，UI 用它做廉价 diff，回放以此为准。

  _record(type, seat, extra) {
    this.seq += 1
    this.actions.push({ seq: this.seq, type, seat, hand: this.handNumber, ...extra })
  }

  start() {
    this.level = this.startLevel
    this.teamLevels = [this.level, this.level]
    this.handNumber = 1
    this.lastRoundResult = null
    this.lastTribute = null
    this.resetHandState()
    this.dealHand()
    this.firstSeat = this.players.find((player) => player.cards.some(isFirstLeadCard))?.seat ?? 0
    this.turnSeat = this.firstSeat
    return this.snapshot(0)
  }

  /** 完成本副牌后开始下一副，自动执行标准贡牌、还牌和抗贡流程。 */
  startNextHand() {
    if (this.phase !== GD_PHASE.OVER || !this.roundResult) throw new Error('当前还不能开始下一副牌')
    const previous = this.roundResult
    this.lastRoundResult = previous
    this.level = previous.nextLevel
    this.teamLevels = [this.level, this.level]
    this.handNumber = previous.handNumber + 1
    this.lastTribute = null
    this.resetHandState()
    this.dealHand()

    const tribute = this.applyTribute(previous)
    this.lastTribute = tribute
    this._record(tribute.skipped ? 'anti-tribute' : tribute.type === 'double' ? 'tribute-double' : 'tribute-single', tribute.leadSeat, {
      leadSeat: tribute.leadSeat,
    })
    this.turnSeat = tribute.leadSeat
    return this.snapshot(0)
  }

  isWild(card) {
    return isGuandanWild(card, this.level)
  }

  isPlayTurn(seat) {
    return this.phase === GD_PHASE.PLAY && this.turnSeat === seat && !this.players[seat]?.finished
  }

  activeSeats() {
    return this.players.filter((player) => !player.finished).map((player) => player.seat)
  }

  nextActiveSeat(seat) {
    for (let step = 1; step <= 4; step++) {
      const next = (seat + step) % 4
      if (!this.players[next].finished) return next
    }
    return null
  }

  mustPlay(seat) {
    return this.isPlayTurn(seat) && (this.current === null || this.current.seat === seat)
  }

  play(seat, cards) {
    if (!this.isPlayTurn(seat)) throw new Error('还轮不到你出牌')
    if (!Array.isArray(cards) || !cards.length) throw new Error('请选择要出的牌')
    const ids = cards.map((card) => card.id)
    if (new Set(ids).size !== ids.length) throw new Error('同一张牌不能重复出')

    const hand = this.players[seat].cards
    for (const id of ids) {
      if (!hand.some((card) => card.id === id)) throw new Error('牌不在手牌里')
    }

    const pattern = analyzeGuandan(cards, this.level)
    if (!pattern) throw new Error('不成掼蛋牌型')
    if (!canBeatGuandan(this.current?.pattern, pattern)) throw new Error('压不过上家')

    for (const id of ids) {
      const index = hand.findIndex((card) => card.id === id)
      hand.splice(index, 1)
    }
    this.current = { seat, pattern, cards: cards.slice() }
    this.passStreak = 0
    this.history.push({ seat, cards: cards.slice(), pattern })
    this._record('play', seat, { cards: cards.length })

    if (hand.length === 0) {
      this.recordFinish(seat)
      const firstTwoArePartners = this.finishOrder.length >= 2 &&
        GD_TEAMS[this.finishOrder[0]] === GD_TEAMS[this.finishOrder[1]]
      if (firstTwoArePartners || this.finishOrder.length >= 3) {
        this.finishRound()
        return
      }
    }
    this.turnSeat = this.nextActiveSeat(seat)
  }

  pass(seat) {
    if (!this.isPlayTurn(seat)) throw new Error('还轮不到你')
    if (this.mustPlay(seat)) throw new Error('新一轮必须出牌')
    this.passStreak++
    this.history.push({ seat, pass: true })
    this._record('pass', seat)

    const activeCount = this.activeSeats().length
    const currentOwnerActive = this.current && !this.players[this.current.seat].finished
    const passLimit = currentOwnerActive ? activeCount - 1 : activeCount
    if (this.passStreak >= Math.max(1, passLimit)) {
      const leadSeat = this.nextLeadSeat()
      this.current = null
      this.passStreak = 0
      this.turnSeat = leadSeat
      return
    }
    this.turnSeat = this.nextActiveSeat(seat)
  }

  nextLeadSeat() {
    if (this.current && !this.players[this.current.seat].finished) return this.current.seat
    if (this.current) {
      const partner = (this.current.seat + 2) % 4
      if (!this.players[partner].finished) return partner
      return this.nextActiveSeat(this.current.seat)
    }
    return this.turnSeat
  }

  recordFinish(seat) {
    if (!this.players[seat]) throw new Error('无效座位')
    if (!this.finishOrder.includes(seat)) {
      this.finishOrder.push(seat)
      this.players[seat].finished = true
    }
  }

  finishRound() {
    if (this.finishOrder.length < 2) throw new Error('至少需要产生上游和二游')
    const firstSeat = this.finishOrder[0]
    const winnerTeam = GD_TEAMS[firstSeat]
    const doubleDown = GD_TEAMS[this.finishOrder[1]] === winnerTeam

    if (!doubleDown && this.finishOrder.length < 4) {
      const lastSeat = this.players.find((player) => !player.finished)?.seat
      if (lastSeat !== undefined) this.recordFinish(lastSeat)
    }

    const firstAndThirdSame = this.finishOrder.length >= 3 && GD_TEAMS[this.finishOrder[2]] === winnerTeam
    const outcome = doubleDown ? 'double' : firstAndThirdSame ? 'single' : 'one'
    const levelGain = doubleDown ? 3 : firstAndThirdSame ? 2 : 1
    const previousLevel = this.level
    const nextLevel = nextGuandanLevel(previousLevel, levelGain)
    this.teamLevels[winnerTeam] = nextLevel

    this.roundResult = {
      handNumber: this.handNumber,
      winnerTeam,
      outcome,
      levelGain,
      previousLevel,
      nextLevel,
      finishOrder: this.finishOrder.slice(),
      matchWinnerTeam: previousLevel === 14 && outcome !== 'one' ? winnerTeam : null,
    }
    const amount = this.baseBet * levelGain
    this.settle = this.players.map((player) => ({
      seat: player.seat,
      team: player.team,
      delta: player.team === winnerTeam ? amount : -amount,
    }))
    this.phase = GD_PHASE.OVER
  }

  applyTribute(previous) {
    const firstSeat = previous.finishOrder[0]
    const winnerTeam = previous.winnerTeam
    const doubleDown = previous.outcome === 'double'
    const losers = doubleDown
      ? this.players.filter((player) => player.team !== winnerTeam)
      : [this.players[previous.finishOrder[previous.finishOrder.length - 1]]]
    const bigJokers = losers.reduce((count, player) => count + player.cards.filter(isBigJoker).length, 0)

    if (bigJokers >= 2) {
      return {
        type: doubleDown ? 'double' : 'single',
        skipped: true,
        reason: 'anti-tribute',
        gifts: [],
        leadSeat: firstSeat,
      }
    }

    if (doubleDown) {
      const winners = [this.players[previous.finishOrder[0]], this.players[previous.finishOrder[1]]]
      const gifts = losers.map((player) => ({ from: player, card: maxTributeCard(player, this.level) }))
      gifts.sort((a, b) => compareCardsDesc(a.card, b.card, this.level))

      const records = []
      for (let i = 0; i < gifts.length; i++) {
        const gift = gifts[i]
        const receiver = winners[i]
        const given = gift.card
        const returned = returnCard(receiver, this.level)
        removeCard(gift.from, given)
        removeCard(receiver, returned)
        receiver.cards.push(given)
        gift.from.cards.push(returned)
        records.push({ from: gift.from.seat, to: receiver.seat, card: given, returnCard: returned })
      }
      this.players.forEach((player) => {
        player.cards = sortGuandanCards(player.cards, this.level)
      })
      return {
        type: 'double',
        skipped: false,
        reason: 'tribute',
        gifts: records,
        leadSeat: gifts[0].from.seat,
      }
    }

    const giver = losers[0]
    const receiver = this.players[firstSeat]
    const given = maxTributeCard(giver, this.level)
    const returned = returnCard(receiver, this.level)
    removeCard(giver, given)
    removeCard(receiver, returned)
    receiver.cards.push(given)
    giver.cards.push(returned)
    this.players.forEach((player) => {
      player.cards = sortGuandanCards(player.cards, this.level)
    })
    return {
      type: 'single',
      skipped: false,
      reason: 'tribute',
      gifts: [{ from: giver.seat, to: receiver.seat, card: given, returnCard: returned }],
      leadSeat: giver.seat,
    }
  }

  snapshot(observerSeat = -1) {
    return {
      mode: 'guandan',
      phase: this.phase,
      handNumber: this.handNumber,
      level: this.level,
      teamLevels: this.teamLevels.slice(),
      firstSeat: this.firstSeat,
      turnSeat: this.turnSeat,
      current: this.current && {
        seat: this.current.seat,
        pattern: this.current.pattern,
        cards: this.current.cards,
      },
      passStreak: this.passStreak,
      history: this.history.map((entry) =>
        entry.pass
          ? { seat: entry.seat, pass: true }
          : { seat: entry.seat, pattern: entry.pattern, cards: entry.cards }
      ),
      finishOrder: this.finishOrder.slice(),
      roundResult: this.roundResult,
      lastRoundResult: this.lastRoundResult,
      lastTribute: this.lastTribute,
      seq: this.seq,
      actions: this.actions.map((a) => ({ ...a })),
      settle: this.settle,
      baseBet: this.baseBet,
      players: this.players.map((player) => ({
        id: player.id,
        seat: player.seat,
        name: player.name,
        isAI: player.isAI,
        team: player.team,
        finished: player.finished,
        cardCount: player.cards.length,
        cards: observerSeat === player.seat || this.phase === GD_PHASE.OVER ? player.cards : null,
      })),
    }
  }
}
