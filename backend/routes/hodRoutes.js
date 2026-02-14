const express = require('express');
const router = express.Router();
const {
    getAnalytics,
    exportPDF,
    exportExcel,
    exportWord,
} = require('../controllers/hodController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/analytics', protect, authorize('hod'), getAnalytics);
router.get('/export/pdf', protect, authorize('hod'), exportPDF);
router.get('/export/excel', protect, authorize('hod'), exportExcel);
router.get('/export/word', protect, authorize('hod'), exportWord);

module.exports = router;
