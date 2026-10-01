FROM redis:7.4.5

# Custom entrypoint generates redis.conf + ACL file from env vars at container start.
COPY redis-init/custom-entrypoint.sh /usr/local/bin/custom-entrypoint.sh
RUN chmod +x /usr/local/bin/custom-entrypoint.sh

ENTRYPOINT ["custom-entrypoint.sh"]
