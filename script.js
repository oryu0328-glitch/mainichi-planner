(()=>{'use strict';
const KEY='mainichi_planner_v1';const BACKUP_DATE_KEY='mainichi_planner_last_backup_v224';const BACKUP_KEY='mainichi_planner_v2_recovery';const $=s=>document.querySelector(s);const pad=n=>String(n).padStart(2,'0');const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;const parse=s=>new Date(`${s}T12:00:00`);const shift=(s,n)=>{let d=parse(s);d.setDate(d.getDate()+n);return iso(d)};const monthShift=(s,n)=>{let d=parse(s),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);let m=d.getMonth();d.setDate(day);while(d.getMonth()!==m)d.setDate(d.getDate()-1);return iso(d)};const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const today=()=>iso(new Date());const defaultCategories={work:'仕事',private:'プライベート',hobby:'趣味',family:'家族・友人',study:'学校・勉強',meeting:'会議・打ち合わせ',health:'健康・運動',medical:'通院・健康管理',shopping:'買い物',travel:'旅行・お出かけ',anniversary:'記念日・イベント',housework:'家事・生活',finance:'お金・手続き',meal:'食事・外食',other:'その他'};let categories={...defaultCategories};const categoryColors={work:'#9dbde4',private:'#e9a6bb',hobby:'#a6d0b3',family:'#e6c18b',study:'#b8c4ef',meeting:'#a9cbe5',health:'#b1ddc0',medical:'#c2c8e9',shopping:'#efc5a4',travel:'#addbdb',anniversary:'#efb9d5',housework:'#d2d5b0',finance:'#d3c2a4',meal:'#e7c4a9',other:'#d4cbd8'};const themes={pink:['#dc91ab','#f8e2eb','#f1cfdd'],blue:['#7ea9d9','#dfebfa','#cbdff5'],green:['#80b995','#e0f1e5','#cce7d6'],purple:['#a88dd2','#ebe1f9','#ddd0f2'],beige:['#c5a17a','#f1e5d3','#e9d7be']};
const initial=()=>({version:3,customCategories:{...defaultCategories},categoryColors:{...categoryColors},templates:[],notificationEnabled:false,categoryNotifications:{},events:[],todos:[],notes:[],theme:'pink',filters:{...Object.fromEntries(Object.keys(categories).map(k=>[k,true])),todo:true},showCompleted:true,weekStart:0});let data;try{data=JSON.parse(localStorage.getItem(KEY))||initial()}catch{data=initial()}if(!data||!Array.isArray(data.events)||!Array.isArray(data.todos)||!Array.isArray(data.notes))data=initial();data={...initial(),...data,templates:Array.isArray(data.templates)?data.templates:[],filters:{...initial().filters,...data.filters}};categories=data.customCategories&&typeof data.customCategories==='object'&&!Array.isArray(data.customCategories)&&Object.keys(data.customCategories).length?{...data.customCategories}:{...defaultCategories};data.customCategories={...categories};data.categoryColors={...categoryColors,...(data.categoryColors&&typeof data.categoryColors==='object'?data.categoryColors:{})};data.categoryNotifications=data.categoryNotifications&&typeof data.categoryNotifications==='object'&&!Array.isArray(data.categoryNotifications)?data.categoryNotifications:{};for(const k of Object.keys(categories))if(data.filters[k]===undefined)data.filters[k]=true;
const categorySelect=document.querySelector('#categorySelect');function refreshCategorySelect(){categorySelect.innerHTML=Object.entries(categories).map(([key,name])=>`<option value="${esc(key)}">${esc(name)}</option>`).join('')};refreshCategorySelect();const categoryStyle=k=>`style="--category-color:${esc(data.categoryColors[k]||'#d4cbd8')}"`;let undoSnapshot=null,undoTimer=null,dragged=null;let page='home',view='month',selected=today(),anchor=today(),search='';let plannerSearch='',plannerSearchCategory='all',plannerSearchFrom='',plannerSearchTo='',analysisPeriod='week',analysisAnchor=today();const save=()=>{try{const payload=JSON.stringify(data);localStorage.setItem(KEY,payload);return true}catch{alert('保存に失敗しました。容量やブラウザ設定をご確認ください。');return false}};const snapshot=()=>{undoSnapshot=JSON.stringify(data);clearTimeout(undoTimer);$('#undoButton').hidden=false;undoTimer=setTimeout(()=>{$('#undoButton').hidden=true;undoSnapshot=null},30000)};const commit=()=>{if(!save()){if(undoSnapshot){data=JSON.parse(undoSnapshot);undoSnapshot=null;$('#undoButton').hidden=true}render();return false}render();return true};const toast=s=>{const el=$('#toast');el.textContent=s;el.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>el.style.display='none',2300)};const applyTheme=()=>{let t=themes[data.theme]||themes.pink;['--accent','--bg','--soft'].forEach((v,i)=>document.documentElement.style.setProperty(v,t[i]))};const startOfWeek=s=>{let d=parse(s);d.setDate(d.getDate()-(d.getDay()-data.weekStart+7)%7);return iso(d)};
// Calendar dates are local civil dates; calculate differences via UTC to avoid DST rounding.
const dayNumber=s=>Date.parse(s+'T12:00:00Z')/86400000;
const dayDiff=(a,b)=>Math.round(dayNumber(a)-dayNumber(b));
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&iso(parse(s))===s;
function occurrenceStarts(e,date){
 if(!validDate(e.date)||!validDate(date)||date<e.date)return false;
 const until=e.repeatUntil&&validDate(e.repeatUntil)?e.repeatUntil:null;
 if(until&&date>until)return false;
 const diff=dayDiff(date,e.date),repeat=e.repeat||'none';
 if(repeat==='none')return diff===0;
 if(repeat==='daily')return true;
 if(repeat==='weekly')return diff%7===0;
 if(repeat==='weekdays')return [1,2,3,4,5].includes(parse(date).getDay());
 if(repeat==='custom')return (Array.isArray(e.repeatDays)?e.repeatDays:[]).map(Number).includes(parse(date).getDay());
 if(repeat==='monthly')return +date.slice(8)===+e.date.slice(8);
 if(repeat==='yearly')return date.slice(5)===e.date.slice(5);
 return false;
}
function eventOccurs(e,date){
 if(!validDate(date)||!validDate(e.date)||date<e.date)return false;
 const span=e.endDate&&validDate(e.endDate)&&e.endDate>=e.date?Math.min(366,dayDiff(e.endDate,e.date)):0;
 const overnight=!e.allDay&&e.start&&e.end&&e.end<=e.start?1:0;
 // A recurring event may continue for several days, but the recurrence limit applies to its start.
 for(let i=0;i<=Math.max(span,overnight);i++){const start=shift(date,-i);if(occurrenceStarts(e,start)&&!(e.exceptions&&e.exceptions[start]))return true}
 return false;
}
function overlapping(item){
 if(item.allDay||!item.start||!item.end)return [];
 const last=item.repeat==='none'?(item.endDate||item.date):shift(item.date,366);
 const from=item.date,to=item.repeat==='none'?last:shift(item.date,366);
 let conflicts=[];
 for(const e of data.events){
  if(e.id===item.id||e.allDay||!e.start||!e.end||!(e.start<item.end&&item.start<e.end))continue;
  const start=from,end=to;
  // Bound the warning check to a year for indefinite recurrence; existing records are not modified.
  for(let d=start,n=0;d<=end&&n<367;d=shift(d,1),n++){
   if(eventOccurs(item,d)&&eventOccurs(e,d)){conflicts.push(e.title);break}
  }
 }
 return conflicts;
}
// Return actual calendar-day slices, preserving the start date of each recurrence.
function entries(date){
 let a=[];
 const mins=t=>{const p=String(t||'').split(':').map(Number);return p.length===2&&p.every(Number.isFinite)?p[0]*60+p[1]:0};
 for(const e of data.events){
  if(data.filters[e.category]===false)continue;
  const span=e.endDate&&validDate(e.endDate)&&e.endDate>=e.date?Math.min(366,dayDiff(e.endDate,e.date)):0;
  for(let back=0;back<=Math.max(1,span);back++){
   const origin=shift(date,-back);
   if(!occurrenceStarts(e,origin))continue;
   const exception=e.exceptions?.[origin];
   if(exception)continue; // removed or moved occurrence
   const timed=!e.allDay&&e.start&&e.end;
   const durationDays=span||((timed&&mins(e.end)<=mins(e.start))?1:0);
   if(back>durationDays)continue;
   // If this is a single-day event with a next-day end, show only the appropriate slice.
   const startDay=back===0,finalDay=back===durationDays;
   if(timed&&back>0&&!finalDay)continue;
   const start=startDay?e.start:'00:00',end=finalDay?e.end:'24:00';
   a.push({...e,kind:'event',occurrenceDate:origin,segmentStart:start,segmentEnd:end,time:start,display:e.title});
  }
  for(const [origin,change] of Object.entries(e.exceptions||{})){
   if(!change||!validDate(change.date))continue;
   const endDate=change.endDate&&validDate(change.endDate)?change.endDate:change.date;
   if(date<change.date||date>endDate)continue;
   const first=date===change.date,last=date===endDate;
   a.push({...e,...change,id:e.id,kind:'event',occurrenceDate:origin,repeat:'none',segmentStart:first?(change.start||'00:00'):'00:00',segmentEnd:last?(change.end||'24:00'):'24:00',time:first?(change.start||''):'00:00',display:change.title||e.title});
  }
 }
 if(data.filters.todo)for(const t of data.todos){if(t.due===date&&(data.showCompleted||t.status!=='done')&&data.filters[t.category]!==false)a.push({...t,kind:'todo',time:t.dueTime||'',display:'☑ '+t.title})}
 return a.sort((x,y)=>x.time.localeCompare(y.time)||x.display.localeCompare(y.display));
}

const chip=x=>`<button ${x.kind==='event'?categoryStyle(x.category):''} draggable="${x.kind==='event'}" data-drag="${esc(x.id)}" class="chip ${x.kind==='todo'?'todo':esc(x.category)} ${x.status==='done'?'done':''}" data-edit="${esc(x.kind)}:${esc(x.id)}" data-occurrence="${esc(x.occurrenceDate||'')}" title="${esc(x.display)}">${esc(x.time?x.time+' ':'')}${esc(x.display)}</button>`;const row=x=>`<div class="rowitem"><span ${x.kind==='event'?categoryStyle(x.category):''} class="dot ${x.kind==='todo'?'todo-dot':esc(x.category)}"></span>${x.kind==='todo'?`<input aria-label="完了切替" class="taskcheck" type="checkbox" data-toggle="${esc(x.id)}" ${x.status==='done'?'checked':''}>`:''}<div class="grow ${x.status==='done'?'strike':''}"><strong>${esc(x.title)}</strong><div class="small muted">${esc(x.kind==='todo'?'ToDo':categories[x.category]||'予定')} ${esc(x.time||'')} ${esc(x.due||'')}</div></div><button data-edit="${esc(x.kind)}:${esc(x.id)}" data-occurrence="${esc(x.occurrenceDate||'')}">編集</button></div>`;
function home(){const items=entries(today()),remaining=data.todos.filter(x=>x.status!=='done').length,finished=data.todos.filter(x=>x.status==='done').length;return `${backupReminderBanner()}<div class="grid2"><div class="panel"><div class="muted">今日の予定</div><div class="stat">${items.filter(x=>x.kind==='event').length} 件</div></div><div class="panel"><div class="muted">未完了ToDo</div><div class="stat">${remaining} 件</div></div></div><div class="panel"><div class="between"><h3>今日の時間割</h3><button data-page="calendar">カレンダーへ →</button></div><p class="small muted">予定のある時間帯を表示・空き時間はそのまま</p>${dailyTimeline(items)}</div><div class="panel"><h3>今日のスケジュール</h3>${items.map(row).join('')||'<div class="empty">今日の予定はありません</div>'}</div><div class="grid2 home-preview-panels"><div class="panel"><div class="between"><h3>ToDo</h3><button data-page="todos">すべて見る →</button></div><div class="home-preview-scroll" tabindex="0" aria-label="ホームのToDo一覧">${data.todos.filter(x=>x.status!=='done').slice(0,6).map(x=>`<div class="home-mini"><label><input type="checkbox" data-toggle="${esc(x.id)}"> ${esc(x.title)}</label><small>${esc(x.memo||'')} ${esc(x.due||'')}</small></div>`).join('')||'<div class="empty">未完了ToDoなし</div>'}</div></div><div class="panel"><div class="between"><h3>メモ</h3><button data-page="notes">すべて見る →</button></div><div class="home-preview-scroll" tabindex="0" aria-label="ホームのメモ一覧">${data.notes.slice(-4).reverse().map(x=>`<div class="home-mini"><strong>${esc(x.title)}</strong><small>${esc(x.memo||'')}</small><button data-edit="note:${esc(x.id)}">編集</button></div>`).join('')||'<div class="empty">メモなし</div>'}</div></div></div><div class="panel"><h3>ToDo達成状況 ${finished}/${data.todos.length}</h3><progress style="width:100%;accent-color:var(--accent)" max="${Math.max(data.todos.length,1)}" value="${finished}"></progress></div>`}
function calendarTimeline(html){
 const label=calendarTimelineExpanded?'− 折りたたむ':'＋ 詳しく見る';
 return `<div class="calendar-fold-controls"><button type="button" data-calendar-toggle="1" aria-expanded="${calendarTimelineExpanded}">${label}</button></div><div class="calendar-fold ${calendarTimelineExpanded?'is-expanded':'is-collapsed'}">${html}</div>`;
}
function calendar(){let label=view==='month'?`${anchor.slice(0,4)}年${+anchor.slice(5,7)}月`:view==='week'?`${startOfWeek(anchor)} から1週間`:`${selected}`;let filter=`<div class="filter-toolbar"><span class="filter-caption">表示するカテゴリー</span><div class="filter-actions"><button type="button" data-filter-all="true">全選択</button><button type="button" data-filter-all="false">全解除</button></div></div><div class="filters-scroll"><div class="filters">${Object.entries({...categories,todo:'期限付きToDo'}).map(([k,v])=>`<label><input type="checkbox" data-filter="${k}" ${data.filters[k]?'checked':''}> ${esc(v)}</label>`).join('')}<label><input type="checkbox" id="completedFilter" ${data.showCompleted?'checked':''}> 完了済みを表示</label></div></div>`;let body='';if(view==='month'){let d=parse(anchor);d.setDate(1);let first=iso(d),offset=(d.getDay()-data.weekStart+7)%7,start=shift(first,-offset);body=`<div class="calendar">${Array.from({length:7},(_,i)=>`<div class="weekday">${'日月火水木金土'[(i+data.weekStart)%7]}</div>`).join('')}${Array.from({length:42},(_,i)=>{let day=shift(start,i),es=entries(day);return `<div data-drop-date="${day}" class="day ${day.slice(0,7)!==anchor.slice(0,7)?'outside':''} ${day===selected?'selected':''} ${day===today()?'today':''}"><button class="daynum" data-date="${day}">${+day.slice(8)}</button>${es.slice(0,3).map(chip).join('')}${es.length>3?`<button class="chip" data-date="${day}">他${es.length-3}件</button>`:''}</div>`}).join('')}</div>`}else if(view==='week'){let start=startOfWeek(anchor);body=calendarTimeline(timeGrid(Array.from({length:7},(_,i)=>shift(start,i)),'week'))}else body=`<div class="daylist"><button class="primary" data-date="${selected}">＋ この日の追加・編集</button>${calendarTimeline(timeGrid([selected],'day'))}</div>`;return `<div class="panel"><div class="row" style="flex-wrap:wrap;margin-bottom:10px"><button data-page="eventSearch">🔎 予定検索</button><button data-page="analysis">▥ 時間分析</button></div><div class="toolbar"><button id="prev">‹</button><button id="goToday">今日</button><button id="next">›</button><strong>${esc(label)}</strong><span class="spacer"></span><button data-view="month" ${view==='month'?'class="primary"':''}>月</button><button data-view="week" ${view==='week'?'class="primary"':''}>週</button><button data-view="day" ${view==='day'?'class="primary"':''}>日</button></div>${filter}</div><div class="panel">${body}</div><div class="panel"><div class="between"><h3>${selected} の予定</h3><div class="calendar-add-actions"><button type="button" data-open-templates="1">予定テンプレ</button><button data-new="event">＋ 新規作成</button></div></div>${entries(selected).map(row).join('')||'<div class="empty">予定はありません</div>'}</div>`}
function showDayActions(day){selected=day;anchor=day;$('#dayActionDate').textContent=day;const es=entries(day).filter(x=>x.kind==='event');$('#dayActionList').innerHTML=es.length?es.map(x=>`<button type="button" data-choice-edit="${esc(x.id)}" data-occurrence="${esc(x.occurrenceDate||day)}">${esc(x.start||'終日')} ${esc(x.title)}　編集 ›</button>`).join(''):'<p class="muted">この日の予定はありません</p>';$('#dayActionDialog').showModal()}
let lastOccurrenceContext=null;function showRepeatChoice(id,date){lastOccurrenceContext=date;const single=confirm('この日だけ編集しますか？\nOK：この回だけ変更\nキャンセル：繰り返し全体を変更');openForm('event',id,single?date:null)}
$('#editorCloseX').addEventListener('click',closeForm);
$('#dayActionCloseX').addEventListener('click',()=>$('#dayActionDialog').close());
$('#paletteCloseX').addEventListener('click',()=>$('#colorPaletteDialog').close());
$('#dayActionDialog').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.choiceEdit){$('#dayActionDialog').close();const ev=data.events.find(x=>x.id===b.dataset.choiceEdit);if(ev?.repeat&&ev.repeat!=='none')showRepeatChoice(ev.id,b.dataset.occurrence);else openForm('event',b.dataset.choiceEdit)}else if(b.id==='dayActionNew'){$('#dayActionDialog').close();openForm('event')}else if(b.id==='dayActionClose')$('#dayActionDialog').close()});
// Unified vertical time grids: home/day and seven-column week.
function gridSegments(day){
 return entries(day).filter(x=>x.kind==='event'&&!x.allDay&&/^\d{2}:\d{2}$/.test(x.segmentStart||x.start||'')&&/^\d{2}:\d{2}$/.test(x.segmentEnd||x.end||'')).map(x=>{
  const mins=t=>{const [h,m]=t.split(':').map(Number);return h*60+m};
  return {...x,begin:mins(x.segmentStart||x.start),finish:mins(x.segmentEnd||x.end)};
 }).filter(x=>x.finish>x.begin);
}
function gridRange(days){
 const all=days.flatMap(gridSegments);
 if(!all.length)return null;
 return {start:Math.max(0,Math.floor(Math.min(...all.map(x=>x.begin))/60)),end:Math.min(24,Math.ceil(Math.max(...all.map(x=>x.finish))/60))};
}
// Assign equal-width lanes within each connected group of overlapping events.
function layoutOverlaps(items){
 // Keep original insertion order: the first saved event gets the left lane.
 // All events in a connected overlap group share the same column count.
 const sourceOrder=e=>{const i=data.events.findIndex(x=>x.id===e.id);return i<0?Number.MAX_SAFE_INTEGER:i};
 const ordered=[...items].sort((a,b)=>a.begin-b.begin||a.finish-b.finish||sourceOrder(a)-sourceOrder(b));
 const groups=[];let group=[],end=-1;
 for(const e of ordered){if(group.length&&e.begin>=end){groups.push(group);group=[];end=-1}group.push(e);end=Math.max(end,e.finish)}
 if(group.length)groups.push(group);
 return groups.flatMap(g=>{
  // Assign stable lanes by saved order, while allowing non-overlapping events to reuse a lane.
  const byCreation=[...g].sort((a,b)=>sourceOrder(a)-sourceOrder(b)||a.begin-b.begin);
  const lanes=[];const placed=[];
  for(const e of byCreation){let lane=lanes.findIndex(list=>list.every(x=>x.finish<=e.begin||e.finish<=x.begin));
   if(lane<0){lane=lanes.length;lanes.push([])}lanes[lane].push(e);placed.push({...e,lane});}
  return placed.map(e=>({...e,laneCount:lanes.length}));
 });
}
let monthArmedDate=null;
let calendarTimelineExpanded=false;
function handleCalendarDateTap(day){
 if(view==='month'){
  if(monthArmedDate!==day){monthArmedDate=day;selected=day;render();return}
  monthArmedDate=null;
 }
 selected=day;anchor=day;showDayActions(day);
}
function resetCalendarZoom(){
 // Preserve pinch-to-zoom accessibility; reset page scroll on navigation.
 window.scrollTo({top:0,left:0,behavior:'instant'});
}
function openCalendarTemplates(){
 const templates=data.templates||[];
 if(!templates.length){toast('テンプレートはまだありません。予定編集画面で「テンプレ保存」してください');return}
 const menu=document.createElement('dialog');menu.className='choice-dialog template-picker';
 menu.innerHTML=`<h3>予定テンプレートを選択</h3><div class="choice-list">${templates.map(t=>`<button type="button" data-pick-template="${esc(t.id)}">${esc(t.title)}</button>`).join('')}</div><div class="actions"><button type="button" data-close-templates="1">閉じる</button></div>`;
 document.body.appendChild(menu);menu.addEventListener('close',()=>menu.remove());menu.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.closeTemplates){menu.close();return}if(b.dataset.pickTemplate){const id=b.dataset.pickTemplate;menu.close();applyTemplate(id)}});menu.showModal();
}
function applyTemplate(id){
 const t=(data.templates||[]).find(x=>x.id===id);if(!t)return;
 openForm('event');const f=$('#editForm');for(const k of ['title','memo','start','end','category','place','repeat','reminder','notifyMode'])if(t[k]!=null&&f.elements[k])f.elements[k].value=t[k];
 f.elements.allDay.checked=!!t.allDay;$('#timeFields').hidden=!!t.allDay;toast('テンプレートを読み込みました');
}
function nowLine(start,end,unit,days){
 const d=new Date(),clock=d.getHours()*60+d.getMinutes();
 if(!days.includes(today())||clock<start*60||clock>end*60)return '';
 const y=(clock-start*60)*unit/60;
 return `<div class="planner-now-line" style="top:${y}px" aria-label="現在時刻 ${pad(d.getHours())}:${pad(d.getMinutes())}"><span>● ${pad(d.getHours())}:${pad(d.getMinutes())}</span></div>`;
}
function timeGrid(days,mode='day'){
 const single=days.length===1,compactWeek=mode==='week'&&!calendarTimelineExpanded;
 const range=gridRange(days); // Trim unused hours at both ends in compact and expanded week views; keep gaps between events.
 const allday=days.map(d=>entries(d).filter(x=>x.kind==='event'&&x.allDay));
 if(!range&&!allday.some(x=>x.length))return '<p class="muted small">この期間の予定はありません。</p>';
 const topAll=allday.some(x=>x.length)?`<div class="tg-allday"><span>終日</span>${days.map((d,i)=>`<div class="tg-allday-col">${allday[i].map(x=>`<button type="button" class="tg-allchip" style="--tg-color:${esc(data.categoryColors[x.category]||'#d4cbd8')}" data-edit="event:${esc(x.id)}" data-occurrence="${esc(x.occurrenceDate||d)}">${esc(x.title)}</button>`).join('')}</div>`).join('')}</div>`:'';
 if(!range)return `<div class="tg-scroll ${single?'tg-day tg-single':'tg-week'}"><div class="tg-inner">${topAll}</div></div>`;
 const unit=compactWeek?12:30, height=(range.end-range.start)*unit;
 const ticks=Array.from({length:range.end-range.start+1},(_,i)=>`<div class="tg-tick" style="top:${i*unit}px"><span>${String(range.start+i).padStart(2,'0')}:00</span></div>`).join('');
 const cols=days.map((d,di)=>{
  const ev=layoutOverlaps(gridSegments(d));
  const blocks=ev.map(e=>{
   const top=(e.begin-range.start*60)*unit/60;
   const bottom=(e.finish-range.start*60)*unit/60;
   const color=esc(data.categoryColors[e.category]||'#d4cbd8');
   // Thin duration rail and translucent fill keep long events visually light.
   return `<div class="tg-duration" style="top:${top}px;height:${Math.max(2,bottom-top)}px;--tg-color:${color};left:calc(${e.lane} * 100% / ${e.laneCount} + 2px) !important;right:auto !important;width:calc(100% / ${e.laneCount} - 4px)" aria-hidden="true"></div><button type="button" class="tg-event" style="top:${top}px;--tg-color:${color};left:calc(${e.lane} * 100% / ${e.laneCount} + 2px) !important;right:auto !important;width:calc(100% / ${e.laneCount} - 4px)" data-edit="event:${esc(e.id)}" data-occurrence="${esc(e.occurrenceDate||d)}" title="${esc(e.title)} ${esc(e.segmentStart||e.start)}〜${esc(e.segmentEnd||e.end)}"><strong>${esc(e.title)}</strong><small>${esc(e.segmentStart||e.start)}〜${esc(e.segmentEnd||e.end)}</small></button>`;
  }).join('');
  return `<div class="tg-column" data-drop-date="${d}" style="height:${height}px">${blocks}</div>`;
 }).join('');
 const heads=single?'':`<div class="tg-head"><span>時間</span>${days.map(d=>`<button type="button" data-date="${d}">${d.slice(5).replace('-','/')}<small>${'日月火水木金土'[parse(d).getDay()]}</small></button>`).join('')}</div>`;
 return `<div class="tg-scroll ${single?'tg-day tg-single':'tg-week'}"><div class="tg-inner">${heads}${topAll}<div class="tg-body" style="height:${height}px">${nowLine(range.start,range.end,unit,days)}<div class="tg-times">${ticks}</div><div class="tg-columns">${cols}</div></div></div></div>`;
}
// Home-only condensed timeline. Day/week calendar grids remain unchanged.
let homeTimelineExpanded=false;
function dailyTimeline(items){
 const day=today(),segments=gridSegments(day).sort((a,b)=>a.begin-b.begin||a.finish-b.finish);
 const allDay=entries(day).filter(x=>x.kind==='event'&&x.allDay);
 if(!segments.length&&!allDay.length)return '<p class="muted small">今日の予定はありません。</p>';
 const allDayHtml=allDay.length?`<div class="mini-allday">${allDay.map(e=>`<button type="button" class="mini-chip" style="--mini-color:${esc(data.categoryColors[e.category]||'#d4cbd8')}" data-edit="event:${esc(e.id)}" data-occurrence="${esc(e.occurrenceDate||day)}">終日 · ${esc(e.title)}</button>`).join('')}</div>`:'';
 if(!segments.length)return allDayHtml;
 const start=Math.max(0,Math.floor(Math.min(...segments.map(e=>e.begin))/60)),end=Math.min(24,Math.ceil(Math.max(...segments.map(e=>e.finish))/60));
 const span=end-start,unit=homeTimelineExpanded?42:12;
 const summary=`<div class="mini-summary">${String(start).padStart(2,'0')}:00 〜 ${String(end).padStart(2,'0')}:00 · ${segments.length}件</div>`;
 const ticks=Array.from({length:span+1},(_,i)=>`<div class="mini-tick" style="top:${i*unit}px"><span>${String(start+i).padStart(2,'0')}:00</span></div>`).join('');
 const blocks=layoutOverlaps(segments).map(e=>{
   const top=(e.begin-start*60)*unit/60,height=(e.finish-e.begin)*unit/60;
   const color=esc(data.categoryColors[e.category]||'#d4cbd8');
   const duration=`${esc(e.segmentStart||e.start)}〜${esc(e.segmentEnd||e.end)}`;
   return `<div class="mini-duration" style="top:${top}px;height:${Math.max(height,2)}px;left:calc(${e.lane} * 100% / ${e.laneCount} + 2px) !important;right:auto !important;width:calc(100% / ${e.laneCount} - 4px);--mini-color:${color}"></div><button type="button" class="mini-event" style="top:${top}px;left:calc(${e.lane} * 100% / ${e.laneCount} + 2px) !important;right:auto !important;width:calc(100% / ${e.laneCount} - 4px);--mini-color:${color}" data-edit="event:${esc(e.id)}" data-occurrence="${esc(e.occurrenceDate||day)}" title="${esc(e.title)} ${duration}"><strong>${esc(e.title)}</strong>${homeTimelineExpanded?`<small>${duration}</small>`:''}</button>`;
 }).join('');
 return `${allDayHtml}<div class="mini-controls">${summary}<button type="button" data-mini-toggle="1" aria-expanded="${homeTimelineExpanded}" aria-label="時間割を${homeTimelineExpanded?'折りたたむ':'展開する'}">${homeTimelineExpanded?'− 折りたたむ':'＋ 詳しく見る'}</button></div><div class="mini-grid ${homeTimelineExpanded?'mini-expanded':'mini-collapsed'}" style="height:${span*unit}px">${nowLine(start,end,unit,[day])}<div class="mini-times">${ticks}</div><div class="mini-track">${blocks}</div></div>`;
}
function todos(){let list=data.todos.filter(t=>`${t.title} ${t.memo||''}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(a.status==='done')-(b.status==='done')||(a.due||'9999').localeCompare(b.due||'9999'));return `<div class="panel"><div class="between"><h3>ToDoリスト</h3><button class="primary" data-new="todo">＋ ToDo</button></div><input id="searchTodo" placeholder="タスクを検索" value="${esc(search)}" aria-label="ToDo検索"><p class="muted small">期限を設定したToDoはカレンダーに自動表示されます。</p>${list.map(t=>row({...t,kind:'todo'})).join('')||'<div class="empty">ToDoがありません</div>'}</div>`}
function notes(){return `<div class="panel"><div class="between"><h3>メモ一覧</h3><button class="primary" data-new="note">＋ メモ</button></div>${data.notes.map(n=>`<div class="rowitem"><div class="grow"><strong>${esc(n.title)}</strong><p class="small muted">${esc((n.memo||'').slice(0,140))}</p></div><button data-edit="note:${esc(n.id)}">編集</button></div>`).join('')||'<div class="empty">メモはまだありません</div>'}</div>`}
function categoryManager(){return `<div class="panel"><div class="between"><h3>カテゴリーをカスタマイズ</h3><span class="small muted">${Object.keys(categories).length}件</span></div><p class="small muted">名前と色はいつでも変更できます。カテゴリーを削除しても、予定やToDoは別のカテゴリーへ移せます。</p><div class="category-manager">${Object.entries(categories).map(([k,v])=>`<div class="category-item"><span class="category-swatch" style="background:${esc(data.categoryColors[k]||'#d4cbd8')}"></span><span class="category-name">${esc(v)}</span><div class="category-buttons"><button type="button" data-rename-category="${esc(k)}">名前</button><button type="button" data-color-category="${esc(k)}">色</button><button type="button" data-delete-category="${esc(k)}" class="danger">削除</button></div></div>`).join('')}</div><button type="button" class="primary" data-add-category="1">＋ カテゴリーを追加</button></div>`}
function searchEventsPage(){
 const all=[];const from=plannerSearchFrom||shift(today(),-365),to=plannerSearchTo||shift(today(),365);
 if(to<from)return '<div class="panel">開始日が終了日より後です。</div>';
 // Bound search to one year for responsive mobile operation.
 const end=dayDiff(to,from)>366?shift(from,366):to;
 for(let d=from;d<=end;d=shift(d,1))for(const x of entries(d)){
  if(x.kind!=='event')continue;
  if(plannerSearchCategory!=='all'&&x.category!==plannerSearchCategory)continue;
  if(plannerSearch&&!`${x.title} ${x.memo||''} ${x.place||''} ${categories[x.category]||''}`.toLowerCase().includes(plannerSearch.toLowerCase()))continue;
  all.push({...x,searchDate:d});if(all.length>=250)break;
 }
 const shown=all.slice(0,250);
 return `<div class="panel"><h3>予定を検索</h3><label>キーワード<input id="plannerSearch" value="${esc(plannerSearch)}" placeholder="予定名・メモ・場所"></label><div class="two"><label>開始日<input type="date" id="plannerSearchFrom" value="${esc(plannerSearchFrom)}"></label><label>終了日<input type="date" id="plannerSearchTo" value="${esc(plannerSearchTo)}"></label></div><label>カテゴリー<select id="plannerSearchCategory"><option value="all">すべて</option>${Object.entries(categories).map(([k,v])=>`<option value="${esc(k)}" ${plannerSearchCategory===k?'selected':''}>${esc(v)}</option>`).join('')}</select></label><button class="primary" data-run-search="1">検索する</button><p class="small muted">未指定の場合は前後1年間。検索範囲は最大367日、結果は最大250件です。現在のカテゴリー表示設定に従います。</p></div><div class="panel"><h3>検索結果 ${shown.length}件</h3>${shown.map(x=>`<div class="rowitem"><div class="grow"><strong>${esc(x.title)}</strong><div class="small muted">${esc(x.searchDate)} ${esc(x.segmentStart||x.start||'終日')}　${esc(categories[x.category]||'')}</div></div><button data-jump-date="${esc(x.searchDate)}">表示</button><button data-edit="event:${esc(x.id)}" data-occurrence="${esc(x.occurrenceDate||x.searchDate)}">編集</button></div>`).join('')||'<div class="empty">該当する予定はありません</div>'}</div>`;
}
function analysisPage(){
 const begin=analysisPeriod==='day'?analysisAnchor:analysisPeriod==='week'?startOfWeek(analysisAnchor):analysisAnchor.slice(0,7)+'-01';
 const finish=analysisPeriod==='day'?begin:analysisPeriod==='week'?shift(begin,6):shift(monthShift(begin,1),-1);
 const totals={};let count=0;
 for(let d=begin;d<=finish;d=shift(d,1))for(const x of gridSegments(d)){
  totals[x.category]=(totals[x.category]||0)+(x.finish-x.begin);count++;
 }
 const sorted=Object.entries(totals).sort((a,b)=>b[1]-a[1]),max=Math.max(1,...sorted.map(x=>x[1]));
 return `<div class="panel"><div class="between"><h3>カテゴリー別の時間分析</h3><div><button data-analysis-prev="1">‹</button><button data-analysis-next="1">›</button></div></div><div class="row" style="flex-wrap:wrap">${[['day','日'],['week','週'],['month','月']].map(([v,n])=>`<button data-analysis-period="${v}" ${analysisPeriod===v?'class="primary"':''}>${n}</button>`).join('')}</div><p class="muted">${begin} 〜 ${finish}</p><p class="small muted">重複する予定はそれぞれの時間を集計。終日予定は時間に換算しません。カテゴリーの表示フィルターに従います。</p>${sorted.map(([k,v])=>`<div class="analysis-item"><div class="between"><strong>${esc(categories[k]||k)}</strong><span>${Math.floor(v/60)}時間${v%60}分</span></div><div class="analysis-bar"><div style="width:${v/max*100}%;background:${esc(data.categoryColors[k]||'#d4cbd8')}"></div></div></div>`).join('')||'<div class="empty">集計できる予定はありません</div>'}<p class="muted small">集計した予定区間：${count}件</p></div>`;
}
function backupReminderBanner(){const last=localStorage.getItem(BACKUP_DATE_KEY);return (!last||!validDate(last)||dayDiff(today(),last)>=14)?`<div class="panel backup-warning">バックアップから14日以上経過、または保存記録がありません。<button data-page="settings">バックアップする</button></div>`:''}
function backupStatus(){const last=localStorage.getItem(BACKUP_DATE_KEY);const days=last&&validDate(last)?dayDiff(today(),last):null;const due=days===null||days>=14;return `<div class="panel"><h3>バックアップのお知らせ</h3><p class="${due?'backup-warning':'muted'}">${days===null?'このバージョンではまだバックアップ記録がありません。':`最後のバックアップ：${esc(last)}（${Math.max(0,days)}日前）`}${due?'　14日ごとのバックアップをおすすめします。':''}</p><button data-page="settings">バックアップを保存する →</button><p class="small muted">ダウンロードボタンを押した日を記録します。実際にファイルが保存されたかも確認してください。</p></div>`}
function settings(){return `${backupStatus()}${categoryManager()}<div class="panel"><h3>カテゴリー別の通知</h3><p class="small muted">チェックを外したカテゴリーは、通知設定が「カテゴリーに従う」の予定を通知しません。予定ごとに通知のオン・オフを指定することもできます。</p><div class="row" style="flex-wrap:wrap;margin:10px 0"><button id="notifyPermission" type="button">通知を許可・確認</button><button id="testNotification" type="button">テスト通知を送る</button><span id="notifyState" class="small muted">${typeof Notification==='undefined'?'この環境では非対応':Notification.permission}</span></div><p class="small muted">通知はホーム画面に追加したアプリで許可してください。現在の方式ではアプリを閉じた状態の通知は保証できません。</p><div class="notification-category-list">${Object.entries(categories).map(([k,v])=>`<label class="notification-category-item"><input type="checkbox" data-category-notification="${esc(k)}" ${data.categoryNotifications[k]!==false?'checked':''}><span class="dot" ${categoryStyle(k)}></span><span>${esc(v)}</span></label>`).join('')}</div></div><div class="panel"><h3>予定テンプレート</h3><p class="small muted">予定の編集画面からテンプレートに保存できます。</p>${(data.templates||[]).map(x=>`<div class="rowitem"><div class="grow"><strong>${esc(x.title)}</strong><div class="small muted">${esc(categories[x.category]||'予定')}</div></div><button data-template="${esc(x.id)}">使う</button><button data-remove-template="${esc(x.id)}">削除</button></div>`).join('')||'<p class="muted small">テンプレートはまだありません</p>'}</div><div class="panel"><h3>テーマカラー</h3><div class="row">${Object.entries(themes).map(([name,t])=>`<button data-theme="${name}" class="themebox ${data.theme===name?'chosen':''}" style="background:${t[0]}" title="${name}" aria-label="${name}"></button>`).join('')}</div></div><div class="panel"><h3>表示設定</h3><label>週の開始曜日 <select id="weekStart"><option value="0" ${data.weekStart===0?'selected':''}>日曜日</option><option value="1" ${data.weekStart===1?'selected':''}>月曜日</option></select></label></div><div class="panel"><h3>データのバックアップ</h3><p class="small muted">14日以上保存していない場合はホーム・設定にお知らせします。</p><p class="muted small">このブラウザに保存された予定・ToDo・メモ・設定をJSON形式で書き出します。</p><div class="row"><button id="export">バックアップを保存</button><label class="primary" style="border-radius:12px;padding:10px 14px;cursor:pointer">バックアップを復元<input id="import" type="file" accept=".json,application/json" hidden></label></div></div><div class="panel"><h3>データの取り扱い</h3><p class="muted small">データは現在のブラウザ内に保存され、端末間では同期されません。共有端末での機密情報の入力は避けてください。</p></div>`}
function syncCategories(){if(!data.categoryNotifications||typeof data.categoryNotifications!=='object'||Array.isArray(data.categoryNotifications))data.categoryNotifications={};categories=data.customCategories&&typeof data.customCategories==='object'&&!Array.isArray(data.customCategories)&&Object.keys(data.customCategories).length?{...data.customCategories}:{...defaultCategories};data.customCategories={...categories};data.categoryColors={...categoryColors,...(data.categoryColors||{})};for(const k of Object.keys(categories))if(data.filters[k]===undefined)data.filters[k]=true;refreshCategorySelect()}function render(){syncCategories();applyTheme();$('#todayLabel').textContent=new Date().toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'long'});$('#pageTitle').textContent=({home:'ホーム',calendar:'カレンダー',todos:'ToDo',notes:'メモ',analysis:'分析',eventSearch:'予定検索',settings:'設定'})[page];$('#addButton').hidden=page==='settings'||page==='todos'||page==='notes'||page==='analysis'||page==='eventSearch';document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('#content').innerHTML=({home,calendar,todos,notes,settings,analysis:analysisPage,eventSearch:searchEventsPage})[page]();}
let editingOccurrence=null;function openForm(kind,id,occurrenceDate=null){editingOccurrence=null;let list=kind==='event'?data.events:kind==='todo'?data.todos:data.notes,item=list.find(x=>x.id===id)||{},f=$('#editForm');if(kind==='event'&&id&&occurrenceDate&&item.repeat&&item.repeat!=='none'){editingOccurrence={id,date:occurrenceDate};const exception=item.exceptions?.[occurrenceDate];item={...item,...(exception||{}),date:exception?.date||occurrenceDate,endDate:exception?.endDate||(item.endDate&&dayDiff(item.endDate,item.date)>0?shift(occurrenceDate,dayDiff(item.endDate,item.date)):occurrenceDate),repeat:'none',repeatUntil:'',repeatDays:[]}}f.reset();f.elements.id.value=id||'';f.elements.kind.value=kind;f.elements.title.value=item.title||'';f.elements.memo.value=item.memo||'';$('#formTitle').textContent=(id?'編集：':'新規：')+({event:'予定',todo:'ToDo',note:'メモ'})[kind];$('#eventFields').hidden=kind!=='event';$('#todoFields').hidden=kind!=='todo';$('#categoryField').hidden=kind==='note';$('#deleteButton').hidden=!id;$('#duplicateButton').hidden=kind!=='event'||!id;$('#moveButton').hidden=kind!=='event'||!id;$('#templateSaveButton').hidden=kind!=='event';$('#eventExtras').hidden=kind!=='event';$('#noteLinkField').hidden=kind!=='note';if(item.category&&!categories[item.category]&&!f.elements.category.querySelector('[data-legacy]')){const legacy=document.createElement('option');legacy.value=item.category;legacy.textContent='以前のカテゴリー（'+item.category+'）';legacy.dataset.legacy='true';f.elements.category.appendChild(legacy)}f.elements.category.value=item.category||'work';f.elements.date.value=item.date||selected;f.elements.endDate.value=item.endDate||item.date||selected;f.elements.allDay.checked=item.allDay??false;f.elements.start.value=item.start||'09:00';f.elements.end.value=item.end||'10:00';f.elements.repeat.value=item.repeat||'none';f.elements.repeatUntil.value=item.repeatUntil||'';f.querySelectorAll('[name=repeatDay]').forEach(c=>c.checked=(item.repeatDays||[]).map(Number).includes(Number(c.value)));$('#repeatDaysField').hidden=f.elements.repeat.value!=='custom';f.elements.reminder.value=item.reminder??'30';f.elements.notifyMode.value=item.notifyMode||(id?'inherit':'inherit');f.elements.place.value=item.place||'';f.elements.due.value=item.due||'';f.elements.dueTime.value=item.dueTime||'';f.elements.priority.value=item.priority||'medium';f.elements.status.value=item.status||'todo';f.elements.related.innerHTML='<option value="">なし</option>'+data.events.map(e=>`<option value="${esc(e.id)}">${esc(e.title)}</option>`).join('');f.elements.related.value=item.related||'';f.elements.relatedNote.innerHTML='<option value="">なし</option>'+data.notes.map(n=>`<option value="${esc(n.id)}">${esc(n.title)}</option>`).join('');f.elements.relatedNote.value=item.relatedNote||'';f.elements.noteEvent.innerHTML='<option value="">なし</option>'+data.events.map(e=>`<option value="${esc(e.id)}">${esc(e.title)}</option>`).join('');f.elements.noteEvent.value=item.noteEvent||'';f.elements.noteTodo.innerHTML='<option value="">なし</option>'+data.todos.map(e=>`<option value="${esc(e.id)}">${esc(e.title)}</option>`).join('');f.elements.noteTodo.value=item.noteTodo||'';$('#timeFields').hidden=kind==='event'&&f.elements.allDay.checked;$('#editor').showModal()}
function closeForm(){editingOccurrence=null;lastOccurrenceContext=null;$('#editor').close()};function storeForm(e){e.preventDefault();let f=e.currentTarget,kind=f.elements.kind.value,id=f.elements.id.value||uid(),title=f.elements.title.value.trim(),memo=f.elements.memo.value.trim();if(!title)return alert('タイトルを入力してください');let previous=(kind==='event'?data.events:kind==='todo'?data.todos:data.notes).find(x=>x.id===id);let item={...previous,id,title,memo};if(kind==='event'){let date=f.elements.date.value,endDate=f.elements.endDate.value||date,allDay=f.elements.allDay.checked,start=f.elements.start.value,end=f.elements.end.value;if(!date||endDate<date)return alert('日付を確認してください');if(!allDay&&(!start||!end))return alert('開始・終了時刻を確認してください');if(!allDay&&date===endDate&&start>end)endDate=shift(date,1);if(!allDay&&date===endDate&&start===end)return alert('開始・終了時刻が同じです');if(f.elements.repeat.value==='custom'&&!f.querySelector('[name=repeatDay]:checked'))return alert('繰り返す曜日を選択してください');if(f.elements.repeatUntil.value&&f.elements.repeatUntil.value<date)return alert('繰り返し終了日を確認してください');Object.assign(item,{date,endDate,allDay,start:allDay?'':start,end:allDay?'':end,category:f.elements.category.value,repeat:f.elements.repeat.value,repeatDays:[...f.querySelectorAll('[name=repeatDay]:checked')].map(x=>Number(x.value)),repeatUntil:f.elements.repeatUntil.value,reminder:f.elements.reminder.value,notifyMode:f.elements.notifyMode.value,place:f.elements.place.value.trim()})}if(kind==='todo')Object.assign(item,{due:f.elements.due.value,dueTime:f.elements.dueTime.value,priority:f.elements.priority.value,status:f.elements.status.value,category:f.elements.category.value,related:f.elements.related.value,relatedNote:f.elements.relatedNote.value});if(kind==='note')Object.assign(item,{noteEvent:f.elements.noteEvent.value,noteTodo:f.elements.noteTodo.value});if(kind==='event'&&editingOccurrence){const original=data.events.find(x=>x.id===editingOccurrence.id);if(original){snapshot();const exception={...item,repeat:'none'};delete exception.exceptions;original.exceptions={...(original.exceptions||{}),[editingOccurrence.date]:exception};if(!commit())return;editingOccurrence=null;closeForm();toast('この回だけ変更しました');return}}if(kind==='event'){let conflicts=overlapping(item);if(conflicts.length&&!confirm('時間が重なる予定があります：'+conflicts.slice(0,3).join('、')+'。それでも保存しますか？'))return}snapshot();let list=kind==='event'?data.events:kind==='todo'?data.todos:data.notes,i=list.findIndex(x=>x.id===id);if(i>=0)list[i]=item;else list.push(item);if(!commit())return;closeForm();toast('保存しました')}
function deleteCurrent(){
 const f=$('#editForm'),kind=f.elements.kind.value,id=f.elements.id.value;
 if(!id)return;
 const item=data.events.find(x=>x.id===id);
 if(kind==='event'&&item&&item.repeat&&item.repeat!=='none'){
  const dlg=$('#deleteChoiceDialog');
  dlg.dataset.eventId=id;
  dlg.dataset.occurrence=editingOccurrence?.date||lastOccurrenceContext||selected||f.elements.date.value;
  dlg.showModal();
  return;
 }
 if(!confirm('この項目を削除しますか？'))return;
 deleteWhole(kind,id);
}
function deleteWhole(kind,id){
 snapshot();const key=kind==='event'?'events':kind==='todo'?'todos':'notes';
 data[key]=data[key].filter(x=>x.id!==id);
 if(kind==='event'){data.todos.forEach(t=>{if(t.related===id)t.related=''});data.notes.forEach(n=>{if(n.noteEvent===id)n.noteEvent=''})}
 if(kind==='todo')data.notes.forEach(n=>{if(n.noteTodo===id)n.noteTodo='' });
 if(kind==='note')data.todos.forEach(t=>{if(t.relatedNote===id)t.relatedNote='' });
 if(!commit())return;closeForm();toast('削除しました');
}
$('#deleteChoiceDialog').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 const dlg=$('#deleteChoiceDialog'),id=dlg.dataset.eventId,origin=dlg.dataset.occurrence;
 if(b.id==='deleteChoiceCancel'){dlg.close();return}
 if(b.id==='deleteChoiceOne'){
  const ev=data.events.find(x=>x.id===id);
  if(!ev||!origin)return;
  snapshot();ev.exceptions={...(ev.exceptions||{}),[origin]:{deleted:true}};
  if(!commit())return;
  dlg.close();closeForm();toast('この日だけ削除しました');return;
 }
 if(b.id==='deleteChoiceAll'){
  if(!confirm('繰り返し予定をすべて削除しますか？'))return;
  dlg.close();deleteWhole('event',id);
 }
});

$('#editForm').addEventListener('submit',storeForm);$('#cancelButton').addEventListener('click',closeForm);$('#deleteButton').addEventListener('click',deleteCurrent);$('#editForm').elements.repeat.addEventListener('change',e=>$('#repeatDaysField').hidden=e.target.value!=='custom');$('#templateSaveButton').addEventListener('click',()=>{let f=$('#editForm');if(!f.elements.title.value.trim())return alert('タイトルを入力してください');snapshot();data.templates||=[];data.templates.push({id:uid(),title:f.elements.title.value.trim(),memo:f.elements.memo.value,category:f.elements.category.value,start:f.elements.start.value,end:f.elements.end.value,allDay:f.elements.allDay.checked,place:f.elements.place.value,repeat:f.elements.repeat.value,reminder:f.elements.reminder.value});commit();toast('テンプレートを保存しました')});$('#duplicateButton').addEventListener('click',()=>{let f=$('#editForm');f.elements.id.value='';editingOccurrence=null;$('#formTitle').textContent='予定を複製';$('#deleteButton').hidden=true;$('#duplicateButton').hidden=true;toast('日付を選んで保存してください')});$('#moveButton').addEventListener('click',()=>{
 const f=$('#editForm'),id=f.elements.id.value,ev=data.events.find(x=>x.id===id);if(!ev)return;
 const target=prompt('移動先の日付（YYYY-MM-DD）',f.elements.date.value);if(target===null)return;
 if(!validDate(target))return alert('日付はYYYY-MM-DD形式で入力してください');
 const occurrence=editingOccurrence?.date;
 if(ev.repeat&&ev.repeat!=='none'&&!occurrence){
  return alert('繰り返し予定全体の移動は、開始日・終了日を編集して保存してください。特定の1回だけ移動するには、その回を選んで編集してください。');
 }
 const offset=dayDiff(f.elements.endDate.value||f.elements.date.value,f.elements.date.value);
 f.elements.date.value=target;f.elements.endDate.value=shift(target,offset);
 toast('移動先の日付を設定しました。「保存する」で確定します');
});
$('#undoButton').addEventListener('click',()=>{if(!undoSnapshot)return;let old=JSON.parse(undoSnapshot);undoSnapshot=null;clearTimeout(undoTimer);$('#undoButton').hidden=true;const before=data;data=old;syncCategories();if(!save()){data=before;render();return}render();toast('元に戻しました')});$('#editForm').elements.allDay.addEventListener('change',e=>$('#timeFields').hidden=e.target.checked);$('#addButton').addEventListener('click',()=>openForm(page==='todos'?'todo':page==='notes'?'note':'event'));$('#editor').addEventListener('click',e=>{if(e.target===$('#editor'))closeForm()});
const PALETTE=[['白','#ffffff'],['アイボリー','#fff9ed'],['クリーム','#fff0c9'],['薄い緑','#d9eddc'],['淡い黄色','#fbe7a2'],['淡いピンク','#f8dce7'],['水色','#c5e7f3'],['薄いグレー','#e0e0e0'],['ミント','#bfe7d7'],['ラベンダー','#d9d1f1'],['黄色','#f2d16b'],['薄いオレンジ','#f8c8a0'],['桜色','#f4c2d4'],['黄緑','#b9d58c'],['ターコイズ','#8acbc9'],['緑','#9dc5a6'],['サーモン','#efa995'],['ベージュ','#cbb69b'],['ピンク','#eaa1bc'],['青','#91b6df'],['紫','#b4a0d5'],['オレンジ','#d99c69'],['赤','#d8797c'],['グレー','#939393'],['深緑','#719a86'],['ローズ','#bd7b96'],['紺','#6e84ab'],['茶色','#967964'],['チャコール','#5b5b60'],['黒','#242424']];
let paletteCategory=null;
function openColorPalette(k){paletteCategory=k;const dlg=$('#colorPaletteDialog');$('#paletteCategoryName').textContent=categories[k]||'カテゴリー';const current=(data.categoryColors[k]||'').toLowerCase();$('#paletteOptions').innerHTML=PALETTE.map(([name,hex])=>`<label class="palette-choice"><input type="radio" name="paletteColor" value="${hex}" ${current===hex?'checked':''}><span class="palette-circle" style="background:${hex}"></span><span>${name}</span></label>`).join('');dlg.showModal()}
$('#paletteCancel').addEventListener('click',()=>$('#colorPaletteDialog').close());
$('#paletteApply').addEventListener('click',()=>{const picked=document.querySelector('input[name="paletteColor"]:checked');if(!picked)return toast('色を選択してください');const k=paletteCategory;if(!k||!categories[k])return $('#colorPaletteDialog').close();snapshot();data.categoryColors[k]=picked.value;if(commit()){toast('色を変更しました');$('#colorPaletteDialog').close()}});
document.addEventListener('click',e=>{
// 空白の日付セルをタップしたときは、その日付の新規予定を開く。
// 既存の予定チップ・ボタンは従来の動作を優先する。
// Month: every first tap (including existing event chips) only selects a date.
// The second tap on that same date opens the day's action chooser, so repeated
// events still use the original edit/delete logic once explicitly selected.
if(page==='calendar'&&view==='month'){
 const monthCell=e.target.closest('.calendar .day[data-drop-date]');
 if(monthCell){
  const target=e.target.closest('button');
  const day=monthCell.dataset.dropDate;
  if(/^\d{4}-\d{2}-\d{2}$/.test(day)){
   // No direct editing from chips, regardless of which chip was tapped.
   // The first tap selects, the second tap opens the date's actions.
   e.preventDefault();
   handleCalendarDateTap(day);
   return;
  }
 }
}
const cell=e.target.closest('.calendar .day[data-drop-date], .weekview .weekcol[data-drop-date]');
if(cell&&!e.target.closest('button, a, input, label, [data-drag], .chip')){
  const day=cell.dataset.dropDate;
  if(/^\d{4}-\d{2}-\d{2}$/.test(day)){handleCalendarDateTap(day);return;}
}
let b=e.target.closest('button');if(!b)return;if(b.dataset.runSearch){plannerSearch=$('#plannerSearch').value.trim();plannerSearchFrom=$('#plannerSearchFrom').value;plannerSearchTo=$('#plannerSearchTo').value;plannerSearchCategory=$('#plannerSearchCategory').value;render();return}if(b.dataset.jumpDate){selected=anchor=b.dataset.jumpDate;view='day';page='calendar';render();return}if(b.dataset.analysisPeriod){analysisPeriod=b.dataset.analysisPeriod;render();return}if(b.dataset.analysisPrev||b.dataset.analysisNext){const step=b.dataset.analysisPrev?-1:1;analysisAnchor=analysisPeriod==='month'?monthShift(analysisAnchor,step):shift(analysisAnchor,step*(analysisPeriod==='week'?7:1));render();return}if(b.dataset.miniToggle){homeTimelineExpanded=!homeTimelineExpanded;render();return}if(b.dataset.calendarToggle){calendarTimelineExpanded=!calendarTimelineExpanded;render();return}if(b.dataset.openTemplates){openCalendarTemplates();return}if(b.dataset.addCategory){const name=prompt('新しいカテゴリー名を入力してください');if(name===null)return;const value=name.trim();if(!value||value.length>32)return toast('1〜32文字で入力してください');if(Object.values(categories).includes(value))return toast('同じ名前のカテゴリーがあります');const id='custom_'+uid().replace(/[^a-zA-Z0-9_-]/g,'_');snapshot();categories[id]=value;data.customCategories={...categories};data.categoryColors[id]='#d4cbd8';data.filters[id]=true;data.categoryNotifications[id]=true;commit();toast('カテゴリーを追加しました');return}else if(b.dataset.renameCategory){const k=b.dataset.renameCategory;const name=prompt('カテゴリー名を変更',categories[k]);if(name===null)return;const value=name.trim();if(!value||value.length>32)return toast('1〜32文字で入力してください');if(Object.entries(categories).some(([id,n])=>id!==k&&n===value))return toast('同じ名前のカテゴリーがあります');snapshot();categories[k]=value;data.customCategories={...categories};commit();toast('名前を変更しました');return}else if(b.dataset.colorCategory){const k=b.dataset.colorCategory;openColorPalette(k);return}else if(b.dataset.deleteCategory){const k=b.dataset.deleteCategory;const other=Object.keys(categories).filter(x=>x!==k);if(!other.length)return toast('最後のカテゴリーは削除できません');const used=data.events.filter(x=>x.category===k).length+data.todos.filter(x=>x.category===k).length;const target=other.includes('other')?'other':other[0];if(!confirm('「'+categories[k]+'」を削除しますか？'+(used?' 関連する'+used+'件は「'+categories[target]+'」に移動します。':'')))return;snapshot();for(const x of [...data.events,...data.todos,...(data.templates||[])])if(x.category===k)x.category=target;delete categories[k];data.customCategories={...categories};delete data.categoryColors[k];delete data.filters[k];delete data.categoryNotifications[k];commit();toast('カテゴリーを削除しました');return}else if(b.dataset.page){page=b.dataset.page;search='';render()}else if(b.dataset.new)openForm(b.dataset.new);else if(b.dataset.edit){let [kind,id]=b.dataset.edit.split(':');const item=data.events.find(x=>x.id===id);if(kind==='event'&&item?.repeat&&item.repeat!=='none')showRepeatChoice(id,b.dataset.occurrence||selected);else openForm(kind,id)}else if(b.dataset.date){if(page==='calendar')handleCalendarDateTap(b.dataset.date);else{selected=b.dataset.date;anchor=selected;render()}}else if(b.dataset.view){monthArmedDate=null;view=b.dataset.view;calendarTimelineExpanded=false;resetCalendarZoom();render()}else if(b.id==='goToday'){monthArmedDate=null;selected=anchor=today();resetCalendarZoom();render()}else if(b.id==='prev'||b.id==='next'){monthArmedDate=null;let dir=b.id==='prev'?-1:1;anchor=view==='month'?monthShift(anchor,dir):shift(anchor,dir*(view==='week'?7:1));selected=anchor;resetCalendarZoom();render()}else if(b.dataset.template){applyTemplate(b.dataset.template)}else if(b.dataset.removeTemplate){if(confirm('テンプレートを削除しますか？')){snapshot();data.templates=data.templates.filter(x=>x.id!==b.dataset.removeTemplate);commit()}}else if(b.id==='notifyPermission'){if(!('Notification'in window)||!window.isSecureContext){toast('この環境では通知を利用できません');return}if(Notification.permission==='granted'){toast('通知は許可されています');return}Notification.requestPermission().then(x=>{toast('通知設定：'+x);render()}).catch(()=>toast('通知許可の取得に失敗しました'))}else if(b.id==='testNotification'){sendPlannerNotification('まいにち手帳・テスト通知','通知が正常に表示されるか確認してください').then(ok=>toast(ok?'通知を送信しました':'通知できません。通知許可とホーム画面への追加を確認してください'))}else if(b.dataset.filterAll!==undefined){const before={...data.filters};const checked=b.dataset.filterAll==='true';for(const key of [...Object.keys(categories),'todo'])data.filters[key]=checked;if(!save()){data.filters=before;render();return}render();toast(checked?'すべてのカテゴリーを表示します':'すべてのカテゴリーを非表示にしました')}else if(b.dataset.theme){let old=data.theme;data.theme=b.dataset.theme;if(!save())data.theme=old;render()}else if(b.id==='export'){let blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`mainichi-backup-${today()}.json`;a.click();try{localStorage.setItem(BACKUP_DATE_KEY,today())}catch{}setTimeout(()=>URL.revokeObjectURL(url),2000);render()}});
document.addEventListener('change',async e=>{let t=e.target;if(t.dataset.filter){let old=data.filters[t.dataset.filter];data.filters[t.dataset.filter]=t.checked;if(!save())data.filters[t.dataset.filter]=old;render()}else if(t.dataset.categoryNotification){const k=t.dataset.categoryNotification;const old={...data.categoryNotifications};data.categoryNotifications[k]=t.checked;if(!save())data.categoryNotifications=old;render()}else if(t.id==='completedFilter'){let old=data.showCompleted;data.showCompleted=t.checked;if(!save())data.showCompleted=old;render()}else if(t.dataset.toggle){let item=data.todos.find(x=>x.id===t.dataset.toggle);if(item){snapshot();item.status=t.checked?'done':'todo';commit()}}else if(t.id==='weekStart'){let old=data.weekStart;data.weekStart=Number(t.value);if(!save())data.weekStart=old;render()}else if(t.id==='import'){
 const file=t.files?.[0];if(!file)return;
 try{
  if(file.size>2e6)throw Error('ファイルが大きすぎます');
  const obj=JSON.parse(await file.text());
  if(!obj||typeof obj!=='object'||!['events','todos','notes'].every(k=>Array.isArray(obj[k])&&obj[k].length<=10000))throw Error('バックアップ形式が正しくありません');
  for(const k of ['events','todos','notes']){
   const ids=new Set();
   for(const x of obj[k]){
    if(!x||typeof x!=='object'||typeof x.id!=='string'||!x.id||typeof x.title!=='string'||x.title.length>120||ids.has(x.id))throw Error('項目データが不正です');
    ids.add(x.id);
    if(k==='events'&&(!validDate(x.date)||(x.endDate&&!validDate(x.endDate))||(x.endDate&&x.endDate<x.date)))throw Error('予定の日付が不正です');
    if(k==='todos'&&x.due&&!validDate(x.due))throw Error('ToDoの期限が不正です');
   }
  }
  if(obj.templates!==undefined&&!Array.isArray(obj.templates))throw Error('テンプレート形式が不正です');
  if(!confirm('現在のデータをバックアップの内容で置き換えます。続けますか？'))return;
  const old=JSON.stringify(data),next={...initial(),...obj,filters:{...initial().filters,...(obj.filters&&typeof obj.filters==='object'?obj.filters:{})}};
  if(!themes[next.theme])next.theme='pink';
  try{localStorage.setItem(BACKUP_KEY,old)}catch{throw Error('復元前の安全コピーを保存できませんでした。空き容量をご確認ください')}
  try{localStorage.setItem(KEY,JSON.stringify(next))}catch{throw Error('復元データの保存に失敗しました。元のデータは保持されています')}
  undoSnapshot=old;clearTimeout(undoTimer);$('#undoButton').hidden=false;
  undoTimer=setTimeout(()=>{undoSnapshot=null;$('#undoButton').hidden=true},30000);
  data=next;syncCategories();render();toast('復元しました。30秒以内なら元に戻せます');
 }catch(err){alert('復元できませんでした：'+err.message)}finally{t.value=''}
}});
document.addEventListener('input',e=>{if(e.target.id==='searchTodo'){let cursor=e.target.selectionStart;search=e.target.value;let list=data.todos.filter(t=>`${t.title} ${t.memo||''}`.toLowerCase().includes(search.toLowerCase()));let panel=e.target.closest('.panel');panel.querySelectorAll('.rowitem,.empty').forEach(n=>n.remove());panel.insertAdjacentHTML('beforeend',list.map(t=>row({...t,kind:'todo'})).join('')||'<div class="empty">該当なし</div>');e.target.setSelectionRange(cursor,cursor)}});document.addEventListener('dragstart',e=>{let el=e.target.closest('[data-drag]');if(el&&el.getAttribute('draggable')==='true'){dragged=el.dataset.drag;e.dataTransfer.setData('text/plain',dragged);e.dataTransfer.effectAllowed='move'}});document.addEventListener('dragover',e=>{if(dragged&&e.target.closest('[data-drop-date]'))e.preventDefault()});document.addEventListener('drop',e=>{let target=e.target.closest('[data-drop-date]');if(!target||!dragged)return;e.preventDefault();let item=data.events.find(x=>x.id===dragged),dest=target.dataset.dropDate;dragged=null;if(!item||!dest||item.date===dest)return;if(item.repeat&&item.repeat!=='none'){toast('繰り返し予定は編集画面で日付を変更してください');return}snapshot();let duration=Math.round((parse(item.endDate||item.date)-parse(item.date))/86400000);item.date=dest;item.endDate=shift(dest,duration);let conflict=overlapping(item);if(conflict.length&&!confirm('移動先に重なる予定があります。移動しますか？')){data=JSON.parse(undoSnapshot);undoSnapshot=null;clearTimeout(undoTimer);$('#undoButton').hidden=true;render();return}commit();toast('予定を移動しました')});document.addEventListener('dragend',()=>dragged=null);
async function sendPlannerNotification(title,body){
 if(!('Notification'in window)||Notification.permission!=='granted'||!window.isSecureContext)return false;
 try{
  if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.ready;await reg.showNotification(title,{body,icon:'./icon-192.png',badge:'./icon-192.png',tag:'mainichi-'+Date.now()});return true}
  new Notification(title,{body,icon:'./icon-192.png'});return true
 }catch(err){console.warn('通知に失敗しました',err);return false}
}
const timer=new Set();setInterval(async()=>{if(typeof Notification==='undefined'||Notification.permission!=='granted')return;const now=Date.now();for(const e of data.events){if(e.allDay||!e.start||e.reminder==null||e.reminder==='none'||e.notifyMode==='off'||(e.notifyMode!=='on'&&data.categoryNotifications[e.category]===false))continue;for(let i=0;i<2;i++){const day=shift(today(),i);if(!eventOccurs(e,day))continue;const target=new Date(day+'T'+e.start+':00').getTime()-Number(e.reminder)*60000;const key=e.id+':'+day+':'+e.reminder;const remembered='mainichi_notice_'+key;if(now>=target&&now-target<60000&&!timer.has(key)&&!sessionStorage.getItem(remembered)){timer.add(key);if(await sendPlannerNotification('まいにち手帳',e.title)){try{sessionStorage.setItem(remembered,'1')}catch{}}else timer.delete(key)}}}if(timer.size>500)timer.clear()},30000);
setInterval(()=>{if((page==='calendar'||page==='home')&&!document.querySelector('dialog[open]'))render()},60000);
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
render();
})();
