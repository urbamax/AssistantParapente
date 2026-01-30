const GENERATED_CONTENT = {
    "modernized/desequilibre-du-vol": {
        "summary": `
            <h3>Déséquilibre du Vol</h3>
            <p>Ce cours traite des conséquences aérodynamiques des variations de vitesse sur les profils de parapente.</p>
            <ul>
                <li><strong>PTV :</strong> Somme des poids du pilote et du matériel (force vers le bas).</li>
                <li><strong>RFA :</strong> Somme de la Portance et de la Traînée (force vers le haut).</li>
                <li><strong>Vol Equilibré :</strong> RFA = PTV.</li>
                <li><strong>Déséquilibre :</strong> Turbulence -> Baisse de FA -> Enfoncement -> Abatée -> Prise de vitesse -> FA > PTV -> Ressource -> Retour à l'équilibre.</li>
            </ul>
        `,
        "quiz": [
            {
                "question": "En vol équilibré, quelle est la relation entre la RFA et le PTV ?",
                "options": ["La RFA est supérieure", "La RFA est inférieure", "La RFA est égale et opposée", "Pas de lien"],
                "correct": 2,
                "explanation": "En vol stabilisé, les forces s'équilibrent exactement."
            },
            {
                "question": "Que se passe-t-il si la FA devient inférieure au PTV ?",
                "options": ["L'aile monte", "L'aile s'enfonce et abat", "Le pilote monte", "L'aile décroche"],
                "correct": 1,
                "explanation": "Le manque de portance provoque un enfoncement et une abatée pour regagner de la vitesse."
            },
            {
                "question": "Lors d'une ressource, que ressent le pilote ?",
                "options": ["Apesanteur", "Bascule avant", "Compression dans la sellette", "Rien"],
                "correct": 2,
                "explanation": "La FA supérieure au poids crée une accélération vers le haut (facteur de charge)."
            }
        ]
    },
    "modernized/les-brises": {
        "summary": `
            <h3>Le Cycle des Brises</h3>
            <p>Phénomènes thermiques locaux influençant le vol.</p>
            <ul>
                <li><strong>Brise de pente :</strong> Montante (jour, soleil) / Descendante (soir, ombre).</li>
                <li><strong>Brise de vallée :</strong> Appel d'air massif remontant la vallée en journée.</li>
                <li><strong>Brise de mer :</strong> Mer vers terre le jour (la terre chauffe plus vite).</li>
            </ul>
        `,
        "quiz": [
            {
                "question": "Moteur principal des brises de pente ?",
                "options": ["Vent météo", "Force de Coriolis", "Rayonnement solaire", "Humidité"],
                "correct": 2,
                "explanation": "Le soleil chauffe le sol, qui chauffe l'air à son contact."
            },
            {
                "question": "Brise descendante le soir ?",
                "options": ["Anabatique", "Catabatique", "De mer", "De terre"],
                "correct": 1,
                "explanation": "La brise catabatique coule par gravité vers le bas."
            }
        ]
    },
    "modernized/espaces-aeriens": {
        "summary": `
            <h3>Espaces Aériens</h3>
            <p>Réglementation et types d'espaces.</p>
            <ul>
                <li><strong>AMSL :</strong> Altitude mer. <strong>AGL :</strong> Hauteur sol. <strong>FL :</strong> Niveau de vol (1013 hPa).</li>
                <li><strong>Classe A :</strong> Interdit. <strong>Classes E/G :</strong> Autorisés.</li>
                <li><strong>Zones P :</strong> Interdit. <strong>Zones R :</strong> Réglementé. <strong>RTBA :</strong> Danger de mort (avions de chasse).</li>
            </ul>
        `,
        "quiz": [
            {
                "question": "Que signifie AMSL ?",
                "options": ["Altitude Mer", "Hauteur Sol", "Altitude Sans Licence", "Air Mass Standard"],
                "correct": 0,
                "explanation": "Above Mean Sea Level."
            },
            {
                "question": "Classe d'espace interdite au Vol Libre ?",
                "options": ["Classe A", "Classe E", "Classe G", "Toutes"],
                "correct": 0,
                "explanation": "La classe A est réservée aux IFR et interdite aux VFR."
            }
        ]
    },
    "modernized/facteurs-humains": {
        "summary": `
            <h3>Facteurs Humains</h3>
            <p>Le facteur humain est la cause principale des accidents. Ce cours explore les mécanismes psychologiques et physiologiques.</p>
            <ul>
                <li><strong>Vigilance :</strong> Capacité à maintenir son attention. Dégradée par la fatigue, le stress, la routine.</li>
                <li><strong>Stress :</strong> Réaction d'adaptation. Bon à petite dose (éveil), dangereux si excessif (panique, sidération).</li>
                <li><strong>Effet Tunnel :</strong> Focalisation sur un seul problème, perte de la vision globale.</li>
            </ul>
        `,
        "quiz": [
            {
                "question": "Quel est le pourcentage d'accidents liés au facteur humain ?",
                "options": ["Moins de 10%", "Environ 50%", "Plus de 80%", "Aucun, c'est la faute du matériel"],
                "correct": 2,
                "explanation": "La grande majorité des accidents proviennent d'une erreur de décision ou de pilotage, pas d'une rupture matériel."
            },
            {
                "question": "Qu'est-ce que l'homéostasie du risque ?",
                "options": ["La peur du vide", "L'acceptation d'un niveau de risque constant", "L'envie de dormir", "La faim en vol"],
                "correct": 1,
                "explanation": "Le pilote a tendance à 'consommer' le gain de sécurité (ex: voile plus sûre) pour prendre plus de risques ailleurs."
            }
        ]
    },
    "modernized/mecanique-du-vol": {
        "summary": `
            <h3>Mécanique du Vol</h3>
            <p>Les forces en présence sur un parapente en vol.</p>
            <ul>
                <li><strong>RFA (Résultante des Forces Aérodynamiques) :</strong> Se décompose en Portance (Perpendiculaire trajectoire) et Traînée (Parallèle trajectoire).</li>
                <li><strong>Poids (P) :</strong> Toujours vertical, vers le bas.</li>
                <li><strong>Équilibre :</strong> En vol rectiligne uniforme, RFA = Poids (vectoriellement opposés).</li>
                <li><strong>Finesse :</strong> Rapport Portance / Traînée = Distance horizontale / Perte d'altitude.</li>
            </ul>
        `,
        "quiz": [
            {
                "question": "Quelle force permet au parapente de voler (s'oppose au poids) ?",
                "options": ["La Traînée", "La Poussée", "La Portance", "La Gravité"],
                "correct": 2,
                "explanation": "La portance est la composante aérodynamique perpendiculaire à la trajectoire qui sustente l'aéronef."
            },
            {
                "question": "Si j'ai une finesse de 8, combien de km je parcours avec 1000m de gaz ?",
                "options": ["800m", "8km", "10km", "4km"],
                "correct": 1,
                "explanation": "1000m x 8 = 8000m = 8km (en air calme, sans vent)."
            }
        ]
    },
    "modernized/la-dynamique-du-vol": {
        "summary": `
            <h3>La Dynamique du Vol</h3>
            <p>Le pilotage actif et la gestion des mouvements pendulaires.</p>
            <ul>
                <li><strong>Tangage :</strong> Mouvement avant-arrière. Abatée (aile devant) / Ressource (aile derrière).</li>
                <li><strong>Roulis :</strong> Mouvement latéral (gauche-droite).</li>
                <li><strong>Lacet :</strong> Rotation sur l'axe vertical.</li>
                <li><strong>Pilotage :</strong> L'action commande a toujours un temps de retard (inertie). Il faut agir tôt et doser.</li>
            </ul>
        `,
        "quiz": [
            {
                "question": "En sortie de thermique, l'aile a tendance à faire une...",
                "options": ["Ressource (cabré)", "Abatée (plongée)", "Vrille", "Marche arrière"],
                "correct": 1,
                "explanation": "En sortant de l'ascendance, l'incidence diminue et l'aile veut reprendre de la vitesse, elle plonge devant : c'est l'abatée."
            },
            {
                "question": "Pour arrêter une abatée (aile qui plonge devant), je dois :",
                "options": ["Lever les mains", "Freiner brièvement et relâcher", "Freiner et garder les mains en bas", "Tirer le secours"],
                "correct": 1,
                "explanation": "Un freinage temporisé (coup de frein) au moment où l'aile passe devant permet de la stopper, puis il faut remonter les mains."
            }
        ]
    },
    "modernized/les-pieges-aerologiques": {
        "summary": `
            <h3>Les Pièges Aérologiques</h3>
            <p>Les situations dangereuses invisibles.</p>
            <ul>
                <li><strong>Sous le vent :</strong> Zone turbulente derrière un obstacle. DANGER DE MORT.</li>
                <li><strong>Cisaillement :</strong> Rencontre de deux masses d'air de directions/vitesses différentes.</li>
                <li><strong>Gradient de vent :</strong> Diminution du vent près du sol. Attention à l'atterrissage (perte de portance brutale).</li>
            </ul>
        `,
        "quiz": [
            {
                "question": "Où se situe la zone 'sous le vent' d'une montagne ?",
                "options": ["Au sommet", "Côté exposé au vent", "Côté abrité du vent", "Dans la vallée"],
                "correct": 2,
                "explanation": "C'est la zone située derrière l'obstacle par rapport au vent. Elle est le siège de turbulences (rotors) très dangereuses."
            },
            {
                "question": "L'atterrissage par vent fort est risqué à cause du...",
                "options": ["Gradient de vent", "Manque de visibilité", "Froid", "Kamikaze"],
                "correct": 0,
                "explanation": "Près du sol, le vent ralentit par friction. L'aile perd soudainement de la vitesse air et peut décrocher si on la freine trop."
            }
        ]
    },
    "facteurs_humains/1-fh-check-list": {
        "summary": `
            <h3>Check-list Facteurs Humains</h3>
            <p>Ce module vous invite à évaluer votre préparation mentale et physique avant le vol.</p>
            <ul>
                <li><strong>Culture de la sécurité :</strong> Êtes-vous conscient des risques inhérents à l'activité ?</li>
                <li><strong>État d'esprit :</strong> Laissez vos soucis quotidiens au sol. Méfiez-vous de l'euphorie comme de l'anxiété.</li>
                <li><strong>Stress :</strong> Une "boule au ventre" est une alarme. Le stress dégrade la prise de décision.</li>
                <li><strong>Motivation & Intentions :</strong> Vos objectifs sont-ils en adéquation avec vos capacités du moment ?</li>
                <li><strong>Physiologie :</strong> Alcool, médicaments, fatigue... Votre forme physique est le carburant de votre attention.</li>
            </ul>
            <p><strong>Rappel :</strong> 80% des accidents ont une composante "Facteurs Humains". Votre capacité à renoncer ou à adapter votre vol est votre meilleure défense.</p>
        `,
        "quiz": [
            {
                "question": "Le stress intense (la 'boule au ventre') avant un vol est :",
                "options": [
                    "Un stimulant nécessaire pour être vigilant.",
                    "Une alarme qui signale un problème à résoudre.",
                    "Normal, tous les pilotes ressentent cela.",
                    "Un signe de faiblesse technique."
                ],
                "correct": 1,
                "explanation": "Le stress excessif est une alarme interne. Il pollue la prise de décision et doit être analysé avant de décoller."
            },
            {
                "question": "Quelle est la règle concernant les habitudes de vie (problèmes, travail) avant de voler ?",
                "options": [
                    "On peut y penser pendant les transitions calmes.",
                    "Il faut les laisser au sol pour se concentrer sur le vol.",
                    "Cela n'a aucune influence sur le pilotage.",
                    "Elles permettent de rester éveillé."
                ],
                "correct": 1,
                "explanation": "Pour une vigilance optimale, vous devez laisser vos soucis quotidiens au sol et endosser pleinement votre costume de pilote."
            },
            {
                "question": "Face à une situation qui se dégrade en vol, quelle est la clé de la sécurité ?",
                "options": [
                    "Attendre de voir si ça s'améliore.",
                    "Se fier uniquement à son instinct.",
                    "Prendre une décision le plus tôt possible.",
                    "Demander l'avis des autres pilotes à la radio."
                ],
                "correct": 2,
                "explanation": "Plus tôt vous prendrez une décision (comme aller atterrir), plus vous aurez de marge de manœuvre et de sérénité."
            }
        ]
    },
    "facteurs_humains/5-fh-fiche-synthase-ressources-vl": {
        "summary": `
            <h3>Synthèse : Les Ressources du Pilote</h3>
            <p>La performance et la sécurité d'un pilote reposent sur l'équilibre de trois types de ressources :</p>
            <ol>
                <li><strong>Niveau de Pilotage :</strong> Votre maîtrise technique de l'aile.</li>
                <li><strong>Gestion des Risques :</strong> Votre capacité à identifier et éviter les dangers (météo, sites, matériel).</li>
                <li><strong>Manière d'Agir (Attitude) :</strong> Votre état mental, vos décisions et votre comportement.</li>
            </ol>
            <p>Un "bon pilote" n'est pas seulement celui qui vole bien techniquement, mais celui qui sait rester dans sa <strong>zone de maîtrise</strong> en adaptant son vol aux conditions et à sa forme du jour.</p>
        `,
        "quiz": [
            {
                "question": "Selon la DGAC, quelle est la part des accidents liés à des erreurs de jugement ?",
                "options": [
                    "Environ 20%",
                    "Environ 50%",
                    "Environ 80%",
                    "Presque 100%"
                ],
                "correct": 2,
                "explanation": "Environ 80% des accidents sont liés à des erreurs de jugement ou de prise de décision (Facteurs Humains), et non à une défaillance matérielle."
            },
            {
                "question": "Qu'est-ce qu'un 'bon pilote' selon ce module ?",
                "options": [
                    "Celui qui fait les figures les plus impressionnantes.",
                    "Celui qui vole dans les conditions les plus fortes.",
                    "Celui qui sait rester dans sa zone de maîtrise.",
                    "Celui qui a le matériel le plus récent."
                ],
                "correct": 2,
                "explanation": "La sécurité dépend de la capacité à ne pas dépasser ses propres limites (zone de maîtrise), peu importe le niveau technique absolu."
            }
        ]
    },
    "facteurs_humains/facteurs-humains2022": {
        "summary": `
            <h3>Classification des Compétences (Modèle 2022)</h3>
            <p>Ce module présente une classification détaillée des compétences du pilote, divisée en deux grands domaines :</p>
            <ul>
                <li><strong>Facteurs Techniques (1/3 des compétences) :</strong>
                    <ul>
                        <li><strong>Pilotage (PIL) :</strong> Technique gestuelle, plan de vol.</li>
                        <li><strong>Matériel (MAT) :</strong> Entretien et utilisation de l'équipement.</li>
                        <li><strong>Aérologie (AIR) :</strong> Compréhension et analyse du milieu.</li>
                        <li><strong>Connaissances (CNS) :</strong> Règles et théorie.</li>
                    </ul>
                </li>
                <li><strong>Facteurs Non-Techniques (2/3 des compétences) :</strong>
                    <ul>
                        <li><strong>Gestion (GES) & Décisions (DEC) :</strong> Choix stratégiques, renoncement.</li>
                        <li><strong>Conscience (COS) :</strong> Perception de la situation et anticipation.</li>
                        <li><strong>Physique/Mental (PHY/STS) :</strong> Forme, gestion du stress et des émotions.</li>
                        <li><strong>Environnement (ENV) :</strong> Relation aux autres et au milieu.</li>
                    </ul>
                </li>
            </ul>
        `,
        "quiz": [
            {
                "question": "Quelle proportion des compétences du pilote relève des facteurs 'Non-Techniques' ?",
                "options": [
                    "Une petite partie.",
                    "Environ 1/3.",
                    "Environ 1/2.",
                    "Environ 2/3."
                ],
                "correct": 3,
                "explanation": "Les facteurs non-techniques (gestion, mental, décision...) représentent environ 2/3 des compétences nécessaires pour voler en sécurité."
            },
            {
                "question": "Dans quelle catégorie se classe la gestion du stress (STS) ?",
                "options": [
                    "Facteurs Techniques",
                    "Facteurs Non-Techniques",
                    "Aérologie",
                    "Matériel"
                ],
                "correct": 1,
                "explanation": "Le stress est une composante physiologique et psychologique, classée dans les Facteurs Non-Techniques."
            },
            {
                "question": "A quoi correspond la compétence 'Conscience de la situation' (COS) ?",
                "options": [
                    "Savoir où se trouve le Nord.",
                    "Avoir une bonne vision de loin.",
                    "Percevoir, analyser et anticiper l'évolution de l'environnement.",
                    "Connaître son altitude précise."
                ],
                "correct": 2,
                "explanation": "La conscience de la situation est la capacité mentale à percevoir les éléments actuels, comprendre leur sens et projeter leur état futur (anticipation)."
            }
        ]
    }
};
