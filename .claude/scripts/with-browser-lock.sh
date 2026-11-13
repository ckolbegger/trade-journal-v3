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
# command runs in its own group) and to every process that still belongs to the command: a descendant
# found by parent PID (so one in its own group or session is ended too), one that carries the command's
# environment token TJ_BROWSER_LOCK_TOKEN (so one whose parent died before the signal is found, if it
# did not scrub its environment and ps -E can show it: node and browsers yes, Apple system binaries no),
# or one seen by the periodic scan (about once a second while the command runs) whose start time is
# unchanged. Each signal is preceded by a fresh scan, so a PID that ended and was reused is never
# signalled. The wrapper gives them 5 s from the signal to end (TJ_BROWSER_LOCK_GRACE overrides the 5, in
# seconds, for tests of this script only), KILLs what remains, waits for it, and only then exits with the
# command's status and releases the lock. A command that ignores TERM is KILLed when the grace period
# ends. A signal that arrives between the fork and the exec is held until the command's group exists,
# then acted on. A descendant that is born and loses its parent within one scan interval and has no
# readable token (a system binary) can still be missed. When the lock file cannot be locked for any reason
# but another holder (flock fails other than EWOULDBLOCK) the wrapper prints a message and exits 2 without
# waiting. Tests only: TJ_BROWSER_LOCK_TEST_CHILD_PAUSE=<seconds> holds the forked command before its exec,
# TJ_BROWSER_LOCK_TEST_PARENT_PAUSE=<seconds> holds the wrapper between the fork and its setpgrp (both with
# INT, TERM and HUP blocked), and TJ_BROWSER_LOCK_TEST_STALE_PID=<pid> plants a remembered process that
# is not a descendant.
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
# Every process of the command carries this token in its environment. ps -E shows it for the processes
# that allow it (node and a browser do; Apple system binaries such as sleep do not), so it finds a
# descendant that lost its parent before any signal, as long as it did not scrub its environment.
my $token = "$$-" . int(rand(1e9)) . "-" . int(time);
my %known;   # pid => start time of every process of the command seen so far: what tells it from a reused PID
my %sent;    # "signal pid start" of each signal already sent, so a process gets each signal once
my $reaped = 0;
%known = ($ENV{TJ_BROWSER_LOCK_TEST_STALE_PID} => "stale") if ($ENV{TJ_BROWSER_LOCK_TEST_STALE_PID} // "") =~ /^\d+$/;  # tests only
# The processes that belong to the command right now, as {pid => {pgid, start}}. A process belongs when it
# is the command, is in the command group, carries the token, is a child of one that belongs (so one in
# its own group or session is found), or was seen before and its start time is unchanged (so one whose
# parent died and is now a child of PID 1 stays found). %known is rebuilt from the result, so a PID that
# ended, even if another process uses it now, is dropped and never signalled.
sub scan {
  open(my $ps, "-|", "/bin/ps", "-axwwE", "-o", "pid=,ppid=,pgid=,stat=,lstart=,command=") or return {};
  my (%p, %kids);
  while (<$ps>) {
    next unless /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\w{3}\s+\w{3}\s+\d+\s+[\d:]+\s+\d{4})\s*(.*)$/s;
    my ($pid, $ppid, $pgid, $stat, $start, $rest) = ($1, $2, $3, $4, $5, $6);
    next if $stat =~ /^Z/;
    $p{$pid} = { pgid => $pgid, start => $start, token => ($rest =~ /(?:^|\s)\QTJ_BROWSER_LOCK_TOKEN=$token\E(?:\s|$)/ ? 1 : 0) };
    push @{$kids{$ppid}}, $pid;
  }
  close $ps;
  my (%member, @queue);
  my $add = sub { my $x = shift; return if $x == $$ || $member{$x}++; push @queue, $x; };
  for my $x (keys %p) {
    $add->($x) if $p{$x}{token}
      || ($p{$x}{pgid} == $child && ($x != $child || !$reaped))
      || (($known{$x} // "") eq $p{$x}{start});
  }
  $add->($child) if !$reaped && exists $p{$child};
  while (defined(my $x = shift @queue)) { $add->($_) for @{$kids{$x} // []}; }
  %known = map { $_ => $p{$_}{start} } keys %member;
  return { map { $_ => $p{$_} } keys %member };
}
# Scan, then send the signal to each process that still belongs to the command and has not had it yet,
# so a reused PID is never signalled. Returns how many processes belong.
sub signal_all {
  my $sig = shift;
  my $m = scan();
  for my $x (keys %$m) { kill $sig, $x unless $sent{"$sig $x $m->{$x}{start}"}++; }
  kill $sig, -$child if $child != $own_pgrp && grep { $m->{$_}{pgid} == $child } keys %$m;
  return scalar keys %$m;
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
  if (my $p = $ENV{TJ_BROWSER_LOCK_TEST_CHILD_PAUSE}) { my $end = time + $p; select(undef, undef, undef, 0.05) while time < $end; }  # tests only, signals still blocked
  $SIG{$_} = "DEFAULT" for qw(INT TERM HUP);
  POSIX::sigprocmask(POSIX::SIG_SETMASK(), $oldmask);
  setpgrp(0, 0);                    # own process group, so the wrapper can signal every descendant
  $ENV{TJ_BROWSER_LOCK_HELD} = 1;   # $fh is close-on-exec, so the command does not hold the lock
  $ENV{TJ_BROWSER_LOCK_TOKEN} = $token;   # marks every process of the command, whatever becomes of its parent
  { no warnings "exec"; exec { $ARGV[0] } @ARGV; }
  print STDERR "with-browser-lock: cannot run $ARGV[0]: $!\n";
  exit 127;
}
if (my $p = $ENV{TJ_BROWSER_LOCK_TEST_PARENT_PAUSE}) { my $end = time + $p; select(undef, undef, undef, 0.05) while time < $end; }  # tests only, signals still blocked
setpgrp($child, $child);            # also from this side, so the group exists whichever process runs first
POSIX::sigprocmask(POSIX::SIG_SETMASK(), $oldmask);
# On a signal, scan for what belongs to the command and send it TERM.
sub act_on_signal { return unless $newsig; $newsig = 0; signal_all("TERM"); }
# Poll for the command instead of blocking, so the grace period runs from the signal even while the
# command is still alive. Until a signal, scan about once a second (a ps costs about 30 ms), so a
# descendant that later loses its parent is already known; after one, scan four times a second, TERM
# what is new, and once $grace seconds have passed since the signal KILL everything that belongs.
my ($status, $killed, $nextscan) = (0, 0, 0);
while (1) {
  act_on_signal();
  my $r = waitpid($child, POSIX::WNOHANG());
  if ($r == $child) { $status = $?; $reaped = 1; last }
  if ($r == -1 && !$!{EINTR}) { $reaped = 1; last }
  if (time >= $nextscan) {
    if ($signalled) { signal_all($killed ? "KILL" : "TERM"); $nextscan = time + 0.25; }
    else { scan(); $nextscan = time + 1; }
  }
  if ($signalled && !$killed && time >= $sigtime + $grace) { signal_all("KILL"); $killed = 1; }
  select(undef, undef, undef, 0.05);
}
act_on_signal();
if ($signalled) {
  # Release the lock only once nothing that belongs to the command is left, in its group or not:
  # TERM went out, give them until the grace period ends, then KILL what remains and wait up to 5 s more.
  my ($deadline, $stop) = ($sigtime + $grace, 0);
  while (signal_all(time >= $deadline ? "KILL" : "TERM")) {
    if (time >= $deadline) { $stop ||= time + 5; last if time >= $stop; }
    select(undef, undef, undef, 0.2);
  }
}
exit(($status & 127) ? 128 + ($status & 127) : $status >> 8);
' -- "$lock" "$@"
