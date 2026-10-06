/**
 * 决策：结合对局状态（谁是地主、队友/对手余牌、当前牌权）挑选着法。
 *  - 叫/抢地主：手牌强度过阈值即叫，抢地主随倍数上升提高门槛
 *  - 领出：一手出完直接出；先甩小牌与长组合；对手报单/报双时避开单张/对子，队友报单时喂小单
 *  - 跟牌：同型最小压且尽量不拆牌；炸弹只在关键时刻用；农民不压队友，地主报单时全力顶牌
 */
import { analyze, countRanks, T } from '../patterns.js'
import { generateLeads, generateFollows, generateBombs } from './moves.js'
import { assessHand, breakPenalty, sortLeads, sortFollows, leavesFinisher } from './evaluate.js'

const BID_THRESHOLD = 10
const ROB_THRESHOLD = 14

export function aiBid(game, seat) {
  return assessHand(game.players[seat].cards) >= BID_THRESHOLD
}

export function aiRob(game, seat) {
  const score = assessHand(game.players[seat].cards)
  const pressure = Math.max(0, (game.bidMul || 1) - 1) * 0.8
  return score >= ROB_THRESHOLD + pressure
}

function isFarmer(game, seat) {
  return !game.players[seat].isLandlord
}

function sameDoudizhuTeam(game, first, second) {
  return isFarmer(game, first) && isFarmer(game, second)
}

function opponentSeats(game, seat) {
  return game.players.filter((p) => p.seat !== seat && !sameDoudizhuTeam(game, seat, p.seat)).map((p) => p.seat)
}

function minOpponentCards(game, seat) {
  return Math.min(...opponentSeats(game, seat).map((s) => game.players[s].cards.length))
}

export function chooseLead(game, seat, hand) {
  if (analyze(hand)) return hand.slice()
  const leads = generateLeads(hand)
  const finisher = leads.find((mv) => mv.cards.length === hand.length)
  if (finisher) return finisher.cards

  // 手里有炸弹且炸完剩下一手能走完：先炸再走
  for (const bomb of generateBombs(hand)) if (leavesFinisher(hand, bomb)) return bomb.cards

  let sorted = sortLeads(hand, leads)
  const next = (seat + 1) % 3
  // 农民：下家是队友且报单/报双 → 喂最小的单张/对子
  if (sameDoudizhuTeam(game, seat, next)) {
    const mateCount = game.players[next].cards.length
    if (mateCount === 1) {
      const solo = leads.filter((mv) => mv.p.type === T.SOLO).sort((a, b) => a.p.rank - b.p.rank)[0]
      if (solo) return solo.cards
    }
    if (mateCount === 2) {
      const pair = leads.filter((mv) => mv.p.type === T.PAIR).sort((a, b) => a.p.rank - b.p.rank)[0]
      if (pair) return pair.cards
    }
  }

  const danger = minOpponentCards(game, seat)
  if (danger === 1) {
    const nonSolo = sorted.filter((mv) => mv.p.type !== T.SOLO)
    if (nonSolo.length) return nonSolo[0].cards
    // 只剩单张可出：先出最大的，逼对手
    const solos = leads.filter((mv) => mv.p.type === T.SOLO).sort((a, b) => b.p.rank - a.p.rank)
    if (solos.length) return solos[0].cards
  }
  if (danger === 2) {
    const safe = sorted.filter((mv) => mv.p.type !== T.PAIR)
    if (safe.length) sorted = safe
  }
  return sorted[0]?.cards || null
}

function chooseFollow(game, seat, hand, follows) {
  const current = game.current
  const finisher = follows.find((mv) => mv.cards.length === hand.length)
  if (finisher) return finisher.cards
  // 压完这手剩下的能一把走完 → 直接压
  const winning = follows.find((mv) => mv.force === 0 && leavesFinisher(hand, mv))
  if (winning) return winning.cards

  const counts = countRanks(hand)
  const sorted = sortFollows(hand, follows)
  const normal = sorted.filter((mv) => mv.force === 0)
  const bombs = sorted.filter((mv) => mv.force > 0)
  const danger = minOpponentCards(game, seat)
  const ownerCards = game.players[current.seat].cards.length

  // 出牌的对手只剩 1-2 张：拿最大的顶住，必要时上炸弹
  if (ownerCards <= 2) {
    if (normal.length) return normal[normal.length - 1].cards
    if (bombs.length) return bombs[0].cards
    return null
  }

  const pick = normal.find((mv) => breakPenalty(counts, mv.cards) < 10 || danger <= 3)
  if (pick) {
    const topRank = Math.max(...pick.cards.map((c) => c.rank))
    // 用王去压普通小牌不划算，除非对手快走完
    if (topRank >= 16 && current.pattern.rank < 13 && danger > 5) return null
    // 农民在队友前面时，不急着用 2 压地主的小单张（队友还有机会接）
    if (
      topRank === 15 &&
      current.pattern.type === T.SOLO &&
      current.pattern.rank < 10 &&
      danger > 8 &&
      isFarmer(game, seat) &&
      (seat + 1) % 3 !== current.seat
    ) {
      return null
    }
    return pick.cards
  }

  if (!bombs.length) return null
  const bigPlay = current.cards.length >= 5 || current.pattern.rank >= 15
  const afterBomb = hand.length - bombs[0].cards.length
  if (danger <= 4 || afterBomb <= 4 || bigPlay) return bombs[0].cards
  return null
}

/**
 * AI 出牌决策：先判断能否一次出完，再按牌型、队友牌权和对手余牌选择。
 * @returns {Array} 要出的牌对象数组；null 表示过牌
 */
export function aiPlay(game, seat) {
  const hand = game.players[seat].cards
  if (!hand.length) return null
  const current = game.current

  if (current === null || current.seat === seat) return chooseLead(game, seat, hand)

  const follows = generateFollows(hand, current)
  if (!follows.length) return null

  if (sameDoudizhuTeam(game, seat, current.seat)) {
    // 队友拿着牌权：除非能一把走完，否则让队友继续
    const finisher = follows.find((mv) => mv.cards.length === hand.length)
    if (finisher) return finisher.cards
    const nextSeat = (seat + 1) % 3
    // 地主是我下家且快走完，队友出的小单张挡不住 → 我来顶大的
    if (
      game.players[nextSeat].isLandlord &&
      game.players[nextSeat].cards.length <= 2 &&
      current.pattern.type === T.SOLO &&
      current.pattern.rank < 14
    ) {
      const normal = sortFollows(hand, follows).filter((mv) => mv.force === 0)
      if (normal.length) return normal[normal.length - 1].cards
    }
    return null
  }
  return chooseFollow(game, seat, hand, follows)
}

function movesKey(cards) {
  return cards
    .map((c) => c.id)
    .sort((a, b) => a - b)
    .join(',')
}

/**
 * 给玩家的提示候选：第一项为 AI 推荐，其余按“代价从小到大”排列，供“提示”按钮循环。
 * 跟牌时只列能压过上家的牌（不考虑队友让牌），领出时列出全部可领牌型。
 * @returns {Array<Array>} 牌组数组；空数组表示没有牌能大过上家
 */
export function hintCandidates(game, seat) {
  const hand = game.players[seat].cards
  if (!hand.length) return []
  const current = game.current
  const leading = current === null || current.seat === seat
  const list = []
  const seen = new Set()
  const push = (cards) => {
    if (!cards || !cards.length) return
    const key = movesKey(cards)
    if (seen.has(key)) return
    seen.add(key)
    list.push(cards)
  }
  if (leading) {
    push(chooseLead(game, seat, hand))
    for (const mv of sortLeads(hand, generateLeads(hand))) push(mv.cards)
    for (const mv of generateBombs(hand)) push(mv.cards)
  } else {
    if (!sameDoudizhuTeam(game, seat, current.seat)) push(aiPlay(game, seat))
    for (const mv of sortFollows(hand, generateFollows(hand, current))) push(mv.cards)
  }
  return list
}
