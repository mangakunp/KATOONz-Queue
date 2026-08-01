const KEY="katoonz_tomo_v2";
const $=s=>document.querySelector(s);

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
    courtCount:2,
    courts:[
      {id:1,name:"5",slots:[null,null,null,null]},
      {id:2,name:"6",slots:[null,null,null,null]}
    ]
  };
}

let state;
try{state=JSON.parse(localStorage.getItem(KEY))||defaults()}catch{state=defaults()}
let drag={playerId:null,sourceCourt:null,sourceSlot:null,ghost:null};

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
function changeCourtCount(){
  const n=+$("#courtCount").value;
  if(state.courts.some(c=>c.slots.some(Boolean))&&!confirm("มีคอร์ทกำลังเล่นอยู่ ต้องการเปลี่ยนจำนวนคอร์ทหรือไม่?")){
    render();return;
  }
  const old=state.courts;
  state.courtCount=n;
  state.courts=Array.from({length:n},(_,i)=>({id:i+1,name:old[i]?.name||String(i+1),slots:[null,null,null,null]}));
  syncStatuses();save();render();
}
function chooseFour(){
  const rest=state.players.filter(p=>p.status==="พัก").sort((a,b)=>a.games-b.games||b.lv-a.lv);
  if(rest.length<4)return null;
  const pool=rest.slice(0,Math.min(8,rest.length));
  let best=null,bestDiff=999;
  for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++)for(let k=j+1;k<pool.length;k++)for(let m=k+1;m<pool.length;m++){
    const q=[pool[i],pool[j],pool[k],pool[m]];
    const pairs=[[q[0],q[1],q[2],q[3]],[q[0],q[2],q[1],q[3]],[q[0],q[3],q[1],q[2]]];
    pairs.forEach(z=>{
      const d=Math.abs((z[0].lv+z[1].lv)-(z[2].lv+z[3].lv));
      if(d<bestDiff){bestDiff=d;best=z}
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
  state.courts.find(x=>x.id===id).slots=[null,null,null,null];
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
  document.querySelectorAll(".dragging,.over").forEach(x=>x.classList.remove("dragging","over"));
  drag.ghost?.remove();
  drag={playerId:null,sourceCourt:null,sourceSlot:null,ghost:null};
}
function slotHtml(c,i){
  const p=player(c.slots[i]);
  return `<div class="slot ${p?`filled lv${p.lv}`:""}" data-drop="slot" data-court="${c.id}" data-slot="${i}" ${p?`data-player-id="${p.id}"`:""}>
    ${p?`<div><div class="slot-name">${esc(p.name)}</div><div class="slot-meta">Lv.${p.lv} · เกม ${p.games}</div></div>`:"ลากผู้เล่นมาวาง"}
  </div>`;
}
function renderWaiting(){
  const arr=state.players.filter(p=>p.status==="พัก").sort((a,b)=>a.games-b.games||a.name.localeCompare(b.name));
  $("#waiting").innerHTML=arr.length?arr.map(p=>`
    <div class="player-chip lv${p.lv}" data-player-id="${p.id}">
      <div><span class="chip-main">${esc(p.name)}</span> <span class="badge">Lv.${p.lv}</span><div class="slot-meta">เกม ${p.games}</div></div>
      <div><button class="secondary edit" data-id="${p.id}">แก้ไข</button> <button class="danger remove" data-id="${p.id}">ลบ</button></div>
    </div>`).join(""):'<div class="empty">ไม่มีคนพัก</div>';
}
function renderCourts(){
  $("#courts").innerHTML=state.courts.map(c=>`
    <div class="court">
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
function bind(){
  $("#addPlayer").onclick=addPlayer;
  $("#newName").onkeydown=e=>{if(e.key==="Enter")addPlayer()};
  $("#courtCount").onchange=changeCourtCount;
  $("#resetGames").onclick=()=>{if(confirm("รีเซ็ตจำนวนเกมทั้งหมด?")){state.players.forEach(p=>p.games=0);save();render()}};
  $("#resetAll").onclick=()=>{if(confirm("ล้างข้อมูลทั้งหมด?")){state=defaults();save();render()}};
  document.querySelectorAll(".edit").forEach(b=>b.onclick=()=>editPlayer(+b.dataset.id));
  document.querySelectorAll(".remove").forEach(b=>b.onclick=()=>removePlayer(+b.dataset.id));
  document.querySelectorAll(".start").forEach(b=>b.onclick=()=>startCourt(+b.dataset.id));
  document.querySelectorAll(".rotate").forEach(b=>b.onclick=()=>rotate(+b.dataset.id));
  document.querySelectorAll(".end").forEach(b=>b.onclick=()=>endCourt(+b.dataset.id));
  document.querySelectorAll(".court-name").forEach(x=>x.onchange=()=>setCourtName(+x.dataset.id,x.value));
  wireDrag();
}
function render(){
  syncStatuses();
  $("#courtCount").value=state.courtCount;
  renderWaiting();renderCourts();
  $("#statAll").textContent=state.players.length;
  $("#statPlay").textContent=state.players.filter(p=>p.status==="เล่น").length;
  $("#statRest").textContent=state.players.filter(p=>p.status==="พัก").length;
  bind();
}
render();

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.error));
}