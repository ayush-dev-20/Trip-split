import { Router } from 'express';
import * as ai from '../controllers/aiController';
import { authenticate, requireFeature, aiLimiter } from '../middleware';

const router = Router();

router.use(authenticate);
router.use(aiLimiter);

router.post('/scan-receipt', requireFeature('aiReceiptScanner'), ai.uploadReceiptMiddleware, ai.scanReceipt);
router.post('/categorize', requireFeature('aiCategorizer'), ai.categorizeExpense);
router.post('/budget-advisor', requireFeature('aiBudgetAdvisor'), ai.budgetAdvisor);
router.post('/spending-insights/:tripId', requireFeature('aiSpendingInsights'), ai.spendingInsights);
router.post('/trip-planner', requireFeature('aiTripPlanner'), ai.tripPlanner);
router.post('/trip-planner/stream', requireFeature('aiTripPlanner'), ai.tripPlannerStream);
router.post('/trip-planner-for-trip', requireFeature('aiTripPlanner'), ai.tripPlannerForTrip);
router.post('/trip-planner-for-trip/stream', requireFeature('aiTripPlanner'), ai.tripPlannerForTripStream);
router.post('/parse-expense', requireFeature('aiNaturalLanguage'), ai.parseNaturalLanguage);
router.post('/chat', requireFeature('aiChatbot'), ai.chatbot);
router.post('/predict-cost', requireFeature('aiAnomalyDetection'), ai.predictCost);
router.post('/detect-anomaly', requireFeature('aiAnomalyDetection'), ai.detectAnomaly);

export default router;
