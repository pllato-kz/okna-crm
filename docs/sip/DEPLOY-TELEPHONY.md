# Телефония (звонки из браузера) — развёртывание

Пошаговая инструкция, чтобы поднять телефонию, когда будет готова VM и SIP-транк.
Софтфон в CRM уже встроен; нужно поднять Asterisk и дать CRM 2 секрета.

Схема: **Браузер (CRM) ──WSS──> Asterisk (Google VM) ──SIP──> Binotel (АТС + KG-номер) ──> клиент**

---

## Предусловия (бизнес)
- **SIP-доступ от Binotel (внешний SIP / SIP-линия):** SIP-хост, логин, пароль, исходящий номер.
  ⚠️ Сначала подтвердить в кабинете Binotel, что они дают подключить **внешнее SIP-устройство** (наш Asterisk), а не только свой виджет.
- **KG-номер**, привязанный к Binotel (чтобы исходящий шёл с местного номера).

## Шаг 1. Google Cloud VM
1. console.cloud.google.com → создать проект → **Compute Engine** (включить API).
2. **Create instance:** Machine **e2-micro**, регион **us-central1** (Always Free), Boot disk **Ubuntu 22.04 LTS**, отметить **Allow HTTP/HTTPS**.
3. **Static IP:** VPC network → IP addresses → зарезервировать внешний IP этой VM.
4. **Firewall (VPC → Firewall, source 0.0.0.0/0):** `tcp:8089`, `udp:5060`, `udp:10000-20000`, `udp:3478` (порт 80 откроется галочкой HTTP).

## Шаг 2. Установка Asterisk
1. SSH в VM.
2. Скопировать `docs/sip/setup-asterisk.sh` на сервер.
3. В начале скрипта заполнить:
   - `PUBLIC_IP` — внешний (статический) IP VM;
   - данные транка Binotel (хост/логин/пароль);
   - `SIP_ENDPOINT_PASSWORD` = `openssl rand -hex 16`.
4. `sudo ./setup-asterisk.sh` (ставит Asterisk 22, WSS-cert Let's Encrypt, pjsip, диалплан).
5. После установки применить «настройки стабильности» из `docs/sip/ASTERISK-CONFIG.md`
   (rtp_timeout/rtp_keepalive, qualify_frequency, expiration=120) — чтобы звонки не рвались.

## Шаг 3. Активация в CRM (это делает Pllato)
Прислать Pllato 2 значения:
- **`SIP_DOMAIN`** — вид `<ip-через-дефис>.nip.io`;
- **`SIP_ENDPOINT_PASSWORD`** — из шага 2.

Pllato поставит их секретами на Pages-проект `okna-crm`:
```
wrangler pages secret put SIP_DOMAIN --project-name okna-crm
wrangler pages secret put SIP_ENDPOINT_PASSWORD --project-name okna-crm
```
(опц. `SIP_TURN_URL/USERNAME/PASSWORD` при жёстком NAT).

## Шаг 4. Проверка
- В CRM внизу появится бар статуса SIP («регистрируется → готов»).
- Эхо-тест: набрать **9000** в софтфоне → слышишь себя = WSS+DTLS+RTP ок.
- Тестовый звонок на реальный номер.

---

## Если Binotel не даёт внешний SIP
Тогда схема меняется: вместо нашего Asterisk интегрируемся через **API/вебхуки Binotel**
(их click-to-call + события звонков → лог в CRM). Это другой объём работ — согласовать отдельно.

## Заметки
- Always-Free VM у Google только в США → задержка до KG выше (на качестве звонка заметно). Для лучшего качества — VPS ближе к KG.
- Карта на GCP (даже free-tier) — записана в `docs/BILLING.md`, заказчик переводит на свою.
