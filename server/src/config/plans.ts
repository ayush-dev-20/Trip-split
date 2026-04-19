import { SubscriptionTier } from '@prisma/client';

/**
 * Feature gates per subscription tier.
 * Controls what each tier can access.
 */
export const PLAN_LIMITS: Record<
  SubscriptionTier,
  {
    maxActiveTrips: number;
    maxMembersPerTrip: number;
    multiCurrency: boolean;
    allCharts: boolean;
    aiReceiptScanner: boolean;
    aiCategorizer: boolean;
    aiBudgetAdvisor: boolean;
    aiSpendingInsights: boolean;
    aiTripPlanner: boolean;
    aiChatbot: boolean;
    aiNaturalLanguage: boolean;
    aiAnomalyDetection: boolean;
    pdfCsvExport: boolean;
    customReportBuilder: boolean;
    yearInReview: boolean;
    groupChat: boolean;
    tripPolls: boolean;
    tripFeed: boolean;
    tripNotes: boolean;
    apiAccess: boolean;
    auditLogs: boolean;
    customBranding: boolean;
    prioritySupport: boolean;
    advancedAnalytics: boolean;
  }
> = {
  FREE: {
    maxActiveTrips: 2,
    maxMembersPerTrip: 5,
    multiCurrency: false,
    allCharts: false,
    aiReceiptScanner: true,
    aiCategorizer: true,
    aiBudgetAdvisor: true,
    aiSpendingInsights: true,
    aiTripPlanner: true,
    aiChatbot: true,
    aiNaturalLanguage: true,
    aiAnomalyDetection: true,
    pdfCsvExport: false,
    customReportBuilder: false,
    yearInReview: false,
    groupChat: true,
    tripPolls: true,
    tripFeed: true,
    tripNotes: true,
    apiAccess: false,
    auditLogs: false,
    customBranding: false,
    prioritySupport: false,
    advancedAnalytics: false,
  },
  PRO: {
    maxActiveTrips: Infinity,
    maxMembersPerTrip: Infinity,
    multiCurrency: true,
    allCharts: true,
    aiReceiptScanner: true,
    aiCategorizer: true,
    aiBudgetAdvisor: false,
    aiSpendingInsights: false,
    aiTripPlanner: false,
    aiChatbot: false,
    aiNaturalLanguage: true,
    aiAnomalyDetection: true,
    pdfCsvExport: true,
    customReportBuilder: false,
    yearInReview: true,
    groupChat: true,
    tripPolls: true,
    tripFeed: true,
    tripNotes: true,
    apiAccess: false,
    auditLogs: false,
    customBranding: false,
    prioritySupport: true,
    advancedAnalytics: true,
  },
  TEAM: {
    maxActiveTrips: Infinity,
    maxMembersPerTrip: Infinity,
    multiCurrency: true,
    allCharts: true,
    aiReceiptScanner: true,
    aiCategorizer: true,
    aiBudgetAdvisor: true,
    aiSpendingInsights: true,
    aiTripPlanner: true,
    aiChatbot: true,
    aiNaturalLanguage: true,
    aiAnomalyDetection: true,
    pdfCsvExport: true,
    customReportBuilder: true,
    yearInReview: true,
    groupChat: true,
    tripPolls: true,
    tripFeed: true,
    tripNotes: true,
    apiAccess: true,
    auditLogs: true,
    customBranding: true,
    prioritySupport: true,
    advancedAnalytics: true,
  },
};

export const SUBSCRIPTION_PRICES = {
  PRO: { monthly: 7.99, currency: 'usd' },
  TEAM: { monthly: 19.99, currency: 'usd' },
};
