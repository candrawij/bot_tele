📊 Skema Database untuk Website Top Up Game
Fokus: Admin & CS Management
Berikut adalah skema database lengkap untuk website top up game, dengan fokus khusus pada manajemen admin dan CS. Skema ini dirancang untuk mendukung semua fitur yang sudah kita bahas di PRD dan implementasi bot Telegram.

🗄️ ERD (Entity Relationship Diagram) - Admin & CS Module
text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     admins      │     │    cs_agents    │     │     users       │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │     │ id (PK)         │
│ email           │     │ admin_id (FK)   │     │ email           │
│ password        │     │ user_id (FK)    │     │ password        │
│ name            │     │ status          │     │ name            │
│ role            │     │ skills          │     │ phone           │
│ status          │     │ rating          │     │ status          │
│ created_at      │     │ total_handled   │     │ created_at      │
│ updated_at      │     │ avg_response    │     │ updated_at      │
└────────┬────────┘     │ created_at      │     └─────────────────┘
         │               │ updated_at      │               │
         │               └─────────────────┘               │
         │                        │                        │
         │                        ▼                        │
         │               ┌─────────────────┐               │
         └──────────────►│   tickets       │◄──────────────┘
                         ├─────────────────┤
                         │ id (PK)         │
                         │ ticket_id (UK)  │  ← TCK-0001
                         │ user_id (FK)    │
                         │ admin_id (FK)   │  ← NULL jika belum diassign
                         │ cs_agent_id(FK) │  ← NULL jika belum diassign
                         │ category        │  ← topup, refund, complaint, general
                         │ priority        │  ← normal, urgent, critical
                         │ status          │  ← open, assigned, pending, closed
                         │ subject         │
                         │ messages_count  │
                         │ last_message_at │
                         │ assigned_at     │
                         │ closed_at       │
                         │ created_at      │
                         │ updated_at      │
                         └─────────────────┘
                                  │
                                  │ 1
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ ticket_messages │
                         ├─────────────────┤
                         │ id (PK)         │
                         │ ticket_id (FK)  │
                         │ sender_type     │  ← user, admin, cs, system
                         │ sender_id       │
                         │ message         │
                         │ is_forwarded    │
                         │ created_at      │
                         └─────────────────┘
📝 Skema Database Lengkap (SQL - PostgreSQL)
1. Tabel Users (Pelanggan Biasa)
sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    telegram_id BIGINT UNIQUE, -- ID Telegram untuk integrasi bot
    status VARCHAR(20) DEFAULT 'active', -- active, suspended, banned
    total_transactions INT DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    last_active_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index untuk performa
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_status ON users(status);
2. Tabel Admins (Admin Sistem - Super Admin)
sql
CREATE TABLE admins (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(30) DEFAULT 'admin', -- super_admin, admin, support_manager
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, suspended
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index
CREATE INDEX idx_admins_email ON admins(email);
CREATE INDEX idx_admins_role ON admins(role);
CREATE INDEX idx_admins_status ON admins(status);
Data Seed untuk Admin Awal:

sql
INSERT INTO admins (email, password, name, role) VALUES 
('superadmin@topup.com', '$2y$10$...', 'Super Admin', 'super_admin'),
('admin@topup.com', '$2y$10$...', 'Admin Utama', 'admin');
3. Tabel CS Agents (Customer Service)
sql
CREATE TABLE cs_agents (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, -- Jika login pakai user biasa
    admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL, -- Jika login pakai admin
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telegram_id BIGINT UNIQUE, -- ID Telegram untuk notifikasi
    status VARCHAR(20) DEFAULT 'online', -- online, offline, busy, away
    skills TEXT[], -- Array skills: ['topup', 'refund', 'complaint']
    rating DECIMAL(3,2) DEFAULT 0, -- Rating dari user
    total_handled INT DEFAULT 0,
    avg_response_time INT DEFAULT 0, -- dalam detik
    max_tickets INT DEFAULT 5, -- Maks tiket yang bisa dihandle bersamaan
    current_tickets INT DEFAULT 0,
    shift_start TIME,
    shift_end TIME,
    last_active_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Validasi: setidaknya satu referensi harus ada
    CONSTRAINT cs_agent_has_user_or_admin CHECK (user_id IS NOT NULL OR admin_id IS NOT NULL)
);

-- Index
CREATE INDEX idx_cs_agents_status ON cs_agents(status);
CREATE INDEX idx_cs_agents_telegram_id ON cs_agents(telegram_id);
CREATE INDEX idx_cs_agents_email ON cs_agents(email);
CREATE INDEX idx_cs_agents_skills ON cs_agents USING GIN(skills);
Data Seed untuk CS:

sql
INSERT INTO cs_agents (admin_id, name, email, telegram_id, status, skills, shift_start, shift_end) VALUES 
(1, 'Budi CS', 'budi.cs@topup.com', 123456789, 'online', ARRAY['topup', 'refund'], '09:00', '17:00'),
(2, 'Siti CS', 'siti.cs@topup.com', 987654321, 'online', ARRAY['topup', 'complaint'], '13:00', '22:00');
4. Tabel Tickets (Tiket CS)
sql
CREATE TABLE tickets (
    id BIGSERIAL PRIMARY KEY,
    ticket_id VARCHAR(20) UNIQUE NOT NULL, -- TCK-0001
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL, -- Jika diambil admin
    cs_agent_id BIGINT REFERENCES cs_agents(id) ON DELETE SET NULL, -- Jika diambil CS
    
    -- Informasi Tiket
    category VARCHAR(30) NOT NULL, -- topup, refund, complaint, general, technical
    priority VARCHAR(20) DEFAULT 'normal', -- normal, urgent, critical
    status VARCHAR(20) DEFAULT 'open', -- open, assigned, pending, closed
    
    -- Konten
    subject VARCHAR(255),
    messages_count INT DEFAULT 0,
    last_message_at TIMESTAMP,
    
    -- Assignment
    assigned_at TIMESTAMP,
    first_response_at TIMESTAMP,
    closed_at TIMESTAMP,
    
    -- Metadata
    source VARCHAR(30) DEFAULT 'telegram', -- telegram, website, email, whatsapp
    rating TINYINT, -- 1-5
    feedback TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint
    CONSTRAINT chk_status CHECK (status IN ('open', 'assigned', 'pending', 'closed'))
);

-- Index untuk performa
CREATE INDEX idx_tickets_ticket_id ON tickets(ticket_id);
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_cs_agent ON tickets(cs_agent_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_category ON tickets(category);
CREATE INDEX idx_tickets_created ON tickets(created_at);
CREATE INDEX idx_tickets_assigned ON tickets(assigned_at) WHERE status = 'assigned';
CREATE INDEX idx_tickets_unassigned ON tickets(cs_agent_id) WHERE cs_agent_id IS NULL AND status = 'open';
Trigger untuk auto-generate ticket_id:

sql
CREATE OR REPLACE FUNCTION generate_ticket_id()
RETURNS TRIGGER AS $$
DECLARE
    next_number INT;
BEGIN
    -- Ambil nomor urut terakhir
    SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_id FROM 5) AS INT)), 0) + 1
    INTO next_number
    FROM tickets
    WHERE ticket_id LIKE 'TCK-%';
    
    NEW.ticket_id := 'TCK-' || LPAD(next_number::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_ticket_id
BEFORE INSERT ON tickets
FOR EACH ROW
EXECUTE FUNCTION generate_ticket_id();
5. Tabel Ticket Messages (Pesan Tiket)
sql
CREATE TABLE ticket_messages (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT REFERENCES tickets(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL, -- user, admin, cs, system
    sender_id BIGINT, -- user_id / admin_id / cs_agent_id
    
    message TEXT NOT NULL,
    is_forwarded BOOLEAN DEFAULT FALSE,
    is_internal BOOLEAN DEFAULT FALSE, -- Hanya untuk internal (tidak ke user)
    
    -- Metadata
    telegram_message_id INT, -- ID dari pesan di Telegram
    read_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index
CREATE INDEX idx_ticket_messages_ticket ON ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_sender ON ticket_messages(sender_type, sender_id);
CREATE INDEX idx_ticket_messages_created ON ticket_messages(created_at);
6. Tabel Admin Logs (Audit Trail)
sql
CREATE TABLE admin_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- login, refund, update_status, assign_ticket, close_ticket
    target_type VARCHAR(30), -- transaction, ticket, user, product
    target_id BIGINT,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index
CREATE INDEX idx_admin_logs_admin ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_action ON admin_logs(action);
CREATE INDEX idx_admin_logs_created ON admin_logs(created_at);
CREATE INDEX idx_admin_logs_details ON admin_logs USING GIN(details);
7. Tabel CS Performance (Tracking Kinerja CS)
sql
CREATE TABLE cs_performance (
    id BIGSERIAL PRIMARY KEY,
    cs_agent_id BIGINT REFERENCES cs_agents(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    tickets_handled INT DEFAULT 0,
    tickets_closed INT DEFAULT 0,
    avg_response_time INT DEFAULT 0, -- detik
    avg_resolution_time INT DEFAULT 0, -- detik
    satisfaction_rate DECIMAL(3,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(cs_agent_id, date)
);

-- Index
CREATE INDEX idx_cs_performance_agent ON cs_performance(cs_agent_id);
CREATE INDEX idx_cs_performance_date ON cs_performance(date);
🔗 Relasi dengan Tabel Transaksi (Core Business)
Untuk integrasi dengan bisnis inti (top-up), CS/Admin perlu mengakses data transaksi:

sql
-- Tabel games (sudah dari PRD sebelumnya)
CREATE TABLE games (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel products
CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    game_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    price INT NOT NULL,
    stock INT DEFAULT -1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- Tabel transactions (Core)
CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    trx_id VARCHAR(50) UNIQUE NOT NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL, -- Jika refund manual
    game_id INT NOT NULL,
    product_id INT NOT NULL,
    user_game_id VARCHAR(100) NOT NULL,
    amount INT NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_code VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    payment_expiry TIMESTAMP,
    topup_request_sent_at TIMESTAMP,
    topup_response TEXT,
    webhook_payload TEXT,
    refunded_at TIMESTAMP,
    refunded_by BIGINT REFERENCES admins(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Index untuk transaksi
CREATE INDEX idx_transactions_trx_id ON transactions(trx_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at);
🎯 Query-Query Penting untuk CS & Admin
1. Dashboard Admin - Hari Ini
sql
-- Statistik transaksi hari ini
SELECT 
    COUNT(*) as total_transactions,
    SUM(amount) as total_revenue,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
    ROUND(COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
FROM transactions
WHERE DATE(created_at) = CURRENT_DATE;

-- Tiket CS hari ini
SELECT 
    COUNT(*) as total_tickets,
    COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
    COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned_tickets,
    COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_tickets
FROM tickets
WHERE DATE(created_at) = CURRENT_DATE;
2. Daftar Tiket untuk CS
sql
-- Tiket yang bisa diambil CS
SELECT 
    t.ticket_id,
    u.name as user_name,
    u.telegram_id,
    t.category,
    t.priority,
    t.subject,
    t.created_at,
    (SELECT message FROM ticket_messages 
     WHERE ticket_id = t.id 
     ORDER BY created_at DESC 
     LIMIT 1) as last_message
FROM tickets t
JOIN users u ON t.user_id = u.id
WHERE t.status = 'open'
ORDER BY 
    CASE t.priority 
        WHEN 'critical' THEN 1 
        WHEN 'urgent' THEN 2 
        ELSE 3 
    END,
    t.created_at ASC;
3. Ambil Tiket oleh CS
sql
-- Assign tiket ke CS
UPDATE tickets 
SET 
    cs_agent_id = 123,
    status = 'assigned',
    assigned_at = CURRENT_TIMESTAMP
WHERE ticket_id = 'TCK-0001'
AND status = 'open'
RETURNING *;

-- Update jumlah tiket CS
UPDATE cs_agents 
SET current_tickets = current_tickets + 1
WHERE id = 123;
4. Cek Riwayat User (untuk CS)
sql
-- Lihat histori transaksi user
SELECT 
    trx_id,
    g.name as game_name,
    p.name as product_name,
    amount,
    status,
    created_at
FROM transactions t
JOIN games g ON t.game_id = g.id
JOIN products p ON t.product_id = p.id
WHERE user_id = 123
ORDER BY created_at DESC
LIMIT 10;

-- Lihat histori tiket user
SELECT 
    ticket_id,
    category,
    status,
    priority,
    created_at,
    closed_at
FROM tickets
WHERE user_id = 123
ORDER BY created_at DESC;
5. Proses Refund oleh Admin
sql
-- Update transaksi refund
UPDATE transactions 
SET 
    status = 'refunded',
    refunded_at = CURRENT_TIMESTAMP,
    refunded_by = 1  -- admin_id
WHERE trx_id = 'TRX123456'
AND status = 'failed'
RETURNING *;

-- Catat log refund
INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
VALUES (
    1, 
    'refund', 
    'transaction', 
    123, 
    jsonb_build_object('trx_id', 'TRX123456', 'amount', 5000, 'reason', 'API Error')
);

-- Update status tiket terkait (jika ada)
UPDATE tickets 
SET 
    status = 'closed',
    closed_at = CURRENT_TIMESTAMP,
    feedback = 'Refund processed successfully'
WHERE ticket_id = 'TCK-0001';
🔐 Security & Best Practices
1. Hashing Password
sql
-- Gunakan bcrypt untuk password (di aplikasi, bukan database)
-- Contoh di Laravel: Hash::make('password')
-- Di Node.js: bcrypt.hash('password', 10)
2. Soft Delete (Opsional)
sql
-- Tambahkan deleted_at ke tabel penting
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE admins ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE cs_agents ADD COLUMN deleted_at TIMESTAMP;

-- Index untuk soft delete
CREATE INDEX idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NULL;
3. Audit Trail
sql
-- Trigger untuk update updated_at otomatis
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Terapkan ke semua tabel dengan updated_at
📊 Ringkasan Tabel & Relasi
Tabel	Primary Key	Foreign Key	Fungsi
users	id	-	Pelanggan/pengguna website
admins	id	-	Admin sistem (super admin)
cs_agents	id	user_id, admin_id	CS Agents (bisa login via user/admin)
tickets	id	user_id, admin_id, cs_agent_id	Tiket CS
ticket_messages	id	ticket_id	Pesan dalam tiket
admin_logs	id	admin_id	Audit trail admin
cs_performance	id	cs_agent_id	Tracking kinerja CS
transactions	id	user_id, admin_id, game_id, product_id	Core transaksi top-up
games	id	-	Daftar game
products	id	game_id	Produk top-up
Kesimpulan: Skema di atas mencakup semua kebutuhan CS & Admin:

✅ Manajemen Admin & CS

✅ Sistem Tiket dengan assignment

✅ Tracking kinerja CS

✅ Audit trail (admin_logs)

✅ Integrasi dengan bot Telegram (telegram_id)

✅ Integrasi dengan transaksi (refund, monitoring)

Skema ini siap diimplementasikan dengan Prisma, Sequelize, atau raw query sesuai pilihan Anda.

This response is AI-generated, for reference only.