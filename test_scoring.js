const fs = require('fs');

const code = fs.readFileSync('/Volumes/maximeurbaniak/AssistantParapente/js/weatherScoring.js', 'utf8');

global.localStorage = {
    getItem: function(key) {
        if (key === 'tp_equipment_data') {
            return JSON.stringify([
                { id: '1', nom: 'SUPAIR BIRDY 2', type: 'voile', ventMin: 0, ventMax: 20 }
            ]);
        }
        return null;
    }
};

eval(code);

const site = { orientation: 'N,NE', orientation_ideale_deg: 0 };
const weather = {
    isDaytime: true,
    windSpeed: 15,
    windGust: 20,
    windDirDeg: 0,
    windCard: 'N',
    cape: 0,
    precipitation: 0
};
const userPreferences = {
    filterMode: 'hardware',
    vMin: 0,
    vMax: 25,
    deltaRafaleMax: 10
};

const result = evaluateSpotForecast(site, weather, userPreferences);
console.log(result);
