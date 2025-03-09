import mysql2 from 'mysql2';

const db = mysql2.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
})

db.connect(err => {
    if (err) console.error('Database Connection Failed: ', err);
    else console.log('Connected to MySQL');
})

export default db;
