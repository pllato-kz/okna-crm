-- schema.sql — реляционная схема ОКНА CRM для Cloudflare D1 (SQLite)
-- Слой 1 плана BACKEND_PLAN.md. Только структура; данные — в seed.sql (Слой 5).
--
-- Принципы (клиент-независимость):
--   * Никаких строк конкретного клиента в DDL. Название компании, стадии,
--     источники, типы — это ДАННЫЕ (строки таблиц), а не значения в коде.
--   * Все справочники вынесены в отдельные таблицы со своими PK.
--   * Схема накатывается на любую новую базу одной командой.
--
-- Соглашения:
--   * PK справочников — короткие текстовые коды ('lead', 'g1', 'mosquito'),
--     совпадают с кодами из data.js — это упрощает миграцию и сидинг.
--   * PK сущностей — TEXT (как uid() во фронте: 'cl1', 'd1', 'u_isk').
--   * Деньги/ставки — INTEGER (сом, без копеек). Остатки — REAL (бывают дробные).
--   * Даты/время — TEXT в ISO-8601 (как во фронте). created_at по умолчанию — now.
--   * Внешние ключи включены; справочники определены до ссылающихся таблиц.

PRAGMA foreign_keys = ON;

-- ============================================================
-- СПРАВОЧНИКИ (каталоги)
-- ============================================================

-- Роли сотрудников (director / manager / surveyor / production / warehouse)
CREATE TABLE roles (
  id    TEXT PRIMARY KEY,        -- 'director', 'manager', ...
  name  TEXT NOT NULL,           -- человекочитаемое название роли
  sort  INTEGER NOT NULL DEFAULT 0
);

-- Модули интерфейса (для матрицы прав доступа)
CREATE TABLE modules (
  id    TEXT PRIMARY KEY,        -- 'dashboard', 'funnel', 'measure', ...
  name  TEXT NOT NULL,
  sort  INTEGER NOT NULL DEFAULT 0
);

-- Матрица прав: какая роль видит какой модуль (бывш. MODULE_ROLES в data.js)
CREATE TABLE module_roles (
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  role_id   TEXT NOT NULL REFERENCES roles(id)   ON DELETE CASCADE,
  PRIMARY KEY (module_id, role_id)
);

-- Типы клиентов (Физ. лицо / Юр. лицо)
CREATE TABLE client_types (
  id   TEXT PRIMARY KEY,         -- 'individual', 'company'
  name TEXT NOT NULL
);

-- Источники лидов (Instagram, 2GIS, Сайт, Рекомендация, Билборд, Звонок)
CREATE TABLE lead_sources (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

-- Стадии воронки сделки (STAGES): lead → measure → ... → done
CREATE TABLE deal_stages (
  id    TEXT PRIMARY KEY,        -- 'lead', 'measure', 'calc', ...
  name  TEXT NOT NULL,
  color TEXT,                    -- HEX-цвет для UI
  sort  INTEGER NOT NULL DEFAULT 0,
  lost  INTEGER NOT NULL DEFAULT 0  -- 1 = стадия-проигрыш (закрытая, не активная)
);

-- Этапы цеха (PROD_STAGES): queue → cutting → glass → assembly → ready → installing
CREATE TABLE prod_stages (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  color TEXT,
  sort  INTEGER NOT NULL DEFAULT 0
);

-- Типы профиля (ПВХ / Алюминий)
CREATE TABLE material_types (
  id   TEXT PRIMARY KEY,         -- 'pvc', 'aluminum'
  name TEXT NOT NULL
);

-- Серии профиля (Эконом / Средняя / Премиум)
CREATE TABLE material_series (
  id   TEXT PRIMARY KEY,         -- 'economy', 'medium', 'premium'
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

-- Типы стеклопакетов (GLASS) со ставкой за м²
CREATE TABLE glass_types (
  id   TEXT PRIMARY KEY,         -- 'g1', 'g2', 'g3'
  name TEXT NOT NULL,
  rate INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);

-- Типы открывания (OPENINGS) со ставкой за створку
CREATE TABLE openings (
  id   TEXT PRIMARY KEY,         -- 'deaf', 'turn', 'tilt'
  name TEXT NOT NULL,
  rate INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);

-- Доп. опции конструкции (EXTRAS). per: способ расчёта длины при ценообразовании
CREATE TABLE extras (
  id    TEXT PRIMARY KEY,        -- 'mosquito', 'sill', 'ebb', 'slopes', 'mount', 'demount'
  name  TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  per   TEXT NOT NULL DEFAULT 'шт'   -- 'шт' | 'м' | 'периметр'
        CHECK (per IN ('шт','м','периметр')),
  sort  INTEGER NOT NULL DEFAULT 0
);

-- Типы платежей (Аванс / Доплата)
CREATE TABLE payment_types (
  id   TEXT PRIMARY KEY,         -- 'advance', 'surcharge'
  name TEXT NOT NULL
);

-- Статусы кредиторки (ожидает / просрочено / оплачено)
CREATE TABLE payable_statuses (
  id   TEXT PRIMARY KEY,         -- 'await', 'overdue', 'paid'
  name TEXT NOT NULL
);

-- Типы событий ленты (money / measure / funnel / prod / lead / wh)
CREATE TABLE activity_kinds (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- ============================================================
-- КОМПАНИЯ И СОТРУДНИКИ
-- ============================================================

-- Профиль компании. Одна строка (id='main'); хранится как данные, не в коде.
CREATE TABLE company (
  id            TEXT PRIMARY KEY DEFAULT 'main',
  name          TEXT NOT NULL,
  legal         TEXT,
  city          TEXT,
  phone         TEXT,
  workshop      TEXT,
  revenue_year  TEXT,
  doc_settings  TEXT                                -- JSON: реквизиты и шаблон договора для счетов/договоров
);

-- Сотрудники = пользователи системы. Реальная авторизация: email + хэш пароля.
CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,        -- логин
  password_hash  TEXT,                        -- хэш пароля (НЕ открытый текст); задаётся на Слое 3
  role_id        TEXT NOT NULL REFERENCES roles(id),
  title          TEXT,                        -- должность ('Директор', 'Замерщик', ...)
  is_primary     INTEGER NOT NULL DEFAULT 0,  -- 0/1 — показывать как демо-аккаунт
  is_active      INTEGER NOT NULL DEFAULT 1,  -- 0/1
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_users_role ON users(role_id);

-- ============================================================
-- КЛИЕНТЫ
-- ============================================================

CREATE TABLE clients (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT,
  address     TEXT,
  type_id     TEXT REFERENCES client_types(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_clients_type ON clients(type_id);

-- ============================================================
-- СКЛАД
-- ============================================================

-- Профиль (материалы) со ставкой, остатком и минимумом
CREATE TABLE materials (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type_id    TEXT REFERENCES material_types(id),
  series_id  TEXT REFERENCES material_series(id),
  rate       INTEGER NOT NULL DEFAULT 0,   -- продажная цена за единицу (за пог.м / м²)
  cost       INTEGER NOT NULL DEFAULT 0,   -- закупочная (себестоимость) за пог.м
  bar_len    REAL    NOT NULL DEFAULT 6,   -- длина хлыста, м (6 / 6.5 …) — для пересчёта
  stock      REAL    NOT NULL DEFAULT 0,   -- текущий остаток
  min_stock  REAL    NOT NULL DEFAULT 0,   -- минимум (ниже — дозаказ)
  unit       TEXT,                         -- 'пог.м', ...
  supplier   TEXT
);
CREATE INDEX idx_materials_type   ON materials(type_id);
CREATE INDEX idx_materials_series ON materials(series_id);

-- Комплектующие (стеклопакеты, фурнитура, сетки, подоконники, отливы)
CREATE TABLE components (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  stock      REAL NOT NULL DEFAULT 0,
  min_stock  REAL NOT NULL DEFAULT 0,
  unit       TEXT
);

-- Движения склада: журнал прихода и расхода (приход поставки, списание в
-- производство, брак, возврат поставщику, корректировка). qty всегда > 0,
-- направление — в поле dir. balance_after — остаток после операции (для аудита).
CREATE TABLE warehouse_movements (
  id             TEXT PRIMARY KEY,
  kind           TEXT NOT NULL,            -- 'mat' | 'comp'
  item_id        TEXT NOT NULL,            -- materials.id | components.id
  name           TEXT,                     -- снимок названия на момент операции
  unit           TEXT,
  dir            TEXT NOT NULL,            -- 'in' | 'out'
  type           TEXT,                     -- receipt | production | writeoff | return | adjust
  qty            REAL NOT NULL DEFAULT 0,  -- всегда положительное
  reason         TEXT,                     -- причина/комментарий (для расхода)
  balance_after  REAL,                     -- остаток после операции
  deal_id        TEXT,                     -- если списание под сделку (опц.)
  user_id        TEXT REFERENCES users(id),
  at             TEXT,                     -- когда (ISO)
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_wh_mov_item ON warehouse_movements(item_id);
CREATE INDEX idx_wh_mov_at   ON warehouse_movements(at);

-- Задачи и напоминания по сделкам (follow-up)
CREATE TABLE tasks (
  id           TEXT PRIMARY KEY,
  deal_id      TEXT REFERENCES deals(id),
  title        TEXT NOT NULL,
  due          TEXT,                          -- срок (ISO)
  assignee_id  TEXT REFERENCES users(id),
  done         INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tasks_deal ON tasks(deal_id);
CREATE INDEX idx_tasks_due  ON tasks(due);

-- ============================================================
-- СДЕЛКИ
-- ============================================================

CREATE TABLE deals (
  id             TEXT PRIMARY KEY,
  client_id      TEXT NOT NULL REFERENCES clients(id),
  stage_id       TEXT NOT NULL REFERENCES deal_stages(id),
  manager_id     TEXT REFERENCES users(id),
  source_id      TEXT REFERENCES lead_sources(id),
  prod_stage_id  TEXT REFERENCES prod_stages(id),   -- NULL пока не в производстве
  sum            INTEGER NOT NULL DEFAULT 0,        -- зафиксированная сумма заказа
  note           TEXT,
  hot            INTEGER NOT NULL DEFAULT 0,         -- 0/1 «горящий» лид
  discount       REAL    NOT NULL DEFAULT 0,         -- скидка, % (0..30)
  prepay_pct     INTEGER NOT NULL DEFAULT 30,        -- предоплата, %
  -- флаги списания со склада по этапам (бывш. d.consumed)
  consumed_profile   INTEGER NOT NULL DEFAULT 0,
  consumed_glass     INTEGER NOT NULL DEFAULT 0,
  consumed_fittings  INTEGER NOT NULL DEFAULT 0,
  ready_date     TEXT,                              -- плановая готовность (производство)
  install_date   TEXT,                              -- плановый монтаж
  contract_no    TEXT,                              -- номер договора подряда
  contract_date  TEXT,                              -- дата договора
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  stage_since    TEXT                                -- когда зашла в текущую стадию
);
CREATE INDEX idx_deals_client     ON deals(client_id);
CREATE INDEX idx_deals_stage      ON deals(stage_id);
CREATE INDEX idx_deals_manager    ON deals(manager_id);
CREATE INDEX idx_deals_prod_stage ON deals(prod_stage_id);

-- Конструкции (позиции) сделки — то, что собирается на замере
CREATE TABLE deal_items (
  id          TEXT PRIMARY KEY,
  deal_id     TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  profile_id  TEXT REFERENCES materials(id),
  glass_id    TEXT REFERENCES glass_types(id),
  opening_id  TEXT REFERENCES openings(id),
  w           INTEGER NOT NULL DEFAULT 0,    -- ширина, мм
  h           INTEGER NOT NULL DEFAULT 0,    -- высота, мм
  sashes      INTEGER NOT NULL DEFAULT 1,    -- створок
  sashes_json TEXT,                          -- настройка каждой створки: [{open,dir,active}]
  price_override INTEGER,                     -- ручная цена за шт (NULL = авторасчёт)
  qty         INTEGER NOT NULL DEFAULT 1,    -- количество, шт
  sort        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_deal_items_deal ON deal_items(deal_id);

-- Доп. опции конструкции (многие-ко-многим: позиция ↔ опция)
CREATE TABLE deal_item_extras (
  item_id   TEXT NOT NULL REFERENCES deal_items(id) ON DELETE CASCADE,
  extra_id  TEXT NOT NULL REFERENCES extras(id),
  PRIMARY KEY (item_id, extra_id)
);

-- Оплаты по сделке (Аванс / Доплата)
CREATE TABLE payments (
  id          TEXT PRIMARY KEY,
  deal_id     TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  type_id     TEXT REFERENCES payment_types(id),
  amount      INTEGER NOT NULL DEFAULT 0,
  date        TEXT,                          -- дата платежа (ISO)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_payments_deal ON payments(deal_id);

-- ============================================================
-- ФИНАНСЫ И ЛЕНТА
-- ============================================================

-- Кредиторка: что компания должна поставщикам
CREATE TABLE payables (
  id          TEXT PRIMARY KEY,
  supplier    TEXT NOT NULL,
  for_what    TEXT,
  amount      INTEGER NOT NULL DEFAULT 0,
  due         TEXT,                          -- срок оплаты (ISO)
  status_id   TEXT REFERENCES payable_statuses(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_payables_status ON payables(status_id);

-- Лента событий (кто что сделал)
CREATE TABLE activity (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id),
  text        TEXT NOT NULL,
  kind_id     TEXT REFERENCES activity_kinds(id),
  at          TEXT,                          -- когда (ISO)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_activity_at   ON activity(at);
CREATE INDEX idx_activity_user ON activity(user_id);

-- ============================================================
-- ИНТЕГРАЦИИ
-- ============================================================

-- Защита входа от перебора: неудачные попытки по IP/email (окно 15 минут).
CREATE TABLE login_attempts (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  ip    TEXT,
  email TEXT,
  at    TEXT NOT NULL
);

-- Атомарные счётчики (нумерация документов). name напр. 'contract-2026'.
-- Инкремент через INSERT .. ON CONFLICT DO UPDATE .. RETURNING — без гонок.
CREATE TABLE counters (
  name TEXT PRIMARY KEY,
  val  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_login_attempts_at ON login_attempts(at);

-- Настройки WhatsApp-интеграции через Green API. Одна строка (id='main').
-- api_token — секрет: хранится только на сервере, наружу (в bootstrap) НЕ отдаётся.
CREATE TABLE wa_config (
  id             TEXT PRIMARY KEY DEFAULT 'main',
  id_instance    TEXT,                          -- idInstance Green API
  api_token      TEXT,                          -- apiTokenInstance (секрет)
  enabled        INTEGER NOT NULL DEFAULT 0,     -- 0/1 — включена ли отправка
  webhook_secret TEXT,                           -- секрет для валидации входящего вебхука
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO wa_config (id, enabled) VALUES ('main', 0);

-- Сообщения WhatsApp (двусторонний чат). Входящие приходят на вебхук,
-- исходящие пишутся при отправке. id = idMessage из Green API (для дедупликации).
CREATE TABLE wa_messages (
  id           TEXT PRIMARY KEY,               -- idMessage из Green API
  chat_id      TEXT NOT NULL,                  -- '77051234567@c.us'
  client_id    TEXT REFERENCES clients(id),    -- сопоставленный клиент (если найден)
  direction    TEXT NOT NULL,                  -- 'in' | 'out'
  text         TEXT,
  sender_name  TEXT,
  status       TEXT,                           -- sent | delivered | read (для исходящих)
  ts           INTEGER,                         -- unix-время Green API
  at           TEXT,                            -- ISO
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_wa_msg_chat   ON wa_messages(chat_id);
CREATE INDEX idx_wa_msg_client ON wa_messages(client_id);
CREATE INDEX idx_wa_msg_ts     ON wa_messages(ts);

-- Instagram-интеграция (провайдеро-независимая): конфиг + история DM
CREATE TABLE ig_config (
  id             TEXT PRIMARY KEY DEFAULT 'main',
  username       TEXT,                            -- @аккаунт Instagram
  token          TEXT,                            -- токен сервиса/Meta (секрет)
  enabled        INTEGER NOT NULL DEFAULT 0,
  webhook_secret TEXT,                            -- секрет вебхука (сервис шлёт ?key=)
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ig_messages (
  id           TEXT PRIMARY KEY,
  chat_id      TEXT NOT NULL,                     -- '@username'
  client_id    TEXT REFERENCES clients(id),
  direction    TEXT NOT NULL,                     -- 'in' | 'out'
  text         TEXT,
  sender_name  TEXT,
  status       TEXT,
  at           TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ig_msg_chat   ON ig_messages(chat_id);
CREATE INDEX idx_ig_msg_client ON ig_messages(client_id);
INSERT INTO ig_config (id, enabled) VALUES ('main', 0);
