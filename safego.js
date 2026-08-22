const NAV_ITEMS = [
  {key:'overview', label:'Overview', icon:'<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="7" height="7.5" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="10.5" width="7" height="10" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/></svg>'},
  {key:'risk', label:'Risk factors', icon:'<svg viewBox="0 0 24 24" fill="none"><path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'},
  {key:'alerts', label:'Alerts', icon:'<svg viewBox="0 0 24 24" fill="none"><path d="M4 10v4a1 1 0 001 1h2l4 4V5L7 9H5a1 1 0 00-1 1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M15.5 8.5a5 5 0 010 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'},
  {key:'conditions', label:'Conditions', icon:'<svg viewBox="0 0 24 24" fill="none"><circle cx="6" cy="6" r="2.2" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="18" r="2.2" stroke="currentColor" stroke-width="1.6"/><path d="M7.8 7.5c2 1 3 2.7 3 4.5s1 3.5 3 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="2.4 2.4"/></svg>'},
  {key:'reports', label:'Reports', icon:'<svg viewBox="0 0 24 24" fill="none"><path d="M6 3.5h9l3 3V20a.8.8 0 01-.8.8H6a.8.8 0 01-.8-.8V4.3a.8.8 0 01.8-.8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 12h7M8.5 15.5h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'},
];

const ICONS = {
  weather: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 16a4.5 4.5 0 010-9 5.5 5.5 0 0110.6 1.7A3.8 3.8 0 0117 16H7Z" stroke="currentColor" stroke-width="1.6"/><path d="M8 19v1M12 19v1.6M16 19v1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  school: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 10.5 12 5l8 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v8h12v-8" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  flood: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 18c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M3 13c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-5.1-7-10.7A7 7 0 0112 3a7 7 0 017 7.3C19 15.9 12 21 12 21Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="10.3" r="2.4" stroke="currentColor" stroke-width="1.6"/></svg>',
  reports: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-5.1-7-10.7A7 7 0 0112 3a7 7 0 017 7.3C19 15.9 12 21 12 21Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
};

const reportIcon = {
  Flooding: ICONS.flood,
  'Road Hazard': ICONS.alert,
  'Transport Disruption': '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="8" width="17" height="9" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="19" r="1.4" stroke="currentColor" stroke-width="1.4"/><circle cx="16" cy="19" r="1.4" stroke="currentColor" stroke-width="1.4"/><path d="M3.5 12h17" stroke="currentColor" stroke-width="1.6"/></svg>',
};

const srcClass = {gov:'src-gov', school:'src-school', weather:'src-weather', community:'src-community'};
const stripClass = {gov:'strip-gov', school:'strip-school', weather:'strip-weather', community:'strip-community'};
const RISK_COLOR = { low:'#166534', mod:'#a16207', high:'#c2410c', crit:'#b91c1c' };

const LOCATIONS = [
  {
    id: 'espana',
    name: 'España Blvd., Sampaloc',
    city: 'Manila',
    aliases: ['espana', 'españa', 'sampaloc', 'morayta', 'mapua intramuros commute'],
    updated: '6:42 AM',
    risk: {
      key: 'mod',
      name: 'MODERATE RISK',
      pct: 58,
      rank: 'Level 2 of 4',
      summary: 'Moderate rainfall and localized street flooding. Travel is possible, but expect delays. Allow extra time and monitor advisories before leaving.',
      status: 'Passable, delays likely',
    },
    stats: [
      {label:'Weather', value:'Heavy rain, 25°C', sub:'Signal No. 1 · Gusts to 45 km/h', icon:'weather', tone:'icon-weather'},
      {label:'School status', value:'Classes ongoing', sub:'Mapúa · face-to-face, 6:00 AM', icon:'school', tone:'icon-ok'},
      {label:'Road condition', value:'Partial flooding', sub:'Ankle-deep at 2 spots', icon:'flood', tone:'icon-mod'},
      {label:'Latest advisory', value:'PAGASA rainfall advisory', sub:'Issued 6:15 AM · Metro Manila', icon:'alert', tone:'icon-alert'},
    ],
    factors: [
      {name:'Weather', pill:'mod', pillText:'Moderate', desc:'Heavy rain since 4:30 AM, 25°C, gusts up to 45 km/h. PAGASA rainfall advisory in effect.', meter:'meter-58', icon:'weather', tone:'icon-weather'},
      {name:'Flood / roads', pill:'mod', pillText:'Moderate', desc:'Ankle-deep flooding at 2 points along España Blvd. Vehicles passable at reduced speed.', meter:'meter-52', icon:'flood', tone:'icon-mod'},
      {name:'Official advisories', pill:'high', pillText:'Elevated', desc:'1 PAGASA rainfall advisory and 1 city flood bulletin for España / Sampaloc, issued in the last 2 hours.', meter:'meter-70', icon:'alert', tone:'icon-alert'},
      {name:'School status', pill:'low', pillText:'Normal', desc:'Mapúa University has not announced a class suspension as of the latest update.', meter:'meter-20', icon:'school', tone:'icon-ok'},
      {name:'Community reports', pill:'mod', pillText:'3 recent', desc:'3 flood reports and 1 stalled vehicle in the past hour, pending verification.', meter:'meter-40', icon:'reports', tone:'icon-neutral'},
    ],
    advisories: [
      {src:'gov', label:'Government', title:'PAGASA rainfall advisory: Metro Manila', desc:'Moderate to heavy rainfall expected over Metro Manila within the next 3 hours.', time:'6:15 AM'},
      {src:'school', label:'School', title:'Mapúa University: classes proceed as scheduled', desc:'No suspension announced. Monitor road conditions and allot extra travel time.', time:'6:00 AM'},
      {src:'weather', label:'Weather', title:'Localized flood watch: España / Sampaloc', desc:'Street-level flooding possible in low-lying sections due to sustained rainfall.', time:'5:50 AM'},
      {src:'community', label:'Community', title:'Slow traffic along Quezon Blvd.', desc:'Aggregated from 4 reports in the last hour. Pending official verification.', time:'5:40 AM'},
    ],
    reports: [
      {type:'Flooding', title:'Ankle-deep flooding', meta:'España Blvd. corner Morayta · 6:20 AM', status:'pending', statusLabel:'Pending'},
      {type:'Road Hazard', title:'Open manhole reported', meta:'Lerma St. · 5:55 AM', status:'verified', statusLabel:'Verified'},
      {type:'Transport Disruption', title:'Jeepney route rerouted', meta:'Quezon Blvd. · 5:40 AM', status:'unverified', statusLabel:'Unverified'},
    ],
    points: [
      {kind:'start', label:'North of area', name:'Lacson / España', sub:'Dry at this end of the corridor'},
      {kind:'mid', label:'Watched', name:'España Blvd. (Sampaloc)', sub:'Ankle-deep flooding at 2 points · reduced speed'},
      {kind:'mid', label:'Watched', name:'Quezon Blvd. underpass', sub:'Passable, water rising slowly'},
      {kind:'end', label:'South of area', name:'Toward Quiapo', sub:'Low visibility reported near the underpass'},
    ],
    floods: [
      {title:'España Blvd. near Morayta', meta:'Ankle-deep (~10cm) · vehicles passable', tone:''},
      {title:'Quezon Blvd. underpass', meta:'Shin-level, rising slowly · monitored by MMDA', tone:'icon-brand'},
    ],
    hazards: [
      {title:'Stalled jeepney, España Blvd.', meta:'Reported 6:20 AM · Pending'},
      {title:'Open manhole, Lerma St.', meta:'Reported 5:55 AM · Verified'},
      {title:'Low visibility, Quiapo underpass', meta:'Reported 6:05 AM · Unverified'},
    ],
  },
  {
    id: 'intramuros',
    name: 'Mapúa University, Intramuros',
    city: 'Manila',
    aliases: ['mapua', 'mapúa', 'intramuros', 'campus'],
    updated: '6:40 AM',
    risk: {
      key: 'low',
      name: 'LOW RISK',
      pct: 22,
      rank: 'Level 1 of 4',
      summary: 'Campus grounds are dry. Nearby corridors toward España still have localized flooding, but access to Intramuros is currently clear.',
      status: 'Passable',
    },
    stats: [
      {label:'Weather', value:'Rain, 25°C', sub:'Lighter than inland Sampaloc', icon:'weather', tone:'icon-weather'},
      {label:'School status', value:'Classes ongoing', sub:'No suspension as of 6:00 AM', icon:'school', tone:'icon-ok'},
      {label:'Road condition', value:'Campus access clear', sub:'No flooding on campus roads', icon:'flood', tone:'icon-ok'},
      {label:'Latest advisory', value:'Classes proceed', sub:'Mapúa admin · 6:00 AM', icon:'alert', tone:'icon-ok'},
    ],
    factors: [
      {name:'Weather', pill:'low', pillText:'Low', desc:'Rain continuing but lighter over Intramuros than over España / Sampaloc.', meter:'meter-20', icon:'weather', tone:'icon-weather'},
      {name:'Flood / roads', pill:'low', pillText:'Low', desc:'Campus grounds dry. No access issues reported at the gates.', meter:'meter-20', icon:'flood', tone:'icon-ok'},
      {name:'Official advisories', pill:'low', pillText:'Normal', desc:'School notice: face-to-face classes proceed. City flood bulletins apply to inland Manila, not campus grounds.', meter:'meter-20', icon:'alert', tone:'icon-ok'},
      {name:'School status', pill:'low', pillText:'Normal', desc:'No schedule change from Mapúa University administration.', meter:'meter-20', icon:'school', tone:'icon-ok'},
      {name:'Community reports', pill:'low', pillText:'Quiet', desc:'No new campus hazard reports in the last hour.', meter:'meter-20', icon:'reports', tone:'icon-neutral'},
    ],
    advisories: [
      {src:'school', label:'School', title:'Mapúa University: classes proceed as scheduled', desc:'Campus is open. Students coming from España should still check road conditions.', time:'6:00 AM'},
      {src:'gov', label:'Government', title:'PAGASA rainfall advisory: Metro Manila', desc:'Metro-wide rainfall advisory remains in effect.', time:'6:15 AM'},
      {src:'weather', label:'Weather', title:'Intramuros: no flood watch', desc:'No street-level flooding reported on campus or immediately outside the walls.', time:'5:55 AM'},
    ],
    reports: [
      {type:'Road Hazard', title:'Wet tiles at Main Building steps', meta:'Intramuros campus · 6:10 AM', status:'verified', statusLabel:'Verified'},
    ],
    points: [
      {kind:'start', label:'Approach', name:'Muralla St.', sub:'Passable, light rain'},
      {kind:'end', label:'Campus', name:'Mapúa University gates', sub:'Dry grounds, normal access'},
    ],
    floods: [
      {title:'No active flood points on campus', meta:'Last checked 6:38 AM', tone:'icon-brand'},
    ],
    hazards: [
      {title:'Wet tiles at Main Building steps', meta:'Reported 6:10 AM · Verified'},
    ],
  },
  {
    id: 'quiapo',
    name: 'Quiapo underpass',
    city: 'Manila',
    aliases: ['quiapo', 'underpass', 'quezon bridge'],
    updated: '6:35 AM',
    risk: {
      key: 'high',
      name: 'HIGH RISK',
      pct: 76,
      rank: 'Level 3 of 4',
      summary: 'Shin-level water at the underpass and low visibility. Vehicles may stall. Foot traffic should avoid this segment if possible.',
      status: 'Hazardous, delays',
    },
    stats: [
      {label:'Weather', value:'Heavy rain, 25°C', sub:'Low visibility in the underpass', icon:'weather', tone:'icon-weather'},
      {label:'School status', value:'Classes ongoing', sub:'Does not override road risk here', icon:'school', tone:'icon-mod'},
      {label:'Road condition', value:'Shin-level flooding', sub:'Rising slowly · MMDA on site', icon:'flood', tone:'icon-alert'},
      {label:'Latest advisory', value:'Flood bulletin', sub:'City government · 5:50 AM', icon:'alert', tone:'icon-alert'},
    ],
    factors: [
      {name:'Weather', pill:'high', pillText:'Elevated', desc:'Heavy rain and spray reducing visibility inside the underpass.', meter:'meter-70', icon:'weather', tone:'icon-weather'},
      {name:'Flood / roads', pill:'high', pillText:'High', desc:'Shin-level water. Stalled vehicles reported. Foot traffic not advised.', meter:'meter-70', icon:'flood', tone:'icon-alert'},
      {name:'Official advisories', pill:'high', pillText:'Elevated', desc:'City flood bulletin covers this underpass. MMDA monitoring.', meter:'meter-70', icon:'alert', tone:'icon-alert'},
      {name:'School status', pill:'low', pillText:'Normal', desc:'Nearby campuses have not suspended classes. This rating is for the roadway, not class status.', meter:'meter-20', icon:'school', tone:'icon-ok'},
      {name:'Community reports', pill:'high', pillText:'Several', desc:'Multiple stalled-vehicle and flooding reports in the last hour.', meter:'meter-70', icon:'reports', tone:'icon-alert'},
    ],
    advisories: [
      {src:'gov', label:'Government', title:'Flood bulletin: Quiapo underpass', desc:'Shin-level flooding. Motorists advised to use alternate routes.', time:'5:50 AM'},
      {src:'weather', label:'Weather', title:'Heavy rain continuing', desc:'Sustained rainfall over central Manila this morning.', time:'6:15 AM'},
      {src:'community', label:'Community', title:'Stalled vehicles in the underpass', desc:'Several reports since 5:40 AM. Not all verified.', time:'6:05 AM'},
    ],
    reports: [
      {type:'Flooding', title:'Shin-level water in underpass', meta:'Quiapo · 6:05 AM', status:'verified', statusLabel:'Verified'},
      {type:'Transport Disruption', title:'Stalled UV Express', meta:'Quiapo underpass · 6:12 AM', status:'pending', statusLabel:'Pending'},
      {type:'Road Hazard', title:'Low visibility', meta:'Quiapo underpass · 6:05 AM', status:'unverified', statusLabel:'Unverified'},
    ],
    points: [
      {kind:'start', label:'Approach', name:'Quezon Blvd. north', sub:'Water beginning to pond'},
      {kind:'mid', label:'Watched', name:'Quiapo underpass', sub:'Shin-level · stalled vehicles'},
      {kind:'end', label:'Exit', name:'Toward Lawton', sub:'Still passable beyond the dip'},
    ],
    floods: [
      {title:'Quiapo underpass', meta:'Shin-level, rising slowly · MMDA on site', tone:''},
    ],
    hazards: [
      {title:'Stalled UV Express', meta:'Reported 6:12 AM · Pending'},
      {title:'Low visibility in underpass', meta:'Reported 6:05 AM · Unverified'},
    ],
  },
  {
    id: 'lerma',
    name: 'Lerma St., Sampaloc',
    city: 'Manila',
    aliases: ['lerma', 'sampaloc'],
    updated: '6:38 AM',
    risk: {
      key: 'mod',
      name: 'MODERATE RISK',
      pct: 48,
      rank: 'Level 2 of 4',
      summary: 'An open manhole is verified on Lerma. Nearby España flooding may push more water this way. Use caution on foot.',
      status: 'Passable with caution',
    },
    stats: [
      {label:'Weather', value:'Heavy rain, 25°C', sub:'Same system as España', icon:'weather', tone:'icon-weather'},
      {label:'School status', value:'Classes ongoing', sub:'Nearby Mapúa · 6:00 AM', icon:'school', tone:'icon-ok'},
      {label:'Road condition', value:'Open manhole', sub:'Verified · foot traffic caution', icon:'flood', tone:'icon-mod'},
      {label:'Latest advisory', value:'PAGASA rainfall advisory', sub:'Metro Manila · 6:15 AM', icon:'alert', tone:'icon-alert'},
    ],
    factors: [
      {name:'Weather', pill:'mod', pillText:'Moderate', desc:'Heavy rain continuing over Sampaloc.', meter:'meter-52', icon:'weather', tone:'icon-weather'},
      {name:'Flood / roads', pill:'mod', pillText:'Moderate', desc:'Standing water plus a verified open manhole.', meter:'meter-52', icon:'flood', tone:'icon-mod'},
      {name:'Official advisories', pill:'mod', pillText:'Moderate', desc:'Covered by the metro rainfall advisory. No street-specific bulletin.', meter:'meter-40', icon:'alert', tone:'icon-mod'},
      {name:'School status', pill:'low', pillText:'Normal', desc:'No campus closure affecting this street.', meter:'meter-20', icon:'school', tone:'icon-ok'},
      {name:'Community reports', pill:'mod', pillText:'Active', desc:'Open manhole verified. Additional flood notes nearby.', meter:'meter-40', icon:'reports', tone:'icon-neutral'},
    ],
    advisories: [
      {src:'community', label:'Community', title:'Open manhole on Lerma St.', desc:'Verified report. Marked and being monitored.', time:'5:55 AM'},
      {src:'gov', label:'Government', title:'PAGASA rainfall advisory: Metro Manila', desc:'Moderate to heavy rainfall expected over Metro Manila.', time:'6:15 AM'},
    ],
    reports: [
      {type:'Road Hazard', title:'Open manhole reported', meta:'Lerma St. · 5:55 AM', status:'verified', statusLabel:'Verified'},
      {type:'Flooding', title:'Ankle-deep near España', meta:'Lerma / España · 6:18 AM', status:'pending', statusLabel:'Pending'},
    ],
    points: [
      {kind:'start', label:'Corner', name:'Lerma / España', sub:'Water spilling from España'},
      {kind:'end', label:'Watched', name:'Lerma St. manhole', sub:'Verified open manhole · use caution'},
    ],
    floods: [
      {title:'Lerma / España corner', meta:'Ankle-deep spillover from España Blvd.', tone:''},
    ],
    hazards: [
      {title:'Open manhole, Lerma St.', meta:'Reported 5:55 AM · Verified'},
    ],
  },
];

let currentLocation = null;

function searchLocations(query) {
  const q = query.trim().toLowerCase();
  if (!q) return LOCATIONS;
  return LOCATIONS.filter((loc) => {
    const hay = [loc.name, loc.city, ...(loc.aliases || [])].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

function buildNav(container) {
  const ul = document.getElementById(container);
  ul.innerHTML = NAV_ITEMS.map((item) => `
    <li class="nav-item ${item.key === 'overview' ? 'active' : ''}" data-key="${item.key}">
      ${item.icon}<span>${item.label}</span>
    </li>`).join('');
  ul.addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item');
    if (item) navigate(item.dataset.key);
  });
}

function navigate(key) {
  document.querySelectorAll('.page').forEach((p) => {
    p.classList.toggle('hidden', p.dataset.page !== key);
  });
  document.querySelectorAll('.nav-item').forEach((n) => {
    n.classList.toggle('active', n.dataset.key === key);
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function showSearch() {
  document.getElementById('app-shell').classList.remove('active');
  document.getElementById('search-screen').classList.remove('hidden-screen');
  document.querySelector('.bottom-tabs').classList.remove('visible');
  const input = document.getElementById('place-search');
  input.value = '';
  renderResults('place-results', searchLocations(''));
  input.focus();
}

function showApp() {
  document.getElementById('search-screen').classList.add('hidden-screen');
  document.getElementById('app-shell').classList.add('active');
  document.querySelector('.bottom-tabs').classList.add('visible');
}

function gaugeSVG(size, valuePct, color) {
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - valuePct / 100);
  return `
  <svg width="${size}" height="${size / 1.7}" viewBox="0 0 ${size} ${size / 1.7}">
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="#d9d9d9" stroke-width="10" stroke-linecap="butt"/>
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="butt"
      stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
    <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-weight="700" font-size="20" fill="#1a1a1a">${valuePct}%</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-size="10.5" fill="#5c5c5c">risk index</text>
  </svg>`;
}

function renderAdvisories(target, list) {
  const el = document.getElementById(target);
  if (!list.length) {
    el.innerHTML = '<p class="empty-note">No advisories for this area in the mock set.</p>';
    return;
  }
  el.innerHTML = list.map((a) => `
    <div class="adv-item">
      <div class="source-strip ${stripClass[a.src]}"></div>
      <div class="adv-body">
        <div class="adv-top"><span class="src-tag ${srcClass[a.src]}">${a.label}</span><span class="adv-title inline">${a.title}</span></div>
        <div class="adv-desc">${a.desc}</div>
      </div>
      <div class="adv-time mono">${a.time}</div>
    </div>`).join('');
}

function renderReports(target, list) {
  const el = document.getElementById(target);
  if (!list.length) {
    el.innerHTML = '<p class="empty-note">No community reports in the mock set.</p>';
    return;
  }
  el.innerHTML = list.map((r) => `
    <div class="report-row">
      <div class="rtype">${reportIcon[r.type] || reportIcon.Flooding}</div>
      <div class="report-main"><div class="title">${r.title}</div><div class="meta">${r.meta}</div></div>
      <span class="status-chip status-${r.status}">${r.statusLabel}</span>
    </div>`).join('');
}

function setPill(el, key, text) {
  el.className = `pill ${key}`;
  el.innerHTML = `<span class="dot"></span>${text}`;
}

function selectLocation(id) {
  const loc = LOCATIONS.find((l) => l.id === id);
  if (!loc) return;
  currentLocation = loc;
  const color = RISK_COLOR[loc.risk.key];

  document.getElementById('overviewTitle').textContent = loc.name;
  document.getElementById('overviewSub').textContent = `${loc.city} · informational snapshot, not an official suspension notice`;
  document.getElementById('riskName').textContent = loc.risk.name;
  document.getElementById('riskWhy').textContent = loc.risk.summary;
  document.getElementById('riskUpdated').textContent = `Last updated ${loc.updated}`;
  setPill(document.getElementById('riskPill'), loc.risk.key, loc.risk.rank);
  setPill(document.getElementById('topbarPill'), loc.risk.key, loc.risk.name.replace(' RISK', ''));

  const hero = document.getElementById('riskHero');
  hero.className = `risk-hero risk-${loc.risk.key}`;

  document.getElementById('heroGaugeWrap').innerHTML = gaugeSVG(150, loc.risk.pct, color);
  document.getElementById('riskPageGaugeWrap').innerHTML = gaugeSVG(190, loc.risk.pct, color);
  document.getElementById('riskPageName').textContent = loc.risk.name;
  document.getElementById('riskPageSub').textContent = `${loc.name} · ${loc.risk.name.toLowerCase()}`;
  document.getElementById('riskPageCaption').textContent = loc.risk.summary;
  document.getElementById('riskPageUpdated').textContent = `Last updated ${loc.updated}`;

  document.getElementById('statRow').innerHTML = loc.stats.map((s) => `
    <div class="card stat-card">
      <div class="label">${s.label}</div>
      <div class="value-row">
        <div class="value">${s.value}</div>
        <div class="icon-badge ${s.tone}">${ICONS[s.icon]}</div>
      </div>
      <div class="sub">${s.sub}</div>
    </div>`).join('');

  document.getElementById('factorList').innerHTML = loc.factors.map((f, i) => `
    <div class="card factor-card ${i === loc.factors.length - 1 ? 'mb-0' : ''}">
      <div class="factor-icon ${f.tone}">${ICONS[f.icon]}</div>
      <div class="factor-body">
        <div class="factor-top"><div class="factor-name">${f.name}</div><span class="pill ${f.pill}"><span class="dot"></span>${f.pillText}</span></div>
        <p class="factor-desc">${f.desc}</p>
        <div class="meter"><div class="meter-fill ${f.meter}"></div></div>
      </div>
    </div>`).join('');

  renderAdvisories('dashAdvisories', loc.advisories.slice(0, 3));
  renderAdvisories('fullAnnouncements', loc.advisories);
  renderReports('dashReports', loc.reports);
  renderReports('reportsList', loc.reports);

  document.getElementById('conditionsSub').textContent = loc.name;
  setPill(document.getElementById('conditionsPill'), loc.risk.key, loc.risk.status);
  document.getElementById('floodUpdated').textContent = `Updated ${loc.updated}`;
  document.getElementById('hazardCount').textContent = `${loc.hazards.length} listed`;

  document.getElementById('conditionTrack').innerHTML = loc.points.map((p) => `
    <div class="route-node">
      <div class="route-dot ${p.kind === 'end' ? 'end' : p.kind === 'mid' ? 'mid' : ''}"><div class="inner"></div></div>
      <div class="rn-label">${p.label}</div>
      <div class="rn-name">${p.name}</div>
      <div class="rn-sub">${p.sub}</div>
    </div>`).join('');

  document.getElementById('floodList').innerHTML = loc.floods.map((h, i) => `
    <div class="hazard-row ${i === loc.floods.length - 1 ? 'mb-0' : ''}">
      <div class="hazard-icon ${h.tone}">${ICONS.flood}</div>
      <div class="hazard-body"><div class="title">${h.title}</div><div class="meta">${h.meta}</div></div>
    </div>`).join('');

  document.getElementById('hazardList').innerHTML = loc.hazards.map((h, i) => `
    <div class="hazard-row ${i === loc.hazards.length - 1 ? 'mb-0' : ''}">
      <div class="hazard-icon">${ICONS.alert}</div>
      <div class="hazard-body"><div class="title">${h.title}</div><div class="meta">${h.meta}</div></div>
    </div>`).join('');

  document.getElementById('rep-loc').value = loc.name;
  document.getElementById('place-search-bar').value = loc.name;
  hideResults('place-results');
  hideResults('place-results-bar');
  showApp();
  navigate('overview');
}

function renderResults(listId, items) {
  const list = document.getElementById(listId);
  if (!items.length) {
    list.hidden = false;
    list.innerHTML = '<li class="place-empty">No matching area in this mock dataset.</li>';
    return;
  }
  list.hidden = false;
  list.innerHTML = items.map((loc) => `
    <li>
      <button type="button" class="place-option" data-id="${loc.id}">
        <span class="place-option-name">${loc.name}</span>
        <span class="place-option-meta">${loc.city}</span>
      </button>
    </li>`).join('');
}

function hideResults(listId) {
  document.getElementById(listId).hidden = true;
}

function bindSearch(inputId, listId, hideWhenEmpty) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  input.addEventListener('input', () => {
    const q = input.value;
    if (hideWhenEmpty && !q.trim()) {
      hideResults(listId);
      return;
    }
    renderResults(listId, searchLocations(q));
  });

  input.addEventListener('focus', () => {
    const q = input.value;
    if (hideWhenEmpty && !q.trim()) {
      renderResults(listId, LOCATIONS);
      return;
    }
    renderResults(listId, searchLocations(q));
  });

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const matches = searchLocations(input.value);
    if (matches[0]) selectLocation(matches[0].id);
  });

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (btn) selectLocation(btn.dataset.id);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  buildNav('navList');
  buildNav('navListMobile');

  document.getElementById('place-chips').innerHTML = LOCATIONS.map((loc) =>
    `<button type="button" class="place-chip" data-id="${loc.id}">${loc.name}</button>`
  ).join('');
  document.getElementById('place-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (btn) selectLocation(btn.dataset.id);
  });

  bindSearch('place-search', 'place-results', false);
  bindSearch('place-search-bar', 'place-results-bar', true);
  renderResults('place-results', LOCATIONS);

  document.querySelectorAll('[data-go-home]').forEach((el) => {
    el.addEventListener('click', showSearch);
  });

  document.querySelectorAll('.view-all').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });

  document.getElementById('submit-report').addEventListener('click', () => {
    alert('This is a Phase 1 UI mock. Report submission is not connected to a backend.');
  });

  document.getElementById('typeChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.type-chip');
    if (!chip) return;
    document.querySelectorAll('.type-chip').forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box') && !e.target.closest('.location-bar')) {
      hideResults('place-results-bar');
    }
  });
});
