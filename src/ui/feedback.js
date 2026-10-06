/**
 * 对局反馈：把对局事件翻译成音效 / 语音 / 全屏特效。
 * “什么事件配什么反馈”是纯数据（playCue），播放器通过参数注入，可在 Node 单测。
 */
import { T } from '../game/patterns.js'
import { patternCallout, passCallout } from './sound.js'

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

const BID_WORDS = { 'bid-call': '叫地主', 'bid-pass': '不叫', 'rob-call': '抢地主', 'rob-pass': '不抢' }

/**
 * 一次出牌/过牌对应的反馈
 * @returns {{ sfx: string, say: string, fx: null | {kind, text, dur, showMul?} }}
 */
export function playCue(game, action, seq = 0) {
  if (action.pass) return { sfx: 'pass', say: passCallout(action.seat + seq), fx: null }
  const type = action.pattern && action.pattern.type
  if (game === 'guandan') {
    const fx = GD_FX[type] || null
    return { sfx: fx ? fx.sfx : 'play', say: '', fx }
  }
  const fx = DZ_FX[type] || null
  return { sfx: fx ? fx.sfx : 'play', say: patternCallout(action.pattern), fx }
}

export function bidCue(type) {
  return { sfx: type === 'bid-call' || type === 'rob-call' ? 'select' : 'pass', say: BID_WORDS[type] || '' }
}

export function createFeedback({ sfx, say, waitAudio, showFx }) {
  let alerted = {}
  let lastTurnKey = ''
  let epoch = 0 // 每局自增：上一局还在等待中的反馈（如结算音）醒来后发现过期就放弃

  return {
    reset() {
      alerted = {}
      lastTurnKey = ''
      epoch += 1
    },

    play({ game, action, seq, totalMul }) {
      const cue = playCue(game, action, seq)
      sfx(cue.sfx)
      if (cue.fx) showFx(cue.fx.kind, cue.fx.text, cue.fx.showMul ? `倍数 ×${totalMul}` : '', cue.fx.dur)
      if (cue.say) say(cue.say, action.seat)
    },

    bid({ seat, kind }) {
      const cue = bidCue(kind)
      sfx(cue.sfx)
      say(cue.say, seat)
    },

    landlord() {
      sfx('landlord')
    },

    /** 报单 / 报双：每家每个数量只提醒一次，语音排在该家出牌播报之后 */
    alarms(snap) {
      if (!snap || snap.phase !== 'play') return
      for (const p of snap.players || []) {
        if (p.seat === 0 || !p.cardCount || p.cardCount > 2) continue
        const key = `${p.seat}:${p.cardCount}`
        if (alerted[key]) continue
        alerted[key] = true
        sfx('alarm')
        say(p.cardCount === 1 ? '我只剩一张牌啦' : '我只剩两张牌啦', p.seat, { queue: true })
      }
    },

    /** 轮到自己：等上家声音播完再响提示音 */
    turn(snap, { autoPlay = false } = {}) {
      if (!snap || snap.phase !== 'play') return
      const myTurn = snap.turnSeat === 0 && !autoPlay
      const key = myTurn ? `${snap.seq}` : ''
      if (myTurn && key !== lastTurnKey) {
        waitAudio().then(() => {
          if (lastTurnKey === key) sfx('turn')
        })
      }
      lastTurnKey = key
    },

    /** 结算：等最后一手播报说完再响胜负音 / 春天特效 */
    settle({ won, spring }) {
      const mine = epoch
      waitAudio()
        .then(() => new Promise((resolve) => setTimeout(resolve, 200)))
        .then(() => {
          if (mine !== epoch) return
          if (spring) {
            sfx('spring')
            showFx('spring', spring === 'spring' ? '春天' : '反春', '倍数 ×2', 1800)
            say(spring === 'spring' ? '春天' : '反春', 0)
          } else {
            sfx(won ? 'win' : 'lose')
          }
        })
    },
  }
}
