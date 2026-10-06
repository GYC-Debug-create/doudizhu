/**
 * 斗地主牌桌视图推导：snapshot → 界面要显示的一切（轮次、文案、可出判定、记牌器、结算行）。
 * 纯函数，不依赖 Vue；组件只把结果绑到模板上。
 */
import { PHASE } from '../game/rules.js'
import { canBeat, TYPE_NAMES, T } from '../game/patterns.js'

export const BID_LABELS = {
  'bid-call': '叫地主',
  'bid-pass': '不叫',
  'rob-call': '抢地主',
  'rob-pass': '不抢',
}

const isPositiveBid = (type) => type === 'bid-call' || type === 'rob-call'

/** 本家（座位 0）当前能做什么 */
export function deriveTurn(snap, { bottomPending = false } = {}) {
  const bid = snap.phase === PHASE.BID
  const robbing = bid && snap.candidate !== null && snap.robTurn === 0
  const robbed = (snap.robbedBy || []).includes(0)
  const playTurn = snap.phase === PHASE.PLAY && snap.turnSeat === 0 && !bottomPending
  return {
    bidTurn: bid && snap.candidate === null && snap.bidTurn === 0,
    robTurn: robbing && !robbed,
    robPassOnly: robbing && robbed,
    playTurn,
    mustLead: playTurn && (snap.current === null || snap.current.seat === 0),
  }
}

export function totalMul(snap) {
  return (snap.bidMul || 1) * (snap.bombMul || 1)
}

export function finalMul(snap) {
  return totalMul(snap) * (snap.springMul || 1)
}

export function isBombPattern(pattern) {
  return !!pattern && (pattern.type === T.BOMB || pattern.type === T.ROCKET)
}

export function phaseLabel(snap) {
  if (snap.phase === PHASE.BID) return snap.candidate === null ? '叫地主' : '抢地主'
  if (snap.phase === PHASE.PLAY) return '出牌中'
  return '本局结束'
}

export function isSeatActive(snap, seat) {
  if (snap.phase === PHASE.BID) return snap.candidate === null ? snap.bidTurn === seat : snap.robTurn === seat
  if (snap.phase === PHASE.PLAY) return snap.turnSeat === seat
  return false
}

export function roleLabel(snap, seat) {
  if (snap.landlordSeat === seat) return '地主'
  return snap.landlordSeat === null ? '身份待定' : '农民'
}

export function seatAlert(snap, seat) {
  if (snap.phase !== PHASE.PLAY) return ''
  const n = (snap.players[seat] && snap.players[seat].cardCount) || 0
  return n === 1 ? '报单' : n === 2 ? '报双' : ''
}

export function lastAction(snap, seat) {
  const h = snap.history || []
  for (let i = h.length - 1; i >= 0; i--) if (h[i].seat === seat) return h[i]
  return null
}

export function actionTypeName(action) {
  if (!action) return ''
  if (action.pass) return '不出'
  return action.pattern ? TYPE_NAMES[action.pattern.type] || '' : ''
}

/** 某座位最近一次叫/抢表态 → { label, kind } */
export function lastBid(snap, seat) {
  const events = snap.actions || []
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e.seat === seat && BID_LABELS[e.type]) return { label: BID_LABELS[e.type], kind: isPositiveBid(e.type) ? 'positive' : 'neutral' }
  }
  return { label: '', kind: 'neutral' }
}

export function bidEvents(snap, limit = 8) {
  return (snap.actions || [])
    .filter((a) => BID_LABELS[a.type])
    .map((a) => ({ seat: a.seat, label: BID_LABELS[a.type], kind: isPositiveBid(a.type) ? 'positive' : 'neutral' }))
    .slice(-limit)
}

export function winnerLabel(snap, seatName) {
  const winner = snap.winnerSeats && snap.winnerSeats[0]
  if (winner === undefined) return '对局结束'
  const spring = snap.spring === 'spring' ? ' · 春天！' : snap.spring === 'anti-spring' ? ' · 反春！' : ''
  return `${seatName(winner)}胜利${spring}`
}

export function iWin(snap) {
  const mine = (snap.settle || []).find((s) => s.seat === 0)
  return !!mine && mine.delta > 0
}

/** 中央状态条：{ text, subtitle } */
export function statusLine(snap, turn, { seatName, bottomPending, finishActive }) {
  const s = snap
  const winner = winnerLabel(s, seatName)
  if (bottomPending) return { text: '底牌翻开中', subtitle: `${seatName(s.landlordSeat)} 正在接牌，底牌翻开后开始出牌` }
  if (finishActive) {
    return { text: iWin(s) ? '你已出完，展示剩余手牌' : '对局结束，展示剩余手牌', subtitle: `${winner} · 先展示其他玩家剩余手牌` }
  }
  if (s.phase === PHASE.OVER) {
    return s.overReason === 'no-bid'
      ? { text: '本局作废', subtitle: '没有人叫地主，牌局重新开始' }
      : { text: '对局结束', subtitle: `${winner} · 点击下方重新发牌` }
  }
  if (s.phase === PHASE.BID) {
    if (s.candidate === null) {
      return {
        text: s.bidTurn === 0 ? '轮到你叫地主' : `等待 ${seatName(s.bidTurn)} 叫地主`,
        subtitle: s.bidTurn === 0 ? '选一项开始本轮叫牌' : `第 ${s.bidRounds + 1} 轮叫牌进行中`,
      }
    }
    const text = turn.robTurn ? (s.callSeat === 0 ? '轮到你最后抢或不抢' : '轮到你抢地主') : `等待 ${seatName(s.robTurn)} 决定是否抢地主`
    const subtitle =
      s.robTurn === s.callSeat
        ? `当前候选：${seatName(s.candidate)} · 首次叫地主者最后表态`
        : `当前候选：${seatName(s.candidate)} · 叫抢倍数 ${s.bidMul}`
    return { text, subtitle }
  }
  const text = turn.playTurn
    ? turn.mustLead
      ? '轮到你领出'
      : '轮到你出牌'
    : s.current
      ? `等待 ${seatName(s.turnSeat)} 出牌`
      : `等待 ${seatName(s.turnSeat)} 领出`
  const subtitle = !s.current
    ? turn.playTurn
      ? '请选择一手牌开始新一轮'
      : '上一手结束，等待新的领出'
    : '需要同牌型更大的牌，或用炸弹 / 王炸压过'
  return { text, subtitle }
}

export function emptyTable(snap, turn) {
  if (snap.phase === PHASE.BID) return { title: '等待地主确定', subtitle: '完成叫牌后，底牌会亮出' }
  if (snap.phase === PHASE.PLAY) return { title: '新一轮开始', subtitle: turn.playTurn ? '轮到你领出' : '上一手牌结束后重新开始' }
  return { title: '等待下一局', subtitle: '重新发牌即可继续' }
}

/**
 * 已选牌的判定 → 出牌按钮状态 + 选牌区文案 + 反馈条文案/颜色
 * @param pattern  analyze(已选牌) 结果；未选时传 null 且 count = 0
 */
export function judgeSelection(snap, turn, { pattern, count, hinted, aiThinking }) {
  const prev = snap.current && snap.current.pattern
  let canPlay
  if (!turn.playTurn) canPlay = { allowed: false, reason: snap.phase === PHASE.BID ? '叫牌阶段不能出牌' : '未轮到你' }
  else if (!count) canPlay = { allowed: false, reason: '请先选择要出的牌' }
  else if (!pattern) canPlay = { allowed: false, reason: '牌型不成型，请调整选牌' }
  else if (!canBeat(prev, pattern)) {
    canPlay = prev.type !== pattern.type
      ? { allowed: false, reason: `需同为 ${TYPE_NAMES[prev.type]} 或用炸弹压过` }
      : { allowed: false, reason: '点数不够大，压不过上家' }
  } else canPlay = { allowed: true, reason: '' }

  let label
  if (!turn.playTurn) label = aiThinking ? 'AI 正在思考' : snap.phase === PHASE.BID ? '叫牌结束后才能出牌' : '等待你的回合'
  else if (!count) label = turn.mustLead ? '请选择一手牌领出' : '选择要出的牌'
  else label = pattern ? TYPE_NAMES[pattern.type] || '牌型已成' : '牌型未成型'

  let kind = 'info'
  if (turn.playTurn && count) kind = !pattern ? 'error' : !canPlay.allowed ? 'warn' : 'ok'

  let text
  if (!turn.playTurn) {
    text = aiThinking ? 'AI 正在思考，请稍候' : snap.phase === PHASE.BID ? '完成叫抢地主后才能出牌' : '等待轮到你时再选牌出牌'
  } else if (!count) {
    text = turn.mustLead ? '新一轮请领出 — 任选一手合法牌型' : '选择要出的牌，或点击"提示"查看建议'
  } else if (!pattern) {
    text = '不成牌型 — 请增减选牌，尝试组成对子、顺子等'
  } else if (!canPlay.allowed) {
    text = canPlay.reason
  } else {
    const prefix = hinted ? '智能提示：' : ''
    text = turn.mustLead ? `${prefix}已选 ${TYPE_NAMES[pattern.type]} — 可以领出` : `${prefix}已选 ${TYPE_NAMES[pattern.type]} — 可压过上家`
  }
  return { canPlay, label, kind, text }
}

const COUNTER_ORDER = [17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3]
const COUNTER_LABELS = { 17: '大', 16: '小', 15: '2', 14: 'A', 13: 'K', 12: 'Q', 11: 'J' }

/** 记牌器：除自己手牌与已出牌外，每个点数还剩几张在别人手里（四张都在 = 可能有炸弹） */
export function counterCells(snap, myCards) {
  const left = new Map()
  for (let r = 3; r <= 15; r++) left.set(r, 4)
  left.set(16, 1)
  left.set(17, 1)
  const seen = [...myCards]
  for (const h of snap.history || []) if (h.cards) seen.push(...h.cards)
  for (const c of seen) left.set(c.rank, Math.max(0, (left.get(c.rank) || 0) - 1))
  return COUNTER_ORDER.map((rank) => ({
    rank,
    label: COUNTER_LABELS[rank] || String(rank),
    left: left.get(rank),
    hot: rank <= 15 && left.get(rank) === 4,
  }))
}

/** 结算弹窗数据 */
export function settleView(snap, seatName) {
  const chips = [`底分 ${snap.baseBet}`, `叫抢 ×${snap.bidMul}`, `炸弹 ×${snap.bombMul}`]
  if (snap.spring) chips.push(`${snap.spring === 'spring' ? '春天' : '反春'} ×2`)
  chips.push(`总计 ×${finalMul(snap)}`)
  const won = iWin(snap)
  return {
    won,
    title: won ? '这一局拿下了' : '这一局没能守住',
    subtitle: `${winnerLabel(snap, seatName)} · ${finalMul(snap)} 倍 · 底分 ${snap.baseBet}`,
    rows: (snap.settle || []).map((row) => ({
      name: seatName(row.seat),
      role: row.isLandlord ? '地主' : '农民',
      highlight: !!row.isLandlord,
      delta: row.delta,
    })),
    chips,
  }
}
