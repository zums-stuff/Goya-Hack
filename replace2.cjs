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
    
    content = content.replace(/Alice/g, 'Gremium');
    content = content.replace(/ALICE/g, 'GREMIUM');
    content = content.replace(/alice/g, 'gremium');
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated', file);
        updatedCount++;
    }
}
console.log('Total files updated (Alice):', updatedCount);
