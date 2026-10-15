import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function atNoon(daysFromToday: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date;
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const profEmail = process.env.PROF_EMAIL ?? "prof@issatkr.tn";
  const profPassword = process.env.PROF_PASSWORD;
  const chefEmail = process.env.CHEF_EMAIL ?? "chef@issatkr.tn";
  const chefPassword = process.env.CHEF_PASSWORD;
  const demoPassword = process.env.DEMO_PASSWORD;

  if (!adminEmail || !adminPassword || adminPassword.length < 8) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD (8 characters minimum) are required",
    );
  }
  // Demo accounts and demo data: development only.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "The demo seed must not run in production (it creates demo accounts and demo data)",
    );
  }
  // No password is hard-coded: every demo account takes its password from .env.
  for (const [name, value] of [
    ["PROF_PASSWORD", profPassword],
    ["CHEF_PASSWORD", chefPassword],
    ["DEMO_PASSWORD", demoPassword],
  ] as const) {
    if (!value || value.length < 8) {
      throw new Error(`${name} is required in .env (8 characters minimum)`);
    }
  }
  const safeChefPassword = chefPassword as string;
  const safeDemoPassword = demoPassword as string;

  const [adminHash, profHash, chefHash, demoHash] = await Promise.all([
    bcrypt.hash(adminPassword, 12),
    bcrypt.hash(profPassword as string, 12),
    bcrypt.hash(safeChefPassword, 12),
    bcrypt.hash(safeDemoPassword, 12),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: adminHash,
      name: "Administrateur",
      role: "ADMIN",
      active: true,
    },
    create: {
      email: adminEmail,
      password: adminHash,
      name: "Administrateur",
      role: "ADMIN",
    },
  });

  const chef = await prisma.user.upsert({
    where: { email: chefEmail },
    update: {
      password: chefHash,
      name: "Sami Haddad",
      role: "DEPARTMENT_HEAD",
      active: true,
    },
    create: {
      email: chefEmail,
      password: chefHash,
      name: "Sami Haddad",
      role: "DEPARTMENT_HEAD",
    },
  });

  const prof = await prisma.user.upsert({
    where: { email: profEmail },
    update: {
      password: profHash,
      name: "Karim Ben Salah",
      role: "PROF",
      active: true,
    },
    create: {
      email: profEmail,
      password: profHash,
      name: "Karim Ben Salah",
      role: "PROF",
    },
  });

  const mathProf = await prisma.user.upsert({
    where: { email: "math@issatkr.tn" },
    update: {
      password: demoHash,
      name: "Leila Mansour",
      role: "PROF",
      active: true,
    },
    create: {
      email: "math@issatkr.tn",
      password: demoHash,
      name: "Leila Mansour",
      role: "PROF",
    },
  });

  await prisma.setting.upsert({
    where: { key: "absence_limit" },
    create: { key: "absence_limit", value: "3" },
    update: {},
  });

  const levels = await Promise.all(
    [
      { code: "L1", name: "Licence 1" },
      { code: "L2", name: "Licence 2" },
      { code: "L3", name: "Licence 3" },
    ].map((level) =>
      prisma.academicLevel.upsert({
        where: { code: level.code },
        update: { name: level.name, active: true },
        create: level,
      }),
    ),
  );
  const levelByCode = Object.fromEntries(levels.map((level) => [level.code, level]));

  const subjects = await Promise.all(
    [
      { code: "ALGO", name: "Algorithmique" },
      { code: "BD", name: "Bases de données" },
      { code: "RES", name: "Réseaux" },
      { code: "MATH", name: "Mathématiques" },
    ].map((subject) =>
      prisma.subject.upsert({
        where: { code: subject.code },
        update: { name: subject.name, active: true },
        create: subject,
      }),
    ),
  );
  const subjectByCode = Object.fromEntries(
    subjects.map((subject) => [subject.code, subject]),
  );

  for (const subject of subjects) {
    for (const level of levels) {
      await prisma.absenceThreshold.upsert({
        where: {
          subjectId_levelId: {
            subjectId: subject.id,
            levelId: level.id,
          },
        },
        create: {
          subjectId: subject.id,
          levelId: level.id,
          eliminationCount: 3,
        },
        update: { eliminationCount: 3 },
      });
    }
  }

  const classSpecs = [
    {
      name: "1INFO-1",
      code: "1INFO-1",
      externalId: "G-1INFO-1",
      program: "Génie informatique",
      academicYear: "2026-2027",
      semester: 1,
      levelId: levelByCode.L1.id,
    },
    {
      name: "2INFO-1",
      code: "2INFO-1",
      externalId: "G-2INFO-1",
      program: "Génie informatique",
      academicYear: "2026-2027",
      semester: 1,
      levelId: levelByCode.L2.id,
    },
    {
      name: "3INFO-1",
      code: "3INFO-1",
      externalId: "G-3INFO-1",
      program: "Génie informatique",
      academicYear: "2026-2027",
      semester: 1,
      levelId: levelByCode.L3.id,
    },
  ];

  const classes = [];
  for (const spec of classSpecs) {
    classes.push(
      await prisma.class.upsert({
        where: { code: spec.code },
        update: spec,
        create: spec,
      }),
    );
  }
  const classByCode = Object.fromEntries(classes.map((item) => [item.code, item]));

  const studentSpecs = [
    {
      classCode: "1INFO-1",
      matricule: "2026001",
      lastName: "Ben Ali",
      firstName: "Amine",
      email: "amine.benali@demo.issatkr.tn",
      cin: "11000001",
    },
    {
      classCode: "1INFO-1",
      matricule: "2026002",
      lastName: "Trabelsi",
      firstName: "Sara",
      email: "sara.trabelsi@demo.issatkr.tn",
      cin: "11000002",
    },
    {
      classCode: "1INFO-1",
      matricule: "2026003",
      lastName: "Hammami",
      firstName: "Youssef",
      email: "youssef.hammami@demo.issatkr.tn",
      cin: "11000003",
    },
    {
      classCode: "1INFO-1",
      matricule: "2026004",
      lastName: "Gharbi",
      firstName: "Nour",
      email: "nour.gharbi@demo.issatkr.tn",
      cin: "11000004",
    },
    {
      classCode: "1INFO-1",
      matricule: "2026005",
      lastName: "Jebali",
      firstName: "Khaled",
      email: "khaled.jebali@demo.issatkr.tn",
      cin: "11000005",
    },
    {
      classCode: "1INFO-1",
      matricule: "2026006",
      lastName: "Mejri",
      firstName: "Ines",
      email: "ines.mejri@demo.issatkr.tn",
      cin: "11000006",
    },
    {
      classCode: "1INFO-1",
      matricule: "2026007",
      lastName: "Chaabane",
      firstName: "Mohamed",
      email: "mohamed.chaabane@demo.issatkr.tn",
      cin: "11000007",
    },
    {
      classCode: "1INFO-1",
      matricule: "2026008",
      lastName: "Karray",
      firstName: "Amina",
      email: "amina.karray@demo.issatkr.tn",
      cin: "11000008",
    },
    {
      classCode: "2INFO-1",
      matricule: "2025101",
      lastName: "Bouaziz",
      firstName: "Rami",
      email: "rami.bouaziz@demo.issatkr.tn",
      cin: "12000001",
    },
    {
      classCode: "2INFO-1",
      matricule: "2025102",
      lastName: "Saidi",
      firstName: "Hela",
      email: "hela.saidi@demo.issatkr.tn",
      cin: "12000002",
    },
    {
      classCode: "2INFO-1",
      matricule: "2025103",
      lastName: "Ayari",
      firstName: "Anis",
      email: "anis.ayari@demo.issatkr.tn",
      cin: "12000003",
    },
    {
      classCode: "2INFO-1",
      matricule: "2025104",
      lastName: "Ferjani",
      firstName: "Lina",
      email: "lina.ferjani@demo.issatkr.tn",
      cin: "12000004",
    },
    {
      classCode: "3INFO-1",
      matricule: "2024201",
      lastName: "Dridi",
      firstName: "Omar",
      email: "omar.dridi@demo.issatkr.tn",
      cin: "13000001",
    },
    {
      classCode: "3INFO-1",
      matricule: "2024202",
      lastName: "Ben Hassen",
      firstName: "Maya",
      email: "maya.benhassen@demo.issatkr.tn",
      cin: "13000002",
    },
    {
      classCode: "3INFO-1",
      matricule: "2024203",
      lastName: "Jlassi",
      firstName: "Tarek",
      email: "tarek.jlassi@demo.issatkr.tn",
      cin: "13000003",
    },
  ];

  const students = [];
  for (const spec of studentSpecs) {
    const classId = classByCode[spec.classCode].id;
    students.push(
      await prisma.student.upsert({
        where: {
          matricule_classId: {
            matricule: spec.matricule,
            classId,
          },
        },
        update: {
          firstName: spec.firstName,
          lastName: spec.lastName,
          email: spec.email,
          cin: spec.cin,
          active: true,
        },
        create: {
          matricule: spec.matricule,
          firstName: spec.firstName,
          lastName: spec.lastName,
          email: spec.email,
          cin: spec.cin,
          classId,
        },
      }),
    );
  }
  const studentByMatricule = Object.fromEntries(
    students.map((student) => [student.matricule, student]),
  );

  await prisma.attendance.deleteMany({
    where: { session: { class: { code: { in: classSpecs.map((item) => item.code) } } } },
  });
  await prisma.notificationLog.deleteMany({
    where: { student: { matricule: { in: studentSpecs.map((item) => item.matricule) } } },
  });
  await prisma.alertState.deleteMany({
    where: { student: { matricule: { in: studentSpecs.map((item) => item.matricule) } } },
  });
  await prisma.session.deleteMany({
    where: { class: { code: { in: classSpecs.map((item) => item.code) } } },
  });

  const sessionSpecs = [
    {
      classCode: "1INFO-1",
      subjectCode: "ALGO",
      professorId: prof.id,
      offset: -10,
      startTime: "08:30",
      endTime: "10:00",
      room: "A12",
      finalize: true,
    },
    {
      classCode: "1INFO-1",
      subjectCode: "ALGO",
      professorId: prof.id,
      offset: -7,
      startTime: "08:30",
      endTime: "10:00",
      room: "A12",
      finalize: true,
    },
    {
      classCode: "1INFO-1",
      subjectCode: "ALGO",
      professorId: prof.id,
      offset: -3,
      startTime: "08:30",
      endTime: "10:00",
      room: "A12",
      finalize: true,
    },
    {
      classCode: "1INFO-1",
      subjectCode: "BD",
      professorId: prof.id,
      offset: -2,
      startTime: "10:15",
      endTime: "11:45",
      room: "B03",
      finalize: true,
    },
    {
      classCode: "1INFO-1",
      subjectCode: "ALGO",
      professorId: prof.id,
      offset: 0,
      startTime: "08:30",
      endTime: "10:00",
      room: "A12",
      finalize: false,
    },
    {
      classCode: "1INFO-1",
      subjectCode: "BD",
      professorId: prof.id,
      offset: 0,
      startTime: "10:15",
      endTime: "11:45",
      room: "B03",
      finalize: false,
    },
    {
      classCode: "1INFO-1",
      subjectCode: "MATH",
      professorId: mathProf.id,
      offset: 0,
      startTime: "13:30",
      endTime: "15:00",
      room: "C21",
      finalize: false,
    },
    {
      classCode: "1INFO-1",
      subjectCode: "ALGO",
      professorId: prof.id,
      offset: 2,
      startTime: "08:30",
      endTime: "10:00",
      room: "A12",
      finalize: false,
    },
    {
      classCode: "2INFO-1",
      subjectCode: "RES",
      professorId: chef.id,
      offset: -4,
      startTime: "09:00",
      endTime: "10:30",
      room: "D10",
      finalize: true,
    },
    {
      classCode: "2INFO-1",
      subjectCode: "RES",
      professorId: chef.id,
      offset: 0,
      startTime: "09:00",
      endTime: "10:30",
      room: "D10",
      finalize: false,
    },
    {
      classCode: "3INFO-1",
      subjectCode: "BD",
      professorId: prof.id,
      offset: -1,
      startTime: "14:00",
      endTime: "15:30",
      room: "B07",
      finalize: true,
    },
    {
      classCode: "3INFO-1",
      subjectCode: "MATH",
      professorId: mathProf.id,
      offset: 1,
      startTime: "08:30",
      endTime: "10:00",
      room: "C21",
      finalize: false,
    },
  ];

  const sessions: (Awaited<ReturnType<typeof prisma.session.create>> & {
    classCode: string;
    subjectCode: string;
  })[] = [];
  for (const spec of sessionSpecs) {
    const subject = subjectByCode[spec.subjectCode];
    const date = atNoon(spec.offset);
    const created = await prisma.session.create({
      data: {
        classId: classByCode[spec.classCode].id,
        professorId: spec.professorId,
        subjectId: subject.id,
        courseName: subject.name,
        courseCode: subject.code,
        date,
        startTime: spec.startTime,
        endTime: spec.endTime,
        room: spec.room,
        finalizedAt: spec.finalize ? date : null,
      },
    });
    sessions.push({ ...created, classCode: spec.classCode, subjectCode: spec.subjectCode });
  }

  const classStudents = (classCode: string) =>
    studentSpecs
      .filter((student) => student.classCode === classCode)
      .map((student) => studentByMatricule[student.matricule]);

  const absencePlan: Record<string, "present" | "absent" | "justified"> = {};
  function mark(
    matricule: string,
    session: (typeof sessions)[number],
    status: "present" | "absent" | "justified",
  ) {
    absencePlan[`${matricule}:${session.id}`] = status;
  }

  const algoHistory = sessions.filter(
    (session) =>
      session.classCode === "1INFO-1" &&
      session.subjectCode === "ALGO" &&
      session.finalizedAt,
  );
  const bdHistory = sessions.filter(
    (session) =>
      session.classCode === "1INFO-1" &&
      session.subjectCode === "BD" &&
      session.finalizedAt,
  );
  const resHistory = sessions.filter(
    (session) =>
      session.classCode === "2INFO-1" &&
      session.finalizedAt,
  );
  const l3History = sessions.filter(
    (session) => session.classCode === "3INFO-1" && session.finalizedAt,
  );

  for (const session of [...algoHistory, ...bdHistory]) {
    for (const student of classStudents("1INFO-1")) {
      mark(student.matricule, session, "present");
    }
  }
  mark("2026002", algoHistory[0], "absent");
  mark("2026002", algoHistory[1], "absent");
  mark("2026003", algoHistory[0], "absent");
  mark("2026003", algoHistory[1], "absent");
  mark("2026003", algoHistory[2], "absent");
  mark("2026004", algoHistory[0], "justified");
  mark("2026004", algoHistory[1], "absent");
  mark("2026006", bdHistory[0], "absent");
  mark("2026007", algoHistory[2], "justified");

  for (const session of resHistory) {
    for (const student of classStudents("2INFO-1")) {
      mark(student.matricule, session, "present");
    }
  }
  mark("2025103", resHistory[0], "absent");
  mark("2025102", resHistory[0], "justified");

  for (const session of l3History) {
    for (const student of classStudents("3INFO-1")) {
      mark(student.matricule, session, "present");
    }
  }
  mark("2024201", l3History[0], "absent");

  const attendanceRows = [];
  for (const session of sessions.filter((item) => item.finalizedAt)) {
    for (const student of classStudents(session.classCode)) {
      const status = absencePlan[`${student.matricule}:${session.id}`] ?? "present";
      attendanceRows.push({
        studentId: student.id,
        sessionId: session.id,
        present: status === "present",
        justification:
          status === "justified" ? "Certificat médical déposé à l’administration" : null,
        amendedAt: status === "justified" ? new Date() : null,
        amendedById: status === "justified" ? admin.id : null,
      });
    }
  }
  if (attendanceRows.length) {
    await prisma.attendance.createMany({ data: attendanceRows });
  }

  const demoAlerts = [
    {
      matricule: "2026002",
      subjectCode: "ALGO",
      levelCode: "L1",
      alertLevel: "WARNING" as const,
      count: 2,
    },
    {
      matricule: "2026003",
      subjectCode: "ALGO",
      levelCode: "L1",
      alertLevel: "ELIMINATED" as const,
      count: 3,
    },
  ];

  for (const alert of demoAlerts) {
    const student = studentByMatricule[alert.matricule];
    const subject = subjectByCode[alert.subjectCode];
    const level = levelByCode[alert.levelCode];
    await prisma.alertState.create({
      data: {
        studentId: student.id,
        subjectId: subject.id,
        levelId: level.id,
        level: alert.alertLevel,
        lastAbsenceCount: alert.count,
        episode: 1,
      },
    });
    await prisma.notificationLog.create({
      data: {
        studentId: student.id,
        subjectId: subject.id,
        levelId: level.id,
        type: "WARNING",
        status: "SENT",
        recipient: student.email ?? "demo@issatkr.tn",
        absenceCount: 2,
        threshold: 3,
        episode: 1,
        dedupKey: `${student.id}:${subject.id}:${level.id}:WARNING:1`,
        attempts: 1,
        sentAt: atNoon(-3),
      },
    });
    if (alert.alertLevel === "ELIMINATED") {
      await prisma.notificationLog.create({
        data: {
          studentId: student.id,
          subjectId: subject.id,
          levelId: level.id,
          type: "ELIMINATION",
          status: "SENT",
          recipient: student.email ?? "demo@issatkr.tn",
          absenceCount: 3,
          threshold: 3,
          episode: 1,
          dedupKey: `${student.id}:${subject.id}:${level.id}:ELIMINATION:1`,
          attempts: 1,
          sentAt: atNoon(-1),
        },
      });
    }
  }

  await prisma.notificationLog.create({
    data: {
      studentId: studentByMatricule["2026006"].id,
      subjectId: subjectByCode.BD.id,
      levelId: levelByCode.L1.id,
      type: "WARNING",
      status: "FAILED",
      recipient: "ines.mejri@demo.issatkr.tn",
      absenceCount: 1,
      threshold: 3,
      episode: 1,
      dedupKey: `${studentByMatricule["2026006"].id}:${subjectByCode.BD.id}:${levelByCode.L1.id}:WARNING:demo-failed`,
      attempts: 2,
      error: "SMTP démo : serveur injoignable",
    },
  });

  console.log("Seed démo OK");
  console.log("");
  console.log("Comptes");
  console.log(`  Admin              ${adminEmail} / (ADMIN_PASSWORD)`);
  console.log(`  Chef département   ${chefEmail} / (CHEF_PASSWORD)`);
  console.log(`  Enseignant Karim   ${profEmail} / (PROF_PASSWORD)`);
  console.log(`  Enseignante Leila  math@issatkr.tn / (DEMO_PASSWORD)`);
  console.log("");
  console.log("À montrer");
  console.log("  Prof Karim : séances du jour 1INFO-1 (Algo 08:30, BD 10:15)");
  console.log("  Sara Trabelsi : avertissement Algo (2/3)");
  console.log("  Youssef Hammami : éliminé Algo (3/3)");
  console.log("  Nour Gharbi : une absence justifiée");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
