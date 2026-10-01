# rabbitmq

`rabbitmq-init/definitions.json` is loaded at boot (`load_definitions`) and provisions:

| object   | value                                                  |
| -------- | ------------------------------------------------------ |
| vhost    | `bf`                                                   |
| user     | `bf` / `bf` (tag `administrator`, full perms on `bf`)  |
| exchange | `bf.events` (topic, durable)                           |
| queue    | `bf.orders` (quorum, durable)                          |
| binding  | `bf.events` -> `bf.orders` with routing key `orders.#` |

Management UI: http://localhost:15672 (login `bf` / `bf`).

## Password hash

Definitions files do not accept plaintext passwords, only `password_hash`.
The hash for `bf` was generated with (algorithm `rabbit_password_hashing_sha256`:
`base64(salt(4 bytes) + sha256(salt + password))`):

```sh
python3 -c "
import os, hashlib, base64
salt = os.urandom(4)
print(base64.b64encode(salt + hashlib.sha256(salt + b'bf').digest()).decode())
"
```

Paste the output into `users[0].password_hash`. Alternatively, after changing the password
in the UI, export via **Overview -> Export definitions** and copy the hash from there.

Definitions are only imported on boot; existing objects are never deleted, so edits to the
file are additive.
