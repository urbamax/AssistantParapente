const SitesEngine = {
    state: {
        filterWind: [], // Array of selected winds (Include)
        filterType: [], // Array of selected types (Include)
        filterWindInclude: [],
        filterWindExclude: [],
        filterTypeInclude: [],
        filterTypeExclude: [],
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
        expandedSites: {}
    }
};

SitesEngine.init = function (engineRef) {
        console.log("SitesEngine Initialized");
        this.engine = engineRef;
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

        // Trigger background geolocation to activate radius slider immediately if allowed
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.state.userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    const container = document.getElementById('radius-slider-container');
                    if (container) container.style.display = 'flex';
                    this.renderList();
                    if (this.state.map) {
                        this.updateMapMarkers();
                    }
                },
                (error) => {
                    console.log("Background geolocation failed/denied:", error);
                }
            );
        }

        this.renderList();
        this.switchMapMode('leaflet');
    };
