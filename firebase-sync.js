(() => {
  const statusEl=document.getElementById("cloudStatus");
  const codeInput=document.getElementById("syncCode");
  const autoSelect=document.getElementById("autoSync");
  const uploadBtn=document.getElementById("uploadCloud");
  const downloadBtn=document.getElementById("downloadCloud");
  const saveCodeBtn=document.getElementById("saveSyncCode");

  let db=null;
  let unsubscribeRef=null;
  let applyingRemote=false;
  let lastUploadedJson="";

  function setStatus(text,kind="neutral"){
    if(!statusEl)return;
    statusEl.textContent=text;
    statusEl.style.background=kind==="ok"?"#dcfce7":kind==="error"?"#fee2e2":"#eef2f6";
    statusEl.style.color=kind==="ok"?"#166534":kind==="error"?"#991b1b":"#667085";
  }

  function configReady(){
    const c=window.KTQM_FIREBASE_CONFIG||{};
    return c.apiKey && !String(c.apiKey).includes("PUT_YOUR");
  }

  function initFirebase(){
    if(!configReady()){
      setStatus("ยังไม่ได้ใส่ Firebase config","error");
      return false;
    }
    try{
      if(!firebase.apps.length)firebase.initializeApp(window.KTQM_FIREBASE_CONFIG);
      db=firebase.database();
      setStatus(navigator.onLine?"พร้อมเชื่อมต่อ":"ออฟไลน์","ok");
      return true;
    }catch(e){
      setStatus("Firebase error","error");
      console.error(e);
      return false;
    }
  }

  function cleanCode(){
    return (codeInput.value||"").trim().replace(/[.#$[\]/]/g,"-");
  }

  function validCode(){
    const c=cleanCode();
    if(c.length<16){
      alert("รหัสก๊วนควรยาวอย่างน้อย 16 ตัวอักษร เพื่อป้องกันคนอื่นเดารหัสได้");
      return null;
    }
    return c;
  }


  function collectionToArray(value){
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

  function normalizeCloudState(raw){
    // รองรับกรณีส่งมาทั้ง {state:{...}} และกรณีส่งเฉพาะ state
    const source=(raw && raw.state && typeof raw.state==="object") ? raw.state : raw;
    if(!source || typeof source!=="object"){
      throw new Error("ไม่พบข้อมูลก๊วนใน Cloud");
    }

    const normalized={
      ...source,
      players:collectionToArray(source.players),
      favorites:collectionToArray(source.favorites),
      history:collectionToArray(source.history),
      courts:collectionToArray(source.courts)
    };

    normalized.players=normalized.players.map((p,index)=>({
      id:Number(p?.id) || (index+1),
      name:String(p?.name || ("ผู้เล่น "+(index+1))),
      lv:[1,2,3].includes(Number(p?.lv)) ? Number(p.lv) : 2,
      games:Number(p?.games) || 0,
      status:p?.status==="เล่น" ? "เล่น" : "พัก",
      queuePos:Number(p?.queuePos) || (index+1)
    }));

    normalized.favorites=normalized.favorites.map((f,index)=>({
      id:Number(f?.id) || (Date.now()+index),
      name:String(f?.name || ("สมาชิก "+(index+1))),
      lv:[1,2,3].includes(Number(f?.lv)) ? Number(f.lv) : 2
    }));

    normalized.history=normalized.history.map((h,index)=>({
      id:Number(h?.id) || (Date.now()+index),
      courtName:String(h?.courtName || "-"),
      playerIds:collectionToArray(h?.playerIds).map(Number).filter(Number.isFinite),
      finishedAt:h?.finishedAt || new Date().toISOString()
    }));

    normalized.courts=normalized.courts.map((c,index)=>({
      id:index+1,
      name:String(c?.name || (index+1)),
      slots:collectionToArray(c?.slots).concat([null,null,null,null]).slice(0,4)
        .map(v=>v==null?null:Number(v))
    }));

    normalized.queueCounter=Math.max(
      Number(source.queueCounter)||0,
      ...normalized.players.map(p=>Number(p.queuePos)||0),
      0
    );
    normalized.courtCount=normalized.courts.length;
    return normalized;
  }

  async function upload(){
    const code=validCode();
    if(!code || !db)return;
    try{
      setStatus("กำลังส่ง...");
      const data=window.KTQM.getState();
      const payload={state:data,updatedAt:firebase.database.ServerValue.TIMESTAMP};
      lastUploadedJson=JSON.stringify(data);
      await db.ref("groups/"+code).set(payload);
      setStatus("ส่งสำเร็จ","ok");
    }catch(e){
      setStatus("ส่งไม่สำเร็จ","error");
      alert("ส่งข้อมูลไม่สำเร็จ: "+e.message);
    }
  }

  async function download(){
    const code=validCode();
    if(!code || !db)return;
    try{
      setStatus("กำลังดึง...");
      const snap=await db.ref("groups/"+code+"/state").once("value");
      const raw=snap.val();
      if(!raw)return alert("ยังไม่มีข้อมูล Cloud สำหรับรหัสนี้");
      const data=normalizeCloudState(raw);
      applyingRemote=true;
      window.KTQM.replaceState(data);
      applyingRemote=false;
      lastUploadedJson=JSON.stringify(data);
      setStatus("ดึงสำเร็จ","ok");
    }catch(e){
      applyingRemote=false;
      setStatus("ดึงไม่สำเร็จ","error");
      alert("ดึงข้อมูลไม่สำเร็จ: "+e.message+"\n\nแนะนำ: เปิดเครื่องที่มีข้อมูลถูกต้อง แล้วกด ส่งขึ้น Cloud ใหม่ 1 ครั้ง");
    }
  }

  function stopListener(){
    if(unsubscribeRef){
      unsubscribeRef.off();
      unsubscribeRef=null;
    }
  }

  function startListener(){
    stopListener();
    const code=validCode();
    if(!code || !db)return;
    unsubscribeRef=db.ref("groups/"+code+"/state");
    unsubscribeRef.on("value",snap=>{
      const raw=snap.val();
      if(!raw)return;
      const data=normalizeCloudState(raw);
      const remoteJson=JSON.stringify(data);
      if(remoteJson===lastUploadedJson)return;
      applyingRemote=true;
      try{
        window.KTQM.replaceState(data);
        lastUploadedJson=remoteJson;
        setStatus("ซิงก์แล้ว","ok");
      }catch(e){
        console.error(e);
      }finally{
        applyingRemote=false;
      }
    },err=>{
      setStatus("ซิงก์ผิดพลาด","error");
      console.error(err);
    });
  }

  function saveSettings(){
    const code=cleanCode();
    localStorage.setItem("ktqm_sync_code",code);
    localStorage.setItem("ktqm_auto_sync",autoSelect.value);
    if(autoSelect.value==="on")startListener();
    else stopListener();
    setStatus("บันทึกการตั้งค่าแล้ว","ok");
  }

  codeInput.value=localStorage.getItem("ktqm_sync_code")||"";
  autoSelect.value=localStorage.getItem("ktqm_auto_sync")||"off";

  saveCodeBtn?.addEventListener("click",saveSettings);
  uploadBtn?.addEventListener("click",upload);
  downloadBtn?.addEventListener("click",download);
  autoSelect?.addEventListener("change",saveSettings);

  window.addEventListener("online",()=>setStatus("ออนไลน์","ok"));
  window.addEventListener("offline",()=>setStatus("ออฟไลน์"));

  if(initFirebase() && autoSelect.value==="on" && codeInput.value.trim().length>=16){
    startListener();
  }
})();