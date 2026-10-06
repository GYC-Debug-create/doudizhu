import {
  GT,
  GD_RANKS,
  analyzeGuandan,
  canBeatGuandan,
  getGuandanSequenceWindows,
  guandanCardValue,
  isGuandanWild,
} from './patterns.js'

function targetRanks(level) {
  return GD_RANKS.slice().sort((a, b) => guandanCardValue(a, level) - guandanCardValue(b, level))
}

function byRank(hand, level) {
  const groups = new Map()
  for (const card of hand) {
    if (isGuandanWild(card, level)) continue
    if (!groups.has(card.rank)) groups.set(card.rank, [])
    groups.get(card.rank).push(card)
  }
  return groups
}

function cardsForRequirements(hand, requirements, level, suit = null, preferredIds = new Set()) {
  const selected = []
  const wilds = hand
    .filter((card) => isGuandanWild(card, level))
    .sort((a, b) => Number(preferredIds.has(b.id)) - Number(preferredIds.has(a.id)))
  let missing = 0

  for (const [rank, count] of requirements) {
    const available = hand
      .filter((card) => {
        if (isGuandanWild(card, level) || selected.some((item) => item.id === card.id)) return false
        if (card.rank !== rank) return false
        return suit === null || card.suit === suit
      })
      .sort((a, b) => Number(preferredIds.has(b.id)) - Number(preferredIds.has(a.id)))
    selected.push(...available.slice(0, count))
    missing += Math.max(0, count - available.length)
  }

  if (missing > wilds.length) return null
  return selected.concat(wilds.slice(0, missing))
}

function validCandidate(hand, requirements, level, previous, suit = null, preferredIds = new Set()) {
  const cards = cardsForRequirements(hand, requirements, level, suit, preferredIds)
  if (!cards) return null
  const pattern = analyzeGuandan(cards, level)
  return pattern && canBeatGuandan(previous, pattern) ? cards : null
}

function containsIds(cards, ids) {
  return [...ids].every((id) => cards.some((card) => card.id === id))
}

function findSimple(hand, level, previous, count, preferredIds = new Set(), requirePreferred = false) {
  let fallback = null
  for (const rank of targetRanks(level)) {
    const candidate = validCandidate(hand, [[rank, count]], level, previous, null, preferredIds)
    if (!candidate || (requirePreferred && !containsIds(candidate, preferredIds))) continue
    if (candidate.length === hand.length) return candidate
    if (!fallback) fallback = candidate
  }
  return fallback
}

function findTriplePair(hand, level, previous, preferredIds = new Set(), requirePreferred = false) {
  const ranks = targetRanks(level)
  for (const tripleRank of ranks) {
    for (const pairRank of ranks) {
      if (tripleRank === pairRank) continue
      const candidate = validCandidate(hand, [[tripleRank, 3], [pairRank, 2]], level, previous, null, preferredIds)
      if (candidate && (!requirePreferred || containsIds(candidate, preferredIds))) return candidate
    }
  }
  return null
}

function findSequence(hand, level, previous, windowSize, count, suit = null, preferredIds = new Set(), requirePreferred = false) {
  const windows = getGuandanSequenceWindows(windowSize).sort((a, b) => a.high - b.high)
  for (const window of windows) {
    const candidate = validCandidate(
      hand,
      window.ranks.map((rank) => [rank, count]),
      level,
      previous,
      suit,
      preferredIds
    )
    if (candidate && (!requirePreferred || containsIds(candidate, preferredIds))) return candidate
  }
  return null
}

function findStraightFlush(hand, level, previous, preferredIds = new Set(), requirePreferred = false) {
  for (const suit of [0, 1, 2, 3]) {
    const candidate = findSequence(hand, level, previous, 5, 1, suit, preferredIds, requirePreferred)
    if (candidate) return candidate
  }
  return null
}

function findPlane(hand, level, previous = null, preferredIds = new Set(), requirePreferred = false) {
  const sizes = previous && previous.type === GT.PLANE
    ? [previous.length]
    : [3, 4, 5, 6, 7, 8, 9]
  for (const size of sizes) {
    const candidate = findSequence(hand, level, previous, size, 3, null, preferredIds, requirePreferred)
    if (candidate) return candidate
  }
  return null
}

function findBomb(hand, level, previous, preferredIds = new Set(), requirePreferred = false) {
  for (let size = 4; size <= 10; size++) {
    for (const rank of targetRanks(level)) {
      const candidate = validCandidate(hand, [[rank, size]], level, previous, null, preferredIds)
      if (candidate && (!requirePreferred || containsIds(candidate, preferredIds))) return candidate
    }
  }
  return null
}

function findRocket(hand, level, previous) {
  const cards = hand.filter((card) => card.rank === 16 || card.rank === 17)
  if (cards.length < 4) return null
  const candidate = cards.slice(0, 4)
  const pattern = analyzeGuandan(candidate, level)
  return pattern && canBeatGuandan(previous, pattern) ? candidate : null
}

function patternWeight(pattern) {
  return {
    [GT.SOLO]: 0,
    [GT.PAIR]: 4,
    [GT.TRIPLE]: 6,
    [GT.STRAIGHT]: 8,
    [GT.TRIPLE_PAIR]: 10,
    [GT.STRAIGHT_PAIR]: 11,
    [GT.STEEL]: 13,
    [GT.PLANE]: 15,
    [GT.STRAIGHT_FLUSH]: 32,
    [GT.BOMB]: 80,
    [GT.ROCKET]: 120,
  }[pattern.type] ?? 200
}

function leadScore(cards, pattern, hand, level) {
  const groups = byRank(hand, level)
  const groupSizes = cards
    .filter((card) => !isGuandanWild(card, level))
    .map((card) => groups.get(card.rank)?.length || 1)
  const largestGroup = Math.max(...groupSizes, 1)
  const preservePenalty = largestGroup >= 4
    ? 30
    : pattern.type === GT.SOLO && largestGroup > 1
      ? 12
      : 0
  const lowest = Math.min(...cards.map((card) => guandanCardValue(card, level)))
  const useBonus = Math.max(0, cards.length - 1) * 2.5
  // 优先清掉完整组合，同时保留四张以上的炸弹胚子。
  return patternWeight(pattern) + preservePenalty + lowest / 100 - useBonus
}

function finishingMove(hand, level, previous) {
  const pattern = analyzeGuandan(hand, level)
  return pattern && canBeatGuandan(previous, pattern) ? hand.slice() : null
}

function strategicLead(hand, level) {
  const candidates = []
  const sorted = hand.slice().sort((a, b) => guandanCardValue(a, level) - guandanCardValue(b, level))
  for (const card of sorted) {
    const pattern = analyzeGuandan([card], level)
    if (pattern) candidates.push({ cards: [card], pattern })
  }

  const options = [
    findSimple(hand, level, null, 2),
    findSimple(hand, level, null, 3),
    findTriplePair(hand, level, null),
    findSequence(hand, level, null, 5, 1),
    findSequence(hand, level, null, 3, 2),
    findSequence(hand, level, null, 2, 3),
    findPlane(hand, level, null),
    findStraightFlush(hand, level, null),
    findBomb(hand, level, null),
    findRocket(hand, level, null),
  ]
  for (const cards of options) {
    if (!cards) continue
    const pattern = analyzeGuandan(cards, level)
    if (pattern) candidates.push({ cards, pattern })
  }
  candidates.sort((a, b) => leadScore(a.cards, a.pattern, hand, level) - leadScore(b.cards, b.pattern, hand, level))
  return candidates[0]?.cards || (sorted.length ? [sorted[0]] : null)
}

function findSameType(hand, level, previous) {
  switch (previous.type) {
    case GT.SOLO:
      return hand
        .slice()
        .sort((a, b) => guandanCardValue(a, level) - guandanCardValue(b, level))
        .map((card) => [card])
        .find((cards) => {
          const pattern = analyzeGuandan(cards, level)
          return pattern && canBeatGuandan(previous, pattern)
        }) || null
    case GT.PAIR:
      return findSimple(hand, level, previous, 2)
    case GT.TRIPLE:
      return findSimple(hand, level, previous, 3)
    case GT.TRIPLE_PAIR:
      return findTriplePair(hand, level, previous)
    case GT.STRAIGHT:
      return findSequence(hand, level, previous, 5, 1)
    case GT.STRAIGHT_PAIR:
      return findSequence(hand, level, previous, 3, 2)
    case GT.STEEL:
      return findSequence(hand, level, previous, 2, 3)
    case GT.PLANE:
      return findPlane(hand, level, previous)
    case GT.STRAIGHT_FLUSH:
      return findStraightFlush(hand, level, previous)
    default:
      return null
  }
}

function shouldLetPartnerLead(game, seat) {
  const current = game.current
  return current && current.seat !== seat && game.players[current.seat].team === game.players[seat].team
}

function seededHint(game, seat, selectedIds) {
  const hand = game.players[seat].cards
  const handIds = new Set(hand.map((card) => card.id))
  const preferredIds = new Set((selectedIds || []).filter((id) => handIds.has(id)))
  if (!preferredIds.size) return null

  const previous = game.current && game.current.pattern
  const rocket = findRocket(hand, game.level, previous)
  if (rocket && containsIds(rocket, preferredIds)) return rocket

  const selectedRanks = [...new Set(hand.filter((card) => preferredIds.has(card.id) && !isGuandanWild(card, game.level)).map((card) => card.rank))]
  const wildCount = hand.filter((card) => isGuandanWild(card, game.level)).length
  for (const rank of selectedRanks) {
    const naturalCount = hand.filter((card) => card.rank === rank && !isGuandanWild(card, game.level)).length
    for (let size = Math.min(10, naturalCount + wildCount); size >= 4; size--) {
      const candidate = validCandidate(hand, [[rank, size]], game.level, previous, null, preferredIds)
      if (candidate && containsIds(candidate, preferredIds)) return candidate
    }
  }

  const bomb = findBomb(hand, game.level, previous, preferredIds, true)
  if (bomb) return bomb

  const straightFlush = findStraightFlush(hand, game.level, previous, preferredIds, true)
  if (straightFlush) return straightFlush

  const plane = findPlane(hand, game.level, previous, preferredIds, true)
  if (plane) return plane

  const steel = findSequence(hand, game.level, previous, 2, 3, null, preferredIds, true)
  if (steel) return steel
  const triplePair = findTriplePair(hand, game.level, previous, preferredIds, true)
  if (triplePair) return triplePair
  const straightPair = findSequence(hand, game.level, previous, 3, 2, null, preferredIds, true)
  if (straightPair) return straightPair
  const straight = findSequence(hand, game.level, previous, 5, 1, null, preferredIds, true)
  if (straight) return straight
  const triple = findSimple(hand, game.level, previous, 3, preferredIds, true)
  if (triple) return triple
  const pair = findSimple(hand, game.level, previous, 2, preferredIds, true)
  if (pair) return pair
  return findSimple(hand, game.level, previous, 1, preferredIds, true)
}

export function aiGuandanPlay(game, seat) {
  const hand = game.players[seat].cards
  if (!hand.length) return null
  const previous = game.current && game.current.pattern
  const finish = finishingMove(hand, game.level, previous)
  if (finish) return finish
  if (!previous || game.current?.seat === seat) return strategicLead(hand, game.level)
  if (shouldLetPartnerLead(game, seat)) return null

  const sameType = findSameType(hand, game.level, previous)
  if (sameType) return sameType

  const bomb = findBomb(hand, game.level, previous)
  if (bomb) return bomb

  return findRocket(hand, game.level, previous)
}

export function aiGuandanHint(game, seat, selectedIds = []) {
  return seededHint(game, seat, selectedIds) || aiGuandanPlay(game, seat)
}
