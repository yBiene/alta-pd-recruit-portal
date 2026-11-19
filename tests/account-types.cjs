const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(new URL('../functions/manage-user.ts',`file://${__filename}`),'utf8').replace(/^import[^\n]*\n/,'');
async function create({owner=false,fto=false,request={},membershipError=false}={}){
 let handler,profile,membership,created=false,deleted=false;
 const me={id:'actor',role:owner?'admin':'trainer',access_level:owner?'owner':fto?'standard':'extra',account_enabled:true};
 const admin={
  auth:{admin:{createUser:async()=>{created=true;return {data:{user:{id:'created-user'}},error:null};},deleteUser:async()=>{deleted=true;return {error:null};}}},
  from:table=>({
   select:()=>({eq:(field,value)=>({maybeSingle:async()=>({data:table==='profiles'&&value==='actor'?me:null,error:null}),single:async()=>({data:{id:'fto-unit'},error:null})})}),
   insert:async values=>{if(table==='profiles')profile=values;else membership=values;return {error:table==='portal_hub_memberships'&&membershipError?{message:'test failure'}:null};}
  })
 };
 const caller={auth:{getUser:async()=>({data:{user:{id:'actor'}},error:null})}};
 const context={Response,Headers,console:{error(){}},Deno:{env:{get:key=>key==='SUPABASE_SERVICE_ROLE_KEY'?'service':'anon'},serve:fn=>{handler=fn;}},createClient:(_url,key)=>key==='service'?admin:caller};
 vm.runInNewContext(source,context);
 const response=await handler({method:'POST',headers:new Headers({Authorization:'Bearer fixture'}),json:async()=>({action:'create',accountType:'employee',username:'max.mustermann',name:'Max Mustermann',serviceNo:'42',rank:'Police Officer',...request})});
 return {status:response.status,body:await response.json(),profile,membership,created,deleted};
}
(async()=>{
 const employee=await create({request:{role:'admin',access:'owner'}});
 assert.equal(employee.status,200);
 assert.equal(employee.profile.role,'recruit');
 assert.equal(employee.profile.access_level,'standard');
 assert.equal(employee.profile.rank,'Police Officer');
 assert.equal(employee.body.temporaryPassword,'123456');
 const denied=await create({request:{accountType:'management'}});
 assert.equal(denied.status,400);assert.equal(denied.created,false);
 const ftoDenied=await create({fto:true});
 assert.equal(ftoDenied.status,400);assert.equal(ftoDenied.created,false);
 const manager=await create({owner:true,request:{accountType:'management',rank:'Sergeant'}});
 assert.equal(manager.status,200);assert.equal(manager.profile.role,'trainer');assert.equal(manager.profile.access_level,'extra');
 const ownerDenied=await create({owner:true,request:{accountType:'owner'}});
 assert.equal(ownerDenied.status,400);assert.equal(ownerDenied.created,false);
 const invalidRank=await create({request:{rank:'Fake rank'}});
 assert.equal(invalidRank.status,400);assert.equal(invalidRank.created,false);
 const legacy=await create({request:{accountType:'trainer',role:'trainer',access:'standard'}});
 assert.equal(legacy.status,200);assert.equal(legacy.membership.unit_role,'instructor');
 const failed=await create({request:{accountType:'trainer',role:'trainer',access:'standard'},membershipError:true});
 assert.equal(failed.status,400);assert.equal(failed.deleted,true);
 console.log('PASS: canonical account creation, privilege escalation rejection, owner-only management grants, FTO separation and legacy-create rollback.');
})().catch(error=>{console.error(error);process.exitCode=1;});
