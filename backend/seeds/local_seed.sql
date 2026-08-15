INSERT INTO users (id, email, password_hash, date_of_birth, account_status)
VALUES
  (1, 'maya@example.com', '$2a$12$replace_with_local_hash', '1998-04-15', 'active'),
  (2, 'arjun@example.com', '$2a$12$replace_with_local_hash', '1996-09-22', 'active'),
  (3, 'neha@example.com', '$2a$12$replace_with_local_hash', '1999-12-01', 'active');

INSERT INTO profiles (user_id, display_name, username, bio, location, profile_visibility)
VALUES
  (1, 'Maya Rao', 'maya', 'Building Zumers with friends.', 'Mumbai', 'friends'),
  (2, 'Arjun Mehta', 'arjun', 'Photos, videos, and everyday thoughts.', 'Delhi', 'friends'),
  (3, 'Neha Shah', 'neha', 'Here for meaningful conversations.', 'Bengaluru', 'friends');

INSERT INTO friendships (user_id, friend_id)
VALUES
  (1, 2),
  (1, 3);

INSERT INTO posts (author_id, content, visibility)
VALUES
  (1, 'First thought on Zumers.', 'friends'),
  (2, 'Testing the social feed foundation.', 'friends'),
  (3, 'Ready for Cloudinary media uploads next.', 'friends');

SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));
SELECT setval(pg_get_serial_sequence('profiles', 'id'), (SELECT MAX(id) FROM profiles));
SELECT setval(pg_get_serial_sequence('friendships', 'id'), (SELECT MAX(id) FROM friendships));
SELECT setval(pg_get_serial_sequence('posts', 'id'), (SELECT MAX(id) FROM posts));
