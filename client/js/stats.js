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
function xpToNextLevel(l){return l*150;}
function calcLevel(xp){let lv=1,r=xp;while(r>=xpToNextLevel(lv)){r-=xpToNextLevel(lv);lv++;}return lv;}
function calcStudyXp(s){return Math.floor(s/10);}
function calcSubjectGain(s){return(s/60)*0.03;}
function buildPlayer(name,subjects,xp){
  const st=calcStatsFromSubjects(subjects),lv=calcLevel(xp||0);
  return{name,subjects:{...subjects},xp:xp||0,level:lv,maxHp:st.maxHp,hp:st.maxHp,atk:st.atk,sp:st.sp,def:st.def,speed:st.speed,totalStudySeconds:0};
}
function formatTime(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return[h,m,sec].map(v=>String(v).padStart(2,'0')).join(':');}