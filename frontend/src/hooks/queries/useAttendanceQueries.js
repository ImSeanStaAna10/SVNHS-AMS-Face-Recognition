import { useQuery } from "@tanstack/react-query";

import adviserService from "../../services/adviserService";

import cachePolicy from "../../lib/query/cachePolicy";
import queryKeys from "../../lib/query/queryKeys";

/* =========================================================
   ACTIVE ATTENDANCE SESSION

   Current service:
   adviserService.getActiveSession(sectionId)

   This is live operational data, so we intentionally use
   the "live" cache policy. It can still be shared/deduped,
   but it is allowed to refresh when needed.
========================================================= */

export const useActiveAttendanceSession = (
  sectionId,
  options = {},
) =>
  useQuery({
    queryKey:
      queryKeys.adviser.activeSession(
        sectionId,
      ),

    queryFn: () =>
      adviserService.getActiveSession(
        sectionId,
      ),

    ...cachePolicy.live,

    enabled: Boolean(sectionId),

    ...options,
  });

/* =========================================================
   LIVE ATTENDANCE SESSION RECORDS

   Current service:
   adviserService.getSessionRecords(sessionId)

   This hook is for ACTIVE / LIVE attendance data.
========================================================= */

export const useAttendanceSessionRecords = (
  sessionId,
  options = {},
) =>
  useQuery({
    queryKey:
      queryKeys.adviser.sessionRecords(
        sessionId,
      ),

    queryFn: () =>
      adviserService.getSessionRecords(
        sessionId,
      ),

    ...cachePolicy.live,

    enabled: Boolean(sessionId),

    ...options,
  });

/* =========================================================
   ATTENDANCE HISTORY LIST

   Current service:
   adviserService.getAttendanceHistory({
     fromDate,
     toDate,
     page,
     size,
   })

   Completed history is relatively stable, so it uses the
   history cache policy instead of the live policy.
========================================================= */

export const useAttendanceHistory = (
  {
    fromDate = "",
    toDate = "",
    page = 0,
    size = 8,
  } = {},
  options = {},
) => {
  const params = {
    fromDate,
    toDate,
    page,
    size,
  };

  return useQuery({
    queryKey:
      queryKeys.adviser.attendanceHistory.list(
        params,
      ),

    queryFn: () =>
      adviserService.getAttendanceHistory(
        params,
      ),

    ...cachePolicy.history,

    enabled: Boolean(
      fromDate &&
        toDate,
    ),

    ...options,
  });
};

/* =========================================================
   HISTORICAL ATTENDANCE SESSION RECORDS

   Current service:
   adviserService.getSessionRecords(sessionId)

   This deliberately uses a DIFFERENT query key from the
   live session-record hook above.

   Reason:
   - live session records should stay fresh
   - completed historical records are stable and cacheable
========================================================= */

export const useHistoricalAttendanceSessionRecords = (
  sessionId,
  options = {},
) =>
  useQuery({
    queryKey:
      queryKeys.adviser.attendanceHistory.sessionRecords(
        sessionId,
      ),

    queryFn: () =>
      adviserService.getSessionRecords(
        sessionId,
      ),

    ...cachePolicy.history,

    enabled: Boolean(sessionId),

    ...options,
  });

export default {
  useActiveAttendanceSession,
  useAttendanceSessionRecords,
  useAttendanceHistory,
  useHistoricalAttendanceSessionRecords,
};
