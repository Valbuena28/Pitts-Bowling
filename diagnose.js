require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function check() {
    let output = '';
    const log = (msg) => { output += msg + '\n'; console.log(msg); };

    log('--- Diagnosis Start ---');
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        log('DB Connection: Success');

        const [columns] = await connection.query('DESCRIBE usuarios');
        const columnNames = columns.map(c => c.Field);
        log('Columns found: ' + columnNames.join(', '));

        const required = ['failed_attempts', 'block_count', 'permanently_blocked', 'locked_until'];
        const missing = required.filter(c => !columnNames.includes(c));

        if (missing.length > 0) {
            log('MISSING COLUMNS: ' + missing.join(', '));
        } else {
            log('All security columns present.');
        }

        await connection.end();

    } catch (err) {
        log('DB Error: ' + err.message);
    }
    log('--- Diagnosis End ---');
    fs.writeFileSync('result_clean.txt', output);
}

check();
