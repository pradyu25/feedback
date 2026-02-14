const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', '..', 'clgdata');
const files = fs.readdirSync(dataDir).filter(f => f.includes('Alloc'));

files.forEach(file => {
    console.log(`\n\n=== FILE: ${file} ===`);
    const workbook = xlsx.readFile(path.join(dataDir, file));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Inspect first 20 rows
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 'A', range: 0, limit: 20, defval: '' });

    rows.forEach((row, i) => {
        // Log if it looks like subject/faculty row
        // Criteria: Column A (Subject?) and E (Faculty?) have content
        if (row.A && row.E) {
            console.log(`Row ${i}: Subject="${row.A}", Faculty="${row.E}", Year="${row.B}", Sem="${row.C}"`);
        } else if (row.A || row.B || row.C || row.D || row.E) {
            // Log partials to see structure
            console.log(`Row ${i} (Partial):`, JSON.stringify(row));
        }
    });
});
