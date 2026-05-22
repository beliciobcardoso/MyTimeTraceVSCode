## ADDED Requirements

### Requirement: Propriedade dbPath e método getDbPath no DatabaseManager
O `DatabaseManager` SHALL declarar `private dbPath: string = ''` e atribuir `this.dbPath = path.join(storagePath, 'time_tracker.sqlite')` no início de `initialize()`, antes de abrir o banco. SHALL expor `getDbPath(): string { return this.dbPath; }` como método público. O `close()` não SHALL modificar `this.dbPath` — apenas zera `this.db`.

#### Scenario: BackupManager obtém path do banco
- **WHEN** `databaseManager.getDbPath()` é chamado pelo `BackupManager`
- **THEN** o path absoluto do `time_tracker.sqlite` é retornado corretamente

#### Scenario: getDbPath após close
- **WHEN** `databaseManager.close()` é chamado seguido de `databaseManager.getDbPath()`
- **THEN** o path ainda é retornado corretamente (o `close()` não zera `dbPath`)
