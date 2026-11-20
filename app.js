const $ = (id) => document.getElementById(id);
let avatars = [], voices = [], historyItems = [];
const api = async (url, options={}) => {
  const res = await fetch(url, {credentials:"same-origin", ...options, headers:{"Content-Type":"application/json", ...(options.headers||{})}});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || data.message || `Request failed (${res.status})`);
  return data;
};
function notice(message, type="success") {
  const el=$("notice"); el.textContent=message; el.className=`notice show ${type}`;
}
function setConnected(yes) {
  $("connectionLabel").textContent=yes?"API connected":"Not connected";
  $("statusBadge").textContent=yes?"Connected":"Offline";
  $("statusBadge").classList.toggle("online",yes);
  $("apiStatus").textContent=yes?"Connected":"Not configured";
  $("apiStatus").classList.toggle("ok",yes);
}
function openSettings(){ $("settingsModal").classList.remove("hidden"); }
function closeSettings(){ $("settingsModal").classList.add("hidden"); }
async function connect() {
  const key=$("apiKey").value.trim();
  if(!key){alert("Paste your HeyGen API key first.");return;}
  $("connectBtn").disabled=true; $("connectBtn").textContent="Connecting…";
  try {
    await api("/api/key",{method:"POST",body:JSON.stringify({apiKey:key})});
    $("apiKey").value=""; setConnected(true); closeSettings();
    await Promise.all([loadAvatars(),loadVoices()]);
    notice("Connected to HeyGen. Your avatar and voice libraries are ready.");
  } catch(e){notice(e.message,"error");}
  finally{$("connectBtn").disabled=false;$("connectBtn").innerHTML='Connect API <b>→</b>';}
}
async function disconnect(){
  try{await api("/api/key",{method:"DELETE"});setConnected(false);avatars=[];voices=[];$("avatarSelect").innerHTML='<option value="">Connect API to load avatars</option>';$("voiceSelect").innerHTML='<option value="">Avatar default voice</option>';$("avatarStatus").textContent="Not loaded";closeSettings();notice("API key cleared from this server session.");}
  catch(e){notice(e.message,"error");}
}
async function loadAvatars(){
  const result=await api("/api/avatars");
  avatars=result.data||[];
  const select=$("avatarSelect");select.innerHTML='<option value="">Choose an avatar</option>';
  avatars.forEach(a=>{
    const opt=document.createElement("option");opt.value=a.id;opt.textContent=`${a.name||"Unnamed avatar"}${a.gender?` · ${a.gender}`:""}`;
    opt.dataset.voice=a.default_voice_id||"";opt.dataset.image=a.preview_image_url||"";select.append(opt);
  });
  $("avatarStatus").textContent=`${avatars.length} loaded`;$("avatarStatus").classList.add("ok");
  if(!avatars.length) select.innerHTML='<option value="">No avatars returned by this API key</option>';
}
async function loadVoices(){
  const result=await api("/api/voices?type=public");voices=result.data||[];
  const select=$("voiceSelect");select.innerHTML='<option value="">Avatar default voice</option>';
  voices.forEach(v=>{const opt=document.createElement("option");opt.value=v.voice_id;opt.textContent=`${v.name||"Voice"}${v.language?` · ${v.language}`:""}`;select.append(opt);});
}
$("avatarSelect").addEventListener("change",()=>{
  const opt=$("avatarSelect").selectedOptions[0];const avatar=avatars.find(a=>a.id===opt?.value);
  const preview=$("avatarPreview");
  if(!avatar){preview.innerHTML='<div class="avatar-placeholder">✦</div><div><strong>No avatar selected</strong><small>Your selected presenter will appear here.</small></div>';return;}
  preview.innerHTML="";
  if(avatar.preview_image_url){const img=document.createElement("img");img.src=avatar.preview_image_url;img.alt="Avatar preview";img.style.cssText="width:43px;height:43px;object-fit:cover;border-radius:8px";preview.append(img);}
  else{const icon=document.createElement("div");icon.className="avatar-placeholder";icon.textContent="✦";preview.append(icon);}
  const info=document.createElement("div");const name=document.createElement("strong");name.textContent=avatar.name||"Selected avatar";const small=document.createElement("small");small.textContent=avatar.gender||"HeyGen presenter";info.append(name,small);preview.append(info);
});
$("script").addEventListener("input",()=>$("charCount").textContent=`${$("script").value.length.toLocaleString()} / 5,000`);
$("clearScript").onclick=()=>{$("script").value="";$("charCount").textContent="0 / 5,000";};
async function generate(){
  const avatarId=$("avatarSelect").value,script=$("script").value.trim();
  if(!avatarId){notice("Choose an avatar before generating your video.","error");return;}
  if(!script){notice("Write a script before generating your video.","error");return;}
  const btn=$("generateBtn");btn.disabled=true;btn.innerHTML="Submitting to HeyGen…";
  try{
    const result=await api("/api/videos",{method:"POST",body:JSON.stringify({
      avatarId,voiceId:$("voiceSelect").value,script,title:$("videoTitle").value||"My HeyGen video",
      aspectRatio:$("ratio").value,resolution:$("resolution").value,caption:$("captions").checked
    })});
    const data=result.data||result;const id=data.video_id||data.id;
    if(!id)throw new Error("HeyGen did not return a video ID.");
    $("previewStage").innerHTML='<div class="preview-orb">◌</div><div class="preview-copy"><strong>Video is rendering</strong><span>Your video is being generated by HeyGen. This can take a few minutes.</span></div><div class="stage-corner">RENDER IN PROGRESS</div>';
    notice(`Video submitted successfully. ID: ${id}`);
    await pollVideo(id);await loadHistory();
  }catch(e){notice(e.message,"error");}
  finally{btn.disabled=false;btn.innerHTML='<span>✦</span> Generate video <b>→</b>';}
}
async function pollVideo(id){
  for(let i=0;i<90;i++){
    await new Promise(r=>setTimeout(r,5000));
    try{
      const result=await api(`/api/videos/${encodeURIComponent(id)}`);const v=result.data||result;
      const status=String(v.status||"processing").toLowerCase();
      if(status==="completed"||status==="success"){
        const url=v.video_url||v.video_page_url;
        $("previewStage").innerHTML="";
        if(v.video_url){const video=document.createElement("video");video.src=v.video_url;video.controls=true;video.playsInline=true;video.style.cssText="width:100%;height:100%;object-fit:contain;background:#05060a";$("previewStage").style.padding="0";$("previewStage").append(video);}
        else {$("previewStage").innerHTML='<div class="preview-copy"><strong>Video completed</strong><span>Open your HeyGen video to view the result.</span></div>';}
        notice("Your video is ready!");return;
      }
      if(["failed","error"].includes(status)){notice(v.failure_message||"Video generation failed.","error");return;}
    }catch(e){notice(`Checking render status: ${e.message}`,"error");}
  }
  notice("Rendering is taking longer than expected. Check Video history for the latest status.");
}
async function loadHistory(){
  const result=await api("/api/history");historyItems=result.data||[];
  $("historyCount").textContent=`${historyItems.length} videos`;
  const list=$("historyList");list.innerHTML="";
  if(!historyItems.length){list.innerHTML='<div class="empty-state"><div>◷</div><b>No videos yet</b><p>Your generated videos will show up here.</p></div>';return;}
  historyItems.forEach(v=>{
    const row=document.createElement("div");row.className="history-row";
    const thumb=document.createElement("div");thumb.className="history-thumb";thumb.textContent="▶";
    const info=document.createElement("div");info.className="history-info";
    const title=document.createElement("strong");title.textContent=v.title||"HeyGen video";
    const meta=document.createElement("small");meta.textContent=`${v.video_id||v.id||"Video"} · ${v.status||"Submitted"}`;
    info.append(title,meta);
    const status=document.createElement("span");status.className="history-status "+(v.status==="completed"?"completed":"");status.textContent=v.status||"waiting";
    const actions=document.createElement("div");actions.className="history-actions";
    if(v.video_url){const a=document.createElement("a");a.href=v.video_url;a.target="_blank";a.rel="noreferrer";a.textContent="Open video ↗";actions.append(a);}
    row.append(thumb,info,status,actions);list.append(row);
  });
}
document.querySelectorAll(".nav-item").forEach(btn=>btn.onclick=()=>{
  const history=btn.dataset.view==="history";
  $("createView").classList.toggle("hidden",history);$("historyView").classList.toggle("hidden",!history);
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n===btn));
  $("pageName").textContent=history?"Video history":"Create video";
  if(history)loadHistory().catch(e=>notice(e.message,"error"));
});
$("openSettings").onclick=$("openSettings2").onclick=$("topSettings").onclick=openSettings;
$("closeSettings").onclick=closeSettings;$("connectBtn").onclick=connect;$("disconnectBtn").onclick=disconnect;
$("toggleKey").onclick=()=>{const input=$("apiKey");input.type=input.type==="password"?"text":"password";$("toggleKey").textContent=input.type==="password"?"Show":"Hide";};
$("refreshAvatars").onclick=()=>loadAvatars().then(()=>notice("Avatar list refreshed.")).catch(e=>notice(e.message,"error"));
$("refreshHistory").onclick=()=>loadHistory().catch(e=>notice(e.message,"error"));
$("generateBtn").onclick=generate;
(async()=>{try{const s=await api("/api/session");setConnected(s.connected);if(s.connected){await Promise.all([loadAvatars(),loadVoices()]);}}catch{} })();
