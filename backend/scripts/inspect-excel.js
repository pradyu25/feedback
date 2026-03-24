const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const files = [
    path.join(__dirname, '../../clgdata/AIML-Subs-Alloc-2-2.xlsx'),
    path.join(__dirname, '../../clgdata/AIML-Subs-Alloc-3-2.xlsx'),
    path.join(__dirname, '../../clgdata/AIML-Subs-Alloc-4-2.xlsx'),
];

files.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
        console.log(`NOT FOUND: ${filePath}`);
        return;
    }
    const wb = xlsx.read(fs.readFileSync(filePath), { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 'A', range: 0, defval: '' });

    console.log(`\n===== ${path.basename(filePath)} =====`);
    console.log('First 5 rows (raw):');
    rows.slice(0, 5).forEach((r, i) => console.log(`  Row ${i}:`, JSON.stringify(r)));
    console.log(`All ${rows.length} rows:`);
    rows.forEach((r, i) => {
        if (r.A || r.B || r.C || r.D || r.E) {
            console.log(`  [${i}] A="${r.A}" B="${r.B}" C="${r.C}" D="${r.D}" E="${r.E}" F="${r.F || ''}"`);
        }
    });
});
