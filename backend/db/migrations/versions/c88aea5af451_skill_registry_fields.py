"""skill_registry_fields

Revision ID: c88aea5af451
Revises: 505cd1bdb8ed
Create Date: 2026-03-31 14:36:19.937952

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c88aea5af451'
down_revision: Union[str, Sequence[str], None] = '505cd1bdb8ed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    """Return True if column already exists in table (handles partial prior migrations)."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column in [c["name"] for c in inspector.get_columns(table)]


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('skills', sa.Column('skill_type', sa.String(), nullable=False, server_default='executable'))
    op.add_column('skills', sa.Column('version', sa.String(), nullable=False, server_default='1.0.0'))
    op.add_column('skills', sa.Column('author', sa.String(), nullable=False, server_default='user'))
    # user_id may already exist if the DB had a prior migration that was later removed
    if not _column_exists('skills', 'user_id'):
        op.add_column('skills', sa.Column('user_id', sa.String(), nullable=True))
    op.add_column('skills', sa.Column('allowed_tools', sa.JSON(), nullable=False, server_default='[]'))
    if not _column_exists('skills', 'user_invocable'):
        op.add_column('skills', sa.Column('user_invocable', sa.Boolean(), nullable=False, server_default='0'))
    else:
        with op.batch_alter_table('skills') as batch_op:
            batch_op.alter_column('user_invocable', existing_type=sa.Boolean(), nullable=False, server_default='0')
    if not _column_exists('skills', 'disable_model_invocation'):
        op.add_column('skills', sa.Column('disable_model_invocation', sa.Boolean(), nullable=False, server_default='0'))
    else:
        with op.batch_alter_table('skills') as batch_op:
            batch_op.alter_column('disable_model_invocation', existing_type=sa.Boolean(), nullable=False, server_default='0')
    op.add_column('skills', sa.Column('context_requirements', sa.JSON(), nullable=False, server_default='[]'))
    op.add_column('agents', sa.Column('skill_hook_url', sa.String(), nullable=True))
    op.add_column('agents', sa.Column('skill_hook_secret', sa.String(), nullable=True))
    # Drop legacy tenant_id column if it exists (from a prior migration that was removed)
    if _column_exists('skills', 'tenant_id'):
        with op.batch_alter_table('skills') as batch_op:
            batch_op.drop_column('tenant_id')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('agents', 'skill_hook_secret')
    op.drop_column('agents', 'skill_hook_url')
    op.drop_column('skills', 'context_requirements')
    op.drop_column('skills', 'disable_model_invocation')
    op.drop_column('skills', 'user_invocable')
    op.drop_column('skills', 'allowed_tools')
    op.drop_column('skills', 'user_id')
    op.drop_column('skills', 'author')
    op.drop_column('skills', 'version')
    op.drop_column('skills', 'skill_type')
