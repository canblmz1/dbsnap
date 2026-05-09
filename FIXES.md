# FIXES

Date: 2026-05-09

## 1. Bulunan Kritik Buglar

1. CLI/package/core sürümünün ve metadata `DBSNAP_VERSION` değerinin ayrı yerlerde yaşaması release sırasında mismatch riski yaratıyordu.
2. Publish edilen binary yolu npm symlink üzerinden çağrıldığında CLI entrypoint davranışı kırılabiliyordu.
3. `dbsnap verify <name>` README'de anlatılan gerçek CLI yüzeyinin parçası olmak zorundaydı; komutun register ve JSON davranışı regression kapsamına alındı.
4. `save --dry-run` gerçek npm consumer smoke akışında SQLite dosyası yokken erken hata verebiliyordu.
5. `save` remote veya production-looking DB'lere karşı guard kullanmadığı için araç yanlışlıkla production backup tool gibi kullanılabilirdi.
6. Restore target mismatch davranışı force guard ile karışmaya açıktı; `force` ve `allowDifferentTarget` ayrı anlamlarda kalmalıydı.
7. PostgreSQL/Docker fallback ve spawn davranışında stream flush, timeout, NUL byte, allowlist ve ambiguity davranışları release öncesi testle kilitlenmeliydi.

## 2. Düzeltilenler

- Root, CLI package, core package ve `DBSNAP_VERSION` `0.9.0-beta.5` üzerinde hizalı.
- Version alignment testi eklendi; CLI `--version` package version ile aynı değeri basıyor.
- Snapshot metadata `dbsnapVersion` aynı `DBSNAP_VERSION` sabitinden yazılıyor.
- `dbsnap verify <name>` ve `dbsnap verify <name> --json` davranışı testlendi.
- `dbsnap prune` eklendi:
  - `--keep-last <count>`
  - `--older-than <duration>`
  - `--dry-run`
  - `--json`
- `save` artık remote veya production-looking database hedeflerini default olarak blokluyor; override için `--force-i-know-what-i-am-doing` gerekiyor.
- `save --dry-run` DB dosyası henüz yokken consumer smoke preview olarak çalışıyor.
- `doctor` çıktısı iyileştirildi:
  - `DATABASE_URL` source
  - `pg_dump` / `pg_restore` version
  - Docker daemon/Desktop guidance
  - Docker PostgreSQL container eşleşmeme veya ambiguity mesajı
- `scripts/pack-smoke.mjs` genişletildi:
  - core ve CLI tarball pack
  - dist/README/LICENSE/package.json doğrulaması
  - bin shebang doğrulaması
  - public API import smoke
  - `npx dbsnap --version`
  - `npx dbsnap --help`
  - `npx dbsnap init --dry-run`
  - `DATABASE_URL=file:./dev.db npx dbsnap save test --dry-run`
  - `DATABASE_URL=file:./dev.db npx dbsnap --json list`
  - `npx --no-install dbsnap --version`
  - npm script içinden `dbsnap`
  - `pnpm exec dbsnap`
  - Windows path boşluklu klasörde install/run
- README ve `packages/cli/README.md` birebir hizalı.
- `docs/issues/feature-priorities.md` eklendi.
- `docs/publish-checklist.md` version bump source-of-truth akışını ve GitHub metadata önerilerini içeriyor.

## 3. Eklenen Testler

- Version mismatch regression:
  - root package version
  - core package version
  - CLI package version
  - CLI core dependency version
  - `DBSNAP_VERSION`
- README CLI reference ile register edilen CLI command listesinin eşleşmesi.
- CLI help içinde `verify` ve `prune`.
- CLI `prune --keep-last 0 --dry-run --json`.
- Core `pruneSnapshots()` keep-last + older-than + dry-run.
- `save --dry-run` SQLite dosyası yokken preview.
- `save` remote DB guard ve force override.
- `verifySnapshot()` missing metadata, missing artifact, size mismatch, database type mismatch.
- PostgreSQL restore target identity:
  - aynı host/port/db geçer
  - farklı db name bloklanır
  - farklı port bloklanır
  - dry-run mismatch bilgisini döner
- Force ve allowDifferentTarget ayrımı korunur.
- Spawn:
  - output stream finish beklenir
  - output stream error propagate edilir
  - input stream error propagate edilir
  - timeout clean error'a dönüşür
  - command allowlist dışı command reddedilir
  - arg içinde boşluk ve `&` literal arg olarak güvenli çalışır
  - NUL byte reddedilir
- PostgreSQL execution planning:
  - missing `pg_dump`
  - Docker fallback
  - Docker container ambiguity

## 4. Kalan Riskler

- PostgreSQL ve Docker testleri gerçek servis gerektirmeyen unit/mocked kapsamda; canlı PostgreSQL integration testi ayrı bir CI job olarak eklenebilir.
- Snapshot compression bu release içinde uygulanmadı; planlandı.
- First-party Vitest/Playwright helper export'ları planlandı.
- MySQL adapter, shell completions, snapshot diff metadata, demo app ve TUI P2 olarak planlandı.
- Büyük local DB performansı disk, dump size ve PostgreSQL tooling hızına bağlı.

## 5. Yeni Özellik Önerileri

Shipped:

- `dbsnap verify <name>`
- `dbsnap prune`
- Better doctor temel iyileştirmeleri

Planned:

- `save --compress gzip` ve compressed restore
- `@canblmz1/dbsnap/vitest`
- `@canblmz1/dbsnap/playwright`
- shell completions
- MySQL adapter
- snapshot diff metadata
- demo app / GIF
- richer interactive TUI

Detaylı task listesi: `docs/issues/feature-priorities.md`.

## 6. npm Publish Öncesi Komut Sırası

```bash
pnpm install
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm pack:smoke

cd packages/core
npm pack
npm publish --access public --tag beta

cd ../cli
npm pack
npm publish --access public --tag beta
```

Version bump sırasında şu değerler birlikte güncellenmeli:

- root `package.json`
- `packages/core/package.json`
- `packages/cli/package.json`
- `packages/cli/package.json` içindeki `@canblmz1/dbsnap-core` dependency
- `packages/core/src/snapshots/metadata.ts` içindeki `DBSNAP_VERSION`
- `CHANGELOG.md`

## 7. Publish Sonrası Smoke Test Komutları

```bash
mkdir -p /tmp/dbsnap-smoke
cd /tmp/dbsnap-smoke
npm init -y
npm install -D @canblmz1/dbsnap@0.9.0-beta.5
npx dbsnap --version
npx dbsnap --help
npx dbsnap verify --help
npx dbsnap init --dry-run
DATABASE_URL=file:./dev.db npx dbsnap save test --dry-run
DATABASE_URL=file:./dev.db npx dbsnap --json list
```

## Final Doğrulama Sonucu

Passed locally on Windows:

- `pnpm install`
- `pnpm typecheck`
- `pnpm test`
  - core: 45 passed
  - CLI: 18 passed
- `pnpm build`
- `pnpm pack:smoke`
- `npm pack` for `@canblmz1/dbsnap-core`
- `npm pack` for `@canblmz1/dbsnap`
- temp consumer install with local core + CLI tarballs
- `npx dbsnap --version` -> `0.9.0-beta.5`
- `npx dbsnap --help`
- `npx dbsnap verify --help`
- `npx dbsnap init --dry-run`
- `DATABASE_URL=file:./dev.db npx dbsnap save test --dry-run`
- `DATABASE_URL=file:./dev.db npx dbsnap --json list`
- README command smoke list
- YAML parse:
  - `.github/workflows/ci.yml`
  - `pnpm-workspace.yaml`
