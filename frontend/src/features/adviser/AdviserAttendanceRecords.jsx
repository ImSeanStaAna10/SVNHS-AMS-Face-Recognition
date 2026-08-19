import AdviserLayout from "../../layouts/AdviserLayout";

import AttendanceRecords from "../attendance-records/AttendanceRecords";

/* =========================================================
   COMPONENT
========================================================= */

function AdviserAttendanceRecords() {
  return (
    <AdviserLayout
      title="Attendance Records"
      eyebrow="REPORT ARCHIVE"
      description="Weekly and monthly attendance reports for your assigned section"
    >
      <AttendanceRecords
        role="ADVISER"
      />
    </AdviserLayout>
  );
}

export default AdviserAttendanceRecords;