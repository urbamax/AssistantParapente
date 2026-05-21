const SitesEngine = {
    state: {
        filterWind: [], // Array of selected winds (Include)
        filterType: [], // Array of selected types (Include)
        filterWindInclude: [],
        filterWindExclude: [],
        filterTypeInclude: [],
        filterTypeExclude: ['ATTERRO'],
        currentSiteCoords: null,
        userLocation: null, // {lat, lng}
        radiusLimit: 210, // Max distance radius limit (210 = Illimité)
        sortMode: 'CONDITIONS', // 'CONDITIONS', 'DISTANCE', 'AZ'
        conditionsStrategy: 'CONSECUTIVE', // 'CONSECUTIVE', 'HALF_DAY', 'DAILY', 'TOTAL'
        forecastOffset: 0, // Hourly forecast offset (0 to 48)
        weatherForecasts: {}, // siteId -> array of hourly weather forecast objects
        limitWindMin: 0,
        limitWindMax: 25,
        limitGustDelta: 10,
        hideUnflyable: false,
        weatherModel: 'meteofrance', // 'meteofrance', 'icon', 'ecmwf', 'gfs'
        map: null,
        markersGroup: null,
        tileLayer: null,
        mapExpanded: true,
        expandedSites: {},
        searchQuery: '' // Text search query
    }
};

SitesEngine.init = function (engineRef) {
        console.log("SitesEngine Initialized");
        this.engine = engineRef;
    };

SitesEngine.removeAccents = function (str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

SitesEngine.requestGpsLocation = function (isInitialLoad = false) {
    const statusEl = document.getElementById('address-status-message');
    const inputEl = document.getElementById('address-input');
    const gpsBtn = document.getElementById('btn-use-gps');

    if (window.GdprEngine && !window.GdprEngine.isConsentGranted('gps')) {
        if (!isInitialLoad) {
            const openSettings = confirm("Vous devez autoriser la géolocalisation dans vos options de confidentialité pour utiliser cette fonctionnalité. Souhaitez-vous modifier vos préférences ?");
            if (openSettings) {
                window.GdprEngine.showModal('gdpr-settings-modal');
            }
        }
        if (statusEl) {
            statusEl.innerHTML = `<i class="ri-shield-user-line" style="color: var(--text-muted);"></i> Géolocalisation désactivée par vos choix de confidentialité. <a href="#" onclick="if(window.GdprEngine) window.GdprEngine.showModal('gdpr-settings-modal'); return false;" style="color: var(--accent-blue); text-decoration: underline; font-weight: 600;">Gérer</a>`;
            statusEl.style.color = 'var(--text-muted)';
        }
        if (gpsBtn) {
            gpsBtn.style.borderColor = 'var(--border-color)';
            gpsBtn.style.color = 'var(--text-muted)';
        }
        return;
    }

    if (!navigator.geolocation) {
        if (!isInitialLoad && statusEl) {
            statusEl.innerHTML = `<i class="ri-error-warning-line" style="color: var(--accent-red);"></i> La géolocalisation n'est pas supportée par votre navigateur.`;
            statusEl.style.color = 'var(--accent-red)';
        }
        return;
    }

    if (!isInitialLoad && statusEl) {
        statusEl.innerHTML = `<i class="ri-loader-4-line" style="animation: spin 1s linear infinite;"></i> Récupération de la position GPS...`;
        statusEl.style.color = 'var(--text-muted)';
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            // Reset cached distances to force recalculation with new GPS coordinates
            if (typeof SITES_DATA !== 'undefined' && Array.isArray(SITES_DATA)) {
                SITES_DATA.forEach(s => { delete s.distance; });
            }

            this.state.userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            if (inputEl) inputEl.value = "Ma position GPS";
            if (statusEl) {
                statusEl.innerHTML = `<i class="ri-checkbox-circle-line" style="color: var(--accent-green);"></i> Position GPS actuelle activée.`;
                statusEl.style.color = 'var(--accent-green)';
            }
            if (gpsBtn) {
                gpsBtn.style.borderColor = 'var(--accent-blue)';
                gpsBtn.style.color = 'var(--accent-blue)';
            }

            this.renderList();
            if (this.state.map) {
                this.updateMapMarkers();
            }
        },
        (error) => {
            console.error("Geolocation error:", error);
            if (!isInitialLoad) {
                alert("Impossible d'obtenir votre position GPS. Assurez-vous d'avoir autorisé l'accès.");
            }
            if (statusEl) {
                statusEl.innerHTML = `<i class="ri-error-warning-line" style="color: var(--accent-red);"></i> Position GPS indisponible. Saisissez une adresse.`;
                statusEl.style.color = 'var(--accent-red)';
            }
        }
    );
};

SitesEngine.show = function () {
        if (!this.initialized) {
            this.setupDropdowns();

            // Prefill limits inputs and select from state
            const minInput = document.getElementById('limit-wind-min');
            const maxInput = document.getElementById('limit-wind-max');
            const deltaInput = document.getElementById('limit-gust-delta');
            const hideUnflyableCheckbox = document.getElementById('hide-unflyable-checkbox');
            const modelSelect = document.getElementById('weather-model-select');
            const sortSelect = document.getElementById('select-sort-mode');
            const radiusSlider = document.getElementById('radius-slider');
            const radiusLabel = document.getElementById('radius-val-label');

            if (minInput) minInput.value = this.state.limitWindMin;
            if (maxInput) maxInput.value = this.state.limitWindMax;
            if (deltaInput) deltaInput.value = this.state.limitGustDelta;
            if (hideUnflyableCheckbox) hideUnflyableCheckbox.checked = this.state.hideUnflyable;
            if (modelSelect) modelSelect.value = this.state.weatherModel;
            if (sortSelect) sortSelect.value = this.state.sortMode;
            if (radiusSlider) radiusSlider.value = this.state.radiusLimit;
            if (radiusLabel) radiusLabel.textContent = this.state.radiusLimit === 210 ? 'Illimité' : `${this.state.radiusLimit} km`;

            this.fetchWeatherForSites();
            this.initialized = true;
        }
        this.initMap();
        if (this.state.map) setTimeout(() => { this.state.map.invalidateSize(); }, 100);

        // Trigger central GPS request
        this.requestGpsLocation(true);

        this.renderList();
        this.switchMapMode('leaflet');
    };
