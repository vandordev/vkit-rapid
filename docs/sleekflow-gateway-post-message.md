# Panduan POST Message ke SleekFlow Gateway

Dokumen ini menjelaskan cara service lain mengirim outbound message melalui SleekFlow Gateway Oriskin.

## Ringkasan

- Base URL production: `https://sleekflow.oriskin.co.id`
- Endpoint text message: `POST /api/messages`
- Auth yang direkomendasikan: `X-API-Key: <API_TOKEN>`
- Content type text/template: `application/json`
- Content type media: `multipart/form-data`

Minta nilai `<API_TOKEN>` ke maintainer gateway. Jangan hardcode token di source code; simpan di environment variable service pemanggil.

## Endpoint Utama: Kirim Text Message

Gunakan endpoint ini untuk mengirim pesan teks biasa.

```bash
curl -X POST 'https://sleekflow.oriskin.co.id/api/messages' \
  -H 'X-API-Key: <API_TOKEN>' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{
    "channel": "whatsapp",
    "to": "6281234567890",
    "from": "6280000000000",
    "messageType": "text",
    "messageContent": "Halo, ini pesan dari service internal Oriskin.",
    "analyticTags": ["internal-service", "transactional"]
  }'
```

### Payload

| Field | Type | Required | Keterangan |
| --- | --- | --- | --- |
| `channel` | string | Ya | Channel pengiriman. Contoh: `whatsapp`. |
| `to` | string | Ya | Identitas penerima. Untuk WhatsApp, gunakan nomor format internasional tanpa `+`, contoh `6281234567890`. |
| `from` | string | Tidak | Sender/channel identity yang diteruskan ke SleekFlow. Isi jika sender eksplisit dibutuhkan. |
| `fromNumber` | string | Tidak | Alias untuk `from`. Gunakan salah satu saja. |
| `messageType` | string | Tidak | Default gateway: `text`. Untuk text message sebaiknya tetap kirim `text`. |
| `messageContent` | string | Ya | Isi pesan. |
| `analyticTags` | string[] | Tidak | Tag analitik untuk SleekFlow dan audit internal. |

### Contoh Response Berhasil

```json
{
  "success": true,
  "message": "Message sent successfully",
  "result": {
    "status": "ok"
  }
}
```

Isi `result` mengikuti response dari upstream SleekFlow, jadi bentuk detailnya bisa berbeda.

## Template Environment di Service Pemanggil

Contoh konfigurasi environment:

```bash
SLEEKFLOW_GATEWAY_URL="https://sleekflow.oriskin.co.id"
SLEEKFLOW_GATEWAY_TOKEN="<API_TOKEN>"
SLEEKFLOW_DEFAULT_CHANNEL="whatsapp"
SLEEKFLOW_DEFAULT_SENDER="6280000000000"
```

Contoh cURL dengan environment variable:

```bash
curl -X POST "${SLEEKFLOW_GATEWAY_URL}/api/messages" \
  -H "X-API-Key: ${SLEEKFLOW_GATEWAY_TOKEN}" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d "{
    \"channel\": \"${SLEEKFLOW_DEFAULT_CHANNEL}\",
    \"to\": \"6281234567890\",
    \"from\": \"${SLEEKFLOW_DEFAULT_SENDER}\",
    \"messageType\": \"text\",
    \"messageContent\": \"Halo dari service internal.\",
    \"analyticTags\": [\"internal-service\"]
  }"
```

## Kirim Media

Gunakan endpoint ini jika perlu mengirim file.

```bash
curl -X POST 'https://sleekflow.oriskin.co.id/api/messages/media' \
  -H 'X-API-Key: <API_TOKEN>' \
  -H 'Accept: application/json' \
  -F 'channel=whatsapp' \
  -F 'to=6281234567890' \
  -F 'from=6280000000000' \
  -F 'messageContent=Berikut lampiran dari Oriskin.' \
  -F 'analyticTags=internal-service,attachment' \
  -F 'files=@/path/to/file.pdf'
```

Catatan media:

- Field file wajib bernama `files`.
- `analyticTags` untuk media dikirim sebagai string comma-separated, bukan array.
- Jangan set header `Content-Type` manual untuk media; biarkan `curl` membuat boundary `multipart/form-data`.

## Kirim Template Message

Gunakan endpoint ini untuk template message.

```bash
curl -X POST 'https://sleekflow.oriskin.co.id/api/messages/templates' \
  -H 'X-API-Key: <API_TOKEN>' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{
    "channel": "whatsapp",
    "to": "6281234567890",
    "from": "6280000000000",
    "messageType": "template",
    "extendedMessage": {
      "templateName": "appointment_reminder",
      "language": "id",
      "parameters": {
        "customerName": "Budi",
        "appointmentDate": "2026-07-10",
        "appointmentTime": "14:00"
      }
    },
    "analyticTags": ["internal-service", "template"]
  }'
```

`extendedMessage` diteruskan sebagai object ke SleekFlow. Sesuaikan strukturnya dengan template yang sudah terdaftar di SleekFlow.

## Auth

Gateway membaca `API_TOKEN` dari header berikut:

```http
X-API-Key: <API_TOKEN>
```

Header `Authorization: Bearer <API_TOKEN>` tidak didukung. Service pemanggil harus memakai `X-API-Key`.

Jika service tidak bisa mengirim header, gateway masih mendukung query parameter `token`, tetapi ini tidak direkomendasikan karena token lebih mudah tercatat di log URL.

```bash
curl -X POST 'https://sleekflow.oriskin.co.id/api/messages?token=<API_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "channel": "whatsapp",
    "to": "6281234567890",
    "messageContent": "Halo."
  }'
```

## Error yang Umum

### 401 Unauthorized

Token tidak ada atau tidak sesuai.

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Invalid authentication token"
}
```

Periksa:

- Header `X-API-Key` sudah dikirim dan nilainya tidak kosong.
- Jangan memakai header `Authorization: Bearer`; gateway tidak membaca header tersebut.
- Token service pemanggil sama dengan token yang dikonfigurasi di gateway.

### 400 Validation Error

Payload tidak sesuai schema.

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Validation failed"
}
```

Periksa field wajib:

- Text: `channel`, `to`, `messageContent`
- Media: `channel`, `to`, `files`
- Template: `channel`, `to`, `extendedMessage`

### 502 Message Request Failed

Gateway berhasil menerima request, tetapi request ke upstream SleekFlow ditolak atau gagal.

Periksa:

- `channel`, `to`, dan `from` valid di SleekFlow.
- API key SleekFlow di gateway masih valid.
- Template sudah aktif jika memakai template message.

## Health Check dan Dokumentasi API

Sebelum integrasi, service lain bisa mengecek gateway:

```bash
curl -sS 'https://sleekflow.oriskin.co.id/health'
```

OpenAPI/Scalar tersedia di:

- `https://sleekflow.oriskin.co.id/openapi`

## Rekomendasi Integrasi

- Set timeout request dari service pemanggil, misalnya 10-30 detik.
- Simpan `x-request-id` dari response header jika perlu tracing.
- Jangan retry otomatis tanpa idempotency strategy, karena request yang sudah diteruskan ke SleekFlow bisa terkirim lebih dari sekali.
- Log payload seperlunya saja. Hindari menyimpan token dan data personal lengkap di log aplikasi.
- Gunakan `analyticTags` untuk menandai asal service, contoh `["evoucher", "transactional"]`.
