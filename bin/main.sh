set -e
mkcontainer-generate "$@"
sudo true # we need sudo later so prompt now before output
make || (rm -f tmp.img && exit 1)
