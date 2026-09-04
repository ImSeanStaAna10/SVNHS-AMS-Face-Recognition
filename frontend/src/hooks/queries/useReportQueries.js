import { useQuery } from "@tanstack/react-query";

import attendanceReportService from "../../services/attendanceReportService";

import cachePolicy from "../../lib/query/cachePolicy";
import queryKeys from "../../lib/query/queryKeys";

/* =========================================================
   ATTENDANCE REPORT ARCHIVE

   Shared by:
   - ADVISER
   - COUNCILOR

   Generated report metadata is archive/history-style data,
   so cachePolicy.history is used.

   PDF / Excel / ZIP actions remain direct service actions and
   are intentionally not cached here.
========================================================= */

export const useAttendanceReportArchive = (
  {
    role = "",
    type = "",
    sectionId = "",
    from = "",
    to = "",
    page = 0,
    size = 12,
  } = {},
  options = {},
) => {
  const normalizedRole = String(role || "")
    .trim()
    .toUpperCase();

  const isCouncilor = normalizedRole === "COUNCILOR";

  const params = {
    role: normalizedRole,

    type: type || "",

    sectionId: isCouncilor ? sectionId || "" : "",

    from: from || "",

    to: to || "",

    page: Number(page) || 0,

    size: Number(size) || 12,
  };

  return useQuery({
    queryKey: queryKeys.attendanceReports.archive(params),

    queryFn: () =>
      attendanceReportService.getAttendanceReportArchive({
        type: params.type,

        sectionId: isCouncilor ? params.sectionId : undefined,

        from: params.from,

        to: params.to,

        page: params.page,

        size: params.size,
      }),

    ...cachePolicy.history,

    enabled: Boolean(normalizedRole),

    ...options,
  });
};

export default {
  useAttendanceReportArchive,
};
