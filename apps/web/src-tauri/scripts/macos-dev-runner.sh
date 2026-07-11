#!/bin/sh
set -eu

binary="$1"
shift

case "$(uname -s)" in
Darwin)
	exec -a "CV Tailor" "$binary" "$@"
	;;
*)
	exec "$binary" "$@"
	;;
esac
