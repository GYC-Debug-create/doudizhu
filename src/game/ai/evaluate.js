/**
 * 评估：手牌强度（叫/抢地主用）与着法代价（领出/跟牌排序用）。纯函数，不看对局状态。
 */
import { analyze, countRanks, T } from '../patterns.js'
import { generateLeads, poolExcluding } from './moves.js'

/** 基础控制力：大王 6 分、小王 4 分、每个 2 两分、每个四炸 5 分。 */
export function evalHand(cards) {
  const m = countRanks(cards)
  let score = 0
  if (m.has(17)) score += 6
  if (m.has(16)) score += 4
  score += 2 * (m.get(15) || 0)
  for (const count of m.values()) if (count === 4) score += 5
  return score
}

/** 手牌强度：王/2/炸弹等控制牌加分，孤张和拆牌风险扣分。 */
export function assessHand(cards) {
  const m = countRanks(cards)
  let score = evalHand(cards)
  let pairs = 0
  let triples = 0
  let singles = 0
  const normalRanks = [...m.keys()].filter((rank) => rank <= 14).sort((a, b) => a - b)

  for (const count of m.values()) {
    if (count === 3) triples++
    else if (count === 2) pairs++
    else if (count === 1) singles++
  }
  score += triples * 1.15 + pairs * 0.55 - singles * 0.22

  let longest = 0
  let run = 0
  for (let i = 0; i < normalRanks.length; i++) {
    run = i > 0 && normalRanks[i] === normalRanks[i - 1] + 1 ? run + 1 : 1
    longest = Math.max(longest, run)
  }
  score += Math.min(2.4, Math.max(0, longest - 2) * 0.45)

  const comboCount = generateLeads(cards).filter((move) => move.p.type !== T.SOLO).length
  score += Math.min(1.8, comboCount * 0.06)
  return score
}

// 每张牌的“控制价值”：A/2/王 领出代价更高
const HIGH_CARD_COST = { 14: 0.9, 15: 2.2, 16: 3.5, 17: 4.5 }

/** 着法拆牌代价：从对子/三张/炸弹里只拿一部分 */
export function breakPenalty(counts, cards) {
  const used = countRanks(cards)
  let penalty = 0
  for (const [rank, n] of used) {
    const have = counts.get(rank) || 0
    if (n >= have) continue
    if (have === 4) penalty += 10
    else if (have === 3) penalty += n === 1 ? 3 : 2.5
    else if (have === 2) penalty += 2.2
  }
  return penalty
}

function leadMoveScore(hand, move) {
  const counts = countRanks(hand)
  const typeBias = {
    [T.SOLO]: 0,
    [T.PAIR]: 2,
    [T.TRIPLE]: 3,
    [T.TRIPLE_SOLO]: 4,
    [T.TRIPLE_PAIR]: 5,
    [T.STRAIGHT]: 6,
    [T.STRAIGHT_PAIR]: 7,
    [T.PLANE]: 8,
    [T.PLANE_SOLO]: 9,
    [T.PLANE_PAIR]: 10,
  }
  let preservePenalty = breakPenalty(counts, move.cards)
  if (move.p.type === T.SOLO && (counts.get(move.cards[0].rank) || 1) > 1) preservePenalty += 4
  let highCost = 0
  for (const card of move.cards) highCost += HIGH_CARD_COST[card.rank] || 0
  const useBonus = Math.max(0, move.cards.length - 1) * 1.8
  return (typeBias[move.p.type] ?? 20) + preservePenalty + highCost + move.p.rank * 0.18 - useBonus
}

export function sortLeads(hand, leads) {
  return leads.slice().sort(
    (a, b) => leadMoveScore(hand, a) - leadMoveScore(hand, b) || a.p.rank - b.p.rank || b.cards.length - a.cards.length
  )
}

function followMoveScore(hand, move) {
  const counts = countRanks(hand)
  let score = move.force * 40 + move.p.rank + breakPenalty(counts, move.cards) * 1.6
  for (const card of move.cards) score += (HIGH_CARD_COST[card.rank] || 0) * 0.6
  return score
}

export function sortFollows(hand, follows) {
  return follows.slice().sort((a, b) => followMoveScore(hand, a) - followMoveScore(hand, b) || a.cards.length - b.cards.length)
}

/** 打出 mv 后剩下的牌能否一手出完 */
export function leavesFinisher(hand, mv) {
  const rest = poolExcluding(hand, mv.cards)
  return rest.length === 0 || !!analyze(rest)
}
