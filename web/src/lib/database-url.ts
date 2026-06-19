function stripPythonDriver(url: string) {
  return url
    .replace("postgresql+psycopg2://", "postgresql://")
    .replace("postgresql+psycopg://", "postgresql://")
    .replace("postgres+psycopg://", "postgres://");
}

export function getAuthDatabaseUrl() {
  const raw =
    process.env.BETTER_AUTH_DATABASE_URL ||
    process.env.POSTGRESQL_URL ||
    process.env.DATABASE_URL ||
    "";

  return stripPythonDriver(raw.trim());
}
