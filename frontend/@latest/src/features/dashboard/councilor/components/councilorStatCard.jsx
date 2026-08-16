function CouncilorStatCard({
  title,
  value,
  description,
}) {
  return (
    <div className="card h-100">
      <div className="card-body">
        <p className="text-secondary mb-2">
          {title}
        </p>

        <h2 className="fw-bold mb-2">
          {value}
        </h2>

        {description && (
          <small className="text-secondary">
            {description}
          </small>
        )}
      </div>
    </div>
  );
}

export default CouncilorStatCard;