#!/bin/bash
# usage: with-browser-lock.sh <command...>
# Runs the command while holding the one lock that serializes every user of port 5175: the test
# servers, the tj-release cache in the temp directory, and the CDP ports 9341 and 9342 (decision 111).
# The lock is a kernel lock (flock, taken by this wrapper through Perl) on the file
# <temp dir>/tj-browser-lock-5175.flock. The wrapper holds it while the command runs; the command does
# not inherit it. A second caller waits until it is released. The kernel releases the lock when the
# wrapper dies, whatever the cause (SIGKILL included), so there is no takeover, no stale-lock check and
# no age limit. The file's content is the holder's PID, read only for the waiting message; it never
# decides who holds the lock. The command's exit code is passed through (128+n when a signal n ended it).
# On INT, TERM or HUP the wrapper sends TERM to the command, waits for it, and exits with its status.
# The temp directory is the user's own (`getconf DARWIN_USER_TEMP_DIR`, symlinks resolved), not the
# current $TMPDIR, so every process of this user finds the same lock whichever worktree or sandbox
# it runs from. TJ_BROWSER_LOCK_DIR overrides the lock file's path (for tests of this script only).
# A command run inside the lock sees TJ_BROWSER_LOCK_HELD=1 and runs without taking it again, so
# wrapping a command that itself wraps its browser stages does not deadlock.
set -u
(( $# >= 1 )) || { echo "usage: $0 <command...>" >&2; exit 2; }
[[ -n "${TJ_BROWSER_LOCK_HELD:-}" ]] && exec "$@"

base=$(getconf DARWIN_USER_TEMP_DIR 2>/dev/null) || base=""
[[ -d "$base" ]] || base=${TMPDIR:-/tmp}
base=$(cd "$base" && pwd -P) || { echo "with-browser-lock: no temp directory" >&2; exit 2; }
lock=${TJ_BROWSER_LOCK_DIR:-$base/tj-browser-lock-5175.flock}

exec /usr/bin/perl -e '
use strict; use warnings;
use Fcntl qw(:flock O_RDWR O_CREAT);
my $lock = shift @ARGV;
sysopen(my $fh, $lock, O_RDWR | O_CREAT, 0644) or do { print STDERR "with-browser-lock: cannot open $lock: $!\n"; exit 2 };
my ($child, $signalled, $waiting) = (0, 0, 1);
$SIG{$_} = sub { exit 130 if $waiting; $signalled = 1; kill "TERM", $child if $child } for qw(INT TERM HUP);
my $announced = 0;
until (flock($fh, LOCK_EX | LOCK_NB)) {
  unless ($announced) {
    my $pid = "?";
    if (open(my $r, "<", $lock)) { my $l = <$r>; if (defined $l) { chomp $l; $pid = $l if $l =~ /^\d+$/ } }
    print STDERR "with-browser-lock: waiting for the lock held by process $pid ($lock)\n";
    $announced = 1;
  }
  select(undef, undef, undef, 0.25);
}
truncate($fh, 0); sysseek($fh, 0, 0); syswrite($fh, "$$\n");
print STDERR "with-browser-lock: acquired\n" if $announced;
$waiting = 0;
$child = fork();
die "with-browser-lock: fork failed: $!\n" unless defined $child;
if ($child == 0) {
  $ENV{TJ_BROWSER_LOCK_HELD} = 1;   # $fh is close-on-exec, so the command does not hold the lock
  { no warnings "exec"; exec { $ARGV[0] } @ARGV; }
  print STDERR "with-browser-lock: cannot run $ARGV[0]: $!\n";
  exit 127;
}
kill "TERM", $child if $signalled;
while (1) { my $r = waitpid($child, 0); last if $r == $child || ($r == -1 && !$!{EINTR}); }
exit(($? & 127) ? 128 + ($? & 127) : $? >> 8);
' -- "$lock" "$@"
