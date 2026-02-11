#!/usr/bin/env node

/**
 * Watch Script for Components
 * Automatically rebuilds components.js when header.html or footer.html changes
 * 
 * Usage: node components/watch.js
 * Press Ctrl+C to stop
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const componentsDir = __dirname;
const headerFile = path.join(componentsDir, 'header.html');
const footerFile = path.join(componentsDir, 'footer.html');

console.log('👀 Watching for changes...');
console.log('   - header.html');
console.log('   - footer.html');
console.log('\nPress Ctrl+C to stop\n');

// Build function
function build() {
    try {
        execSync('node components/build.js', {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit'
        });
    } catch (error) {
        console.error('❌ Build failed');
    }
}

// Initial build
build();

// Watch for changes
fs.watch(headerFile, (eventType) => {
    if (eventType === 'change') {
        console.log('📝 header.html changed - rebuilding...');
        build();
    }
});

fs.watch(footerFile, (eventType) => {
    if (eventType === 'change') {
        console.log('📝 footer.html changed - rebuilding...');
        build();
    }
});
