const http = require('http');
const qs = require('querystring');
function get(path, headers={}){
  return new Promise((resolve,reject)=>{
    const opts={host:'127.0.0.1',port:3000,path,method:'GET',headers};
    const req=http.request(opts,res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>resolve({res,body:b}));});
    req.on('error',reject);
    req.end();
  });
}
function post(path,data,headers={}){
  return new Promise((resolve,reject)=>{
    const postData=qs.stringify(data);
    const opts={host:'127.0.0.1',port:3000,path,method:'POST',headers:Object.assign({'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(postData)},headers)};
    const req=http.request(opts,res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>resolve({res,body:b}));});
    req.on('error',reject);
    req.write(postData);
    req.end();
  });
}
(async()=>{
  try{
    const r1=await get('/admin/login');
    const setCookies=r1.res.headers['set-cookie']||[];
    const cookieHeader=setCookies.map(c=>c.split(';')[0]).join('; ');
    const m=r1.body.match(/name=\"_csrf\" value=\"([^\"]+)\"/);
    const token=m?m[1]:'';
    console.log('csrf ok?',!!token);
    const r2=await post('/admin/login',{username:'admin',password:'Admin@12345',_csrf:token},{Cookie:cookieHeader});
    console.log('login status',r2.res.statusCode);
    const postCookies=r2.res.headers['set-cookie']||[];
    const sessionCookie=postCookies.map(c=>c.split(';')[0]).join('; ');
    const allCookies=(cookieHeader?cookieHeader+'; ':'')+sessionCookie;
    const r3=await get('/admin/settings',{Cookie:allCookies});
    console.log('/admin/settings status',r3.res.statusCode);
    console.log(r3.body.slice(0,500));
  }catch(e){console.error('ERR',e);}
})();
