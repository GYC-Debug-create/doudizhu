<template>
  <view class="mode-line">
    <text class="mode-label">模式</text>
    <view class="mode-switch">
      <button
        v-for="mode in modes"
        :key="mode.key"
        class="mode-option"
        :class="[mode.tone, { active: active === mode.key }]"
        :aria-pressed="active === mode.key"
        :aria-label="`切换到${mode.label}`"
        hover-class="mode-option-hover"
        @tap="$emit('select', mode.key)"
      >
        <text class="mode-symbol">{{ mode.icon }}</text>
        <text>{{ mode.label }}</text>
      </button>
    </view>
    <text class="mode-note">{{ note }}</text>
  </view>
</template>

<script>
/** 模式切换条：modes = [{ key, label, note, icon, tone }]。 */
export default {
  name: 'ModeSwitch',
  options: { virtualHost: true, styleIsolation: 'apply-shared' },
  emits: ['select'],
  props: {
    modes: { type: Array, required: true },
    active: { type: String, default: '' },
  },
  computed: {
    note() {
      const mode = this.modes.find((item) => item.key === this.active) || this.modes[0]
      return mode ? mode.note : ''
    },
  },
}
</script>
