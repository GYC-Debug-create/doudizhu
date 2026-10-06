/**
 * 双游戏控制器：把斗地主 / 掼蛋两套引擎统一到同一接口。
 *
 * 控制器持有引擎实例（引擎活在响应式图之外，snapshot 是唯一数据通道），负责快照 diff，
 * 并把“发生了什么”作为事件 emit 出去；谁关心谁订阅（展示动画 / 音效 / 节奏 / 档案），控制器一概不知。
 *
 * 统一接口：
 *   start(options)        新开一局（dz: {mode}，掼蛋: {level}）
 *   play/pass/bid/...     玩家动作（引擎抛错 → 'error' 事件）
 *   aiStep(seat)          AI 一步行动
 *   currentAISeat()       当前该行动的 AI 座位（无则 null）
 *   hint(seat)            提示（斗地主：同一手内循环候选）
 *   nextHand()            仅掼蛋：{outcome:'next',level} | {outcome:'restart'}
 *
 * 事件（payload 均带 game: 'doudizhu' | 'guandan'）：
 *   snap { snap }               每次刷新后的最新快照
 *   play { action, seq, lead, mate }  新出牌或过牌；lead = 是否领出新一轮，
 *                               mate = 台面上的牌是否是队友出的（过牌时用来区分“让队友”与“要不起”）
 *   bid { seat, kind }          新叫/抢表态（kind: bid-call 等，仅斗地主）
 *   trick                       台面出牌/过牌更新
 *   bottom { cards }            底牌确定（仅斗地主）
 *   no-bid                      无人叫地主（仅斗地主）
 *   finish                      进入终局（揭示剩余手牌）
 *   level { level }             掼蛋副结算升级
 *   settle { settle, snap }     本局结算（每局只发一次）
 *   refreshed { snap }          本轮刷新完成（订阅者据此调度 AI / 检查报单）
 *   error { error }
 */
import { DoudizhuGame, PHASE } from '../game/rules.js'
import { GuandanGame, GD_PHASE, GD_TEAMS } from '../game/guandan/rules.js'
import { aiBid, aiRob, aiPlay, hintCandidates } from '../game/ai.js'
import { aiGuandanPlay, aiGuandanHint } from '../game/guandan/ai.js'

const BID_ACTION_TYPES = new Set(['bid-call', 'bid-pass', 'rob-call', 'rob-pass'])
const isPlayType = (type) => type === 'play' || type === 'pass'

/** 本次出牌/过牌之前，台面归谁：领出与队友判断都基于它 */
function playContext(prev, action, sameTeam) {
  const owner = prev.current ? prev.current.seat : null
  const lead = owner === null || owner === action.seat
  return { lead, mate: !lead && sameTeam(owner, action.seat) }
}

/** 两个控制器共用的骨架：快照 diff + 动作执行 + 事件发射 */
function createBase(game, emit, diff) {
  const state = { engine: null, prev: null }
  const send = (type, payload = {}) => emit(type, { game, ...payload })

  const refresh = () => {
    const snap = state.engine.snapshot(0)
    const prev = state.prev
    state.prev = snap
    send('snap', { snap })
    if (prev) diff(snap, prev, send)
    send('refreshed', { snap })
  }

  const run = (fn) => {
    try {
      fn()
    } catch (error) {
      send('error', { error })
    }
    refresh()
  }

  return { state, refresh, run, send }
}

export function createDoudizhuController({ seats, emit }) {
  let autoPlay = false // 托管：座位 0 交给 AI
  let hintList = null // 提示候选（同一手内循环），seq 变化即失效
  let hintSeq = -1
  let hintIndex = 0

  const isAISeat = (seat) => !!(seats[seat] && (seats[seat].isAI || (seat === 0 && autoPlay)))

  const { state, refresh, run } = createBase('doudizhu', emit, (snap, prev, send) => {
    if (snap.seq !== prev.seq) {
      const latest = snap.actions[snap.actions.length - 1]
      if (latest && isPlayType(latest.type)) send('trick')
      if (latest && BID_ACTION_TYPES.has(latest.type)) send('bid', { seat: latest.seat, kind: latest.type })
    }
    if (snap.history.length > prev.history.length) {
      const action = snap.history[snap.history.length - 1]
      const farmers = (a, b) => snap.landlordSeat !== null && a !== snap.landlordSeat && b !== snap.landlordSeat
      send('play', { action, seq: snap.seq, ...playContext(prev, action, farmers) })
    }
    if (!prev.bottom && snap.bottom) send('bottom', { cards: snap.bottom })
    if (snap.phase === PHASE.OVER && prev.phase !== PHASE.OVER) {
      if (snap.overReason === 'no-bid') send('no-bid')
      if (snap.overReason === 'finished') send('finish')
      if (snap.settle) send('settle', { settle: snap.settle, snap })
    }
  })
  const engine = () => state.engine

  return {
    start({ mode, random } = {}) {
      state.engine = new DoudizhuGame(seats, { mode, randomSeed: random })
      state.engine.start()
      state.prev = null
      hintList = null
      refresh()
    },

    play(seat, cards) {
      run(() => engine().play(seat, cards))
    },
    pass(seat) {
      run(() => engine().pass(seat))
    },
    bid(seat) {
      run(() => engine().bidCall(seat))
    },
    bidPass(seat) {
      run(() => engine().bidPass(seat))
    },
    rob(seat) {
      run(() => engine().robCall(seat))
    },
    robPass(seat) {
      run(() => engine().robPass(seat))
    },

    /** 提示：第一次给 AI 推荐，再按依次循环其余可出牌型；返回 null 表示没有牌大过上家 */
    hint(seat = 0) {
      const g = engine()
      if (!g || g.phase !== PHASE.PLAY) return null
      if (!hintList || hintSeq !== g.seq) {
        hintList = hintCandidates(g, seat)
        hintSeq = g.seq
        hintIndex = 0
      }
      if (!hintList.length) return null
      const cards = hintList[hintIndex % hintList.length]
      hintIndex += 1
      return cards
    },

    /** 跟牌时手里是否有能压过上家的牌（UI 用于“要不起”） */
    canFollow(seat = 0) {
      const g = engine()
      if (!g || g.phase !== PHASE.PLAY || g.turnSeat !== seat) return true
      if (g.current === null || g.current.seat === seat) return true
      return hintCandidates(g, seat).length > 0
    },

    setAutoPlay(on) {
      autoPlay = !!on
    },

    aiStep(seat) {
      const g = engine()
      run(() => {
        if (g.phase === PHASE.BID) {
          if (g.candidate === null) {
            if (seat === g.bidTurn && isAISeat(seat)) {
              if (aiBid(g, seat)) g.bidCall(seat)
              else g.bidPass(seat)
            }
          } else if (g.canRob(seat)) {
            if (aiRob(g, seat)) g.robCall(seat)
            else g.robPass(seat)
          } else {
            g.robPass(seat)
          }
        } else if (g.phase === PHASE.PLAY && seat === g.turnSeat) {
          const cards = aiPlay(g, seat)
          if (cards && cards.length) g.play(seat, cards)
          else g.pass(seat)
        }
      })
    },

    currentAISeat() {
      const s = state.prev
      if (!s) return null
      if (s.phase === PHASE.BID) {
        if (s.candidate === null) return isAISeat(s.bidTurn) ? s.bidTurn : null
        if (s.robTurn !== null && isAISeat(s.robTurn) && !(s.robbedBy || []).includes(s.robTurn)) return s.robTurn
        return null
      }
      if (s.phase === PHASE.PLAY) return isAISeat(s.turnSeat) ? s.turnSeat : null
      return null
    },
  }
}

export function createGuandanController({ seats, emit }) {
  const { state, refresh, run } = createBase('guandan', emit, (snap, prev, send) => {
    if (snap.seq !== prev.seq) {
      const latest = snap.actions[snap.actions.length - 1]
      if (latest && isPlayType(latest.type)) send('trick')
    }
    if (snap.history.length > prev.history.length) {
      const action = snap.history[snap.history.length - 1]
      send('play', { action, seq: snap.seq, ...playContext(prev, action, (a, b) => GD_TEAMS[a] === GD_TEAMS[b]) })
    }
    if (snap.phase === GD_PHASE.OVER && prev.phase !== GD_PHASE.OVER) {
      if (snap.roundResult) {
        send('finish')
        send('level', { level: snap.roundResult.nextLevel })
      }
      if (snap.settle) send('settle', { settle: snap.settle, snap })
    }
  })
  const engine = () => state.engine

  return {
    start({ level } = {}) {
      state.engine = new GuandanGame(seats, { baseBet: 100, level })
      state.engine.start()
      state.prev = null
      refresh()
    },

    play(seat, cards) {
      run(() => engine().play(seat, cards))
    },
    pass(seat) {
      run(() => engine().pass(seat))
    },

    /** 提示：结合当前已选牌给出建议（掼蛋 AI 支持在已选基础上补牌） */
    hint(seat = 0, selectionIds = []) {
      return aiGuandanHint(engine(), seat, selectionIds)
    },

    /** 完成本副后开下一副；整局打完时返回 'restart' 由页面重置等级并重开 */
    nextHand() {
      const g = engine()
      if (!g || g.phase !== GD_PHASE.OVER || !g.roundResult) return { outcome: 'restart' }
      const result = g.roundResult
      if (result.matchWinnerTeam !== null && result.matchWinnerTeam !== undefined) {
        return { outcome: 'restart', matchWinner: true }
      }
      g.startNextHand()
      state.prev = null
      refresh()
      return { outcome: 'next', level: g.level }
    },

    aiStep(seat) {
      const g = engine()
      if (g.phase !== GD_PHASE.PLAY || g.turnSeat !== seat) return
      run(() => {
        const cards = aiGuandanPlay(g, seat)
        if (cards && cards.length) g.play(seat, cards)
        else if (!g.mustPlay(seat)) g.pass(seat)
        else {
          const fallback = g.players[seat].cards[0]
          if (fallback) g.play(seat, [fallback])
        }
      })
    },

    currentAISeat() {
      const s = state.prev
      if (!s || s.phase !== GD_PHASE.PLAY) return null
      const seat = s.turnSeat
      return seats[seat] && seats[seat].isAI ? seat : null
    },
  }
}
