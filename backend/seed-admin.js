// Creates the SUPER_ADMIN account. Credentials come from .env:
//   SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

function requireEnv(name) {
  const value = process.env[name] && process.env[name].trim();
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const adapter = new PrismaPg({ connectionString: requireEnv('DATABASE_URL') });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = requireEnv('SUPER_ADMIN_EMAIL');
  const password = requireEnv('SUPER_ADMIN_PASSWORD');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Super Admin already exists:', existing.email);
    return;
  }
  const hash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: {
      email,
      name: 'Super Admin',
      password: hash,
      role: 'SUPER_ADMIN',
    },
  });
  console.log('✓ Super Admin created:', admin.email);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
