// Admin Authentication Logic
const ADMIN_USER = "saveen";
const ADMIN_PASS = "@Saveen2014518";

// 1. Handle Login Form (on admin/login.html)
const adminLoginForm = document.getElementById('admin-login-form');
if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('admin-username').value.trim();
        const pass = document.getElementById('admin-password').value;
        const err = document.getElementById('admin-error');
        const btn = document.getElementById('login-btn');

        // Show loading
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>Verifying...';

        setTimeout(() => {
            if (user === ADMIN_USER && pass === ADMIN_PASS) {
                sessionStorage.setItem('admin_logged_in', 'true');
                btn.innerHTML = '✅ Access Granted!';
                setTimeout(() => {
                    window.location.href = 'pos.html';
                }, 600);
            } else {
                err.classList.add('show');
                btn.disabled = false;
                btn.innerHTML = 'Login to Dashboard';
                // Clear password field on failure
                document.getElementById('admin-password').value = '';
                document.getElementById('admin-password').focus();
            }
        }, 800);
    });
}

// 2. Protect Admin Pages - Call at top of every protected page
window.checkAdminAuth = function() {
    if (sessionStorage.getItem('admin_logged_in') !== 'true') {
        window.location.replace('login.html');
    }
}

// 3. Admin Logout
window.adminLogout = function() {
    sessionStorage.removeItem('admin_logged_in');
    window.location.replace('login.html');
}
