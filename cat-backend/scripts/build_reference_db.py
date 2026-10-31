"""Retired importer: legacy name/ID files cannot establish reference identity."""
import sys


def main():
    print('This legacy builder is disabled: it can reset cats and publishes unverified numeric-ID assets. '
          'Register cat photos through the admin API, migrate the database, then run '
          'python scripts/build_reference_snapshot.py --output <new-directory>. '
          'Existing legacy embeddings require rebuilding; adding a manifest by hand cannot prove their origin.',
          file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
