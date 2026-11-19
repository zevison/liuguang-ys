import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.liuguang.ys',
  appName: '映界',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
      overlaysWebView: false
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false
    },
    Keyboard: {
      // resizeOnFullScreen: true 会让 WebView 在软键盘弹出时 resize
      // 这会打断 Android 中文 IME 的 composition 事件！
      // 设置为 false 让 WebView 保持不变，用键盘事件自己调整
      resizeOnFullScreen: true,
      style: 'DARK'
    }
  }
}

export default config
