const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

// Configuration
const WATCH_FILES = [
    'js/data/qcm_ffvl.csv',
    'js/data/qcm_ffvl_explanations.csv'
];
const CONVERT_SCRIPT = 'python3 js/data/convert_csv_to_js.py';

console.log("👀 Surveillance des fichiers CSV activée...");
WATCH_FILES.forEach(file => {
    console.log(`   - ${file}`);
});
console.log("\n(Appuyez sur Ctrl+C pour arrêter)\n");

// Debounce function to avoid double-firing on some OSs
let fsWait = false;
function triggerUpdate(filename) {
    if (fsWait) return;
    fsWait = true;
    setTimeout(() => { fsWait = false; }, 100);

    console.log(`📝 Modification détectée : ${filename}`);
    console.log("🔄 Mise à jour de qcm_data.js...");

    exec(CONVERT_SCRIPT, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Erreur: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`⚠️ Attention: ${stderr}`);
        }
        console.log(stdout);
        console.log("✅ Mise à jour terminée !\n");
    });
}

// Initialize Watchers
WATCH_FILES.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Fichier introuvable : ${filePath}`);
        return;
    }

    fs.watch(filePath, (eventType, filename) => {
        if (eventType === 'change') {
            triggerUpdate(filename || file);
        }
    });
});
