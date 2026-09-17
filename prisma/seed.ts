import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const profEmail = process.env.PROF_EMAIL;
  const profPassword = process.env.PROF_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 8) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD (8 characters minimum) are required",
    );
  }

  const adminHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: adminHash, name: "Administrateur", role: "ADMIN" },
    create: { email: adminEmail, password: adminHash, name: "Administrateur", role: "ADMIN" },
  });

  if (profEmail && profPassword) {
    if (profPassword.length < 8) {
      throw new Error("PROF_PASSWORD must contain at least 8 characters");
    }
    const profHash = await bcrypt.hash(profPassword, 12);
    await prisma.user.upsert({
      where: { email: profEmail },
      update: { password: profHash, name: "Professeur", role: "PROF" },
      create: {
        email: profEmail,
        password: profHash,
        name: "Professeur",
        role: "PROF",
      },
    });
  }

  await prisma.setting.upsert({
    where: { key: "absence_limit" },
    create: { key: "absence_limit", value: "3" },
    update: {},
  });

  console.log("Seed OK");
  console.log(`Admin: ${adminEmail}`);
  if (profEmail && profPassword) console.log(`Prof: ${profEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
