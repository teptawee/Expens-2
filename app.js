/* ============================================================
   ⚠️ API CONFIG — แก้ 2 บรรทัดนี้เท่านั้น
   ============================================================ */
var API_URL = 'https://script.google.com/macros/s/AKfycbwB2SQ-SyeLgrTKSXjh7mQ4lOLCA_km84fFjufnhgsUftCVDgwlXVdKXMIb8uK8kvUQ/exec';
var API_TOKEN = 'Teptawee.Expense-2';

/* ============ GLOBAL ============ */
var CATS = [];
var PAYS = [];
var DASH = null;
var charts = { cat: null, time: null, pay: null };
var currentChartMode = 'overview';
var currentExpenseLimit = 20;
var currentExpensePage = 1;
var currentTotalPages = 1;
var currentTotalItems = 0;
var chartOffset = 0;
var isCustomRange = false;
var dashMonth = '';
var bmMonth = '';
var currentFilterCategory = '';
var filterPageSize = 20;
var filterPage = 1;
var PALETTE = ['#FFB8D1','#A8E6CF','#A8D8FF','#C7A8FF','#FFE48A','#FFC4A3','#B8E0FF','#FFD9E8','#D9F7E8','#E8D9FF','#FFF4CC','#FFE0CC'];

/* ============ HELPERS ============ */
function showPage(id, btn){
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  if(btn) btn.classList.add('active');
  if(id === 'dash') loadDashboard();
  if(id === 'list') loadExpenseListPage();
  if(id === 'set'){
    loadCategories().then(function(){ loadPayments(); loadBudgetMonthly(); });
  }
}

function switchToDashboard(){
  // หาปุ่ม tab ของ Dashboard
  var dashBtn = null;
  document.querySelectorAll('.tab').forEach(function(t){
    var oc = t.getAttribute('onclick') || '';
    if(oc.indexOf("'dash'") >= 0) dashBtn = t;
  });
  showPage('dash', dashBtn);
}
function loadExpenseListPage(){
  if(currentFilterCategory){
    renderFilteredList();
    return;
  }
  loadExpensePage(currentExpensePage);
}

function fmt(n){
  return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

function toast(msg){
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2200);
}

function loading(on){
  document.getElementById('loading').classList.toggle('show', !!on);
}

function closeModal(id){
  document.getElementById(id).style.display = 'none';
}

/* ============ LOCALSTORAGE CACHE ============ */
function saveExpense(){
  var date = document.getElementById('f-date').value;
  var cat = document.getElementById('f-cat').value;
  var pay = document.getElementById('f-pay').value;
  var amount = parseFloat(document.getElementById('f-amount').value);
  var note = document.getElementById('f-note').value.trim();

  if(!date || !cat || !pay || !amount || amount <= 0){
    toast('⚠️ กรอกข้อมูลให้ครบก่อนนะ');
    return;
  }

  loading(true);
  gs('addExpense', { date: date, category: cat, payment: pay, amount: amount, note: note })
    .then(function(){
      toast('🎉 บันทึกสำเร็จ! เยี่ยมมาก');
      fireConfetti();

      // ล้าง cache ทั้งหมด
      invalidateCache();

      // เคลียร์ฟอร์ม
      document.getElementById('f-amount').value = '';
      document.getElementById('f-note').value = '';

      // ตั้งเดือน dashboard เป็นเดือนของรายการที่เพิ่งบันทึก
      var entryMonth = date.substring(0, 7);
      if(entryMonth !== dashMonth){
        dashMonth = entryMonth;
        document.getElementById('dashMonth').value = dashMonth;
        var info = document.getElementById('dashMonthInfo');
        if(dashMonth === getCurrentMonth()){
          info.textContent = '📌 ปัจจุบัน';
          info.style.color = '#27AE60';
        } else {
          info.textContent = '📅 ' + formatMonthTH(dashMonth);
          info.style.color = '#B7791F';
        }
      }

      // กลับไปหน้า Dashboard และโหลดข้อมูลใหม่ (force)
      switchToDashboard();
      return loadDashboard(true);
    })
    .then(function(){ loading(false); })
    .catch(function(e){ loading(false); toast('❌ ' + e.message); });
}

/* ============ API CALL ============ */
function gs(fn){
  var args = Array.prototype.slice.call(arguments, 1);
  var url = API_URL.trim();
  return fetch(url, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: API_TOKEN,
      action: fn,
      args: args
    })
  })
  .then(function(r){
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  })
  .then(function(txt){
    try {
      var res = JSON.parse(txt);
      if(res.success === false) throw new Error(res.error || 'API Error');
      return res.data;
    } catch(parseErr){
      if(parseErr.message && parseErr.message.indexOf('API Error') === 0) throw parseErr;
      if(parseErr.message === 'Unauthorized') throw parseErr;
      console.error('Response:', txt.substring(0, 500));
      throw new Error('Response ไม่ใช่ JSON');
    }
  });
}

function dateToISO(d){
  var yyyy = d.getFullYear();
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

function getCurrentMonth() {
  var d = new Date();
  var yyyy = d.getFullYear();
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  return yyyy + '-' + mm;
}

function formatMonthTH(ym) {
  if(!ym) return '';
  var parts = ym.split('-');
  var monthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var m = parseInt(parts[1], 10) - 1;
  return monthNames[m] + ' ' + parts[0];
}

/* ============ THEME ============ */
function toggleTheme(){
  var body = document.body;
  var btn = document.getElementById('themeToggle');
  body.classList.toggle('dark');
  var isDark = body.classList.contains('dark');
  btn.textContent = isDark ? '☀️' : '🌙';
  try{ localStorage.setItem('expenseTheme', isDark ? 'dark' : 'light'); }catch(e){}
}

function loadTheme(){
  try{
    var saved = localStorage.getItem('expenseTheme');
    if(saved === 'dark'){
      document.body.classList.add('dark');
      document.getElementById('themeToggle').textContent = '☀️';
    }
  }catch(e){}
}

/* ============ RIPPLE EFFECT ============ */
document.addEventListener('click', function(e){
  var target = e.target.closest('.btn, .tab, .chip, .nav-btn, .cat-action-btn, .icon-btn, .limit-chip, .btn-now, .preset-btn, .page-btn, .page-num');
  if(!target) return;

  var rect = target.getBoundingClientRect();
  var ripple = document.createElement('span');
  ripple.className = 'ripple';
  var size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size/2) + 'px';

  var pos = window.getComputedStyle(target).position;
  if(pos === 'static') target.style.position = 'relative';
  target.style.overflow = 'hidden';
  target.appendChild(ripple);

  setTimeout(function(){ ripple.remove(); }, 600);

  if(navigator.vibrate){
    try{ navigator.vibrate(10); }catch(e){}
  }
});

/* ============ NUMBER COUNT-UP ============ */
function animateNumber(el, targetVal, duration){
  if(!el) return;
  duration = duration || 800;
  var start = 0;
  var startTime = null;
  var target = Number(targetVal) || 0;

  function step(ts){
    if(!startTime) startTime = ts;
    var progress = Math.min((ts - startTime) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = Math.floor(start + (target - start) * eased);
    el.textContent = current.toLocaleString('th-TH');
    if(progress < 1) requestAnimationFrame(step);
    else el.textContent = target.toLocaleString('th-TH', {maximumFractionDigits: 0});
  }
  requestAnimationFrame(step);
}

/* ============ CONFETTI ============ */
function fireConfetti(){
  var colors = ['#FFB8D1','#A8E6CF','#A8D8FF','#C7A8FF','#FFE48A','#FFC4A3'];
  var count = 30;
  for(var i = 0; i < count; i++){
    (function(i){
      setTimeout(function(){
        var p = document.createElement('div');
        p.className = 'confetti-piece';
        p.style.left = (Math.random() * 100) + 'vw';
        p.style.top = '-20px';
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
        p.style.width = (6 + Math.random() * 8) + 'px';
        p.style.height = (6 + Math.random() * 8) + 'px';
        p.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
        p.style.animationDelay = (Math.random() * .3) + 's';
        document.body.appendChild(p);
        setTimeout(function(){ p.remove(); }, 3500);
      }, i * 20);
    })(i);
  }
}

/* ============ INIT (OPTIMIZED) ============ */
window.addEventListener('load', function(){
  loadTheme();
  var today = new Date();
  document.getElementById('f-date').value = dateToISO(today);

  dashMonth = getCurrentMonth();
  bmMonth = getCurrentMonth();
  document.getElementById('dashMonth').value = dashMonth;
  document.getElementById('bmMonth').value = bmMonth;
  document.getElementById('dashMonthInfo').textContent = '📌 ปัจจุบัน';
  document.getElementById('dashMonthInfo').style.color = '#27AE60';

  console.log('🔧 API_URL =', API_URL);

  // ⚡ ลองโหลดจาก cache ก่อน (แสดงทันที)
  var cached = loadCache('initData');
  if(cached){
    applyInitData(cached, true);
  } else {
    showSkeletonDashboard();
    loading(true);
  }

  // ⚡ เรียก API รอบเดียว
  var t0 = performance.now();
  gs('getInitData', currentExpenseLimit, dashMonth)
    .then(function(data){
      var t1 = performance.now();
      console.log('⚡ API took:', Math.round(t1 - t0), 'ms');
      saveCache('initData', data, 5 * 60 * 1000);
      applyInitData(data, false);
      loading(false);
    })
    .catch(function(e){
      loading(false);
      if(!cached){
        toast('❌ โหลดไม่สำเร็จ: ' + e.message);
        console.error('Init error:', e);
      }
    });
});

function applyInitData(data, fromCache){
  CATS = data.categories || [];
  PAYS = data.payments || [];
  DASH = data.dashboard;

  fillSelects();
  renderSummary();
  renderCatChart();
  renderTimeChart();
  renderPayChart();
  renderCatLimits();

  if(fromCache){
    console.log('⚡ ใช้ข้อมูลจาก cache');
  }
}

function showSkeletonDashboard(){
  var grid = document.getElementById('summaryGrid');
  if(grid){
    var sk = '<div class="insight-card"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div></div>';
    grid.innerHTML = sk + sk + sk + sk;
  }
}

function fillSelects(){
  document.getElementById('f-cat').innerHTML = CATS
    .map(function(c){ return '<option value="' + c.name + '">' + c.icon + ' ' + c.name + '</option>'; })
    .join('');
  document.getElementById('f-pay').innerHTML = PAYS
    .map(function(p){ return '<option value="' + p.name + '">' + p.icon + ' ' + p.name + '</option>'; })
    .join('');
}

/* ============ DASHBOARD MONTH ============ */
function changeDashMonth() {
  var val = document.getElementById('dashMonth').value;
  dashMonth = val || getCurrentMonth();
  var info = document.getElementById('dashMonthInfo');
  if (dashMonth === getCurrentMonth()) {
    info.textContent = '📌 ปัจจุบัน';
    info.style.color = '#27AE60';
  } else {
    info.textContent = '📅 ' + formatMonthTH(dashMonth);
    info.style.color = '#B7791F';
  }
  loadDashboard();
}

/* ============ SAVE EXPENSE ============ */
function saveExpense(){
  var date = document.getElementById('f-date').value;
  var cat = document.getElementById('f-cat').value;
  var pay = document.getElementById('f-pay').value;
  var amount = parseFloat(document.getElementById('f-amount').value);
  var note = document.getElementById('f-note').value.trim();

  if(!date || !cat || !pay || !amount || amount <= 0){
    toast('⚠️ กรอกข้อมูลให้ครบก่อนนะ');
    return;
  }

  loading(true);
  gs('addExpense', { date: date, category: cat, payment: pay, amount: amount, note: note })
    .then(function(){
      toast('🎉 บันทึกสำเร็จ! เยี่ยมมาก');
      fireConfetti();
      invalidateCache();
      document.getElementById('f-amount').value = '';
      document.getElementById('f-note').value = '';
      return loadDashboard();
    })
    .then(function(){ loading(false); })
    .catch(function(e){ loading(false); toast('❌ ' + e.message); });
}

/* ============ DASHBOARD (OPTIMIZED) ============ */
function loadDashboard(forceRefresh){
  var cached = forceRefresh ? null : loadCache('dashboard_' + dashMonth);

  if(cached){
    DASH = cached;
    renderSummary();
    renderCatChart();
    renderTimeChart();
    renderPayChart();
    renderCatLimits();
  } else {
    loading(true);
  }

  return gs('getDashboard', currentExpenseLimit, dashMonth)
    .then(function(d){
      if(!d || !d.summary) throw new Error('ข้อมูลว่างเปล่า');

      DASH = d;
      saveCache('dashboard_' + dashMonth, d, 3 * 60 * 1000);

      renderSummary();
      renderCatChart();
      renderTimeChart();
      renderPayChart();
      renderCatLimits();

      loading(false);
    })
    .catch(function(e){
      loading(false);
      if(!cached){
        toast('โหลด dashboard ไม่สำเร็จ: ' + e.message);
      }
      console.error('Dashboard error:', e);
    });
}
/* ============ RENDER SUMMARY ============ */
function renderSummary(){
  var s = DASH.summary;
  var ins = DASH.insights || {};

  function fmtDiff(diff, hasHistory, isNew){
    if(!hasHistory){
      return '<span class="insight-badge same">— ไม่มีข้อมูล</span>';
    }
    if(isNew){
      return '<span class="insight-badge new">▲ ใหม่</span>';
    }
    var abs = Math.abs(diff).toFixed(1);
    if(diff > 0.5){
      return '<span class="insight-badge up">▲ +' + abs + '%</span>';
    } else if(diff < -0.5){
      return '<span class="insight-badge down">▼ ' + abs + '%</span>';
    } else {
      return '<span class="insight-badge same">— 0%</span>';
    }
  }

  var dayBadge = ins.day ? fmtDiff(ins.day.diff, ins.day.hasHistory, ins.day.isNew) : '';
  var weekBadge = ins.week ? fmtDiff(ins.week.diff, ins.week.hasHistory, ins.week.isNew) : '';

  var monthBadge = '';
  var monthSub = '';
  if(ins.month){
    monthBadge = fmtDiff(ins.month.diff, ins.month.hasHistory, ins.month.isNew);
    if(ins.month.prevFull > 0){
      monthSub = 'เดือนก่อนทั้งเดือน: <b>฿' + fmt(ins.month.prevFull) + '</b>';
    }
  }

  var avgValue = ins.avgPerDay || 0;
  var forecast = ins.forecast || 0;

  var html =
    '<div class="insight-card c-day">' +
      '<div class="insight-label">📅 วันนี้</div>' +
      '<div class="insight-value"><span id="sum-day">0</span><span class="unit">บาท</span></div>' +
      dayBadge +
      '<div class="insight-sub">' + (ins.day && ins.day.prevValue > 0 ? 'เมื่อวาน: ฿' + fmt(ins.day.prevValue) : 'ยังไม่มีข้อมูลเมื่อวาน') + '</div>' +
    '</div>' +

    '<div class="insight-card c-week">' +
      '<div class="insight-label">🗓️ สัปดาห์นี้</div>' +
      '<div class="insight-value"><span id="sum-week">0</span><span class="unit">บาท</span></div>' +
      weekBadge +
      '<div class="insight-sub">' + (ins.week && ins.week.prevValue > 0 ? 'สัปดาห์ก่อน: ฿' + fmt(ins.week.prevValue) : 'ยังไม่มีข้อมูล') + '</div>' +
    '</div>' +

    '<div class="insight-card c-month">' +
      '<div class="insight-label">📆 เดือนนี้</div>' +
      '<div class="insight-value"><span id="sum-month">0</span><span class="unit">บาท</span></div>' +
      monthBadge +
      '<div class="insight-sub">' + (monthSub || 'ยังไม่มีข้อมูลเดือนก่อน') + '</div>' +
    '</div>' +

    '<div class="insight-card c-avg">' +
      '<div class="insight-label">📊 เฉลี่ย/วัน</div>' +
      '<div class="insight-value"><span id="sum-avg">0</span><span class="unit">บาท</span></div>' +
      '<div class="insight-sub">คาดการณ์สิ้นเดือน <b>~฿' + fmt(Math.round(forecast)) + '</b></div>' +
      '<div class="forecast-bar"><div id="forecastBar" style="width:0%"></div></div>' +
    '</div>';

  document.getElementById('summaryGrid').innerHTML = html;

  setTimeout(function(){
    animateNumber(document.getElementById('sum-day'), s.day);
    animateNumber(document.getElementById('sum-week'), s.week);
    animateNumber(document.getElementById('sum-month'), s.month);
    animateNumber(document.getElementById('sum-avg'), Math.round(avgValue));

    setTimeout(function(){
      var fb = document.getElementById('forecastBar');
      if(fb){
        var pct = Math.min((ins.dayOfMonth / ins.daysInMonth) * 100, 100);
        fb.style.width = pct + '%';
      }
    }, 200);
  }, 50);
}

/* ============ CATEGORY CHART ============ */
function renderCatChart(){
  var canvas = document.getElementById('catChart');
  if(!canvas) return;
  if(charts.cat){ charts.cat.destroy(); charts.cat = null; }

  var keys = Object.keys(DASH.byCategory);
  if(keys.length === 0){
    canvas.parentElement.innerHTML = '<div class="empty"><span class="emo">📭</span>ยังไม่มีข้อมูล</div>';
    return;
  }

  var iconMap = DASH.catIconMap || {};
  var labelsWithIcon = keys.map(function(k){
    return (iconMap[k] || '📌') + ' ' + k;
  });

  charts.cat = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: labelsWithIcon,
      datasets: [{
        data: keys.map(function(k){ return DASH.byCategory[k]; }),
        backgroundColor: keys.map(function(_, i){ return PALETTE[i % PALETTE.length]; }),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { animateRotate: true, animateScale: true, duration: 1200, easing: 'easeOutQuart' },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 6 } },
        tooltip: {
          callbacks: {
            label: function(ctx){
              var total = ctx.dataset.data.reduce(function(a, b){ return a + b; }, 0);
              var pct = ((ctx.parsed / total) * 100).toFixed(1);
              return ctx.label + ': ฿' + fmt(ctx.parsed) + ' (' + pct + '%)';
            }
          }
        }
      }
    }
  });
}

/* ============ TIME CHART ============ */
function renderTimeChart(){
  var canvas = document.getElementById('timeChart');
  if(!canvas) return;
  if(charts.time){ charts.time.destroy(); charts.time = null; }

  updateNavButtons();

  if(currentChartMode === 'overview' && DASH && DASH.summary){
    var s = DASH.summary;
    drawTimeChart({
      labels: ['วันนี้', 'สัปดาห์', 'เดือน', 'ปี'],
      data: [s.day, s.week, s.month, s.year],
      colors: ['#FFB8D1', '#A8E6CF', '#A8D8FF', '#FFE48A'],
      title: '📌 ภาพรวม'
    });
    return;
  }

  if(currentChartMode === 'custom'){ return; }

  if(chartOffset === 0){
    gs('getChartData', currentChartMode)
      .then(function(res){
        if(!res || !res.labels) throw new Error('ไม่มีข้อมูล');
        drawTimeChart(res);
      })
      .catch(function(e){
        toast('โหลดกราฟไม่สำเร็จ: ' + e.message);
      });
  } else {
    loadChartWithOffset();
  }
}

function drawTimeChart(res){
  var canvas = document.getElementById('timeChart');
  if(!canvas) return;
  if(charts.time){ charts.time.destroy(); charts.time = null; }

  var infoEl = document.getElementById('chartInfo');
  if(infoEl) infoEl.textContent = res.title || '';

  var maxVal = Math.max.apply(null, res.data.concat([0]));

  var totalLabels = res.labels.length;
  var skipEvery = 1;
  if(totalLabels > 30) skipEvery = 7;
  else if(totalLabels > 20) skipEvery = 5;
  else if(totalLabels > 12) skipEvery = 2;

  charts.time = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: res.labels,
      datasets: [{
        label: 'ยอดใช้จ่าย (บาท)',
        data: res.data,
        backgroundColor: res.colors,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx){
              var total = ctx.dataset.data.reduce(function(a, b){ return a + b; }, 0);
              var pct = total > 0 ? ((ctx.parsed.y / total) * 100).toFixed(1) : '0';
              var isMax = ctx.parsed.y === maxVal && ctx.parsed.y > 0;
              return (isMax ? '👑 ' : '') + '฿' + fmt(ctx.parsed.y) + ' (' + pct + '%)';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 10 },
            callback: function(v){
              if(v >= 1000) return '฿' + (v / 1000).toFixed(1) + 'k';
              return '฿' + v;
            }
          }
        },
        x: {
          ticks: {
            font: { size: 9 },
            autoSkip: false,
            maxRotation: 60,
            minRotation: 0,
            callback: function(value, index){
              if(index % skipEvery === 0) return this.getLabelForValue(value);
              return '';
            }
          }
        }
      }
    }
  });
}

function switchChartMode(mode, btn){
  currentChartMode = mode;
  chartOffset = 0;
  isCustomRange = false;

  document.querySelectorAll('.chart-controls .chip').forEach(function(c){
    c.classList.remove('active');
  });
  if(btn) btn.classList.add('active');

  updateNavButtons();
  renderTimeChart();
}

function shiftChart(direction){
  if(currentChartMode === 'overview' || isCustomRange) return;
  chartOffset += direction;
  loadChartWithOffset();
}

function loadChartWithOffset(){
  var canvas = document.getElementById('timeChart');
  if(!canvas) return;

  updateNavButtons();
  loading(true);
  gs('getChartDataShift', currentChartMode, chartOffset)
    .then(function(res){
      if(!res || !res.labels) throw new Error('ไม่มีข้อมูล');
      drawTimeChart(res);
      loading(false);
    })
    .catch(function(e){
      loading(false);
      toast('❌ ' + e.message);
    });
}

function updateNavButtons(){
  var nav = document.getElementById('chartNav');
  if(!nav) return;

  var prevBtn = nav.querySelector('.nav-btn:nth-child(1)');
  var nextBtn = nav.querySelector('.nav-btn:nth-child(2)');
  var btnNow = document.getElementById('btnNow');

  if(currentChartMode === 'overview'){
    nav.classList.add('hidden');
    return;
  }

  nav.classList.remove('hidden');

  var shouldShowNow = isCustomRange || chartOffset !== 0;
  if(btnNow){
    if(shouldShowNow) btnNow.classList.add('show');
    else btnNow.classList.remove('show');
  }

  if(prevBtn) prevBtn.disabled = isCustomRange;
  if(nextBtn) nextBtn.disabled = (isCustomRange || chartOffset >= 0);
}

function backToNow(){
  chartOffset = 0;
  isCustomRange = false;
  currentChartMode = 'overview';

  document.querySelectorAll('.chart-controls .chip').forEach(function(c){
    c.classList.remove('active');
    if(c.dataset.mode === 'overview') c.classList.add('active');
  });

  var btnNow = document.getElementById('btnNow');
  if(btnNow) btnNow.classList.remove('show');

  if(DASH && DASH.summary){
    var s = DASH.summary;
    drawTimeChart({
      labels: ['วันนี้', 'สัปดาห์', 'เดือน', 'ปี'],
      data: [s.day, s.week, s.month, s.year],
      colors: ['#FFB8D1', '#A8E6CF', '#A8D8FF', '#FFE48A'],
      title: '📌 ภาพรวม'
    });
  } else {
    renderTimeChart();
  }

  updateNavButtons();
  toast('🏠 กลับมาดูข้อมูลล่าสุดแล้ว');
}

/* ============ DATE RANGE ============ */
function openDateRangeModal(){
  document.getElementById('dateRangeModal').classList.add('show');

  var today = new Date();
  var month = new Date();
  month.setDate(today.getDate() - 29);

  document.getElementById('dr-start').value = dateToISO(month);
  document.getElementById('dr-end').value = dateToISO(today);
  updateDateRangePreview();

  document.getElementById('dr-start').onchange = updateDateRangePreview;
  document.getElementById('dr-end').onchange = updateDateRangePreview;
}

function closeDateRangeModal(){
  document.getElementById('dateRangeModal').classList.remove('show');
}

function setPreset(days){
  var end = new Date();
  var start = new Date();
  start.setDate(end.getDate() - (days - 1));
  document.getElementById('dr-start').value = dateToISO(start);
  document.getElementById('dr-end').value = dateToISO(end);
  updateDateRangePreview();
}

function setPresetThisMonth(){
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), 1);
  var end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  document.getElementById('dr-start').value = dateToISO(start);
  document.getElementById('dr-end').value = dateToISO(end);
  updateDateRangePreview();
}

function setPresetLastMonth(){
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var end = new Date(now.getFullYear(), now.getMonth(), 0);
  document.getElementById('dr-start').value = dateToISO(start);
  document.getElementById('dr-end').value = dateToISO(end);
  updateDateRangePreview();
}

function updateDateRangePreview(){
  var start = document.getElementById('dr-start').value;
  var end = document.getElementById('dr-end').value;
  var el = document.getElementById('dr-preview');
  if(!start || !end){ el.textContent = ''; return; }
  var s = new Date(start);
  var e = new Date(end);
  if(s > e){
    el.textContent = '⚠️ วันเริ่มต้องมาก่อนวันสิ้นสุด';
    el.style.color = '#C0392B';
    return;
  }
  var days = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
  el.textContent = '📊 รวม ' + days + ' วัน' + (days > 62 ? ' (แสดงเป็นรายสัปดาห์)' : '');
  el.style.color = 'var(--muted)';
}

function applyDateRange(){
  var start = document.getElementById('dr-start').value;
  var end = document.getElementById('dr-end').value;

  if(!start || !end){ toast('⚠️ เลือกวันที่ให้ครบก่อนนะ'); return; }
  if(new Date(start) > new Date(end)){ toast('⚠️ วันเริ่มต้องมาก่อนวันสิ้นสุด'); return; }

  closeDateRangeModal();
  isCustomRange = true;
  chartOffset = 0;
  currentChartMode = 'custom';

  document.querySelectorAll('.chart-controls .chip').forEach(function(c){
    c.classList.remove('active');
  });

  loading(true);
  gs('getChartDataCustom', start, end)
    .then(function(res){
      if(!res || !res.labels) throw new Error('ไม่มีข้อมูล');
      if(res.error) throw new Error(res.error);
      drawTimeChart(res);
      updateNavButtons();
      loading(false);
    })
    .catch(function(e){
      loading(false);
      toast('❌ ' + e.message);
      isCustomRange = false;
    });
}

/* ============ PAYMENT CHART ============ */
function renderPayChart(){
  var canvas = document.getElementById('payChart');
  if(!canvas) return;
  if(charts.pay){ charts.pay.destroy(); charts.pay = null; }

  var keys = Object.keys(DASH.byPayment);
  if(keys.length === 0){
    canvas.parentElement.innerHTML = '<div class="empty"><span class="emo">💳</span>ยังไม่มีข้อมูล</div>';
    return;
  }

  var iconMap = DASH.payIconMap || {};
  var labelsWithIcon = keys.map(function(k){
    return (iconMap[k] || '💳') + ' ' + k;
  });

  charts.pay = new Chart(canvas.getContext('2d'), {
    type: 'pie',
    data: {
      labels: labelsWithIcon,
      datasets: [{
        data: keys.map(function(k){ return DASH.byPayment[k]; }),
        backgroundColor: keys.map(function(_, i){ return PALETTE[(i + 4) % PALETTE.length]; }),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { animateRotate: true, animateScale: true, duration: 1200, easing: 'easeOutQuart' },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 6 } },
        tooltip: {
          callbacks: {
            label: function(ctx){
              var total = ctx.dataset.data.reduce(function(a, b){ return a + b; }, 0);
              var pct = ((ctx.parsed / total) * 100).toFixed(1);
              return ctx.label + ': ฿' + fmt(ctx.parsed) + ' (' + pct + '%)';
            }
          }
        }
      }
    }
  });
}

/* ============ CATEGORY LIMITS ============ */
function renderCatLimits(){
  var wrap = document.getElementById('catLimits');
  if(!DASH.catStat || DASH.catStat.length === 0){
    wrap.innerHTML =
      '<div class="cat-limits-empty">' +
        '<span class="emo">🎯</span>' +
        'ยังไม่มีหมวดหมู่ กด + เพิ่มที่หน้าตั้งค่า' +
      '</div>';
    return;
  }

  var html = '<div class="cat-limits-grid">';
  DASH.catStat.forEach(function(c){
    var limit = c.limit || 0;
    var used = c.used || 0;
    var remain = Math.max(limit - used, 0);
    var pctUsed = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    var pctRemain = Math.max(100 - pctUsed, 0);

    var barColor, cardClass, badge = '';
    if(limit === 0){
      barColor = 'linear-gradient(90deg, #C7A8FF, #E8D9FF)';
      cardClass = '';
    } else if(pctUsed >= 100){
      barColor = 'linear-gradient(90deg, #FF6B6B, #FFB8B8)';
      cardClass = 'over-budget';
      badge = '<div class="cat-card-badge danger">⚠️ เกินวงเงิน</div>';
    } else if(pctUsed >= 80){
      barColor = 'linear-gradient(90deg, #FFB84D, #FFE48A)';
      cardClass = 'warning';
      badge = '<div class="cat-card-badge warn">⚡ ใกล้เต็ม</div>';
    } else {
      barColor = 'linear-gradient(90deg, #6DCFA6, #A8E6CF)';
      cardClass = 'good';
    }

    var pctDisplay = limit > 0 ? pctRemain.toFixed(1) + '%' : '—';
    var pctColor = limit > 0
      ? (pctRemain >= 50 ? '#27AE60' : (pctRemain >= 20 ? '#B7791F' : '#C0392B'))
      : '#8B85A0';

    var customBadge = c.hasCustom
      ? '<div class="cat-card-badge custom">🎯 ตั้งเฉพาะเดือน</div>'
      : '';

    var catObj = CATS.filter(function(x){ return x.name === c.name; })[0];
    var catId = catObj ? catObj.id : '';
    var catColor = catObj ? catObj.color : (c.color || '#FFD9E8');
    var catLimit = catObj ? catObj.limit : 0;
    var catIcon = catObj ? catObj.icon : c.icon;

    var catDataJSON = JSON.stringify({
      id: catId, name: c.name, icon: catIcon, limit: catLimit, color: catColor
    }).replace(/'/g, "&#39;");

    html +=
      '<div class="cat-card ' + cardClass + '">' +
        badge + customBadge +
        '<div class="cat-card-header">' +
          '<div class="cat-card-icon" style="background:' + (c.color || '#FFD9E8') + '">' + c.icon + '</div>' +
          '<div class="cat-card-title">' +
            '<div class="name">' + c.name + '</div>' +
            '<div class="sub">' + (limit > 0 ? 'คงเหลือ ' + pctRemain.toFixed(0) + '%' : 'ไม่กำหนดวงเงิน') + '</div>' +
          '</div>' +
          '<div class="cat-card-actions">' +
            '<button class="cat-action-btn edit" onclick=\'openCatModal(' + catDataJSON + ')\' title="แก้ไข">✏️</button>' +
            '<button class="cat-action-btn add" onclick="quickAddExpense(\'' + c.name.replace(/'/g, "\\'") + '\')" title="เพิ่ม">➕</button>' +
            '<button class="cat-action-btn list" onclick="filterByCategory(\'' + c.name.replace(/'/g, "\\'") + '\')" title="ดูรายการ">📋</button>' +
          '</div>' +
          '<div class="cat-card-pct" style="color:' + pctColor + '">' + pctDisplay + '</div>' +
        '</div>' +
        '<div class="cat-card-amounts">' +
          '<div class="item used"><span class="lbl">💸 ใช้ไป</span><span class="val">฿' + fmt(used) + '</span></div>' +
          '<div class="item limit"><span class="lbl">🎯 วงเงิน</span><span class="val">฿' + fmt(limit) + '</span></div>' +
          '<div class="item remain"><span class="lbl">💰 คงเหลือ</span><span class="val">฿' + fmt(remain) + '</span></div>' +
        '</div>' +
        '<div class="cat-card-bar"><div style="width:' + pctUsed + '%; background:' + barColor + '"></div></div>' +
      '</div>';
  });
  html += '</div>';
  wrap.innerHTML = html;
}

/* ============ QUICK ADD ============ */
function quickAddExpense(categoryName){
  var addBtn = null;
  document.querySelectorAll('.tab').forEach(function(t){
    if(t.getAttribute('onclick') && t.getAttribute('onclick').indexOf("'add'") >= 0){
      addBtn = t;
    }
  });
  showPage('add', addBtn);

  document.getElementById('f-date').value = dateToISO(new Date());

  setTimeout(function(){
    var sel = document.getElementById('f-cat');
    for(var i = 0; i < sel.options.length; i++){
      if(sel.options[i].value === categoryName){
        sel.selectedIndex = i;
        break;
      }
    }
    var amtInput = document.getElementById('f-amount');
    if(amtInput){
      amtInput.focus();
      amtInput.scrollIntoView({behavior: 'smooth', block: 'center'});
    }
    toast('📝 เพิ่มรายการในหมวด: ' + categoryName);
  }, 150);
}

/* ============ FILTER ============ */
function filterByCategory(categoryName){
  if(currentFilterCategory === categoryName){
    clearCategoryFilter();
    return;
  }
  currentFilterCategory = categoryName;
  filterPage = 1;

  var listBtn = null;
  document.querySelectorAll('.tab').forEach(function(t){
    if(t.getAttribute('onclick') && t.getAttribute('onclick').indexOf("'list'") >= 0){
      listBtn = t;
    }
  });
  showPage('list', listBtn);

  var banner = document.getElementById('filterBanner');
  banner.innerHTML =
    '🔍 กำลังดูเฉพาะ: <b>' + categoryName + '</b>' +
    '<button class="clear-filter" onclick="clearCategoryFilter()">✖ ล้างตัวกรอง</button>';
  banner.classList.add('show');

  setTimeout(function(){ renderFilteredList(); }, 150);
}

function clearCategoryFilter(){
  currentFilterCategory = '';
  filterPage = 1;
  var banner = document.getElementById('filterBanner');
  if(banner) banner.classList.remove('show');
  loadExpensePage(1);
}

/* ============ PAGINATION ============ */
function loadExpensePage(page){
  loading(true);
  gs('getExpensesPaged', currentExpenseLimit, page, dashMonth)
    .then(function(res){
      if(!res || !res.items) throw new Error('โหลดไม่ได้');
      currentExpensePage = res.page;
      currentTotalPages = res.totalPages;
      currentTotalItems = res.total;
      renderExpenseItems(res.items);
      renderPagination(res);
      if(res.items.length === 0 && res.total > 0 && page > 1){
        loadExpensePage(res.totalPages);
        return;
      }
      loading(false);
    })
    .catch(function(e){ loading(false); toast('❌ ' + e.message); });
}

function renderExpenseItems(items){
  if(!items || items.length === 0){
    document.getElementById('expList').innerHTML =
      '<div class="empty"><span class="emo">📭</span>ยังไม่มีรายการ</div>';
    return;
  }

  var catIconMap = (DASH && DASH.catIconMap) || {};
  var catColorMap = (DASH && DASH.catColorMap) || {};
  var payIconMap = (DASH && DASH.payIconMap) || {};

  var html = '';
  items.forEach(function(e){
    var catIcon = catIconMap[e.category] || '📌';
    var catColor = catColorMap[e.category] || '#FFD9E8';
    var payIcon = payIconMap[e.payment] || '💳';

    html +=
      '<div class="list-item">' +
        '<div class="icon" style="background:' + catColor + '">' + catIcon + '</div>' +
        '<div class="info">' +
          '<div class="t">' + e.category + '</div>' +
          '<div class="s">' + e.date + ' • ' + payIcon + ' ' + e.payment + (e.note ? (' • ' + e.note) : '') + '</div>' +
        '</div>' +
        '<div class="amt">฿' + fmt(e.amount) + '</div>' +
        '<div class="actions">' +
          '<button class="icon-btn btn-edit" onclick=\'openExpenseEditModal(' + JSON.stringify(e) + ')\'>✏️</button>' +
          '<button class="icon-btn" style="background:#FFE0E0;color:#C0392B" onclick="delExpense(\'' + e.id + '\')">🗑️</button>' +
        '</div>' +
      '</div>';
  });
  document.getElementById('expList').innerHTML = html;
}

function renderPagination(res){
  var wrap = document.getElementById('pagination');
  if(!wrap) return;

  if(res.total === 0){ wrap.innerHTML = ''; return; }

  if(res.totalPages <= 1){
    wrap.innerHTML = '<div class="page-info">แสดง <b>' + res.total + '</b> รายการ</div>';
    return;
  }

  var prevBtn = '<button class="page-btn" onclick="goToPage(' + (res.page - 1) + ')"' +
    (res.page <= 1 ? ' disabled' : '') + '>◀ ก่อนหน้า</button>';

  var nextBtn = '<button class="page-btn" onclick="goToPage(' + (res.page + 1) + ')"' +
    (res.page >= res.totalPages ? ' disabled' : '') + '>ถัดไป ▶</button>';

  var pages = [];
  var total = res.totalPages;
  var cur = res.page;
  var windowSize = 2;

  if(total <= 7){
    for(var i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    var start = Math.max(2, cur - windowSize);
    var end = Math.min(total - 1, cur + windowSize);
    if(start > 2) pages.push('...');
    for(var j = start; j <= end; j++) pages.push(j);
    if(end < total - 1) pages.push('...');
    pages.push(total);
  }

  var numsHtml = '';
  pages.forEach(function(p){
    if(p === '...') numsHtml += '<span class="page-num dots">…</span>';
    else if(p === cur) numsHtml += '<button class="page-num active">' + p + '</button>';
    else numsHtml += '<button class="page-num" onclick="goToPage(' + p + ')">' + p + '</button>';
  });

  wrap.innerHTML =
    '<div class="page-nav">' + prevBtn + '</div>' +
    '<div class="page-numbers">' + numsHtml + '</div>' +
    '<div class="page-nav">' + nextBtn + '</div>' +
    '<div class="page-info">' +
      'แสดง <b>' + res.start + '-' + res.end + '</b> จาก <b>' + res.total + '</b> รายการ' +
      ' • หน้า <b>' + res.page + '</b>/<b>' + res.totalPages + '</b>' +
    '</div>';
}

function goToPage(page){
  if(page < 1 || page > currentTotalPages) return;
  if(currentFilterCategory){
    filterPage = page;
    renderFilteredList();
  } else {
    loadExpensePage(page);
  }
  var el = document.getElementById('list');
  if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
}

function renderFilteredList(){
  if(!currentFilterCategory){ loadExpenseList(); return; }

  loading(true);
  gs('getExpensesPagedFilter', filterPageSize, filterPage, currentFilterCategory)
    .then(function(res){
      currentExpensePage = res.page;
      currentTotalPages = res.totalPages;
      currentTotalItems = res.total;
      renderExpenseItems(res.items);
      renderPagination(res);
      loading(false);
    })
    .catch(function(e){ loading(false); toast('❌ ' + e.message); });
}

function loadExpenseList(){
  if(currentFilterCategory){ renderFilteredList(); return; }

  var list = (DASH && DASH.expenses) ? DASH.expenses : [];
  if(list.length === 0){
    document.getElementById('expList').innerHTML =
      '<div class="empty"><span class="emo">📭</span>ยังไม่มีรายการ</div>';
    document.getElementById('pagination').innerHTML = '';
    return;
  }
  renderExpenseItems(list);
  document.getElementById('pagination').innerHTML = '';
}

function switchExpenseLimit(limit, btn){
  currentExpenseLimit = limit;
  currentExpensePage = 1;
  filterPageSize = limit;

  document.querySelectorAll('.list-controls .limit-chip').forEach(function(c){
    c.classList.remove('active');
  });
  if(btn) btn.classList.add('active');

  if(currentFilterCategory){
    filterPage = 1;
    renderFilteredList();
  } else {
    loadExpensePage(1);
  }
}

function delExpense(id){
  if(!confirm('ลบรายการนี้?')) return;
  loading(true);
  gs('deleteExpense', id)
    .then(function(){
      toast('🗑️ ลบแล้ว');
      invalidateCache();
      return loadDashboard();
    })
    .then(function(){
      if(currentFilterCategory) renderFilteredList();
      else loadExpensePage(currentExpensePage);
      loading(false);
    })
    .catch(function(e){ loading(false); toast('❌ ' + e.message); });
}

/* ============ EDIT EXPENSE ============ */
function openExpenseEditModal(e){
  document.getElementById('expModal').style.display = 'flex';
  document.getElementById('expModalTitle').textContent = '✏️ แก้ไขรายการ';
  document.getElementById('m-exp-id').value = e.id;
  document.getElementById('m-exp-date').value = e.date;
  document.getElementById('m-exp-amount').value = e.amount;
  document.getElementById('m-exp-note').value = e.note || '';

  document.getElementById('m-exp-cat').innerHTML = CATS
    .map(function(c){
      var sel = (c.name === e.category) ? ' selected' : '';
      return '<option value="' + c.name + '"' + sel + '>' + c.icon + ' ' + c.name + '</option>';
    }).join('');

  document.getElementById('m-exp-pay').innerHTML = PAYS
    .map(function(p){
      var sel = (p.name === e.payment) ? ' selected' : '';
      return '<option value="' + p.name + '"' + sel + '>' + p.icon + ' ' + p.name + '</option>';
    }).join('');
}

function saveExpenseEdit(){
  var payload = {
    id: document.getElementById('m-exp-id').value,
    date: document.getElementById('m-exp-date').value,
    category: document.getElementById('m-exp-cat').value,
    payment: document.getElementById('m-exp-pay').value,
    amount: parseFloat(document.getElementById('m-exp-amount').value),
    note: document.getElementById('m-exp-note').value.trim()
  };

  if(!payload.date || !payload.category || !payload.payment || !payload.amount || payload.amount <= 0){
    toast('⚠️ กรอกข้อมูลให้ครบก่อนนะ');
    return;
  }

  loading(true);
  gs('updateExpense', payload)
    .then(function(){
      toast('✅ แก้ไขสำเร็จ!');
      closeModal('expModal');
      invalidateCache();
      return loadDashboard();
    })
    .then(function(){
      if(currentFilterCategory) renderFilteredList();
      else loadExpensePage(currentExpensePage);
      loading(false);
    })
    .catch(function(e){ loading(false); toast('❌ ' + e.message); });
}

/* ============ SETTINGS: CATEGORIES ============ */
function loadCategories(){
  return gs('getCategories').then(function(cats){
    CATS = cats;
    fillSelects();
    var html = '';
    if(cats.length === 0){
      html = '<div class="empty"><span class="emo">🏷️</span>ยังไม่มีหมวดหมู่</div>';
    } else {
      cats.forEach(function(c){
        html +=
          '<div class="settings-row">' +
            '<div class="icon" style="background:' + c.color + '">' + c.icon + '</div>' +
            '<div class="info">' +
              '<div class="t">' + c.name + '</div>' +
              '<div class="s">วงเงินเริ่มต้น: ฿' + fmt(c.limit) + '</div>' +
            '</div>' +
            '<div class="actions">' +
              '<button class="icon-btn btn-edit" onclick=\'openCatModal(' + JSON.stringify(c) + ')\'>✏️</button>' +
              '<button class="icon-btn" style="background:#FFE0E0" onclick="delCat(\'' + c.id + '\')">🗑️</button>' +
            '</div>' +
          '</div>';
      });
    }
    document.getElementById('catList').innerHTML = html;
  });
}

function openCatModal(c){
  document.getElementById('catModal').style.display = 'flex';
  if(c){
    document.getElementById('catModalTitle').textContent = 'แก้ไขหมวดหมู่';
    document.getElementById('m-cat-id').value = c.id || '';
    document.getElementById('m-cat-name').value = c.name || '';
    document.getElementById('m-cat-icon').value = c.icon || '';
    document.getElementById('m-cat-limit').value = c.limit || 0;
    document.getElementById('m-cat-color').value = c.color || '#FFD9E8';
  } else {
    document.getElementById('catModalTitle').textContent = 'เพิ่มหมวดหมู่';
    document.getElementById('m-cat-id').value = '';
    document.getElementById('m-cat-name').value = '';
    document.getElementById('m-cat-icon').value = '';
    document.getElementById('m-cat-limit').value = '';
    document.getElementById('m-cat-color').value = '#FFD9E8';
  }
}

function saveCat(){
  var id = document.getElementById('m-cat-id').value;
  var payload = {
    id: id,
    name: document.getElementById('m-cat-name').value.trim(),
    icon: document.getElementById('m-cat-icon').value.trim() || '📌',
    limit: parseFloat(document.getElementById('m-cat-limit').value) || 0,
    color: document.getElementById('m-cat-color').value
  };
  if(!payload.name){ toast('⚠️ ใส่ชื่อหมวดหมู่ก่อน'); return; }

  loading(true);
  var promise = id ? gs('updateCategory', payload) : gs('addCategory', payload);
  promise
    .then(function(){
      toast('✅ บันทึกแล้ว');
      closeModal('catModal');
      invalidateCache();
      return loadCategories();
    })
    .then(function(){
      loading(false);
      if(document.getElementById('dash').classList.contains('active')) loadDashboard();
    })
    .catch(function(e){ loading(false); toast('❌ ' + e.message); });
}

function delCat(id){
  if(!confirm('ลบหมวดหมู่นี้?')) return;
  loading(true);
  gs('deleteCategory', id)
    .then(function(){
      toast('🗑️ ลบแล้ว');
      invalidateCache();
      return loadCategories();
    })
    .then(function(){
      loading(false);
      if(document.getElementById('dash').classList.contains('active')) loadDashboard();
    })
    .catch(function(e){ loading(false); toast('❌ ' + e.message); });
}

/* ============ SETTINGS: PAYMENTS ============ */
function loadPayments(){
  return gs('getPayments').then(function(pays){
    PAYS = pays;
    fillSelects();
    var html = '';
    if(pays.length === 0){
      html = '<div class="empty"><span class="emo">💳</span>ยังไม่มีประเภท</div>';
    } else {
      pays.forEach(function(p){
        html +=
          '<div class="settings-row">' +
            '<div class="icon">' + p.icon + '</div>' +
            '<div class="info"><div class="t">' + p.name + '</div></div>' +
            '<div class="actions">' +
              '<button class="icon-btn btn-edit" onclick=\'openPayModal(' + JSON.stringify(p) + ')\'>✏️</button>' +
              '<button class="icon-btn" style="background:#FFE0E0" onclick="delPay(\'' + p.id + '\')">🗑️</button>' +
            '</div>' +
          '</div>';
      });
    }
    document.getElementById('payList').innerHTML = html;
  });
}

function openPayModal(p){
  document.getElementById('payModal').style.display = 'flex';
  if(p){
    document.getElementById('payModalTitle').textContent = 'แก้ไขประเภท';
    document.getElementById('m-pay-id').value = p.id;
    document.getElementById('m-pay-name').value = p.name;
    document.getElementById('m-pay-icon').value = p.icon;
  } else {
    document.getElementById('payModalTitle').textContent = 'เพิ่มประเภท';
    document.getElementById('m-pay-id').value = '';
    document.getElementById('m-pay-name').value = '';
    document.getElementById('m-pay-icon').value = '';
  }
}

function savePay(){
  var id = document.getElementById('m-pay-id').value;
  var payload = {
    id: id,
    name: document.getElementById('m-pay-name').value.trim(),
    icon: document.getElementById('m-pay-icon').value.trim() || '💳'
  };
  if(!payload.name){ toast('⚠️ ใส่ชื่อประเภทก่อน'); return; }

  loading(true);
  var promise = id ? gs('updatePayment', payload) : gs('addPayment', payload);
  promise
    .then(function(){
      toast('✅ บันทึกแล้ว');
      closeModal('payModal');
      invalidateCache();
      return loadPayments();
    })
    .then(function(){ loading(false); })
    .catch(function(e){ loading(false); toast('❌ ' + e.message); });
}

function delPay(id){
  if(!confirm('ลบประเภทนี้?')) return;
  loading(true);
  gs('deletePayment', id)
    .then(function(){
      toast('🗑️ ลบแล้ว');
      invalidateCache();
      return loadPayments();
    })
    .then(function(){ loading(false); })
    .catch(function(e){ loading(false); toast('❌ ' + e.message); });
}

/* ============ BUDGET MONTHLY ============ */
function loadBudgetMonthly(){
  var val = document.getElementById('bmMonth').value || getCurrentMonth();
  bmMonth = val;

  gs('getBudgetMonthly', bmMonth)
    .then(function(budgetMap){
      var html = '';
      if (CATS.length === 0) {
        html = '<div class="empty"><span class="emo">🏷️</span>ยังไม่มีหมวดหมู่</div>';
      } else {
        CATS.forEach(function(c){
          var customLimit = budgetMap[c.name];
          var isCustom = (customLimit !== undefined && customLimit !== null);
          var value = isCustom ? customLimit : '';

          html +=
            '<div class="bm-row">' +
              '<div class="bm-row-info">' +
                '<div class="icon" style="background:' + c.color + '">' + c.icon + '</div>' +
                '<div class="txt">' +
                  '<div class="name">' + c.name + '</div>' +
                  '<div class="sub">ค่าเริ่มต้น: ฿' + fmt(c.limit) + (isCustom ? ' • ✅ ตั้งเฉพาะเดือน' : '') + '</div>' +
                '</div>' +
              '</div>' +
              '<div class="bm-input-group">' +
                '<input type="number" min="0" step="100" placeholder="' + c.limit + '" ' +
                  'value="' + value + '" ' +
                  'class="' + (isCustom ? 'custom' : '') + '" ' +
                  'data-cat="' + c.name + '" ' +
                  'onchange="saveBM(this)" onblur="saveBM(this)">' +
                '<button class="bm-clear" ' + (isCustom ? '' : 'disabled') + ' ' +
                  'onclick="clearBM(\'' + c.name + '\')" title="ล้างค่าเฉพาะเดือน">✖</button>' +
              '</div>' +
            '</div>';
        });
      }
      document.getElementById('bmList').innerHTML = html;
    })
    .catch(function(e){ toast('❌ ' + e.message); });
}

function saveBM(input) {
  var cat = input.getAttribute('data-cat');
  var raw = input.value.trim();
  var val = raw === '' ? 0 : parseFloat(raw);

  if (isNaN(val) || val < 0) { toast('⚠️ ค่าไม่ถูกต้อง'); return; }

  var payload = { yearMonth: bmMonth, category: cat, limit: val };

  gs('setBudgetMonthly', payload)
    .then(function(res){
      if (res.action === 'deleted') {
        input.value = '';
        input.classList.remove('custom');
        toast('🗑️ ล้างค่าเฉพาะเดือน');
      } else if (res.action === 'updated' || res.action === 'added') {
        input.classList.add('custom');
        toast('✅ บันทึกแล้ว');
      }
      invalidateCache();
      loadBudgetMonthly();
    })
    .catch(function(e){ toast('❌ ' + e.message); });
}

function clearBM(cat) {
  if (!confirm('ล้างวงเงินเฉพาะเดือนของ "' + cat + '" ?')) return;
  gs('deleteBudgetMonthly', bmMonth, cat)
    .then(function(){
      toast('🗑️ ล้างแล้ว');
      invalidateCache();
      loadBudgetMonthly();
    })
    .catch(function(e){ toast('❌ ' + e.message); });
}

function copyFromPreviousMonth() {
  if (!confirm('คัดลอกวงเงินจากเดือนก่อนหน้ามาที่ ' + formatMonthTH(bmMonth) + ' ?')) return;
  gs('copyBudgetFromPreviousMonth', bmMonth)
    .then(function(res){
      if (res.copied > 0) toast('📋 คัดลอก ' + res.copied + ' รายการ จาก ' + res.from);
      else toast('ℹ️ ไม่มีข้อมูลให้คัดลอก');
      invalidateCache();
      loadBudgetMonthly();
    })
    .catch(function(e){ toast('❌ ' + e.message); });
}
