<template>
  <view class="mask confirm-mask" @tap="$emit('cancel')">
    <view class="dialog confirm-dialog" @tap.stop>
      <view class="result-mark neutral"><text>!</text></view>
      <text class="settle-kicker">确认操作</text>
      <text class="settle-title">{{ title }}</text>
      <text class="settle-subtitle">{{ subtitle }}</text>
      <view class="confirm-actions">
        <button class="btn ghost confirm-btn" hover-class="btn-hover" @tap="$emit('cancel')"><text>取消</text></button>
        <button class="btn primary confirm-btn" hover-class="btn-hover" @tap="$emit('confirm')">
          <text class="btn-symbol">↻</text><text>{{ actionLabel }}</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script>
/** 重开/切模式确认弹窗，页面级共用。 */
export default {
  name: 'ConfirmDialog',
  options: {
    // 小程序端：组件节点虚拟化（避免包裹层破坏 flex 布局）+ 页面样式穿透
    virtualHost: true,
    styleIsolation: 'apply-shared',
  },
  props: {
    title: { type: String, default: '确定要重新开始？' },
    subtitle: { type: String, default: '当前牌局进度将丢失，重新发牌' },
    actionLabel: { type: String, default: '确认重开' },
  },
  emits: ['cancel', 'confirm'],
}
</script>
