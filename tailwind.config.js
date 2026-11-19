/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 设计系统 v4: 回归 v1 原始浅蓝（用户最爱）
        // HUD Sci-Fi 风格 + 亮蓝 CTA + 深蓝黑沉浸式背景
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',   // ★ v1 主强调色：淡蓝/亮蓝 CTA
          600: '#2563EB',
          700: '#1D4ED8',
        },
        accent: {
          400: '#818CF8',
          500: '#6366F1',   // 辅助靛蓝（hover / secondary）
          600: '#4F46E5',
        },
        ink: {
          bg: '#0A1628',       // ★ v1 原始深蓝黑背景
          card: '#0F1E36',     // 卡片深蓝（更深）
          surface: '#132440',  // 次表面
          muted: '#0C1829',
          border: '#1E3A5F',   // 蓝调边框
          text: '#EFF6FF',
          subtext: '#8FA3C7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseSubtle: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
      easing: {
        'out': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
