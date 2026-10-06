import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDeck, shuffle, sortCards, draw, makeCard, cardsFromIds, cardRank, cardName } from '../src/game/cards.js'

test('createDeck：54 张、id 唯一、rank 边界', () => {
  const deck = createDeck()
  assert.equal(deck.length, 54)
  assert.equal(new Set(deck.map((c) => c.id)).size, 54)
  assert.equal(cardRank(0), 3)
  assert.equal(cardRank(51), 15) // 2
  assert.equal(cardRank(52), 16) // 小王
  assert.equal(cardRank(53), 17) // 大王
  // 每个 rank 3..15 恰好 4 张
  for (let r = 3; r <= 15; r++) {
    assert.equal(deck.filter((c) => c.rank === r).length, 4, `rank ${r}`)
  }
})

test('牌名与花色颜色', () => {
  assert.equal(cardName(0), '♥3')
  assert.equal(cardName(47), '♠A') // id = (rank-3)*4 + suit → ♠A 为 47
  assert.equal(cardName(53), '🃏大王')
  const card = makeCard(12) // rank 6, suit 0 → ♥6
  assert.equal(card.rank, 6)
  assert.equal(card.suit, 0)
  assert.equal(card.red, true)
  assert.equal(makeCard(3).red, false) // ♣3
})

test('shuffle：保持多重集不变、可注入 rng 复现', () => {
  const deck = createDeck()
  let s = 42
  const rngA = () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
  const a = shuffle(deck, rngA)
  assert.equal(a.length, 54)
  assert.deepEqual(
    a.map((c) => c.id).sort((x, y) => x - y),
    deck.map((c) => c.id)
  )
  // 相同种子 → 相同序列
  let s2 = 42
  const rngB = () => {
    s2 = (s2 * 1103515245 + 12345) % 2147483648
    return s2 / 2147483648
  }
  const b = shuffle(deck, rngB)
  assert.deepEqual(a.map((c) => c.id), b.map((c) => c.id))
  // 不改变原数组
  assert.equal(deck[0].id, 0)
})

test('sortCards：rank 降序', () => {
  const hand = cardsFromIds([0, 53, 30, 12]) // 3, 大王, 10, ♦6
  const sorted = sortCards(hand)
  assert.deepEqual(
    sorted.map((c) => c.rank),
    [17, 10, 6, 3]
  )
})

test('draw：从头部取牌并移除', () => {
  const deck = createDeck()
  const taken = draw(deck, 5)
  assert.equal(taken.length, 5)
  assert.equal(deck.length, 49)
  assert.equal(taken[0].id, 0)
  assert.equal(deck[0].id, 5)
})
