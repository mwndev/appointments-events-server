const Pool = require('pg').Pool

const pool = new Pool({
    user: 'martin',
    password: 'Tofufight3r!',
    host: 'localhost',
    port: 5432,
    database: 'zaneta'
})

module.exports = pool;
