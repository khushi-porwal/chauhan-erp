import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Default Company
  const company = await prisma.company.create({
    data: {
      name: 'Chauhan Enterprises',
      legalName: 'Chauhan Enterprises Private Limited',
      email: 'info@chauhanenterprises.com',
      phone: '9876543210',
      website: 'www.chauhanenterprises.com',
      gstNumber: '07AAAAA1111A1Z1',
      address: '123 Business Park, New Delhi, India',
      currency: 'INR',
    },
  });
  console.log(`Created Company: ${company.name} (${company.id})`);

  // 2. Create Default Branch
  const branch = await prisma.branch.create({
    data: {
      name: 'Head Office',
      code: 'HQ',
      address: '123 Business Park, New Delhi, India',
      phone: '9876543210',
      companyId: company.id,
    },
  });
  console.log(`Created Branch: ${branch.name} (${branch.id})`);

  // 3. Create Default Financial Year
  const financialYear = await prisma.financialYear.create({
    data: {
      name: 'FY 2026-27',
      startDate: new Date('2026-04-01T00:00:00Z'),
      endDate: new Date('2027-03-31T23:59:59Z'),
      isActive: true,
      companyId: company.id,
    },
  });
  console.log(`Created Financial Year: ${financialYear.name} (${financialYear.id})`);

  // 4. Create Super Admin User
  const hashedPassword = await bcrypt.hash('SuperAdmin@123', 10);
  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@chauhanerp.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      permissions: JSON.stringify([
        'company:read',
        'company:write',
        'branch:read',
        'branch:write',
        'fy:read',
        'fy:write',
        'user:read',
        'user:write',
        'audit:read'
      ]),
      status: 'ACTIVE',
      companyId: company.id,
      branchId: branch.id,
    },
  });
  console.log(`Created Super Admin User: ${superAdmin.email}`);

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
