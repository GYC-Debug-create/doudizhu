/**
 * 电脑端牌桌缩放：按设计尺寸排版，再按窗口等比缩放铺满屏幕。
 * 窄屏（手机/平板）返回 1，沿用原响应式布局。
 */
export const DESIGN_WIDTH = 1210
export const DESIGN_HEIGHT = 800
const MIN_DESKTOP_WIDTH = 1100
const MAX_ZOOM = 1.8
// 矮屏笔记本（如 1366×768）适度缩小，保证出牌区不被裁掉
const MIN_ZOOM = 0.75
const MAX_STAGE_WIDTH = 1560

/** @returns {{ zoom: number, width: number }} width 为设计单位下的内容区宽度 */
export function computeStage(width, height) {
  if (width < MIN_DESKTOP_WIDTH) return { zoom: 1, width: 1180 }
  const raw = Math.max(MIN_ZOOM, Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT, MAX_ZOOM))
  const zoom = Math.abs(raw - 1) > 0.02 ? Math.round(raw * 100) / 100 : 1
  // 屏幕比设计稿更宽时把内容区横向撑开，避免左右大片留白
  return { zoom, width: Math.round(Math.min(MAX_STAGE_WIDTH, width / zoom - 32)) }
}
