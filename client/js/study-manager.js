// ============================================
// 学習管理機能
// 学習履歴、統計、目標設定、ストリーク、カレンダー
// ============================================

class StudyManager {
    constructor() {
        this.studyHistory = [];
        this.studyGoals = [];
        this.streak = { current: 0, best: 0, lastStudyDate: null };
        this.loadStudyData();
    }

    // 学習データをロード
    loadStudyData() {
        try {
            const player = getPlayerData();
            if (player) {
                this.studyHistory = player.studyHistory || [];
                this.studyGoals = player.studyGoals || [];
                this.streak = player.streak || { current: 0, best: 0, lastStudyDate: null };
            }
        } catch (e) {
            console.error('学習データのロードに失敗:', e);
        }
    }

    // 学習データを保存
    saveStudyData() {
        try {
            const player = getPlayerData();
            if (player) {
                player.studyHistory = this.studyHistory;
                player.studyGoals = this.studyGoals;
                player.streak = this.streak;
                localStorage.setItem('player', JSON.stringify(player));
            }
        } catch (e) {
            console.error('学習データの保存に失敗:', e);
        }
    }

    // 学習履歴を記録
    recordStudy(subject, time, questionsAnswered, correctCount) {
        const today = new Date().toISOString().split('T')[0];
        const record = {
            date: today,
            timestamp: Date.now(),
            subject,
            time, // 秒
            questionsAnswered,
            correctCount,
            accuracy: questionsAnswered > 0 ? Math.round(correctCount / questionsAnswered * 100) : 0
        };

        this.studyHistory.push(record);

        // ストリークを更新
        this.updateStreak(today);

        // 目標を更新
        this.updateGoals(today, subject, time, questionsAnswered);

        this.saveStudyData();
    }

    // ストリークを更新
    updateStreak(today) {
        if (this.streak.lastStudyDate === today) {
            // 既に今日記録済み
            return;
        }

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        if (this.streak.lastStudyDate === yesterday) {
            // 昨日も勉強していたら連続記録を更新
            this.streak.current++;
        } else if (this.streak.lastStudyDate !== today) {
            // 連続が途切れた
            this.streak.current = 1;
        }

        this.streak.lastStudyDate = today;
        if (this.streak.current > this.streak.best) {
            this.streak.best = this.streak.current;
        }
    }

    // 目標を更新
    updateGoals(today, subject, time, questionsAnswered) {
        this.studyGoals.forEach(goal => {
            if (goal.completed) return;

            if (goal.type === 'daily' && goal.lastReset !== today) {
                // 日次目標をリセット
                goal.current = 0;
                goal.lastReset = today;
            }

            if (goal.targetType === 'time' && goal.subject === subject) {
                goal.current += time;
            } else if (goal.targetType === 'questions' && goal.subject === subject) {
                goal.current += questionsAnswered;
            }

            if (goal.current >= goal.target) {
                goal.completed = true;
                this.handleGoalCompletion(goal);
            }
        });
    }

    // 目標達成時の処理
    handleGoalCompletion(goal) {
        // 報酬を付与
        const player = getPlayerData();
        if (player) {
            const bonusCoins = goal.type === 'daily' ? 50 : 200;
            player.coins = (player.coins || 0) + bonusCoins;
            localStorage.setItem('player', JSON.stringify(player));

            // 通知
            if (typeof addChatMessage === 'function') {
                addChatMessage({
                    type: 'system',
                    playerName: '学習目標',
                    playerLevel: 0,
                    message: `🎯 目標達成！「${goal.name}」をクリアしました！\nコイン+${bonusCoins}`,
                    timestamp: Date.now()
                });
            }
        }
    }

    // 新しい目標を追加
    addGoal(goal) {
        const newGoal = {
            id: 'goal_' + Date.now(),
            name: goal.name,
            type: goal.type, // 'daily' or 'weekly'
            subject: goal.subject,
            targetType: goal.targetType, // 'time' or 'questions'
            target: goal.target,
            current: 0,
            completed: false,
            lastReset: new Date().toISOString().split('T')[0],
            createdAt: Date.now()
        };

        this.studyGoals.push(newGoal);
        this.saveStudyData();
    }

    // 目標を削除
    removeGoal(goalId) {
        this.studyGoals = this.studyGoals.filter(goal => goal.id !== goalId);
        this.saveStudyData();
    }

    // 統計を取得
    getStats() {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const todayRecords = this.studyHistory.filter(r => r.date === today);
        const weekRecords = this.studyHistory.filter(r => r.date >= weekAgo);
        const monthRecords = this.studyHistory.filter(r => r.date >= monthAgo);

        const totalTimeToday = todayRecords.reduce((sum, r) => sum + r.time, 0);
        const totalTimeWeek = weekRecords.reduce((sum, r) => sum + r.time, 0);
        const totalTimeMonth = monthRecords.reduce((sum, r) => sum + r.time, 0);

        const totalQuestionsToday = todayRecords.reduce((sum, r) => sum + r.questionsAnswered, 0);
        const totalQuestionsWeek = weekRecords.reduce((sum, r) => sum + r.questionsAnswered, 0);
        const totalQuestionsMonth = monthRecords.reduce((sum, r) => sum + r.questionsAnswered, 0);

        const avgAccuracyToday = todayRecords.length > 0
            ? Math.round(todayRecords.reduce((sum, r) => sum + r.accuracy, 0) / todayRecords.length)
            : 0;
        const avgAccuracyWeek = weekRecords.length > 0
            ? Math.round(weekRecords.reduce((sum, r) => sum + r.accuracy, 0) / weekRecords.length)
            : 0;

        // 教科別統計
        const subjectStats = {};
        this.studyHistory.forEach(record => {
            if (!subjectStats[record.subject]) {
                subjectStats[record.subject] = { time: 0, questions: 0, correct: 0 };
            }
            subjectStats[record.subject].time += record.time;
            subjectStats[record.subject].questions += record.questionsAnswered;
            subjectStats[record.subject].correct += record.correctCount;
        });

        Object.keys(subjectStats).forEach(subject => {
            subjectStats[subject].accuracy = subjectStats[subject].questions > 0
                ? Math.round(subjectStats[subject].correct / subjectStats[subject].questions * 100)
                : 0;
        });

        return {
            today: {
                time: totalTimeToday,
                questions: totalQuestionsToday,
                accuracy: avgAccuracyToday
            },
            week: {
                time: totalTimeWeek,
                questions: totalQuestionsWeek,
                accuracy: avgAccuracyWeek
            },
            month: {
                time: totalTimeMonth,
                questions: totalQuestionsMonth
            },
            streak: this.streak,
            subjectStats,
            goals: this.studyGoals.filter(g => !g.completed).length,
            completedGoals: this.studyGoals.filter(g => g.completed).length
        };
    }

    // 学習カレンダーデータを取得
    getCalendarData(year, month) {
        const calendarData = {};
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayRecords = this.studyHistory.filter(r => r.date === date);

            if (dayRecords.length > 0) {
                const totalTime = dayRecords.reduce((sum, r) => sum + r.time, 0);
                const totalQuestions = dayRecords.reduce((sum, r) => sum + r.questionsAnswered, 0);
                const avgAccuracy = Math.round(dayRecords.reduce((sum, r) => sum + r.accuracy, 0) / dayRecords.length);

                calendarData[day] = {
                    hasStudy: true,
                    time: totalTime,
                    questions: totalQuestions,
                    accuracy: avgAccuracy
                };
            } else {
                calendarData[day] = { hasStudy: false };
            }
        }

        return calendarData;
    }

    // 苦手な教科を特定
    getWeakSubjects() {
        const subjectStats = this.getStats().subjectStats;
        const subjects = Object.keys(subjectStats).map(subject => ({
            subject,
            accuracy: subjectStats[subject].accuracy,
            questions: subjectStats[subject].questions
        }));

        // 正解率が低い順にソート（最低10問以上解いているもの）
        return subjects
            .filter(s => s.questions >= 10)
            .sort((a, b) => a.accuracy - b.accuracy)
            .slice(0, 5);
    }
}

// グローバルインスタンス
let studyManager = null;

// 学習管理システムを初期化
function initStudyManager() {
    if (!studyManager) {
        studyManager = new StudyManager();
    }
    return studyManager;
}

// 学習統計UIを表示
function showStudyStatsUI() {
    const manager = initStudyManager();
    const stats = manager.getStats();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'studyStatsModal';

    modal.innerHTML = `
        <div class="modal-content study-stats-modal">
            <button type="button" class="close btn btn-secondary">閉じる</button>
            <h2>📊 学習統計</h2>
            
            <div class="stats-tabs">
                <button class="tab-btn active" data-tab="overview">概要</button>
                <button class="tab-btn" data-tab="subjects">教科別</button>
                <button class="tab-btn" data-tab="calendar">カレンダー</button>
                <button class="tab-btn" data-tab="goals">目標</button>
            </div>

            <div class="tab-content active" id="tab-overview">
                <div class="stats-overview">
                    <div class="stat-card">
                        <div class="stat-value">${formatTime(stats.today.time)}</div>
                        <div class="stat-label">今日の学習時間</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.today.questions}</div>
                        <div class="stat-label">今日の問題数</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.today.accuracy}%</div>
                        <div class="stat-label">今日の正解率</div>
                    </div>
                    <div class="stat-card streak">
                        <div class="stat-value">${stats.streak.current}日</div>
                        <div class="stat-label">連続学習（最高${stats.streak.best}日）</div>
                    </div>
                </div>

                <div class="stats-weekly">
                    <h3>今週の学習</h3>
                    <div class="stat-row">
                        <span>学習時間:</span>
                        <span>${formatTime(stats.week.time)}</span>
                    </div>
                    <div class="stat-row">
                        <span>解いた問題:</span>
                        <span>${stats.week.questions}問</span>
                    </div>
                    <div class="stat-row">
                        <span>平均正解率:</span>
                        <span>${stats.week.accuracy}%</span>
                    </div>
                </div>

                <div class="stats-monthly">
                    <h3>今月の学習</h3>
                    <div class="stat-row">
                        <span>学習時間:</span>
                        <span>${formatTime(stats.month.time)}</span>
                    </div>
                    <div class="stat-row">
                        <span>解いた問題:</span>
                        <span>${stats.month.questions}問</span>
                    </div>
                </div>
            </div>

            <div class="tab-content" id="tab-subjects">
                <h3>教科別統計</h3>
                <div class="subject-stats">
                    ${Object.entries(stats.subjectStats).map(([subject, data]) => `
                        <div class="subject-stat-item">
                            <div class="subject-name">${subject}</div>
                            <div class="subject-details">
                                <div class="subject-bar">
                                    <div class="subject-fill" style="width: ${data.accuracy}%"></div>
                                </div>
                                <div class="subject-info">
                                    <span>正解率: ${data.accuracy}%</span>
                                    <span>${data.questions}問 / ${formatTime(data.time)}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="weak-subjects">
                    <h3>苦手な教科</h3>
                    ${manager.getWeakSubjects().length > 0
                        ? manager.getWeakSubjects().map(s => `
                            <div class="weak-subject-item">
                                <span>${s.subject}</span>
                                <span class="weak-accuracy">${s.accuracy}%</span>
                            </div>
                        `).join('')
                        : '<p>データが不足しています</p>'
                    }
                </div>
            </div>

            <div class="tab-content" id="tab-calendar">
                <h3>学習カレンダー</h3>
                <div class="calendar-controls">
                    <button class="btn btn-secondary" id="prevMonth">前月</button>
                    <span id="calendarTitle"></span>
                    <button class="btn btn-secondary" id="nextMonth">次月</button>
                </div>
                <div class="calendar-grid" id="calendarGrid"></div>
            </div>

            <div class="tab-content" id="tab-goals">
                <h3>学習目標</h3>
                <div class="goals-list">
                    ${manager.studyGoals.length === 0
                        ? '<p class="no-goals">目標が設定されていません</p>'
                        : manager.studyGoals.map(goal => `
                            <div class="goal-item ${goal.completed ? 'completed' : ''}">
                                <div class="goal-header">
                                    <span class="goal-name">${goal.name}</span>
                                    <span class="goal-type">${goal.type === 'daily' ? '日次' : '週次'}</span>
                                </div>
                                <div class="goal-progress">
                                    <div class="goal-bar">
                                        <div class="goal-fill" style="width: ${Math.min(100, goal.current / goal.target * 100)}%"></div>
                                    </div>
                                    <div class="goal-info">
                                        <span>${goal.current} / ${goal.target} ${goal.targetType === 'time' ? '秒' : '問'}</span>
                                        ${goal.completed ? '<span class="goal-completed">✓ 達成</span>' : ''}
                                    </div>
                                </div>
                                <button class="btn btn-secondary btn-sm goal-delete" data-goal-id="${goal.id}">削除</button>
                            </div>
                        `).join('')
                    }
                </div>
                <button class="btn btn-primary" id="addGoalBtn">目標を追加</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // イベントリスナー
    modal.querySelector('.close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // タブ切り替え
    modal.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById('tab-' + e.target.dataset.tab).classList.add('active');

            if (e.target.dataset.tab === 'calendar') {
                renderCalendar(modal);
            }
        });
    });

    // 目標削除
    modal.querySelectorAll('.goal-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const goalId = e.target.dataset.goalId;
            manager.removeGoal(goalId);
            modal.remove();
            showStudyStatsUI();
        });
    });

    // 目標追加
    modal.querySelector('#addGoalBtn').addEventListener('click', () => {
        showAddGoalUI();
    });

    // カレンダー操作
    let currentYear = new Date().getFullYear();
    let currentMonth = new Date().getMonth() + 1;

    modal.querySelector('#prevMonth').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 1) {
            currentMonth = 12;
            currentYear--;
        }
        renderCalendar(modal, currentYear, currentMonth);
    });

    modal.querySelector('#nextMonth').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }
        renderCalendar(modal, currentYear, currentMonth);
    });
}

// カレンダーを描画
function renderCalendar(modal, year, month) {
    if (!year) year = new Date().getFullYear();
    if (!month) month = new Date().getMonth() + 1;

    const manager = initStudyManager();
    const calendarData = manager.getCalendarData(year, month);
    const firstDay = new Date(year, month - 1, 1).getDay();
    const lastDay = new Date(year, month, 0).getDate();

    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    modal.querySelector('#calendarTitle').textContent = `${year}年 ${monthNames[month - 1]}`;

    let html = '<div class="calendar-weekdays">';
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    weekdays.forEach(w => html += `<div class="calendar-weekday">${w}</div>`);
    html += '</div><div class="calendar-days">';

    // 空白セル
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }

    // 日付セル
    for (let day = 1; day <= lastDay; day++) {
        const data = calendarData[day];
        const hasStudy = data.hasStudy;
        const intensity = hasStudy ? Math.min(3, Math.floor(data.time / 1800)) : 0; // 30分ごとに強度アップ

        html += `
            <div class="calendar-day ${hasStudy ? 'has-study' : ''} intensity-${intensity}">
                <span class="day-number">${day}</span>
                ${hasStudy ? `<div class="study-indicator" title="${formatTime(data.time)} / ${data.questions}問 / ${data.accuracy}%"></div>` : ''}
            </div>
        `;
    }

    html += '</div>';
    modal.querySelector('#calendarGrid').innerHTML = html;
}

// 目標追加UIを表示
function showAddGoalUI() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'addGoalModal';

    modal.innerHTML = `
        <div class="modal-content add-goal-modal">
            <button type="button" class="close btn btn-secondary">閉じる</button>
            <h2>🎯 学習目標を追加</h2>
            
            <form id="addGoalForm">
                <div class="form-group">
                    <label>目標名</label>
                    <input type="text" id="goalName" required placeholder="例: 1日30分勉強">
                </div>
                
                <div class="form-group">
                    <label>種類</label>
                    <select id="goalType">
                        <option value="daily">日次</option>
                        <option value="weekly">週次</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>教科</label>
                    <select id="goalSubject">
                        <option value="math">数学</option>
                        <option value="english">英語</option>
                        <option value="science">理科</option>
                        <option value="social">社会</option>
                        <option value="japanese">国語</option>
                        <option value="all">全教科</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>目標タイプ</label>
                    <select id="goalTargetType">
                        <option value="time">時間（秒）</option>
                        <option value="questions">問題数</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>目標値</label>
                    <input type="number" id="goalTarget" required min="1" placeholder="例: 1800（30分）">
                </div>
                
                <button type="submit" class="btn btn-primary">追加</button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    modal.querySelector('#addGoalForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const manager = initStudyManager();
        manager.addGoal({
            name: document.getElementById('goalName').value,
            type: document.getElementById('goalType').value,
            subject: document.getElementById('goalSubject').value,
            targetType: document.getElementById('goalTargetType').value,
            target: parseInt(document.getElementById('goalTarget').value)
        });
        modal.remove();
        showStudyStatsUI();
    });
}

// 時間をフォーマット
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}時間${minutes}分`;
    }
    return `${minutes}分`;
}

// グローバル関数として公開
window.initStudyManager = initStudyManager;
window.showStudyStatsUI = showStudyStatsUI;
window.getStudyManager = () => studyManager;

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => {
    initStudyManager();
});
