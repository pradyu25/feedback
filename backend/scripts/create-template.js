const ExcelJS = require('exceljs');

const generateTemplate = async () => {
    const workbook = new ExcelJS.Workbook();

    // Students Sheet
    const studentsSheet = workbook.addWorksheet('Students');
    studentsSheet.columns = [
        { header: 'rollId', key: 'rollId', width: 20 },
        { header: 'name', key: 'name', width: 30 },
        { header: 'year', key: 'year', width: 10 },
        { header: 'semester', key: 'semester', width: 10 },
        { header: 'section', key: 'section', width: 10 },
        { header: 'password', key: 'password', width: 20 }
    ];
    studentsSheet.addRow({ rollId: '21AI01', name: 'John Doe', year: 3, semester: 5, section: 'A', password: '1234' });

    // Faculty Sheet
    const facultySheet = workbook.addWorksheet('Faculty');
    facultySheet.columns = [
        { header: 'facultyId', key: 'facultyId', width: 20 },
        { header: 'name', key: 'name', width: 30 },
        { header: 'department', key: 'department', width: 20 }
    ];
    facultySheet.addRow({ facultyId: 'F001', name: 'Dr. Jane Smith', department: 'AIML' });

    // Subjects Sheet
    const subjectsSheet = workbook.addWorksheet('Subjects');
    subjectsSheet.columns = [
        { header: 'subjectCode', key: 'subjectCode', width: 15 },
        { header: 'subjectName', key: 'subjectName', width: 30 },
        { header: 'type', key: 'type', width: 15 }, // theory/lab
        { header: 'year', key: 'year', width: 10 },
        { header: 'semester', key: 'semester', width: 10 },
        { header: 'section', key: 'section', width: 10 },
        { header: 'facultyId', key: 'facultyId', width: 20 } // Must match facultyId in Faculty sheet
    ];
    subjectsSheet.addRow({ subjectCode: 'CS101', subjectName: 'Intro to AI', type: 'theory', year: 3, semester: 5, section: 'A', facultyId: 'F001' });

    await workbook.xlsx.writeFile('DataTemplate.xlsx');
    console.log('Template created: DataTemplate.xlsx');
};

generateTemplate();
