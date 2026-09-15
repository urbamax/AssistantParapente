import os

def wrap_engine(filename, output_name, class_name, engine_name):
    with open(f"js/{filename}", 'r', encoding='utf-8') as f:
        content = f.read()

    # Wrap the engine into an ES6 module
    wrapper = f"""/**
 * VIEW/CONTROLLER - {class_name}
 * Wrapped from {filename}
 */
import GlobalState from '../core/app_state.js';
import AppEvents from '../core/events.js';
import AppRouter from '../core/router.js';
import StorageService from '../services/storage.js';

""" + content.replace(f"const {engine_name} =", f"const {engine_name} =") + f"""

export default {{
    mount: async function(params) {{
        console.log("Mounting {class_name} with params", params);
        if ({engine_name} && {engine_name}.init) {{
            {engine_name}.init(window.Engine); // Pass a dummy or the global engine if needed
        }}
        if ({engine_name}.show) {{
            {engine_name}.show();
        }}
    }},
    unmount: async function() {{
        console.log("Unmounting {class_name}");
        // Cleanup if necessary
    }},
    engine: {engine_name}
}};
"""

    with open(f"js/views/{output_name}", 'w', encoding='utf-8') as f:
        f.write(wrapper)
    print(f"Created js/views/{output_name}")

if __name__ == '__main__':
    wrap_engine('quiz_engine_v4_7.js', 'quiz.js', 'QuizView', 'QuizEngine')
    wrap_engine('library_engine.js', 'manual.js', 'LibraryView', 'LibraryEngine')
    wrap_engine('logbook_engine.js', 'logbook.js', 'LogbookView', 'LogbookEngine')
    wrap_engine('sites_engine.js', 'sites.js', 'SitesView', 'SitesEngine')
