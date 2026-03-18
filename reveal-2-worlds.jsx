import { useState, useEffect, useCallback, useRef } from "react";

const PF="'Press Start 2P',monospace",BF="'VT323',monospace";
const C={bg:"#0e1019",bgC:"#171b2d",bgL:"#222842",acc:"#f04f78",accD:"#b83058",blu:"#3b7dd8",bluL:"#5fcde4",grn:"#38b764",grnD:"#257953",grnL:"#6abe30",yel:"#feae34",yelD:"#d77643",pur:"#b55088",org:"#d77643",red:"#e04040",wht:"#f4f4f4",txt:"#c8c8c8",dim:"#555570",gld:"#feae34",xp:"#5fcde4",brd:"#2a2e48"};
const WL="#2a1f3d",WD="#1a1230",FL="#3a2820",FD="#281a14",WO="#5a3a20",ST="#4a4460",SD="#3a3450";

function useSound(){const r=useRef(null);const g=()=>{if(!r.current)r.current=new(window.AudioContext||window.webkitAudioContext)();return r.current};
const b=(f,d,dl=0,tp="square",v=0.05)=>{try{const c=g(),n=c.currentTime,o=c.createOscillator(),ga=c.createGain();o.type=tp;o.connect(ga);ga.connect(c.destination);o.frequency.setValueAtTime(f,n+dl);ga.gain.setValueAtTime(v,n+dl);ga.gain.exponentialRampToValueAtTime(0.001,n+dl+d);o.start(n+dl);o.stop(n+dl+d)}catch(e){}};
return useCallback((t)=>{if(t==="click")b(700,0.08);else if(t==="select"){b(523,0.12);b(659,0.12,0.08);b(784,0.15,0.16)}else if(t==="loot"){[392,523,659,784].forEach((f,i)=>b(f,0.12,i*0.08,"sine",0.06))}else if(t==="achieve"){b(1047,0.1,0,"sine",0.07);b(1319,0.1,0.1,"sine",0.07);b(1568,0.15,0.2,"sine",0.07)}else if(t==="door"){b(150,0.2,0,"sine",0.08);b(200,0.15,0.15,"sine",0.06);b(300,0.2,0.3,"sine",0.05)}},[])}

const CL=[{id:"warrior",icon:"⚔️",color:"#f04f78"},{id:"mage",icon:"🧙",color:"#b55088"},{id:"archer",icon:"🏹",color:"#feae34"},{id:"healer",icon:"🛡️",color:"#5fcde4"},{id:"rogue",icon:"🗡️",color:"#38b764"}];
const NPC=[{name:"Mia",cls:CL[1],hat:"#b55088",body:"#b55088",skin:"#fed",px:18,py:62},{name:"Jonas",cls:CL[4],hat:"#38b764",body:"#257953",skin:"#edc",px:75,py:65},{name:"Sara",cls:CL[3],hat:"#5fcde4",body:"#3b7dd8",skin:"#ffe",px:55,py:70},{name:"Emil",cls:CL[2],hat:"#feae34",body:"#d77643",skin:"#fec",px:88,py:63}];
const DAILY=[{d:1,xp:10},{d:2,xp:15},{d:3,xp:20},{d:4,xp:30},{d:5,xp:50},{d:6,xp:50},{d:7,xp:100,sp:true}];
const SQ=[{i:"⚡",t:"Quick Estimate",d:"3 tasks, 2 min",xp:30},{i:"🔍",t:"Risk Spotter",d:"Find risici",xp:40},{i:"🤝",t:"Hjælp team",d:"Vær expert",xp:50},{i:"📊",t:"Accuracy",d:"Est. vs real",xp:25}];
const WORLDS=[{id:"w1",name:"Platform Team",sprint:"Sprint 14",icon:"⚔️",color:C.grn,prog:5,tot:12,lv:"WORLD 1",boss:"👾",sky:"#6a98e0",grs:"#38b764",drt:"#d77643"},
{id:"w2",name:"Kunde X",sprint:"Scope Workshop",icon:"🏰",color:C.yel,prog:2,tot:8,lv:"WORLD 2",boss:"🐉",sky:"#e0c888",grs:"#f0d888",drt:"#a08050"},
{id:"w3",name:"Infra Team",sprint:"Q2 Budget",icon:"🗼",color:C.bluL,prog:0,tot:6,lv:"WORLD 3",boss:"💀",sky:"#8ab0d8",grs:"#d8e8f8",drt:"#8898a8"}];
function dk(h,a=40){const n=parseInt(h.replace("#",""),16);return `#${(Math.max(0,(n>>16)-a)<<16|Math.max(0,((n>>8)&0xff)-a)<<8|Math.max(0,(n&0xff)-a)).toString(16).padStart(6,"0")}`}

function Spr({hat,body,skin="#fdd",cls,size=1,anim,dir=1,idle=true,label}){
  const[t,setT]=useState(Math.floor(Math.random()*100));
  useEffect(()=>{if(!idle)return;const i=setInterval(()=>setT(v=>v+1),90);return ()=>clearInterval(i)},[idle]);
  const s=size,w=Math.round(14*s),cl=cls||CL[0],blink=idle&&t%30<2,leg=idle?Math.sin(t*0.2)*s*0.3:0;
  return <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",transform:`scaleX(${dir})`,position:"relative"}}>
    <div style={{position:"relative",width:`${w*1.3}px`,animation:anim||"none"}}>
      <div style={{position:"absolute",bottom:`${-2*s}px`,left:"50%",transform:"translateX(-50%)",width:`${w*1.2}px`,height:`${2*s}px`,background:"rgba(0,0,0,0.15)",borderRadius:"50%"}}/>
      <div style={{width:`${w}px`,margin:"0 auto"}}>
        <div style={{textAlign:"center",fontSize:`${3.5*s}px`,marginBottom:`${-0.5*s}px`,opacity:0.5}}>{cl.icon}</div>
        <div style={{width:`${w}px`,height:`${3*s}px`,background:hat||cl.color,margin:"0 auto"}}/>
        <div style={{width:`${w*0.85}px`,height:`${2.5*s}px`,background:dk(hat||cl.color),margin:"-1px auto 0"}}/>
        <div style={{width:`${w*0.75}px`,height:`${7*s}px`,background:skin,margin:"0 auto",position:"relative"}}>
          {!blink&&<><div style={{position:"absolute",top:`${2.5*s}px`,left:`${1.5*s}px`,width:`${1.5*s}px`,height:`${1.5*s}px`,background:C.bg}}/><div style={{position:"absolute",top:`${2.5*s}px`,right:`${1.5*s}px`,width:`${1.5*s}px`,height:`${1.5*s}px`,background:C.bg}}/></>}
          {blink&&<div style={{position:"absolute",top:`${3*s}px`,left:`${1*s}px`,right:`${1*s}px`,height:`${0.8*s}px`,background:C.bg}}/>}
        </div>
        <div style={{width:`${w*0.9}px`,height:`${8*s}px`,background:body||hat||cl.color,margin:"0 auto",position:"relative"}}>
          <div style={{position:"absolute",right:`${-3*s}px`,top:`${1.5*s}px`,fontSize:`${3.5*s}px`,transform:`rotate(${-25+Math.sin((t||0)*0.1)*5}deg)`,opacity:0.7}}>{cl.icon}</div>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:`${1.5*s}px`}}>
          <div style={{width:`${4*s}px`,height:`${4*s+leg}px`,background:dk(body||hat||cl.color,60)}}/>
          <div style={{width:`${4*s}px`,height:`${4*s-leg}px`,background:dk(body||hat||cl.color,60)}}/>
        </div>
      </div>
    </div>
    {label&&<div style={{fontFamily:PF,fontSize:`${Math.max(4,2.2*s)}px`,color:C.wht,marginTop:`${1.5*s}px`,background:C.bg+"bb",padding:"1px 3px",transform:`scaleX(${dir})`}}>{label}</div>}
  </div>}

function Torch({x,y,size=1}){
  const[t,setT]=useState(Math.floor(Math.random()*100));
  useEffect(()=>{const i=setInterval(()=>setT(v=>v+1),60);return ()=>clearInterval(i)},[]);
  const s=size;
  return <div style={{position:"absolute",left:`${x}%`,top:`${y}%`}}>
    <div style={{width:`${6*s}px`,height:`${18*s}px`,background:WO,margin:"0 auto"}}/>
    <div style={{position:"absolute",top:`${-10*s}px`,left:"50%",transform:"translateX(-50%)"}}>
      <div style={{width:`${5+Math.sin(t*0.3)*2}px`,height:`${9+Math.sin(t*0.25)*3}px`,background:"#ff6030",borderRadius:`${3*s}px ${3*s}px 0 0`,margin:"0 auto",opacity:0.9}}/>
      <div style={{width:`${3+Math.sin(t*0.35)*1.5}px`,height:`${6+Math.sin(t*0.3)*2}px`,background:"#ffaa30",borderRadius:`${2*s}px ${2*s}px 0 0`,margin:`${-5*s}px auto 0`}}/>
      <div style={{width:`${2+Math.sin(t*0.4)*1}px`,height:`${3+Math.sin(t*0.35)*1}px`,background:"#ffe477",borderRadius:`${s}px ${s}px 0 0`,margin:`${-2*s}px auto 0`}}/>
    </div>
    <div style={{position:"absolute",top:`${-16*s}px`,left:"50%",transform:"translateX(-50%)",width:`${35+Math.sin(t*0.2)*8}px`,height:`${35+Math.sin(t*0.2)*8}px`,borderRadius:"50%",background:"radial-gradient(circle,#ff603015,#ffaa3008,transparent)",pointerEvents:"none"}}/>
    {[0,1].map(i=> <div key={i} style={{position:"absolute",top:`${-12*s-Math.abs(Math.sin(t*0.15+i*2))*10}px`,left:`${50+Math.sin(t*0.2+i*3)*8}%`,width:`${2*s}px`,height:`${2*s}px`,background:["#ff6030","#ffe477"][i],borderRadius:"50%",opacity:0.3+Math.sin(t*0.1+i)*0.2}}/>)}
  </div>}

function Portal({w,hovered:isH,t,onClick}){
  return <div onClick={onClick} style={{cursor:"pointer",transition:"all 0.25s",transform:isH?"scale(1.06) translateY(-4px)":"scale(1)",width:"170px"}}>
    <div style={{width:"170px",position:"relative"}}>
      <div style={{width:"170px",height:"22px",background:ST,borderRadius:"6px 6px 0 0",border:`3px solid ${SD}`,borderBottom:"none",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontFamily:PF,fontSize:"5px",color:w.color,letterSpacing:"1px"}}>{w.lv}</span>
      </div>
      <div style={{width:"164px",height:"95px",margin:"0 3px",overflow:"hidden",position:"relative",border:`3px solid ${isH?w.color:SD}`,borderTop:"none",boxShadow:isH?`0 0 20px ${w.color}44, inset 0 0 15px ${w.color}22`:"none",transition:"all 0.3s"}}>
        <div style={{width:"100%",height:"40%",background:w.sky}}/>
        <div style={{width:"100%",height:"60%",background:w.grs}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:"15%",background:w.drt}}/>
        {[15,45,80].map((x,i)=> <div key={i} style={{position:"absolute",bottom:"18%",left:`${x}%`}}><div style={{width:"3px",height:"7px",background:dk(w.drt),margin:"0 auto"}}/><div style={{width:"9px",height:"7px",background:dk(w.grs),marginTop:"-2px",marginLeft:"-3px"}}/></div>)}
        {[20,65].map((x,i)=> <div key={i} style={{position:"absolute",top:`${8+i*5}%`,left:`${(x+t*0.3)%100}%`,width:"16px",height:"5px",background:"#fff",opacity:0.35}}/>)}
        <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:`radial-gradient(ellipse,${w.color}${isH?"30":"10"},transparent 70%)`,animation:isH?"portalPulse 1.5s ease-in-out infinite":"none"}}/>
        {isH&&Array.from({length:5}).map((_,i)=> <div key={i} style={{position:"absolute",left:`${15+i*16}%`,top:`${20+Math.sin(t*0.05+i)*25}%`,width:"3px",height:"3px",borderRadius:"50%",background:w.color,opacity:0.4+Math.sin(t*0.06+i)*0.3,animation:`float ${1+i%3*0.3}s ease-in-out ${i*0.12}s infinite`}}/>)}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:"26px",filter:isH?"none":"brightness(0.7)",animation:isH?"bounce 0.6s ease-in-out infinite":"none"}}>{w.icon}</div>
        <div style={{position:"absolute",bottom:"18%",right:"8%",fontSize:"13px",opacity:isH?0.6:0.2,transition:"opacity 0.3s"}}>{w.boss}</div>
      </div>
      <div style={{position:"absolute",top:"22px",left:0,width:"10px",height:"95px",background:`linear-gradient(90deg,${SD},${ST})`}}/>
      <div style={{position:"absolute",top:"22px",right:0,width:"10px",height:"95px",background:`linear-gradient(90deg,${ST},${SD})`}}/>
    </div>
    <div style={{textAlign:"center",marginTop:"6px"}}>
      <div style={{fontFamily:PF,fontSize:"7px",color:isH?w.color:C.txt,textShadow:isH?`0 0 6px ${w.color}66`:"none"}}>{w.name}</div>
      <div style={{fontFamily:BF,fontSize:"12px",color:C.dim}}>{w.sprint}</div>
      <div style={{display:"flex",alignItems:"center",gap:"3px",justifyContent:"center",marginTop:"3px"}}>
        <div style={{width:"70px",height:"5px",background:C.bg,border:`1px solid ${dk(w.color)}`,overflow:"hidden"}}><div style={{height:"100%",width:`${(w.prog/w.tot)*100}%`,background:w.color,boxShadow:`0 0 3px ${w.color}44`}}/></div>
        <span style={{fontFamily:PF,fontSize:"4px",color:w.color}}>{w.prog}/{w.tot}</span>
      </div>
      {isH&&<div style={{fontFamily:PF,fontSize:"4px",color:w.color,marginTop:"3px",animation:"pulse 0.6s infinite"}}>▶ ENTER</div>}
    </div>
  </div>}

export default function WorldSelect(){
  const sound=useSound();const[t,setT]=useState(0);const[hov,setHov]=useState(null);
  const[claimed,setClaimed]=useState([1,2,3]);const[chest,setChest]=useState(false);const[chestDone,setChestDone]=useState(false);const[lootVis,setLootVis]=useState(false);
  const[flash,setFlash]=useState(null);const[tab,setTab]=useState("worlds");
  const[xpT,setXpT]=useState(0);const[sessT,setSessT]=useState(0);const[accT,setAccT]=useState(0);
  useEffect(()=>{const i=setInterval(()=>setT(v=>v+1),50);return ()=>clearInterval(i)},[]);
  useEffect(()=>{let v=0;const i=setInterval(()=>{v+=30;if(v>=1240){setXpT(1240);clearInterval(i)}else setXpT(v)},20);return ()=>clearInterval(i)},[]);
  useEffect(()=>{let v=0;const i=setInterval(()=>{v++;if(v>=24){setSessT(24);clearInterval(i)}else setSessT(v)},50);return ()=>clearInterval(i)},[]);
  useEffect(()=>{let v=0;const i=setInterval(()=>{v++;if(v>=78){setAccT(78);clearInterval(i)}else setAccT(v)},35);return ()=>clearInterval(i)},[]);

  function openChest(){if(chest||chestDone)return;setChest(true);sound("loot");setTimeout(()=>{setClaimed(p=>[...p,4]);setLootVis(true);sound("achieve");setFlash(C.gld);setTimeout(()=>{setChest(false);setChestDone(true);setLootVis(false);setFlash(null)},600)},800)}

  return <div style={{minHeight:"100vh",position:"relative",overflow:"hidden"}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');*{box-sizing:border-box;margin:0;padding:0}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes pop{0%{transform:scale(0)}70%{transform:scale(1.15)}100%{transform:scale(1)}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes flashOut{0%{opacity:0.5}100%{opacity:0}}@keyframes portalPulse{0%,100%{opacity:0.3}50%{opacity:0.6}}@keyframes chestOpen{0%{transform:scale(1)}20%{transform:scale(1.2) rotate(-3deg)}40%{transform:scale(1.3) rotate(3deg)}100%{transform:scale(1)}}@keyframes lootFloat{0%{transform:translateY(0) scale(0);opacity:0}40%{transform:translateY(-25px) scale(1.2);opacity:1}100%{transform:translateY(-40px);opacity:0}}@keyframes charWalk{0%,100%{transform:translateX(0)}50%{transform:translateX(6px)}}@keyframes victoryPulse{0%,100%{text-shadow:3px 3px 0 #b83058,0 0 20px rgba(240,79,120,0.3)}50%{text-shadow:3px 3px 0 #b83058,0 0 40px rgba(240,79,120,0.6)}}`}</style>

    {flash&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:flash,opacity:0.4,pointerEvents:"none",zIndex:200,animation:"flashOut 0.5s ease-out forwards"}}/>}

    {/* Tavern wall */}
    <div style={{position:"absolute",top:0,left:0,right:0,height:"35%",background:`linear-gradient(180deg,${WD},${WL})`}}/>
    {Array.from({length:12}).map((_,i)=> <div key={`wb${i}`} style={{position:"absolute",top:`${3+Math.floor(i/4)*10}%`,left:`${(i%4)*26+2}%`,width:"22%",height:"8%",border:`1px solid ${WD}`,opacity:0.12}}/>)}
    <div style={{position:"absolute",top:"33%",left:0,right:0,height:"3%",background:`linear-gradient(180deg,${WO},${dk(WO)})`}}/>
    {[20,50,80].map((x,i)=> <div key={`bm${i}`} style={{position:"absolute",top:0,left:`${x}%`,width:"2%",height:"33%",background:`linear-gradient(90deg,${dk(WO)},${WO},${dk(WO)})`,opacity:0.3}}/>)}
    {/* Floor */}
    <div style={{position:"absolute",top:"36%",left:0,right:0,bottom:0,background:`linear-gradient(180deg,${FL},${FD})`}}/>
    {Array.from({length:8}).map((_,i)=> <div key={`fp${i}`} style={{position:"absolute",top:`${36+i*8}%`,left:0,right:0,height:"1px",background:FD,opacity:0.25}}/>)}

    <Torch x={8} y={10} size={1.2}/><Torch x={88} y={10} size={1.2}/><Torch x={35} y={8} size={1}/><Torch x={62} y={8} size={1}/>
    <div style={{position:"absolute",top:0,left:0,right:0,height:"40%",background:"radial-gradient(ellipse at 50% 80%,#ff603008,transparent 60%)",pointerEvents:"none"}}/>
    {Array.from({length:10}).map((_,i)=> <div key={`dp${i}`} style={{position:"absolute",left:`${(i*10+t*0.015*(i%3+1))%105}%`,top:`${15+Math.sin(t*0.01+i*1.2)*20}%`,width:`${2+i%2}px`,height:`${2+i%2}px`,borderRadius:"50%",background:C.gld,opacity:0.05+Math.sin(t*0.015+i)*0.03}}/>)}

    {/* NPCs */}
    {NPC.map((m,i)=> <div key={m.name} style={{position:"absolute",left:`${m.px+Math.sin(t*0.008+i*2)*4}%`,top:`${m.py}%`,animation:`charWalk ${3+i}s ease-in-out infinite`,zIndex:3}}>
      <Spr hat={m.hat} body={m.body} skin={m.skin} cls={m.cls} size={1.5} dir={Math.sin(t*0.008+i*2)>0?1:-1} label={m.name}/>
    </div>)}
    {/* Player */}
    <div style={{position:"absolute",left:"46%",top:"55%",zIndex:4}}>
      <Spr hat="#f04f78" body="#3b7dd8" skin="#fdd" cls={CL[0]} size={2.3} anim="float 2s ease-in-out infinite" label="Du"/>
      <div style={{fontFamily:PF,fontSize:"4px",color:C.acc,textAlign:"center",marginTop:"2px",animation:"pulse 1.5s infinite"}}>▼</div>
    </div>

    {/* UI */}
    <div style={{position:"relative",zIndex:5,padding:"8px 10px"}}>
      <div style={{textAlign:"center",marginBottom:"4px"}}><h1 style={{fontFamily:PF,fontSize:"16px",color:C.acc,letterSpacing:"4px",margin:0,animation:"victoryPulse 3s ease-in-out infinite"}}>REVEAL</h1><div style={{fontFamily:BF,fontSize:"13px",color:C.dim}}>◈ TAVERN HUB ◈</div></div>

      {/* Stats */}
      <div style={{display:"flex",justifyContent:"center",gap:"8px",marginBottom:"6px"}}>
        {[{v:sessT,c:C.acc,l:"SESS"},{v:`${accT}%`,c:C.grn,l:"ACC"}].map((s,i)=> <div key={i} style={{background:C.bgC+"dd",border:`2px solid ${C.brd}`,padding:"3px 8px",display:"flex",alignItems:"center",gap:"3px"}}><span style={{fontFamily:PF,fontSize:"9px",color:s.c}}>{s.v}</span><span style={{fontFamily:PF,fontSize:"3px",color:C.dim}}>{s.l}</span></div>)}
        <div style={{background:C.bgC+"dd",border:`2px solid ${C.brd}`,padding:"3px 8px",display:"flex",alignItems:"center",gap:"3px"}}><span style={{fontSize:"10px",animation:"float 1.2s ease-in-out infinite"}}>🔥</span><span style={{fontFamily:PF,fontSize:"9px",color:C.org}}>3</span></div>
        <div style={{background:C.bgC+"dd",border:`2px solid ${C.brd}`,padding:"3px 8px",display:"flex",alignItems:"center",gap:"3px"}}><span style={{fontFamily:PF,fontSize:"3px",color:C.gld}}>LV3</span><div style={{width:"50px",height:"4px",background:C.bg,border:`1px solid ${C.brd}`}}><div style={{height:"100%",width:`${(xpT/2000)*100}%`,background:C.xp,transition:"width 0.05s"}}/></div><span style={{fontFamily:PF,fontSize:"3px",color:C.xp}}>{xpT}</span></div>
      </div>

      {/* Daily */}
      <div style={{display:"flex",justifyContent:"center",gap:"3px",marginBottom:"8px"}}>
        {DAILY.map((d,i)=>{const done=claimed.includes(d.d);const isN=d.d===4&&!done&&!chestDone;
          return <div key={i} onClick={()=>{if(isN)openChest()}} style={{width:"28px",height:"34px",background:done||chestDone&&d.d===4?C.grn+"33":isN?C.gld+"22":C.bgL+"aa",border:`2px solid ${done||chestDone&&d.d===4?C.grn:isN?C.gld:C.brd}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:isN?"pointer":"default",boxShadow:isN?`0 0 10px ${C.gld}44`:"none",animation:chest&&isN?"chestOpen 0.8s":isN?"float 1s ease-in-out infinite":"none",position:"relative"}}>
            {done||chestDone&&d.d===4? <span style={{fontSize:"11px"}}>✅</span>:isN? <span style={{fontSize:"14px"}}>🎁</span>:<span style={{fontFamily:PF,fontSize:"4px",color:d.sp?C.gld:C.txt}}>{d.sp?"🌟":`+${d.xp}`}</span>}
            {lootVis&&isN&&<div style={{position:"absolute",top:"-28px",left:"50%",transform:"translateX(-50%)",animation:"lootFloat 0.8s ease-out forwards",pointerEvents:"none",whiteSpace:"nowrap"}}><span style={{fontFamily:PF,fontSize:"5px",color:C.gld}}>+30 💎</span></div>}
          </div>})}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",justifyContent:"center",gap:"5px",marginBottom:"8px"}}>
        {[{id:"worlds",l:"🌍 VERDENER"},{id:"quests",l:"📜 QUESTS"}].map(tb=> <div key={tb.id} onClick={()=>{setTab(tb.id);sound("click")}} style={{fontFamily:PF,fontSize:"5px",color:tab===tb.id?C.gld:C.dim,padding:"4px 10px",background:tab===tb.id?C.bgL+"dd":C.bg+"88",border:`2px solid ${tab===tb.id?C.gld:C.brd}`,cursor:"pointer"}}>{tb.l}</div>)}
      </div>

      {/* Portals */}
      {tab==="worlds"&&<div style={{display:"flex",justifyContent:"center",gap:"14px",flexWrap:"wrap",animation:"slideUp 0.3s"}}>
        {WORLDS.map((w,i)=> <div key={w.id} style={{animation:`slideUp 0.3s ${i*0.1}s both`}} onMouseEnter={()=>{setHov(w.id);sound("click")}} onMouseLeave={()=>setHov(null)}>
          <Portal w={w} hovered={hov===w.id} t={t} onClick={()=>{sound("door");setFlash(w.color);setTimeout(()=>setFlash(null),500)}}/>
        </div>)}
      </div>}

      {tab==="quests"&&<div style={{maxWidth:"480px",margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px",animation:"slideUp 0.3s"}}>
        {SQ.map((sq,i)=> <div key={sq.t} onClick={()=>sound("select")} style={{background:C.bgC+"dd",border:`2px solid ${C.yel}44`,padding:"8px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",animation:`slideUp 0.3s ${i*0.08}s both`}}>
          <div style={{width:"28px",height:"28px",background:C.yel+"22",border:`2px solid ${C.yel}44`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",flexShrink:0,animation:`float ${1.8+i%2*0.4}s ease-in-out ${i*0.2}s infinite`}}>{sq.i}</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontFamily:PF,fontSize:"4px",color:C.wht}}>{sq.t}</div><div style={{fontFamily:BF,fontSize:"11px",color:C.dim}}>{sq.d}</div></div>
          <span style={{fontFamily:PF,fontSize:"5px",color:C.xp}}>+{sq.xp}</span>
        </div>)}
      </div>}
    </div>
  </div>}