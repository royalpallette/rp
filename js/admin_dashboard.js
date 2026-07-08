import { auth, db } from './firebase-config.js';
import { ref, onValue, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    // Check auth
    if (!sessionStorage.getItem('admin_token')) {
        window.location.href = 'login.html';
        return;
    }

    const activeUsersEl = document.getElementById('stat-active-users');
    const totalVisitsEl = document.getElementById('stat-total-visits');
    const totalFeedbacksEl = document.getElementById('stat-total-feedbacks');
    const activityLogList = document.getElementById('activity-log-list');
    const feedbackList = document.getElementById('feedback-list');

    // 1. Live Active Viewers
    onValue(ref(db, 'active_users'), (snapshot) => {
        if (snapshot.exists()) {
            activeUsersEl.textContent = Object.keys(snapshot.val()).length;
        } else {
            activeUsersEl.textContent = "0";
        }
    });

    // 2. Total Visits (we will store each visit in a specific node, or just a counter)
    // Actually, storing each visit is better for activity log, but a simple counter is more robust for numbers.
    // Let's use `analytics/total_visits` counter
    onValue(ref(db, 'analytics/total_visits'), (snapshot) => {
        totalVisitsEl.textContent = snapshot.exists() ? snapshot.val() : "0";
    });

    // 3. Total Feedbacks
    onValue(ref(db, 'feedbacks'), (snapshot) => {
        if (snapshot.exists()) {
            totalFeedbacksEl.textContent = Object.keys(snapshot.val()).length;
            
            // Populate feedback list (Reverse chronological)
            const feedbacks = [];
            snapshot.forEach(child => {
                feedbacks.push(child.val());
            });
            feedbacks.sort((a,b) => b.timestamp - a.timestamp); // newest first

            feedbackList.innerHTML = '';
            feedbacks.forEach(f => {
                const date = new Date(f.timestamp).toLocaleString();
                let ratingHtml = '';
                for(let i=0; i<5; i++){
                    if(i < f.rating) ratingHtml += '<span class="text-yellow-400">★</span>';
                    else ratingHtml += '<span class="text-gray-300">★</span>';
                }

                feedbackList.innerHTML += `
                    <div class="p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <span class="font-semibold text-gray-800">${f.name || 'Anonymous'}</span>
                                <span class="text-xs text-gray-400 ml-2">${date}</span>
                            </div>
                            <div class="text-sm">${ratingHtml}</div>
                        </div>
                        <p class="text-sm text-gray-600">${f.message}</p>
                    </div>
                `;
            });
        } else {
            totalFeedbacksEl.textContent = "0";
            feedbackList.innerHTML = '<div class="text-center text-gray-400 py-10">No feedback yet.</div>';
        }
    });

    // 4. Activity Logs (Audit Trail)
    // Fetch last 50 logs
    const logsQuery = query(ref(db, 'activity_logs'), orderByChild('timestamp'), limitToLast(50));
    onValue(logsQuery, (snapshot) => {
        if (snapshot.exists()) {
            const logs = [];
            snapshot.forEach(child => {
                logs.push(child.val());
            });
            logs.reverse(); // newest first

            activityLogList.innerHTML = '';
            logs.forEach(log => {
                const date = new Date(log.timestamp).toLocaleString();
                
                // Determine styling based on type
                let icon = '';
                let bgColor = 'bg-gray-100 text-gray-600';
                
                if (log.type === 'admin_login') { icon = '🛡️'; bgColor = 'bg-red-100 text-red-600'; }
                else if (log.type === 'admin_logout') { icon = '🔒'; bgColor = 'bg-red-50 text-red-400'; }
                else if (log.type === 'user_login') { icon = '👤'; bgColor = 'bg-blue-100 text-blue-600'; }
                else if (log.type === 'user_logout') { icon = '👋'; bgColor = 'bg-blue-50 text-blue-400'; }
                else if (log.type === 'page_visit') { icon = '👀'; bgColor = 'bg-green-100 text-green-600'; }
                else { icon = '📝'; bgColor = 'bg-gray-100 text-gray-600'; }

                activityLogList.innerHTML += `
                    <li class="flex items-start gap-4">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${bgColor}">
                            ${icon}
                        </div>
                        <div>
                            <p class="text-sm text-gray-800">${log.message}</p>
                            <p class="text-xs text-gray-400 mt-1">${date}</p>
                        </div>
                    </li>
                `;
            });
        } else {
            activityLogList.innerHTML = '<li class="text-center text-gray-400 py-10">No activity yet.</li>';
        }
    });
});
