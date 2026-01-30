import os

# Output directory
OUTPUT_DIR = "courses/html"
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

# Common CSS/Template
def get_template(title, content, course_id, image_path=None):
    schema_html = ""
    if image_path:
        schema_html = f"""
        <div class="schema-container">
            <a href="../../{image_path}" target="_blank">
                <img src="../../{image_path}" alt="Schéma explicatif" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); cursor: pointer; transition: transform 0.2s;">
            </a>
            <p style="margin-top: 10px; font-size: 0.9em; color: #94a3b8; font-style: italic;">(Cliquer pour agrandir) Schéma synthétique du cours</p>
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link href="https://fonts.googleapis.com/css2?family=outfit:wght@300;400;600&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css" rel="stylesheet">
    <link rel="stylesheet" href="../../css/style.css">
    <style>
        /* Force Dark Theme Variables Fallback */
        :root {{
            --bg-app: #0f172a;
            --bg-overlay: rgba(15, 23, 42, 0.85); /* Slightly more opaque */
            --text-main: #e2e8f0;
            --text-muted: #94a3b8;
            --accent-blue: #38bdf8;
            --border-color: #334155;
            --bg-card: #1e293b;
        }}

        body {{
            background-color: var(--bg-app);
            color: var(--text-main);
            overflow-y: auto !important;
            margin: 0;
            padding: 0;
        }}

        /* Fixed Header Override */
        .top-controls {{
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 120px;
            background: #0f172a !important; /* Solid background to prevent overlap issues */
            border-bottom: 1px solid var(--border-color);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 40px;
        }}

        .course-standalone-container {{
            max-width: 900px;
            margin: 0 auto;
            margin-top: 140px; /* Push content below header */
            padding: 40px 20px 100px 20px;
            position: relative;
            z-index: 1;
        }}

        /* Typography */
        h1 {{
            color: var(--accent-blue);
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 20px;
            margin-bottom: 40px;
        }}
        
        /* Quiz Button Styles */
        .quiz-btn-premium {{
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 0.95em;
            cursor: pointer;
            box-shadow: 0 4px 6px -1px rgba(14, 165, 233, 0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none; 
            transition: all 0.2s;
        }}
        .quiz-btn-premium:hover {{
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(14, 165, 233, 0.4);
            filter: brightness(1.1);
        }}
        .quiz-btn-premium.big {{
            padding: 16px 40px;
            font-size: 1.1em;
            margin: 0 auto;
        }}
    </style>
</head>
<body class="theme-dark standalone-course">

    <!-- EXACT CLONE OF APP HEADER -->
    <div class="top-controls">
        <div class="header-branding">
            <h1 class="dashboard-title">THÉORIE PARAPENTE</h1>
            <p class="dashboard-subtitle">Plateforme d'entraînement & bibliothèque FFVL</p>
        </div>
        <div class="header-actions">
            <!-- Club Logo -->
            <a href="https://parapente62lefildariane.wordpress.com" target="_blank" title="Visiter le site du Club Le Fil d'Ariane">
                <img src="https://parapente62lefildariane.wordpress.com/wp-content/uploads/2025/02/logo-club-2025-2.png?w=781" alt="Logo Club" class="club-logo">
            </a>
            <!-- FFVL Logo -->
            <a href="https://parapente.ffvl.fr" target="_blank" title="Visiter le site de la FFVL">
                <img src="https://federation.ffvl.fr/sites/ffvl.fr/files/FFVL_3.png" alt="Logo FFVL" class="ffvl-logo">
            </a>
            
            <!-- Theme Toggle Placeholder (Visual Consistency) -->
            <button class="icon-btn" style="cursor:default; opacity:0.8;">
                <div class="auto-icon-composite">
                    <i class="ri-moon-line"></i>
                </div>
            </button>

             <!-- BACK BUTTON -->
            <a href="../../index.html" class="nav-btn" style="text-decoration:none; display:flex; align-items:center; gap:8px; background:var(--bg-card); padding:10px 20px; border-radius:30px; border:1px solid var(--accent-blue); color:white; margin-left: 10px;">
                <i class="ri-arrow-left-line"></i>
                <span style="font-weight:600;">RETOUR</span>
            </a>
        </div>
    </div>

    <!-- MAIN SCROLLABLE CONTENT -->
    <div class="course-standalone-container">
        
        <!-- TITLE & QUIZ HEADER -->
        <h1>{title}</h1>
        
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px dashed #334155;">
            <div style="font-style: italic; color: #94a3b8;">
                <i class="ri-refresh-line"></i> Contenu moderne optimisé.
            </div>
            
            <button onclick="startQuiz('{course_id}')" class="quiz-btn-premium">
                <i class="ri-flashlight-fill"></i> LANCER LE QUIZZ
            </button>
        </div>

    {schema_html}

    <div class="content">
        {content}
    </div>
    
    <!-- FOOTER QUIZ RECALL -->
    <div style="text-align: center; margin-top: 80px; padding-top: 40px; border-top: 1px solid #334155;">
        <h3 style="color: #fff; margin-bottom: 20px;">Vous avez terminé le cours ?</h3>
        <button onclick="startQuiz('{course_id}')" class="quiz-btn-premium big">
            <i class="ri-check-double-line"></i> VALIDER MES CONNAISSANCES
        </button>
    </div>

    <!-- Close main container -->
    </div>

    <style>
        /* Quiz Button Styles */
        .quiz-btn-premium {{
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); /* Sky 500-600 */
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 0.95em;
            cursor: pointer;
            box-shadow: 0 4px 6px -1px rgba(14, 165, 233, 0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.2s;
        }}
        .quiz-btn-premium:hover {{
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(14, 165, 233, 0.4);
            filter: brightness(1.1);
        }}
        .quiz-btn-premium.big {{
            padding: 16px 40px;
            font-size: 1.1em;
            margin: 0 auto;
        }}
    </style>

    <script>
        function startQuiz(courseId) {{
            // Store intent and go back home
            localStorage.setItem('pending_quiz', courseId);
            window.location.href = '../../index.html';
        }}
    </script>
</body>
</html>"""

# DATA: LES BRISES
brises_content = """
<div class="note">
    <strong>Niveau Vert (Brevet Initial)</strong> - Comprendre le cycle des brises est essentiel pour voler en sécurité et longtemps.
</div>

<h2>1. Le Mécanisme Fondamental</h2>
<p>
    À petite échelle, les vents locaux naissent toujours d'un <strong>contraste de température</strong>. C'est le moteur thermique :
</p>
<ul>
    <li>Le soleil chauffe la surface du sol.</li>
    <li>Le sol communique sa chaleur à l'air à son contact par conduction.</li>
    <li>Cet air chaud, plus léger (moins dense), s'élève : c'est l'ascendance thermique.</li>
</ul>

<h2>2. La Brise de Pente (Cycle Diurne)</h2>
<p>
    Le matin, les versants exposés à l'Est sont les premiers chauffés. L'air se réchauffe au contact de la pente et s'élève le long du relief.
    C'est la <strong>Brise de Pente Montante</strong> (ou anabatique).
</p>
<p>
    Ce phénomène "aspire" l'air des vallées et des plaines pour combler le vide laissé par l'air qui monte. 
    Au fur et à mesure que le soleil tourne :
</p>
<ul>
    <li>Le matin : Pentes Est actives.</li>
    <li>À midi : Pentes Sud actives (phénomène maximal).</li>
    <li>L'après-midi : Pentes Ouest actives.</li>
    <li>Les pentes à l'ombre voient leur brise s'arrêter (ou s'inverser).</li>
</ul>

<h2>3. La Brise de Vallée</h2>
<p>
    C'est un phénomène de plus grande échelle qui se met en place plus tard dans la journée (souvent vers 11h-12h).
    L'ensemble des pentes chauffées "tire" une énorme masse d'air vers les sommets. Pour alimenter ce mouvement, l'air doit venir de la plaine et remonter toute la vallée.
</p>
<p>
    C'est la <strong>Brise de Vallée Montante</strong>. Elle est souvent forte et stable.
</p>

<h2>4. Le Cycle Nocturne (Catabatique)</h2>
<p>
    Dès que le soleil se couche ou passe derrière la montagne (ombre), le sol se refroidit rapidement par rayonnement.
    L'air au contact du sol se refroidit, devient plus lourd et "coule" le long des pentes comme de l'eau.
</p>
<ul>
    <li><strong>Brise de pente descendante</strong> : L'air froid descend des sommets vers la vallée.</li>
    <li><strong>Brise de vallée descendante</strong> : Plus tard dans la nuit, toute la vallée se vidange vers la plaine.</li>
</ul>

<h2>5. Brise de Mer et Brise de Terre</h2>
<p>
    Le même principe s'applique sur la côte :
</p>
<ul>
    <li><strong>Jour (Brise de Mer)</strong> : La terre chauffe plus vite que la mer. L'air monte sur terre, l'air frais marin vient le remplacer (vent de la mer vers la terre).</li>
    <li><strong>Nuit (Brise de Terre)</strong> : La terre refroidit plus vite. L'air froid de la terre coule vers la mer (vent de la terre vers la mer).</li>
</ul>

<div class="key-takeaway">
    <h3><i class="ri-lightbulb-flash-line"></i> À Retenir</h3>
    <ul>
        <li><strong>Chaud = Montée</strong> (Brise montante, Anabatique).</li>
        <li><strong>Froid = Descente</strong> (Brise descendante, Catabatique).</li>
        <li>La brise de pente réagit <strong>immédiatement</strong> au soleil.</li>
        <li>La brise de vallée a de <strong>l'inertie</strong> (démarre plus tard, finit plus tard).</li>
    </ul>
</div>
"""

# DATA: FACTEURS HUMAINS
fh_content = """
<div class="note">
    <strong>Niveau Vert (Brevet Initial)</strong> - D'après JG Charrier (Mentalpilote). La sécurité n'est pas qu'une question de technique, mais d'attitude.
</div>

<h2>1. L'Attitude Pilote</h2>
<p>
    Votre attitude, c'est votre état d'esprit. Contrairement à la technique, elle fluctue selon votre fatigue, votre stress ou vos émotions.
    Une <strong>culture positive</strong> de la sécurité diminue drastiquement les accidents.
</p>
<p>
    Inversement, l'invulnérabilité ("ça n'arrive qu'aux autres") est le piège mortel classique.
</p>

<h2>2. Les 5 Attitudes Dangereuses</h2>
<p>Une étude a identifié 5 états d'esprit qui mènent à l'accident :</p>
<ul>
    <li><strong>L'Impulsivité</strong> ("Vite, vite !") : Besoin d'agir sans réfléchir. <br><em>Antidote : "Pas si vite, réfléchissons."</em></li>
    <li><strong>L'Anti-autorité</strong> ("Les règles, c'est pour les autres") : Refus des contraintes.<br><em>Antidote : "Suivez les règles, elles sont écrites avec du sang."</em></li>
    <li><strong>L'Invulnérabilité</strong> ("Ça ne peut pas m'arriver") : Déni du risque.<br><em>Antidote : "Ça peut m'arriver, même aujourd'hui."</em></li>
    <li><strong>Le Macho</strong> ("Je vais leur montrer") : Besoin de prouver.<br><em>Antidote : "Prendre des risques est stupide."</em></li>
    <li><strong>La Résignation</strong> ("À quoi bon...") : Sentiment d'impuissance.<br><em>Antidote : "Je ne suis pas sans ressources, je peux agir."</em></li>
</ul>

<h2>3. La Gestion des Ressources</h2>
<p>
    Imaginez vos capacités comme un réservoir ou une batterie. Pour voler en sécurité, vous devez gérer trois ressources :
</p>
<ul>
    <li><strong>Votre savoir-faire</strong> (Technique, Pilotage).</li>
    <li><strong>Votre gestion des risques</strong> (Analyse météo, Décisions).</li>
    <li><strong>Votre état personnel</strong> (Forme physique, Mental).</li>
</ul>
<p>
    Si l'un de ces réservoirs est vide (fatigue, stress au travail, maladie), vous n'êtes plus en état de gérer une situation complexe en vol.
    <strong>Un bon pilote sait renoncer quand il n'est pas à 100%.</strong>
</p>

<div class="key-takeaway">
    <h3><i class="ri-error-warning-line"></i> Le Piège "Objectif Destination"</h3>
    <p>
        Vouloir absolument atteindre le but (l'atterrissage, le sommet) alors que les conditions se dégradent.
        Le stress réduit la conscience (effet tunnel). Savoir faire demi-tour est la preuve d'une grande maîtrise.
    </p>
</div>
"""

# DATA: MECANIQUE DU VOL
meca_content = """
<div class="note">
    <strong>Niveau Vert</strong> - Comprendre pourquoi et comment un parapente vole.
</div>

<h2>1. Le Principe de la Portance</h2>
<p>
    Pourquoi ça vole ? C'est le déplacement de l'aile dans l'air qui crée un <strong>Vent Relatif</strong>.
    L'air s'écoule autour du profil :
</p>
<ul>
    <li>Il accélère sur le dessus (extrados) -> <strong>Dépression</strong> (Aspiration vert le haut).</li>
    <li>Il ralentit dessous (intrados) -> <strong>Surpression</strong> (Poussée vers le haut).</li>
</ul>
<p>
    La "somme" de ces forces est la <strong>Portance</strong>. C'est elle qui s'oppose à votre Poids.
</p>

<h2>2. Les Forces en Présence</h2>
<p> En vol rectiligne stabilisé, trois forces s'équilibrent :</p>
<ul>
    <li><strong>Le Poids (P)</strong> : Vertical, vers le bas. C'est vous + le matériel.</li>
    <li><strong>La Traînée (T)</strong> : Résistance de l'air, opposée à la trajectoire.</li>
    <li><strong>La Portance (Rz)</strong> : Perpendiculaire à la trajectoire.</li>
    <li><strong>La RFA (Résultante des Forces Aérodynamiques)</strong> : Somme de Portance + Traînée. Elle équilibre exactement le Poids.</li>
</ul>

<h2>3. Les Angles</h2>
<p>Il est crucial de ne pas confondre ces trois angles :</p>
<ul>
    <li><strong>L'Assiette</strong> : Angle entre l'aile et l'horizon. (Ce qu'on voit).</li>
    <li><strong>La Pente de Trajectoire</strong> : Angle entre notre descente et l'horizon.</li>
    <li><strong>L'Incidence</strong> : Angle entre l'aile et le Vent Relatif (la trajectoire). <strong>C'est l'angle de la sécurité !</strong></li>
</ul>

<div class="key-takeaway">
    <h3><i class="ri-alert-line"></i> Incidence : Danger !</h3>
    <ul>
        <li><strong>Incidence trop grande</strong> (freins trop bas) = <strong>DÉCROCHAGE</strong>. Plus de portance, l'aile tombe.</li>
        <li><strong>Incidence trop faible</strong> (accélérateur à fond + turbulence) = <strong>FERMETURE</strong>. Le bord d'attaque s'écrase.</li>
    </ul>
    <p>Le pilotage consiste essentiellement à gérer l'incidence pour rester dans le domaine de vol.</p>
</div>
"""

# DATA: DYNAMIQUE DU VOL
dynamique_content = """
<div class="note">
    <strong>Niveau Vert</strong> - Les mouvements de l'aile autour de ses axes.
</div>

<h2>1. Les 3 Axes de Rotation</h2>
<p>
    Comme un avion ou un bateau, un parapente peut tourner autour de 3 axes passant par son centre de gravité :
</p>
<ul>
    <li><strong>Le Roulis</strong> : Balancement gauche-droite (Comme un pendule). C'est le mouvement pour virer.</li>
    <li><strong>Le Tangage</strong> : Mouvement avant-arrière (Cabré / Piqué).
        <ul>
            <li><em>Abattée</em> : L'aile plonge devant.</li>
            <li><em>Ressource</em> : L'aile remonte au-dessus ou derrière.</li>
        </ul>
    </li>
    <li><strong>Le Lacet</strong> : Rotation à plat (L'aile pivote sur elle-même).</li>
</ul>

<h2>2. La Stabilité Pendulaire</h2>
<p>
    La particularité du parapente, c'est que le pilote (le poids) est suspendu très bas sous l'aile (la portance).
    Cela crée une immense <strong>stabilité pendulaire</strong>.
</p>
<p>
    Si l'aile s'écarte (roulis), le poids du pilote la ramène naturellement à la verticale. C'est cette stabilité qui rend le parapente accessible.
</p>

<h2>3. Le Roulis Induit</h2>
<p>
    Attention : les axes sont liés. Une action de lacet (tourner à plat) finit souvent par créer du roulis (l'aile s'incline).
    C'est la base du virage coordonné.
</p>
"""

# DATA: PIEGES AEROLOGIQUES
pieges_content = """
<div class="note">
    <strong>Niveau Vert</strong> - Reconnaître et éviter les dangers invisibles de l'air.
</div>

<h2>1. Le Gradient de Vent</h2>
<p>
    Près du sol, le vent est freiné par la friction. À l'atterrissage, vous passez d'un vent fort (en altitude) à un vent faible (au sol).
</p>
<div class="key-takeaway">
    <h3><i class="ri-alert-line"></i> Danger à l'atterrissage</h3>
    <p>
        En descendant dans la couche de gradient, votre vitesse air diminue brutalement.
        <strong>Risque :</strong> Décrochage si vous freinez trop tôt, ou enfoncement brutal.
        <strong>Solution :</strong> Gardez de la vitesse (bras hauts) jusqu'au sol !
    </p>
</div>

<h2>2. Les Turbulences (Rotors)</h2>
<p>
    L'air se comporte comme de l'eau. Derrière un obstacle (arbre, maison, colline), il crée des tourbillons (rotors).
    Ne volez jamais <strong>SOUS LE VENT</strong> d'un obstacle. C'est une zone de "lessiveuse" où l'aile peut fermer.
</p>

<h2>3. L'Effet Venturi</h2>
<p>
    Lorsque le vent s'engouffre dans un passage resserré (col, vallon étroit), il accélère.
    C'est l'effet Venturi. Le vent peut y devenir beaucoup plus fort que prévu, vous empêchant d'avancer.
</p>

<h2>4. Les Orages (Danger Mortel)</h2>
<p>
    Le cumulonimbus (Cb) est l'ennemi n°1. Il aspire l'air à des kilomètres à la ronde.
    Si vous voyez un développement orageux : <strong>POSEZ-VOUS IMMÉDIATEMENT.</strong>
    N'attendez pas la pluie ou le tonnerre, les rafales arrivent bien avant.
</p>
"""

# DATA: DESEQUILIBRE DU VOL
desequilibre_content = """
<div class="note">
    <strong>Niveau Bleu</strong> - Comprendre et gérer les incidents de vol.
</div>

<h2>1. L'Équilibre et sa Rupture</h2>
<p>
    En vol calme, le Poids (PTV) et la Force Aérodynamique (RFA) sont alignés et opposés.
    Une turbulence rompt cet équilibre :
</p>
<ul>
    <li>Si l'aile perd de la portance (descendance), elle accélère pour en retrouver (Abattée).</li>
    <li>Si l'aile gagne de la portance (ascendance), elle se cabre et ralentit (Ressource).</li>
</ul>

<h2>2. L'Abattée (L'aile plonge)</h2>
<p>
    L'aile passe devant le pilote.
    <strong>Danger :</strong> Si elle va trop loin (plus bas que l'horizon), elle peut fermer frontalement.
    <strong>Action :</strong> Freiner (temporisation) pour l'arrêter au-dessus de la tête.
</p>

<h2>3. La Ressource (L'aile cabre)</h2>
<p>
    L'aile part derrière le pilote.
    <strong>Danger :</strong> Si elle ralentit trop, elle peut décrocher.
    <strong>Action :</strong> Bras hauts ! Laisser l'aile revoler. Ne jamais freiner une aile qui est derrière vous.
</p>

<h2>4. La Fermeture Asymétrique</h2>
<p>
    Un côté de l'aile se replie à cause d'une turbulence.
    <strong>Réaction :</strong>
    1. Contrer à la sellette (se pencher côté ouvert) pour garder le cap.
    2. Freiner *légèrement* côté ouvert.
    3. (Optionnel) "Pomper" sèchement côté fermé pour rouvrir.
</p>
"""

# DATA: ESPACES AERIENS
espaces_content = """
<div class="note">
    <strong>Niveau Général</strong> - Partager le ciel en sécurité et légalité.
</div>

<h2>1. Altitude vs Hauteur</h2>
<ul>
    <li><strong>Hauteur (AGL - Above Ground Level)</strong> : Distance par rapport au sol (ce que je vois).</li>
    <li><strong>Altitude (AMSL - Above Mean Sea Level)</strong> : Distance par rapport au niveau de la mer (ce que dit l'altimètre calé au QNH).</li>
    <li><strong>Niveau de Vol (FL - Flight Level)</strong> : Altitude pression standard (1013 hPa). Utilisé en haute altitude par les avions.</li>
</ul>

<h2>2. Les Classes d'Espace (La Pyramide)</h2>
<p>L'espace est découpé en tranches. En France, pour faire simple :</p>
<ul>
    <li><strong>Classe G (Golf)</strong> : Non contrôlé. C'est notre terrain de jeu principal. "G comme Gratuit". Voir et éviter.</li>
    <li><strong>Classe E (Echo)</strong> : Contrôlé pour les avions (IFR), mais libre pour nous (VFR) si bonne visibilité.</li>
    <li><strong>Classes D, C, A</strong> : Contrôlés. <strong>INTERDITS</strong> au parapente (sauf dérogations rares). Ils protègent les aéroports.</li>
</ul>

<h2>3. Les Zones Particulières</h2>
<ul>
    <li><strong>CTR (Control Zone)</strong> : Boîte autour d'un aéroport, part du sol. Interdit.</li>
    <li><strong>TMA (Terminal Manoeuvring Area)</strong> : Grosses zones au-dessus des aéroports pour l'approche. Souvent Interdites.</li>
    <li><strong>R (Réglementée)</strong> : Peut être active (interdite) ou inactive (autorisée). Vérifier les NOTAM/AZBA (Réseau Très Basse Altitude militaire).</li>
    <li><strong>P (Prohibited)</strong> : Interdite tout le temps (Centrales nucléaires, bases sensibles).</li>
    <li><strong>ZSM (Sensibilité Majeure)</strong> : Parcs nationaux, réserves. Souvent interdit de survoler à moins de 300m ou 1000m sol pour protéger la faune.</li>
</ul>

<h2>4. Règle d'Or : VFR</h2>
<p>
    Nous volons en VFR (Visual Flight Rules).
    <strong>Interdiction absolue de voler dans les nuages</strong> (on ne voit rien et on risque la collision).
    Il faut toujours garder les distances avec les nuages.
</p>
<script>
    // NUCLEAR SCROLL FIX: Multi-strategy height calculation
    function updateHeight() {
        if(!window.frameElement) return;
        
        const body = document.body;
        const html = document.documentElement;
        
        // Calculate max possible height from all sources
        const height = Math.max(
            body.scrollHeight, body.offsetHeight,
            html.clientHeight, html.scrollHeight, html.offsetHeight
        );
        
        // Apply with generous buffer to prevent 1px cutoffs
        window.frameElement.style.height = (height + 100) + 'px';
    }

    // 1. Use ResizeObserver on multiple targets
    const resizeObserver = new ResizeObserver(() => updateHeight());
    resizeObserver.observe(document.body);
    resizeObserver.observe(document.documentElement);
    
    // 2. Standard Events
    window.addEventListener('load', updateHeight);
    window.addEventListener('resize', updateHeight);
    window.addEventListener('DOMContentLoaded', updateHeight);
    
    // 3. Image Load Listeners (Crucial for large schemas)
    document.querySelectorAll('img').forEach(img => {
        img.addEventListener('load', updateHeight);
        if(img.complete) updateHeight(); // If already loaded
    });
    
    // 4. Fallback Interval (Safety Net)
    setInterval(updateHeight, 500);
    
    // 5. Initial Call
    updateHeight();
</script>
</body>
</html>"""

def generate():
    # 1. Les Brises
    html = get_template("Les Brises", brises_content, "modernized/les-brises", "img/schemas/schema_brises_vallee.png")
    with open(os.path.join(OUTPUT_DIR, "les_brises.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("Generated Premium: les_brises.html")

    # 2. Facteurs Humains
    html = get_template("Facteurs Humains", fh_content, "modernized/facteurs-humains", "img/schemas/schema_facteurs_humains.png")
    with open(os.path.join(OUTPUT_DIR, "facteurs_humains.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("Generated Premium: facteurs_humains.html")
    
    # 3. Mécanique du Vol
    html = get_template("Mécanique du Vol", meca_content, "modernized/mecanique-du-vol", "img/schemas/schema_forces_vol.png")
    with open(os.path.join(OUTPUT_DIR, "mecanique_du_vol.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("Generated Premium: mecanique_du_vol.html")

    # 4. Dynamique
    html = get_template("Dynamique du Vol", dynamique_content, "modernized/la-dynamique-du-vol", "img/schemas/schema_dynamique_3axes.png")
    with open(os.path.join(OUTPUT_DIR, "la_dynamique_du_vol.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("Generated Premium: la_dynamique_du_vol.html")

    # 5. Pièges
    html = get_template("Pièges Aérologiques", pieges_content, "modernized/les-pieges-aerologiques", "img/schemas/schema_pieges_aerologiques.png")
    with open(os.path.join(OUTPUT_DIR, "les_pieges_aerologiques.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("Generated Premium: les_pieges_aerologiques.html")

    # 6. Déséquilibre
    html = get_template("Déséquilibre du Vol", desequilibre_content, "modernized/desequilibre-du-vol", "img/schemas/schema_desequilibre_pendulaire.png")
    with open(os.path.join(OUTPUT_DIR, "desequilibre_du_vol.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("Generated Premium: desequilibre_du_vol.html")

    # 7. Espaces Aériens
    html = get_template("Espaces Aériens", espaces_content, "modernized/espaces-aeriens", "img/schemas/schema_espaces_aeriens.png")
    with open(os.path.join(OUTPUT_DIR, "ffvl_formation_espacesaeriens.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("Generated Premium: ffvl_formation_espacesaeriens.html")

if __name__ == "__main__":
    generate()

# DATA: LES BRISES
brises_content = """
<div class="note">
    <strong>Niveau Vert (Brevet Initial)</strong> - Comprendre le cycle des brises est essentiel pour voler en sécurité et longtemps.
</div>

<h2>1. Le Mécanisme Fondamental</h2>
<p>
    À petite échelle, les vents locaux naissent toujours d'un <strong>contraste de température</strong>. C'est le moteur thermique :
</p>
<ul>
    <li>Le soleil chauffe la surface du sol.</li>
    <li>Le sol communique sa chaleur à l'air à son contact par conduction.</li>
    <li>Cet air chaud, plus léger (moins dense), s'élève : c'est l'ascendance thermique.</li>
</ul>

<h2>2. La Brise de Pente (Cycle Diurne)</h2>
<p>
    Le matin, les versants exposés à l'Est sont les premiers chauffés. L'air se réchauffe au contact de la pente et s'élève le long du relief.
    C'est la <strong>Brise de Pente Montante</strong> (ou anabatique).
</p>
<p>
    Ce phénomène "aspire" l'air des vallées et des plaines pour combler le vide laissé par l'air qui monte. 
    Au fur et à mesure que le soleil tourne :
</p>
<ul>
    <li>Le matin : Pentes Est actives.</li>
    <li>À midi : Pentes Sud actives (phénomène maximal).</li>
    <li>L'après-midi : Pentes Ouest actives.</li>
    <li>Les pentes à l'ombre voient leur brise s'arrêter (ou s'inverser).</li>
</ul>

<h2>3. La Brise de Vallée</h2>
<p>
    C'est un phénomène de plus grande échelle qui se met en place plus tard dans la journée (souvent vers 11h-12h).
    L'ensemble des pentes chauffées "tire" une énorme masse d'air vers les sommets. Pour alimenter ce mouvement, l'air doit venir de la plaine et remonter toute la vallée.
</p>
<p>
    C'est la <strong>Brise de Vallée Montante</strong>. Elle est souvent forte et stable.
</p>

<h2>4. Le Cycle Nocturne (Catabatique)</h2>
<p>
    Dès que le soleil se couche ou passe derrière la montagne (ombre), le sol se refroidit rapidement par rayonnement.
    L'air au contact du sol se refroidit, devient plus lourd et "coule" le long des pentes comme de l'eau.
</p>
<ul>
    <li><strong>Brise de pente descendante</strong> : L'air froid descend des sommets vers la vallée.</li>
    <li><strong>Brise de vallée descendante</strong> : Plus tard dans la nuit, toute la vallée se vidange vers la plaine.</li>
</ul>

<h2>5. Brise de Mer et Brise de Terre</h2>
<p>
    Le même principe s'applique sur la côte :
</p>
<ul>
    <li><strong>Jour (Brise de Mer)</strong> : La terre chauffe plus vite que la mer. L'air monte sur terre, l'air frais marin vient le remplacer (vent de la mer vers la terre).</li>
    <li><strong>Nuit (Brise de Terre)</strong> : La terre refroidit plus vite. L'air froid de la terre coule vers la mer (vent de la terre vers la mer).</li>
</ul>

<div class="key-takeaway">
    <h3><i class="ri-lightbulb-flash-line"></i> À Retenir</h3>
    <ul>
        <li><strong>Chaud = Montée</strong> (Brise montante, Anabatique).</li>
        <li><strong>Froid = Descente</strong> (Brise descendante, Catabatique).</li>
        <li>La brise de pente réagit <strong>immédiatement</strong> au soleil.</li>
        <li>La brise de vallée a de <strong>l'inertie</strong> (démarre plus tard, finit plus tard).</li>
    </ul>
</div>
"""

# DATA: FACTEURS HUMAINS
fh_content = """
<div class="note">
    <strong>Niveau Vert (Brevet Initial)</strong> - D'après JG Charrier (Mentalpilote). La sécurité n'est pas qu'une question de technique, mais d'attitude.
</div>

<h2>1. L'Attitude Pilote</h2>
<p>
    Votre attitude, c'est votre état d'esprit. Contrairement à la technique, elle fluctue selon votre fatigue, votre stress ou vos émotions.
    Une <strong>culture positive</strong> de la sécurité diminue drastiquement les accidents.
</p>
<p>
    Inversement, l'invulnérabilité ("ça n'arrive qu'aux autres") est le piège mortel classique.
</p>

<h2>2. Les 5 Attitudes Dangereuses</h2>
<p>Une étude a identifié 5 états d'esprit qui mènent à l'accident :</p>
<ul>
    <li><strong>L'Impulsivité</strong> ("Vite, vite !") : Besoin d'agir sans réfléchir. <br><em>Antidote : "Pas si vite, réfléchissons."</em></li>
    <li><strong>L'Anti-autorité</strong> ("Les règles, c'est pour les autres") : Refus des contraintes.<br><em>Antidote : "Suivez les règles, elles sont écrites avec du sang."</em></li>
    <li><strong>L'Invulnérabilité</strong> ("Ça ne peut pas m'arriver") : Déni du risque.<br><em>Antidote : "Ça peut m'arriver, même aujourd'hui."</em></li>
    <li><strong>Le Macho</strong> ("Je vais leur montrer") : Besoin de prouver.<br><em>Antidote : "Prendre des risques est stupide."</em></li>
    <li><strong>La Résignation</strong> ("À quoi bon...") : Sentiment d'impuissance.<br><em>Antidote : "Je ne suis pas sans ressources, je peux agir."</em></li>
</ul>

<h2>3. La Gestion des Ressources</h2>
<p>
    Imaginez vos capacités comme un réservoir ou une batterie. Pour voler en sécurité, vous devez gérer trois ressources :
</p>
<ul>
    <li><strong>Votre savoir-faire</strong> (Technique, Pilotage).</li>
    <li><strong>Votre gestion des risques</strong> (Analyse météo, Décisions).</li>
    <li><strong>Votre état personnel</strong> (Forme physique, Mental).</li>
</ul>
<p>
    Si l'un de ces réservoirs est vide (fatigue, stress au travail, maladie), vous n'êtes plus en état de gérer une situation complexe en vol.
    <strong>Un bon pilote sait renoncer quand il n'est pas à 100%.</strong>
</p>

<h2>4. La Conscience de la Situation</h2>
<p>
    C'est la capacité à percevoir ce qui se passe autour de soi (météo qui change, autres voiles) et à anticiper le futur.
    Le stress réduit cette conscience (effet tunnel).
</p>
<div class="key-takeaway">
    <h3><i class="ri-error-warning-line"></i> Le Piège Classique</h3>
    <p>
        "L'objectif destination" : Vouloir absolument atteindre le but (l'atterrissage, le sommet) alors que les conditions se dégradent.
        Savoir faire demi-tour est la preuve d'une grande maîtrise.
    </p>
</div>
"""

# DATA: MECANIQUE DU VOL
meca_content = """
<div class="note">
    <strong>Niveau Vert</strong> - Comprendre pourquoi et comment un parapente vole.
</div>

<h2>1. Le Principe de la Portance</h2>
<p>
    Pourquoi ça vole ? C'est le déplacement de l'aile dans l'air qui crée un <strong>Vent Relatif</strong>.
    L'air s'écoule autour du profil :
</p>
<ul>
    <li>Il accélère sur le dessus (extrados) -> <strong>Dépression</strong> (Aspiration vert le haut).</li>
    <li>Il ralentit dessous (intrados) -> <strong>Surpression</strong> (Poussée vers le haut).</li>
</ul>
<p>
    La "somme" de ces forces est la <strong>Portance</strong>. C'est elle qui s'oppose à votre Poids.
</p>

<h2>2. Les Forces en Présence</h2>
<p> En vol rectiligne stabilisé, trois forces s'équilibrent (ou 4 si on décompose la RFA) :</p>
<ul>
    <li><strong>Le Poids (P)</strong> : Vertical, vers le bas. C'est vous + le matériel.</li>
    <li><strong>La Traînée (T)</strong> : Résistance de l'air, opposée à la trajectoire.</li>
    <li><strong>La Portance (Rz)</strong> : Perpendiculaire à la trajectoire.</li>
    <li><strong>La RFA (Résultante des Forces Aérodynamiques)</strong> : Somme de Portance + Traînée. Elle équilibre exactement le Poids (et s'oppose à lui).</li>
</ul>

<h2>3. Les Angles</h2>
<p>Il est crucial de ne pas confondre ces trois angles :</p>
<ul>
    <li><strong>L'Assiette</strong> : Angle entre l'aile et l'horizon. (Ce qu'on voit).</li>
    <li><strong>La Pente de Trajectoire</strong> : Angle entre notre descente et l'horizon.</li>
    <li><strong>L'Incidence</strong> : Angle entre l'aile et le Vent Relatif (la trajectoire). <strong>C'est l'angle le plus important pour la sécurité !</strong></li>
</ul>

<div class="key-takeaway">
    <h3><i class="ri-alert-line"></i> Incidence : Danger !</h3>
    <ul>
        <li><strong>Incidence trop grande</strong> (freins trop bas) = <strong>DÉCROCHAGE</strong>. Plus de portance, l'aile tombe.</li>
        <li><strong>Incidence trop faible</strong> (accélérateur à fond + turbulence) = <strong>FERMETURE</strong>. Le bord d'attaque s'écrase.</li>
    </ul>
    <p>Le pilotage consiste essentiellement à gérer l'incidence pour rester dans le domaine de vol.</p>
</div>

<h2>4. La Finesse</h2>
<p>
    C'est le rapport entre la distance horizontale parcourue et la hauteur perdue.
    <br><em>Exemple : Finesse 8 = Je parcours 8km en partant de 1000m d'altitude (sans vent).</em>
</p>
<p>
    <strong>Avec du vent de face</strong>, votre finesse sol diminue (vous avancez moins vite).
    <strong>Avec du vent de cul</strong>, votre finesse sol augmente.
</p>
"""

def generate():
    # 1. Les Brises
    html = get_template("Les Brises", brises_content, "modernized/les-brises", "img/schemas/schema_brises_vallee.png")
    with open(os.path.join(OUTPUT_DIR, "les_brises.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("Generated Premium: les_brises.html")

    # 2. Facteurs Humains
    html = get_template("Facteurs Humains", fh_content, "modernized/facteurs-humains", "img/schemas/schema_facteurs_humains.png")
    with open(os.path.join(OUTPUT_DIR, "facteurs_humains.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("Generated Premium: facteurs_humains.html")
    
    # 3. Mécanique du Vol
    html = get_template("Mécanique du Vol", meca_content, "modernized/mecanique-du-vol", "img/schemas/schema_forces_vol.png")
    with open(os.path.join(OUTPUT_DIR, "mecanique_du_vol.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("Generated Premium: mecanique_du_vol.html")

if __name__ == "__main__":
    generate()
