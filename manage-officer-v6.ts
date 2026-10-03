import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async (req) => {
 const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 try{
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth=req.headers.get("Authorization")||"";
  const caller=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const {data:{user}}=await caller.auth.getUser(); if(!user) throw new Error("Nicht angemeldet");
  const {data:me}=await admin.from("profiles").select("role,access_level").eq("id",user.id).single();
  if(!(me?.role==="admin"&&me?.access_level==="owner")) throw new Error("Nur Hauptadmin");
  const b=await req.json(), username=String(b.username||"").trim().toLowerCase();
  if(!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error("Ungültiger Benutzername");
  const password=String(b.password||"123456");
  const {data:created,error:ce}=await admin.auth.admin.createUser({email:`${username}@altapd.internal`,password,email_confirm:true,user_metadata:{username,name:b.name}}); if(ce) throw ce;
  const id=created.user!.id;
  const {error:pe}=await admin.from("profiles").insert({id,username,name:String(b.name||username),service_no:String(b.serviceNo||""),rank:String(b.rank||"Officer"),role:"recruit",access_level:"standard",status:"Officer",fto:"—"});
  if(pe){await admin.auth.admin.deleteUser(id);throw pe}
  const roles=Array.isArray(b.roles)?b.roles:["officer"];
  await admin.from("user_roles").insert([...new Set(["officer",...roles])].map(role=>({user_id:id,role})));
  return new Response(JSON.stringify({ok:true,id}),{headers:cors});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:String(e)}),{status:400,headers:cors})}
});
