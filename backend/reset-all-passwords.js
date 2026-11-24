require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const newPassword = process.env.RESET_PASSWORD;
  if (!newPassword) {
    throw new Error('Set RESET_PASSWORD to the password every student/supervisor should get');
  }
  const hash = await bcrypt.hash(newPassword, 12);
  const result = await prisma.user.updateMany({
    where: { role: { in: ['STUDENT', 'SUPERVISOR'] } },
    data: { password: hash }
  });
  console.log('Updated:', result.count, 'users');
}

main().catch(console.error).finally(() => prisma.$disconnect());
