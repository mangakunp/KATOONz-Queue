
(function(){
  const $=s=>document.querySelector(s);
  let auth=null, db=null, user=null, ready=false;

  function msg(t, ok=true){
    const el=$("#cloudStatus");
    if(el){el.textContent=t;el.className="cloud-status "+(ok?"ok":"bad");}
  }
  function localState(){
    try { return JSON.parse(localStorage.getItem("katoonz_tomo_v5_offline") || "null"); }
    catch(e){ return null; }
  }
  function toArray(value){
    if(Array.isArray(value))return value.filter(v=>v!=null);
    if(value==null)return [];
    if(typeof value==="object"){
      return Object.keys(value)
        .sort((a,b)=>Number(a)-Number(b))
        .map(k=>value[k])
        .filter(v=>v!=null);
    }
    return [];
  }

  function encodeForCloud(obj){
    const c=JSON.parse(JSON.stringify(obj||{}));
    if(c.costs)c.costs.qrData="";

    // Firebase ใช้ null เป็นคำสั่งลบข้อมูล จึงใช้ 0 เป็น sentinel ช่องสนามว่าง
    c.courts=toArray(c.courts).map((court,index)=>({
      ...court,
      id:Number(court?.id)||index+1,
      name:String(court?.name ?? (index+1)),
      state:court?.state||"idle",
      slots:(Array.isArray(court?.slots)?court.slots:[null,null,null,null])
        .concat([null,null,null,null]).slice(0,4)
        .map(v=>Number(v)||0)
    }));

    return c;
  }

  function decodeFromCloud(raw){
    const c=JSON.parse(JSON.stringify(raw||{}));

    c.members=toArray(c.members);
    c.today=toArray(c.today);
    c.history=toArray(c.history);
    c.courts=toArray(c.courts).map((court,index)=>{
      const src=(court && typeof court==="object")?court:{};

      let slots;
      if(Array.isArray(src.slots)){
        slots=src.slots.slice(0,4);
      }else if(src.slots && typeof src.slots==="object"){
        slots=[0,1,2,3].map(i=>src.slots[i] ?? src.slots[String(i)] ?? 0);
      }else{
        slots=[0,0,0,0];
      }

      slots=slots.concat([0,0,0,0]).slice(0,4).map(v=>{
        const n=Number(v);
        return Number.isFinite(n)&&n>0?n:null;
      });

      return {
        ...src,
        id:Number(src.id)||index+1,
        name:String(src.name ?? (index+1)),
        slots,
        state:["idle","called","playing"].includes(src.state)
          ? src.state
          : (slots.some(Boolean)?"called":"idle")
      };
    });

    // ข้อมูล Cloud รุ่นเก่าที่สนามหายหมด
    if(c.courts.length===0){
      c.courts=[
        {id:1,name:"1",slots:[null,null,null,null],state:"idle"},
        {id:2,name:"2",slots:[null,null,null,null],state:"idle"}
      ];
    }

    return c;
  }
  async function init(){
    if(!window.KTQM_FIREBASE_CONFIG){msg("ยังไม่มี Firebase config",false);return;}
    try{
      const app=firebase.initializeApp(window.KTQM_FIREBASE_CONFIG);
      auth=firebase.auth();
      db=firebase.database();
      ready=true;
      auth.onAuthStateChanged(u=>{
        user=u||null;
        renderAuth();
      });
    }catch(e){msg("Firebase เริ่มทำงานไม่สำเร็จ",false);console.error(e);}
  }
  function renderAuth(){
    const out=$("#authLoggedOut"), inn=$("#authLoggedIn");
    const card=document.querySelector(".cloud-card");
    if(!out||!inn)return;
    out.classList.toggle("hidden",!!user);
    inn.classList.toggle("hidden",!user);
    if(card)card.classList.toggle("logged-in",!!user);
    if(user){
      $("#cloudUserEmail").textContent=user.email||"ผู้ใช้";
      msg("พร้อมซิงค์ Cloud");
    }else msg("Offline mode · ยังไม่ได้เข้าสู่ระบบ");
  }
  async function signup(){
    const email=$("#authEmail").value.trim(), pass=$("#authPassword").value;
    if(!email||pass.length<6)return alert("กรุณาใส่อีเมล และรหัสผ่านอย่างน้อย 6 ตัว");
    try{await auth.createUserWithEmailAndPassword(email,pass);msg("สมัครและเข้าสู่ระบบแล้ว");}
    catch(e){alert("สมัครไม่สำเร็จ: "+e.message);}
  }
  async function login(){
    const email=$("#authEmail").value.trim(), pass=$("#authPassword").value;
    if(!email||!pass)return alert("กรุณาใส่อีเมลและรหัสผ่าน");
    try{await auth.signInWithEmailAndPassword(email,pass);msg("เข้าสู่ระบบแล้ว");}
    catch(e){alert("เข้าสู่ระบบไม่สำเร็จ: "+e.message);}
  }
  async function resetPassword(){
    const email=$("#authEmail").value.trim();
    if(!email)return alert("กรุณาใส่อีเมลก่อน");
    try{await auth.sendPasswordResetEmail(email);alert("ส่งอีเมลตั้งรหัสผ่านใหม่แล้ว");}
    catch(e){alert("ส่งไม่สำเร็จ: "+e.message);}
  }
  async function saveCloud(){
    if(!user)return alert("กรุณาเข้าสู่ระบบก่อน");
    const s=localState();
    if(!s)return alert("ไม่พบข้อมูลในเครื่อง");
    if(!confirm("บันทึกข้อมูลในเครื่องขึ้น Cloud ของบัญชีนี้ใช่ไหม?"))return;
    try{
      await db.ref("users/"+user.uid+"/queueData").set({
        state:encodeForCloud(s),
        updatedAt:firebase.database.ServerValue.TIMESTAMP,
        version:"5.5.2"
      });
      msg("บันทึกขึ้น Cloud สำเร็จ ✓");
    }catch(e){alert("บันทึก Cloud ไม่สำเร็จ: "+e.message);}
  }
  async function loadCloud(){
    if(!user)return alert("กรุณาเข้าสู่ระบบก่อน");
    if(!confirm("โหลดข้อมูลจาก Cloud จะนำมาแทนข้อมูลในเครื่องปัจจุบัน ต้องการดำเนินการต่อหรือไม่?"))return;
    try{
      const snap=await db.ref("users/"+user.uid+"/queueData").once("value");
      const v=snap.val();
      if(!v||!v.state)return alert("บัญชีนี้ยังไม่มีข้อมูล Cloud");
      const migrated=decodeFromCloud(v.state);
      localStorage.setItem("katoonz_tomo_v5_offline",JSON.stringify(migrated));
      msg("โหลดจาก Cloud สำเร็จ ✓");
      location.reload();
    }catch(e){alert("โหลด Cloud ไม่สำเร็จ: "+e.message);}
  }

  document.addEventListener("DOMContentLoaded",()=>{
    $("#signupBtn")?.addEventListener("click",signup);
    $("#loginBtn")?.addEventListener("click",login);
    $("#resetPasswordBtn")?.addEventListener("click",resetPassword);
    $("#logoutBtn")?.addEventListener("click",()=>auth?.signOut());
    $("#saveCloudBtn")?.addEventListener("click",saveCloud);
    $("#loadCloudBtn")?.addEventListener("click",loadCloud);
    init();
  });
})();
