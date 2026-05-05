import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireFeature } from '../middleware/featureGate';
import { exportTripCSV, exportTripPDF } from '../controllers/exportController';

const router = Router();

router.use(authenticate);

// GET /api/export/trips/:tripId/csv  → CSV of all expenses (PRO+)
router.get('/trips/:tripId/csv', requireFeature('pdfCsvExport'), exportTripCSV);

// GET /api/export/trips/:tripId/pdf  → PDF report (PRO+)
router.get('/trips/:tripId/pdf', requireFeature('pdfCsvExport'), exportTripPDF);

export default router;
