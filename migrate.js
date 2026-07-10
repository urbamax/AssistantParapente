const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'js/data/sites_data copie.js');
const outputPath = path.join(__dirname, 'js/data/sites_data.js');

let fileContent = fs.readFileSync(inputPath, 'utf8');

// Strip the variable declaration to make it parsable
const dataString = fileContent.replace('const SITES_DATA = ', '').trim().replace(/;$/, '');
let sites;
try {
    sites = eval('(' + dataString + ')');
} catch(e) {
    console.error("Error parsing backup data:", e);
    process.exit(1);
}

function getSiteSousType(typeOriginal) {
    const typeMap = {
        "NATUREL": ["Décollage", "Naturel"],
        "DUNE": ["Décollage", "Dune"],
        "ATTERRO": ["Atterrissage"],
        "ATTERO": ["Atterrissage"], 
        "TREUIL": ["Décollage", "Treuil"], 
        "GONFLAGE": ["Pente école"]
    };
    
    if (!typeOriginal) return ["Décollage", "Naturel"];
    
    const typesToProcess = Array.isArray(typeOriginal) ? typeOriginal : [typeOriginal];
    let newTypes = [];
    
    typesToProcess.forEach(t => {
        const mapped = typeMap[t] || ["Décollage", "Naturel"];
        newTypes.push(...mapped);
    });
    
    return [...new Set(newTypes)];
}

const newSites = sites.map(site => {
    const newSite = {};
    
    // referecence_terrain -> id (String)
    newSite.id = String(site.referecence_terrain || "");
    
    // Conservation du nom et autres champs
    newSite.nom = site.nom;
    
    // latitude -> lat (String)
    // longitude -> lon (String)
    // altitude -> alt (String)
    newSite.lat = String(site.latitude || "");
    newSite.lon = String(site.longitude || "");
    newSite.alt = String(site.altitude || "");
    
    // site_type et site_sous_type
    newSite.site_type = "vol";
    newSite.site_sous_type = getSiteSousType(site.type);
    
    // orientations_vent (Array) -> orientation (String)
    if (Array.isArray(site.orientations_vent)) {
        newSite.orientation = site.orientations_vent.join(',');
    } else {
        newSite.orientation = "";
    }
    
    // acces_topo -> acces
    newSite.acces = site.acces_topo || "";
    
    // aerologie_ideale -> vent_favo
    newSite.vent_favo = site.aerologie_ideale || "";
    
    // observations -> description
    newSite.description = site.observations || "";
    
    // reglementation -> reg_aerienne
    newSite.reg_aerienne = site.reglementation || "";
    
    // Retain other fields
    if (site.affiche !== undefined) newSite.affiche = site.affiche;
    if (site.conventionnement !== undefined) newSite.conventionnement = site.conventionnement;
    if (site.praticabilite !== undefined) newSite.praticabilite = site.praticabilite;
    if (site.structure_gestionnaire !== undefined) newSite.structure_gestionnaire = site.structure_gestionnaire;
    if (site.dangers !== undefined) newSite.dangers = site.dangers;
    if (site.secours_acces !== undefined) newSite.secours_acces = site.secours_acces;
    if (site.restrictions !== undefined) newSite.restrictions = site.restrictions;
    if (site.url !== undefined) newSite.url = site.url;
    
    return newSite;
});

const output = 'const SITES_DATA = ' + JSON.stringify(newSites, null, 4) + ';\n';
fs.writeFileSync(outputPath, output);
console.log(`Successfully migrated ${newSites.length} sites from backup to current data file.`);
