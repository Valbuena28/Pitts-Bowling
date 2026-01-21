const { pool } = require('../db');

const createTables = async () => {
    try {
        console.log('Creating posts table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                slug VARCHAR(255) UNIQUE NOT NULL,
                title VARCHAR(255) NOT NULL,
                subtitle VARCHAR(255),
                author_name VARCHAR(100) NOT NULL,
                author_avatar_url VARCHAR(255),
                category VARCHAR(50) NOT NULL,
                content_html LONGTEXT NOT NULL,
                main_image_url VARCHAR(255) NOT NULL,
                published_at DATETIME NOT NULL,
                is_featured TINYINT(1) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'published',
                external_link VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        console.log('Creating post_images table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS post_images (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                image_url VARCHAR(255) NOT NULL,
                sort_order INT DEFAULT 0,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
            )
        `);

        console.log('Creating post_tags table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS post_tags (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                tag VARCHAR(50) NOT NULL,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
            )
        `);

        console.log('All tables created successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error creating tables:', error);
        process.exit(1);
    }
};

createTables();
