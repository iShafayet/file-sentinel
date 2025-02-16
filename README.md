# file-sentinel

File integrity daemon with automated replica and recovery.

## To run (directly on development machine)

1. Have nodejs 18 (LTS) or newer installed.
2. Then run `npm i`
3. Run `npm run start-compiled`.

## To run integration tests locally (directly on development machine)

Run `npm run test`

## To install as a cli tool

Run `npm run install-cli`

## Command line usage

```bash
npm run build
node dist/start.js \
  --operation verify-and-recover \
  --target-dir "/example/target" \
  --target-metadata-dir "/example/target-meta" \
  --hash-recheck-threshold 0 \
  --verification-mode size-and-hash \
  --mirror-dir "/example/mirror" \
  --mirror-metadata-dir "/example/mirror-meta" \
  --mirror-precedence true \
  --verify-after-recovery true \
  --panic-on-error true \
  --verbose true
```

Or, if you installed the cli tool, you can run:

```bash
file-sentinel \
  --operation verify-and-recover \
  --target-dir "/example/target" \
  --target-metadata-dir "/example/target-meta" \
  --hash-recheck-threshold 0 \
  --verification-mode size-and-hash \
  --mirror-dir "/example/mirror" \
  --mirror-metadata-dir "/example/mirror-meta" \
  --mirror-precedence true \
  --verify-after-recovery true \
  --panic-on-error true \
  --verbose true
```

## Author and License

License: [GNU General Public License v3.0](LICENSE)

2025 © [Sayem Shafayet](https://ishafayet.me)
