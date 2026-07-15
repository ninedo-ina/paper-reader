-- 关注关系
CREATE TABLE pr_follows (
    id BIGSERIAL PRIMARY KEY,
    follower_id BIGINT NOT NULL REFERENCES pr_users(id),
    followee_id BIGINT NOT NULL REFERENCES pr_users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(follower_id, followee_id)
);

-- 私信
CREATE TABLE pr_messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id BIGINT NOT NULL REFERENCES pr_users(id),
    receiver_id BIGINT NOT NULL REFERENCES pr_users(id),
    content TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 群组
CREATE TABLE pr_groups (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    owner_id BIGINT NOT NULL REFERENCES pr_users(id),
    avatar_url VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 群成员
CREATE TABLE pr_group_members (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES pr_groups(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES pr_users(id),
    username VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(1000),
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- 群消息
CREATE TABLE pr_group_messages (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES pr_groups(id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES pr_users(id),
    username VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(1000),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_follows_follower ON pr_follows(follower_id);
CREATE INDEX idx_follows_followee ON pr_follows(followee_id);
CREATE INDEX idx_messages_sender ON pr_messages(sender_id);
CREATE INDEX idx_messages_receiver ON pr_messages(receiver_id);
CREATE INDEX idx_messages_conversation ON pr_messages(sender_id, receiver_id);
CREATE INDEX idx_group_members_group ON pr_group_members(group_id);
CREATE INDEX idx_group_members_user ON pr_group_members(user_id);
CREATE INDEX idx_group_messages_group ON pr_group_messages(group_id, created_at);
