import re

def update_html(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update CSS cache busting
    content = re.sub(r'(href="css/.*?\.css)\?.*?"', r'\1?v=2.0"', content)

    # 2. Update JS cache busting & structure
    # Remove old scripts that will be modularized
    scripts_to_remove = [
        'js/engine_v4_6.js',
        'js/quiz_engine_v4_7.js',
        'js/library_engine.js',
        'js/logbook_engine.js',
        'js/sites_engine.js',
        'js/sites_map.js',
        'js/sites_weather.js',
        'js/sites_filter.js',
        'js/sites_ui.js',
        'js/services/storage.js'
    ]
    
    for s in scripts_to_remove:
        content = re.sub(r'<script\s+src="' + re.escape(s) + r'.*?></script>\n?', '', content)

    # Add main.js module at the end of body if not present
    if '<script type="module" src="js/core/main.js?v=2.0"></script>' not in content:
        content = content.replace('</body>', '    <script type="module" src="js/core/main.js?v=2.0"></script>\n</body>')

    # Remove remaining old version strings from other scripts
    content = re.sub(r'(\.js)\?v=[a-zA-Z0-9_.]+', r'\1?v=2.0', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print("HTML cleanup and cache busting completed.")

if __name__ == '__main__':
    update_html('index.html')
