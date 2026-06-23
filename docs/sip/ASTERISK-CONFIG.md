# Asterisk — полная конфигурация + тюнинг стабильности («связь не обрывается»)

> Все настройки Asterisk нашего WebRTC-софтфона, с акцентом на **стабильность
> соединения**. Передавай этот файл другой сессии Claude Code — здесь конфиги
> целиком + что добавить, чтобы звонки не рвались.
>
> Базовый автоустановщик — `setup-asterisk.sh` (Asterisk 22 LTS, Ubuntu 22.04).
> Этот док = что он ставит + **дельта стабильности**, которой в нём ещё нет.

---

## 0. Архитектура и где что лежит

- Asterisk 22 LTS на VM с **прямым public IP** (GCP e2-micro Always Free ок).
- Браузер ↔ Asterisk по **WSS (8089)**, аудио — **SRTP/DTLS + ICE**.
- Asterisk ↔ провайдер (Binotel/Mango/Zadarma) — **SIP UDP (5060)** + RTP.
- Конфиги: `/etc/asterisk/{modules,http,rtp,pjsip,extensions}.conf`
- Ключи: `/etc/asterisk/keys/` (WSS-cert от Let's Encrypt + DTLS self-signed).
- Применить изменения: `sudo asterisk -rx 'pjsip reload'` (или `core reload`).

---

## 1. Открытые порты (firewall) — без них рвётся/нет звука

UFW (или security-group облака) — **обязательны все**:
```
22/tcp            SSH
80/tcp            Let's Encrypt (выдача/renew cert)
443/tcp           (опц.)
8089/tcp          WSS (браузерный SIP)
5060/udp          SIP к провайдеру
10000-20000/udp   RTP media  ← ЧАСТАЯ ПРИЧИНА «нет звука / рвётся»
3478/udp          STUN
```
⚠️ В облаке (GCP/AWS) мало UFW — продублируй те же порты в **security-group/firewall
облака**, иначе RTP-диапазон режется и звонок «соединяется но тишина → отбой».

---

## 2. modules.conf
```ini
[modules]
autoload=yes
noload => chan_sip.so      ; только PJSIP, старый chan_sip выключен
```

## 3. http.conf — WSS-сервер
```ini
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8088
tlsenable=yes
tlsbindaddr=0.0.0.0:8089
tlscertfile=/etc/asterisk/keys/wss-fullchain.pem
tlsprivatekey=/etc/asterisk/keys/wss-privkey.pem
```
> WSS-сертификат — настоящий (Let's Encrypt по домену `<ip-через-дефис>.nip.io`).
> Самоподписанный тут НЕ годится — браузер не подключится к wss://.

## 4. rtp.conf — ICE/STUN/диапазон портов
```ini
[general]
rtpstart=10000
rtpend=20000
icesupport=yes
stunaddr=stun.l.google.com:19302
; turnaddr= не нужен, пока VM с прямым public IP. Если оператор за
; жёстким NAT и звук пропадает — поднять coturn и задать turnaddr.
```

---

## 5. pjsip.conf — ГЛАВНОЕ (тут живёт стабильность)

### 5.1 Транспорты
```ini
[global]
type=global
endpoint_identifier_order=username,ip

[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
cert_file=/etc/asterisk/keys/wss-fullchain.pem
priv_key_file=/etc/asterisk/keys/wss-privkey.pem

[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060
```

### 5.2 Браузерный endpoint (оператор 100) — WebRTC
```ini
[100-auth]
type=auth
auth_type=userpass
username=100
password=ЗАМЕНИ_endpoint_password         ; openssl rand -hex 16

[100]
type=endpoint
transport=transport-wss
context=from-internal
disallow=all
allow=alaw,ulaw          ; только G.711 — Binotel-совместимо, без opus-транскодинга
auth=100-auth
aors=100
webrtc=yes               ; включает разом: DTLS, ICE, rtcp_mux, avpf, rtp secure
dtls_cert_file=/etc/asterisk/keys/dtls.pem
dtls_private_key=/etc/asterisk/keys/dtls.pem
dtls_setup=actpass
dtls_verify=fingerprint
ice_support=yes
media_use_received_transport=yes
rtcp_mux=yes
; ── ДЕЛЬТА СТАБИЛЬНОСТИ (добавь, в базовом скрипте нет) ──
rtp_timeout=30           ; нет RTP 30с → положить звонок (убивает «зависшие» вызовы)
rtp_timeout_hold=300     ; то же на удержании
rtp_keepalive=5          ; слать RTP-keepalive каждые 5с (держит NAT-биндинг, нет тишины)

[100]
type=aor
max_contacts=5
remove_existing=yes
; ── ДЕЛЬТА СТАБИЛЬНОСТИ ──
qualify_frequency=30     ; пинговать контакт каждые 30с (детект мёртвых + держит NAT)
qualify_timeout=5        ; ответ на пинг ждём 5с
```

### 5.3 SIP-trunk провайдера (пример Binotel)
```ini
[binotel-auth]
type=auth
auth_type=userpass
username=ЗАМЕНИ_trunk_login
password=ЗАМЕНИ_trunk_password

[binotel]
type=endpoint
transport=transport-udp
context=from-binotel
disallow=all
allow=alaw,ulaw
outbound_auth=binotel-auth
aors=binotel
from_user=ЗАМЕНИ_trunk_login
from_domain=sip52.binotel.com
direct_media=no          ; ВАЖНО: RTP идёт через Asterisk, иначе WebRTC↔провайдер не сойдутся

[binotel]
type=aor
contact=sip:sip52.binotel.com:5060
; ── ДЕЛЬТА СТАБИЛЬНОСТИ ──
qualify_frequency=60     ; держим trunk живым, ловим падение провайдера

[binotel]
type=identify
endpoint=binotel
match=sip52.binotel.com

[binotel-reg]
type=registration
outbound_auth=binotel-auth
server_uri=sip:sip52.binotel.com:5060
client_uri=ЗАМЕНИ_trunk_login@sip52.binotel.com
retry_interval=60               ; при ошибке регистрации — повтор через 60с
; ── ДЕЛЬТА СТАБИЛЬНОСТИ ──
forbidden_retry_interval=300    ; при 403 — не долбить, повтор через 5 мин
expiration=120                  ; перерегистрация каждые 120с (NAT не успевает протухнуть)
max_retries=10000               ; не сдаваться (по сути бесконечно)
line=yes                        ; входящие матчатся по этой регистрации
```

> **Почему дельта стабильности решает «обрывается»:**
> - `qualify_frequency` — Asterisk сам шлёт OPTIONS-пинги: держит NAT-дыру открытой
>   и видит «мёртвый» контакт сразу, а не на следующем звонке.
> - `rtp_timeout` — если медиа-поток встал (Wi-Fi моргнул), звонок корректно
>   завершается, не висит зомби.
> - `rtp_keepalive` — пакетики в тишине держат RTP-сессию и NAT-биндинг → нет
>   «через минуту разговора пропал звук».
> - `expiration` на регистрации < таймаута NAT провайдера → trunk не «отваливается».

---

## 6. extensions.conf — диалплан
```ini
[general]
static=yes
writeprotect=no

[from-internal]                       ; браузер → провайдер (исходящие)
exten => _X.,1,NoOp(Outbound: ${EXTEN})
 same => n,Dial(PJSIP/${EXTEN}@binotel,60)
 same => n,Hangup()
exten => 9000,1,Answer()              ; эхо-тест: набери 9000 → слышишь себя
 same => n,Echo()
 same => n,Hangup()

[from-binotel]                        ; провайдер → браузер (входящие)
exten => _X.,1,NoOp(Inbound)
 same => n,Dial(PJSIP/100,30)
 same => n,Hangup()
```

---

## 7. Сертификаты и авто-renew (иначе через 90 дней WSS умрёт)
- WSS-cert: Let's Encrypt по домену `<ip>.nip.io` (`certbot --standalone`).
- DTLS-cert: self-signed (`openssl req -x509 ... -days 3650`).
- **Авто-renew hook** (критично для долгой работы) —
  `/etc/letsencrypt/renewal-hooks/deploy/reload-sip.sh`:
  ```bash
  #!/bin/bash
  cp /etc/letsencrypt/live/<DOMAIN>/fullchain.pem /etc/asterisk/keys/wss-fullchain.pem
  cp /etc/letsencrypt/live/<DOMAIN>/privkey.pem   /etc/asterisk/keys/wss-privkey.pem
  chown asterisk:users /etc/asterisk/keys/wss-*
  systemctl reload asterisk
  ```
  Проверь, что certbot-таймер активен: `systemctl list-timers | grep certbot`.

---

## 8. Клиент (браузер) — что уже сделано для стабильности
В `sip-client.js` (SIP.js) уже включено, повторять не надо:
- `keepAliveInterval: 30` — WebSocket ping каждые 30с (не даёт прокси/NAT закрыть WSS).
- `reconnectionAttempts: 100`, `reconnectionDelay: 4` — авто-переподключение WSS.
- Авто-**ре-регистрация** после реконнекта + 3 триггера восстановления
  (transport-event, периодическая проверка, ручной разбуд).
- Состояние `reconnecting` в UI, мягкий re-register → жёсткое пересоздание UA.

---

## 9. Проверка (после установки/изменений)
```bash
sudo asterisk -rx 'pjsip show transports'      # wss и udp — Bound
sudo asterisk -rx 'pjsip show registrations'   # trunk → Registered
sudo asterisk -rx 'pjsip show aors'            # qualify виден
sudo asterisk -rx 'pjsip show contacts'        # браузер-контакт Avail + RTT
sudo journalctl -u asterisk -f                 # live-логи
```
Тест звука: из браузера набрать **9000** (эхо) → слышишь себя = WSS+DTLS+RTP ок.

---

## 10. Если всё-таки рвётся — частые причины
| Симптом | Причина | Фикс |
|---------|---------|------|
| Соединяется, **тишина**, через ~30с отбой | закрыт RTP-диапазон `10000-20000/udp` (особенно в firewall ОБЛАКА) | открыть порты в security-group облака, не только UFW |
| Через 1-2 мин разговора **пропал звук** | NAT-биндинг протух | `rtp_keepalive=5`, `qualify_frequency=30` (раздел 5.2) |
| Trunk периодически **Unregistered** | `expiration` больше NAT-таймаута провайдера | `expiration=120` (раздел 5.3) |
| Зомби-звонки висят | нет `rtp_timeout` | `rtp_timeout=30` |
| Браузер не подключается к wss:// | самоподписанный WSS-cert / cert протух | Let's Encrypt + renew-hook (раздел 7) |
| WSS падает раз в N минут | нет keepalive | у нас есть `keepAliveInterval:30` в клиенте — проверь, что грузится свежий `sip-client.js` |

---

## 11. Чек-лист «стабильно и не рвётся»
- [ ] Все порты открыты И в UFW, И в firewall облака (особенно `10000-20000/udp`).
- [ ] В endpoint 100 добавлены `rtp_timeout`, `rtp_keepalive`.
- [ ] В AOR 100 добавлен `qualify_frequency=30`.
- [ ] В trunk AOR `qualify_frequency`, в registration `expiration=120` + `forbidden_retry_interval`.
- [ ] Let's Encrypt renew-hook на месте, certbot-таймер активен.
- [ ] `pjsip show registrations` = Registered, `pjsip show contacts` = Avail с RTT.
- [ ] Эхо-тест 9000 — звук чистый в обе стороны.
