const { Pool } = require('pg');

let pool = null;
let isConnected = false;

async function connectPostgreSQL() {
  if (!process.env.POSTGRESQL_URI) {
    throw new Error('POSTGRESQL_URI not set');
  }
  pool = new Pool({
    connectionString: process.env.POSTGRESQL_URI,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    keepAlive: true,
    max: 10
  });

  pool.on('error', (err) => {
    console.warn('[PostgreSQL Pool] Client error caught:', err.message);
  });

  await pool.query('SELECT 1');

  // Create tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      mongo_id VARCHAR(50) UNIQUE,
      email VARCHAR(255) UNIQUE NOT NULL,
      role VARCHAR(20) NOT NULL,
      name VARCHAR(255),
      password_hash VARCHAR(255),
      reg_no VARCHAR(100),
      institution_name VARCHAR(255),
      institution_code VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reg_no VARCHAR(100);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_name VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_code VARCHAR(100);

    CREATE TABLE IF NOT EXISTS student_profiles (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(50) UNIQUE REFERENCES users(mongo_id),
      resume_path TEXT,
      github_url TEXT,
      portfolio_url TEXT,
      leetcode_url TEXT,
      gfg_url TEXT,
      linkedin_url TEXT,
      figma_url TEXT,
      target_role VARCHAR(255),
      placement_cell_id VARCHAR(50),
      approval_status VARCHAR(20) DEFAULT 'pending',
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id SERIAL PRIMARY KEY,
      mongo_id VARCHAR(50) UNIQUE,
      student_id VARCHAR(50),
      analysis_data JSONB,
      structured_evidence JSONB,
      claim_validation JSONB,
      scores JSONB,
      role_analysis JSONB,
      recommendations JSONB,
      roadmap JSONB,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE analyses ADD COLUMN IF NOT EXISTS mongo_id VARCHAR(50) UNIQUE;
    ALTER TABLE analyses ADD COLUMN IF NOT EXISTS structured_evidence JSONB;
    ALTER TABLE analyses ADD COLUMN IF NOT EXISTS claim_validation JSONB;
    ALTER TABLE analyses ADD COLUMN IF NOT EXISTS role_analysis JSONB;

    CREATE TABLE IF NOT EXISTS proof_submissions (
      id SERIAL PRIMARY KEY,
      mongo_id VARCHAR(50) UNIQUE,
      analysis_id VARCHAR(50),
      student_id VARCHAR(50),
      claim TEXT,
      proof_type VARCHAR(50),
      proof_data TEXT,
      file_path TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      review_result JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE proof_submissions ADD COLUMN IF NOT EXISTS mongo_id VARCHAR(50) UNIQUE;
    ALTER TABLE proof_submissions ADD COLUMN IF NOT EXISTS analysis_id VARCHAR(50);
    ALTER TABLE proof_submissions ADD COLUMN IF NOT EXISTS review_result JSONB;
  `);
  isConnected = true;
}

function getPool() {
  return pool;
}

function getPgStatus() {
  return isConnected && pool !== null;
}

module.exports = { connectPostgreSQL, getPool, getPgStatus };
