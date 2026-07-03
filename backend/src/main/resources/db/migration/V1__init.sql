CREATE TABLE pr_users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE pr_papers (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES pr_users(id),
    title VARCHAR(500) NOT NULL,
    authors VARCHAR(2000),
    abstract_text TEXT,
    doi VARCHAR(500),
    year VARCHAR(50),
    journal VARCHAR(200),
    source_type VARCHAR(50) NOT NULL,
    source_url VARCHAR(1000),
    file_path VARCHAR(1000) NOT NULL,
    grobid_result JSONB,
    page_count INTEGER NOT NULL DEFAULT 0,
    file_size BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE pr_annotations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES pr_users(id),
    paper_id BIGINT NOT NULL REFERENCES pr_papers(id),
    page_number INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,
    color VARCHAR(20),
    position JSONB NOT NULL,
    text TEXT,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE pr_notes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES pr_users(id),
    paper_id BIGINT NOT NULL REFERENCES pr_papers(id),
    title VARCHAR(500),
    content TEXT NOT NULL,
    page_number INTEGER NOT NULL DEFAULT 0,
    chapter VARCHAR(500),
    tags VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE pr_reading_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES pr_users(id),
    paper_id BIGINT NOT NULL REFERENCES pr_papers(id),
    current_page INTEGER NOT NULL DEFAULT 1,
    total_pages INTEGER NOT NULL DEFAULT 0,
    duration_seconds BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE pr_ai_chats (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES pr_users(id),
    paper_id BIGINT,
    model VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE pr_ai_messages (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL REFERENCES pr_ai_chats(id),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE pr_user_settings (
    user_id BIGINT PRIMARY KEY REFERENCES pr_users(id),
    theme VARCHAR(10) NOT NULL DEFAULT 'light',
    language VARCHAR(10) NOT NULL DEFAULT 'zh',
    default_ai_model VARCHAR(50),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_papers_user_id ON pr_papers(user_id);
CREATE INDEX idx_annotations_paper_id ON pr_annotations(paper_id, user_id);
CREATE INDEX idx_notes_paper_id ON pr_notes(paper_id, user_id);
CREATE INDEX idx_notes_user_id ON pr_notes(user_id);
CREATE INDEX idx_reading_logs_user_id ON pr_reading_logs(user_id);
CREATE INDEX idx_ai_chats_user_id ON pr_ai_chats(user_id);
CREATE INDEX idx_ai_messages_chat_id ON pr_ai_messages(chat_id);
