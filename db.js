const RTDB_URL = "https://tradeconnect-1bb92-default-rtdb.asia-southeast1.firebasedatabase.app";

const DEFAULT_TABLES = [
    { id: 't1',  name: 'මේසය 1',  capacity: 2, status: 'available' },
    { id: 't2',  name: 'මේසය 2',  capacity: 2, status: 'available' },
    { id: 't3',  name: 'මේසය 3',  capacity: 4, status: 'available' },
    { id: 't4',  name: 'මේසය 4',  capacity: 4, status: 'available' },
    { id: 't5',  name: 'මේසය 5',  capacity: 4, status: 'available' },
    { id: 't6',  name: 'මේසය 6',  capacity: 6, status: 'available' },
    { id: 't7',  name: 'මේසය 7',  capacity: 6, status: 'available' },
    { id: 't8',  name: 'මේසය 8',  capacity: 6, status: 'available' },
    { id: 't9',  name: 'VIP කාමරය 1', capacity: 8, status: 'available' },
    { id: 't10', name: 'VIP කාමරය 2', capacity: 10, status: 'available' }
];

const INITIAL_DATA = {
    categories: [
        { id: 'all', name: 'සියල්ල (All)' }
    ],
    products: [],
    tables: [...DEFAULT_TABLES],
    orders: {},
    expenses: {},
    staff: {},
    credits: {},
    loan_customers: {},
    loans: {},
    settings: {
        taxRate: 0,
        currency: 'රු.'
    }
};

class Database {
    constructor() {
        this.data = JSON.parse(localStorage.getItem('ju_pos_data')) || Object.assign({}, INITIAL_DATA);
        
        // Auto-restore default tables if empty
        if (!this.data.tables || this.data.tables.length === 0) {
            this.data.tables = [...DEFAULT_TABLES];
            localStorage.setItem('ju_pos_data', JSON.stringify(this.data));
        }

        if (!this.data.credits) this.data.credits = {};
        if (!this.data.staff) this.data.staff = {};
        if (!this.data.loan_customers) this.data.loan_customers = {};
        if (!this.data.loans) this.data.loans = {};

        this.localOrders = Array.isArray(this.data.orders) ? this.data.orders : Object.values(this.data.orders || {});
        this.localExpenses = Array.isArray(this.data.expenses) ? this.data.expenses : Object.values(this.data.expenses || {});
        this.localStaff = Array.isArray(this.data.staff) ? this.data.staff : Object.values(this.data.staff || {});
        this.localCredits = Array.isArray(this.data.credits) ? this.data.credits : Object.values(this.data.credits || {});
        this.localLoanCustomers = Object.values(this.data.loan_customers || {});
        this.localLoans = Object.values(this.data.loans || {});
    }

    async init() {
        // Flush any offline writes first
        this._startOnlineListener();
        try {
            const r = await fetch(RTDB_URL + '/.json', {signal: AbortSignal.timeout(8000)});
            const cloudData = await r.json();
            
            if (cloudData && cloudData.error) {
                console.error("Firebase Error:", cloudData.error);
                throw new Error(cloudData.error);
            }
            
            if (!cloudData || !cloudData.settings || !cloudData.products || cloudData.products.length === 0) {
                await fetch(RTDB_URL + '/.json', { method: 'PUT', body: JSON.stringify(this.data) });
            } else {
                cloudData.categories = cloudData.categories || [];
                cloudData.products = cloudData.products || [];
                cloudData.tables = cloudData.tables || [];
                cloudData.orders = cloudData.orders || {};
                cloudData.expenses = cloudData.expenses || {};
                cloudData.staff = cloudData.staff || {};
                cloudData.credits = cloudData.credits || {};
                cloudData.loan_customers = cloudData.loan_customers || {};
                cloudData.loans = cloudData.loans || {};

                this.localOrders = Object.values(cloudData.orders);
                this.localExpenses = Object.values(cloudData.expenses);
                this.localStaff = Object.values(cloudData.staff);
                this.localCredits = Object.values(cloudData.credits);
                this.localLoanCustomers = Object.values(cloudData.loan_customers);
                this.localLoans = Object.values(cloudData.loans);

                this.data = cloudData;
                localStorage.setItem('ju_pos_data', JSON.stringify(this.data));
            }
            // Flush any pending offline writes now that we're online
            await this.flushOfflineQueue();
        } catch(e) {
            console.warn("Offline/Cloud error — using locally cached data.", e.message);
        }
    }

    async poll() {
        try {
            const r = await fetch(RTDB_URL + '/.json', {signal: AbortSignal.timeout(6000)});
            const cloudData = await r.json();
            
            if (cloudData && cloudData.error) {
                return; // Silent fail on permission denied
            }
            
            if (cloudData) {
                // *** MERGE strategy: cloud + local combined, local items win if not in cloud ***
                // This prevents auto-clear of offline/pending data during polling

                this.data.tables = cloudData.tables || this.data.tables || [];

                // Orders: merge cloud + local (union by id)
                const cloudOrders = cloudData.orders || {};
                const localOrderObj = this.data.orders || {};
                const mergedOrders = { ...localOrderObj, ...cloudOrders };
                this.data.orders = mergedOrders;
                this.localOrders = Object.values(mergedOrders);

                // Expenses: merge
                const cloudExp = cloudData.expenses || {};
                const mergedExp = { ...( this.data.expenses || {} ), ...cloudExp };
                this.data.expenses = mergedExp;
                this.localExpenses = Object.values(mergedExp);

                // Staff: merge
                const cloudStaff = cloudData.staff || {};
                const mergedStaff = { ...( this.data.staff || {} ), ...cloudStaff };
                this.data.staff = mergedStaff;
                this.localStaff = Object.values(mergedStaff);

                // Credits: merge
                const cloudCredits = cloudData.credits || {};
                const mergedCredits = { ...( this.data.credits || {} ), ...cloudCredits };
                this.data.credits = mergedCredits;
                this.localCredits = Object.values(mergedCredits);

                // Loan Customers: merge (IMPORTANT - prevents auto-clear)
                const cloudLoanCust = cloudData.loan_customers || {};
                const mergedLoanCust = { ...( this.data.loan_customers || {} ), ...cloudLoanCust };
                this.data.loan_customers = mergedLoanCust;
                this.localLoanCustomers = Object.values(mergedLoanCust);

                // Loans: merge (IMPORTANT - prevents auto-clear)
                const cloudLoans = cloudData.loans || {};
                const mergedLoans = { ...( this.data.loans || {} ), ...cloudLoans };
                this.data.loans = mergedLoans;
                this.localLoans = Object.values(mergedLoans);

                // Settings & Products: use cloud if set, else keep local
                if (cloudData.settings) this.data.settings = cloudData.settings;
                if (cloudData.products && cloudData.products.length > 0) this.data.products = cloudData.products;
                if (cloudData.categories && cloudData.categories.length > 0) this.data.categories = cloudData.categories;

                localStorage.setItem('ju_pos_data', JSON.stringify(this.data));
                if (window.App && typeof window.App.renderView === 'function') {
                    window.App.renderView();
                }
            }
        } catch(e) {
            // offline — silent fail
        }
    }

    async pushToCloud(path, payload, method="PUT") {
        // Always save to localStorage immediately (offline-first)
        localStorage.setItem('ju_pos_data', JSON.stringify(this.data));
        if (!navigator.onLine) {
            this._queueWrite(path, payload, method);
            return;
        }
        try {
            const res = await fetch(`${RTDB_URL}/${path}.json`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(8000)
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
        } catch (e) {
            // Network failed — queue for retry
            this._queueWrite(path, payload, method);
        }
    }

    _queueWrite(path, payload, method) {
        const queue = JSON.parse(localStorage.getItem('ju_offline_queue') || '[]');
        queue.push({ path, payload, method, ts: Date.now() });
        localStorage.setItem('ju_offline_queue', JSON.stringify(queue));
        console.log(`[Offline] Queued write: ${method} ${path}`);
    }

    async flushOfflineQueue() {
        const queue = JSON.parse(localStorage.getItem('ju_offline_queue') || '[]');
        if (!queue.length) return;
        const failed = [];
        for (const op of queue) {
            try {
                const res = await fetch(`${RTDB_URL}/${op.path}.json`, {
                    method: op.method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(op.payload),
                    signal: AbortSignal.timeout(8000)
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
            } catch(e) {
                failed.push(op);
            }
        }
        localStorage.setItem('ju_offline_queue', JSON.stringify(failed));
        if (failed.length === 0 && queue.length > 0) {
            console.log(`[Sync] Flushed ${queue.length} offline write(s) ✅`);
        }
    }

    _startOnlineListener() {
        window.addEventListener('online', async () => {
            console.log('[Network] Back online — flushing queue...');
            await this.flushOfflineQueue();
            await this.poll();
            if (window.App) window.App.showToast('🌐 Online — Data synced!', 'success');
        });
        window.addEventListener('offline', () => {
            if (window.App) window.App.showToast('📴 Offline mode — data saved locally', 'warning');
        });
    }

    getData() { return this.data; }

    /* Products */
    getProducts(category = 'all') {
        if (category === 'all') return this.data.products;
        return this.data.products.filter(p => p.category === category);
    }

    addProduct(product) {
        this.data.products.push(product);
        this.pushToCloud('products', this.data.products);
    }

    updateProduct(id, updatedProduct) {
        const idx = this.data.products.findIndex(p => p.id === id);
        if (idx !== -1) {
            this.data.products[idx] = { ...this.data.products[idx], ...updatedProduct };
            this.pushToCloud(`products/${idx}`, this.data.products[idx]);
        }
    }

    deleteProduct(id) {
        this.data.products = this.data.products.filter(p => p.id !== id);
        this.pushToCloud('products', this.data.products);
    }

    /* Categories & Settings */
    getCategories() { return this.data.categories; }
    
    saveSettings(settings) {
        this.data.settings = settings;
        this.pushToCloud('settings', this.data.settings);
    }

    /* Tables */
    getTables() { return this.data.tables; }
    addTable(table) {
        if (!this.data.tables) this.data.tables = [];
        table.id = 'tbl_' + Date.now();
        table.status = 'available';
        this.data.tables.push(table);
        this.pushToCloud('tables', this.data.tables);
        return table.id;
    }
    deleteTable(id) {
        this.data.tables = this.data.tables.filter(t => t.id !== id);
        this.pushToCloud('tables', this.data.tables);
    }
    updateTableName(id, name, capacity) {
        const t = this.data.tables.find(t => t.id === id);
        if (t) { t.name = name; t.capacity = capacity; this.pushToCloud('tables', this.data.tables); }
    }

    /* Orders & KDS */
    getOrders() { return this.localOrders; }

    placeOrder(order) {
        this.data.orders[order.id] = order;
        this.localOrders.push(order);
        this.pushToCloud(`orders/${order.id}`, order);
        
        if(order.type === 'dine-in' && order.tableId) {
            const tIdx = this.data.tables.findIndex(t => t.id === order.tableId);
            if(tIdx !== -1) {
                this.data.tables[tIdx].status = 'occupied';
                this.pushToCloud(`tables/${tIdx}/status`, "occupied");
            }
        }
        
        order.items.forEach(item => {
            const pIdx = this.data.products.findIndex(p => p.id === item.id);
            if(pIdx !== -1 && this.data.products[pIdx].stock !== undefined) {
                this.data.products[pIdx].stock -= item.qty;
                this.pushToCloud(`products/${pIdx}/stock`, this.data.products[pIdx].stock);
            }
        });
    }

    updateOrderStatus(orderId, kdsStatus) {
        const o = this.data.orders[orderId];
        const idx = this.localOrders.findIndex(o => o.id === orderId);
        
        if (o && idx !== -1) {
            o.kdsStatus = kdsStatus;
            this.localOrders[idx].kdsStatus = kdsStatus;
            this.pushToCloud(`orders/${orderId}/kdsStatus`, kdsStatus);
            
            if(kdsStatus === 'completed' && o.type === 'dine-in') {
                const tIdx = this.data.tables.findIndex(t => t.id === o.tableId);
                if(tIdx !== -1) {
                    this.data.tables[tIdx].status = 'available';
                    this.pushToCloud(`tables/${tIdx}/status`, "available");
                }
            }
        }
    }

    /* Staff */
    getStaff() { return this.localStaff; }
    addStaff(s) {
        this.data.staff[s.id] = s;
        this.localStaff.push(s);
        this.pushToCloud(`staff/${s.id}`, s);
    }
    deleteStaff(id) {
        delete this.data.staff[id];
        this.localStaff = this.localStaff.filter(x => x.id !== id);
        this.pushToCloud(`staff/${id}`, null, "DELETE");
    }
    updateStaff(id, updatedStaff) {
        if(this.data.staff[id]) {
            this.data.staff[id] = { ...this.data.staff[id], ...updatedStaff };
            const idx = this.localStaff.findIndex(s => s.id === id);
            if(idx !== -1) this.localStaff[idx] = this.data.staff[id];
            this.pushToCloud(`staff/${id}`, this.data.staff[id]);
        }
    }

    /* Expenses */
    getExpenses() { return this.localExpenses; }
    addExpense(e) {
        this.data.expenses[e.id] = e;
        this.localExpenses.push(e);
        this.pushToCloud(`expenses/${e.id}`, e);
    }
    deleteExpense(id) {
        delete this.data.expenses[id];
        this.localExpenses = this.localExpenses.filter(x => x.id !== id);
        this.pushToCloud(`expenses/${id}`, null, "DELETE");
    }

    /* Credits (legacy simple) */
    getCredits() { return this.localCredits; }
    saveCredit(credit) {
        if (!this.data.credits) this.data.credits = {};
        const idx = this.localCredits.findIndex(c => c.id === credit.id);
        if(idx !== -1) {
            this.data.credits[credit.id] = { ...this.data.credits[credit.id], ...credit };
            this.localCredits[idx] = this.data.credits[credit.id];
        } else {
            this.data.credits[credit.id] = credit;
            this.localCredits.push(credit);
        }
        this.pushToCloud(`credits/${credit.id}`, this.data.credits[credit.id]);
    }

    /* ---- LOAN CUSTOMERS ---- */
    getLoanCustomers() { return this.localLoanCustomers; }
    saveLoanCustomer(cust) {
        if(!this.data.loan_customers) this.data.loan_customers = {};
        const isNew = !cust.id;
        if(isNew) cust.id = 'lc_' + Date.now();
        this.data.loan_customers[cust.id] = cust;
        const idx = this.localLoanCustomers.findIndex(c => c.id === cust.id);
        if(idx !== -1) this.localLoanCustomers[idx] = cust;
        else this.localLoanCustomers.push(cust);
        this.pushToCloud(`loan_customers/${cust.id}`, cust);
        return cust.id;
    }
    deleteLoanCustomer(id) {
        delete this.data.loan_customers[id];
        this.localLoanCustomers = this.localLoanCustomers.filter(c => c.id !== id);
        this.pushToCloud(`loan_customers/${id}`, null, 'DELETE');
    }

    /* ---- LOANS ---- */
    getLoans() { return this.localLoans; }
    saveLoan(loan) {
        if(!this.data.loans) this.data.loans = {};
        const isNew = !loan.id;
        if(isNew) loan.id = 'ln_' + Date.now();
        this.data.loans[loan.id] = loan;
        const idx = this.localLoans.findIndex(l => l.id === loan.id);
        if(idx !== -1) this.localLoans[idx] = loan;
        else this.localLoans.push(loan);
        this.pushToCloud(`loans/${loan.id}`, loan);
        return loan.id;
    }
    patchLoan(id, patch) {
        if(!this.data.loans[id]) return;
        this.data.loans[id] = { ...this.data.loans[id], ...patch };
        const idx = this.localLoans.findIndex(l => l.id === id);
        if(idx !== -1) this.localLoans[idx] = this.data.loans[id];
        this.pushToCloud(`loans/${id}`, this.data.loans[id]);
    }
    deleteLoan(id) {
        delete this.data.loans[id];
        this.localLoans = this.localLoans.filter(l => l.id !== id);
        this.pushToCloud(`loans/${id}`, null, 'DELETE');
    }

    /* Metrics with Expense & Discounts */
    getMetrics(dateStr = new Date().toDateString()) {
        const dateOrders = this.localOrders.filter(o => new Date(o.timestamp).toDateString() === dateStr && o.kdsStatus === 'completed');
        const dateExpenses = this.localExpenses.filter(e => new Date(e.timestamp).toDateString() === dateStr);

        let cogs = 0;
        const revenue = dateOrders.reduce((sum, o) => {
            o.items.forEach(i => {
                const prod = this.data.products.find(p => p.id === i.id);
                if(prod && prod.costPrice > 0) cogs += (prod.costPrice * i.qty);
            });
            return sum + o.total;
        }, 0);

        const ordersCount = dateOrders.length;
        const avgValue = ordersCount > 0 ? revenue / ordersCount : 0;
        
        const totalExpenses = dateExpenses.reduce((sum, e) => sum + e.amount, 0);
        const profit = revenue - cogs - totalExpenses;

        const activeTables = this.data.tables.filter(t => t.status === 'occupied').length;
        
        return {
            revenue: Math.max(0, revenue),
            orders: ordersCount,
            avgValue: Math.round(avgValue),
            activeTables,
            totalTables: this.data.tables.length,
            totalExpenses,
            profit
        };
    }

    /* ---- BACKUP DOWNLOAD ---- */
    downloadBackup() {
        const backup = {
            exportedAt: new Date().toISOString(),
            version: 'sobamin-pos-v1',
            data: this.data
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `sobamin-backup-${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
        if (window.App) window.App.showToast('📥 Backup file download වෙමින් පවතී...', 'success');
    }
}

const db = new Database();
