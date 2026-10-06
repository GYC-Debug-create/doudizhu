/**
 * 着法枚举：给定手牌，列出所有合法领出 / 能压过上家的跟牌 / 炸弹。
 * 只回答“能出什么”，不做任何取舍；每个着法为 { cards, p: analyze 结果, force: 0 同型 / 1 炸弹 / 2 王炸 }。
 * 翼牌（三带一/三带二/飞机带翼）通过枚举 + analyze 校验保证合法。
 */
import { analyze, T } from '../patterns.js'

/** rank -> 该 rank 的牌数组（保持手牌顺序） */
export function byRank(hand) {
  const m = new Map()
  for (const c of hand) {
    if (!m.has(c.rank)) m.set(c.rank, [])
    m.get(c.rank).push(c)
  }
  return m
}

/** 手牌中除 used 外的部分，按 rank 升序 */
export function poolExcluding(hand, used) {
  const usedIds = new Set(used.map((c) => c.id))
  return hand.filter((c) => !usedIds.has(c.id)).sort((a, b) => a.rank - b.rank)
}

/** C(n,k) 组合枚举 */
function combinations(arr, k) {
  const res = []
  const cur = []
  const rec = (start) => {
    if (cur.length === k) {
      res.push(cur.slice())
      return
    }
    for (let i = start; i < arr.length; i++) {
      cur.push(arr[i])
      rec(i + 1)
      cur.pop()
    }
  }
  rec(0)
  return res
}

/** base + n 张散牌翼 → 整体 analyze 为 type 的第一个合法组合；无则 null */
function attachSoloKickers(base, pool, n, type) {
  if (n === 0) {
    const p = analyze(base)
    return p && p.type === type ? base.slice() : null
  }
  // 只考虑最小的 12 张，控制枚举规模
  const combos = combinations(pool.slice(0, 12), n)
  for (const ks of combos) {
    const all = [...base, ...ks]
    const p = analyze(all)
    if (p && p.type === type) return all
  }
  return null
}

/** base + n 个对子翼（从 m 中 rank 升序选，排除 exclude ranks） */
function attachPairKickers(base, m, exclude, n, type) {
  const ranks = [...m.keys()]
    .filter((r) => !exclude.has(r) && m.get(r).length >= 2)
    .sort((a, b) => a - b)
  for (const rs of combinations(ranks, n)) {
    const all = [...base]
    for (const r of rs) all.push(...m.get(r).slice(0, 2))
    const p = analyze(all)
    if (p && p.type === type) return all
  }
  return null
}

/** [start, start+len) 每个 rank 是否至少有 minCount 张 */
function hasRun(m, minCount, start, len) {
  for (let r = start; r < start + len; r++) {
    const cards = m.get(r)
    if (!cards || cards.length < minCount) return false
  }
  return true
}

/** 取 [start, start+len) 每个 rank 的 minCount 张 */
function runCards(m, minCount, start, len) {
  const out = []
  for (let r = start; r < start + len; r++) out.push(...m.get(r).slice(0, minCount))
  return out
}

function runRankSet(start, len) {
  const s = new Set()
  for (let r = start; r < start + len; r++) s.add(r)
  return s
}

/** 组装一个候选着法（cards + 解析结果 + force: 0 同型 / 1 炸弹 / 2 王炸） */
function move(cards, force) {
  const p = analyze(cards)
  return p ? { cards, p, force } : null
}

/**
 * 枚举所有合法领出（不含炸弹/王炸）
 * @returns {Array<{cards, p, force}>}
 */
export function generateLeads(hand) {
  const m = byRank(hand)
  const moves = []

  for (const [r, cards] of m) {
    moves.push(move([cards[0]], 0)) // 单张
    if (cards.length >= 2) moves.push(move([cards[0], cards[1]], 0)) // 对子
    if (cards.length >= 3) {
      const base = cards.slice(0, 3)
      moves.push(move(base, 0)) // 三张
      const solo = attachSoloKickers(base, poolExcluding(hand, base), 1, T.TRIPLE_SOLO)
      if (solo) moves.push(move(solo, 0))
      const pair = attachPairKickers(base, m, new Set([r]), 1, T.TRIPLE_PAIR)
      if (pair) moves.push(move(pair, 0))
    }
  }
  // 顺子
  for (let len = 5; len <= 12; len++) {
    for (let s = 3; s + len - 1 <= 14; s++) {
      if (hasRun(m, 1, s, len)) moves.push(move(runCards(m, 1, s, len), 0))
    }
  }
  // 连对
  for (let len = 3; len <= 10; len++) {
    for (let s = 3; s + len - 1 <= 14; s++) {
      if (hasRun(m, 2, s, len)) moves.push(move(runCards(m, 2, s, len), 0))
    }
  }
  // 飞机（纯三张、带单、带对）
  for (let k = 2; k <= 6; k++) {
    for (let s = 3; s + k - 1 <= 14; s++) {
      if (!hasRun(m, 3, s, k)) continue
      const base = runCards(m, 3, s, k)
      moves.push(move(base, 0))
      if (base.length + k <= hand.length) {
        const solo = attachSoloKickers(base, poolExcluding(hand, base), k, T.PLANE_SOLO)
        if (solo) moves.push(move(solo, 0))
        const pair = attachPairKickers(base, m, runRankSet(s, k), k, T.PLANE_PAIR)
        if (pair) moves.push(move(pair, 0))
      }
    }
  }
  return moves.filter(Boolean)
}

/**
 * 枚举所有能压过 current 的着法
 * @returns {Array<{cards, p, force}>} force 0 同型 / 1 炸弹 / 2 王炸
 */
export function generateFollows(hand, current) {
  const p = current.pattern
  const m = byRank(hand)
  const moves = []

  switch (p.type) {
    case T.SOLO:
      for (const [r, cards] of m) {
        if (r > p.rank) moves.push(move([cards[0]], 0))
      }
      break
    case T.PAIR:
      for (const [r, cards] of m) {
        if (r > p.rank && cards.length >= 2) moves.push(move(cards.slice(0, 2), 0))
      }
      break
    case T.TRIPLE:
    case T.TRIPLE_SOLO:
    case T.TRIPLE_PAIR:
      for (const [r, cards] of m) {
        if (r <= p.rank || cards.length < 3) continue
        const base = cards.slice(0, 3)
        if (p.type === T.TRIPLE) moves.push(move(base, 0))
        if (p.type === T.TRIPLE_SOLO) {
          const mv = attachSoloKickers(base, poolExcluding(hand, base), 1, T.TRIPLE_SOLO)
          if (mv) moves.push(move(mv, 0))
        }
        if (p.type === T.TRIPLE_PAIR) {
          const mv = attachPairKickers(base, m, new Set([r]), 1, T.TRIPLE_PAIR)
          if (mv) moves.push(move(mv, 0))
        }
      }
      break
    case T.STRAIGHT:
      for (let s = p.rank + 1; s + p.length - 1 <= 14; s++) {
        if (hasRun(m, 1, s, p.length)) moves.push(move(runCards(m, 1, s, p.length), 0))
      }
      break
    case T.STRAIGHT_PAIR:
      for (let s = p.rank + 1; s + p.length - 1 <= 14; s++) {
        if (hasRun(m, 2, s, p.length)) moves.push(move(runCards(m, 2, s, p.length), 0))
      }
      break
    case T.PLANE:
    case T.PLANE_SOLO:
    case T.PLANE_PAIR: {
      const k = p.length
      for (let s = p.rank + 1; s + k - 1 <= 14; s++) {
        if (!hasRun(m, 3, s, k)) continue
        const base = runCards(m, 3, s, k)
        if (p.type === T.PLANE) {
          moves.push(move(base, 0))
        } else if (p.type === T.PLANE_SOLO) {
          const mv = attachSoloKickers(base, poolExcluding(hand, base), k, T.PLANE_SOLO)
          if (mv) moves.push(move(mv, 0))
        } else {
          const mv = attachPairKickers(base, m, runRankSet(s, k), k, T.PLANE_PAIR)
          if (mv) moves.push(move(mv, 0))
        }
      }
      break
    }
    case T.BOMB:
      // 只能更大的炸弹（王炸统一在下面追加）
      for (const [r, cards] of m) {
        if (r > p.rank && cards.length === 4) moves.push(move(cards.slice(0, 4), 0))
      }
      break
    case T.ROCKET:
      break // 没有任何牌能压王炸
  }

  // 通用后手：炸弹压非炸弹、王炸压一切
  if (p.type !== T.ROCKET) {
    if (p.type !== T.BOMB) {
      for (const [r, cards] of m) {
        if (cards.length === 4) moves.push(move(cards.slice(0, 4), 1))
      }
    }
    if (m.has(16) && m.has(17)) moves.push(move([m.get(16)[0], m.get(17)[0]], 2))
  }

  return moves.filter(Boolean)
}

/** 手中所有炸弹与王炸 */
export function generateBombs(hand) {
  const m = byRank(hand)
  const out = []
  for (const cards of m.values()) if (cards.length === 4) out.push(move(cards.slice(0, 4), 1))
  if (m.has(16) && m.has(17)) out.push(move([m.get(16)[0], m.get(17)[0]], 2))
  return out.filter(Boolean)
}
