const KEY="katoonz_tomo_v5_offline";
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));

function seedMembers(){
  return [
    ["K'T",3],["NT",2],["TE'",3],["BG",1],["FM",3],["WP",2],
    ["JN",1],["CP",3],["ND",2],["OLF",2],["TE",3],["DM",2]
  ].map((x,i)=>({id:i+1,name:x[0],lv:x[1]}));
}
function defaultState(){
  return {
    members:seedMembers(),
    today:[],
    courts:[{id:1,name:"1",slots:[null,null,null,null],state:"idle"},{id:2,name:"2",slots:[null,null,null,null],state:"idle"}],
    shuttleCount:0,
    queueCounter:0,
    history:[],
    archive:{},
    plan:{items:[]},
    costs:{courtRate:120,courtCount:2,hours:2,shuttleRate:45,other:0,qrData:""},
    sessionDate:new Date().toISOString().slice(0,10)
  };
}
let state;
try{state=JSON.parse(localStorage.getItem(KEY))||defaultState()}catch{state=defaultState()}
normalizeState();

function toArray(value){
  if(Array.isArray(value))return value.filter(v=>v!=null);
  if(value==null)return [];
  if(typeof value==="object"){
    return Object.keys(value)
      .sort((a,b)=>{
        const an=Number(a),bn=Number(b);
        if(Number.isFinite(an)&&Number.isFinite(bn))return an-bn;
        return String(a).localeCompare(String(b));
      })
      .map(k=>value[k])
      .filter(v=>v!=null);
  }
  return [];
}

function normalizeState(){
  if(!state || typeof state!=="object")state=defaultState();

  state.members=toArray(state.members);
  state.today=toArray(state.today);
  state.courts=toArray(state.courts);
  state.history=toArray(state.history);

  if(!state.archive || typeof state.archive!=="object")state.archive={};
  if(!state.plan||typeof state.plan!=="object")state.plan={items:[]};
  if(!Array.isArray(state.plan.items))state.plan.items=[];
  if(!state.costs || typeof state.costs!=="object"){
    state.costs={courtRate:120,courtCount:state.courts.length||2,hours:2,shuttleRate:45,other:0,qrData:""};
  }

  if(!Number.isFinite(+state.costs.courtCount))state.costs.courtCount=state.courts.length||2;
  if(!Number.isFinite(+state.costs.courtRate))state.costs.courtRate=120;
  if(!Number.isFinite(+state.costs.hours))state.costs.hours=2;
  if(!Number.isFinite(+state.costs.shuttleRate))state.costs.shuttleRate=45;
  if(!Number.isFinite(+state.costs.other))state.costs.other=0;
  if(typeof state.costs.qrData!=="string")state.costs.qrData="";

  // Firebase อาจตัด slots ที่เป็น null ทิ้งทั้งหมด
  // จึงสร้าง 4 ช่องกลับมา และรองรับ sentinel 0 จาก v5.5.2+
  state.courts=state.courts.map((c,index)=>{
    c=(c && typeof c==="object")?c:{};
    let slots=toArray(c.slots);

    // กรณี slots เป็น object ที่มี key 0..3 และบางช่องหาย:
    // reconstruct จาก source โดยรักษาตำแหน่งให้มากที่สุด
    if(c.slots && !Array.isArray(c.slots) && typeof c.slots==="object"){
      slots=[0,1,2,3].map(i=>c.slots[i] ?? c.slots[String(i)] ?? null);
    }

    slots=slots.concat([null,null,null,null]).slice(0,4).map(v=>{
      if(v===0 || v==="0" || v===false || v==="")return null;
      const n=Number(v);
      return Number.isFinite(n) && n>0 ? n : null;
    });

    return {
      ...c,
      id:Number(c.id)||index+1,
      name:String(c.name ?? (index+1)),
      slots,
      state:["idle","called","playing"].includes(c.state)
        ? c.state
        : (slots.some(Boolean)?"called":"idle")
    };
  });

  // ถ้าข้อมูลเก่ามากและสนามหายทั้งหมด ให้คืนสนามเริ่มต้น 2 สนาม
  if(state.courts.length===0){
    state.courts=[
      {id:1,name:"1",slots:[null,null,null,null],state:"idle"},
      {id:2,name:"2",slots:[null,null,null,null],state:"idle"}
    ];
  }

  if(!Number.isFinite(+state.queueCounter))state.queueCounter=0;
  if(!Number.isFinite(+state.shuttleCount))state.shuttleCount=0;
  if(!state.sessionDate)state.sessionDate=new Date().toISOString().slice(0,10);

  state.today=state.today.map((p,i)=>{
    p=(p && typeof p==="object")?p:{};
    if(!Number.isFinite(+p.queuePos)){state.queueCounter++;p.queuePos=state.queueCounter}
    if(!p.joinedAt)p.joinedAt=Date.now();
    if(!p.waitStart)p.waitStart=p.joinedAt;
    if(!["waiting","called","playing","paused"].includes(p.status))p.status="waiting";
    if(!Number.isFinite(+p.games))p.games=0;
    p.memberId=Number(p.memberId)||0;
    return p;
  }).filter(p=>p.memberId>0);

  state.members=state.members.map((m,i)=>({
    ...m,
    id:Number(m?.id)||i+1,
    name:String(m?.name||("ผู้เล่น "+(i+1))),
    lv:[1,2,3].includes(Number(m?.lv))?Number(m.lv):2
  }));

  // ถ้าสถานะ today ไม่ตรงกับสนามหลัง migration ให้ sync จากสนาม
  const courtIds=new Set(state.courts.flatMap(c=>c.slots.filter(Boolean)));
  state.today.forEach(p=>{
    if(courtIds.has(p.memberId)){
      const court=state.courts.find(c=>c.slots.includes(p.memberId));
      p.status=court?.state==="playing"?"playing":"called";
    }else if(p.status==="called" || p.status==="playing"){
      p.status="waiting";
      p.waitStart=Date.now();
      p.queuePos=nextQueue();
    }
  });
}

function sessionKey(){
  return state.sessionDate || new Date().toISOString().slice(0,10);
}
function archiveSnapshot(){
  const players=state.today.map(p=>{
    const m=member(p.memberId);
    return {
      memberId:p.memberId,
      name:m?.name||("ID "+p.memberId),
      lv:m?.lv||0,
      games:Number(p.games)||0,
      joinedAt:p.joinedAt||null
    };
  });
  const totalGames=state.history.length;
  const courtCount=state.courts.length;
  const costs=state.costs||{};
  const paidCourtCount=Number(costs.courtCount)||0;
  const courtCost=(Number(costs.courtRate)||0)*(Number(costs.hours)||0)*paidCourtCount;
  const shuttleCost=(Number(costs.shuttleRate)||0)*(Number(state.shuttleCount)||0);
  const totalCost=courtCost+shuttleCost+(Number(costs.other)||0);
  return {
    date:sessionKey(),
    updatedAt:Date.now(),
    playerCount:players.length,
    totalGames,
    shuttleCount:Number(state.shuttleCount)||0,
    courtCount,
    paidCourtCount,
    totalCost,
    perPerson:players.length?totalCost/players.length:0,
    players
  };
}
function syncArchive(){
  if(!state.archive || typeof state.archive!=="object")state.archive={};
  if(!state.plan||typeof state.plan!=="object")state.plan={items:[]};
  if(!Array.isArray(state.plan.items))state.plan.items=[];
  const snap=archiveSnapshot();
  // เก็บแม้ยังไม่มีเกม หากมีผู้เล่นวันนี้ เพื่อไม่ให้ข้อมูลวันนั้นหาย
  if(snap.playerCount>0 || snap.totalGames>0 || snap.shuttleCount>0){
    state.archive[snap.date]=snap;
  }
}
function save(){
  syncArchive();
  localStorage.setItem(KEY,JSON.stringify(state));
}
function member(id){return state.members.find(m=>m.id===id)}
function todayPlayer(memberId){return state.today.find(p=>p.memberId===memberId)}
function nextMemberId(){return Math.max(0,...state.members.map(m=>m.id))+1}
function nextCourtId(){return Math.max(0,...state.courts.map(c=>c.id))+1}
function nextQueue(){state.queueCounter++;return state.queueCounter}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function formatTime(ts){return new Intl.DateTimeFormat("th-TH",{hour:"2-digit",minute:"2-digit"}).format(new Date(ts))}
function waitingMinutes(p){
  if(p.status!=="waiting"||!p.waitStart)return 0;
  return Math.max(0,Math.floor((Date.now()-p.waitStart)/60000));
}
function formatMoney(n){return Number(n||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2})}
function currentDateThai(){
  return new Intl.DateTimeFormat("th-TH",{dateStyle:"full"}).format(new Date());
}

function showPage(id){
  $$(".page").forEach(p=>p.classList.toggle("active",p.id===id));
  $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.page===id));
  const titles={playersPage:"รายชื่อผู้เล่น (ทั้งหมด)",todayPage:"การเล่นวันนี้",costPage:"สรุปค่าใช้จ่ายวันนี้"};
  $("#pageTitle").textContent=titles[id]||"KATOONz Queue";
  if(window.innerWidth<=900)$("#sidebar").classList.remove("open");
  localStorage.setItem("katoonz_v5_page",id);
}
$$(".nav-btn").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
$$(".history-tab").forEach(b=>b.onclick=()=>{
  $$(".history-tab").forEach(x=>x.classList.toggle("active",x===b));
  $("#dailyHistoryPanel").classList.toggle("active",b.dataset.history==="daily");
  $("#weeklyHistoryPanel").classList.toggle("active",b.dataset.history==="weekly");
});
$("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");
$("#todayDate").textContent=currentDateThai();
$("#costDate").textContent=currentDateThai();

let memberEditId=null;
function openMemberModal(id=null){
  memberEditId=id;
  const m=id?member(id):null;
  $("#memberModalTitle").textContent=id?"แก้ไขผู้เล่น":"เพิ่มผู้เล่น";
  $("#memberNameInput").value=m?.name||"";
  $("#memberLvSelect").value=String(m?.lv||2);
  $("#memberModal").classList.remove("hidden");
}
function closeModals(){$$(".modal").forEach(m=>m.classList.add("hidden"))}
$("#addMemberBtn").onclick=()=>openMemberModal();
$$(".modal-close,.modal-bg").forEach(el=>el.onclick=closeModals);
$("#saveMemberBtn").onclick=()=>{
  const name=$("#memberNameInput").value.trim();
  if(!name)return alert("กรุณาใส่ชื่อผู้เล่น");
  if(memberEditId){
    const m=member(memberEditId);m.name=name;m.lv=+$("#memberLvSelect").value;
  }else{
    state.members.push({id:nextMemberId(),name,lv:+$("#memberLvSelect").value});
  }
  save();closeModals();render();
};
function deleteMember(id){
  if(todayPlayer(id))return alert("ผู้เล่นนี้อยู่ในรายชื่อวันนี้ กรุณานำออกจากวันนี้ก่อน");
  if(confirm("ลบผู้เล่นนี้ออกจากรายชื่อทั้งหมด?")){state.members=state.members.filter(m=>m.id!==id);save();render()}
}
let quickEdit={id:null,mode:null};
function openQuickEdit(id,mode){
  const m=member(id);if(!m)return;
  quickEdit={id,mode};
  $("#quickEditTitle").textContent=mode==="name"?"แก้ชื่อผู้เล่น":"ปรับ Level";
  $("#quickNameBlock").style.display=mode==="name"?"block":"none";
  $("#quickLevelBlock").style.display=mode==="level"?"block":"none";
  $("#quickNameInput").value=m.name;
  $("#quickLvSelect").value=String(m.lv);
  $("#quickEditModal").classList.remove("hidden");
}
$("#saveQuickEditBtn").onclick=()=>{
  const m=member(quickEdit.id);if(!m)return;
  if(quickEdit.mode==="name"){
    const name=$("#quickNameInput").value.trim();
    if(!name)return alert("กรุณาใส่ชื่อ");
    m.name=name;
  }else{
    m.lv=+$("#quickLvSelect").value;
  }
  save();closeModals();render();
};
function quickLevel(id){openQuickEdit(id,"level")}

function addToday(memberId){
  if(todayPlayer(memberId))return;
  const now=Date.now();
  state.today.push({memberId,joinedAt:now,waitStart:now,status:"waiting",games:0,queuePos:nextQueue()});
  state.plan.items=[];save();render();
}
function removeToday(memberId){
  const p=todayPlayer(memberId);
  if(!p)return;
  if(state.courts.some(c=>c.slots.includes(memberId)))return alert("ผู้เล่นกำลังอยู่ในสนาม กรุณาจบเกมหรือเปลี่ยนตัวก่อน");
  if(confirm("นำผู้เล่นออกจากวันนี้?")){state.today=state.today.filter(x=>x.memberId!==memberId);state.plan.items=[];save();render()}
}
function togglePause(memberId){
  const p=todayPlayer(memberId);if(!p)return;
  if(p.status==="playing"||p.status==="called")return alert("ผู้เล่นอยู่ในสนาม/ถูกเรียกแล้ว");
  if(p.status==="paused"){p.status="waiting";p.waitStart=Date.now();p.queuePos=nextQueue()}
  else p.status="paused";
  save();render();
}
function editJoinTime(memberId){
  const p=todayPlayer(memberId);
  const current=formatTime(p.joinedAt);
  const val=prompt("เวลาเข้าก๊วน (HH:MM)",current);
  if(!val)return;
  const match=val.match(/^(\d{1,2}):(\d{2})$/);
  if(!match)return alert("รูปแบบเวลาไม่ถูกต้อง");
  const d=new Date();d.setHours(+match[1],+match[2],0,0);
  p.joinedAt=d.getTime();
  if(p.games===0&&p.status==="waiting")p.waitStart=p.joinedAt;
  save();render();
}
function waitingQueue(){
  return state.today.filter(p=>p.status==="waiting").sort((a,b)=>a.queuePos-b.queuePos);
}

function addCourt(){
  const id=nextCourtId();
  state.courts.push({id,name:String(id),slots:[null,null,null,null],state:"idle"});
  save();render();
}
function deleteCourt(id){
  const idx=state.courts.findIndex(c=>c.id===id);if(idx<0)return;
  const c=state.courts[idx];
  if(c.slots.some(Boolean)&&!confirm("สนามนี้มีผู้เล่นอยู่ ต้องการลบและส่งผู้เล่นกลับคิว?"))return;
  c.slots.filter(Boolean).forEach(mid=>{
    const p=todayPlayer(mid);if(p){p.status="waiting";p.waitStart=Date.now();p.queuePos=nextQueue()}
  });
  state.courts.splice(idx,1);save();render();
}
function renameCourt(id,val){const c=state.courts.find(c=>c.id===id);if(c){c.name=val.trim()||String(id);save()}}


function groupKey(ids){return ids.slice().sort((a,b)=>a-b).join("-")}
function rrPairKey(a,b){return [a,b].sort((x,y)=>x-y).join("-")}

function rrHistory(){
  const group={}, meet={}, partner={}, opponent={};
  state.history.forEach(h=>{
    const s=(h.slots||[]).filter(Boolean);
    if(s.length!==4)return;

    group[groupKey(s)]=(group[groupKey(s)]||0)+1;

    for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
      const k=rrPairKey(s[i],s[j]);
      meet[k]=(meet[k]||0)+1;
    }

    [[s[0],s[1]],[s[2],s[3]]].forEach(([a,b])=>{
      const k=rrPairKey(a,b); partner[k]=(partner[k]||0)+1;
    });

    [[s[0],s[2]],[s[0],s[3]],[s[1],s[2]],[s[1],s[3]]].forEach(([a,b])=>{
      const k=rrPairKey(a,b); opponent[k]=(opponent[k]||0)+1;
    });
  });
  return {group,meet,partner,opponent};
}

function rrBestPairing(ids, hist, virtualPartner, virtualOpponent){
  const opts=[
    [ids[0],ids[1],ids[2],ids[3]],
    [ids[0],ids[2],ids[1],ids[3]],
    [ids[0],ids[3],ids[1],ids[2]]
  ];
  let best=opts[0], bestScore=Infinity;
  opts.forEach(z=>{
    const p1=rrPairKey(z[0],z[1]), p2=rrPairKey(z[2],z[3]);
    const opp=[
      rrPairKey(z[0],z[2]),rrPairKey(z[0],z[3]),
      rrPairKey(z[1],z[2]),rrPairKey(z[1],z[3])
    ];
    const s=
      ((hist.partner[p1]||0)+(hist.partner[p2]||0)+(virtualPartner[p1]||0)+(virtualPartner[p2]||0))*60 +
      opp.reduce((n,k)=>n+(hist.opponent[k]||0)+(virtualOpponent[k]||0),0)*12;
    if(s<bestScore){bestScore=s;best=z}
  });
  return best;
}

function generatePlan(){
  const hist=rrHistory();
  const plans=[];
  let virtual=waitingQueue().map(p=>({...p}));
  const vGroup={}, vMeet={}, vPartner={}, vOpponent={}, vUse={};

  for(let round=0; round<5 && virtual.length>=4; round++){
    const pool=virtual.slice(0,Math.min(12,virtual.length));
    let best=null,bestScore=Infinity;

    for(let a=0;a<pool.length;a++)
    for(let b=a+1;b<pool.length;b++)
    for(let c=b+1;c<pool.length;c++)
    for(let d=c+1;d<pool.length;d++){
      const four=[pool[a],pool[b],pool[c],pool[d]];
      const ids=four.map(x=>x.memberId);

      let score=(a+b+c+d)*18;
      score+=((hist.group[groupKey(ids)]||0)+(vGroup[groupKey(ids)]||0))*180;
      score+=ids.reduce((n,id)=>n+(vUse[id]||0),0)*35;

      for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
        const k=rrPairKey(ids[i],ids[j]);
        score+=((hist.meet[k]||0)+(vMeet[k]||0))*18;
      }

      if(score<bestScore){bestScore=score;best=four}
    }

    if(!best)break;

    const ids=best.map(x=>x.memberId);
    const paired=rrBestPairing(ids,hist,vPartner,vOpponent);
    plans.push({ids,paired});

    vGroup[groupKey(ids)]=(vGroup[groupKey(ids)]||0)+1;
    ids.forEach(id=>vUse[id]=(vUse[id]||0)+1);

    for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
      const k=rrPairKey(ids[i],ids[j]);
      vMeet[k]=(vMeet[k]||0)+1;
    }

    [[paired[0],paired[1]],[paired[2],paired[3]]].forEach(([a,b])=>{
      const k=rrPairKey(a,b); vPartner[k]=(vPartner[k]||0)+1;
    });

    [[paired[0],paired[2]],[paired[0],paired[3]],[paired[1],paired[2]],[paired[1],paired[3]]].forEach(([a,b])=>{
      const k=rrPairKey(a,b); vOpponent[k]=(vOpponent[k]||0)+1;
    });

    const used=new Set(ids);
    const remain=virtual.filter(p=>!used.has(p.memberId));
    let qmax=remain.reduce((m,p)=>Math.max(m,+p.queuePos||0),0);
    best.forEach(p=>remain.push({...p,queuePos:++qmax}));
    virtual=remain;
  }

  state.plan.items=plans;
  save();
  return plans;
}

function nextPlanned(){
  if(!state.plan.items.length)generatePlan();
  while(state.plan.items.length){
    const item=state.plan.items.shift();
    if(item.ids.every(id=>todayPlayer(id)?.status==="waiting")){
      return item.ids.map(id=>todayPlayer(id));
    }
  }
  return null;
}

function renderLookahead(){
  const box=$("#lookaheadList");
  if(!box)return;
  if(!state.plan.items.length)generatePlan();
  box.innerHTML=state.plan.items.length
    ? state.plan.items.slice(0,5).map((it,i)=>{
        const names=it.ids.map(id=>member(id)?.name||("ID "+id));
        return `<div class="lookahead-item">
          <div class="lookahead-no">${i+1}</div>
          <div>
            <div class="lookahead-names">${names.map(esc).join(" · ")}</div>
            <div class="round-robin-note">ไม่ใช้ Level · ลดกลุ่มซ้ำ · ลดคู่ซ้ำ · ลดคนเดิมเจอบ่อย</div>
          </div>
          <div class="lookahead-status">ถัดไป</div>
        </div>`;
      }).join("")
    : '<div class="empty-state">ยังวางคิวล่วงหน้าไม่ได้</div>';
}
function chooseNextFour(){const p=nextPlanned();if(p&&p.length===4)return p;const q=waitingQueue();return q.length>=4?q.slice(0,4):null;}
function pairKey(a,b){
  return [a,b].sort((x,y)=>x-y).join("-");
}
function encounterStats(){
  const partner={},opponent={},recentPartner={},recentOpponent={},courtUse={};

  state.history.forEach((h,index)=>{
    const s=h.slots||[];
    if(s.length!==4)return;

    const partners=[[s[0],s[1]],[s[2],s[3]]];
    const opponents=[[s[0],s[2]],[s[0],s[3]],[s[1],s[2]],[s[1],s[3]]];

    partners.forEach(([a,b])=>{
      const k=pairKey(a,b);
      partner[k]=(partner[k]||0)+1;
      // เกมล่าสุดมีน้ำหนักสูงกว่า
      if(index<8)recentPartner[k]=(recentPartner[k]||0)+(8-index);
    });

    opponents.forEach(([a,b])=>{
      const k=pairKey(a,b);
      opponent[k]=(opponent[k]||0)+1;
      if(index<8)recentOpponent[k]=(recentOpponent[k]||0)+(8-index);
    });

    const courtName=String(h.court||"");
    s.forEach(mid=>{
      const key=mid+"@"+courtName;
      courtUse[key]=(courtUse[key]||0)+1;
    });
  });

  return{partner,opponent,recentPartner,recentOpponent,courtUse};
}

function scorePairing(z,stats){
  const p1=pairKey(z[0],z[1]);
  const p2=pairKey(z[2],z[3]);

  const opp=[
    pairKey(z[0],z[2]),
    pairKey(z[0],z[3]),
    pairKey(z[1],z[2]),
    pairKey(z[1],z[3])
  ];

  // คู่เดิมมีโทษสูงที่สุด
  const partnerRepeat=(stats.partner[p1]||0)+(stats.partner[p2]||0);
  const recentPartner=(stats.recentPartner[p1]||0)+(stats.recentPartner[p2]||0);

  // คู่แข่งเดิมมีโทษรองลงมา
  const opponentRepeat=opp.reduce((n,k)=>n+(stats.opponent[k]||0),0);
  const recentOpponent=opp.reduce((n,k)=>n+(stats.recentOpponent[k]||0),0);

  return (
    partnerRepeat*40 +
    recentPartner*14 +
    opponentRepeat*7 +
    recentOpponent*3
  );
}

function pairFour(players){
  const ids=players.map(p=>p.memberId);
  return rrBestPairing(ids,rrHistory(),{},{});
}

function courtDiversityScore(mid,courtName){
  const stats=encounterStats();
  return stats.courtUse[mid+"@"+String(courtName)]||0;
}

function callCourt(id){
  const c=state.courts.find(c=>c.id===id);
  if(!c)return;
  if(c.state!=="idle"||c.slots.some(Boolean))return alert("สนามนี้มีคิวแล้ว");
  const next=chooseNextFour();
  if(!next)return alert("ผู้เล่นที่รอมีไม่ถึง 4 คน");
  let paired=pairFour(next);

  // ช่วยให้ผู้เล่นได้หมุนเวียนใช้หลายสนาม โดยไม่เปลี่ยนสิทธิ์ 4 คนที่รอนานสุด
  const left=[paired[0],paired[1]];
  const right=[paired[2],paired[3]];
  const originalScore=paired.reduce((n,mid)=>n+courtDiversityScore(mid,c.name),0);
  const flipped=[right[0],right[1],left[0],left[1]];
  const flippedScore=flipped.reduce((n,mid)=>n+courtDiversityScore(mid,c.name),0);
  if(flippedScore<originalScore)paired=flipped;

  c.slots=paired;
  c.state="called";
  paired.forEach(mid=>{
    const p=todayPlayer(mid);
    if(p)p.status="called";
  });
  save();render();
}
function playCourt(id){
  const c=state.courts.find(c=>c.id===id);
  if(!c||c.state!=="called"||c.slots.some(x=>!x))return;
  c.state="playing";
  c.startedAt=Date.now();
  c.slots.forEach(mid=>{
    const p=todayPlayer(mid);
    if(p){p.status="playing";p.games++}
  });
  save();render();
}
function endCourt(id){
  const c=state.courts.find(c=>c.id===id);
  if(!c||c.state==="idle")return;
  const ids=c.slots.filter(Boolean);
  if(c.state==="playing"&&ids.length){
    state.history.unshift({time:Date.now(),court:c.name,slots:[...ids]});
  }
  ids.forEach(mid=>{
    const p=todayPlayer(mid);
    if(p){p.status="waiting";p.waitStart=Date.now();p.queuePos=nextQueue()}
  });
  c.slots=[null,null,null,null];
  c.state="idle";
  c.startedAt=null;
  state.plan.items=[];
  save();render();
}
let replaceTarget=null;
function openReplace(courtId,slot){
  const c=state.courts.find(c=>c.id===courtId),oldId=c?.slots?.[slot];
  if(!c||!oldId)return;
  replaceTarget={courtId,slot,oldId};
  $("#replaceText").textContent="เปลี่ยน "+(member(oldId)?.name||"ผู้เล่น");

  const waiting=waitingQueue();
  let html='<div class="replace-group-title">คนที่กำลังรอ</div>';
  html+=waiting.length?waiting.map(p=>{
    const m=member(p.memberId);
    return `<button class="replace-choice" data-type="waiting" data-mid="${p.memberId}">
      <b>${esc(m?.name)}</b> · Lv.${m?.lv} · รอ ${waitingMinutes(p)} นาที
    </button>`;
  }).join(""):'<div class="empty-state">ไม่มีคนรอ</div>';

  if(c.state==="called"){
    const others=[];
    state.courts.filter(x=>x.id!==courtId && x.state==="called").forEach(other=>{
      other.slots.forEach((mid,sidx)=>{
        if(mid)others.push({courtId:other.id,slot:sidx,mid,courtName:other.name});
      });
    });
    html+='<div class="replace-group-title">สลับกับสนามอื่น (เฉพาะสนามที่ยังไม่กดเล่น)</div>';
    html+=others.length?others.map(o=>{
      const m=member(o.mid);
      return `<button class="replace-choice other-court" data-type="court" data-mid="${o.mid}" data-cid="${o.courtId}" data-slot="${o.slot}">
        <b>${esc(m?.name)}</b> · สนาม ${esc(o.courtName)} · Lv.${m?.lv}
      </button>`;
    }).join(""):'<div class="empty-state">ไม่มีสนามอื่นที่อยู่สถานะ “เรียกแล้ว”</div>';
  }

  $("#replaceChoices").innerHTML=html;
  $$(".replace-choice").forEach(b=>b.onclick=()=>{
    if(b.dataset.type==="court"){
      swapAcrossCourts(+b.dataset.cid,+b.dataset.slot);
    }else{
      replaceWithWaiting(+b.dataset.mid);
    }
  });
  $("#replaceModal").classList.remove("hidden");
}
function replaceWithWaiting(newId){
  if(!replaceTarget)return;
  const c=state.courts.find(c=>c.id===replaceTarget.courtId);
  const old=todayPlayer(replaceTarget.oldId),incoming=todayPlayer(newId);
  c.slots[replaceTarget.slot]=newId;

  if(c.state==="called"){
    if(old){old.status="waiting";old.waitStart=Date.now();old.queuePos=nextQueue()}
    if(incoming)incoming.status="called";
  }else if(c.state==="playing"){
    if(old){old.status="waiting";old.waitStart=Date.now();old.queuePos=nextQueue()}
    if(incoming){incoming.status="playing";incoming.games++}
  }
  closeModals();save();render();
}
function swapAcrossCourts(otherCourtId,otherSlot){
  if(!replaceTarget)return;
  const a=state.courts.find(c=>c.id===replaceTarget.courtId);
  const b=state.courts.find(c=>c.id===otherCourtId);
  if(!a||!b||a.state!=="called"||b.state!=="called"){
    return alert("สลับข้ามสนามได้เฉพาะสนามที่ยังไม่ได้กดเล่น");
  }
  const temp=a.slots[replaceTarget.slot];
  a.slots[replaceTarget.slot]=b.slots[otherSlot];
  b.slots[otherSlot]=temp;
  closeModals();save();render();
}
$("#addCourtBtn").onclick=addCourt;
$("#shuttlePlus").onclick=()=>{state.shuttleCount++;save();render()};
$("#shuttleMinus").onclick=()=>{state.shuttleCount=Math.max(0,state.shuttleCount-1);save();render()};


["courtRate","costCourtCount","hoursPlayed","shuttleRate","otherCost"].forEach(id=>{
  $("#"+id).oninput=()=>{
    state.costs={
      courtRate:+$("#courtRate").value||0,
      courtCount:+$("#costCourtCount").value||0,
      hours:+$("#hoursPlayed").value||0,
      shuttleRate:+$("#shuttleRate").value||0,
      other:+$("#otherCost").value||0,
      qrData:state.costs.qrData||""
    };
    save();renderCosts();
  };
});


$("#costCourtPlus").onclick=()=>{
  state.costs.courtCount=(+state.costs.courtCount||0)+1;
  save();renderCosts();
};
$("#costCourtMinus").onclick=()=>{
  state.costs.courtCount=Math.max(0,(+state.costs.courtCount||0)-1);
  save();renderCosts();
};

$("#uploadQrBtn").onclick=()=>$("#qrFile").click();
$("#removeQrBtn").onclick=()=>{
  state.costs.qrData="";
  save();renderCosts();
};
$("#qrFile").onchange=e=>{
  const file=e.target.files?.[0];
  if(!file)return;
  if(!file.type.startsWith("image/"))return alert("กรุณาเลือกไฟล์รูปภาพ");
  const reader=new FileReader();
  reader.onload=()=>{
    const img=new Image();
    img.onload=()=>{
      const max=700;
      const scale=Math.min(1,max/Math.max(img.width,img.height));
      const canvas=document.createElement("canvas");
      canvas.width=Math.round(img.width*scale);
      canvas.height=Math.round(img.height*scale);
      const ctx=canvas.getContext("2d");
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      state.costs.qrData=canvas.toDataURL("image/jpeg",0.82);
      save();renderCosts();
    };
    img.src=reader.result;
  };
  reader.readAsDataURL(file);
  e.target.value="";
};

$("#newDayBtn").onclick=()=>{
  syncArchive();
  localStorage.setItem(KEY,JSON.stringify(state));
  if(!confirm("เริ่มวันใหม่? จะล้างผู้เล่นวันนี้ คิว สนามที่กำลังเล่น จำนวนลูก และประวัติวันนี้ แต่เก็บรายชื่อสมาชิกไว้"))return;
  state.today=[];
  state.courts=[{id:1,name:"1",slots:[null,null,null,null],state:"idle"},{id:2,name:"2",slots:[null,null,null,null],state:"idle"}];
  state.shuttleCount=0;state.queueCounter=0;state.history=[];state.plan={items:[]};state.sessionDate=new Date().toISOString().slice(0,10);
  save();render();
};
$("#backupBtn").onclick=()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="KATOONz_v5_backup.json";a.click();URL.revokeObjectURL(a.href)
};
$("#restoreBtn").onclick=()=>$("#restoreFile").click();
$("#restoreFile").onchange=e=>{
  const file=e.target.files?.[0];if(!file)return;
  const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);normalizeState();save();render();alert("กู้คืนข้อมูลสำเร็จ")}catch{alert("ไฟล์สำรองไม่ถูกต้อง")}};r.readAsText(file);e.target.value=""
};

$("#playerSearch").oninput=renderMembers;
$("#levelFilter").onchange=renderMembers;

function renderMembers(){
  const q=$("#playerSearch").value.trim().toLowerCase(),lv=$("#levelFilter").value;
  const list=state.members.filter(m=>(!q||m.name.toLowerCase().includes(q))&&(lv==="all"||String(m.lv)===lv));
  $("#memberList").innerHTML=list.length?list.map((m,i)=>{
    const t=todayPlayer(m.id);
    return `<div class="member-row">
      <div class="member-no">${i+1}</div>
      <div><div class="member-level-dot-wrap"><span class="level-dot lv${m.lv}"></span><div class="member-name">${esc(m.name)}</div></div><small class="status-today">${t?"● อยู่ในวันนี้แล้ว":""}</small></div>
      <div><span class="lv-badge lv${m.lv}">Lv.${m.lv}</span></div>
      <div>${t?'<span class="status-chip status-wait">วันนี้</span>':'<span class="muted">—</span>'}</div>
      <div class="member-actions">
        ${t?`<button class="mini-btn remove-today" data-id="${m.id}">นำออกวันนี้</button>`:`<button class="primary add-today" data-id="${m.id}">เพิ่มวันนี้</button>`}
        <button class="mini-btn edit-member" data-id="${m.id}">แก้ชื่อ</button>
        <button class="mini-btn edit-lv" data-id="${m.id}">ปรับ Lv.</button>
        <button class="danger-btn delete-member" data-id="${m.id}">ลบ</button>
      </div>
    </div>`
  }).join(""):'<div class="empty-state">ไม่พบรายชื่อผู้เล่น</div>';
  $$(".add-today").forEach(b=>b.onclick=()=>addToday(+b.dataset.id));
  $$(".remove-today").forEach(b=>b.onclick=()=>removeToday(+b.dataset.id));
  $$(".edit-member").forEach(b=>b.onclick=()=>openQuickEdit(+b.dataset.id,"name"));
  $$(".edit-lv").forEach(b=>b.onclick=()=>quickLevel(+b.dataset.id));
  $$(".delete-member").forEach(b=>b.onclick=()=>deleteMember(+b.dataset.id));
}
function renderQueue(){
  const sorted=[...state.today].sort((a,b)=>{
    const order={waiting:0,called:1,playing:2,paused:3};
    return order[a.status]-order[b.status] || a.queuePos-b.queuePos;
  });
  $("#todayQueue").innerHTML=sorted.length?sorted.map((p,i)=>{
    const m=member(p.memberId);
    const status=p.status==="waiting"?["รอ","status-wait"]:
      p.status==="called"?["ถูกเรียก","status-pause"]:
      p.status==="playing"?["เล่น","status-play"]:["พักเอง","status-pause"];
    return `<div class="queue-row">
      <div class="queue-pos">#${i+1}${p.status==="waiting"&&i<4?'<br><span class="smart-badge">คิวถัดไป</span>':""}</div>
      <div class="member-level-dot-wrap"><span class="level-dot lv${m?.lv}"></span><b>${esc(m?.name)}</b> <span class="lv-badge lv${m?.lv}">Lv.${m?.lv}</span></div>
      <div class="queue-time">มา ${formatTime(p.joinedAt)}</div>
      <div class="queue-games">🎮 ${p.games}</div>
      <div class="queue-wait">⏱ ${p.status==="waiting"?waitingMinutes(p):0} นาที</div>
      <div><button class="status-chip ${status[1]} pause-btn" data-id="${p.memberId}">${status[0]}</button></div>
      <div style="grid-column:2/-1;display:flex;gap:5px">
        <button class="mini-btn time-btn" data-id="${p.memberId}">แก้เวลา</button>
        <button class="mini-btn remove-today" data-id="${p.memberId}">นำออกวันนี้</button>
      </div>
    </div>`
  }).join(""):'<div class="empty-state">ยังไม่มีผู้เล่นวันนี้</div>';
  $$(".pause-btn").forEach(b=>b.onclick=()=>togglePause(+b.dataset.id));
  $$(".time-btn").forEach(b=>b.onclick=()=>editJoinTime(+b.dataset.id));
  $$(".remove-today").forEach(b=>b.onclick=()=>removeToday(+b.dataset.id));
}
function renderCourts(){
  $("#courtList").innerHTML=state.courts.length?state.courts.map(c=>`
    <div class="court-card">
      <button class="court-delete" data-id="${c.id}">×</button>
      <div class="court-title"><span>สนาม</span><input class="court-name-input" data-id="${c.id}" value="${esc(c.name)}">
        <span class="court-state-badge ${c.state==="idle"?"court-state-idle":c.state==="called"?"court-state-called":"court-state-playing"}">${c.state==="idle"?"ว่าง":c.state==="called"?"เรียกแล้ว":"กำลังเล่น"}</span>
      </div>
      <div class="court-slots">
        ${c.slots.map((mid,idx)=>{
          const m=mid?member(mid):null;
          return `<button class="court-slot ${mid?"filled":""}" data-cid="${c.id}" data-slot="${idx}">
            ${m?`<div><b>${esc(m.name)}</b><small>Lv.${m.lv} · แตะเพื่อเปลี่ยน</small></div>`:'ว่าง'}
          </button>`
        }).join("")}
      </div>
      <div class="court-controls">
        <button class="call-btn" data-id="${c.id}" ${c.state!=="idle"?"disabled":""}>① เรียก</button>
        <button class="play-btn" data-id="${c.id}" ${c.state!=="called"?"disabled":""}>② เล่น</button>
        <button class="end-btn" data-id="${c.id}" ${c.state==="idle"?"disabled":""}>③ จบเกม</button>
      </div>
      <div class="swap-hint">
        ${c.state==="called"
          ? "🤖 Smart Rotation จัดคู่แล้ว · แตะชื่อเพื่อเปลี่ยน/สลับก่อนกดเล่น"
          : c.state==="playing"
          ? "กำลังเล่น · แตะชื่อเพื่อเปลี่ยนกับคนรอ"
          : "สนามว่าง"}
      </div>
    </div>`).join(""):'<div class="empty-state">ยังไม่มีสนาม กด “เพิ่มสนาม”</div>';
  $$(".court-delete").forEach(b=>b.onclick=()=>deleteCourt(+b.dataset.id));
  $$(".court-name-input").forEach(i=>i.onchange=()=>renameCourt(+i.dataset.id,i.value));
  $$(".call-btn").forEach(b=>b.onclick=()=>callCourt(+b.dataset.id));
  $$(".play-btn").forEach(b=>b.onclick=()=>playCourt(+b.dataset.id));
  $$(".end-btn").forEach(b=>b.onclick=()=>endCourt(+b.dataset.id));
  $$(".court-slot.filled").forEach(b=>b.onclick=()=>openReplace(+b.dataset.cid,+b.dataset.slot));
}
function renderCosts(){
  $("#courtRate").value=state.costs.courtRate;
  $("#costCourtCount").value=state.costs.courtCount;
  $("#hoursPlayed").value=state.costs.hours;
  $("#shuttleRate").value=state.costs.shuttleRate;
  $("#otherCost").value=state.costs.other;
  const courtCount=+state.costs.courtCount||0;
  const courtCost=state.costs.courtRate*state.costs.hours*courtCount;
  const shuttleCost=state.costs.shuttleRate*state.shuttleCount;
  const total=courtCost+shuttleCost+state.costs.other;
  const n=state.today.length;
  $("#courtCostText").textContent=formatMoney(courtCost)+" บาท";
  $("#courtFormula").textContent=`${formatMoney(state.costs.courtRate)} × ${courtCount} สนาม × ${state.costs.hours} ชม.`;
  $("#shuttleCostText").textContent=formatMoney(shuttleCost)+" บาท";
  $("#shuttleFormula").textContent=`${formatMoney(state.costs.shuttleRate)} × ${state.shuttleCount} ลูก`;
  $("#otherCostText").textContent=formatMoney(state.costs.other)+" บาท";
  $("#totalCostText").textContent=formatMoney(total)+" บาท";
  $("#costPlayerCount").textContent=n+" คน";
  $("#perPersonText").textContent=(n?formatMoney(total/n):"0.00")+" บาท";
  const hasQr=!!state.costs.qrData;
  $("#qrPreviewWrap").classList.toggle("hidden",!hasQr);
  $("#removeQrBtn").style.display=hasQr?"inline-block":"none";
  if(hasQr)$("#qrPreview").src=state.costs.qrData;
}

function thaiShortDate(dateStr){
  const d=new Date(dateStr+"T12:00:00");
  return new Intl.DateTimeFormat("th-TH",{day:"numeric",month:"short",year:"numeric"}).format(d);
}
function startOfWeek(dateStr){
  const d=new Date(dateStr+"T12:00:00");
  const day=(d.getDay()+6)%7; // Monday=0
  d.setDate(d.getDate()-day);
  return d.toISOString().slice(0,10);
}
function endOfWeek(startStr){
  const d=new Date(startStr+"T12:00:00");
  d.setDate(d.getDate()+6);
  return d.toISOString().slice(0,10);
}
function renderDailyHistory(){
  const entries=Object.values(state.archive||{}).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  $("#dailyHistoryList").innerHTML=entries.length?entries.map(s=>`
    <div class="history-day">
      <div class="history-day-head">
        <div><b>${thaiShortDate(s.date)}</b><small> · อัปเดต ${formatTime(s.updatedAt)}</small></div>
        <small>${s.playerCount||0} คน</small>
      </div>
      <div class="history-stats">
        <div class="history-stat"><strong>${s.totalGames||0}</strong><span>เกม</span></div>
        <div class="history-stat"><strong>${s.playerCount||0}</strong><span>ผู้เล่น</span></div>
        <div class="history-stat"><strong>${s.courtCount||0}</strong><span>สนาม</span></div>
        <div class="history-stat"><strong>${s.shuttleCount||0}</strong><span>ลูก</span></div>
        <div class="history-stat"><strong>${formatMoney(s.totalCost||0)}</strong><span>บาท</span></div>
      </div>
      <div class="history-player-list">
        ${(s.players||[]).slice().sort((a,b)=>(b.games||0)-(a.games||0)).map(p=>`
          <div class="history-player"><b>${esc(p.name)}</b> · ${p.games||0} เกม</div>
        `).join("")}
      </div>
    </div>
  `).join(""):'<div class="empty-state">ยังไม่มีประวัติรายวัน</div>';
}
function renderWeeklyHistory(){
  const days=Object.values(state.archive||{});
  const weeks={};
  days.forEach(s=>{
    const key=startOfWeek(s.date);
    if(!weeks[key])weeks[key]={start:key,end:endOfWeek(key),days:0,totalGames:0,shuttleCount:0,totalCost:0,playerGames:{}};
    const w=weeks[key];
    w.days++;
    w.totalGames+=Number(s.totalGames)||0;
    w.shuttleCount+=Number(s.shuttleCount)||0;
    w.totalCost+=Number(s.totalCost)||0;
    (s.players||[]).forEach(p=>{
      const k=p.name||String(p.memberId);
      w.playerGames[k]=(w.playerGames[k]||0)+(Number(p.games)||0);
    });
  });
  const arr=Object.values(weeks).sort((a,b)=>b.start.localeCompare(a.start));
  $("#weeklyHistoryList").innerHTML=arr.length?arr.map(w=>{
    const players=Object.entries(w.playerGames).sort((a,b)=>b[1]-a[1]);
    return `<div class="history-day">
      <div class="week-title">${thaiShortDate(w.start)} – ${thaiShortDate(w.end)}</div>
      <div class="history-stats">
        <div class="history-stat"><strong>${w.days}</strong><span>วันที่เล่น</span></div>
        <div class="history-stat"><strong>${w.totalGames}</strong><span>เกมรวม</span></div>
        <div class="history-stat"><strong>${players.length}</strong><span>ผู้เล่น</span></div>
        <div class="history-stat"><strong>${w.shuttleCount}</strong><span>ลูก</span></div>
        <div class="history-stat"><strong>${formatMoney(w.totalCost)}</strong><span>บาท</span></div>
      </div>
      <div class="history-player-list">
        ${players.map(([name,games])=>`<div class="history-player"><b>${esc(name)}</b> · ${games} เกม</div>`).join("")}
      </div>
    </div>`;
  }).join(""):'<div class="empty-state">ยังไม่มีประวัติรายสัปดาห์</div>';
}
function renderHistoryArchive(){
  syncArchive();
  renderDailyHistory();
  renderWeeklyHistory();
}

function renderStats(){
  const playing=state.today.filter(p=>p.status==="playing").length;
  const waiting=state.today.filter(p=>p.status==="waiting").length;
  $("#allPlayerCount").textContent=state.members.length;
  $("#todayPlayerCountHome").textContent=state.today.length;
  $("#playingCountHome").textContent=playing;
  $("#todayCount").textContent=state.today.length;
  $("#playingCount").textContent=playing;
  $("#waitingCount").textContent=waiting;
  $("#shuttleSummary").textContent=state.shuttleCount;
  $("#shuttleCount").textContent=state.shuttleCount;
}
$("#rebuildPlanBtn")?.addEventListener("click",()=>{state.plan.items=[];generatePlan();render()});
function render(){
  renderMembers();renderQueue();renderLookahead();renderCourts();renderCosts();renderStats();renderHistoryArchive();
}
render();
setInterval(()=>{renderQueue()},60000);
showPage(localStorage.getItem("katoonz_v5_page")||"playersPage");

if("serviceWorker" in navigator && location.protocol!=="file:"){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.error));
}