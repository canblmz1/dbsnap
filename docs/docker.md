# Docker

Docker mode lets dbsnap use PostgreSQL tools inside a matching local PostgreSQL container.

```bash
dbsnap save docker-ready --docker
dbsnap restore docker-ready --docker --yes
```

## Detection

dbsnap runs `docker ps` with a parseable format and matches the exposed port to the port in `DATABASE_URL`.

If multiple containers expose the same port, dbsnap stops and asks you to make the environment less ambiguous.

## Fallback

When local `pg_dump` or `pg_restore` is missing, dbsnap tries Docker automatically unless `--no-docker` is passed.

## Safety

Docker support still obeys the same restore safety guard. Remote-looking or production-looking targets are blocked unless forced.

## Windows Docker Desktop

Docker mode is designed to work on Windows through Docker Desktop. dbsnap avoids shell pipelines and streams dump files through spawned `docker` commands, but port matching still depends on the host port shown by `docker ps`. If Docker Desktop is running but `dbsnap doctor` reports the daemon unavailable, check that Docker Desktop has finished starting and that the current terminal can run `docker info`.
