/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 设计系统 v3: Minimalism & Swiss Style + 天空蓝 CTA（保留深色沉浸底）
        // Primary: #0369A1 sky-blue, Secondary: #38BDF8 light-sky, Accent: #60A5FA
        brand: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',   // 主强调色：天空蓝（Play 按钮 / 主 CTA）
          600: '#0369A1',
          700: '#075985',
        },
        accent: {
          400: '#60A5FA',
          500: '#3B82F6',   // 辅助强调色：亮蓝（链接/高亮）
          600: '#2563EB',
        },
        ink: {
          bg: '#0B1120',       // 深蓝黑背景（之前 #000 纯黑太硬，带点蓝调更协调）
          surface: '#111827',  // 卡片背景（slate-900）
          muted: '#1F2937',
          border: '#1E3A5F',   // 蓝调边框
          text: '#F1F5F9',
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
