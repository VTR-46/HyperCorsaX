import asyncio
import json
import os
import uuid
from datetime import datetime, timezone


SAMPLE_COLUMNS = (
    "speed", "rpm", "gear", "gas", "brake", "clutch", "fuel", "steer", "drs",
    "tyre_fl_temp", "tyre_fr_temp", "tyre_rl_temp", "tyre_rr_temp",
    "brake_fl_temp", "brake_fr_temp", "brake_rl_temp", "brake_rr_temp", "ers_power",
    "tyre_fl_wear", "tyre_fr_wear", "tyre_rl_wear", "tyre_rr_wear",
    "damage_front", "damage_rear", "damage_left", "damage_right", "damage_general",
    "tyre_fl_pressure", "tyre_fr_pressure", "tyre_rl_pressure", "tyre_rr_pressure",
    "abs_value", "tc_value", "current_time", "last_time", "best_time", "split",
    "completed_laps", "position", "current_sector", "number_of_laps", "status", "session",
)


class MySQLStorage:
    def __init__(self):
        self.enabled = os.getenv("HYPERCORSA_DB_ENABLED", "1").lower() not in {"0", "false", "no"}
        self.queue = asyncio.Queue(maxsize=int(os.getenv("HYPERCORSA_DB_QUEUE", "10000")))
        self.batch_size = int(os.getenv("HYPERCORSA_DB_BATCH", "250"))
        self._connection = None
        self._task = None
        self._session_id = None

    async def start_session(self, metadata=None):
        self._session_id = str(uuid.uuid4())
        if self.enabled:
            await asyncio.to_thread(self._insert_session, metadata or {})
            self._task = asyncio.create_task(self._writer())
        return self._session_id

    async def add_sample(self, sample):
        if self.enabled:
            await self.queue.put(sample)

    async def close_session(self):
        if not self.enabled or not self._task:
            return
        await self.queue.join()
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        await asyncio.to_thread(self._finish_session)
        self._close_connection()

    async def list_sessions(self, limit=50):
        return await asyncio.to_thread(self._list_sessions, limit)

    async def get_samples(self, session_id, limit=5000):
        return await asyncio.to_thread(self._get_samples, session_id, limit)

    async def _writer(self):
        while True:
            first = await self.queue.get()
            batch = [first]
            while len(batch) < self.batch_size:
                try:
                    batch.append(self.queue.get_nowait())
                except asyncio.QueueEmpty:
                    break
            while True:
                try:
                    await asyncio.to_thread(self._insert_samples, batch)
                    break
                except asyncio.CancelledError:
                    raise
                except Exception as error:
                    print(f"Falha ao gravar lote MySQL; tentando novamente: {error}")
                    if self._connection:
                        try:
                            self._connection.rollback()
                        except Exception:
                            pass
                    self._close_connection()
                    await asyncio.sleep(1)
            for _ in batch:
                self.queue.task_done()

    def _connect(self):
        if self._connection and self._connection.is_connected():
            return self._connection
        password = os.getenv("MYSQL_PASSWORD")
        if password is None:
            raise RuntimeError("MYSQL_PASSWORD nao configurada; copie Data/.env.example para Data/.env e preencha a senha")
        try:
            import mysql.connector
        except ImportError as error:
            raise RuntimeError("Instale mysql-connector-python ou defina HYPERCORSA_DB_ENABLED=0") from error
        self._connection = mysql.connector.connect(
            host=os.getenv("MYSQL_HOST", "127.0.0.1"),
            port=int(os.getenv("MYSQL_PORT", "3306")),
            user=os.getenv("MYSQL_USER", "root"),
            password=password,
            database=os.getenv("MYSQL_DATABASE", "hypercorsa"),
        )
        return self._connection

    def _insert_session(self, metadata):
        connection = self._connect()
        cursor = connection.cursor()
        cursor.execute(
            """INSERT INTO telemetry_sessions
            (id, started_at, car, track, mode, metadata_json)
            VALUES (%s, %s, %s, %s, %s, %s)""",
            (self._session_id, datetime.now(timezone.utc), metadata.get("car"),
             metadata.get("track"), metadata.get("mode"), json.dumps(metadata)),
        )
        connection.commit()
        cursor.close()

    def _insert_samples(self, samples):
        connection = self._connect()
        cursor = connection.cursor()
        columns = ", ".join(f"`{column}`" for column in (("session_id", "sample_index", "recorded_at", "elapsed_ms") + SAMPLE_COLUMNS))
        placeholders = ", ".join(["%s"] * (4 + len(SAMPLE_COLUMNS)))
        updates = ", ".join(f"`{column}`=VALUES(`{column}`)" for column in SAMPLE_COLUMNS)
        query = f"INSERT INTO telemetry_samples ({columns}) VALUES ({placeholders}) ON DUPLICATE KEY UPDATE {updates}"
        values = []
        for sample in samples:
            values.append((self._session_id, sample["sample_index"], sample["recorded_at"], sample["elapsed_ms"])
                          + tuple(sample.get(column) for column in SAMPLE_COLUMNS))
        cursor.executemany(query, values)
        connection.commit()
        cursor.close()

    def _finish_session(self):
        connection = self._connect()
        cursor = connection.cursor()
        cursor.execute(
            "UPDATE telemetry_sessions SET ended_at = %s WHERE id = %s",
            (datetime.now(timezone.utc), self._session_id),
        )
        connection.commit()
        cursor.close()

    def _list_sessions(self, limit):
        connection = self._connect()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, started_at, ended_at, car, track, mode FROM telemetry_sessions "
            "ORDER BY started_at DESC LIMIT %s", (min(max(limit, 1), 500),),
        )
        rows = cursor.fetchall()
        cursor.close()
        return rows

    def _get_samples(self, session_id, limit):
        connection = self._connect()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM telemetry_samples WHERE session_id = %s "
            "ORDER BY sample_index LIMIT %s", (session_id, min(max(limit, 1), 1000000)),
        )
        rows = cursor.fetchall()
        cursor.close()
        return downsample(rows, limit)

    def _close_connection(self):
        if self._connection:
            self._connection.close()
            self._connection = None


def downsample(rows, limit):
    """Retorna pontos uniformemente distribuidos sem descartar os extremos."""
    if len(rows) <= limit:
        return rows
    step = (len(rows) - 1) / (limit - 1)
    return [rows[round(index * step)] for index in range(limit)]