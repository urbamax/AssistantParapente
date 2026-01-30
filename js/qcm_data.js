// =========================================================================
// AGGREGATION DES BASES DE DONNÉES QCM
// =========================================================================
// Nécessite le chargement préalable de :
// - js/data/qcm_bi.js
// - js/data/qcm_bp.js
// - js/data/qcm_bpc.js

const QCM_DATA = [
    ...QCM_BI,
    ...QCM_BP,
    ...QCM_BPC
];

console.log("BASE DE DONNEES QCM CHARGEE AVEC SUCCES");
console.log("Total Questions :" + QCM_DATA.length);
console.log("- BI : " + QCM_BI.length);
console.log("- BP : " + QCM_BP.length);
console.log("- BPC : " + QCM_BPC.length);
