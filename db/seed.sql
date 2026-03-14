-- Seed podaci za lokalni razvoj
INSERT INTO users (id, email, username, password_hash)
VALUES
  (1, 'ana@example.com', 'ana', '$2b$10$z6wF6I7M6R8kY2kg0uK2Y.3v5x7MCLM0QbV7R8f9jQ9CMX6L9iP6i'),
  (2, 'marko@example.com', 'marko', '$2b$10$z6wF6I7M6R8kY2kg0uK2Y.3v5x7MCLM0QbV7R8f9jQ9CMX6L9iP6i')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (user_id, full_name, bio, avatar_url, is_private)
VALUES
  (1, 'Ana Markovic', 'Frontend engineer', '', FALSE),
  (2, 'Marko Jovanovic', 'Backend engineer', '', TRUE)
ON CONFLICT (user_id) DO NOTHING;
