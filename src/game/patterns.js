/**
 * 斗地主牌型分析与比较
 *
 * analyze(cards) 返回:
 *   { type, rank, length } | null
 *   type 枚举见 T；rank 为主牌 rank（用于比较）；
 *   length 仅在需要区分时有用（顺子长度/连对对数/飞机翼数）。
 *
 * 规则说明（家庭宽松版）：
 *   - 三带一/飞机带单不限制带牌是否互不相同
 *   - 2 与王不能进入顺子/连对/飞机
 */

export const T = {
  SOLO: 'SOLO', // 单张
  PAIR: 'PAIR', // 对子
  TRIPLE: 'TRIPLE', // 三张
  TRIPLE_SOLO: 'TRIPLE_SOLO', // 三带一
  TRIPLE_PAIR: 'TRIPLE_PAIR', // 三带二
  STRAIGHT: 'STRAIGHT', // 顺子 >=5
  STRAIGHT_PAIR: 'STRAIGHT_PAIR', // 连对 >=3 对
  PLANE: 'PLANE', // 飞机不带
  PLANE_SOLO: 'PLANE_SOLO', // 飞机带单
  PLANE_PAIR: 'PLANE_PAIR', // 飞机带对
  BOMB: 'BOMB', // 炸弹
  ROCKET: 'ROCKET', // 王炸
}

export const TYPE_NAMES = {
  [T.SOLO]: '单张',
  [T.PAIR]: '对子',
  [T.TRIPLE]: '三张',
  [T.TRIPLE_SOLO]: '三带一',
  [T.TRIPLE_PAIR]: '三带二',
  [T.STRAIGHT]: '顺子',
  [T.STRAIGHT_PAIR]: '连对',
  [T.PLANE]: '飞机',
  [T.PLANE_SOLO]: '飞机带单',
  [T.PLANE_PAIR]: '飞机带对',
  [T.BOMB]: '炸弹',
  [T.ROCKET]: '王炸',
}

/** 是否是"连续"的一组 rank（升序数组） */
function runs(ranks) {
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false
  }
  return true
}

/** 顺子/连对/飞机不能含 2 与王（rank <= A=14） */
function maxRankOk(ranks) {
  return ranks[ranks.length - 1] <= 14
}

/** 统计牌面值出现次数：rank -> count */
export function countRanks(cards) {
  const m = new Map()
  for (const c of cards) m.set(c.rank, (m.get(c.rank) || 0) + 1)
  return m
}

function desc(type, rank, length = 1) {
  return { type, rank, length }
}

/**
 * 分析一手牌的牌型，非法返回 null
 * @param {Array<{rank:number}>} cards
 */
export function analyze(cards) {
  const n = cards.length
  if (n === 0) return null

  const m = countRanks(cards)
  const ranks = [...m.keys()].sort((a, b) => a - b)
  const t3 = [...m.entries()].filter(([, c]) => c === 3).map(([r]) => r).sort((a, b) => a - b)
  const t2 = [...m.entries()].filter(([, c]) => c === 2).map(([r]) => r).sort((a, b) => a - b)
  const t1 = [...m.entries()].filter(([, c]) => c === 1).map(([r]) => r).sort((a, b) => a - b)

  // 王炸
  if (n === 2 && m.has(16) && m.has(17)) return desc(T.ROCKET, 17)

  // 炸弹
  if (n === 4 && m.size === 1) return desc(T.BOMB, ranks[0])

  if (n === 1) return desc(T.SOLO, ranks[0])
  if (n === 2 && m.size === 1) return desc(T.PAIR, ranks[0])
  if (n === 3 && m.size === 1) return desc(T.TRIPLE, ranks[0])

  // 三带一
  if (n === 4 && m.size === 2 && t3.length === 1) return desc(T.TRIPLE_SOLO, t3[0])
  // 三带二
  if (n === 5 && m.size === 2 && t3.length === 1 && t2.length === 1) return desc(T.TRIPLE_PAIR, t3[0])

  // 顺子
  if (n >= 5 && t1.length === n && runs(ranks) && maxRankOk(ranks)) return desc(T.STRAIGHT, ranks[0], n)

  // 连对
  if (n >= 6 && n % 2 === 0 && t2.length === n / 2 && runs(t2) && maxRankOk(t2))
    return desc(T.STRAIGHT_PAIR, t2[0], n / 2)

  // 飞机（纯三张连续）
  if (n >= 6 && n % 3 === 0 && t3.length === n / 3 && runs(t3) && maxRankOk(t3))
    return desc(T.PLANE, t3[0], n / 3)

  // 飞机带单：k 组三张连续 + k 张散牌
  if (n % 4 === 0 && n >= 8) {
    const k = n / 4
    if (t3.length === k && runs(t3) && maxRankOk(t3)) {
      const tripleTotal = t3.reduce((s, r) => s + m.get(r), 0)
      if (n - tripleTotal === k) return desc(T.PLANE_SOLO, t3[0], k)
    }
  }

  // 飞机带对：k 组三张连续 + k 个对子
  if (n % 5 === 0 && n >= 10) {
    const k = n / 5
    if (t3.length === k && runs(t3) && maxRankOk(t3)) {
      const tripleTotal = t3.reduce((s, r) => s + m.get(r), 0)
      if (n - tripleTotal === 2 * k && t2.length === k) return desc(T.PLANE_PAIR, t3[0], k)
    }
  }

  return null
}

/**
 * 是否能压过上手。prev=null 表示新一轮自由出牌。
 * 调用前应先保证 next 自身合法（analyze 非 null）。
 */
export function canBeat(prev, next) {
  if (!prev) return true
  if (next.type === T.ROCKET) return true // 王炸压一切
  if (prev.type === T.ROCKET) return false
  if (next.type === T.BOMB) {
    if (prev.type === T.BOMB) return next.rank > prev.rank
    return true // 炸弹压一切非炸弹
  }
  if (prev.type === T.BOMB) return false
  if (prev.type !== next.type) return false
  if (prev.length !== next.length) return false
  return next.rank > prev.rank
}
