const KEY="katoonz_tomo_v2";
const $=s=>document.querySelector(s);

function emptyState(){
  return{
    players:[],
    history:[],
    favorites:[],
    courtCount:0,
    courts:[]
  };
}

function defaults(){
  return{
    players:[
      {id:1,name:"K'T",lv:3,games:0,status:"พัก"},
      {id:2,name:"NT",lv:2,games:0,status:"พัก"},
      {id:3,name:"TE'",lv:3,games:0,status:"พัก"},
      {id:4,name:"BG",lv:1,games:0,status:"พัก"},
      {id:5,name:"FM",lv:3,games:0,status:"พัก"},
      {id:6,name:"WP",lv:2,games:0,status:"พัก"},
      {id:7,name:"JN",lv:1,games:0,status:"พัก"},
      {id:8,name:"CP",lv:3,games:0,status:"พัก"},
      {id:9,name:"ND",lv:2,games:0,status:"พัก"},
      {id:10,name:"OLF",lv:2,games:0,status:"พัก"},
      {id:11,name:"TE",lv:3,games:0,status:"พัก"},
      {id:12,name:"DM",lv:2,games:0,status:"พัก"}
    ],
    history:[],
    favorites:[
      {id:101,name:"K'T",lv:3},
      {id:102,name:"NT",lv:2},
      {id:103,name:"TE'",lv:3},
      {id:104,name:"BG",lv:1},
      {id:105,name:"FM",lv:3},
      {id:106,name:"WP",lv:2},
      {id:107,name:"JN",lv:1},
      {id:108,name:"CP",lv:3},
      {id:109,name:"ND",lv:2},
      {id:110,name:"OLF",lv:2},
      {id:111,name:"TE",lv:3},
      {id:112,name:"DM",lv:2}
    ],
    courtCount:2,
    courts:[
      {id:1,name:"5",slots:[null,null,null,null]},
      {id:2,name:"6",slots:[null,null,null,null]}
    ]
  };
}

let state;
try{state=JSON.parse(localStorage.getItem(KEY))||defaults()}catch{state=defaults()}
if(!Array.isArray(state.favorites))state.favorites=[];
if(!Array.isArray(state.history))state.history=[];
let drag={playerId:null,sourceCourt:null,sourceSlot:null,ghost:null};
let replaceTarget={courtId:null,slotIndex:null};

function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function player(id){return state.players.find(p=>p.id===id)}
function nextId(){return Math.max(0,...state.players.map(p=>p.id))+1}
function syncStatuses(){
  state.players.forEach(p=>p.status="พัก");
  state.courts.forEach(c=>c.slots.forEach(id=>{if(id&&player(id))player(id).status="เล่น"}));
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}

function addPlayer(){
  const name=$("#newName").value.trim();
  if(!name)return alert("กรุณาใส่ชื่อผู้เล่น");
  state.players.push({id:nextId(),name,lv:+$("#newLv").value,games:0,status:"พัก"});
  $("#newName").value="";
  save();render();
}
function editPlayer(id){
  const p=player(id);
  const name=prompt("ชื่อใหม่",p.name);
  if(name===null)return;
  const lv=prompt("Level 1-3",p.lv);
  if(name.trim())p.name=name.trim();
  if(["1","2","3"].includes(lv))p.lv=+lv;
  save();render();
}
function removePlayer(id){
  const p=player(id);
  if(p.status==="เล่น")return alert("ผู้เล่นกำลังเล่นอยู่");
  if(confirm("ลบ "+p.name+" ?")){
    state.players=state.players.filter(x=>x.id!==id);
    save();render();
  }
}


function openFavoriteModal(){
  $("#favoriteNameInput").value="";
  $("#favoriteLvInput").value="2";
  $("#favoriteModal").classList.remove("hidden");
  $("#favoriteModal").setAttribute("aria-hidden","false");
  setTimeout(()=>$("#favoriteNameInput").focus(),50);
}
function closeFavoriteModal(){
  $("#favoriteModal").classList.add("hidden");
  $("#favoriteModal").setAttribute("aria-hidden","true");
}
function saveFavoriteDirect(){
  const name=$("#favoriteNameInput").value.trim();
  const lv=+$("#favoriteLvInput").value;
  if(!name)return alert("กรุณาใส่ชื่อผู้เล่น");
  const duplicate=state.favorites.some(f=>f.name.trim().toLowerCase()===name.toLowerCase());
  if(duplicate)return alert(name+" อยู่ในรายชื่อโปรดแล้ว");
  state.favorites.push({id:Date.now(),name,lv});
  save();
  closeFavoriteModal();
  render();
}

function isFavoriteName(name){
  return state.favorites.some(f=>f.name.trim().toLowerCase()===name.trim().toLowerCase());
}
function toggleFavorite(id){
  const p=player(id);
  if(!p)return;
  const idx=state.favorites.findIndex(f=>f.name.trim().toLowerCase()===p.name.trim().toLowerCase());
  if(idx>=0)state.favorites.splice(idx,1);
  else state.favorites.push({id:Date.now(),name:p.name,lv:p.lv});
  save();render();
}
function addFavoriteToday(fid){
  const f=state.favorites.find(x=>x.id===fid);
  if(!f)return;
  const exists=state.players.some(p=>p.name.trim().toLowerCase()===f.name.trim().toLowerCase());
  if(exists)return alert(f.name+" อยู่ในรายชื่อวันนี้แล้ว");
  state.players.push({id:nextId(),name:f.name,lv:f.lv,games:0,status:"พัก"});
  save();render();
}
function removeFavorite(fid){
  const f=state.favorites.find(x=>x.id===fid);
  if(!f)return;
  if(confirm("ลบ "+f.name+" ออกจากรายชื่อโปรด?")){
    state.favorites=state.favorites.filter(x=>x.id!==fid);
    save();render();
  }
}
function editFavorite(fid){
  const f=state.favorites.find(x=>x.id===fid);
  if(!f)return;
  const name=prompt("ชื่อในรายชื่อโปรด",f.name);
  if(name===null)return;
  const lv=prompt("Level 1-3",f.lv);
  if(name.trim())f.name=name.trim();
  if(["1","2","3"].includes(lv))f.lv=+lv;
  save();render();
}
function addAllFavorites(){
  let added=0;
  state.favorites.forEach(f=>{
    const exists=state.players.some(p=>p.name.trim().toLowerCase()===f.name.trim().toLowerCase());
    if(!exists){
      state.players.push({id:nextId(),name:f.name,lv:f.lv,games:0,status:"พัก"});
      added++;
    }
  });
  save();render();
  if(!added)alert("รายชื่อโปรดทั้งหมดอยู่ในรายชื่อวันนี้แล้ว");
}

function changeCourtCount(){
  const n=+$("#courtCount").value;
  const oldCount=state.courts.length;

  if(n===oldCount){
    state.courtCount=n;
    save();
    render();
    return;
  }

  if(n>oldCount){
    for(let i=oldCount;i<n;i++){
      state.courts.push({
        id:i+1,
        name:String(i+1),
        slots:[null,null,null,null]
      });
    }
    state.courtCount=n;
    save();
    render();
    return;
  }

  const courtsToRemove=state.courts.slice(n);
  const hasActivePlayers=courtsToRemove.some(c=>c.slots.some(Boolean));

  if(hasActivePlayers){
    alert("ไม่สามารถลดจำนวนคอร์ทได้ เพราะคอร์ทที่จะถูกลบยังมีผู้เล่นอยู่ กรุณาจบเกมหรือย้ายผู้เล่นออกก่อน");
    $("#courtCount").value=String(oldCount);
    return;
  }

  if(!confirm("ต้องการลดจำนวนคอร์ทจาก "+oldCount+" เหลือ "+n+" ใช่หรือไม่?")){
    $("#courtCount").value=String(oldCount);
    return;
  }

  state.courts=state.courts.slice(0,n);
  state.courtCount=n;
  save();
  render();
}

function pairKey(a,b){
  return [a,b].sort((x,y)=>x-y).join("-");
}
function historyCounts(){
  const partner={},opponent={};
  state.history.forEach(h=>{
    const ids=h.playerIds||[];
    if(ids.length!==4)return;
    const [a,b,c,d]=ids;
    [pairKey(a,b),pairKey(c,d)].forEach(k=>partner[k]=(partner[k]||0)+1);
    [[a,c],[a,d],[b,c],[b,d]].forEach(x=>{
      const k=pairKey(x[0],x[1]);
      opponent[k]=(opponent[k]||0)+1;
    });
  });
  return{partner,opponent};
}
function chooseFour(){
  const rest=state.players
    .filter(p=>p.status==="พัก")
    .sort((a,b)=>a.games-b.games||b.lv-a.lv||a.name.localeCompare(b.name));
  if(rest.length<4)return null;

  const pool=rest.slice(0,Math.min(10,rest.length));
  const counts=historyCounts();
  let best=null,bestScore=Infinity;

  for(let i=0;i<pool.length;i++)
  for(let j=i+1;j<pool.length;j++)
  for(let k=j+1;k<pool.length;k++)
  for(let m=k+1;m<pool.length;m++){
    const q=[pool[i],pool[j],pool[k],pool[m]];
    const pairings=[
      [q[0],q[1],q[2],q[3]],
      [q[0],q[2],q[1],q[3]],
      [q[0],q[3],q[1],q[2]]
    ];

    pairings.forEach(z=>{
      const teamDiff=Math.abs((z[0].lv+z[1].lv)-(z[2].lv+z[3].lv));
      const gameSpread=Math.max(...z.map(p=>p.games))-Math.min(...z.map(p=>p.games));
      const partnerRepeat=(counts.partner[pairKey(z[0].id,z[1].id)]||0)+(counts.partner[pairKey(z[2].id,z[3].id)]||0);
      const opponentRepeat=
        (counts.opponent[pairKey(z[0].id,z[2].id)]||0)+
        (counts.opponent[pairKey(z[0].id,z[3].id)]||0)+
        (counts.opponent[pairKey(z[1].id,z[2].id)]||0)+
        (counts.opponent[pairKey(z[1].id,z[3].id)]||0);

      const score=(teamDiff*20)+(gameSpread*8)+(partnerRepeat*12)+(opponentRepeat*3);
      if(score<bestScore){
        bestScore=score;
        best=z;
      }
    });
  }
  return best;
}

function startCourt(id){
  const c=state.courts.find(x=>x.id===id);
  if(c.slots.some(Boolean))return alert("คอร์ทนี้กำลังใช้งาน");
  const pick=chooseFour();
  if(!pick)return alert("คนพักไม่ถึง 4 คน");
  c.slots=pick.map(p=>p.id);
  pick.forEach(p=>p.games++);
  syncStatuses();save();render();
}
function endCourt(id){
  const c=state.courts.find(x=>x.id===id);
  if(!c)return;
  const ids=c.slots.filter(Boolean);
  if(ids.length===4){
    state.history.unshift({
      id:Date.now(),
      courtName:c.name,
      playerIds:[...ids],
      finishedAt:new Date().toISOString()
    });
  }
  c.slots=[null,null,null,null];
  syncStatuses();save();render();
}
function rotate(id){
  const c=state.courts.find(x=>x.id===id);
  if(c.slots.some(x=>!x))return;
  const[a,b,d,e]=c.slots;
  c.slots=[a,d,b,e];
  save();render();
}
function setCourtName(id,value){
  state.courts.find(x=>x.id===id).name=value.trim()||String(id);
  save();
}
function movePlayer(targetCourt,targetSlot){
  if(!drag.playerId)return;
  const source=drag.sourceCourt?state.courts.find(c=>c.id===drag.sourceCourt):null;
  const target=targetCourt?state.courts.find(c=>c.id===targetCourt):null;
  const targetId=target?target.slots[targetSlot]:null;
  if(target){
    target.slots[targetSlot]=drag.playerId;
    if(source)source.slots[drag.sourceSlot]=targetId||null;
  }else if(source){
    source.slots[drag.sourceSlot]=null;
  }
  syncStatuses();save();render();
}
function beginDrag(el,e){
  drag.playerId=+el.dataset.playerId;
  drag.sourceCourt=el.dataset.court?+el.dataset.court:null;
  drag.sourceSlot=el.dataset.slot!==undefined&&el.dataset.slot!==""?+el.dataset.slot:null;
  el.classList.add("dragging");
  if(e.type==="touchstart"){
    const g=document.createElement("div");
    g.className="drag-ghost";g.textContent=player(drag.playerId).name;
    document.body.appendChild(g);drag.ghost=g;moveGhost(e.touches[0]);
    document.addEventListener("touchmove",touchMove,{passive:false});
    document.addEventListener("touchend",touchEnd,{once:true});
  }
}
function moveGhost(t){if(drag.ghost){drag.ghost.style.left=t.clientX+"px";drag.ghost.style.top=t.clientY+"px"}}
function touchMove(e){
  e.preventDefault();moveGhost(e.touches[0]);
  document.querySelectorAll(".over").forEach(x=>x.classList.remove("over"));
  const el=document.elementFromPoint(e.touches[0].clientX,e.touches[0].clientY);
  el?.closest("[data-drop]")?.classList.add("over");
}
function touchEnd(e){
  document.removeEventListener("touchmove",touchMove);
  const t=e.changedTouches[0];
  const zone=document.elementFromPoint(t.clientX,t.clientY)?.closest("[data-drop]");
  if(zone){
    if(zone.dataset.drop==="waiting")movePlayer(null,null);
    else movePlayer(+zone.dataset.court,+zone.dataset.slot);
  }
  cleanupDrag();
}
function cleanupDrag(){
  window.__justDragged=true;
  setTimeout(()=>window.__justDragged=false,250);
  document.querySelectorAll(".dragging,.over").forEach(x=>x.classList.remove("dragging","over"));
  drag.ghost?.remove();
  drag={playerId:null,sourceCourt:null,sourceSlot:null,ghost:null};
}

function openReplaceModal(courtId,slotIndex){
  const c=state.courts.find(x=>x.id===courtId);
  const currentId=c?.slots?.[slotIndex];
  const current=currentId?player(currentId):null;
  if(!current)return;

  replaceTarget={courtId,slotIndex};
  $("#replaceCurrent").textContent="กำลังเปลี่ยน: "+current.name+" (Lv."+current.lv+")";

  const available=state.players
    .filter(p=>p.status==="พัก")
    .sort((a,b)=>a.games-b.games||a.name.localeCompare(b.name));

  $("#availablePlayers").innerHTML=available.length
    ? available.map(p=>`
      <div class="available-player lv${p.lv}">
        <button class="replace-choice" data-id="${p.id}">
          <div><b>${esc(p.name)}</b> <span class="badge">Lv.${p.lv}</span></div>
          <div class="slot-meta">เกม ${p.games}</div>
        </button>
      </div>`).join("")
    : '<div class="empty">ไม่มีผู้เล่นว่าง</div>';

  $("#replaceModal").classList.remove("hidden");
  $("#replaceModal").setAttribute("aria-hidden","false");
  document.querySelectorAll(".replace-choice").forEach(b=>{
    b.onclick=()=>replaceWithPlayer(+b.dataset.id);
  });
}
function closeReplaceModal(){
  $("#replaceModal").classList.add("hidden");
  $("#replaceModal").setAttribute("aria-hidden","true");
  replaceTarget={courtId:null,slotIndex:null};
}
function replaceWithPlayer(newPlayerId){
  const c=state.courts.find(x=>x.id===replaceTarget.courtId);
  if(!c)return;
  const oldId=c.slots[replaceTarget.slotIndex];
  c.slots[replaceTarget.slotIndex]=newPlayerId;

  const oldP=player(oldId);
  const newP=player(newPlayerId);
  if(oldP)oldP.status="พัก";
  if(newP)newP.status="เล่น";

  syncStatuses();
  save();
  closeReplaceModal();
  render();
}

function slotHtml(c,i){
  const p=player(c.slots[i]);
  return `<div class="slot ${p?`filled lv${p.lv}`:""}" data-drop="slot" data-court="${c.id}" data-slot="${i}" ${p?`data-player-id="${p.id}" data-tap-replace="1"`:""}>
    ${p?`<div><div class="slot-name">${esc(p.name)}</div><div class="slot-meta">Lv.${p.lv} · เกม ${p.games}</div></div>`:"ลากผู้เล่นมาวาง"}
  </div>`;
}

function renderFavorites(){
  const box=$("#favorites");
  if(!state.favorites.length){
    box.innerHTML='<div class="empty">ยังไม่มีรายชื่อโปรด</div>';
    return;
  }
  const sorted=state.favorites.slice().sort((a,b)=>a.name.localeCompare(b.name));
  box.innerHTML=sorted.map((f,index)=>{
    const today=state.players.some(p=>p.name.trim().toLowerCase()===f.name.trim().toLowerCase());
    return `<div class="favorite-item lv${f.lv}">
      <div class="favorite-main">
        <span class="favorite-number">${index+1}</span>
        <span class="star-btn">★</span>
        <div><div class="favorite-name">${esc(f.name)}</div><div class="slot-meta">Lv.${f.lv}${today?" · อยู่ในวันนี้แล้ว":""}</div></div>
      </div>
      <div class="favorite-actions">
        <button class="primary fav-add" data-id="${f.id}" ${today?"disabled":""}>เพิ่มวันนี้</button>
        <button class="secondary fav-edit" data-id="${f.id}">แก้ชื่อ/Lv.</button>
        <button class="danger fav-remove" data-id="${f.id}">ลบดาว</button>
      </div>
    </div>`;
  }).join("");
}


function formatDateTime(iso){
  try{
    return new Intl.DateTimeFormat("th-TH",{dateStyle:"short",timeStyle:"short"}).format(new Date(iso));
  }catch{
    return iso||"";
  }
}
function renderHistory(){
  const box=$("#historyList");
  $("#historyCount").textContent=state.history.length+" เกม";
  if(!state.history.length){
    box.innerHTML='<div class="history-empty">ยังไม่มีประวัติรอบเล่น</div>';
    return;
  }
  box.innerHTML=state.history.slice(0,30).map(h=>{
    const ps=(h.playerIds||[]).map(id=>player(id)).filter(Boolean);
    const names=ps.length===4
      ? `${esc(ps[0].name)} + ${esc(ps[1].name)} <span class="vs">VS</span> ${esc(ps[2].name)} + ${esc(ps[3].name)}`
      : "ข้อมูลผู้เล่นไม่ครบ";
    return `<div class="history-item">
      <div class="history-top">
        <div class="history-court">คอร์ท ${esc(h.courtName||"-")}</div>
        <div class="history-time">${formatDateTime(h.finishedAt)}</div>
      </div>
      <div class="history-match">${names}</div>
    </div>`;
  }).join("");
}

function renderWaiting(){
  const arr=state.players.filter(p=>p.status==="พัก").sort((a,b)=>a.games-b.games||a.name.localeCompare(b.name));
  $("#waiting").innerHTML=arr.length?arr.map(p=>`
    <div class="player-chip lv${p.lv}" data-player-id="${p.id}">
      <div><span class="chip-main">${esc(p.name)}</span> <span class="badge">Lv.${p.lv}</span><div class="slot-meta">เกม ${p.games}</div></div>
      <div><button class="star-btn ${isFavoriteName(p.name)?"":"off"} favorite-toggle" data-id="${p.id}" title="บันทึกรายชื่อโปรด">${isFavoriteName(p.name)?"★":"☆"}</button> <button class="secondary edit" data-id="${p.id}">แก้ไข</button> <button class="danger remove" data-id="${p.id}">ลบ</button></div>
    </div>`).join(""):'<div class="empty">ไม่มีคนพัก</div>';
}
function renderCourts(){
  if(!state.courts.length){
    $("#courts").innerHTML='<div class="empty">ยังไม่มีคอร์ท กรุณาเลือกจำนวนคอร์ทด้านบน</div>';
    return;
  }
  $("#courts").innerHTML=state.courts.map(c=>`
    <div class="court">
      <button class="delete-court" data-id="${c.id}" aria-label="ลบคอร์ท ${esc(c.name)}">×</button>
      <div class="court-head"><span>คอร์ท</span><input class="court-name" data-id="${c.id}" value="${esc(c.name)}"></div>
      <div class="slots">${slotHtml(c,0)}${slotHtml(c,1)}<div class="vs">VS</div>${slotHtml(c,2)}${slotHtml(c,3)}</div>
      <div class="actions">
        <button class="primary start" data-id="${c.id}">▶ เรียกผู้เล่น</button>
        <button class="secondary rotate" data-id="${c.id}">🔄 เปลี่ยนคู่</button>
        <button class="danger end" data-id="${c.id}">■ จบเกม</button>
      </div>
    </div>`).join("");
}
function wireDrag(){
  document.querySelectorAll("[data-player-id]").forEach(el=>{
    el.draggable=true;
    el.addEventListener("dragstart",e=>{beginDrag(el,e);e.dataTransfer.setData("text/plain",el.dataset.playerId)});
    el.addEventListener("dragend",cleanupDrag);
    el.addEventListener("touchstart",e=>beginDrag(el,e),{passive:true});
  });
  document.querySelectorAll("[data-drop]").forEach(zone=>{
    zone.addEventListener("dragover",e=>{e.preventDefault();zone.classList.add("over")});
    zone.addEventListener("dragleave",()=>zone.classList.remove("over"));
    zone.addEventListener("drop",e=>{
      e.preventDefault();
      if(zone.dataset.drop==="waiting")movePlayer(null,null);
      else movePlayer(+zone.dataset.court,+zone.dataset.slot);
      cleanupDrag();
    });
  });
}

function exportData(){
  const data=JSON.stringify(state,null,2);
  const blob=new Blob([data],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download="KATOONz_TOMO_backup_"+new Date().toISOString().slice(0,10)+".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function importDataFile(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const imported=JSON.parse(reader.result);
      if(!imported||!Array.isArray(imported.players)||!Array.isArray(imported.courts)){
        throw new Error("รูปแบบไฟล์ไม่ถูกต้อง");
      }
      if(!Array.isArray(imported.favorites))imported.favorites=[];
      if(!Array.isArray(imported.history))imported.history=[];
      state=imported;
      syncStatuses();
      save();
      render();
      alert("กู้คืนข้อมูลสำเร็จ");
    }catch(e){
      alert("ไม่สามารถกู้คืนข้อมูลได้: "+e.message);
    }
  };
  reader.readAsText(file);
}

function showTab(tabId){
  document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("active",p.id===tabId));
  document.querySelectorAll(".tab-button").forEach(b=>b.classList.toggle("active",b.dataset.tab===tabId));
  try{localStorage.setItem("katoonz_active_tab",tabId)}catch{}
}
function deleteCourt(id){
  const idx=state.courts.findIndex(c=>c.id===id);
  if(idx<0)return;
  const c=state.courts[idx];
  const hasPlayers=c.slots.some(Boolean);
  const msg=hasPlayers?`คอร์ท ${c.name} ยังมีผู้เล่นอยู่ ต้องการลบและส่งผู้เล่นทั้งหมดกลับไปพักใช่หรือไม่?`:`ต้องการลบคอร์ท ${c.name} ใช่หรือไม่?`;
  if(!confirm(msg))return;
  state.courts.splice(idx,1);
  state.courts.forEach((court,i)=>court.id=i+1);
  state.courtCount=state.courts.length;
  syncStatuses();save();render();
}

function bind(){
  document.querySelectorAll(".tab-button").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
  $("#addPlayer").onclick=addPlayer;
  $("#exportData").onclick=exportData;
  $("#importData").onclick=()=>$("#importFile").click();
  $("#importFile").onchange=e=>{
    const file=e.target.files?.[0];
    if(file)importDataFile(file);
    e.target.value="";
  };
  $("#clearHistory").onclick=()=>{
    if(confirm("ล้างประวัติรอบเล่นทั้งหมด?")){
      state.history=[];
      save();
      render();
    }
  };
  $("#addFavoriteDirect").onclick=openFavoriteModal;
  $("#saveFavoriteDirect").onclick=saveFavoriteDirect;
  $("#closeFavorite").onclick=closeFavoriteModal;
  $("#favoriteModal .modal-backdrop").onclick=closeFavoriteModal;
  $("#favoriteNameInput").onkeydown=e=>{if(e.key==="Enter")saveFavoriteDirect()};
  $("#closeReplace").onclick=closeReplaceModal;
  $("#replaceModal .modal-backdrop").onclick=closeReplaceModal;
  $("#addAllFavorites").onclick=addAllFavorites;
  $("#newName").onkeydown=e=>{if(e.key==="Enter")addPlayer()};
  $("#courtCount").onchange=changeCourtCount;
  $("#resetGames").onclick=()=>{if(confirm("รีเซ็ตจำนวนเกมทั้งหมด?")){state.players.forEach(p=>p.games=0);save();render()}};
  $("#newSession").onclick=()=>{
    if(confirm("เริ่มก๊วนใหม่ใช่หรือไม่? ระบบจะล้างผู้เล่นวันนี้ จำนวนเกม และคอร์ท แต่จะเก็บรายชื่อโปรดไว้")){
      const savedFavorites=Array.isArray(state.favorites)?state.favorites:[];
      state={
        players:[],
        favorites:savedFavorites,
        history:[],
        courtCount:0,
        courts:[]
      };
      save();
      render();
    }
  };
  $("#factoryReset").onclick=()=>{
    if(confirm("ล้างระบบทั้งหมดใช่หรือไม่? การดำเนินการนี้จะลบผู้เล่น รายชื่อโปรด จำนวนเกม และคอร์ททั้งหมด")){
      state=emptyState();
      save();
      render();
    }
  };
  document.querySelectorAll(".favorite-toggle").forEach(b=>b.onclick=()=>toggleFavorite(+b.dataset.id));
  document.querySelectorAll(".fav-add").forEach(b=>b.onclick=()=>addFavoriteToday(+b.dataset.id));
  document.querySelectorAll(".fav-edit").forEach(b=>b.onclick=()=>editFavorite(+b.dataset.id));
  document.querySelectorAll(".fav-remove").forEach(b=>b.onclick=()=>removeFavorite(+b.dataset.id));
  document.querySelectorAll(".edit").forEach(b=>b.onclick=()=>editPlayer(+b.dataset.id));
  document.querySelectorAll(".remove").forEach(b=>b.onclick=()=>removePlayer(+b.dataset.id));
  document.querySelectorAll(".delete-court").forEach(b=>b.onclick=()=>deleteCourt(+b.dataset.id));
  document.querySelectorAll(".start").forEach(b=>b.onclick=()=>startCourt(+b.dataset.id));
  document.querySelectorAll(".rotate").forEach(b=>b.onclick=()=>rotate(+b.dataset.id));
  document.querySelectorAll(".end").forEach(b=>b.onclick=()=>endCourt(+b.dataset.id));
  document.querySelectorAll(".court-name").forEach(x=>x.onchange=()=>setCourtName(+x.dataset.id,x.value));
  document.querySelectorAll('[data-tap-replace="1"]').forEach(el=>{
    let touchMoved=false;
    el.addEventListener("touchmove",()=>{touchMoved=true},{passive:true});
    el.addEventListener("touchend",()=>{
      if(!touchMoved)openReplaceModal(+el.dataset.court,+el.dataset.slot);
      touchMoved=false;
    });
    el.addEventListener("click",e=>{
      if(e.detail===0)return;
      if(!window.__justDragged)openReplaceModal(+el.dataset.court,+el.dataset.slot);
    });
  });
  wireDrag();
}
function render(){
  syncStatuses();
  $("#courtCount").value=state.courtCount;
  renderFavorites();renderWaiting();renderCourts();renderHistory();
  $("#favoriteCount").textContent=state.favorites.length+" คน";
  $("#statAll").textContent=state.players.length;
  $("#statPlay").textContent=state.players.filter(p=>p.status==="เล่น").length;
  $("#statRest").textContent=state.players.filter(p=>p.status==="พัก").length;
  bind();
  let activeTab="homeTab";
  try{activeTab=localStorage.getItem("katoonz_active_tab")||"homeTab"}catch{}
  if(!document.getElementById(activeTab))activeTab="homeTab";
  showTab(activeTab);
}
render();

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.error));
}