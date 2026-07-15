const result=localStorage.getItem("battleResult"),turn=Number(localStorage.getItem("battleTurn")||"0"),playerHP=localStorage.getItem("playerHP")||"0",damage=Number(localStorage.getItem("totalDamage")||"0"),critical=localStorage.getItem("criticalCount")||"0",title=document.getElementById("resultTitle");
const won=result==="win";
let rematchRequested=false, opponentRematchRequested=false;

if(!localStorage.getItem("battleXpGain"))applyBattleRewards(won,turn,damage);
const xpGain=localStorage.getItem("battleXpGain")||"0";
title.textContent=won?I18N.win:I18N.lose;title.className=won?"win":"lose";
document.getElementById("turnText").textContent=I18N.turnCount+" : "+turn;
document.getElementById("hpText").textContent=I18N.remainHp+" : "+playerHP;
document.getElementById("damageText").textContent=I18N.totalDamage+" : "+damage;
document.getElementById("criticalText").textContent=I18N.criticalCount+" : "+critical+" "+I18N.times;
const xpEl=document.getElementById("xpGainText");
if(xpEl)xpEl.textContent=I18N.xp+" +"+xpGain;

const retryBtn=document.getElementById("retryBtn");
const homeBtn=document.getElementById("homeBtn");

// Home button always works
homeBtn.onclick=()=>location.href="index.html";

// Retry button - try rematch, fallback to index if no room
retryBtn.onclick=()=>{
    const roomId=localStorage.getItem("roomId");
    if(!roomId){
        location.href="index.html";
        return;
    }
    if(rematchRequested)return;
    rematchRequested=true;
    retryBtn.textContent="相手を待っています...";
    retryBtn.disabled=true;
    
    try{
        const socket=io();
        socket.emit("requestRematch",roomId);
        
        socket.on("rematchReady",()=>{
            opponentRematchRequested=true;
            if(rematchRequested){
                socket.emit("startRematch",roomId);
            }else{
                retryBtn.textContent="相手が再戦を希望しています！";
                retryBtn.disabled=false;
            }
        });
        
        socket.on("rematchConfirmed",()=>{
            localStorage.removeItem("battleResult");
            localStorage.removeItem("battleTurn");
            localStorage.removeItem("playerHP");
            localStorage.removeItem("enemyHP");
            localStorage.removeItem("totalDamage");
            localStorage.removeItem("criticalCount");
            localStorage.removeItem("battleXpGain");
            location.href="battle.html";
        });
        
        socket.on("connect_error",()=>{
            retryBtn.textContent="接続エラー - ホームへ";
            retryBtn.disabled=false;
            retryBtn.onclick=()=>location.href="index.html";
        });
    }catch(e){
        console.error("Socket error:",e);
        location.href="index.html";
    }
};
