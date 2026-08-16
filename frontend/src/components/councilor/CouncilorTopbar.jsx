import authService from "../../services/authService";

function CouncilorTopbar() {
  const user = authService.getUser();

  return (
    <header className="councilor-topbar">
      <div>
        <span className="councilor-topbar-eyebrow">
          SCHOOL ADMINISTRATION
        </span>

        <h2>Councilor Dashboard</h2>
      </div>

      <div className="councilor-profile">
        <div className="councilor-profile-avatar">
          {user?.name?.charAt(0)?.toUpperCase() || "C"}
        </div>

        <div className="councilor-profile-info">
          <strong>{user?.name || "Councilor"}</strong>
          <span>{user?.email || ""}</span>
        </div>
      </div>
    </header>
  );
}

export default CouncilorTopbar;