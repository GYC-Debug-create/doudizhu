/**
 * 牌组工具：54 张牌的表示、命名、洗牌、排序
 * 牌 id 0..53；rank 3..17（3 最小，A=14, 2=15, 小王=16, 大王=17）
 * suit 0..3 对应 红桃/方块/黑桃/梅花（王牌的 suit 仅为区分大小王）
 */

export const RANK_MIN = 3

export const RANK_CHARS = [
  '', '', '', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '小王', '大王'
]

export const SUIT_CHARS = ['♥', '♦', '♣', '♠']
export const SUIT_RED = [0, 1]

/** 一张牌：{ id, rank, suit, name, red } */
export function makeCard(id) {
  const rank = cardRank(id)
  const suit = cardSuit(id)
  const red = rank >= 16 || SUIT_RED.includes(suit)
  return { id, rank, suit, name: cardName(id), red }
}

export function cardRank(id) {
  return id < 52 ? Math.floor(id / 4) + RANK_MIN : id - 52 + 16
}

export function cardSuit(id) {
  return id < 52 ? id % 4 : id - 52
}

export function cardName(id) {
  const rank = cardRank(id)
  const suit = cardSuit(id)
  if (rank === 16) return '🃏小王'
  if (rank === 17) return '🃏大王'
  return SUIT_CHARS[suit] + RANK_CHARS[rank]
}

/** 52 花色牌 + 2 王，共 54 张 */
export function createDeck() {
  const deck = []
  for (let i = 0; i < 54; i++) deck.push(makeCard(i))
  return deck
}

/** Fisher-Yates 洗牌，返回新数组；rng 可注入以便测试复现 */
export function shuffle(cards, rng = Math.random) {
  const arr = cards.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 按 rank 降序（大在前），同 rank 按花色降序 */
export function sortCards(cards) {
  return cards.slice().sort((a, b) => (b.rank - a.rank) || (b.suit - a.suit))
}

/** 从 id 数组构造牌对象数组 */
export function cardsFromIds(ids) {
  return ids.map(makeCard)
}

/** 抽牌：从 deck 中取出 count 张并移除 */
export function draw(deck, count) {
  const taken = deck.splice(0, count)
  return taken
}
