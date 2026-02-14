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
    const feedbacks = await Feedback.find(query)
        .populate('facultyId', 'name')
        .populate('subjectId', 'subjectName');

    const completedCount = feedbacks.filter(f => f.isCompleted).length;

    const facultyStats = {};
    const subjectStats = {};

    feedbacks.forEach((f) => {
        if (f.isCompleted) {
            // Faculty
            const fId = f.facultyId._id.toString();
            if (!facultyStats[fId]) facultyStats[fId] = { name: f.facultyId.name, sum: 0, count: 0 };
            facultyStats[fId].sum += f.totalScore;
            facultyStats[fId].count++;

            // Subject
            const sId = f.subjectId._id.toString();
            if (!subjectStats[sId]) subjectStats[sId] = { name: f.subjectId.subjectName, sum: 0, count: 0 };
            subjectStats[sId].sum += f.totalScore;
            subjectStats[sId].count++;


        }
    });

    const facultyReport = Object.values(facultyStats).map(s => ({ name: s.name, average: (s.sum / s.count).toFixed(2) }));
    const subjectReport = Object.values(subjectStats).map(s => ({ name: s.name, average: (s.sum / s.count).toFixed(2) }));

    return { completedCount, facultyReport, subjectReport };
};


// @desc    Get HOD analytics
// @route   GET /api/hod/analytics
// @access  Private (HOD)
const getAnalytics = asyncHandler(async (req, res) => {
    const { year, semester } = req.query;
    const analytics = await calculateAnalytics({ year, semester });

    // Need proper total student count logic based on enrollment
    const totalStudents = await Student.countDocuments(year ? { year: parseInt(year) } : {});

    res.json({
        totalStudents,
        completedCount: analytics.completedCount,
        inProgressCount: 0,
        notSubmittedCount: totalStudents - analytics.completedCount,
        facultyReport: analytics.facultyReport,
        subjectReport: analytics.subjectReport,
    });
});

// @desc    Export analytics as PDF
// @route   GET /api/hod/export/pdf
// @access  Private (HOD)
const exportPDF = asyncHandler(async (req, res) => {
    const { year, semester } = req.query;
    const analytics = await calculateAnalytics({ year, semester });

    const doc = new PDFDocument({ margin: 0, size: 'A4' }); // Start with 0 margin
    const filename = `Feedback_Report_Y${year}_S${semester}.pdf`;

    res.setHeader('Content-disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // Add Logo Banner (Full Width)
    const logoPath = path.join(__dirname, '..', 'logo.jpg');
    if (fs.existsSync(logoPath)) {
        // A4 width ~595.28 points
        doc.image(logoPath, 0, 0, { width: 595.28, height: 150 });
    }

    // Header Content (Shifted down)
    const headerStartY = 170;

    // Title
    doc.font('Helvetica-Bold').fontSize(24).text('AIML Department', 0, headerStartY, { align: 'center', width: 595.28 });
    doc.fontSize(20).text('Feedback Analysis Report', 0, headerStartY + 35, { align: 'center', width: 595.28 });

    // Info Box
    const infoBoxY = headerStartY + 80;
    doc.rect(50, infoBoxY, 495, 80).fillAndStroke('#f0f0f0', '#333');
    doc.fillColor('#000')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`Academic Year: ${year}`, 70, infoBoxY + 20)
        .text(`Semester: ${semester}`, 70, infoBoxY + 40)
        .text(`Generated: ${new Date().toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })}`, 70, infoBoxY + 60);

    let yPosition = infoBoxY + 120;

    // Faculty Performance Section
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e40af').text('Faculty Performance Analysis', 50, yPosition);
    doc.moveTo(50, yPosition + 20).lineTo(545, yPosition + 20).stroke('#1e40af');
    yPosition += 40;

    analytics.facultyReport.forEach((f, index) => {
        const score = parseFloat(f.average);
        const color = score >= 90 ? '#16a34a' : score >= 75 ? '#2563eb' : '#ea580c';

        doc.fontSize(11)
            .font('Helvetica')
            .fillColor('#000')
            .text(`${index + 1}. ${f.name}`, 70, yPosition);

        doc.fontSize(11)
            .font('Helvetica-Bold')
            .fillColor(color)
            .text(`${f.average}%`, 450, yPosition);

        yPosition += 25;

        // Add new page if needed
        if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
            // Re-add logo on new pages if desired? For now, keep simple.
        }
    });

    doc.moveDown(2);
    yPosition += 30;

    // Subject Performance Section
    if (yPosition > 650) {
        doc.addPage();
        yPosition = 50;
    }

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#7c3aed').text('Subject Performance Analysis', 50, yPosition);
    doc.moveTo(50, yPosition + 20).lineTo(545, yPosition + 20).stroke('#7c3aed');
    yPosition += 40;

    analytics.subjectReport.forEach((s, index) => {
        const score = parseFloat(s.average);
        const color = score >= 90 ? '#16a34a' : score >= 75 ? '#2563eb' : '#ea580c';

        doc.fontSize(11)
            .font('Helvetica')
            .fillColor('#000')
            .text(`${index + 1}. ${s.name}`, 70, yPosition);

        doc.fontSize(11)
            .font('Helvetica-Bold')
            .fillColor(color)
            .text(`${s.average}%`, 450, yPosition);

        yPosition += 25;

        if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
        }
    });

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
    const { year, semester } = req.query;
    const analytics = await calculateAnalytics({ year, semester });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Feedback Report', {
        pageSetup: { paperSize: 9, orientation: 'portrait' }
    });

    // Add Logo (Covering Columns A-D, Rows 1-5)
    const logoPath = path.join(__dirname, '..', 'logo.jpg');
    const startDataRow = 7; // Shift content down

    if (fs.existsSync(logoPath)) {
        const logoId = workbook.addImage({
            filename: logoPath,
            extension: 'jpeg',
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
    titleCell.value = 'AIML Department\nFeedback Analysis Report';
    titleCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FF1e40af' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Report Info (Shifted)
    const infoRow = titleRow + 4;
    sheet.getRow(infoRow).height = 25;
    sheet.mergeCells(`A${infoRow}:D${infoRow}`);
    const infoCell = sheet.getCell(`A${infoRow}`);
    infoCell.value = `Academic Year: ${year} | Semester: ${semester} | Generated: ${new Date().toLocaleDateString('en-IN')}`;
    infoCell.font = { name: 'Calibri', size: 12, bold: true };
    infoCell.alignment = { vertical: 'middle', horizontal: 'center' };
    infoCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFe5e7eb' }
    };

    // Faculty Performance Section (Shifted)
    const facultyHeaderRow = infoRow + 2;
    sheet.getRow(facultyHeaderRow).height = 25;
    sheet.mergeCells(`A${facultyHeaderRow}:D${facultyHeaderRow}`);
    const facultyHeader = sheet.getCell(`A${facultyHeaderRow}`);
    facultyHeader.value = 'Faculty Performance Analysis';
    facultyHeader.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    facultyHeader.alignment = { vertical: 'middle', horizontal: 'center' };
    facultyHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1e40af' }
    };

    // Faculty Table Headers
    const facultyTableHeadersRow = facultyHeaderRow + 1;
    sheet.getRow(facultyTableHeadersRow).height = 20;
    const facultyTableHeaders = ['S.No', 'Faculty Name', 'Average Score (%)', 'Rating'];
    facultyTableHeaders.forEach((header, index) => {
        const cell = sheet.getCell(facultyTableHeadersRow, index + 1);
        cell.value = header;
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF3b82f6' }
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // Faculty Data
    let currentRow = facultyTableHeadersRow + 1;
    analytics.facultyReport.forEach((f, index) => {
        const score = parseFloat(f.average);
        const rating = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : 'Average';
        const scoreColor = score >= 90 ? 'FF16a34a' : score >= 75 ? 'FF2563eb' : 'FFea580c';

        sheet.getRow(currentRow).values = [index + 1, f.name, f.average, rating];

        // Style each cell
        for (let col = 1; col <= 4; col++) {
            const cell = sheet.getCell(currentRow, col);
            cell.font = { name: 'Calibri', size: 10 };
            cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };

            // Color code the score and rating
            if (col === 3 || col === 4) {
                cell.font = { ...cell.font, bold: true, color: { argb: scoreColor } };
            }
        }
        currentRow++;
    });

    // Subject Performance Section
    currentRow += 2;
    sheet.getRow(currentRow).height = 25;
    sheet.mergeCells(`A${currentRow}:D${currentRow}`);
    const subjectHeader = sheet.getCell(`A${currentRow}`);
    subjectHeader.value = 'Subject Performance Analysis';
    subjectHeader.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    subjectHeader.alignment = { vertical: 'middle', horizontal: 'center' };
    subjectHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF7c3aed' }
    };

    // Subject Table Headers
    currentRow++;
    sheet.getRow(currentRow).height = 20;
    const subjectTableHeaders = ['S.No', 'Subject Name', 'Average Score (%)', 'Rating'];
    subjectTableHeaders.forEach((header, index) => {
        const cell = sheet.getCell(currentRow, index + 1);
        cell.value = header;
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF9333ea' }
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // Subject Data
    currentRow++;
    analytics.subjectReport.forEach((s, index) => {
        const score = parseFloat(s.average);
        const rating = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : 'Average';
        const scoreColor = score >= 90 ? 'FF16a34a' : score >= 75 ? 'FF2563eb' : 'FFea580c';

        sheet.getRow(currentRow).values = [index + 1, s.name, s.average, rating];

        for (let col = 1; col <= 4; col++) {
            const cell = sheet.getCell(currentRow, col);
            cell.font = { name: 'Calibri', size: 10 };
            cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };

            if (col === 3 || col === 4) {
                cell.font = { ...cell.font, bold: true, color: { argb: scoreColor } };
            }
        }
        currentRow++;
    });

    // Set column widths
    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 35;
    sheet.getColumn(3).width = 20;
    sheet.getColumn(4).width = 15;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Feedback_Report_Y${year}_S${semester}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
});

// @desc    Export analytics as Word
// @route   GET /api/hod/export/word
// @access  Private (HOD)
const exportWord = asyncHandler(async (req, res) => {
    const { year, semester } = req.query;
    const analytics = await calculateAnalytics({ year, semester });

    const { Table, TableCell, TableRow, WidthType, BorderStyle } = require('docx');

    const logoPath = path.join(__dirname, '..', 'logo.jpg');
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

    const doc = new Document({
        sections: [{
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
                    children: [
                        new TextRun({
                            text: 'AIML Department',
                            bold: true,
                            size: 48,
                            color: '1e40af',
                        }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200, before: 200 },
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: 'Feedback Analysis Report',
                            bold: true,
                            size: 36,
                            color: '1e40af',
                        }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 },
                }),

                // Report Info
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Academic Year: ${year} | Semester: ${semester}`,
                            bold: true,
                            size: 24,
                        }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Generated: ${new Date().toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}`,
                            size: 20,
                        }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 600 },
                }),

                // Faculty Performance Section
                new Paragraph({
                    children: [
                        new TextRun({
                            text: 'Faculty Performance Analysis',
                            bold: true,
                            size: 32,
                            color: '1e40af',
                        }),
                    ],
                    spacing: { before: 400, after: 300 },
                }),

                // Faculty Table
                new Table({
                    width: {
                        size: 100,
                        type: WidthType.PERCENTAGE,
                    },
                    rows: [
                        // Header Row
                        new TableRow({
                            tableHeader: true,
                            children: [
                                new TableCell({
                                    children: [new Paragraph({
                                        children: [new TextRun({ text: 'S.No', bold: true, color: 'FFFFFF' })],
                                        alignment: AlignmentType.CENTER,
                                    })],
                                    shading: { fill: '3b82f6' },
                                }),
                                new TableCell({
                                    children: [new Paragraph({
                                        children: [new TextRun({ text: 'Faculty Name', bold: true, color: 'FFFFFF' })],
                                        alignment: AlignmentType.CENTER,
                                    })],
                                    shading: { fill: '3b82f6' },
                                }),
                                new TableCell({
                                    children: [new Paragraph({
                                        children: [new TextRun({ text: 'Average Score (%)', bold: true, color: 'FFFFFF' })],
                                        alignment: AlignmentType.CENTER,
                                    })],
                                    shading: { fill: '3b82f6' },
                                }),
                                new TableCell({
                                    children: [new Paragraph({
                                        children: [new TextRun({ text: 'Rating', bold: true, color: 'FFFFFF' })],
                                        alignment: AlignmentType.CENTER,
                                    })],
                                    shading: { fill: '3b82f6' },
                                }),
                            ],
                        }),
                        // Data Rows
                        ...analytics.facultyReport.map((f, index) => {
                            const score = parseFloat(f.average);
                            const rating = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : 'Average';
                            const color = score >= 90 ? '16a34a' : score >= 75 ? '2563eb' : 'ea580c';

                            return new TableRow({
                                children: [
                                    new TableCell({
                                        children: [new Paragraph({
                                            children: [new TextRun({ text: `${index + 1}` })],
                                            alignment: AlignmentType.CENTER,
                                        })],
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({
                                            children: [new TextRun({ text: f.name })],
                                        })],
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({
                                            children: [new TextRun({ text: f.average, bold: true, color })],
                                            alignment: AlignmentType.CENTER,
                                        })],
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({
                                            children: [new TextRun({ text: rating, bold: true, color })],
                                            alignment: AlignmentType.CENTER,
                                        })],
                                    }),
                                ],
                            });
                        }),
                    ],
                }),

                // Subject Performance Section
                new Paragraph({
                    children: [
                        new TextRun({
                            text: 'Subject Performance Analysis',
                            bold: true,
                            size: 32,
                            color: '7c3aed',
                        }),
                    ],
                    spacing: { before: 600, after: 300 },
                }),

                // Subject Table
                new Table({
                    width: {
                        size: 100,
                        type: WidthType.PERCENTAGE,
                    },
                    rows: [
                        // Header Row
                        new TableRow({
                            tableHeader: true,
                            children: [
                                new TableCell({
                                    children: [new Paragraph({
                                        children: [new TextRun({ text: 'S.No', bold: true, color: 'FFFFFF' })],
                                        alignment: AlignmentType.CENTER,
                                    })],
                                    shading: { fill: '9333ea' },
                                }),
                                new TableCell({
                                    children: [new Paragraph({
                                        children: [new TextRun({ text: 'Subject Name', bold: true, color: 'FFFFFF' })],
                                        alignment: AlignmentType.CENTER,
                                    })],
                                    shading: { fill: '9333ea' },
                                }),
                                new TableCell({
                                    children: [new Paragraph({
                                        children: [new TextRun({ text: 'Average Score (%)', bold: true, color: 'FFFFFF' })],
                                        alignment: AlignmentType.CENTER,
                                    })],
                                    shading: { fill: '9333ea' },
                                }),
                                new TableCell({
                                    children: [new Paragraph({
                                        children: [new TextRun({ text: 'Rating', bold: true, color: 'FFFFFF' })],
                                        alignment: AlignmentType.CENTER,
                                    })],
                                    shading: { fill: '9333ea' },
                                }),
                            ],
                        }),
                        // Data Rows
                        ...analytics.subjectReport.map((s, index) => {
                            const score = parseFloat(s.average);
                            const rating = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : 'Average';
                            const color = score >= 90 ? '16a34a' : score >= 75 ? '2563eb' : 'ea580c';

                            return new TableRow({
                                children: [
                                    new TableCell({
                                        children: [new Paragraph({
                                            children: [new TextRun({ text: `${index + 1}` })],
                                            alignment: AlignmentType.CENTER,
                                        })],
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({
                                            children: [new TextRun({ text: s.name })],
                                        })],
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({
                                            children: [new TextRun({ text: s.average, bold: true, color })],
                                            alignment: AlignmentType.CENTER,
                                        })],
                                    }),
                                    new TableCell({
                                        children: [new Paragraph({
                                            children: [new TextRun({ text: rating, bold: true, color })],
                                            alignment: AlignmentType.CENTER,
                                        })],
                                    }),
                                ],
                            });
                        }),
                    ],
                }),

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
        }],
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
