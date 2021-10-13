# mkcontainer

Lightweight container builder for Linux backed by `make` and `systemd-nspawn`.

```
npm install -g mkcontainer
```

## Usage

First make sure you have `systemd-nspawn` installed.

Then make a `Containerfile` which has a format similar to a `Dockerfile`

```
FROM ubuntu:xenial
RUN rm -f /etc/resolv.conf && echo '8.8.8.8' > /etc/resolv.conf
RUN apt-get update
RUN apt-get install -y git vim curl
RUN curl -fs https://raw.githubusercontent.com/mafintosh/node-install/master/install | sh
RUN node-install 8.9.1
```

The above `Containerfile` installs Ubuntu 16.04 (xenial), then updates the name server so dns works, and installs
git, vim, curl and node 8.9.1.

To make a container from that `Containerfile` simply cd into the same dir and run

```sh
mkcontainer
```

This should produce a `Makefile`, that is automatically run and a container called `container.img`. The container is around 4GB but should be sparse (see `ls -lsh` for the actual size)

If you run `mkcontainer` again the build should be cached. Similar to docker, when you update a line in the `Containerfile` you cache invalidate
every line below it. There is a global cache for each layer stored in `~/.mkcontainer`

To run the produced container simply do `make run` but you can also run it with systemd, ie `sudo systemd-nspawn -a -i container.img /bin/bash`

## Containerfile

The `Containerfile` currently understands the following primitives

* `FROM os:version` - will bootstrap your container. `os` can be `Ubuntu`, `Arch`, `Alpine` and `Debian` currently. Note that `Arch` and `Alpine` doesn't have a version.
* `RUN cmd` - run a shell command inside the container
* `ENV name=value, name=value...` - set env vars for the script. You can use host env resolution in the values.
* `COPY from to` - copy a file into the container. `to` should be an absolute path.
* `MOUNT from to` - auto mount a folder from the host into the container when running
* `CMD cmd` - the command to execute when the container runs

## License

MIT
