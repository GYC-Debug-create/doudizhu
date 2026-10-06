/**
 * 对局反馈：把对局事件翻译成音效 / 语音台词 / 全屏特效。
 * “什么事件配什么反馈”是纯数据（playCue / bidCue / settleCue），台词变体在 voice-lines.js；
 * 播放器通过参数注入，可在 Node 单测。
 */
import { T } from '../game/patterns.js'

const DZ_FX = {
  [T.BOMB]: { kind: 'bomb', text: '炸弹', sfx: 'bomb', dur: 1300, showMul: true },
  [T.ROCKET]: { kind: 'rocket', text: '王炸', sfx: 'rocket', dur: 1600, showMul: true },
  [T.PLANE]: { kind: 'plane', text: '飞机', sfx: 'plane', dur: 1100 },
  [T.PLANE_SOLO]: { kind: 'plane', text: '飞机', sfx: 'plane', dur: 1100 },
  [T.PLANE_PAIR]: { kind: 'plane', text: '飞机', sfx: 'plane', dur: 1100 },
  [T.STRAIGHT]: { kind: 'combo', text: '顺子', sfx: 'combo', dur: 900 },
  [T.STRAIGHT_PAIR]: { kind: 'combo', text: '连对', sfx: 'combo', dur: 900 },
}

const GD_FX = {
  BOMB: { kind: 'bomb', text: '炸弹', sfx: 'bomb', dur: 1300 },
  STRAIGHT_FLUSH: { kind: 'bomb', text: '同花顺', sfx: 'bomb', dur: 1300 },
  ROCKET: { kind: 'rocket', text: '四王', sfx: 'rocket', dur: 1300 },
}

// 牌型 → 台词 key（单张/对子/三张按点数）
const DZ_LINE = {
  [T.TRIPLE_SOLO]: 'triple-solo',
  [T.TRIPLE_PAIR]: 'triple-pair',
  [T.STRAIGHT]: 'straight',
  [T.STRAIGHT_PAIR]: 'straight-pair',
  [T.PLANE]: 'plane',
  [T.PLANE_SOLO]: 'plane',
  [T.PLANE_PAIR]: 'plane',
  [T.BOMB]: 'bomb',
  [T.ROCKET]: 'rocket',
}
const GD_LINE = {
  TRIPLE_PAIR: 'gd-triple-pair',
  STRAIGHT: 'straight',
  STRAIGHT_PAIR: 'gd-straight-pair',
  STEEL: 'gd-steel',
  PLANE: 'plane',
  STRAIGHT_FLUSH: 'gd-straight-flush',
  BOMB: 'bomb',
  ROCKET: 'gd-rocket',
}
const RANKED = { SOLO: 'solo', PAIR: 'pair', TRIPLE: 'triple' }
// 跟牌压过对手时，这些普通牌型有一定概率改喊“大你 / 管上 / 压死”
const TAUNTABLE = new Set(['SOLO', 'PAIR', 'TRIPLE', 'TRIPLE_SOLO', 'TRIPLE_PAIR'])
const TAUNT_CHANCE = 0.3
// 轮到你超过这么久还没出，AI 会催
const HURRY_MS = 18000

function patternLine(game, pattern) {
  if (!pattern) return null
  const ranked = RANKED[pattern.type]
  if (ranked) return pattern.rank >= 3 && pattern.rank <= 17 ? `${ranked}-${pattern.rank}` : null
  return (game === 'guandan' ? GD_LINE : DZ_LINE)[pattern.type] || null
}

/**
 * 一次出牌/过牌对应的反馈
 * @param ctx { lead, mate, random }  lead: 是否领出；mate: 台面上的牌是否是队友出的
 * @returns {{ sfx: string, line: string|null, fx: null | {kind, text, dur, showMul?} }}
 */
export function playCue(game, action, { lead = true, mate = false, random = Math.random } = {}) {
  if (action.pass) return { sfx: 'pass', line: mate ? 'pass-mate' : 'pass', fx: null }
  const type = action.pattern && action.pattern.type
  const fx = (game === 'guandan' ? GD_FX : DZ_FX)[type] || null
  let line = patternLine(game, action.pattern)
  if (!lead && !mate && TAUNTABLE.has(type) && random() < TAUNT_CHANCE) line = 'beat'
  return { sfx: fx ? fx.sfx : 'play', line, fx }
}

export function bidCue(kind) {
  return { sfx: kind === 'bid-call' || kind === 'rob-call' ? 'select' : 'pass', line: kind }
}

/**
 * 结算反应：由一个 AI 替“输赢的另一方”发声——你赢了，输家 AI 叹气；你输了，赢家 AI 得意。
 * @returns {{ sfx, seat: number|null, line: string|null }}
 */
export function settleCue({ settle = [], spring = null }) {
  const mine = settle.find((row) => row.seat === 0)
  const won = !!mine && mine.delta > 0
  const winners = settle.filter((row) => row.delta > 0).map((row) => row.seat)
  if (spring) return { sfx: 'spring', seat: winners[0] ?? 0, line: spring, won }
  const reactor = settle.find((row) => row.seat !== 0 && (won ? row.delta < 0 : row.delta > 0))
  return { sfx: won ? 'win' : 'lose', seat: reactor ? reactor.seat : null, line: reactor ? (won ? 'lose' : 'win') : null, won }
}

export function createFeedback({ sfx, speak, waitAudio, showFx, random = Math.random, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let alerted = {}
  let lastTurnKey = ''
  let hurryTimer = null
  let epoch = 0 // 每局自增：上一局还在等待中的反馈（如结算音）醒来后发现过期就放弃

  const cancelHurry = () => {
    if (hurryTimer !== null) clearTimer(hurryTimer)
    hurryTimer = null
  }

  return {
    reset() {
      alerted = {}
      lastTurnKey = ''
      cancelHurry()
      epoch += 1
    },

    play({ game, action, lead, mate, totalMul }) {
      const cue = playCue(game, action, { lead, mate, random })
      sfx(cue.sfx)
      if (cue.fx) showFx(cue.fx.kind, cue.fx.text, cue.fx.showMul ? `倍数 ×${totalMul}` : '', cue.fx.dur)
      if (cue.line) speak(action.seat, cue.line)
    },

    bid({ seat, kind }) {
      const cue = bidCue(kind)
      sfx(cue.sfx)
      speak(seat, cue.line)
    },

    landlord() {
      sfx('landlord')
    },

    /** 报单 / 报双：每家每个数量只提醒一次，台词排在该家出牌播报之后 */
    alarms(snap) {
      if (!snap || snap.phase !== 'play') return
      for (const p of snap.players || []) {
        if (p.seat === 0 || !p.cardCount || p.cardCount > 2) continue
        const key = `${p.seat}:${p.cardCount}`
        if (alerted[key]) continue
        alerted[key] = true
        sfx('alarm')
        speak(p.seat, `alarm-${p.cardCount}`, { queue: true })
      }
    },

    /** 轮到自己：等上家声音播完再响提示音；拖太久没出，AI 会催 */
    turn(snap, { autoPlay = false } = {}) {
      if (!snap || snap.phase !== 'play') {
        cancelHurry()
        return
      }
      const myTurn = snap.turnSeat === 0 && !autoPlay
      const key = myTurn ? `${snap.seq}` : ''
      if (key !== lastTurnKey) {
        cancelHurry()
        if (myTurn) {
          waitAudio().then(() => {
            if (lastTurnKey === key) sfx('turn')
          })
          const others = (snap.players || []).map((p) => p.seat).filter((seat) => seat !== 0)
          hurryTimer = setTimer(() => {
            hurryTimer = null
            if (lastTurnKey === key && others.length) speak(others[Math.floor(random() * others.length)], 'hurry')
          }, HURRY_MS)
        }
      }
      lastTurnKey = key
    },

    /** 结算：等最后一手播报说完，再响胜负音 / 春天特效，并由一个 AI 发表感想 */
    settle({ settle, spring }) {
      const mine = epoch
      cancelHurry()
      const cue = settleCue({ settle, spring })
      waitAudio()
        .then(() => new Promise((resolve) => setTimer(resolve, 200)))
        .then(() => {
          if (mine !== epoch) return
          sfx(cue.sfx)
          if (spring) showFx('spring', spring === 'spring' ? '春天' : '反春', '倍数 ×2', 1800)
          if (cue.line && cue.seat !== null) speak(cue.seat, cue.line, { queue: true })
        })
    },
  }
}
