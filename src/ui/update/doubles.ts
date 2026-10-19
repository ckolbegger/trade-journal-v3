// Doubles for the service-worker registration, the container's controllerchange, and the
// BroadcastChannel tabs use to share unsaved-work state. Real-browser behavior is proven in the
// browser suite (B1.10–B1.13).
export class FakeWorker {
  readonly messages: unknown[] = [];
  postMessage(message: unknown) {
    this.messages.push(message);
  }
}

export class FakeRegistration extends EventTarget {
  waiting: FakeWorker | null = null;
  updates = 0;
  update() {
    this.updates++;
    return Promise.resolve();
  }
  // A verified release finished installing and now waits.
  releaseWaiting() {
    this.waiting = new FakeWorker();
    this.dispatchEvent(new Event('updatefound'));
  }
}

export class FakeContainer extends EventTarget {
  controllerChange() {
    this.dispatchEvent(new Event('controllerchange'));
  }
}

// An in-memory BroadcastChannel network: every channel of one network sees the others' messages.
export class ChannelNetwork {
  private readonly members = new Set<FakeChannel>();
  open(): FakeChannel {
    const channel = new FakeChannel(this.members);
    this.members.add(channel);
    return channel;
  }
}

export class FakeChannel extends EventTarget {
  private readonly members: Set<FakeChannel>;
  constructor(members: Set<FakeChannel>) {
    super();
    this.members = members;
  }
  postMessage(data: unknown) {
    for (const member of this.members) {
      if (member !== this) member.dispatchEvent(new MessageEvent('message', { data }));
    }
  }
  close() {
    this.members.delete(this);
  }
}
