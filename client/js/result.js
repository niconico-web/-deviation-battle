const result=localStorage.getItem("battleResult"),turn=localStorage.getItem("battleTurn")||"0",playerHP=localStorage.getItem("playerHP")||"0",damage=localStorage.getItem("totalDamage")||"0",critical=localStorage.getItem("criticalCount")||"0",title=document.getElementById("resultTitle");
title.textContent=result==="win"?I18N.win:I18N.lose;title.className=result==="win"?"win":"lose";
document.getElementById("turnText").textContent=I18N.turnCount+" : "+turn;
document.getElementById("hpText").textContent=I18N.remainHp+" : "+playerHP;
document.getElementById("damageText").textContent=I18N.totalDamage+" : "+damage;
document.getElementById("criticalText").textContent=I18N.criticalCount+" : "+critical+" "+I18N.times;
document.getElementById("retryBtn").onclick=()=>location.href="index.html";
document.getElementById("homeBtn").onclick=()=>location.href="index.html";
