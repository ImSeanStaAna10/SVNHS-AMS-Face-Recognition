import api from "./api";

import {
  downloadFile,
  openBlobInNewTab,
} from "../utils/downloadFile";

/* =========================================================
   HELPERS
========================================================= */

const buildParams = (values = {}) => {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => {
      return (
        value !== undefined &&
        value !== null &&
        value !== ""
      );
    })
  );
};

const getContentDispositionFileName = (
  headers,
  fallbackFileName
) => {
  const contentDisposition =
    headers?.["content-disposition"];

  if (!contentDisposition) {
    return fallbackFileName;
  }

  const utf8Match =
    contentDisposition.match(
      /filename\*=UTF-8''([^;]+)/i
    );

  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(
        utf8Match[1].replace(/["']/g, "")
      );
    } catch {
      return utf8Match[1].replace(/["']/g, "");
    }
  }

  const normalMatch =
    contentDisposition.match(
      /filename="?([^";]+)"?/i
    );

  return (
    normalMatch?.[1]?.trim() ||
    fallbackFileName
  );
};

/* =========================================================
   ARCHIVE LIST

   COUNCILOR:
   → all authorized sections

   ADVISER:
   → backend automatically limits to own section
========================================================= */

const getAttendanceReportArchive = async ({
  type,
  sectionId,
  from,
  to,
  page = 0,
  size = 12,
} = {}) => {
  const response = await api.get(
    "/attendance-reports/archive",
    {
      params: buildParams({
        type,
        sectionId,
        from,
        to,
        page,
        size,
      }),
    }
  );

  return response.data;
};

/* =========================================================
   PREVIEW REPORT
========================================================= */

const previewAttendanceReport = async ({
  sectionId,
  type,
  from,
  to,
}) => {
  const response = await api.get(
    "/attendance-reports/preview",
    {
      params: {
        sectionId,
        type,
        from,
        to,
      },
    }
  );

  return response.data;
};

/* =========================================================
   GENERATE / REGENERATE SINGLE REPORT

   COUNCILOR ONLY
========================================================= */

const generateAttendanceReport = async ({
  sectionId,
  type,
  from,
  to,
}) => {
  const response = await api.post(
    "/attendance-reports/generate",
    null,
    {
      params: {
        sectionId,
        type,
        from,
        to,
      },
    }
  );

  return response.data;
};

/* =========================================================
   GENERATE BATCH

   COUNCILOR ONLY
========================================================= */

const generateAttendanceReportBatch = async ({
  type,
  from,
  to,
}) => {
  const response = await api.post(
    "/attendance-reports/generate-batch",
    null,
    {
      params: {
        type,
        from,
        to,
      },
    }
  );

  return response.data;
};

/* =========================================================
   GET PDF BLOB
========================================================= */

const getAttendanceReportPdf = async (
  reportId,
  {
    download = false,
  } = {}
) => {
  const response = await api.get(
    `/attendance-reports/${reportId}/pdf`,
    {
      params: {
        download,
      },

      responseType: "blob",
    }
  );

  return {
    blob: response.data,
    headers: response.headers,
  };
};

/* =========================================================
   VIEW PDF
========================================================= */

const viewAttendanceReportPdf = async (
  reportId
) => {
  const {
    blob,
  } = await getAttendanceReportPdf(
    reportId,
    {
      download: false,
    }
  );

  openBlobInNewTab(
    blob
  );
};

/* =========================================================
   DOWNLOAD PDF
========================================================= */

const downloadAttendanceReportPdf = async ({
  id,
  pdfFileName,
}) => {
  const {
    blob,
    headers,
  } = await getAttendanceReportPdf(
    id,
    {
      download: true,
    }
  );

  const fileName =
    getContentDispositionFileName(
      headers,
      pdfFileName ||
        "attendance-report.pdf"
    );

  downloadFile({
    blob,
    fileName,
  });
};

/* =========================================================
   GET EXCEL BLOB
========================================================= */

const getAttendanceReportExcel = async (
  reportId
) => {
  const response = await api.get(
    `/attendance-reports/${reportId}/excel`,
    {
      responseType: "blob",
    }
  );

  return {
    blob: response.data,
    headers: response.headers,
  };
};

/* =========================================================
   DOWNLOAD EXCEL
========================================================= */

const downloadAttendanceReportExcel = async ({
  id,
  excelFileName,
}) => {
  const {
    blob,
    headers,
  } = await getAttendanceReportExcel(
    id
  );

  const fileName =
    getContentDispositionFileName(
      headers,
      excelFileName ||
        "attendance-report.xlsx"
    );

  downloadFile({
    blob,
    fileName,
  });
};

/* =========================================================
   DOWNLOAD ALL ZIP

   format:
   PDF
   EXCEL
   BOTH
========================================================= */

const downloadAttendanceReportsZip = async ({
  type,
  sectionId,
  from,
  to,
  format = "BOTH",
} = {}) => {
  const response = await api.get(
    "/attendance-reports/archive/download-all",
    {
      params: buildParams({
        type,
        sectionId,
        from,
        to,
        format,
      }),

      responseType: "blob",
    }
  );

  const fallbackFileName =
    `attendance_reports_${format.toLowerCase()}.zip`;

  const fileName =
    getContentDispositionFileName(
      response.headers,
      fallbackFileName
    );

  downloadFile({
    blob: response.data,
    fileName,
  });
};

/* =========================================================
   EXPORT SERVICE
========================================================= */

const attendanceReportService = {
  getAttendanceReportArchive,

  previewAttendanceReport,

  generateAttendanceReport,

  generateAttendanceReportBatch,

  getAttendanceReportPdf,

  viewAttendanceReportPdf,

  downloadAttendanceReportPdf,

  getAttendanceReportExcel,

  downloadAttendanceReportExcel,

  downloadAttendanceReportsZip,
};

export default attendanceReportService;

export {
  getAttendanceReportArchive,
  previewAttendanceReport,
  generateAttendanceReport,
  generateAttendanceReportBatch,
  getAttendanceReportPdf,
  viewAttendanceReportPdf,
  downloadAttendanceReportPdf,
  getAttendanceReportExcel,
  downloadAttendanceReportExcel,
  downloadAttendanceReportsZip,
};