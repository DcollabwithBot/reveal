export const PF = "'Press Start 2P',monospace";
export const BF = "'VT323',monospace";

export const C = {
  bg:"#0e1019", bgC:"#171b2d", bgL:"#222842",
  acc:"#f04f78", accD:"#b83058", blu:"#3b7dd8", bluL:"#5fcde4",
  grn:"#38b764", grnD:"#257953", grnL:"#6abe30",
  yel:"#feae34", yelD:"#d77643", pur:"#b55088", purD:"#7a3060",
  org:"#d77643", red:"#e04040", wht:"#f4f4f4",
  txt:"#c8c8c8", dim:"#555570", gld:"#feae34", xp:"#5fcde4", brd:"#2a2e48",
  sky:"#4a78c8", skyL:"#6a98e0", grs:"#38b764", grsD:"#257953", grsL:"#6abe30",
  drt:"#d77643", drtD:"#a0522d", wat:"#3068b0", watL:"#5090d0"
};

export const CLASSES = [
  {id:"warrior",  name:"WARRIOR",     icon:"⚔️",  color:"#f04f78", proj:"⚔️",  trail:"#f04f78", spellName:"BLADE STORM"},
  {id:"mage",     name:"MAGE",        icon:"🧙",  color:"#b55088", proj:"🔥",  trail:"#ff6030", spellName:"FIREBALL"},
  {id:"archer",   name:"ARCHER",      icon:"🏹",  color:"#feae34", proj:"🏹",  trail:"#feae34", spellName:"ARROW RAIN"},
  {id:"healer",   name:"HEALER",      icon:"🛡️",  color:"#5fcde4", proj:"✨",  trail:"#5fcde4", spellName:"HOLY LIGHT"},
  {id:"rogue",    name:"ROGUE",       icon:"🗡️",  color:"#38b764", proj:"🗡️",  trail:"#38b764", spellName:"SHADOW STRIKE"},
  {id:"berserker",name:"BERSERKER",   icon:"🪓",  color:"#d77643", proj:"💥",  trail:"#d77643", spellName:"GROUND POUND"},
  {id:"necro",    name:"NECROMANCER", icon:"💀",  color:"#8855aa", proj:"💀",  trail:"#8855aa", spellName:"DARK PULSE"},
];

export const NPC_TEAM = [
  {id:2, name:"Mia",   lv:5, cls:CLASSES[1], hat:"#b55088", body:"#b55088", skin:"#fed"},
  {id:3, name:"Jonas", lv:2, cls:CLASSES[4], hat:"#38b764", body:"#257953", skin:"#edc"},
  {id:4, name:"Sara",  lv:4, cls:CLASSES[3], hat:"#5fcde4", body:"#3b7dd8", skin:"#ffe"},
  {id:5, name:"Emil",  lv:3, cls:CLASSES[2], hat:"#feae34", body:"#d77643", skin:"#fec"},
];

export const HELMETS = [
  {id:"h0", name:"Ingen",      icon:"·",  color:"#555570", pv:null},
  {id:"h1", name:"Iron Helm",  icon:"🪖", color:"#8899aa", pv:"#8899aa"},
  {id:"h2", name:"Gold Crown", icon:"👑", color:"#feae34", pv:"#feae34"},
  {id:"h3", name:"Mage Hood",  icon:"🧙", color:"#b55088", pv:"#b55088"},
  {id:"h4", name:"Shadow Cowl",icon:"🦇", color:"#444",    pv:"#444"},
  {id:"h5", name:"Fire Helm",  icon:"🔥", color:"#d77643", pv:"#d77643"},
  {id:"h6", name:"Frost Crown",icon:"❄️", color:"#5fcde4", pv:"#5fcde4"},
];

export const ARMORS = [
  {id:"a0", name:"Ingen",       icon:"·",  color:"#555570", pv:null},
  {id:"a1", name:"Iron Plate",  icon:"🛡️", color:"#7788aa", pv:"#7788aa"},
  {id:"a2", name:"Gold Mail",   icon:"✨", color:"#feae34", pv:"#c8a840"},
  {id:"a3", name:"Shadow Cloak",icon:"🌑", color:"#333",    pv:"#333344"},
  {id:"a4", name:"Fire Robe",   icon:"🔥", color:"#e04040", pv:"#cc3030"},
  {id:"a5", name:"Frost Armor", icon:"❄️", color:"#5fcde4", pv:"#4090c0"},
  {id:"a6", name:"Nature Mail", icon:"🌿", color:"#38b764", pv:"#308050"},
];

export const BOOTS = [
  {id:"b0", name:"Ingen",       icon:"·",  color:"#555570", pv:null},
  {id:"b1", name:"Iron Boots",  icon:"🥾", color:"#666",    pv:"#555"},
  {id:"b2", name:"Speed Shoes", icon:"👟", color:"#38b764", pv:"#257953"},
  {id:"b3", name:"Shadow Steps",icon:"🦶", color:"#333",    pv:"#333"},
  {id:"b4", name:"Fire Treads", icon:"🔥", color:"#d77643", pv:"#994020"},
  {id:"b5", name:"Frost Walk",  icon:"❄️", color:"#5fcde4", pv:"#3070a0"},
];

export const WEAPONS = [
  {id:"w0", name:"Bare Hands",  icon:"✊", color:"#555570", pv:null},
  {id:"w1", name:"Iron Sword",  icon:"⚔️", color:"#8899aa", pv:"⚔️"},
  {id:"w2", name:"Fire Staff",  icon:"🔥", color:"#e04040", pv:"🔥"},
  {id:"w3", name:"Shadow Blade",icon:"🗡️", color:"#38b764", pv:"🗡️"},
  {id:"w4", name:"Holy Mace",   icon:"🔨", color:"#5fcde4", pv:"🔨"},
  {id:"w5", name:"Bone Wand",   icon:"💀", color:"#b55088", pv:"💀"},
  {id:"w6", name:"Great Axe",   icon:"🪓", color:"#d77643", pv:"🪓"},
  {id:"w7", name:"Hunter Bow",  icon:"🏹", color:"#feae34", pv:"🏹"},
];

export const AMULETS = [
  {id:"m0", name:"Ingen",       icon:"·",  color:"#555570", glow:null},
  {id:"m1", name:"Ruby",        icon:"❤️", color:"#e04040", glow:"#e04040"},
  {id:"m2", name:"Sapphire",    icon:"💎", color:"#3b7dd8", glow:"#3b7dd8"},
  {id:"m3", name:"Emerald",     icon:"💚", color:"#38b764", glow:"#38b764"},
  {id:"m4", name:"Gold Medal",  icon:"🏅", color:"#feae34", glow:"#feae34"},
  {id:"m5", name:"Dark Crystal",icon:"🔮", color:"#b55088", glow:"#b55088"},
  {id:"m6", name:"Star Frag",   icon:"⭐", color:"#feae34", glow:"#feae34"},
];

export const SKINS = ["#fdd","#fed","#edc","#ffe","#fec","#dbc","#c9a","#fca","#b97","#864"];

// Worlds for WorldSelect (demo data, real data comes from props in production)
export const WORLDS = [
  {id:"w1", name:"Platform Team", sprint:"Sprint 14", icon:"⚔️", color:"#38b764", prog:5, tot:12, lv:"WORLD 1", boss:"👾",
    sky:"#6a98e0", grs:"#38b764", drt:"#d77643",
    nodes:[
      {id:0,x:120,y:360,c:"#44bb66",i:"🏠",l:"START",dn:true,tp:"s"},
      {id:1,x:200,y:300,c:"#4488dd",i:"🃏",l:"Poker I",dn:true,tp:"p"},
      {id:2,x:310,y:270,c:"#4488dd",i:"🃏",l:"Poker II",dn:true,tp:"p"},
      {id:3,x:400,y:220,c:"#dd4444",i:"🎰",l:"Roulette",dn:true,tp:"r"},
      {id:4,x:340,y:155,c:"#ff8844",i:"🔍",l:"Risk Hunt",dn:true,tp:"q"},
      {id:5,x:460,y:148,c:"#44bb66",i:"⛳",l:"Checkpoint",dn:true,tp:"c"},
      {id:6,x:560,y:198,c:"#4488dd",i:"🃏",l:"Poker III",cur:true,tp:"p"},
      {id:7,x:650,y:258,c:"#dd4444",i:"🎰",l:"Roulette II",tp:"r"},
      {id:8,x:580,y:318,c:"#ff8844",i:"⚡",l:"Quick Est.",tp:"q"},
      {id:9,x:700,y:178,c:"#ff8844",i:"🤝",l:"Help Team",tp:"q"},
      {id:10,x:780,y:238,c:"#4488dd",i:"🃏",l:"Poker IV",tp:"p"},
      {id:11,x:870,y:178,c:"#aa44cc",i:"👾",l:"SPRINT BOSS",tp:"b"},
    ],
    paths:[[0,1],[1,2],[2,3],[3,4],[3,5],[5,6],[6,7],[6,8],[7,9],[7,10],[10,11]]},
  {id:"w2", name:"Kunde X", sprint:"Scope Workshop", icon:"🏰", color:"#feae34", prog:2, tot:8, lv:"WORLD 2", boss:"🐉",
    sky:"#e0c888", grs:"#f0d888", drt:"#a08050",
    nodes:[
      {id:0,x:120,y:360,c:"#44bb66",i:"🏠",l:"START",dn:true,tp:"s"},
      {id:1,x:220,y:290,c:"#4488dd",i:"🃏",l:"Poker I",dn:true,tp:"p"},
      {id:2,x:350,y:250,c:"#4488dd",i:"🃏",l:"Poker II",cur:true,tp:"p"},
      {id:3,x:480,y:210,c:"#dd4444",i:"🎰",l:"Roulette",tp:"r"},
      {id:4,x:600,y:250,c:"#ff8844",i:"🔍",l:"Risk Hunt",tp:"q"},
      {id:5,x:700,y:190,c:"#44bb66",i:"⛳",l:"Checkpoint",tp:"c"},
      {id:6,x:800,y:230,c:"#4488dd",i:"🃏",l:"Poker III",tp:"p"},
      {id:7,x:870,y:178,c:"#aa44cc",i:"🐉",l:"BOSS: Dragon",tp:"b"},
    ],
    paths:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]]},
  {id:"w3", name:"Infra Team", sprint:"Q2 Budget", icon:"🗼", color:"#5fcde4", prog:0, tot:6, lv:"WORLD 3", boss:"💀",
    sky:"#8ab0d8", grs:"#d8e8f8", drt:"#8898a8",
    nodes:[
      {id:0,x:120,y:360,c:"#44bb66",i:"🏠",l:"START",cur:true,tp:"s"},
      {id:1,x:250,y:300,c:"#4488dd",i:"🃏",l:"Poker I",tp:"p"},
      {id:2,x:380,y:240,c:"#dd4444",i:"🎰",l:"Roulette",tp:"r"},
      {id:3,x:500,y:200,c:"#ff8844",i:"🔍",l:"Risk Hunt",tp:"q"},
      {id:4,x:650,y:220,c:"#4488dd",i:"🃏",l:"Poker II",tp:"p"},
      {id:5,x:870,y:178,c:"#aa44cc",i:"💀",l:"BOSS: Skeleton",tp:"b"},
    ],
    paths:[[0,1],[1,2],[2,3],[3,4],[4,5]]},
];
