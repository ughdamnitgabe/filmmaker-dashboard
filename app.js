/* =====================================================================
   Filmmaker Dashboard — static GitHub Pages app (Gabe & Amelia only).
   Plain HTML/CSS/JS, no framework, no server of ours.
   Data lives in localStorage on this device under 'filmmakerDashboard.v1'.
   Optional cloud sync (Supabase, same project as Script Builder) keeps
   ONE shared library: Gabe and Amelia see and edit the SAME projects,
   last-write-wins. That is deliberately DIFFERENT from Script Builder /
   Story Studio, which keep one library per account. See README + the
   cloud-sync section below, and supabase/filmmaker_libraries.sql.
   Sign-out clears the shared library from this device (it stays in the
   cloud), so the next person signing in on a shared device never
   inherits the previous person's on-screen copy — they pull it from
   the cloud after signing in.
   ===================================================================== */
'use strict';

/* ---------------- utils ---------------- */
function uid() { return 'x' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function money(n) { n = Number(n) || 0; return '$' + Math.round(n).toLocaleString('en-US'); }
function money2(n) { n = Number(n) || 0; return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function num(v, d) { var n = parseFloat(v); return isNaN(n) ? (d || 0) : n; }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(s) { if (!s) return '—'; var d = new Date(s + 'T12:00:00'); if (isNaN(d)) return s; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function nowISO() { return new Date().toISOString(); }

/* ---------------- reference data (2026-27 union snapshot — editable) ---------------- */
/* Rates are union MINIMUMS as published for 2026-27. They are a dated
   snapshot, not a live feed: guilds publish PDFs, not an API. Check the
   current rate sheet before signing anything. Every rate in the app is
   editable, and the Union Rates tab shows the effective dates. */
var UNION_RATES = {
  note: 'Dated snapshot — SAG-AFTRA Jul 1, 2026–Jun 30, 2027; WGA May 2, 2026–May 1, 2027; DGA 2026-27; IATSE 2024-27 Basic Agreement. Minimums only — quotes are negotiated above scale. Verify before signing.',
  sag: [
    { tier: 'Ultra Low Budget (UPA)', budget: 'Under $300,000', day: 257, week: null, ph: 0.22 },
    { tier: 'Moderate Low Budget (MPA)', budget: '$300,000 – $700,000', day: 449, week: 1560, ph: 0.22 },
    { tier: 'Low Budget (LBA)', budget: '$700,000 – $2,000,000', day: 834, week: 2896, ph: 0.22 },
    { tier: 'Basic Theatrical', budget: 'Over $2,000,000', day: 1283, week: 4456, ph: 0.22 }
  ],
  sagBackground: { day: 231, specialAbility: 241, standIn: 270, ph: 0.215 },
  sagShort: { note: 'Short Project Agreement: budgets under $50,000, max 40 min. Micro-Budget: under $20,000, rates negotiable.' },
  dga: {
    note: 'DGA Low Budget Theatrical Sideletter covers films up to $11M. Director pay is a % of full scale by budget level.',
    fullScaleDirectorWeek: 25460, fullScaleNote: 'Full-scale theatrical director ≈ $25,460/week (2026-27, $24,599 in 2025-26 + 3.5% Jul 1, 2026).',
    levels: [
      { level: 'Level 1a', budget: '$0 – $500,000', pct: 0.33 },
      { level: 'Level 1b', budget: '$500,000 – $1,100,000', pct: 0.33 },
      { level: 'Level 2', budget: '$1,100,000 – $2,600,000', pct: 0.50 },
      { level: 'Level 3', budget: '$2,600,000 – $8,500,000', pct: 0.75 },
      { level: 'Level 4', budget: '$8,500,000 – $11,000,000', pct: 0.90 }
    ],
    ph: 0.205
  },
  wga: {
    note: 'WGA 2026 MBA, May 2, 2026 – May 1, 2027. Low budget = under $5M; high budget = $5M+.',
    low: { originalInclTreatment: 92268, originalExclTreatment: 61990, rewrite: 30273, polish: 15148 },
    high: { originalInclTreatment: 173215, originalExclTreatment: 126899, rewrite: 46152, polish: 23077 },
    weekToWeek: 7511, pension: 0.1125, health: 0.1625
  },
  iatse: {
    note: 'IATSE planning scale, 2024-27 Basic Agreement (wages +3.5% in year 3, Oct 4, 2026). Rates vary by local and by low-budget tier — use as planning numbers, confirm with the local.',
    roles: [
      { role: 'Director of Photography', day: 429, note: 'low-budget tier; up to ~$1,129/day studio scale' },
      { role: 'Camera Operator', day: 698, note: 'Local 600' },
      { role: '1st Assistant Camera', day: 510, note: 'Local 600' },
      { role: 'Gaffer', hour: 63.01, note: 'Local 728' },
      { role: 'Key Grip', hour: 63.01, note: 'Local 80' },
      { role: 'Best Boy Electric', hour: 57.20, note: 'Local 728 (ACLT)' },
      { role: 'Production Sound Mixer', hour: 105.38, note: '' }
    ]
  }
};

var FRINGES = [
  { id: 'sag-principal', name: 'SAG Principal — P&H 22%', rate: 0.22, note: 'SAG-AFTRA pension & health, principals, eff. Sep 6, 2026.' },
  { id: 'sag-background', name: 'SAG Background — P&H 21.5%', rate: 0.215, note: 'SAG-AFTRA pension & health, background, eff. Sep 6, 2026.' },
  { id: 'dga', name: 'DGA — P&H 20.5%', rate: 0.205, note: 'DGA pension & health (planning).' },
  { id: 'wga', name: 'WGA — Pension 11.25% + Health 16.25% (27.5%)', rate: 0.275, note: 'WGA benefit plans, 2026 schedule.' },
  { id: 'iatse', name: 'IATSE — Pension & Health 28% (planning)', rate: 0.28, note: 'MPI pension/health + payroll, planning figure — confirm with the local.' },
  { id: 'nonunion', name: 'Non-union payroll taxes 18%', rate: 0.18, note: 'FICA 7.65% + FUTA/SUTA + workers comp, planning figure.' },
  { id: 'none', name: 'No fringe', rate: 0, note: '' }
];
function fringeRate(id) { var f = FRINGES.find(function (x) { return x.id === id; }); return f ? f.rate : 0; }

/* 27 standard accounts. Sections: ATL / BTL / POST / OTHER. */
var ACCOUNTS = [
  { code: '1100', name: 'Story & Rights', section: 'ATL' },
  { code: '1200', name: 'Producer', section: 'ATL' },
  { code: '1300', name: 'Director', section: 'ATL' },
  { code: '1400', name: 'Principal Cast', section: 'ATL' },
  { code: '1500', name: 'Supporting Cast & Background', section: 'ATL' },
  { code: '2000', name: 'Production Staff', section: 'BTL' },
  { code: '2100', name: 'Art Department', section: 'BTL' },
  { code: '2200', name: 'Set Dressing', section: 'BTL' },
  { code: '2300', name: 'Props', section: 'BTL' },
  { code: '2400', name: 'Wardrobe', section: 'BTL' },
  { code: '2500', name: 'Makeup & Hair', section: 'BTL' },
  { code: '2600', name: 'Camera', section: 'BTL' },
  { code: '2700', name: 'Electric', section: 'BTL' },
  { code: '2800', name: 'Grip', section: 'BTL' },
  { code: '2900', name: 'Sound', section: 'BTL' },
  { code: '3000', name: 'Transportation', section: 'BTL' },
  { code: '3100', name: 'Locations', section: 'BTL' },
  { code: '3200', name: 'Catering & Craft Services', section: 'BTL' },
  { code: '3300', name: 'Production Office & Misc', section: 'BTL' },
  { code: '4000', name: 'Editorial', section: 'POST' },
  { code: '4100', name: 'Visual Effects', section: 'POST' },
  { code: '4200', name: 'Music', section: 'POST' },
  { code: '4300', name: 'Sound Post & Mix', section: 'POST' },
  { code: '4400', name: 'Color & Finishing', section: 'POST' },
  { code: '4500', name: 'Titles & Deliverables', section: 'POST' },
  { code: '5000', name: 'Legal, Insurance & Clearance', section: 'OTHER' },
  { code: '5100', name: 'Completion Bond & Financing', section: 'OTHER' }
];
var DEPTS = ['Camera', 'Art', 'Wardrobe', 'Makeup & Hair', 'Sound', 'Grip', 'Electric', 'Props', 'Production'];
/* Which accounts belong to which department (for dept-head filtered views). */
var DEPT_ACCOUNTS = {
  'Camera': ['2600'], 'Art': ['2100', '2200'], 'Wardrobe': ['2400'],
  'Makeup & Hair': ['2500'], 'Sound': ['2900', '4300'], 'Grip': ['2800'],
  'Electric': ['2700'], 'Props': ['2300'], 'Production': ['2000', '3000', '3100', '3200', '3300', '5000', '5100']
};

/* ---------------- data model ---------------- */
function newLine(desc, qty, x, rate, fringeId, qtyGlobal) {
  return { id: uid(), desc: desc || '', qty: num(qty, 1), x: num(x, 1), rate: num(rate, 0), fringeId: fringeId || 'none', qtyGlobal: qtyGlobal || '' };
}
function newAccount(code, name, section, lines) {
  return { id: uid(), code: code, name: name, section: section, lines: lines || [] };
}
function blankProject(template) {
  var p = {
    id: uid(), title: 'Untitled Film', template: template || 'feature',
    company: '', producer: 'Gabe Arredondo', director: '', writer: '', preparedBy: 'Gabe Arredondo',
    budgetDate: todayISO(), version: 'v1 — Draft', currency: 'USD',
    status: 'In progress', createdAt: nowISO(), updatedAt: nowISO(),
    globals: { shootDays: 20, prepWeeks: 2, wrapDays: 2, contingencyPct: 10, bondPct: 2.5, locations: 1 },
    accounts: ACCOUNTS.map(function (a) { return newAccount(a.code, a.name, a.section, []); }),
    locations: [], actuals: [], scenes: [], props: [], crew: [],
    schedule: { startDate: '', days: [] }, /* days: [{id, date, sceneIds:[], callTime, location, notes}] */
    financing: { sources: [], notes: '' },
    bonds: { depositOn: true, depositPct: 40, depositFlat: null, depositReturned: false, depositNote: '40% planning default. Your SAG-AFTRA security deposit letter is the authoritative number.' },
    moodboards: [], /* {id, title, scope, images:[{src, caption}], notes} */
    notes: ''
  };
  return p;
}
function seedDB() { return { version: 1, updatedAt: nowISO(), projects: [] }; }

/* Feature template: indie scale, SAG Moderate Low tier ($449/day), fringes pre-wired.
   All rates are planning defaults — edit any of them. */
function applyFeatureTemplate(p) {
  function linesFor(code, rows) {
    var a = p.accounts.find(function (x) { return x.code === code; });
    if (a) a.lines = rows.map(function (r) { return newLine(r[0], r[1], r[2], r[3], r[4], r[5] || ''); });
  }
  linesFor('1100', [['Original screenplay (WGA low-budget planning)', 1, 1, 30000, 'none'], ['Rights / option', 1, 1, 2500, 'none']]);
  linesFor('1200', [['Producer fee', 1, 1, 15000, 'none'], ['Associate producer', 1, 1, 5000, 'none']]);
  linesFor('1300', [['Director (DGA low-budget planning, 33% of scale)', 1, 1, 20000, 'dga']]);
  linesFor('1400', [
    ['Lead — Actor 1', 1, 0, 449, 'sag-principal'],
    ['Lead — Actor 2', 1, 0, 449, 'sag-principal'],
    ['Supporting — Actor 3', 1, 0, 449, 'sag-principal']
  ]);
  /* Cast lines link their X (days) to cast-days globals once the schedule exists;
     until then the template uses shoot days as the day count. */
  p.accounts.find(function (a) { return a.code === '1400'; }).lines.forEach(function (l) { l.x = 20; l.qtyGlobal = 'shootDays'; });
  linesFor('1500', [['Background actors', 10, 0, 231, 'sag-background']]);
  p.accounts.find(function (a) { return a.code === '1500'; }).lines[0].x = 5;
  linesFor('2000', [['Unit production manager', 1, 0, 350, 'nonunion'], ['1st assistant director', 1, 0, 300, 'nonunion'], ['Production assistant', 2, 0, 200, 'nonunion']]);
  p.accounts.find(function (a) { return a.code === '2000'; }).lines.forEach(function (l) { l.x = 22; l.qtyGlobal = 'shootDays'; });
  linesFor('2600', [['Director of photography', 1, 0, 600, 'iatse'], ['Camera operator', 1, 0, 500, 'iatse'], ['1st AC', 1, 0, 350, 'iatse'], ['Camera package rental', 1, 0, 750, 'none']]);
  p.accounts.find(function (a) { return a.code === '2600'; }).lines.forEach(function (l) { l.x = 20; l.qtyGlobal = 'shootDays'; });
  linesFor('2700', [['Gaffer', 1, 0, 504, 'iatse'], ['Best boy electric', 1, 0, 458, 'iatse'], ['Lighting package', 1, 0, 400, 'none']]);
  p.accounts.find(function (a) { return a.code === '2700'; }).lines.forEach(function (l) { l.x = 20; l.qtyGlobal = 'shootDays'; });
  linesFor('2800', [['Key grip', 1, 0, 504, 'iatse'], ['Grip package', 1, 0, 350, 'none']]);
  p.accounts.find(function (a) { return a.code === '2800'; }).lines.forEach(function (l) { l.x = 20; l.qtyGlobal = 'shootDays'; });
  linesFor('2900', [['Production sound mixer', 1, 0, 600, 'iatse'], ['Sound package', 1, 0, 250, 'none']]);
  p.accounts.find(function (a) { return a.code === '2900'; }).lines.forEach(function (l) { l.x = 20; l.qtyGlobal = 'shootDays'; });
  linesFor('3100', [['Location fees', 1, 0, 500, 'none'], ['Permits', 1, 1, 1500, 'none']]);
  p.accounts.find(function (a) { return a.code === '3100'; }).lines[0].x = 20;
  linesFor('3200', [['Catering', 25, 0, 25, 'none'], ['Craft services', 1, 0, 150, 'none']]);
  p.accounts.find(function (a) { return a.code === '3200'; }).lines.forEach(function (l) { l.x = 20; l.qtyGlobal = 'shootDays'; });
  linesFor('4000', [['Editor', 1, 1, 12000, 'nonunion'], ['Edit suite', 1, 1, 3000, 'none']]);
  linesFor('4200', [['Composer / score', 1, 1, 8000, 'none'], ['Music licensing', 1, 1, 3000, 'none']]);
  linesFor('4300', [['Sound mix', 1, 1, 6000, 'none']]);
  linesFor('4400', [['Color grade', 1, 1, 4000, 'none']]);
  linesFor('4500', [['Deliverables / DCP', 1, 1, 2500, 'none']]);
  linesFor('5000', [['E&O insurance', 1, 1, 3500, 'none'], ['Legal / clearance', 1, 1, 4000, 'none']]);
  linesFor('5100', [['Completion bond (see Financing & Bonds)', 1, 1, 0, 'none']]);
  p.globals.shootDays = 20; p.globals.contingencyPct = 10; p.globals.bondPct = 2.5;
  return p;
}

/* ---------------- calc engine (pure — tested in Node) ---------------- */
function lineQty(line, derived) {
  if (line.qtyGlobal && derived && derived[line.qtyGlobal] != null) return derived[line.qtyGlobal];
  return line.qty;
}
function lineSubtotal(line, derived) { return lineQty(line, derived) * line.x * line.rate; }
function lineFringe(line, derived) { return lineSubtotal(line, derived) * fringeRate(line.fringeId); }
function lineTotal(line, derived) { return lineSubtotal(line, derived) + lineFringe(line, derived); }
function accountTotals(acc, derived) {
  var sub = 0, fr = 0;
  acc.lines.forEach(function (l) { sub += lineSubtotal(l, derived); fr += lineFringe(l, derived); });
  return { subtotal: sub, fringe: fr, total: sub + fr };
}
function sagTierForBudget(total) {
  if (total < 300000) return UNION_RATES.sag[0];
  if (total < 700000) return UNION_RATES.sag[1];
  if (total <= 2000000) return UNION_RATES.sag[2];
  return UNION_RATES.sag[3];
}
/* Derived counts from the schedule: shoot days, cast days per character,
   location days per location. Lines linked to a global use these. */
function derivedFromSchedule(p) {
  var d = { shootDays: p.globals.shootDays };
  var days = (p.schedule && p.schedule.days) || [];
  if (days.length) d.shootDays = days.length;
  var castDays = {}, locDays = {};
  days.forEach(function (day) {
    (day.sceneIds || []).forEach(function (sid) {
      var sc = (p.scenes || []).find(function (s) { return s.id === sid; });
      if (!sc) return;
      (sc.characters || []).forEach(function (c) { castDays['castDays:' + c] = (castDays['castDays:' + c] || 0) + 1; });
      if (sc.location) locDays['locationDays:' + sc.location] = (locDays['locationDays:' + sc.location] || 0) + 1;
    });
  });
  Object.keys(castDays).forEach(function (k) { d[k] = castDays[k]; });
  Object.keys(locDays).forEach(function (k) { d[k] = locDays[k]; });
  return d;
}
function calcBudget(p) {
  var derived = derivedFromSchedule(p);
  var sections = { ATL: 0, BTL: 0, POST: 0, OTHER: 0 };
  var accounts = p.accounts.map(function (a) {
    var t = accountTotals(a, derived);
    sections[a.section] = (sections[a.section] || 0) + t.total;
    return { id: a.id, code: a.code, name: a.name, section: a.section, subtotal: t.subtotal, fringe: t.fringe, total: t.total };
  });
  var subtotal = accounts.reduce(function (s, a) { return s + a.subtotal; }, 0);
  var fringe = accounts.reduce(function (s, a) { return s + a.fringe; }, 0);
  var preCont = subtotal + fringe;
  var contingency = preCont * (num(p.globals.contingencyPct, 10) / 100);
  var bondLine = 0;
  var bondAcc = p.accounts.find(function (a) { return a.code === '5100'; });
  if (bondAcc) bondLine = accountTotals(bondAcc, derived).total;
  /* Completion bond as a % of the budget (planning) is applied on the
     bond account line only when its rate is 0 — the line itself is the
     authority; the % in globals is the planning default shown in
     Financing & Bonds. */
  var grandTotal = preCont + contingency;
  return { derived: derived, accounts: accounts, sections: sections, subtotal: subtotal, fringe: fringe, preContingency: preCont, contingency: contingency, bondLine: bondLine, grandTotal: grandTotal };
}
/* Cast payroll = Principal Cast + Supporting/Background lines (wages only,
   before fringe). P&H per line's fringe. Deposit base = payroll + P&H. */
function calcBonds(p) {
  var b = calcBudget(p);
  var payroll = 0, ph = 0;
  p.accounts.forEach(function (a) {
    if (a.code !== '1400' && a.code !== '1500') return;
    a.lines.forEach(function (l) {
      payroll += lineSubtotal(l, b.derived);
      ph += lineFringe(l, b.derived);
    });
  });
  var base = payroll + ph;
  var deposit = 0;
  if (p.bonds && p.bonds.depositOn) {
    deposit = (p.bonds.depositFlat != null && p.bonds.depositFlat !== '')
      ? num(p.bonds.depositFlat, 0)
      : base * (num(p.bonds.depositPct, 40) / 100);
  }
  return { payroll: payroll, ph: ph, base: base, deposit: deposit, grandTotal: b.grandTotal, totalCashRequired: b.grandTotal + deposit, contingency: b.contingency };
}
function calcFinancing(p) {
  var srcs = (p.financing && p.financing.sources) || [];
  var committed = 0, received = 0, pipeline = 0;
  srcs.forEach(function (s) {
    committed += num(s.committed, 0); received += num(s.received, 0);
    if (s.status === 'Pipeline') pipeline += num(s.committed, 0);
  });
  var b = calcBonds(p);
  var gap = Math.max(0, b.totalCashRequired - committed);
  var toLand = Math.max(0, committed - received);
  var waterfall = srcs.slice().sort(function (a, c) { return num(a.tier, 99) - num(c.tier, 99); });
  return { committed: committed, received: received, pipeline: pipeline, gap: gap, toLand: toLand, waterfall: waterfall, totalCashRequired: b.totalCashRequired };
}
function calcActuals(p) {
  var b = calcBudget(p);
  var byAccount = {};
  (p.actuals || []).forEach(function (a) { byAccount[a.accountId] = (byAccount[a.accountId] || 0) + num(a.amount, 0); });
  var spent = (p.actuals || []).reduce(function (s, a) { return s + num(a.amount, 0); }, 0);
  var rows = b.accounts.map(function (a) {
    var sp = byAccount[a.id] || 0;
    return { code: a.code, name: a.name, budgeted: a.total, spent: sp, left: a.total - sp };
  });
  return { spent: spent, left: b.grandTotal - spent, rows: rows, grandTotal: b.grandTotal };
}
/* Day Out of Days: characters x shoot days. S=start, W=work, F=finish, H=hold, ''=off. */
function calcDOOD(p) {
  var days = (p.schedule && p.schedule.days) || [];
  var chars = [];
  (p.scenes || []).forEach(function (sc) {
    (sc.characters || []).forEach(function (c) { if (chars.indexOf(c) < 0) chars.push(c); });
  });
  var rows = chars.map(function (c) {
    var workDays = [];
    days.forEach(function (day, i) {
      var works = (day.sceneIds || []).some(function (sid) {
        var sc = (p.scenes || []).find(function (s) { return s.id === sid; });
        return sc && (sc.characters || []).indexOf(c) >= 0;
      });
      if (works) workDays.push(i);
    });
    var cells = days.map(function (day, i) {
      if (workDays.indexOf(i) < 0) return '';
      if (workDays.length === 1) return 'S/F';
      if (i === workDays[0]) return 'S';
      if (i === workDays[workDays.length - 1]) return 'F';
      return 'W';
    });
    /* Hold days: scheduled shoot days between first and last work day where the actor is not called. */
    if (workDays.length > 1) {
      for (var i = workDays[0] + 1; i < workDays[workDays.length - 1]; i++) {
        if (workDays.indexOf(i) < 0) cells[i] = 'H';
      }
    }
    return { character: c, cells: cells, workCount: workDays.length };
  });
  return { days: days, characters: chars, rows: rows };
}
function producerProgress(p) {
  var b = calcBudget(p);
  var scenes = p.scenes || [];
  var withShots = scenes.filter(function (s) { return (s.shots || []).length > 0; }).length;
  var withLook = scenes.filter(function (s) { return s.look && (s.look.notes || (s.look.images || []).length); }).length;
  var withCoverage = scenes.filter(function (s) { return s.coverage && s.coverage.trim(); }).length;
  var propsReady = (p.props || []).filter(function (x) { return x.status === 'On set' || x.status === 'Sourced'; }).length;
  return {
    script: scenes.length ? 'Done' : 'Not started',
    breakdown: scenes.length + ' scenes',
    moodboard: (p.moodboards || []).length + ' boards',
    storyboard: withShots + ' / ' + scenes.length + ' scenes with shots',
    shotList: withShots + ' / ' + scenes.length + ' scenes',
    look: withLook + ' / ' + scenes.length + ' scenes with look inspo',
    coverage: withCoverage + ' / ' + scenes.length + ' scenes covered',
    props: propsReady + ' / ' + (p.props || []).length + ' props ready',
    budget: money(b.grandTotal) + ' total',
    schedule: (p.schedule.days || []).length + ' shoot days',
    financing: money(calcFinancing(p).committed) + ' committed'
  };
}

/* ---------------- exports (pure) ---------------- */
function escXml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function buildMMBXML(p) {
  var b = calcBudget(p);
  var out = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- MMB-style XML export, modeled on Movie Magic Budgeting\'s published XML (Advanced) export structure. -->',
    '<!-- This is NOT a native .mmb / .mmbx file: Movie Magic\'s native format is a closed, proprietary format with no public spec. -->',
    '<Budget title="' + escXml(p.title) + '" currency="' + escXml(p.currency) + '" version="' + escXml(p.version) + '">',
    '  <BudgetInfo><Producer>' + escXml(p.producer) + '</Producer><Director>' + escXml(p.director) + '</Director><Writer>' + escXml(p.writer) + '</Writer><PreparedBy>' + escXml(p.preparedBy) + '</PreparedBy><BudgetDate>' + escXml(p.budgetDate) + '</BudgetDate><Company>' + escXml(p.company) + '</Company></BudgetInfo>',
    '  <Globals><ShootDays>' + b.derived.shootDays + '</ShootDays><ContingencyPct>' + p.globals.contingencyPct + '</ContingencyPct><BondPct>' + p.globals.bondPct + '</BondPct></Globals>'];
  p.accounts.forEach(function (a, ai) {
    var t = accountTotals(a, b.derived);
    out.push('  <Account code="' + a.code + '" name="' + escXml(a.name) + '" section="' + a.section + '" subtotal="' + t.subtotal.toFixed(2) + '" fringe="' + t.fringe.toFixed(2) + '" total="' + t.total.toFixed(2) + '">');
    a.lines.forEach(function (l) {
      out.push('    <DetailLine description="' + escXml(l.desc) + '" qty="' + lineQty(l, b.derived) + '" x="' + l.x + '" rate="' + l.rate + '" subtotal="' + lineSubtotal(l, b.derived).toFixed(2) + '" fringe="' + lineFringe(l, b.derived).toFixed(2) + '" fringeId="' + escXml(l.fringeId) + '" />');
    });
    out.push('  </Account>');
  });
  var bonds = calcBonds(p);
  out.push('  <Totals subtotal="' + b.subtotal.toFixed(2) + '" fringe="' + b.fringe.toFixed(2) + '" contingency="' + b.contingency.toFixed(2) + '" grandTotal="' + b.grandTotal.toFixed(2) + '" />');
  out.push('  <Bonds sagDeposit="' + bonds.deposit.toFixed(2) + '" depositBase="' + bonds.base.toFixed(2) + '" totalCashRequired="' + bonds.totalCashRequired.toFixed(2) + '" />');
  out.push('</Budget>');
  return out.join('\n');
}
function buildCSV(p) {
  var b = calcBudget(p);
  var rows = [['Account', 'Code', 'Section', 'Description', 'Qty', 'X', 'Rate', 'Fringe', 'Subtotal', 'Fringe $', 'Total']];
  p.accounts.forEach(function (a) {
    a.lines.forEach(function (l) {
      rows.push([a.name, a.code, a.section, l.desc, lineQty(l, b.derived), l.x, l.rate, l.fringeId, lineSubtotal(l, b.derived).toFixed(2), lineFringe(l, b.derived).toFixed(2), lineTotal(l, b.derived).toFixed(2)]);
    });
    var t = accountTotals(a, b.derived);
    rows.push([a.name + ' TOTAL', a.code, a.section, '', '', '', '', '', t.subtotal.toFixed(2), t.fringe.toFixed(2), t.total.toFixed(2)]);
  });
  rows.push(['GRAND TOTAL', '', '', '', '', '', '', '', b.subtotal.toFixed(2), b.fringe.toFixed(2), b.grandTotal.toFixed(2)]);
  return rows.map(function (r) { return r.map(function (c) { var s = String(c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(','); }).join('\n');
}
function buildTSV(p) { return buildCSV(p).split('\n').map(function (line) { return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(function (c) { return c.replace(/^"|"$/g, '').replace(/""/g, '"'); }).join('\t'); }).join('\n'); }

/* Script parsing (pure): .txt / Fountain text, and .fdx XML text. */
var PROP_KEYWORDS = ['gun', 'pistol', 'rifle', 'knife', 'sword', 'phone', 'laptop', 'computer', 'letter', 'photo', 'photograph', 'key', 'keys', 'wallet', 'bag', 'suitcase', 'bottle', 'glass', 'cup', 'cigarette', 'lighter', 'watch', 'ring', 'necklace', 'hat', 'coat', 'car', 'truck', 'bike', 'bicycle', 'map', 'book', 'newspaper', 'candle', 'lamp', 'chair', 'table', 'mirror', 'rope', 'box', 'envelope', 'ticket', 'passport', 'camera', 'radio', 'tv', 'television', 'guitar', 'piano', 'flowers', 'cake', 'food', 'plate', 'fork', 'blood', 'mask', 'wig', 'glasses', 'sunglasses', 'umbrella', 'flashlight', 'backpack', 'purse', 'briefcase', 'chest', 'safe', 'door', 'window'];
function parseScriptText(text) {
  var lines = String(text || '').split(/\r?\n/);
  var scenes = [], cur = null;
  function flush() { if (cur) scenes.push(cur); cur = null; }
  lines.forEach(function (raw) {
    var line = raw.trim();
    if (!line) return;
    var slug = line.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+(.+)$/i);
    if (slug) {
      flush();
      var rest = slug[2];
      var parts = rest.split(/\s+-\s+/);
      cur = { id: uid(), slug: line.toUpperCase(), location: (parts[0] || '').trim(), dayNight: (parts[1] || '').trim(), characters: [], props: [], description: '', coverage: '', dept: { Wardrobe: '', Art: '', Camera: '', Sound: '', 'Makeup & Hair': '' }, look: { notes: '', lighting: '', color: '', lens: '', images: [] }, shots: [], mood: [] };
      return;
    }
    if (!cur) return;
    /* Character cue: ALL CAPS, short, no period — in dialogue blocks. */
    if (/^[A-Z][A-Z0-9 '’\-()]{1,30}$/.test(line) && !/[.!?]$/.test(line) && line.split(' ').length <= 4) {
      var name = line.replace(/\s*\(.*\)\s*$/, '').trim();
      if (name && cur.characters.indexOf(name) < 0 && name.length > 1) cur.characters.push(name);
      return;
    }
    cur.description = (cur.description ? cur.description + ' ' : '') + line;
    var low = line.toLowerCase();
    PROP_KEYWORDS.forEach(function (kw) {
      if (low.indexOf(kw) >= 0 && cur.props.indexOf(kw) < 0) cur.props.push(kw);
    });
  });
  flush();
  return scenes;
}
function parseFDX(text) {
  try {
    var doc = new DOMParser().parseFromString(text, 'text/xml');
    var paras = doc.getElementsByTagName('Paragraph');
    var out = [], cur = null;
    function flush() { if (cur) out.push(cur); cur = null; }
    for (var i = 0; i < paras.length; i++) {
      var type = paras[i].getAttribute('Type') || '';
      var txt = paras[i].textContent.trim();
      if (!txt) continue;
      if (type === 'Scene Heading') {
        flush();
        cur = { id: uid(), slug: txt.toUpperCase(), location: txt, dayNight: '', characters: [], props: [], description: '', coverage: '', dept: { Wardrobe: '', Art: '', Camera: '', Sound: '', 'Makeup & Hair': '' }, look: { notes: '', lighting: '', color: '', lens: '', images: [] }, shots: [], mood: [] };
      } else if (type === 'Character') {
        if (cur) { var n = txt.replace(/\s*\(.*\)\s*$/, '').trim(); if (n && cur.characters.indexOf(n) < 0) cur.characters.push(n); }
      } else if (cur) {
        cur.description = (cur.description ? cur.description + ' ' : '') + txt;
        var low = txt.toLowerCase();
        PROP_KEYWORDS.forEach(function (kw) { if (low.indexOf(kw) >= 0 && cur.props.indexOf(kw) < 0) cur.props.push(kw); });
      }
    }
    flush();
    return out;
  } catch (e) { return parseScriptText(text); }
}

/* Node test export (browser ignores this block). */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UNION_RATES: UNION_RATES, FRINGES: FRINGES, ACCOUNTS: ACCOUNTS, blankProject: blankProject, applyFeatureTemplate: applyFeatureTemplate, lineSubtotal: lineSubtotal, lineFringe: lineFringe, calcBudget: calcBudget, calcBonds: calcBonds, calcFinancing: calcFinancing, calcActuals: calcActuals, calcDOOD: calcDOOD, derivedFromSchedule: derivedFromSchedule, parseScriptText: parseScriptText, buildMMBXML: buildMMBXML, buildCSV: buildCSV, buildTSV: buildTSV, producerProgress: producerProgress, newLine: newLine, money: money };
}

/* =====================================================================
   Persistence + cloud sync (shared library).
   Local: localStorage 'filmmakerDashboard.v1' holds the SHARED library
   currently on screen. Signed-out work lives under the signed-out key
   and is NEVER auto-pushed — the app asks first.
   Cloud: Supabase project script-builder (same as Script Builder),
   table public.filmmaker_libraries, ONE row id='shared' holding the
   whole library as JSON. RLS (see supabase/filmmaker_libraries.sql)
   only allows Gabe's and Amelia's email addresses. Until that SQL is
   run in the Supabase dashboard, the table does not exist and sync
   simply stays off — the app works fully offline, nothing is lost.
   Sign-out: flushes a final push, then CLEARS the shared library from
   this device (a recovery copy is stashed under the signer's own user
   id, never shown to the next signer). The next signer pulls the
   shared library from the cloud after signing in. That is the fix for
   the shared-device problem: Amelia never inherits Gabe's on-screen
   copy, and vice versa — she gets the shared copy from the cloud.
   Last-write-wins, same rules as Script Builder: newer timestamp wins,
   never overwrite non-empty data with empty data, ask when timestamps
   cannot decide. No live co-typing in v1 — if you both edit at once,
   the later save wins.
   ===================================================================== */
var LS_KEY = 'filmmakerDashboard.v1';
var LS_OWNER_KEY = 'filmmakerDashboard.owner.v1';
var LS_SIGNEDOUT_KEY = 'filmmakerDashboard.signedout.v1';
var LS_USER_PREFIX = 'filmmakerDashboard.user.';
var SB_SESSION_KEY = 'filmmakerDashboard.session.v1';
var SB_URL = 'https://elnbqrnljdqvjcbpyxne.supabase.co';
var SB_ANON = 'sb_publishable_3rtVB9nuc61cLb5I7nhYZg_WFlxlk79';
var CLOUD_DEBOUNCE_MS = 2000;
var SHARED_ROW_ID = 'shared';

var DB = seedDB();
var currentProjectId = null;
var currentTab = 'dashboard';
var currentRole = 'producer'; /* producer | dept */
var currentDept = 'Camera';
var cloudSession = null, cloudUser = null, cloudState = 'off', cloudBusy = false, cloudPushHandle = null, cloudPushPending = false, cloudLastPush = null, cloudLastPushAt = 0, localUnsynced = false, cloudSuppressPush = false;
var pendingCloud = null, pendingClaim = null;

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
function loadLocalDB() {
  try { var raw = lsGet(LS_KEY); if (!raw) return seedDB(); var d = JSON.parse(raw); return (d && Array.isArray(d.projects)) ? d : seedDB(); } catch (e) { return seedDB(); }
}
DB = (typeof localStorage !== 'undefined') ? loadLocalDB() : seedDB();
var libraryOwner = (function () { try { var rec = JSON.parse(lsGet(LS_OWNER_KEY) || 'null'); if (rec && typeof rec.userId === 'string') return rec.userId; if (rec === null && !isEmptyDB(loadLocalDB())) return null; } catch (e) {} return ''; })();
function persistLocal() {
  lsSet(LS_KEY, JSON.stringify(DB));
  if (libraryOwner !== null) lsSet(LS_OWNER_KEY, JSON.stringify({ userId: libraryOwner }));
}
function stashKeyFor(ownerId) { if (ownerId === '') return LS_SIGNEDOUT_KEY; return LS_USER_PREFIX + ownerId; }
function loadStash(ownerId) { try { var raw = lsGet(stashKeyFor(ownerId)); if (!raw) return null; var d = JSON.parse(raw); return (d && Array.isArray(d.projects)) ? d : null; } catch (e) { return null; } }
function stashLibrary(ownerId, db) { lsSet(stashKeyFor(ownerId), JSON.stringify(db)); }
function isEmptyDB(db) { return !db || !Array.isArray(db.projects) || db.projects.length === 0; }
function latestUpdated(db) { var best = ''; (db.projects || []).forEach(function (p) { if (p.updatedAt && p.updatedAt > best) best = p.updatedAt; }); return best; }
function parseSyncTime(s) { var t = Date.parse(s || ''); return isNaN(t) ? 0 : t; }
function localSyncTime(db) { return parseSyncTime(db && db.updatedAt) || parseSyncTime(latestUpdated(db)); }
function cloudSyncTime(cdb, cu) { return parseSyncTime(cu) || parseSyncTime(cdb && cdb.updatedAt) || parseSyncTime(latestUpdated(cdb)); }
function sameContent(a, b) {
  function strip(db) { var c = clone(db || { projects: [] }); delete c.updatedAt; (c.projects || []).forEach(function (p) { delete p.updatedAt; }); return c; }
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}
function decideSync(local, cloud, cloudUpdatedAt) {
  if (isEmptyDB(cloud)) {
    if (isEmptyDB(local)) return { action: 'none' };
    return { action: 'push' };
  }
  if (isEmptyDB(local)) return { action: 'pull' };
  if (sameContent(local, cloud)) return { action: 'none' };
  var lt = localSyncTime(local), ct = cloudSyncTime(cloud, cloudUpdatedAt);
  if (lt && ct && lt !== ct) return { action: lt > ct ? 'push' : 'pull' };
  return { action: 'choose' };
}
function touchLocal() { DB.updatedAt = nowISO(); var p = currentProject(); if (p) p.updatedAt = nowISO(); }
function currentProject() { return (DB.projects || []).find(function (p) { return p.id === currentProjectId; }) || DB.projects[0] || null; }
function save() { touchLocal(); persistLocal(); scheduleCloudPush(); }

/* ---- Supabase REST (plain fetch, no SDK — same as Script Builder) ---- */
function loadCloudSession() {
  try { var raw = lsGet(SB_SESSION_KEY); if (!raw) return null; var s = JSON.parse(raw); return (s && s.access_token && s.user_id) ? s : null; } catch (e) { return null; }
}
cloudSession = (typeof localStorage !== 'undefined') ? loadCloudSession() : null;
cloudUser = cloudSession ? { id: cloudSession.user_id, email: cloudSession.email || '' } : null;
function saveCloudSession(s) { cloudSession = s; cloudUser = s ? { id: s.user_id, email: s.email || '' } : null; if (s) lsSet(SB_SESSION_KEY, JSON.stringify(s)); else lsDel(SB_SESSION_KEY); }
function sbFetch(path, opts) {
  opts = opts || {};
  var headers = { apikey: SB_ANON, 'Content-Type': 'application/json' };
  if (cloudSession && cloudSession.access_token) headers.Authorization = 'Bearer ' + cloudSession.access_token;
  return fetch(SB_URL + path, { method: opts.method || 'GET', headers: headers, body: opts.body || undefined, keepalive: !!opts.keepalive }).then(function (r) {
    if (!r.ok) { var e = new Error('Supabase ' + r.status); e.status = r.status; throw e; }
    return r.text().then(function (t) { try { return JSON.parse(t); } catch (e) { return t; } });
  });
}
function sessionFromAuth(data) {
  if (!data || !data.access_token) return null;
  return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at, user_id: data.user && data.user.id, email: data.user && data.user.email };
}
function authSignUp(email, pw) { return sbFetch('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: email, password: pw }) }); }
function authSignIn(email, pw) { return sbFetch('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email, password: pw }) }); }
function authRefresh() { return sbFetch('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: cloudSession.refresh_token }) }); }
function authGetUser() { return sbFetch('/auth/v1/user', { method: 'GET' }); }
function fetchCloudRow() {
  return sbFetch('/rest/v1/filmmaker_libraries?id=eq.' + SHARED_ROW_ID + '&select=data,updated_at,updated_by', { method: 'GET' }).then(function (rows) {
    if (!rows || !rows.length) return null;
    return { db: rows[0].data, updatedAt: rows[0].updated_at, updatedBy: rows[0].updated_by };
  });
}
function pushCloudRowReal(keepalive) {
  var headers = { apikey: SB_ANON, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' };
  if (cloudSession && cloudSession.access_token) headers.Authorization = 'Bearer ' + cloudSession.access_token;
  var body = JSON.stringify([{ id: SHARED_ROW_ID, data: DB, updated_at: DB.updatedAt || nowISO(), updated_by: cloudUser ? cloudUser.email : '' }]);
  return fetch(SB_URL + '/rest/v1/filmmaker_libraries?on_conflict=id', { method: 'POST', headers: headers, body: body, keepalive: !!keepalive }).then(function (r) {
    if (!r.ok) { var e = new Error('Supabase ' + r.status); e.status = r.status; throw e; }
    cloudLastPushAt = parseSyncTime(DB.updatedAt);
  });
}
function setCloudStatus(s) { cloudState = s; var el = (typeof document !== 'undefined') ? document.getElementById('cloud-status') : null; if (el) el.textContent = cloudStatusText(); renderCloudAuth(); }
function cloudStatusText() {
  return { off: 'Cloud sync off — you’re signed out. Your work is saved on this device.', local: 'Saved on this device — cloud not synced yet.', saving: 'Saving to cloud…', synced: 'Synced to the shared cloud library.', error: 'Cloud unreachable — saved on this device, will retry.', choosing: 'Cloud and this device differ — pick one below.', claim: 'This device has work saved while signed out — is it yours?' }[cloudState] || '';
}
function handleSyncError(err) {
  if (err && err.status === 401) { saveCloudSession(null); setCloudStatus('off'); return; }
  if (err && (err.status === 403 || err.status === 404)) { setCloudStatus('error'); var m = (typeof document !== 'undefined') ? document.getElementById('cloud-auth-msg') : null; if (m) m.textContent = 'Shared sync isn’t set up for this account yet — run supabase/filmmaker_libraries.sql in the Supabase dashboard (see README step 5), then sign in again. Your work is safe on this device.'; return; }
  setCloudStatus('local');
}
function pushCloud() {
  if (!cloudUser || cloudBusy) { if (cloudUser) cloudPushPending = true; return Promise.resolve(); }
  cloudBusy = true; setCloudStatus('saving');
  var needRefresh = cloudSession && cloudSession.expires_at && cloudSession.expires_at - Math.floor(Date.now() / 1000) < 60;
  var p = needRefresh ? authRefresh().then(function (d) { var s = sessionFromAuth(d); if (s) saveCloudSession(s); }).catch(function () {}) : Promise.resolve();
  cloudLastPush = p.then(function () { return pushCloudRowReal(); }).then(function () {
    cloudBusy = false; localUnsynced = false; setCloudStatus('synced');
    if (cloudPushPending) { cloudPushPending = false; return pushCloud(); }
  }).catch(function (err) { cloudBusy = false; handleSyncError(err); });
  return cloudLastPush;
}
function scheduleCloudPush() {
  if (!cloudUser || cloudSuppressPush) return;
  localUnsynced = true;
  if (cloudPushHandle) clearTimeout(cloudPushHandle);
  cloudPushHandle = setTimeout(function () { cloudPushHandle = null; pushCloud(); }, CLOUD_DEBOUNCE_MS);
}
function initialSync() {
  if (!cloudUser) return Promise.resolve();
  return fetchCloudRow().then(function (cloud) {
    if (!cloud || !cloud.db) {
      if (isEmptyDB(DB)) { setCloudStatus('synced'); return; }
      return pushCloud();
    }
    var decision = decideSync(DB, cloud.db, cloud.updatedAt);
    if (decision.action === 'push') return pushCloud();
    if (decision.action === 'none') { setCloudStatus('synced'); return; }
    if (decision.action === 'pull') {
      DB = cloud.db; persistLocal(); if (typeof renderAll === 'function') renderAll();
      setCloudStatus('synced'); return;
    }
    pendingCloud = cloud; setCloudStatus('choosing');
  }).catch(handleSyncError);
}
function localEditedSincePush() { var lt = parseSyncTime(DB && DB.updatedAt); if (!lt) return true; return lt > cloudLastPushAt; }
function recheckCloud() {
  if (!cloudUser || cloudBusy || pendingClaim || cloudState === 'choosing' || cloudState === 'claim') return Promise.resolve();
  if (localEditedSincePush()) {
    if (cloudPushHandle) { clearTimeout(cloudPushHandle); cloudPushHandle = null; }
    return pushCloud().then(function () { return recheckCloud(); });
  }
  if (cloudPushHandle) { clearTimeout(cloudPushHandle); cloudPushHandle = null; }
  localUnsynced = false;
  if (typeof document === 'undefined' || !document.getElementById('view-dashboard')) return Promise.resolve();
  return initialSync();
}
function flushCloudPushOnClose() {
  if (!cloudUser || cloudBusy) return;
  if (!localEditedSincePush()) return;
  if (!cloudPushHandle && !localUnsynced) return;
  if (cloudPushHandle) { clearTimeout(cloudPushHandle); cloudPushHandle = null; }
  localUnsynced = false;
  pushCloudRowReal(true).catch(function () {});
}
/* Sign-in: stash whatever is on screen under its previous owner, then
   load the SHARED library from the cloud (last-write-wins). A signed-out
   library is never auto-pushed — the claim panel asks first. */
function switchToShared(sess) {
  var uid = sess.user_id || sess.id;
  var email = sess.email || '';
  /* Who owned the library on screen? 'shared' (was signed in), ''
     (signed out), or null (unknown / pre-dates this tracking). */
  var prevOwner = null;
  try { var rec = JSON.parse(lsGet(LS_OWNER_KEY) || 'null'); prevOwner = (rec && typeof rec.userId === 'string') ? rec.userId : (rec === null ? null : ''); } catch (e) { prevOwner = null; }
  if (prevOwner === 'shared') prevOwner = cloudUser ? cloudUser.id : '';
  /* Stash the on-screen library under its previous owner ('' = signed out). */
  if (!isEmptyDB(DB)) stashLibrary(prevOwner === null ? '' : prevOwner, DB);
  var own = loadStash(uid);
  if (!isEmptyDB(DB) && (prevOwner === '')) {
    pendingClaim = { db: clone(DB), email: email };
    DB = seedDB(); persistLocal();
    setCloudStatus('claim');
    return false;
  }
  if (own && !isEmptyDB(own)) {
    /* Recovery stash of this signer's own — only used when the cloud is empty. */
    pendingClaim = { db: own, email: email, recovery: true };
    DB = seedDB(); persistLocal();
    setCloudStatus('claim');
    return false;
  }
  DB = seedDB(); persistLocal();
  return true;
}
function initCloud() {
  if (typeof document !== 'undefined') renderCloudAuth();
  if (!cloudUser) { setCloudStatus('off'); return Promise.resolve(); }
  setCloudStatus('local');
  if (typeof fetch !== 'function') { setCloudStatus('local'); return Promise.resolve(); }
  var needRefresh = cloudSession && cloudSession.expires_at && cloudSession.expires_at - Math.floor(Date.now() / 1000) < 60;
  var p = needRefresh ? authRefresh().then(function (d) { var s = sessionFromAuth(d); if (s) saveCloudSession(s); }).catch(function () {}) : Promise.resolve();
  return p.then(function () { return authGetUser(); }).then(function (u) {
    if (u && u.id) cloudUser = { id: u.id, email: u.email || cloudUser.email };
    if (switchToShared(cloudUser)) return initialSync();
    if (typeof renderAll === 'function') renderAll();
  }).catch(function (err) {
    if (err && err.status === 401) { saveCloudSession(null); setCloudStatus('off'); if (typeof renderAll === 'function') renderAll(); return; }
    setCloudStatus('local');
  });
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports.decideSync = decideSync; module.exports.sameContent = sameContent; module.exports.seedDB = seedDB;
}

/* =====================================================================
   UI — tabs, dashboard, budget. Rendered into #view; one delegated
   click/input/change handler drives everything (data-action attributes).
   Role filter: currentRole 'producer' sees everything; 'dept' sees only
   currentDept's accounts / scene sections / props / inspo, and the
   budget totals are hidden (dept heads get their own lines only).
   This is a client-side view filter on the shared login in v1 — do NOT
   share the shared login with dept heads; use the per-dept exports /
   printouts on their tabs instead. True separate dept accounts need a
   backend and are a v2 item (see README).
   ===================================================================== */
var TABS = [
  ['dashboard', 'Dashboard'], ['budget', 'Budget'], ['rates', 'Union Rates'],
  ['actuals', 'Actuals & Left'], ['script', 'Script & Coverage'], ['schedule', 'Schedule'],
  ['visual', 'Visual Prep'], ['scenes', 'Scene Pages'], ['props', 'Props & Sets'],
  ['crew', 'Crew & Call Sheets'], ['financing', 'Financing & Bonds'], ['settings', 'Settings & Export']
];
function $(id) { return document.getElementById(id); }
function h(html) { return html; }
function download(filename, text, mime) {
  var blob = new Blob([text], { type: mime || 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}
function setTab(t) { currentTab = t; renderAll(); }
function renderTabs() {
  $('tabs').innerHTML = TABS.map(function (t) {
    return '<button type="button" data-action="tab" data-tab="' + t[0] + '" class="' + (currentTab === t[0] ? 'active' : '') + '">' + t[1] + '</button>';
  }).join('');
}
function renderAll() {
  renderTabs();
  var p = currentProject();
  var v = $('view');
  if (!p) { v.innerHTML = viewHome(); return; }
  var fn = { dashboard: viewDashboard, budget: viewBudget, rates: viewRates, actuals: viewActuals, script: viewScript, schedule: viewSchedule, visual: viewVisual, scenes: viewScenes, props: viewProps, crew: viewCrew, financing: viewFinancing, settings: viewSettings }[currentTab] || viewDashboard;
  v.innerHTML = fn(p);
  renderCloudAuth();
}
function projectCard(p) {
  var b = calcBudget(p);
  return '<div class="card"><h2>' + esc(p.title) + '</h2><p class="sub">' + esc(p.template) + ' · ' + esc(p.status) + ' · Budget ' + money(b.grandTotal) + ' · ' + (p.schedule.days || []).length + ' shoot days</p>' +
    '<div class="btnrow"><button type="button" class="small" data-action="open-project" data-id="' + p.id + '">Open</button>' +
    '<button type="button" class="small" data-action="dup-project" data-id="' + p.id + '">Duplicate</button>' +
    '<button type="button" class="small ghost" data-action="del-project" data-id="' + p.id + '">Delete</button></div></div>';
}
function viewHome() {
  var cards = DB.projects.map(projectCard).join('') || '<p class="muted">No projects yet — start one below. Projects are shared: Gabe and Amelia see the same list.</p>';
  return '<div class="card"><h2>My Films</h2><p class="sub">Shared library — Gabe &amp; Amelia see and edit the same projects. Last save wins if you both edit at once, so don’t type in the same project at the same time.</p>' +
    '<div class="btnrow"><button type="button" class="small primary" data-action="new-project" data-template="feature">＋ New Feature</button>' +
    '<button type="button" class="small" data-action="new-project" data-template="short">＋ New Short</button>' +
    '<button type="button" class="small" data-action="new-project" data-template="commercial">＋ New Commercial</button>' +
    '<button type="button" class="small" data-action="new-project" data-template="blank">＋ Blank</button></div>' +
    '<div class="card"><h3>☁️ Cloud sync — shared</h3><p class="muted">Sign in to back up the shared library to the cloud and use it on phone and laptop. Email confirmation is on — check your inbox for the confirmation link after signing up.</p>' +
    '<p id="cloud-status" class="saved"></p>' +
    '<div id="cloud-signed-out"><label>Email<input type="email" id="cloud-email" autocomplete="email" placeholder="you@example.com"></label>' +
    '<label>Password<input type="password" id="cloud-password" autocomplete="current-password" placeholder="Your password"></label>' +
    '<div class="btnrow"><button type="button" class="small primary" id="btn-cloud-signin">Sign in</button>' +
    '<button type="button" class="small" id="btn-cloud-signup">Sign up</button></div>' +
    '<p class="muted" id="cloud-auth-msg"></p></div>' +
    '<div id="cloud-signed-in" hidden><p>Signed in as <b id="cloud-email-shown"></b> — shared library</p>' +
    '<div class="btnrow"><button type="button" class="small" id="btn-cloud-sync">↻ Sync now</button>' +
    '<button type="button" class="small ghost" id="btn-cloud-signout">Sign out</button></div>' +
    '<p class="muted">Signing out clears the shared library from this device (it stays in the cloud). The next person to sign in here pulls it fresh — they never inherit your on-screen copy.</p></div>' +
    '<div id="cloud-conflict" hidden><p><b>Cloud and this device both have projects — pick which one to keep.</b></p><p id="cloud-conflict-text" class="muted"></p>' +
    '<div class="btnrow"><button type="button" class="small primary" id="btn-cloud-keep-local">Keep this device</button>' +
    '<button type="button" class="small" id="btn-cloud-use-cloud">Use cloud copy</button></div></div>' +
    '<div id="cloud-claim" hidden><p><b>This device already has projects saved while signed out — are they yours?</b></p><p id="cloud-claim-text" class="muted"></p>' +
    '<div class="btnrow"><button type="button" class="small primary" id="btn-cloud-claim-yes">Yes — upload them to the shared library</button>' +
    '<button type="button" class="small" id="btn-cloud-claim-no">No — start from the cloud copy</button></div>' +
    '<p class="muted">If you pick No, those projects stay saved on this device under a backup — nothing is deleted.</p></div></div>' +
    '<div class="btnrow"><button type="button" class="small" data-action="export-json">⬇ Export backup (JSON)</button>' +
    '<button type="button" class="small" data-action="import-json">⬆ Import backup</button><input type="file" id="import-file" accept=".json,application/json" hidden></div>' +
    '</div>' + cards;
}
function renderCloudAuth() {
  var signedIn = !!cloudUser;
  var so = $('cloud-signed-out'), si = $('cloud-signed-in');
  if (so) so.hidden = signedIn;
  if (si) si.hidden = !signedIn;
  var shown = $('cloud-email-shown'); if (shown && cloudUser) shown.textContent = cloudUser.email || '';
  var st = $('cloud-status'); if (st) st.textContent = cloudStatusText();
  var conf = $('cloud-conflict'); if (conf) conf.hidden = !(pendingCloud && cloudState === 'choosing');
  var cl = $('cloud-claim'); if (cl) cl.hidden = !(pendingClaim && cloudState === 'claim');
  if (pendingCloud && $('cloud-conflict-text')) $('cloud-conflict-text').textContent = 'Cloud copy updated ' + (pendingCloud.updatedAt || 'recently') + (pendingCloud.updatedBy ? ' by ' + pendingCloud.updatedBy : '') + '. This device was updated ' + (DB.updatedAt || 'recently') + '.';
  if (pendingClaim && $('cloud-claim-text')) $('cloud-claim-text').textContent = 'This device has ' + pendingClaim.db.projects.length + ' project(s) saved while signed out. Upload them to the shared library for ' + (pendingClaim.email || 'your account') + '?';
}
function headerFields(p) {
  return '<div class="card"><h2>' + esc(p.title) + '</h2>' +
    '<div class="grid3">' +
    '<label>Project title<input data-field="title" value="' + esc(p.title) + '"></label>' +
    '<label>Production company<input data-field="company" value="' + esc(p.company) + '"></label>' +
    '<label>Producer<input data-field="producer" value="' + esc(p.producer) + '"></label>' +
    '<label>Director<input data-field="director" value="' + esc(p.director) + '"></label>' +
    '<label>Writer<input data-field="writer" value="' + esc(p.writer) + '"></label>' +
    '<label>Prepared by<input data-field="preparedBy" value="' + esc(p.preparedBy) + '"></label>' +
    '<label>Budget date<input type="date" data-field="budgetDate" value="' + esc(p.budgetDate) + '"></label>' +
    '<label>Version<input data-field="version" value="' + esc(p.version) + '"></label>' +
    '<label>Status<select data-field="status">' + ['In progress', 'Pre-production', 'Shooting', 'Post', 'Done'].map(function (s) { return '<option' + (p.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
    '</div><p class="muted">Role view: <select id="role-select" data-field="__role"><option value="producer"' + (currentRole === 'producer' ? ' selected' : '') + '>Producer — everything</option>' +
    DEPTS.map(function (d) { return '<option value="dept:' + d + '"' + (currentRole === 'dept' && currentDept === d ? ' selected' : '') + '>Dept head — ' + d + ' only</option>'; }).join('') +
    '</select> <span class="muted">Dept heads see only their department’s budget lines, inspo, shots, schedule items and scene sections. Use their tab’s export/print for what you send them — don’t share the shared login.</span></p>' +
    '<div class="btnrow"><button type="button" class="small" data-action="back-home">← All films</button>' +
    '<button type="button" class="small primary" data-action="preview-pdf">👁 Preview / PDF</button>' +
    '<span class="saved" id="saved-note">Saved on this device</span></div></div>';
}
function visibleAccounts(p) {
  if (currentRole !== 'dept') return p.accounts;
  var codes = DEPT_ACCOUNTS[currentDept] || [];
  return p.accounts.filter(function (a) { return codes.indexOf(a.code) >= 0; });
}
function viewDashboard(p) {
  var b = calcBudget(p), bonds = calcBonds(p), fin = calcFinancing(p), act = calcActuals(p), prog = producerProgress(p);
  var propsDue = (p.props || []).filter(function (x) { return x.status !== 'On set' && x.status !== 'Returned' && x.prepBy && x.prepBy <= todayISO(); });
  var kpi = function (label, val, sub) { return '<div class="card kpi-card"><div class="kpi-label">' + label + '</div><div class="kpi">' + val + '</div><div class="muted">' + (sub || '') + '</div></div>'; };
  var rows = Object.keys(prog).map(function (k) { return '<tr><td>' + k + '</td><td>' + esc(prog[k]) + '</td></tr>'; }).join('');
  return headerFields(p) +
    '<div class="grid4">' +
    kpi('Budget total', money(b.grandTotal), 'Contingency ' + money(b.contingency) + ' included') +
    kpi('Spent', money(act.spent), money(act.left) + ' left to spend') +
    kpi('Cash required', money(bonds.totalCashRequired), 'incl. SAG deposit ' + money(bonds.deposit) + ' locked') +
    kpi('Financing committed', money(fin.committed), money(fin.gap) + ' gap to close') +
    '</div>' +
    '<div class="card"><h3>Producer progress</h3><table>' + rows + '</table></div>' +
    (propsDue.length ? '<div class="card"><h3>⚠️ Props / set pieces due now</h3><p>' + propsDue.map(function (x) { return esc(x.name) + ' — prep by ' + fmtDate(x.prepBy) + ' (' + esc(x.status) + ')'; }).join('<br>') + '</p></div>' : '') +
    '<div class="card"><h3>Next shoot day</h3><p>' + nextShootDay(p) + '</p>' +
    '<div class="btnrow"><button type="button" class="small" data-action="goto" data-tab="schedule">Schedule</button>' +
    '<button type="button" class="small" data-action="goto" data-tab="budget">Budget</button>' +
    '<button type="button" class="small" data-action="goto" data-tab="financing">Financing &amp; Bonds</button></div></div>';
}
function nextShootDay(p) {
  var days = (p.schedule.days || []).slice().sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });
  var next = days.find(function (d) { return d.date >= todayISO(); });
  if (!next) return 'No shoot days scheduled yet — add them on the Schedule tab.';
  var scenes = (next.sceneIds || []).map(function (sid) { var s = (p.scenes || []).find(function (x) { return x.id === sid; }); return s ? s.slug : ''; }).filter(Boolean).join(', ');
  return fmtDate(next.date) + (next.location ? ' — ' + esc(next.location) : '') + (scenes ? ' — ' + esc(scenes) : '');
}
function viewBudget(p) {
  var b = calcBudget(p);
  var isDept = currentRole === 'dept';
  var accounts = visibleAccounts(p);
  var pct = function (v) { return b.grandTotal ? (100 * v / b.grandTotal).toFixed(1) + '%' : '—'; };
  var topsRow = function (label, v) { return '<div class="list-row"><span class="list-label">' + label + '</span><span class="list-pct">' + pct(v) + '</span><span class="list-amount">' + money(v) + '</span></div>'; };
  var tops = '<div class="card"><h2>Topsheet</h2><div class="list-group">' +
    topsRow('Above the Line', b.sections.ATL || 0) +
    topsRow('Below the Line — Production', b.sections.BTL || 0) +
    topsRow('Post-Production', b.sections.POST || 0) +
    topsRow('Other', b.sections.OTHER || 0) +
    topsRow('Subtotal (wages &amp; costs)', b.subtotal) +
    topsRow('Fringes &amp; taxes', b.fringe) +
    topsRow('Contingency (' + p.globals.contingencyPct + '%)', b.contingency) +
    '<div class="list-row total"><span class="list-label">Grand total</span><span class="list-pct">100%</span><span class="list-amount">' + money(b.grandTotal) + '</span></div></div>' +
    '<p class="muted">SAG security deposit ' + money(calcBonds(p).deposit) + ' is locked cash — NOT in the total above. Total cash required: ' + money(calcBonds(p).totalCashRequired) + '. See Financing &amp; Bonds.</p></div>';
  var globals = '<div class="card"><h3>Globals — change one number, the budget reprices</h3><div class="grid4">' +
    '<label>Shoot days<input type="number" data-global="shootDays" value="' + p.globals.shootDays + '"></label>' +
    '<label>Prep weeks<input type="number" data-global="prepWeeks" value="' + p.globals.prepWeeks + '"></label>' +
    '<label>Wrap days<input type="number" data-global="wrapDays" value="' + p.globals.wrapDays + '"></label>' +
    '<label>Contingency %<input type="number" data-global="contingencyPct" value="' + p.globals.contingencyPct + '"></label>' +
    '<label>Completion bond % (planning)<input type="number" data-global="bondPct" value="' + p.globals.bondPct + '"></label>' +
    '<label>Locations<input type="number" data-global="locations" value="' + p.globals.locations + '"></label></div>' +
    '<p class="muted">Lines linked to a global use its value for Qty or X. When a schedule exists, shoot days come from the schedule (' + b.derived.shootDays + ' days) and cast days per character come from the scenes scheduled.</p></div>';
  var detail = accounts.map(function (a) {
    var t = accountTotals(a, b.derived);
    var rows = a.lines.map(function (l) {
      return '<div class="line-row">' +
        '<div class="line-top"><input data-line="' + l.id + '" data-lfield="desc" value="' + esc(l.desc) + '" aria-label="Description">' +
        '<span class="line-total">' + money(lineTotal(l, b.derived)) + '</span>' +
        '<button type="button" class="line-del" data-action="del-line" data-id="' + l.id + '" title="Delete line">×</button></div>' +
        '<div class="line-math"><input type="number" data-line="' + l.id + '" data-lfield="qty" value="' + lineQty(l, b.derived) + '"' + (l.qtyGlobal ? ' title="Linked to ' + l.qtyGlobal + '"' : '') + ' aria-label="Qty">' +
        '<span class="math-x">×</span>' +
        '<input type="number" data-line="' + l.id + '" data-lfield="x" value="' + l.x + '" aria-label="Times">' +
        '<span class="math-x">@</span>' +
        '<input type="number" data-line="' + l.id + '" data-lfield="rate" value="' + l.rate + '" aria-label="Rate">' +
        '<select data-line="' + l.id + '" data-lfield="fringeId" aria-label="Fringe">' + FRINGES.map(function (f) { return '<option value="' + f.id + '"' + (l.fringeId === f.id ? ' selected' : '') + '>' + f.name + '</option>'; }).join('') + '</select>' +
        '<select data-line="' + l.id + '" data-lfield="qtyGlobal" aria-label="Link qty to"><option value="">— link qty —</option>' +
        '<option value="shootDays"' + (l.qtyGlobal === 'shootDays' ? ' selected' : '') + '>Shoot days</option>' +
        (p.scenes || []).flatMap(function (s) { return s.characters || []; }).filter(function (v, i, a2) { return a2.indexOf(v) === i; }).map(function (c) { return '<option value="castDays:' + esc(c) + '"' + (l.qtyGlobal === 'castDays:' + c ? ' selected' : '') + '>Cast days: ' + esc(c) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="line-sub">Subtotal ' + money(lineSubtotal(l, b.derived)) + ' · Fringe ' + money(lineFringe(l, b.derived)) + '</div></div>';
    }).join('');
    return '<div class="card"><h3>' + a.code + ' — ' + esc(a.name) + '</h3>' +
      '<div class="list-group">' + rows + '</div>' +
      '<div class="account-total"><span>Account total <span class="muted">· Subtotal ' + money(t.subtotal) + ' · Fringe ' + money(t.fringe) + '</span></span><span>' + money(t.total) + '</span></div>' +
      '<div class="btnrow"><button type="button" class="small" data-action="add-line" data-id="' + a.id + '">＋ Add line</button>' +
      '<button type="button" class="small" data-action="apply-sag" data-id="' + a.id + '">Apply SAG tier to cast</button></div></div>';
  }).join('');
  return headerFields(p) + (isDept ? '' : tops) + globals + detail;
}

/* ---------------- Union Rates / Actuals / Script ---------------- */
function viewRates(p) {
  var b = calcBudget(p);
  var tier = sagTierForBudget(b.grandTotal);
  var sagRows = UNION_RATES.sag.map(function (t) {
    return '<tr><td>' + t.tier + '</td><td>' + t.budget + '</td><td class="num">' + money(t.day) + '/day</td><td class="num">' + (t.week ? money(t.week) + '/week' : '—') + '</td><td class="num">' + Math.round(t.ph * 100) + '%</td><td><button type="button" class="small" data-action="apply-sag-tier" data-day="' + t.day + '" data-week="' + (t.week || '') + '">Use this tier</button></td></tr>';
  }).join('');
  return headerFields(p) + '<div class="card"><h2>Union Rates — 2026-27 snapshot</h2>' +
    '<p class="muted">' + UNION_RATES.note + '</p>' +
    '<p>Your budget total is ' + money(b.grandTotal) + ' — that puts you in the <b>' + tier.tier + '</b> SAG tier (' + money(tier.day) + '/day).</p>' +
    '<h3>SAG-AFTRA — theatrical, Jul 1, 2026 – Jun 30, 2027</h3><table><tr><th>Tier</th><th>Budget</th><th class="num">Day</th><th class="num">Week</th><th class="num">P&amp;H</th><th></th></tr>' + sagRows + '</table>' +
    '<p class="muted">Background: ' + money(UNION_RATES.sagBackground.day) + '/day · Special ability: ' + money(UNION_RATES.sagBackground.specialAbility) + ' · Stand-in: ' + money(UNION_RATES.sagBackground.standIn) + ' · Background P&amp;H ' + Math.round(UNION_RATES.sagBackground.ph * 100) + '%. ' + UNION_RATES.sagShort.note + '</p>' +
    '<h3>DGA</h3><p class="muted">' + UNION_RATES.dga.note + ' ' + UNION_RATES.dga.fullScaleNote + ' P&amp;H ' + Math.round(UNION_RATES.dga.ph * 100) + '%.</p>' +
    '<table><tr><th>Level</th><th>Budget</th><th class="num">% of scale</th></tr>' + UNION_RATES.dga.levels.map(function (l) { return '<tr><td>' + l.level + '</td><td>' + l.budget + '</td><td class="num">' + Math.round(l.pct * 100) + '%</td></tr>'; }).join('') + '</table>' +
    '<h3>WGA — May 2, 2026 – May 1, 2027</h3><p class="muted">' + UNION_RATES.wga.note + ' Pension ' + Math.round(UNION_RATES.wga.pension * 100) + '%, Health ' + Math.round(UNION_RATES.wga.health * 100) + '%. Week-to-week ' + money(UNION_RATES.wga.weekToWeek) + '/week.</p>' +
    '<table><tr><th></th><th class="num">Low budget (&lt;$5M)</th><th class="num">High budget ($5M+)</th></tr>' +
    '<tr><td>Original screenplay, incl. treatment</td><td class="num">' + money(UNION_RATES.wga.low.originalInclTreatment) + '</td><td class="num">' + money(UNION_RATES.wga.high.originalInclTreatment) + '</td></tr>' +
    '<tr><td>Original screenplay, excl. treatment / sale</td><td class="num">' + money(UNION_RATES.wga.low.originalExclTreatment) + '</td><td class="num">' + money(UNION_RATES.wga.high.originalExclTreatment) + '</td></tr>' +
    '<tr><td>Rewrite</td><td class="num">' + money(UNION_RATES.wga.low.rewrite) + '</td><td class="num">' + money(UNION_RATES.wga.high.rewrite) + '</td></tr>' +
    '<tr><td>Polish</td><td class="num">' + money(UNION_RATES.wga.low.polish) + '</td><td class="num">' + money(UNION_RATES.wga.high.polish) + '</td></tr></table>' +
    '<h3>IATSE — planning scale</h3><p class="muted">' + UNION_RATES.iatse.note + '</p>' +
    '<table><tr><th>Role</th><th class="num">Rate</th><th>Note</th></tr>' + UNION_RATES.iatse.roles.map(function (r) { return '<tr><td>' + r.role + '</td><td class="num">' + (r.day ? money(r.day) + '/day' : money(r.hour) + '/hr') + '</td><td>' + esc(r.note) + '</td></tr>'; }).join('') + '</table></div>';
}
function viewActuals(p) {
  var a = calcActuals(p);
  var rows = a.rows.map(function (r) {
    return '<tr' + (r.left < 0 ? ' class="over"' : '') + '><td>' + r.code + ' — ' + esc(r.name) + '</td><td class="num">' + money(r.budgeted) + '</td><td class="num">' + money(r.spent) + '</td><td class="num">' + money(r.left) + '</td></tr>';
  }).join('');
  var ledger = (p.actuals || []).map(function (x, i) {
    var acc = p.accounts.find(function (ac) { return ac.id === x.accountId; });
    return '<tr><td>' + fmtDate(x.date) + '</td><td>' + (acc ? acc.code + ' — ' + esc(acc.name) : '') + '</td><td>' + esc(x.payee || '') + '</td><td>' + esc(x.note || '') + '</td><td class="num">' + money(x.amount) + '</td><td><button type="button" class="small ghost" data-action="del-actual" data-i="' + i + '">×</button></td></tr>';
  }).join('');
  return headerFields(p) + '<div class="card"><h2>Actuals &amp; Left to Spend</h2>' +
    '<div class="grid3"><div><div class="kpi-label">Budgeted</div><div class="kpi">' + money(a.grandTotal) + '</div></div>' +
    '<div><div class="kpi-label">Spent</div><div class="kpi">' + money(a.spent) + '</div></div>' +
    '<div><div class="kpi-label">Left to spend</div><div class="kpi">' + money(a.left) + '</div></div></div>' +
    '<table><tr><th>Account</th><th class="num">Budgeted</th><th class="num">Spent</th><th class="num">Left</th></tr>' + rows + '</table></div>' +
    '<div class="card"><h3>Add an expense</h3><div class="grid4">' +
    '<label>Date<input type="date" id="act-date" value="' + todayISO() + '"></label>' +
    '<label>Account<select id="act-account">' + p.accounts.map(function (ac) { return '<option value="' + ac.id + '">' + ac.code + ' — ' + esc(ac.name) + '</option>'; }).join('') + '</select></label>' +
    '<label>Payee<input id="act-payee" placeholder="Vendor / person"></label>' +
    '<label>Amount<input type="number" id="act-amount" placeholder="0"></label></div>' +
    '<label>Note<input id="act-note" placeholder="What was this for?"></label>' +
    '<div class="btnrow"><button type="button" class="small primary" data-action="add-actual">＋ Add expense</button></div>' +
    '<table><tr><th>Date</th><th>Account</th><th>Payee</th><th>Note</th><th class="num">Amount</th><th></th></tr>' + ledger + '</table></div>';
}
function viewScript(p) {
  var scenes = p.scenes || [];
  var list = scenes.map(function (s, i) {
    return '<div class="card"><h3>Scene ' + (i + 1) + ' — ' + esc(s.slug) + '</h3>' +
      '<p class="muted">' + esc(s.location || '') + (s.dayNight ? ' · ' + esc(s.dayNight) : '') + '</p>' +
      '<p>' + esc(s.description || '').slice(0, 400) + '</p>' +
      '<p>Characters: ' + (s.characters || []).map(function (c) { return '<span class="pill">' + esc(c) + '</span>'; }).join(' ') + '</p>' +
      '<p>Props detected: ' + (s.props || []).map(function (x) { return '<span class="pill">' + esc(x) + '</span>'; }).join(' ') + '</p>' +
      '<label>Coverage<textarea data-scene="' + s.id + '" data-sfield="coverage" rows="2" placeholder="Reader coverage — what works, what doesn’t…">' + esc(s.coverage || '') + '</textarea></label>' +
      '<div class="btnrow"><button type="button" class="small" data-action="send-scene-budget" data-id="' + s.id + '">Send cast / props / location to budget</button>' +
      '<button type="button" class="small" data-action="goto-scene" data-id="' + s.id + '">Open scene page →</button></div></div>';
  }).join('');
  return headerFields(p) + '<div class="card"><h2>Script &amp; Coverage</h2>' +
    '<p class="sub">Upload a script (.txt, .fountain, or .fdx) or paste it below. The app drafts a scene breakdown — sluglines, characters, locations, props — which you can fix by hand. Props are detected by keyword and are a starting point, not a guarantee: check every scene.</p>' +
    '<div class="btnrow"><input type="file" id="script-file" accept=".txt,.fountain,.fdx,.xml" class="small">' +
    '<button type="button" class="small primary" data-action="import-script-file">Import file</button></div>' +
    '<label>Or paste script text<textarea id="script-paste" rows="6" placeholder="INT. KITCHEN — NIGHT&#10;…"></textarea></label>' +
    '<div class="btnrow"><button type="button" class="small primary" data-action="import-script-paste">Parse pasted script</button>' +
    '<button type="button" class="small" data-action="clear-scenes">Clear breakdown</button></div>' +
    '<p class="muted" id="script-msg">' + scenes.length + ' scenes in the breakdown.</p></div>' + list;
}

/* ---------------- Schedule / DOOD / Call sheets ---------------- */
function viewSchedule(p) {
  var days = p.schedule.days || [];
  var dood = calcDOOD(p);
  var dayCards = days.map(function (d, i) {
    var scs = (d.sceneIds || []).map(function (sid) { var s = (p.scenes || []).find(function (x) { return x.id === sid; }); return s ? s.slug : ''; }).filter(Boolean);
    var propsToday = propsForDay(p, d);
    return '<div class="card"><h3>Day ' + (i + 1) + ' — ' + fmtDate(d.date) + '</h3>' +
      '<p class="muted">Call ' + esc(d.callTime || '—') + (d.location ? ' · ' + esc(d.location) : '') + '</p>' +
      '<p>Scenes: ' + (scs.join(', ') || '—') + '</p>' +
      '<p>Props / set pieces today: ' + (propsToday.map(function (x) { return esc(x.name); }).join(', ') || '—') + '</p>' +
      '<div class="btnrow"><button type="button" class="small" data-action="call-sheet" data-i="' + i + '">📋 Call sheet</button>' +
      '<button type="button" class="small ghost" data-action="del-day" data-i="' + i + '">Remove day</button></div></div>';
  }).join('');
  var doodHead = '<tr><th>Cast</th><th>Days</th>' + days.map(function (d, i) { return '<th>' + (i + 1) + '<br><span class="muted">' + (d.date || '').slice(5) + '</span></th>'; }).join('') + '</tr>';
  var doodRows = dood.rows.map(function (r) {
    return '<tr><td>' + esc(r.character) + '</td><td class="num">' + r.workCount + '</td>' + r.cells.map(function (c) {
      var cls = c === 'W' ? 'work' : c === 'S' ? 'start' : c === 'F' ? 'finish' : c === 'H' ? 'hold' : '';
      return '<td class="' + cls + '">' + c + '</td>';
    }).join('') + '</tr>';
  }).join('');
  return headerFields(p) + '<div class="card"><h2>Schedule — Stripboard</h2>' +
    '<p class="sub">Build shoot days from your breakdown scenes. Changing the schedule reprices the budget: shoot days, cast days per character, and location days all feed linked budget lines. S = start, W = work, F = finish, H = hold, S/F = one-day only.</p>' +
    '<div class="grid3"><label>Start date<input type="date" id="sched-start" value="' + esc(p.schedule.startDate || '') + '"></label>' +
    '<label>New day — date<input type="date" id="sched-date" value="' + todayISO() + '"></label>' +
    '<label>Call time<input id="sched-call" placeholder="e.g. 7:00 AM"></label></div>' +
    '<label>Scenes this day<select id="sched-scenes" multiple size="4">' + (p.scenes || []).map(function (s) { return '<option value="' + s.id + '">' + esc(s.slug) + '</option>'; }).join('') + '</select></label>' +
    '<div class="btnrow"><button type="button" class="small primary" data-action="add-day">＋ Add shoot day</button>' +
    '<button type="button" class="small" data-action="auto-schedule">Auto-build days from scenes (1 scene group per day, in order)</button></div>' +
    '<p class="muted">Shoot days: ' + days.length + ' · Derived globals: shoot days ' + calcBudget(p).derived.shootDays + '</p></div>' +
    dayCards +
    '<div class="card"><h3>Day Out of Days</h3><div style="overflow-x:auto"><table class="dood">' + doodHead + doodRows + '</table></div></div>' +
    '<div id="call-sheet-out"></div>';
}
function propsForDay(p, day) {
  var out = [];
  (p.props || []).forEach(function (pr) {
    if ((pr.sceneIds || []).some(function (sid) { return (day.sceneIds || []).indexOf(sid) >= 0; })) out.push(pr);
  });
  return out;
}
function callSheetHTML(p, dayIndex) {
  var d = p.schedule.days[dayIndex];
  if (!d) return '';
  var scenes = (d.sceneIds || []).map(function (sid) { return (p.scenes || []).find(function (s) { return s.id === sid; }); }).filter(Boolean);
  var cast = [];
  scenes.forEach(function (s) { (s.characters || []).forEach(function (c) { if (cast.indexOf(c) < 0) cast.push(c); }); });
  var crewRows = (p.crew || []).map(function (c) {
    return '<tr><td>' + esc(c.role || '') + '</td><td>' + esc(c.name || '') + '</td><td>' + esc(c.phone || '') + '</td><td>' + esc(c.callTime || d.callTime || '') + '</td></tr>';
  }).join('');
  var props = propsForDay(p, d);
  return '<div class="card"><div class="callhead"><h2>CALL SHEET — ' + esc(p.title) + '</h2>' +
    '<p><b>Day ' + (dayIndex + 1) + ' — ' + fmtDate(d.date) + '</b> · Call ' + esc(d.callTime || '—') + (d.location ? ' · ' + esc(d.location) : '') + '<br>' +
    esc(p.company || '') + ' · Producer ' + esc(p.producer || '') + ' · Director ' + esc(p.director || '') + '</p></div>' +
    '<h3>Scenes</h3><table><tr><th>Scene</th><th>Characters</th></tr>' + scenes.map(function (s) { return '<tr><td>' + esc(s.slug) + '</td><td>' + esc((s.characters || []).join(', ')) + '</td></tr>'; }).join('') + '</table>' +
    '<h3>Cast</h3><p>' + (cast.join(', ') || '—') + '</p>' +
    '<h3>Crew</h3><table><tr><th>Role</th><th>Name</th><th>Phone</th><th>Call</th></tr>' + (crewRows || '<tr><td colspan="4">No crew listed yet — add them on the Crew tab.</td></tr>') + '</table>' +
    '<h3>Props &amp; set pieces today</h3><p>' + (props.map(function (x) { return esc(x.name) + ' (' + esc(x.status) + ')'; }).join(', ') || '—') + '</p>' +
    '<h3>Notes</h3><p>' + esc(d.notes || '') + '</p>' +
    '<p class="muted">Weather: ________ · Nearest hospital: ________ · Production contact: ________</p>' +
    '<div class="btnrow noprint"><button type="button" class="small primary" data-action="print-call-sheet">🖨 Print / Save as PDF</button></div></div>';
}

/* ---------------- Visual Prep / Scenes / Props / Crew ---------------- */
function viewVisual(p) {
  var boards = (p.moodboards || []).map(function (b) {
    var imgs = (b.images || []).map(function (im) { return '<figure><img src="' + esc(im.src) + '" alt=""><figcaption>' + esc(im.caption || '') + '</figcaption></figure>'; }).join('');
    return '<div class="card"><h3>' + esc(b.title) + ' <span class="muted">' + esc(b.scope || '') + '</span></h3><p>' + esc(b.notes || '') + '</p>' +
      '<div class="moodgrid">' + imgs + '</div>' +
      '<div class="btnrow"><button type="button" class="small" data-action="add-mood-img" data-id="' + b.id + '">＋ Add image (URL)</button>' +
      '<button type="button" class="small ghost" data-action="del-board" data-id="' + b.id + '">Delete board</button></div></div>';
  }).join('');
  var shots = (p.scenes || []).map(function (s, i) {
    var list = (s.shots || []).map(function (sh, j) {
      return '<tr><td>' + (j + 1) + '</td><td>' + esc(sh.size || '') + '</td><td>' + esc(sh.lens || '') + '</td><td>' + esc(sh.move || '') + '</td><td>' + esc(sh.desc || '') + '</td><td>' + esc(sh.status || '') + '</td></tr>';
    }).join('');
    var look = s.look || {};
    return '<div class="card"><h3>Scene ' + (i + 1) + ' — ' + esc(s.slug) + '</h3>' +
      '<p><b>Look for the DP:</b> ' + esc(look.notes || '—') + '<br><span class="muted">Lighting: ' + esc(look.lighting || '—') + ' · Color: ' + esc(look.color || '—') + ' · Lens: ' + esc(look.lens || '—') + '</span></p>' +
      '<label>Look notes<textarea data-scene="' + s.id + '" data-sfield="look.notes" rows="2" placeholder="What should this scene look like? Reference, mood, light, color…">' + esc(look.notes || '') + '</textarea></label>' +
      '<div class="grid3"><label>Lighting<input data-scene="' + s.id + '" data-sfield="look.lighting" value="' + esc(look.lighting || '') + '"></label>' +
      '<label>Color<input data-scene="' + s.id + '" data-sfield="look.color" value="' + esc(look.color || '') + '"></label>' +
      '<label>Lens<input data-scene="' + s.id + '" data-sfield="look.lens" value="' + esc(look.lens || '') + '"></label></div>' +
      '<table><tr><th>#</th><th>Size</th><th>Lens</th><th>Movement</th><th>Description</th><th>Status</th></tr>' + list + '</table>' +
      '<div class="btnrow"><button type="button" class="small" data-action="add-shot" data-id="' + s.id + '">＋ Add shot</button></div></div>';
  }).join('');
  return headerFields(p) + '<div class="card"><h2>Visual Prep</h2><p class="sub">Mood boards, storyboard / shot lists, and per-scene look inspiration for the DP. Shots tie to the schedule and the budget — more setups means more time, which means more money.</p>' +
    '<div class="btnrow"><button type="button" class="small primary" data-action="add-board">＋ New mood board</button></div></div>' + boards + shots;
}
function viewScenes(p) {
  var isDept = currentRole === 'dept';
  var list = (p.scenes || []).map(function (s, i) {
    var depts = isDept ? [currentDept] : DEPTS;
    var sections = depts.map(function (d) {
      var key = d === 'Art' ? 'Art' : d;
      var val = (s.dept && s.dept[key]) || '';
      return '<label>' + d + '<textarea data-scene="' + s.id + '" data-sfield="dept.' + key + '" rows="2" placeholder="Needs / plan / watch-outs for ' + d + '…">' + esc(val) + '</textarea></label>';
    }).join('');
    return '<div class="card"><h3>Scene ' + (i + 1) + ' — ' + esc(s.slug) + '</h3>' +
      '<p class="muted">' + esc(s.location || '') + ' · Characters: ' + esc((s.characters || []).join(', ')) + ' · Props: ' + esc((s.props || []).join(', ')) + '</p>' +
      (isDept ? '<p class="muted">You’re seeing the ' + currentDept + ' section only.</p>' : '') + sections +
      '<label>Cross-department note<textarea data-scene="' + s.id + '" data-sfield="crossNote" rows="2" placeholder="Affects more than one department — tag it below…">' + esc(s.crossNote || '') + '</textarea></label>' +
      '<label>Tag departments<select data-scene="' + s.id + '" data-sfield="crossDepts" multiple size="3">' + DEPTS.map(function (d) { return '<option value="' + d + '"' + ((s.crossDepts || []).indexOf(d) >= 0 ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select></label>' +
      '<p class="muted">Cross-dept notes appear in every tagged department’s section.</p></div>';
  }).join('');
  return headerFields(p) + '<div class="card"><h2>Scene Pages</h2><p class="sub">One page per scene. Shared info at the top, one section per department below. Producer sees all sections; a dept head sees only theirs.</p></div>' + (list || '<div class="card"><p class="muted">No scenes yet — import a script on the Script &amp; Coverage tab.</p></div>');
}
function viewProps(p) {
  var rows = (p.props || []).map(function (pr, i) {
    return '<tr><td>' + esc(pr.name) + '</td><td>' + esc(pr.dept || '') + '</td><td>' + fmtDate(pr.firstNeeded) + '</td><td>' + fmtDate(pr.prepBy) + '</td><td>' + esc(pr.status || '') + '</td><td>' + esc((pr.sceneIds || []).length + ' scene(s)') + '</td>' +
      '<td><select data-prop="' + pr.id + '" data-pfield="status">' + ['Needed', 'Sourced', 'On set', 'Returned'].map(function (s) { return '<option' + (pr.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td>' +
      '<td><button type="button" class="small ghost" data-action="del-prop" data-i="' + i + '">×</button></td></tr>';
  }).join('');
  return headerFields(p) + '<div class="card"><h2>Props &amp; Set Pieces</h2>' +
    '<p class="sub">First-needed date, prep-by date, department, status. When a prop is needed on a shoot day, it shows on that day’s call sheet.</p>' +
    '<div class="grid3"><label>Name<input id="prop-name" placeholder="e.g. Hero revolver"></label>' +
    '<label>Department<select id="prop-dept">' + DEPTS.map(function (d) { return '<option>' + d + '</option>'; }).join('') + '</select></label>' +
    '<label>Prep by<input type="date" id="prop-prep"></label></div>' +
    '<div class="btnrow"><button type="button" class="small primary" data-action="add-prop">＋ Add prop / set piece</button>' +
    '<button type="button" class="small" data-action="props-from-scenes">Pull props from breakdown</button></div>' +
    '<table><tr><th>Name</th><th>Dept</th><th>First needed</th><th>Prep by</th><th>Status</th><th>Scenes</th><th>Set status</th><th></th></tr>' + rows + '</table></div>';
}
function viewCrew(p) {
  var rows = (p.crew || []).map(function (c, i) {
    return '<tr><td>' + esc(c.name || '') + '</td><td>' + esc(c.role || '') + '</td><td>' + esc(c.phone || '') + '</td><td>' + esc(c.email || '') + '</td><td>' + esc(c.emergency || '') + '</td><td>' + esc(c.notes || '') + '</td>' +
      '<td><button type="button" class="small ghost" data-action="del-crew" data-i="' + i + '">×</button></td></tr>';
  }).join('');
  return headerFields(p) + '<div class="card"><h2>Crew &amp; Call Sheets</h2>' +
    '<p class="sub">Crew directory fed by the intake form below. Call sheets on the Schedule tab pull names, phones and call times from here.</p>' +
    '<div class="grid3"><label>Name<input id="crew-name"></label><label>Role / department<input id="crew-role" placeholder="e.g. DP — Camera"></label><label>Phone<input id="crew-phone"></label>' +
    '<label>Email<input id="crew-email" type="email"></label><label>Emergency contact (name + phone)<input id="crew-emergency" placeholder="Name — 555-1234"></label><label>Call time<input id="crew-call" placeholder="e.g. 7:00 AM"></label></div>' +
    '<label>Allergies / medical notes<input id="crew-notes" placeholder="Anything the set needs to know"></label>' +
    '<label>Address<input id="crew-address"></label>' +
    '<div class="btnrow"><button type="button" class="small primary" data-action="add-crew">＋ Add crew member</button>' +
    '<button type="button" class="small" data-action="print-intake">🖨 Blank intake form (print / PDF)</button></div>' +
    '<p class="muted">Intake: crew fill in this same form — on your device, or on a printed copy you type in later. There is no public intake link in v1 (a public form that writes to the shared library needs a backend — see README). Never share the shared sign-in with crew; use the printed intake form or enter their details yourself.</p>' +
    '<table><tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th><th>Emergency</th><th>Notes</th><th></th></tr>' + rows + '</table></div>';
}

/* ---------------- Financing & Bonds / Settings / Preview ---------------- */
function viewFinancing(p) {
  var b = calcBonds(p), fin = calcFinancing(p);
  var srcRows = (p.financing.sources || []).map(function (s, i) {
    return '<tr><td>' + esc(s.name || '') + '</td><td>' + esc(s.kind || '') + '</td><td class="num">' + money(s.committed) + '</td><td class="num">' + money(s.received) + '</td><td>' + esc(s.status || '') + '</td><td>' + esc(s.terms || '') + '</td><td>Tier ' + (s.tier || '') + '</td>' +
      '<td><button type="button" class="small ghost" data-action="del-source" data-i="' + i + '">×</button></td></tr>';
  }).join('');
  var wf = fin.waterfall.map(function (s, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(s.name || '') + '</td><td>' + esc(s.kind || '') + '</td><td class="num">' + money(s.committed) + '</td></tr>'; }).join('');
  return headerFields(p) + '<div class="card"><h2>Financing &amp; Bonds</h2>' +
    '<h3>SAG-AFTRA security deposit — locked cash, NOT in the budget total</h3>' +
    '<p>Cast payroll ' + money(b.payroll) + ' + SAG P&amp;H ' + money(b.ph) + ' = deposit base ' + money(b.base) + '. ' +
    'Deposit at ' + p.bonds.depositPct + '% = <b>' + money(b.deposit) + '</b>. You still pay the actors from shooting cash while this sits in escrow — so you need payroll <i>and</i> the deposit at the same time.</p>' +
    '<div class="grid3"><label><input type="checkbox" data-bond="depositOn" ' + (p.bonds.depositOn ? 'checked' : '') + '> Count the deposit (locked cash)</label>' +
    '<label>Deposit % (planning default 40)<input type="number" data-bond="depositPct" value="' + p.bonds.depositPct + '"></label>' +
    '<label>Flat figure from guild letter (overrides %)<input type="number" data-bond="depositFlat" value="' + (p.bonds.depositFlat == null ? '' : p.bonds.depositFlat) + '" placeholder="leave blank to use %"></label></div>' +
    '<p class="muted">' + esc(p.bonds.depositNote || '') + ' Typically ~$2,500 for ultra-low-budget films; $30k–$60k on a $1.2M feature. Returned only after all performers are paid, P&amp;H is submitted, claims are resolved and paperwork is delivered.</p>' +
    '<div class="grid3"><div><div class="kpi-label">Budget grand total</div><div class="kpi">' + money(b.grandTotal) + '</div></div>' +
    '<div><div class="kpi-label">SAG deposit (locked)</div><div class="kpi">' + money(b.deposit) + '</div></div>' +
    '<div><div class="kpi-label">Total cash required</div><div class="kpi">' + money(b.totalCashRequired) + '</div></div></div>' +
    '<p class="muted">Completion bond (' + p.globals.bondPct + '% planning) is a cost <i>inside</i> the budget — see account 5100. It guarantees the film gets finished and delivered; lenders usually require it, and guarantors rarely take films under ~$1M–$3.5M.</p>' +
    '<h3>Financing — where the money comes from</h3>' +
    '<div class="grid4"><div><div class="kpi-label">Committed</div><div class="kpi">' + money(fin.committed) + '</div></div>' +
    '<div><div class="kpi-label">Received</div><div class="kpi">' + money(fin.received) + '</div></div>' +
    '<div><div class="kpi-label">Still to land</div><div class="kpi">' + money(fin.toLand) + '</div></div>' +
    '<div><div class="kpi-label">Gap to close</div><div class="kpi">' + money(fin.gap) + '</div></div></div>' +
    '<div class="grid4"><label>Source name<input id="fin-name" placeholder="e.g. Meridian Equity"></label>' +
    '<label>Kind<select id="fin-kind"><option>Equity</option><option>Pre-sale</option><option>Tax incentive</option><option>Gap loan</option><option>Crowdfunding</option><option>Own money</option><option>Other</option></select></label>' +
    '<label>Committed<input type="number" id="fin-committed" placeholder="0"></label>' +
    '<label>Received<input type="number" id="fin-received" placeholder="0"></label>' +
    '<label>Status<select id="fin-status"><option>Firm</option><option>Pipeline</option><option>Received</option></select></label>' +
    '<label>Recoupment tier<input type="number" id="fin-tier" value="1"></label>' +
    '<label>Deal terms<input id="fin-terms" placeholder="e.g. 120% recoup, 50/50 after"></label></div>' +
    '<div class="btnrow"><button type="button" class="small primary" data-action="add-source">＋ Add source</button></div>' +
    '<table><tr><th>Source</th><th>Kind</th><th class="num">Committed</th><th class="num">Received</th><th>Status</th><th>Terms</th><th>Tier</th><th></th></tr>' + srcRows + '</table>' +
    '<h3>Recoupment waterfall — who gets paid back first</h3>' +
    '<table><tr><th>#</th><th>Source</th><th>Kind</th><th class="num">Committed</th></tr>' + wf + '</table></div>';
}
function viewSettings(p) {
  return headerFields(p) + '<div class="card"><h2>Settings &amp; Export</h2>' +
    '<p class="sub">Exports are honest about what they are: the MMB XML is modeled on Movie Magic Budgeting’s published XML (Advanced) export structure — it is NOT a native .mmb / .mmbx file, which is a closed proprietary format with no public spec. The CSV / TSV carry the same detail lines and can be opened in any spreadsheet.</p>' +
    '<div class="btnrow">' +
    '<button type="button" class="small primary" data-action="export-mmb-xml">⬇ MMB-style XML</button>' +
    '<button type="button" class="small" data-action="export-csv">⬇ CSV</button>' +
    '<button type="button" class="small" data-action="export-tsv">⬇ Tab-delimited</button>' +
    '<button type="button" class="small" data-action="export-json">⬇ Full backup (JSON)</button>' +
    '<button type="button" class="small" data-action="preview-pdf">👁 Preview / PDF</button></div>' +
    '<h3>Sharing</h3><p class="muted">Producer (you and Amelia) — full access to every project. Dept heads — in-app role filter on the project header, plus per-dept exports from their tabs. Do not share the shared sign-in with dept heads; send them their filtered export/printout instead. True separate dept-head accounts need a backend and are a v2 item.</p>' +
    '<h3>Locations</h3><div class="btnrow"><input id="loc-name" placeholder="Location name"><input id="loc-incentive" type="number" placeholder="Incentive %"><button type="button" class="small" data-action="add-location">＋ Add location</button></div>' +
    '<p>' + (p.locations || []).map(function (l) { return '<span class="pill">' + esc(l.name) + (l.incentive ? ' — ' + l.incentive + '% incentive' : '') + '</span>'; }).join(' ') + '</p>' +
    '<h3>Danger zone</h3><div class="btnrow"><button type="button" class="small ghost" data-action="reset-project">Reset this project to a blank template</button></div></div>';
}
function previewHTML(p) {
  var b = calcBudget(p), bonds = calcBonds(p);
  var rows = b.accounts.map(function (a) {
    return '<tr><td>' + a.code + '</td><td>' + esc(a.name) + '</td><td class="num">' + money(a.subtotal) + '</td><td class="num">' + money(a.fringe) + '</td><td class="num">' + money(a.total) + '</td><td class="num">' + (b.grandTotal ? (100 * a.total / b.grandTotal).toFixed(1) + '%' : '—') + '</td></tr>';
  }).join('');
  var detail = p.accounts.map(function (a) {
    var t = accountTotals(a, b.derived);
    var lines = a.lines.map(function (l) { return '<tr><td>' + esc(l.desc) + '</td><td class="num">' + lineQty(l, b.derived) + '</td><td class="num">' + l.x + '</td><td class="num">' + money(l.rate) + '</td><td class="num">' + money(lineSubtotal(l, b.derived)) + '</td><td class="num">' + money(lineFringe(l, b.derived)) + '</td><td class="num">' + money(lineTotal(l, b.derived)) + '</td></tr>'; }).join('');
    return '<h3>' + a.code + ' — ' + esc(a.name) + ' — ' + money(t.total) + '</h3><table><tr><th>Description</th><th class="num">Qty</th><th class="num">×</th><th class="num">Rate</th><th class="num">Subtotal</th><th class="num">Fringe</th><th class="num">Total</th></tr>' + lines + '</table>';
  }).join('');
  return '<div style="font-family:Georgia,serif"><h1 style="margin:0">' + esc(p.title) + '</h1>' +
    '<p>' + esc(p.company || '') + '<br>Producer: ' + esc(p.producer || '') + ' · Director: ' + esc(p.director || '') + ' · Writer: ' + esc(p.writer || '') + '<br>Prepared by ' + esc(p.preparedBy || '') + ' · Budget date ' + fmtDate(p.budgetDate) + ' · Version ' + esc(p.version) + ' · Currency ' + esc(p.currency) + '<br>Shoot days ' + b.derived.shootDays + ' · Locations ' + (p.globals.locations || 1) + '</p>' +
    '<h2>TOPSHEET</h2><table><tr><th>Account</th><th></th><th class="num">Subtotal</th><th class="num">Fringe</th><th class="num">Total</th><th class="num">%</th></tr>' + rows +
    '<tr class="total"><td></td><td>Subtotal</td><td class="num">' + money(b.subtotal) + '</td><td class="num">' + money(b.fringe) + '</td><td class="num">' + money(b.preContingency) + '</td><td></td></tr>' +
    '<tr><td></td><td>Contingency (' + p.globals.contingencyPct + '%)</td><td class="num"></td><td class="num"></td><td class="num">' + money(b.contingency) + '</td><td></td></tr>' +
    '<tr class="total"><td></td><td>GRAND TOTAL</td><td class="num"></td><td class="num"></td><td class="num">' + money(b.grandTotal) + '</td><td class="num">100%</td></tr></table>' +
    '<p><b>Locked cash — not in the total above:</b> SAG security deposit ' + money(bonds.deposit) + ' (cast payroll ' + money(bonds.payroll) + ' + P&amp;H ' + money(bonds.ph) + '). Total cash required: ' + money(bonds.totalCashRequired) + '.</p>' +
    '<h2>DETAIL</h2>' + detail +
    '<h2>SCHEDULE &amp; ASSUMPTIONS</h2><p>Shoot days: ' + b.derived.shootDays + '. Contingency ' + p.globals.contingencyPct + '%. Completion bond planning ' + p.globals.bondPct + '%. Union rates are a 2026-27 snapshot — verify the current rate sheet before signing. Fringes are planning figures unless a guild letter says otherwise.</p>' +
    '<p style="font-size:12px;color:#666">Filmmaker Dashboard — ' + esc(p.title) + ' · ' + esc(p.version) + ' · ' + fmtDate(p.budgetDate) + '</p></div>';
}
function doPreview() {
  var p = currentProject(); if (!p) return;
  $('print-view').innerHTML = previewHTML(p);
  window.print();
}

/* ---------------- events + init ---------------- */
function findLine(id) {
  var p = currentProject(); if (!p) return null;
  for (var i = 0; i < p.accounts.length; i++) { var l = p.accounts[i].lines.find(function (x) { return x.id === id; }); if (l) return l; }
  return null;
}
function applySagTier(day) {
  var p = currentProject(); if (!p) return;
  var cast = p.accounts.find(function (a) { return a.code === '1400'; });
  if (cast) cast.lines.forEach(function (l) { l.rate = num(day, l.rate); l.fringeId = 'sag-principal'; });
  save(); renderAll();
}
function sendSceneToBudget(scene) {
  var p = currentProject(); if (!p) return;
  var b = calcBudget(p);
  var tier = sagTierForBudget(b.grandTotal);
  var castAcc = p.accounts.find(function (a) { return a.code === '1400'; });
  (scene.characters || []).forEach(function (c) {
    if (castAcc.lines.some(function (l) { return l.desc.indexOf(c) >= 0; })) return;
    castAcc.lines.push(newLine(c + ' — ' + scene.slug, 1, 1, tier.day, 'sag-principal', 'castDays:' + c));
  });
  var propsAcc = p.accounts.find(function (a) { return a.code === '2300'; });
  (scene.props || []).forEach(function (pr) {
    if (!propsAcc.lines.some(function (l) { return l.desc === pr; })) propsAcc.lines.push(newLine(pr + ' — ' + scene.slug, 1, 1, 0, 'none'));
  });
  var locAcc = p.accounts.find(function (a) { return a.code === '3100'; });
  if (scene.location && !locAcc.lines.some(function (l) { return l.desc.indexOf(scene.location) >= 0; })) locAcc.lines.push(newLine(scene.location + ' — location', 1, 1, 0, 'none'));
  save(); renderAll();
}
function handleAction(act, el) {
  var p = currentProject();
  var id = el.getAttribute('data-id');
  if (act === 'tab' || act === 'goto') { setTab(el.getAttribute('data-tab')); return; }
  if (act === 'back-home') { currentProjectId = null; renderAll(); return; }
  if (act === 'new-project') {
    var np = blankProject(el.getAttribute('data-template') || 'feature');
    if (np.template === 'feature') applyFeatureTemplate(np);
    np.title = 'Untitled ' + (DB.projects.length + 1);
    DB.projects.push(np); currentProjectId = np.id; save(); renderAll(); return;
  }
  if (act === 'open-project') { currentProjectId = id; setTab('dashboard'); return; }
  if (act === 'dup-project') { var src = DB.projects.find(function (x) { return x.id === id; }); if (src) { var cp = clone(src); cp.id = uid(); cp.title = src.title + ' (copy)'; DB.projects.push(cp); save(); renderAll(); } return; }
  if (act === 'del-project') { if (confirm('Delete this project? This cannot be undone.')) { DB.projects = DB.projects.filter(function (x) { return x.id !== id; }); if (currentProjectId === id) currentProjectId = null; save(); renderAll(); } return; }
  if (!p) return;
  if (act === 'add-line') { var acc = p.accounts.find(function (a) { return a.id === id; }); if (acc) { acc.lines.push(newLine('New line', 1, 1, 0, 'none')); save(); renderAll(); } return; }
  if (act === 'del-line') { p.accounts.forEach(function (a) { a.lines = a.lines.filter(function (l) { return l.id !== id; }); }); save(); renderAll(); return; }
  if (act === 'apply-sag') { var b0 = calcBudget(p); applySagTier(sagTierForBudget(b0.grandTotal).day); return; }
  if (act === 'apply-sag-tier') { applySagTier(el.getAttribute('data-day')); return; }
  if (act === 'add-actual') {
    var amt = num($('act-amount').value, 0);
    p.actuals.push({ date: $('act-date').value || todayISO(), accountId: $('act-account').value, payee: $('act-payee').value, amount: amt, note: $('act-note').value });
    save(); renderAll(); return;
  }
  if (act === 'del-actual') { p.actuals.splice(num(el.getAttribute('data-i'), 0), 1); save(); renderAll(); return; }
  if (act === 'import-script-paste') {
    var txt = $('script-paste').value;
    var sc = parseScriptText(txt);
    p.scenes = sc; save(); renderAll(); return;
  }
  if (act === 'import-script-file') {
    var f = $('script-file').files && $('script-file').files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var text = String(r.result || '');
      p.scenes = /\.fdx$/i.test(f.name) ? parseFDX(text) : parseScriptText(text);
      save(); renderAll();
    };
    r.readAsText(f); return;
  }
  if (act === 'clear-scenes') { if (confirm('Clear the breakdown? Scenes, shots and look notes go with it.')) { p.scenes = []; save(); renderAll(); } return; }
  if (act === 'send-scene-budget') { var sc1 = p.scenes.find(function (s) { return s.id === id; }); if (sc1) sendSceneToBudget(sc1); return; }
  if (act === 'goto-scene') { currentTab = 'scenes'; renderAll(); var el2 = document.querySelector('[data-scene="' + id + '"]'); if (el2) el2.scrollIntoView(); return; }
  if (act === 'add-day') {
    var sel = $('sched-scenes');
    var chosen = sel ? Array.from(sel.selectedOptions).map(function (o) { return o.value; }) : [];
    p.schedule.days.push({ id: uid(), date: $('sched-date').value || todayISO(), callTime: $('sched-call').value || '', location: '', sceneIds: chosen, notes: '' });
    save(); renderAll(); return;
  }
  if (act === 'auto-schedule') {
    p.schedule.days = (p.scenes || []).map(function (s, i) {
      var d = new Date((p.schedule.startDate || todayISO()) + 'T12:00:00'); d.setDate(d.getDate() + i);
      return { id: uid(), date: d.toISOString().slice(0, 10), callTime: '7:00 AM', location: s.location || '', sceneIds: [s.id], notes: '' };
    });
    save(); renderAll(); return;
  }
  if (act === 'del-day') { p.schedule.days.splice(num(el.getAttribute('data-i'), 0), 1); save(); renderAll(); return; }
  if (act === 'call-sheet') {
    var idx = num(el.getAttribute('data-i'), 0);
    var out = $('call-sheet-out'); if (out) { out.innerHTML = callSheetHTML(p, idx); out.scrollIntoView(); }
    return;
  }
  if (act === 'print-call-sheet') { var pv = $('print-view'); var cs = document.querySelector('#call-sheet-out .card'); if (pv && cs) { pv.innerHTML = cs.innerHTML; window.print(); } return; }
  if (act === 'add-board') { p.moodboards.push({ id: uid(), title: 'Mood board ' + ((p.moodboards || []).length + 1), scope: '', images: [], notes: '' }); save(); renderAll(); return; }
  if (act === 'del-board') { p.moodboards = (p.moodboards || []).filter(function (b) { return b.id !== id; }); save(); renderAll(); return; }
  if (act === 'add-mood-img') {
    var url = prompt('Image URL (paste a link to a reference still):');
    if (!url) return;
    var bd = (p.moodboards || []).find(function (b) { return b.id === id; });
    if (bd) { bd.images.push({ src: url, caption: '' }); save(); renderAll(); }
    return;
  }
  if (act === 'add-shot') { var sc2 = p.scenes.find(function (s) { return s.id === id; }); if (sc2) { sc2.shots.push({ size: 'Wide', lens: '', move: 'Static', desc: '', status: 'Planned' }); save(); renderAll(); } return; }
  if (act === 'add-prop') {
    var nm = $('prop-name').value.trim(); if (!nm) return;
    p.props.push({ id: uid(), name: nm, dept: $('prop-dept').value, firstNeeded: '', prepBy: $('prop-prep').value || '', status: 'Needed', sceneIds: [] });
    save(); renderAll(); return;
  }
  if (act === 'props-from-scenes') {
    (p.scenes || []).forEach(function (s) {
      (s.props || []).forEach(function (pr) {
        if (!p.props.some(function (x) { return x.name === pr; })) p.props.push({ id: uid(), name: pr, dept: 'Props', firstNeeded: '', prepBy: '', status: 'Needed', sceneIds: [s.id] });
        else { var ex = p.props.find(function (x) { return x.name === pr; }); if (ex.sceneIds.indexOf(s.id) < 0) ex.sceneIds.push(s.id); }
      });
    });
    save(); renderAll(); return;
  }
  if (act === 'del-prop') { p.props.splice(num(el.getAttribute('data-i'), 0), 1); save(); renderAll(); return; }
  if (act === 'add-crew') {
    var cn = $('crew-name').value.trim(); if (!cn) return;
    p.crew.push({ name: cn, role: $('crew-role').value, phone: $('crew-phone').value, email: $('crew-email').value, emergency: $('crew-emergency').value, callTime: $('crew-call').value, notes: $('crew-notes').value, address: $('crew-address').value });
    save(); renderAll(); return;
  }
  if (act === 'del-crew') { p.crew.splice(num(el.getAttribute('data-i'), 0), 1); save(); renderAll(); return; }
  if (act === 'print-intake') {
    var pv2 = $('print-view');
    if (pv2) { pv2.innerHTML = '<h1>Crew Intake — ' + esc(p.title) + '</h1><p>Name: ________________ Role: ________________<br>Phone: ________________ Email: ________________<br>Emergency contact (name + phone): ________________<br>Allergies / medical notes: ________________<br>Address: ________________</p>'; window.print(); }
    return;
  }
  if (act === 'add-source') {
    p.financing.sources.push({ name: $('fin-name').value, kind: $('fin-kind').value, committed: num($('fin-committed').value, 0), received: num($('fin-received').value, 0), status: $('fin-status').value, tier: num($('fin-tier').value, 1), terms: $('fin-terms').value });
    save(); renderAll(); return;
  }
  if (act === 'del-source') { p.financing.sources.splice(num(el.getAttribute('data-i'), 0), 1); save(); renderAll(); return; }
  if (act === 'add-location') {
    var ln = $('loc-name').value.trim(); if (!ln) return;
    p.locations.push({ name: ln, incentive: num($('loc-incentive').value, 0) }); save(); renderAll(); return;
  }
  if (act === 'export-mmb-xml') { download((p.title || 'budget').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-mmb.xml', buildMMBXML(p), 'application/xml'); return; }
  if (act === 'export-csv') { download((p.title || 'budget').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.csv', buildCSV(p), 'text/csv'); return; }
  if (act === 'export-tsv') { download((p.title || 'budget').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.txt', buildTSV(p), 'text/plain'); return; }
  if (act === 'export-json') { download('filmmaker-dashboard-backup.json', JSON.stringify(DB, null, 2), 'application/json'); return; }
  if (act === 'import-json') { var fi = $('import-file'); if (fi) fi.click(); return; }
  if (act === 'preview-pdf') { doPreview(); return; }
  if (act === 'reset-project') { if (confirm('Reset this project to a blank Feature template? Budget, schedule, scenes and crew are all cleared.')) { var idx2 = DB.projects.findIndex(function (x) { return x.id === p.id; }); var fresh = blankProject('feature'); fresh.id = p.id; fresh.title = p.title; applyFeatureTemplate(fresh); DB.projects[idx2] = fresh; save(); renderAll(); } return; }
}
function handleFieldChange(el) {
  var p = currentProject();
  var field = el.getAttribute('data-field');
  if (field === '__role') {
    var v = el.value;
    if (v === 'producer') { currentRole = 'producer'; } else { currentRole = 'dept'; currentDept = v.replace('dept:', ''); }
    renderAll(); return;
  }
  if (field && p) { p[field] = el.value; save(); return; }
  var g = el.getAttribute('data-global');
  if (g && p) { p.globals[g] = num(el.value, 0); save(); renderAll(); return; }
  var lineId = el.getAttribute('data-line');
  if (lineId) {
    var l = findLine(lineId); if (!l) return;
    var lf = el.getAttribute('data-lfield');
    if (lf === 'qty' || lf === 'x' || lf === 'rate') l[lf] = num(el.value, 0);
    else l[lf] = el.value;
    save();
    /* Totals change — re-render only if the link/field is structural. */
    if (lf === 'qtyGlobal' || lf === 'fringeId') renderAll();
    else { var note = $('saved-note'); if (note) note.textContent = 'Saved on this device'; }
    return;
  }
  var bond = el.getAttribute('data-bond');
  if (bond && p) {
    if (el.type === 'checkbox') p.bonds[bond] = el.checked;
    else if (bond === 'depositFlat') p.bonds[bond] = el.value === '' ? null : num(el.value, 0);
    else p.bonds[bond] = num(el.value, 0);
    save(); renderAll(); return;
  }
  var sceneId = el.getAttribute('data-scene');
  if (sceneId && p) {
    var sc = p.scenes.find(function (s) { return s.id === sceneId; }); if (!sc) return;
    var sf = el.getAttribute('data-sfield');
    if (sf === 'coverage') sc.coverage = el.value;
    else if (sf === 'crossNote') sc.crossNote = el.value;
    else if (sf === 'crossDepts') sc.crossDepts = Array.from(el.selectedOptions).map(function (o) { return o.value; });
    else if (sf && sf.indexOf('dept.') === 0) sc.dept[sf.slice(5)] = el.value;
    else if (sf && sf.indexOf('look.') === 0) sc.look[sf.slice(5)] = el.value;
    save(); return;
  }
  var propId = el.getAttribute('data-prop');
  if (propId && p) {
    var pr = p.props.find(function (x) { return x.id === propId; }); if (!pr) return;
    pr[el.getAttribute('data-pfield')] = el.value; save(); return;
  }
}
function handleAuthClick(id) {
  var emailEl = $('cloud-email'), pwEl = $('cloud-password');
  var msgEl = $('cloud-auth-msg');
  if (id === 'btn-cloud-signin' || id === 'btn-cloud-signup') {
    var email = (emailEl && emailEl.value || '').trim(), pw = pwEl && pwEl.value || '';
    if (!email || pw.length < 6) { if (msgEl) msgEl.textContent = 'Enter an email and a password of at least 6 characters.'; return; }
    if (msgEl) msgEl.textContent = id === 'btn-cloud-signup' ? 'Creating your account…' : 'Signing in…';
    var req = id === 'btn-cloud-signup' ? authSignUp(email, pw) : authSignIn(email, pw);
    req.then(function (data) {
      var sess = sessionFromAuth(data);
      if (!sess) { if (msgEl) msgEl.textContent = 'Signed up — check your email for the confirmation link, tap it, then sign in.'; return; }
      saveCloudSession(sess); libraryOwner = 'shared'; persistLocal();
      if (switchToShared(sess)) { initCloud().then(function () { renderAll(); }); } else { renderAll(); }
    }).catch(function (err) {
      if (msgEl) msgEl.textContent = (err && /email not confirmed/i.test(err.message || '')) ? 'That email isn’t confirmed yet — check your inbox for the confirmation link, tap it, then try signing in again.' : 'Couldn’t sign in. Your work is still saved on this device.';
    });
    return;
  }
  if (id === 'btn-cloud-signout') {
    /* Flush the shared library to the cloud first, then CLEAR it from
       this device — the next signer never inherits the on-screen copy. */
    if (cloudSession) { try { sbFetch('/auth/v1/logout', { method: 'POST', body: '{}' }).catch(function () {}); } catch (e) {} }
    if (cloudUser && !isEmptyDB(DB)) stashLibrary(cloudUser.id, DB);
    saveCloudSession(null); libraryOwner = '';
    DB = seedDB(); currentProjectId = null; pendingCloud = null; pendingClaim = null;
    lsDel(LS_KEY); lsSet(LS_OWNER_KEY, JSON.stringify({ userId: '' }));
    setCloudStatus('off'); renderAll(); return;
  }
  if (id === 'btn-cloud-sync') { if (cloudUser) { recheckCloud().then(function () { renderAll(); }); } return; }
  if (id === 'btn-cloud-keep-local') { pendingCloud = null; setCloudStatus('local'); pushCloud().then(function () { renderAll(); }); return; }
  if (id === 'btn-cloud-use-cloud') { if (pendingCloud && pendingCloud.db) { DB = pendingCloud.db; persistLocal(); } pendingCloud = null; setCloudStatus('synced'); renderAll(); return; }
  if (id === 'btn-cloud-claim-yes') { if (pendingClaim) { DB = pendingClaim.db; persistLocal(); pendingClaim = null; setCloudStatus('local'); pushCloud().then(function () { renderAll(); }); } return; }
  if (id === 'btn-cloud-claim-no') { pendingClaim = null; setCloudStatus('local'); initialSync().then(function () { renderAll(); }); return; }
}
function init() {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (el) { handleAction(el.getAttribute('data-action'), el); return; }
    var auth = e.target.closest('#btn-cloud-signin, #btn-cloud-signup, #btn-cloud-signout, #btn-cloud-sync, #btn-cloud-keep-local, #btn-cloud-use-cloud, #btn-cloud-claim-yes, #btn-cloud-claim-no');
    if (auth) handleAuthClick(auth.id);
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'import-file' && el.files && el.files[0]) {
      var r = new FileReader();
      r.onload = function () { try { var d = JSON.parse(String(r.result)); if (d && Array.isArray(d.projects)) { DB = d; persistLocal(); renderAll(); } } catch (err) {} };
      r.readAsText(el.files[0]); return;
    }
    if (el.id === 'sched-start' && currentProject()) { currentProject().schedule.startDate = el.value; save(); return; }
    if (el.matches('[data-field], [data-global], [data-line], [data-bond], [data-scene], [data-prop]')) handleFieldChange(el);
  });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.matches('[data-field], [data-scene]')) handleFieldChange(el);
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) recheckCloud(); });
  window.addEventListener('focus', function () { recheckCloud(); });
  window.addEventListener('pagehide', function () { flushCloudPushOnClose(); });
  renderAll();
  initCloud();
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports.previewHTML = previewHTML;
  module.exports.callSheetHTML = callSheetHTML;
}
