import { Router } from 'express';
import * as analytics from '../controllers/analyticsController';
import { authenticate, requireFeature } from '../middleware';

const router = Router();

router.use(authenticate);

router.get('/my-expenses', analytics.getUserExpenses);
router.get('/trip/:tripId', analytics.getTripAnalytics);
router.get('/trips-overview', analytics.getTripsOverview);
router.get('/groups-overview', analytics.getGroupsOverview);
router.get('/compare', requireFeature('allCharts'), analytics.compareTrips);
router.get('/year-in-review', requireFeature('yearInReview'), analytics.yearInReview);
router.get('/category-trends', requireFeature('advancedAnalytics'), analytics.categoryTrends);
router.get('/personal', analytics.getPersonalAnalytics);
router.get('/group/:groupId', analytics.getGroupAnalytics);

export default router;
