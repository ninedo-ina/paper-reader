CREATE TABLE pr_forum_disciplines (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    en_name VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE pr_forum_topics (
    id BIGSERIAL PRIMARY KEY,
    discipline_id BIGINT NOT NULL REFERENCES pr_forum_disciplines(id),
    name VARCHAR(200) NOT NULL,
    en_name VARCHAR(200) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE pr_forum_posts (
    id BIGSERIAL PRIMARY KEY,
    topic_id BIGINT NOT NULL REFERENCES pr_forum_topics(id),
    user_id BIGINT NOT NULL REFERENCES pr_users(id),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    username VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(1000),
    like_count INT NOT NULL DEFAULT 0,
    comment_count INT NOT NULL DEFAULT 0,
    favorite_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE pr_forum_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES pr_forum_posts(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES pr_forum_comments(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES pr_users(id),
    content TEXT NOT NULL,
    username VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE pr_forum_likes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES pr_users(id),
    post_id BIGINT NOT NULL REFERENCES pr_forum_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

CREATE TABLE pr_forum_favorites (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES pr_users(id),
    post_id BIGINT NOT NULL REFERENCES pr_forum_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

CREATE INDEX idx_forum_topics_discipline ON pr_forum_topics(discipline_id);
CREATE INDEX idx_forum_posts_topic ON pr_forum_posts(topic_id);
CREATE INDEX idx_forum_posts_user ON pr_forum_posts(user_id);
CREATE INDEX idx_forum_comments_post ON pr_forum_comments(post_id);
CREATE INDEX idx_forum_comments_parent ON pr_forum_comments(parent_id);

-- Seed disciplines (8)
INSERT INTO pr_forum_disciplines (id, name, en_name, sort_order) VALUES
(1, '计算机科学', 'Computer Science', 1),
(2, '数学', 'Mathematics', 2),
(3, '物理学', 'Physics', 3),
(4, '生物学', 'Biology', 4),
(5, '化学', 'Chemistry', 5),
(6, '经济学', 'Economics', 6),
(7, '医学', 'Medicine', 7),
(8, '其他学科', 'Others', 8);

-- Seed topics
INSERT INTO pr_forum_topics (id, discipline_id, name, en_name, sort_order) VALUES
(1, 1, '人工智能', 'Artificial Intelligence', 1),
(2, 1, '机器学习', 'Machine Learning', 2),
(3, 1, '计算机视觉', 'Computer Vision', 3),
(4, 1, '自然语言处理', 'NLP', 4),
(5, 2, '代数', 'Algebra', 1),
(6, 2, '几何', 'Geometry', 2),
(7, 2, '数论', 'Number Theory', 3),
(8, 3, '量子力学', 'Quantum Mechanics', 1),
(9, 3, '天体物理', 'Astrophysics', 2),
(10, 3, '凝聚态物理', 'Condensed Matter', 3),
(11, 4, '分子生物学', 'Molecular Biology', 1),
(12, 4, '遗传学', 'Genetics', 2),
(13, 4, '生态学', 'Ecology', 3),
(14, 5, '有机化学', 'Organic Chemistry', 1),
(15, 5, '无机化学', 'Inorganic Chemistry', 2),
(16, 6, '宏观经济学', 'Macroeconomics', 1),
(17, 6, '微观经济学', 'Microeconomics', 2),
(18, 7, '临床医学', 'Clinical Medicine', 1),
(19, 7, '流行病学', 'Epidemiology', 2),
(20, 8, '交叉学科', 'Interdisciplinary', 1);
