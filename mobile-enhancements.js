
/* KATOONz Queue v6.0.0 — Smartphone UI + Pairing Modes */
(()=>{
  "use strict";

  if(typeof state==="undefined" || typeof save!=="function" || typeof render!=="function"){
    console.error("KATOONz v6 layer: core app not loaded");
    return;
  }

  const MODES={
    balanced:{
      icon:"⚖️",name:"สมดุล",
      desc:"สมดุลเวลารอ + ลดคู่ซ้ำและคู่แข่งซ้ำ",
      note:"ให้สิทธิ์คนต้นคิวสูง และลดคู่/กลุ่มซ้ำ"
    },
    newpeople:{
      icon:"🆕",name:"เจอคนใหม่",
      desc:"เน้นให้ผู้เล่นพบคนที่ยังเจอกันน้อย",
      note:"ลดการเจอคนเดิมทั้งคู่และคู่แข่ง"
    },
    nopartner:{
      icon:"🔁",name:"คู่ไม่ซ้ำ",
      desc:"รักษาลำดับคิว แต่ลงโทษพาร์ตเนอร์เดิมมากเป็นพิเศษ",
      note:"หลีกเลี่ยงคู่เดิมก่อน แล้วค่อยดูคู่แข่ง"
    },
    random:{
      icon:"🎲",name:"สุ่มสนุก",
      desc:"สุ่มจากกลุ่มต้นคิว โดยยังไม่ปล่อยให้คนรอนานหลุดคิวมากเกินไป",
      note:"สุ่มแบบมีขอบเขตจากคนต้นคิว"
    },
    manual:{
      icon:"✋",name:"กำหนดเอง",
      desc:"เรียกคนต้นคิว 4 คนก่อน แล้วแตะชื่อในสนามเพื่อสลับ/จัดคู่เอง",
      note:"ระบบเลือก 4 คน แต่ผู้จัดเป็นคนจัดฝั่ง"
    }
  };

  if(!state.ui || typeof state.ui!=="object")state.ui={fontSize:"md"};
  if(!MODES[state.ui.pairingMode])state.ui.pairingMode="balanced";

  const coreGeneratePlan=generatePlan;
  const coreChooseNextFour=chooseNextFour;
  const corePairFour=pairFour;
  const coreRenderLookahead=renderLookahead;
  const coreRender=render;
  const coreShowPage=showPage;

  function mode(){return state.ui?.pairingMode||"balanced"}
  function hist(){return rrHistory()}

  function allPairings(ids){
    if(!ids || ids.length!==4)return [];
    return [
      [ids[0],ids[1],ids[2],ids[3]],
      [ids[0],ids[2],ids[1],ids[3]],
      [ids[0],ids[3],ids[1],ids[2]]
    ].filter(z=>typeof rulePairingAllowed!=="function" || rulePairingAllowed(z));
  }

  function pairingScore(z,selectedMode){
    const h=hist();
    const stats=typeof encounterStats==="function"?encounterStats():null;
    const p1=rrPairKey(z[0],z[1]), p2=rrPairKey(z[2],z[3]);
    const opp=[
      rrPairKey(z[0],z[2]),rrPairKey(z[0],z[3]),
      rrPairKey(z[1],z[2]),rrPairKey(z[1],z[3])
    ];

    const partner=(h.partner[p1]||0)+(h.partner[p2]||0);
    const opponent=opp.reduce((n,k)=>n+(h.opponent[k]||0),0);
    const recentPartner=stats?((stats.recentPartner[p1]||0)+(stats.recentPartner[p2]||0)):0;
    const recentOpponent=stats?opp.reduce((n,k)=>n+(stats.recentOpponent[k]||0),0):0;

    if(selectedMode==="nopartner")
      return partner*160 + recentPartner*55 + opponent*5 + recentOpponent*2;

    if(selectedMode==="newpeople")
      return partner*45 + opponent*18 + recentPartner*10 + recentOpponent*6;

    return partner*60 + recentPartner*14 + opponent*12 + recentOpponent*3;
  }

  function bestPair(ids,selectedMode){
    const opts=allPairings(ids);
    if(!opts.length)return null;

    if(selectedMode==="random"){
      return opts[Math.floor(Math.random()*opts.length)];
    }
    if(selectedMode==="manual"){
      return opts.find(z=>z[0]===ids[0]&&z[1]===ids[1]) || opts[0];
    }

    let best=opts[0],bestScore=Infinity;
    opts.forEach(z=>{
      const s=pairingScore(z,selectedMode);
      if(s<bestScore){best=z;bestScore=s}
    });
    return best;
  }

  function combinations(pool){
    const out=[];
    for(let a=0;a<pool.length;a++)
    for(let b=a+1;b<pool.length;b++)
    for(let c=b+1;c<pool.length;c++)
    for(let d=c+1;d<pool.length;d++)
      out.push([pool[a],pool[b],pool[c],pool[d]]);
    return out;
  }

  function groupScore(four,selectedMode,indexes,virtualMeet={},virtualGroup={},virtualUse={}){
    const ids=four.map(x=>x.memberId);
    const h=hist();
    const gk=groupKey(ids);

    let waitPenalty=indexes.reduce((a,b)=>a+b,0);

    if(selectedMode==="newpeople")waitPenalty*=7;
    else if(selectedMode==="random")waitPenalty*=12;
    else waitPenalty*=18;

    let s=waitPenalty;

    if(selectedMode==="newpeople"){
      s+=((h.group[gk]||0)+(virtualGroup[gk]||0))*110;
      for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
        const k=rrPairKey(ids[i],ids[j]);
        s+=((h.meet[k]||0)+(virtualMeet[k]||0))*55;
      }
    }else{
      s+=((h.group[gk]||0)+(virtualGroup[gk]||0))*180;
      for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
        const k=rrPairKey(ids[i],ids[j]);
        s+=((h.meet[k]||0)+(virtualMeet[k]||0))*18;
      }
    }

    s+=ids.reduce((n,id)=>n+(virtualUse[id]||0),0)*35;
    if(typeof rulePenaltyForGroup==="function")s+=rulePenaltyForGroup(ids);
    return s;
  }

  function chooseGroupFromPool(pool,selectedMode,virtualMeet={},virtualGroup={},virtualUse={}){
    if(pool.length<4)return null;

    if(selectedMode==="random"){
      // Protect the two longest waiters, randomize two more from the next group.
      const first=pool[0],second=pool[1];
      const rest=pool.slice(2,Math.min(8,pool.length)).sort(()=>Math.random()-.5);
      const candidates=[];
      for(let i=0;i<rest.length;i++)for(let j=i+1;j<rest.length;j++){
        candidates.push([first,second,rest[i],rest[j]]);
      }
      for(const four of candidates.sort(()=>Math.random()-.5)){
        const ids=four.map(x=>x.memberId);
        if((typeof ruleGroupAllowed!=="function"||ruleGroupAllowed(ids)) && bestPair(ids,selectedMode))return four;
      }
    }

    if(selectedMode==="manual" || selectedMode==="nopartner"){
      for(const four of combinations(pool)){
        const ids=four.map(x=>x.memberId);
        if((typeof ruleGroupAllowed!=="function"||ruleGroupAllowed(ids)) && bestPair(ids,selectedMode))return four;
      }
      return null;
    }

    let best=null,bestScore=Infinity;
    combinations(pool).forEach(four=>{
      const ids=four.map(x=>x.memberId);
      if(typeof ruleGroupAllowed==="function" && !ruleGroupAllowed(ids))return;
      if(!bestPair(ids,selectedMode))return;
      const indexes=four.map(p=>pool.indexOf(p));
      const s=groupScore(four,selectedMode,indexes,virtualMeet,virtualGroup,virtualUse);
      if(s<bestScore){best=four;bestScore=s}
    });
    return best;
  }

  function generateModePlan(){
    const selectedMode=mode();
    if(selectedMode==="balanced")return coreGeneratePlan();

    const plans=[];
    let virtual=waitingQueue().map(p=>({...p}));
    const vGroup={},vMeet={},vUse={};

    for(let round=0;round<5 && virtual.length>=4;round++){
      const pool=virtual.slice(0,Math.min(selectedMode==="random"?8:12,virtual.length));
      const best=chooseGroupFromPool(pool,selectedMode,vMeet,vGroup,vUse);
      if(!best)break;

      const ids=best.map(x=>x.memberId);
      const paired=bestPair(ids,selectedMode);
      if(!paired)break;
      plans.push({ids,paired,mode:selectedMode});

      vGroup[groupKey(ids)]=(vGroup[groupKey(ids)]||0)+1;
      ids.forEach(id=>vUse[id]=(vUse[id]||0)+1);
      for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
        const k=rrPairKey(ids[i],ids[j]);
        vMeet[k]=(vMeet[k]||0)+1;
      }

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

  generatePlan=function(){return generateModePlan()};

  chooseNextFour=function(){
    if(mode()==="balanced")return coreChooseNextFour();

    const p=nextPlanned();
    if(p&&p.length===4)return p;

    const q=waitingQueue();
    if(q.length<4)return null;
    const pool=q.slice(0,Math.min(mode()==="random"?8:12,q.length));
    const four=chooseGroupFromPool(pool,mode());
    return four||null;
  };

  pairFour=function(players){
    if(mode()==="balanced")return corePairFour(players);
    const ids=players.map(p=>p.memberId);
    return bestPair(ids,mode());
  };

  renderLookahead=function(){
    const box=document.querySelector("#lookaheadList");
    if(!box)return;
    if(!state.plan.items.length)generatePlan();

    const m=MODES[mode()];
    const note=document.querySelector("#lookaheadModeNote");
    if(note)note.textContent=m.note;

    box.innerHTML=state.plan.items.length
      ? state.plan.items.slice(0,5).map((it,i)=>{
          const paired=it.paired||bestPair(it.ids,mode())||it.ids;
          const left=[paired[0],paired[1]].map(id=>member(id)?.name||("ID "+id));
          const right=[paired[2],paired[3]].map(id=>member(id)?.name||("ID "+id));
          return `<div class="lookahead-item">
            <div class="lookahead-no">${i+1}</div>
            <div>
              <div class="lookahead-names">${left.map(esc).join(" + ")} <b>VS</b> ${right.map(esc).join(" + ")}</div>
              <div class="round-robin-note">${m.icon} ${esc(m.note)}</div>
            </div>
            <div class="lookahead-status">ถัดไป</div>
          </div>`;
        }).join("")
      : '<div class="empty-state">ยังวางคิวล่วงหน้าไม่ได้</div>';
  };

  function updateModeUI(){
    const selected=mode(),m=MODES[selected];
    document.querySelectorAll(".pairing-mode-btn").forEach(b=>{
      b.classList.toggle("active",b.dataset.pairMode===selected);
    });
    const badge=document.querySelector("#pairingModeBadge");
    const desc=document.querySelector("#pairingModeDesc");
    const note=document.querySelector("#smartRotationNote");
    if(badge)badge.textContent=`${m.icon} ${m.name}`;
    if(desc)desc.textContent=m.desc;
    if(note)note.innerHTML=`${m.icon} <b>${m.name}</b> — ${m.desc}`;
  }

  function updateMobileStrip(){
    const el=document.querySelector("#mobileLiveStrip");
    if(!el)return;
    const playing=state.today.filter(p=>p.status==="playing").length;
    const waiting=state.today.filter(p=>p.status==="waiting").length;
    const activeCourts=state.courts.filter(c=>c.state==="playing").length;
    const online=navigator.onLine;
    el.innerHTML=`
      <span class="${online?"online":"offline"}">${online?"● Online":"● Offline"}</span>
      <span class="mobile-live-stats">
        <span>👥 ${state.today.length}</span>
        <span>⏱ ${waiting}</span>
        <span>🏟 ${activeCourts}/${state.courts.length}</span>
        <span>🏸 ${playing}</span>
      </span>`;
  }

  function setBottomActive(kind){
    document.querySelectorAll("#mobileBottomNav button").forEach(b=>{
      b.classList.toggle("active",b.dataset.mobileGo===kind);
    });
  }

  function goMobile(kind){
    if(kind==="players"){
      coreShowPage("playersPage");
      setBottomActive(kind);window.scrollTo({top:0,behavior:"smooth"});return;
    }
    if(kind==="cost"){
      coreShowPage("costPage");
      setBottomActive(kind);window.scrollTo({top:0,behavior:"smooth"});return;
    }

    coreShowPage("todayPage");
    setBottomActive(kind);
    requestAnimationFrame(()=>{
      const target=document.querySelector(kind==="courts"?"#mobileCourtAnchor":"#mobileQueueAnchor");
      if(target)target.scrollIntoView({behavior:"smooth",block:"start"});
    });
  }

  showPage=function(id){
    coreShowPage(id);
    if(id==="playersPage")setBottomActive("players");
    else if(id==="costPage")setBottomActive("cost");
    else if(id==="todayPage" && !document.querySelector("#mobileBottomNav button.active"))setBottomActive("courts");
    else if(id!=="todayPage")document.querySelectorAll("#mobileBottomNav button").forEach(b=>b.classList.remove("active"));
  };

  render=function(){
    coreRender();
    updateModeUI();
    updateMobileStrip();
  };

  document.querySelectorAll(".pairing-mode-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const next=btn.dataset.pairMode;
      if(!MODES[next] || next===mode())return;
      state.ui.pairingMode=next;
      state.plan.items=[];
      save();
      generatePlan();
      render();
    });
  });

  document.querySelector("#openRulesFromMode")?.addEventListener("click",()=>{
    showPage("rulesPage");
    window.scrollTo({top:0,behavior:"smooth"});
  });

  document.querySelectorAll("#mobileBottomNav button").forEach(btn=>{
    btn.addEventListener("click",()=>goMobile(btn.dataset.mobileGo));
  });

  window.addEventListener("online",updateMobileStrip);
  window.addEventListener("offline",updateMobileStrip);

  // On phones the operational screen should be the first useful screen.
  if(window.matchMedia("(max-width:760px)").matches){
    showPage("todayPage");
    setBottomActive("courts");
  }else{
    updateModeUI();
  }

  state.plan.items=[];
  save();
  generatePlan();
  render();
})();
