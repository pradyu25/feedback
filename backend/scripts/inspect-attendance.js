const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', '..', 'clgdata');
const files = fs.readdirSync(dataDir).filter(f => f.includes('ATTENDANCE'));

files.forEach(file => {
    console.log(`\n\n=== ATTENDANCE FILE: ${file} ===`);
    try {
        const workbook = xlsx.readFile(path.join(dataDir, file));
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // Get first 10 rows
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0, limit: 10, defval: null });

        rows.forEach((row, i) => {
            console.log(`Row ${i}:`, JSON.stringify(row));
        });
    } catch (e) {
        console.error(e);
    }
});
