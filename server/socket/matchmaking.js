*** Begin Patch
*** Update File: server/socket/matchmaking.js
@@
 function toBattlePlayer(player, socketId) {
     const battleStats = player.battleStats || player;
-    console.log(`[Matchmaking] toBattlePlayer: player.grade=${player.grade}, battleStats.grade=${battleStats.grade}`);
-    console.log(`[Matchmaking] Player data:`, JSON.stringify(player));
-    console.log(`[Matchmaking] BattleStats:`, JSON.stringify(battleStats));
-    
-    return {
-        id: player.id,
-        socketId,
-        name: player.name || "Unknown",
-        maxHp: battleStats.maxHp ?? player.maxHp ?? 50,
-        atk: battleStats.atk ?? player.atk ?? 10,
-        def: battleStats.def ?? player.def ?? 10,
-        speed: battleStats.speed ?? player.speed ?? 10,
-        grade: player.grade || battleStats.grade || 1,
-        equippedWeapon: player.equippedWeapon || null
-    };
+    // 正規化してログ出力
+    const grade = Number(player.grade ?? battleStats.grade ?? 1) || 1;
+    console.log(`[Matchmaking] toBattlePlayer: normalized grade=${grade}`);
+
+    // デバッグ用の詳細ログ（大きなオブジェクトは省略して出力）
+    console.log(`[Matchmaking] Player id=${player.id}, name=${player.name}`);
+
+    return {
+        id: player.id,
+        socketId,
+        name: player.name || "Unknown",
+        maxHp: battleStats.maxHp ?? player.maxHp ?? 50,
+        atk: battleStats.atk ?? player.atk ?? 10,
+        def: battleStats.def ?? player.def ?? 10,
+        speed: battleStats.speed ?? player.speed ?? 10,
+        grade,
+        equippedWeapon: player.equippedWeapon || null
+    };
 }
*** End Patch