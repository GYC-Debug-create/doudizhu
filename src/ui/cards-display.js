/**
 * 牌面展示纯函数 —— 斗地主 / 掼蛋两套 UI 共用。
 * 只依赖牌对象（{ rank, suit, red, id }），不依赖 Vue，可在 Node 单测。
 */
import { RANK_CHARS, SUIT_CHARS } from '../game/cards.js'

export function rankChar(c) {
  return c.rank >= 16 ? '王' : RANK_CHARS[c.rank]
}

export function suitChar(c) {
  if (c.rank === 16) return '小'
  if (c.rank === 17) return '大'
  return SUIT_CHARS[c.suit]
}

export function centerGlyph(c) {
  if (c.rank === 16) return '小王'
  if (c.rank === 17) return '大王'
  return SUIT_CHARS[c.suit]
}

export function isRedCard(c) {
  if (c.rank === 16) return false
  if (c.rank === 17) return true
  return c.red
}

export function pipCount(c) {
  if (c.rank >= 3 && c.rank <= 10) return c.rank
  if (c.rank === 14) return 1
  if (c.rank === 15) return 2
  return 0
}

export function pipClass(c) {
  return `pips-${pipCount(c)}`
}

export function cardLabel(c) {
  return `${rankChar(c)}${suitChar(c)}`
}
