function ReportPagination({
  page = 0,
  totalPages = 0,
  totalElements = 0,
  size = 12,
  onPageChange,
  loading = false,
}) {
  /* =========================================================
     HIDE PAGINATION

     Walang point ipakita kapag:
     - walang reports
     - one page lang
  ========================================================= */

  if (totalElements === 0 || totalPages <= 1) {
    return null;
  }

  /* =========================================================
     DISPLAY RANGE

     Example:
     Showing 13–24 of 50 reports
  ========================================================= */

  const start = page * size + 1;

  const end = Math.min((page + 1) * size, totalElements);

  /* =========================================================
     VISIBLE PAGE BUTTONS

     Shows around the current page:

     1 2 3
     2 3 4 5 6
     ...
  ========================================================= */

  const visiblePages = [];

  const firstVisible = Math.max(0, page - 2);

  const lastVisible = Math.min(totalPages - 1, page + 2);

  for (
    let currentPage = firstVisible;
    currentPage <= lastVisible;
    currentPage += 1
  ) {
    visiblePages.push(currentPage);
  }

  /* =========================================================
     CHANGE PAGE
  ========================================================= */

  const handlePageChange = (nextPage) => {
    if (loading) {
      return;
    }

    if (nextPage < 0 || nextPage >= totalPages) {
      return;
    }

    if (nextPage === page) {
      return;
    }

    onPageChange?.(nextPage);
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="attendance-records-pagination">
      {/* =====================================================
          RESULT INFORMATION
      ===================================================== */}

      <span className="attendance-records-pagination-info">
        Showing {start}–{end} of {totalElements}{" "}
        {totalElements === 1 ? "report" : "reports"}
      </span>

      {/* =====================================================
          CONTROLS
      ===================================================== */}

      <div className="attendance-records-pagination-controls">
        {/* PREVIOUS */}

        <button
          type="button"
          onClick={() => handlePageChange(page - 1)}
          disabled={loading || page <= 0}
          aria-label="Previous page"
        >
          Previous
        </button>

        {/* FIRST PAGE */}

        {firstVisible > 0 && (
          <>
            <button
              type="button"
              onClick={() => handlePageChange(0)}
              disabled={loading}
              className={page === 0 ? "active" : ""}
              aria-current={page === 0 ? "page" : undefined}
            >
              1
            </button>

            {firstVisible > 1 && (
              <span
                className="attendance-records-pagination-ellipsis"
                aria-hidden="true"
              >
                …
              </span>
            )}
          </>
        )}

        {/* VISIBLE PAGES */}

        {visiblePages.map((pageNumber) => {
          const active = pageNumber === page;

          return (
            <button
              type="button"
              key={pageNumber}
              className={active ? "active" : ""}
              onClick={() => handlePageChange(pageNumber)}
              disabled={loading}
              aria-current={active ? "page" : undefined}
              aria-label={`Page ${pageNumber + 1}`}
            >
              {pageNumber + 1}
            </button>
          );
        })}

        {/* LAST PAGE */}

        {lastVisible < totalPages - 1 && (
          <>
            {lastVisible < totalPages - 2 && (
              <span
                className="attendance-records-pagination-ellipsis"
                aria-hidden="true"
              >
                …
              </span>
            )}

            <button
              type="button"
              onClick={() => handlePageChange(totalPages - 1)}
              disabled={loading}
              className={page === totalPages - 1 ? "active" : ""}
              aria-current={page === totalPages - 1 ? "page" : undefined}
            >
              {totalPages}
            </button>
          </>
        )}

        {/* NEXT */}

        <button
          type="button"
          onClick={() => handlePageChange(page + 1)}
          disabled={loading || page >= totalPages - 1}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default ReportPagination;
