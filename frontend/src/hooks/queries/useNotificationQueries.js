import { useQuery } from "@tanstack/react-query";

import adviserService from "../../services/adviserService";
import notificationService from "../../services/notificationService";

import cachePolicy from "../../lib/query/cachePolicy";
import queryKeys from "../../lib/query/queryKeys";

/* =========================================================
   NOTIFICATION CACHE POLICY

   Notifications should feel current, but they do not need
   to refetch on every route mount.

   The AdviserTopbar still performs a 60-second active sync,
   while this short stale window prevents unnecessary route /
   focus refetches when the data was fetched very recently.
========================================================= */

const NOTIFICATION_STALE_TIME_MS = 15_000;

const NOTIFICATION_GC_TIME_MS = 10 * 60_000;

/* =========================================================
   ADVISER TOPBAR NOTIFICATION SUMMARY

   Existing service:
   notificationService.getAdviserNotificationSummary({ size })

   The service already fetches:
   - /notifications?page=0&size=...
   - /notifications/unread-count

   TanStack Query now owns deduplication, cache reuse,
   focus/reconnect behavior, and the 60-second refresh cadence
   configured by AdviserTopbar.
========================================================= */

export const useAdviserNotificationSummary = (
  { size = 10 } = {},
  options = {},
) =>
  useQuery({
    queryKey: queryKeys.adviser.notifications.topbar(size),

    queryFn: () =>
      notificationService.getAdviserNotificationSummary({
        size,
      }),

    staleTime: NOTIFICATION_STALE_TIME_MS,

    gcTime: NOTIFICATION_GC_TIME_MS,

    ...options,
  });

/* =========================================================
   INCOMING PENDING TRANSFER COUNT

   Existing service:
   adviserService.getIncomingPendingTransferCount()

   This powers the Adviser sidebar transfer badge. It uses the
   existing transfer cache policy.
========================================================= */

export const useIncomingPendingTransferCount = (options = {}) =>
  useQuery({
    queryKey: queryKeys.adviser.transfers.pendingCount(),

    queryFn: () => adviserService.getIncomingPendingTransferCount(),

    ...cachePolicy.transfers,

    ...options,
  });

export default {
  useAdviserNotificationSummary,
  useIncomingPendingTransferCount,
};
