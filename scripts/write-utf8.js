/**
 * Generate pure-ASCII client files (encoding-safe on all systems).
 * HTML: numeric entities for Japanese
 * JS:   \\u escapes only
 * Run: node scripts/write-utf8.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../client");
const VER = Date.now();

const T = {
    appTitle: "\u4e94\u6559\u79d1\u30d0\u30c8\u30eb",
    subtitle: "\u4e94\u6559\u79d1\u306e\u504f\u5dee\u5024\u3067\u6226\u3046\u30aa\u30f3\u30e9\u30a4\u30f3\u5bfe\u6226",
    playerName: "\u30d7\u30ec\u30a4\u30e4\u30fc\u540d",
    playerNamePh: "\u540d\u524d\u3092\u5165\u529b",
    deviation: "\u504f\u5dee\u5024",
    jp: "\u56fd\u8a9e",
    math: "\u6570\u5b66",
    eng: "\u82f1\u8a9e",
    sci: "\u7406\u79d1",
    soc: "\u793e\u4f1a",
    createChar: "\u30ad\u30e3\u30e9\u30af\u30bf\u30fc\u4f5c\u6210",
    status: "\u30b9\u30c6\u30fc\u30bf\u30b9",
    noChar: "\u307e\u3060\u30ad\u30e3\u30e9\u30af\u30bf\u30fc\u304c\u4f5c\u6210\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002",
    studyTimer: "\u52c9\u5f37\u30bf\u30a4\u30de\u30fc",
    studyDesc: "\u52c9\u5f37\u6642\u9593\u304c\u9577\u3044\u307b\u3069\u7d4c\u9a13\u5024\u304c\u5897\u3048\u307e\u3059\u3002\u5f37\u5316\u79d1\u76ee\u306b\u5fdc\u3058\u3066\u504f\u5dee\u5024\u304c\u308f\u305a\u304b\u306b\u4e0a\u6607\u3057\u307e\u3059\u3002",
    studyFocus: "\u5f37\u5316\u3059\u308b\u79d1\u76ee",
    studyStart: "\u52c9\u5f37\u958b\u59cb",
    studyStop: "\u52c9\u5f37\u7d42\u4e86",
    xp: "\u7d4c\u9a13\u5024",
    online: "\u30aa\u30f3\u30e9\u30a4\u30f3\u5bfe\u6226",
    createRoom: "\u30eb\u30fc\u30e0\u4f5c\u6210",
    roomCode: "\u30eb\u30fc\u30e0\u30b3\u30fc\u30c9",
    roomPh: "6\u6587\u5b57\u306e\u30b3\u30fc\u30c9",
    joinRoom: "\u30eb\u30fc\u30e0\u53c2\u52a0",
    deletePlayer: "\u30d7\u30ec\u30a4\u30e4\u30fc\u524a\u9664",
    hpDef: "\u56fd\u8a9e\uff08HP\u30fb\u9632\u5fa1\uff09",
    mathAtk: "\u6570\u5b66\uff08\u653b\u6483\u30fb\u901f\u3055\uff09",
    engSp: "\u82f1\u8a9e\uff08\u7279\u6b8a\u30fb\u901f\u3055\uff09",
    sciAtk: "\u7406\u79d1\uff08\u653b\u6483\u30fb\u7279\u6b8a\uff09",
    socHp: "\u793e\u4f1a\uff08HP\u30fb\u9632\u5fa1\uff09",
    battle: "\u30d0\u30c8\u30eb",
    you: "\u3042\u306a\u305f",
    enemy: "\u76f8\u624b",
    loading: "\u8aad\u8fbc\u4e2d...",
    atk: "\u653b\u6483",
    sp: "\u7279\u6b8a",
    def: "\u9632\u5fa1",
    speed: "\u901f\u3055",
    attack: "\u653b\u6483",
    special: "\u7279\u6b8a",
    guard: "\u9632\u5fa1",
    ultimate: "\u5fc5\u6bba\u6280",
    ultimateGauge: "\u5fc5\u6bba\u6280\u30b2\u30fc\u30b8",
    battleStart: "\u6226\u95d8\u958b\u59cb\uff01",
    retry: "\u3082\u3046\u4e00\u5ea6",
    home: "\u30db\u30fc\u30e0\u3078",
    win: "YOU WIN",
    lose: "YOU LOSE",
    unnamed: "\u7121\u540d",
    playerNameLabel: "\u30d7\u30ec\u30a4\u30e4\u30fc\u540d\uff1a",
    level: "\u30ec\u30d9\u30eb",
    totalStudy: "\u7d2f\u8a08\u52c9\u5f37\u6642\u9593\uff1a",
    xpNext: "\u6b21\u307e\u3067",
    needChar: "\u5148\u306b\u30ad\u30e3\u30e9\u30af\u30bf\u30fc\u3092\u4f5c\u6210\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
    studyTooShort: "5\u79d2\u672a\u6e80\u306e\u52c9\u5f37\u3067\u306f\u5831\u916c\u306f\u3082\u3089\u3048\u307e\u305b\u3093\u3002",
    studyDone: "\u52c9\u5f37\u5b8c\u4e86\uff01",
    time: "\u6642\u9593",
    deviationUp: "\u504f\u5dee\u5024",
    slightUp: "\uff08\u304b\u306a\u308a\u5c11\u3057\uff09",
    roomCreated: "\u30eb\u30fc\u30e0\u3092\u4f5c\u6210\u3057\u307e\u3057\u305f\uff01",
    roomCodeMsg: "\u30eb\u30fc\u30e0\u30b3\u30fc\u30c9",
    tellFriend: "\u53cb\u9054\u306b\u4f1d\u3048\u3066\u304f\u3060\u3055\u3044\u3002",
    roomNotFound: "\u30eb\u30fc\u30e0\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002",
    matched: "\u30de\u30c3\u30c1\u30f3\u30b0\u3057\u307e\u3057\u305f\uff01",
    deleteConfirm: "\u30d7\u30ec\u30a4\u30e4\u30fc\u30c7\u30fc\u30bf\u3092\u524a\u9664\u3057\u307e\u3059\u304b\uff1f",
    deleted: "\u30d7\u30ec\u30a4\u30e4\u30fc\u30c7\u30fc\u30bf\u3092\u524a\u9664\u3057\u307e\u3057\u305f\u3002",
    noBattleData: "\u5bfe\u6226\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093\u3002",
    battleBegin: "\u30d0\u30c8\u30eb\u958b\u59cb\uff01",
    victory: "\u52dd\u5229\uff01",
    defeat: "\u6557\u5317...",
    connecting: "\u63a5\u7d9a\u4e2d...",
    battleEnd: "\u30d0\u30c8\u30eb\u7d42\u4e86",
    yourTurn: "\u3042\u306a\u305f\u306e\u30bf\u30fc\u30f3",
    enemyTurn: "\u76f8\u624b\u306e\u30bf\u30fc\u30f3",
    reconnected: "\u30b5\u30fc\u30d0\u30fc\u306b\u518d\u63a5\u7d9a\u3057\u307e\u3057\u305f\u3002",
    battleAlreadyEnd: "\u3053\u306e\u30d0\u30c8\u30eb\u306f\u65e2\u306b\u7d42\u4e86\u3057\u3066\u3044\u307e\u3059\u3002",
    rejoinFailed: "\u30d0\u30c8\u30eb\u3078\u306e\u518d\u63a5\u7d9a\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u30ed\u30d3\u30fc\u306b\u623b\u308a\u307e\u3059\u3002",
    attackAction: "\u306e\u653b\u6483\uff01",
    specialAction: "\u306e\u7279\u6b8a\u653b\u6483\uff01",
    guardAction: "\u306f\u9632\u5fa1\u3057\u305f\uff01",
    ultimateAction: "\u306e\u5fc5\u6bba\u6280\uff01",
    miss: "\u653b\u6483\u306f\u5916\u308c\u305f\uff01",
    guarding: "\u9632\u5fa1\u614b\u52e2\uff01",
    damage: "\u30c0\u30e1\u30fc\u30b8",
    critical: "\u30af\u30ea\u30c6\u30a3\u30ab\u30eb\u30d2\u30c3\u30c8\uff01",
    note: "\u6ce8\u610f",
    opponentLeft: "\u76f8\u624b\u304c\u9000\u51fa\u3057\u307e\u3057\u305f\u3002",
    turnCount: "\u30bf\u30fc\u30f3\u6570",
    remainHp: "\u6b8b\u308aHP",
    totalDamage: "\u5408\u8a08\u30c0\u30e1\u30fc\u30b8",
    criticalCount: "\u30af\u30ea\u30c6\u30a3\u30ab\u30eb",
    times: "\u56de",
    colon: "\uff1a",
    fileWarn: "\u3053\u306e\u30da\u30fc\u30b8\u306f\u30d5\u30a1\u30a4\u30eb\u304b\u3089\u958b\u3044\u3066\u3044\u307e\u3059\u3002\u30b5\u30fc\u30d0\u30fc\u7d4c\u7531\u3067\u958b\u3044\u3066\u304f\u3060\u3055\u3044\u3002\\n\\nstart.bat \u3092\u5b9f\u884c\u3059\u308b\u304b\u3001\\nhttp://localhost:3000 \\n\u306b\u30a2\u30af\u30bb\u30b9\u3057\u3066\u304f\u3060\u3055\u3044\u3002"
};

function e(s) {
    return [...s].map((ch) => {
        const c = ch.codePointAt(0);
        return c > 127 ? `&#${c};` : ch;
    }).join("");
}

function u(s) {
    return (
        '"' +
        [...s]
            .map((ch) => {
                const c = ch.codePointAt(0);
                if (c <= 0x7f) {
                    if (ch === '"') return '\\"';
                    if (ch === "\\") return "\\\\";
                    return ch;
                }
                if (c > 0xffff) {
                    const hi = Math.floor((c - 0x10000) / 0x400) + 0xd800;
                    const lo = ((c - 0x10000) % 0x400) + 0xdc00;
                    return `\\u${hi.toString(16)}\\u${lo.toString(16)}`;
                }
                return `\\u${c.toString(16).padStart(4, "0")}`;
            })
            .join("") +
        '"'
    );
}

function writeAscii(rel, content) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const buf = Buffer.from(content, "ascii");
    fs.writeFileSync(file, buf);
    const nonAscii = [...buf].some((b) => b > 127);
    console.log(rel, nonAscii ? "HAS NON-ASCII!" : "ASCII OK");
}

function i18nJs() {
    const lines = Object.entries(T).map(([k, v]) => `    ${k}: ${u(v)}`);
    return "const I18N = {\n" + lines.join(",\n") + "\n};\n";
}

writeAscii("js/i18n.js", i18nJs());

writeAscii(
    "js/stats.js",
    [
        'const SUBJECT_KEYS = ["jp", "math", "eng", "sci", "soc"];',
        "const SUBJECT_LABELS = {",
        "    jp: I18N.jp, math: I18N.math, eng: I18N.eng, sci: I18N.sci, soc: I18N.soc",
        "};",
        "const DEFAULT_SUBJECTS = { jp: 50, math: 50, eng: 50, sci: 50, soc: 50 };",
        "function clampSubject(v){return Math.min(80,Math.max(30,Math.round(v*100)/100));}",
        "function calcStatsFromSubjects(s){",
        "  const{jp,math,eng,sci,soc}=s;",
        "  return{",
        "    maxHp:Math.max(50,Math.floor(100+(jp-50)*4+(soc-50)*2)),",
        "    atk:Math.max(20,Math.floor(50+(math-50)*5+(sci-50)*2)),",
        "    sp:Math.max(20,Math.floor(50+(eng-50)*5+(sci-50)*2)),",
        "    def:Math.max(20,Math.floor(50+(soc-50)*5+(jp-50)*2)),",
        "    speed:Math.max(20,Math.floor(50+(eng-50)*3+(math-50)*2))",
        "  };}",
        "function xpToNextLevel(l){return l*100;}",
        "function calcLevel(xp){let lv=1,r=xp;while(r>=xpToNextLevel(lv)){r-=xpToNextLevel(lv);lv++;}return lv;}",
        "function calcStudyXp(s){return Math.floor(s/7);}",
        "function calcSubjectGain(s){return(s/60)*0.05;}",
        "function buildPlayer(name,subjects,xp){",
        "  const st=calcStatsFromSubjects(subjects),lv=calcLevel(xp||0);",
        "  return{name,subjects:{...subjects},xp:xp||0,level:lv,maxHp:st.maxHp,hp:st.maxHp,atk:st.atk,sp:st.sp,def:st.def,speed:st.speed,totalStudySeconds:0};",
        "}",
        "function formatTime(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return[h,m,sec].map(v=>String(v).padStart(2,'0')).join(':');}",
    ].join("\n")
);

writeAscii(
    "js/script.js",
    `const socket = io();
let studyStartTime=null,studyTimerInterval=null,studyElapsedBefore=0;
if(location.protocol==="file:"){alert(I18N.fileWarn);}

function createCharacter(){
  const name=document.getElementById("playerName").value.trim()||I18N.unnamed;
  const subjects={jp:Number(document.getElementById("jp").value),math:Number(document.getElementById("math").value),eng:Number(document.getElementById("eng").value),sci:Number(document.getElementById("sci").value),soc:Number(document.getElementById("soc").value)};
  const existing=getPlayerData(),xp=existing?existing.xp:0,totalStudySeconds=existing?(existing.totalStudySeconds||0):0;
  const player=buildPlayer(name,subjects,xp); player.totalStudySeconds=totalStudySeconds;
  localStorage.setItem("player",JSON.stringify(player)); updateStatus(player); updateXpDisplay(player);
}
function updateStatus(player){
  const s=player.subjects||DEFAULT_SUBJECTS;
  document.getElementById("status").innerHTML=
    "<h2>"+I18N.status+"</h2>"+
    "<p><strong>"+I18N.playerNameLabel+"</strong>"+player.name+"</p>"+
    "<p><strong>"+I18N.level+I18N.colon+"</strong>"+(player.level||1)+" <strong>"+I18N.xp+I18N.colon+"</strong>"+(player.xp||0)+"</p><hr>"+
    "<p>HP"+I18N.colon+player.maxHp+"</p><p>"+I18N.atk+I18N.colon+player.atk+"</p><p>"+I18N.sp+I18N.colon+player.sp+"</p><p>"+I18N.def+I18N.colon+player.def+"</p><p>"+I18N.speed+I18N.colon+player.speed+"</p><hr>"+
    "<p>"+I18N.jp+" "+s.jp+" / "+I18N.math+" "+s.math+" / "+I18N.eng+" "+s.eng+"</p>"+
    "<p>"+I18N.sci+" "+s.sci+" / "+I18N.soc+" "+s.soc+"</p><p>"+I18N.totalStudy+formatTime(player.totalStudySeconds||0)+"</p>";
}
function updateXpDisplay(player){
  const el=document.getElementById("xpDisplay"); if(!el)return;
  const lv=player.level||1,xp=player.xp||0;
  el.textContent=I18N.xp+I18N.colon+xp+" (Lv."+lv+" -> "+I18N.xpNext+" "+xpToNextLevel(lv)+" XP)";
}
function getPlayerData(){const r=localStorage.getItem("player");return r?JSON.parse(r):null;}
function getSubjectsFromInputs(){return{jp:Number(document.getElementById("jp").value),math:Number(document.getElementById("math").value),eng:Number(document.getElementById("eng").value),sci:Number(document.getElementById("sci").value),soc:Number(document.getElementById("soc").value)};}
function startStudy(){
  if(studyStartTime!==null)return; if(!getPlayerData()){alert(I18N.needChar);return;}
  studyStartTime=Date.now(); studyElapsedBefore=0;
  document.getElementById("studyStart").disabled=true; document.getElementById("studyStop").disabled=false; document.getElementById("studyFocus").disabled=true;
  studyTimerInterval=setInterval(updateStudyTimerDisplay,1000); updateStudyTimerDisplay();
}
function stopStudy(){
  if(studyStartTime===null)return; clearInterval(studyTimerInterval); studyTimerInterval=null;
  const elapsed=studyElapsedBefore+Math.floor((Date.now()-studyStartTime)/1000);
  studyStartTime=null; studyElapsedBefore=0;
  document.getElementById("studyStart").disabled=false; document.getElementById("studyStop").disabled=true; document.getElementById("studyFocus").disabled=false;
  applyStudyRewards(elapsed); document.getElementById("studyTimer").textContent="00:00:00";
}
function updateStudyTimerDisplay(){
  if(studyStartTime===null)return;
  document.getElementById("studyTimer").textContent=formatTime(studyElapsedBefore+Math.floor((Date.now()-studyStartTime)/1000));
}
function applyStudyRewards(seconds){
  if(seconds<5){alert(I18N.studyTooShort);return;}
  const player=getPlayerData(); if(!player)return;
  const focus=document.getElementById("studyFocus").value,subjects=player.subjects||getSubjectsFromInputs();
  const gainedXp=calcStudyXp(seconds),subjectGain=calcSubjectGain(seconds);
  subjects[focus]=clampSubject(subjects[focus]+subjectGain);
  const updated=buildPlayer(player.name,subjects,(player.xp||0)+gainedXp);
  updated.totalStudySeconds=(player.totalStudySeconds||0)+seconds;
  localStorage.setItem("player",JSON.stringify(updated));
  ["jp","math","eng","sci","soc"].forEach(k=>document.getElementById(k).value=subjects[k]);
  updateStatus(updated); updateXpDisplay(updated);
  alert(I18N.studyDone+"\\n"+I18N.time+I18N.colon+formatTime(seconds)+"\\n"+I18N.xp+" +"+gainedXp+"\\n"+SUBJECT_LABELS[focus]+I18N.deviationUp+" +"+subjectGain.toFixed(2)+I18N.slightUp);
}
document.getElementById("createRoom").onclick=()=>{const p=getPlayerData();if(!p){alert(I18N.needChar);return;}socket.emit("playerJoin",p);socket.emit("createRoom");};
document.getElementById("joinRoom").onclick=()=>{const p=getPlayerData();if(!p){alert(I18N.needChar);return;}const roomId=document.getElementById("roomInput").value.trim().toUpperCase();if(!roomId){alert(I18N.roomCode+I18N.colon);return;}socket.emit("playerJoin",p);socket.emit("joinRoom",roomId);};
socket.on("roomCreated",roomId=>{alert(I18N.roomCreated+"\\n\\n"+I18N.roomCodeMsg+I18N.colon+roomId+"\\n\\n"+I18N.tellFriend);});
socket.on("joinFailed",()=>alert(I18N.roomNotFound));
socket.on("roomReady",data=>{localStorage.setItem("roomId",data.roomId);localStorage.setItem("battlePlayer",JSON.stringify(data.me));localStorage.setItem("enemy",JSON.stringify(data.enemy));localStorage.setItem("myTurn",String(data.myTurn));alert(I18N.matched);location.href="battle.html";});
socket.on("errorMessage",m=>alert(m));
document.getElementById("deletePlayer").onclick=()=>{if(!confirm(I18N.deleteConfirm))return;if(studyStartTime!==null)stopStudy();localStorage.removeItem("player");localStorage.removeItem("battlePlayer");localStorage.removeItem("enemy");localStorage.removeItem("roomId");document.getElementById("playerName").value="";document.getElementById("status").innerHTML="<h2>"+I18N.status+"</h2><p>"+I18N.noChar+"</p>";updateXpDisplay({xp:0,level:1});alert(I18N.deleted);};
document.getElementById("studyStart").onclick=startStudy;
document.getElementById("studyStop").onclick=stopStudy;
window.onload=()=>{const player=getPlayerData();if(player){updateStatus(player);updateXpDisplay(player);document.getElementById("playerName").value=player.name;if(player.subjects)["jp","math","eng","sci","soc"].forEach(k=>document.getElementById(k).value=player.subjects[k]);}else updateXpDisplay({xp:0,level:1});};
`
);

writeAscii(
    "js/battle.js",
    `const socket=io();
const roomId=localStorage.getItem("roomId");
let me=JSON.parse(localStorage.getItem("battlePlayer")),enemy=JSON.parse(localStorage.getItem("enemy"));
let myTurn=localStorage.getItem("myTurn")==="true",battleEnd=false,rejoined=false,turnCount=0,totalDamage=0,criticalCount=0;
const turnText=document.getElementById("turnText"),myName=document.getElementById("myName"),enemyName=document.getElementById("enemyName");
const myHPBar=document.getElementById("myHPBar"),enemyHPBar=document.getElementById("enemyHPBar"),myHPText=document.getElementById("myHPText"),enemyHPText=document.getElementById("enemyHPText");
const myAtk=document.getElementById("myAtk"),mySp=document.getElementById("mySp"),myDef=document.getElementById("myDef"),mySpeed=document.getElementById("mySpeed");
const enemyAtk=document.getElementById("enemyAtk"),enemySp=document.getElementById("enemySp"),enemyDef=document.getElementById("enemyDef"),enemySpeed=document.getElementById("enemySpeed");
const attackBtn=document.getElementById("attackBtn"),specialBtn=document.getElementById("specialBtn"),guardBtn=document.getElementById("guardBtn"),ultimateBtn=document.getElementById("ultimateBtn");
const ultimateGaugeBar=document.getElementById("ultimateGaugeBar"),log=document.getElementById("log");
function statLabel(k,v){return I18N[k]+I18N.colon+v;}
function initialize(){if(!me||!enemy){alert(I18N.noBattleData);location.href="index.html";return;}myName.textContent=me.name;enemyName.textContent=enemy.name;updateStats();updateHP();updateUltimateGauge();updateButtons();addLog(I18N.battleBegin);}
function updateStats(){myAtk.textContent=statLabel("atk",me.atk);mySp.textContent=statLabel("sp",me.sp);myDef.textContent=statLabel("def",me.def);mySpeed.textContent=statLabel("speed",me.speed);enemyAtk.textContent=statLabel("atk",enemy.atk);enemySp.textContent=statLabel("sp",enemy.sp);enemyDef.textContent=statLabel("def",enemy.def);enemySpeed.textContent=statLabel("speed",enemy.speed);}
function updateHP(){myHPText.textContent="HP "+me.hp+" / "+me.maxHp;enemyHPText.textContent="HP "+enemy.hp+" / "+enemy.maxHp;myHPBar.style.width=(me.hp/me.maxHp*100)+"%";enemyHPBar.style.width=(enemy.hp/enemy.maxHp*100)+"%";}
function updateUltimateGauge(){if(ultimateGaugeBar)ultimateGaugeBar.style.width=(me.ultimate||0)+"%";}
function addLog(t){const d=document.createElement("div");d.textContent=t;log.appendChild(d);log.scrollTop=log.scrollHeight;}
function showDamage(id,a){const el=document.getElementById(id);if(!el)return;el.textContent=a>0?"-"+a:"MISS";el.classList.remove("show");void el.offsetWidth;el.classList.add("show");}
function syncBattleState(data){if(data.attacker.id===me.id){Object.assign(me,data.attacker);Object.assign(enemy,data.defender);}else{Object.assign(enemy,data.attacker);Object.assign(me,data.defender);}myTurn=(data.turn===me.id);localStorage.setItem("battlePlayer",JSON.stringify(me));localStorage.setItem("enemy",JSON.stringify(enemy));localStorage.setItem("myTurn",String(myTurn));updateHP();updateStats();updateUltimateGauge();updateButtons();}
function finishBattle(w){if(battleEnd)return;battleEnd=true;updateButtons();const win=w===me.id;addLog(win?I18N.victory:I18N.defeat);localStorage.setItem("battleResult",win?"win":"lose");localStorage.setItem("battleTurn",String(turnCount));localStorage.setItem("playerHP",String(me.hp));localStorage.setItem("enemyHP",String(enemy.hp));localStorage.setItem("totalDamage",String(totalDamage));localStorage.setItem("criticalCount",String(criticalCount));setTimeout(()=>location.href="result.html",2500);}
function updateButtons(){const c=(me.ultimate||0)>=100;attackBtn.disabled=!myTurn||battleEnd||!rejoined;specialBtn.disabled=!myTurn||battleEnd||!rejoined;guardBtn.disabled=!myTurn||battleEnd||!rejoined;ultimateBtn.disabled=!myTurn||battleEnd||!c||!rejoined;if(!turnText)return;if(!rejoined)turnText.textContent=I18N.connecting;else if(battleEnd)turnText.textContent=I18N.battleEnd;else turnText.textContent=myTurn?I18N.yourTurn:I18N.enemyTurn;}
function sendAction(a){if(!myTurn||battleEnd||!rejoined)return;socket.emit("playerAction",{roomId,action:a});}
socket.on("connect",()=>{if(roomId&&me&&me.id)socket.emit("rejoinBattle",{roomId,oldPlayerId:me.id,player:me});});
socket.on("battleRejoined",data=>{me=data.me;enemy=data.enemy;myTurn=data.myTurn;rejoined=true;localStorage.setItem("battlePlayer",JSON.stringify(me));localStorage.setItem("enemy",JSON.stringify(enemy));localStorage.setItem("myTurn",String(myTurn));updateStats();updateHP();updateUltimateGauge();updateButtons();addLog(I18N.reconnected);});
socket.on("rejoinFailed",data=>{alert(data&&data.reason==="battle_finished"?I18N.battleAlreadyEnd:I18N.rejoinFailed);location.href="index.html";});
socket.on("battleUpdate",data=>{if(battleEnd)return;turnCount++;syncBattleState(data);const L={attack:I18N.attackAction,special:I18N.specialAction,guard:I18N.guardAction,ultimate:I18N.ultimateAction};addLog(data.attacker.name+(L[data.action]||""));if(data.result.miss){addLog(I18N.miss);showDamage(data.attacker.id===me.id?"enemyDamage":"myDamage",0);}else if(data.result.guard){addLog(I18N.guarding);}else{addLog(data.result.damage+" "+I18N.damage);if(data.attacker.id===me.id){totalDamage+=data.result.damage;showDamage("enemyDamage",data.result.damage);}else showDamage("myDamage",data.result.damage);if(data.result.critical){criticalCount++;addLog(I18N.critical);}}if(data.winner)finishBattle(data.winner);});
socket.on("battleFinished",data=>finishBattle(data.winner));
socket.on("actionError",data=>addLog("["+I18N.note+"] "+data.message));
socket.on("opponentLeft",()=>{battleEnd=true;updateButtons();addLog(I18N.opponentLeft);alert(I18N.opponentLeft);location.href="index.html";});
attackBtn.onclick=()=>sendAction("attack");specialBtn.onclick=()=>sendAction("special");guardBtn.onclick=()=>sendAction("guard");ultimateBtn.onclick=()=>sendAction("ultimate");
window.onload=()=>initialize();
`
);

writeAscii(
    "js/result.js",
    `const result=localStorage.getItem("battleResult"),turn=localStorage.getItem("battleTurn")||"0",playerHP=localStorage.getItem("playerHP")||"0",damage=localStorage.getItem("totalDamage")||"0",critical=localStorage.getItem("criticalCount")||"0",title=document.getElementById("resultTitle");
title.textContent=result==="win"?I18N.win:I18N.lose;title.className=result==="win"?"win":"lose";
document.getElementById("turnText").textContent=I18N.turnCount+" : "+turn;
document.getElementById("hpText").textContent=I18N.remainHp+" : "+playerHP;
document.getElementById("damageText").textContent=I18N.totalDamage+" : "+damage;
document.getElementById("criticalText").textContent=I18N.criticalCount+" : "+critical+" "+I18N.times;
document.getElementById("retryBtn").onclick=()=>location.href="index.html";
document.getElementById("homeBtn").onclick=()=>location.href="index.html";
`
);

writeAscii(
    "index.html",
    `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>School Battle</title>
<link rel="stylesheet" href="css/style.css?v=${VER}">
</head>
<body>
<div class="container">
<header class="page-header">
<h1>School Battle</h1>
<p class="subtitle">${e(T.subtitle)}</p>
</header>
<section class="section">
<label class="field-label" for="playerName">${e(T.playerName)}</label>
<input id="playerName" type="text" placeholder="${e(T.playerNamePh)}" autocomplete="nickname">
</section>
<section class="section">
<h2>${e(T.deviation)}</h2>
<div class="subjects">
<label>${e(T.jp)}<input id="jp" type="number" value="50" min="30" max="80" step="0.01" inputmode="decimal"></label>
<label>${e(T.math)}<input id="math" type="number" value="50" min="30" max="80" step="0.01" inputmode="decimal"></label>
<label>${e(T.eng)}<input id="eng" type="number" value="50" min="30" max="80" step="0.01" inputmode="decimal"></label>
<label>${e(T.sci)}<input id="sci" type="number" value="50" min="30" max="80" step="0.01" inputmode="decimal"></label>
<label>${e(T.soc)}<input id="soc" type="number" value="50" min="30" max="80" step="0.01" inputmode="decimal"></label>
</div>
<button type="button" class="btn btn-primary" onclick="createCharacter()">${e(T.createChar)}</button>
</section>
<div id="status" class="status-box"><h2>${e(T.status)}</h2><p>${e(T.noChar)}</p></div>
<section class="study-section section">
<h2>${e(T.studyTimer)}</h2>
<p class="study-desc">${e(T.studyDesc)}</p>
<label class="field-label" for="studyFocus">${e(T.studyFocus)}</label>
<select id="studyFocus">
<option value="jp">${e(T.hpDef)}</option>
<option value="math">${e(T.mathAtk)}</option>
<option value="eng">${e(T.engSp)}</option>
<option value="sci">${e(T.sciAtk)}</option>
<option value="soc">${e(T.socHp)}</option>
</select>
<p id="studyTimer" class="study-timer">00:00:00</p>
<p id="xpDisplay" class="xp-display">${e(T.xp)}${e("\uff1a")}0</p>
<div class="study-buttons">
<button type="button" id="studyStart" class="btn btn-primary">${e(T.studyStart)}</button>
<button type="button" id="studyStop" class="btn btn-danger" disabled>${e(T.studyStop)}</button>
</div>
</section>
<section class="section buttons">
<h2>${e(T.online)}</h2>
<button type="button" id="createRoom" class="btn btn-secondary">${e(T.createRoom)}</button>
<label class="field-label" for="roomInput">${e(T.roomCode)}</label>
<input id="roomInput" type="text" placeholder="${e(T.roomPh)}" maxlength="6" autocapitalize="characters" autocomplete="off">
<button type="button" id="joinRoom" class="btn btn-secondary">${e(T.joinRoom)}</button>
<button type="button" id="deletePlayer" class="btn btn-danger-outline">${e(T.deletePlayer)}</button>
</section>
</div>
<script src="/socket.io/socket.io.js"></script>
<script src="js/i18n.js?v=${VER}"></script>
<script src="js/stats.js?v=${VER}"></script>
<script src="js/script.js?v=${VER}"></script>
</body>
</html>
`
);

writeAscii(
    "battle.html",
    `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>School Battle - ${e(T.battle)}</title>
<link rel="stylesheet" href="css/battle.css?v=${VER}">
</head>
<body>
<div class="battle-container">
<header class="battle-header"><h1>${e(T.battle)}</h1><p id="turnText" class="turn-text"></p></header>
<div class="players">
<div class="card player-card" id="playerCard"><p class="card-label">${e(T.you)}</p><h2 id="myName">----</h2>
<div id="myDamage" class="damage"></div><div class="hpbar"><div id="myHPBar" class="fill"></div></div>
<p id="myHPText" class="hp-text">HP 100 / 100</p>
<div class="stats"><p id="myAtk">${e(T.atk)}${e("\uff1a")}-</p><p id="mySp">${e(T.sp)}${e("\uff1a")}-</p><p id="myDef">${e(T.def)}${e("\uff1a")}-</p><p id="mySpeed">${e(T.speed)}${e("\uff1a")}-</p></div></div>
<div class="vs">VS</div>
<div class="card enemy-card" id="enemyCard"><p class="card-label">${e(T.enemy)}</p><h2 id="enemyName">${e(T.loading)}</h2>
<div id="enemyDamage" class="damage"></div><div class="hpbar"><div id="enemyHPBar" class="fill enemy"></div></div>
<p id="enemyHPText" class="hp-text">HP ???</p>
<div class="stats"><p id="enemyAtk">${e(T.atk)}${e("\uff1a")}${e("\uff1f")}</p><p id="enemySp">${e(T.sp)}${e("\uff1a")}${e("\uff1f")}</p><p id="enemyDef">${e(T.def)}${e("\uff1a")}${e("\uff1f")}</p><p id="enemySpeed">${e(T.speed)}${e("\uff1a")}${e("\uff1f")}</p></div></div></div>
<div class="ultimate-section"><p class="gauge-label">${e(T.ultimateGauge)}</p><div class="ultimateGauge"><div id="ultimateGaugeBar" class="ultimateFill"></div></div></div>
<div class="commands">
<button type="button" id="attackBtn" class="cmd-btn attack">${e(T.attack)}</button>
<button type="button" id="specialBtn" class="cmd-btn special">${e(T.special)}</button>
<button type="button" id="guardBtn" class="cmd-btn guard">${e(T.guard)}</button>
<button type="button" id="ultimateBtn" class="cmd-btn ultimate" disabled>${e(T.ultimate)}</button></div>
<div id="log" class="battle-log">${e(T.battleStart)}</div></div>
<script src="/socket.io/socket.io.js"></script>
<script src="js/i18n.js?v=${VER}"></script>
<script src="js/battle.js?v=${VER}"></script>
</body>
</html>
`
);

writeAscii(
    "result.html",
    `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>School Battle - Result</title>
<link rel="stylesheet" href="css/result.css?v=${VER}">
</head>
<body>
<div id="resultCard"><h1 id="resultTitle"></h1>
<div class="result-stats"><p id="turnText"></p><p id="hpText"></p><p id="damageText"></p><p id="criticalText"></p></div>
<div class="buttonArea">
<button type="button" id="retryBtn" class="btn">${e(T.retry)}</button>
<button type="button" id="homeBtn" class="btn">${e(T.home)}</button>
</div></div>
<script src="js/i18n.js?v=${VER}"></script>
<script src="js/result.js?v=${VER}"></script>
</body>
</html>
`
);

console.log("Done. version=" + VER);
