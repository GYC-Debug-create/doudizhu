/**
 * 斗地主键盘快捷键：按键 + 当前可做的事 → 意图。纯函数，组件只负责执行意图。
 *   叫/抢阶段：空格/回车 = 叫（抢），P/Esc = 不叫（不抢）
 *   出牌阶段：空格/回车 = 出牌（没选牌时先提示；要不起时直接过），P = 不出，H = 提示，Esc = 清空
 */
const isConfirm = (key) => key === ' ' || key === 'Enter'
const isPass = (key) => key === 'p' || key === 'P'

/**
 * @param {string} key  KeyboardEvent.key
 * @param {{ bidTurn, robTurn, robPassOnly, playTurn, canFollow, hasSelection }} s
 * @returns {string|null} bid | bid-pass | rob | rob-pass | play | pass | hint | clear
 */
export function keyIntent(key, s) {
  if (s.bidTurn) return isConfirm(key) ? 'bid' : isPass(key) || key === 'Escape' ? 'bid-pass' : null
  if (s.robTurn) return isConfirm(key) ? 'rob' : isPass(key) || key === 'Escape' ? 'rob-pass' : null
  if (s.robPassOnly) return isConfirm(key) || isPass(key) ? 'rob-pass' : null
  if (!s.playTurn) return null
  if (isConfirm(key)) {
    if (!s.canFollow) return 'pass'
    return s.hasSelection ? 'play' : 'hint'
  }
  if (isPass(key)) return 'pass'
  if (key === 'h' || key === 'H') return 'hint'
  if (key === 'Escape') return 'clear'
  return null
}
