/** 牌桌静态配置：座位与模式选项（页面与组件共享，不含任何逻辑）。 */
import { GAME_MODES } from '../game/modes.js'

export const DOUDIZHU_SEATS = [
  { id: 'me', name: '你', isAI: false },
  { id: 'ai1', name: 'AI·甲', isAI: true },
  { id: 'ai2', name: 'AI·乙', isAI: true },
]

export const GUANDAN_SEATS = [
  { id: 'me', name: '你', isAI: false, team: 0 },
  { id: 'ai-left', name: 'AI·左', isAI: true, team: 1 },
  { id: 'partner', name: 'AI·队友', isAI: true, team: 0 },
  { id: 'ai-right', name: 'AI·右', isAI: true, team: 1 },
]

export const MODE_OPTIONS = [
  { key: GAME_MODES.NORMAL, label: '普通模式', note: '标准 54 张牌', icon: '♠', tone: '' },
  { key: GAME_MODES.SUPER_BOMB, label: '超级多炸弹', note: '每家保底 2 组炸弹', icon: '✦', tone: 'bomb' },
  { key: GAME_MODES.GUANDAN, label: '掼蛋', note: '4 人 · 108 张 · 2v2', icon: '♣', tone: 'guandan' },
]

export function modeLabel(key) {
  return (MODE_OPTIONS.find((item) => item.key === key) || MODE_OPTIONS[0]).label
}
