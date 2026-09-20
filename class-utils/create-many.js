require("dotenv").config();

const { faker } = require("@faker-js/faker");

if (process.argv.length<3) {
    console.log("One command line parameter is required, the email of a user registered in the database.")
    process.exit(1);
}
function getRandomDateTimeLast5Weeks() {
  return new Date(Date.now() - Math.random() * 35 * 24 * 60 * 60 * 1000);
}

(async ()=>{
    const prisma = require("../db/prisma");
const user = await prisma.user.findUnique({where: { email: process.argv[2].toLowerCase()}});
if (!user) {
    console.log("No user with that email was found in the database.")
} else {
    const tasks = [];
    let i = 0;
    while (i<100) {
        let newTask = {};
        // Generate a title and limit it to the 30-character Joi maximum.
        newTask.title = faker.lorem.words({ min: 3, max: 5 }).slice(0, 30).trim();
        newTask.description = faker.lorem.paragraphs({ min: 1, max: 3 }).slice(0, 200).trim();
        newTask.userId = user.id;
        newTask.createdAt = getRandomDateTimeLast5Weeks();
        newTask.isCompleted = (Math.random() > 0.5); 
        newTask.priority = ["low","medium","high"][Math.floor(Math.random()*3)];
        tasks.push(newTask);
        i++;
    }
    await prisma.task.createMany({data: tasks})
}
await prisma.$disconnect();
})();