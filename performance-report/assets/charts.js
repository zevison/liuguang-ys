// 映界性能优化报告 charts
(function() {
  var s = getComputedStyle(document.documentElement);
  var accent = s.getPropertyValue('--accent').trim();
  var accent2 = s.getPropertyValue('--accent2').trim();
  var ink = s.getPropertyValue('--ink').trim();
  var muted = s.getPropertyValue('--muted').trim();
  var rule = s.getPropertyValue('--rule').trim();
  var bg2 = s.getPropertyValue('--bg2').trim();

  // 图表 1: 封面缩图优化前后对比 (柱状图)
  var c1 = echarts.init(document.getElementById('chart-cover'), null, { renderer: 'svg' });
  c1.setOption({
    animation: false,
    textStyle: { color: muted, fontFamily: 'ui-sans-serif, system-ui, sans-serif' },
    tooltip: { trigger: 'axis', appendToBody: true },
    legend: { top: 0, textStyle: { color: muted } },
    grid: { top: 50, bottom: 40, left: 60, right: 20 },
    xAxis: { type: 'category', data: ['原图 CDN\n直连', '缩前 WebP\nq70 effort3', '缩后 WebP\nq50 effort5', '缩后 JPEG\nq50 mozjpeg'], axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted } },
    yAxis: { type: 'value', name: '字节', axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted, formatter: function(v){ return v >= 1024 ? (v/1024).toFixed(0)+'KB' : v+'B'; } }, splitLine: { lineStyle: { color: rule, type: 'dashed' } } },
    series: [{
      name: '封面大小 (bytes)',
      type: 'bar',
      barWidth: 48,
      data: [
        { value: 607970, itemStyle: { color: '#ef4444' } },
        { value: 70866,  itemStyle: { color: accent + 'cc' } },
        { value: 57896,  itemStyle: { color: accent } },
        { value: 34744,  itemStyle: { color: accent2 } }
      ],
      label: { show: true, position: 'top', color: ink, fontWeight: 600, formatter: function(p){ return (p.value/1024).toFixed(1)+'KB'; } }
    }]
  });
  window.addEventListener('resize', function(){ c1.resize(); });

  // 图表 2: 多封面样本一致性 (横向柱)
  var c2 = echarts.init(document.getElementById('chart-samples'), null, { renderer: 'svg' });
  c2.setOption({
    animation: false,
    textStyle: { color: muted },
    tooltip: { trigger: 'axis', appendToBody: true },
    grid: { top: 10, bottom: 30, left: 100, right: 30 },
    xAxis: { type: 'value', axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted, formatter: function(v){ return (v/1024).toFixed(0)+'KB'; } }, splitLine: { lineStyle: { color: rule, type: 'dashed' } } },
    yAxis: { type: 'category', data: ['/images/24680/poster', '/images/9876/poster', '/images/54321/poster', '/images/39148/poster'], axisLine: { lineStyle: { color: rule } }, axisLabel: { color: ink, fontWeight: 600 } },
    series: [{
      name: 'WebP q50 缩后大小',
      type: 'bar',
      data: [18096, 34698, 18642, 57896],
      itemStyle: { color: accent, borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', color: ink, fontWeight: 600, formatter: function(p){ return (p.value/1024).toFixed(1)+'KB'; } }
    }]
  });
  window.addEventListener('resize', function(){ c2.resize(); });

  // 图表 3: 前端 JS raw vs gzip (分组柱)
  var c3 = echarts.init(document.getElementById('chart-js'), null, { renderer: 'svg' });
  c3.setOption({
    animation: false,
    textStyle: { color: muted },
    tooltip: { trigger: 'axis', appendToBody: true, axisPointer: { type: 'shadow' } },
    legend: { top: 0, textStyle: { color: muted } },
    grid: { top: 50, bottom: 40, left: 70, right: 20 },
    xAxis: { type: 'category', data: ['vue-core', 'xgplayer', 'Home', 'Search', 'index'], axisLine: { lineStyle: { color: rule } }, axisLabel: { color: ink, fontWeight: 600 } },
    yAxis: { type: 'value', name: 'KB', axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted, formatter: function(v){ return v/1024+'KB'; } }, splitLine: { lineStyle: { color: rule, type: 'dashed' } } },
    series: [
      { name: '原始大小', type: 'bar', barWidth: 28, itemStyle: { color: bg2, borderColor: rule, borderWidth: 1, borderRadius: [4,4,0,0] }, data: [101234, 554497, 10375, 8515, 19852] },
      { name: 'gzip level 8', type: 'bar', barWidth: 28, itemStyle: { color: accent2, borderRadius: [4,4,0,0] }, data: [39421, 152660, 4017, 3459, 8354] }
    ]
  });
  window.addEventListener('resize', function(){ c3.resize(); });

  // 图表 4: 时间对比
  var c4 = echarts.init(document.getElementById('chart-time'), null, { renderer: 'svg' });
  c4.setOption({
    animation: false,
    textStyle: { color: muted },
    tooltip: { trigger: 'axis', appendToBody: true },
    grid: { top: 30, bottom: 40, left: 80, right: 20 },
    xAxis: { type: 'category', data: ['首页 JS', '封面 WebP q50', '封面 JPEG q50'], axisLine: { lineStyle: { color: rule } }, axisLabel: { color: ink, fontWeight: 600 } },
    yAxis: { type: 'value', name: '秒', axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted, formatter: function(v){ return v+'s'; } }, splitLine: { lineStyle: { color: rule, type: 'dashed' } } },
    series: [{
      name: '缓存命中后服务端耗时',
      type: 'bar',
      barWidth: 60,
      data: [
        { value: 0.223, itemStyle: { color: '#22c55e' } },
        { value: 0.000832, itemStyle: { color: accent, borderRadius: [6,6,0,0] } },
        { value: 0.000560, itemStyle: { color: accent2, borderRadius: [6,6,0,0] } }
      ],
      label: { show: true, position: 'top', color: ink, fontWeight: 700, formatter: function(p){ return p.value < 1 ? (p.value*1000).toFixed(1)+'ms' : p.value+'s'; } }
    }]
  });
  window.addEventListener('resize', function(){ c4.resize(); });
})();
