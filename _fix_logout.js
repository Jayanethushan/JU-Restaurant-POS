const fs = require('fs');
const path = 'app.js';
let c = fs.readFileSync(path, 'utf8');

const regex = /this\._openShiftModal\(false\);\s*\}\s*\}\s*const\s+statusCard\s*=\s*document\.getElementById\('shift-status-card'\);/s;

const replacement = `            this._openShiftModal(false);
        }
    }

    handleLogout() {
        sessionStorage.removeItem('pos_session');
        this.state.role = null;
        this.state.shiftOpen = false;
        document.getElementById('login-overlay').classList.add('active');
        document.getElementById('shift-modal').classList.remove('active');
    }

    _applyRoleUI() {
        const role = this.state.role;
        const roleEl = document.getElementById('logged-user-role');
        if (roleEl) roleEl.textContent = role === 'manager' ? '\\uD83D\\uDC51 Manager' : role === 'cashier' ? '\\uD83D\\uDCB3 Cashier' : '\\uD83C\\uDF73 Kitchen';
        
        let firstTabSet = false;
        document.querySelectorAll('.nav-links li').forEach(li => {
            const tab = li.dataset.tab;
            if (!tab) {
                li.style.display = '';
                return;
            }
            if (role === 'kitchen') {
                li.style.display = (tab === 'kitchen') ? '' : 'none';
                if (tab === 'kitchen' && !firstTabSet) { this.state.currentTab = 'kitchen'; firstTabSet = true; }
            } else if (role === 'cashier') {
                const hiddenTabsForCashier = ['dashboard', 'reports', 'inventory', 'raw-materials', 'suppliers', 'staff'];
                const isHidden = hiddenTabsForCashier.includes(tab);
                li.style.display = isHidden ? 'none' : '';
                if (!isHidden && !firstTabSet && this.state.currentTab === 'dashboard') {
                    this.state.currentTab = 'pos'; firstTabSet = true;
                }
            } else {
                li.style.display = '';
            }
        });
        
        if (role === 'kitchen' && this.state.currentTab !== 'kitchen') {
            this.state.currentTab = 'kitchen';
        }

        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) settingsBtn.style.display = (role === 'manager') ? '' : 'none';
    }

    /* ====== SHIFT MANAGEMENT ====== */
    _openShiftModal(isEnd) {
        const today = new Date().toLocaleDateString('si-LK');
        const statusCard = document.getElementById('shift-status-card');`;

if (regex.test(c)) {
    c = c.replace(regex, replacement);
    fs.writeFileSync(path, c, 'utf8');
    console.log("Fixed!");
} else {
    console.log("Regex didn't match.");
}
