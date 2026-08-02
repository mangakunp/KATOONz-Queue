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
      const data=snap.val();
      if(!data)return alert("ยังไม่มีข้อมูล Cloud สำหรับรหัสนี้");
      applyingRemote=true;
      window.KTQM.replaceState(data);
      applyingRemote=false;
      lastUploadedJson=JSON.stringify(data);
      setStatus("ดึงสำเร็จ","ok");
    }catch(e){
      applyingRemote=false;
      setStatus("ดึงไม่สำเร็จ","error");
      alert("ดึงข้อมูลไม่สำเร็จ: "+e.message);
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
      const data=snap.val();
      if(!data)return;
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