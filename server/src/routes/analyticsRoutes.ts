import { Router } from 'express';
import * as analytics from '../controllers/analyticsController';
import { authenticate, requireFeature } from '../middleware';

const router = Router();

router.use(authenticate);

router.get('/my-expenses', analytics.getUserExpenses);
router.get('/trip/:tripId', analytics.getTripAnalytics);
router.get('/compare', requireFeature('allCharts'), analytics.compareTrips);
router.get('/year-in-review', requireFeature('yearInReview'), analytics.yearInReview);
router.get('/category-trends', requireFeature('advancedAnalytics'), analytics.categoryTrends);

export default router;
