const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const encoder = new TextEncoder();
const limiter = new Map();

function response(body, status=200, extra={}) {
  return new Response(JSON.stringify(body), { status, headers: {...JSON_HEADERS, ...extra} });
}
function originAllowed(origin, env) {
  if (!origin) return true; // non-browser clients still require a valid Firebase token
  const list = (env.ALLOWED_ORIGINS || "").split(",").map(x=>x.trim()).filter(Boolean);
  return list.includes(origin);
}
function corsHeaders(origin, env) {
  const allowed = origin && originAllowed(origin, env);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : (origin ? "null" : "*"),
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function safeText(s) { return typeof s === "string" ? s.trim() : ""; }
function checkRateLimit(key, max) {
  const now=Date.now(), windowMs=60_000;
  const entry=limiter.get(key);
  if(!entry||now-entry.start>=windowMs){limiter.set(key,{start:now,count:1});return true;}
  entry.count++;return entry.count<=max;
}
async function verifyFirebaseToken(token, projectId) {
  const parts=token.split(".");
  if(parts.length!==3)throw new Error("Invalid token");
  let payload;
  try{payload=JSON.parse(atob(parts[1].replace(/-/g,"+").replace(/_/g,"/")));}catch{throw new Error("Invalid token");}
  const now=Math.floor(Date.now()/1000);
  if(payload.iss!==`https://securetoken.google.com/${projectId}`||
     payload.aud!==projectId||!payload.sub||!payload.user_id||
     payload.sub!==payload.user_id||payload.exp<=now||payload.iat>now+60)
    throw new Error("Invalid token");
  const certs=await getFirebaseCerts();
  const cert=certs[payload.kid];
  if(!cert)throw new Error("Invalid token");
  const key=await crypto.subtle.importKey("jwk",cert,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const signed=encoder.encode(`${parts[0]}.${parts[1]}`);
  const signature=Uint8Array.from(atob(parts[2].replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
  const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,signature,signed);
  if(!valid)throw new Error("Invalid token");
  return payload;
}
let certCache=null, certExpiry=0;
async function getFirebaseCerts(){
  if(certCache&&Date.now()<certExpiry)return certCache;
  const r=await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  if(!r.ok)throw new Error("Could not verify identity");
  const data=await r.json();certCache=Object.fromEntries(data.keys.map(k=>[k.kid,k]));certExpiry=Date.now()+50*60*1000;return certCache;
}
export default {
  async fetch(request, env) {
    const origin=request.headers.get("Origin")||"";
    const cors=corsHeaders(origin,env);
    if(!originAllowed(origin,env))return response({error:"Origin not allowed."},403,cors);
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
    const url=new URL(request.url);
    if(request.method==="GET"&&url.pathname==="/health")return response({ok:true,service:"ORBIT AI API"},200,cors);
    if(request.method!=="POST"||url.pathname!=="/chat")return response({error:"Not found."},404,cors);
    if(!env.GROQ_API_KEY||!env.FIREBASE_PROJECT_ID)return response({error:"Server is not configured."},503,cors);
    const auth=request.headers.get("Authorization")||"";
    if(!auth.startsWith("Bearer "))return response({error:"Sign in to continue."},401,cors);
    let identity;
    try{identity=await verifyFirebaseToken(auth.slice(7).trim(),env.FIREBASE_PROJECT_ID);}
    catch{return response({error:"Your session could not be verified. Sign in again."},401,cors);}
    const maxRate=Math.max(1,Math.min(60,Number(env.RATE_LIMIT_PER_MINUTE)||12));
    if(!checkRateLimit(identity.sub,maxRate))return response({error:"You’re sending requests too quickly. Wait a minute and try again."},429,cors);
    const contentLength=Number(request.headers.get("Content-Length")||0);
    if(contentLength>64_000)return response({error:"Request is too large."},413,cors);
    let body;
    try{body=await request.json();}catch{return response({error:"Request body must be valid JSON."},400,cors);}
    const messages=body?.messages;
    const maxMessages=Math.max(2,Math.min(40,Number(env.MAX_MESSAGES)||30));
    const maxChars=Math.max(1000,Math.min(24000,Number(env.MAX_INPUT_CHARS)||16000));
    if(!Array.isArray(messages)||messages.length<1||messages.length>maxMessages)return response({error:`Send between 1 and ${maxMessages} messages.`},400,cors);
    let total=0;
    const clean=[];
    for(const m of messages){
      if(!m||!["user","assistant"].includes(m.role)||typeof m.content!=="string")return response({error:"Invalid message format."},400,cors);
      const content=m.content.trim();if(!content)return response({error:"Messages cannot be empty."},400,cors);
      total+=content.length;if(total>maxChars)return response({error:"Conversation is too long. Start a new chat or shorten your message."},413,cors);
      clean.push({role:m.role,content});
    }
    if(clean.at(-1)?.role!=="user")return response({error:"The latest message must be from you."},400,cors);
    const model=String(env.GROQ_MODEL||"llama-3.3-70b-versatile").trim();
    const timeout=AbortSignal.timeout(45_000);
    let groq;
    try{
      groq=await fetch("https://api.groq.com/openai/v1/chat/completions",{
        method:"POST",headers:{"Authorization":`Bearer ${env.GROQ_API_KEY}`,"Content-Type":"application/json"},
        body:JSON.stringify({model,messages:[{role:"system",content:"You are ORBIT AI, a helpful, clear, thoughtful assistant. Be honest about uncertainty. Use Markdown when it improves readability."},...clean],temperature:0.7,max_tokens:2048,stream:true}),
        signal:timeout
      });
    }catch(e){return response({error:e.name==="TimeoutError"?"The AI service took too long. Try again.":"Could not reach the AI service. Try again shortly."},502,cors);}
    if(!groq.ok){
      let status=groq.status;
      // Do not forward upstream error bodies; they can reveal account/model details.
      if(status===429)return response({error:"AI service is busy or its quota is reached. Try again later."},429,cors);
      if(status===401||status===403)return response({error:"AI service credentials need to be checked by the site owner."},502,cors);
      if(status===400)return response({error:"The AI service rejected this request. Try a shorter message."},400,cors);
      return response({error:"The AI service is temporarily unavailable."},502,cors);
    }
    const headers={...cors,"Content-Type":"text/event-stream; charset=utf-8","Cache-Control":"no-cache, no-transform","X-Content-Type-Options":"nosniff"};
    const upstream=groq.body;
    if(!upstream)return response({error:"AI response stream was unavailable."},502,cors);
    const stream=new ReadableStream({
      async start(controller){
        const reader=upstream.getReader();
        try{
          while(true){const {value,done}=await reader.read();if(done)break;controller.enqueue(value);}
          controller.close();
        }catch{try{controller.enqueue(encoder.encode(`data: ${JSON.stringify({error:"The AI stream ended unexpectedly."})}\n\n`));controller.close();}catch{}}
        finally{reader.releaseLock();}
      },
      cancel(){upstream.cancel().catch(()=>{});}
    });
    return new Response(stream,{status:200,headers});
  }
};