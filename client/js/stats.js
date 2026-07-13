const SUBJECT_KEYS = ["jp", "math", "eng", "sci", "soc"];
const SUBJECT_LABELS = {
    jp: I18N.jp, math: I18N.math, eng: I18N.eng, sci: I18N.sci, soc: I18N.soc
};
const DEFAULT_SUBJECTS = { jp: 50, math: 50, eng: 50, sci: 50, soc: 50 };
function clampSubject(v){return Math.min(80,Math.max(30,Math.round(v*100)/100));}
function calcStatsFromSubjects(s){
  const{jp,math,eng,sci,soc}=s;
  return{
    maxHp:Math.max(50,Math.floor(100+(jp-50)*4+(soc-50)*2)),
    atk:Math.max(20,Math.floor(50+(math-50)*5+(sci-50)*2)),
    sp:Math.max(20,Math.floor(50+(eng-50)*5+(sci-50)*2)),
    def:Math.max(20,Math.floor(50+(soc-50)*5+(jp-50)*2)),
    speed:Math.max(20,Math.floor(50+(eng-50)*3+(math-50)*2))
  };}
function xpToNextLevel(l){return Math.max(40,l*50);}
function calcLevel(xp){let lv=1,r=xp;while(r>=xpToNextLevel(lv)){r-=xpToNextLevel(lv);lv++;}return lv;}
function calcStudyXp(s){return Math.floor(s/4);}
function calcSubjectGain(s){return(s/60)*0.1;}
function calcBattleXp(won,turns,damage){const base=won?40:15;return base+Math.floor(turns*3)+Math.floor(damage/10);}
function applyBattleRewards(won,turns,damage){
  const raw=localStorage.getItem("player");if(!raw)return null;
  const player=JSON.parse(raw);
  const subjects=player.subjects||DEFAULT_SUBJECTS;
  const gainedXp=calcBattleXp(won,turns,damage);
  const updated=buildPlayer(player.name,subjects,(player.xp||0)+gainedXp);
  updated.totalStudySeconds=player.totalStudySeconds||0;
  localStorage.setItem("player",JSON.stringify(updated));
  localStorage.setItem("battleXpGain",String(gainedXp));
  return updated;
}
function buildPlayer(name,subjects,xp){
  const st=calcStatsFromSubjects(subjects),lv=calcLevel(xp||0);
  return{name,subjects:{...subjects},xp:xp||0,level:lv,maxHp:st.maxHp,hp:st.maxHp,atk:st.atk,sp:st.sp,def:st.def,speed:st.speed,totalStudySeconds:0};
}
function formatTime(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return[h,m,sec].map(v=>String(v).padStart(2,'0')).join(':');}