<template>
  <view class="mask">
    <view class="dialog settle-dialog">
      <view class="result-mark" :class="markClass"><text>{{ markText }}</text></view>
      <text class="settle-kicker">{{ kicker }}</text>
      <text class="settle-title">{{ title }}</text>
      <text class="settle-subtitle">{{ subtitle }}</text>
      <view v-if="rows.length" class="settle-list">
        <view v-for="row in rows" :key="row.name" class="settle-row" :class="{ landlord: row.highlight }">
          <view class="settle-player">
            <text class="settle-name">{{ row.name }}</text>
            <text class="settle-role" :class="{ landlord: row.highlight }">{{ row.role }}</text>
          </view>
          <text :class="row.delta >= 0 ? 'gain' : 'lose'">{{ row.delta >= 0 ? '+' : '' }}{{ row.delta }}</text>
        </view>
      </view>
      <view v-if="chips.length" class="settle-mul">
        <text
          v-for="(chip, index) in chips"
          :key="chip"
          class="mul-chip"
          :class="{ total: index === chips.length - 1 }"
        >{{ chip }}</text>
      </view>
      <view v-if="beanDelta !== null" class="bean-settlement" :class="{ positive: beanDelta >= 0 }">
        <text>欢乐豆</text>
        <text class="bean-settlement-value">{{ beanDelta >= 0 ? '+' : '' }}{{ beanDelta }}</text>
      </view>
      <button class="btn primary dialog-btn" hover-class="btn-hover" @tap="$emit('action')">
        <text class="btn-symbol">↻</text><text>{{ actionLabel }}</text>
      </button>
    </view>
  </view>
</template>

<script>
/**
 * 结算弹窗 —— 斗地主结算 / 无人叫地主 / 掼蛋结算共用。
 * rows 为空时隐藏名单，chips 为空时隐藏倍数拆解，beanDelta 为 null 时隐藏豆结算。
 */
export default {
  name: 'SettleDialog',
  options: {
    // 小程序端：组件节点虚拟化（避免包裹层破坏 flex 布局）+ 页面样式穿透
    virtualHost: true,
    styleIsolation: 'apply-shared',
  },
  props: {
    markClass: { type: String, default: '' },
    markText: { type: String, default: '胜' },
    kicker: { type: String, default: '本局结算' },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    rows: { type: Array, default: () => [] },
    chips: { type: Array, default: () => [] },
    beanDelta: { type: Number, default: null },
    actionLabel: { type: String, default: '再来一局' },
  },
  emits: ['action'],
}
</script>
