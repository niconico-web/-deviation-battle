*** Begin Patch
*** Update File: server/managers/BattleManager.js
@@
-    console.log(`[BattleManager] createBattle: host.grade=${host.grade}, guest.grade=${host.grade}`);
+    // Normalize and log grades
+    const hostGrade = Number(host.grade) || 1;
+    const guestGrade = Number(guest.grade) || 1;
+    console.log(`[BattleManager] createBattle: host.grade=${hostGrade}, guest.grade=${guestGrade}`);
@@
-                speed: hostStats.speed,
-                grade: host.grade || 1,
+                speed: hostStats.speed,
+                grade: hostGrade,
@@
-                speed: guestStats.speed,
-                grade: guest.grade || 1,
+                speed: guestStats.speed,
+                grade: guestGrade,
*** End Patch