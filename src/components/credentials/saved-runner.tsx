"use client";

import { useEffect, useState } from "react";
import type { Manifest } from "../../lib/manifest/types";
import { CredentialDialog } from "./credential-dialog";
import { RunPanel } from "../builder/run-panel";

const SESSION_KEY = "jev-typesafe-session-key";

export function SavedRunner({ manifest, interfaceId, versionId }: { manifest: Manifest; interfaceId: string; versionId: string }) {
  const [apiKey, setApiKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) { setApiKey(saved); setRemember(true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  function changeKey(value: string) {
    setApiKey(value);
    if (remember) {
      if (value) sessionStorage.setItem(SESSION_KEY, value);
      else sessionStorage.removeItem(SESSION_KEY);
    }
  }
  function changeRemember(value: boolean) {
    setRemember(value);
    if (value && apiKey) sessionStorage.setItem(SESSION_KEY, apiKey);
    else sessionStorage.removeItem(SESSION_KEY);
  }
  function clear() { setApiKey(""); setRemember(false); sessionStorage.removeItem(SESSION_KEY); }
  return <>
    <RunPanel manifest={manifest} stateText={JSON.stringify(manifest.stateTemplate)} apiKey={apiKey} onOpenKey={() => setOpen(true)}
      runPath={`/api/runtime/interfaces/${interfaceId}/versions/${versionId}`} />
    <CredentialDialog open={open} onClose={() => setOpen(false)} apiKey={apiKey} onKeyChange={changeKey}
      rememberSession={remember} onRememberChange={changeRemember} onClear={clear} />
  </>;
}
