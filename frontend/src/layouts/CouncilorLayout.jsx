import CouncilorSidebar from "../components/councilor/CouncilorSidebar";
import CouncilorTopbar from "../components/councilor/CouncilorTopbar";
import "../styles/councilor.css";

function CouncilorLayout({ children }) {
  return (
    <div className="councilor-layout">
      <CouncilorSidebar />

      <div className="councilor-main">
        <CouncilorTopbar />

        <main className="councilor-content">{children}</main>
      </div>
    </div>
  );
}

export default CouncilorLayout;
