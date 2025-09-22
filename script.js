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
  const goalProgressInp = $("#goalProgress");
  const themeToggle = $("#themeToggle");
  const sheetLinkInput = $("#sheetLink");
  const importSheetBtn = $("#importSheetBtn");
  const sheetStatus = $("#sheetStatus");
  
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

  function showSheetStatus(message = "", kind = "info") {
    if (!sheetStatus) return;
    sheetStatus.textContent = message;
    if (!message) { delete sheetStatus.dataset.kind; return; }
    sheetStatus.dataset.kind = kind || "info";
  }
   
   // State
  let current = new Date(); current.setDate(1);
  let settings = loadJSON(SETTINGS_KEY, {
    goalName: cfg.DEFAULT_GOAL_NAME || "Goal",
    goalAmount: Number(cfg.DEFAULT_GOAL_AMOUNT || 500000),
    goalStart: cfg.DEFAULT_GOAL_START || "",
    goalEnd: cfg.DEFAULT_GOAL_END || "",
    goalProgress: Number(cfg.DEFAULT_GOAL_PROGRESS || 0),
    theme: cfg.DEFAULT_THEME || "dark",
    weekdays: {0:false,1:true,2:true,3:true,4:true,5:true,6:true},
  sheetUrl: cfg.DEFAULT_SHEET_URL || "",
  });
    if (typeof settings.sheetUrl !== "string") settings.sheetUrl = "";
  let store = loadJSON(DATA_KEY, {});

  const sheetRefreshMinutesRaw = Number(cfg.SHEET_REFRESH_MINUTES);
  const sheetRefreshMinutes =
    (Number.isFinite(sheetRefreshMinutesRaw) && sheetRefreshMinutesRaw > 0)
      ? sheetRefreshMinutesRaw
      : 5;
  const SHEET_SYNC_INTERVAL_MS = sheetRefreshMinutes * 60 * 1000;
  let sheetSyncTimer = null;
  let sheetSyncInProgress = false;

  function clearSheetSyncLoop(){
    if(sheetSyncTimer){
      clearInterval(sheetSyncTimer);
      sheetSyncTimer = null;
    }
  }

  function restartSheetSyncLoop(){
    clearSheetSyncLoop();
    if(!settings.sheetUrl) return;
    sheetSyncTimer = setInterval(()=>{
      syncSheetData({ quiet: true });
    }, SHEET_SYNC_INTERVAL_MS);
  }

  async function syncSheetData({ quiet } = {}){
    const rawLink = !quiet ? (sheetLinkInput?.value ?? settings.sheetUrl ?? "") : (settings.sheetUrl || "");
    const link = String(rawLink || "").trim();
    if(!link){
      if(!quiet){
        showSheetStatus("Enter the share link to your Google Sheet first.", "error");
        sheetLinkInput?.focus();
      }
      return null;
    }

    const previousLink = settings.sheetUrl;
    if(previousLink !== link){
      settings.sheetUrl = link;
      saveJSON(SETTINGS_KEY, settings);
      restartSheetSyncLoop();
    }

    if(sheetSyncInProgress){
      if(!quiet){
        showSheetStatus("A sync is already in progress…", "info");
      }
      return null;
    }

    sheetSyncInProgress = true;
    if(importSheetBtn) importSheetBtn.disabled = true;
    if(!quiet){
      showSheetStatus("Loading…", "info");
    }

    let result = null;
    try {
      result = await importGoogleSheet(link);
      store = result.store;
      saveJSON(DATA_KEY, store);
      render();
      if(!quiet){
        showSheetStatus(`Imported ${result.entries} entr${result.entries === 1 ? "y" : "ies"} across ${result.days} day${result.days === 1 ? "" : "s"}.`, "success");
      }
    } catch (err) {
      const message = err && err.message ? err.message : "Unable to import from the sheet.";
      if(!quiet){
        showSheetStatus(message, "error");
      } else {
        console.error("Sheet sync failed:", message, err);
      }
    } finally {
      sheetSyncInProgress = false;
      if(importSheetBtn) importSheetBtn.disabled = false;
    }

    return result;
  }
  
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

   function normalizeSheetUrl(link){
    if(!link) return "";
    const trimmed = String(link).trim();
    if(!trimmed) return "";
    if(/export\?format=csv/i.test(trimmed) || /output=csv/i.test(trimmed)) return trimmed;
    const idMatch = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if(idMatch){
      const gidMatch = trimmed.match(/[?&#]gid=(\d+)/);
      const gid = gidMatch ? gidMatch[1] : "0";
      return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
    }
    return trimmed;
  }

  function parseCSV(text){
    const rows = [];
    let cur = [];
    let val = "";
    let inQuotes = false;
    for(let i=0;i<text.length;i++){
      const ch = text[i];
      if(inQuotes){
        if(ch === '"'){
          const next = text[i+1];
          if(next === '"'){ val += '"'; i++; }
          else { inQuotes = false; }
        } else {
          val += ch;
        }
      } else {
        if(ch === '"') inQuotes = true;
        else if(ch === ','){ cur.push(val); val = ""; }
        else if(ch === '\r'){ continue; }
        else if(ch === '\n'){ cur.push(val); rows.push(cur); cur = []; val = ""; }
        else { val += ch; }
      }
    }
    cur.push(val);
    rows.push(cur);
    return rows;
  }

  function parseSheetDate(value){
    if(value == null) return null;
    if(value instanceof Date && !Number.isNaN(value.getTime())){
      const d = new Date(value); d.setHours(0,0,0,0); return d;
    }
    if(typeof value === "number" && Number.isFinite(value)){
      const base = new Date(Date.UTC(1899,11,30));
      base.setUTCDate(base.getUTCDate()+Math.floor(value));
      return new Date(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
    }
    const str = String(value).trim();
    if(!str) return null;
    const parsed = new Date(str);
    if(!Number.isNaN(parsed.getTime())){
      const d = new Date(parsed); d.setHours(0,0,0,0); return d;
    }
    const slash = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if(slash){
      let [,mStr,dStr,yStr] = slash;
      let year = Number(yStr.length === 2 ? (Number(yStr) >= 70 ? 1900 + Number(yStr) : 2000 + Number(yStr)) : Number(yStr));
      const month = Number(mStr) - 1;
      const day = Number(dStr);
      const d = new Date(year, month, day);
      if(!Number.isNaN(d.getTime())){ d.setHours(0,0,0,0); return d; }
    }
    return null;
  }

  async function importGoogleSheet(url){
    const csvUrl = normalizeSheetUrl(url);
    if(!csvUrl) throw new Error("Enter a valid Google Sheet link.");
    const res = await fetch(csvUrl, { cache: "no-store" });
    if(!res.ok) throw new Error(`Request failed (${res.status})`);
    const text = await res.text();
    if(!text.trim()) throw new Error("The sheet is empty.");
    if(/<html/i.test(text)) throw new Error("Publish the sheet to the web or use the CSV export link.");
    const rows = parseCSV(text).filter(row=>Array.isArray(row) && row.some(cell=>String(cell||"").trim()!==""));
    if(!rows.length) throw new Error("No data rows found.");

    let header = rows[0].map(cell=>String(cell||"").trim());
    let startIndex = 1;
    const headerLower = header.map(cell=>cell.toLowerCase());
    let dateIdx = headerLower.indexOf("date");
    let labelIdx = headerLower.indexOf("label");
    if(labelIdx === -1) labelIdx = headerLower.indexOf("name");
    if(labelIdx === -1) labelIdx = headerLower.indexOf("description");
    let amountIdx = headerLower.findIndex(cell=>["amount","value","total","sales","revenue"].includes(cell));
    if(dateIdx === -1 || amountIdx === -1){
      dateIdx = 0;
      if(labelIdx === -1) labelIdx = 1;
      if(amountIdx === -1) amountIdx = 2;
      startIndex = 0;
    }

    const imported = {};
    let entriesCount = 0;
    for(let r=startIndex; r<rows.length; r++){
      const row = rows[r];
      if(!row) continue;
      const rawDate = row[dateIdx];
      const date = parseSheetDate(rawDate);
      if(!date) continue;
      const rawAmount = amountIdx < row.length ? row[amountIdx] : undefined;
      const amount = Number(String(rawAmount||"").replace(/[^0-9.\-]/g,""));
      if(!Number.isFinite(amount) || amount <= 0) continue;
      const rawLabel = labelIdx != null && labelIdx < row.length ? row[labelIdx] : "";
      const label = String(rawLabel || "Entry").trim() || "Entry";
      const key = iso(date);
      if(!imported[key]) imported[key] = [];
      imported[key].push({ label: label.slice(0,64), amount: Math.round(amount) });
      entriesCount++;
    }
    const dayCount = Object.keys(imported).length;
    if(!entriesCount) throw new Error("No valid rows found. Expect Date, Label and Amount columns.");
    return { store: imported, entries: entriesCount, days: dayCount };
  }

   function dailyGoalIndicator(target, actual){
    if(!Number.isFinite(target)){
      return { indicator: "", title: "" };
    }
    if(target <= 0){
      return {
        indicator: '<span class="pill goal" aria-hidden="true"></span>',
        title: "No daily target"
      };
    }
    const pct = target > 0 ? (actual / target) * 100 : 0;
    const pctRounded = Math.round(pct);
    const label = `${pctRounded}% of daily goal`;
    if(pct >= 150){
      return {
        indicator: '<span class="pace-icon crown" aria-hidden="true">👑</span>',
        title: label
      };
    }
    if(pct >= 125){
      return {
        indicator: '<span class="pace-icon star" aria-hidden="true">⭐</span>',
        title: label
      };
    }
    let cls;
    if(pct < 50){
      cls = "pill goal-low";
    } else if(pct < 100){
      cls = "pill goal-mid";
    } else {
      cls = "pill goal-high";
    }
    return {
      indicator: `<span class="${cls}" aria-hidden="true"></span>`,
      title: label
    };
  }
   
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

  function sumRange(start, end){
    if(!start || !end) return 0;
    const s = sod(start), e = eod(end);
    let sum = 0;
    for(const [k,arr] of Object.entries(store)){
      const d = new Date(k);
      if(d >= s && d <= e){
        sum += (Array.isArray(arr)?arr:[]).reduce((a,x)=>a+(+x.amount||0),0);
      }
    }
    return sum;
  }
   
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
    const now = new Date();
    const y=current.getFullYear(), m=current.getMonth();
    $("#monthLabel").textContent = new Date(y,m,1).toLocaleString(undefined,{month:'long',year:'numeric'});
    grid.innerHTML = "";

    const mask = settings.weekdays || {0:false,1:true,2:true,3:true,4:true,5:true,6:true};
    const start = parseISO(settings.goalStart);
    const end = parseISO(settings.goalEnd);

    const totalWork = workingDaysInRange(start, end, mask);
    const today = sod(now);
    const daysSoFar = workingDaysInRange(start, today, mask);

    const goalAmount = Number(settings.goalAmount||0);
    let progress = Number(settings.goalProgress||0);
    const s = start? sod(start):null, e = end? eod(end):null;
    for(const [k,arr] of Object.entries(store)){
      const d = new Date(k);
      if((!s||d>=s)&&(!e||d<=e)){
        progress += (Array.isArray(arr)?arr:[]).reduce((sum,x)=>sum+(+x.amount||0),0);
      }
    }
     
    const paceByDate = {};
    if (start && end && totalWork > 0) {
      const paceStart = sod(start);
      const paceEnd = sod(end);
      if (paceStart <= paceEnd) {
        let iter = new Date(paceStart);
        let rollingProgress = Number(settings.goalProgress || 0);
        let remainingWorkingDays = totalWork;
        while (iter <= paceEnd) {
          const dayTotal = total(iter);
          if (mask[iter.getDay()]) {
            const remainingGoalForDay = Math.max(0, goalAmount - rollingProgress);
            const remainingWorkingDaysForDay = Math.max(0, remainingWorkingDays);
            const dailyTargetForDay = remainingWorkingDaysForDay > 0 ? (remainingGoalForDay / remainingWorkingDaysForDay) : 0;
            paceByDate[iso(iter)] = dailyTargetForDay;
            if (remainingWorkingDays > 0) remainingWorkingDays -= 1;
          }
          rollingProgress += dayTotal;
          iter.setDate(iter.getDate()+1);
        }
      }
    }

    const remainingGoal = Math.max(0, goalAmount - progress);
    let remainingDays = totalWork - daysSoFar;
    if(remainingDays < 0) remainingDays = 0;
    const daily = remainingDays>0 ? (remainingGoal/remainingDays) : 0;

    const weekStart = new Date(today); weekStart.setDate(weekStart.getDate()-weekStart.getDay());
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate()+6);
    const weekly = daily * workingDaysInRange(weekStart, weekEnd, mask);

    const monthStart = new Date(y,m,1);
    const monthEnd = new Date(y,m+1,0);
    const monthly = daily * workingDaysInRange(monthStart, monthEnd, mask);

    const qStartMonth = Math.floor(m/3)*3;
    const qStart = new Date(y,qStartMonth,1);
    const qEnd = new Date(y,qStartMonth+3,0);
    const qDays = workingDaysInRange(qStart, qEnd, mask);
    const quarterly = daily * qDays;

    const dailyProgress = total(now);
    const weeklyProgress = sumRange(weekStart, weekEnd);
    const monthlyProgress = sumRange(monthStart, monthEnd);
    const quarterlyProgress = sumRange(qStart, qEnd);

    const dailyPct = daily>0 ? (dailyProgress/daily)*100 : 0;
    const weeklyPct = weekly>0 ? (weeklyProgress/weekly)*100 : 0;
    const monthlyPct = monthly>0 ? (monthlyProgress/monthly)*100 : 0;
    const quarterlyPct = quarterly>0 ? (quarterlyProgress/quarterly)*100 : 0;

    const pct = settings.goalAmount > 0 ? (progress / settings.goalAmount) * 100 : 0;

    updateGoalSummary(progress);
     
     kpiDaily.textContent = `${money(daily)} (${dailyPct.toFixed(1)}%)`;
    kpiWeekly.textContent = `${money(weekly)} (${weeklyPct.toFixed(1)}%)`;
    kpiMonthly.textContent = `${money(monthly)} (${monthlyPct.toFixed(1)}%)`;
    kpiQuarterly.textContent = `${money(quarterly)} (${quarterlyPct.toFixed(1)}%)`;
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
      const isoDate = iso(date);
      const cell = document.createElement('div'); cell.className='day'; cell.dataset.date = isoDate;
      /*__TODAY_MARKER__*/
      const now=new Date(); if(date.getFullYear()===now.getFullYear() && date.getMonth()===now.getMonth() && date.getDate()===now.getDate()){ cell.classList.add('today'); }

      const hasPace = isWork && Object.prototype.hasOwnProperty.call(paceByDate, isoDate);
      const paceValue = hasPace ? paceByDate[isoDate] : null;
      const dayTotal = total(date);
      let pace = "";
      if(hasPace && Number.isFinite(paceValue)){
        const { indicator, title: paceTitle } = dailyGoalIndicator(paceValue, dayTotal);
        const attr = paceTitle ? ` title="${paceTitle}" aria-label="${paceTitle}"` : "";
        pace = `<span class="pace"${attr}>${indicator}${money(paceValue)}</span>`;
      }
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
        weekSum += dayTotal;
        const t = document.createElement('div'); t.className='total'; t.innerHTML=`<span>Total</span><span>${money(dayTotal)}</span>`;
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
    goalProgressInp.value = Number(settings.goalProgress||0) || "";
    themeToggle.checked = settings.theme === "light";
    if(sheetLinkInput) sheetLinkInput.value = settings.sheetUrl || "";
    showSheetStatus("", "info");
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
    settings.goalProgress = Number(goalProgressInp.value||0) || 0;
    settings.theme = themeToggle.checked ? "light" : "dark";
    settings.sheetUrl = (sheetLinkInput?.value || "").trim();
    const boxes = Array.from(settingsModal.querySelectorAll("input[type=checkbox][data-wd]"));
    const mask = {...settings.weekdays};
    boxes.forEach(cb=> mask[Number(cb.dataset.wd)] = !!cb.checked);
    settings.weekdays = mask;
    saveJSON(SETTINGS_KEY, settings);
     restartSheetSyncLoop();
     render();
    settingsModal.close();
  });

  if(importSheetBtn){
    importSheetBtn.addEventListener("click", ()=>{
      syncSheetData({ quiet: false });
    });
  }
   
   const helpBtn = $("#helpBtn");
  const helpModal = $("#helpModal");
  if (helpBtn && helpModal) {
    helpBtn.addEventListener("click", () => {
      settingsModal.close();
      if (helpModal.showModal) {
        helpModal.showModal();
        helpModal.addEventListener("close", () => settingsModal.showModal(), { once: true });
      } else {
        helpModal.setAttribute("open", "");
      }
    });
  }
   $("#resetBtn").addEventListener("click", ()=>{
    if(!confirm("Clear all locally saved data and settings?")) return;
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(DATA_KEY);
    settings = {
      goalName: cfg.DEFAULT_GOAL_NAME || "Goal",
      goalAmount: Number(cfg.DEFAULT_GOAL_AMOUNT || 500000),
      goalStart: cfg.DEFAULT_GOAL_START || "",
      goalEnd: cfg.DEFAULT_GOAL_END || "",
      goalProgress: Number(cfg.DEFAULT_GOAL_PROGRESS || 0),
      theme: cfg.DEFAULT_THEME || "dark",
      weekdays: {0:false,1:true,2:true,3:true,4:true,5:true,6:true},
    sheetUrl: cfg.DEFAULT_SHEET_URL || "",
    };
    store = {};
    saveJSON(SETTINGS_KEY, settings);
    saveJSON(DATA_KEY, store);
    restartSheetSyncLoop();
    render();
    showSheetStatus("");
    settingsModal.close();
  });

  // Boot
  render();
   if(settings.sheetUrl){
    syncSheetData({ quiet: true });
  }
  restartSheetSyncLoop();
})();
