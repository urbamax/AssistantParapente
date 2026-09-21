import StorageService from './storage.js';
import IGCParser from './igc_parser.js';

class LogbookService {
    constructor() {
        this.flights = [];
        this.equipment = [];
        this.loadData();
    }

    loadData() {
        this.flights = StorageService.get(StorageService.KEYS.LOGBOOK_DATA) || [];
        if (!Array.isArray(this.flights)) this.flights = [];
        this.flights.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

        this.equipment = StorageService.get(StorageService.KEYS.EQUIPMENT_DATA) || [];
        if (!Array.isArray(this.equipment)) this.equipment = [];
    }

    saveFlights() {
        StorageService.set(StorageService.KEYS.LOGBOOK_DATA, this.flights);
        this.syncCloud();
    }

    saveEquipment() {
        StorageService.set(StorageService.KEYS.EQUIPMENT_DATA, this.equipment);
        this.syncCloud();
    }

    syncCloud() {
        if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.currentUser) {
            window.FirebaseAuthEngine.syncLogbookData(this.flights).catch((error) =>
                console.warn('Échec de la synchro Cloud en arrière-plan (vols) :', error),
            );

            if (typeof window.FirebaseAuthEngine.syncEquipmentData === 'function') {
                window.FirebaseAuthEngine.syncEquipmentData(this.equipment).catch((error) =>
                    console.warn('Échec de la synchro Cloud en arrière-plan (équipement) :', error),
                );
            }

            // Déclenche une synchro debounced pour regrouper les micro-modifications
            // et mettre à jour "Dernière synchro" en temps réel dans l'UI.
            if (typeof window.FirebaseAuthEngine.triggerDebouncedSync === 'function') {
                window.FirebaseAuthEngine.triggerDebouncedSync();
            }
        }
    }

    // --- FLIGHTS CRUD ---
    addFlight(flight) {
        flight.id = Date.now().toString();
        flight.updatedAt = Date.now();
        flight.syncPending = true;
        this.flights.push(flight);
        this.flights.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
        this.saveFlights();
        return flight;
    }

    updateFlight(id, updatedData) {
        const index = this.flights.findIndex((f) => f.id === id);
        if (index !== -1) {
            this.flights[index] = { ...this.flights[index], ...updatedData, updatedAt: Date.now(), syncPending: true };
            this.flights.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
            this.saveFlights();
        }
    }

    deleteFlight(id) {
        this.flights = this.flights.filter((f) => f.id !== id);
        this.saveFlights();

        let deleted = [];
        try {
            deleted = JSON.parse(localStorage.getItem('deleted_flights') || '[]');
        } catch {}
        if (!deleted.includes(id)) {
            deleted.push(id);
            localStorage.setItem('deleted_flights', JSON.stringify(deleted));
        }

        if (
            window.FirebaseAuthEngine &&
            window.FirebaseAuthEngine.currentUser &&
            typeof window.FirebaseAuthEngine.deleteLogbookEntry === 'function'
        ) {
            window.FirebaseAuthEngine.deleteLogbookEntry(id).catch(console.error);
        }
    }

    getFlights() {
        return this.flights;
    }

    getFlightById(id) {
        return this.flights.find((f) => f.id === id);
    }

    // --- EQUIPMENT CRUD ---
    addEquipment(equip) {
        equip.id = Date.now().toString();
        equip.updatedAt = Date.now();
        equip.syncPending = true;
        if (!equip.statut) equip.statut = 'actif';
        this.equipment.push(equip);
        this.saveEquipment();
        return equip;
    }

    updateEquipment(id, updatedData) {
        const index = this.equipment.findIndex((e) => e.id === id);
        if (index !== -1) {
            // Conserver le statut précédent si non fourni
            const statut = updatedData.statut || this.equipment[index].statut;
            this.equipment[index] = {
                ...this.equipment[index],
                ...updatedData,
                id,
                statut,
                updatedAt: Date.now(),
                syncPending: true,
            };
            this.saveEquipment();
        }
    }

    deleteEquipment(id) {
        this.equipment = this.equipment.filter((e) => e.id !== id);
        this.saveEquipment();

        if (
            window.FirebaseAuthEngine &&
            window.FirebaseAuthEngine.currentUser &&
            typeof window.FirebaseAuthEngine.deleteEquipmentEntry === 'function'
        ) {
            window.FirebaseAuthEngine.deleteEquipmentEntry(id).catch(console.error);
        }
    }

    toggleEquipmentStatus(id) {
        const index = this.equipment.findIndex((e) => e.id === id);
        if (index !== -1) {
            this.equipment[index].statut = this.equipment[index].statut === 'actif' ? 'inactif' : 'actif';
            this.equipment[index].updatedAt = Date.now();
            this.equipment[index].syncPending = true;
            this.saveEquipment();
        }
    }

    getEquipment() {
        return this.equipment;
    }

    getEquipmentById(id) {
        return this.equipment.find((e) => e.id === id);
    }

    // --- BUSINESS LOGIC ---
    computeEquipmentWear() {
        const stats = {};

        // Init stats
        this.equipment.forEach((e) => {
            const name = (e.nom || '').toLowerCase();
            stats[name] = {
                equip: e,
                totalSessions: 0,
                totalTime: 0,
                nextRevisionDate: this._calculateNextRevision(e),
                alerts: {
                    dateAlert: false, // Orange/Red if date is close/passed
                    hoursAlert: false, // Orange/Red if flight hours are close/passed to periodiciteHeures
                },
            };
        });

        // Compute from flights
        this.flights.forEach((f) => {
            const voile = (f.voile || '').toLowerCase();
            const sellette = (f.sellette || '').toLowerCase();
            const duree = parseInt(f.duree || 0, 10);

            if (stats[voile]) {
                stats[voile].totalSessions++;
                stats[voile].totalTime += duree;
            }
            if (stats[sellette]) {
                stats[sellette].totalSessions++;
                stats[sellette].totalTime += duree;
            }
        });

        // Calculate Alerts
        const today = new Date(); // Date de référence (peut être forcée si besoin)
        Object.keys(stats).forEach((key) => {
            const s = stats[key];
            const e = s.equip;

            s.diffDays = Infinity;
            s.revisionDateStr = '';

            // Date alerts
            if (s.nextRevisionDate) {
                s.revisionDateStr = s.nextRevisionDate.toISOString().split('T')[0];
                const diffTime = s.nextRevisionDate.getTime() - today.getTime();
                s.diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (s.diffDays <= 0) s.alerts.dateAlert = 'red';
                else if (s.diffDays <= 30) s.alerts.dateAlert = 'orange';
            }

            // Hours alerts
            s.hoursRemaining = null;
            if (e.periodiciteHeures && e.periodiciteHeures > 0) {
                const totalHours = s.totalTime / 60;
                s.hoursRemaining = e.periodiciteHeures - totalHours;

                if (s.hoursRemaining <= 0) s.alerts.hoursAlert = 'red';
                else if (s.hoursRemaining <= 15) s.alerts.hoursAlert = 'orange';
            }
        });

        return stats;
    }

    _calculateNextRevision(equip) {
        if (!equip.periodicite || equip.periodicite <= 0) return null;
        const refDateStr = equip.derniereRevision || equip.dateAchat;
        if (!refDateStr) return null;

        const refDate = new Date(refDateStr);
        if (isNaN(refDate.getTime())) return null;

        const nextRevDate = new Date(refDate);
        nextRevDate.setMonth(nextRevDate.getMonth() + parseInt(equip.periodicite, 10));
        return nextRevDate;
    }

    // altOffset (m) : correction constante ajoutée à toutes les altitudes de la trace, pour les
    // vario mal calés au décollage (ex. atterro à -7 m alors qu'il est à 2 m). Un décalage
    // constant ne change pas le gain, seulement les altitudes absolues.
    parseIGC(rawText, altOffset = 0) {
        try {
            const parsed = IGCParser.parse(rawText);
            if (parsed && parsed.points && parsed.points.length > 0) {
                const offset = Number.isFinite(altOffset) ? altOffset : 0;
                const points = offset ? parsed.points.map((p) => ({ ...p, alt: p.alt + offset })) : parsed.points;
                const hasMax = parsed.maxAltitude > -1000;
                return {
                    success: true,
                    data: {
                        duration: parsed.duration || 0,
                        dateStr: parsed.dateStr || null,
                        maxAltitude: hasMax ? parsed.maxAltitude + Math.round(offset) : null,
                        gain: typeof parsed.gain === 'number' && !isNaN(parsed.gain) ? parsed.gain : null,
                        points,
                        takeoffAlt: points[0].alt,
                        landingAlt: points[points.length - 1].alt,
                    },
                    error: null,
                };
            }
            return { success: false, data: null, error: 'No valid GPS data found in file.' };
        } catch (e) {
            return { success: false, data: null, error: e.message };
        }
    }

    async reverseGeocode(lat, lon) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await res.json();
            const city =
                (data.address &&
                    (data.address.village || data.address.town || data.address.city || data.address.municipality)) ||
                null;
            return { success: true, data: { city }, error: null };
        } catch (e) {
            return { success: false, data: null, error: e.message || 'Erreur de géocodage' };
        }
    }

    // Open-Meteo (gratuit) limite le nombre d'appels par IP et par heure, et la vue Sites en
    // consomme beaucoup : un 429 est fréquent et passager. Un seul nouvel essai après une pause,
    // comme le fait déjà sites_service, avant de renoncer.
    async _fetchWeather(url) {
        let response = await fetch(url);
        if (response.status === 429) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            response = await fetch(url);
        }
        return response;
    }

    async fetchSessionWeather(lat, lon, datetimeStr) {
        try {
            const dateObj = new Date(datetimeStr);
            const dateStrQuery = datetimeStr.split('T')[0];
            const hour = dateObj.getHours(); // 0-23
            const parsedLat = parseFloat(lat);
            const parsedLon = parseFloat(lon);

            // L'API Open-Meteo "forecast" avec start_date et end_date permet de récupérer
            // les données passées récentes. models=meteofrance_seamless encapsule AROME/ARPEGE.
            let url = `https://api.open-meteo.com/v1/forecast?latitude=${parsedLat}&longitude=${parsedLon}&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code&wind_speed_unit=kmh&timezone=auto&start_date=${dateStrQuery}&end_date=${dateStrQuery}&models=meteofrance_seamless`;
            let response = await this._fetchWeather(url);

            // Fallback for dates older than the forecast model limit
            if (response.status === 400) {
                url = `https://archive-api.open-meteo.com/v1/archive?latitude=${parsedLat}&longitude=${parsedLon}&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code&wind_speed_unit=kmh&timezone=auto&start_date=${dateStrQuery}&end_date=${dateStrQuery}`;
                response = await this._fetchWeather(url);
            }

            if (!response.ok) {
                const error =
                    response.status === 429
                        ? 'Service météo momentanément saturé, réessayez dans quelques minutes'
                        : `Open-Meteo API error: ${response.status}`;
                return { success: false, data: null, error };
            }

            const result = await response.json();
            if (!result || !result.hourly || !result.hourly.temperature_2m) {
                return { success: false, data: null, error: "Format JSON inattendu de l'API" };
            }

            const temp = result.hourly.temperature_2m[hour];
            const windSpeed = result.hourly.wind_speed_10m[hour];
            const windGusts = result.hourly.wind_gusts_10m[hour];
            const windDir = result.hourly.wind_direction_10m[hour];
            const weatherCode = result.hourly.weather_code[hour];

            if (temp === undefined || temp === null || windSpeed === undefined || windSpeed === null) {
                return { success: false, data: null, error: 'Données hors couverture (trop ancien)' };
            }

            return {
                success: true,
                data: {
                    temperature: Math.round(temp),
                    ventVitesse: Math.round(windSpeed),
                    ventRafales: windGusts !== undefined && windGusts !== null ? Math.round(windGusts) : null,
                    ventDirection: windDir !== undefined && windDir !== null ? Math.round(windDir) : null,
                    weatherCode: weatherCode !== undefined && weatherCode !== null ? weatherCode : null,
                    source: 'auto',
                },
                error: null,
            };
        } catch (e) {
            return { success: false, data: null, error: e.message || 'Erreur réseau' };
        }
    }
}

export default new LogbookService();
