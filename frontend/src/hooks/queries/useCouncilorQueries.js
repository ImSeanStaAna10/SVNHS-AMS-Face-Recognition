import { useQuery } from "@tanstack/react-query";

import councilorService from "../../services/councilorService";

import cachePolicy from "../../lib/query/cachePolicy";
import queryKeys from "../../lib/query/queryKeys";

const normalizeOverviewParams = ({
  from = "",
  to = "",
  sectionId = "",
  adviserId = "",
  search = "",
  page = 0,
  size = 9,
} = {}) => ({
  from: String(from || ""),
  to: String(to || ""),
  sectionId: String(sectionId || ""),
  adviserId: String(adviserId || ""),
  search: String(search || "").trim(),
  page: Number(page) || 0,
  size: Number(size) || 9,
});

const normalizeSectionReportParams = ({
  from = "",
  to = "",
  search = "",
  page = 0,
  size = 25,
} = {}) => ({
  from: String(from || ""),
  to: String(to || ""),
  search: String(search || "").trim(),
  page: Number(page) || 0,
  size: Number(size) || 25,
});

export const useCouncilorAdvisers = (options = {}) =>
  useQuery({
    queryKey: queryKeys.councilor.advisers(),
    queryFn: () => councilorService.getAdvisers(),
    ...cachePolicy.static,
    ...options,
  });

export const useCouncilorSections = (options = {}) =>
  useQuery({
    queryKey: queryKeys.councilor.sections(),
    queryFn: () => councilorService.getSections(),
    ...cachePolicy.static,
    ...options,
  });

export const useCouncilorAttendanceReport = (params = {}, options = {}) => {
  const normalized = normalizeOverviewParams(params);

  return useQuery({
    queryKey: queryKeys.councilor.attendanceReports.overview(normalized),
    queryFn: ({ signal }) =>
      councilorService.getAttendanceReport({
        ...normalized,
        signal,
      }),
    ...cachePolicy.history,
    enabled: Boolean(normalized.from && normalized.to),
    ...options,
  });
};

export const useCouncilorSectionAttendanceReport = (
  sectionId,
  params = {},
  options = {},
) => {
  const normalized = normalizeSectionReportParams(params);

  return useQuery({
    queryKey: queryKeys.councilor.attendanceReports.section(
      sectionId,
      normalized,
    ),
    queryFn: ({ signal }) =>
      councilorService.getSectionAttendanceReport(sectionId, {
        ...normalized,
        signal,
      }),
    ...cachePolicy.history,
    enabled: Boolean(sectionId && normalized.from && normalized.to),
    ...options,
  });
};

export default {
  useCouncilorAdvisers,
  useCouncilorSections,
  useCouncilorAttendanceReport,
  useCouncilorSectionAttendanceReport,
};
