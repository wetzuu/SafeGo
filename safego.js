const NAV_ITEMS = [
  {key:'dashboard', label:'Dashboard', icon:'<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="7" height="7.5" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="10.5" width="7" height="10" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/></svg>'},
  {key:'risk', label:'Risk Analysis', icon:'<svg viewBox="0 0 24 24" fill="none"><path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'},
  {key:'announcements', label:'Announcements', icon:'<svg viewBox="0 0 24 24" fill="none"><path d="M4 10v4a1 1 0 001 1h2l4 4V5L7 9H5a1 1 0 00-1 1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M15.5 8.5a5 5 0 010 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'},
  {key:'route', label:'Route', icon:'<svg viewBox="0 0 24 24" fill="none"><circle cx="6" cy="6" r="2.2" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="18" r="2.2" stroke="currentColor" stroke-width="1.6"/><path d="M7.8 7.5c2 1 3 2.7 3 4.5s1 3.5 3 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="2.4 2.4"/></svg>'},
  {key:'reports', label:'Reports', icon:'<svg viewBox="0 0 24 24" fill="none"><path d="M6 3.5h9l3 3V20a.8.8 0 01-.8.8H6a.8.8 0 01-.8-.8V4.3a.8.8 0 01.8-.8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 12h7M8.5 15.5h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'},
  {key:'profile', label:'Profile', icon:'<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.3" r="3.3" stroke="currentColor" stroke-width="1.6"/><path d="M4.8 19.5a7.2 7.2 0 0114.4 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'},
];

function buildNav(container) {
  const ul = document.getElementById(container);
  ul.innerHTML = NAV_ITEMS.map(item => `
    <li class="nav-item ${item.key === 'dashboard' ? 'active' : ''}" data-key="${item.key}">
      ${item.icon}<span>${item.label}</span>
    </li>`).join('');
  ul.addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item');
    if (item) navigate(item.dataset.key);
  });
}

function navigate(key) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('hidden', p.dataset.page !== key);
  });
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.key === key);
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function doLogin() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').classList.add('active');
}

function doLogout() {
  document.getElementById('app-shell').classList.remove('active');
  document.getElementById('login-screen').style.display = 'flex';
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
    <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-weight="700" font-size="20" fill="#1a1a1a">58%</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-size="10.5" fill="#5c5c5c">risk index</text>
  </svg>`;
}

const advisories = [
  {src:'gov', label:'Government', title:'PAGASA Rainfall Advisory: Metro Manila', desc:'Moderate to heavy rainfall expected over Metro Manila and nearby provinces within the next 3 hours.', time:'6:15 AM'},
  {src:'school', label:'School', title:'Mapúa University: Classes proceed as scheduled', desc:'No suspension announced. Students are advised to monitor road conditions and allot extra travel time.', time:'6:00 AM'},
  {src:'weather', label:'Weather Bureau', title:'Localized flood watch: España / Sampaloc area', desc:'Street-level flooding possible in low-lying sections due to sustained rainfall since early morning.', time:'5:50 AM'},
  {src:'community', label:'Community', title:'Multiple reports of slow traffic along Quezon Blvd.', desc:'Aggregated from 4 student reports in the last hour. Pending official verification.', time:'5:40 AM'},
];
const srcClass = {gov:'src-gov', school:'src-school', weather:'src-weather', community:'src-community'};
const stripClass = {gov:'strip-gov', school:'strip-school', weather:'strip-weather', community:'strip-community'};

function renderAdvisories(target, list) {
  document.getElementById(target).innerHTML = list.map(a => `
    <div class="adv-item">
      <div class="source-strip ${stripClass[a.src]}"></div>
      <div class="adv-body">
        <div class="adv-top"><span class="src-tag ${srcClass[a.src]}">${a.label}</span><span class="adv-title inline">${a.title}</span></div>
        <div class="adv-desc">${a.desc}</div>
      </div>
      <div class="adv-time mono">${a.time}</div>
    </div>`).join('');
}

const reports = [
  {type:'Flooding', title:'Ankle-deep flooding', meta:'España Blvd. corner Morayta · 6:20 AM', status:'pending', statusLabel:'Pending Verification'},
  {type:'Road Hazard', title:'Open manhole reported', meta:'Lerma St. · 5:55 AM', status:'verified', statusLabel:'Verified'},
  {type:'Transport Disruption', title:'Jeepney route rerouted', meta:'Quezon Blvd. · 5:40 AM', status:'unverified', statusLabel:'Unverified'},
];
const reportIcon = {
  'Flooding':'<svg viewBox="0 0 24 24" fill="none"><path d="M3 18c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  'Road Hazard':'<svg viewBox="0 0 24 24" fill="none"><path d="M12 3 2 20h20L12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  'Transport Disruption':'<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="8" width="17" height="9" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="19" r="1.4" stroke="currentColor" stroke-width="1.4"/><circle cx="16" cy="19" r="1.4" stroke="currentColor" stroke-width="1.4"/><path d="M3.5 12h17" stroke="currentColor" stroke-width="1.6"/></svg>',
};

function renderReports(target, list) {
  document.getElementById(target).innerHTML = list.map(r => `
    <div class="report-row">
      <div class="rtype">${reportIcon[r.type] || reportIcon.Flooding}</div>
      <div class="report-main"><div class="title">${r.title}</div><div class="meta">${r.meta}</div></div>
      <span class="status-chip status-${r.status}">${r.statusLabel}</span>
    </div>`).join('');
}

function mockSubmit() {
  alert('This is a Phase 1 UI mock. Report submission is not yet connected to a backend.');
}

document.addEventListener('DOMContentLoaded', () => {
  buildNav('navList');
  buildNav('navListMobile');

  document.getElementById('heroGaugeWrap').innerHTML = gaugeSVG(150, 58, '#a16207');
  document.getElementById('riskPageGaugeWrap').innerHTML = gaugeSVG(190, 58, '#a16207');

  renderAdvisories('dashAdvisories', advisories.slice(0, 3));
  renderAdvisories('fullAnnouncements', advisories);
  renderReports('dashReports', reports);
  renderReports('reportsList', reports);

  document.getElementById('login-btn').addEventListener('click', doLogin);
  document.getElementById('logout-btn').addEventListener('click', doLogout);
  document.querySelectorAll('.view-all').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });
  document.getElementById('submit-report').addEventListener('click', mockSubmit);

  document.getElementById('typeChips').addEventListener('click', e => {
    const chip = e.target.closest('.type-chip');
    if (!chip) return;
    document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
  });

  document.querySelectorAll('.toggle').forEach(t => {
    t.addEventListener('click', () => t.classList.toggle('on'));
  });
});
