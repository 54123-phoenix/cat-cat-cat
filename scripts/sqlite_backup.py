"""Consistent SQLite snapshot/restore using SQLite's online backup API."""
import argparse
from contextlib import closing
from pathlib import Path
import sqlite3


def snapshot(source: Path, destination: Path, *, replace: bool = False):
    source, destination = source.resolve(), destination.resolve()
    if not source.is_file():
        raise ValueError(f'Database not found: {source}')
    if source == destination:
        raise ValueError('Source and destination must differ')
    if destination.exists() and not replace:
        raise ValueError(f'Refusing to overwrite: {destination}')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as src:
        with closing(sqlite3.connect(destination)) as dest, dest:
            src.backup(dest)
            result = dest.execute('PRAGMA integrity_check').fetchone()[0]
            if result != 'ok':
                raise RuntimeError(f'Snapshot integrity check failed: {result}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--replace', action='store_true', help='restore over a stopped database after making a pre-restore backup')
    args = parser.parse_args()
    snapshot(args.source, args.destination, replace=args.replace)
    print(f'SQLite snapshot verified: {args.destination}')
