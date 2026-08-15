
(function(){
  const $=s=>document.querySelector(s);
  let auth=null, db=null, user=null, ready=false;

  function msg(t, ok=true){
    const el=$("#cloudStatus");
    if(el){el.textContent=t;el.className="cloud-status "+(ok?"ok":"bad");}
  }
  function localState(){
    try { return JSON.parse(localStorage.getItem("ktqm_v5_state") || "null"); }
    catch(e){ return null; }
  }
  function stripQr(obj){
    const c=JSON.parse(JSON.stringify(obj||{}));
    if(c.costs) c.costs.qrData="";
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
    if(!out||!inn)return;
    out.classList.toggle("hidden",!!user);
    inn.classList.toggle("hidden",!user);
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
        state:stripQr(s),
        updatedAt:firebase.database.ServerValue.TIMESTAMP,
        version:"5.5"
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
      localStorage.setItem("ktqm_v5_state",JSON.stringify(v.state));
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
