# file-sentinel

File integrity daemon with automated replica and recovery.

## To run (directly on development machine, with livereload)

1. Have nodejs 16 (LTS) or newer installed.
2. Then run `npm i`
3. Run `npm run dev`.
4. Server should be accessible at http://localhost:9241/

## To run integration tests locally (directly on development machine)

1. Make sure you have the server running at http://localhost:9241/
2. Server should be accessible at http://localhost:9241/

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
  --verify-after-recovery true
```

## Author and License

License: [GNU General Public License v3.0](LICENSE)

2025 © [Sayem Shafayet](https://ishafayet.me)
