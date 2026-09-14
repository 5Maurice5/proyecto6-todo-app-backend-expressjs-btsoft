CREATE TABLE tags (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    user_id CHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_tag_per_user
        UNIQUE (name, user_id),

    CONSTRAINT fk_tags_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);