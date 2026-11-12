CREATE TABLE orders (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id)
);
CREATE INDEX orders_user_id_idx ON orders (user_id);
