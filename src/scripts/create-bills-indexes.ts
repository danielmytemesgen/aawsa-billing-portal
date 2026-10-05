import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.production' });

async function createBillsIndexes() {
  const { query, closePool } = await import('../lib/db');
  console.log('🚀 Starting bills table indexing...');

  const indexes = [
    {
      name: 'idx_bills_status_month',
      sql: 'CREATE INDEX IF NOT EXISTS idx_bills_status_month ON bills (status, month_year)',
      description: 'Accelerates dashboard status filters and approval queries'
    },
    {
      name: 'idx_bills_bill_number',
      sql: 'CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills (bill_number) WHERE deleted_at IS NULL',
      description: 'Accelerates bill lookup by bill number'
    },
    {
      name: 'idx_bills_branch_status',
      sql: 'CREATE INDEX IF NOT EXISTS idx_bills_branch_status ON bills (branch_id, status) WHERE deleted_at IS NULL',
      description: 'Accelerates branch-isolated bill queries'
    },
    {
      name: 'idx_bills_month_year',
      sql: 'CREATE INDEX IF NOT EXISTS idx_bills_month_year ON bills (month_year)',
      description: 'Accelerates monthly bill reporting without customer key'
    },
    {
      name: 'idx_bills_deleted_at',
      sql: 'CREATE INDEX IF NOT EXISTS idx_bills_deleted_at ON bills (deleted_at)',
      description: 'Accelerates soft-delete filtering'
    }
  ];

  for (const idx of indexes) {
    try {
      console.log(`⏳ Creating index ${idx.name}... (${idx.description})`);
      await query(idx.sql);
      console.log(`✅ Index ${idx.name} ensured successfully.`);
    } catch (err: any) {
      console.error(`❌ Failed to create index ${idx.name}:`, err?.message || err);
    }
  }

  await closePool();
  console.log('🎉 Bills table indexing completed.');
}

createBillsIndexes().catch((err) => {
  console.error('Fatal error during indexing:', err);
  process.exit(1);
});
