import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// 本项目 package.json 为 "type": "module"，该版本 uni 插件以 CJS 导出，
// 函数实际位于 .default；做一次归一化兼容两种加载方式
const uniPlugin = uni.default || uni

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uniPlugin()],
  server: {
    // 本地调试留下的浏览器 profile / 截图目录不参与热更新，否则会不停整页刷新
    watch: { ignored: ['**/.chrome-*/**', '**/*.png', '**/*.log', '**/dist/**'] },
  },
})
