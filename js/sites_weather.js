SitesEngine.fetchWeatherForSites = async function () {
    if (typeof SITES_DATA === 'undefined' || SITES_DATA.length === 0) return;

    const activeSites = SITES_DATA.filter(s => s.affiche !== false && !isNaN(parseFloat(s.latitude)) && !isNaN(parseFloat(s.longitude)));
    if (activeSites.length === 0) return;

    const lats = activeSites.map(s => parseFloat(s.latitude)).join(',');
    const lons = activeSites.map(s => parseFloat(s.longitude)).join(',');

    let apiEndpoint = 'meteofrance'; // default AROME
    if (this.state.weatherModel === 'icon' || this.state.weatherModel === 'iconeu') apiEndpoint = 'dwd-icon';
    else if (this.state.weatherModel === 'gfs') apiEndpoint = 'gfs';
    else if (this.state.weatherModel === 'ecmwf') apiEndpoint = 'ecmwf';
    else if (this.state.weatherModel === 'meteoblue') apiEndpoint = 'forecast';

    let modelParam = '';
    if (this.state.weatherModel === 'iconeu') {
        modelParam = '&models=icon_eu';
    } else if (this.state.weatherModel === 'icon') {
        modelParam = '&models=icon_global';
    }

    const url = `https://api.open-meteo.com/v1/${apiEndpoint}?latitude=${lats}&longitude=${lons}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation&daily=sunrise,sunset&timezone=Europe%2FParis&forecast_days=6${modelParam}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const results = Array.isArray(data) ? data : [data];

        this.state.weatherForecasts = {};

        // Find current time index in hourly forecast to align offset=0 with current hour
        const now = new Date();
        let currentHourIndex = 0;
        if (results[0]?.hourly?.time) {
            const times = results[0].hourly.time;
            const currentTimestamp = now.getTime();
            let minDiff = Infinity;
            times.forEach((t, i) => {
                const diff = Math.abs(new Date(t).getTime() - currentTimestamp);
                if (diff < minDiff) {
                    minDiff = diff;
                    currentHourIndex = i;
                }
            });
        }

        activeSites.forEach((site, index) => {
            try {
                const hourly = results[index]?.hourly;
                if (hourly) {
                    const forecasts = [];
                    const windSpeedKey = Object.keys(hourly).find(k => k.startsWith('wind_speed_10m')) || 'wind_speed_10m';
                    const windDirKey = Object.keys(hourly).find(k => k.startsWith('wind_direction_10m')) || 'wind_direction_10m';
                    const windGustKey = Object.keys(hourly).find(k => k.startsWith('wind_gusts_10m')) || 'wind_gusts_10m';
                    const precipKey = Object.keys(hourly).find(k => k.startsWith('precipitation')) || 'precipitation';

                    // Keep up to 120 hours starting from currentHourIndex
                    for (let i = 0; i <= 120; i++) {
                        const idx = currentHourIndex + i;
                        if (idx < hourly.time.length) {
                            const dirDeg = hourly[windDirKey][idx];
                            const card = this.degreesToCardinal(dirDeg);

                            let sunriseText = '';
                            let sunsetText = '';
                            let legalStartText = '';
                            let legalEndText = '';
                            let isDaytime = true;

                            const daily = results[index]?.daily;
                            if (daily && daily.time) {
                                const datePart = hourly.time[idx].substring(0, 10);
                                const dailyIdx = daily.time.indexOf(datePart);

                                if (dailyIdx !== -1) {
                                    const sunriseStr = daily.sunrise ? daily.sunrise[dailyIdx] : null;
                                    const sunsetStr = daily.sunset ? daily.sunset[dailyIdx] : null;

                                    if (sunriseStr && sunsetStr) {
                                        sunriseText = sunriseStr.substring(11, 16).replace(':', 'h');
                                        sunsetText = sunsetStr.substring(11, 16).replace(':', 'h');

                                        const forecastHour = parseInt(hourly.time[idx].substring(11, 13));
                                        const forecastMin = parseInt(hourly.time[idx].substring(14, 16));
                                        const forecastMins = forecastHour * 60 + forecastMin;

                                        const sunriseHour = parseInt(sunriseStr.substring(11, 13));
                                        const sunriseMin = parseInt(sunriseStr.substring(14, 16));
                                        const sunriseMins = sunriseHour * 60 + sunriseMin;

                                        const sunsetHour = parseInt(sunsetStr.substring(11, 13));
                                        const sunsetMin = parseInt(sunsetStr.substring(14, 16));
                                        const sunsetMins = sunsetHour * 60 + sunsetMin;

                                        const legalStartMins = sunriseMins - 30;
                                        const legalEndMins = sunsetMins - 30;

                                        const formatMinsToTime = (totalMins) => {
                                            const normalized = (totalMins + 1440) % 1440;
                                            const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
                                            const mm = String(normalized % 60).padStart(2, '0');
                                            return `${hh}h${mm}`;
                                        };

                                        legalStartText = formatMinsToTime(legalStartMins);
                                        legalEndText = formatMinsToTime(legalEndMins);

                                        isDaytime = forecastMins >= legalStartMins && forecastMins <= legalEndMins;
                                    }
                                }
                            }

                            forecasts.push({
                                time: hourly.time[idx],
                                windSpeed: Math.round(hourly[windSpeedKey][idx]),
                                windGust: Math.round(hourly[windGustKey][idx]),
                                windDirDeg: Math.round(dirDeg),
                                windCard: card,
                                precipitation: hourly[precipKey] ? hourly[precipKey][idx] ?? 0 : 0,
                                sunriseText: sunriseText,
                                sunsetText: sunsetText,
                                legalStartText: legalStartText,
                                legalEndText: legalEndText,
                                isDaytime: isDaytime
                            });
                        }
                    }
                    this.state.weatherForecasts[site.id] = forecasts;
                }
            } catch (siteErr) {
                console.error(`Erreur lors du traitement météo pour le site ${site.nom}:`, siteErr);
            }
        });

        // Enable the forecast slider
        const slider = document.getElementById('forecast-slider');
        if (slider) {
            slider.disabled = false;
            const maxVal = Math.max(0, (results[0]?.hourly?.time?.length || 121) - currentHourIndex - 1);
            slider.max = Math.min(maxVal, this.state.forecastMaxRange || 120);

            // Adjust offset if it exceeds new max
            if (this.state.forecastOffset > slider.max) {
                this.state.forecastOffset = parseInt(slider.max);
            }
            slider.value = this.state.forecastOffset;
            const percentage = slider.max > 0 ? (this.state.forecastOffset / slider.max) * 100 : 0;
            slider.style.background = `linear-gradient(to right, var(--accent-blue) 0%, var(--accent-blue) ${percentage}%, rgba(255,255,255,0.1) ${percentage}%, rgba(255,255,255,0.1) 100%)`;
        }

        this.updateForecastLabel();

        this.renderList();
        if (this.state.map) {
            this.updateMapMarkers();
        }
    } catch (e) {
        console.error("Erreur lors de la récupération météo:", e);
        const container = document.getElementById('sites-list-container');
        if (container) {
            container.innerHTML = `
                    <div style="color:var(--accent-red, #ef4444); font-size: 0.95rem; text-align: center; padding: 24px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-lg); width: 100%;">
                        <i class="ri-error-warning-line" style="font-size: 1.8rem; display: block; margin-bottom: 8px;"></i>
                        <strong>Erreur de chargement météo :</strong><br>
                        <span style="font-family: monospace; font-size: 0.85rem; opacity: 0.85;">${e.message || e}</span>
                        <button onclick="SitesEngine.fetchWeatherForSites()" class="action-btn-primary" style="margin-top: 12px; padding: 8px 16px; font-size: 0.8rem; border-radius: var(--radius-pill);">Réessayer</button>
                    </div>
                `;
        }
    }
};

SitesEngine.changeWeatherModel = function (model) {
    this.state.weatherModel = model;

    // Show loading state
    const container = document.getElementById('sites-list-container');
    if (container) {
        container.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 40px; font-size: 1.1rem; color: var(--text-secondary);">
                    <i class="ri-loader-4-line" style="animation: spin 1s linear infinite; font-size: 1.5rem;"></i>
                    <span>Chargement des prévisions (${model.toUpperCase()})...</span>
                </div>
            `;
    }

    this.savePreferences();
    this.fetchWeatherForSites();
};

SitesEngine.isForecastFlyable = function (site, weather) {
    // 1. Construire l'objet des préférences de l'utilisateur
    const userPrefs = {
        vMin: this.state.limitWindMin,
        vMax: this.state.limitWindMax,
        deltaRafaleMax: this.state.limitGustDelta
    };

    // 2. Déterminer la meilleure orientation du site par rapport au vent actuel
    let bestOrientation = undefined;

    const orientations = site.orientation ? site.orientation.split(',').map(v => v.trim()) : [];
    if (orientations.length > 0 && weather) {
        const CARD_TO_DEG = { "N": 0, "NE": 45, "E": 90, "SE": 135, "S": 180, "SO": 225, "O": 270, "NO": 315 };
        let minDiff = 180;

        orientations.forEach(card => {
            const deg = CARD_TO_DEG[card];
            if (deg !== undefined) {
                // Trouver la différence angulaire
                let diff = Math.abs(weather.windDirDeg - deg) % 360;
                diff = diff > 180 ? 360 - diff : diff;

                if (diff < minDiff) {
                    minDiff = diff;
                    bestOrientation = deg;
                }
            }
        });
    }

    // 3. Préparer l'objet site pour l'évaluateur (on ne modifie pas l'objet original)
    const siteGeometry = {
        ...site,
        orientation_ideale_deg: bestOrientation
    };

    // 4. Appel du nouveau module de scoring
    return evaluateSpotForecast(siteGeometry, weather, userPrefs);
};

SitesEngine.degreesToCardinal = function (deg) {
    const val = Math.floor((deg / 45) + 0.5);
    const arr = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
    return arr[(val % 8)];
};