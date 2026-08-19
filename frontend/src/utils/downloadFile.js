export const downloadFile = ({ blob, fileName }) => {
  if (!blob) {
    throw new Error("File content is required.");
  }

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName || "download";

  document.body.appendChild(anchor);

  anchor.click();

  anchor.remove();

  URL.revokeObjectURL(url);
};

export const openBlobInNewTab = (blob) => {
  if (!blob) {
    throw new Error("File content is required.");
  }

  const url = URL.createObjectURL(blob);

  const newTab = window.open(url, "_blank", "noopener,noreferrer");

  if (!newTab) {
    URL.revokeObjectURL(url);

    throw new Error(
      "Unable to open the PDF. Please allow pop-ups for this website.",
    );
  }

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
};
