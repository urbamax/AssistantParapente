// Configuration Firebase pour l'application Assistant Parapente.
// Remplacez ces valeurs par celles de votre propre projet Firebase (obtenues dans les paramètres de votre projet sur la console Firebase).
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAUdlM62YgZv5EshgfQE_qgIvPO9UoTaRc",
    authDomain: "assistantparapente.firebaseapp.com",
    projectId: "assistantparapente",
    storageBucket: "assistantparapente.firebasestorage.app",
    messagingSenderId: "486480233693",
    appId: "1:486480233693:web:63320cb14b9076affbc734",
    measurementId: "G-PERCHHV7ZZ"
};

// Variable d'activation globale.
// Mettez cette variable à true une fois que vous avez renseigné les identifiants ci-dessus.
const IS_FIREBASE_ENABLED = true;

// Clé VAPID pour les notifications push (Firebase Cloud Messaging).
// À générer dans la console Firebase : Project Settings > Cloud Messaging > Web configuration
// > Web Push certificates > "Generate key pair". Tant que ce champ est vide, le bouton
// "Activer les alertes météo" affichera une erreur explicite au lieu d'échouer silencieusement.
const FCM_VAPID_KEY = "";
