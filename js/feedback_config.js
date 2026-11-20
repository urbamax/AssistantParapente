/**
 * Configuration de l'envoi des signalements et suggestions (spec 048).
 *
 * Envoi direct vers l'endpoint interne du serveur (/api/feedback), qui relaie
 * instantanément les messages vers le Webhook Discord privé de l'administrateur
 * sans aucun service tiers ni adresse e-mail exposée.
 */
export const FEEDBACK_CONFIG = Object.freeze({
    web3FormsAccessKey: '',
    customEndpoint: '/api/feedback',
});
