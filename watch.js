const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

// Configuration
const CONFIG = {
    data: {
        files: [
            'js/data/qcm_ffvl.csv',
            'js/data/qcm_ffvl_explanations.csv'
        ],
        script: 'python3 js/data/convert_csv_to_js.py',
        label: 'DATA'
    }
};

console.log("👀 Surveillance des fichiers activée...");

// Helper to setup watcher
function setupWatcher(category, fileList, command) {
    fileList.forEach(file => {
        const filePath = path.join(__dirname, file);

        console.log(`   - [${category}] ${file}`);

        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ Fichier introuvable : ${filePath}`);
            return;
        }

        let fsWait = false;
        fs.watch(filePath, (eventType, filename) => {
            if (eventType === 'change') {
                if (fsWait) return;
                fsWait = true;
                setTimeout(() => { fsWait = false; }, 100);

                console.log(`\n📝 Modification détectée (${category}) : ${filename || file}`);
                console.log(`🔄 Exécution : ${command}...`);

                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`❌ Erreur: ${error.message}`);
                        return;
                    }
                    if (stderr) {
                        // Some commands output to stderr even on success, so we log it but don't fail hard usually
                        // or valid warnings.
                        if (stderr.trim().length > 0) console.warn(`⚠️ Output (stderr): ${stderr}`);
                    }
                    console.log(stdout);
                    console.log(`✅ ${category} mis à jour !\n`);
                });
            }
        });
    });
}

setupWatcher(CONFIG.data.label, CONFIG.data.files, CONFIG.data.script);

console.log("\n(Appuyez sur Ctrl+C pour arrêter)\n");
