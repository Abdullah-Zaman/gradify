// Seeds the university / department / program / session / FYP phases and the
// MANAGER account. Manager credentials come from .env:
//   MANAGER_EMAIL, MANAGER_PASSWORD
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
  // University
  const university = await prisma.university.upsert({
    where: { code: 'TSU' },
    update: {},
    create: { name: 'The Superior University', code: 'TSU' }
  });
  console.log('University:', university.name);

  // Department
  const department = await prisma.department.upsert({
    where: { code_universityId: { code: 'SE', universityId: university.id } },
    update: {},
    create: { name: 'Software Engineering', code: 'SE', universityId: university.id }
  });
  console.log('Department:', department.name);

  // Program
  const program = await prisma.program.upsert({
    where: { code_departmentId: { code: 'BSSE', departmentId: department.id } },
    update: {},
    create: { name: 'BS Software Engineering', code: 'BSSE', departmentId: department.id }
  });
  console.log('Program:', program.name);

  // Academic Session
  const session = await prisma.academicSession.upsert({
    where: { semester_year_programId: { semester: 'FALL', year: 2026, programId: program.id } },
    update: {},
    create: { name: 'Fall 2026', semester: 'FALL', year: 2026, programId: program.id }
  });
  console.log('Session:', session.name);

  // FYP Phases
  const fyp1 = await prisma.fYPPhase.upsert({
    where: { phase_sessionId: { phase: 'FYP_1', sessionId: session.id } },
    update: {},
    create: { phase: 'FYP_1', sessionId: session.id }
  });
  console.log('FYP Phase:', fyp1.phase);

  const fyp2 = await prisma.fYPPhase.upsert({
    where: { phase_sessionId: { phase: 'FYP_2', sessionId: session.id } },
    update: {},
    create: { phase: 'FYP_2', sessionId: session.id }
  });
  console.log('FYP Phase:', fyp2.phase);

  // Manager user
  const managerEmail = requireEnv('MANAGER_EMAIL');
  const hashedPassword = await bcrypt.hash(requireEnv('MANAGER_PASSWORD'), 12);
  const manager = await prisma.user.upsert({
    where: { email: managerEmail },
    update: { universityId: university.id },
    create: {
      email: managerEmail,
      name: 'FYP Manager',
      password: hashedPassword,
      role: 'MANAGER',
      universityId: university.id
    }
  });
  console.log('Manager:', manager.email);

  console.log('Seed complete!');
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());