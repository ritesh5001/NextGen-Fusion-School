# Data Protection & Compliance

> **This is engineering documentation, not legal advice.** The templates in this
> folder are starting points. Have a qualified lawyer in your jurisdiction review
> and finalize them before you sign anything or publish a privacy policy.

NextGen Fusion School stores **personal data of children**, which is a high-risk
category under India's **DPDP Act 2023** and the EU/UK **GDPR**. This document
describes what the platform does technically and what you (the vendor) and the
school (the customer) must do organizationally.

## Roles

- **School = Data Fiduciary / Controller.** They decide what student data to
  collect and why. The privacy policy shown to parents is theirs.
- **NextGen Fusion = Data Processor.** You provide the software. In the
  self-hosted model the school runs their own instance and DB, which *reduces*
  your processor exposure — but a signed **Data Processing Agreement (DPA)** is
  still expected. See `DATA_PROCESSING_AGREEMENT.template.md`.

## Data-subject rights — built in

| Right | Endpoint | Notes |
|------|----------|-------|
| Access / portability | `exportStudentData` ([compliance.functions.ts](../../src/lib/compliance.functions.ts)) | Returns all data held about a student as JSON. Perm: `students.read`. |
| Erasure | `eraseStudentData` | Redacts PII, keeps an anonymized shell so financial/accounting records stay intact. Perm: `students.delete`. Audited. |

## Retention

- Financial records (fees, payments, ledger) are typically retained **7 years**
  for tax/audit — that's why erasure anonymizes rather than hard-deletes.
- Define a written retention schedule per data category and put it in the
  privacy policy. Purge inactive student PII past the retention window.

## Consent

- **Not yet implemented.** You must capture verifiable parental consent at
  admission (DPDP requires it for children). Recommended next step: add a
  consent checkbox + timestamp to the admission form and a `consent` record.

## Security posture (what's in place)

- Passwords: bcrypt (cost 12).
- Auth: short-lived JWT access tokens + rotating refresh tokens.
- Signed, non-forgeable license keys (ed25519).
- Server-side RBAC on premium modules; permission checks on sensitive actions.
- Login + license + admission rate-limiting; audit trail on sensitive mutations.
- Reverse-proxy security headers (HSTS, CSP, X-Frame-Options) — see `Caddyfile`.

## Security posture (still TODO before selling)

- [ ] **Encrypt the database at rest** (Postgres volume / disk encryption).
- [ ] **Encrypted, offsite backups** — `scripts/backup.sh` now supports
      `BACKUP_PASSPHRASE`/`BACKUP_GPG_RECIPIENT` + `BACKUP_RCLONE_REMOTE`. Turn it on.
- [ ] **Test restores** on a schedule.
- [ ] **Parental consent capture** at admission.
- [ ] **RBAC on core modules** (students/fees/attendance) after a role-template review.
- [ ] **httpOnly cookie sessions** (currently tokens live in `localStorage`).
- [ ] **A written breach-response plan** — DPDP requires notifying the Data
      Protection Board and affected persons.
- [ ] **Move secrets out of source** — rotate the platform admin credential to
      a per-deployment env var + hash.

## Breach response (outline)

1. Contain and assess scope.
2. Notify the school (controller) without undue delay.
3. School notifies the DPB / supervisory authority and affected data principals
   as the law requires.
4. Record the incident and remediation.
