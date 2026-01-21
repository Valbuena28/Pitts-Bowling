const { pool } = require('../db');

const verifyTables = async () => {
    try {
        const [rows] = await pool.query("SHOW TABLES LIKE 'post%'");
        const tables = rows.map(r => Object.values(r)[0]);
        console.log('Found tables:', tables);

        const expected = ['post_images', 'post_tags', 'posts'];
        const missing = expected.filter(t => !tables.includes(t));

        if (missing.length === 0) {
            console.log('All expected tables found.');
            process.exit(0);
        } else {
            console.error('Missing tables:', missing);
            process.exit(1);
        }
    } catch (error) {
        console.error('Error verifying tables:', error);
        process.exit(1);
    }
};

verifyTables();
