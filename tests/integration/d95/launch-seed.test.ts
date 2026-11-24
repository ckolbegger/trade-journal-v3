// @vitest-environment jsdom
// T95.28-F2 The app itself, not only Workspace.initialize, gives an existing Workspace the three revisions of manifest 6 on launch (I95.8 case 6, "on its next start").
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AppShell, type Screens } from '../../../src/ui/AppShell.tsx';
import { dumpAll, launch, w7Device } from '../d8/support.ts';
import { definitionsOf, REVISED } from './seed-support.ts';

afterEach(cleanup);

describe('T95.28-F2 launch seeding through the shell', () => {
  it('should give the workspace-v7 fixture its three revisions when the app opens it, with no migration', { timeout: 120_000 }, async () => {
    const d = await w7Device();
    const before = definitionsOf(await dumpAll(d.factory));
    const app = await launch(d);
    const screens = { trades: () => createElement('p', null, 'Trades screen') } as unknown as Screens;

    render(createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(AppShell, { facade: app, screens })));
    await screen.findByText('Trades screen');

    const stored = new Set(before.map((definition) => definition.id));
    const added = definitionsOf(await dumpAll(d.factory)).filter((definition) => !stored.has(definition.id));
    expect(added.map((definition) => definition.entryTypeKey).sort()).toEqual(REVISED);
  });
});
