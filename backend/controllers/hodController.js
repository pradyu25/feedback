const asyncHandler = require('express-async-handler');
const Feedback = require('../models/Feedback');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun } = require('docx');
const fs = require('fs');
const path = require('path');

// Helper for analytics
const calculateAnalytics = async (query) => {
    // Ensure types matches Schema (Numbers)
    const baseFilter = {};
    if (query.year) baseFilter.year = parseInt(query.year);
    if (query.semester) baseFilter.semester = parseInt(query.semester);

    const subjectsFilter = { ...baseFilter };
    const studentsFilter = { ...baseFilter };

    if (query.section && query.section !== 'All') {
        subjectsFilter.section = query.section;
        studentsFilter.section = query.section;
    }

    const [students, subjects] = await Promise.all([
        Student.find(studentsFilter),
        Subject.find(subjectsFilter)
    ]);

    const feedbackFilter = { ...baseFilter };
    if (query.section && query.section !== 'All') {
        feedbackFilter.subjectId = { $in: subjects.map(s => s._id) };
        feedbackFilter.studentId = { $in: students.map(s => s._id) };
    }

    const feedbacks = await Feedback.find(feedbackFilter)
        .populate('facultyId', 'name')
        .populate('subjectId', 'subjectName');

    const sectionSubjectCount = {};
    subjects.forEach(s => {
        if (!sectionSubjectCount[s.section]) sectionSubjectCount[s.section] = 0;
        sectionSubjectCount[s.section]++;
    });

    const studentFeedbackCount = {};
    feedbacks.forEach(f => {
        if (f.isCompleted) {
            const sid = f.studentId.toString();
            studentFeedbackCount[sid] = (studentFeedbackCount[sid] || 0) + 1;
        }
    });

    let completedCount = 0;
    const pendingStudents = [];

    students.forEach(s => {
        const required = sectionSubjectCount[s.section] || 0;
        const actual = studentFeedbackCount[s._id.toString()] || 0;
        // If there are required subjects and student has done >= required, count as 1
        if (required > 0 && actual >= required) {
            completedCount++;
        } else {
            pendingStudents.push({
                rollId: s.rollId,
                name: s.name,
                completed: actual,
                required: required
            });
        }
    });

    // Faculty & Subject Reports Calculation
    const facultyStats = {};
    const subjectStats = {};

    feedbacks.forEach((f) => {
        if (f.isCompleted) {
            // Faculty
            const fId = f.facultyId._id.toString();
            if (!facultyStats[fId]) {
                facultyStats[fId] = {
                    name: f.facultyId.name,
                    sum: 0,
                    count: 0,
                    questionStats: {}
                };
            }
            facultyStats[fId].sum += f.totalScore;
            facultyStats[fId].count++;

            // Aggregate question scores for Faculty
            if (f.responses && f.responses.length > 0) {
                f.responses.forEach(r => {
                    const qIndex = r.questionIndex;
                    if (!facultyStats[fId].questionStats[qIndex]) {
                        facultyStats[fId].questionStats[qIndex] = { sum: 0, count: 0 };
                    }
                    facultyStats[fId].questionStats[qIndex].sum += r.rating;
                    facultyStats[fId].questionStats[qIndex].count++;
                });
            }

            // Subject
            const sId = f.subjectId._id.toString();
            if (!subjectStats[sId]) subjectStats[sId] = { name: f.subjectId.subjectName, sum: 0, count: 0 };
            subjectStats[sId].sum += f.totalScore;
            subjectStats[sId].count++;
        }
    });

    const facultyReport = Object.values(facultyStats).map(s => {
        const questionScores = Object.entries(s.questionStats).map(([index, stats]) => ({
            questionIndex: parseInt(index),
            average: ((stats.sum / stats.count) * 20).toFixed(2),
        })).sort((a, b) => a.questionIndex - b.questionIndex);

        return {
            name: s.name,
            average: (s.sum / s.count).toFixed(2),
            questions: questionScores
        };
    });

    const subjectReport = Object.values(subjectStats).map(s => ({ name: s.name, average: (s.sum / s.count).toFixed(2) }));

    const detailedReport = { theory: [], lab: [] };

    subjects.forEach(s => {
        const sId = s._id.toString();
        const subjectFeedbacks = feedbacks.filter(f => f.subjectId._id.toString() === sId && f.isCompleted);

        if (subjectFeedbacks.length > 0) {
            let sumTotalScore = 0;
            let count = 0;
            const paramStats = {};

            subjectFeedbacks.forEach(f => {
                sumTotalScore += f.totalScore;
                count++;
                if (f.responses) {
                    f.responses.forEach(r => {
                        const idx = r.questionIndex;
                        if (!paramStats[idx]) paramStats[idx] = { sum: 0, count: 0 };
                        paramStats[idx].sum += r.rating;
                        paramStats[idx].count++;
                    });
                }
            });

            // Dynamically find max parameters or fallback to 10 for theory / 8 for lab
            const maxIdx = Math.max(...Object.keys(paramStats).map(Number));
            const numParams = maxIdx >= 0 ? maxIdx + 1 : (s.type === 'theory' ? 10 : 8);
            const params = [];

            for (let i = 0; i < numParams; i++) {
                if (paramStats[i] && paramStats[i].count > 0) {
                    params.push(((paramStats[i].sum / paramStats[i].count) * 20).toFixed(1)); // e.g. 79.7
                } else {
                    params.push('-');
                }
            }

            const facultyName = subjectFeedbacks[0].facultyId?.name || 'Unknown';
            const subjectNameWithFaculty = `${s.subjectName}-(${facultyName})`;

            const reportRow = {
                subjectName: subjectNameWithFaculty,
                params: params,
                average: (sumTotalScore / count).toFixed(2),
            };

            if (s.type === 'theory') {
                detailedReport.theory.push(reportRow);
            } else {
                detailedReport.lab.push(reportRow);
            }
        }
    });

    return { completedCount, facultyReport, subjectReport, pendingStudents, detailedReport };
};


// @desc    Get HOD analytics
// @route   GET /api/hod/analytics
// @access  Private (HOD)
const getAnalytics = asyncHandler(async (req, res) => {
    const { year, semester } = req.query;

    const filter = {};
    if (year) filter.year = parseInt(year);
    if (semester) filter.semester = parseInt(semester);

    // 1. Get Distinct Sections
    const distinctSections = await Subject.find(filter).distinct('section');
    const sectionsToProcess = distinctSections.length > 0 ? distinctSections.sort() : ['A'];

    // 2. Compute Individual Section Analytics and Overall combined in parallel
    const sectionPromises = sectionsToProcess.map(async (sec) => {
        const countFilter = { ...filter, section: sec };
        const [secAnalytics, secTotalStudents] = await Promise.all([
            calculateAnalytics({ year, semester, section: sec }),
            Student.countDocuments(countFilter)
        ]);

        return {
            section: sec,
            totalStudents: secTotalStudents,
            completedCount: secAnalytics.completedCount,
            inProgressCount: 0,
            notSubmittedCount: secTotalStudents - secAnalytics.completedCount,
            facultyReport: secAnalytics.facultyReport,
            subjectReport: secAnalytics.subjectReport,
            pendingStudents: secAnalytics.pendingStudents,
        };
    });

    const [sectionsData, overallAnalytics] = await Promise.all([
        Promise.all(sectionPromises),
        calculateAnalytics({ year, semester })
    ]);

    const totalYearStudents = sectionsData.reduce((sum, d) => sum + d.totalStudents, 0);

    res.json({
        totalStudents: totalYearStudents,
        completedCount: overallAnalytics.completedCount,
        inProgressCount: 0,
        notSubmittedCount: totalYearStudents - overallAnalytics.completedCount,
        facultyReport: overallAnalytics.facultyReport,
        subjectReport: overallAnalytics.subjectReport,
        pendingStudents: overallAnalytics.pendingStudents,
        sectionsData // Attach the grouped datasets directly
    });
});

// @desc    Export analytics as PDF
// @route   GET /api/hod/export/pdf
// @access  Private (HOD)
const exportPDF = asyncHandler(async (req, res) => {
    const { year, semester, section } = req.query;

    let sectionsToExport = [];
    if (section && section !== 'All') {
        sectionsToExport = [section];
    } else {
        const filter = {};
        if (year) filter.year = parseInt(year);
        if (semester) filter.semester = parseInt(semester);
        const distinctSections = await Subject.find(filter).distinct('section');
        sectionsToExport = distinctSections.length > 0 ? distinctSections.sort() : ['All'];
    }

    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true }); // Enable page buffering for footer loop
    const filename = `Feedback_Report_Y${year}_S${semester}.pdf`;

    res.setHeader('Content-disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // Fetch all section analytics concurrently
    const sectionAnalyticsList = await Promise.all(
        sectionsToExport.map(currentSection => calculateAnalytics({ year, semester, section: currentSection }))
    );

    for (let i = 0; i < sectionsToExport.length; i++) {
        const currentSection = sectionsToExport[i];
        const analytics = sectionAnalyticsList[i];

        if (i > 0) {
            doc.addPage();
        }

        // Add Logo Banner (Full Width)
        const logoPath = path.join(__dirname, '..', 'logo.png');
        if (fs.existsSync(logoPath)) {
            // A4 width ~595.28 points
            doc.image(logoPath, 0, 0, { width: 595.28, height: 150 });
        }

        // Header Content (Shifted down)
        const headerStartY = 170;

        // Title
        doc.font('Helvetica-Bold').fontSize(24).text('Department of AIML', 0, headerStartY, { align: 'center', width: 595.28 });
        doc.fontSize(20).text('Feedback Analysis Report', 0, headerStartY + 35, { align: 'center', width: 595.28 });

        // Info Box
        const infoBoxY = headerStartY + 80;
        doc.rect(50, infoBoxY, 495, 80).fillAndStroke('#f0f0f0', '#333');
        doc.fillColor('#000')
            .fontSize(12)
            .font('Helvetica-Bold')
            .text(`Academic Year: ${year}`, 70, infoBoxY + 20)
            .text(`Semester: ${semester}`, 70, infoBoxY + 40)
            .text(`Section: ${currentSection}`, 70, infoBoxY + 60)
            .text(`Generated: ${new Date().toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}`, 70, infoBoxY + 80);

        let yPosition = infoBoxY + 120;

        // Draw Function
        const drawGrid = (title, dataList, isTheory) => {
            if (!dataList || dataList.length === 0) return;

            doc.fontSize(14).font('Helvetica-Bold').fillColor('#000').text(title, 0, yPosition, { align: 'center', width: 595.28 });
            yPosition += 25;

            const cwSNO = 30;
            const cwSubj = 150;
            const numParams = isTheory ? 10 : 8;
            const cwParam = 24;
            const cwTotal = 60;
            const rowHeight = 25;

            const tableWidth = cwSNO + cwSubj + (numParams * cwParam) + cwTotal;
            const startX = (595.28 - tableWidth) / 2;

            const drawRow = (rowObj, isHeader = false) => {
                let x = startX;
                doc.fillColor('#000');
                if (isHeader) {
                    doc.fontSize(8).font('Helvetica-Bold');
                } else {
                    doc.fontSize(9).font('Helvetica');
                }

                // SNO
                doc.rect(x, yPosition, cwSNO, rowHeight).stroke('#333');
                doc.text(rowObj[0], x, yPosition + 8, { width: cwSNO, align: 'center' });
                x += cwSNO;

                // Subject Name
                doc.rect(x, yPosition, cwSubj, rowHeight).stroke('#333');
                doc.text(rowObj[1], x + 5, yPosition + 8, { width: cwSubj - 10, align: 'left', lineBreak: false });
                x += cwSubj;

                // Params
                for (let i = 0; i < numParams; i++) {
                    doc.rect(x, yPosition, cwParam, rowHeight).stroke('#333');
                    doc.text(rowObj[2 + i], x, yPosition + 8, { width: cwParam, align: 'center' });
                    x += cwParam;
                }

                // Total
                doc.rect(x, yPosition, cwTotal, rowHeight).stroke('#333');
                doc.text(rowObj[2 + numParams], x, yPosition + 8, { width: cwTotal, align: 'center' });

                yPosition += rowHeight;
            };

            // Table Header
            const headers = ['SNO', isTheory ? 'SUBJECT NAME' : 'LAB SUBJECT NAME'];
            for (let i = 1; i <= numParams; i++) headers.push(`P${i}`);
            headers.push('FEEDBACK (%)');

            drawRow(headers, true);

            dataList.forEach((row, idx) => {
                if (yPosition + rowHeight > 750) {
                    doc.addPage();
                    yPosition = 50;
                    drawRow(headers, true);
                }
                const rowObj = [(idx + 1).toString(), row.subjectName, ...row.params.slice(0, numParams), `${row.average}%`];
                drawRow(rowObj);
            });

            yPosition += 40;
        };

        const yearLabel = year === 2 ? 'II' : year === 3 ? 'III' : 'IV';
        const semLabel = semester === 1 ? 'I' : 'II';
        const basePath = `2025-26 - AIML - ${yearLabel} - ${semLabel} - ${currentSection}`;

        doc.fontSize(20).font('Helvetica-Bold').fillColor('#000').text('FEEDBACK SYSTEM', 0, yPosition, { align: 'center', width: 595.28 });
        yPosition += 40;

        drawGrid(`${basePath} - (Theory) FEED BACK - II`, analytics.detailedReport?.theory || [], true);

        if (yPosition + 100 > 750) { doc.addPage(); yPosition = 50; }
        drawGrid(`${basePath} - (Laboratory) FEED BACK - II`, analytics.detailedReport?.lab || [], false);

    } // end sectionsToExport loop

    // Footer
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
            .fillColor('#666')
            .text(
                `Page ${i + 1} of ${pages.count} | Confidential Document | AIML Department`,
                50,
                doc.page.height - 50,
                { align: 'center', width: doc.page.width - 100 }
            );
    }

    doc.end();
});

// @desc    Export analytics as Excel
// @route   GET /api/hod/export/excel
// @access  Private (HOD)
const exportExcel = asyncHandler(async (req, res) => {
    const { year, semester, section } = req.query;

    let sectionsToExport = [];
    if (section && section !== 'All') {
        sectionsToExport = [section];
    } else {
        const filter = {};
        if (year) filter.year = parseInt(year);
        if (semester) filter.semester = parseInt(semester);
        const distinctSections = await Subject.find(filter).distinct('section');
        sectionsToExport = distinctSections.length > 0 ? distinctSections.sort() : ['All'];
    }

    const workbook = new ExcelJS.Workbook();

    // Fetch all section analytics concurrently
    const sectionAnalyticsList = await Promise.all(
        sectionsToExport.map(currentSection => calculateAnalytics({ year, semester, section: currentSection }))
    );

    for (let i = 0; i < sectionsToExport.length; i++) {
        const currentSection = sectionsToExport[i];
        const analytics = sectionAnalyticsList[i];

        const sheetName = sectionsToExport.length > 1 ? `Section ${currentSection}` : 'Feedback Report';
        const sheet = workbook.addWorksheet(sheetName, {
            pageSetup: { paperSize: 9, orientation: 'portrait' }
        });

        // Add Logo (Covering Columns A-D, Rows 1-5)
        const logoPath = path.join(__dirname, '..', 'logo.png');
        const startDataRow = 7; // Shift content down

        if (fs.existsSync(logoPath)) {
            const logoId = workbook.addImage({
                filename: logoPath,
                extension: 'png',
            });
            sheet.addImage(logoId, {
                tl: { col: 0, row: 0 },
                br: { col: 4, row: 5 } // Covers A1 to D5
            });
        }

        // Header Section (Shifted)
        const titleRow = startDataRow;
        sheet.mergeCells(`A${titleRow}:D${titleRow + 2}`);
        const titleCell = sheet.getCell(`A${titleRow}`);
        titleCell.value = 'Department of AIML\nFeedback Analysis Report';
        titleCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FF1e40af' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

        // Report Info (Shifted)
        const infoRow = titleRow + 4;
        sheet.getRow(infoRow).height = 25;
        sheet.mergeCells(`A${infoRow}:D${infoRow}`);
        const infoCell = sheet.getCell(`A${infoRow}`);
        infoCell.value = `Academic Year: ${year} | Semester: ${semester} | Section: ${currentSection} | Generated: ${new Date().toLocaleDateString('en-IN')}`;
        infoCell.font = { name: 'Calibri', size: 12, bold: true };
        infoCell.alignment = { vertical: 'middle', horizontal: 'center' };
        infoCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFe5e7eb' }
        };

        // Build Grid Function for Excel
        let currentRow = infoRow + 2;

        const buildExcelGrid = (title, dataList, isTheory) => {
            if (!dataList || dataList.length === 0) return;

            // Title Row
            sheet.getRow(currentRow).height = 25;
            const numParams = isTheory ? 10 : 8;
            const lastColChar = String.fromCharCode(65 + 2 + numParams); // e.g. 10 params -> A+2+10 = M (actually A+2(col C)+10(P10)=M)
            // A=0, B=1, ... wait: col 1=A, col 2=B, col 3=C...
            // SNO(1), Subject(2), P1-P10(3-12), Total(13). 13 is 'M'.
            const lastColIndex = 2 + numParams + 1;
            const mergeCode = `A${currentRow}:${String.fromCharCode(64 + lastColIndex)}${currentRow}`;

            sheet.mergeCells(mergeCode);
            const titleHeader = sheet.getCell(`A${currentRow}`);
            titleHeader.value = title;
            titleHeader.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF000000' } };
            titleHeader.alignment = { vertical: 'middle', horizontal: 'center' };
            titleHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe5e7eb' } };

            currentRow++;

            // Headers
            sheet.getRow(currentRow).height = 20;
            const headers = ['S.No', isTheory ? 'SUBJECT NAME' : 'LAB SUBJECT NAME'];
            for (let i = 1; i <= numParams; i++) headers.push(`P${i}`);
            headers.push('FEEDBACK (%)');

            headers.forEach((header, index) => {
                const cell = sheet.getCell(currentRow, index + 1);
                cell.value = header;
                cell.font = { name: 'Calibri', size: 11, bold: true };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFd1d5db' } };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            currentRow++;

            // Data Rows
            dataList.forEach((row, index) => {
                const rowObj = [index + 1, row.subjectName, ...row.params.slice(0, numParams), `${row.average}%`];
                sheet.getRow(currentRow).values = rowObj;

                for (let col = 1; col <= headers.length; col++) {
                    const cell = sheet.getCell(currentRow, col);
                    cell.font = { name: 'Calibri', size: 10 };
                    cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'center' };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                }
                currentRow++;
            });

            currentRow += 2;
        };

        const yearLabel = year === 2 ? 'II' : year === 3 ? 'III' : 'IV';
        const semLabel = semester === 1 ? 'I' : 'II';
        const basePath = `2025-26 - AIML - ${yearLabel} - ${semLabel} - ${currentSection}`;

        buildExcelGrid(`${basePath} - (Theory) FEED BACK - II`, analytics.detailedReport?.theory || [], true);
        buildExcelGrid(`${basePath} - (Laboratory) FEED BACK - II`, analytics.detailedReport?.lab || [], false);

        // Adjust column widths
        sheet.getColumn(1).width = 8;
        sheet.getColumn(2).width = 40;
        for (let i = 3; i <= 14; i++) sheet.getColumn(i).width = 8;
    } // end section loop

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Feedback_Report_Y${year}_S${semester}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
});

// @desc    Export analytics as Word
// @route   GET /api/hod/export/word
// @access  Private (HOD)
const exportWord = asyncHandler(async (req, res) => {
    const { year, semester, section } = req.query;

    let sectionsToExport = [];
    if (section && section !== 'All') {
        sectionsToExport = [section];
    } else {
        const filter = {};
        if (year) filter.year = parseInt(year);
        if (semester) filter.semester = parseInt(semester);
        const distinctSections = await Subject.find(filter).distinct('section');
        sectionsToExport = distinctSections.length > 0 ? distinctSections.sort() : ['All'];
    }

    const { Table, TableCell, TableRow, WidthType, BorderStyle } = require('docx');

    const logoPath = path.join(__dirname, '..', 'logo.png');
    let logoImage = null;
    if (fs.existsSync(logoPath)) {
        logoImage = new ImageRun({
            data: fs.readFileSync(logoPath),
            transformation: {
                width: 600,
                height: 150,
            },
        });
    }

    const wordSections = [];

    // Fetch all section analytics concurrently
    const sectionAnalyticsList = await Promise.all(
        sectionsToExport.map(currentSection => calculateAnalytics({ year, semester, section: currentSection }))
    );

    for (let i = 0; i < sectionsToExport.length; i++) {
        const currentSection = sectionsToExport[i];
        const analytics = sectionAnalyticsList[i];

        wordSections.push({
            properties: {
                page: {
                    margin: {
                        top: 0,
                        right: 0,
                        bottom: 720, // 0.5 inch bottom margin
                        left: 0,
                    },
                },
            },
            children: [
                // Logo (Full Width Banner)
                ...(logoImage ? [new Paragraph({
                    children: [new ImageRun({
                        data: fs.readFileSync(logoPath),
                        transformation: {
                            width: 800, // Full page width (A4 width is approx 595pt or 794px at 96dpi)
                            height: 200, // Adjusted height
                        },
                    })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 }, // Space after banner
                })] : []),

                // Title
                new Paragraph({
                    children: [new TextRun({ text: 'FEEDBACK SYSTEM', bold: true, size: 40 })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400, before: 200 },
                }),

                ...(() => {
                    const documentElements = [];

                    const yearLabel = year === 2 ? 'II' : year === 3 ? 'III' : 'IV';
                    const semLabel = semester === 1 ? 'I' : 'II';
                    const basePath = `2025-26 - AIML - ${yearLabel} - ${semLabel} - ${currentSection}`;

                    const buildWordTable = (title, dataList, isTheory) => {
                        if (!dataList || dataList.length === 0) return [];
                        const nodes = [];

                        // Table Title
                        nodes.push(new Paragraph({
                            children: [new TextRun({ text: title, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 400, after: 200 },
                        }));

                        const numParams = isTheory ? 10 : 8;
                        const headers = ['S.No', isTheory ? 'SUBJECT NAME' : 'LAB SUBJECT NAME'];
                        for (let i = 1; i <= numParams; i++) headers.push(`P${i}`);
                        headers.push('FEEDBACK (%)');

                        const tableRows = [
                            new TableRow({
                                tableHeader: true,
                                children: headers.map(h => new TableCell({
                                    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16 })], alignment: AlignmentType.CENTER })],
                                    shading: { fill: 'e5e7eb' },
                                }))
                            }),
                            ...dataList.map((row, index) => {
                                const rowCells = [(index + 1).toString(), row.subjectName, ...row.params.slice(0, numParams), `${row.average}%`];
                                return new TableRow({
                                    children: rowCells.map((val, cellIdx) => new TableCell({
                                        children: [new Paragraph({ children: [new TextRun({ text: val, size: 18 })], alignment: cellIdx === 1 ? AlignmentType.LEFT : AlignmentType.CENTER })],
                                    }))
                                });
                            })
                        ];

                        nodes.push(new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: tableRows,
                        }));

                        return nodes;
                    };

                    documentElements.push(...buildWordTable(`${basePath} - (Theory) FEED BACK - II`, analytics.detailedReport?.theory || [], true));
                    documentElements.push(...buildWordTable(`${basePath} - (Laboratory) FEED BACK - II`, analytics.detailedReport?.lab || [], false));

                    return documentElements;
                })(),

                // Footer
                new Paragraph({
                    children: [
                        new TextRun({
                            text: 'Confidential Document | AIML Department',
                            size: 16,
                            color: '666666',
                        }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 800 },
                }),
            ],
        });
    } // end section loop

    const doc = new Document({
        sections: wordSections,
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=Feedback_Report_Y${year}_S${semester}.docx`);
    res.send(buffer);
});

module.exports = {
    getAnalytics,
    exportPDF,
    exportExcel,
    exportWord,
};
