CREATE TABLE tags_task (
    tag_id CHAR(36) NOT NULL,
    task_id CHAR(36) NOT NULL,

    PRIMARY KEY (tag_id, task_id),

    CONSTRAINT fk_tags_task_tag
        FOREIGN KEY (tag_id)
        REFERENCES tags(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_tags_task_task
        FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE
);