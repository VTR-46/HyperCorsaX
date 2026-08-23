import os
from pathlib import Path

import mysql.connector


ROOT = Path(__file__).resolve().parent
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"'))

connection = mysql.connector.connect(
    host=os.getenv("MYSQL_HOST", "127.0.0.1"),
    port=int(os.getenv("MYSQL_PORT", "3306")),
    user=os.getenv("MYSQL_USER", "root"),
    password=os.getenv("MYSQL_PASSWORD", ""),
)
cursor = connection.cursor()
for statement in (ROOT / "schema.sql").read_text(encoding="utf-8").split(";"):
    statement = statement.strip()
    if statement:
        cursor.execute(statement)
connection.commit()
cursor.execute("USE hypercorsa")
cursor.execute("SHOW TABLES LIKE 'telemetry_sessions'")
sessions = cursor.fetchone() is not None
cursor.execute("SHOW TABLES LIKE 'telemetry_samples'")
samples = cursor.fetchone() is not None
cursor.close()
connection.close()
if not sessions or not samples:
    raise RuntimeError("As tabelas de telemetria nao foram criadas")
print("Banco hypercorsa e tabelas de telemetria: OK")
