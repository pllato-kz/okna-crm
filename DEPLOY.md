# DEPLOY.md — развёртывание ОКНА CRM на Cloudflare

Runbook: как поднять проект с нуля на **новом** Cloudflare-аккаунте (например, при
передаче клиенту). Тот же код работает у любого клиента без правок — всё специфичное
(ID ресурсов, данные компании) задаётся в `wrangler.toml` и в БД, а не в коде.

## Стек
- Фронтенд: статический сайт (vanilla HTML/CSS/JS), без сборки.
- Бэкенд: **Cloudflare Pages Functions** (`functions/api/[[path]].js`), REST API.
- БД: **Cloudflare D1** (SQLite), биндинг `DB`.
- Файлы: **Cloudflare R2**, биндинг `BUCKET`.
- Авторизация: JWT (HS256), пароли — PBKDF2. Секрет подписи — `JWT_SECRET`.

## Что понадобится
- Аккаунт Cloudflare (план с Pages + D1 + R2).
- Node.js 18+ и `npx wrangler` (ставится автоматически).
- Доступ к этому git-репозиторию.

---

## Шаг 1. Создать ресурсы

```bash
# D1 — база данных
npx wrangler d1 create okna-crm-db
#   → запомни выведенный database_id

# R2 — хранилище файлов
npx wrangler r2 bucket create okna-crm-files
```

> Имена (`okna-crm-db`, `okna-crm-files`) можно поменять — главное, чтобы они
> совпадали с `wrangler.toml`. Имена биндингов в коде (`DB`, `BUCKET`) НЕ меняем.

## Шаг 2. Прописать ресурсы в `wrangler.toml`

Открой `wrangler.toml` и подставь свои значения:

```toml
name = "okna-crm"
compatibility_date = "2026-06-01"
pages_build_output_dir = "."

[[d1_databases]]
binding = "DB"
database_name = "okna-crm-db"
database_id = "<ВСТАВЬ database_id из шага 1>"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "okna-crm-files"
```

## Шаг 3. Создать проект Pages и привязать биндинги

Вариант А — через дашборд (рекомендуется для автодеплоя из git):
1. Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Выбрать этот репозиторий, production-ветка **`main`**.
3. Build settings: framework preset **None**, build command — пусто, output dir — `/`.
4. После создания: **Settings → Functions → Bindings**:
   - D1 database binding: имя **`DB`** → база `okna-crm-db`.
   - R2 bucket binding: имя **`BUCKET`** → бакет `okna-crm-files`.

> Биндинги D1/R2 обязательны — без них API вернёт ошибки обращения к базе.

## Шаг 4. Накатить схему и данные в D1

```bash
# структура (26 таблиц)
npx wrangler d1 execute okna-crm-db --remote --file=./schema.sql

# данные: справочники + демо + начальные пароли
npx wrangler d1 execute okna-crm-db --remote --file=./seed.sql
```

`seed.sql` состоит из двух частей:
- **A. Справочники** — нужны всегда (роли, стадии, источники, опции, типы…).
- **B. Демо-данные** — компания, сотрудники, клиенты, склад, сделки. Для чистого
  боевого старта без демо можно применить только раздел A (скопировать его в
  отдельный файл), затем завести своих пользователей и компанию.

## Шаг 5. Задать секрет JWT

```bash
npx wrangler pages secret put JWT_SECRET --project-name okna-crm
#   ввести длинную случайную строку (например: openssl rand -hex 48)
```

> Важно: для Pages именно `pages secret put`, не `secret put`. Секрет
> применяется только к **новому** деплою — после установки нужен передеплой (Шаг 6).

## Шаг 6. Задеплоить / передеплоить

- Если подключён git (Шаг 3, вариант А): любой push в `main` триггерит автодеплой.
  Чтобы применить только что заданный секрет — сделай **Deployments → Retry deployment**
  (или пустой коммит в `main`).
- Альтернатива через API (триггер сборки из подключённого git):
  ```bash
  curl -X POST \
    "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/pages/projects/okna-crm/deployments" \
    -H "Authorization: Bearer <CLOUDFLARE_API_TOKEN>"
  ```

## Шаг 7. Проверка

```bash
BASE=https://<твой-проект>.pages.dev

# 1) API жив
curl -s $BASE/api/health        # → {"status":"ok",...}

# 2) вход (после schema+seed+JWT+redeploy)
curl -s -X POST $BASE/api/login -H 'content-type: application/json' \
  -d '{"email":"director@okna.kz","password":"okna2026"}'   # → {"token":...}
```

Чек-лист в браузере:
1. Открыть сайт → видна форма «Вход для сотрудников».
2. Войти `director@okna.kz` / `okna2026` → дашборд с данными.
3. Создать клиента → **F5** → запись на месте (данные в БД, не в localStorage).
4. Открыть в другом браузере → те же данные (общая база).
5. Войти `warehouse@okna.kz` → видны только Склад/Производство.

---

## Учётные данные по умолчанию (из `seed.sql`)
Пароль у всех — **`okna2026`** (сменить после запуска!).

| Роль | Email |
|---|---|
| Директор | `director@okna.kz` |
| Менеджер | `manager@okna.kz` |
| Замерщик | `surveyor@okna.kz` |
| Сборщик | `assembler@okna.kz` |
| Склад | `warehouse@okna.kz` |

Смена пароля (от лица директора или самого пользователя):
```
POST /api/users/<id>/password   { "password": "новый_пароль" }   (с заголовком Authorization: Bearer <token>)
```

## Клиент-независимость (что менять под конкретного клиента)
- **Название/город/телефон компании** — строка таблицы `company` (не в коде).
  Меняется через API (`PUT /api/company/main`) или SQL.
- **Справочники** (стадии воронки, источники, опции, типы) — строки таблиц,
  правятся под процессы клиента без изменения кода.
- **Ресурсы Cloudflare** (ID базы, бакет) — только в `wrangler.toml`.
- **Демо-данные** — раздел B в `seed.sql`, при боевом старте не применять.

## Типичные проблемы
| Симптом | Причина / решение |
|---|---|
| `JWT_SECRET не задан` при входе | Секрет не задан **или** не было передеплоя после `pages secret put`. Сделать Retry deployment. |
| `Неверный логин или пароль` для seed-юзера | Не применён `seed.sql` (таблица `users` пустая). Накатить Шаг 4. |
| Ошибки обращения к базе / 500 на CRUD | Не привязаны биндинги `DB`/`BUCKET` (Шаг 3.4) или неверный `database_id` в `wrangler.toml`. |
| Изменения не сохраняются после F5 | Вошли в **демо-режим** (нижние кнопки на экране входа), а не через форму логина. Войти email+паролем. |
| Сайт показывает старую версию | Кэш CDN/браузера — жёсткое обновление (Ctrl/Cmd+Shift+R) и/или Retry deployment. |
