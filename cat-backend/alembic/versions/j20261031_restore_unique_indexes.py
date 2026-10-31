"""Restore unique indexes omitted by the legacy snapshot adoption helper."""
from alembic import op
import sqlalchemy as sa

revision = 'j20261031'
down_revision = 'i20261031'
branch_labels = None
depends_on = None

# Frozen contract: do not import the live ORM schema into a migration.
INDEXES = (
    ('campuses', 'ix_campuses_slug', 'slug'),
    ('users', 'ix_users_openid', 'openid'),
    ('users', 'ix_users_username', 'username'),
    ('invite_codes', 'ix_invite_codes_code', 'code'),
)


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != 'sqlite':
        raise RuntimeError('Unique index repair currently supports SQLite only')
    # A savepoint keeps all index replacements atomic, including a racing write.
    with bind.begin_nested():
        for table, name, column in INDEXES:
            duplicate = bind.execute(sa.text(
                f'SELECT 1 FROM "{table}" WHERE "{column}" IS NOT NULL '
                f'GROUP BY "{column}" HAVING COUNT(*) > 1 LIMIT 1'
            )).first()
            if duplicate:
                raise RuntimeError(
                    f'Unique index repair blocked: duplicate {table}.{column}. '
                    'Back up the database and resolve duplicates explicitly before retrying; no rows were changed.'
                )
        for table, name, column in INDEXES:
            existing = {i['name']: i for i in sa.inspect(bind).get_indexes(table)}.get(name)
            if existing and existing['unique'] and existing['column_names'] == [column]:
                continue
            if existing:
                op.drop_index(name, table_name=table)
            op.create_index(name, table, [column], unique=True)


def downgrade():
    raise RuntimeError('Refusing to remove repaired identity uniqueness constraints')
