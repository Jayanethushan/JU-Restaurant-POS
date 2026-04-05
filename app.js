class AppCore {
    constructor() {
        this.state = {
            currentTab: 'pos',
            cart: [],
            orderType: 'dine-in',
            activeCategory: 'all',
            searchQuery: '',
            selectedTableId: null,
            discount: { val: 0, type: 'amount' },
            serviceCharge: { val: 0, type: 'amount' },
            deliveryCharge: 0,
            deliveryLocation: null  // { lat, lng, name, distance }
        };
        
        this.elements = {
            viewContainer: document.getElementById('view-container'),
            navLinks: document.querySelectorAll('.nav-links li'),
            typeBtns: document.querySelectorAll('.type-btn'),
            cartSidebar: document.getElementById('cart-sidebar'),
            appContainer: document.getElementById('app-container'),
            clock: document.getElementById('live-clock'),
            tableSelect: document.getElementById('cart-table-select'),
            checkoutBtn: document.getElementById('checkout-btn'),
            discVal: document.getElementById('discount-val'),
            discType: document.getElementById('discount-type'),
            scVal: document.getElementById('service-charge-val'),
            scType: document.getElementById('service-charge-type')
        };
        
        this.init();
    }

    init() {
        this.startClock();
        this.bindEvents();
        this.renderView();
        this.updateCartUI();
    }

    startClock() {
        setInterval(() => {
            const now = new Date();
            this.elements.clock.textContent = now.toLocaleTimeString('en-US', { hour12: false });
            // Refresh Kitchen View every minute automatically to reflect Live Timer colours
            if(this.state.currentTab === 'kitchen') {
                this.renderKitchen(this.elements.viewContainer, false);
            }
        }, 1000);
    }

    bindEvents() {
        this.elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                this.elements.navLinks.forEach(l => l.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');
                this.state.currentTab = target.dataset.tab;
                this.renderView();
            });
        });

        this.elements.typeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.elements.typeBtns.forEach(b => b.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');
                this.state.orderType = target.dataset.type;
                
                if(this.state.orderType === 'dine-in') {
                    this.elements.tableSelect.style.display = 'block';
                    this.populateTableSelect();
                } else {
                    this.elements.tableSelect.style.display = 'none';
                    this.state.selectedTableId = null;
                }

                // Show map modal for delivery
                if(this.state.orderType === 'delivery') {
                    this.openDeliveryMap();
                } else {
                    // Reset delivery charge when switching away
                    this.state.deliveryCharge = 0;
                    this.state.deliveryLocation = null;
                    this.updateCartUI();
                }
            });
        });

        if(this.elements.tableSelect) {
            this.elements.tableSelect.addEventListener('change', (e) => {
                this.state.selectedTableId = e.target.value;
            });
        }
        
        if(this.elements.checkoutBtn) {
            this.elements.checkoutBtn.addEventListener('click', () => this.handleCheckout());
        }

        document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const overlay = e.currentTarget.closest('.modal-overlay');
                if (overlay) overlay.classList.remove('active');
            });
        });

        document.getElementById('settings-btn').addEventListener('click', () => {
            const data = db.getData();
            const settings = data.settings || {};
            document.getElementById('set-tax').value = settings.taxRate || 0;
            document.getElementById('set-currency').value = settings.currency || 'රු.';
            document.getElementById('settings-modal').classList.add('active');
            requestAnimationFrame(() => lucide.createIcons());
        });

        // Discount Triggers
        if(this.elements.discVal) {
            this.elements.discVal.addEventListener('input', (e) => {
                this.state.discount.val = parseFloat(e.target.value) || 0;
                this.updateCartUI();
            });
        }
        if(this.elements.discType) {
            this.elements.discType.addEventListener('change', (e) => {
                this.state.discount.type = e.target.value;
                this.updateCartUI();
            });
        }
        
        if(this.elements.scVal) {
            this.elements.scVal.addEventListener('input', (e) => {
                this.state.serviceCharge.val = parseFloat(e.target.value) || 0;
                this.updateCartUI();
            });
        }
        if(this.elements.scType) {
            this.elements.scType.addEventListener('change', (e) => {
                this.state.serviceCharge.type = e.target.value;
                this.updateCartUI();
            });
        }

        // Connect modals for staff and expenses
        const staffSaveBtn = document.getElementById('save-staff-btn');
        if(staffSaveBtn) {
            staffSaveBtn.addEventListener('click', (e) => { e.preventDefault(); this.handleStaffSave(); });
        }
        const expSaveBtn = document.getElementById('save-exp-btn');
        if(expSaveBtn) {
            expSaveBtn.addEventListener('click', (e) => { e.preventDefault(); this.handleExpSave(); });
        }

        const btnAddLoan = document.getElementById('btn-add-loan');
        if(btnAddLoan) btnAddLoan.addEventListener('click', () => this.handleFinanceLoanAdd());

        const btnPaySalary = document.getElementById('btn-pay-salary');
        if(btnPaySalary) btnPaySalary.addEventListener('click', () => this.handleFinancePaySalary());

        const btnConfirmCredit = document.getElementById('confirm-credit-btn');
        if (btnConfirmCredit) btnConfirmCredit.addEventListener('click', () => this.processCreditCheckout());

        const btnSubmitCreditPay = document.getElementById('btn-submit-credit-pay');
        if (btnSubmitCreditPay) btnSubmitCreditPay.addEventListener('click', () => this.submitCreditPayment());

        const finInputs = ['finance-deduct-loan', 'finance-bonus'];
        finInputs.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('input', () => this.calcNetSalary());
        });

        // Delivery map confirm button
        const confirmDelivBtn = document.getElementById('confirm-delivery-location-btn');
        if(confirmDelivBtn) {
            confirmDelivBtn.addEventListener('click', () => {
                document.getElementById('delivery-map-modal').classList.remove('active');
                this.updateCartUI();
                if(this.state.deliveryLocation) {
                    const loc = this.state.deliveryLocation;
                    this.showToast(`📍 ${loc.name} | ${loc.distance.toFixed(1)} km | රු. ${this.state.deliveryCharge.toFixed(0)}`, 'success');
                }
            });
        }
    }

    showToast(message, type='success') {
        const container = document.getElementById('toast-container');
        if(!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = type === 'success' ? 'check-circle' : (type==='warning'?'alert-triangle':'alert-circle');
        toast.innerHTML = `<i data-lucide="${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);
        lucide.createIcons();

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /* ---- DELIVERY MAP ---- */
    haversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    openDeliveryMap() {
        const HOTEL_LAT = 7.75889, HOTEL_LNG = 80.5683, RATE = 200;
        const modal = document.getElementById('delivery-map-modal');
        modal.classList.add('active');
        lucide.createIcons();

        const initMap = (startLat, startLng, isGPS) => {
            // Satellite tiles - maxNativeZoom:19 + maxZoom:21 fixes tile load at high zoom
            const satelliteLayer = L.tileLayer(
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                { attribution: 'Tiles &copy; Esri', maxZoom: 21, maxNativeZoom: 19 }
            );
            const labelsLayer = L.tileLayer(
                'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
                { attribution: '', maxZoom: 21, maxNativeZoom: 19, opacity: 0.7 }
            );
            const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap', maxZoom: 21, maxNativeZoom: 19
            });

            const map = L.map('delivery-map', {
                layers: [satelliteLayer, labelsLayer],
                maxZoom: 21
            }).setView([startLat, startLng], 15);

            L.control.layers(
                { '\uD83D\uDEF0\uFE0F Satellite': L.layerGroup([satelliteLayer, labelsLayer]), '\uD83D\uDDFA\uFE0F Street': streetLayer },
                {}, { position: 'topright', collapsed: false }
            ).addTo(map);

            // Hotel marker (cyan pulsing)
            const hotelIcon = L.divIcon({
                html: '<div style="width:18px;height:18px;background:#00e5ff;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 0 rgba(0,229,255,0.6);animation:mapPulse 1.5s infinite;"></div><style>@keyframes mapPulse{0%{box-shadow:0 0 0 0 rgba(0,229,255,0.6)}70%{box-shadow:0 0 0 10px rgba(0,229,255,0)}100%{box-shadow:0 0 0 0 rgba(0,229,255,0)}}</style>',
                iconSize: [18, 18], iconAnchor: [9, 9], className: ''
            });
            L.marker([HOTEL_LAT, HOTEL_LNG], { icon: hotelIcon })
                .addTo(map)
                .bindPopup('<b style="color:#00e5ff;">\uD83C\uDFE8 Sobamin Hotel</b><br><small>Galewela</small>');

            // GPS user location marker (green)
            if (isGPS) {
                const gpsIcon = L.divIcon({
                    html: '<div style="width:14px;height:14px;background:#00e676;border-radius:50%;border:3px solid #fff;box-shadow:0 0 8px #00e676;"></div>',
                    iconSize: [14, 14], iconAnchor: [7, 7], className: ''
                });
                L.marker([startLat, startLng], { icon: gpsIcon })
                    .addTo(map)
                    .bindPopup('<b style="color:#00e676;">\uD83D\uDCF1 \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0D8A\u0DB1\u0DCA\u0DB1 \u0DAD\u0DD4\u0DCA\u0DBB</b>').openPopup();
            }

            let destMarker = null, routeLayer = null;

            map.on('click', async (e) => {
                const { lat, lng } = e.latlng;
                if (destMarker) map.removeLayer(destMarker);
                if (routeLayer) map.removeLayer(routeLayer);

                document.getElementById('delivery-info-bar').style.display = 'block';
                document.getElementById('delivery-distance-text').textContent = '...';
                document.getElementById('delivery-fee-text').textContent = '\u0D9C\u0DAB\u0DB1\u0DBA \u0D9A\u0DBB\u0DB8\u0DD2\u0DB1\u0DCA...';
                document.getElementById('delivery-loc-name').textContent = '\u0DC3\u0DDC\u0DBA\u0DB8\u0DD2\u0DB1\u0DCA...';
                document.getElementById('confirm-delivery-location-btn').disabled = true;

                const destIcon = L.divIcon({
                    html: '<div style="width:18px;height:18px;background:#ff3366;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px #ff3366;"></div>',
                    iconSize: [18, 18], iconAnchor: [9, 9], className: ''
                });
                destMarker = L.marker([lat, lng], { icon: destIcon }).addTo(map);

                // OSRM road routing
                let roadDistKm = null;
                try {
                    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${HOTEL_LNG},${HOTEL_LAT};${lng},${lat}?overview=full&geometries=geojson`;
                    const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(8000) });
                    const osrmData = await osrmRes.json();
                    if (osrmData.code === 'Ok' && osrmData.routes.length > 0) {
                        roadDistKm = osrmData.routes[0].distance / 1000;
                        routeLayer = L.geoJSON(osrmData.routes[0].geometry, {
                            style: { color: '#00e5ff', weight: 4, opacity: 0.85, lineJoin: 'round', lineCap: 'round' }
                        }).addTo(map);
                        map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
                    }
                } catch (err) { console.warn('OSRM fail:', err); }

                const dist = roadDistKm !== null ? roadDistKm : this.haversineDistance(HOTEL_LAT, HOTEL_LNG, lat, lng);
                const isFallback = roadDistKm === null;
                const charge = Math.round(Math.max(1, dist) * RATE);
                this.state.deliveryCharge = charge;
                this.state.deliveryLocation = { lat, lng, distance: dist, name: '\u0DC3\u0DDC\u0DBA\u0DB8\u0DD2\u0DB1\u0DCA...' };

                document.getElementById('delivery-distance-text').textContent = dist.toFixed(2) + ' km' + (isFallback ? ' *' : ' \uD83D\uDEE3\uFE0F');
                document.getElementById('delivery-fee-text').textContent = '\u0DBB\u0DD4. ' + charge;
                document.getElementById('confirm-delivery-location-btn').disabled = false;

                if (isFallback) {
                    routeLayer = L.polyline([[HOTEL_LAT, HOTEL_LNG], [lat, lng]], {
                        color: '#ffaa00', weight: 2.5, dashArray: '8,6', opacity: 0.7
                    }).addTo(map);
                }

                // Reverse geocode
                try {
                    const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`, { signal: AbortSignal.timeout(5000) });
                    const geoData = await geo.json();
                    const name = (geoData.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`).split(',').slice(0, 3).join(', ');
                    this.state.deliveryLocation.name = name;
                    document.getElementById('delivery-loc-name').textContent = name;
                    destMarker.bindPopup(`<b>\uD83D\uDCCD ${name}</b><br>\uD83D\uDCCF ${dist.toFixed(2)} km ${isFallback ? '(approximate)' : '\uD83D\uDEE3\uFE0F road'}<br>\uD83D\uDEB5 \u0DBB\u0DD4. ${charge}`).openPopup();
                } catch {
                    const name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                    this.state.deliveryLocation.name = name;
                    document.getElementById('delivery-loc-name').textContent = name;
                }
            });

            this._deliveryMap = map;
        };

        if (!this._deliveryMap) {
            // Try GPS first, fallback to hotel coords
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => setTimeout(() => initMap(pos.coords.latitude, pos.coords.longitude, true), 300),
                    ()    => setTimeout(() => initMap(HOTEL_LAT, HOTEL_LNG, false), 300),
                    { timeout: 6000, maximumAge: 60000 }
                );
            } else {
                setTimeout(() => initMap(HOTEL_LAT, HOTEL_LNG, false), 300);
            }
        } else {
            setTimeout(() => this._deliveryMap.invalidateSize(), 200);
        }
    }



    getCurrency() { return db.getData().settings?.currency || 'රු.'; }
    getTaxRate() { return db.getData().settings?.taxRate ?? 10; }

    saveSettings() {
        const t = parseFloat(document.getElementById('set-tax').value) || 0;
        const c = document.getElementById('set-currency').value || 'රු.';
        const data = db.getData();
        data.settings = { taxRate: t, currency: c };
        db.saveSettings(data.settings);
        document.getElementById('settings-modal').classList.remove('active');
        this.showToast('සැකසුම් සාර්ථකව සුරැකිණි');
        this.updateCartUI();
    }

    async connectPrinter() {
        try {
            if (!navigator.bluetooth) {
                return this.showToast('ඔබේ උපාංගය Bluetooth සහය නොදක්වයි!', 'error');
            }
            this.showToast('Printer එක සෙවීම ආරම්භ කරමින්...', 'warning');
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] // generic serial
            });
            this.showToast(`Printer (${device.name || 'Unknown'}) සම්බන්ධ විය!`, 'success');
        } catch (e) {
            this.showToast('Printer සම්බන්ධ කිරීම අවලංගු විය ගැලපෙන ආකෘතියක් නොමැත!', 'error');
        }
    }

    connectScanner() {
        this.showToast('බාකෝඩ් ස්කෑනරය සඳහා USB අතුරු මුහුණත සක්‍රීය කර ඇත. කරුණාකර ස්කෑන් කරන්න.', 'success');
    }

    async fullDataReset() {
        const step1 = confirm('⚠️ අවවාදයයි!\n\nOrders, Products, Staff, Credits, Loans, Expenses - සියලු data සදහටම delete වේ.\n\nදිගටම කරගෙන යාමට OK press කරන්න.');
        if (!step1) return;

        const step2 = confirm('🔴 අවසාන තහවුරුව!\n\nමෙය undo කළ නොහැක. Reset කිරීමට හරිද?\n\n(Backup download කළාද? නැත්නම් Cancel click කර Settings > Backup ලබාගන්න)');
        if (!step2) return;

        document.getElementById('settings-modal').classList.remove('active');
        this.showToast('⏳ Data reset වෙමින්... කරුණාකර රැඳෙන්න', 'warning');

        const RTDB_URL = "https://tradeconnect-1bb92-default-rtdb.asia-southeast1.firebasedatabase.app";
        const CLEAN = {
            categories: [{ id: 'all', name: 'සියල්ල (All)' }],
            products: [],
            tables: [
                { id:'t1', name:'මේසය 1', capacity:2, status:'available' },
                { id:'t2', name:'මේසය 2', capacity:2, status:'available' },
                { id:'t3', name:'මේසය 3', capacity:4, status:'available' },
                { id:'t4', name:'මේසය 4', capacity:4, status:'available' },
                { id:'t5', name:'මේසය 5', capacity:4, status:'available' },
                { id:'t6', name:'මේසය 6', capacity:6, status:'available' },
                { id:'t7', name:'මේසය 7', capacity:6, status:'available' },
                { id:'t8', name:'මේසය 8', capacity:6, status:'available' },
                { id:'t9', name:'VIP කාමරය 1', capacity:8, status:'available' },
                { id:'t10', name:'VIP කාමරය 2', capacity:10, status:'available' }
            ],
            orders:{}, expenses:{}, staff:{}, credits:{}, loan_customers:{}, loans:{},
            settings:{ taxRate:0, currency:'රු.' }
        };

        // 1. Firebase reset
        try {
            await fetch(RTDB_URL + '/.json', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(CLEAN),
                signal: AbortSignal.timeout(10000)
            });
        } catch(e) { console.warn('Firebase reset warning:', e.message); }

        // 2. Clear localStorage & session
        localStorage.removeItem('ju_pos_data');
        localStorage.removeItem('ju_offline_queue');

        // 3. Clear SW cache
        if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map(n => caches.delete(n)));
        }
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
        }

        alert('✅ සියලු data සාර්ථකව reset කළා!\nPage refresh වේ...');
        window.location.reload();
    }

    renderView() {
        const container = this.elements.viewContainer;
        container.innerHTML = '';
        requestAnimationFrame(() => lucide.createIcons());

        if (this.state.currentTab === 'pos') {
            this.elements.cartSidebar.classList.remove('hidden');
            this.elements.appContainer.classList.remove('hide-cart');
            if(this.state.orderType === 'dine-in') this.populateTableSelect();
        } else {
            this.elements.cartSidebar.classList.add('hidden');
            this.elements.appContainer.classList.add('hide-cart');
        }

        switch (this.state.currentTab) {
            case 'pos': this.renderPOS(container); break;
            case 'tables': this.renderTables(container); break;
            case 'kitchen': this.renderKitchen(container, true); break;
            case 'dashboard': this.renderDashboard(container); break;
            case 'reports': this.renderReports(container); break;
            case 'inventory': this.renderInventory(container); break;
            case 'staff': this.renderStaff(container); break;
            case 'credits': this.renderCredits(container); break;
        }
    }

    /* --- POS MODULE --- */
    renderPOS(container) {
        const header = document.createElement('div');
        header.className = 'view-header';
        header.innerHTML = `
            <h2>විකුණුම් (POS)</h2>
            <div class="search-bar">
                <i data-lucide="search"></i>
                <input type="text" id="product-search" placeholder="අයිතම සොයන්න..." value="${this.state.searchQuery}">
            </div>
        `;
        container.appendChild(header);

        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'category-chips';
        const categories = db.getCategories();
        categories.forEach(cat => {
            const chip = document.createElement('button');
            chip.className = `chip ${this.state.activeCategory === cat.id ? 'active' : ''}`;
            chip.textContent = cat.name;
            chip.addEventListener('click', () => {
                this.state.activeCategory = cat.id;
                this.renderView();
            });
            chipsContainer.appendChild(chip);
        });
        container.appendChild(chipsContainer);

        const grid = document.createElement('div');
        grid.className = 'product-grid';
        const products = db.getProducts(this.state.activeCategory);
        
        const filtered = products.filter(p => p.name.toLowerCase().includes(this.state.searchQuery.toLowerCase()));
        const currency = this.getCurrency();

        filtered.forEach(prod => {
            const card = document.createElement('div');
            card.className = 'product-card';
            
            const isOutOfStock = prod.stock !== undefined && prod.stock <= 0;
            if(isOutOfStock) {
                card.style.opacity = '0.5';
            } else if (prod.stock !== undefined && prod.stock <= 5) {
                card.style.border = '1px solid var(--accent-danger)';
                card.style.boxShadow = '0 0 10px rgba(255,51,102,0.3)';
            }

            card.innerHTML = `
                <div class="product-img-wrapper">
                    <img src="${prod.image}" alt="${prod.name}" class="product-img" onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'">
                    ${prod.stock !== undefined ? `<div class="product-stock ${prod.stock<=5?'glow-text':''}" style="color:${prod.stock<=5?'var(--accent-danger)':'var(--text-primary)'}">තොගය: ${prod.stock}</div>` : ''}
                </div>
                <div class="product-info">
                    <div class="product-title">${prod.name}</div>
                    <div class="product-price">
                        <span>${currency} ${parseFloat(prod.price).toFixed(2)}</span>
                        <button class="add-btn" ${isOutOfStock?'disabled':''}><i data-lucide="plus" style="width:16px;height:16px;"></i></button>
                    </div>
                </div>
            `;
            
            if(!isOutOfStock) {
                card.addEventListener('click', () => {
                    if (prod.modifiers && prod.modifiers.length > 0) {
                        this.showModifierModal(prod);
                    } else {
                        this.addToCart(prod);
                    }
                });
            }
            grid.appendChild(card);
        });
        
        if(filtered.length === 0) {
            grid.innerHTML = `<div class="empty-cart" style="grid-column: 1/-1;">"${this.state.searchQuery}" සඳහා අයිතම හමු නොවීය.</div>`;
        }
        
        container.appendChild(grid);

        setTimeout(() => {
            const sInput = document.getElementById('product-search');
            if(sInput) {
                sInput.addEventListener('input', (e) => {
                    this.state.searchQuery = e.target.value;
                    this.renderView();
                    const el = document.getElementById('product-search');
                    if(el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
                });
            }
        }, 10);
    }

    addToCart(product, modifiers = null) {
        if(product.stock !== undefined && product.stock <= 0) {
            return this.showToast('තොග අවසන් වී ඇත!', 'error');
        }

        const existing = this.state.cart.find(i => i.id === product.id && i.modifiers === modifiers);
        if (existing) {
            if(product.stock !== undefined && existing.qty + 1 > product.stock) return this.showToast('තොග සීමාව ඉක්මවිය නොහැක', 'error');
            existing.qty += 1;
        } else {
            this.state.cart.push({ ...product, qty: 1, modifiers });
        }
        this.updateCartUI();
        this.showToast(`${product.name} එක් කරන ලදී`, 'success');
    }

    updateCartItemQty(index, delta) {
        const item = this.state.cart[index];
        if(delta > 0) {
            const prodRef = db.getProducts('all').find(p => p.id === item.id);
            if(prodRef && prodRef.stock !== undefined && (item.qty + delta) > prodRef.stock) {
                 return this.showToast('තොග සීමාව ඉක්මවිය නොහැක', 'error');
            }
        }
        
        if(item.qty + delta > 0) {
            item.qty += delta;
        } else {
            this.state.cart.splice(index, 1);
        }
        this.updateCartUI();
    }

    removeCartItem(index) {
        this.state.cart.splice(index, 1);
        this.updateCartUI();
    }

    updateCartUI() {
        const cartItemsContainer = document.getElementById('cart-items');
        if(!cartItemsContainer) return;

        cartItemsContainer.innerHTML = '';
        
        let subtotal = 0;
        let totalQty = 0;
        const currency = this.getCurrency();

        if (this.state.cart.length === 0) {
            cartItemsContainer.innerHTML = '<div class="empty-cart">ඇණවුම හිස්</div>';
        } else {
            this.state.cart.forEach((item, index) => {
                const itemTotal = item.price * item.qty;
                subtotal += itemTotal;
                totalQty += item.qty;

                const modifierHtml = item.modifiers ? `<br><small style="color:var(--text-secondary);font-size:0.75rem;">(+ ${item.modifiers})</small>` : '';

                const div = document.createElement('div');
                div.className = 'cart-item-card';
                div.innerHTML = `
                    <button class="remove-item-btn" data-idx="${index}"><i data-lucide="x"></i></button>
                    <div class="cart-item-header" style="padding-top:8px;">
                        <span class="cart-item-name">${item.name} ${modifierHtml}</span>
                        <span class="cart-item-price">${currency} ${itemTotal.toFixed(2)}</span>
                    </div>
                    <div class="cart-item-controls">
                        <span style="font-size: 0.8rem; color: var(--text-secondary)">${currency} ${item.price} x ${item.qty}</span>
                        <div class="qty-controls">
                            <button class="qty-btn minus" data-idx="${index}"><i data-lucide="minus" style="width:14px;height:14px;"></i></button>
                            <span style="font-size:0.9rem;font-weight:bold;width:20px;text-align:center;">${item.qty}</span>
                            <button class="qty-btn plus" data-idx="${index}"><i data-lucide="plus" style="width:14px;height:14px;"></i></button>
                        </div>
                    </div>
                `;
                
                div.querySelector('.remove-item-btn').addEventListener('click', () => this.removeCartItem(index));
                div.querySelector('.minus').addEventListener('click', () => this.updateCartItemQty(index, -1));
                div.querySelector('.plus').addEventListener('click', () => this.updateCartItemQty(index, 1));
                
                cartItemsContainer.appendChild(div);
            });
        }

        const taxRate = this.getTaxRate();
        const tax = subtotal * (taxRate / 100);
        
        let scAmt = 0;
        if(this.state.serviceCharge.val > 0) {
            scAmt = this.state.serviceCharge.type === 'percent' ? subtotal * (this.state.serviceCharge.val / 100) : this.state.serviceCharge.val;
        }

        let discountAmt = 0;
        if(this.state.discount.val > 0) {
            if(this.state.discount.type === 'percent') {
                discountAmt = (subtotal + tax + scAmt) * (this.state.discount.val / 100);
            } else {
                discountAmt = this.state.discount.val;
            }
        }

        const delivAmt = this.state.orderType === 'delivery' ? (this.state.deliveryCharge || 0) : 0;
        const total = Math.max(0, subtotal + tax + scAmt + delivAmt - discountAmt);

        document.getElementById('cart-count').textContent = totalQty;
        document.getElementById('cart-subtotal').textContent = `${currency} ${subtotal.toFixed(2)}`;
        
        const taxEl = document.getElementById('cart-tax');
        if(taxEl) {
            taxEl.textContent = `${currency} ${tax.toFixed(2)}`;
            taxEl.parentElement.querySelector('span').textContent = `සේවා ගාස්තුව/බද්ද (${taxRate}%)`;
        }

        const scRow = document.getElementById('cart-service-row');
        if(scRow) {
            if(scAmt > 0) {
                scRow.style.display = 'flex';
                document.getElementById('cart-service-charge').textContent = `+ ${currency} ${scAmt.toFixed(2)}`;
            } else {
                scRow.style.display = 'none';
            }
        }

        // Delivery charge row
        const delivRow = document.getElementById('cart-delivery-row');
        if(delivRow) {
            if(delivAmt > 0) {
                delivRow.style.display = 'flex';
                const loc = this.state.deliveryLocation;
                const distLabel = loc ? ` (${loc.distance.toFixed(1)} km)` : '';
                document.getElementById('cart-delivery-label').textContent = `🛵 ඩිලිවරි ගාස්තුව${distLabel}`;
                document.getElementById('cart-delivery-charge').textContent = `+ ${currency} ${delivAmt.toFixed(2)}`;
            } else {
                delivRow.style.display = 'none';
            }
        }

        const discRow = document.getElementById('cart-discount-row');
        if(discountAmt > 0) {
            discRow.style.display = 'flex';
            document.getElementById('cart-discount').textContent = `- ${currency} ${discountAmt.toFixed(2)}`;
        } else {
            discRow.style.display = 'none';
        }

        document.getElementById('cart-total').textContent = `${currency} ${total.toFixed(2)}`;
        
        if(this.elements.checkoutBtn) {
            this.elements.checkoutBtn.disabled = this.state.cart.length === 0;
            this.elements.checkoutBtn.style.opacity = this.state.cart.length === 0 ? "0.5" : "1";
        }
        
        lucide.createIcons();
    }


    populateTableSelect() {
        const select = this.elements.tableSelect;
        select.innerHTML = '<option value="">මේසයක් තෝරන්න...</option>';
        const availableTables = db.getTables().filter(t => t.status === 'available');
        
        if(availableTables.length === 0) {
             select.innerHTML += '<option value="" disabled>සියලුම මේස භාවිතයේ පවතී</option>';
        }

        availableTables.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = `${t.name} (ආසන: ${t.capacity})`;
            if(this.state.selectedTableId === t.id) opt.selected = true;
            select.appendChild(opt);
        });
        
        select.style.display = 'block';
    }

    showModifierModal(product) {
        const modal = document.getElementById('add-on-modal');
        document.getElementById('modal-item-name').textContent = `අමතර වෙනස්කම්: ${product.name}`;
        
        const body = document.getElementById('modal-addons');
        body.innerHTML = '';
        
        product.modifiers.forEach((mod, idx) => {
            const div = document.createElement('div');
            div.style.marginBottom = '1rem';
            div.innerHTML = `
                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; padding:0.5rem; background:rgba(255,255,255,0.05); border-radius:6px;">
                    <input type="radio" name="modifier" value="${mod}" ${idx === 0 ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent-cyan)">
                    <span style="font-weight:600">${mod}</span>
                </label>
            `;
            body.appendChild(div);
        });
        
        modal.classList.add('active');
        
        const btn = document.getElementById('add-to-cart-modal-btn');
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', () => {
            const selectedStr = document.querySelector('input[name="modifier"]:checked');
            if(selectedStr) {
                this.addToCart(product, selectedStr.value);
            }
            modal.classList.remove('active');
        });
    }

    handleCheckout() {
        if(this.state.cart.length === 0) return this.showToast('ඇණවුම හිස්', 'error');
        
        if(this.state.orderType === 'dine-in' && !this.state.selectedTableId) {
            return this.showToast('කරුණාකර මෙහි කෑමට ගන්නා ඇණවුම සඳහා මේසයක් තෝරන්න!', 'error');
        }

        if(this.state.orderType === 'credit') {
            document.getElementById('credit-cust-name').value = '';
            document.getElementById('credit-cust-phone').value = '';
            return document.getElementById('credit-checkout-modal').classList.add('active');
        }

        this.completeOrderProcess();
    }

    processCreditCheckout() {
        const name = document.getElementById('credit-cust-name').value.trim();
        const phone = document.getElementById('credit-cust-phone').value.trim();
        if(!name || !phone) return this.showToast('කරුණාකර නම සහ දුරකථන අංකය ලබාදෙන්න', 'error');
        
        document.getElementById('credit-checkout-modal').classList.remove('active');

        // Calculate total (same as completeOrderProcess)
        const subtotal = this.state.cart.reduce((s,i) => s + (i.price * i.qty), 0);
        const taxRate = this.getTaxRate();
        const tax = subtotal * (taxRate / 100);
        let scAmt = 0;
        if(this.state.serviceCharge.val > 0) {
            scAmt = this.state.serviceCharge.type === 'percent' ? subtotal * (this.state.serviceCharge.val/100) : this.state.serviceCharge.val;
        }
        let discountAmt = 0;
        if(this.state.discount.val > 0) {
            discountAmt = this.state.discount.type === 'percent' ? (subtotal + tax + scAmt) * (this.state.discount.val/100) : this.state.discount.val;
        }
        const total = Math.max(0, subtotal + tax + scAmt - discountAmt);

        // Find or create loan customer
        let loanCust = db.getLoanCustomers().find(c => c.phone === phone);
        if(!loanCust) {
            const newCust = {
                id: null,
                name,
                phone,
                address: '',
                notes: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            const newId = db.saveLoanCustomer(newCust);
            loanCust = db.getLoanCustomers().find(c => c.phone === phone) || { id: newId, name, phone };
        }

        // Create loan item description from cart
        const itemDesc = this.state.cart.map(i => `${i.name} x${i.qty}`).join(', ');

        // Create loan record
        const loan = {
            id: null,
            customerId: loanCust.id,
            description: 'ණය ඇණවුම (POS)',
            items: itemDesc,
            totalAmount: total,
            paidAmount: 0,
            dueDate: null,
            installments: [],
            paymentHistory: [],
            status: 'active',
            createdAt: new Date().toISOString()
        };
        db.saveLoan(loan);

        // Reset cart state
        this.state.cart = [];
        this.state.selectedTableId = null;
        this.state.discount = { val: 0, type: 'amount' };
        this.state.serviceCharge = { val: 0, type: 'amount' };
        if(this.elements.discVal) this.elements.discVal.value = '';
        if(this.elements.scVal) this.elements.scVal.value = '';
        this.updateCartUI();

        this.showToast(`✅ ණය සාර්ථකව ${name} හට සේව් කළා (${this.getCurrency()} ${total.toFixed(2)})`, 'success');
        this.renderView();
    }

    completeOrderProcess() {
        const subtotal = this.state.cart.reduce((s,i) => s + (i.price*i.qty), 0);
        const taxRate = this.getTaxRate();
        const tax = subtotal * (taxRate/100);

        let scAmt = 0;
        if(this.state.serviceCharge.val > 0) {
            scAmt = this.state.serviceCharge.type === 'percent' ? subtotal * (this.state.serviceCharge.val/100) : this.state.serviceCharge.val;
        }
        let discountAmt = 0;
        if(this.state.discount.val > 0) {
            discountAmt = this.state.discount.type === 'percent' ? (subtotal + tax + scAmt) * (this.state.discount.val/100) : this.state.discount.val;
        }
        const delivAmt = this.state.orderType === 'delivery' ? (this.state.deliveryCharge || 0) : 0;
        const total = Math.max(0, subtotal + tax + scAmt + delivAmt - discountAmt);

        const dt = new Date();
        const strId = `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}-${String(dt.getHours()).padStart(2,'0')}${String(dt.getMinutes()).padStart(2,'0')}${Math.floor(Math.random()*100)}`;

        const order = {
            id: `ORD-${strId}`,
            type: this.state.orderType,
            tableId: this.state.selectedTableId,
            items: [...this.state.cart],
            discount: discountAmt,
            serviceCharge: scAmt,
            deliveryCharge: delivAmt,
            deliveryLocation: this.state.deliveryLocation || null,
            subtotal, tax, total,
            timestamp: dt.toISOString(),
            kdsStatus: 'pending'
        };

        db.placeOrder(order);
        this.renderReceiptModal(order);

        this.state.cart = [];
        this.state.selectedTableId = null;
        this.state.discount = { val: 0, type:'amount' };
        this.state.serviceCharge = { val: 0, type:'amount' };
        this.state.deliveryCharge = 0;
        this.state.deliveryLocation = null;
        if(this.elements.discVal) this.elements.discVal.value = '';
        if(this.elements.scVal) this.elements.scVal.value = '';

        if(this.state.orderType === 'dine-in' && this.state.currentTab === 'pos') {
            this.populateTableSelect();
        }
        this.updateCartUI();
        this.showToast('ඇණවුම කුස්සියට සාර්ථකව යවන ලදී!', 'success');
    }


    renderReceiptModal(order) {
        const currency = this.getCurrency();
        document.getElementById('receipt-date').textContent = new Date(order.timestamp).toLocaleString();
        document.getElementById('receipt-id').textContent = order.id;
        
        let displayType = order.type.toUpperCase();
        if(order.type === 'dine-in') displayType = "මෙහි කෑමට";
        else if (order.type === 'takeaway') displayType = "රැගෙන යාමට";
        else if (order.type === 'delivery') displayType = "බෙදා හැරීම";
        else if (order.type === 'credit') displayType = `ණය (Credit) - ${order.creditDetails?.customerName || ''}`;
        document.getElementById('receipt-type').textContent = displayType;
        
        const tableInfo = document.getElementById('receipt-table-info');
        if(order.type === 'dine-in' && order.tableId) {
            const t = db.getTables().find(tb => tb.id === order.tableId);
            tableInfo.style.display = 'block';
            tableInfo.textContent = `ස්ථානය: ${t ? t.name : order.tableId}`;
        } else {
            tableInfo.style.display = 'none';
        }

        const itemsBox = document.getElementById('receipt-items');
        itemsBox.innerHTML = '';
        order.items.forEach(i => {
            const p = i.price * i.qty;
            let n = i.name;
            if(i.modifiers) n += ` (${i.modifiers})`;
            itemsBox.innerHTML += `<div class="receipt-item"><span>${i.qty}x ${n}</span><span>${currency} ${p.toFixed(2)}</span></div>`;
        });

        let scHTML = '';
        if(order.serviceCharge > 0) {
            scHTML = `<div class="receipt-item"><span>සේවා ගාස්තුව</span><span>${currency} ${order.serviceCharge.toFixed(2)}</span></div>`;
        }

        const totalsDiv = document.querySelector('.receipt-totals');
        totalsDiv.innerHTML = `
            <div class="receipt-item"><span>මුළු වටිනාකම</span><span>${currency} ${order.subtotal.toFixed(2)}</span></div>
            ${scHTML}
            <div class="receipt-item"><span>සේවා ගාස්තුව/බද්ද</span><span>${currency} ${order.tax.toFixed(2)}</span></div>
            ${order.discount>0 ? `<div class="receipt-item"><span>වට්ටම</span><span>-${currency} ${order.discount.toFixed(2)}</span></div>` : ''}
            <div class="receipt-item" style="font-weight:bold; font-size:1.1rem; margin-top:10px;"><span>මුළු මුදල</span><span>${currency} ${order.total.toFixed(2)}</span></div>
        `;

        const rModal = document.getElementById('receipt-modal');
        rModal.classList.add('active');

        document.getElementById('btn-print').onclick = () => window.print();
        document.getElementById('btn-close-receipt').onclick = () => rModal.classList.remove('active');
    }

    /* --- TABLE MANAGEMENT --- */
    renderTables(container) {
        // Header with Add Table button
        const header = document.createElement('div');
        header.className = 'view-header';
        header.innerHTML = `
            <h2>මේස කළමනාකරණය</h2>
            <button class="neon-btn" id="btn-add-table" style="margin-top:0; padding:0.4rem 1.1rem; font-size:0.85rem;">
                <i data-lucide="plus-circle"></i> මේසයක් එක් කරන්න
            </button>
        `;
        container.appendChild(header);

        // Add Table inline form (hidden initially)
        const addForm = document.createElement('div');
        addForm.id = 'add-table-form';
        addForm.style.cssText = 'display:none; background:var(--bg-card); border:1px solid var(--accent-cyan); border-radius:12px; padding:1.2rem; margin-bottom:1.5rem; gap:1rem; flex-wrap:wrap; align-items:flex-end;';
        addForm.innerHTML = `
            <div style="flex:2; min-width:140px;">
                <label style="font-size:0.8rem; color:var(--text-secondary); display:block; margin-bottom:4px;">මේසයේ නම *</label>
                <input type="text" id="new-table-name" placeholder="ඉ. මේසය 11" style="width:100%; background:var(--bg-dark); border:1px solid var(--border-glass); color:var(--text-primary); padding:0.5rem 0.75rem; border-radius:8px; font-size:0.9rem;">
            </div>
            <div style="flex:1; min-width:100px;">
                <label style="font-size:0.8rem; color:var(--text-secondary); display:block; margin-bottom:4px;">ආසන සංඛ්‍යාව</label>
                <input type="number" id="new-table-cap" min="1" max="50" value="4" style="width:100%; background:var(--bg-dark); border:1px solid var(--border-glass); color:var(--text-primary); padding:0.5rem 0.75rem; border-radius:8px; font-size:0.9rem;">
            </div>
            <div style="display:flex; gap:0.5rem;">
                <button id="save-new-table-btn" class="neon-btn" style="margin-top:0; padding:0.5rem 1rem; font-size:0.85rem;">✔ සුරකින්න</button>
                <button id="cancel-new-table-btn" class="action-btn" style="padding:0.5rem 1rem; font-size:0.85rem;">✕</button>
            </div>
        `;
        container.appendChild(addForm);

        // Toggle form visibility
        header.querySelector('#btn-add-table').addEventListener('click', () => {
            const isHidden = addForm.style.display === 'none' || addForm.style.display === '';
            addForm.style.display = isHidden ? 'flex' : 'none';
            if (isHidden) document.getElementById('new-table-name').focus();
        });
        addForm.querySelector('#cancel-new-table-btn').addEventListener('click', () => {
            addForm.style.display = 'none';
        });
        addForm.querySelector('#save-new-table-btn').addEventListener('click', () => {
            const name = document.getElementById('new-table-name').value.trim();
            const cap  = parseInt(document.getElementById('new-table-cap').value) || 4;
            if (!name) return this.showToast('මේසයේ නම දෙන්න!', 'error');
            db.addTable({ name, capacity: cap });
            this.showToast(`✅ "${name}" මේසය සාර්ථකව එකතු කළා!`, 'success');
            this.renderView();
        });

        const tables = db.getTables();
        const activeOrders = db.getOrders().filter(o => o.type === 'dine-in' && o.tableId && o.kdsStatus !== 'completed');
        const grid = document.createElement('div');
        grid.className = 'table-grid';

        if (tables.length === 0) {
            grid.innerHTML = `<div class="empty-cart" style="grid-column:1/-1; padding:3rem 1rem; font-size:1rem;">🪑 මේස කිසිවක් නැත. ඉහළ "+ මේසයක් එක් කරන්න" ක්ලික් කරන්න.</div>`;
        } else {
            tables.forEach(table => {
                const tOrder = activeOrders.find(o => o.tableId === table.id);
                const isOccupied = table.status === 'occupied';

                const card = document.createElement('div');
                card.className = `table-card ${isOccupied ? 'table-occupied' : 'table-available'}`;

                let html = `
                    <h3>${table.name}</h3>
                    <div class="table-capacity"><i data-lucide="users" style="width:14px;height:14px;"></i> ආසන: ${table.capacity}</div>
                    <div style="margin-top:0.8rem; font-size:0.85rem; font-weight:bold; color:${isOccupied ? 'var(--accent-danger)' : 'var(--accent-success)'}">
                        ${isOccupied ? '🔴 භාවිතයේ' : '🟢 හිස්'}
                    </div>`;

                if (tOrder) {
                    html += `<div style="margin-top:0.4rem; font-size:0.78rem; color:var(--text-secondary);">${tOrder.id}</div>
                             <button class="action-btn success free-btn" style="margin:0.5rem auto 0; padding:0.3rem 0.6rem;" data-tid="${table.id}">නිදහස් කරන්න</button>`;
                } else {
                    html += `<button class="action-btn danger del-table-btn" style="margin:0.6rem auto 0; padding:0.2rem 0.5rem; font-size:0.75rem; width:auto;" data-delid="${table.id}">
                        <i data-lucide="trash-2" style="width:12px;height:12px;"></i> ඉවත් කරන්න
                    </button>`;
                }

                card.innerHTML = html;

                // Free table button
                const freeBtn = card.querySelector('.free-btn');
                if (freeBtn) {
                    freeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        db.updateOrderStatus(tOrder.id, 'completed');
                        this.renderView();
                        this.showToast('මේසය සාර්ථකව නිදහස් කරන ලදී', 'success');
                    });
                }

                // Delete table button
                const delBtn = card.querySelector('.del-table-btn');
                if (delBtn) {
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (confirm(`"${table.name}" මේසය ස්ථිරවම ඉවත් කරන්නද?`)) {
                            db.deleteTable(table.id);
                            this.showToast(`"${table.name}" ඉවත් කරන ලදී`, 'warning');
                            this.renderView();
                        }
                    });
                }

                // Click to open POS for empty table
                if (!isOccupied && !tOrder) {
                    card.style.cursor = 'pointer';
                    card.addEventListener('click', (e) => {
                        if (e.target.closest('button')) return;
                        this.state.currentTab = 'pos';
                        this.state.orderType = 'dine-in';
                        this.state.selectedTableId = table.id;
                        this.renderView();
                        this.elements.typeBtns.forEach(b => b.classList.remove('active'));
                        document.querySelector('.type-btn[data-type="dine-in"]').classList.add('active');
                    });
                }

                grid.appendChild(card);
            });
        }

        container.appendChild(grid);
        requestAnimationFrame(() => lucide.createIcons());
    }


    /* --- KITCHEN DISPLAY SYSTEM --- */
    renderKitchen(container, reRenderHeader = true) {
        if(reRenderHeader) {
            container.innerHTML = '';
            const header = document.createElement('div');
            header.className = 'view-header';
            header.innerHTML = `<h2>කුස්සිය (Kitchen Display System)</h2>
                <div style="display:flex; gap:10px;">
                    <span style="font-size:0.85rem; padding:4px 8px; border-radius:4px; border:1px solid var(--accent-danger);">පොරොත්තුවෙන් (Pending)</span>
                    <span style="font-size:0.85rem; padding:4px 8px; border-radius:4px; border:1px solid var(--accent-warning);">සකස් කරමින් (Preparing)</span>
                    <span style="font-size:0.85rem; padding:4px 8px; border-radius:4px; border:1px solid var(--accent-success);">සූදානම් (Ready)</span>
                </div>`;
            container.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'kds-grid';
            grid.id = 'kds-grid-container';
            container.appendChild(grid);
        }

        const grid = document.getElementById('kds-grid-container');
        if(!grid) return;
        grid.innerHTML = '';

        const orders = db.getOrders().filter(o => o.kdsStatus !== 'completed').sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

        if(orders.length === 0) {
            grid.innerHTML = `<div class="empty-cart" style="font-size:1.2rem; margin-top:50px; grid-column:1/-1;">☕ කුස්සියේ දැනට ඇණවුම් කිසිවක් නැත.</div>`;
            return;
        }

        const tables = db.getTables();
        const now = new Date();

        orders.forEach(o => {
            const timeStr = new Date(o.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            // Calculate elapsed time warning
            const diffMin = Math.floor((now - new Date(o.timestamp)) / 60000);
            let timeColorStr = 'var(--text-secondary)';
            if(o.kdsStatus !== 'ready') {
                if(diffMin > 15) timeColorStr = 'var(--accent-danger)';
                else if(diffMin > 10) timeColorStr = 'var(--accent-warning)';
            }
            
            let locStr = o.type.toUpperCase();
            if(o.type === 'dine-in') locStr = 'මෙහි කෑමට';
            if(o.type === 'takeaway') locStr = 'රැගෙන යාමට';
            if(o.type === 'delivery') locStr = 'බෙදා හැරීම';
            
            if(o.type === 'dine-in' && o.tableId) {
                const tr = tables.find(t=>t.id === o.tableId);
                locStr = tr ? `මෙහි කෑමට • ${tr.name}` : locStr;
            }

            const ticket = document.createElement('div');
            ticket.className = `kds-ticket ${o.kdsStatus}`;
            
            let btnActionHtml = '';
            let btnClasses = '';
            let nextAction = '';

            if (o.kdsStatus === 'pending') {
                btnActionHtml = '<i data-lucide="play"></i> සකස් කිරීම අරඹන්න';
                btnClasses = 'action-btn primary';
                nextAction = 'preparing';
            } else if (o.kdsStatus === 'preparing') {
                btnActionHtml = '<i data-lucide="bell"></i> සූදානම් ලෙස සලකුණු කරන්න';
                btnClasses = 'action-btn warning';
                nextAction = 'ready';
                ticket.style.borderTopColor = 'var(--accent-warning)';
            } else if (o.kdsStatus === 'ready') {
                btnActionHtml = '<i data-lucide="check-square"></i> බෙදා හැරියා / සම්පූර්ණයි';
                btnClasses = 'action-btn success';
                nextAction = 'completed';
            }

            let itemsHtml = o.items.map(i => {
                return `<li class="kds-item">
                    <strong style="color:var(--accent-cyan)">${i.qty}x</strong> ${i.name}
                    ${i.modifiers ? `<br><small style="color:var(--text-secondary); margin-left: 20px;">- ${i.modifiers}</small>` : ''}
                </li>`;
            }).join('');

            ticket.innerHTML = `
                <div class="kds-ticket-header">
                    <div>
                        <strong>${o.id.split('-').pop()}</strong><br>
                        <small style="color:var(--text-secondary);">${locStr}</small>
                    </div>
                    <span style="color:${timeColorStr};font-size:0.9rem;font-weight:bold;">${timeStr} (${diffMin}m ago)</span>
                </div>
                <ul class="kds-items">${itemsHtml}</ul>
                <button class="${btnClasses}" style="width:100%; justify-content:center; margin-top:auto;" data-oid="${o.id}" data-action="${nextAction}">${btnActionHtml}</button>
            `;

            ticket.querySelector('button').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                db.updateOrderStatus(btn.dataset.oid, btn.dataset.action);
                this.renderView();
                this.showToast('ඇණවුම යාවත්කාලීන කරන ලදී', 'success');
            });

            grid.appendChild(ticket);
        });
        lucide.createIcons();
    }

    /* --- DASHBOARD --- */
    renderDashboard(container) {
         const header = document.createElement('div');
         header.className = 'view-header';
         header.innerHTML = '<h2>ප්‍රධාන දත්ත පුවරුව (Dashboard)</h2><span style="color:var(--text-secondary);">අද දින සාර්ථක වූ මෙහෙයුම් වලින් ලැබෙන සජීවී දත්ත</span>';
         container.appendChild(header);
         
         const metrics = db.getMetrics();
         const currency = this.getCurrency();
         
         const grids = document.createElement('div');
         grids.className = 'dashboard-grid';
         grids.innerHTML = `
            <div class="glass-card metric-card primary">
                <div class="metric-title">අද දවසේ ආදායම</div>
                <div class="metric-value">${currency} ${metrics.revenue.toLocaleString()}</div>
            </div>
            <div class="glass-card metric-card secondary">
                <div class="metric-title">ලාභය (අද)</div>
                <div class="metric-value">${currency} ${metrics.profit.toLocaleString()}</div>
            </div>
            <div class="glass-card metric-card">
                <div class="metric-title">මුළු ඇණවුම්</div>
                <div class="metric-value" style="color:var(--text-primary)">${metrics.orders}</div>
            </div>
            <div class="glass-card metric-card">
                <div class="metric-title">භාවිතයේ ඇති මේස</div>
                <div class="metric-value" style="color:var(--text-primary)">
                    ${metrics.activeTables} <span style="font-size:1rem;color:var(--text-secondary)">/ ${metrics.totalTables}</span>
                </div>
            </div>
         `;
         container.appendChild(grids);
         
         const chartMock = document.createElement('div');
         chartMock.className = 'glass-card';
         chartMock.style.padding = '2rem';
         chartMock.style.height = '300px';
         chartMock.style.display = 'flex';
         chartMock.style.flexDirection = 'column';
         chartMock.style.justifyContent = 'flex-end';
         chartMock.style.position = 'relative';

         chartMock.innerHTML = `
            <h3 style="position:absolute; top: 1.5rem; left: 1.5rem; color: var(--text-secondary);">විකුණුම් ක්‍රියාකාරකම් සටහන (Timeline)</h3>
            <div style="display:flex; gap:1rem; height: 180px; align-items:flex-end; width:100%; border-bottom: 1px solid var(--border-glass);">
                ${[40, 60, 20, 80, 50, 90, 100].map(h => `
                    <div style="flex:1; background: linear-gradient(0deg, var(--accent-cyan-glow) 0%, var(--accent-cyan) 100%); height: ${h}%; border-radius: 4px 4px 0 0; opacity: 0.8;"></div>
                `).join('')}
            </div>
            <div style="display:flex; justify-content:space-between; margin-top: 10px; color:var(--text-secondary); font-size:0.8rem;">
                <span>9 AM</span><span>11 AM</span><span>1 PM</span><span>3 PM</span><span>5 PM</span><span>7 PM</span><span>9 PM</span>
            </div>
         `;
         container.appendChild(chartMock);
    }

    /* --- REPORTS MODULE --- */
    renderReports(container) {
        const header = document.createElement('div');
        header.className = 'view-header';
        header.innerHTML = `
            <h2>වාර්තා (Reports)</h2>
            <button class="neon-btn" style="width:auto; margin:0;" onclick="document.getElementById('expense-modal').classList.add('active');"><i data-lucide="plus"></i> වියදමක් එක් කරන්න</button>
        `;
        container.appendChild(header);

        const metrics = db.getMetrics();
        const exps = db.getExpenses().sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        const currency = this.getCurrency();

        const dashContainer = document.createElement('div');
        dashContainer.innerHTML = `
            <div class="dashboard-grid" style="grid-template-columns: repeat(3, 1fr);">
                <div class="glass-card metric-card" style="border-color:var(--accent-cyan);">
                    <div class="metric-title">මුළු විකුණුම් (Revenue)</div>
                    <div class="metric-value" style="color:var(--accent-cyan);">${currency} ${metrics.revenue.toLocaleString()}</div>
                </div>
                <div class="glass-card metric-card" style="border-color:var(--accent-danger);">
                    <div class="metric-title">මුළු වියදම් (Expenses)</div>
                    <div class="metric-value" style="color:var(--accent-danger);">${currency} ${metrics.totalExpenses.toLocaleString()}</div>
                </div>
                <div class="glass-card metric-card" style="border-color:var(--accent-success);">
                    <div class="metric-title">දළ ලාභය (Profit)</div>
                    <div class="metric-value" style="color:var(--accent-success);">${currency} ${metrics.profit.toLocaleString()}</div>
                </div>
            </div>
            
            <h3 style="margin:20px 0 10px; border-bottom:1px solid var(--border-glass); padding-bottom:5px;">අලුත්ම වියදම් වාර්තා (Recent Expenses)</h3>
            <div class="inventory-table-container">
                <table>
                    <thead>
                        <tr>
                            <th>දිනය</th>
                            <th>වර්ගය</th>
                            <th>විස්තරය</th>
                            <th>මුදල</th>
                            <th>ක්‍රියා</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${exps.length === 0 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">වියදම් කිසිවක් නැත</td></tr>` : 
                        exps.map(e => `
                            <tr>
                                <td>${new Date(e.timestamp).toLocaleString()}</td>
                                <td><span class="badge" style="background:var(--accent-danger); color:white;">${e.category}</span></td>
                                <td>${e.description}</td>
                                <td style="color:var(--accent-danger); font-weight:bold;">${currency} ${e.amount.toFixed(2)}</td>
                                <td><button class="action-btn danger" onclick="App.deleteExpense('${e.id}')"><i data-lucide="trash-2" style="width:16px;"></i></button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        container.appendChild(dashContainer);
    }

    handleExpSave() {
        const cat = document.getElementById('exp-cat').value.trim();
        const desc = document.getElementById('exp-desc').value.trim();
        const amt = parseFloat(document.getElementById('exp-amount').value);

        if(!cat || isNaN(amt)) return this.showToast('කරුණාකර තොරතුරු නිවැරදිව ලබාදෙන්න', 'error');

        db.addExpense({
            id: 'exp_'+Date.now(),
            category: cat,
            description: desc,
            amount: amt,
            timestamp: new Date().toISOString()
        });

        document.getElementById('expense-modal').classList.remove('active');
        document.getElementById('expense-form').reset();
        this.showToast('වියදම සුරැකිණි', 'success');
        this.renderView();
    }

    deleteExpense(id) {
        if(confirm('වියදම මකා දැමීමට අවශ්‍යද?')) {
            db.deleteExpense(id);
            this.showToast('වියදම මකා දැමිණි', 'success');
            this.renderView();
        }
    }

    /* --- STAFF MODULE --- */
    renderStaff(container) {
        const header = document.createElement('div');
        header.className = 'view-header';
        header.innerHTML = `
            <h2>සේවක මණ්ඩලය (Staff)</h2>
            <button class="neon-btn" style="width:auto; margin:0;" onclick="document.getElementById('staff-modal').classList.add('active');"><i data-lucide="user-plus"></i> නව සේවකයෙක්</button>
        `;
        container.appendChild(header);

        const staffList = db.getStaff();
        
        const grid = document.createElement('div');
        grid.className = 'product-grid'; // same styles fit nicely

        if(staffList.length === 0) {
            grid.innerHTML = '<div class="empty-cart" style="grid-column:1/-1">සේවක විස්තර පද්ධතියට ඇතුලත් කර නැත.</div>';
        } else {
            staffList.forEach(s => {
                const card = document.createElement('div');
                card.className = 'glass-card';
                card.style.padding = '1.5rem';
                card.style.position = 'relative';
                
                card.innerHTML = `
                    <div style="text-align:center; margin-bottom:1rem;">
                        <div style="width:60px; height:60px; border-radius:50%; background:var(--accent-purple-glow); color:var(--text-primary); margin:0 auto 10px; display:flex; align-items:center; justify-content:center; font-size:1.5rem; border:2px solid var(--accent-purple);">
                            ${s.name.charAt(0).toUpperCase()}
                        </div>
                        <h3 style="font-size:1.1rem;">${s.name}</h3>
                        <p style="color:var(--accent-cyan); font-size:0.9rem; font-weight:bold; margin-top:5px;">${s.role}</p>
                        <p style="color:var(--text-secondary); font-size:0.8rem; margin-top:5px;">📞 ${s.contact || 'No Contact'}</p>
                        <div style="background:rgba(0,0,0,0.3); border-radius:6px; padding:10px; margin-top:10px;">
                            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:5px;"><span>පඩිය:</span> <strong>${this.getCurrency()} ${s.basicSalary || 0}</strong></div>
                            <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--accent-danger);"><span>ණය/අත්ති:</span> <strong>${this.getCurrency()} ${s.loanAmount || 0}</strong></div>
                        </div>
                        <button class="action-btn" style="width:100%; justify-content:center; margin-top:10px; border-color:var(--accent-success); color:var(--accent-success);" onclick="App.openFinanceModal('${s.id}')"><i data-lucide="banknote" style="width:16px;"></i> පඩි / ණය කළමනාකරණය</button>
                    </div>
                    <button class="action-btn danger" onclick="App.deleteStaff('${s.id}')" style="position:absolute; top:10px; right:10px; padding:4px;"><i data-lucide="trash-2" style="width:14px;"></i></button>
                `;
                grid.appendChild(card);
            });
        }
        container.appendChild(grid);
    }

    handleStaffSave() {
        const name = document.getElementById('staff-name').value.trim();
        const role = document.getElementById('staff-role').value;
        const contact = document.getElementById('staff-contact').value.trim();
        const basicSalary = parseFloat(document.getElementById('staff-salary').value) || 0;

        if(!name || !role) return this.showToast('කරුණාකර තොරතුරු සම්පූර්ණ කරන්න', 'error');

        db.addStaff({
            id: 'stf_'+Date.now(),
            name, role, contact, basicSalary, loanAmount: 0
        });

        document.getElementById('staff-modal').classList.remove('active');
        document.getElementById('staff-form').reset();
        this.showToast('සේවකයා පද්ධතියට එක්කරන ලදී', 'success');
        this.renderView();
    }

    deleteStaff(id) {
        if(confirm('මෙම සේවකයා ඉවත් කිරීමට අවශ්‍යද?')) {
            db.deleteStaff(id);
            this.showToast('සේවකයා ඉවත් කරන ලදී', 'success');
            this.renderView();
        }
    }

    openFinanceModal(id) {
        const staffList = db.getStaff();
        const s = staffList.find(x => x.id === id);
        if(!s) return;

        document.getElementById('finance-staff-id').value = s.id;
        document.getElementById('finance-staff-name').textContent = s.name;
        document.getElementById('finance-basic-salary').textContent = `${this.getCurrency()} ${s.basicSalary || 0}`;
        document.getElementById('finance-current-loan').textContent = `${this.getCurrency()} ${s.loanAmount || 0}`;
        
        document.getElementById('finance-add-loan').value = '';
        document.getElementById('finance-deduct-loan').value = '';
        document.getElementById('finance-bonus').value = '';
        
        this.calcNetSalary();
        document.getElementById('staff-finance-modal').classList.add('active');
    }

    calcNetSalary() {
        const id = document.getElementById('finance-staff-id').value;
        const s = db.getStaff().find(x => x.id === id);
        if(!s) return;

        const basic = s.basicSalary || 0;
        const deduct = parseFloat(document.getElementById('finance-deduct-loan').value) || 0;
        const bonus = parseFloat(document.getElementById('finance-bonus').value) || 0;

        const net = basic - deduct + bonus;
        document.getElementById('finance-net-salary').textContent = `${this.getCurrency()} ${net.toFixed(2)}`;
    }

    handleFinanceLoanAdd() {
        const id = document.getElementById('finance-staff-id').value;
        const s = db.getStaff().find(x => x.id === id);
        if(!s) return;

        const addAmt = parseFloat(document.getElementById('finance-add-loan').value);
        if(isNaN(addAmt) || addAmt <= 0) return this.showToast('කරුණාකර නිවැරදි මුදලක් ඇතුලත් කරන්න', 'error');

        const newLoan = (s.loanAmount || 0) + addAmt;
        db.updateStaff(s.id, { loanAmount: newLoan });
        
        // Optionally save to expenses
        db.addExpense({
            id: 'exp_'+Date.now(),
            category: 'සේවක ණය/අත්තිකාරම්',
            description: `${s.name} සඳහා ණය/අත්තිකාරම් දීම`,
            amount: addAmt,
            timestamp: new Date().toISOString()
        });

        this.showToast('ණය මුදල එකතු කරන ලදී', 'success');
        document.getElementById('staff-finance-modal').classList.remove('active');
        this.renderView();
    }

    handleFinancePaySalary() {
        const id = document.getElementById('finance-staff-id').value;
        const s = db.getStaff().find(x => x.id === id);
        if(!s) return;

        const basic = s.basicSalary || 0;
        const deduct = parseFloat(document.getElementById('finance-deduct-loan').value) || 0;
        const bonus = parseFloat(document.getElementById('finance-bonus').value) || 0;
        
        if(deduct > (s.loanAmount || 0)) return this.showToast('අඩුකරන ණය මුදල සේවකයාගේ මුළු ණයට වඩා වැඩියි!', 'error');

        const newLoan = (s.loanAmount || 0) - deduct;
        const net = basic - deduct + bonus;

        db.updateStaff(s.id, { loanAmount: newLoan });

        db.addExpense({
            id: 'exp_'+Date.now(),
            category: 'සේවක වැටුප්',
            description: `${s.name} හට පඩි ගෙවීම (බෝනස්: ${bonus}, ණය කැපුම: ${deduct})`,
            amount: net,
            timestamp: new Date().toISOString()
        });

        this.showToast('පඩි ගෙවීම සාර්ථකයි', 'success');
        document.getElementById('staff-finance-modal').classList.remove('active');
        this.renderView();
    }


    /* --- INVENTORY CRUD --- */
    renderInventory(container) {
        const header = document.createElement('div');
        header.className = 'view-header';
        header.innerHTML = `
            <h2>ගබඩා කළමනාකරණය (Inventory)</h2>
            <button class="neon-btn" style="width:auto; margin:0;" id="open-add-inv-btn"><i data-lucide="plus"></i> නව අයිතමයක්</button>
        `;
        container.appendChild(header);

        const products = db.getProducts('all');
        const categories = db.getCategories();
        const currency = this.getCurrency();

        const tableContainer = document.createElement('div');
        tableContainer.className = 'inventory-table-container';

        let innerTbl = `
            <table>
                <thead>
                    <tr>
                        <th width="80">පින්තූරය</th>
                        <th>විස්තරය (Product)</th>
                        <th>කාණ්ඩය</th>
                        <th>මිල</th>
                        <th>තොගය (Stock)</th>
                        <th>ක්‍රියා</th>
                    </tr>
                </thead>
                <tbody>
        `;

        products.forEach(p => {
            const catInfo = categories.find(c => c.id === p.category) || {name: p.category};
            const isLowStock = p.stock !== undefined && p.stock <= 5;
            const sClass = isLowStock ? 'color:var(--accent-danger); font-weight:bold;' : 'color:var(--text-secondary)';
            const rowStyle = isLowStock ? 'background: rgba(255, 51, 102, 0.15); border-left: 3px solid var(--accent-danger);' : '';
            
            innerTbl += `
                <tr style="${rowStyle}">
                    <td><img src="${p.image}" width="50" height="50" onerror="this.src='https://via.placeholder.com/50?text=NA'"></td>
                    <td>
                        <strong style="display:block; font-size:1rem; ${isLowStock ? 'color:var(--accent-danger);' : ''}">${p.name} ${isLowStock ? '<span style="font-size:0.7rem; background:var(--accent-danger); color:#fff; padding:2px 4px; border-radius:4px; margin-left:5px;">අඩුයි!</span>' : ''}</strong>
                        <small style="color:var(--text-secondary)">වෙනස්කම්: ${p.modifiers ? p.modifiers.join(', ') : 'නැත'}</small>
                    </td>
                    <td><span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-primary); border:1px solid var(--border-glass);">${catInfo.name}</span></td>
                    <td style="font-weight:600; color:var(--accent-cyan);">${currency} ${parseFloat(p.price).toFixed(2)}</td>
                    <td style="${sClass}">${p.stock !== undefined ? p.stock : 'සීමාවක් නැත'}</td>
                    <td>
                        <div style="display:flex; gap:0.5rem;">
                            <button class="action-btn" title="වෙනස් කරන්න" onclick="App.editProduct('${p.id}')"><i data-lucide="edit" style="width:16px;"></i></button>
                            <button class="action-btn danger" title="මකා දමන්න" onclick="App.deleteProduct('${p.id}')"><i data-lucide="trash-2" style="width:16px;"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        innerTbl += `</tbody></table>`;
        tableContainer.innerHTML = innerTbl;
        container.appendChild(tableContainer);

        document.getElementById('open-add-inv-btn').addEventListener('click', () => {
            document.getElementById('inventory-form').reset();
            document.getElementById('inv-id').value = '';
            document.getElementById('inv-modal-title').textContent = 'නව අයිතමයක් එක් කරන්න';
            document.getElementById('inventory-modal').classList.add('active');
        });

        const saveBtn = document.getElementById('save-inventory-btn');
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

        newSaveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleInventorySave();
        });
    }

    handleInventorySave() {
        const id = document.getElementById('inv-id').value;
        const name = document.getElementById('inv-name').value.trim();
        const price = parseFloat(document.getElementById('inv-price').value);
        const costPrice = parseFloat(document.getElementById('inv-cost').value);
        const category = document.getElementById('inv-category').value;
        const stockStr = document.getElementById('inv-stock').value;
        const stock = stockStr ? parseInt(stockStr) : undefined;
        let image = document.getElementById('inv-image').value.trim();
        const mods = document.getElementById('inv-mods').value.trim();

        if(!name || isNaN(price) || isNaN(costPrice)) {
            return this.showToast('කරුණාකර අවශ්‍ය තොරතුරු (නම, මිල, ගත් මිල) ලබා දෙන්න', 'error');
        }

        if(!image) image = `https://via.placeholder.com/400x300?text=${encodeURIComponent(name)}`;

        let modifierArr = null;
        if(mods) modifierArr = mods.split(',').map(s => s.trim()).filter(s => s);

        const prodObj = {
            id: id || `p_${Date.now()}`,
            name, price, costPrice, category, stock, image
        };
        if(modifierArr && modifierArr.length > 0) prodObj.modifiers = modifierArr;

        if(id) {
            db.updateProduct(id, prodObj);
            this.showToast('අයිතමය යාවත්කාලීන කරන ලදී!', 'success');
        } else {
            db.addProduct(prodObj);
            this.showToast('අයිතමය සාර්ථකව එක් කරන ලදී!', 'success');
        }
        
        document.getElementById('inventory-modal').classList.remove('active');
        this.renderView();
    }

    editProduct(id) {
        const p = db.getProducts('all').find(x => x.id === id);
        if(!p) return;
        document.getElementById('inv-id').value = p.id;
        document.getElementById('inv-name').value = p.name;
        document.getElementById('inv-category').value = p.category;
        document.getElementById('inv-price').value = p.price;
        document.getElementById('inv-cost').value = p.costPrice || 0;
        document.getElementById('inv-stock').value = p.stock !== undefined ? p.stock : '';
        document.getElementById('inv-mods').value = p.modifiers ? p.modifiers.join(', ') : '';
        document.getElementById('inv-image').value = p.image || '';

        document.getElementById('inv-modal-title').textContent = 'අයිතමය වෙනස් කරන්න';
        document.getElementById('inventory-modal').classList.add('active');
    }

    /* --- HARDWARE CONNECTORS --- */
    async connectPrinter() {
        try {
            if (!navigator.bluetooth) {
                return this.showToast('Bluetooth පහසුකම ඔබගේ Browser එකේ නොමැත.', 'error');
            }
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
                optionalServices: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] // common Thermal Printer IDs
            });
            this.showToast(`ප්‍රින්ටරය සම්බන්ධ වුණා: ${device.name}`, 'success');
            document.getElementById('connect-bt-printer').innerHTML = '<i data-lucide="check"></i> සම්බන්ධ කර ඇත';
            lucide.createIcons();
        } catch (error) {
            console.error(error);
            this.showToast('ප්‍රින්ටරය සම්බන්ධ කිරීම අසාර්ථකයි.', 'error');
        }
    }

    async connectScanner() {
        try {
            if (!navigator.usb) {
                return this.showToast('USB පහසුකම ඔබගේ Browser එකේ නොමැත.', 'error');
            }
            const device = await navigator.usb.requestDevice({ filters: [{}] }); 
            this.showToast(`ස්කෑනරය සම්බන්ධ වුණා: ${device.productName}`, 'success');
            document.getElementById('connect-scanner').innerHTML = '<i data-lucide="check"></i> සම්බන්ධ කර ඇත';
            lucide.createIcons();
        } catch (error) {
            console.error(error);
            this.showToast('ස්කෑනරය සම්බන්ධ කිරීම අසාර්ථකයි.', 'error');
        }
    }

    deleteProduct(id) {
        if(confirm('මෙම අයිතමය මකා දැමීමට අවශ්‍ය බව විශ්වාසද?')) {
            db.deleteProduct(id);
            this.showToast('අයිතමය මකා දමන ලදී.', 'success');
            this.renderView();
        }
    }

    /* ====== FULL LOAN MANAGEMENT SYSTEM (Janith LoanMgr) ====== */

    renderCredits(container) {
        const cur = this.getCurrency();
        const customers = db.getLoanCustomers();
        const loans = db.getLoans();

        // Stats
        const activeLoans = loans.filter(l => l.status !== 'cleared');
        const totalOwed = activeLoans.reduce((s,l) => s + ((l.totalAmount||0) - (l.paidAmount||0)), 0);
        const overdueCount = activeLoans.filter(l => this._loanIsOverdue(l)).length;

        container.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:0 0 1rem 0; flex-wrap:wrap; gap:0.5rem;">
            <h2 style="font-size:1.3rem; font-weight:800;">💳 ණය කළමනාකරණය (Loans)</h2>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <button class="neon-btn" style="margin-top:0; padding:8px 14px; font-size:0.85rem;" onclick="App.loanOpenCustomerForm()">👤 පාරිභෝගිකයා එකතු කරන්න</button>
                <button class="neon-btn" style="margin-top:0; padding:8px 14px; font-size:0.85rem; background:var(--accent-danger);" onclick="App.loanOpenNewLoan()">➕ නව ණය</button>
            </div>
        </div>

        <!-- Stats Row -->
        <div style="display:flex; gap:0.75rem; margin-bottom:1rem; flex-wrap:wrap;">
            <div class="glass-card" style="flex:1; min-width:120px; padding:12px;">
                <div style="font-size:0.7rem; color:var(--text-secondary); font-weight:700; text-transform:uppercase; margin-bottom:4px;">මුළු ගෙවිය යුතු</div>
                <div style="font-family:monospace; font-size:1.2rem; font-weight:800; color:var(--accent-danger);">${cur} ${totalOwed.toFixed(2)}</div>
            </div>
            <div class="glass-card" style="flex:1; min-width:120px; padding:12px;">
                <div style="font-size:0.7rem; color:var(--text-secondary); font-weight:700; text-transform:uppercase; margin-bottom:4px;">සක්‍රිය ණය</div>
                <div style="font-family:monospace; font-size:1.2rem; font-weight:800;">${activeLoans.length}</div>
            </div>
            <div class="glass-card" style="flex:1; min-width:120px; padding:12px;">
                <div style="font-size:0.7rem; color:var(--text-secondary); font-weight:700; text-transform:uppercase; margin-bottom:4px;">කල් ඉකුත්</div>
                <div style="font-family:monospace; font-size:1.2rem; font-weight:800; color:${overdueCount > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'};">${overdueCount}</div>
            </div>
            <div class="glass-card" style="flex:1; min-width:120px; padding:12px;">
                <div style="font-size:0.7rem; color:var(--text-secondary); font-weight:700; text-transform:uppercase; margin-bottom:4px;">ගනුදෙනුකරුවන්</div>
                <div style="font-family:monospace; font-size:1.2rem; font-weight:800;">${customers.length}</div>
            </div>
        </div>

        <!-- Main layout -->
        <div style="display:flex; gap:1rem; flex:1; overflow:hidden; min-height:400px;">
            <!-- Left: customer list -->
            <div style="width:280px; min-width:220px; flex-shrink:0; background:var(--bg-card); border:1px solid var(--border-glass); border-radius:12px; display:flex; flex-direction:column; overflow:hidden;">
                <div style="padding:10px 12px; border-bottom:1px solid var(--border-glass); font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">ගනුදෙනුකරුවන්</div>
                <div id="loan-cust-list" style="flex:1; overflow-y:auto;">
                    ${customers.length === 0
                        ? `<div style="text-align:center; color:var(--text-secondary); padding:2rem; font-size:0.85rem;">ගනුදෙනුකරුවෙකු නොමැත.<br>➕ Add Customer ඔබන්න</div>`
                        : customers.map(c => {
                            const custLoans = loans.filter(l => l.customerId === c.id && l.status !== 'cleared');
                            const owed = custLoans.reduce((s,l) => s + ((l.totalAmount||0) - (l.paidAmount||0)), 0);
                            const hasOverdue = custLoans.some(l => this._loanIsOverdue(l));
                            return `<div class="loan-cust-row" onclick="App.loanSelectCustomer('${c.id}')" style="padding:10px 14px; border-bottom:1px solid var(--border-glass); cursor:pointer; display:flex; align-items:center; gap:10px; transition:background 0.15s;">
                                <div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg, var(--accent-cyan), var(--accent-purple, #8b5cf6)); display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; color:#000; flex-shrink:0;">${(c.name||'?')[0].toUpperCase()}</div>
                                <div style="flex:1; min-width:0;">
                                    <div style="font-weight:700; font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.name}</div>
                                    <div style="font-size:0.75rem; color:var(--text-secondary);">${c.phone||'—'}</div>
                                </div>
                                <div style="text-align:right; flex-shrink:0;">
                                    <div style="font-family:monospace; font-size:0.8rem; font-weight:700; color:${owed>0?'var(--accent-danger)':'var(--accent-success)'};">${owed>0?`${cur} ${owed.toFixed(2)}`:'✓ Clear'}</div>
                                    ${hasOverdue ? `<div style="font-size:0.65rem; color:var(--accent-danger); font-weight:700;">⚠ OVERDUE</div>` : ''}
                                </div>
                            </div>`;
                        }).join('')
                    }
                </div>
            </div>
            <!-- Right: loan details -->
            <div id="loan-right-panel" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:0.75rem;">
                <div style="height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-secondary); flex-direction:column; gap:0.5rem;">
                    <div style="font-size:2.5rem; opacity:0.3;">💳</div>
                    <div>ගනුදෙනුකරුවෙකු තෝරන්න</div>
                </div>
            </div>
        </div>`;
    }

    _loanIsOverdue(loan) {
        if(loan.status === 'cleared' || ((loan.totalAmount||0) - (loan.paidAmount||0)) <= 0) return false;
        if(loan.installments?.length) return loan.installments.some(i => !i.paid && new Date(i.dueDate) < new Date());
        if(loan.dueDate) return new Date(loan.dueDate) < new Date();
        return false;
    }

    loanSelectCustomer(custId) {
        const cur = this.getCurrency();
        const cust = db.getLoanCustomers().find(c => c.id === custId);
        if(!cust) return;
        const loans = db.getLoans().filter(l => l.customerId === custId).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        const totalOwed = loans.filter(l => l.status !== 'cleared').reduce((s,l) => s + ((l.totalAmount||0) - (l.paidAmount||0)), 0);

        // Highlight selected
        document.querySelectorAll('.loan-cust-row').forEach(r => r.style.background = '');
        document.querySelectorAll('.loan-cust-row').forEach(r => {
            if(r.getAttribute('onclick')?.includes(custId)) r.style.background = 'var(--accent-cyan-soft, rgba(0,212,255,0.1))';
        });

        const panel = document.getElementById('loan-right-panel');
        if(!panel) return;

        panel.innerHTML = `
            <!-- Customer Header -->
            <div class="glass-card" style="padding:14px; display:flex; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                <div style="width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg, var(--accent-cyan), #8b5cf6); display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:800; color:#000; flex-shrink:0;">${(cust.name||'?')[0].toUpperCase()}</div>
                <div style="flex:1">
                    <div style="font-size:1rem; font-weight:800;">${cust.name}</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary);">📞 ${cust.phone||'—'} ${cust.address ? `&nbsp;|&nbsp; 🏠 ${cust.address}` : ''}</div>
                    ${cust.notes ? `<div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">📝 ${cust.notes}</div>` : ''}
                </div>
                <div style="text-align:right; flex-shrink:0;">
                    <div style="font-size:0.75rem; color:var(--text-secondary);">මුළු ගෙවිය යුතු</div>
                    <div style="font-family:monospace; font-size:1.2rem; font-weight:900; color:${totalOwed>0?'var(--accent-danger)':'var(--accent-success)'};">${totalOwed>0?`${cur} ${totalOwed.toFixed(2)}`:'✓ All Clear'}</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:5px; flex-shrink:0;">
                    <button class="neon-btn" style="margin-top:0; padding:6px 12px; font-size:0.8rem;" onclick="App.loanOpenNewLoan('${cust.id}')">➕ නව ණය</button>
                    <button class="action-btn" style="padding:6px 12px; font-size:0.8rem;" onclick="App.loanOpenCustomerForm('${cust.id}')">✏️ Edit</button>
                    <button class="action-btn danger" style="padding:6px 12px; font-size:0.8rem;" onclick="App.loanDeleteCustomer('${cust.id}')">🗑️</button>
                </div>
            </div>
            <!-- Loans -->
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); padding:2px 0;">ණය (${loans.length})</div>
            ${loans.length === 0
                ? `<div style="text-align:center; color:var(--text-secondary); padding:2rem; font-size:0.85rem;">මෙම ගනුදෙනුකරු සඳහා ණය නොමැත.</div>`
                : loans.map(l => this._renderLoanCard(l, cur)).join('')
            }`;
        lucide.createIcons();
    }

    _renderLoanCard(loan, cur) {
        const pct = loan.totalAmount > 0 ? Math.min(100, ((loan.paidAmount||0) / loan.totalAmount) * 100) : 0;
        const remaining = (loan.totalAmount||0) - (loan.paidAmount||0);
        const isCleared = loan.status === 'cleared' || remaining <= 0;
        const overdue = this._loanIsOverdue(loan);
        const borderColor = isCleared ? 'rgba(0,230,118,0.3)' : overdue ? 'rgba(239,68,68,0.3)' : 'var(--border-glass)';

        const instHTML = loan.installments?.length ? `
            <div style="margin-top:10px; border-top:1px solid var(--border-glass); padding-top:10px;">
                <div style="font-size:0.72rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px;">📅 වාරික කාලසටහන</div>
                ${loan.installments.map((inst,i) => {
                    const due = new Date(inst.dueDate);
                    const daysLeft = Math.ceil((due - new Date()) / (1000*60*60*24));
                    let bg, info;
                    if(inst.paid){ bg='rgba(0,230,118,0.08)'; info=`✓ ගෙව්වා`; }
                    else if(daysLeft < 0){ bg='rgba(239,68,68,0.1)'; info=`⚠ ${Math.abs(daysLeft)}d කල් ඉකුත්`; }
                    else if(daysLeft <= 7){ bg='rgba(245,158,11,0.1)'; info=`⏰ ${daysLeft}d ඉතිරියි`; }
                    else{ bg='var(--bg-dark)'; info=due.toLocaleDateString(); }
                    return `<div style="display:flex; align-items:center; gap:6px; padding:5px 8px; border-radius:6px; margin-bottom:3px; font-size:0.78rem; background:${bg}; border:1px solid var(--border-glass);">
                        <div style="width:7px; height:7px; border-radius:50%; background:${inst.paid?'var(--accent-success)':daysLeft<0?'var(--accent-danger)':'var(--text-secondary)'}; flex-shrink:0;"></div>
                        <div style="flex:1;">වාරිකය ${i+1} — ${cur} ${(inst.amount||0).toFixed(2)}</div>
                        <div style="color:var(--text-secondary);">${info}</div>
                        ${!inst.paid ? `<button class="action-btn" style="padding:2px 8px; font-size:0.7rem;" onclick="App.loanMarkInstPaid('${loan.id}',${i})">✓</button>` : ''}
                    </div>`;
                }).join('')}
            </div>` : '';

        const payHistHTML = loan.paymentHistory?.length ? `
            <div style="margin-top:8px; border-top:1px solid var(--border-glass); padding-top:8px;">
                <div style="font-size:0.72rem; font-weight:700; color:var(--text-secondary); margin-bottom:4px;">ගෙවීම් ඉතිහාසය</div>
                ${loan.paymentHistory.slice(-5).reverse().map(p => `
                    <div style="display:flex; justify-content:space-between; font-size:0.78rem; padding:3px 0; border-bottom:1px solid var(--border-glass);">
                        <span style="color:var(--text-secondary);">${new Date(p.date).toLocaleDateString()} ${p.note ? `— ${p.note}` : ''}</span>
                        <span style="font-family:monospace; color:var(--accent-success); font-weight:700;">+${cur} ${(p.amount||0).toFixed(2)}</span>
                    </div>`).join('')}
            </div>` : '';

        return `<div class="glass-card" style="padding:14px; border-color:${borderColor};">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:10px; gap:8px; flex-wrap:wrap;">
                <div>
                    <div style="font-size:0.9rem; font-weight:800;">${loan.description||'ණය'} ${isCleared?'<span class="badge" style="background:rgba(0,230,118,0.2);color:var(--accent-success);border:1px solid var(--accent-success);">✓ ගෙව්වා</span>':overdue?'<span class="badge" style="background:rgba(239,68,68,0.15);color:var(--accent-danger);border:1px solid var(--accent-danger);">⚠ කල් ඉකුත්</span>':''}</div>
                    <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">📅 ${new Date(loan.createdAt).toLocaleDateString()} ${loan.installments?.length ? `| ${loan.installments.length} වාරික` : ''}</div>
                    ${loan.items ? `<div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">🛍 ${loan.items}</div>` : ''}
                </div>
                <div style="display:flex; gap:5px; flex-shrink:0;">
                    ${!isCleared ? `<button class="neon-btn" style="margin-top:0; padding:5px 10px; font-size:0.78rem;" onclick="App.loanOpenPayment('${loan.id}')">💰 ගෙවීම</button>` : ''}
                    ${!isCleared ? `<button class="action-btn" style="padding:5px 10px; font-size:0.78rem;" onclick="App.loanMarkCleared('${loan.id}')">✓ Clear</button>` : ''}
                    <button class="action-btn danger" style="padding:5px 10px; font-size:0.78rem;" onclick="App.loanDeleteLoan('${loan.id}')">🗑️</button>
                </div>
            </div>
            <!-- Progress -->
            <div style="display:flex; gap:16px; margin-bottom:10px; flex-wrap:wrap;">
                <div style="flex:1; min-width:70px;"><div style="font-size:0.7rem; color:var(--text-secondary); text-transform:uppercase; margin-bottom:2px;">මුළු</div><div style="font-family:monospace; font-size:0.9rem; font-weight:800;">${cur} ${(loan.totalAmount||0).toFixed(2)}</div></div>
                <div style="flex:1; min-width:70px;"><div style="font-size:0.7rem; color:var(--text-secondary); text-transform:uppercase; margin-bottom:2px;">ගෙව්වා</div><div style="font-family:monospace; font-size:0.9rem; font-weight:800; color:var(--accent-success);">${cur} ${(loan.paidAmount||0).toFixed(2)}</div></div>
                <div style="flex:1; min-width:70px;"><div style="font-size:0.7rem; color:var(--text-secondary); text-transform:uppercase; margin-bottom:2px;">ඉතිරිය</div><div style="font-family:monospace; font-size:0.9rem; font-weight:800; color:${remaining>0?'var(--accent-danger)':'var(--accent-success)'};">${cur} ${Math.max(0,remaining).toFixed(2)}</div></div>
            </div>
            <div style="height:6px; background:var(--bg-dark); border-radius:3px; overflow:hidden; margin-bottom:4px;">
                <div style="height:100%; width:${pct.toFixed(1)}%; background:linear-gradient(90deg, var(--accent-cyan), var(--accent-success)); border-radius:3px; transition:width 0.4s;"></div>
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary); text-align:right;">${pct.toFixed(0)}% ගෙව්වා</div>
            ${payHistHTML}
            ${instHTML}
        </div>`;
    }

    loanOpenCustomerForm(id=null) {
        const cust = id ? db.getLoanCustomers().find(c => c.id === id) : null;
        const modal = document.getElementById('loan-customer-modal');
        if(!modal) return;
        modal.querySelector('#loan-cust-modal-title').textContent = cust ? '✏️ ගනුදෙනුකරු සංස්කරණය' : '👤 ගනුදෙනුකරු එකතු කරන්න';
        modal.querySelector('#lc-id').value = id || '';
        modal.querySelector('#lc-name').value = cust?.name || '';
        modal.querySelector('#lc-phone').value = cust?.phone || '';
        modal.querySelector('#lc-address').value = cust?.address || '';
        modal.querySelector('#lc-notes').value = cust?.notes || '';
        modal.classList.add('active');
    }

    loanSaveCustomer() {
        const id = document.getElementById('lc-id').value;
        const name = document.getElementById('lc-name').value.trim();
        if(!name) return this.showToast('නම ඇතුලත් කරන්න', 'error');
        const cust = {
            id: id || null,
            name,
            phone: document.getElementById('lc-phone').value.trim(),
            address: document.getElementById('lc-address').value.trim(),
            notes: document.getElementById('lc-notes').value.trim(),
            updatedAt: new Date().toISOString()
        };
        if(!cust.id) cust.createdAt = new Date().toISOString();
        db.saveLoanCustomer(cust);
        document.getElementById('loan-customer-modal').classList.remove('active');
        this.showToast('ගනුදෙනුකරු සුරැකිණි ✅', 'success');
        this.renderView();
    }

    loanDeleteCustomer(id) {
        const loans = db.getLoans().filter(l => l.customerId === id && l.status !== 'cleared');
        if(loans.length && !confirm(`ගනුදෙනුකරුට ${loans.length} සක්‍රිය ණය ඇත. ඉවත් කරන්නද?`)) return;
        if(!confirm('ගනුදෙනුකරු සහ ඔහුගේ සියලු ණය ඉවත් කරන්නද?')) return;
        db.getLoans().filter(l => l.customerId === id).forEach(l => db.deleteLoan(l.id));
        db.deleteLoanCustomer(id);
        this.showToast('ඉවත් කළා', 'info');
        this.renderView();
    }

    loanOpenNewLoan(preCustomerId=null) {
        const customers = db.getLoanCustomers();
        const modal = document.getElementById('loan-new-modal');
        if(!modal) return;
        const sel = modal.querySelector('#ln-cust');
        sel.innerHTML = `<option value="">— ගනුදෙනුකරු තෝරන්න —</option>` +
            customers.map(c => `<option value="${c.id}" ${c.id===preCustomerId?'selected':''}>${c.name} — ${c.phone||''}</option>`).join('') +
            `<option value="__new__">➕ නව ගනුදෙනුකරු...</option>`;
        modal.querySelector('#ln-id').value = '';
        modal.querySelector('#ln-desc').value = '';
        modal.querySelector('#ln-items').value = '';
        modal.querySelector('#ln-total').value = '';
        modal.querySelector('#ln-init').value = '0';
        modal.querySelector('#ln-due').value = '';
        modal.querySelector('#ln-inst-count').value = '0';
        modal.querySelector('#ln-inst-every').value = '1';
        const nd = new Date(); nd.setMonth(nd.getMonth()+1);
        modal.querySelector('#ln-inst-start').value = nd.toISOString().split('T')[0];
        modal.querySelector('#ln-inst-preview').textContent = '';
        modal.classList.add('active');
    }

    loanPreviewInstallments() {
        const count = parseInt(document.getElementById('ln-inst-count')?.value)||0;
        const el = document.getElementById('ln-inst-preview');
        if(!el) return;
        if(!count){ el.textContent = ''; return; }
        const every = parseInt(document.getElementById('ln-inst-every')?.value)||1;
        const total = parseFloat(document.getElementById('ln-total')?.value)||0;
        const start = document.getElementById('ln-inst-start')?.value;
        const amt = total>0 ? (total/count).toFixed(2) : 0;
        el.textContent = `✅ ${count} වාරික × ${this.getCurrency()} ${amt}, සෑම ${every} මාස(ක), ආරම්භය: ${start||'—'}`;
    }

    loanSaveNewLoan() {
        const custId = document.getElementById('ln-cust')?.value;
        if(!custId || custId==='__new__') return this.showToast('ගනුදෙනුකරු තෝරන්න', 'error');
        const total = parseFloat(document.getElementById('ln-total').value)||0;
        if(!total) return this.showToast('ණය මුදල ඇතුලත් කරන්න', 'error');
        const initPay = parseFloat(document.getElementById('ln-init').value)||0;
        const count = parseInt(document.getElementById('ln-inst-count')?.value)||0;
        const every = parseInt(document.getElementById('ln-inst-every')?.value)||1;
        const startStr = document.getElementById('ln-inst-start')?.value;
        let installments = [];
        if(count > 0 && startStr) {
            const instAmt = (total - initPay) / count;
            for(let i=0; i<count; i++) {
                const d = new Date(startStr);
                d.setMonth(d.getMonth() + i * every);
                installments.push({ dueDate: d.toISOString().split('T')[0], amount: parseFloat(instAmt.toFixed(2)), paid: false });
            }
        }
        const loan = {
            customerId: custId,
            description: document.getElementById('ln-desc').value.trim() || 'ණය',
            items: document.getElementById('ln-items').value.trim() || null,
            totalAmount: total,
            paidAmount: initPay,
            dueDate: document.getElementById('ln-due').value || null,
            installments,
            paymentHistory: initPay > 0 ? [{ date: new Date().toISOString(), amount: initPay, note: 'ආරම්භක ගෙවීම' }] : [],
            status: 'active',
            createdAt: new Date().toISOString()
        };
        db.saveLoan(loan);
        document.getElementById('loan-new-modal').classList.remove('active');
        this.showToast('ණය සාර්ථකව සෑදිණි ✅', 'success');
        this.renderView();
        setTimeout(() => this.loanSelectCustomer(custId), 100);
    }

    loanOpenPayment(loanId) {
        const loan = db.getLoans().find(l => l.id === loanId);
        if(!loan) return;
        const cur = this.getCurrency();
        const remaining = (loan.totalAmount||0) - (loan.paidAmount||0);
        const modal = document.getElementById('loan-pay-modal');
        if(!modal) return;
        modal.querySelector('#lp-loan-id').value = loanId;
        modal.querySelector('#lp-loan-info').textContent = `${loan.description||'ණය'} — ඉතිරිය: ${cur} ${remaining.toFixed(2)}`;
        modal.querySelector('#lp-amt').value = '';
        modal.querySelector('#lp-amt').max = remaining;
        modal.querySelector('#lp-note').value = '';
        modal.querySelector('#lp-date').value = new Date().toISOString().split('T')[0];
        modal.classList.add('active');
    }

    loanRecordPayment() {
        const loanId = document.getElementById('lp-loan-id').value;
        const loan = db.getLoans().find(l => l.id === loanId);
        if(!loan) return;
        const amt = parseFloat(document.getElementById('lp-amt').value)||0;
        if(!amt || amt <= 0) return this.showToast('ගෙවීමේ මුදල ඇතුලත් කරන්න', 'error');
        const note = document.getElementById('lp-note').value.trim();
        const date = document.getElementById('lp-date').value || new Date().toISOString().split('T')[0];
        const newPaid = (loan.paidAmount||0) + amt;
        const cleared = newPaid >= loan.totalAmount;
        db.patchLoan(loanId, {
            paidAmount: newPaid,
            status: cleared ? 'cleared' : 'active',
            paymentHistory: [...(loan.paymentHistory||[]), { date: new Date(date).toISOString(), amount: amt, note }]
        });
        document.getElementById('loan-pay-modal').classList.remove('active');
        this.showToast(`✅ ${this.getCurrency()} ${amt.toFixed(2)} සටහන් කළා!${cleared?' ණය සම්පූර්ණයෙන් ගෙව්වා! 🎉':''}`, 'success');
        const custId = loan.customerId;
        this.renderView();
        setTimeout(() => this.loanSelectCustomer(custId), 100);
    }

    loanMarkInstPaid(loanId, idx) {
        const loan = db.getLoans().find(l => l.id === loanId);
        if(!loan) return;
        const insts = [...loan.installments];
        const inst = insts[idx];
        if(!inst || inst.paid) return;
        insts[idx] = { ...inst, paid: true, paidDate: new Date().toISOString().split('T')[0] };
        const newPaid = (loan.paidAmount||0) + inst.amount;
        const cleared = newPaid >= loan.totalAmount;
        db.patchLoan(loanId, {
            installments: insts,
            paidAmount: newPaid,
            status: cleared ? 'cleared' : 'active',
            paymentHistory: [...(loan.paymentHistory||[]), { date: new Date().toISOString(), amount: inst.amount, note: `වාරිකය ${idx+1} ගෙව්වා` }]
        });
        this.showToast(`වාරිකය ${idx+1} ✅`, 'success');
        const custId = loan.customerId;
        this.renderView();
        setTimeout(() => this.loanSelectCustomer(custId), 100);
    }

    loanMarkCleared(loanId) {
        if(!confirm('ණය සම්පූර්ණයෙන් ගෙව්වා ලෙස සලකුණු කරන්නද?')) return;
        const loan = db.getLoans().find(l => l.id === loanId);
        if(!loan) return;
        db.patchLoan(loanId, { status: 'cleared', paidAmount: loan.totalAmount });
        this.showToast('ණය ගෙව්වා ✅', 'success');
        const custId = loan.customerId;
        this.renderView();
        setTimeout(() => this.loanSelectCustomer(custId), 100);
    }

    loanDeleteLoan(loanId) {
        if(!confirm('ණය වාර්තාව ඉවත් කරන්නද?')) return;
        const loan = db.getLoans().find(l => l.id === loanId);
        const custId = loan?.customerId;
        db.deleteLoan(loanId);
        this.showToast('ඉවත් කළා', 'info');
        this.renderView();
        if(custId) setTimeout(() => this.loanSelectCustomer(custId), 100);
    }

} // end class AppCore

// Attach globally
window.App = null;
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for initial Firebase Sync
    await db.init();
    
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';

    window.App = new AppCore();

    setInterval(() => {
        if(navigator.onLine) {
            db.poll();
        }
    }, 10000);
});
