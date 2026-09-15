const fs = require('fs');
const path = require('path');

const VIEWS_DIR = path.join(__dirname, '../js/views');

function addImportIfMissing(content, importStatement) {
    if (!content.includes('import { escapeHTML }')) {
        const lines = content.split('\n');
        let lastImportIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('import ')) {
                lastImportIdx = i;
            }
        }
        
        if (lastImportIdx !== -1) {
            lines.splice(lastImportIdx + 1, 0, importStatement);
            return lines.join('\n');
        } else {
            return importStatement + '\n' + content;
        }
    }
    return content;
}

function fixLogbook() {
    const file = path.join(VIEWS_DIR, 'logbook.js');
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    content = addImportIfMissing(content, "import { escapeHTML } from '../core/security.js';");

    content = content.replace(/\$\{siteName\}/g, '${escapeHTML(siteName)}');
    content = content.replace(/\$\{location\}/g, '${escapeHTML(location)}');
    content = content.replace(/\$\{subtitle\}/g, '${escapeHTML(subtitle)}');
    content = content.replace(/\$\{session\.voile\}/g, '${escapeHTML(session.voile)}');
    content = content.replace(/\$\{session\.sellette\}/g, '${escapeHTML(session.sellette)}');
    content = content.replace(/\$\{session\.commentaire\}/g, '${escapeHTML(session.commentaire)}');
    content = content.replace(/\$\{session\.techDecollage\}/g, '${escapeHTML(session.techDecollage)}');
    content = content.replace(/\$\{searchedString\}/g, '${escapeHTML(searchedString)}');

    fs.writeFileSync(file, content, 'utf8');
}

function fixSites() {
    const file = path.join(VIEWS_DIR, 'sites.js');
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    content = addImportIfMissing(content, "import { escapeHTML } from '../core/security.js';");
    
    content = content.replace(/\$\{site\.nom\}/g, '${escapeHTML(site.nom)}');
    content = content.replace(/\$\{site\.nomMin\}/g, '${escapeHTML(site.nomMin)}');
    content = content.replace(/\$\{site\.description\}/g, '${escapeHTML(site.description)}');
    content = content.replace(/\$\{site\.type\}/g, '${escapeHTML(site.type)}');
    content = content.replace(/\$\{site\.orientation\}/g, '${escapeHTML(site.orientation)}');
    content = content.replace(/\$\{site\.pratique\}/g, '${escapeHTML(site.pratique)}');
    content = content.replace(/\$\{note\.content\}/g, '${escapeHTML(note.content)}');
    content = content.replace(/\$\{feature\.properties\.name\}/g, '${escapeHTML(feature.properties.name)}');

    fs.writeFileSync(file, content, 'utf8');
}

function fixQuiz() {
    const file = path.join(VIEWS_DIR, 'quiz.js');
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    content = addImportIfMissing(content, "import { escapeHTML } from '../core/security.js';");
    
    content = content.replace(/\$\{question\.titre\}/g, '${escapeHTML(question.titre)}');
    content = content.replace(/\$\{question\.texte\}/g, '${escapeHTML(question.texte)}');
    content = content.replace(/\$\{choice\}/g, '${escapeHTML(choice)}');
    content = content.replace(/\$\{theme\}/g, '${escapeHTML(theme)}');

    fs.writeFileSync(file, content, 'utf8');
}

function fixLibrary() {
    const file = path.join(VIEWS_DIR, 'library.js');
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');

    content = addImportIfMissing(content, "import { escapeHTML } from '../core/security.js';");
    
    content = content.replace(/\$\{course\.title\}/g, '${escapeHTML(course.title)}');
    content = content.replace(/\$\{course\.description\}/g, '${escapeHTML(course.description)}');
    content = content.replace(/\$\{course\.author\}/g, '${escapeHTML(course.author)}');
    content = content.replace(/\$\{pdf\.title\}/g, '${escapeHTML(pdf.title)}');

    fs.writeFileSync(file, content, 'utf8');
}

fixLogbook();
fixSites();
fixQuiz();
fixLibrary();
console.log("Done escaping HTML in views.");
