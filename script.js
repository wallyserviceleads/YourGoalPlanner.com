/* Goal Tracking Calendar (Unbranded, Local-First, v2)
   - Settings + data stored in localStorage
   - Multiple entries per day (label + amount)
   - Settings modal (goal name, amount, date range, weekday toggles, light/dark theme)
   - Pacing by selected working days within goal range */

'use strict';

function showEntryModal(date, initial = {}) {
  const dlg = document.getElementById("entryModal");
  const form = document.getElementById("entryForm");
  const title = document.getElementById("entryTitle");
  const label = document.getElementById("entryLabel");
  const amount = document.getElementById("entryAmount");
  const delBtn = document.getElementById("entryDelete");

  const _isod = (d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
title.textContent = `${initial.mode === "edit" ? "Edit" : "Add"} entry — ${_isod(date)}`;

  label.value = initial.label || "";
  amount.value = initial.amount != null ? String(initial.amount) : "";

  // Show Delete only in edit mode
  if (delBtn) delBtn.style.display = initial.mode === "edit" ? "inline-flex" : "none";

  return new Promise((resolve) => {
    const onClose = () => {
      dlg.removeEventListener("close", onClose);
      if (dlg.returnValue === "delete") {
        resolve({ _delete: true });
      } else if (dlg.returnValue === "save") {
        const amt = Number(String(amount.value).replace(/[^0-9.\-]/g, ""));
        resolve({ label: label.value.trim(), amount: amt });
      } else {
        resolve(null);
      }
    };
    dlg.addEventListener("close", onClose);
    if (!dlg.showModal) { dlg.setAttribute('open',''); } else { dlg.showModal(); }

    setTimeout(() => label.focus(), 0);
  });
}


(function(){
   /*__UNSTICK_DIALOG__*/
try {
  const dlg = document.getElementById('entryModal');
  if (dlg) {
    if (dlg.open) { try { dlg.close(); } catch {} }
    dlg.removeAttribute('open');               // ensure not open
  }
  // If browser left siblings inert, restore interactivity:
  document.querySelectorAll('[inert]').forEach(el => el.removeAttribute('inert'));
} catch {}
  const cfg = window.APP_CONFIG || {};
  const $ = (sel)=>document.querySelector(sel);
  const $$ = (sel)=>Array.from(document.querySelectorAll(sel));

  // Elements
  const settingsBtn = $("#settingsBtn");
  const settingsModal = $("#settingsModal");
  const closeSettings = $("#closeSettings");
  const saveSettings = $("#saveSettings");

  const goalSummary = $("#goalSummary");
  const goalNameInp = $("#goalName");
  const goalAmountInp = $("#goalAmount");
  const goalStartInp = $("#goalStart");
  const goalEndInp = $("#goalEnd");
  const themeToggle = $("#themeToggle");

  const monthLabel = $("#monthLabel");
  const grid = $("#calendarGrid");
  const prevBtn = $("#prevMonth");
  const nextBtn = $("#nextMonth");

  const kpiDaily = $("#kpiDaily");
  const kpiWeekly = $("#kpiWeekly");
  const kpiMonthly = $("#kpiMonthly");
  const kpiQuarterly = $("#kpiQuarterly");
  const kpiYTD = $("#kpiYTD");

  let weekdayCheckboxes = [];

  // Storage
  const SETTINGS_KEY = "gtc_v2_settings";
  const DATA_KEY = "gtc_v2_data"; // 'YYYY-MM-DD' -> [{label, amount}]

  const loadJSON = (k,f)=>{ try{const r=localStorage.getItem(k); return r?JSON.parse(r):f;}catch{return f;} };
  const saveJSON = (k,v)=>{ try{localStorage.setItem(k, JSON.stringify(v)); }catch{} };

  // State
  let current = new Date(); current.setDate(1);
  let settings = loadJSON(SETTINGS_KEY, {
    goalName: cfg.DEFAULT_GOAL_NAME || "Goal",
    goalAmount: Number(cfg.DEFAULT_GOAL_AMOUNT || 500000),
    goalStart: cfg.DEFAULT_GOAL_START || "",
    goalEnd: cfg.DEFAULT_GOAL_END || "",
    theme: cfg.DEFAULT_THEME || "dark",
    weekdays: {0:false,1:true,2:true,3:true,4:true,5:true,6:true},
  });
  let store = loadJSON(DATA_KEY, {});

  // Theme
  function applyTheme(){
    const theme = settings.theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
  }

  // Helpers
  const iso = (d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parseISO = (s)=> s ? new Date(s+"T00:00:00") : null;
  const sod = (d)=>{ const x=new Date(d); x.setHours(0,0,0,0); return x; };
  const eod = (d)=>{ const x=new Date(d); x.setHours(23,59,59,999); return x; };
  const dim = (y,m)=> new Date(y,m+1,0).getDate();
  const money = (n=0)=>"$"+(Math.round(+n)||0).toLocaleString();

  function workingDaysInRange(start, end, mask){
    if(!start||!end) return 0;
    const s=sod(start), e=eod(end);
    if(e<s) return 0;
    let c=0, cur=new Date(s);
    while(cur<=e){ if(mask[cur.getDay()]) c++; cur.setDate(cur.getDate()+1); }
    return c;
  }
  function workingDaysInMonth(date, mask){
    const y=date.getFullYear(), m=date.getMonth();
    let c=0; for(let d=1; d<=dim(y,m); d++){ if(mask[new Date(y,m,d).getDay()]) c++; }
    return c;
  }

  function entries(date){ const a=store[iso(date)]; return Array.isArray(a)?a:[]; }
  function setEntries(date, arr){
    const clean = (arr||[]).map(e=>({label:String(e.label||'Sale').slice(0,64), amount:Math.max(0,Math.round(+e.amount||0))})).filter(e=>e.amount>0);
    if(clean.length) store[iso(date)] = clean; else delete store[iso(date)];
    saveJSON(DATA_KEY, store);
  }
function addEntryFlow(date){
  return showEntryModal(date, { mode: "add", label: "Sale" }).then((res)=>{
    if (!res) return false;
    const { label, amount } = res;
    if (!Number.isFinite(amount) || amount <= 0) { alert("Please enter a positive number."); return false; }
    const arr = entries(date); arr.push({ label, amount: Math.round(amount) }); setEntries(date, arr);
    return true;
  });
}
// Callers:


  function total(date){ return entries(date).reduce((s,e)=>s+(+e.amount||0),0); }

  function updateGoalSummary(progress=0){
    const name = settings.goalName || "Goal";
    const amt = money(settings.goalAmount||0);
    let range = "no range";
    if(settings.goalStart && settings.goalEnd) range = `${settings.goalStart} → ${settings.goalEnd}`;
    else if(settings.goalStart) range = `from ${settings.goalStart}`;
    else if(settings.goalEnd) range = `until ${settings.goalEnd}`;
    const pct = settings.goalAmount > 0 ? (progress / settings.goalAmount) * 100 : 0;
    const pctText = `– ${pct.toFixed(1)}%`;
    $("#goalSummary").textContent = `${name} — ${amt} (${range}) ${pctText}`;
  }

  function render(){
    applyTheme();
    
    const y=current.getFullYear(), m=current.getMonth();
    $("#monthLabel").textContent = new Date(y,m,1).toLocaleString(undefined,{month:'long',year:'numeric'});
    grid.innerHTML = "";

    const mask = settings.weekdays || {0:false,1:true,2:true,3:true,4:true,5:true,6:true};
    const start = parseISO(settings.goalStart);
    const end = parseISO(settings.goalEnd);

    const workInRange = workingDaysInRange(start, end, mask);
    const daily = workInRange>0 ? (Number(settings.goalAmount||0)/workInRange) : 0;
    const weekly = daily * [0,1,2,3,4,5,6].filter(d=>mask[d]).length;
    const monthly = daily * workingDaysInMonth(current, mask);

    // Quarter
    const qStartMonth = Math.floor(m/3)*3;
    const qStart = new Date(y,qStartMonth,1);
    const qEnd = new Date(y,qStartMonth+3,0);
    const qDays = workingDaysInRange(qStart, qEnd, mask);
    const quarterly = daily * qDays;

    // Range progress
    let progress = 0;
    const s = start? sod(start):null, e = end? eod(end):null;
    for(const [k,arr] of Object.entries(store)){
      const d = new Date(k);
      if((!s||d>=s)&&(!e||d<=e)){
        progress += (Array.isArray(arr)?arr:[]).reduce((sum,x)=>sum+(+x.amount||0),0);
      }
    }
     
const pct = settings.goalAmount > 0 ? (progress / settings.goalAmount) * 100 : 0;

    updateGoalSummary(progress);
     
    kpiDaily.textContent = money(daily);
    kpiWeekly.textContent = money(weekly);
    kpiMonthly.textContent = money(monthly);
    kpiQuarterly.textContent = money(quarterly);
    kpiYTD.textContent = `${money(progress)} (${pct.toFixed(1)}%)`;

    // headers
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(h=>{
      const div=document.createElement('div'); div.className='day';
      div.innerHTML=`<div class="date"><strong>${h}</strong></div>`; grid.appendChild(div);
    });

    // pad
    const firstDay = new Date(y,m,1).getDay();
    for(let i=0;i<firstDay;i++){ const pad=document.createElement('div'); pad.className='day pad'; pad.innerHTML='<div class="date"> </div>'; grid.appendChild(pad); }

    const days = dim(y,m);
    let weekSum = 0;
    for(let d=1; d<=days; d++){
      const date = new Date(y,m,d);
      const wd = date.getDay();
      const isWork = !!mask[wd];
      const cell = document.createElement('div'); cell.className='day'; cell.dataset.date = iso(date);
      /*__TODAY_MARKER__*/
      const now=new Date(); if(date.getFullYear()===now.getFullYear() && date.getMonth()===now.getMonth() && date.getDate()===now.getDate()){ cell.classList.add('today'); }

      const pace = (isWork && isFinite(daily) && daily>0) ? `<span class="pace"><span class="pill goal"></span>${money(daily)}</span>` : "";
      cell.innerHTML = `<div class="date"><span>${d}</span>${pace}</div>`;

      const list = document.createElement('div'); list.className='items';
const arr = entries(date);
if(arr.length){
  arr.forEach((e, i)=>{
    const label = (e.label||'Entry').replace(/[<>&]/g, s=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[s]));
    const row = document.createElement('div'); row.className='item';
    row.innerHTML = `<span>${label}</span><span class="amount">${money(e.amount)}</span>`;

    // Click a row to edit (don’t bubble to the day cell add handler)
    row.title = 'Click to edit';
    row.addEventListener('click', (ev)=>{
  ev.stopPropagation();
  showEntryModal(date, { mode: "edit", label: e.label || "", amount: e.amount }).then(res=>{
    if(!res) return;

    // Handle Delete
    if (res._delete) {
      const copy = entries(date);
      copy.splice(i, 1);
      setEntries(date, copy);
      render();
      return;
    }

    // Handle Save
    const { label, amount } = res;
    if(!Number.isFinite(amount) || amount <= 0){ alert('Please enter a positive number.'); return; }
    const copy = entries(date);
    copy[i] = { label, amount: Math.round(amount) };
    setEntries(date, copy);
    render();
  });
});


    list.appendChild(row);
  });
}

      cell.appendChild(list);

      if(isWork){
        const tot = total(date); weekSum += tot;
        const t = document.createElement('div'); t.className='total'; t.innerHTML=`<span>Total</span><span>${money(tot)}</span>`;
        cell.appendChild(t);
      }

      cell.addEventListener('click', async ()=>{
  const ok = await addEntryFlow(date);
  if (ok) render();
});


      grid.appendChild(cell);

      if (wd===6 || d===days){
        const weekRow = document.createElement('div'); weekRow.className='week-row';
        weekRow.innerHTML = `<div>Week subtotal</div><div>${money(weekSum)}</div>`;
        grid.appendChild(weekRow); weekSum = 0;
      }
    }
  }

  // Navigation
  prevBtn.addEventListener('click', ()=>{ current.setMonth(current.getMonth()-1); render(); });
  nextBtn.addEventListener('click', ()=>{ current.setMonth(current.getMonth()+1); render(); });

  // Settings
  function initSettingsBindings(){
    goalNameInp.value = settings.goalName || "";
    goalAmountInp.value = Number(settings.goalAmount||0) || "";
    goalStartInp.value = settings.goalStart || "";
    goalEndInp.value = settings.goalEnd || "";
    themeToggle.checked = settings.theme === "light";
    const cont = settingsModal.querySelector(".weekday-toggles");
    const boxes = Array.from(cont.querySelectorAll("input[type=checkbox][data-wd]"));
    boxes.forEach(cb=>{ const wd = Number(cb.dataset.wd); cb.checked = !!settings.weekdays[wd]; });
  }
  settingsBtn.addEventListener("click", ()=>{ initSettingsBindings(); settingsModal.showModal(); });
  closeSettings.addEventListener("click", ()=> settingsModal.close());

  saveSettings.addEventListener("click", (ev)=>{
    ev.preventDefault();
    settings.goalName = (goalNameInp.value||"Goal").trim();
    settings.goalAmount = Number(goalAmountInp.value||0) || 0;
    settings.goalStart = goalStartInp.value || "";
    settings.goalEnd = goalEndInp.value || "";
    settings.theme = themeToggle.checked ? "light" : "dark";
    const boxes = Array.from(settingsModal.querySelectorAll("input[type=checkbox][data-wd]"));
    const mask = {...settings.weekdays};
    boxes.forEach(cb=> mask[Number(cb.dataset.wd)] = !!cb.checked);
    settings.weekdays = mask;
    saveJSON(SETTINGS_KEY, settings);
    render();
    settingsModal.close();
  });
  $("#resetBtn").addEventListener("click", ()=>{
    if(!confirm("Clear all locally saved data and settings?")) return;
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(DATA_KEY);
    settings = {
      goalName: cfg.DEFAULT_GOAL_NAME || "Goal",
      goalAmount: Number(cfg.DEFAULT_GOAL_AMOUNT || 500000),
      goalStart: cfg.DEFAULT_GOAL_START || "",
      goalEnd: cfg.DEFAULT_GOAL_END || "",
      theme: cfg.DEFAULT_THEME || "dark",
      weekdays: {0:false,1:true,2:true,3:true,4:true,5:true,6:true},
    };
    store = {};
    saveJSON(SETTINGS_KEY, settings);
    saveJSON(DATA_KEY, store);
    render(); settingsModal.close();
  });

  // Boot
  render();
})();
// netlify/functions/ghl-usage.js
export const handler = async (event) => {
  const origin = event.headers.origin || "";
  const cors = {
    "Access-Control-Allow-Origin": "https://calendar.yourgoalplanner.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Use POST" };
  }

  try {
    const { contactId, lastUsedAtISO, noteText } = JSON.parse(event.body || "{}");
    if (!contactId) {
      return { statusCode: 400, headers: cors, body: "Missing contactId" };
    }

    const token = process.env.GHL_TOKEN;                     // HighLevel token (v2 private integration or OAuth)
    const lastUsageFieldId = process.env.GHL_LAST_USAGE_FIELD_ID; // optional: the custom field id for “Last Usage”
    const base = "https://services.leadconnectorhq.com";     // HighLevel API host

    const headers = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      // HighLevel/LeadConnector requires an API Version header on many endpoints:
      "Version": "2021-07-28"
    };

    // Option A: update a custom field (if you created one and set its id)
    let results = [];
    if (lastUsageFieldId && lastUsedAtISO) {
      const res = await fetch(`${base}/contacts/${contactId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          // custom field values array (id + value)
          customFields: [{ id: lastUsageFieldId, value: lastUsedAtISO }]
        })
      });
      results.push({ type: "customField", status: res.status });
    }

    // Option B: also drop a note (nice audit trail)
    const text = noteText || `Calendar used at ${lastUsedAtISO || new Date().toISOString()}`;
    const noteRes = await fetch(`${base}/contacts/${contactId}/notes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: text })
    });
    results.push({ type: "note", status: noteRes.status });

    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, results }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: String(err) }) };
  }
};
