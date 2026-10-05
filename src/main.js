import "./styles.css";
import { createIcons, Sparkles, Plus, Search, MessageSquare, Settings, Sun, Moon, LogOut, UserRound, Send, Paperclip, Copy, RotateCcw, Trash2, Pencil, Menu, X, ChevronDown, ArrowUpRight, ShieldCheck, Zap, CircleHelp, Check, PanelLeftClose, LoaderCircle, Github, Eye, EyeOff, Mail, LockKeyhole, Chrome, AlertCircle, Wifi, WifiOff, MoreHorizontal, Square, Command, Orbit } from "lucide";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import {
  auth, firebaseConfigured, GoogleAuthProvider, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail,
  signOut, updateProfile, onAuthStateChanged
} from "./firebase.js";
import { ensureUserProfile, getPreferences, savePreferences, createConversation, watchConversations, getConversation, saveMessages, renameConversation, removeConversation } from "./store.js";

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state = { user:null, conversations:[], activeId:null, messages:[], busy:false, theme:"dark", sidebarOpen:true, authMode:"login", unsubscribe:null, query:"", controller:null, profileOpen:false };
const apiUrl = (import.meta.env.VITE_ORBIT_API_URL || "").trim().replace(/\/+$/,"");
const icon = (name, size=18) => `<i data-lucide="${name}" width="${size}" height="${size}"></i>`;
const stamp = ts => ts?.toDate ? ts.toDate().toLocaleDateString([], {month:"short",day:"numeric"}) : "";
function toast(message, type="info") {
  const host = $("#toast-host"); if (!host) return;
  const node = document.createElement("div"); node.className = `toast ${type}`;
  node.innerHTML = `${icon(type==="error"?"alert-circle":type==="success"?"check":"sparkles",17)}<span>${esc(message)}</span>`;
  host.append(node); setTimeout(()=>node.remove(),3600);
}
function renderIcons() { createIcons({icons:{Sparkles,Plus,Search,MessageSquare,Settings,Sun,Moon,LogOut,UserRound,Send,Paperclip,Copy,RotateCcw,Trash2,Pencil,Menu,X,ChevronDown,ArrowUpRight,ShieldCheck,Zap,CircleHelp,Check,PanelLeftClose,LoaderCircle,Github,Eye,EyeOff,Mail,LockKeyhole,Chrome,AlertCircle,Wifi,WifiOff,MoreHorizontal,Square,Command,Orbit}, attrs:{"stroke-width":1.8}}); }
function renderAuth() {
  const signup = state.authMode==="signup";
  $("#app").innerHTML = `<main class="auth-shell">
    <section class="auth-art"><div class="art-grid"></div><div class="brand"><span class="brand-symbol">${icon("orbit",22)}</span><span>ORBIT <b>AI</b></span></div>
      <div class="art-copy"><div class="eyebrow"><span class="pulse"></span> YOUR CREATIVE CO-PILOT</div><h1>Think beyond<br><em>the obvious.</em></h1><p>A calmer space to explore ideas, solve problems, and turn your next thought into something real.</p>
      <div class="orbit-visual"><div class="planet p1"></div><div class="planet p2"></div><div class="planet p3"></div><div class="orbit-ring ring1"></div><div class="orbit-ring ring2"></div><div class="orbit-core">${icon("sparkles",29)}</div></div>
      <div class="art-foot"><span>${icon("shield-check",16)} Private by design</span><span>Built for curious minds ↗</span></div></div></section>
    <section class="auth-panel"><div class="auth-mobile-brand"><span class="brand-symbol">${icon("orbit",22)}</span> ORBIT <b>AI</b></div><div class="auth-card">
      <div class="auth-tag">WELCOME ${signup?"ABOARD":"BACK"}</div><h2>${signup?"Create your orbit.":"Your ideas, in orbit."}</h2><p class="muted">${signup?"A few details and you’re ready to explore.":"Pick up where curiosity left off."}</p>
      ${!firebaseConfigured?`<div class="setup-alert">${icon("alert-circle",18)} <div><b>Setup required</b><span>Add your Firebase values to <code>.env</code> before authentication can work.</span></div></div>`:""}
      <form id="auth-form" class="auth-form">
        ${signup?`<label>Your name<input name="name" autocomplete="name" placeholder="How should we call you?" required maxlength="80"></label>`:""}
        <label>Email address<div class="field-icon">${icon("mail",17)}<input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></div></label>
        <label>Password<div class="field-icon">${icon("lock-keyhole",17)}<input name="password" type="password" autocomplete="${signup?"new-password":"current-password"}" placeholder="${signup?"At least 6 characters":"Enter your password"}" minlength="6" required><button type="button" class="field-action" id="toggle-password" aria-label="Show password">${icon("eye",17)}</button></div></label>
        ${!signup?`<div class="forgot-row"><button type="button" class="text-btn" id="forgot">Forgot password?</button></div>`:""}
        <button class="btn btn-primary auth-submit" type="submit">${signup?"Create account":"Sign in"} ${icon("arrow-up-right",17)}</button>
      </form>
      <div class="auth-divider"><span></span> OR CONTINUE WITH <span></span></div>
      <button id="google-auth" class="btn btn-google" ${!firebaseConfigured?"disabled":""}>${icon("chrome",18)} Continue with Google</button>
      <p class="auth-switch">${signup?"Already have an account?":"New to Orbit?"} <button class="text-btn" id="switch-auth">${signup?"Sign in":"Create an account"}</button></p>
      <p class="legal">By continuing, you agree to use ORBIT AI responsibly. Your chats are private to your account.</p>
    </div><div class="auth-bottom">© 2026 ORBIT AI <span>Made for what’s next.</span></div></section><div id="toast-host" class="toast-host"></div></main>`;
  renderIcons();
  $("#switch-auth").onclick=()=>{state.authMode=signup?"login":"signup";renderAuth();};
  $("#toggle-password").onclick=()=>{const i=$('[name="password"]');i.type=i.type==="password"?"text":"password";$("#toggle-password").innerHTML=icon(i.type==="password"?"eye":"eye-off",17);renderIcons();};
  $("#forgot")?.addEventListener("click", async()=>{const email=$('[name="email"]').value.trim();if(!email)return toast("Enter your email address first.","error");try{await sendPasswordResetEmail(auth,email);toast("Password reset email sent.","success");}catch(e){toast(authError(e),"error");}});
  $("#google-auth").onclick=async()=>{if(!firebaseConfigured)return toast("Configure Firebase first.","error");try{await signInWithPopup(auth,new GoogleAuthProvider());}catch(e){toast(authError(e),"error");}};
  $("#auth-form").onsubmit=async e=>{e.preventDefault();if(!firebaseConfigured)return toast("Configure Firebase first. See README.md.","error");const fd=new FormData(e.currentTarget),email=String(fd.get("email")).trim(),password=String(fd.get("password"));const btn=$(".auth-submit");btn.disabled=true;btn.innerHTML=`${icon("loader-circle",17)} Please wait…`;renderIcons();try{if(signup){const c=await createUserWithEmailAndPassword(auth,email,password);await updateProfile(c.user,{displayName:String(fd.get("name")).trim()});}else await signInWithEmailAndPassword(auth,email,password);}catch(err){toast(authError(err),"error");btn.disabled=false;btn.innerHTML=`${signup?"Create account":"Sign in"} ${icon("arrow-up-right",17)}`;renderIcons();}};
}
function authError(e){const m={"auth/invalid-credential":"Email or password is incorrect.","auth/email-already-in-use":"An account with this email already exists.","auth/weak-password":"Choose a stronger password (at least 6 characters).","auth/invalid-email":"That email address doesn’t look valid.","auth/popup-closed-by-user":"Google sign-in was closed.","auth/unauthorized-domain":"Add this domain in Firebase Authentication → Settings → Authorized domains.","auth/network-request-failed":"Network issue. Check your connection and try again.","auth/too-many-requests":"Too many attempts. Please wait a little and try again."};return m[e?.code]||e?.message||"Something went wrong. Please try again.";}
function renderApp() {
 const u=state.user, initial=(u.displayName||u.email||"O").trim().charAt(0).toUpperCase();
 $("#app").innerHTML=`<div class="app-shell ${state.sidebarOpen?"":"sidebar-collapsed"}" data-theme="${state.theme}">
  <aside class="sidebar">
    <div class="side-top"><a class="brand side-brand" href="#" id="brand-home"><span class="brand-symbol">${icon("orbit",21)}</span><span>ORBIT <b>AI</b></span></a><button class="icon-btn collapse-btn" id="collapse-sidebar" title="Collapse sidebar">${icon("panel-left-close",18)}</button></div>
    <button class="btn btn-new-chat" id="new-chat">${icon("plus",18)}<span>New conversation</span><kbd>⌘ K</kbd></button>
    <button class="side-search" id="focus-search">${icon("search",17)}<span>Search chats</span><kbd>/</kbd></button>
    <div class="side-label">WORKSPACE <span>PERSONAL</span></div>
    <nav class="side-nav"><button class="nav-item active" id="nav-chat">${icon("message-square",18)}<span>AI Workspace</span><span class="nav-dot"></span></button><button class="nav-item" id="nav-settings">${icon("settings",18)}<span>Settings</span></button></nav>
    <div class="history-heading"><span>RECENT CHATS</span>${icon("more-horizontal",16)}</div>
    <div class="history-search hidden" id="history-search-wrap"><input id="history-search" placeholder="Filter conversations…"><button id="close-search" class="mini-icon">${icon("x",15)}</button></div>
    <div class="conversation-list" id="conversation-list">${historyHTML()}</div>
    <div class="sidebar-spacer"></div>
    <div class="plan-card"><div class="plan-icon">${icon("zap",17)}</div><div><b>Your space to explore</b><p>AI assistance, one idea at a time.</p></div><span class="plan-spark">✦</span></div>
    <button class="profile-button" id="profile-menu"><span class="avatar">${esc(initial)}</span><span class="profile-copy"><b>${esc(u.displayName||"Orbit Explorer")}</b><small>${esc(u.email||"")}</small></span>${icon("chevron-down",16)}</button>
    <div class="profile-popover hidden" id="profile-popover"><button id="profile-settings">${icon("user-round",16)} Account settings</button><button id="sign-out">${icon("log-out",16)} Sign out</button></div>
  </aside>
  <main class="main-panel"><header class="topbar"><div class="top-left"><button class="icon-btn mobile-menu" id="mobile-menu">${icon("menu",19)}</button><div class="breadcrumb"><span>Workspace</span>${icon("chevron-down",13)}<b id="top-title">AI Workspace</b></div></div><div class="top-actions"><div class="secure-pill">${icon("shield-check",15)} <span>Private session</span></div><button class="icon-btn theme-toggle" id="theme-toggle" title="Toggle theme">${icon(state.theme==="dark"?"sun":"moon",18)}</button><button class="avatar top-avatar" id="top-profile" title="Account">${esc(initial)}</button></div></header>
    <section id="workspace" class="workspace">${workspaceHTML()}</section>
  </main><div id="toast-host" class="toast-host"></div><div id="modal-root"></div></div>`;
 renderIcons(); bindApp();
}
function historyHTML(){
 const q=state.query.toLowerCase();
 const items=state.conversations.filter(c=>(c.title||"New conversation").toLowerCase().includes(q));
 if(!items.length)return `<div class="history-empty">${q?"No matching chats":"Your conversations will appear here."}</div>`;
 return items.map(c=>`<div class="history-item ${state.activeId===c.id?"selected":""}" data-chat-id="${esc(c.id)}"><button class="history-open" data-open-chat="${esc(c.id)}">${icon("message-square",16)}<span>${esc(c.title||"New conversation")}</span></button><button class="history-menu" data-chat-menu="${esc(c.id)}" aria-label="Conversation options">${icon("more-horizontal",16)}</button></div>`).join("");
}
function workspaceHTML(){
 if(state.view==="settings")return settingsHTML();
 if(!state.messages.length&&!state.busy)return `<div class="welcome-wrap"><div class="welcome-eyebrow"><span class="welcome-spark">${icon("sparkles",14)}</span> YOUR THINKING SPACE</div><h1>Where should we<br><span>begin today?</span></h1><p class="welcome-sub">Bring a question, a half-formed idea, or a problem you can’t quite crack.<br class="desktop-only"> We’ll work through it together.</p>
  <div class="suggestion-grid"><button class="suggestion-card" data-prompt="Explain a complex topic in simple terms, with an example."><span class="suggestion-icon violet">${icon("sparkles",19)}</span><b>Make it make sense</b><p>Break down a complex topic into simple ideas.</p><span class="suggestion-arrow">${icon("arrow-up-right",16)}</span></button><button class="suggestion-card" data-prompt="Help me brainstorm 10 original ideas for a project, with pros and cons."><span class="suggestion-icon blue">${icon("zap",19)}</span><b>Explore possibilities</b><p>Brainstorm fresh angles and unexpected ideas.</p><span class="suggestion-arrow">${icon("arrow-up-right",16)}</span></button><button class="suggestion-card" data-prompt="Help me write clean, well-structured code. Ask what you need to know first."><span class="suggestion-icon amber">${icon("command",19)}</span><b>Build something</b><p>Turn a technical challenge into a clear plan.</p><span class="suggestion-arrow">${icon("arrow-up-right",16)}</span></button><button class="suggestion-card" data-prompt="Help me create a practical step-by-step plan for my goal."><span class="suggestion-icon mint">${icon("orbit",19)}</span><b>Find my next step</b><p>Make a realistic plan that moves you forward.</p><span class="suggestion-arrow">${icon("arrow-up-right",16)}</span></button></div>
  <div class="composer-wrap"><div class="composer" id="composer"><textarea id="prompt-input" rows="1" placeholder="Ask anything. Start anywhere…" aria-label="Message ORBIT AI"></textarea><div class="composer-bottom"><div class="composer-hints"><span class="composer-status"><span class="status-dot"></span> Ready to explore</span><span class="hint-divider"></span><span>Be curious. Be specific.</span></div><button class="send-button" id="send-message" title="Send message">${icon("arrow-up",19)}</button></div></div><div class="composer-disclaimer">ORBIT AI can make mistakes. Check important information.</div></div></div>`;
 return `<div class="chat-layout"><div class="chat-titlebar"><div><div class="chat-kicker"><span class="status-dot"></span> CONVERSATION</div><h2>${esc(state.conversations.find(c=>c.id===state.activeId)?.title||"New conversation")}</h2></div><button class="btn btn-quiet" id="clear-chat">${icon("trash-2",15)} Clear chat</button></div>
 <div class="message-list" id="message-list">${state.messages.map((m,i)=>messageHTML(m,i)).join("")}${state.busy?`<article class="message assistant-message"><div class="message-avatar orbit-avatar">${icon("sparkles",17)}</div><div class="message-content"><div class="message-author">ORBIT <span>AI</span><small>Thinking…</small></div><div class="thinking"><i></i><i></i><i></i></div></div></article>`:""}</div>
 <div class="composer-wrap chat-composer-wrap"><div class="composer" id="composer"><textarea id="prompt-input" rows="1" placeholder="Message ORBIT AI…" aria-label="Message ORBIT AI"></textarea><div class="composer-bottom"><div class="composer-hints"><span class="composer-status"><span class="status-dot"></span> ${state.busy?"Generating response":"Ready to explore"}</span><span class="hint-divider"></span><span>Enter to send · Shift + Enter for newline</span></div>${state.busy?`<button class="send-button stop-button" id="stop-generation" title="Stop generation">${icon("square",14)}</button>`:`<button class="send-button" id="send-message" title="Send message">${icon("arrow-up",19)}</button>`}</div></div><div class="composer-disclaimer">ORBIT AI can make mistakes. Check important information.</div></div></div>`;
}
function messageHTML(m,i){
 const isUser=m.role==="user";
 let body;
 try{body=DOMPurify.sanitize(marked.parse(m.content||""));}catch{body=esc(m.content).replace(/\n/g,"<br>");}
 return `<article class="message ${isUser?"user-message":"assistant-message"}"><div class="message-avatar ${isUser?"user-avatar":"orbit-avatar"}">${isUser?esc((state.user?.displayName||"Y").charAt(0).toUpperCase()):icon("sparkles",17)}</div><div class="message-content"><div class="message-author">${isUser?"YOU":'ORBIT <span>AI</span>'}<small>${isUser?"You said":"Response"}</small></div><div class="message-body">${body}</div>${!isUser?`<div class="message-tools"><button data-copy="${i}" class="tool-btn">${icon("copy",14)} Copy</button><button data-regenerate="${i}" class="tool-btn">${icon("rotate-ccw",14)} Regenerate</button></div>`:""}</div></article>`;
}
function settingsHTML(){const u=state.user;return `<div class="settings-wrap"><div class="settings-heading"><div class="chat-kicker">PERSONALIZE YOUR SPACE</div><h1>Settings</h1><p>Make ORBIT feel a little more like yours.</p></div><section class="settings-card"><div class="settings-card-head"><span class="settings-icon">${icon("user-round",18)}</span><div><h3>Account profile</h3><p>Your account details from Firebase Authentication.</p></div></div><div class="account-row"><div class="avatar large-avatar">${esc((u.displayName||u.email||"O").charAt(0).toUpperCase())}</div><div><b>${esc(u.displayName||"Orbit Explorer")}</b><p>${esc(u.email||"")}</p><span class="verified-label">${icon("shield-check",14)} Authenticated account</span></div></div></section>
<section class="settings-card"><div class="settings-card-head"><span class="settings-icon">${icon("sun",18)}</span><div><h3>Appearance</h3><p>Choose the theme that feels right for you.</p></div></div><div class="setting-row"><div><b>Color theme</b><p>Switch between dark and light mode.</p></div><button class="theme-choice" id="settings-theme">${icon(state.theme==="dark"?"moon":"sun",17)} ${state.theme==="dark"?"Dark theme":"Light theme"} ${icon("chevron-down",15)}</button></div></section>
<section class="settings-card"><div class="settings-card-head"><span class="settings-icon">${icon("shield-check",18)}</span><div><h3>Privacy & security</h3><p>Understand how your workspace is protected.</p></div></div><div class="setting-row"><div><b>Private conversations</b><p>Your Firestore rules should restrict records to their owner.</p></div><span class="security-state">${icon("lock-keyhole",14)} Account scoped</span></div><div class="setting-row"><div><b>AI backend</b><p>Requests are sent to your configured Cloudflare Worker.</p></div><span class="security-state">${apiUrl?"Configured":"Needs setup"}</span></div></section>
<section class="settings-card danger-card"><div class="settings-card-head"><span class="settings-icon danger-icon">${icon("log-out",18)}</span><div><h3>Session</h3><p>Sign out from this device.</p></div></div><button class="btn btn-danger" id="settings-sign-out">${icon("log-out",16)} Sign out</button></section></div>`;}
function bindApp(){
 $("#new-chat").onclick=()=>newChat();
 $("#brand-home").onclick=e=>{e.preventDefault();state.view="chat";state.activeId=null;state.messages=[];renderApp();};
 $("#collapse-sidebar").onclick=()=>{state.sidebarOpen=!state.sidebarOpen;renderApp();};
 $("#mobile-menu").onclick=()=>{state.sidebarOpen=!state.sidebarOpen;renderApp();};
 $("#nav-settings").onclick=()=>{state.view="settings";renderApp();};
 $("#nav-chat").onclick=()=>{state.view="chat";renderApp();};
 $("#settings-theme")?.addEventListener("click",toggleTheme); $("#theme-toggle").onclick=toggleTheme;
 $("#settings-sign-out")?.addEventListener("click",()=>signOut(auth));
 $("#profile-menu").onclick=()=>$("#profile-popover").classList.toggle("hidden");
 $("#top-profile").onclick=()=>$("#profile-popover").classList.toggle("hidden");
 $("#profile-settings")?.addEventListener("click",()=>{state.view="settings";renderApp();});
 $("#sign-out")?.addEventListener("click",()=>signOut(auth));
 $("#focus-search").onclick=()=>{const w=$("#history-search-wrap");w.classList.remove("hidden");$("#history-search").focus();};
 $("#close-search")?.addEventListener("click",()=>{$("#history-search-wrap").classList.add("hidden");state.query="";renderHistory();});
 $("#history-search")?.addEventListener("input",e=>{state.query=e.target.value;renderHistory();});
 $$("[data-open-chat]").forEach(b=>b.onclick=()=>openChat(b.dataset.openChat));
 $$("[data-chat-menu]").forEach(b=>b.onclick=e=>{e.stopPropagation();showConversationMenu(b.dataset.chatMenu,b);});
 $$("[data-prompt]").forEach(b=>b.onclick=()=>{const t=$("#prompt-input");t.value=b.dataset.prompt;t.focus();resizeInput(t);});
 $("#send-message")?.addEventListener("click",()=>sendMessage());
 $("#prompt-input")?.addEventListener("input",e=>resizeInput(e.target));
 $("#prompt-input")?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}});
 $("#stop-generation")?.addEventListener("click",()=>state.controller?.abort());
 $("#clear-chat")?.addEventListener("click",()=>confirmModal("Clear this conversation?","This removes all messages from the current conversation.","Clear messages",async()=>{state.messages=[];await persist();renderApp();}));
 $$("[data-copy]").forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(state.messages[Number(b.dataset.copy)].content);toast("Response copied.","success");}catch{toast("Clipboard access is unavailable in this browser.","error");}});
 $$("[data-regenerate]").forEach(b=>b.onclick=()=>regenerate(Number(b.dataset.regenerate)));
 $$(".message-body pre").forEach(pre=>{const code=$("code",pre);if(code){hljs.highlightElement(code);const copy=document.createElement("button");copy.className="code-copy";copy.textContent="Copy code";copy.onclick=async()=>{try{await navigator.clipboard.writeText(code.innerText);toast("Code copied.","success");}catch{toast("Could not copy code.","error");}};pre.append(copy);}});
}
function renderHistory(){const l=$("#conversation-list");if(l)l.innerHTML=historyHTML();$$("[data-open-chat]").forEach(b=>b.onclick=()=>openChat(b.dataset.openChat));$$("[data-chat-menu]").forEach(b=>b.onclick=e=>{e.stopPropagation();showConversationMenu(b.dataset.chatMenu,b);});}
function toggleTheme(){state.theme=state.theme==="dark"?"light":"dark";document.querySelector(".app-shell")?.setAttribute("data-theme",state.theme);savePreferences(state.user.uid,{theme:state.theme}).catch(()=>{});renderApp();}
function resizeInput(el){el.style.height="auto";el.style.height=Math.min(el.scrollHeight,160)+"px";}
async function newChat(){state.view="chat";state.activeId=null;state.messages=[];renderApp();$("#prompt-input")?.focus();}
async function openChat(id){try{const c=await getConversation(state.user.uid,id);if(!c)return toast("Conversation not found.","error");state.activeId=id;state.messages=Array.isArray(c.messages)?c.messages:[];state.view="chat";renderApp();scrollMessages();}catch(e){toast(e.message,"error");}}
function scrollMessages(){const el=$("#message-list");if(el)el.scrollTop=el.scrollHeight;}
function showConversationMenu(id,anchor){$$(".chat-context-menu").forEach(x=>x.remove());const menu=document.createElement("div");menu.className="chat-context-menu";menu.innerHTML=`<button data-rename>${icon("pencil",14)} Rename</button><button data-delete class="danger-text">${icon("trash-2",14)} Delete</button>`;anchor.parentElement.append(menu);menu.querySelector("[data-rename]").onclick=async()=>{menu.remove();const old=state.conversations.find(c=>c.id===id)?.title||"";const title=prompt("Rename conversation:",old);if(title?.trim()){try{await renameConversation(state.user.uid,id,title.trim().slice(0,100));toast("Conversation renamed.","success");}catch(e){toast(e.message,"error");}}};menu.querySelector("[data-delete]").onclick=()=>{menu.remove();confirmModal("Delete conversation?","This permanently removes the selected conversation.","Delete",async()=>{try{await removeConversation(state.user.uid,id);if(state.activeId===id){state.activeId=null;state.messages=[];renderApp();}toast("Conversation deleted.","success");}catch(e){toast(e.message,"error");}});};}
function confirmModal(title,desc,action,fn){const root=$("#modal-root");root.innerHTML=`<div class="modal-backdrop"><div class="modal-card"><div class="modal-symbol">${icon("alert-circle",22)}</div><h3>${esc(title)}</h3><p>${esc(desc)}</p><div class="modal-actions"><button class="btn btn-quiet" id="modal-cancel">Cancel</button><button class="btn btn-danger" id="modal-confirm">${esc(action)}</button></div></div></div>`;$("#modal-cancel").onclick=()=>root.innerHTML="";$("#modal-confirm").onclick=async()=>{root.innerHTML="";try{await fn();}catch(e){toast(e.message||"Action failed.","error");}};}
async function persist(){if(!state.activeId||!state.user)return;await saveMessages(state.user.uid,state.activeId,state.messages,state.conversations.find(c=>c.id===state.activeId)?.title||titleFrom(state.messages[0]?.content||"New conversation"));}
function titleFrom(s){const t=String(s||"New conversation").replace(/\s+/g," ").trim();return t.length>42?t.slice(0,39)+"…":t||"New conversation";}
async function ensureConversation(firstText){if(state.activeId)return state.activeId;const c=await createConversation(state.user.uid,titleFrom(firstText));state.activeId=c.id;return c.id;}
async function sendMessage(){
 const input=$("#prompt-input");if(!input||state.busy)return;const content=input.value.trim();if(!content)return;
 if(!apiUrl){toast("AI backend is not configured. Set VITE_ORBIT_API_URL in .env.","error");return;}
 state.busy=true;state.controller=new AbortController();state.messages.push({role:"user",content});input.value="";renderApp();scrollMessages();
 try{
   await ensureConversation(content);await persist();
   const token=await state.user.getIdToken();
   const res=await fetch(`${apiUrl}/chat`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({messages:state.messages.map(m=>({role:m.role,content:m.content}))}),signal:state.controller.signal});
   if(!res.ok){let detail={};try{detail=await res.json();}catch{};throw new Error(detail.error||`AI request failed (${res.status}).`);}
   const ctype=res.headers.get("content-type")||"";
   if(ctype.includes("text/event-stream")&&res.body){
     const assistant={role:"assistant",content:""};state.messages.push(assistant);renderApp();scrollMessages();
     const reader=res.body.getReader(),decoder=new TextDecoder();let buffer="";
     while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const chunks=buffer.split("\n\n");buffer=chunks.pop()||"";for(const chunk of chunks){const line=chunk.split("\n").find(x=>x.startsWith("data:"));if(!line)continue;const raw=line.slice(5).trim();if(raw==="[DONE]")continue;let data;try{data=JSON.parse(raw);}catch{continue;}if(data.error)throw new Error(data.error);assistant.content+=data.choices?.[0]?.delta?.content||"";const article=$$(".assistant-message").at(-1);if(article){const body=$(".message-body",article);if(body){body.innerHTML=DOMPurify.sanitize(marked.parse(assistant.content||""));}}scrollMessages();}
     }
   } else {const data=await res.json();state.messages.push({role:"assistant",content:data.content||data.choices?.[0]?.message?.content||"The model returned an empty response."});}
   await persist();
 }catch(e){if(e.name==="AbortError"){toast("Generation stopped.","info");}else{state.messages.push({role:"assistant",content:`I couldn’t complete that request. **${e.message}**\n\nCheck your connection and Worker configuration, then try again.`});toast(e.message,"error");}await persist().catch(()=>{});}
 finally{state.busy=false;state.controller=null;renderApp();scrollMessages();}
}
async function regenerate(index){if(state.busy)return;const target=state.messages[index];if(!target||target.role!=="assistant")return;state.messages=state.messages.slice(0,index);await persist();renderApp();const lastUser=[...state.messages].reverse().find(m=>m.role==="user");if(!lastUser)return;const input=$("#prompt-input");if(input){input.value=lastUser.content;await sendMessage();}}
async function bootUser(user){
 state.user=user;state.view="chat";
 try{await ensureUserProfile(user);const prefs=await getPreferences(user.uid);state.theme=prefs.theme==="light"?"light":"dark";}catch(e){console.error(e);toast("Could not load your profile. Check Firebase setup and rules.","error");}
 renderApp();
 if(state.unsubscribe)state.unsubscribe();
 try{state.unsubscribe=watchConversations(user.uid,items=>{state.conversations=items;renderHistory();if(state.activeId){const c=items.find(x=>x.id===state.activeId);const h=$("#top-title");if(h&&c)h.textContent=c.title||"AI Workspace";}},e=>toast("Could not load chat history. Check Firestore Rules.","error"));}catch(e){toast(e.message,"error");}
}
if(!firebaseConfigured){state.authMode="login";renderAuth();}
else{
 renderAuth();
 onAuthStateChanged(auth,user=>{if(user)bootUser(user);else{state.user=null;if(state.unsubscribe)state.unsubscribe();state.conversations=[];state.activeId=null;state.messages=[];renderAuth();}});
}
window.addEventListener("online",()=>toast("You’re back online.","success"));
window.addEventListener("offline",()=>toast("You’re offline. Check your connection.","error"));