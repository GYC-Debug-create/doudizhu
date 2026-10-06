/**
 * 斗地主 AI 门面：对外保持原有导入路径，实现拆在 ./ai/ 下
 *   moves.js     能出什么（着法枚举）
 *   evaluate.js  好不好（手牌强度 / 着法代价）
 *   strategy.js  出哪个（结合对局状态决策）
 */
export { evalHand, assessHand } from './ai/evaluate.js'
export { generateLeads, generateFollows, generateBombs } from './ai/moves.js'
export { aiBid, aiRob, aiPlay, hintCandidates } from './ai/strategy.js'
