const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.next')) {
                results = results.concat(walk(file));
            }
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.md') || file.endsWith('.css')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('.');
let updatedCount = 0;

for (const file of files) {
    if (file.includes('gap-analysis.md')) continue;
    
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    content = content.replace(/PumaTrade/g, 'Gremium');
    content = content.replace(/Puma Trade/g, 'Gremium');
    content = content.replace(/PUMATRADE/g, 'GREMIUM');
    content = content.replace(/pumatrade/g, 'gremium');
    content = content.replace(/Puma/g, 'Gremium');
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated', file);
        updatedCount++;
    }
}
console.log('Total files updated:', updatedCount);
