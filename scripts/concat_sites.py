import os

def concat_and_wrap_sites():
    # The files that make up SitesEngine
    files = [
        'js/_legacy/sites_engine.js',
        'js/sites_map.js',
        'js/sites_weather.js',
        'js/sites_filter.js',
        'js/sites_ui.js'
    ]
    
    combined_content = ""
    for f in files:
        if os.path.exists(f):
            with open(f, 'r', encoding='utf-8') as file:
                combined_content += file.read() + "\n\n"
        else:
            print(f"File not found: {f}")
            
    # Wrap
    wrapper = f"""/**
 * VIEW/CONTROLLER - SitesView
 * Wrapped from sites_engine.js and its fragments (map, weather, filter, ui)
 */
import GlobalState from '../core/app_state.js';
import AppEvents from '../core/events.js';
import AppRouter from '../core/router.js';
import StorageService from '../services/storage.js';

""" + combined_content.replace(f"const SitesEngine =", f"const SitesEngine =") + f"""

window.SitesEngine = SitesEngine;

export default {{
    mount: async function(params) {{
        console.log("Mounting SitesView with params", params);
        if (SitesEngine && SitesEngine.init) {{
            SitesEngine.init(window.Engine);
        }}
        if (SitesEngine.show) {{
            SitesEngine.show();
        }}
    }},
    unmount: async function() {{
        console.log("Unmounting SitesView");
        // Cleanup if necessary
    }},
    engine: SitesEngine
}};
"""

    with open('js/views/sites.js', 'w', encoding='utf-8') as f:
        f.write(wrapper)
        
    print("Combined and wrapped sites.js successfully.")

if __name__ == '__main__':
    concat_and_wrap_sites()
