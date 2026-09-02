// The management page's state, from the browser's own enterprise handler.
//
// Different in kind from every other store in this app, and the difference is
// the point: this page adopts `ManagementUIHandler` wholesale rather than
// speaking a typed Astro interface, so the transport is `cr.sendWithPromise`
// and the shapes below are UPSTREAM's, transcribed from the replies the real
// browser sends rather than from a reading of the C++.
//
// Measured on the shipped binary with an unmanaged profile, which is what
// every field's "empty" case below is taken from:
//
//   getContextualManagedData  {managed: false, pageSubtitle: "Your browser is
//                             not managed", …four subtitle strings…}
//   getExtensions             []
//   getManagedWebsites        []
//   getApplications           []
//   getThreatProtectionInfo   {description: "…Chrome Enterprise Connectors…",
//                              info: []}
//   initBrowserReportingInfo  []
//   initProfileReportingInfo  []
//
// THE MANAGED PATH IS NOT VERIFIED HERE, and saying so is better than implying
// it is: producing a non-empty reply needs an enterprise policy this machine
// does not have. To capture it, run the browser with a policy directory —
// `--user-data-dir` plus a JSON policy under `/etc/chromium/policies/managed/`
// setting e.g. `CloudReportingEnabled` — and re-read the same seven messages
// with tools/cdp-navigate.py.

import {sendWithPromise} from '@astro/platform';
import {useSyncExternalStore} from 'react';

/** An extension or an app the administrator installed. */
export interface ManagedItem {
  readonly name: string;
  readonly permissions: readonly string[];
}

/**
 * One row of a reporting list.
 *
 * `messageId` is a GRIT string name, not text — upstream's page resolves it
 * through `loadTimeData`, and this page can too because its C++ controller
 * adds the same table with upstream's `remove_links=true` variants. A row whose
 * id the table does not carry renders its id, which is ugly and honest; the
 * alternative is a blank row that looks like a browser reporting nothing.
 */
export interface ReportingRow {
  readonly messageId: string;
  readonly reportingType: string;
}

export interface ThreatProtectionRow {
  readonly title: string;
  readonly permission: string;
}

export interface ManagementState {
  readonly ready: boolean;
  /** The browser's own answer to "is this browser managed". */
  readonly managed: boolean;
  /** The browser's own one-line status, e.g. "Your browser is not managed". */
  readonly pageSubtitle: string;
  readonly extensionReportingSubtitle: string;
  readonly applicationReportingSubtitle: string;
  readonly managedWebsitesSubtitle: string;
  readonly extensions: readonly ManagedItem[];
  readonly applications: readonly ManagedItem[];
  readonly managedWebsites: readonly string[];
  readonly browserReporting: readonly ReportingRow[];
  readonly profileReporting: readonly ReportingRow[];
  readonly threatProtectionDescription: string;
  readonly threatProtection: readonly ThreatProtectionRow[];
}

const EMPTY: ManagementState = {
  ready: false,
  // Not `false`. Rendering "not managed" before the browser has answered would
  // state the reassuring answer to a question about who controls the browser,
  // which is the one direction of that mistake that matters.
  managed: false,
  pageSubtitle: '',
  extensionReportingSubtitle: '',
  applicationReportingSubtitle: '',
  managedWebsitesSubtitle: '',
  extensions: [],
  applications: [],
  managedWebsites: [],
  browserReporting: [],
  profileReporting: [],
  threatProtectionDescription: '',
  threatProtection: [],
};

let snapshot: ManagementState = EMPTY;
const listeners = new Set<() => void>();
let started = false;

function publish(patch: Partial<ManagementState>): void {
  snapshot = {...snapshot, ...patch};
  for (const listener of listeners) {
    listener();
  }
}

interface ManagedData {
  managed: boolean;
  pageSubtitle: string;
  extensionReportingSubtitle: string;
  applicationReportingSubtitle: string;
  managedWebsitesSubtitle: string;
}

interface ThreatProtectionInfo {
  description: string;
  info: ThreatProtectionRow[];
}

function start(): void {
  if (started) {
    return;
  }
  started = true;

  // No feature detection here on purpose. `sendWithPromise` resolves the
  // bridge itself and refuses loudly when chrome.send is absent -- a second
  // check in every store would be the same decision made in two places, and
  // the one that drifted would be the one nobody read.

  void Promise.all([
    sendWithPromise<ManagedData>('getContextualManagedData'),
    sendWithPromise<ManagedItem[]>('getExtensions'),
    sendWithPromise<ManagedItem[]>('getApplications'),
    sendWithPromise<string[]>('getManagedWebsites'),
    sendWithPromise<ReportingRow[]>('initBrowserReportingInfo'),
    sendWithPromise<ReportingRow[]>('initProfileReportingInfo'),
    sendWithPromise<ThreatProtectionInfo>('getThreatProtectionInfo'),
  ]).then(
    ([
      managedData,
      extensions,
      applications,
      managedWebsites,
      browserReporting,
      profileReporting,
      threatProtection,
    ]) => {
      publish({
        ready: true,
        managed: managedData.managed,
        pageSubtitle: managedData.pageSubtitle,
        extensionReportingSubtitle: managedData.extensionReportingSubtitle,
        applicationReportingSubtitle: managedData.applicationReportingSubtitle,
        managedWebsitesSubtitle: managedData.managedWebsitesSubtitle,
        extensions,
        applications,
        managedWebsites,
        browserReporting,
        profileReporting,
        threatProtectionDescription: threatProtection.description,
        threatProtection: threatProtection.info,
      });
    },
  );
}

export function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): ManagementState {
  return snapshot;
}

/** The live management state. */
export function useManagement(): ManagementState {
  return useSyncExternalStore(subscribe, getSnapshot);
}
