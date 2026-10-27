/* @ds-bundle: {"format":4,"namespace":"CycleLab","components":[{"name":"Icon"},{"name":"Button"},{"name":"Segmented"},{"name":"Chip"},{"name":"Badge"},{"name":"Metric"},{"name":"Progress"},{"name":"Panel"},{"name":"Sidebar"},{"name":"SyncStatus"},{"name":"LineChart"},{"name":"BarChart"},{"name":"ZoneBar"},{"name":"RouteMap"},{"name":"DataTable"},{"name":"ChatMessage"},{"name":"ToolResult"},{"name":"StateBlock"}]} */
(function () {
  var React = window.React, h = React.createElement;
  var useState = React.useState, useRef = React.useRef, useMemo = React.useMemo, useLayoutEffect = React.useLayoutEffect;

  function cx() { return Array.prototype.slice.call(arguments).filter(Boolean).join(' '); }
  function omit(o, keys) { var r = {}; for (var k in o) if (keys.indexOf(k) < 0) r[k] = o[k]; return r; }

  var TONE = { neutral: 'var(--ink-faint)', success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)', info: 'var(--info)', brand: 'var(--brand)', power: 'var(--power)', heart: 'var(--heart)', cadence: 'var(--cadence)', speed: 'var(--speed)', elevation: 'var(--elevation)', fitness: 'var(--fitness)', fatigue: 'var(--fatigue)', form: 'var(--form)', muted: 'var(--ink-muted)', faint: 'var(--ink-faint)', ink: 'var(--ink)' };
  for (var z = 1; z <= 7; z++) TONE['z' + z] = 'var(--z' + z + ')';
  function toneColor(t) { return TONE[t] || t || TONE.neutral; }

  function fmt(v) { if (v == null || isNaN(v)) return '–'; return Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10).replace('.', ','); }

  /* ---------- Icon ---------- */
  var ICONS = {
    dashboard: 'M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z',
    activity: 'M3 12h4l3-7 4 14 3-7h4',
    performance: 'M4 4v16h16M7 15c2.5-6 5.5-8 13-9',
    mountain: 'M3 19l6-10 4 6 2-3 6 7z',
    coach: 'M5 5h14v10H10l-5 4z',
    sync: 'M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
    'chevron-right': 'M9 6l6 6-6 6',
    'chevron-down': 'M6 9l6 6 6-6',
    close: 'M6 6l12 12M18 6L6 18',
    send: 'M4 12l16-8-6 16-2-7z',
    alert: 'M12 4l9 16H3zM12 10v4M12 17v.5',
    check: 'M5 12l4 4 10-10',
    compare: 'M8 4v16M16 4v16M4 8h8M12 16h8',
    plus: 'M12 5v14M5 12h14',
    bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
    heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
    cadence: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 12l4-4',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    trend: 'M4 16l5-5 4 4 7-7M15 8h5v5',
    sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
    route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8'
  };
  function Icon(p) {
    return h('svg', { className: cx('cl-icon', p.className), viewBox: '0 0 24 24', width: p.size || 16, height: p.size || 16, style: p.style, 'aria-hidden': p.title ? undefined : true, role: p.title ? 'img' : undefined },
      p.title ? h('title', null, p.title) : null, h('path', { d: ICONS[p.name] || '' }));
  }

  /* ---------- Controls ---------- */
  function Button(p) {
    var iconOnly = p.icon && p.children == null;
    var rest = omit(p, ['variant', 'size', 'icon', 'iconRight', 'children', 'className']);
    return h('button', Object.assign({ type: 'button' }, rest, { className: cx('cl-btn', 'cl-btn-' + (p.variant || 'secondary'), p.size === 'sm' && 'cl-btn-sm', iconOnly && 'cl-btn-icon', p.className) }),
      p.icon ? h(Icon, { name: p.icon, size: p.size === 'sm' ? 14 : 16 }) : null, p.children, p.iconRight ? h(Icon, { name: p.iconRight, size: 14 }) : null);
  }

  function Segmented(p) {
    return h('div', { className: cx('cl-seg', p.className), role: 'group', 'aria-label': p.label },
      (p.options || []).map(function (o) {
        o = typeof o === 'string' ? { value: o, label: o } : o;
        return h('button', { key: o.value, type: 'button', 'aria-pressed': o.value === p.value, onClick: function () { if (p.onChange) p.onChange(o.value); } }, o.label);
      }));
  }

  function Chip(p) {
    return h('button', { type: 'button', className: cx('cl-chip', p.className), 'aria-pressed': !!p.active, onClick: p.onClick },
      p.color ? h('i', { className: 'cl-chip-dot', style: { background: toneColor(p.color) } }) : null,
      p.children, p.count != null ? h('span', { className: 'cl-chip-count' }, p.count) : null);
  }

  function Badge(p) {
    return h('span', { className: cx('cl-badge', p.variant === 'outline' && 'cl-badge-outline', p.className), title: p.title },
      p.tone ? h('i', { className: 'cl-badge-dot', style: { background: toneColor(p.tone) } }) : null, p.children);
  }

  /* ---------- Figures ---------- */
  function Metric(p) {
    var d = p.delta, good = d == null || d === 0 ? null : (p.lowerIsBetter ? d < 0 : d > 0);
    return h('div', { className: cx('cl-metric', 'cl-metric-' + (p.size || 'm'), p.className) },
      h('div', { className: 'cl-metric-label' }, p.accent ? h('i', { className: 'cl-metric-swatch', style: { background: toneColor(p.accent) } }) : null, p.label),
      h('div', { className: 'cl-metric-value' }, p.value, p.unit ? h('span', { className: 'cl-metric-unit' }, p.unit) : null),
      d != null || p.sub ? h('div', { className: 'cl-metric-sub' },
        d != null ? h('span', { className: good == null ? '' : good ? 'cl-good' : 'cl-bad' }, (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '') + (p.deltaFormat ? p.deltaFormat(Math.abs(d)) : fmt(Math.abs(d))) + (p.deltaUnit || '')) : null,
        d != null && p.sub ? ' ' : null, p.sub) : null);
  }

  function Progress(p) {
    var pct = Math.max(0, Math.min(1, (p.value || 0) / (p.max || 1)));
    return h('div', { className: 'cl-progress' },
      p.label || p.valueLabel ? h('div', { className: 'cl-progress-head' }, h('span', null, p.label), h('b', null, p.valueLabel)) : null,
      h('div', { className: 'cl-progress-track', role: 'progressbar', 'aria-valuenow': Math.round(pct * 100), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': p.label },
        h('div', { className: 'cl-progress-fill', style: { width: pct * 100 + '%', background: toneColor(p.tone || 'brand') } })));
  }

  function Panel(p) {
    return h('section', { className: cx('cl-panel', p.flush && 'cl-panel-flush', p.className), style: p.style },
      p.title || p.actions ? h('header', { className: 'cl-panel-head' },
        h('div', { style: { minWidth: 0 } }, p.title ? h('div', { className: 'cl-panel-title' }, p.title) : null, p.subtitle ? h('div', { className: 'cl-panel-sub' }, p.subtitle) : null),
        p.actions ? h('div', { className: 'cl-panel-actions' }, p.actions) : null) : null,
      h('div', { className: 'cl-panel-body', style: p.bodyStyle }, p.children));
  }

  /* ---------- Shell ---------- */
  function Sidebar(p) {
    return h('aside', { className: cx('cl-sidebar', p.className) },
      p.header ? h('div', { className: 'cl-sidebar-head' }, p.header) : null,
      h('nav', { className: 'cl-nav', 'aria-label': p.label || 'Principal' },
        (p.items || []).map(function (it) {
          return h('button', { key: it.id, type: 'button', className: 'cl-nav-item', 'aria-current': it.id === p.active ? 'page' : undefined, onClick: function () { if (p.onSelect) p.onSelect(it.id); } },
            h(Icon, { name: it.icon }), h('span', null, it.label), it.shortcut ? h('span', { className: 'cl-nav-kbd' }, it.shortcut) : null);
        })),
      p.children,
      p.footer ? h('div', { className: 'cl-sidebar-foot' }, p.footer) : null);
  }

  var SYNC = {
    synced: { c: 'var(--success)', t: 'Sincronizado con Garmin' },
    syncing: { c: 'var(--info)', t: 'Sincronizando…' },
    error: { c: 'var(--danger)', t: 'Error de sincronización' },
    offline: { c: 'var(--ink-faint)', t: 'Sin conexión' }
  };
  function SyncStatus(p) {
    var s = SYNC[p.state] || SYNC.synced, busy = p.state === 'syncing';
    return h('button', { type: 'button', className: 'cl-sync', onClick: p.onClick, disabled: busy, 'aria-live': 'polite', title: busy ? undefined : 'Sincronizar ahora' },
      busy ? h(Icon, { name: 'sync', className: 'cl-spin', style: { color: s.c } }) : h('i', { className: 'cl-sync-dot', style: { background: s.c } }),
      h('span', { style: { minWidth: 0, flex: 1 } }, h('div', { className: 'cl-sync-title' }, p.title || s.t), p.detail ? h('div', { className: 'cl-sync-detail' }, p.detail) : null),
      busy ? null : h(Icon, { name: 'sync', size: 14, style: { color: 'var(--ink-faint)' } }));
  }

  /* ---------- Chart helpers ---------- */
  function useWidth() {
    var ref = useRef(null), st = useState(0);
    useLayoutEffect(function () {
      var el = ref.current; if (!el) return;
      st[1](el.clientWidth);
      if (!window.ResizeObserver) return;
      var ro = new ResizeObserver(function () { st[1](el.clientWidth); });
      ro.observe(el);
      return function () { ro.disconnect(); };
    }, []);
    return [ref, st[0]];
  }
  function niceTicks(min, max, n) {
    var span = max - min; if (!(span > 0)) return [min];
    var step = Math.pow(10, Math.floor(Math.log10(span / n))), err = span / n / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var t = []; for (var v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) t.push(+v.toFixed(10));
    return t;
  }
  function niceDomain(min, max) {
    if (min === max) { min -= 1; max += 1; }
    var t = niceTicks(min, max, 4), step = t.length > 1 ? t[1] - t[0] : 1;
    return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
  }
  function linear(d0, d1, r0, r1) { var k = (r1 - r0) / ((d1 - d0) || 1); var f = function (v) { return r0 + (v - d0) * k; }; f.invert = function (px) { return d0 + (px - r0) / k; }; return f; }
  function logScale(d0, d1, r0, r1) { var l0 = Math.log(d0), k = (r1 - r0) / (Math.log(d1) - l0); var f = function (v) { return r0 + (Math.log(v) - l0) * k; }; f.invert = function (px) { return Math.exp(l0 + (px - r0) / k); }; return f; }
  function nearest(data, key, v) {
    var lo = 0, hi = data.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (data[m][key] < v) lo = m; else hi = m; }
    return Math.abs(data[lo][key] - v) <= Math.abs(data[hi][key] - v) ? lo : hi;
  }
  function Legend(p) {
    return h('div', { className: 'cl-legend' }, p.series.map(function (s) {
      return h('span', { key: s.key }, h('i', { style: { borderTopColor: toneColor(s.color), borderTopStyle: s.dash ? 'dashed' : 'solid' } }), s.label || s.key);
    }));
  }
  function tipRow(s, v) {
    return h('div', { key: s.key, className: 'cl-tip-row' }, h('i', { className: 'cl-swatch', style: { background: toneColor(s.color) } }), h('span', null, s.label || s.key), h('b', null, (s.format || fmt)(v), s.unit ? ' ' + s.unit : ''));
  }

  /* ---------- LineChart ---------- */
  function LineChart(p) {
    var wr = useWidth(), ref = wr[0], W = wr[1], H = p.height || 220;
    var data = p.data || [], xk = p.x || 'x', series = p.series || [];
    var hs = useState(null), hiLocal = hs[0], setHi = hs[1];
    var ins = useState(false), inside = ins[0], setInside = ins[1];
    var ds = useState(null), dr = ds[0], setDr = ds[1];
    var hi = p.hoverIndex !== undefined ? p.hoverIndex : hiLocal;
    var hasRight = series.some(function (s) { return s.axis === 'right'; });
    var m = { l: p.hideYAxis ? 8 : 40, r: hasRight ? 40 : 10, t: 8, b: p.hideXAxis ? 6 : 22 };
    var seriesKey = series.map(function (s) { return [s.key, s.axis, s.area, s.color, s.dash].join(':'); }).join('|');

    var calc = useMemo(function () {
      if (!data.length || !W) return null;
      var x0 = Infinity, x1 = -Infinity;
      for (var i = 0; i < data.length; i++) { var xv = data[i][xk]; if (xv < x0) x0 = xv; if (xv > x1) x1 = xv; }
      if (p.xDomain) { x0 = p.xDomain[0]; x1 = p.xDomain[1]; }
      var X = (p.xType === 'log' ? logScale : linear)(x0, x1, m.l, W - m.r);
      function dom(axis) {
        var lo = Infinity, hiV = -Infinity;
        series.forEach(function (s) {
          if ((s.axis || 'left') !== axis) return;
          for (var j = 0; j < data.length; j++) { var v = data[j][s.key]; if (v != null && !isNaN(v)) { if (v < lo) lo = v; if (v > hiV) hiV = v; } }
        });
        if (lo === Infinity) return null;
        if (p.zeroBased !== false && lo > 0) lo = 0;
        return niceDomain(lo, hiV);
      }
      var dl = p.yDomain || dom('left'), drr = p.yDomainRight || dom('right');
      var YL = dl ? linear(dl[0], dl[1], H - m.b, m.t) : null, YR = drr ? linear(drr[0], drr[1], H - m.b, m.t) : null;
      var base = H - m.b;
      var paths = series.map(function (s) {
        var Y = s.axis === 'right' ? YR : YL, d = '', on = false, first = null, last = null;
        for (var j = 0; j < data.length; j++) {
          var v = data[j][s.key];
          if (v == null || isNaN(v)) { on = false; continue; }
          var px = X(data[j][xk]).toFixed(1);
          if (first == null) first = px; last = px;
          d += (on ? 'L' : 'M') + px + ',' + Y(v).toFixed(1); on = true;
        }
        return { s: s, d: d, area: s.area && first != null ? d + 'L' + last + ',' + base + 'L' + first + ',' + base + 'Z' : null };
      });
      return { X: X, YL: YL, YR: YR, dl: dl, dr: drr, paths: paths, x0: x0, x1: x1 };
    }, [data, W, H, seriesKey, p.xType, String(p.yDomain), String(p.xDomain), String(p.yDomainRight), xk]);

    var kids = [];
    if (calc && calc.YL) {
      var X = calc.X;
      (p.bands || []).forEach(function (b, i) {
        var y0 = calc.YL(Math.min(b.to, calc.dl[1])), y1 = calc.YL(Math.max(b.from, calc.dl[0]));
        if (y1 > y0) kids.push(h('rect', { key: 'b' + i, x: m.l, width: W - m.l - m.r, y: y0, height: y1 - y0, fill: toneColor(b.color), opacity: b.opacity || 0.06 }));
      });
      var yt = niceTicks(calc.dl[0], calc.dl[1], p.yTicks || 4);
      kids.push(h('g', { key: 'g', className: 'cl-grid' }, yt.map(function (t) { return h('line', { key: t, x1: m.l, x2: W - m.r, y1: calc.YL(t), y2: calc.YL(t) }); })));
      if (!p.hideYAxis) kids.push(h('g', { key: 'yl', className: 'cl-axis' }, yt.map(function (t) { return h('text', { key: t, x: m.l - 8, y: calc.YL(t) + 3, textAnchor: 'end' }, (p.yFormat || fmt)(t)); })));
      if (calc.YR) kids.push(h('g', { key: 'yr', className: 'cl-axis' }, niceTicks(calc.dr[0], calc.dr[1], p.yTicks || 4).map(function (t) { return h('text', { key: t, x: W - m.r + 8, y: calc.YR(t) + 3 }, (p.yFormatRight || fmt)(t)); })));
      if (!p.hideXAxis) {
        var xt = p.xTicks || niceTicks(calc.x0, calc.x1, Math.max(2, Math.floor(W / 90)));
        kids.push(h('g', { key: 'x', className: 'cl-axis' }, xt.filter(function (t) { return t >= calc.x0 && t <= calc.x1; }).map(function (t) { return h('text', { key: t, x: X(t), y: H - 6, textAnchor: 'middle' }, (p.xFormat || fmt)(t)); })));
      }
      (p.refLines || []).forEach(function (r, i) {
        var y = calc.YL(r.value);
        kids.push(h('line', { key: 'rl' + i, x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: toneColor(r.color || 'faint'), strokeDasharray: '3 3' }));
        if (r.label) kids.push(h('text', { key: 'rt' + i, x: W - m.r - 4, y: y - 4, textAnchor: 'end', className: 'cl-axis', style: { font: '500 10px var(--font-mono)', fill: 'var(--ink-faint)' } }, r.label));
      });
      var sel = dr ? [Math.min(dr[0], dr[1]), Math.max(dr[0], dr[1])] : p.selection;
      if (sel) {
        var sx0 = X(sel[0]), sx1 = X(sel[1]);
        kids.push(h('rect', { key: 'sel', x: sx0, width: Math.max(1, sx1 - sx0), y: m.t, height: H - m.t - m.b, className: 'cl-sel' }));
        kids.push(h('line', { key: 'se0', x1: sx0, x2: sx0, y1: m.t, y2: H - m.b, className: 'cl-sel-edge' }));
        kids.push(h('line', { key: 'se1', x1: sx1, x2: sx1, y1: m.t, y2: H - m.b, className: 'cl-sel-edge' }));
      }
      calc.paths.forEach(function (ps, i) { if (ps.area) kids.push(h('path', { key: 'a' + i, d: ps.area, fill: toneColor(ps.s.color), opacity: ps.s.areaOpacity || 0.14 })); });
      calc.paths.forEach(function (ps, i) { if (ps.s.line !== false) kids.push(h('path', { key: 'l' + i, d: ps.d, fill: 'none', stroke: toneColor(ps.s.color), strokeWidth: ps.s.width || 1.5, strokeDasharray: ps.s.dash ? '4 3' : undefined, strokeLinejoin: 'round', opacity: ps.s.opacity })); });
      if (hi != null && data[hi]) {
        var hx = X(data[hi][xk]);
        kids.push(h('line', { key: 'cross', x1: hx, x2: hx, y1: m.t, y2: H - m.b, stroke: 'var(--ink-faint)', strokeWidth: 1 }));
        series.forEach(function (s, i) {
          var v = data[hi][s.key]; if (v == null || isNaN(v)) return;
          var Y = s.axis === 'right' ? calc.YR : calc.YL;
          kids.push(h('circle', { key: 'd' + i, cx: hx, cy: Y(v), r: 3.5, fill: toneColor(s.color), stroke: 'var(--bg-200)', strokeWidth: 1.5 }));
        });
      }
    }

    function xAt(e) { var r = ref.current.getBoundingClientRect(); return calc.X.invert(Math.max(m.l, Math.min(W - m.r, e.clientX - r.left))); }
    function finish() {
      if (!dr) return;
      var a = Math.min(dr[0], dr[1]), b = Math.max(dr[0], dr[1]);
      setDr(null);
      if (calc.X(b) - calc.X(a) > 4) p.onSelect([a, b]); else p.onSelect(null);
    }
    function onMove(e) {
      if (!calc) return;
      var v = xAt(e), idx = nearest(data, xk, v);
      setHi(idx); setInside(true);
      if (p.onHover) p.onHover(idx, data[idx]);
      if (dr) setDr([dr[0], v]);
    }
    function onLeave() { setHi(null); setInside(false); if (p.onHover) p.onHover(null, null); finish(); }
    function onDown(e) { if (!calc || !p.onSelect) return; var v = xAt(e); setDr([v, v]); }

    var tip = null;
    if (inside && hi != null && calc && data[hi]) {
      var row = data[hi], tx = calc.X(row[xk]);
      tip = h('div', { className: 'cl-tip', style: { left: tx > W - 180 ? tx - 168 : tx + 12, top: m.t } },
        h('div', { className: 'cl-tip-head' }, (p.tooltipTitle || p.xFormat || fmt)(row[xk], row)),
        series.filter(function (s) { return !s.hideInTooltip; }).map(function (s) { return tipRow(s, row[s.key]); }),
        p.tooltipExtra ? p.tooltipExtra(row) : null);
    }
    return h('div', { className: cx('cl-chart', p.className) },
      p.legend ? h(Legend, { series: series }) : null,
      h('div', { ref: ref, style: { position: 'relative', height: H, cursor: p.onSelect ? 'crosshair' : 'default' }, onMouseMove: onMove, onMouseLeave: onLeave, onMouseDown: onDown, onMouseUp: function () { if (calc && p.onSelect) finish(); } },
        W ? h('svg', { width: W, height: H, role: 'img', 'aria-label': p.ariaLabel || 'Gráfico' }, kids) : null, tip));
  }

  /* ---------- BarChart ---------- */
  function BarChart(p) {
    var wr = useWidth(), ref = wr[0], W = wr[1], H = p.height || 180;
    var data = p.data || [], xk = p.x || 'x', series = p.series || [];
    var hs = useState(null), hi = hs[0], setHi = hs[1];
    var m = { l: p.hideYAxis ? 8 : 40, r: p.line ? 40 : 8, t: 8, b: 22 };
    var n = data.length, bw = n ? (W - m.l - m.r) / n : 0, gap = Math.min(8, bw * 0.3);
    var max = 0;
    data.forEach(function (d) { var s = 0; series.forEach(function (se) { s += d[se.key] || 0; }); if (s > max) max = s; });
    var dom = p.yDomain || niceDomain(0, max || 1), Y = linear(dom[0], dom[1], H - m.b, m.t);
    var kids = [];
    if (W && n) {
      var yt = niceTicks(dom[0], dom[1], 3);
      kids.push(h('g', { key: 'g', className: 'cl-grid' }, yt.map(function (t) { return h('line', { key: t, x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t) }); })));
      if (!p.hideYAxis) kids.push(h('g', { key: 'y', className: 'cl-axis' }, yt.map(function (t) { return h('text', { key: t, x: m.l - 8, y: Y(t) + 3, textAnchor: 'end' }, (p.yFormat || fmt)(t)); })));
      data.forEach(function (d, i) {
        var acc = 0, x = m.l + i * bw + gap / 2, stacked = series.length > 1;
        series.forEach(function (se, j) {
          var v = d[se.key] || 0; if (!v) return;
          var y = Y(acc + v), y0 = Y(acc); acc += v;
          kids.push(h('rect', { key: i + '-' + j, x: x, width: Math.max(1, bw - gap), y: y, height: Math.max(0, y0 - y - (stacked ? 1 : 0)), fill: toneColor(d._color || se.color), opacity: hi == null || hi === i ? 1 : 0.45, rx: stacked ? 0 : 2 }));
        });
      });
      var every = Math.ceil(n / Math.max(1, Math.floor((W - m.l - m.r) / 52)));
      kids.push(h('g', { key: 'x', className: 'cl-axis' }, data.map(function (d, i) { return i % every ? null : h('text', { key: i, x: m.l + i * bw + bw / 2, y: H - 6, textAnchor: 'middle' }, (p.xFormat || String)(d[xk], d)); })));
      if (p.line) {
        var lmax = -Infinity, lmin = Infinity; data.forEach(function (d) { var v = d[p.line.key]; if (v > lmax) lmax = v; if (v < lmin) lmin = v; });
        var ld = p.line.zeroBased ? niceDomain(0, lmax || 1) : niceDomain(lmin - (lmax - lmin || lmax * .1) * .5, lmax), YL = linear(ld[0], ld[1], H - m.b, m.t);
        kids.push(h('path', { key: 'ln', d: data.map(function (d, i) { return (i ? 'L' : 'M') + (m.l + i * bw + bw / 2).toFixed(1) + ',' + YL(d[p.line.key]).toFixed(1); }).join(''), fill: 'none', stroke: toneColor(p.line.color), strokeWidth: 2, strokeLinejoin: 'round' }));
        kids.push(h('g', { key: 'yr', className: 'cl-axis' }, niceTicks(ld[0], ld[1], 3).map(function (t) { return h('text', { key: t, x: W - m.r + 8, y: YL(t) + 3 }, fmt(t)); })));
      }
    }
    function onMove(e) { if (!n) return; var r = ref.current.getBoundingClientRect(), i = Math.floor((e.clientX - r.left - m.l) / bw); setHi(i >= 0 && i < n ? i : null); }
    var tip = null;
    if (hi != null && data[hi]) {
      var d = data[hi], cxp = m.l + hi * bw + bw / 2;
      tip = h('div', { className: 'cl-tip', style: { left: cxp > W - 180 ? cxp - 168 : cxp + 12, top: m.t } },
        h('div', { className: 'cl-tip-head' }, (p.tooltipTitle || p.xFormat || String)(d[xk], d)),
        series.concat(p.line ? [p.line] : []).map(function (se) { return d[se.key] == null ? null : tipRow(se, d[se.key]); }));
    }
    return h('div', { className: cx('cl-chart', p.className) },
      p.legend ? h(Legend, { series: series.concat(p.line ? [p.line] : []) }) : null,
      h('div', { ref: ref, style: { position: 'relative', height: H }, onMouseMove: onMove, onMouseLeave: function () { setHi(null); }, onClick: function () { if (p.onBarClick && hi != null) p.onBarClick(data[hi], hi); } },
        W ? h('svg', { width: W, height: H, role: 'img', 'aria-label': p.ariaLabel || 'Gráfico de barras' }, kids) : null, tip));
  }

  /* ---------- ZoneBar ---------- */
  function ZoneBar(p) {
    var zones = p.zones || [], total = zones.reduce(function (a, z) { return a + z.value; }, 0) || 1;
    var maxV = zones.reduce(function (a, z) { return Math.max(a, z.value); }, 0) || 1;
    return h('div', { className: 'cl-zonebar' },
      h('div', { className: 'cl-zonebar-track', role: 'img', 'aria-label': p.ariaLabel || 'Distribución por zonas' },
        zones.map(function (z, i) { return z.value ? h('i', { key: i, style: { flex: z.value, background: toneColor(z.color) }, title: z.label + ' · ' + Math.round(z.value / total * 100) + '%' }) : null; })),
      p.compact ? null : h('div', { className: 'cl-zonebar-list' }, zones.map(function (z, i) {
        return [
          h('span', { key: 'a' + i, className: 'cl-zone-tag' }, h('i', { className: 'cl-swatch', style: { background: toneColor(z.color) } }), z.label),
          h('span', { key: 'b' + i, style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 } }, h('span', { className: 'cl-muted', style: { width: 96, flex: 'none' } }, z.name || ''), h('i', { className: 'cl-zone-bar', style: { width: (z.value / maxV * 100) + '%', background: toneColor(z.color) } })),
          h('span', { key: 'c' + i, className: 'cl-num cl-muted', style: { textAlign: 'right' } }, (p.format || fmt)(z.value)),
          h('span', { key: 'd' + i, className: 'cl-num', style: { textAlign: 'right' } }, Math.round(z.value / total * 100) + '%')
        ];
      })));
  }

  /* ---------- RouteMap ---------- */
  var SCALE_STEPS = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  function RouteMap(p) {
    var wr = useWidth(), ref = wr[0], W = wr[1], H = p.height || 220, pts = p.points || [];
    var hl = p.highlight, zoom = !!(p.zoomToHighlight && hl && hl[1] > hl[0]);
    var geo = useMemo(function () {
      if (!W || !pts.length) return null;
      var a0 = zoom ? hl[0] : 0, a1 = zoom ? hl[1] : pts.length - 1;
      var minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      for (var i = a0; i <= a1; i++) { var q = pts[i]; if (q[0] < minx) minx = q[0]; if (q[0] > maxx) maxx = q[0]; if (q[1] < miny) miny = q[1]; if (q[1] > maxy) maxy = q[1]; }
      var pad = 32, s = Math.min((W - 2 * pad) / ((maxx - minx) || 1), (H - 2 * pad) / ((maxy - miny) || 1));
      var ox = (W - (maxx - minx) * s) / 2, oy = (H - (maxy - miny) * s) / 2;
      var P = function (q) { return [ox + (q[0] - minx) * s, H - (oy + (q[1] - miny) * s)]; };
      var line = function (list, closed) { var d = ''; for (var j = 0; j < list.length; j++) { var c = P(list[j]); d += (j ? 'L' : 'M') + c[0].toFixed(1) + ',' + c[1].toFixed(1); } return closed ? d + 'Z' : d; };
      var path = function (a, b) { return line(pts.slice(a, b + 1)); };
      return { P: P, line: line, path: path, s: s, full: path(0, pts.length - 1) };
    }, [W, H, pts, zoom ? hl[0] + ':' + hl[1] : 'all']);
    var kids = [], feats = p.features || [];
    if (geo) {
      if (!feats.length) {
        var g = [];
        for (var x = 16; x < W; x += 32) g.push(h('line', { key: 'gx' + x, x1: x, x2: x, y1: 0, y2: H }));
        for (var y = 16; y < H; y += 32) g.push(h('line', { key: 'gy' + y, x1: 0, x2: W, y1: y, y2: y }));
        kids.push(h('g', { key: 'grid', className: 'cl-map-grid' }, g));
      }
      var labels = [];
      feats.forEach(function (f, i) {
        if (f.type === 'label' || f.type === 'peak') {
          var c = geo.P(f.at);
          if (f.type === 'peak') labels.push(h('path', { key: 'pk' + i, d: 'M' + c[0] + ',' + (c[1] - 5) + 'l4.5,8h-9z', className: 'cl-map-peak' }));
          else labels.push(h('circle', { key: 'tw' + i, cx: c[0], cy: c[1], r: f.major ? 3 : 2, className: 'cl-map-town' }));
          // Flip the label to the other side if it would run off the map (≈6px per character).
          var tw = String(f.label).length * 6, end = f.anchor === 'end' ? c[0] - 8 - tw > 4 : c[0] + 8 + tw > W - 4;
          // Major labels (the start town) sit above their dot so they never cover the route leaving it.
          var mid = f.major, lx = mid ? Math.max(4 + tw / 2, Math.min(W - 4 - tw / 2, c[0])) : end ? c[0] - 8 : c[0] + 8;
          labels.push(h('text', { key: 'lb' + i, x: lx, y: mid ? c[1] - 10 : c[1] + 3.5, textAnchor: mid ? 'middle' : end ? 'end' : 'start', className: cx('cl-map-label', f.major && 'cl-map-label-major') }, f.label));
          return;
        }
        kids.push(h('path', { key: 'f' + i, d: geo.line(f.points, f.closed), className: 'cl-map-' + f.type }));
      });
      kids.push(h('path', { key: 'r0', d: geo.full, className: 'cl-map-casing' }));
      kids.push(h('path', { key: 'r', d: geo.full, className: 'cl-map-route' }));
      if (hl) { var a = Math.max(0, hl[0]), b = Math.min(pts.length - 1, hl[1]); if (b > a) kids.push(h('path', { key: 'hl', d: geo.path(a, b), className: 'cl-map-hl' })); }
      (p.markers || []).forEach(function (m, i) {
        if (!pts[m.index]) return; var c = geo.P(pts[m.index]);
        kids.push(h('g', { key: 'mk' + i }, h('circle', { cx: c[0], cy: c[1], r: 8, className: 'cl-map-marker' }), h('text', { x: c[0], y: c[1] + 3, textAnchor: 'middle', className: 'cl-map-marker-text' }, m.label)));
      });
      kids = kids.concat(labels);
      var st = geo.P(pts[0]), en = geo.P(pts[pts.length - 1]);
      if (Math.hypot(en[0] - st[0], en[1] - st[1]) > 10) kids.push(h('circle', { key: 'e', cx: en[0], cy: en[1], r: 5, className: 'cl-map-end' }));
      kids.push(h('circle', { key: 's', cx: st[0], cy: st[1], r: 5, className: 'cl-map-start' }));
      if (p.cursor != null && pts[p.cursor]) { var cu = geo.P(pts[p.cursor]); kids.push(h('circle', { key: 'c', cx: cu[0], cy: cu[1], r: 6, className: 'cl-map-cursor' })); }
      if (p.scale) {
        // Points are in metres: pick the largest round distance that fits in ~90px.
        var meters = SCALE_STEPS.filter(function (v) { return v * geo.s <= 90; }).pop() || SCALE_STEPS[0], px = meters * geo.s, sx = W - 16 - px, sy = H - 14;
        kids.push(h('g', { key: 'scale', className: 'cl-map-scale' },
          h('path', { d: 'M' + sx + ',' + (sy - 4) + 'v4h' + px.toFixed(1) + 'v-4' }),
          h('text', { x: sx + px / 2, y: sy - 7, textAnchor: 'middle' }, meters >= 1000 ? meters / 1000 + ' km' : meters + ' m')));
        kids.push(h('g', { key: 'north', className: 'cl-map-scale', transform: 'translate(' + (W - 20) + ',18)' },
          h('path', { d: 'M0,-8L4,4L0,1L-4,4Z', className: 'cl-map-north' }), h('text', { y: 16, textAnchor: 'middle' }, 'N')));
      }
    }
    return h('div', { ref: ref, className: 'cl-map', style: { height: H } },
      W ? h('svg', { width: W, height: H, role: 'img', 'aria-label': p.ariaLabel || 'Recorrido' }, kids) : null,
      p.caption ? h('div', { className: 'cl-map-caption' }, p.caption) : null);
  }

  /* ---------- DataTable ---------- */
  function DataTable(p) {
    var cols = p.columns || [], rows = p.rows || [], key = p.rowKey || 'id', checks = p.checked;
    function check(k) { if (p.onCheck) p.onCheck(k); }
    // Roving tabindex: one tab stop per table; arrows move between rows.
    var focusKey = rows.some(function (r) { return r[key] === p.selected; }) ? p.selected : rows.length ? rows[0][key] : null;
    function rowKey(e, k, r) {
      if (e.target !== e.currentTarget) return;
      if ((e.key === 'Enter' || e.key === ' ') && p.onSelect) { e.preventDefault(); p.onSelect(k, r); return; }
      if (e.key === 'Escape' && p.onEscape) { e.preventDefault(); p.onEscape(); return; }
      var list = e.currentTarget.parentNode.children, i = Array.prototype.indexOf.call(list, e.currentTarget);
      var n = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : -1;
      if (n < 0 || n >= list.length || n === i) return;
      e.preventDefault(); list[n].focus();
      if (p.selectOnFocus && p.onSelect) p.onSelect(rows[n][key], rows[n]);
    }
    return h('div', { className: cx('cl-table-wrap', p.className), style: { maxHeight: p.maxHeight } },
      h('table', { className: cx('cl-table', p.compact && 'cl-table-compact') },
        h('thead', null, h('tr', null, checks ? h('th', { style: { width: 36 } }) : null, cols.map(function (c) { return h('th', { key: c.key, 'data-align': c.align, style: { width: c.width } }, c.label); }))),
        h('tbody', null, rows.map(function (r) {
          var k = r[key], chk = checks && checks.indexOf(k) >= 0;
          return h('tr', { key: k, 'aria-selected': p.selected === k, tabIndex: p.onSelect ? (k === focusKey ? 0 : -1) : undefined, onClick: function () { if (p.onSelect) p.onSelect(k, r); }, onKeyDown: function (e) { rowKey(e, k, r); } },
            checks ? h('td', { onClick: function (e) { e.stopPropagation(); check(k); } },
              h('span', { className: 'cl-check', role: 'checkbox', 'aria-checked': !!chk, 'aria-label': p.checkLabel || 'Seleccionar para comparar', tabIndex: 0, onKeyDown: function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); check(k); } } }, chk ? h(Icon, { name: 'check', size: 12 }) : null)) : null,
            cols.map(function (c) { return h('td', { key: c.key, 'data-align': c.align }, c.render ? c.render(r) : r[c.key]); }));
        }))),
      !rows.length && p.empty ? p.empty : null);
  }

  /* ---------- AI ---------- */
  function ChatMessage(p) {
    var user = p.role === 'user';
    return h('div', { className: cx('cl-msg', user ? 'cl-msg-user' : 'cl-msg-assistant') },
      user ? null : h('div', { className: 'cl-msg-avatar', 'aria-hidden': true }, 'CL'),
      h('div', { className: 'cl-msg-body' }, p.children));
  }
  function ToolResult(p) {
    var st = p.status || 'done';
    return h('div', { className: 'cl-tool' },
      h('div', { className: 'cl-tool-head' },
        st === 'running' ? h(Icon, { name: 'sync', size: 14, className: 'cl-spin', style: { color: 'var(--info)' } }) :
          st === 'error' ? h(Icon, { name: 'alert', size: 14, style: { color: 'var(--danger)' } }) : h(Icon, { name: 'check', size: 14, style: { color: 'var(--success)' } }),
        h('span', { className: 'cl-tool-name' }, p.tool), p.args ? h('span', { className: 'cl-tool-args' }, '(' + p.args + ')') : null,
        p.meta ? h('span', { style: { marginLeft: 'auto', whiteSpace: 'nowrap' } }, p.meta) : null),
      p.title || p.children ? h('div', { className: 'cl-tool-body' }, p.title ? h('div', { className: 'cl-tool-title' }, p.title) : null, p.children) : null);
  }

  /* ---------- States ---------- */
  function StateBlock(p) {
    var k = p.kind || 'empty';
    return h('div', { className: 'cl-state', role: k === 'error' ? 'alert' : 'status' },
      k === 'loading' ? h(Icon, { name: 'sync', size: 20, className: 'cl-spin', style: { color: 'var(--info)' } }) : h(Icon, { name: k === 'error' ? 'alert' : 'search', size: 20, style: { color: k === 'error' ? 'var(--danger)' : 'var(--ink-faint)' } }),
      p.title ? h('div', { className: 'cl-state-title' }, p.title) : null,
      p.detail ? h('div', { style: { maxWidth: 360 } }, p.detail) : null,
      p.action || null);
  }
  function Skeleton(p) { return h('div', { className: 'cl-skel', style: { height: p.height || 12, width: p.width || '100%', borderRadius: p.radius }, 'aria-hidden': true }); }

  window.CycleLab = Object.assign(window.CycleLab || {}, {
    Icon: Icon, Button: Button, Segmented: Segmented, Chip: Chip, Badge: Badge, Metric: Metric, Progress: Progress, Panel: Panel,
    Sidebar: Sidebar, SyncStatus: SyncStatus, LineChart: LineChart, BarChart: BarChart, Legend: Legend, ZoneBar: ZoneBar, RouteMap: RouteMap,
    DataTable: DataTable, ChatMessage: ChatMessage, ToolResult: ToolResult, StateBlock: StateBlock, Skeleton: Skeleton,
    utils: { fmt: fmt, toneColor: toneColor, niceTicks: niceTicks }
  });
})();
