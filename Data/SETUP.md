# Persistencia de telemetria

1. Instale o MySQL Server localmente.
2. Instale as dependencias Python:

```powershell
pip install -r Data\requirements.txt
```

3. Crie o banco e as tabelas:

```powershell
Get-Content Data\schema.sql | mysql -u root -p
```

Alternativamente, depois de configurar `Data\.env`, execute:

```powershell
python Data\init_database.py
```

Esse comando cria o banco, cria as tabelas e confirma se `telemetry_sessions` e `telemetry_samples` existem.

Alternativa no Windows PowerShell:

```powershell
cmd /c "mysql -u root -p < Data\schema.sql"
```

Se `mysql` nao estiver no `PATH`, use o caminho completo da instalacao padrao:

```powershell
Get-Content Data\schema.sql | & 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe' -u root -p
```

4. Copie `Data\.env.example` para `Data\.env` e preencha a senha. O bridge carrega esse arquivo automaticamente; ele nao deve ser versionado.
5. Execute `tl.bat` e abra `http://localhost:8080/graphics.html`.

Se o usuario MySQL nao tiver senha, mantenha `MYSQL_PASSWORD=` no arquivo `.env`. Se a senha nao for definida, o bridge informa a configuracao ausente e continua o modo live sem persistencia.

## API local

- `GET /api/health`
- `GET /api/sessions`
- `GET /api/sessions/{id}/samples?limit=5000`
- `GET /api/compare?left={id}&right={id}&limit=5000`

O bridge grava os frames recebidos em lotes. A API reduz uniformemente as series longas para proteger o navegador. Se o MySQL estiver indisponivel, o live continua, mas o historico retorna erro `503`.
