import queryKeys from "../../lib/query/queryKeys";

export const invalidateCouncilorAdviserCache = async (queryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.councilor.advisers(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.councilor.sections(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.councilor.attendanceReports.all(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.attendanceReports.archives("COUNCILOR"),
    }),
  ]);
};

export const invalidateCouncilorSectionCache = async (queryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.councilor.sections(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.councilor.attendanceReports.all(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.attendanceReports.archives("COUNCILOR"),
    }),
  ]);
};

export const invalidateCouncilorAttendanceCache = async (queryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.councilor.attendanceReports.all(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.attendanceReports.archives("COUNCILOR"),
    }),
  ]);
};

export default {
  invalidateCouncilorAdviserCache,
  invalidateCouncilorSectionCache,
  invalidateCouncilorAttendanceCache,
};
