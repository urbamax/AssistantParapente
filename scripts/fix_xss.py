import os
import re

VIEWS_DIR = "/Users/USER/Desktop/SITEWEB EN DEV/AssistantParapente/js/views"

def add_import_if_missing(content, import_statement):
    if "import { escapeHTML }" not in content:
        # Find the last import
        lines = content.split('\n')
        last_import_idx = -1
        for i, line in enumerate(lines):
            if line.startswith('import '):
                last_import_idx = i
        
        if last_import_idx != -1:
            lines.insert(last_import_idx + 1, import_statement)
            return '\n'.join(lines)
        else:
            return import_statement + '\n' + content
    return content

def fix_logbook():
    path = os.path.join(VIEWS_DIR, "logbook.js")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    content = add_import_if_missing(content, "import { escapeHTML } from '../core/security.js';")

    content = re.sub(r'\$\{siteName\}', r'${escapeHTML(siteName)}', content)
    content = re.sub(r'\$\{location\}', r'${escapeHTML(location)}', content)
    content = re.sub(r'\$\{subtitle\}', r'${escapeHTML(subtitle)}', content)
    content = re.sub(r'\$\{session\.voile\}', r'${escapeHTML(session.voile)}', content)
    content = re.sub(r'\$\{session\.sellette\}', r'${escapeHTML(session.sellette)}', content)
    content = re.sub(r'\$\{session\.commentaire\}', r'${escapeHTML(session.commentaire)}', content)
    content = re.sub(r'\$\{session\.techDecollage\}', r'${escapeHTML(session.techDecollage)}', content)
    content = re.sub(r'\$\{searchedString\}', r'${escapeHTML(searchedString)}', content)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def fix_sites():
    path = os.path.join(VIEWS_DIR, "sites.js")
    if not os.path.exists(path): return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    content = add_import_if_missing(content, "import { escapeHTML } from '../core/security.js';")
    
    content = re.sub(r'\$\{site\.nom\}', r'${escapeHTML(site.nom)}', content)
    content = re.sub(r'\$\{site\.nomMin\}', r'${escapeHTML(site.nomMin)}', content)
    content = re.sub(r'\$\{site\.description\}', r'${escapeHTML(site.description)}', content)
    content = re.sub(r'\$\{site\.type\}', r'${escapeHTML(site.type)}', content)
    content = re.sub(r'\$\{site\.orientation\}', r'${escapeHTML(site.orientation)}', content)
    content = re.sub(r'\$\{site\.pratique\}', r'${escapeHTML(site.pratique)}', content)
    content = re.sub(r'\$\{note\.content\}', r'${escapeHTML(note.content)}', content)
    content = re.sub(r'\$\{feature\.properties\.name\}', r'${escapeHTML(feature.properties.name)}', content)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def fix_quiz():
    path = os.path.join(VIEWS_DIR, "quiz.js")
    if not os.path.exists(path): return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    content = add_import_if_missing(content, "import { escapeHTML } from '../core/security.js';")
    
    content = re.sub(r'\$\{question\.titre\}', r'${escapeHTML(question.titre)}', content)
    content = re.sub(r'\$\{question\.texte\}', r'${escapeHTML(question.texte)}', content)
    content = re.sub(r'\$\{choice\}', r'${escapeHTML(choice)}', content)
    content = re.sub(r'\$\{theme\}', r'${escapeHTML(theme)}', content)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def fix_library():
    path = os.path.join(VIEWS_DIR, "manual.js")
    if not os.path.exists(path): return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    content = add_import_if_missing(content, "import { escapeHTML } from '../core/security.js';")
    
    content = re.sub(r'\$\{course\.title\}', r'${escapeHTML(course.title)}', content)
    content = re.sub(r'\$\{course\.description\}', r'${escapeHTML(course.description)}', content)
    content = re.sub(r'\$\{course\.author\}', r'${escapeHTML(course.author)}', content)
    content = re.sub(r'\$\{pdf\.title\}', r'${escapeHTML(pdf.title)}', content)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

fix_logbook()
fix_sites()
fix_quiz()
fix_library()
print("Done escaping HTML in views.")
