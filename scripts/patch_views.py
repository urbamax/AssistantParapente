import os

def patch_views():
    views = ['quiz.js', 'manual.js', 'logbook.js', 'sites.js']
    engines = ['QuizEngine', 'LibraryEngine', 'LogbookEngine', 'SitesEngine']
    
    for view, engine in zip(views, engines):
        path = f"js/views/{view}"
        if not os.path.exists(path): continue
        with open(path, 'r') as f:
            content = f.read()
            
        # Add window.Engine_name = Engine_name;
        if f"window.{engine} =" not in content:
            content = content.replace(
                f"export default {{",
                f"window.{engine} = {engine};\nexport default {{"
            )
            with open(path, 'w') as f:
                f.write(content)
        print(f"Patched {view}")

if __name__ == '__main__':
    patch_views()
