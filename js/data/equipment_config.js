// js/data/equipment_config.js

export const EQUIPMENT_TYPES = [
    { id: 'voile', label: 'Voile', icon: 'ri-parachute-line', alertColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' },
    {
        id: 'sellette',
        label: 'Sellette',
        icon: 'ri-shield-line',
        alertColor: 'rgba(245, 158, 11, 0.1)',
        color: '#f59e0b',
    },
    {
        id: 'secours',
        label: 'Parachute de Secours',
        icon: 'ri-lifebuoy-line',
        alertColor: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
    },
    {
        id: 'accessoire',
        label: 'Accessoire',
        icon: 'ri-settings-4-line',
        alertColor: 'rgba(107, 114, 128, 0.1)',
        color: '#6b7280',
    },
];

export const GLIDER_CATEGORIES = ['A', 'B', 'C', 'D', 'CCC'];

export const HARNESS_TYPES = ['Assise', 'Cocon', 'Réversible', 'String'];

export const REVISION_PERIODS_MONTHS = [
    { value: 12, label: 'Tous les 12 mois (1 an)' },
    { value: 24, label: 'Tous les 24 mois (2 ans)' },
    { value: 6, label: 'Tous les 6 mois' },
    { value: 0, label: 'Aucun contrôle requis / Jamais' },
];

export const REVISION_PERIODS_HOURS = [
    { value: 0, label: 'Non applicable' },
    { value: 50, label: 'Toutes les 50 heures' },
    { value: 100, label: 'Toutes les 100 heures' },
    { value: 150, label: 'Toutes les 150 heures' },
];

export const DEFAULT_EQUIPMENT_BRANDS = [
    'Advance',
    'BGD',
    'Gin',
    'Niviuk',
    'Ozone',
    'Phi',
    'Nova',
    'Supair',
    'Skywalk',
    'Triple Seven',
    'AirDesign',
    'Flow',
];
export const DEFAULT_EQUIPMENT_SIZES = ['XS', 'S', 'M', 'ML', 'L', 'XL'];
export const DEFAULT_EQUIPMENT_COLORS = [
    'Rouge',
    'Bleu',
    'Vert',
    'Jaune',
    'Orange',
    'Blanc',
    'Noir',
    'Gris',
    'Violet',
    'Rose',
];
