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
# On INT, TERM or HUP the wrapper sends TERM to the command's whole process group (the
# command runs in its own group) and to every descendant found by parent PID (so one that moved to its
# own group or session is ended too), gives them 5 s from the signal to end (TJ_BROWSER_LOCK_GRACE
# overrides the 5, in seconds, for tests of this script only), KILLs what remains, waits for it, and only
# then exits with the command's status and releases the lock. A command that ignores TERM is KILLed
# when the grace period ends. A signal that arrives between the fork and the exec is held until the
# command's group exists, then acted on. When the lock file cannot be locked for any reason but another
# holder (flock fails other than EWOULDBLOCK) the wrapper prints a message and exits 2 without waiting.
# TJ_BROWSER_LOCK_TEST_CHILD_PAUSE=<seconds> holds the forked command before its exec (tests only).
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
use POSIX ();
my $lock = shift @ARGV;
sysopen(my $fh, $lock, O_RDWR | O_CREAT, 0644) or do { print STDERR "with-browser-lock: cannot open $lock: $!\n"; exit 2 };
use Time::HiRes qw(time);
my ($child, $signalled, $newsig, $waiting, $sigtime) = (0, 0, 0, 1, 0);
my $grace = ($ENV{TJ_BROWSER_LOCK_GRACE} // "") =~ /^\d+(\.\d+)?$/ ? $ENV{TJ_BROWSER_LOCK_GRACE} : 5;
# The handler only records the signal; the loop below acts on it within one poll.
$SIG{$_} = sub { exit 130 if $waiting; $sigtime = time unless $signalled; $signalled = 1; $newsig = 1 } for qw(INT TERM HUP);
my $own_pgrp = getpgrp();
my %known;   # pid => process group of every descendant of the command seen so far (found by parent PID)
# Find the descendants of the command by walking parent PIDs, so one that moved to its own process group or
# session (Playwright starts its browsers that way) is still found. Descendants already known stay known
# and seed the walk, so a child whose parent has died (now a child of PID 1) is still followed.
sub snapshot {
  open(my $ps, "-|", "/bin/ps", "-axo", "pid=,ppid=,pgid=") or return;
  my (%kids, %pgid);
  while (<$ps>) { my ($p, $pp, $g) = split; next unless defined $g; push @{$kids{$pp}}, $p; $pgid{$p} = $g; }
  close $ps;
  my %seen;
  my @queue = grep { exists $pgid{$_} } ($child, keys %known);
  while (defined(my $p = shift @queue)) {
    next if $seen{$p}++;
    for my $k (@{$kids{$p} // []}) { $known{$k} = $pgid{$k}; push @queue, $k; }
  }
}
# Signal the command group, every known descendant and each descendant group (never the group of this wrapper).
sub signal_all {
  my $sig = shift;
  kill $sig, -$child;
  for my $p (keys %known) { my $g = $known{$p}; kill $sig, $p; kill $sig, -$g if $g > 1 && $g != $own_pgrp; }
}
sub alive {
  return 1 if kill(0, -$child);
  for my $p (keys %known) { my $g = $known{$p}; return 1 if kill(0, $p) || ($g > 1 && $g != $own_pgrp && kill(0, -$g)); }
  return 0;
}
my $announced = 0;
until (flock($fh, LOCK_EX | LOCK_NB)) {
  next if $!{EINTR};
  unless ($!{EWOULDBLOCK}) { print STDERR "with-browser-lock: cannot lock $lock: $!\n"; exit 2 }   # not contention: do not wait
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
# INT, TERM and HUP stay blocked from here until the command exists as a process group, so a signal in
# the window between fork and exec is neither lost nor taken by a handler copied into the command: the
# child resets the handlers to the default before it unblocks, and the wrapper acts on a signal that
# arrived meanwhile (kept pending) once the group is there.
my $sigs = POSIX::SigSet->new(POSIX::SIGINT(), POSIX::SIGTERM(), POSIX::SIGHUP());
my $oldmask = POSIX::SigSet->new();
POSIX::sigprocmask(POSIX::SIG_BLOCK(), $sigs, $oldmask);
$waiting = 0;
$child = fork();
die "with-browser-lock: fork failed: $!\n" unless defined $child;
if ($child == 0) {
  $SIG{$_} = "DEFAULT" for qw(INT TERM HUP);
  POSIX::sigprocmask(POSIX::SIG_SETMASK(), $oldmask);
  if (my $p = $ENV{TJ_BROWSER_LOCK_TEST_CHILD_PAUSE}) { my $end = time + $p; select(undef, undef, undef, 0.05) while time < $end; }  # tests only
  setpgrp(0, 0);                    # own process group, so the wrapper can signal every descendant
  $ENV{TJ_BROWSER_LOCK_HELD} = 1;   # $fh is close-on-exec, so the command does not hold the lock
  { no warnings "exec"; exec { $ARGV[0] } @ARGV; }
  print STDERR "with-browser-lock: cannot run $ARGV[0]: $!\n";
  exit 127;
}
setpgrp($child, $child);            # also from this side, so the group exists whichever process runs first
POSIX::sigprocmask(POSIX::SIG_SETMASK(), $oldmask);
# On a signal, record the descendants first (before the command can end and orphan them), then send TERM.
sub act_on_signal { return unless $newsig; $newsig = 0; snapshot(); signal_all("TERM"); }
# Poll for the command instead of blocking, so the grace period runs from the signal even while the
# command is still alive: once $grace seconds have passed since TERM, KILL the whole group and every
# known descendant.
my ($status, $killed, $lastsnap) = (0, 0, 0);
while (1) {
  act_on_signal();
  my $r = waitpid($child, POSIX::WNOHANG());
  if ($r == $child) { $status = $?; last }
  last if $r == -1 && !$!{EINTR};
  if ($signalled) {
    if (time - $lastsnap >= 0.25) { snapshot(); $lastsnap = time; }
    if (!$killed && time >= $sigtime + $grace) { signal_all("KILL"); $killed = 1; }
  }
  select(undef, undef, undef, 0.05);
}
act_on_signal();
if ($signalled) {
  # Release the lock only once no process of the command is left, in its group or in a group of its own:
  # TERM was sent, give them until the grace period ends, then KILL what remains.
  my $deadline = $sigtime + $grace;
  while (1) { snapshot(); last unless alive() && time < $deadline; select(undef, undef, undef, 0.2); }
  if (alive()) { signal_all("KILL"); my $stop = time + 5; select(undef, undef, undef, 0.05) while alive() && time < $stop; }
}
exit(($status & 127) ? 128 + ($status & 127) : $status >> 8);
' -- "$lock" "$@"
