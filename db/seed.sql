-- Seed podaci za lokalni razvoj
INSERT INTO users (id, email, username, password_hash)
VALUES
  (1, 'ana@example.com', 'ana', '$2b$10$z6wF6I7M6R8kY2kg0uK2Y.3v5x7MCLM0QbV7R8f9jQ9CMX6L9iP6i'),
  (2, 'marko@example.com', 'marko', '$2b$10$z6wF6I7M6R8kY2kg0uK2Y.3v5x7MCLM0QbV7R8f9jQ9CMX6L9iP6i'),
  (4, 'milica@example.com', 'milica', '$2b$10$b5K7ydO443eBL/F90MucIeSKp/rsEq3N7CUGfe2ZkmFl63Z68lJcW'),
  (5, 'tamara@example.com', 'tamara', '$2b$10$b5K7ydO443eBL/F90MucIeSKp/rsEq3N7CUGfe2ZkmFl63Z68lJcW'),
  (6, 'aleksandra@example.com', 'aleksandra', '$2b$10$b5K7ydO443eBL/F90MucIeSKp/rsEq3N7CUGfe2ZkmFl63Z68lJcW'),
  (7, 'natalija@example.com', 'natalija', '$2b$10$b5K7ydO443eBL/F90MucIeSKp/rsEq3N7CUGfe2ZkmFl63Z68lJcW'),
  (8, 'marija@example.com', 'marija', '$2b$10$b5K7ydO443eBL/F90MucIeSKp/rsEq3N7CUGfe2ZkmFl63Z68lJcW'),
  (9, 'teodora@example.com', 'teodora', '$2b$10$b5K7ydO443eBL/F90MucIeSKp/rsEq3N7CUGfe2ZkmFl63Z68lJcW'),
  (10, 'jelena@example.com', 'jelena', '$2b$10$b5K7ydO443eBL/F90MucIeSKp/rsEq3N7CUGfe2ZkmFl63Z68lJcW'),
  (11, 'andjela@example.com', 'andjela', '$2b$10$b5K7ydO443eBL/F90MucIeSKp/rsEq3N7CUGfe2ZkmFl63Z68lJcW'),
  (12, 'nikolina@example.com', 'nikolina', '$2b$10$b5K7ydO443eBL/F90MucIeSKp/rsEq3N7CUGfe2ZkmFl63Z68lJcW')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (user_id, full_name, bio, avatar_url, is_private)
VALUES
  (1, 'Ana Markovic', 'Frontend engineer', '', FALSE),
  (2, 'Marko Jovanovic', 'Backend engineer', '', TRUE),
  (4, 'Milica Kostic', 'Travel and photo lover', 'http://localhost:3000/assets/milica.png', FALSE),
  (5, 'Tamara Majdak', 'Gym and wellness', 'http://localhost:3000/assets/tamara.jpeg', TRUE),
  (6, 'Aleksandra Acimovic', 'Reels and lifestyle', 'http://localhost:3000/assets/aleksandra.jpeg', FALSE),
  (7, 'Natalija Ristovic', 'Photography and fashion', 'http://localhost:3000/assets/natalija.jpeg', FALSE),
  (8, 'Marija Stevic', 'Beauty and daily moments', 'http://localhost:3000/assets/marija.jpeg', FALSE),
  (9, 'Teodora Ilic', 'Cafe hopping and outfits', 'http://localhost:3000/assets/teodora.svg', FALSE),
  (10, 'Jelena Petrovic', 'Weekend travel diary', 'http://localhost:3000/assets/jelena.svg', FALSE),
  (11, 'Andjela Nikolic', 'Private moments and close friends', 'http://localhost:3000/assets/andjela.svg', TRUE),
  (12, 'Nikolina Savic', 'Music, reels and city nights', 'http://localhost:3000/assets/nikolina.svg', FALSE)
ON CONFLICT (user_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM users), 12), true);
