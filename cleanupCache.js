// ✅ cleanupCache.js – Updated to skip technical-screens.json for stable advanced routes

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'cache');

function cleanupCache() {
    if (!fs.existsSync(CACHE_DIR)) return;

    const files = fs.readdirSync(CACHE_DIR);

    files.forEach(file => {
        // Skip critical files for advanced features
        if (file === 'technical-screens.json') {
            console.log(`⏩ Skipping ${file} during cleanup (required for advanced routes)`);
            return;
        }
        
        const filePath = path.join(CACHE_DIR, file);
        try {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted cache file: ${file}`);
        } catch (err) {
            console.error(`❌ Error deleting ${file}:`, err);
        }
    });
}

module.exports = cleanupCache;
