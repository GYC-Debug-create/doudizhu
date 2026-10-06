export const GT = {
  SOLO: 'SOLO',
  PAIR: 'PAIR',
  TRIPLE: 'TRIPLE',
  TRIPLE_PAIR: 'TRIPLE_PAIR',
  STRAIGHT: 'STRAIGHT',
  STRAIGHT_PAIR: 'STRAIGHT_PAIR',
  STEEL: 'STEEL',
  PLANE: 'PLANE',
  STRAIGHT_FLUSH: 'STRAIGHT_FLUSH',
  BOMB: 'BOMB',
  ROCKET: 'ROCKET',
}

export const TYPE_NAMES = {
  [GT.SOLO]: '单张',
  [GT.PAIR]: '对子',
  [GT.TRIPLE]: '三张',
  [GT.TRIPLE_PAIR]: '三带二',
  [GT.STRAIGHT]: '顺子',
  [GT.STRAIGHT_PAIR]: '三连对',
  [GT.STEEL]: '钢板',
  [GT.PLANE]: '飞机',
  [GT.STRAIGHT_FLUSH]: '同花顺',
  [GT.BOMB]: '炸弹',
  [GT.ROCKET]: '四王',
}

// 内部牌点沿用牌库：3..A 为 3..14，2 为 15，大小王为 16/17。
export const GD_RANKS = [15, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
const SUITS = [0, 1, 2, 3]

export function normalizeGuandanLevel(level = 15) {
  if (level === 2) return 15
  return GD_RANKS.includes(level) ? level : 15
}

export function isGuandanWild(card, level = 15) {
  return !!card && card.rank === normalizeGuandanLevel(level) && card.suit === 0
}

/** 非组合牌的比较值：级牌高于 A，普通 2 低于 3；王最高。 */
export function guandanCardValue(cardOrRank, level = 15) {
  const rank = typeof cardOrRank === 'number' ? cardOrRank : cardOrRank && cardOrRank.rank
  const normalizedLevel = normalizeGuandanLevel(level)
  if (rank === 17) return 102
  if (rank === 16) return 101
  if (rank === normalizedLevel) return 100
  return rank === 15 ? 2 : rank
}

export function sortGuandanCards(cards, level = 15) {
  return cards.slice().sort((a, b) => {
    const valueDiff = guandanCardValue(b, level) - guandanCardValue(a, level)
    if (valueDiff) return valueDiff
    return (b.suit - a.suit) || String(a.id).localeCompare(String(b.id))
  })
}

function sequenceWindows(size) {
  if (size === 5) {
    return [
      { ranks: [14, 15, 3, 4, 5], high: 5 },
      { ranks: [15, 3, 4, 5, 6], high: 6 },
      { ranks: [3, 4, 5, 6, 7], high: 7 },
      { ranks: [4, 5, 6, 7, 8], high: 8 },
      { ranks: [5, 6, 7, 8, 9], high: 9 },
      { ranks: [6, 7, 8, 9, 10], high: 10 },
      { ranks: [7, 8, 9, 10, 11], high: 11 },
      { ranks: [8, 9, 10, 11, 12], high: 12 },
      { ranks: [9, 10, 11, 12, 13], high: 13 },
      { ranks: [10, 11, 12, 13, 14], high: 14 },
    ]
  }
  if (size === 3) {
    return [
      { ranks: [14, 15, 3], high: 3 },
      { ranks: [15, 3, 4], high: 4 },
      { ranks: [3, 4, 5], high: 5 },
      { ranks: [4, 5, 6], high: 6 },
      { ranks: [5, 6, 7], high: 7 },
      { ranks: [6, 7, 8], high: 8 },
      { ranks: [7, 8, 9], high: 9 },
      { ranks: [8, 9, 10], high: 10 },
      { ranks: [9, 10, 11], high: 11 },
      { ranks: [10, 11, 12], high: 12 },
      { ranks: [11, 12, 13], high: 13 },
      { ranks: [12, 13, 14], high: 14 },
    ]
  }
  if (size === 2) {
    return [
      { ranks: [14, 15], high: 2 },
      { ranks: [15, 3], high: 3 },
      { ranks: [3, 4], high: 4 },
      { ranks: [4, 5], high: 5 },
      { ranks: [5, 6], high: 6 },
      { ranks: [6, 7], high: 7 },
      { ranks: [7, 8], high: 8 },
      { ranks: [8, 9], high: 9 },
      { ranks: [9, 10], high: 10 },
      { ranks: [10, 11], high: 11 },
      { ranks: [11, 12], high: 12 },
      { ranks: [12, 13], high: 13 },
      { ranks: [13, 14], high: 14 },
    ]
  }
  return []
}

export function getGuandanSequenceWindows(size = 5) {
  return sequenceWindowsForSize(size).map((window) => ({ ranks: window.ranks.slice(), high: window.high }))
}

function desc(type, rank, length = 1, bombSize = 0, value = rank) {
  return { type, rank, length, bombSize, value }
}

function naturalRankCounts(cards) {
  const counts = new Map()
  for (const card of cards) counts.set(card.rank, (counts.get(card.rank) || 0) + 1)
  return counts
}

function matchesWindow(ranks, size) {
  const rankSet = new Set(ranks)
  if (rankSet.size !== size) return null
  return sequenceWindowsForSize(size).find((window) => window.ranks.every((rank) => rankSet.has(rank))) || null
}

function sequenceWindowsForSize(size) {
  const fixed = sequenceWindows(size)
  if (fixed.length) return fixed
  const windows = []
  for (let start = 3; start + size - 1 <= 14; start++) {
    windows.push({ ranks: Array.from({ length: size }, (_, index) => start + index), high: start + size - 1 })
  }
  if (size >= 2 && size <= 13) {
    windows.push({ ranks: [15, ...Array.from({ length: size - 1 }, (_, index) => 3 + index)], high: size + 1 })
    windows.push({ ranks: [14, 15, ...Array.from({ length: size - 2 }, (_, index) => 3 + index)], high: size })
  }
  return windows
}

function naturalPattern(cards, level) {
  const n = cards.length
  const counts = naturalRankCounts(cards)
  const ranks = [...counts.keys()]
  const values = [...counts.values()].sort((a, b) => b - a)

  if (n === 4 && counts.get(16) === 2 && counts.get(17) === 2) {
    return desc(GT.ROCKET, 17, 4, 4, 102)
  }

  if (n >= 4 && n <= 10 && counts.size === 1) {
    const rank = ranks[0]
    return desc(GT.BOMB, rank, n, n, guandanCardValue(rank, level))
  }

  if (n === 5 && new Set(cards.map((card) => card.suit)).size === 1) {
    const window = matchesWindow(ranks, 5)
    if (window) return desc(GT.STRAIGHT_FLUSH, window.high, 5, 0, window.high)
  }

  if (n === 5 && counts.size === 2 && values[0] === 3 && values[1] === 2) {
    const tripleRank = ranks.find((rank) => counts.get(rank) === 3)
    return desc(GT.TRIPLE_PAIR, tripleRank, 1, 0, guandanCardValue(tripleRank, level))
  }

  if (n === 6 && counts.size === 3 && values.every((value) => value === 2)) {
    const window = matchesWindow(ranks, 3)
    if (window) return desc(GT.STRAIGHT_PAIR, window.high, 3, 0, window.high)
  }

  if (n === 6 && counts.size === 2 && values.every((value) => value === 3)) {
    const window = matchesWindow(ranks, 2)
    if (window) return desc(GT.STEEL, window.high, 2, 0, window.high)
  }

  if (n >= 9 && n % 3 === 0 && counts.size === n / 3 && values.every((value) => value === 3)) {
    const window = matchesWindow(ranks, n / 3)
    if (window) return desc(GT.PLANE, window.high, n / 3, 0, window.high)
  }

  if (n === 5 && counts.size === 5) {
    const window = matchesWindow(ranks, 5)
    if (window) return desc(GT.STRAIGHT, window.high, 5, 0, window.high)
  }

  if (n === 3 && counts.size === 1) {
    const rank = ranks[0]
    return desc(GT.TRIPLE, rank, 1, 0, guandanCardValue(rank, level))
  }
  if (n === 2 && counts.size === 1) {
    const rank = ranks[0]
    return desc(GT.PAIR, rank, 1, 0, guandanCardValue(rank, level))
  }
  if (n === 1) {
    const rank = ranks[0]
    return desc(GT.SOLO, rank, 1, 0, guandanCardValue(rank, level))
  }
  return null
}

function power(pattern) {
  if (!pattern) return -1
  if (pattern.type === GT.ROCKET) return 100
  if (pattern.type === GT.BOMB) {
    if (pattern.bombSize >= 6) return 80 + pattern.bombSize
    if (pattern.bombSize === 5) return 65
    return 55
  }
  if (pattern.type === GT.STRAIGHT_FLUSH) return 75
  return 0
}

function normalPriority(type) {
  return {
    [GT.STEEL]: 6,
    [GT.PLANE]: 7,
    [GT.STRAIGHT_PAIR]: 5,
    [GT.TRIPLE_PAIR]: 4,
    [GT.STRAIGHT]: 3,
    [GT.TRIPLE]: 2,
    [GT.PAIR]: 1,
    [GT.SOLO]: 0,
  }[type] ?? -1
}

function betterPattern(current, candidate) {
  if (!current) return candidate
  const currentPower = power(current)
  const candidatePower = power(candidate)
  if (candidatePower !== currentPower) return candidatePower > currentPower ? candidate : current
  if (candidatePower === 0 && current.type !== candidate.type) {
    return normalPriority(candidate.type) > normalPriority(current.type) ? candidate : current
  }
  return (candidate.value ?? -1) > (current.value ?? -1) ? candidate : current
}

function replaceWilds(cards, assignments) {
  let wildIndex = 0
  return cards.map((card) => {
    if (!isGuandanWild(card, assignments.level)) return card
    const assignment = assignments.values[wildIndex++]
    return { ...card, rank: assignment.rank, suit: assignment.suit }
  })
}

function assignmentValues(wildCount, level) {
  let values = [{ values: [], level }]
  for (let i = 0; i < wildCount; i++) {
    const next = []
    for (const current of values) {
      for (const rank of GD_RANKS) {
        for (const suit of SUITS) next.push({ values: [...current.values, { rank, suit }], level })
      }
    }
    values = next
  }
  return values
}

/**
 * 分析一手掼蛋牌。红桃级牌会枚举为除大小王外的牌点和花色，
 * 因而可以参与顺子、三连对、钢板、同花顺以及炸弹。
 */
export function analyzeGuandan(cards, level = 15) {
  if (!cards || cards.length === 0) return null
  const normalizedLevel = normalizeGuandanLevel(level)
  const wildCount = cards.filter((card) => isGuandanWild(card, normalizedLevel)).length
  if (!wildCount) return naturalPattern(cards, normalizedLevel)

  let best = null
  for (const values of assignmentValues(wildCount, normalizedLevel)) {
    const assigned = replaceWilds(cards, values)
    best = betterPattern(best, naturalPattern(assigned, normalizedLevel))
  }
  return best
}

export function canBeatGuandan(previous, next) {
  if (!next) return false
  if (!previous) return true

  const previousPower = power(previous)
  const nextPower = power(next)
  if (previousPower > 0 || nextPower > 0) {
    if (previous.type === GT.BOMB && next.type === GT.BOMB) {
      if (previous.bombSize !== next.bombSize) return next.bombSize > previous.bombSize
      return next.value > previous.value
    }
    if (previous.type === GT.STRAIGHT_FLUSH && next.type === GT.STRAIGHT_FLUSH) return next.value > previous.value
    return nextPower > previousPower
  }

  if (previous.type !== next.type || previous.length !== next.length) return false
  return next.value > previous.value
}
