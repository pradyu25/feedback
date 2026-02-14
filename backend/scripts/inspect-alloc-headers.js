const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', '..', 'clgdata');
const files = fs.readdirSync(dataDir).filter(f => f.includes('Alloc'));

files.forEach(file => {
    console.log(`\n\n=== ALLOC FILE: ${file} ===`);
    const workbook = xlsx.readFile(path.join(dataDir, file));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Get as object with column letters A, B, C...
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 'A', range: 0, limit: 5 });

    rows.forEach((row, i) => {
        console.log(`Row ${i}:`, JSON.stringify(row));
    });
});
