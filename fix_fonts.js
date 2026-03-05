const fs = require('fs');
const path = require('path');

const cssDir = 'd:\\Esp32_projeler\\akilli_cami\\workshop\\cami-tv\\web\\css';

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    const regex = /font-size:\s*([^;]+);/g;

    content = content.replace(regex, (match, value) => {
        value = value.trim();
        if (value.includes('var(--font-scale)') || value.startsWith('calc(')) {
            return match;
        }

        let newValue = `calc(var(--font-scale) * ${value})`;
        modified = true;
        return `font-size: ${newValue};`;
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${path.basename(filePath)}`);
    } else {
        console.log(`No changes in ${path.basename(filePath)}`);
    }
}

fs.readdirSync(cssDir).forEach(file => {
    if (file.endsWith('.css')) {
        processFile(path.join(cssDir, file));
    }
});
