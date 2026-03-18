import { useState, useEffect, useCallback, useRef } from "react";

const PF="'Press Start 2P',monospace",BF="'VT323',monospace";
const C={bg:"#0e1019",bgC:"#171b2d",bgL:"#222842",acc:"#f04f78",accD:"#b83058",blu:"#3b7dd8",bluL:"#5fcde4",grn:"#38b764",grnD:"#257953",grnL:"#6abe30",yel:"#feae34",yelD:"#d77643",pur:"#b55088",purD:"#7a3060",org:"#d77643",red:"#e04040",wht:"#f4f4f4",txt:"#c8c8c8",dim:"#555570",gld:"#feae34",xp:"#5fcde4",brd:"#2a2e48",sky:"#4a78c8",skyL:"#6a98e0",grs:"#38b764",grsD:"#257953",grsL:"#6abe30",drt:"#d77643",drtD:"#a0522d",wat:"#3068b0",watL:"#5090d0"};

// ==================== SOUND ENGINE ====================
function useSound(){
  const r=useRef(null);
  const g=()=>{if(!r.current)r.current=new(window.AudioContext||window.webkitAudioContext)();return r.current};
  const b=(freq,dur,del=0,type="square",vol=0.05)=>{try{const c=g(),n=c.currentTime,o=c.createOscillator(),ga=c.createGain();o.type=type;o.connect(ga);ga.connect(c.destination);o.frequency.setValueAtTime(freq,n+del);ga.gain.setValueAtTime(vol,n+del);ga.gain.exponentialRampToValueAtTime(0.001,n+del+dur);o.start(n+del);o.stop(n+del+dur)}catch(e){}};
  return useCallback((t)=>{
    if(t==="click")b(700,0.08);
    else if(t==="select"){b(523,0.12);b(659,0.12,0.08);b(784,0.15,0.16)}
    else if(t==="attack"){b(200,0.06,0,"sawtooth",0.08);b(400,0.06,0.04,"square",0.06);b(800,0.08,0.08)}
    else if(t==="hit"){b(120,0.12,0,"sawtooth",0.1);b(80,0.15,0.08,"sawtooth",0.08)}
    else if(t==="spell"){[523,784,1047,1319].forEach((f,i)=>b(f,0.1,i*0.06,"sine",0.06))}
    else if(t==="reveal"){[200,300,400,600,800,1200].forEach((f,i)=>b(f,0.12,i*0.06,"sine",0.07))}
    else if(t==="countdown"){b(440,0.12,0,"sine",0.08)}
    else if(t==="countgo"){[523,659,784,1047].forEach((f,i)=>b(f,0.15,i*0.08,"sine",0.09))}
    else if(t==="boom"){b(80,0.3,0,"sawtooth",0.12);b(60,0.4,0.1,"sawtooth",0.1);b(40,0.5,0.2,"sawtooth",0.08)}
    else if(t==="victory"){[523,659,784,1047,1319,1047,1319,1568].forEach((f,i)=>b(f,0.2,i*0.12,"sine",0.07))}
    else if(t==="achieve"){b(1047,0.1,0,"sine",0.07);b(1319,0.1,0.1,"sine",0.07);b(1568,0.15,0.2,"sine",0.07)}
    else if(t==="loot"){b(988,0.08,0,"sine",0.06);b(1319,0.12,0.06,"sine",0.06)}
    else if(t==="powerup"){[523,784,1047].forEach((f,i)=>b(f,0.1,i*0.08,"sine",0.07))}
    else if(t==="warning"){b(200,0.15,0,"sawtooth",0.06);b(150,0.2,0.15,"sawtooth",0.06)}
    else if(t==="combo"){b(784,0.08,0,"sine",0.07);b(1047,0.1,0.08,"sine",0.07)}
    else if(t==="heartbeat"){b(60,0.15,0,"sine",0.1);b(60,0.15,0.25,"sine",0.07)}
  },[])
}

// ==================== DATA ====================
const CLASSES=[
  {id:"warrior",name:"WARRIOR",icon:"⚔️",color:"#f04f78",proj:"⚔️",trail:"#f04f78",spellName:"BLADE STORM"},
  {id:"mage",name:"MAGE",icon:"🧙",color:"#b55088",proj:"🔥",trail:"#ff6030",spellName:"FIREBALL"},
  {id:"archer",name:"ARCHER",icon:"🏹",color:"#feae34",proj:"🏹",trail:"#feae34",spellName:"ARROW RAIN"},
  {id:"healer",name:"HEALER",icon:"🛡️",color:"#5fcde4",proj:"✨",trail:"#5fcde4",spellName:"HOLY LIGHT"},
  {id:"rogue",name:"ROGUE",icon:"🗡️",color:"#38b764",proj:"🗡️",trail:"#38b764",spellName:"SHADOW STRIKE"},
  {id:"berserker",name:"BERSERKER",icon:"🪓",color:"#d77643",proj:"💥",trail:"#d77643",spellName:"GROUND POUND"},
  {id:"necro",name:"NECROMANCER",icon:"💀",color:"#8855aa",proj:"💀",trail:"#8855aa",spellName:"DARK PULSE"},
];
const PV=[1,2,3,5,8,13,21];
const TEAM=[
  {id:1,name:"Du",isP:true,lv:3,cls:CLASSES[0],hat:"#f04f78",body:"#3b7dd8",skin:"#fdd"},
  {id:2,name:"Mia",isP:false,lv:5,cls:CLASSES[1],hat:"#b55088",body:"#b55088",skin:"#fed"},
  {id:3,name:"Jonas",isP:false,lv:2,cls:CLASSES[4],hat:"#38b764",body:"#257953",skin:"#edc"},
  {id:4,name:"Sara",isP:false,lv:4,cls:CLASSES[3],hat:"#5fcde4",body:"#3b7dd8",skin:"#ffe"},
  {id:5,name:"Emil",isP:false,lv:3,cls:CLASSES[2],hat:"#feae34",body:"#d77643",skin:"#fec"},
];
const CHAL=[
  {i:"🏖️",t:"IT HAR FERIE!",d:"Nøglepersonen er væk i 2 uger!"},
  {i:"🔄",t:"KRAV ÆNDRET!",d:"Kunden vil noget helt andet!"},
  {i:"📉",t:"USTABILT!",d:"API'et crasher under load!"},
  {i:"📄",t:"DOCS MANGLER!",d:"Ingen spec overhovedet!"},
  {i:"🧑‍💻",t:"SINGLE POK!",d:"Kun én forstår den kode!"},
];
const ACHIEVEMENTS=[
  {id:"first",name:"FIRST BLOOD",icon:"🩸",desc:"Første vote i sessionen"},
  {id:"risk",name:"RISK HUNTER",icon:"🔍",desc:"Spillede et risk card"},
  {id:"power",name:"POWER PLAYER",icon:"⚡",desc:"Brugte en power-up"},
  {id:"sniper",name:"ESTIMATION SNIPER",icon:"🎯",desc:"Ramte tæt på gennemsnittet"},
  {id:"team",name:"TEAM PLAYER",icon:"🤝",desc:"Alle havde lav spredning"},
  {id:"brave",name:"BRAVE SOUL",icon:"💪",desc:"Confidence 5/5"},
];

function pick(a){return a[Math.floor(Math.random()*a.length)]}
function clamp(v){let b=PV[0];for(const p of PV)if(Math.abs(p-v)<Math.abs(b-v))b=p;return b}
function gv(pv,sp=2){return TEAM.filter(m=>!m.isP).map(m=>({mid:m.id,val:clamp(Math.max(1,pv+Math.round((Math.random()-0.5)*sp*2)))}))}
function dk(h,a=40){const n=parseInt(h.replace("#",""),16);return`#${(Math.max(0,(n>>16)-a)<<16|Math.max(0,((n>>8)&0xff)-a)<<8|Math.max(0,(n&0xff)-a)).toString(16).padStart(6,"0")}`}

// ==================== LIVING SCENE ====================
function Scene({children,mc=C.acc}){
  const[t,setT]=useState(0);
  useEffect(()=>{const i=setInterval(()=>setT(v=>v+1),50);return()=>clearInterval(i)},[]);
  return <div style={{minHeight:"100vh",position:"relative",overflow:"hidden"}}>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes slideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      @keyframes pop{0%{transform:scale(0)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
      @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
      @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
      @keyframes charBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      @keyframes celebrate{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-12px) rotate(-5deg)}75%{transform:translateY(-12px) rotate(5deg)}}
      @keyframes atkLunge{0%{transform:translateY(0)}25%{transform:translateY(-16px) translateX(4px)}50%{transform:translateY(-8px)}100%{transform:translateY(0)}}
      @keyframes spellFly{0%{transform:translateY(0) scale(1);opacity:1}60%{transform:translateY(-80px) scale(1.3);opacity:0.8}100%{transform:translateY(-120px) scale(0.5);opacity:0}}
      @keyframes spellGlow{0%{transform:translate(-50%,-50%) scale(0);opacity:0.8}100%{transform:translate(-50%,-50%) scale(3);opacity:0}}
      @keyframes trailFade{0%{opacity:0.6}100%{opacity:0;transform:scale(0)}}
      @keyframes flashOut{0%{opacity:0.6}100%{opacity:0}}
      @keyframes screenShake{0%,100%{transform:translate(0)}10%{transform:translate(-5px,3px)}30%{transform:translate(5px,-3px)}50%{transform:translate(-4px,4px)}70%{transform:translate(4px,-2px)}90%{transform:translate(-2px,1px)}}
      @keyframes dmgFloat{0%{transform:translate(-50%,0) scale(0.5);opacity:0}20%{transform:translate(-50%,-20px) scale(1.2);opacity:1}100%{transform:translate(-50%,-80px) scale(0.8);opacity:0}}
      @keyframes bossIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
      @keyframes bossRage{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-6px) scale(1.05)}}
      @keyframes bossHit{0%{filter:brightness(3)}50%{transform:translateX(-4px)}100%{filter:brightness(1);transform:translateX(0)}}
      @keyframes bossDeath{0%{transform:scale(1);opacity:1}50%{transform:scale(1.3) rotate(10deg);opacity:0.5}100%{transform:scale(0) rotate(45deg);opacity:0}}
      @keyframes achieveIn{0%{transform:translate(-50%,-30px);opacity:0}100%{transform:translate(-50%,0);opacity:1}}
      @keyframes comboPop{0%{transform:scale(0)}70%{transform:scale(1.3)}100%{transform:scale(1)}}
      @keyframes comboPulse{0%,100%{transform:scale(1);text-shadow:0 0 15px #feae34}50%{transform:scale(1.1);text-shadow:0 0 25px #feae34}}
      @keyframes lootDrop{0%{transform:translateY(-40px);opacity:0}100%{transform:translateY(0);opacity:1}}
      @keyframes lootBounce{0%{transform:translateY(0)}30%{transform:translateY(-12px)}50%{transform:translateY(0)}70%{transform:translateY(-6px)}100%{transform:translateY(0)}}
      @keyframes cardFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
      @keyframes cardDrop{0%{transform:translateY(-20px);opacity:0}100%{transform:translateY(0);opacity:1}}
      @keyframes particle{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-200px) scale(0)}}
      @keyframes spellFlash{0%{opacity:0;transform:translate(-50%,-50%) scale(0.5)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
      @keyframes victoryPulse{0%,100%{text-shadow:0 0 20px #feae3466;transform:scale(1)}50%{text-shadow:0 0 40px #feae3488;transform:scale(1.05)}}
      @keyframes sunPulse{0%,100%{box-shadow:0 0 30px #ffe47744,0 0 60px #ffe47722}50%{box-shadow:0 0 40px #ffe47766,0 0 80px #ffe47733}}
    `}</style>
    {/* Sky */}
    <div style={{position:"absolute",top:0,left:0,right:0,height:"45%",background:`linear-gradient(${180+Math.sin(t*0.003)*2}deg,${C.skyL},${C.sky})`}}/>
    {/* Sun */}
    <div style={{position:"absolute",top:`${7+Math.sin(t*0.005)*2}%`,right:"10%",width:"36px",height:"36px",borderRadius:"50%",background:"#ffe477",boxShadow:`0 0 ${25+Math.sin(t*0.02)*10}px #ffe47744, 0 0 ${50+Math.sin(t*0.02)*20}px #ffe47722`}}/>
    {/* Clouds */}
    {[{l:3,tp:8,w:100,sp:0.015},{l:28,tp:4,w:70,sp:0.01},{l:58,tp:13,w:85,sp:0.013},{l:83,tp:6,w:60,sp:0.018},{l:-10,tp:16,w:90,sp:0.011}].map((c,i)=>
      <div key={i} style={{position:"absolute",left:`${(c.l+t*c.sp)%115}%`,top:`${c.tp}%`,opacity:0.45+Math.sin(t*0.008+i)*0.1}}>
        <div style={{width:`${c.w}px`,height:`${c.w*0.32}px`,background:"#fff"}}/>
        <div style={{width:`${c.w*0.5}px`,height:`${c.w*0.2}px`,background:"#fff",marginTop:`${-c.w*0.12}px`,marginLeft:`${c.w*0.18}px`}}/>
      </div>)}
    {/* Birds */}
    {[{x:15,y:10,s:0.04},{x:55,y:7,s:0.03},{x:85,y:14,s:0.025}].map((bd,i)=>
      <div key={`bd${i}`} style={{position:"absolute",left:`${(bd.x+t*bd.s)%110}%`,top:`${bd.y+Math.sin(t*0.06+i*3)*1.5}%`,fontSize:"9px",transform:`scaleX(${Math.sin(t*0.12+i)>0?1:-1})`}}>🐦</div>)}
    {/* Ground */}
    <div style={{position:"absolute",bottom:0,left:0,right:0,height:"58%",background:`linear-gradient(180deg,${C.grs},${C.grsD})`}}/>
    <div style={{position:"absolute",bottom:0,left:0,right:0,height:"8%",background:`linear-gradient(180deg,${C.drt},${C.drtD})`}}/>
    {/* Animated grass */}
    {Array.from({length:40}).map((_,i)=>
      <div key={`gr${i}`} style={{position:"absolute",bottom:`${44+Math.sin(i*1.1)*4}%`,left:`${1+i*2.5}%`,width:"3px",height:`${5+Math.sin(t*0.05+i*0.7)*2}px`,background:C.grsL,opacity:0.35,transform:`rotate(${Math.sin(t*0.04+i)*10}deg)`,transformOrigin:"bottom"}}/>)}
    {/* Flowers */}
    {[{l:"8%",b:"47%"},{l:"22%",b:"50%"},{l:"45%",b:"48%"},{l:"72%",b:"51%"},{l:"90%",b:"46%"}].map((f,i)=>
      <div key={`fl${i}`} style={{position:"absolute",left:f.l,bottom:f.b,fontSize:`${7+Math.sin(t*0.03+i)*1}px`,animation:`float ${2+i%3}s ease-in-out ${i*0.4}s infinite`}}>{["🌸","🌼","🌺","💮","🌻"][i%5]}</div>)}
    {/* Trees */}
    {[{l:"2%",b:"48%"},{l:"94%",b:"46%"},{l:"12%",b:"53%"},{l:"84%",b:"51%"}].map((tr,i)=>
      <div key={`tr${i}`} style={{position:"absolute",left:tr.l,bottom:tr.b,transform:`rotate(${Math.sin(t*0.015+i*2)*1.5}deg)`,transformOrigin:"bottom"}}>
        <div style={{width:"7px",height:"18px",background:C.drtD,margin:"0 auto"}}/>
        <div style={{width:"26px",height:"20px",background:C.grsD,marginTop:"-3px",marginLeft:"-9px"}}/>
        <div style={{width:"16px",height:"12px",background:C.grs,marginTop:"-4px",marginLeft:"-4px"}}/>
      </div>)}
    {/* Floating particles */}
    {Array.from({length:15}).map((_,i)=>
      <div key={`pt${i}`} style={{position:"absolute",left:`${(i*7+t*0.025*((i%3)+1))%105}%`,top:`${18+Math.sin(t*0.018+i*1.5)*28}%`,width:`${3+i%3*2}px`,height:`${3+i%3*2}px`,borderRadius:"50%",background:[C.gld,C.acc,C.xp,C.grnL][i%4],opacity:0.12+Math.sin(t*0.025+i)*0.08}}/>)}
    {/* Butterflies */}
    {[{x:30,y:35},{x:65,y:28}].map((bf,i)=>
      <div key={`bf${i}`} style={{position:"absolute",left:`${bf.x+Math.sin(t*0.02+i*5)*8}%`,top:`${bf.y+Math.cos(t*0.025+i*3)*5}%`,fontSize:"10px",transform:`scaleX(${Math.sin(t*0.2+i)>0?1:-1})`}}>🦋</div>)}
    {/* Mode glow */}
    <div style={{position:"absolute",top:"10%",left:"50%",transform:"translateX(-50%)",width:"50%",height:"30%",background:`radial-gradient(ellipse,${mc}${(10+Math.round(Math.sin(t*0.02)*5)).toString(16).padStart(2,"0")} 0%,transparent 70%)`,pointerEvents:"none"}}/>
    <div style={{position:"relative",zIndex:2}}>{children}</div>
  </div>
}

// ==================== PIXEL SPRITE ====================
function Sprite({m,size=1,anim,attacking,hit,idle=true}){
  const[t,setT]=useState(0);
  useEffect(()=>{if(!idle)return;const i=setInterval(()=>setT(v=>v+1),80);return()=>clearInterval(i)},[idle]);
  const s=size,w=Math.round(16*s),cl=m.cls||CLASSES[0];
  const br=idle?Math.sin(t*0.25)*s*0.4:0;
  const blink=idle&&t%35<2;
  const look=idle?Math.sin(t*0.08)>0.7?"r":Math.sin(t*0.08)<-0.7?"l":"c":"c";
  return <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",position:"relative"}}>
    {/* Attack projectile */}
    {attacking&&<div style={{position:"absolute",top:`${-15*s}px`,left:"50%",transform:"translateX(-50%)",zIndex:10,pointerEvents:"none"}}>
      <div style={{fontSize:`${8*s}px`,animation:"spellFly 0.7s ease-out forwards",filter:`drop-shadow(0 0 ${4*s}px ${cl.trail})`}}>{cl.proj}</div>
      <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:`${12*s}px`,height:`${12*s}px`,borderRadius:"50%",background:`radial-gradient(circle,${cl.trail}66,transparent)`,animation:"spellGlow 0.5s ease-out forwards"}}/>
      {Array.from({length:6}).map((_,i)=><div key={i} style={{position:"absolute",left:`${50+Math.cos(i*1.05)*15}%`,top:`${50+Math.sin(i*1.05)*15+i*5}%`,width:`${(5-i)*s}px`,height:`${(5-i)*s}px`,background:cl.trail,borderRadius:"50%",opacity:0.6-i*0.08,animation:`trailFade 0.3s ease-out ${i*0.04}s forwards`}}/>)}
    </div>}
    {/* Damage flash */}
    {hit&&<div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:C.red,opacity:0.4,animation:"flashOut 0.2s ease-out forwards",zIndex:5}}/>}
    <div style={{position:"relative",width:`${w*1.4}px`,animation:anim||"none"}}>
      {/* Shadow */}
      <div style={{position:"absolute",bottom:`${-2*s}px`,left:"50%",transform:"translateX(-50%)",width:`${w*1.4}px`,height:`${3*s}px`,background:"rgba(0,0,0,0.2)",borderRadius:"50%"}}/>
      <div style={{width:`${w}px`,margin:"0 auto"}}>
        {/* Class icon float */}
        <div style={{textAlign:"center",fontSize:`${4*s}px`,marginBottom:`${-0.5*s}px`,opacity:0.6,animation:idle?"float 2s ease-in-out infinite":"none"}}>{cl.icon}</div>
        {/* Hat */}
        <div style={{width:`${w*1.1}px`,height:`${4*s}px`,background:m.hat||cl.color,margin:"0 auto"}}/>
        <div style={{width:`${w*0.9}px`,height:`${3*s}px`,background:dk(m.hat||cl.color),margin:"-1px auto 0"}}/>
        {/* Head */}
        <div style={{width:`${w*0.8}px`,height:`${(8+br*0.15)*s}px`,background:m.skin||"#fdd",margin:"0 auto",position:"relative",transition:"height 0.2s"}}>
          {!blink&&<><div style={{position:"absolute",top:`${3*s}px`,left:`${(look==="l"?1:look==="r"?3:2)*s}px`,width:`${2*s}px`,height:`${2*s}px`,background:C.bg,transition:"left 0.2s"}}/><div style={{position:"absolute",top:`${3*s}px`,right:`${(look==="r"?1:look==="l"?3:2)*s}px`,width:`${2*s}px`,height:`${2*s}px`,background:C.bg,transition:"right 0.2s"}}/></>}
          {blink&&<div style={{position:"absolute",top:`${4*s}px`,left:`${1.5*s}px`,right:`${1.5*s}px`,height:`${s}px`,background:C.bg}}/>}
        </div>
        {/* Body */}
        <div style={{width:`${w}px`,height:`${(10+br*0.2)*s}px`,background:m.body||m.hat||cl.color,margin:"0 auto",position:"relative",transition:"height 0.2s"}}>
          <div style={{position:"absolute",right:`${-4*s}px`,top:`${2*s}px`,fontSize:`${4*s}px`,transform:`rotate(${-30+Math.sin((t||0)*0.12)*6}deg)`,opacity:0.8,transition:"transform 0.2s"}}>{cl.icon}</div>
        </div>
        {/* Legs */}
        <div style={{display:"flex",justifyContent:"center",gap:`${2*s}px`}}>
          <div style={{width:`${5*s}px`,height:`${5*s+(idle?Math.sin(t*0.18)*s*0.3:0)}px`,background:dk(m.body||m.hat||cl.color,60),transition:"height 0.2s"}}/>
          <div style={{width:`${5*s}px`,height:`${5*s-(idle?Math.sin(t*0.18)*s*0.3:0)}px`,background:dk(m.body||m.hat||cl.color,60),transition:"height 0.2s"}}/>
        </div>
      </div>
    </div>
    {/* Name */}
    <div style={{fontFamily:PF,fontSize:`${Math.max(5,2.8*s)}px`,color:C.wht,marginTop:`${2*s}px`,textShadow:`0 0 3px ${C.bg}`,background:C.bg+"cc",padding:"1px 4px"}}>{m.name}</div>
    <div style={{fontFamily:PF,fontSize:`${Math.max(4,2*s)}px`,color:C.gld,background:C.bg+"88",padding:"0 3px"}}>{cl.icon} LV{m.lv}</div>
    {m.isP&&<div style={{fontFamily:PF,fontSize:`${Math.max(3,1.8*s)}px`,color:C.acc,marginTop:"1px",animation:"pulse 1.5s infinite"}}>▼ DIG</div>}
  </div>
}

// ==================== BOSS ====================
function Boss({hp,maxHp,name,hit,defeated}){
  const pct=Math.max(0,(hp/maxHp)*100);
  const hpColor=pct>60?C.grn:pct>30?C.yel:C.red;
  return <div style={{textAlign:"center",animation:hit?"bossHit 0.3s":"none"}}>
    <div style={{fontFamily:PF,fontSize:"8px",color:C.acc,letterSpacing:"2px",marginBottom:"4px",textShadow:`0 0 8px ${C.acc}44`}}>{name}</div>
    {/* HP bar */}
    <div style={{width:"220px",margin:"0 auto",position:"relative"}}>
      <div style={{height:"14px",background:C.bg,border:`3px solid ${C.brd}`,position:"relative",overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${hpColor},${dk(hpColor,-30)})`,transition:"width 0.5s ease-out",boxShadow:`0 0 8px ${hpColor}44`}}/>
        {/* Shiny effect */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:"40%",background:"rgba(255,255,255,0.15)"}}/>
      </div>
      <div style={{fontFamily:PF,fontSize:"6px",color:hpColor,marginTop:"2px"}}>{Math.round(hp)}/{maxHp} HP</div>
    </div>
    {/* Boss sprite */}
    <div style={{fontSize:defeated?"40px":"50px",marginTop:"8px",filter:hit?"brightness(2)":"none",transition:"all 0.2s",animation:defeated?"bossDeath 1s ease-out forwards":pct<30?"bossRage 0.5s ease-in-out infinite":"bossIdle 2s ease-in-out infinite"}}>
      👾
    </div>
    {defeated&&<div style={{fontFamily:PF,fontSize:"10px",color:C.acc,marginTop:"4px",animation:"pop 0.5s"}}>DEFEATED!</div>}
  </div>
}

// ==================== DAMAGE NUMBER ====================
function DmgNum({value,color=C.acc,x=50,critical}){
  return <div style={{position:"absolute",left:`${x}%`,top:"30%",transform:"translateX(-50%)",pointerEvents:"none",zIndex:20,animation:"dmgFloat 1s ease-out forwards"}}>
    <div style={{fontFamily:PF,fontSize:critical?"18px":"13px",color,textShadow:`0 0 8px ${color}, 2px 2px 0 ${C.bg}`,fontWeight:"bold"}}>
      {critical&&"💥 "}{value}{critical&&" !"}
    </div>
  </div>
}

// ==================== ACHIEVEMENT POPUP ====================
function AchievePopup({achieve,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2500);return()=>clearTimeout(t)},[onDone]);
  return <div style={{position:"fixed",top:"12%",left:"50%",transform:"translateX(-50%)",zIndex:120,animation:"achieveIn 0.5s ease-out"}}>
    <div style={{background:`linear-gradient(135deg,${C.bgC},${C.bgL})`,border:`3px solid ${C.gld}`,boxShadow:`0 0 25px ${C.gld}44, 0 0 50px ${C.gld}22`,padding:"12px 24px",display:"flex",alignItems:"center",gap:"12px"}}>
      <span style={{fontSize:"28px",animation:"pop 0.4s"}}>{achieve.icon}</span>
      <div>
        <div style={{fontFamily:PF,fontSize:"7px",color:C.gld,letterSpacing:"2px"}}>ACHIEVEMENT!</div>
        <div style={{fontFamily:PF,fontSize:"9px",color:C.wht,marginTop:"2px"}}>{achieve.name}</div>
        <div style={{fontFamily:BF,fontSize:"14px",color:C.dim}}>{achieve.desc}</div>
      </div>
    </div>
  </div>
}

// ==================== COMBO ====================
function ComboDisplay({count}){
  if(count<2)return null;
  return <div style={{position:"fixed",top:"20%",right:"8%",zIndex:100,animation:"comboPop 0.4s ease-out"}}>
    <div style={{fontFamily:PF,fontSize:"14px",color:C.gld,textShadow:`0 0 15px ${C.gld}`,letterSpacing:"2px",animation:"comboPulse 0.8s ease-in-out infinite"}}>{count}x</div>
    <div style={{fontFamily:PF,fontSize:"7px",color:C.org,textAlign:"center"}}>COMBO!</div>
  </div>
}

// ==================== LOOT DROPS ====================
function LootDrops({items,active}){
  if(!active||!items.length)return null;
  return <div style={{display:"flex",gap:"10px",justifyContent:"center",flexWrap:"wrap",margin:"10px 0"}}>
    {items.map((item,i)=><div key={i} style={{animation:`lootDrop 0.5s ease-out ${i*0.15}s both`}}>
      <div style={{width:"48px",height:"48px",background:`linear-gradient(135deg,${C.bgL},${C.bgC})`,border:`3px solid ${item.color||C.gld}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"22px",boxShadow:`0 0 10px ${(item.color||C.gld)}44`,animation:`lootBounce 0.6s ease-out ${0.5+i*0.15}s both`}}>
        {item.icon}
      </div>
      <div style={{fontFamily:PF,fontSize:"5px",color:item.color||C.gld,textAlign:"center",marginTop:"3px"}}>{item.label}</div>
    </div>)}
  </div>
}

// ==================== FLIP CARD ====================
function FlipCard({value,member,revealed,delay=0,mc=C.acc}){
  return <div style={{perspective:"400px",width:"44px",height:"62px"}}>
    <div style={{width:"100%",height:"100%",position:"relative",transformStyle:"preserve-3d",transition:`transform 0.6s ease ${delay}s`,transform:revealed?"rotateY(180deg)":"rotateY(0)"}}>
      <div style={{position:"absolute",width:"100%",height:"100%",backfaceVisibility:"hidden",background:`repeating-linear-gradient(45deg,${mc}22,${mc}22 3px,${C.bgC} 3px,${C.bgC} 6px)`,border:`3px solid ${mc}`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 0 6px ${mc}33`}}><span style={{fontFamily:PF,fontSize:"11px",color:mc,animation:"pulse 1s infinite"}}>?</span></div>
      <div style={{position:"absolute",width:"100%",height:"100%",backfaceVisibility:"hidden",transform:"rotateY(180deg)",background:`linear-gradient(145deg,${C.bgL},${C.bgC})`,border:`3px solid ${member?.hat||C.acc}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",boxShadow:`0 3px 10px ${(member?.hat||C.acc)}44`}}><span style={{fontFamily:PF,fontSize:"12px",color:member?.hat||C.txt}}>{value}</span><span style={{fontFamily:PF,fontSize:"3px",color:C.dim}}>PTS</span></div>
    </div>
  </div>
}

// ==================== BUTTON ====================
function Btn({children,onClick,color=C.acc,disabled,large,style:s}){
  const[p,setP]=useState(false);
  return <button onClick={onClick} disabled={disabled} onMouseDown={()=>setP(true)} onMouseUp={()=>setP(false)} onMouseLeave={()=>setP(false)} style={{fontFamily:PF,fontSize:large?"10px":"8px",color:C.wht,background:disabled?C.dim:color,border:`3px solid ${disabled?C.dim:color}`,borderBottom:p?`3px solid ${color}`:`5px solid ${C.bg}`,borderRight:p?`3px solid ${color}`:`5px solid ${C.bg}`,padding:large?"12px 20px":"8px 14px",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,transform:p?"translate(2px,2px)":"none",transition:"transform 0.05s",letterSpacing:"1px",display:"inline-flex",alignItems:"center",gap:"8px",...s}}>{children}</button>
}
function Box({children,color=C.brd,glow,style:s}){return <div style={{border:`3px solid ${color}`,boxShadow:glow?`0 0 12px ${glow}`:`3px 3px 0 ${C.bg}`,background:C.bgC+"e8",...s}}>{children}</div>}

// ==================== MAIN SESSION ====================
export default function Session(){
  const sound=useSound();
  const isR=false; // toggle for roulette mode
  const mc=isR?C.yel:C.blu;
  const bossName="PROJ-142: OAuth2 Login Flow";
  const maxHp=100;

  const[step,setStep]=useState(0); // 0=vote,1=reveal,2=discuss,3=confidence,4=victory
  const[pv,setPv]=useState(null);
  const[votes,setVotes]=useState([]);
  const[rdy,setRdy]=useState(false);
  const[rev,setRev]=useState(false);
  const[cd,setCd]=useState(-1);
  const[cv,setCv]=useState(null);
  const[ac,setAc]=useState([]);
  const[bossHp,setBossHp]=useState(maxHp);
  const[bossHit,setBossHit]=useState(false);
  const[bossDead,setBossDead]=useState(false);
  const[atk,setAtk]=useState(false);
  const[npcAtk,setNpcAtk]=useState([]);
  const[npcHits,setNpcHits]=useState([]);
  const[dmgNums,setDmgNums]=useState([]);
  const[flash,setFlash]=useState(null);
  const[shake,setShake]=useState(false);
  const[combo,setCombo]=useState(0);
  const[achieves,setAchieves]=useState([]);
  const[showAchieve,setShowAchieve]=useState(null);
  const[loot,setLoot]=useState([]);
  const[showLoot,setShowLoot]=useState(false);
  const[rc,setRc]=useState([]);
  const[ll,setLl]=useState(null);
  const[llr,setLlr]=useState(null);
  const[spellName,setSpellName]=useState(null);

  function addDmg(val,x,critical=false){setDmgNums(p=>[...p,{id:Date.now()+Math.random(),val,x,critical}]);setTimeout(()=>setDmgNums(p=>p.slice(1)),1200)}
  function addAchieve(a){if(achieves.includes(a.id))return;setAchieves(p=>[...p,a.id]);setShowAchieve(a);sound("achieve")}
  function doFlash(col){setFlash(col);setTimeout(()=>setFlash(null),300)}
  function doShake(){setShake(true);setTimeout(()=>setShake(false),400)}
  function doBossHit(dmg){setBossHit(true);setBossHp(h=>Math.max(0,h-dmg));setTimeout(()=>setBossHit(false),200);sound("hit")}

  // NPC voting with staggered attacks
  useEffect(()=>{
    if(pv===null||rdy)return;
    const timer=setTimeout(()=>{
      const v=gv(pv,2);setVotes(v);setRdy(true);
      v.forEach((vote,i)=>{
        setTimeout(()=>{
          setNpcAtk(p=>[...p,vote.mid]);
          sound("spell");
          setSpellName(TEAM.find(m=>m.id===vote.mid)?.cls?.spellName||"ATTACK");
          setTimeout(()=>{setSpellName(null)},600);
          // Boss takes damage
          doBossHit(vote.val*1.5);
          addDmg(vote.val,35+i*10);
          setTimeout(()=>setNpcAtk(p=>p.filter(x=>x!==vote.mid)),500);
        },400+i*500);
      });
    },1200);
    return()=>clearTimeout(timer)
  },[pv,rdy]);

  function doVote(v){
    setPv(v);sound("attack");
    setAtk(true);
    setSpellName(TEAM[0].cls.spellName);
    setTimeout(()=>{setSpellName(null)},600);
    // Player attack
    doBossHit(v*2);
    addDmg(v,50,v>=8);
    doFlash(TEAM[0].cls.trail);
    doShake();
    setTimeout(()=>setAtk(false),500);
    setCombo(c=>c+1);
    addAchieve(ACHIEVEMENTS[0]); // FIRST BLOOD
    if(v>=8)sound("combo");
  }

  function doReveal(){
    sound("countdown");setCd(3);
    const i=setInterval(()=>{
      setCd(p=>{
        if(p<=1){
          clearInterval(i);
          setTimeout(()=>{
            setCd(-1);
            sound("countgo");
            doFlash(mc);
            doShake();
            // Kill boss
            setBossHp(0);setBossDead(true);
            setTimeout(()=>{
              sound("boom");
              doFlash(C.wht);
              doShake();
              setRev(true);setStep(1);
              // Check sniper
              const allV=[pv,...votes.map(v=>v.val)];
              const avg=allV.reduce((a,b)=>a+b,0)/allV.length;
              if(Math.abs(pv-avg)<2)addAchieve(ACHIEVEMENTS[3]);
              const spread=Math.max(...allV)-Math.min(...allV);
              if(spread<=3)addAchieve(ACHIEVEMENTS[4]);
            },800);
          },400);
          return 0;
        }
        sound("heartbeat");return p-1;
      });
    },750);
  }

  function doDisc(){setStep(2);sound("click")}
  function doCv(v){
    setCv(v);sound("select");
    if(v===5)addAchieve(ACHIEVEMENTS[5]);
    setTimeout(()=>{setAc(TEAM.filter(m=>!m.isP).map(m=>({mid:m.id,val:Math.max(1,Math.min(5,v+Math.floor(Math.random()*3)-1))})))},500);
  }
  function doFin(){
    setStep(4);sound("victory");doFlash(C.gld);
    // Generate loot
    const loots=[{icon:"💎",label:`+${45+Math.floor(Math.random()*30)} XP`,color:C.xp}];
    if(rc.length>0)loots.push({icon:"🔍",label:"Risk Badge",color:C.acc});
    if(combo>=3)loots.push({icon:"🔥",label:"Streak Bonus",color:C.org});
    if(ll)loots.push({icon:"⚡",label:"Power Badge",color:C.pur});
    loots.push({icon:"⭐",label:"Session Star",color:C.gld});
    setLoot(loots);
    setTimeout(()=>setShowLoot(true),500);
  }
  function doLL(id){
    setLl(id);sound("powerup");doFlash(C.pur);
    addAchieve(ACHIEVEMENTS[2]);
    if(id==="expert")setLlr("💬 \"Denne type tog 8 pts sidst.\"");
    else if(id==="audience"){const av=[pv,...votes.map(v=>v.val)];const d={};av.forEach(v=>{d[v]=(d[v]||0)+1});setLlr(`📊 ${Object.entries(d).map(([k,v])=>`${k}:${Math.round(v/av.length*100)}%`).join(" ")}`);}
    else if(id==="5050")setLlr("✂️ To dårlige antagelser fjernet!");
    else setLlr("🔮 Afhængighed til team på ferie!");
  }

  const allV=pv!==null?[{mid:1,val:pv},...votes]:[];
  const avg=allV.length?(allV.reduce((s,v)=>s+v.val,0)/allV.length).toFixed(1):0;
  const spread=allV.length?Math.max(...allV.map(v=>v.val))-Math.min(...allV.map(v=>v.val)):0;

  return <Scene mc={mc}>
    {/* Flash overlay */}
    {flash&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:flash,opacity:0.5,pointerEvents:"none",zIndex:200,animation:"flashOut 0.3s ease-out forwards"}}/>}
    {/* Countdown */}
    {cd>=0&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:`rgba(0,0,0,${cd>0?0.7:0.9})`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:150}}>
      <div style={{fontFamily:PF,fontSize:cd>0?"80px":"60px",color:cd>0?C.acc:C.grn,textShadow:`0 0 50px ${cd>0?C.acc:C.grn}`,animation:"pop 0.4s"}}>{cd>0?cd:"⚔️ REVEAL!"}</div>
      {cd>0&&<div style={{fontFamily:PF,fontSize:"8px",color:C.dim,marginTop:"16px",animation:"pulse 0.75s infinite"}}>ALLE KORT VENDES...</div>}
    </div>}
    {/* Achievement */}
    {showAchieve&&<AchievePopup achieve={showAchieve} onDone={()=>setShowAchieve(null)}/>}
    {/* Combo */}
    <ComboDisplay count={combo}/>
    {/* Spell name flash */}
    {spellName&&<div style={{position:"fixed",top:"40%",left:"50%",transform:"translate(-50%,-50%)",zIndex:100,pointerEvents:"none",animation:"spellFlash 0.6s ease-out forwards"}}><div style={{fontFamily:PF,fontSize:"14px",color:C.wht,textShadow:`0 0 20px ${C.wht}, 0 0 40px ${mc}`,letterSpacing:"3px"}}>{spellName}!</div></div>}

    <div style={{animation:shake?"screenShake 0.4s":"none"}}>
      <div style={{padding:"10px 14px"}}>
        {/* Top bar */}
        <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"8px"}}>
          <div style={{fontFamily:PF,fontSize:"6px",padding:"3px 6px",background:mc,color:C.bg}}>{isR?"🎰 ROULETTE":"🃏 POKER"}</div>
          <div style={{fontFamily:PF,fontSize:"5px",color:mc}}>{bossName}</div>
          <div style={{flex:1}}/>
          <div style={{fontFamily:PF,fontSize:"5px",color:C.org,marginRight:"4px"}}>🔥{combo}</div>
          {["ESTIMÉR","REVEAL","DISK.","CONF.","VICTORY"].map((s,i)=><div key={i} style={{height:"9px",padding:"0 3px",background:i<step?C.grn:i===step?C.acc:C.bgL,fontFamily:PF,fontSize:"4px",color:C.wht,display:"flex",alignItems:"center"}}>{i===step?s:i<step?"✓":""}</div>)}
        </div>

        {/* BOSS */}
        <div style={{position:"relative",marginBottom:"8px"}}>
          <Boss hp={bossHp} maxHp={maxHp} name="👾 SPRINT BOSS" hit={bossHit} defeated={bossDead}/>
          {/* Damage numbers */}
          {dmgNums.map(d=><DmgNum key={d.id} value={d.val} x={d.x} critical={d.critical} color={d.critical?C.gld:C.acc}/>)}
        </div>

        {/* Characters */}
        <div style={{display:"flex",justifyContent:"center",alignItems:"flex-end",gap:"14px",marginBottom:"10px",minHeight:"130px"}}>
          {TEAM.map((m,i)=>{
            const hasV=m.isP?pv!==null:votes.some(v=>v.mid===m.id);
            const vv=m.isP?pv:votes.find(v=>v.mid===m.id)?.val;
            const isAtk=m.isP?atk:npcAtk.includes(m.id);
            const isHit=npcHits.includes(m.id);
            const isVic=step===4;
            const anim=isVic?"celebrate 0.4s ease-in-out infinite":isAtk?"atkLunge 0.4s ease-out":hasV&&!rev?"charBounce 0.8s ease-in-out infinite":"none";
            return <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
              {hasV&&<div style={{marginBottom:"4px",animation:"cardDrop 0.4s ease-out"}}><FlipCard value={vv} member={m} revealed={rev} delay={i*0.12} mc={mc}/></div>}
              {!hasV&&<div style={{height:"66px",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
                {!m.isP&&<div style={{fontFamily:PF,fontSize:"6px",color:m.hat||C.dim,animation:"pulse 1s infinite"}}>💭</div>}</div>}
              <Sprite m={m} size={1.7} anim={anim} attacking={isAtk} hit={isHit}/>
            </div>
          })}
        </div>

        {/* Game UI */}
        <div style={{maxWidth:"660px",margin:"0 auto"}}>
          {/* STEP 0: Vote */}
          {step===0&&<div style={{animation:"slideUp 0.3s",textAlign:"center"}}>
            <div style={{fontFamily:PF,fontSize:"6px",color:C.dim,letterSpacing:"2px",marginBottom:"8px"}}>
              {pv===null?"◈ VÆLG DIT KORT FOR AT ANGRIBE ◈":rdy?"◈ ALLE HAR ANGREBET! ◈":"◈ PARTY ANGRIBER... ◈"}
            </div>
            <div style={{display:"flex",gap:"6px",justifyContent:"center",flexWrap:"wrap",marginBottom:"14px"}}>
              {PV.map((v,vi)=><div key={v} onClick={()=>{if(pv===null)doVote(v)}} style={{width:"56px",height:"78px",background:`linear-gradient(145deg,${C.bgL},${C.bgC})`,border:`3px solid ${pv===v?mc:C.brd}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:pv===null?"pointer":"default",opacity:pv!==null&&pv!==v?0.1:1,transform:pv===v?"scale(1.15) translateY(-10px)":"scale(1)",transition:"all 0.15s",boxShadow:pv===v?`0 4px 16px ${mc}66`:`3px 3px 0 ${C.bg}`,animation:pv===null?`cardFloat 2.5s ease-in-out ${vi*0.12}s infinite`:"none",position:"relative"}}>
                <div style={{position:"absolute",top:"2px",left:"4px",fontFamily:PF,fontSize:"5px",color:pv===v?mc:C.dim}}>{v}</div>
                <div style={{fontFamily:PF,fontSize:"18px",color:pv===v?mc:C.txt,textShadow:pv===v?`0 0 8px ${mc}`:"none"}}>{v}</div>
                <div style={{fontFamily:PF,fontSize:"4px",color:C.dim}}>DMG</div>
              </div>)}
            </div>
            {rdy&&<Btn large color={C.acc} onClick={doReveal} style={{fontSize:"11px",animation:"pulse 0.8s infinite"}}>⚔️ REVEAL ATTACK!</Btn>}
          </div>}

          {/* STEP 1: Reveal */}
          {step===1&&<div style={{animation:"slideUp 0.3s",textAlign:"center"}}>
            <div style={{fontFamily:PF,fontSize:"7px",color:C.grn,marginBottom:"10px",textShadow:`0 0 6px ${C.grn}44`}}>👾 BOSS DEFEATED!</div>
            <div style={{display:"flex",gap:"8px",justifyContent:"center",marginBottom:"12px"}}>
              <Box glow={C.blu+"33"} style={{padding:"10px",minWidth:"70px"}}><div style={{fontFamily:PF,fontSize:"4px",color:C.dim}}>SNIT</div><div style={{fontFamily:PF,fontSize:"18px",color:C.blu,textShadow:`0 0 6px ${C.blu}44`}}>{avg}</div></Box>
              <Box glow={(spread>5?C.acc:C.grn)+"33"} style={{padding:"10px",minWidth:"70px"}}><div style={{fontFamily:PF,fontSize:"4px",color:C.dim}}>SPREAD</div><div style={{fontFamily:PF,fontSize:"18px",color:spread>5?C.acc:C.grn}}>{spread}</div></Box>
              <Box style={{padding:"10px",minWidth:"70px"}}><div style={{fontFamily:PF,fontSize:"4px",color:C.dim}}>STATUS</div><div style={{fontFamily:PF,fontSize:"9px",color:spread>5?C.acc:spread>2?C.yel:C.grn}}>{spread>5?"⚠️ HØJ":spread>2?"MEDIUM":"✓ ALIGN"}</div></Box>
            </div>
            <Btn large color={C.blu} onClick={doDisc}>💬 DISKUSSION & POWER-UPS</Btn>
          </div>}

          {/* STEP 2: Discussion */}
          {step===2&&<div style={{animation:"slideUp 0.3s",textAlign:"center"}}>
            {spread>3&&<Box color={C.yel} glow={C.yel+"33"} style={{padding:"7px",marginBottom:"8px"}}><div style={{fontFamily:PF,fontSize:"6px",color:C.yel}}>⚠️ UENIGHED — {spread} PTS!</div></Box>}
            <div style={{fontFamily:PF,fontSize:"5px",color:C.dim,marginBottom:"5px"}}>RISK CARDS</div>
            <div style={{display:"flex",gap:"4px",justifyContent:"center",flexWrap:"wrap",marginBottom:"10px"}}>
              {["🔥 Dependency","🧱 Legacy","🕳️ Unknown","🧑‍💻 Single PoK"].map(c=>
                <div key={c} onClick={()=>{if(!rc.includes(c)){setRc([...rc,c]);sound("click");addAchieve(ACHIEVEMENTS[1])}}} style={{fontFamily:PF,fontSize:"5px",padding:"5px 8px",cursor:"pointer",background:rc.includes(c)?C.acc:C.bgL+"dd",color:rc.includes(c)?C.wht:C.txt,border:`2px solid ${rc.includes(c)?C.acc:C.brd}`,animation:rc.includes(c)?"pop 0.3s":"none"}}>{c}</div>)}
            </div>
            <div style={{fontFamily:PF,fontSize:"5px",color:C.dim,marginBottom:"6px"}}>POWER-UPS</div>
            <div style={{display:"flex",gap:"10px",justifyContent:"center",marginBottom:"10px"}}>
              {[{id:"expert",i:"📞",n:"Expert"},{id:"audience",i:"📊",n:"Audience"},{id:"5050",i:"✂️",n:"Cut"},{id:"oracle",i:"🔮",n:"Oracle"}].map(l=>
                <div key={l.id} onClick={()=>{if(!ll)doLL(l.id)}} style={{textAlign:"center",cursor:ll?"default":"pointer",opacity:ll&&ll!==l.id?0.15:1,transform:ll===l.id?"scale(1.2)":"scale(1)",transition:"all 0.2s"}}>
                  <div style={{width:"38px",height:"38px",margin:"0 auto",borderRadius:"50%",background:ll===l.id?C.pur:C.bgL+"dd",border:`3px solid ${ll===l.id?C.pur:C.brd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",boxShadow:ll===l.id?`0 0 12px ${C.pur}66`:"none",animation:!ll?"float 2s ease-in-out infinite":"none"}}>{l.i}</div>
                  <div style={{fontFamily:PF,fontSize:"4px",color:ll===l.id?C.pur:C.dim,marginTop:"2px"}}>{l.n}</div>
                </div>)}
            </div>
            {llr&&<Box color={C.pur} glow={C.pur+"22"} style={{padding:"8px",marginBottom:"8px"}}><div style={{fontFamily:BF,fontSize:"14px",color:C.txt}}>{llr}</div></Box>}
            <Btn large color={C.grn} onClick={()=>{setStep(3);sound("click")}}>✅ CONFIDENCE VOTE</Btn>
          </div>}

          {/* STEP 3: Confidence */}
          {step===3&&<div style={{animation:"slideUp 0.3s",textAlign:"center"}}>
            <div style={{fontFamily:PF,fontSize:"6px",color:C.dim,marginBottom:"8px"}}>◈ HVOR SIKKER ER DU? ◈</div>
            <div style={{display:"flex",gap:"8px",justifyContent:"center",marginBottom:"14px"}}>
              {[1,2,3,4,5].map(v=>{const cols=[C.red,C.org,C.yel,C.grnL,C.grn];const em=["😰","😐","🤔","😊","💪"];
                return <div key={v} onClick={()=>{if(cv===null)doCv(v)}} style={{textAlign:"center",cursor:cv===null?"pointer":"default",opacity:cv!==null&&cv!==v?0.1:1,transform:cv===v?"scale(1.25)":"scale(1)",transition:"all 0.2s"}}>
                  <div style={{width:"42px",height:"42px",margin:"0 auto",borderRadius:"50%",background:cv===v?cols[v-1]:C.bgL+"dd",border:`3px solid ${cv===v?cols[v-1]:C.brd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",boxShadow:cv===v?`0 0 14px ${cols[v-1]}66`:"none",animation:cv===null?`float 2s ease-in-out ${v*0.15}s infinite`:"none"}}>{em[v-1]}</div>
                  <div style={{fontFamily:PF,fontSize:"4px",color:cv===v?cols[v-1]:C.dim,marginTop:"2px"}}>{["USIKKER","LIDT","OK","SIKKER","100%"][v-1]}</div>
                </div>})}
            </div>
            {ac.length>0&&<>
              <Box style={{padding:"10px",maxWidth:"320px",margin:"0 auto 10px"}}>
                <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>{[{mid:1,val:cv},...ac].map((c,i)=>{const m=TEAM.find(x=>x.id===c.mid);const cols=[C.red,C.org,C.yel,C.grnL,C.grn];
                  return <div key={i} style={{textAlign:"center"}}><Sprite m={m} size={0.8} idle={false}/><div style={{fontFamily:PF,fontSize:"7px",color:cols[c.val-1]}}>{c.val}</div></div>})}</div>
              </Box>
              <Btn large color={C.acc} onClick={doFin}>🏆 VICTORY!</Btn>
            </>}
          </div>}

          {/* STEP 4: Victory */}
          {step===4&&<div style={{animation:"slideUp 0.3s",textAlign:"center"}}>
            <div style={{fontFamily:PF,fontSize:"16px",color:C.gld,marginBottom:"10px",textShadow:`0 0 25px ${C.gld}66`,letterSpacing:"4px",animation:"victoryPulse 1s ease-in-out infinite"}}>★ VICTORY ★</div>
            <div style={{display:"flex",gap:"8px",justifyContent:"center",marginBottom:"10px"}}>
              <Box color={C.grn} glow={C.grn+"33"} style={{padding:"10px"}}><div style={{fontFamily:PF,fontSize:"4px",color:C.dim}}>ESTIMAT</div><div style={{fontFamily:PF,fontSize:"22px",color:C.grn}}>{clamp(Math.round(allV.reduce((s,v)=>s+v.val,0)/allV.length))}</div></Box>
              <Box style={{padding:"10px"}}><div style={{fontFamily:PF,fontSize:"4px",color:C.dim}}>CONFIDENCE</div><div style={{fontSize:"22px"}}>{["😰","😐","🤔","😊","💪"][(cv||1)-1]}</div></Box>
              <Box style={{padding:"10px"}}><div style={{fontFamily:PF,fontSize:"4px",color:C.dim}}>COMBO</div><div style={{fontFamily:PF,fontSize:"22px",color:C.org}}>{combo}x</div></Box>
            </div>
            {/* Loot */}
            <div style={{fontFamily:PF,fontSize:"6px",color:C.gld,marginBottom:"6px",animation:"pop 0.5s 0.3s both"}}>◈ LOOT DROPS ◈</div>
            <LootDrops items={loot} active={showLoot}/>
            {/* XP */}
            <Box color={C.xp} glow={C.xp+"33"} style={{padding:"10px",maxWidth:"300px",margin:"10px auto"}}>
              <div style={{fontFamily:PF,fontSize:"7px",color:C.xp}}>⭐ +{45+combo*5} XP</div>
              <div style={{display:"flex",alignItems:"center",gap:"5px",marginTop:"4px"}}><span style={{fontFamily:PF,fontSize:"5px",color:C.gld}}>LV3</span><div style={{flex:1,height:"7px",background:C.bg,border:`2px solid ${C.brd}`}}><div style={{height:"100%",width:"72%",background:`linear-gradient(90deg,${C.xp},${C.bluL})`,transition:"width 2s",boxShadow:`0 0 6px ${C.xp}44`}}/></div></div>
            </Box>
            {/* Achievements earned */}
            {achieves.length>0&&<div style={{marginTop:"8px"}}><div style={{fontFamily:PF,fontSize:"5px",color:C.gld,marginBottom:"4px"}}>ACHIEVEMENTS</div>
              <div style={{display:"flex",gap:"6px",justifyContent:"center",flexWrap:"wrap"}}>{achieves.map(id=>{const a=ACHIEVEMENTS.find(x=>x.id===id);return a?<div key={id} style={{padding:"4px 8px",background:C.bgL,border:`2px solid ${C.gld}`,display:"flex",alignItems:"center",gap:"4px"}}><span style={{fontSize:"12px"}}>{a.icon}</span><span style={{fontFamily:PF,fontSize:"4px",color:C.gld}}>{a.name}</span></div>:null})}</div>
            </div>}
          </div>}
        </div>
      </div>
    </div>
  </Scene>
}
