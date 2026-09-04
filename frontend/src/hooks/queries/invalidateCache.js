import queryKeys from "../../lib/query/queryKeys";

/* =========================================================
   TRANSFER CACHE
========================================================= */

export const invalidateTransferCache = async (queryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.adviser.transfers.incoming(),
    }),

    queryClient.invalidateQueries({
      queryKey: queryKeys.adviser.transfers.outgoing(),
    }),

    /*
     * Kapag may transfer na na-approve/reject/cancel,
     * possible maapektuhan din ang student roster.
     */
    queryClient.invalidateQueries({
      queryKey: [...queryKeys.adviser.all, "students"],
    }),
  ]);
};

/* =========================================================
   STUDENT CACHE
========================================================= */

export const invalidateStudentCache = async (
  queryClient,
  { sectionId, studentId } = {},
) => {
  const tasks = [];

  if (sectionId) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.adviser.students(sectionId),
      }),
    );
  }

  if (studentId) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.adviser.student(studentId),
      }),
    );
  }

  await Promise.all(tasks);
};

/* =========================================================
   ATTENDANCE CACHE
========================================================= */

export const invalidateAttendanceCache = async (
  queryClient,
  { sectionId, sessionId } = {},
) => {
  const tasks = [];

  if (sectionId) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.adviser.activeSession(sectionId),
      }),
    );
  }

  if (sessionId) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.adviser.sessionRecords(sessionId),
      }),
    );
  }

  await Promise.all(tasks);
};
