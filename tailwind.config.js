/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 设计系统 v2: OLED 黑底 + 电影院红 CTA + 深靛蓝次色
        // Pattern: Hero-Centric | Style: Dark Mode (OLED) | Keywords: cinema immersive
        brand: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          300: '#FDA4AF',
          400: '#FB7185',
          500: '#E11D48',   // 主强调色：电影院红（Play 按钮 / 主 CTA）
          600: '#BE123C',
          700: '#9F1239',
        },
        accent: {
          500: '#6366F1',   // 次强调色：靛蓝（链接/辅助高亮）
          600: '#4F46E5',
        },
        ink: {
          bg: '#000000',       // OLED 纯黑（省电 + 沉浸式）
          surface: '#0C0C0D',  // 卡片背景
          muted: '#181818',
          border: '#312E81',   // 深靛蓝边框
          text: '#F8FAFC',
          subtext: '#94A3B8',
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
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      // 统一过渡曲线（Material Motion / iOS ease-out）
      easing: {
        'out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in': 'cubic-bezier(0.4, 0, 1, 1)',
        'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
    },
  },
  plugins: [],
}
